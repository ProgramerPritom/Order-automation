import { pool } from '../src/lib/db';

async function syncAllReactionsNow() {
  const channelRes = await pool.query(
    `SELECT access_token, channel_identifier, tenant_id FROM channels WHERE platform = 'facebook' ORDER BY ai_active DESC LIMIT 1;`
  );
  const { access_token, channel_identifier, tenant_id } = channelRes.rows[0];

  const batchUrl = `https://graph.facebook.com/v19.0/${channel_identifier}/posts?fields=id,reactions.type(LIKE).summary(total_count).as(like),reactions.type(LOVE).summary(total_count).as(love),reactions.type(CARE).summary(total_count).as(care),reactions.type(HAHA).summary(total_count).as(haha),reactions.type(WOW).summary(total_count).as(wow),reactions.type(SAD).summary(total_count).as(sad),reactions.type(ANGRY).summary(total_count).as(angry)&limit=50&access_token=${access_token}`;

  const res = await fetch(batchUrl);
  const data = await res.json();
  if (data.data && Array.isArray(data.data)) {
    for (const p of data.data) {
      const like = p.like?.summary?.total_count || 0;
      const love = p.love?.summary?.total_count || 0;
      const care = p.care?.summary?.total_count || 0;
      const haha = p.haha?.summary?.total_count || 0;
      const wow = p.wow?.summary?.total_count || 0;
      const sad = p.sad?.summary?.total_count || 0;
      const angry = p.angry?.summary?.total_count || 0;
      const total = like + love + care + haha + wow + sad + angry;
      const summary = { total, like, love, care, haha, wow, sad, angry };

      const rawId = p.id;
      const cleanSuffix = rawId.includes('_') ? rawId.split('_')[1] : rawId;

      await pool.query(
        `UPDATE facebook_posts 
         SET reaction_summary = $1, last_reaction_sync = NOW() 
         WHERE tenant_id = $2 AND (post_id = $3 OR post_id LIKE '%' || $4);`,
        [JSON.stringify(summary), tenant_id, rawId, cleanSuffix]
      );
    }
    console.log('✓ Successfully synced reaction summaries for', data.data.length, 'posts');
  }

  await pool.end();
}

syncAllReactionsNow().catch(console.error);
