import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { enqueueWebhookJob } from '@/lib/message-queue';
import { transcribeVoiceNote, identifyProductFromImage } from '@/lib/multimodal-ai';

export const dynamic = 'force-dynamic';

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'saas_meta_webhook_secret_2026';

/**
 * GET /api/webhooks/meta - Meta Webhook Verification Handshake
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Meta Webhook handshake verified successfully!');
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden: Verification token mismatch', { status: 403 });
}

/**
 * POST /api/webhooks/meta - Ultra-Fast Ingestion with Redis Queue
 * Omnichannel Support: Facebook Messenger, Post Comments, Instagram DM & WhatsApp Cloud API
 */
export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const payload = await req.json();
    console.log('🔔 [Incoming Meta Webhook]', JSON.stringify(payload, null, 2));

    const entry = payload.entry?.[0];
    if (!entry) {
      return NextResponse.json({ received: true, message: 'Empty entry' }, { status: 200 });
    }

    const pageId = entry.id || entry.messaging?.[0]?.recipient?.id;

    // Resolve matching channel & tenant strictly
    let channel: any = null;
    if (pageId) {
      const channelRes = await query(
        `SELECT c.id, c.tenant_id, c.platform, c.channel_identifier, c.channel_name, c.access_token, c.ai_active
         FROM channels c
         WHERE c.channel_identifier = $1
         LIMIT 1;`,
        [String(pageId)]
      );
      if (channelRes.rows.length > 0) {
        channel = channelRes.rows[0];
      }
    }

    // =========================================================================
    // CASE 1: Incoming Facebook Messenger or Instagram DM
    // =========================================================================
    const messagingEvents = entry.messaging || [];
    for (const messagingEvent of messagingEvents) {
      if (messagingEvent.message && !messagingEvent.message.is_echo) {
        const senderId = messagingEvent.sender?.id;
        let messageText = messagingEvent.message?.text;

        // Handle Multimodal (Audio voice notes & product photos)
        const attachments = messagingEvent.message.attachments || [];
        const audioAttachment = attachments.find((a: any) => a.type === 'audio');
        const imageAttachment = attachments.find((a: any) => a.type === 'image');
        let matchedProductId: string | undefined;

        if (audioAttachment) {
          try {
            const transcription = await transcribeVoiceNote(audioAttachment.payload?.url);
            const transcribedNote = `[ভয়েস নোট ট্রান্সক্রিপশন]: ${transcription.text}`;
            messageText = messageText ? `${messageText} ${transcribedNote}` : transcribedNote;
          } catch (e) {}
        }

        if (imageAttachment) {
          try {
            // Fetch live catalog for this specific channel and tenant
            let catalogProducts: any[] = [];
            if (channel) {
              const catRes = await query(
                `SELECT id, title, price, stock, category, description, rag_knowledge, image_url
                 FROM products
                 WHERE tenant_id = $1 AND (channel_id IS NULL OR channel_id = $2) AND is_active = TRUE
                 ORDER BY stock DESC LIMIT 25;`,
                [channel.tenant_id, channel.id]
              );
              catalogProducts = catRes.rows;
            }

            const visionResult = await identifyProductFromImage(imageAttachment.payload?.url, catalogProducts);
            
            if (visionResult.matchedProduct) {
              matchedProductId = visionResult.matchedProduct.id;
              const p = visionResult.matchedProduct;
              const ragInfo = p.rag_knowledge ? ` | র্যাক নলেজ: ${p.rag_knowledge}` : '';
              const visionHeader = `[গ্রাহক পণ্যের ছবি পাঠিয়েছেন: ${imageAttachment.payload?.url}] [ছবিতে শনাক্তকৃত পণ্য]: ${p.title} (আইডি: ${p.id} | মূল্য: ৳${p.price} | লাইভ স্টক: ${p.stock} পিস${ragInfo})`;
              messageText = messageText
                ? `${visionHeader} [গ্রাহকের প্রশ্ন]: ${messageText}`
                : `${visionHeader} [গ্রাহকের প্রশ্ন]: এই পণ্যটি কি স্টকে আছে এবং এর দাম কত?`;
            } else {
              const summary = visionResult.detectedItemSummary || 'একটি পণ্যের ছবি';
              const color = visionResult.detectedColor ? ` (রং: ${visionResult.detectedColor})` : '';
              const visionHeader = `[গ্রাহক পণ্যের ছবি পাঠিয়েছেন: ${imageAttachment.payload?.url}] [ছবিতে দৃশ্যমান]: ${summary}${color} [ক্যাটালগ স্ট্যাটাস]: স্টোরের ক্যাটালগে এই নির্দিষ্ট পণ্যটি সরাসরি পাওয়া যায়নি।`;
              messageText = messageText
                ? `${visionHeader} [গ্রাহকের প্রশ্ন]: ${messageText}`
                : `${visionHeader} [গ্রাহকের প্রশ্ন]: এই পণ্যটি আপনাদের কাছে আছে কিনা এবং মূল্য কত?`;
            }
          } catch (e: any) {
            console.error('Webhook vision processing error:', e.message);
            if (!messageText) {
              messageText = `[গ্রাহক একটি পণ্যের ছবি পাঠিয়েছেন: ${imageAttachment.payload?.url}] অনুগ্রহ করে এই পণ্যের দাম ও স্টক জানতে চান।`;
            }
          }
        }

        if (channel && senderId && messageText && channel.ai_active !== false) {
          // Extract referral post_id if customer sent message from a Facebook Video Post or Ad CTA
          const referralPostId =
            messagingEvent.referral?.post_id ||
            messagingEvent.postback?.referral?.post_id ||
            messagingEvent.referral?.ref ||
            undefined;

          // Enqueue into Resilient Redis FIFO Queue with auto-retry
          await enqueueWebhookJob('customer_message', {
            tenantId: channel.tenant_id,
            channelId: channel.id,
            pageId: String(pageId),
            senderId: String(senderId),
            messageText,
            matchedProductId,
            imageUrl: imageAttachment?.payload?.url,
            referralPostId,
            accessToken: channel.access_token || process.env.META_PAGE_ACCESS_TOKEN || '',
          });
        }
      }
    }

    // =========================================================================
    // CASE 2: Incoming Facebook Post Comment & WhatsApp (feed & messages changes)
    // =========================================================================
    if (entry.changes && Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        // Facebook Post Comment (feed changes)
        if (change.field === 'feed') {
          const val = change.value;
          if (val && val.item === 'comment' && val.verb !== 'remove') {
            const commentId = val.comment_id;
            const postId = val.post_id || val.parent_id || 'general_post';
            const commenterId = val.from?.id;
            const commenterName = val.from?.name || 'Facebook User';
            const commentText = val.message;
            const postMessage = val.post?.message;

            const isOwnPage = commenterId === pageId || commenterId === channel?.channel_identifier;

            if (channel && commentId && commentText && !isOwnPage && channel.ai_active !== false) {
              console.log(`💬 [Comment Queued] Post: ${postId} | Commenter: ${commenterName} ("${commentText}")`);

              // Enqueue comment processing into Redis Queue
              await enqueueWebhookJob('facebook_comment', {
                tenantId: channel.tenant_id,
                channelId: channel.id,
                postId: String(postId),
                commentId: String(commentId),
                customerName: commenterName,
                customerId: commenterId,
                commentText,
                postMessage,
                mediaUrl: val.photo || null,
                permalinkUrl: val.link || null,
                accessToken: channel.access_token || process.env.META_PAGE_ACCESS_TOKEN || '',
              });
            }
          }
        }

        // WhatsApp Business Cloud API Message Ingestion
        if (change.field === 'messages') {
          const val = change.value;
          const phoneNumberId = val?.metadata?.phone_number_id;
          const waMessage = val?.messages?.[0];

          const displayPhone = val?.metadata?.display_phone_number?.replace(/[\s\-\+\(\)]/g, '') || '';
          if (phoneNumberId && waMessage) {
            const waChannelRes = await query(
              `SELECT c.id, c.tenant_id, c.access_token, c.ai_active
               FROM channels c
               WHERE (
                 c.channel_identifier = $1 
                 OR c.channel_identifier = $2
                 OR (LENGTH($2) >= 10 AND RIGHT(c.channel_identifier, 10) = RIGHT($2, 10))
                 OR (LENGTH($1) >= 10 AND RIGHT(c.channel_identifier, 10) = RIGHT($1, 10))
               ) AND c.platform = 'whatsapp'
               LIMIT 1;`,
              [String(phoneNumberId), String(displayPhone)]
            );

            if (waChannelRes.rows.length > 0 && waChannelRes.rows[0].ai_active !== false) {
              const waChannel = waChannelRes.rows[0];
              const senderPhone = waMessage.from; // e.g. 8801700000000
              const waText = waMessage.text?.body || '';

              if (waText && senderPhone) {
                console.log(`📱 [WhatsApp Queued] From: ${senderPhone} ("${waText}")`);
                await enqueueWebhookJob('customer_message', {
                  tenantId: waChannel.tenant_id,
                  channelId: waChannel.id,
                  platform: 'whatsapp',
                  pageId: String(phoneNumberId),
                  senderId: String(senderPhone),
                  customerName: val.contacts?.[0]?.profile?.name || `WhatsApp ${senderPhone}`,
                  messageText: waText,
                  accessToken: waChannel.access_token || process.env.META_PAGE_ACCESS_TOKEN || '',
                });
              }
            }
          }
        }
      }
    }

    const duration = Date.now() - start;

    // Fast acknowledgement to Meta within 10-25ms
    return NextResponse.json(
      { received: true, queued: true, durationMs: duration },
      { status: 200, headers: { 'X-Response-Time': `${duration}ms` } }
    );
  } catch (error: any) {
    console.error('Webhook ingestion error:', error);
    return NextResponse.json({ received: true, error: error.message }, { status: 200 });
  }
}
