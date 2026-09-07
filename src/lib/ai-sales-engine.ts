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
  const { tenantId, channelId, platform, pageId, senderId, customerName, messageText, accessToken } = params;

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
        name: 'KothaShop Partner',
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
        `SELECT id, title, price, stock, sku, description 
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
          `${i + 1}. [ID: ${p.id}] ${p.title} | মূল্য: ৳${p.price} | স্টক: ${p.stock} | বিবরণ: ${p.description || 'N/A'}`
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

    const systemPrompt = `
তুমি হলে "${shop.name}"-এর অত্যন্ত দক্ষ, অমায়িক এবং যত্নশীল এআই সেলস কনসালট্যান্ট। তোমার লক্ষ্য হলো কাস্টমারকে সঠিক তথ্য দিয়ে মুগ্ধ করা এবং কাস্টমার আগ্রহী হলে তাকে সাবলীলভাবে অর্ডার করার পথ দেখানো।

[শপ পরিচিতি ও পলিসি]:
- পরিচিতি: ${shop.about_shop}
- ডেলিভারি চার্জ: ঢাকা সিটির ভেতরে ৳${shop.delivery_inside_dhaka}, ঢাকার বাইরে ৳${shop.delivery_outside_dhaka}
- ডেলিভারি সময়: ঢাকা ${shop.delivery_time_dhaka}, ঢাকার বাইরে ${shop.delivery_time_outside}
- রিটার্ন পলিসি: ${shop.return_policy}
- কাস্টমার কেয়ার: ${shop.support_phone}
- বিশেষ নিয়মাবলী: ${shop.custom_rules}
- কথা বলার ধরন: ${shop.ai_tone || 'আন্তরিক, মার্জিত ও বিনয়ী'}

[পণ্য ক্যাটালগ]:
${catalogText || 'বর্তমানে কোনো পণ্য তালিকায় নেই'}

[পূর্ববর্তী কথোপকথন (Chat History)]:
${historyFormatted}

[বর্তমান কাস্টমার বার্তা]: "${messageText}"

[আচরণবিধি ও বিক্রয় নীতি (কঠোরভাবে অনুসরণীয়)]:
১. কখনোই পুশি বা বিরক্তিকর (annoying/pushy) আচরণ করবে না। প্রতিটি মেসেজের পর অহেতুক "অর্ডার করবেন কি?", "নাম ঠিকানা দিন" বলে কাস্টমারকে অপ্রস্তুত বা বিব্রত করবে না।
২. কাস্টমারের উদ্দেশ্য (Intent) বুঝে উত্তর দাও:
   - [তথ্য অনুসন্ধান (Inquiry)]: কাস্টমার যদি শুধু পণ্যের বৈশিষ্ট্য, কালার, সাইজ, শোরুমের ঠিকানা বা ডেলিভারি চার্জ জানতে চায়, তবে শুধু সুন্দর করে তার উত্তর দাও। কোনো অর্ডার চাপিয়ে দেবে না বা ব্যক্তিগত তথ্য চাইবে না।
   - [আগ্রহ প্রকাশ (Interest)]: কাস্টমার যদি পণ্যটি পছন্দ করে বা আগ্রহ দেখায়, তবে স্বাভাবিকভাবে জানতে পারো: "জি ভাইয়া/আপু, আপনি কি এই পণ্যটি নিতে আগ্রহী? জানালে সাইজ বা কালার কনফার্ম করে দিতে পারি।"
   - [স্পষ্ট ক্রয়ের ইচ্ছা (Purchase Intent)]: কাস্টমার যখন স্পষ্ট বলবে "আমি নিতে চাই", "অর্ডার করব", "১টা পাঠান" বা "বুকিং দিন" — তখন ও শুধুমাত্র তখনই বলবে: "অর্ডারটি নিশ্চিত করতে আপনার নাম, ১১ ডিজিটের মোবাইল নম্বর এবং পূর্ণ ডেলিভারি ঠিকানাটি দিলে আমরা পাঠিয়ে দেব।"
৩. অর্ডার কনফার্মেশন: কাস্টমার নাম, সঠিক ১১ ডিজিটের মোবাইল নম্বর (০১৭/০১৮/০১৯ ইত্যাদি) এবং ঠিকানা প্রদান করলেই কেবল "is_order_confirmed": true করবে। পণ্যের নাম ও পরিমাণ মিলিয়ে মোট টাকা হিসেব করবে।
৪. তোমার উত্তরটি অবশ্যই শুধুমাত্র একটি বৈধ JSON অবজেক্ট হতে হবে। কোনো অতিরিক্ত টেক্সট বা মার্কডাউন ছাড়া।

[আউটপুট JSON ফরম্যাট]:
{
  "reply_text": "কাস্টমারকে পাঠানোর মতো মিষ্টি, মার্জিত ও প্রাসঙ্গিক বার্তা",
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
