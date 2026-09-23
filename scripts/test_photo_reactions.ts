import { pool } from '../src/lib/db';

async function testPhotoReactions() {
  const channelRes = await pool.query(
    `SELECT access_token FROM channels WHERE platform = 'facebook' ORDER BY ai_active DESC LIMIT 1;`
  );
  const token = channelRes.rows[0].access_token;
  const photoId = '122108926665475656';
  const r = await fetch(`https://graph.facebook.com/v19.0/${photoId}/reactions?access_token=${token}`);
  const d = await r.json();
  console.log('Reactions on photo:', d);

  // Also check if any comments exist on the page from bots:
  const commentsRes = await fetch(`https://graph.facebook.com/v19.0/1374129259109200/feed?fields=comments{from,message}&limit=10&access_token=${token}`);
  const commentsData = await commentsRes.json();
  console.log('Recent comments on feed:', JSON.stringify(commentsData, null, 2));

  await pool.end();
}

testPhotoReactions().catch(console.error);
