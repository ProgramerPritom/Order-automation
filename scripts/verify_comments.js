const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verify() {
  const r = await pool.query(`
    SELECT p.post_id, p.message, count(c.id) as comment_count,
           json_agg(json_build_object('id', c.comment_id, 'name', c.customer_name, 'comment', c.comment_text, 'reply', c.ai_reply_text)) as comments
    FROM facebook_posts p
    JOIN facebook_comments c ON p.post_id = c.post_id
    GROUP BY p.id;
  `);
  console.log(JSON.stringify(r.rows, null, 2));
  await pool.end();
}

verify().catch(console.error);
