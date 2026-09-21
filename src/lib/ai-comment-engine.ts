import { query } from './db';
import { saasRedis } from './redis';

interface ProcessCommentParams {
  tenantId: string;
  channelId: string;
  postId: string;
  commentId: string;
  customerName?: string;
  customerId?: string;
  commentText: string;
  postMessage?: string;
  mediaUrl?: string;
  permalinkUrl?: string;
  accessToken: string;
  pageId?: string;
}

export async function processFacebookComment(params: ProcessCommentParams) {
  const {
    tenantId,
    channelId,
    postId,
    commentId,
    customerName,
    customerId,
    commentText,
    postMessage,
    mediaUrl,
    permalinkUrl,
    accessToken,
    pageId: providedPageId,
  } = params;

  try {
    // 1. Upsert Facebook Post
    await query(
      `INSERT INTO facebook_posts (tenant_id, channel_id, post_id, message, media_url, permalink_url, comment_count, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, NOW())
       ON CONFLICT (tenant_id, post_id) 
       DO UPDATE SET 
         comment_count = facebook_posts.comment_count + 1,
         updated_at = NOW();`,
      [tenantId, channelId, postId, postMessage || 'Facebook Post', mediaUrl || null, permalinkUrl || null]
    );

    // 2. Fetch Shop Knowledge and Products for Context
    const shopCacheKey = `shop:${tenantId}`;
    let shop = await saasRedis.get<any>(shopCacheKey);

    if (!shop) {
      const tenantRes = await query(
        `SELECT name, about_shop, delivery_inside_dhaka, delivery_outside_dhaka, return_policy, ai_tone, support_phone 
         FROM tenants 
         WHERE id = $1;`,
        [tenantId]
      );
      shop = tenantRes.rows[0] || {
        name: 'আমাদের শপ',
        about_shop: 'একটি বিশ্বস্ত অনলাইন শপ',
        delivery_inside_dhaka: 80,
        delivery_outside_dhaka: 150,
        return_policy: '৭ দিনের সহজ রিটার্ন পলিসি',
        support_phone: '',
      };
      await saasRedis.set(shopCacheKey, shop, { ex: 3600 });
    }

    // Check if this post is mapped to a specific product
    let mappedProduct: any = null;
    try {
      const mappedRes = await query(
        `SELECT p.id, p.title, p.price, p.stock, p.category, p.description, p.rag_knowledge
         FROM post_product_mappings ppm
         JOIN products p ON ppm.product_id = p.id
         WHERE ppm.post_id = $1 AND ppm.tenant_id = $2
         LIMIT 1;`,
        [postId, tenantId]
      );
      if (mappedRes.rows.length > 0) {
        mappedProduct = mappedRes.rows[0];
      }
    } catch (e) {
      console.warn('Could not query post_product_mappings:', e);
    }

    // Fetch product catalog for general fallback context (channel-scoped)
    const prodRes = await query(
      `SELECT title, price, stock, category, rag_knowledge FROM products 
       WHERE tenant_id = $1 AND (channel_id IS NULL OR channel_id = $2) AND is_active = TRUE 
       ORDER BY stock DESC LIMIT 15;`,
      [tenantId, channelId]
    );
    const productCatalog = prodRes.rows
      .map((p) => `- ${p.title}: ৳${p.price} (স্টক: ${p.stock})`)
      .join('\n');

    const mappedProductContext = mappedProduct
      ? `
[এই নির্দিষ্ট ভিডিও/পোস্টের লিংক করা মূল পণ্য (100% নিশ্চিত)]:
- পণ্যের নাম: ${mappedProduct.title}
- নির্ধারিত মূল্য: ৳${mappedProduct.price}
- লাইভ স্টক: ${mappedProduct.stock} পিস
- বিবরণ: ${mappedProduct.description || 'N/A'}
${mappedProduct.rag_knowledge ? `- এআই র্যাক নলেজ (RAG Knowledge / স্পেক্স / উপাদান / নির্দেশিকা): ${mappedProduct.rag_knowledge}` : ''}
(কাস্টমার এই পোস্টের পণ্যের দাম, সাইজ, উপাদান বা বিবরণ জানতে চাইলে উপরের এই নির্দিষ্ট পণ্যটির সঠিক তথ্য দেখে উত্তর জানাও।)`
      : '';

    // 3. Generate Public AI Comment Reply with Gemini 2.5 Flash
    const apiKey = process.env.GEMINI_API_KEY;
    let aiReplyText = `ধন্যবাদ আপনার কমেন্টের জন্য ভাইয়া/আপু! বিস্তারিত তথ্যের জন্য আমরা আপনাকে ইনবক্সে মেসেজ দিয়েছি, দয়া করে ইনবক্স চেক করুন।`;

    if (apiKey) {
      const commentPrompt = `
তুমি হলে "${shop.name}"-এর সোশ্যাল মিডিয়া সেলস ও চাইল্ড অ্যাক্টিভিটি কনসালট্যান্ট।
আমাদের ফেসবুক পোস্টের নিচে একজন অভিভাবক/কাস্টমার কমেন্ট করেছেন। তোমাকে পাবলিক কমেন্টে অত্যন্ত মিষ্টি, আন্তরিক ও আকর্ষণীয় বাংলায় উত্তর দিতে হবে।

[শপ পরিচিতি]: ${shop.about_shop}
[পণ্য বিভাগ]: বাচ্চাদের ব্রেইন ডেভেলপমেন্ট ও মোবাইল আসক্তি কমানোর প্রিমিয়াম খেলনা ও মন্টেসরি অ্যাক্টিভিটি কিট।
[ডেলিভারি চার্জ]: ঢাকার ভেতরে ৳${shop.delivery_inside_dhaka || 80}, ঢাকার বাইরে ৳${shop.delivery_outside_dhaka || 130} (সম্পূর্ণ ক্যাশ অন ডেলিভারি)
${mappedProductContext}
[দোকানের অন্যান্য পণ্য তালিকা ও মূল্য]:
${productCatalog || '- Montessori Busy Board: ৳1250'}

[পোস্টের বিষয়বস্তু]: "${postMessage || 'আমাদের নতুন কালেকশন'}"
[কাস্টমারের নাম]: ${customerName || 'সম্মানিত ক্রেতা'}
[কাস্টমারের কমেন্ট]: "${commentText}"

[কঠোর নির্দেশনাবলী]:
১. ১-২ লাইনের মধ্যে অমায়িক, আন্তরিক ও জীবন্ত বাংলায় উত্তর দাও। কাস্টমারকে "ভাইয়া" বা "আপু" বলে সম্বোধন করো।
২. কাস্টমার দাম জানতে চাইলে: সরাসরি সঠিক মূল্য জানাও, সংক্ষেপে উল্লেখ করো এটি বাচ্চাদের মোবাইল আসক্তি কমাতে ও ব্রেইন ডেভেলপমেন্টে কতটা চমৎকার কাজ করে, এবং বাচ্চার বয়স অনুযায়ী পরামর্শের জন্য ইনবক্সে বিস্তারিত দেখতে বলো।
৩. কখনোই রোবোটিক বা যান্ত্রিক ভাষা ব্যবহার করবে না।
৪. শুধুমাত্র কমেন্টের রিপ্লাই টেক্সটটি দাও, কোনো ইনভার্টেড কমা বা অতিরিক্ত লেখা ছাড়া।
`;

      const candidateModels = ['gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-2.5-flash'];
      for (const model of candidateModels) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: commentPrompt }] }],
                generationConfig: { maxOutputTokens: 200, temperature: 0.5 },
              }),
            }
          );
          const data = await geminiRes.json();
          const generated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (generated) {
            aiReplyText = generated;
            break;
          }
        } catch (aiErr) {
          console.error(`Gemini model ${model} comment error:`, aiErr);
        }
      }
    }

    // 4. Save Comment & AI Reply in Database
    await query(
      `INSERT INTO facebook_comments (
        tenant_id, channel_id, post_id, comment_id, customer_name, customer_id, 
        comment_text, ai_reply_text, ai_replied, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())
      ON CONFLICT (comment_id) 
      DO UPDATE SET 
        ai_reply_text = EXCLUDED.ai_reply_text,
        ai_replied = TRUE;`,
      [tenantId, channelId, postId, commentId, customerName || 'Facebook User', customerId || null, commentText, aiReplyText]
    );

    // 5. Post Public Comment Reply via Meta Graph API
    if (accessToken && accessToken !== 'mock_token' && accessToken.startsWith('EAA')) {
      try {
        const fbRes = await fetch(
          `https://graph.facebook.com/v19.0/${commentId}/comments?access_token=${accessToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: aiReplyText }),
          }
        );
        if (fbRes.ok) {
          console.log(`✅ [Graph API] Public comment reply posted for ${commentId}`);
        } else {
          const errData = await fbRes.json();
          console.warn('⚠️ Meta Graph API comment reply error:', errData);
        }
      } catch (graphErr: any) {
        console.error('Meta Graph API comment reply failed:', graphErr.message);
      }
    }

    // =========================================================================
    // 6. Meta Private Reply: Open Direct 1-on-1 Messenger Inbox Thread
    // =========================================================================
    let resolvedPageId = providedPageId;
    if (!resolvedPageId) {
      const chRes = await query(`SELECT channel_identifier FROM channels WHERE id = $1;`, [channelId]);
      if (chRes.rows.length > 0) {
        resolvedPageId = chRes.rows[0].channel_identifier;
      }
    }

    const privateReplyText = mappedProduct
      ? `আসসালামু আলাইকুম ${customerName ? `${customerName} ` : ''}ভাইয়া/আপু! আমাদের পোস্টে "${mappedProduct.title}" সম্পর্কে কমেন্ট করার জন্য ধন্যবাদ।\n\nঅফার মূল্য মাত্র ৳${mappedProduct.price}। সম্পূর্ণ ক্যাশ অন ডেলিভারিতে চেক করে টাকা দেওয়ার সুযোগ আছে (অগ্রিম কোনো পেমেন্ট লাগবে না)।\n\nঅর্ডার করতে বা যেকোনো প্রশ্ন থাকলে এখানেই মেসেজে জানান!`
      : `আসসালামু আলাইকুম ${customerName ? `${customerName} ` : ''}ভাইয়া/আপু! আমাদের ফেসবুক পোস্টে কমেন্ট করার জন্য আন্তরিক ধন্যবাদ। বিস্তারিত ও অফার মূল্যের জন্য আমরা ইনবক্সে যোগাযোগ করেছি। যেকোনো তথ্যের জন্য বা অর্ডার করতে এখনই রিপ্লাই দিন!`;

    let privateReplySent = false;
    if (resolvedPageId && accessToken && accessToken !== 'mock_token' && accessToken.startsWith('EAA')) {
      try {
        const privateRes = await fetch(
          `https://graph.facebook.com/v19.0/${resolvedPageId}/messages?access_token=${accessToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { comment_id: commentId },
              message: { text: privateReplyText },
            }),
          }
        );
        if (privateRes.ok) {
          privateReplySent = true;
          console.log(`✅ [Graph API] Private Reply inbox message dispatched for comment ${commentId}`);
        } else {
          const errData = await privateRes.json();
          console.warn('⚠️ Meta Graph API private reply error:', errData);
        }
      } catch (privErr: any) {
        console.warn('Meta Private Reply call failed:', privErr.message);
      }
    }

    return {
      success: true,
      commentId,
      aiReplyText,
      privateReplyText,
      privateReplySent,
    };
  } catch (error: any) {
    console.error('processFacebookComment error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Automatically detects and replies to any unreplied Facebook comments for a tenant
 * Acts as a resilient auto-healer if Meta webhook misses an event or encounters network lag.
 */
export async function syncAndProcessUnrepliedFacebookComments(tenantId: string): Promise<number> {
  let repliedCount = 0;
  try {
    const channelRes = await query(
      `SELECT id, channel_identifier, access_token, tenant_id, ai_active 
       FROM channels 
       WHERE tenant_id = $1 AND platform = 'facebook' AND ai_active = TRUE 
       LIMIT 1;`,
      [tenantId]
    );

    if (channelRes.rows.length === 0) return 0;
    const channel = channelRes.rows[0];
    if (channel.ai_active === false || !channel.access_token) return 0;

    const pageId = channel.channel_identifier;
    const token = channel.access_token;

    // 1. Fetch recent published posts
    const feedRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/feed?limit=3&access_token=${token}`
    );
    if (!feedRes.ok) return 0;
    const feedData = await feedRes.json();
    const posts = feedData.data || [];

    for (const post of posts) {
      // 2. Fetch comments for post
      const commRes = await fetch(
        `https://graph.facebook.com/v19.0/${post.id}/comments?fields=id,message,from,created_time,comments{from}&limit=25&access_token=${token}`
      );
      if (!commRes.ok) continue;
      const commData = await commRes.json();
      const comments = commData.data || [];

      for (const comment of comments) {
        const commenterId = comment.from?.id;
        const commenterName = comment.from?.name || 'Customer';
        const commentText = comment.message;

        // Skip if comment is made by the page itself
        if (commenterId === pageId) continue;

        // Check if page already replied under this comment on Facebook
        const subReplies = comment.comments?.data || [];
        const pageAlreadyRepliedOnFb = subReplies.some((sr: any) => sr.from?.id === pageId);

        // Check if already in DB
        const dbCheck = await query(
          `SELECT id, ai_replied FROM facebook_comments WHERE comment_id = $1;`,
          [comment.id]
        );

        if (pageAlreadyRepliedOnFb && dbCheck.rows.length > 0 && dbCheck.rows[0].ai_replied) {
          continue; // Already replied and in DB
        }

        if (!pageAlreadyRepliedOnFb && commentText) {
          console.log(`🤖 [Auto-Healer Comment Engine] Processing unreplied comment: "${commentText}" by ${commenterName}`);

          await processFacebookComment({
            tenantId: channel.tenant_id,
            channelId: channel.id,
            postId: post.id,
            commentId: comment.id,
            customerName: commenterName,
            customerId: commenterId,
            commentText,
            postMessage: post.message,
            accessToken: token,
          });

          repliedCount++;
        }
      }
    }
  } catch (err: any) {
    console.error('syncAndProcessUnrepliedFacebookComments error:', err.message);
  }

  return repliedCount;
}

