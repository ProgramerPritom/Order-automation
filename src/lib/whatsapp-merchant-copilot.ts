import { query } from './db';
import { askGemini } from './gemini';
import {
  lookupOrderSkill,
  confirmOrderSkill,
  shipOrderSkill,
  deliverOrderSkill,
  cancelOrderSkill,
  updateStockSkill,
  toggleChannelAiSkill,
  takeoverCustomerSkill,
} from './agent-skills/merchant-skills';

export interface ProcessCopilotResult {
  isMerchant: boolean;
  replyText: string;
  merchantName?: string;
  storeName?: string;
  stats?: any;
}

/**
 * Normalizes phone numbers for matching (e.g. +88017... -> 017...)
 */
export function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith('880')) {
    return '0' + digits.slice(3);
  }
  if (digits.startsWith('88') && digits.length === 13) {
    return '0' + digits.slice(2);
  }
  return digits;
}

/**
 * Core Merchant WhatsApp Copilot Engine
 * Receives incoming WhatsApp message from a merchant and replies with live store data
 */
export async function processMerchantWhatsAppMessage(
  rawSenderPhone: string,
  messageText: string
): Promise<ProcessCopilotResult> {
  const normalizedPhone = normalizePhone(rawSenderPhone);
  const trimmedMsg = (messageText || '').trim();

  // 1. Identify merchant by phone number in database
  const merchantRes = await query(
    `SELECT u.id as user_id, u.name as user_name, u.phone as user_phone, u.role,
            t.id as tenant_id, t.name as store_name, t.phone as store_phone, 
            t.plan, t.business_category, t.delivery_inside_dhaka, t.delivery_outside_dhaka
     FROM users u
     JOIN tenants t ON u.tenant_id = t.id
     WHERE (
       u.phone = $1 OR t.phone = $1
       OR (LENGTH($1) >= 10 AND (RIGHT(COALESCE(u.phone, ''), 10) = RIGHT($1, 10) OR RIGHT(COALESCE(t.phone, ''), 10) = RIGHT($1, 10)))
     )
     ORDER BY u.created_at ASC
     LIMIT 1;`,
    [normalizedPhone]
  );

  // If sender is NOT a registered merchant
  let merchant = merchantRes.rows[0];
  if (!merchant) {
    // If no merchant matched by phone, fallback to default active tenant for demo/testing
    const fallbackTenant = await query(
      `SELECT t.id as tenant_id, t.name as store_name, u.name as user_name,
              t.delivery_inside_dhaka, t.delivery_outside_dhaka
       FROM tenants t 
       JOIN users u ON u.tenant_id = t.id 
       ORDER BY t.created_at ASC LIMIT 1;`
    );

    if (fallbackTenant.rows.length > 0) {
      merchant = fallbackTenant.rows[0];
    } else {
      return {
        isMerchant: false,
        replyText: `👋 আসসালামু আলাইকুম!\nআমি *ShopPilot AI Assistant*।\n\nআপনার এই নম্বরটি (*+${rawSenderPhone.replace(/\D/g, '')}*) ShopPilot-এর কোনো শপ অ্যাকাউন্টের সাথে যুক্ত নেই।\n\n💡 আপনার শপের লাইভ অর্ডার, বিক্রি ও এআই আপডেট পেতে আপনার রেজিস্টার্ড মোবাইল নম্বর দিয়ে মেসেজ করুন অথবা ড্যাশবোর্ডের Settings থেকে নম্বর আপডেট করুন।`,
      };
    }
  }

  const tenantId = merchant.tenant_id;
  const storeName = merchant.store_name || 'My Store';
  const merchantName = merchant.user_name || 'শপ ওনার';

  // 2. Fetch live store statistics from database
  const orderStatsRes = await query(
    `SELECT 
       count(*) as total_orders,
       count(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_orders,
       count(*) FILTER (WHERE status = 'pending') as pending_count,
       count(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
       count(*) FILTER (WHERE status = 'shipped') as shipped_count,
       count(*) FILTER (WHERE status = 'delivered') as delivered_count,
       count(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
       COALESCE(sum(total_amount), 0) as total_sales,
       COALESCE(sum(total_amount) FILTER (WHERE created_at >= CURRENT_DATE), 0) as today_sales,
       COALESCE(sum(total_amount) FILTER (WHERE status = 'delivered'), 0) as delivered_sales,
       COALESCE(sum(estimated_profit) FILTER (WHERE status = 'delivered'), 0) as delivered_profit
     FROM orders 
     WHERE tenant_id = $1;`,
    [tenantId]
  );
  const stats = orderStatsRes.rows[0] || {};

  // 3. Fetch recent 5 orders
  const recentOrdersRes = await query(
    `SELECT order_number, customer_name, customer_phone, delivery_address, total_amount, status, created_at
     FROM orders
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 5;`,
    [tenantId]
  );

  // 4. Fetch low stock products (stock < 10)
  const lowStockRes = await query(
    `SELECT title, price, stock 
     FROM products 
     WHERE tenant_id = $1 AND stock < 10 AND is_active = true
     ORDER BY stock ASC
     LIMIT 5;`,
    [tenantId]
  );

  // 5. Fetch connected channels
  const channelsRes = await query(
    `SELECT platform, channel_name, channel_identifier, ai_active, webhook_verified
     FROM channels 
     WHERE tenant_id = $1;`,
    [tenantId]
  );

  // 6. Fetch live Facebook comment metrics
  const commentStatsRes = await query(
    `SELECT 
       count(*) as total_comments,
       count(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_comments,
       count(*) FILTER (WHERE ai_replied = TRUE) as ai_replied_count,
       count(*) FILTER (WHERE private_reply_sent = TRUE) as private_replied_count,
       count(*) FILTER (WHERE ai_replied = FALSE OR ai_replied IS NULL) as unreplied_count
     FROM facebook_comments 
     WHERE tenant_id = $1;`,
    [tenantId]
  );
  const commentStats = commentStatsRes.rows[0] || {};

  // 7. Fetch live Customer messages & conversations metrics
  const messageStatsRes = await query(
    `SELECT 
       count(DISTINCT c.id) as total_conversations,
       count(DISTINCT c.id) FILTER (WHERE c.created_at >= CURRENT_DATE) as today_conversations,
       count(m.id) as total_messages,
       count(m.id) FILTER (WHERE m.created_at >= CURRENT_DATE) as today_messages,
       count(m.id) FILTER (WHERE m.sender_type = 'customer') as customer_messages,
       count(m.id) FILTER (WHERE m.sender_type = 'ai') as ai_messages
     FROM conversations c
     LEFT JOIN messages m ON m.conversation_id = c.id
     WHERE c.tenant_id = $1;`,
    [tenantId]
  );
  const messageStats = messageStatsRes.rows[0] || {};

  // 8. Fetch recent 3 Facebook comments
  const recentCommentsRes = await query(
    `SELECT customer_name, comment_text, ai_reply_text, ai_replied, private_reply_sent, created_at
     FROM facebook_comments
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 3;`,
    [tenantId]
  );

  // 9. Fetch recent 3 customer inquiries
  const recentInquiriesRes = await query(
    `SELECT c.customer_name, c.customer_phone, m.content, m.created_at
     FROM messages m
     JOIN conversations c ON m.conversation_id = c.id
     WHERE c.tenant_id = $1 AND m.sender_type = 'customer'
     ORDER BY m.created_at DESC
     LIMIT 3;`,
    [tenantId]
  );

  // 10. Agentic Order Management Actions via WhatsApp
  // Action: Confirm Order (e.g., "অর্ডার #KS-123456 কনফার্ম করো" বা "কনফার্ম #KS-123456")
  const confirmMatch = trimmedMsg.match(/(?:কনফার্ম|confirm|গ্রহণ)\s*(?:করো|করুন)?\s*(?:অর্ডার)?\s*(?:#|no\.?|নং)?\s*(KS-?\d{4,8}|\d{5,8})/i) ||
                       trimmedMsg.match(/(?:অর্ডার)?\s*(?:#|no\.?|নং)?\s*(KS-?\d{4,8}|\d{5,8})\s*(?:কনফার্ম|confirm|গ্রহণ)\s*(?:করো|করুন)?/i);
  if (confirmMatch) {
    const res = await confirmOrderSkill(tenantId, confirmMatch[1]);
    return { isMerchant: true, replyText: res.message, merchantName, storeName, stats };
  }

  // Action: Ship Order to Courier (e.g., "অর্ডার #KS-123456 কুরিয়ারে পাঠাও" বা "কুরিয়ার #KS-123456")
  const shipMatch = trimmedMsg.match(/(?:কুরিয়ার|ship|পাঠাও|কুরিয়ারে)\s*(?:করো|করুন|পাঠাও)?\s*(?:অর্ডার)?\s*(?:#|no\.?|নং)?\s*(KS-?\d{4,8}|\d{5,8})/i) ||
                    trimmedMsg.match(/(?:অর্ডার)?\s*(?:#|no\.?|নং)?\s*(KS-?\d{4,8}|\d{5,8})\s*(?:কুরিয়ার|ship|পাঠাও|কুরিয়ারে)\s*(?:করো|করুন|পাঠাও)?/i);
  if (shipMatch) {
    const res = await shipOrderSkill(tenantId, shipMatch[1]);
    return { isMerchant: true, replyText: res.message, merchantName, storeName, stats };
  }

  // Action: Deliver Order (e.g., "অর্ডার #KS-123456 ডেলিভারড" বা "ডেলিভারড #KS-123456")
  const deliverMatch = trimmedMsg.match(/(?:ডেলিভারড|deliver|ডেলিভারি)\s*(?:করো|করুন|হয়েছে)?\s*(?:অর্ডার)?\s*(?:#|no\.?|নং)?\s*(KS-?\d{4,8}|\d{5,8})/i) ||
                       trimmedMsg.match(/(?:অর্ডার)?\s*(?:#|no\.?|নং)?\s*(KS-?\d{4,8}|\d{5,8})\s*(?:ডেলিভারড|deliver|ডেলিভারি)\s*(?:করো|করুন|হয়েছে)?/i);
  if (deliverMatch) {
    const res = await deliverOrderSkill(tenantId, deliverMatch[1]);
    return { isMerchant: true, replyText: res.message, merchantName, storeName, stats };
  }

  // Action: Cancel Order (e.g., "অর্ডার #KS-123456 বাতিল করো" বা "বাতিল #KS-123456")
  const cancelMatch = trimmedMsg.match(/(?:বাতিল|cancel|ক্যানসেল)\s*(?:করো|করুন)?\s*(?:অর্ডার)?\s*(?:#|no\.?|নং)?\s*(KS-?\d{4,8}|\d{5,8})/i) ||
                      trimmedMsg.match(/(?:অর্ডার)?\s*(?:#|no\.?|নং)?\s*(KS-?\d{4,8}|\d{5,8})\s*(?:বাতিল|cancel|ক্যানসেল)\s*(?:করো|করুন)?/i);
  if (cancelMatch) {
    const res = await cancelOrderSkill(tenantId, cancelMatch[1]);
    return { isMerchant: true, replyText: res.message, merchantName, storeName, stats };
  }

  // Action: Lookup Order Details (e.g., "অর্ডার #KS-123456" বা "#KS-123456" বা ফোন নম্বর)
  const lookupOrderMatch = trimmedMsg.match(/(?:অর্ডার|order)\s*(?:#|no\.?|নং)\s*(KS-?\d{4,8}|\d{5,8})/i) ||
                           trimmedMsg.match(/^#(KS-?\d{4,8}|\d{5,8})$/i);
  if (lookupOrderMatch) {
    const res = await lookupOrderSkill(tenantId, lookupOrderMatch[1]);
    return { isMerchant: true, replyText: res.message, merchantName, storeName, stats };
  }

  // Action: Update Product Stock (e.g., "স্টক আপডেট Montessori Board 25" বা "Montessori Board এর স্টক 20 পিস করো")
  const stockUpdateMatch = trimmedMsg.match(/(?:স্টক\s*(?:আপডেট|করো|করুন)?|update\s*stock)\s*[:=]?\s*(.+?)\s*(?:এর)?\s*(?:স্টক)?\s*(\d+)\s*(?:পিস|টি)?$/i) ||
                           trimmedMsg.match(/(.+?)\s*(?:এর)?\s*স্টক\s*(\d+)\s*(?:পিস|টি)?\s*(?:করো|করুন)?$/i);
  if (stockUpdateMatch && stockUpdateMatch[1] && stockUpdateMatch[2] && !stockUpdateMatch[1].includes('অর্ডার')) {
    const pTitle = stockUpdateMatch[1].trim();
    const qty = parseInt(stockUpdateMatch[2], 10);
    if (!isNaN(qty) && pTitle.length >= 2 && pTitle !== 'কম') {
      const res = await updateStockSkill(tenantId, pTitle, qty);
      return { isMerchant: true, replyText: res.message, merchantName, storeName, stats };
    }
  }

  // Action: Toggle AI Automation for Channels (e.g., "AI বট বন্ধ করো", "ফেসবুক বট চালু করো")
  const aiToggleMatch = trimmedMsg.match(/(?:ফেসবুক\s*বট|fb\s*bot|ফেসবুক\s*ai|ai|এআই|বট|bot)\s*(?:অটোমেশন)?\s*(চালু|অন|on|start|সক্রিয়|বন্ধ|অফ|off|stop|পজ|pause|নিষ্ক্রিয়)\s*(?:করো|করুন)?$/i) ||
                        trimmedMsg.match(/(চালু|অন|on|start|সক্রিয়|বন্ধ|অফ|off|stop|পজ|pause|নিষ্ক্রিয়)\s*(?:করো|করুন)?\s*(?:ফেসবুক\s*বট|fb\s*bot|ফেসবুক\s*ai|ai|এআই|বট|bot)/i);
  if (aiToggleMatch) {
    const rawAction = aiToggleMatch[1] || aiToggleMatch[2] || '';
    const isEnable = /চালু|অন|on|start|সক্রিয়/i.test(rawAction);
    const platform = /ফেসবুক|fb/i.test(trimmedMsg) ? 'facebook' : 'all';
    const res = await toggleChannelAiSkill(tenantId, platform, isEnable);
    return { isMerchant: true, replyText: res.message, merchantName, storeName, stats };
  }

  // Action: Human Takeover / Mute AI for a customer (e.g., "টেকওভার 01712345678", "01712345678 এর সাথে AI বন্ধ করো")
  const takeoverMatch = trimmedMsg.match(/(?:টেকওভার|মিউট|takeover|mute)\s*(01[3-9]\d{8})/i) ||
                        trimmedMsg.match(/(01[3-9]\d{8})\s*(?:এর সাথে AI বন্ধ করো|আমি কথা বলব|মিউট করো|টেকওভার)/i);
  if (takeoverMatch) {
    const phone = takeoverMatch[1];
    const res = await takeoverCustomerSkill(tenantId, phone, 24);
    return { isMerchant: true, replyText: res.message, merchantName, storeName, stats };
  }

  // 11. Handle quick keyword commands for zero-latency instant responses
  const lower = trimmedMsg.toLowerCase();

  // Quick Command: Orders / অর্ডার / 1
  if (lower === 'order' || lower === 'orders' || lower === 'অর্ডার' || lower === '1') {
    let text = `📦 *${storeName} — অর্ডারের বর্তমান অবস্থা*\n`;
    text += `━━━━━━━━━━━━━━━━━━━\n`;
    text += `• 📅 আজকের নতুন অর্ডার: *${stats.today_orders || 0} টি* (৳${stats.today_sales || 0})\n`;
    text += `• ⏳ রিভিউ পেন্ডিং: *${stats.pending_count || 0} টি*\n`;
    text += `• ✅ কনফার্মড অর্ডার: *${stats.confirmed_count || 0} টি*\n`;
    text += `• 🚚 কুরিয়ারে পাঠানো: *${stats.shipped_count || 0} টি*\n`;
    text += `• 📦 সফল ডেলিভারি: *${stats.delivered_count || 0} টি*\n`;
    text += `• 💰 সর্বমোট বিক্রি: *৳${stats.total_sales || 0}*\n\n`;

    if (recentOrdersRes.rows.length > 0) {
      text += `*সাম্প্রতিক অর্ডারসমূহ:*\n`;
      recentOrdersRes.rows.slice(0, 3).forEach((o, i) => {
        text += `${i + 1}. *#${o.order_number}* • ${o.customer_name} • ৳${o.total_amount} (${o.status})\n`;
      });
    }

    return {
      isMerchant: true,
      replyText: text,
      merchantName,
      storeName,
      stats,
    };
  }

  // Quick Command: Stock / স্টক / 2
  if (lower === 'stock' || lower === 'স্টক' || lower === '2') {
    let text = `📊 *${storeName} — স্টক অ্যালার্ট*\n`;
    text += `━━━━━━━━━━━━━━━━━━━\n`;
    if (lowStockRes.rows.length === 0) {
      text += `✅ চমৎকার! আপনার কোনো পণ্যের স্টক কম নেই। সব পণ্য পর্যাপ্ত স্টকে আছে।`;
    } else {
      text += `⚠️ *যেসব পণ্যের স্টক কম আছে (১০টির নিচে):*\n\n`;
      lowStockRes.rows.forEach((p, i) => {
        text += `${i + 1}. *${p.title}*\n   অবশিষ্ট স্টক: *${p.stock} পিস* (মূল্য: ৳${p.price})\n`;
      });
      text += `\n💡 শীঘ্রই নতুন স্টক যোগ করুন যাতে অর্ডার মিস না হয়!`;
    }

    return {
      isMerchant: true,
      replyText: text,
      merchantName,
      storeName,
      stats,
    };
  }

  // Quick Command: Sales & Profit / বিক্রি / লাভ / 3
  if (lower === 'sales' || lower === 'বিক্রি' || lower === 'লাভ' || lower === 'profit' || lower === '3') {
    let text = `💰 *${storeName} — বিক্রয় ও লাভের খতিয়ান*\n`;
    text += `━━━━━━━━━━━━━━━━━━━\n`;
    text += `• 📅 আজকের বিক্রি: *৳${stats.today_sales || 0}* (${stats.today_orders || 0} টি অর্ডার)\n`;
    text += `• 📈 সর্বমোট বিক্রি: *৳${stats.total_sales || 0}* (${stats.total_orders || 0} টি অর্ডার)\n`;
    text += `• 📦 সফল ডেলিভারির বিল: *৳${stats.delivered_sales || 0}*\n`;
    text += `• 💎 অর্জিত নিট প্রফিট: *৳${stats.delivered_profit || 0}*\n`;
    text += `• ⏳ ডেলিভারি অপেক্ষমান বিল: *৳${Math.max(0, Number(stats.total_sales || 0) - Number(stats.delivered_sales || 0))}*\n\n`;
    text += `💡 বিস্তারিত তথ্য জানতে যেকোনো স্বাভাবিক বাংলায় প্রশ্ন করতে পারেন।`;

    return {
      isMerchant: true,
      replyText: text,
      merchantName,
      storeName,
      stats,
    };
  }

  // Identify specific connected channels
  const fbChannel = channelsRes.rows.find((c) => c.platform === 'facebook');
  const waChannel = channelsRes.rows.find((c) => c.platform === 'whatsapp');

  // Quick Command: Facebook Page / চ্যানেল / পেজ / 4 / ফেসবুক
  const fbKeywords = ['পেজ', 'চ্যানেল', 'page', 'channels', '4', 'facebook', 'ফেসবুক', 'fb'];
  const isFbQuery = fbKeywords.some((k) => lower === k || lower.includes('facebook') || lower.includes('পেজ কানেক্ট') || lower.includes('ফেসবুক'));

  if (isFbQuery) {
    let text = `🌐 *${storeName} — ফেসবুক পেজ ও চ্যানেল স্ট্যাটাস*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    if (fbChannel) {
      const fbStatus = fbChannel.ai_active ? '🟢 সক্রিয় (Active)' : '🔴 নিষ্ক্রিয় (Paused)';
      text += `📘 *ফেসবুক পেজ:* *${fbChannel.channel_name}* (✅ কানেক্টেড)\n`;
      text += `   • পেজ আইডি: \`${fbChannel.channel_identifier}\`\n`;
      text += `   • এআই অটো-রিপ্লাই: ${fbStatus}\n`;
      text += `   • মেসেঞ্জার ও কমেন্ট: কাস্টমারদের প্রশ্নের উত্তর এআই দিয়ে দিচ্ছে\n\n`;
    } else {
      text += `📘 *ফেসবুক পেজ:* ⚠️ কোনো পেজ সংযুক্ত নেই\n`;
      text += `   💡 ShopPilot ড্যাশবোর্ডের *Channels* ট্যাব থেকে আপনার ফেসবুক পেজটি কানেক্ট করে নিন।\n\n`;
    }

    if (waChannel) {
      const waStatus = waChannel.ai_active ? '🟢 সক্রিয়' : '🔴 বন্ধ';
      text += `📱 *WhatsApp AI Bot:* +${waChannel.channel_identifier} (${waStatus})\n`;
      text += `   • ওনার অ্যাসিস্ট্যান্ট ও সেলস অটোমেশন সফলভাবে কাজ করছে।\n\n`;
    }

    text += `💡 _যেকোনো সময় ড্যাশবোর্ড থেকে AI চালু বা বন্ধ করতে পারেন।_`;

    return {
      isMerchant: true,
      replyText: text,
      merchantName,
      storeName,
      stats,
    };
  }

  // Quick Command: Facebook Comments / কমেন্ট / 5
  const commentKeywords = ['কমেন্ট', 'comment', 'comments', 'কমেন্টস', '5', 'আজকে কয়টা কমেন্ট', 'কমেন্টের হিসাব'];
  const isCommentQuery = commentKeywords.some((k) => lower === k || lower.includes('কমেন্ট'));

  if (isCommentQuery) {
    let text = `💬 *${storeName} — ফেসবুক কমেন্ট স্ট্যাটাস*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `• 📅 আজকের নতুন কমেন্ট: *${commentStats.today_comments || 0} টি*\n`;
    text += `• 💬 সর্বমোট কমেন্ট: *${commentStats.total_comments || 0} টি*\n`;
    text += `• 🤖 AI রিপ্লাই সম্পন্ন: *${commentStats.ai_replied_count || 0} টি*\n`;
    text += `• 📬 ইনবক্সে পাঠানো DM (Private Reply): *${commentStats.private_replied_count || 0} টি*\n`;
    text += `• ⏳ অপেক্ষমান (Unreplied): *${commentStats.unreplied_count || 0} টি*\n\n`;

    if (recentCommentsRes.rows.length > 0) {
      text += `*সাম্প্রতিক ৩টি কমেন্ট:*\n`;
      recentCommentsRes.rows.forEach((c: any, i: number) => {
        const replyTag = c.ai_replied ? '✅ AI Replied' : '⏳ Pending';
        text += `${i + 1}. *${c.customer_name || 'কাস্টমার'}*: "${c.comment_text.slice(0, 45)}..." (${replyTag})\n`;
      });
      text += `\n`;
    }
    text += `💡 কোনো কমেন্টারকে ইনবক্সে প্রাইভেট অফার পাঠাতে ড্যাশবোর্ডের *Comments* ট্যাব ব্যবহার করুন।`;

    return {
      isMerchant: true,
      replyText: text,
      merchantName,
      storeName,
      stats: { ...stats, commentStats },
    };
  }

  // Quick Command: Messages & Inbox / মেসেজ / ইনবক্স / 6
  const messageKeywords = ['মেসেজ', 'message', 'messages', 'ইনবক্স', 'inbox', '6', 'আজকে কয়টা মেসেজ', 'মেসেজের হিসাব'];
  const isMessageQuery = messageKeywords.some((k) => lower === k || lower.includes('মেসেজ') || lower.includes('ইনবক্স'));

  if (isMessageQuery) {
    let text = `📨 *${storeName} — কাস্টমার মেসেজ ও ইনবক্স রিপোর্ট*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `• 📅 আজকের মোট কথোপকথন (Conversations): *${messageStats.today_conversations || 0} টি*\n`;
    text += `• 👥 সর্বমোট কাস্টমার চ্যাট: *${messageStats.total_conversations || 0} টি*\n`;
    text += `• 📩 কাস্টমার মেসেজ আদান-প্রদান: *${messageStats.total_messages || 0} টি* (আজকে: ${messageStats.today_messages || 0})\n`;
    text += `• 🤖 এআই সেলস হ্যান্ডলিং: *${messageStats.ai_messages || 0} টি* মেসেজের উত্তর দিয়েছে\n\n`;

    if (recentInquiriesRes.rows.length > 0) {
      text += `*সাম্প্রতিক কাস্টমার মেসেজ:*\n`;
      recentInquiriesRes.rows.forEach((m: any, i: number) => {
        text += `${i + 1}. *${m.customer_name || 'কাস্টমার'}* (${m.customer_phone || 'ইনবক্স'}): "${m.content.slice(0, 40)}..."\n`;
      });
      text += `\n`;
    }
    text += `💡 ড্যাশবোর্ডের *Inbox* থেকে লাইভ চ্যাট দেখতে পারেন বা যে কাউকে ম্যানুয়াল টেকওভার করতে পারেন।`;

    return {
      isMerchant: true,
      replyText: text,
      merchantName,
      storeName,
      stats: { ...stats, messageStats },
    };
  }

  // Quick Command: Executive Daily Briefing / সামারি / রিপোর্ট / 7
  const summaryKeywords = ['সামারি', 'summary', 'রিপোর্ট', 'report', 'দৈনিক সামারি', 'আজকের রিপোর্ট', '7', 'দৈনিক রিপোর্ট'];
  const isSummaryQuery = summaryKeywords.some((k) => lower === k || lower.includes('সামারি') || lower.includes('দৈনিক রিপোর্ট'));

  if (isSummaryQuery) {
    let text = `📊 *${storeName} — দৈনিক এক্সিকিউটিভ রিপোর্ট*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `💰 *বিক্রি ও লাভ (Financials):*\n`;
    text += `• আজকের মোট বিক্রি: *৳${stats.today_sales || 0}* (${stats.today_orders || 0} টি নতুন অর্ডার)\n`;
    text += `• সর্বমোট বিক্রি: *৳${stats.total_sales || 0}* (${stats.total_orders || 0} টি অর্ডার)\n`;
    text += `• ক্যাশ ডেলিভারি সম্পন্ন: *৳${stats.delivered_sales || 0}*\n`;
    text += `• অর্জিত নিট প্রফিট: *৳${stats.delivered_profit || 0}*\n\n`;

    text += `📦 *অর্ডার অপারেশনস (Operations):*\n`;
    text += `• রিভিউ পেন্ডিং: *${stats.pending_count || 0} টি*\n`;
    text += `• কনফার্মড: *${stats.confirmed_count || 0} টি*\n`;
    text += `• কুরিয়ারে পাঠানো: *${stats.shipped_count || 0} টি*\n`;
    text += `• সফল ডেলিভারি: *${stats.delivered_count || 0} টি*\n\n`;

    text += `💬 *সোশ্যাল ও ইনবক্স (Social Commerce):*\n`;
    text += `• আজকের ফেসবুক কমেন্ট: *${commentStats.today_comments || 0} টি* (AI রিপ্লাই: ${commentStats.ai_replied_count || 0})\n`;
    text += `• ইনবক্সে পাঠানো অফার (DM): *${commentStats.private_replied_count || 0} টি*\n`;
    text += `• আজকের কাস্টমার চ্যাট: *${messageStats.today_conversations || 0} টি*\n`;
    text += `• এআই হ্যান্ডল্ড মেসেজ: *${messageStats.ai_messages || 0} টি*\n\n`;

    if (lowStockRes.rows.length > 0) {
      text += `⚠️ *স্টক সতর্কতা (Low Stock):*\n`;
      lowStockRes.rows.forEach((p: any) => {
        text += `• ${p.title}: বাকি *${p.stock} পিস*\n`;
      });
      text += `\n`;
    } else {
      text += `✅ *স্টক অবস্থা:* সব পণ্য পর্যাপ্ত স্টকে আছে।\n\n`;
    }

    const pendingNum = Number(stats.pending_count || 0);
    text += `💡 *এআই ম্যানেজারের পরামর্শ:* ${pendingNum > 0 ? `আপনার ${pendingNum}টি অর্ডার রিভিউ বাকি আছে। "কনফার্ম #অর্ডার_নম্বর" পাঠিয়ে কনফার্ম করুন।` : 'আজকের সব অর্ডার কনফার্মড আছে। চমৎকার কাজ চলছে!'}`;

    return {
      isMerchant: true,
      replyText: text,
      merchantName,
      storeName,
      stats,
    };
  }

  // Quick Command: Help / মেনু
  if (lower === 'help' || lower === 'মেনু' || lower === 'hi' || lower === 'হ্যালো' || lower === 'hello' || lower === 'menu') {
    const fbSummary = fbChannel ? `(✅ ${fbChannel.channel_name} সংযুক্ত)` : '(⚠️ সংযুক্ত নেই)';
    const text = `👋 আসসালামু আলাইকুম *${merchantName}* ভাই!\nআমি আপনার *${storeName}*-এর পার্সোনাল এআই ম্যানেজার (WhatsApp Copilot)।\n\nযেকোনো তথ্য জানতে নিচের নম্বর বা কোড পাঠিয়ে দিন:\n\n` +
      `1️⃣ *অর্ডার* — আজকের ও পেন্ডিং অর্ডারের লাইভ হিসাব\n` +
      `2️⃣ *স্টক* — কোন কোন পণ্যের স্টক কম আছে\n` +
      `3️⃣ *বিক্রি* — আজকের ও মোট বিক্রি এবং লাভের হিসাব\n` +
      `4️⃣ *পেজ* — ফেসবুক পেজ ${fbSummary} ও এআই স্ট্যাটাস\n` +
      `5️⃣ *কমেন্ট* — ফেসবুক কমেন্ট ও এআই প্রাইভেট রিপ্লাইয়ের হিসাব\n` +
      `6️⃣ *মেসেজ* — কাস্টমার মেসেজ ও ইনবক্স কথোপকথনের আপডেট\n` +
      `7️⃣ *সামারি* — আজকের সারাদিনের সম্পূর্ণ এক্সিকিউটিভ রিপোর্ট\n\n` +
      `⚡ *সরাসরি অ্যাকশন কমান্ড (বিনা ড্যাশবোর্ডে কাজ করার জন্য):*\n` +
      `• *কনফার্ম #KS-XXXXXX* — অর্ডার কনফার্ম করুন\n` +
      `• *কুরিয়ার #KS-XXXXXX* — কুরিয়ারে পাঠান\n` +
      `• *বাতিল #KS-XXXXXX* — অর্ডার বাতিল ও স্টক ফেরত\n` +
      `• *[পণ্যের নাম] এর স্টক [সংখ্যা] পিস করো* — স্টক পরিবর্তন\n` +
      `• *ফেসবুক বট বন্ধ/চালু করো* — AI অটোমেশন নিয়ন্ত্রণ\n` +
      `• *টেকওভার 017XXXXXXX* — কাস্টমারকে নিজে হ্যান্ডল করুন\n\n` +
      `💬 অথবা স্বাভাবিক বাংলায় যেকোনো প্রশ্ন বা নির্দেশনা দিতে পারেন!`;

    return {
      isMerchant: true,
      replyText: text,
      merchantName,
      storeName,
      stats,
    };
  }

  // 11. Conversational AI Query with Gemini
  const systemContext = `
তুমি হলে "${storeName}" অনলাইন শপের নিজস্ব স্মার্ট পার্সোনাল এআই বিজনেস ম্যানেজার ও সহকারী (WhatsApp AI Manager)।
তুমি শপ ওনার "${merchantName}"-এর সাথে সরাসরি WhatsApp-এ কথা বলছো।
তোমার কাজ হলো শপের রিয়েল-টাইম লাইভ ডাটাবেজ থেকে নিখুঁত তথ্য দেওয়া, প্রশ্নগুলোর উত্তর দেওয়া এবং দরকারি পরামর্শ দেওয়া।

[শপের লাইভ ডাটাবেজ স্ট্যাটাস]:
- শপের নাম: ${storeName}
- ওনারের নাম: ${merchantName}
- আজকের নতুন অর্ডার: ${stats.today_orders || 0} টি (আজকের বিক্রি: ৳${stats.today_sales || 0})
- মোট সর্বমোট অর্ডার: ${stats.total_orders || 0} টি
- পেন্ডিং অর্ডার: ${stats.pending_count || 0} টি
- কনফার্মড অর্ডার: ${stats.confirmed_count || 0} টি
- কুরিয়ারে পাঠানো হয়েছে: ${stats.shipped_count || 0} টি
- সফলভাবে ডেলিভারড: ${stats.delivered_count || 0} টি
- মোট বিক্রি (Total Sales): ৳${stats.total_sales || 0}
- মোট অর্জিত নিট লাভ: ৳${stats.delivered_profit || 0}
- ডেলিভারি চার্জ: ঢাকা ৳${merchant.delivery_inside_dhaka || 80}, ঢাকার বাইরে ৳${merchant.delivery_outside_dhaka || 150}

[ফেসবুক কমেন্টের লাইভ স্ট্যাটাস]:
- আজকের ফেসবুক কমেন্ট: ${commentStats.today_comments || 0} টি
- সর্বমোট ফেসবুক কমেন্ট: ${commentStats.total_comments || 0} টি
- এআই স্বয়ংক্রিয়ভাবে রিপ্লাই দিয়েছে: ${commentStats.ai_replied_count || 0} টি
- ইনবক্সে পাঠানো প্রাইভেট অফার (Private Replies): ${commentStats.private_replied_count || 0} টি
- এখনো রিপ্লাই দেওয়া বাকি (Unreplied): ${commentStats.unreplied_count || 0} টি

[কাস্টমার মেসেজ ও ইনবক্স স্ট্যাটাস]:
- আজকের নতুন চ্যাট/কথোপকথন: ${messageStats.today_conversations || 0} টি
- সর্বমোট কাস্টমার কথোপকথন: ${messageStats.total_conversations || 0} টি
- সর্বমোট আদান-প্রদান করা মেসেজ: ${messageStats.total_messages || 0} টি (আজকে: ${messageStats.today_messages || 0} টি)
- কাস্টমারদের পাঠানো মেসেজ: ${messageStats.customer_messages || 0} টি
- এআই-এর দেওয়া উত্তরের সংখ্যা: ${messageStats.ai_messages || 0} টি

[ফেসবুক পেজ কানেকশন স্ট্যাটাস - বিশেষ নজর দেবে]:
${fbChannel ? `- ফেসবুক পেজ সফলভাবে সংযুক্ত আছে: পেজের নাম "${fbChannel.channel_name}", পেজ আইডি: ${fbChannel.channel_identifier}, এআই অটো-রিপ্লাই: ${fbChannel.ai_active ? 'চালু (Active)' : 'বন্ধ (Off)'}। ওনার ফেসবুক পেজ নিয়ে জানতে চাইলে নিশ্চিত করবে যে পেজ কানেক্টেড আছে এবং এআই কাজ করছে।` : '- কোনো ফেসবুক পেজ এখনো কানেক্ট করা নেই। ওনার জানতে চাইলে পরিষ্কারভাবে বলবে পেজ কানেক্ট করা নেই এবং ড্যাশবোর্ডের Channels ট্যাব থেকে পেজ কানেক্ট করতে অনুরোধ করবে।'}

[অন্যান্য কানেক্টেড চ্যানেল]:
${channelsRes.rows.length > 0 ? channelsRes.rows.map((c: any) => `- ${c.platform.toUpperCase()}: "${c.channel_name}" (এআই চালু: ${c.ai_active ? 'হ্যাঁ (ON)' : 'না (OFF)'})`).join('\n') : '- কোনো চ্যানেল কানেক্টেড নেই।'}

[সাম্প্রতিক অর্ডারসমূহ]:
${recentOrdersRes.rows.length > 0 ? recentOrdersRes.rows.map((o: any) => `- #${o.order_number} (${o.customer_name}, ${o.customer_phone}) বিল: ৳${o.total_amount}, স্ট্যাটাস: ${o.status}, ঠিকানা: ${o.delivery_address || 'N/A'}`).join('\n') : '- কোনো অর্ডার রেকর্ড নেই।'}

[সাম্প্রতিক ৩টি কমেন্ট]:
${recentCommentsRes.rows.length > 0 ? recentCommentsRes.rows.map((c: any) => `- ${c.customer_name || 'Customer'}: "${c.comment_text}" (${c.ai_replied ? 'Replied' : 'Pending'})`).join('\n') : '- কোনো কমেন্ট রেকর্ড নেই।'}

[সাম্প্রতিক কাস্টমার ইনকোয়ারি]:
${recentInquiriesRes.rows.length > 0 ? recentInquiriesRes.rows.map((m: any) => `- ${m.customer_name || 'Customer'} (${m.customer_phone || 'Inbox'}): "${m.content}"`).join('\n') : '- কোনো কাস্টমার মেসেজ রেকর্ড নেই।'}

[লো-স্টক পণ্য তালিকা]:
${lowStockRes.rows.length > 0 ? lowStockRes.rows.map((p: any) => `- ${p.title}: বাকি ${p.stock} পিস (৳${p.price})`).join('\n') : '- সব পণ্যের স্টক পর্যাপ্ত।'}

[গুরুত্বপূর্ণ নির্দেশিকা]:
১. উত্তরটি WhatsApp-এ যাবে, তাই WhatsApp উপযোগী ফরম্যাটিং ব্যবহার করো (যেমন বোল্ড করার জন্য *শব্দ*, ইমোজি এবং পরিষ্কার লাইন ব্রেক)।
২. ওনার যদি কমেন্ট বা মেসেজ সম্পর্কে জানতে চায় (যেমন: "আজকে কয়টা কমেন্ট আসলো?", "কয়টা মেসেজ আসলো?"), উপরে দেওয়া ফেসবুক কমেন্ট ও কাস্টমার মেসেজের লাইভ হিসাব থেকে ১০০% সঠিক তথ্য দেবে।
৩. সবসময় একজন অভিজ্ঞ, বন্ধুসুলভ, স্মার্ট পার্টনারের মতো আন্তরিক বাংলায় কথা বলবে (যেমন: "জি ভাইয়া", "আপনার শপের বর্তমান হিসাব অনুযায়ী...", ইত্যাদি)।
৪. সংক্ষেপে কিন্তু যথাযথ ও তথ্যবহুল উত্তর দেবে যাতে মোবাইলে পড়তে সুবিধা হয়।
`;

  try {
    const aiReply = await askGemini(trimmedMsg, systemContext);
    if (!aiReply || aiReply.includes('এআই এপিআই কি কনফিগার করা নেই') || aiReply.includes('বর্তমানে এআই রেসপন্স তৈরিতে কিছুটা সমস্যা')) {
      let fbText = `জি ${merchantName} ভাই, আপনার শপের বর্তমান হিসাব অনুযায়ী:\n`;
      fbText += `• 📅 আজকের অর্ডার: *${stats.today_orders || 0} টি* (৳${stats.today_sales || 0})\n`;
      fbText += `• 📦 সর্বমোট অর্ডার: *${stats.total_orders || 0} টি*\n`;
      fbText += `• ⏳ রিভিউ পেন্ডিং: *${stats.pending_count || 0} টি*\n`;
      fbText += `• 💰 সর্বমোট বিক্রি: *৳${stats.total_sales || 0}*\n\n`;
      fbText += `💡 নির্দিষ্ট তথ্যের জন্য *অর্ডার*, *স্টক*, বা *বিক্রি* লিখে মেসেজ দিতে পারেন।`;
      return {
        isMerchant: true,
        replyText: fbText,
        merchantName,
        storeName,
        stats,
      };
    }

    return {
      isMerchant: true,
      replyText: aiReply,
      merchantName,
      storeName,
      stats,
    };
  } catch (err: any) {
    console.error('Gemini error in merchant copilot:', err);
    return {
      isMerchant: true,
      replyText: `জি ${merchantName} ভাই, সাময়িক সার্ভার কানেকশনের জন্য উত্তর দিতে একটু দেরি হচ্ছে। তবে আপনার শপে মোট *${stats.total_orders || 0} টি* অর্ডার এসেছে এবং মোট বিক্রি *৳${stats.total_sales || 0}*।`,
      merchantName,
      storeName,
      stats,
    };
  }
}
