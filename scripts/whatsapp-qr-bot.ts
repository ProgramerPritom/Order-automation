import dotenv from 'dotenv';
dotenv.config();

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import { processMerchantWhatsAppMessage } from '../src/lib/whatsapp-merchant-copilot';
import { processCustomerMessage } from '../src/lib/ai-sales-engine';
import { query } from '../src/lib/db';

const AUTH_DIR = path.join(process.cwd(), 'baileys_auth');

console.log('\n======================================================');
console.log('  🚀 KothaShop WhatsApp AI Merchant Assistant Runner');
console.log('======================================================\n');

async function startWhatsAppBot() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock: WASocket = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    generateHighQualityLinkPreview: true,
    browser: ['KothaShop AI Assistant', 'Chrome', '1.0.0'],
  });

  // Save auth credentials whenever updated
  sock.ev.on('creds.update', saveCreds);

  // Monitor connection updates
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n------------------------------------------------------');
      console.log('📱 WhatsApp এ লগইন করতে নিচের QR কোডটি স্ক্যান করুন:');
      console.log('👉 WhatsApp Mobile App > Linked Devices > Link a device');
      console.log('------------------------------------------------------\n');
      qrcode.generate(qr, { small: true });
      console.log('\n(QR কোডটি স্ক্যান করা মাত্রই বটটি স্বয়ংক্রিয়ভাবে সক্রিয় হবে)\n');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`⚠️ সংযোগ বিচ্ছিন্ন হয়েছে (Code: ${statusCode})। পুনরায় সংযোগ চেষ্টা করা হচ্ছে: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(() => {
          startWhatsAppBot();
        }, 3000);
      } else {
        console.log('❌ ডিভাইস থেকে লগআউট করা হয়েছে। পুনরায় QR স্ক্যান করতে baileys_auth ফোল্ডার মুছে স্ক্রিপ্ট আবার চালু করুন।');
      }
    } else if (connection === 'open') {
      const botPhone = (sock.user?.id || '').split(':')[0] || (sock.user?.id || '').split('@')[0] || '';
      console.log('\n======================================================');
      console.log(`  ✅ WhatsApp এআই সহকারী সফলভাবে সংযুক্ত হয়েছে! (+${botPhone})`);
      console.log('  💬 এখন যেকোনো শপ ওনার তাদের নম্বর থেকে মেসেজ দিলেই');
      console.log('     স্বয়ংক্রিয়ভাবে লাইভ ডাটাবেজ থেকে উত্তর পাবেন।');
      console.log('======================================================\n');

      // Send welcome message to owner's chat
      if (botPhone) {
        try {
          const ownerJid = `${botPhone}@s.whatsapp.net`;
          const welcomeText =
            `🎉 *আসসালামু আলাইকুম! KothaShop WhatsApp AI সফলভাবে সংযুক্ত হয়েছে!* 🚀\n\n` +
            `আমি আপনার অনলাইন শপের *স্মার্ট এআই সেলস ও বিজনেস অ্যাসিস্ট্যান্ট*।\n\n` +
            `📌 *আপনি যেভাবে আমাকে ব্যবহার করতে পারবেন:*\n` +
            `১️⃣ *দোকানের হিসাব ও তথ্য জানতে:* এই চ্যাটেই আমাকে সরাসরি মেসেজ পাঠাতে পারেন (যেমন: *"আজকের বিক্রি কত?"*, *"অর্ডার কয়টি?"*, *"স্টক আপডেট"* বা *"মেনু"* লিখে পাঠান)।\n` +
            `২️⃣ *কাস্টমার অর্ডার অটোমেশন:* যেকোনো কাস্টমার আপনার এই নম্বরে মেসেজ পাঠালে আমি স্বয়ংক্রিয়ভাবে তাদের সাথে কথা বলে সাইজ/ঠিকানা নিয়ে ডাটাবেজে অর্ডার কনফার্ম করে দেব!\n\n` +
            `💡 _টেস্ট করতে এখনই নিচে যেকোনো মেসেজ লিখে পাঠান (যেমন: "আজকের অর্ডার" বা "হেল্প")!_`;

          sock.sendMessage(ownerJid, { text: welcomeText }).catch(() => {});
        } catch (_) {}
      }
    }
  });

  // Listen to incoming messages
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      if (!msg.message) continue;

      const remoteJid = msg.key.remoteJid || '';
      if (!remoteJid.endsWith('@s.whatsapp.net')) continue;

      const botPhone = (sock.user?.id || '').split(':')[0] || (sock.user?.id || '').split('@')[0] || '';
      const cleanBotPhone = botPhone.replace(/\D/g, '');
      const rawRemotePhone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');

      // Check if this message was sent to SELF ("Message yourself" in WhatsApp)
      const isSelfChat =
        (cleanBotPhone && (rawRemotePhone === cleanBotPhone || rawRemotePhone.endsWith(cleanBotPhone.slice(-10)))) ||
        remoteJid === `${botPhone}@s.whatsapp.net`;

      // Ignore outgoing messages sent to OTHER people (avoid loop)
      if (msg.key.fromMe && !isSelfChat) continue;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        '';

      if (!text || !text.trim()) continue;

      const rawPhone = remoteJid.replace('@s.whatsapp.net', '');
      console.log(`\n📩 [WhatsApp Message Received] From: +${rawPhone} | isSelfChat: ${isSelfChat} | Text: "${text}"`);

      try {
        await sock.sendPresenceUpdate('composing', remoteJid);

        let targetTenantId: string | null = null;
        let channelId: string | null = null;

        const chanRes = await query(
          `SELECT id, tenant_id, ai_active FROM channels WHERE platform = 'whatsapp' AND channel_identifier = $1 LIMIT 1;`,
          [botPhone]
        );

        if (chanRes.rows.length > 0) {
          targetTenantId = chanRes.rows[0].tenant_id;
          channelId = chanRes.rows[0].id;
        }

        if (!targetTenantId) {
          const defaultTenant = await query(`SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1;`);
          if (defaultTenant.rows.length > 0) {
            targetTenantId = defaultTenant.rows[0].id;
          }
        }

        // Check if sender is shop owner
        const merchantCheck = await query(
          `SELECT u.id as user_id, u.name as user_name, u.role
           FROM users u
           WHERE u.tenant_id = $1 AND (
             u.phone = $2 OR (LENGTH($2) >= 10 AND RIGHT(COALESCE(u.phone, ''), 10) = RIGHT($2, 10))
           ) LIMIT 1;`,
          [targetTenantId, rawPhone]
        );

        const isOwner =
          isSelfChat ||
          (cleanBotPhone && rawPhone.endsWith(cleanBotPhone.slice(-10))) ||
          merchantCheck.rows.length > 0;

        if (isOwner) {
          // SENDER IS OWNER -> Run Business Copilot
          console.log(`👑 [WA Owner Query] From: +${rawPhone} | "${text}"`);
          const result = await processMerchantWhatsAppMessage(rawPhone, text);
          await new Promise((resolve) => setTimeout(resolve, 500));
          await sock.sendMessage(remoteJid, { text: result.replyText });
          console.log(`📤 [WA Owner Reply Sent] To: +${rawPhone}`);
        } else {
          // SENDER IS A CUSTOMER (From Facebook Post CTA or WhatsApp direct) -> Run AI Sales Consultant!
          console.log(`🛍️ [WA Customer Sales] From: +${rawPhone} | "${text}"`);
          if (targetTenantId) {
            if (!channelId) {
              const newChanRes = await query(
                `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, ai_active, webhook_verified, quality_rating)
                 VALUES ($1, 'whatsapp', $2, 'WhatsApp Commerce', true, true, 'GREEN')
                 ON CONFLICT (tenant_id, platform, channel_identifier) DO UPDATE SET updated_at = NOW()
                 RETURNING id;`,
                [targetTenantId, botPhone || 'whatsapp_bot']
              );
              channelId = newChanRes.rows[0]?.id;
            }

            const salesResult = await processCustomerMessage({
              tenantId: targetTenantId,
              channelId: channelId || 'whatsapp_channel',
              platform: 'whatsapp',
              pageId: botPhone || 'whatsapp_bot',
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
      } catch (err) {
        console.error('❌ Error handling WhatsApp message:', err);
        try {
          await sock.sendMessage(remoteJid, {
            text: 'দুঃখিত, আপনার অনুরোধটি প্রসেস করতে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
          });
        } catch (_) {}
      }
    }
  });
}

// Start runner
startWhatsAppBot().catch((err) => {
  console.error('Fatal WhatsApp Runner error:', err);
});
