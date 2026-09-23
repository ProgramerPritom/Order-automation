import { pool } from '../src/lib/db';

async function testBatchReactions() {
  const channelRes = await pool.query(
    `SELECT access_token, channel_identifier FROM channels WHERE platform = 'facebook' ORDER BY ai_active DESC LIMIT 1;`
  );
  const { access_token, channel_identifier } = channelRes.rows[0];

  const batchUrl = `https://graph.facebook.com/v19.0/${channel_identifier}/posts?fields=id,message,created_time,reactions.type(LIKE).summary(total_count).as(like),reactions.type(LOVE).summary(total_count).as(love),reactions.type(ANGRY).summary(total_count).as(angry)&limit=10&access_token=${access_token}`;

  const res = await fetch(batchUrl);
  const data = await res.json();
  console.log('Batch fetch status:', res.status);
  if (data.data) {
    for (const p of data.data) {
      console.log('Post ID:', p.id);
      console.log('Message:', (p.message || '').slice(0, 30));
      console.log('Likes:', p.like?.summary?.total_count);
      console.log('Love:', p.love?.summary?.total_count);
      console.log('Angry:', p.angry?.summary?.total_count);
      console.log('---');
    }
  } else {
    console.log('Error:', data);
  }

  await pool.end();
}

testBatchReactions().catch(console.error);
