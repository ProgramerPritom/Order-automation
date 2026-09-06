const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function syncDb() {
  const tenantId = '58818813-da76-4450-a8f9-494fb46ca3d7';
  const channelRes = await pool.query("SELECT id FROM channels WHERE channel_identifier = '1374129259109200';");
  const channelId = channelRes.rows[0]?.id;
  const postId = '1374129259109200_122095744107475656';

  // Clear previous mock/test comments for this post
  await pool.query("DELETE FROM facebook_comments WHERE post_id = $1;", [postId]);

  // Insert the 3 live comments with their live Facebook comment IDs and posted replies
  const comments = [
    {
      commentId: "122095744107475656_1394338932847727",
      customerName: "Shohajina Sadik Suchana",
      customerId: "28831760923088460",
      commentText: "khub sundor. price jante pari?",
      aiReply: "ধন্যবাদ! আমাদের বিল্ডিং ব্লক খেলনাটির মূল্য মাত্র ৮৫০ টাকা। বিস্তারিত জানাতে আপনাকে ইনবক্সে মেসেজ পাঠাচ্ছি।"
    },
    {
      commentId: "122095744107475656_1099288752692839",
      customerName: "Shohajina Sadik Suchana",
      customerId: "28831760923088460",
      commentText: "block gulo koto pics?",
      aiReply: "প্রিয় গ্রাহক, এই সেটে মোট ৬০টি আকর্ষণীয় ও রঙিন ব্লক পিস রয়েছে।"
    },
    {
      commentId: "122095744107475656_1396443029130287",
      customerName: "Shohajina Sadik Suchana",
      customerId: "28831760923088460",
      commentText: "hello",
      aiReply: "হ্যালো ভাইয়া/আপু! Little Joys-এ স্বাগতম। আপনি কি অর্ডার করতে চান?"
    }
  ];

  for (const c of comments) {
    await pool.query(`
      INSERT INTO facebook_comments (
        tenant_id, channel_id, post_id, comment_id, customer_name, customer_id, comment_text, ai_reply_text, ai_replied, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW());
    `, [tenantId, channelId, postId, c.commentId, c.customerName, c.customerId, c.commentText, c.aiReply]);
  }

  await pool.query("UPDATE facebook_posts SET comment_count = 3 WHERE post_id = $1;", [postId]);
  console.log('Database synchronized with live Facebook comments and replies.');
  await pool.end();
}

syncDb().catch(console.error);
