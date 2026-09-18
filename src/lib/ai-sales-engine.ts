import { query, getClient } from './db';
import { saasRedis } from './redis';
import { checkFaqCache, setFaqCache } from './faq-cache';

interface ProcessMessageParams {
  tenantId: string;
  channelId: string;
  platform?: 'facebook' | 'whatsapp' | 'instagram';
  pageId: string;
  senderId: string;
  customerName?: string;
  messageText: string;
  accessToken: string;
  referralPostId?: string;
}

interface ProcessMessageResult {
  success: boolean;
  isMuted?: boolean;
  replyText?: string;
  orderCreated?: boolean;
  orderNumber?: string;
  orderId?: string;
  error?: string;
}

export async function processCustomerMessage(
  params: ProcessMessageParams
): Promise<ProcessMessageResult> {
  const { tenantId, channelId, platform, pageId, senderId, customerName, messageText, accessToken, referralPostId } = params;

  try {
    // 1. Resolve or Create Conversation
    let conversationId: string;
    let isMuted = false;

    const convRes = await query(
      `SELECT id, ai_muted_until 
       FROM conversations 
       WHERE channel_id = $1 AND customer_identifier = $2 
       LIMIT 1;`,
      [channelId, senderId]
    );

    if (convRes.rows.length > 0) {
      conversationId = convRes.rows[0].id;
      const mutedUntil = convRes.rows[0].ai_muted_until;
      if (mutedUntil && new Date(mutedUntil) > new Date()) {
        isMuted = true;
      }
    } else {
      const newConvRes = await query(
        `INSERT INTO conversations (tenant_id, channel_id, customer_identifier, customer_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id;`,
        [tenantId, channelId, senderId, customerName || 'Facebook Customer']
      );
      conversationId = newConvRes.rows[0].id;
    }

    // Save incoming customer message
    await query(
      `INSERT INTO messages (conversation_id, sender_type, content)
       VALUES ($1, 'customer', $2);`,
      [conversationId, messageText]
    );

    // If human takeover is active, silently stop AI processing
    if (isMuted) {
      console.log(`[Human Takeover Active] AI is muted for customer ${senderId} in conversation ${conversationId}`);
      return { success: true, isMuted: true };
    }

    // =========================================================================
    // 2. Zero-Token FAQ Cache Check (Fast Redis Lookup in <5ms)
    // =========================================================================
    const cachedFaq = await checkFaqCache(tenantId, messageText);
    if (cachedFaq) {
      console.log(`⚡ [Zero-Token FAQ Hit] "${messageText.slice(0, 30)}..." -> Instant Redis answer`);

      // Record AI message in DB
      await query(
        `INSERT INTO messages (conversation_id, sender_type, content)
         VALUES ($1, 'ai', $2);`,
        [conversationId, cachedFaq]
      );
      await query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1;`, [conversationId]);

      // Dispatch to Messenger
      if (accessToken && accessToken !== 'mock_token') {
        fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: cachedFaq },
          }),
        }).catch((err) => console.warn('Meta send error:', err.message));
      }

      return {
        success: true,
        replyText: cachedFaq,
        orderCreated: false,
      };
    }

    // =========================================================================
    // 3. Multi-Turn Working Memory (2-Tier: Fast Redis Cache + PostgreSQL Ledger)
    // =========================================================================
    const historyCacheKey = `conv_history:${conversationId}`;
    let cachedHistory = await saasRedis.get<any[]>(historyCacheKey);

    if (!cachedHistory || !Array.isArray(cachedHistory) || cachedHistory.length === 0) {
      // Fallback: Read from DB if Redis working memory is cold
      const historyRes = await query(
        `SELECT sender_type, content 
         FROM messages 
         WHERE conversation_id = $1 
         ORDER BY created_at DESC 
         LIMIT 8;`,
        [conversationId]
      );
      cachedHistory = historyRes.rows.reverse();
    }

    // Append latest incoming customer message to working memory (sliding window of 8 messages, 24-hour TTL)
    const activeHistory = [...cachedHistory, { sender_type: 'customer', content: messageText }].slice(-8);
    await saasRedis.set(historyCacheKey, activeHistory, { ex: 86400 });

    const historyFormatted = activeHistory
      .map((m: any) => `${m.sender_type === 'customer' ? 'Customer' : 'AI Assistant'}: ${m.content}`)
      .join('\n');

    // =========================================================================
    // 4. Redis-Cached Store Knowledge & Catalog (1-Hour TTL + Event Invalidation)
    // =========================================================================
    const shopCacheKey = `shop:${tenantId}`;
    let shop = await saasRedis.get<any>(shopCacheKey);

    if (!shop) {
      const tenantRes = await query(
        `SELECT name, about_shop, delivery_inside_dhaka, delivery_outside_dhaka, 
                delivery_time_dhaka, delivery_time_outside, return_policy, ai_tone, 
                custom_rules, support_phone 
         FROM tenants 
         WHERE id = $1;`,
        [tenantId]
      );

      shop = tenantRes.rows[0] || {
        name: 'ShopPilot Partner',
        about_shop: 'একটি বিশ্বস্ত অনলাইন শপ',
        delivery_inside_dhaka: 80,
        delivery_outside_dhaka: 130,
        delivery_time_dhaka: '১-২ কর্মদিবস',
        delivery_time_outside: '৩-৫ কর্মদিবস',
        return_policy: '৭ দিনের সহজ রিটার্ন পলিসি',
        support_phone: '০১৭০০০০০০০০',
        ai_tone: 'polite and friendly',
        custom_rules: 'ক্যাশ অন ডেলিভারিতে অর্ডার গ্রহণ করা হয়।',
      };
      // 1-hour TTL (refreshes automatically or invalidated on updates)
      await saasRedis.set(shopCacheKey, shop, { ex: 3600 });
    }

    const catalogCacheKey = `catalog:${tenantId}`;
    let products = await saasRedis.get<any[]>(catalogCacheKey);

    if (!products) {
      const prodRes = await query(
        `SELECT id, title, price, stock, sku, description, rag_knowledge 
         FROM products 
         WHERE tenant_id = $1 AND is_active = TRUE 
         ORDER BY stock DESC 
         LIMIT 30;`,
        [tenantId]
      );
      products = prodRes.rows;
      // 1-hour TTL (refreshes automatically or invalidated on updates/orders)
      await saasRedis.set(catalogCacheKey, products, { ex: 3600 });
    }

    const catalogText = products
      .map(
        (p: any, i: number) =>
          `${i + 1}. [ID: ${p.id}] ${p.title} | মূল্য: ৳${p.price} | স্টক: ${p.stock} | বিবরণ: ${p.description || 'N/A'}${p.rag_knowledge ? ` | র্যাক নলেজ: ${p.rag_knowledge}` : ''}`
      )
      .join('\n');

    // =========================================================================
    // 5. Build Empathetic, Non-Pushy AI System Prompt
    // =========================================================================
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY missing in environment.');
      return { success: false, error: 'GEMINI_API_KEY missing' };
    }

    // Check if customer came from a specific mapped video post
    let mappedProductContext = '';
    if (referralPostId) {
      try {
        const mappedRes = await query(
          `SELECT p.id, p.title, p.price, p.stock, p.sku, p.description, p.rag_knowledge
           FROM post_product_mappings ppm
           JOIN products p ON ppm.product_id = p.id
           WHERE ppm.post_id = $1 AND ppm.tenant_id = $2
           LIMIT 1;`,
          [referralPostId, tenantId]
        );
        if (mappedRes.rows.length > 0) {
          const mp = mappedRes.rows[0];
          mappedProductContext = `
[কাস্টমার ফেসবুকের যে নির্দিষ্ট ভিডিও/পোস্ট দেখে মেসেজ দিয়েছেন তার লিঙ্কড পণ্য (100% নিশ্চিত)]:
- পণ্যের নাম: ${mp.title}
- নির্ধারিত মূল্য: ৳${mp.price}
- বর্তমান লাইভ স্টক: ${mp.stock} পিস
- পণ্যের বিবরণ: ${mp.description || 'N/A'}
${mp.rag_knowledge ? `- পণ্যের বিস্তারিত এআই র্যাক নলেজ (RAG Knowledge / স্পেসিফিকেশন): ${mp.rag_knowledge}` : ''}
(কাস্টমার যখন এই পণ্যটির তথ্য, সাইজ, উপাদান বা মূল্য জানতে চাইবে, নিশ্চিতভাবে এই লিঙ্কড পণ্যের র্যাক নলেজ ও মূল্য দেখে নির্ভুল তথ্য দাও।)
`;
        }
      } catch (e) {
        console.warn('Could not query post_product_mappings in sales engine:', e);
      }
    }

    const systemPrompt = `
[Role & Identity]:
You are an expert sales representative, consultative advisor, and child psychology enthusiast working for "${shop.name}" — a premium online children's educational and activity toy store in Bangladesh.
Your primary mission: Convert inquiries into confirmed sales so no customer or lead is lost. Always maintain high warmth, credibility, and proactive engagement.

[Product & Value Proposition Context]:
We specialize in child brain development, Montessori, sensory, and educational activity toys (যেমন: Felt Busy Board, Wooden Counting Frames, Magnetic Learning Blocks, Puzzle Sets, Cognitive Skill Toys).
Key Value Drivers:
- "ব্রেইন ডেভেলপমেন্ট" (Brain Development, logic, problem-solving, cognitive growth).
- "মোবাইল ও স্ক্রিন আসক্তি কমানো" (100% Screen-free independent play, rescuing kids from phones/tablets).
- "ফাইন মোটর স্কিলস" (Fine Motor Skills, hand-eye coordination).

[Store Knowledge & Delivery Policies]:
- শপের নাম: ${shop.name}
- শপের বিবরণ: ${shop.about_shop}
- ক্যাশ অন ডেলিভারি: সম্পূর্ণ ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে চেক করে টাকা পরিশোধ, অগ্রিম টাকা দেওয়ার কোনো প্রয়োজন নেই)।
- ডেলিভারি চার্জ: ঢাকা সিটির ভেতরে ৳${shop.delivery_inside_dhaka || 80}, ঢাকার বাইরে ৳${shop.delivery_outside_dhaka || 130}
- ডেলিভারি সময়: ঢাকা ${shop.delivery_time_dhaka || '১-২ দিন'}, ঢাকার বাইরে ${shop.delivery_time_outside || '২-৪ দিন'}
- রিটার্ন পলিসি: ${shop.return_policy || '৭ দিনের সহজ এক্সচেঞ্জ/রিটার্ন সুবিধা'}
- হেল্পলাইন / সাপোর্ট: ${shop.support_phone || 'ইনবক্স মেসেজ'}
- বিশেষ নীতিমালা: ${shop.custom_rules || 'অগ্রিম কোনো টাকা দিতে হবে না, পণ্য হাতে পেয়ে মূল্য পরিশোধ (ক্যাশ অন ডেলিভারি)।'}
${mappedProductContext}
[পণ্য ক্যাটালগ ও লাইভ স্টক]:
${catalogText || 'বর্তমানে পণ্য তালিকায় তথ্য সংরক্ষিত আছে'}

[পূর্ববর্তী চ্যাট হিস্টোরি (Chat History)]:
${historyFormatted}

[বর্তমান কাস্টমার বার্তা]: "${messageText}"

[Core Behavior, Psychology & Conversion Rules (কঠোরভাবে অনুসরণীয়)]:
1. Language & Warmth:
   - অত্যন্ত অমায়িক, আন্তরিক ও জীবন্ত বাংলায় (Bangla script) কথা বলো। রোবোটিক বা যান্ত্রিক ভাষা সম্পূর্ণ পরিহার করো।
   - কাস্টমারকে পরম শ্রদ্ধায় "ভাইয়া" বা "আপু" বলে সম্বোধন করো।

2. The "No Dead-End" Rule (কোনো উত্তরের সমাপ্তি যেন থমকে না যায়):
   - কখনোই শুধু পণ্যের দাম বা একক সংখ্যা লিখে থেমে যাবে না।
   - উত্তরের গঠন সবসময় হবে:
     [আন্তরিক কুশল বিনিময়] + [সংক্ষিপ্ত ভ্যালু প্রপোজিশন (ব্রেইন ডেভেলপমেন্ট / মোবাইল আসক্তি কমানো)] + [সঠিক মূল্য ও ক্যাশ অন ডেলিভারির সুবিধা] + [একটি এনগেজিং প্রশ্ন (যেমন বাচ্চার বয়স)]।

3. Handling "Price? / দাম কত? / কত?":
   - কাস্টমার দাম জানতে চাইলে প্রথমে মিষ্টিভাবে দাম স্পষ্টভাবে জানাও, পণ্যের মূল উপকারিতা (মোবাইল থেকে দূরে রেখে ব্রেইন শার্প করা) এক লাইনে স্মরণ করিয়ে দাও এবং সাথে সাথে বাচ্চার বয়স জানতে চাও।
   - উদাহরণ: "আসসালামু আলাইকুম ভাইয়া/আপু! আমাদের এই চমৎকার ব্রেইন ডেভেলপমেন্ট টয়টির অফার মূল্য মাত্র [Price] টাকা। এটি বাচ্চাদের মোবাইল আসক্তি দূর করে নিজ থেকেই খেলায় মনোযোগী করতে দারুণ কাজ করে। আপনার সোনামণির বয়স কত ভাইয়া/আপু? বয়স অনুযায়ী এটি তার জন্য কতটা উপযোগী ও কার্যকরী হবে, তা আমি আপনাকে সুন্দরভাবে জানাতে পারব!"

4. Scarcity & Gentle Urgency:
   - কাস্টমার যখন পছন্দ করে বা আগ্রহ দেখায়, তখন হালকা আরজেন্সি তৈরি করো (যেমন: "আমাদের এই ব্যাচটির স্টক বেশ সীমিত ভাইয়া/আপু, খুব দ্রুত শেষ হয়ে যাচ্ছে")।

5. Active Order Taking Skills (অর্ডার কনফার্ম করার পারদর্শিতা):
   - কাস্টমার যখনই কিনতে চায় (যেমন: "নিতে চাই", "১টা পাঠান", "অর্ডার করব", "কীভাবে নিব?", "বুকিং দিন") — সাথে সাথে বিনয়ের সাথে বলো:
     "অসংখ্য ধন্যবাদ ভাইয়া/আপু! আপনার সোনামণির জন্য অর্ডারটি নিশ্চিত করতে অনুগ্রহ করে আপনার:
     ১. নাম
     ২. সক্রিয় ১১ ডিজিটের মোবাইল নম্বর
     ৩. পূর্ণ ডেলিভারি ঠিকানা (বাসা/রোড/এলাকা/জেলা)
     লিখে জানিয়ে দিন। অগ্রিম কোনো টাকা দিতে হবে না, সম্পূর্ণ ক্যাশ অন ডেলিভারিতে পণ্য হাতে পেয়ে চেক করে টাকা দিতে পারবেন।"
   - কাস্টমার যদি আংশিক তথ্য দেয় (যেমন শুধু ফোন নম্বর দিয়েছে কিন্তু ঠিকানা দেয়নি, অথবা শুধু ঠিকানা দিয়েছে কিন্তু ফোন দেয়নি) — তখন মিসিং তথ্যটি চেয়ে মিষ্টি করে বলো যাতে লিড ড্রপ না হয়।

6. Order Confirmation ("is_order_confirmed": true):
   - যখন কাস্টমার তার (১) নাম, (২) ১১ ডিজিটের বৈধ মোবাইল নম্বর (যেমন: 017/018/019/016/015/013...) এবং (৩) ডেলিভারি ঠিকানা প্রদান করবে:
     - তখনই কেবল "is_order_confirmed": true করবে।
     - "order_details"-এর সব ফিল্ড নির্ভুলভাবে পূর্ণ করবে (প্রোডাক্ট আইডি, টাইটেল, পরিমাণ, ইউনিট প্রাইজ, ডেলিভারি ফি এবং টোটাল অ্যামাউন্ট)।
     - "reply_text"-এ কাস্টমারকে অত্যন্ত সুন্দর ও প্রফেশনাল কনফার্মেশন মেসেজ দেবে (অর্ডারটি গৃহীত হয়েছে, ক্যাশ অন ডেলিভারি, এবং মোট টাকার পরিমাণ উল্লেখ করে)।

7. Output JSON Requirement:
   - তোমার সম্পূর্ণ উত্তরটি অবশ্যই একটি বৈধ JSON অবজেক্ট হতে হবে। কোনো অতিরিক্ত টেক্সট বা মার্কডাউন ব্যাকটিক ছাড়া।

[আউটপুট JSON ফরম্যাট]:
{
  "reply_text": "কাস্টমারকে পাঠানোর মতো উষ্ণ, আকর্ষণীয় ও সেলস-ক্লোজিং বার্তা",
  "is_order_confirmed": true/false,
  "order_details": {
    "customer_name": "গ্রাহকের নাম",
    "customer_phone": "017XXXXXXXX",
    "delivery_address": "পূর্ণ ঠিকানা",
    "delivery_city": "Dhaka অথবা Outside Dhaka",
    "product_id": "পণ্য আইডি",
    "product_title": "পণ্য নাম",
    "quantity": 1,
    "unit_price": 1200,
    "delivery_fee": 80,
    "total_amount": 1280
  }
}
`;

    const candidateModels = ['gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-2.5-flash'];
    let geminiData: any = null;

    for (const model of candidateModels) {
      try {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(geminiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.3,
            },
          }),
        });
        const d = await geminiRes.json();
        if (d.candidates && d.candidates[0]?.content?.parts?.[0]?.text) {
          geminiData = d;
          break;
        } else if (d.error) {
          console.warn(`[Gemini Model ${model} Warning]:`, d.error.message);
        }
      } catch (err: any) {
        console.warn(`[Gemini Model ${model} Fetch Failed]:`, err.message);
      }
    }
    let aiParsed: any = null;

    try {
      const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        aiParsed = JSON.parse(rawText);
      }
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON output:', parseErr);
    }

    const replyText =
      aiParsed?.reply_text ||
      'ধন্যবাদ আপনার বার্তার জন্য! আমাদের একজন প্রতিনিধি খুব শীঘ্রই আপনার সাথে যোগাযোগ করবেন।';

    // 6. Save AI reply to messages (PostgreSQL) and update Redis working memory
    await query(
      `INSERT INTO messages (conversation_id, sender_type, content)
       VALUES ($1, 'ai', $2);`,
      [conversationId, replyText]
    );

    // Update Redis working memory with AI response (24h TTL)
    activeHistory.push({ sender_type: 'ai', content: replyText });
    await saasRedis.set(historyCacheKey, activeHistory.slice(-8), { ex: 86400 });

    // Update conversation timestamp
    await query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1;`, [conversationId]);

    // 7. Process Confirmed Order
    let orderCreated = false;
    let orderNumber: string | undefined;
    let orderId: string | undefined;

    if (aiParsed?.is_order_confirmed && aiParsed.order_details?.customer_phone) {
      const details = aiParsed.order_details;
      const client = await getClient();

      try {
        await client.query('BEGIN');

        orderNumber = `KS-${Math.floor(100000 + Math.random() * 900000)}`;
        const cName = details.customer_name || customerName || 'Valued Customer';
        const cPhone = details.customer_phone;
        const address = details.delivery_address || 'Address from chat';
        const city = details.delivery_city || 'Dhaka';
        const fee = Number(details.delivery_fee) || (city.toLowerCase().includes('dhaka') ? Number(shop.delivery_inside_dhaka) : Number(shop.delivery_outside_dhaka));
        const subtotal = Number(details.unit_price || 0) * Number(details.quantity || 1);
        const total = Number(details.total_amount) || subtotal + fee;
        const profit = Math.round(subtotal * 0.35);

        const orderInsertSql = `
          INSERT INTO orders (
            order_number, tenant_id, customer_name, customer_phone,
            delivery_address, delivery_city, district, delivery_fee, 
            subtotal, total_amount, status, channel_id, notes, 
            courier_name, courier_status, fraud_score, capi_fired, estimated_profit
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, 
            'AI Native Sales Engine', 'Pathao Courier', 'pending', 100, TRUE, $12
          ) RETURNING id, order_number;
        `;

        const orderRes = await client.query(orderInsertSql, [
          orderNumber,
          tenantId,
          cName,
          cPhone,
          address,
          city,
          city,
          fee,
          subtotal,
          total,
          channelId,
          profit,
        ]);

        const newOrder = orderRes.rows[0];
        orderId = newOrder.id;
        orderNumber = newOrder.order_number;
        orderCreated = true;

        // Insert Order Item
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_title, unit_price, quantity, total_price)
           VALUES ($1, $2, $3, $4, $5, $6);`,
          [
            orderId,
            details.product_id || null,
            details.product_title || 'Product',
            details.unit_price || subtotal,
            details.quantity || 1,
            subtotal,
          ]
        );

        // Decrement Product Inventory if matched
        if (details.product_id) {
          await client.query(
            `UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = NOW() WHERE id = $2 AND tenant_id = $3;`,
            [details.quantity || 1, details.product_id, tenantId]
          );
          // Invalidate cached catalog in Redis
          await saasRedis.del(catalogCacheKey);
        }

        await client.query('COMMIT');
        console.log(`🎉 [Native Engine] Order created: #${orderNumber} for ${cName} (${cPhone}) - ৳${total}`);
      } catch (orderErr: any) {
        await client.query('ROLLBACK');
        console.error('Order creation transaction failed:', orderErr);
      } finally {
        client.release();
      }
    }

    // 8. Dispatch Reply to Customer via Meta Graph API (WhatsApp Cloud API or Messenger)
    const hasValidMetaToken =
      accessToken &&
      accessToken !== 'mock_token' &&
      accessToken !== 'whatsapp_managed_token' &&
      accessToken.startsWith('EAA');

    if (hasValidMetaToken) {
      try {
        const isWhatsApp =
          platform === 'whatsapp' ||
          (senderId && senderId.startsWith('880') && !senderId.includes('_'));

        if (isWhatsApp) {
          // WhatsApp Cloud API Outgoing Message
          const waUrl = `https://graph.facebook.com/v19.0/${pageId}/messages`;
          const waRes = await fetch(waUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: senderId,
              type: 'text',
              text: { body: replyText },
            }),
          });
          if (!waRes.ok) {
            const errData = await waRes.json();
            console.warn('⚠️ WhatsApp Cloud API reply error:', errData);
          } else {
            console.log(`✅ [WhatsApp Cloud API] Sent reply to ${senderId}: "${replyText.slice(0, 30)}..."`);
          }
        } else {
          // Facebook Messenger / Instagram DM Outgoing Message
          const fbRes = await fetch(
            `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipient: { id: senderId },
                message: { text: replyText },
              }),
            }
          );
          if (!fbRes.ok) {
            const errData = await fbRes.json();
            console.warn('⚠️ Meta Graph API reply error:', errData);
          } else {
            console.log(`✅ [Graph API] Sent reply to ${senderId}: "${replyText.slice(0, 30)}..."`);
          }
        }
      } catch (graphErr: any) {
        console.error('Meta Graph / WhatsApp API call error:', graphErr.message);
      }
    }

    // 9. Optional Async Dispatch to n8n (Google Sheets / External Sync)
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nWebhookUrl && orderCreated) {
      fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'order.created',
          tenant_id: tenantId,
          order_number: orderNumber,
          customer_name: customerName,
          order_details: aiParsed?.order_details,
        }),
      }).catch(() => {});
    }

    return {
      success: true,
      replyText,
      orderCreated,
      orderNumber,
      orderId,
    };
  } catch (error: any) {
    console.error('processCustomerMessage error:', error);
    return { success: false, error: error.message };
  }
}
