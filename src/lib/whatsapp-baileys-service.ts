import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import { processMerchantWhatsAppMessage } from './whatsapp-merchant-copilot';
import { processCustomerMessage } from './ai-sales-engine';
import { query } from './db';

const AUTH_DIR = path.join(process.cwd(), 'baileys_auth');

export type WhatsAppBotStatus = 'idle' | 'starting' | 'qr_ready' | 'connected' | 'error';

export interface WhatsAppStatusResponse {
  status: WhatsAppBotStatus;
  qrDataUrl: string | null;
  phone: string | null;
  userName: string | null;
  lastError: string | null;
  uptime?: number;
}

/**
 * Smart Commerce & Privacy Intent Filter
 * Protects personal/family/friends chats on private WhatsApp accounts.
 * The AI Sales Engine ONLY replies if the message is genuinely about shopping,
 * Facebook ads/posts, products, pricing, orders, or delivery.
 */
export function isCommerceOrShopInquiry(text: string, hasPriorConversation: boolean): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();

  // If this customer already has an active ongoing conversation in database, continue dialogue
  if (hasPriorConversation) {
    return true;
  }

  // 1. Facebook CTA / Lead / Ad Referral patterns
  const fbPatterns = [
    'facebook', 'ফেসবুক', 'fb', 'saw this on', 'interested in', 'page', 'পেজ',
    'post', 'পোস্ট', 'ad', 'বিজ্ঞাপন', 'saw this post'
  ];
  if (fbPatterns.some((pattern) => lower.includes(pattern))) {
    return true;
  }

  // 2. Clear Commerce, Shopping, Pricing, Product, and Order Keywords
  const commerceKeywords = [
    // Pricing & Cost
    'দাম', 'dam', 'rate', 'price', 'cost', 'koto', 'কত', 'tk', 'টাকা', 'taka',
    // Order & Purchasing
    'order', 'অর্ডার', 'অডার', 'কিনতে', 'kinte', 'নিতে', 'nite', 'buy', 'purchase',
    'booking', 'বুকিং', 'confirm', 'কনফার্ম', 'চাই', 'lagbe', 'লাগবে',
    // Product & Stock Details
    'product', 'প্রোডাক্ট', 'পণ্য', 'item', 'details', 'বিস্তারিত', 'ছবি', 'pic',
    'photo', 'picture', 'stock', 'স্টক', 'available', 'পাওয়া যাবে', 'pawa jabe',
    'size', 'সাইজ', 'colour', 'color', 'কালার',
    // Delivery & Payment
    'delivery', 'ডেলিভারি', 'charge', 'চার্জ', 'courier', 'কুরিয়ার', 'steadfast',
    'redx', 'pathao', 'ক্যাশ অন', 'cash on', 'cod', 'bkash', 'বিকাশ', 'nagad', 'নগদ', 'payment', 'পেমেন্ট',
    // Catalog & Store
    'shop', 'শপ', 'দোকান', 'catalogue', 'ক্যাটালগ', 'মেনু', 'menu', 'discount', 'অফার', 'offer',
    // Common garments & merchandise
    'shirt', 'শার্ট', 'panjabi', 'পাঞ্জাবি', 'saree', 'শাড়ি', 'dress', 'ঘড়ি', 'watch', 'shoe', 'জুতা', 't-shirt'
  ];

  return commerceKeywords.some((kw) => lower.includes(kw));
}

