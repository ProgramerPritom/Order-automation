const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanup() {
  await pool.query("DELETE FROM facebook_comments WHERE post_id IN ('1374129259109200_building_blocks', '1374129259109200_123456789', 'test_post_cache');");
  await pool.query("DELETE FROM facebook_posts WHERE post_id IN ('1374129259109200_building_blocks', '1374129259109200_123456789', 'test_post_cache');");
  console.log('Cleaned up dummy posts.');
  await pool.end();
}

cleanup().catch(console.error);
