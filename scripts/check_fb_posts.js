const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const r = await pool.query("SELECT id, post_id, message, tenant_id, channel_id FROM facebook_posts;");
  console.log('Facebook Posts in DB:', r.rows);
  await pool.end();
}

run().catch(console.error);
