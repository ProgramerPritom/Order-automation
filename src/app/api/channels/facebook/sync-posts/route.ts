import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getAuthTenant(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token =
    authHeader?.startsWith('Bearer ') && authHeader.split(' ')[1] !== 'null'
      ? authHeader.split(' ')[1]
      : req.cookies.get('accessToken')?.value || req.cookies.get('token')?.value;

  if (!token) return null;
  return verifyAccessToken(token);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized or expired session' }, { status: 401 });
    }

    // 1. Fetch active Facebook channel for this tenant
    const channelRes = await query(
      `SELECT id, channel_identifier, channel_name, access_token 
       FROM channels 
       WHERE tenant_id = $1 AND platform = 'facebook' AND ai_active = TRUE
       ORDER BY updated_at DESC LIMIT 1;`,
      [auth.tenantId]
    );

    if (channelRes.rows.length === 0) {
      // Check if any Facebook channel exists (even if ai_active is false)
      const anyFb = await query(
        `SELECT id, channel_identifier, channel_name, access_token 
         FROM channels 
         WHERE tenant_id = $1 AND platform = 'facebook'
         ORDER BY updated_at DESC LIMIT 1;`,
        [auth.tenantId]
      );

      if (anyFb.rows.length === 0) {
        return NextResponse.json(
          {
            error:
              'আপনার কোনো ফেসবুক পেজ কানেক্ট করা নেই। অনুগ্রহ করে প্রথমে "Social Channels" থেকে ফেসবুক পেজ কানেক্ট করুন।',
          },
          { status: 400 }
        );
      }
      channelRes.rows.push(anyFb.rows[0]);
    }

    const channel = channelRes.rows[0];
    const pageId = channel.channel_identifier;
    const pageToken = channel.access_token;

    if (!pageToken) {
      return NextResponse.json(
        {
          error:
            'পেজের অ্যাক্সেস টোকেন পাওয়া যায়নি। অনুগ্রহ করে "Social Channels" থেকে পুনরায় পেজ কানেক্ট বা টোকেন আপডেট করুন।',
        },
        { status: 400 }
      );
    }

    // 2. Fetch latest posts from Facebook Graph API
    const postsUrl = `https://graph.facebook.com/v19.0/${pageId}/posts?fields=id,message,created_time,full_picture,permalink_url,attachments{media_type,url,media}&limit=50&access_token=${pageToken}`;
    const postsRes = await fetch(postsUrl);
    const postsData = await postsRes.json();

    if (!postsRes.ok) {
      const errMsg = postsData?.error?.message || 'মেটা গ্রাফ এপিআই কল ব্যর্থ হয়েছে';
      console.warn('Facebook posts fetch error from Meta:', postsData);
      return NextResponse.json(
        {
          error: `ফেসবুক থেকে পোস্ট রিফ্রেশ করতে সমস্যা হয়েছে: ${errMsg}`,
        },
        { status: 400 }
      );
    }

    const posts = postsData.data || [];

    // 3. Optional: fetch videos
    let videos: any[] = [];
    try {
      const videosUrl = `https://graph.facebook.com/v19.0/${pageId}/videos?fields=id,description,created_time,picture,permalink_url&limit=25&access_token=${pageToken}`;
      const vRes = await fetch(videosUrl);
      const vData = await vRes.json();
      if (vData.data && Array.isArray(vData.data)) {
        videos = vData.data;
      }
    } catch (e) {
      console.warn('Video fetch skipped:', e);
    }

    // 4. Upsert posts into facebook_posts
    let syncedCount = 0;
    for (const post of posts) {
      const postId = post.id;
      const message = post.message || '';
      const mediaUrl =
        post.full_picture || post.attachments?.data?.[0]?.media?.image?.src || null;
      const permalinkUrl = post.permalink_url || `https://facebook.com/${postId}`;
      const createdTime = post.created_time ? new Date(post.created_time) : new Date();

      await query(
        `INSERT INTO facebook_posts (tenant_id, channel_id, post_id, message, media_url, permalink_url, created_time, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (post_id)
         DO UPDATE SET 
           message = COALESCE(NULLIF(EXCLUDED.message, ''), facebook_posts.message),
           media_url = COALESCE(EXCLUDED.media_url, facebook_posts.media_url),
           permalink_url = COALESCE(EXCLUDED.permalink_url, facebook_posts.permalink_url),
           updated_at = NOW();`,
        [auth.tenantId, channel.id, postId, message, mediaUrl, permalinkUrl, createdTime]
      );
      syncedCount++;
    }

    // 5. Upsert videos
    for (const vid of videos) {
      const vidId = vid.id;
      const postId = vidId.includes('_') ? vidId : `${pageId}_${vidId}`;
      const message = vid.description || '';
      const mediaUrl = vid.picture || null;
      const permalinkUrl = vid.permalink_url || `https://facebook.com/${postId}`;
      const createdTime = vid.created_time ? new Date(vid.created_time) : new Date();

      await query(
        `INSERT INTO facebook_posts (tenant_id, channel_id, post_id, message, media_url, permalink_url, created_time, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (post_id)
         DO UPDATE SET 
           message = COALESCE(NULLIF(EXCLUDED.message, ''), facebook_posts.message),
           media_url = COALESCE(EXCLUDED.media_url, facebook_posts.media_url),
           permalink_url = COALESCE(EXCLUDED.permalink_url, facebook_posts.permalink_url),
           updated_at = NOW();`,
        [auth.tenantId, channel.id, postId, message, mediaUrl, permalinkUrl, createdTime]
      );
      syncedCount++;
    }

    // 6. Query updated posts with linked products
    const updatedPostsRes = await query(
      `SELECT p.id, p.post_id, p.message, p.media_url, p.permalink_url, p.comment_count, 
              p.created_time, p.updated_at,
              c.channel_name, COALESCE(c.platform, 'facebook') as platform,
              CASE 
                WHEN pr.id IS NOT NULL THEN json_build_object(
                  'id', pr.id,
                  'title', pr.title,
                  'price', pr.price,
                  'stock', pr.stock,
                  'image_url', pr.image_url,
                  'sku', pr.sku
                )
                ELSE NULL 
              END as linked_product,
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
       LEFT JOIN post_product_mappings ppm ON p.post_id = ppm.post_id AND p.tenant_id = ppm.tenant_id
       LEFT JOIN products pr ON ppm.product_id = pr.id
       WHERE p.tenant_id = $1
       GROUP BY p.id, c.channel_name, c.platform, pr.id
       ORDER BY p.updated_at DESC
       LIMIT 50;`,
      [auth.tenantId]
    );

    return NextResponse.json({
      success: true,
      message: `🎉 "${channel.channel_name}" থেকে ${syncedCount} টি পোস্ট ও ভিডিও সফলভাবে সিঙ্ক করা হয়েছে!`,
      syncedCount,
      posts: updatedPostsRes.rows,
      totalCount: updatedPostsRes.rows.length,
    });
  } catch (err: any) {
    console.error('Facebook sync-posts exception:', err);
    return NextResponse.json(
      { error: err.message || 'পোস্ট সিঙ্ক করার সময় একটি অপ্রত্যাশিত ত্রুটি ঘটেছে।' },
      { status: 500 }
    );
  }
}