/**
 * Send a 1-Click Private Message from Page to Commenter
 * Uses Meta Graph API /{comment_id}/private_replies or /me/messages recipient: { comment_id }
 */
export async function sendPrivateReplyToComment(params: {
  commentId: string;
  messageText: string;
  accessToken: string;
  tenantId: string;
}) {
  const { commentId, messageText, accessToken, tenantId } = params;

  try {
    let sent = false;
    let errorDetail = null;

    if (accessToken && accessToken !== 'mock_token') {
      // 1. Try /{comment_id}/private_replies
      try {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${commentId}/private_replies?access_token=${accessToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: messageText }),
          }
        );
        if (res.ok) {
          sent = true;
        } else {
          const err = await res.json();
          errorDetail = err;
          // Fallback to /me/messages with recipient: { comment_id }
          const fallbackRes = await fetch(
            `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipient: { comment_id: commentId },
                message: { text: messageText },
              }),
            }
          );
          if (fallbackRes.ok) {
            sent = true;
            errorDetail = null;
          }
        }
      } catch (e: any) {
        errorDetail = e.message;
      }
    } else {
      // Mock mode for local testing
      sent = true;
    }

    if (sent) {
      await query(
        `UPDATE facebook_comments 
         SET private_reply_sent = TRUE 
         WHERE comment_id = $1 AND tenant_id = $2;`,
        [commentId, tenantId]
      );
    }

    return { success: sent, error: errorDetail };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
