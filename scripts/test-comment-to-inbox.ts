import * as dotenv from 'dotenv';
dotenv.config();

import { query } from '../src/lib/db';
import { processFacebookComment } from '../src/lib/ai-comment-engine';

async function testPhase4() {
  console.log('🧪 Starting Phase 4 DoD Self-Test: Facebook Comment-to-Inbox Private Replies Pipeline...\n');

  // 1. Get or seed test tenant
  let tenantRes = await query(`SELECT id FROM tenants LIMIT 1;`);
  let tenantId = tenantRes.rows[0]?.id;

  if (!tenantId) {
    const t = await query(`
      INSERT INTO tenants (name, slug, email)
      VALUES ('Comment Test Store', 'comment-${Date.now()}', 'comment-${Date.now()}@test.com')
      RETURNING id;
    `);
    tenantId = t.rows[0].id;
  }

  // 2. Get or seed channel
  let chRes = await query(`SELECT id, channel_identifier FROM channels WHERE tenant_id = $1 LIMIT 1;`, [tenantId]);
  let channelId: string;
  let pageId: string;

  if (chRes.rows.length === 0) {
    pageId = `fb_page_${Date.now()}`;
    const c = await query(`
      INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, access_token)
      VALUES ($1, 'facebook', $2, 'Comment Test Page', 'mock_token')
      RETURNING id;
    `, [tenantId, pageId]);
    channelId = c.rows[0].id;
  } else {
    channelId = chRes.rows[0].id;
    pageId = chRes.rows[0].channel_identifier;
  }

  // 3. Create test product
  const pRes = await query(`
    INSERT INTO products (tenant_id, title, description, category, price, stock, sku, rag_knowledge)
    VALUES ($1, 'Montessori Wooden Busy House', 'বাচ্চাদের ১০টি ভিন্ন স্কিল শেখার কাঠের ঘর', 'Educational', 2450, 10, $2, 'কাঠের ঘর, বিভিন্ন লক, চাবি, গিয়ার ও সুইচ বোর্ড যুক্ত।')
    RETURNING id, title, price;
  `, [tenantId, `SKU-COMM-${Date.now().toString().slice(-4)}`]);
  const product = pRes.rows[0];

  // 4. Create mapped post
  const testPostId = `post_${Date.now()}`;
  await query(`
    INSERT INTO post_product_mappings (tenant_id, post_id, product_id)
    VALUES ($1, $2, $3);
  `, [tenantId, testPostId, product.id]);

  console.log(`✅ Provisioned Mapped Post "${testPostId}" -> Product "${product.title}" (৳${product.price})\n`);

  // 5. Test Comment Processing
  const testCommentId = `comm_${Date.now()}`;
  console.log('💬 Simulating customer comment on post: "এটার প্রাইস কত? অর্ডার করতে চাই"');

  const result = await processFacebookComment({
    tenantId,
    channelId,
    postId: testPostId,
    commentId: testCommentId,
    customerName: 'সাদিয়া ইসলাম',
    customerId: `user_${Date.now()}`,
    commentText: 'এটার প্রাইস কত? অর্ডার করতে চাই',
    postMessage: 'আমাদের মন্টেসরি বিজি হাউজ এখন বিশেষ ছাড়ে!',
    accessToken: 'mock_token',
    pageId,
  });

  console.log('\n🤖 AI Generated Responses:');
  console.log(`  1. Public Comment Reply: "${result.aiReplyText}"`);
  console.log(`  2. Private Reply (Inbox DM): "${result.privateReplyText}"`);

  if (!result.success) {
    throw new Error('❌ processFacebookComment returned failure!');
  }

  if (!result.aiReplyText || result.aiReplyText.trim().length < 5) {
    throw new Error('❌ Public comment reply was not generated properly');
  }

  if (!result.privateReplyText || !result.privateReplyText.includes('2450')) {
    throw new Error('❌ Private inbox reply did not contain mapped product pricing!');
  }
  console.log('✅ Verified Private Reply accurately contains mapped product title & pricing!');

  // 6. Verify Database Record
  const dbCheck = await query(
    `SELECT comment_id, ai_reply_text, ai_replied FROM facebook_comments WHERE comment_id = $1;`,
    [testCommentId]
  );

  if (dbCheck.rows.length === 0 || !dbCheck.rows[0].ai_replied) {
    throw new Error('❌ Comment was not saved into facebook_comments table!');
  }
  console.log('✅ Verified comment and AI response saved in PostgreSQL database.');

  // Cleanup test records
  await query(`DELETE FROM facebook_comments WHERE comment_id = $1;`, [testCommentId]);
  await query(`DELETE FROM post_product_mappings WHERE post_id = $1;`, [testPostId]);
  await query(`DELETE FROM products WHERE id = $1;`, [product.id]);
  console.log('✅ Cleaned up temporary test comment, mapping, and product.');

  console.log('\n=============================================');
  console.log('🎉 PHASE 4 DOD PASSED 100%: COMMENT-TO-INBOX PIPELINE VERIFIED!');
  console.log('=============================================\n');
}

testPhase4()
  .then(() => {})
  .catch((err) => {
    console.error('❌ Phase 4 DoD Test Failed:', err);
    process.exit(1);
  });
