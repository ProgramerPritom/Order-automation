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

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized or expired session' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');
    const forceRefresh = searchParams.get('refresh') === 'true';

    // 1. Fetch active Facebook channel for this tenant
    const channelRes = await query(
      `SELECT id, channel_identifier, channel_name, access_token 
       FROM channels 
       WHERE tenant_id = $1 AND platform = 'facebook'
       ORDER BY ai_active DESC, updated_at DESC LIMIT 1;`,
      [auth.tenantId]
    );

    if (channelRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'ফেসবুক চ্যানেল কানেক্ট করা নেই।' },
        { status: 400 }
      );
    }

    const channel = channelRes.rows[0];
    const pageToken = channel.access_token;

    // IF no specific postId is requested: Return all posts
    if (!postId) {
      let postsRes = await query(
        `SELECT id, post_id, message, media_url, permalink_url, comment_count, 
                created_time, updated_at, hide_reactions_internal, reaction_summary, last_reaction_sync
         FROM facebook_posts 
         WHERE tenant_id = $1 AND message IS NOT NULL AND trim(message) != ''
         ORDER BY created_time DESC LIMIT 50;`,
        [auth.tenantId]
      );

      // Check if any post has null/empty reaction_summary OR forceRefresh is requested
      const hasUnsyncedReactions =
        forceRefresh ||
        postsRes.rows.some((p: any) => !p.reaction_summary || Object.keys(p.reaction_summary).length === 0);

      if (hasUnsyncedReactions && pageToken) {
        try {
          const batchUrl = `https://graph.facebook.com/v19.0/${channel.channel_identifier}/posts?fields=id,reactions.type(LIKE).summary(total_count).as(like),reactions.type(LOVE).summary(total_count).as(love),reactions.type(CARE).summary(total_count).as(care),reactions.type(HAHA).summary(total_count).as(haha),reactions.type(WOW).summary(total_count).as(wow),reactions.type(SAD).summary(total_count).as(sad),reactions.type(ANGRY).summary(total_count).as(angry)&limit=50&access_token=${pageToken}`;
          const fbRes = await fetch(batchUrl);
          const fbData = await fbRes.json();

          if (fbData.data && Array.isArray(fbData.data)) {
            for (const p of fbData.data) {
              const likeCount = p.like?.summary?.total_count || 0;
              const loveCount = p.love?.summary?.total_count || 0;
              const careCount = p.care?.summary?.total_count || 0;
              const hahaCount = p.haha?.summary?.total_count || 0;
              const wowCount = p.wow?.summary?.total_count || 0;
              const sadCount = p.sad?.summary?.total_count || 0;
              const angryCount = p.angry?.summary?.total_count || 0;
              const totalCount =
                likeCount + loveCount + careCount + hahaCount + wowCount + sadCount + angryCount;

              const summary = {
                total: totalCount,
                like: likeCount,
                love: loveCount,
                care: careCount,
                haha: hahaCount,
                wow: wowCount,
                sad: sadCount,
                angry: angryCount,
              };

              const rawId = p.id;
              const cleanSuffix = rawId.includes('_') ? rawId.split('_')[1] : rawId;

              await query(
                `UPDATE facebook_posts 
                 SET reaction_summary = $1, last_reaction_sync = NOW() 
                 WHERE tenant_id = $2 AND (post_id = $3 OR post_id LIKE '%' || $4);`,
                [JSON.stringify(summary), auth.tenantId, rawId, cleanSuffix]
              );
            }

            // Re-query fresh data
            postsRes = await query(
              `SELECT id, post_id, message, media_url, permalink_url, comment_count, 
                      created_time, updated_at, hide_reactions_internal, reaction_summary, last_reaction_sync
               FROM facebook_posts 
               WHERE tenant_id = $1 AND message IS NOT NULL AND trim(message) != ''
               ORDER BY created_time DESC LIMIT 50;`,
              [auth.tenantId]
            );
          }
        } catch (batchErr) {
          console.warn('Batch reactions sync error:', batchErr);
        }
      }

      // Get count of blocked users for this tenant
      const blockedCountRes = await query(
        `SELECT COUNT(*) FROM page_blocked_users WHERE tenant_id = $1;`,
        [auth.tenantId]
      );

      return NextResponse.json({
        posts: postsRes.rows,
        channel: {
          id: channel.id,
          name: channel.channel_name,
          pageId: channel.channel_identifier,
        },
        blockedCount: parseInt(blockedCountRes.rows[0]?.count || '0', 10),
      });
    }

    // 2. Fetch live reaction counts for the specific post from Meta Graph API
    if (!pageToken) {
      return NextResponse.json({ error: 'পেজ অ্যাক্সেস টোকেন পাওয়া যায়নি।' }, { status: 400 });
    }

    // Graph API query for reactions breakdown
    const summaryUrl = `https://graph.facebook.com/v19.0/${postId}?fields=reactions.type(LIKE).summary(total_count).as(like),reactions.type(LOVE).summary(total_count).as(love),reactions.type(CARE).summary(total_count).as(care),reactions.type(HAHA).summary(total_count).as(haha),reactions.type(WOW).summary(total_count).as(wow),reactions.type(SAD).summary(total_count).as(sad),reactions.type(ANGRY).summary(total_count).as(angry)&access_token=${pageToken}`;
    
    // Graph API query for angry reactors list
    const reactorsUrl = `https://graph.facebook.com/v19.0/${postId}/reactions?limit=100&access_token=${pageToken}`;

    const [summaryRes, reactorsRes] = await Promise.all([
      fetch(summaryUrl),
      fetch(reactorsUrl),
    ]);

    const summaryData = await summaryRes.json();
    const reactorsData = await reactorsRes.json();

    if (!summaryRes.ok) {
      console.warn('Meta reactions fetch failed:', summaryData);
      return NextResponse.json(
        { error: summaryData?.error?.message || 'ফেসবুক থেকে রিঅ্যাকশন তথ্য আনা যায়নি' },
        { status: 400 }
      );
    }

    const likeCount = summaryData.like?.summary?.total_count || 0;
    const loveCount = summaryData.love?.summary?.total_count || 0;
    const careCount = summaryData.care?.summary?.total_count || 0;
    const hahaCount = summaryData.haha?.summary?.total_count || 0;
    const wowCount = summaryData.wow?.summary?.total_count || 0;
    const sadCount = summaryData.sad?.summary?.total_count || 0;
    const angryCount = summaryData.angry?.summary?.total_count || 0;
    const totalCount =
      likeCount + loveCount + careCount + hahaCount + wowCount + sadCount + angryCount;

    const summary = {
      total: totalCount,
      like: likeCount,
      love: loveCount,
      care: careCount,
      haha: hahaCount,
      wow: wowCount,
      sad: sadCount,
      angry: angryCount,
    };

    // Calculate attack risk: high angry reactions or high percentage
    const isAttackRisk = angryCount >= 15 || (totalCount > 10 && angryCount / totalCount >= 0.15);

    // Get list of already blocked users for this tenant to cross-reference
    const blockedRes = await query(
      `SELECT facebook_user_id FROM page_blocked_users WHERE tenant_id = $1;`,
      [auth.tenantId]
    );
    const blockedSet = new Set(blockedRes.rows.map((r: any) => r.facebook_user_id));

    const rawReactors = Array.isArray(reactorsData?.data) ? reactorsData.data : [];
    // Keep reactors with type === 'ANGRY' or all reactors
    const angryReactors = rawReactors
      .filter((u: any) => u.type === 'ANGRY' || angryCount > 0)
      .map((u: any) => ({
        id: u.id,
        name: u.name || 'Facebook User',
        type: u.type || 'ANGRY',
        isBlocked: blockedSet.has(u.id),
      }));

    // Update facebook_posts with reaction_summary
    await query(
      `UPDATE facebook_posts 
       SET reaction_summary = $1, last_reaction_sync = NOW() 
       WHERE tenant_id = $2 AND (post_id = $3 OR post_id LIKE '%' || $4);`,
      [JSON.stringify(summary), auth.tenantId, postId, postId.split('_')[1] || postId]
    );

    return NextResponse.json({
      postId,
      summary,
      angryReactors,
      isAttackRisk,
      lastReactionSync: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Reactions route error:', err);
    return NextResponse.json(
      { error: err.message || 'অভ্যন্তরীণ সার্ভার ত্রুটি' },
      { status: 500 }
    );
  }
}
