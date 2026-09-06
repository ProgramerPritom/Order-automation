const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verifyFbLive() {
  const r = await pool.query("SELECT access_token FROM channels WHERE channel_identifier = '1374129259109200';");
  const token = r.rows[0]?.access_token;
  await pool.end();

  const commentId = '122095744107475656_1076716828095576';
  const res = await fetch(`https://graph.facebook.com/v19.0/${commentId}/comments?fields=id,message,from,created_time&access_token=${token}`);
  const data = await res.json();
  console.log('Sub-replies for "atar price koto r delivery charge?":', JSON.stringify(data, null, 2));
}

verifyFbLive().catch(console.error);
