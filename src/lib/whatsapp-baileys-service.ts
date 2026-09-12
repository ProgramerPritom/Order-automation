import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
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

    if (this.sock && this.status === 'connected') {
      return this.getStatus();
    }

    if (this.isInitializing) {
      return this.getStatus();
    }

    this.isInitializing = true;
    this.status = 'starting';
    this.lastError = null;

    try {
      if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307] as any,
        isLatest: true,
      }));

      const sock: WASocket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        generateHighQualityLinkPreview: true,
        browser: ['KothaShop Web AI', 'Chrome', '1.0.0'],
      });

      this.sock = sock;

      // Save credentials update
      sock.ev.on('creds.update', saveCreds);

      // Connection updates
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

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
            console.log('📱 [Baileys Web] New QR Code generated for in-dashboard scan');
          } catch (qrErr) {
            console.error('Error generating QR DataURL:', qrErr);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.log(`⚠️ [Baileys Web] Connection closed (Code: ${statusCode}). Reconnect: ${shouldReconnect}`);

          this.qrRaw = null;
          this.qrDataUrl = null;
          this.connectedAt = null;

          if (shouldReconnect) {
            this.status = 'starting';
            setTimeout(() => {
              this.isInitializing = false;
              this.start();
            }, 3000);
          } else {
            this.status = 'idle';
            this.phone = null;
            this.userName = null;
            this.isInitializing = false;
            // Clean auth folder if logged out
            try {
              if (fs.existsSync(AUTH_DIR)) {
                fs.rmSync(AUTH_DIR, { recursive: true, force: true });
              }
            } catch (_) {}
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
        }
      });

      // Message listener
      sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
          if (msg.key.fromMe || !msg.message) continue;

          const remoteJid = msg.key.remoteJid || '';
          if (!remoteJid.endsWith('@s.whatsapp.net')) continue;

          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            '';

          if (!text || !text.trim()) continue;

          const rawPhone = remoteJid.replace('@s.whatsapp.net', '');
          console.log(`\n📩 [WA In-App Received] From: +${rawPhone} | Text: "${text}"`);

          try {
            await sock.sendPresenceUpdate('composing', remoteJid);

            // 1. Identify which tenant and channel this WhatsApp bot belongs to
            let targetTenantId = this.tenantId;
            let channelId: string | null = null;

            const channelRes = await query(
              `SELECT id, tenant_id, ai_active FROM channels WHERE platform = 'whatsapp' AND channel_identifier = $1 LIMIT 1;`,
              [this.phone]
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
              [targetTenantId, rawPhone]
            );

            const isOwner = merchantCheck.rows.length > 0;

            if (isOwner) {
              // SENDER IS THE SHOP OWNER -> Run Business Copilot
              console.log(`👑 [WhatsApp Copilot] Owner query from +${rawPhone}: "${text}"`);
              const result = await processMerchantWhatsAppMessage(rawPhone, text);
              await new Promise((resolve) => setTimeout(resolve, 500));
              await sock.sendMessage(remoteJid, { text: result.replyText });
              console.log(`📤 [WA Owner Reply Sent] To: +${rawPhone}`);
            } else {
              // SENDER IS A CUSTOMER (From Facebook Post CTA or WhatsApp direct) -> Run AI Sales Consultant!
              console.log(`🛍️ [WhatsApp Sales] Customer message from +${rawPhone}: "${text}"`);
              if (targetTenantId) {
                if (!channelId) {
                  const newChanRes = await query(
                    `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, ai_active, webhook_verified, quality_rating)
                     VALUES ($1, 'whatsapp', $2, 'WhatsApp Commerce', true, true, 'GREEN')
                     ON CONFLICT (tenant_id, platform, channel_identifier) DO UPDATE SET updated_at = NOW()
                     RETURNING id;`,
                    [targetTenantId, this.phone || 'whatsapp_bot']
                  );
                  channelId = newChanRes.rows[0]?.id;
                }

                const salesResult = await processCustomerMessage({
                  tenantId: targetTenantId,
                  channelId: channelId || 'whatsapp_channel',
                  platform: 'whatsapp',
                  pageId: this.phone || 'whatsapp_bot',
                  senderId: rawPhone,
                  customerName: (msg as any).pushName || 'WhatsApp Customer',
                  messageText: text,
                  accessToken: '',
                });

                if (salesResult.replyText && !salesResult.isMuted) {
                  await new Promise((resolve) => setTimeout(resolve, 600));
                  await sock.sendMessage(remoteJid, { text: salesResult.replyText });
                  console.log(`📤 [WA Customer Reply Sent] To: +${rawPhone} | Order created: ${salesResult.orderCreated}`);
                }
              }
            }
          } catch (replyErr) {
            console.error('Error replying to WhatsApp in-app message:', replyErr);
            try {
              await sock.sendMessage(remoteJid, {
                text: 'দুঃখিত, আপনার অনুরোধটি প্রসেস করতে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
              });
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
      // Find tenant: either this.tenantId or default tenant
      let targetTenantId = this.tenantId;
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
         ON CONFLICT (tenant_id, platform, channel_identifier) 
         DO UPDATE SET channel_name = EXCLUDED.channel_name, ai_active = true, webhook_verified = true, updated_at = CURRENT_TIMESTAMP;`,
        [targetTenantId, this.phone, channelName]
      );
      console.log(`💾 [Baileys Web] Synced WhatsApp channel to DB for tenant ${targetTenantId}`);
    } catch (dbErr) {
      console.error('Failed to sync WhatsApp channel to DB:', dbErr);
    }
  }

  public async disconnect(): Promise<WhatsAppStatusResponse> {
    try {
      if (this.sock) {
        await this.sock.logout().catch(() => {});
        this.sock.end(undefined);
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

    this.status = 'idle';
    this.qrRaw = null;
    this.qrDataUrl = null;
    this.phone = null;
    this.userName = null;
    this.connectedAt = null;
    this.lastError = null;
    this.isInitializing = false;

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
