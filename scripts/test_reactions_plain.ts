import { pool } from '../src/lib/db';

async function testPlain() {
  const channelRes = await pool.query(
    `SELECT access_token FROM channels WHERE platform = 'facebook' ORDER BY ai_active DESC LIMIT 1;`
  );
  const token = channelRes.rows[0].access_token;
  const targetId = '1374129259109200_122108935551475656';

  // 1. plain reactions endpoint
  const res = await fetch(`https://graph.facebook.com/v19.0/${targetId}/reactions?access_token=${token}`);
  const data = await res.json();
  console.log('Plain reactions:', data);

  // 2. What about the other post 1374129259109200_122109702057475656 where there are 1 Like, 1 Love?
  const resPost2 = await fetch(`https://graph.facebook.com/v19.0/1374129259109200_122109702057475656/reactions?access_token=${token}`);
  const dataPost2 = await resPost2.json();
  console.log('Post 2 reactions:', dataPost2);

  await pool.end();
}

testPlain().catch(console.error);
