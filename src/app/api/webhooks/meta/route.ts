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

        if (audioAttachment && !messageText) {
          try {
            const transcription = await transcribeVoiceNote(audioAttachment.payload?.url);
            messageText = `[ভয়েস নোট ট্রান্সক্রিপশন]: ${transcription.text}`;
          } catch (e) {}
        }

        if (imageAttachment && !messageText) {
          try {
            const visionResult = await identifyProductFromImage(imageAttachment.payload?.url, []);
            if (visionResult.matchedProduct) {
              messageText = `[ছবিতে শনাক্তকৃত পণ্য]: ${visionResult.matchedProduct.title} (মূল্য: ৳${visionResult.matchedProduct.price})`;
            }
          } catch (e) {}
        }

        if (channel && senderId && messageText && channel.ai_active !== false) {
          // Enqueue into Resilient Redis FIFO Queue with auto-retry
          await enqueueWebhookJob('customer_message', {
            tenantId: channel.tenant_id,
            channelId: channel.id,
            pageId: String(pageId),
            senderId: String(senderId),
            messageText,
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

          if (phoneNumberId && waMessage) {
            const waChannelRes = await query(
              `SELECT c.id, c.tenant_id, c.access_token, c.ai_active
               FROM channels c
               WHERE c.channel_identifier = $1 AND c.platform = 'whatsapp'
               LIMIT 1;`,
              [String(phoneNumberId)]
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
