import { pool } from '../src/lib/db';

async function checkComments() {
  const channelRes = await pool.query(
    `SELECT access_token FROM channels WHERE platform = 'facebook' ORDER BY ai_active DESC LIMIT 1;`
  );
  const token = channelRes.rows[0].access_token;
  const targetId = '1374129259109200_122108935551475656';
  const res = await fetch(`https://graph.facebook.com/v19.0/${targetId}/comments?fields=id,from,message,created_time&access_token=${token}`);
  const data = await res.json();
  console.log('Comments on post:', data);
  await pool.end();
}

checkComments().catch(console.error);
