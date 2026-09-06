const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function processComments() {
  const tenantId = '58818813-da76-4450-a8f9-494fb46ca3d7';
  const channelRes = await pool.query("SELECT id, access_token FROM channels WHERE channel_identifier = '1374129259109200';");
  const channel = channelRes.rows[0];
  const postId = '1374129259109200_122095744107475656';

  const comments = [
    {
      commentId: `fb_comm_${Date.now()}_1`,
      customerName: 'Shohajina Sadik Suchana',
      commentText: 'block gulo koto pics?',
      expectedReply: 'আমাদের এই বিল্ডিং ব্লক সেটে ৬০টি রঙিন পিস রয়েছে।'
    },
    {
      commentId: `fb_comm_${Date.now()}_2`,
      customerName: 'Shohajina Sadik Suchana',
      commentText: 'hello',
      expectedReply: 'হ্যালো ভাইয়া/আপু! Little Joys-এ স্বাগতম। কীভাবে সাহায্য করতে পারি?'
    }
  ];

  for (const c of comments) {
    // 1. Generate AI reply using Gemini 2.5 Flash
    let aiReply = c.expectedReply;
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const prompt = `তুমি "Little Joys" শপের ফেসবুক পেজ ম্যানেজার। কাস্টমার "Shohajina Sadik Suchana" আমাদের পোস্টে কমেন্ট করেছেন: "${c.commentText}". পণ্য: Building Blocks 60 Pcs, দাম 850 টাকা। কাস্টমারকে মিষ্টি ও পেশাদার বাংলায় ১-২ লাইনে উত্তর দাও।`;
      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 150, temperature: 0.6 }
        })
      });
      const gData = await gRes.json();
      const generated = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (generated) aiReply = generated;
    } catch (e) {
      console.warn('Gemini fallback:', e);
    }

    // 2. Insert into facebook_comments
    await pool.query(`
      INSERT INTO facebook_comments (
        tenant_id, channel_id, post_id, comment_id, customer_name, comment_text, ai_reply_text, ai_replied, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW());
    `, [tenantId, channel.id, postId, c.commentId, c.customerName, c.commentText, aiReply]);

    console.log(`Inserted comment "${c.commentText}" with AI reply: "${aiReply}"`);
  }

  // Update comment count on post
  await pool.query(`UPDATE facebook_posts SET comment_count = 3 WHERE post_id = $1;`, [postId]);

  await pool.end();
  console.log('All comments processed.');
}

processComments().catch(console.error);
