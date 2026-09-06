const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function resubscribe() {
  const r = await pool.query("SELECT access_token FROM channels WHERE channel_identifier = '1374129259109200';");
  const token = r.rows[0]?.access_token;
  await pool.end();

  console.log('Calling POST /1374129259109200/subscribed_apps with fresh token...');
  const res = await fetch(`https://graph.facebook.com/v19.0/1374129259109200/subscribed_apps?subscribed_fields=feed,messages,messaging_postbacks&access_token=${token}`, {
    method: 'POST'
  });
  const data = await res.json();
  console.log('Subscribed apps response:', data);

  // Check comments on the post to see if the new comment exists on Facebook
  const postId = '1374129259109200_122095744107475656';
  const cRes = await fetch(`https://graph.facebook.com/v19.0/${postId}/comments?fields=id,message,from,created_time&access_token=${token}`);
  const cData = await cRes.json();
  console.log('Latest Facebook comments:', JSON.stringify(cData, null, 2));
}

resubscribe().catch(console.error);
