const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function postRepliesToFacebook() {
  const r = await pool.query("SELECT access_token FROM channels WHERE channel_identifier = '1374129259109200';");
  const token = r.rows[0]?.access_token;
  await pool.end();

  const commentsToReply = [
    {
      id: "122095744107475656_1394338932847727",
      reply: "ধন্যবাদ! আমাদের বিল্ডিং ব্লক খেলনাটির মূল্য মাত্র ৮৫০ টাকা। বিস্তারিত জানাতে আপনাকে ইনবক্সে মেসেজ পাঠাচ্ছি।"
    },
    {
      id: "122095744107475656_1099288752692839",
      reply: "প্রিয় গ্রাহক, এই সেটে মোট ৬০টি আকর্ষণীয় ও রঙিন ব্লক পিস রয়েছে।"
    },
    {
      id: "122095744107475656_1396443029130287",
      reply: "হ্যালো ভাইয়া/আপু! Little Joys-এ স্বাগতম। আপনি কি অর্ডার করতে চান?"
    }
  ];

  for (const item of commentsToReply) {
    console.log(`Posting reply to Facebook comment ${item.id}...`);
    const res = await fetch(`https://graph.facebook.com/v19.0/${item.id}/comments?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: item.reply })
    });
    const data = await res.json();
    console.log(`Result for ${item.id}:`, data);
  }
}

postRepliesToFacebook().catch(console.error);