class WhatsAppBotService {
  private sock: WASocket | null = null;
  public status: WhatsAppBotStatus = 'idle';
  public qrRaw: string | null = null;
  public qrDataUrl: string | null = null;
  public phone: string | null = null;
  public userName: string | null = null;
  public lastError: string | null = null;
  public tenantId: string | null = null;
  private connectedAt: number | null = null;
  private isInitializing: boolean = false;
  private initStartTime: number = 0;
  private sentBotMessageIds = new Set<string>();
  private hasSentWelcomeForSession: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Check if auth folder exists with existing credentials
    if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
      this.status = 'starting';
      this.start().catch((err) => console.error('Auto-start WA bot error:', err));
    }
  }

  public async start(tenantId?: string): Promise<WhatsAppStatusResponse> {
    if (tenantId) {
      this.tenantId = tenantId;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.sock && this.status === 'connected') {
      return this.getStatus();
    }

    // Explicitly clean up and close previous socket to prevent conflict 440 loops
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.ev.removeAllListeners('messages.upsert');
        this.sock.end(undefined);
      } catch (_) {}
      this.sock = null;
      await new Promise((r) => setTimeout(r, 600));
    }

    // Allow re-attempt if initialization took more than 8 seconds
    if (this.isInitializing && Date.now() - this.initStartTime < 8000) {
      console.log('[Baileys Service] Already initializing, returning current status:', this.status);
      return this.getStatus();
    }

    this.isInitializing = true;
    this.initStartTime = Date.now();
    this.status = 'starting';
    this.lastError = null;
    console.log('[Baileys Service] Initiating start sequence...');

    try {
      if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      }

      console.log(`[Baileys Service] Loading auth state from ${AUTH_DIR}`);
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      console.log('[Baileys Service] Auth state loaded, creating makeWASocket...');

      const sock: WASocket = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        generateHighQualityLinkPreview: true,
        browser: ['KothaShop Web AI', 'Chrome', '1.0.0'],
      });

      this.sock = sock;
      console.log('[Baileys Service] makeWASocket created, binding event listeners...');

      // Save credentials update
      sock.ev.on('creds.update', saveCreds);

      // Connection updates
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        console.log('[Baileys Service] connection.update:', { connection, hasQr: !!qr });

        if (qr) {
          this.qrRaw = qr;
          try {
            this.qrDataUrl = await QRCode.toDataURL(qr, {
              width: 280,
              margin: 2,
              color: {
                dark: '#0f172a',
                light: '#ffffff',
              },
            });
            this.status = 'qr_ready';
            this.isInitializing = false;
            console.log('📱 [Baileys Web] New QR Code generated for in-dashboard scan');
          } catch (qrErr) {
            this.isInitializing = false;
            console.error('Error generating QR DataURL:', qrErr);
          }
        }

        if (connection === 'close') {
          // Ignore events from orphaned / previous sockets
          if (this.sock !== sock) {
            return;
          }

          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          // Crucial: 440 means connectionReplaced by another client. DO NOT auto-reconnect to avoid infinite loop!
          const isReplaced = statusCode === DisconnectReason.connectionReplaced || statusCode === 440;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
          const shouldReconnect = !isReplaced && !isLoggedOut;

          console.log(`⚠️ [Baileys Web] Connection closed (Code: ${statusCode}). Reconnect: ${shouldReconnect}`);

          this.qrRaw = null;
          this.qrDataUrl = null;
          this.connectedAt = null;

          if (shouldReconnect) {
            this.status = 'starting';
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              this.isInitializing = false;
              this.start();
            }, 3500);
          } else {
            console.log(`[Baileys Web] Connection closed permanently (Code: ${statusCode}, replaced: ${isReplaced}, loggedOut: ${isLoggedOut}).`);
            const disconnectedPhone = this.phone;
            const currentTenant = this.tenantId;

            this.status = 'idle';
            this.phone = null;
            this.userName = null;
            this.isInitializing = false;
            this.hasSentWelcomeForSession = false;

            if (isLoggedOut) {
              try {
                if (fs.existsSync(AUTH_DIR)) {
                  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                }
              } catch (_) {}
              try {
                if (disconnectedPhone) {
                  query(
                    `DELETE FROM channels WHERE platform = 'whatsapp' AND (channel_identifier = $1 OR channel_identifier = $2);`,
                    [disconnectedPhone, `+${disconnectedPhone}`]
                  ).catch(() => {});
                } else if (currentTenant) {
                  query(
                    `DELETE FROM channels WHERE platform = 'whatsapp' AND tenant_id = $1;`,
                    [currentTenant]
                  ).catch(() => {});
                }
              } catch (_) {}
            }
          }
        } else if (connection === 'open') {
          this.status = 'connected';
          this.qrRaw = null;
          this.qrDataUrl = null;
          this.connectedAt = Date.now();
          this.isInitializing = false;

          const rawUser = sock.user?.id || '';
          this.phone = rawUser.split(':')[0] || rawUser.split('@')[0] || '';
          this.userName = sock.user?.name || 'WhatsApp Merchant';

          console.log(`✅ [Baileys Web] WhatsApp successfully connected! Phone: +${this.phone}`);

          // Register / sync channel in database
          this.syncChannelToDatabase();

          // Send welcome confirmation greeting ONLY ONCE per session (not on reconnects/reloads)
          if (!this.hasSentWelcomeForSession) {
            this.hasSentWelcomeForSession = true;
            this.sendWelcomeGreeting();
          }
        }
      });

      // Message listener
      sock.ev.on('messages.upsert', async (m) => {
        // WhatsApp sends 'notify' for incoming chats, and 'append' when syncing self messages or from linked phone
        if (m.type !== 'notify' && m.type !== 'append') return;

        for (const msg of m.messages) {
          if (!msg.message) continue;

          // Check if this message was sent by our bot (to avoid echo loop)
          if (msg.key.id && this.sentBotMessageIds.has(msg.key.id)) {
            continue;
          }

          const remoteJid = msg.key.remoteJid || '';
          if (!remoteJid || remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@g.us')) continue;

          const cleanMyPhone = (this.phone || '').replace(/\D/g, '');
          const rawRemoteUser = (remoteJid.split('@')[0] || '').split(':')[0];
          const cleanRemotePhone = rawRemoteUser.replace(/\D/g, '');
          const userLidPrefix = ((sock.user as any)?.lid || '').split('@')[0].split(':')[0];
          const userJidPrefix = (sock.user?.id || '').split('@')[0].split(':')[0];

          // Check if this message was sent to SELF ("Message yourself" / Note to Self in WhatsApp)
          // In WhatsApp multi-device, self messages can be @s.whatsapp.net, user's LID @lid, or own phone
          const isSelfChat =
            (cleanMyPhone && cleanRemotePhone && (
              cleanRemotePhone === cleanMyPhone ||
              cleanRemotePhone.endsWith(cleanMyPhone.slice(-10)) ||
              cleanMyPhone.endsWith(cleanRemotePhone.slice(-10))
            )) ||
            remoteJid === `${this.phone}@s.whatsapp.net` ||
            (userJidPrefix && rawRemoteUser === userJidPrefix) ||
            (userLidPrefix && rawRemoteUser === userLidPrefix) ||
            remoteJid.endsWith('@lid');

          // If message is fromMe, but it's NOT self chat (e.g. merchant chatting manually with a customer on WA), ignore
          if (msg.key.fromMe && !isSelfChat) continue;

          // Unwrap message if ephemeral / viewOnce / documentWithCaption
          let rawMsg: any = msg.message;
          if (rawMsg.ephemeralMessage?.message) rawMsg = rawMsg.ephemeralMessage.message;
          if (rawMsg.viewOnceMessage?.message) rawMsg = rawMsg.viewOnceMessage.message;
          if (rawMsg.viewOnceMessageV2?.message) rawMsg = rawMsg.viewOnceMessageV2.message;
          if (rawMsg.documentWithCaptionMessage?.message) rawMsg = rawMsg.documentWithCaptionMessage.message;

          const text = (
            rawMsg.conversation ||
            rawMsg.extendedTextMessage?.text ||
            rawMsg.imageMessage?.caption ||
            rawMsg.videoMessage?.caption ||
            ''
          ).trim();

          if (!text) continue;

          const displayPhone = cleanMyPhone || cleanRemotePhone || 'unknown';
          console.log(`\n📩 [WA Received] From: +${displayPhone} | isSelfChat: ${isSelfChat} | fromMe: ${msg.key.fromMe} | Text: "${text}"`);

          // For self-chat, reply to owner's number or remoteJid
          const targetJid = isSelfChat
            ? (remoteJid.includes('@s.whatsapp.net') ? remoteJid : (cleanMyPhone ? `${cleanMyPhone}@s.whatsapp.net` : remoteJid))
            : (remoteJid.includes('@s.whatsapp.net') && cleanRemotePhone ? `${cleanRemotePhone}@s.whatsapp.net` : remoteJid);

          // Safe message delivery with fallback and optional quoted message
          const sendSafe = async (textToSend: string, quote?: any): Promise<boolean> => {
            const activeSock = this.sock || sock;
            if (!activeSock) return false;

            const sendOptions: any = {};
            if (quote) {
              sendOptions.quoted = quote;
            }

            try {
              const res = await activeSock.sendMessage(targetJid, { text: textToSend }, sendOptions);
              if (res?.key?.id) {
                this.sentBotMessageIds.add(res.key.id);
                if (this.sentBotMessageIds.size > 2000) this.sentBotMessageIds.clear();
                return true;
              }
            } catch (primaryErr: any) {
              console.warn(`[WA Reply Warning] Direct send to ${targetJid} failed:`, primaryErr?.message || primaryErr);
            }

            // Fallback for self chat: if targetJid failed and remoteJid is different (e.g. LID vs phone)
            if (isSelfChat && remoteJid && remoteJid !== targetJid) {
              try {
                const resFallback = await activeSock.sendMessage(remoteJid, { text: textToSend }, sendOptions);
                if (resFallback?.key?.id) {
                  this.sentBotMessageIds.add(resFallback.key.id);
                  return true;
                }
              } catch (fallbackErr: any) {
                console.warn(`[WA Reply Warning] Fallback send to ${remoteJid} failed:`, fallbackErr?.message || fallbackErr);
              }
            }
            return false;
          };

          try {
            // NEVER send composing presence to yourself (WhatsApp drops connection on self chat presence!)
            if (!isSelfChat) {
              sock.sendPresenceUpdate('composing', targetJid).catch(() => {});
            }

            // 1. Identify which tenant and channel this WhatsApp bot belongs to
            let targetTenantId = this.tenantId;
            let channelId: string | null = null;

            const channelRes = await query(
              `SELECT id, tenant_id, ai_active FROM channels WHERE platform = 'whatsapp' AND (channel_identifier = $1 OR channel_identifier = $2) LIMIT 1;`,
              [this.phone, displayPhone]
            );

            if (channelRes.rows.length > 0) {
              targetTenantId = channelRes.rows[0].tenant_id;
              channelId = channelRes.rows[0].id;
              if (channelRes.rows[0].ai_active === false) {
                console.log(`[WhatsApp AI Disabled] Channel ${channelId} has AI paused.`);
                continue;
              }
            }

            if (!targetTenantId) {
              const defaultTenant = await query(`SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1;`);
              if (defaultTenant.rows.length > 0) {
                targetTenantId = defaultTenant.rows[0].id;
              }
            }

            // 2. Check if the sender is the Shop Owner / Merchant
            const merchantCheck = await query(
              `SELECT u.id as user_id, u.name as user_name, u.role
               FROM users u
               WHERE u.tenant_id = $1 AND (
                 u.phone = $2 OR (LENGTH($2) >= 10 AND RIGHT(COALESCE(u.phone, ''), 10) = RIGHT($2, 10))
               ) LIMIT 1;`,
              [targetTenantId, displayPhone]
            );

            const isOwner =
              isSelfChat ||
              (cleanMyPhone && displayPhone.endsWith(cleanMyPhone.slice(-10))) ||
              merchantCheck.rows.length > 0;

            if (isOwner) {
              // SENDER IS THE SHOP OWNER -> Run Business Copilot
              console.log(`👑 [WhatsApp Copilot] Owner query from +${displayPhone}: "${text}"`);
              const result = await processMerchantWhatsAppMessage(displayPhone, text);
              await new Promise((resolve) => setTimeout(resolve, 200));

              // Format with a distinct AI Assistant header badge for visual clarity
              const formattedReply = result.replyText.startsWith('🤖') || result.replyText.startsWith('👋') || result.replyText.startsWith('🎉')
                ? result.replyText
                : `🤖 *KothaShop AI Copilot*\n━━━━━━━━━━━━━━━━━━━━\n${result.replyText}`;

              const ok = await sendSafe(formattedReply, msg);
              if (ok) {
                console.log(`📤 [WA Owner Reply Sent] To: +${displayPhone} (${targetJid})`);
              } else {
                console.error(`❌ [WA Owner Reply Failed] Could not deliver to +${displayPhone}`);
              }

              // Persist conversation and messages to DB so it appears in Live Inbox
              if (targetTenantId) {
                try {
                  if (!channelId) {
                    const newChanRes = await query(
                      `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, ai_active, webhook_verified, quality_rating)
                       VALUES ($1, 'whatsapp', $2, $3, true, true, 'GREEN')
                       ON CONFLICT (platform, channel_identifier) DO UPDATE SET updated_at = NOW()
                       RETURNING id;`,
                      [targetTenantId, this.phone || displayPhone, `${this.userName || 'Owner'} (WhatsApp)`]
                    );
                    channelId = newChanRes.rows[0]?.id;
                  }

                  if (channelId) {
                    const convRes = await query(
                      `INSERT INTO conversations (tenant_id, channel_id, customer_identifier, customer_name, customer_phone, updated_at)
                       VALUES ($1, $2, $3, 'Shop Owner (You)', $3, NOW())
                       ON CONFLICT (channel_id, customer_identifier) DO UPDATE SET updated_at = NOW()
                       RETURNING id;`,
                      [targetTenantId, channelId, displayPhone]
                    );
                    const convId = convRes.rows[0]?.id;
                    if (convId) {
                      await query(
                        `INSERT INTO messages (conversation_id, sender_type, content, created_at)
                         VALUES 
                           ($1, 'customer', $2, NOW() - INTERVAL '1 second'),
                           ($1, 'ai', $3, NOW());`,
                        [convId, text, result.replyText]
                      );
                    }
                  }
                } catch (persistErr) {
                  console.error('Failed to persist owner WhatsApp message to DB:', persistErr);
                }
              }
            } else {
              // SENDER IS A THIRD-PARTY (Customer from Facebook OR Private Family/Friend Contact)
              if (!targetTenantId) continue;

              if (!channelId) {
                const newChanRes = await query(
                  `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, ai_active, webhook_verified, quality_rating)
                   VALUES ($1, 'whatsapp', $2, 'WhatsApp Commerce', true, true, 'GREEN')
                   ON CONFLICT (platform, channel_identifier) DO UPDATE SET updated_at = NOW()
                   RETURNING id;`,
                  [targetTenantId, this.phone || 'whatsapp_bot']
                );
                channelId = newChanRes.rows[0]?.id;
              }

              // Check if this contact has an existing conversation in our system
              const convCheck = channelId
                ? await query(
                    `SELECT id, ai_muted_until FROM conversations WHERE channel_id = $1 AND customer_identifier = $2 LIMIT 1;`,
                    [channelId, displayPhone]
                  )
                : { rows: [] };

              const hasPriorConversation = convCheck.rows.length > 0;

              // PRIVACY SHIELD: If no commerce/shopping intent (e.g. personal, family, friends chat), PASSIVELY IGNORE!
              const isShoppingQuery = isCommerceOrShopInquiry(text, hasPriorConversation);
              if (!isShoppingQuery) {
                console.log(`🛡️ [WhatsApp Privacy Shield] Non-commerce / personal chat from +${displayPhone} ignored: "${text}"`);
                continue;
              }

              console.log(`🛍️ [WhatsApp Sales] Verified Commerce inquiry from +${displayPhone}: "${text}"`);

              const salesResult = await processCustomerMessage({
                tenantId: targetTenantId,
                channelId: channelId || 'whatsapp_channel',
                platform: 'whatsapp',
                pageId: this.phone || 'whatsapp_bot',
                senderId: displayPhone,
                customerName: (msg as any).pushName || 'WhatsApp Customer',
                messageText: text,
                accessToken: '',
              });

              if (salesResult.replyText && !salesResult.isMuted) {
                await new Promise((resolve) => setTimeout(resolve, 300));
                const ok = await sendSafe(salesResult.replyText, msg);
                if (ok) {
                  console.log(`📤 [WA Customer Reply Sent] To: +${displayPhone} | Order created: ${salesResult.orderCreated}`);
                }
              }
            }
          } catch (replyErr) {
            console.error('Error replying to WhatsApp in-app message:', replyErr);
            try {
              await sendSafe('দুঃখিত, আপনার অনুরোধটি প্রসেস করতে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।', msg);
            } catch (_) {}
          }
        }
      });
    } catch (err: any) {
      console.error('Fatal Baileys Start error:', err);
      this.status = 'error';
      this.lastError = err.message || 'Failed to start WhatsApp bot';
      this.isInitializing = false;
    }

    return this.getStatus();
  }

  private async syncChannelToDatabase() {
    if (!this.phone) return;

    try {
      // Find tenant: either this.tenantId, match by phone, or default tenant
      let targetTenantId = this.tenantId;
      if (!targetTenantId && this.phone) {
        const cleanP = this.phone.replace(/\D/g, '');
        const normP = cleanP.startsWith('880') ? '0' + cleanP.slice(3) : cleanP;
        const tenantByPhone = await query(
          `SELECT u.tenant_id FROM users u WHERE u.phone = $1 OR (LENGTH($1) >= 10 AND RIGHT(COALESCE(u.phone, ''), 10) = RIGHT($1, 10))
           UNION
           SELECT t.id as tenant_id FROM tenants t WHERE t.phone = $1 OR (LENGTH($1) >= 10 AND RIGHT(COALESCE(t.phone, ''), 10) = RIGHT($1, 10))
           LIMIT 1;`,
          [normP]
        );
        if (tenantByPhone.rows.length > 0) {
          targetTenantId = tenantByPhone.rows[0].tenant_id;
        }
      }

      if (!targetTenantId) {
        const defaultTenantRes = await query(
          `SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1;`
        );
        if (defaultTenantRes.rows.length > 0) {
          targetTenantId = defaultTenantRes.rows[0].id;
        }
      }

      if (!targetTenantId) return;

      const channelName = this.userName ? `${this.userName} (WhatsApp)` : 'WhatsApp Business AI';

      await query(
        `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, ai_active, webhook_verified, quality_rating)
         VALUES ($1, 'whatsapp', $2, $3, true, true, 'GREEN')
         ON CONFLICT (platform, channel_identifier) 
         DO UPDATE SET tenant_id = EXCLUDED.tenant_id, channel_name = EXCLUDED.channel_name, ai_active = true, webhook_verified = true, updated_at = CURRENT_TIMESTAMP;`,
        [targetTenantId, this.phone, channelName]
      );
      console.log(`💾 [Baileys Web] Synced WhatsApp channel to DB for tenant ${targetTenantId}`);
    } catch (dbErr) {
      console.error('Failed to sync WhatsApp channel to DB:', dbErr);
    }
  }

  public async sendWelcomeGreeting(): Promise<boolean> {
    if (!this.sock || !this.phone) {
      console.log('Cannot send welcome greeting: socket or phone not ready', { hasSock: !!this.sock, phone: this.phone });
      return false;
    }

    try {
      const ownerJid = `${this.phone}@s.whatsapp.net`;
      const welcomeText =
        `🎉 *আসসালামু আলাইকুম! KothaShop WhatsApp AI সফলভাবে সংযুক্ত হয়েছে!* 🚀\n\n` +
        `আমি আপনার অনলাইন শপের *স্মার্ট এআই সেলস ও বিজনেস অ্যাসিস্ট্যান্ট*।\n\n` +
        `📌 *আপনি যেভাবে আমাকে ব্যবহার করতে পারবেন:*\n` +
        `১️⃣ *দোকানের হিসাব ও তথ্য জানতে:* এই চ্যাটেই আমাকে সরাসরি মেসেজ পাঠাতে পারেন, যেমন:\n` +
        `   • *"আজকের বিক্রি কত?"*\n` +
        `   • *"আজকে কয়টা অর্ডার পড়েছে?"*\n` +
        `   • *"স্টকে কী কী প্রোডাক্ট আছে?"*\n` +
        `   • *"মেনু"* অথবা *"হেল্প"*\n\n` +
        `২️⃣ *কাস্টমার অর্ডার অটোমেশন:* আপনার ফেসবুক পেজ বা অন্য যেকোনো কাস্টমার আপনার এই নম্বরে মেসেজ পাঠালে আমি স্বয়ংক্রিয়ভাবে তাদের সাথে কথা বলে সাইজ/ঠিকানা নিয়ে ডাটাবেজে অর্ডার কনফার্ম করে দেব!\n\n` +
        `💡 _টেস্ট করতে এখনই নিচে যেকোনো মেসেজ লিখে পাঠান (যেমন: "আজকের অর্ডার" বা "হেল্প")!_`;

      const sent = await this.sock.sendMessage(ownerJid, { text: welcomeText });
      if (sent?.key?.id) {
        this.sentBotMessageIds.add(sent.key.id);
      }
      console.log(`📨 [Baileys Web] Welcome greeting sent to owner chat: ${ownerJid}`);
      return true;
    } catch (err) {
      console.error('Failed to send welcome greeting:', err);
      return false;
    }
  }

  public async disconnect(): Promise<WhatsAppStatusResponse> {
    const disconnectedPhone = this.phone;
    const currentTenant = this.tenantId;

    try {
      if (this.sock) {
        if (this.status === 'connected') {
          await Promise.race([
            this.sock.logout().catch(() => {}),
            new Promise((r) => setTimeout(r, 1500)),
          ]);
        }
        try {
          this.sock.end(undefined);
        } catch (_) {}
        this.sock = null;
      }
    } catch (err) {
      console.error('Error logging out socket:', err);
    }

    try {
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      }
    } catch (_) {}

    // Clean up WhatsApp channel record from database
    try {
      if (disconnectedPhone) {
        await query(
          `DELETE FROM channels WHERE platform = 'whatsapp' AND (channel_identifier = $1 OR channel_identifier = $2);`,
          [disconnectedPhone, `+${disconnectedPhone}`]
        );
      } else if (currentTenant) {
        await query(
          `DELETE FROM channels WHERE platform = 'whatsapp' AND tenant_id = $1;`,
          [currentTenant]
        );
      }
      console.log('🗑️ [Baileys Web] Removed WhatsApp channel from DB upon disconnect');
    } catch (dbErr) {
      console.error('Failed to remove WhatsApp channel from DB:', dbErr);
    }

    this.status = 'idle';
    this.qrRaw = null;
    this.qrDataUrl = null;
    this.phone = null;
    this.userName = null;
    this.connectedAt = null;
    this.lastError = null;
    this.isInitializing = false;
    this.hasSentWelcomeForSession = false;

    return this.getStatus();
  }

  public getStatus(): WhatsAppStatusResponse {
    return {
      status: this.status,
      qrDataUrl: this.qrDataUrl,
      phone: this.phone,
      userName: this.userName,
      lastError: this.lastError,
      uptime: this.connectedAt ? Math.floor((Date.now() - this.connectedAt) / 1000) : undefined,
    };
  }
}

// Global singleton to prevent multi-instance re-initialization during development/hot reload
declare global {
  var __whatsapp_bot__: WhatsAppBotService | undefined;
}

export function getWhatsAppService(): WhatsAppBotService {
  if (!globalThis.__whatsapp_bot__) {
    globalThis.__whatsapp_bot__ = new WhatsAppBotService();
  }
  return globalThis.__whatsapp_bot__;
}

export async function resetWhatsAppService(): Promise<WhatsAppBotService> {
  if (globalThis.__whatsapp_bot__) {
    try {
      await globalThis.__whatsapp_bot__.disconnect();
    } catch (_) {}
  }
  globalThis.__whatsapp_bot__ = new WhatsAppBotService();
  return globalThis.__whatsapp_bot__;
}

