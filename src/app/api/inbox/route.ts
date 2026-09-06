import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { saasRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

async function getAuthTenant(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token =
    (authHeader?.startsWith('Bearer ') && authHeader.split(' ')[1] !== 'null')
      ? authHeader.split(' ')[1]
      : req.cookies.get('accessToken')?.value || req.cookies.get('token')?.value;

  if (!token) return null;
  return verifyAccessToken(token);
}

import { parsePaginationParams, decodeCursor, encodeCursor } from '@/lib/pagination';

/**
 * GET /api/inbox - List active conversations with cursor-based pagination across FB, IG, WA
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const { cursor, limit } = parsePaginationParams(req.url, 15, 50);
    const decodedCursor = decodeCursor(cursor);

    // 1. Total conversations count
    let countSql = `SELECT count(*) FROM conversations c JOIN channels ch ON c.channel_id = ch.id WHERE c.tenant_id = $1`;
    const countParams: any[] = [auth.tenantId];
    if (platform && platform !== 'all') {
      countSql += ` AND ch.platform = $2`;
      countParams.push(platform);
    }
    const countRes = await query(countSql, countParams);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    // 2. Paginated query
    let sql = `
      SELECT c.id, c.customer_identifier, c.customer_name, c.customer_phone, 
             c.ai_muted_until, c.updated_at,
             (c.ai_muted_until IS NOT NULL AND c.ai_muted_until > NOW()) as is_human_takeover_active,
             ch.platform as channel_platform, ch.channel_name,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', m.id,
                   'sender_type', m.sender_type,
                   'content', m.content,
                   'created_at', m.created_at
                 ) ORDER BY m.created_at ASC
               ) FILTER (WHERE m.id IS NOT NULL), '[]'
             ) as messages
      FROM conversations c
      JOIN channels ch ON c.channel_id = ch.id
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.tenant_id = $1
    `;
    const params: any[] = [auth.tenantId];
    let paramIndex = 2;

    if (platform && platform !== 'all') {
      sql += ` AND ch.platform = $${paramIndex}`;
      params.push(platform);
      paramIndex++;
    }

    if (decodedCursor) {
      sql += ` AND (c.updated_at, c.id) < ($${paramIndex}, $${paramIndex + 1})`;
      params.push(decodedCursor.createdAt, decodedCursor.id);
      paramIndex += 2;
    }

    sql += `
      GROUP BY c.id, ch.platform, ch.channel_name
      ORDER BY c.updated_at DESC, c.id DESC
      LIMIT $${paramIndex};
    `;
    params.push(limit + 1);

    const res = await query(sql, params);
    const rows = res.rows;
    const hasMore = rows.length > limit;
    const conversations = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && conversations.length > 0) {
      const last = conversations[conversations.length - 1];
      nextCursor = encodeCursor({
        id: last.id,
        createdAt: new Date(last.updated_at).toISOString(),
      });
    }

    return NextResponse.json({
      conversations,
      pagination: {
        nextCursor,
        hasMore,
        limit,
        totalCount,
      },
    });
  } catch (error: any) {
    console.error('Fetch inbox error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/inbox - Send live human message from dashboard to customer Messenger / IG / WA
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { conversationId, messageText } = body;

    if (!conversationId || !messageText?.trim()) {
      return NextResponse.json(
        { error: 'Conversation ID and message text are required' },
        { status: 400 }
      );
    }

    // 1. Verify conversation belongs to this tenant and fetch channel details
    const convRes = await query(
      `SELECT c.id, c.customer_identifier, c.customer_phone, 
              ch.platform as channel_platform, ch.access_token, ch.channel_identifier
       FROM conversations c
       JOIN channels ch ON c.channel_id = ch.id
       WHERE c.id = $1 AND c.tenant_id = $2;`,
      [conversationId, auth.tenantId]
    );

    if (convRes.rows.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const conv = convRes.rows[0];

    // 2. Insert message into PostgreSQL
    const msgRes = await query(
      `INSERT INTO messages (conversation_id, sender_type, content, created_at)
       VALUES ($1, 'human_agent', $2, NOW())
       RETURNING id, sender_type, content, created_at;`,
      [conversationId, messageText.trim()]
    );

    // Update conversation timestamp
    await query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1;`, [conversationId]);

    // 3. Update Redis working memory so AI knows what human agent said
    const historyCacheKey = `conv_history:${conversationId}`;
    let cachedHistory = await saasRedis.get<any[]>(historyCacheKey);
    if (!cachedHistory || !Array.isArray(cachedHistory)) {
      cachedHistory = [];
    }
    cachedHistory.push({ sender_type: 'human_agent', content: messageText.trim() });
    await saasRedis.set(historyCacheKey, cachedHistory.slice(-8), { ex: 86400 });

    // 4. Dispatch to Meta Messenger / Instagram / WhatsApp via Graph API
    const accessToken = conv.access_token || process.env.META_PAGE_ACCESS_TOKEN;
    if (accessToken && accessToken !== 'mock_token') {
      try {
        if (conv.channel_platform === 'whatsapp') {
          // WhatsApp Cloud API dispatch
          const phoneNumberId = conv.channel_identifier || process.env.WHATSAPP_PHONE_NUMBER_ID;
          const targetNumber = conv.customer_phone || conv.customer_identifier;
          if (phoneNumberId && targetNumber) {
            await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: targetNumber.replace(/[^0-9]/g, ''),
                type: 'text',
                text: { body: messageText.trim() },
              }),
            });
          }
        } else {
          // Facebook Messenger & Instagram Direct via /me/messages
          await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: conv.customer_identifier },
              message: { text: messageText.trim() },
            }),
          });
        }
      } catch (err: any) {
        console.warn('Live inbox message dispatch warning:', err.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: msgRes.rows[0],
    });
  } catch (error: any) {
    console.error('Send inbox message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/inbox - Delete a conversation and its messages
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('id');

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    }

    // Delete messages and conversation belonging to this tenant
    await query(`DELETE FROM messages WHERE conversation_id = $1;`, [conversationId]);
    await query(`DELETE FROM conversations WHERE id = $1 AND tenant_id = $2;`, [conversationId, auth.tenantId]);

    // Clear redis history cache
    await saasRedis.del(`conv_history:${conversationId}`);

    return NextResponse.json({ success: true, message: 'চ্যাট সফলভাবে মুছে ফেলা হয়েছে' });
  } catch (error: any) {
    console.error('Delete conversation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
