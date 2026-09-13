import { query } from './db';
import { askGemini } from './gemini';

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
        replyText: `👋 আসসালামু আলাইকুম!\nআমি *KothaShop AI Assistant*।\n\nআপনার এই নম্বরটি (*+${rawSenderPhone.replace(/\D/g, '')}*) KothaShop-এর কোনো শপ অ্যাকাউন্টের সাথে যুক্ত নেই।\n\n💡 আপনার শপের লাইভ অর্ডার, বিক্রি ও এআই আপডেট পেতে আপনার রেজিস্টার্ড মোবাইল নম্বর দিয়ে মেসেজ করুন অথবা ড্যাশবোর্ডের Settings থেকে নম্বর আপডেট করুন।`,
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

  // 6. Handle quick keyword commands for zero-latency instant responses
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
      text += `   💡 KothaShop ড্যাশবোর্ডের *Channels* ট্যাব থেকে আপনার ফেসবুক পেজটি কানেক্ট করে নিন।\n\n`;
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

  // Quick Command: Help / মেনু
  if (lower === 'help' || lower === 'মেনু' || lower === 'hi' || lower === 'হ্যালো' || lower === 'hello' || lower === 'menu') {
    const fbSummary = fbChannel ? `(✅ ${fbChannel.channel_name} সংযুক্ত)` : '(⚠️ সংযুক্ত নেই)';
    const text = `👋 আসসালামু আলাইকুম *${merchantName}* ভাই!\nআমি আপনার *${storeName}*-এর পার্সোনাল এআই ম্যানেজার (WhatsApp Copilot)।\n\nযেকোনো তথ্য জানতে নিচের নম্বর বা কোড পাঠিয়ে দিন:\n\n` +
      `1️⃣ *অর্ডার* — আজকের ও পেন্ডিং অর্ডারের লাইভ হিসাব\n` +
      `2️⃣ *স্টক* — কোন কোন পণ্যের স্টক কম আছে\n` +
      `3️⃣ *বিক্রি* — আজকের ও মোট বিক্রি এবং লাভের হিসাব\n` +
      `4️⃣ *পেজ* — ফেসবুক পেজ ${fbSummary} ও এআই স্ট্যাটাস\n\n` +
      `💬 অথবা স্বাভাবিক বাংলায় যেকোনো প্রশ্ন করুন, যেমন:\n` +
      `• _"আজকে কয়টা অর্ডার পড়েছে?"_\n` +
      `• _"আমার ফেসবুক পেজ কি কানেক্টেড আছে?"_\n` +
      `• _"স্টকে কী কী প্রোডাক্ট আছে?"_\n` +
      `• _"আজকের মোট বিক্রি কত?"_`;

    return {
      isMerchant: true,
      replyText: text,
      merchantName,
      storeName,
      stats,
    };
  }

  // 7. Conversational AI Query with Gemini
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

[ফেসবুক পেজ কানেকশন স্ট্যাটাস - বিশেষ নজর দেবে]:
${fbChannel ? `- ফেসবুক পেজ সফলভাবে সংযুক্ত আছে: পেজের নাম "${fbChannel.channel_name}", পেজ আইডি: ${fbChannel.channel_identifier}, এআই অটো-রিপ্লাই: ${fbChannel.ai_active ? 'চালু (Active)' : 'বন্ধ (Off)'}। ওনার ফেসবুক পেজ নিয়ে জানতে চাইলে নিশ্চিত করবে যে পেজ কানেক্টেড আছে এবং এআই কাজ করছে।` : '- কোনো ফেসবুক পেজ এখনো কানেক্ট করা নেই। ওনার জানতে চাইলে পরিষ্কারভাবে বলবে পেজ কানেক্ট করা নেই এবং ড্যাশবোর্ডের Channels ট্যাব থেকে পেজ কানেক্ট করতে অনুরোধ করবে।'}

[অন্যান্য কানেক্টেড চ্যানেল]:
${channelsRes.rows.length > 0 ? channelsRes.rows.map((c: any) => `- ${c.platform.toUpperCase()}: "${c.channel_name}" (এআই চালু: ${c.ai_active ? 'হ্যাঁ (ON)' : 'না (OFF)'})`).join('\n') : '- কোনো চ্যানেল কানেক্টেড নেই।'}

[সাম্প্রতিক অর্ডারসমূহ]:
${recentOrdersRes.rows.length > 0 ? recentOrdersRes.rows.map((o: any) => `- #${o.order_number} (${o.customer_name}, ${o.customer_phone}) বিল: ৳${o.total_amount}, স্ট্যাটাস: ${o.status}, ঠিকানা: ${o.delivery_address || 'N/A'}`).join('\n') : '- কোনো অর্ডার রেকর্ড নেই।'}

[লো-স্টক পণ্য তালিকা]:
${lowStockRes.rows.length > 0 ? lowStockRes.rows.map((p: any) => `- ${p.title}: বাকি ${p.stock} পিস (৳${p.price})`).join('\n') : '- সব পণ্যের স্টক পর্যাপ্ত।'}

[গুরুত্বপূর্ণ নির্দেশিকা]:
১. উত্তরটি WhatsApp-এ যাবে, তাই WhatsApp উপযোগী ফরম্যাটিং ব্যবহার করো (যেমন বোল্ড করার জন্য *শব্দ*, ইমোজি এবং পরিষ্কার লাইন ব্রেক)।
২. ওনার যদি ফেসবুক পেজ কানেক্টেড আছে কিনা জিজ্ঞেস করে, সাথে সাথে উপরের ফেসবুক পেজ স্ট্যাটাস দেখে পেজের নামসহ নিশ্চিত উত্তর দেবে।
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
