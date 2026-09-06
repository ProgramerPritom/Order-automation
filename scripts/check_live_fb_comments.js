const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkComments() {
  const r = await pool.query("SELECT access_token FROM channels WHERE channel_identifier = '1374129259109200';");
  const token = r.rows[0]?.access_token;
  await pool.end();

  const postId = '1374129259109200_122095744107475656';
  console.log(`Fetching live comments from Facebook for post ${postId}...`);
  const res = await fetch(`https://graph.facebook.com/v19.0/${postId}/comments?fields=id,message,from,created_time&access_token=${token}`);
  const data = await res.json();
  console.log('Live Facebook Comments:', JSON.stringify(data, null, 2));

  // Also test subscribed apps to ensure feed is subscribed
  const subRes = await fetch(`https://graph.facebook.com/v19.0/1374129259109200/subscribed_apps?access_token=${token}`);
  const subData = await subRes.json();
  console.log('Subscribed apps:', JSON.stringify(subData, null, 2));
}

checkComments().catch(console.error);
