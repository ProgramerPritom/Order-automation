import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { sendPrivateReplyToComment, syncAndProcessUnrepliedFacebookComments } from '@/lib/ai-comment-engine';

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
 * GET /api/comments - List Facebook posts and comments with cursor-based pagination
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Trigger auto-healer: detects and processes any unreplied Facebook comments
    syncAndProcessUnrepliedFacebookComments(auth.tenantId).catch((err) =>
      console.warn('Background comment sync warning:', err.message)
    );

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');
    const platform = searchParams.get('platform');
    const { cursor, limit } = parsePaginationParams(req.url, 15, 50);
    const decodedCursor = decodeCursor(cursor);

    // 1. Total posts count
    let countSql = `SELECT count(*) FROM facebook_posts p LEFT JOIN channels c ON p.channel_id = c.id WHERE p.tenant_id = $1`;
    const countParams: any[] = [auth.tenantId];
    if (postId) {
      countParams.push(postId);
      countSql += ` AND p.post_id = $${countParams.length}`;
    }
    if (platform && platform !== 'all') {
      countParams.push(platform);
      countSql += ` AND COALESCE(c.platform, 'facebook') = $${countParams.length}`;
    }
    const countRes = await query(countSql, countParams);
    const totalPostsCount = parseInt(countRes.rows[0].count, 10);

    // 2. Paginated posts query
    let postsSql = `
      SELECT p.id, p.post_id, p.message, p.media_url, p.permalink_url, p.comment_count, 
             p.created_time, p.updated_at,
             c.channel_name, COALESCE(c.platform, 'facebook') as platform,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', cm.id,
                   'comment_id', cm.comment_id,
                   'customer_name', cm.customer_name,
                   'customer_id', cm.customer_id,
                   'comment_text', cm.comment_text,
                   'ai_reply_text', cm.ai_reply_text,
                   'ai_replied', cm.ai_replied,
                   'private_reply_sent', cm.private_reply_sent,
                   'created_at', cm.created_at
                 ) ORDER BY cm.created_at DESC
               ) FILTER (WHERE cm.id IS NOT NULL), '[]'
             ) as comments
      FROM facebook_posts p
      LEFT JOIN channels c ON p.channel_id = c.id
      LEFT JOIN facebook_comments cm ON p.post_id = cm.post_id
      WHERE p.tenant_id = $1
    `;
    const params: any[] = [auth.tenantId];

    if (postId) {
      params.push(postId);
      postsSql += ` AND p.post_id = $${params.length}`;
    }

    if (platform && platform !== 'all') {
      params.push(platform);
      postsSql += ` AND COALESCE(c.platform, 'facebook') = $${params.length}`;
    }

    if (decodedCursor) {
      params.push(decodedCursor.createdAt, decodedCursor.id);
      postsSql += ` AND (p.updated_at, p.id) < ($${params.length - 1}, $${params.length})`;
    }

    postsSql += ` GROUP BY p.id, c.channel_name, c.platform ORDER BY p.updated_at DESC, p.id DESC LIMIT $${params.length + 1};`;
    params.push(limit + 1);

    const res = await query(postsSql, params);
    const rows = res.rows;
    const hasMore = rows.length > limit;
    const posts = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && posts.length > 0) {
      const last = posts[posts.length - 1];
      nextCursor = encodeCursor({
        id: last.id,
        createdAt: new Date(last.updated_at || last.created_time).toISOString(),
      });
    }

    // Calculate aggregated metrics
    const statsRes = await query(
      `SELECT 
         count(*) as total_comments,
         count(*) FILTER (WHERE ai_replied = TRUE) as ai_replied_count,
         count(*) FILTER (WHERE private_reply_sent = TRUE) as private_replied_count
       FROM facebook_comments 
       WHERE tenant_id = $1;`,
      [auth.tenantId]
    );
    const stats = statsRes.rows[0];

    return NextResponse.json({
      posts,
      pagination: {
        nextCursor,
        hasMore,
        limit,
        totalCount: totalPostsCount,
      },
      metrics: {
        totalPosts: totalPostsCount,
        totalComments: parseInt(stats.total_comments || '0', 10),
        aiRepliedCount: parseInt(stats.ai_replied_count || '0', 10),
        privateRepliedCount: parseInt(stats.private_replied_count || '0', 10),
      },
    });
  } catch (error: any) {
    console.error('Fetch comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/comments - Send 1-Click Private Message to Commenter
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, commentId, messageText } = body;

    if (action === 'private_reply') {
      if (!commentId || !messageText?.trim()) {
        return NextResponse.json(
          { error: 'commentId and messageText are required' },
          { status: 400 }
        );
      }

      // Look up channel access token
      const commentRes = await query(
        `SELECT fc.comment_id, fc.channel_id, fc.private_reply_sent, c.access_token
         FROM facebook_comments fc
         JOIN channels c ON fc.channel_id = c.id
         WHERE fc.comment_id = $1 AND fc.tenant_id = $2
         LIMIT 1;`,
        [commentId, auth.tenantId]
      );

      if (commentRes.rows.length === 0) {
        return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
      }

      if (commentRes.rows[0].private_reply_sent) {
        return NextResponse.json(
          { error: 'মেটার পলিসি অনুযায়ী এই কমেন্টের বিপরীতে ইতিমধ্যে ইনবক্সে ১টি প্রাইভেট বার্তা পাঠানো হয়েছে।' },
          { status: 400 }
        );
      }

      const accessToken = commentRes.rows[0].access_token || process.env.META_PAGE_ACCESS_TOKEN || '';

      const result = await sendPrivateReplyToComment({
        commentId,
        messageText,
        accessToken,
        tenantId: auth.tenantId,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: 'Failed to send private reply', details: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Private message sent successfully to commenter',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Comments POST action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
