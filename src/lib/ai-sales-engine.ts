import { query, getClient } from './db';
import { saasRedis } from './redis';
import { checkFaqCache, setFaqCache } from './faq-cache';
import { searchCatalogSemantic } from './embeddings';
import {
  extractBangladeshiPhone,
  extractPotentialAddress,
  extractCustomerName,
  evaluateOrderReadiness,
  executeOrderCreation,
  CustomerLead,
} from './agent-skills/sales-agent';

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

    // =========================================================================
    // 4. Progressive Customer Lead Tracking (Multi-Turn Working Memory)
    // =========================================================================
    const leadCacheKey = `saas_lead:${conversationId}`;
    let activeLead = (await saasRedis.get<CustomerLead>(leadCacheKey)) || {};

    // Auto-detect phone, name, and address from incoming customer message
    const detectedPhone = extractBangladeshiPhone(messageText);
    if (detectedPhone) {
      activeLead.customer_phone = detectedPhone;
    }

    const detectedAddress = extractPotentialAddress(messageText);
    if (detectedAddress) {
      activeLead.delivery_address = detectedAddress;
    }

    const detectedName = extractCustomerName(messageText);
    if (detectedName) {
      activeLead.customer_name = detectedName;
    } else if (!activeLead.customer_name && customerName && customerName !== 'Facebook Customer' && customerName !== 'Facebook User' && customerName !== 'Customer') {
      activeLead.customer_name = customerName;
    }

    // Evaluate order readiness and missing fields
    const readiness = evaluateOrderReadiness(activeLead);
    const capturedInfoText = [
      `নাম: ${activeLead.customer_name || 'এখনও সংগৃহীত হয়নি'}`,
      `ফোন নম্বর: ${activeLead.customer_phone || 'এখনও সংগৃহীত হয়নি'}`,
      `ডেলিভারি ঠিকানা: ${activeLead.delivery_address || 'এখনও সংগৃহীত হয়নি'}`,
    ].join(' | ');

    const missingNotice = readiness.missingBengaliLabels.length > 0
      ? `[অর্ডারের জন্য এখনও যা বাকি আছে]: ${readiness.missingBengaliLabels.join(', ')}`
      : `[অর্ডারের সব তথ্য প্রস্তুত]: সব রিকোয়ার্ড ফিল্ড বিদ্যমান!`;

    // =========================================================================
    // 5. Dynamic Semantic RAG: Vector Search for Relevant Products
    // =========================================================================
    let semanticProducts: any[] = [];
    try {
      semanticProducts = await searchCatalogSemantic(tenantId, messageText, 3);
    } catch (ragErr) {
      console.warn('Semantic catalog search failed, falling back to cache:', ragErr);
    }

    let products: any[] | null = semanticProducts;
    if (!products || products.length === 0) {
      const catalogCacheKey = `catalog:${tenantId}`;
      products = await saasRedis.get<any[]>(catalogCacheKey);
      if (!products) {
        const prodRes = await query(
          `SELECT id, title, price, stock, sku, description, rag_knowledge 
           FROM products 
           WHERE tenant_id = $1 AND is_active = TRUE 
           ORDER BY stock DESC 
           LIMIT 15;`,
          [tenantId]
        );
        products = prodRes.rows;
        await saasRedis.set(catalogCacheKey, products, { ex: 3600 });
      }
    }

    const catalogText = (products || [])
      .map(
        (p: any, i: number) =>
          `${i + 1}. [ID: ${p.id}] ${p.title} | মূল্য: ৳${p.price} | স্টক: ${p.stock} | বিবরণ: ${p.description || 'N/A'}${p.rag_knowledge ? ` | র্যাক নলেজ: ${p.rag_knowledge}` : ''}`
      )
      .join('\n');

    // =========================================================================
    // 6. Build Empathetic, Non-Pushy Agentic AI System Prompt
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
You are an expert consultative sales advisor and agentic bot for "${shop.name}" in Bangladesh.
Your mission: Guide customer politely, consult on their questions using RAG product knowledge, and progressively collect missing order info to close sales without losing leads.

[Store Policies & Delivery]:
- শপের নাম: ${shop.name}
- ক্যাশ অন ডেলিভারি: সম্পূর্ণ ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে চেক করে মূল্য পরিশোধ, অগ্রিম টাকা দেওয়ার কোনো প্রয়োজন নেই)।
- ডেলিভারি চার্জ: ঢাকা সিটিতে ৳${shop.delivery_inside_dhaka || 80}, ঢাকার বাইরে ৳${shop.delivery_outside_dhaka || 130}
- ডেলিভারি সময়: ঢাকা ${shop.delivery_time_dhaka || '১-২ দিন'}, ঢাকার বাইরে ${shop.delivery_time_outside || '২-৪ দিন'}
- রিটার্ন পলিসি: ${shop.return_policy || '৭ দিনের সহজ রিটার্ন পলিসি'}

[কাস্টমারের বর্তমান লিড স্টেট (Captured Lead Info)]:
${capturedInfoText}
${missingNotice}

${mappedProductContext}
[পণ্য ক্যাটালগ ও র্যাক নলেজ (RAG Retrieved Products)]:
${catalogText || 'পণ্য ক্যাটালগ সংরক্ষিত আছে'}

[পূর্ববর্তী চ্যাট হিস্টোরি (Chat History)]:
${historyFormatted}

[বর্তমান কাস্টমার বার্তা]: "${messageText}"

