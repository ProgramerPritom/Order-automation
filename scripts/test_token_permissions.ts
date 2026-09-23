import { pool } from '../src/lib/db';

async function checkToken() {
  const channelRes = await pool.query(
    `SELECT access_token FROM channels WHERE platform = 'facebook' ORDER BY ai_active DESC LIMIT 1;`
  );
  const token = channelRes.rows[0].access_token;
  const res = await fetch(`https://graph.facebook.com/v19.0/me/permissions?access_token=${token}`);
  const data = await res.json();
  console.log('Token Permissions:', data);
  await pool.end();
}

checkToken().catch(console.error);
