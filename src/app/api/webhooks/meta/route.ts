import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { saasRedis } from '@/lib/redis';
import { checkFaqCache } from '@/lib/faq-cache';
import { transcribeVoiceNote, identifyProductFromImage } from '@/lib/multimodal-ai';

export const dynamic = 'force-dynamic';

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'saas_meta_webhook_secret_2026';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/social-commerce';
const APP_URL = process.env.APP_URL || 'http://localhost:3001';

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
 * POST /api/webhooks/meta - High-throughput Webhook Ingestion & n8n Dispatcher
 */
export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const payload = await req.json();

    // Fast resolution of Page ID & Sender ID from payload
    const entry = payload.entry?.[0];
    const pageId = entry?.id || entry?.messaging?.[0]?.recipient?.id || 'unknown_page';
    const senderId = entry?.messaging?.[0]?.sender?.id || 'unknown_sender';
    let messageText = entry?.messaging?.[0]?.message?.text;

    // Multimodal attachments (Voice notes & Product photos)
    const attachments = entry?.messaging?.[0]?.message?.attachments || [];
    const audioAttachment = attachments.find((a: any) => a.type === 'audio');
    const imageAttachment = attachments.find((a: any) => a.type === 'image');

    let isMultimodal = false;
    let attachmentType = null;

    // 1. Audio voice note transcription (Bengali Speech-to-Text)
    if (audioAttachment && !messageText) {
      isMultimodal = true;
      attachmentType = 'audio';
      const audioUrl = audioAttachment.payload?.url;
      const transcription = await transcribeVoiceNote(audioUrl);
      messageText = `[ভয়েস নোট ট্রান্সক্রিপশন]: ${transcription.text}`;
    }

    // 2. Image recognition (Customer sent a product photo)
    if (imageAttachment && !messageText) {
      isMultimodal = true;
      attachmentType = 'image';
      const imageUrl = imageAttachment.payload?.url;
      const visionResult = await identifyProductFromImage(imageUrl, []);
      if (visionResult.matchedProduct) {
        messageText = `[ছবিতে শনাক্তকৃত পণ্য]: ${visionResult.matchedProduct.title} (মূল্য: ৳${visionResult.matchedProduct.price})`;
      }
    }

    // Generate unique event tracking ID
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // 3. Resolve Channel & Tenant from Database
    let tenant: any = null;
    let channel: any = null;

    try {
      // Find matching connected channel
      const channelRes = await query(
        `SELECT c.id, c.tenant_id, c.platform, c.channel_identifier, c.channel_name, c.access_token,
                t.name as tenant_name, t.about_shop, t.delivery_inside_dhaka, t.delivery_outside_dhaka,
                t.delivery_time_dhaka, t.delivery_time_outside, t.return_policy, t.ai_tone, 
                t.custom_rules, t.support_phone
         FROM channels c
         JOIN tenants t ON c.tenant_id = t.id
         WHERE c.channel_identifier = $1 AND c.platform = 'facebook'
         LIMIT 1;`,
        [pageId]
      );

      if (channelRes.rows.length > 0) {
        channel = channelRes.rows[0];
        tenant = channelRes.rows[0];
      } else {
        // Fallback to active demo tenant for testing or unbound pages
        const tenantRes = await query(
          `SELECT id as tenant_id, name as tenant_name, about_shop, delivery_inside_dhaka, 
                  delivery_outside_dhaka, delivery_time_dhaka, delivery_time_outside, 
                  return_policy, ai_tone, custom_rules, support_phone
           FROM tenants 
           WHERE slug = 'demo-aarong-fashion'
           LIMIT 1;`
        );
        if (tenantRes.rows.length > 0) {
          tenant = tenantRes.rows[0];
        }
      }
    } catch (dbErr) {
      console.error('Channel resolution DB error:', dbErr);
    }

    const tenantId = tenant?.tenant_id || tenant?.id || 'c0bc0200-8f99-4dbd-bc8b-ed6f84d5fc1f';

    // 4. Fetch Active Products Catalog for Tenant
    let products: any[] = [];
    try {
      const prodRes = await query(
        `SELECT id, title, price, stock, sku, description, image_url 
         FROM products 
         WHERE tenant_id = $1 AND is_active = TRUE 
         ORDER BY stock DESC 
         LIMIT 25;`,
        [tenantId]
      );
      products = prodRes.rows;
    } catch (prodErr) {
      console.error('Products fetch error:', prodErr);
    }

    // 5. Build Enriched Structured Payload for n8n
    const n8nPayload = {
      event_id: eventId,
      source: 'facebook_messenger',
      timestamp: new Date().toISOString(),
      tenant: {
        id: tenantId,
        name: tenant?.tenant_name || 'KothaShop Partner',
        about_shop: tenant?.about_shop || 'একটি বিশ্বস্ত অনলাইন শপ',
        delivery_inside_dhaka: Number(tenant?.delivery_inside_dhaka) || 80,
        delivery_outside_dhaka: Number(tenant?.delivery_outside_dhaka) || 130,
        delivery_time_dhaka: tenant?.delivery_time_dhaka || '১-২ কর্মদিবস',
        delivery_time_outside: tenant?.delivery_time_outside || '৩-৫ কর্মদিবস',
        return_policy: tenant?.return_policy || '৭ দিনের রিটার্ন সুবিধা',
        support_phone: tenant?.support_phone || '০১৭০০০০০০০০',
        ai_tone: tenant?.ai_tone || 'polite',
        custom_rules: tenant?.custom_rules || '',
      },
      channel: {
        id: channel?.id || null,
        page_id: pageId,
        sender_id: senderId,
        page_access_token: channel?.access_token || process.env.META_PAGE_ACCESS_TOKEN || 'mock_token',
      },
      customer: {
        sender_id: senderId,
        raw_message: messageText || '',
        is_multimodal: isMultimodal,
        attachment_type: attachmentType,
      },
      catalog: products.map((p) => ({
        id: p.id,
        title: p.title,
        price: Number(p.price),
        stock: p.stock,
        sku: p.sku,
        description: p.description,
        image_url: p.image_url,
      })),
      callback_url: `${APP_URL}/api/n8n/callback`,
    };

    // Buffer in Redis for monitoring & queueing
    saasRedis.set(`event:${eventId}`, n8nPayload, { ex: 3600 }).catch(() => {});

    // Check FAQ cache for instant 0-token answers if applicable
    if (messageText) {
      checkFaqCache('global', messageText).then((cachedAnswer) => {
        if (cachedAnswer) {
          console.log(`[FAQ Cache Hit] for "${messageText.slice(0, 30)}..."`);
        }
      });
    }

    // 6. Asynchronously Forward to n8n Automation Engine (Non-blocking)
    console.log(`[Gateway -> n8n] Dispatching event ${eventId} to ${N8N_WEBHOOK_URL}...`);
    fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'KothaShop-Gateway/2.0',
        'X-KothaShop-Event-Id': eventId,
      },
      body: JSON.stringify(n8nPayload),
    })
      .then(async (res) => {
        if (res.ok) {
          console.log(`✅ [Gateway -> n8n] Dispatched event ${eventId} successfully (Status: ${res.status})`);
        } else {
          console.warn(`⚠️ [Gateway -> n8n] n8n returned non-200 status (${res.status}) for event ${eventId}`);
        }
      })
      .catch((err) => {
        // n8n might not be running locally yet, log friendly warning without failing webhook
        console.warn(`ℹ️ [Gateway -> n8n] Could not reach n8n at ${N8N_WEBHOOK_URL}. Make sure n8n is active: ${err.message}`);
      });

    const duration = Date.now() - start;

    // Immediately return 200 OK to Meta to guarantee zero webhook timeouts
    return NextResponse.json(
      {
        received: true,
        eventId,
        forwardedToN8n: true,
        durationMs: duration,
      },
      {
        status: 200,
        headers: {
          'X-Response-Time': `${duration}ms`,
        },
      }
    );
  } catch (error: any) {
    console.error('Webhook ingestion error:', error);
    // Always return 200 to prevent Meta from revoking the webhook URL
    return NextResponse.json({ received: true, error: error.message }, { status: 200 });
  }
}
