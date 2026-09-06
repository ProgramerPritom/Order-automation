const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const tenantId = '58818813-da76-4450-a8f9-494fb46ca3d7';
  const channelId = '991e05d7-c13e-42be-bfbb-ccdfb4b5078c';
  const realPostId = '1374129259109200_122095744107475656';

  const check = await pool.query("SELECT id FROM facebook_posts WHERE post_id = $1;", [realPostId]);
  if (check.rows.length === 0) {
    await pool.query(`
      INSERT INTO facebook_posts (
        tenant_id, channel_id, post_id, message, permalink_url, comment_count, created_time, updated_at
      ) VALUES (
        $1, $2, $3, 'New activity Toy for kids (Building Blocks)', 'https://facebook.com/1374129259109200_122095744107475656', 3, NOW(), NOW()
      );
    `, [tenantId, channelId, realPostId]);
    console.log('Inserted real post.');
  } else {
    console.log('Real post already exists.');
  }

  // Also move or attach the user's test comment to this real post_id so it displays under it
  await pool.query(`
    UPDATE facebook_comments 
    SET post_id = $1 
    WHERE customer_name = 'Shohajina Sadik Suchana';
  `, [realPostId]);
  console.log('Updated Shohajina Sadik Suchana comments to real post_id.');

  await pool.end();
}

run().catch(console.error);