[Core Agentic Rules (কঠোরভাবে অনুসরণীয়)]:
১. অমায়িক ও জীবন্ত বাংলায় কাস্টমারকে "ভাইয়া" বা "আপু" বলে সম্বোধন করো।
২. কাস্টমার দাম জানতে চাইলে: মূল্য জানাও + ১ লাইনে উপকারিতা বলো + বয়স/প্রয়োজন জানতে চাও।
৩. কাস্টমার যদি কিনতে চায় ("নিতে চাই", "অর্ডার করব", "১টা পাঠান", "কীভাবে নিব"):
   - যদি কোনো তথ্য মিসিং থাকে (${readiness.missingBengaliLabels.join(', ')}):
     - কাস্টমারকে আন্তরিক ধন্যবাদ দিয়ে শুধুমাত্র মিসিং তথ্যগুলো (${readiness.missingBengaliLabels.join(', ')}) চেয়ে নাও।
     - আশ্বস্ত করো যে সম্পূর্ণ ক্যাশ অন ডেলিভারিতে চেক করে টাকা দিতে পারবে, অগ্রিম টাকা দিতে হবে না।
     - এই মুহূর্তে "is_order_confirmed": false রাখবে।
   - যদি কাস্টমার আংশিক তথ্য দেয় (যেমন শুধু ফোন নম্বর দিয়েছে কিন্তু নাম/ঠিকানা দেয়নি):
     - নম্বরের জন্য ধন্যবাদ জানাও এবং মিষ্টি করে নাম ও ডেলিভারি ঠিকানা চেয়ে নাও।
   - যখন নাম, ১১ ডিজিটের বৈধ মোবাইল নম্বর (013-019) এবং পূর্ণ ডেলিভারি ঠিকানা—এই ৩টি তথ্যই পাওয়া যাবে:
     - তখনই কেবল "is_order_confirmed": true করবে।
     - "order_details" ফিল্ডগুলো নির্ভুলভাবে পূরণ করবে।
     - reply_text-এ উষ্ণ অভিনন্দন ও অর্ডার কনফার্মেশন রিসিট মেসেজ দেবে।

[আউটপুট JSON ফরম্যাট]:
{
  "reply_text": "কাস্টমারকে পাঠানোর মতো উষ্ণ বার্তা",
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

    let replyText =
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

    // Merge Gemini extractions into active lead if detected
    if (aiParsed?.order_details) {
      const details = aiParsed.order_details;
      if (details.customer_name && (!activeLead.customer_name || activeLead.customer_name === 'Facebook Customer')) {
        activeLead.customer_name = details.customer_name;
      }
      if (details.customer_phone && !activeLead.customer_phone) {
        const p = extractBangladeshiPhone(details.customer_phone);
        if (p) activeLead.customer_phone = p;
      }
      if (details.delivery_address && !activeLead.delivery_address) {
        activeLead.delivery_address = details.delivery_address;
      }
      if (details.product_id) activeLead.product_id = details.product_id;
      if (details.product_title) activeLead.product_title = details.product_title;
      if (details.unit_price) activeLead.unit_price = Number(details.unit_price);
      if (details.quantity) activeLead.quantity = Number(details.quantity);
      if (details.delivery_fee) activeLead.delivery_fee = Number(details.delivery_fee);
      if (details.total_amount) activeLead.total_amount = Number(details.total_amount);
    }

    if (!activeLead.product_id && products && products.length > 0) {
      activeLead.product_id = products[0].id;
      activeLead.product_title = products[0].title;
      activeLead.unit_price = Number(products[0].price);
    }

    // Save progressive lead working memory (24h TTL)
    await saasRedis.set(leadCacheKey, activeLead, { ex: 86400 });

    // Sync captured details to conversations ledger for instant dashboard visibility
    if (activeLead.customer_name || activeLead.customer_phone) {
      await query(
        `UPDATE conversations 
         SET customer_name = COALESCE($1, customer_name), 
             customer_phone = COALESCE($2, customer_phone), 
             updated_at = NOW() 
         WHERE id = $3;`,
        [activeLead.customer_name || null, activeLead.customer_phone || null, conversationId]
      );
    }

    // 7. Process Confirmed Order via Agentic Execution Skill
    let orderCreated = false;
    let orderNumber: string | undefined;
    let orderId: string | undefined;

    const finalReadiness = evaluateOrderReadiness(activeLead);
    const hasBuyingIntent = /(?:অর্ডার|নিতে চাই|পাঠান|কিনব|বুকিং|order|buy)/i.test(`${historyFormatted} ${messageText}`);

    if ((aiParsed?.is_order_confirmed || hasBuyingIntent) && finalReadiness.isReady) {
      const orderExec = await executeOrderCreation({
        tenantId,
        channelId,
        lead: activeLead,
        shop,
      });

      if (orderExec.success) {
        orderCreated = true;
        orderNumber = orderExec.orderNumber;
        orderId = orderExec.orderId;
        // Invalidate Redis lead cache after completed order
        await saasRedis.del(leadCacheKey);

        const cName = activeLead.customer_name || 'সম্মানিত ক্রেতা';
        replyText = `আলহামদুলিল্লাহ ${cName} ভাইয়া/আপু! আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে।\n\n📦 অর্ডার নম্বর: #${orderNumber}\n🛒 পণ্য: ${activeLead.product_title || 'খেলনা'}\n📍 ডেলিভারি ঠিকানা: ${activeLead.delivery_address}\n\nসম্পূর্ণ ক্যাশ অন ডেলিভারিতে পণ্য হাতে পেয়ে চেক করে মূল্য পরিশোধ করতে পারবেন। ${shop.name}-এর সাথে থাকার জন্য ধন্যবাদ!`;

        // Update stored AI message with final confirmation text
        await query(
          `UPDATE messages SET content = $1 WHERE conversation_id = $2 AND sender_type = 'ai' AND created_at >= NOW() - INTERVAL '10 seconds';`,
          [replyText, conversationId]
        );
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
