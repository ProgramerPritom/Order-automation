import dotenv from 'dotenv';
dotenv.config();

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import { processMerchantWhatsAppMessage } from '../src/lib/whatsapp-merchant-copilot';

const AUTH_DIR = path.join(process.cwd(), 'baileys_auth');

console.log('\n======================================================');
console.log('  🚀 KothaShop WhatsApp AI Merchant Assistant Runner');
console.log('======================================================\n');

async function startWhatsAppBot() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({
    version: [2, 3000, 1015901307] as any,
    isLatest: true,
  }));

  console.log(`[Baileys] WA Version: ${version.join('.')}, isLatest: ${isLatest}`);

  const sock: WASocket = makeWASocket({
    version,
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
      console.log('\n======================================================');
      console.log('  ✅ WhatsApp এআই সহকারী সফলভাবে সংযুক্ত হয়েছে!');
      console.log('  💬 এখন যেকোনো শপ ওনার তাদের নম্বর থেকে মেসেজ দিলেই');
      console.log('     স্বয়ংক্রিয়ভাবে লাইভ ডাটাবেজ থেকে উত্তর পাবেন।');
      console.log('======================================================\n');
    }
  });

  // Listen to incoming messages
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      // Ignore bot's own messages or empty messages
      if (msg.key.fromMe || !msg.message) continue;

      const remoteJid = msg.key.remoteJid || '';
      // Only process direct one-on-one user chats, ignore broadcast channels and groups
      if (!remoteJid.endsWith('@s.whatsapp.net')) continue;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        '';

      if (!text || !text.trim()) continue;

      const rawPhone = remoteJid.replace('@s.whatsapp.net', '');
      console.log(`\n📩 [WhatsApp Message Received] From: +${rawPhone} | Text: "${text}"`);

      try {
        // Send typing indicator to feel natural
        await sock.sendPresenceUpdate('composing', remoteJid);

        // Process message through our core merchant copilot
        const result = await processMerchantWhatsAppMessage(rawPhone, text);

        // Pause a moment for realistic typing feel
        await new Promise((resolve) => setTimeout(resolve, 600));

        // Reply to merchant
        await sock.sendMessage(remoteJid, { text: result.replyText });
        console.log(`📤 [WhatsApp Reply Sent] To: +${rawPhone} | Store: ${result.storeName || 'N/A'}`);
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
