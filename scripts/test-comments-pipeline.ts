import { pool, query } from '../src/lib/db';
import { processFacebookComment, sendPrivateReplyToComment } from '../src/lib/ai-comment-engine';

async function runCommentsPipelineTests() {
  console.log('🧪 Starting Facebook Comments & 1-Click Outreach Test Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`  ✅ Passed: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ Failed: ${testName}`);
    }
  }

  try {
    // 1. Setup Test Tenant & Channel
    const testTenantSlug = `test-comment-shop-${Date.now()}`;
    const tenantRes = await query(
      `INSERT INTO tenants (name, slug, email, about_shop, delivery_inside_dhaka, delivery_outside_dhaka)
       VALUES ('ফ্যাশন বাজার', $1, $2, 'সেরা মানের পাঞ্জাবি ও ড্রেস কালেকশন', 80, 130)
       RETURNING id;`,
      [testTenantSlug, `${testTenantSlug}@example.com`]
    );
    const tenantId = tenantRes.rows[0].id;
    assert(!!tenantId, 'Test Tenant created in PostgreSQL');

    const channelIdGen = `chan_fb_${Date.now()}`;
    const channelRes = await query(
      `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, access_token)
       VALUES ($1, 'facebook', $2, 'ফ্যাশন বাজার অফিসিয়াল পেজ', 'mock_token')
       RETURNING id;`,
      [tenantId, channelIdGen]
    );
    const channelId = channelRes.rows[0].id;
    assert(!!channelId, 'Test Channel created in PostgreSQL');

    const testPostId = `post_${Date.now()}`;
    const testCommentId = `comment_${Date.now()}`;

    // 2. Test Comment Ingestion & AI Public Reply
    console.log('\n--- Test 1: Ingesting Post Comment & AI Reply Generation ---');
    const commentRes = await processFacebookComment({
      tenantId,
      channelId,
      postId: testPostId,
      commentId: testCommentId,
      customerName: 'তানজিলা হক',
      customerId: 'user_12345',
      commentText: 'কালো পাঞ্জাবিটার দাম কত ভাইয়া? এম সাইজ হবে?',
      postMessage: 'ঈদের স্পেশাল প্রিমিয়াম কটন পাঞ্জাবি কালেকশন ২০২৬!',
      mediaUrl: 'https://example.com/punjabi.jpg',
      permalinkUrl: 'https://facebook.com/fashionbazar/posts/12345',
      accessToken: 'mock_token',
    });

    assert(commentRes.success, 'processFacebookComment completed without errors');
    assert(!!commentRes.aiReplyText && commentRes.aiReplyText.length > 5, 'AI generated brand-aligned public comment reply');

    // Verify Facebook Post recorded
    const postInDb = await query(`SELECT post_id, comment_count FROM facebook_posts WHERE post_id = $1;`, [testPostId]);
    assert(postInDb.rows.length > 0, 'Post stored in facebook_posts table');
    assert(postInDb.rows[0].comment_count === 1, 'Post comment_count incremented to 1');

    // Verify Facebook Comment recorded
    const commentInDb = await query(
      `SELECT comment_id, customer_name, ai_replied, ai_reply_text, private_reply_sent 
       FROM facebook_comments WHERE comment_id = $1;`,
      [testCommentId]
    );
    assert(commentInDb.rows.length > 0, 'Comment stored in facebook_comments table');
    assert(commentInDb.rows[0].ai_replied === true, 'ai_replied flag set to TRUE');
    assert(commentInDb.rows[0].private_reply_sent === false, 'private_reply_sent initially FALSE');

    // 3. Test 1-Click Connect with Buyer (Private Reply)
    console.log('\n--- Test 2: 1-Click Private Message to Commenter ---');
    const privateReplyRes = await sendPrivateReplyToComment({
      commentId: testCommentId,
      messageText: 'আসসালামু আলাইকুম তানজিলা আপু! পাঞ্জাবিটির দাম ৯৫০ টাকা এবং এম সাইজ এভেইলেবল আছে। আপনি কি অর্ডার করতে চান?',
      accessToken: 'mock_token',
      tenantId,
    });

    assert(privateReplyRes.success, 'Private reply dispatched successfully');

    // Verify updated status in database
    const updatedComment = await query(
      `SELECT private_reply_sent FROM facebook_comments WHERE comment_id = $1;`,
      [testCommentId]
    );
    assert(updatedComment.rows[0].private_reply_sent === true, 'private_reply_sent updated to TRUE in database');

    // 4. Test Second Comment on Same Post (Increment Count)
    console.log('\n--- Test 3: Multiple Comments on Same Post ---');
    const secondCommentId = `comment_2_${Date.now()}`;
    await processFacebookComment({
      tenantId,
      channelId,
      postId: testPostId,
      commentId: secondCommentId,
      customerName: 'সাকিব হাসান',
      commentText: 'ডেলিভারি চার্জ কত ঢাকার বাইরে?',
      accessToken: 'mock_token',
    });

    const postAfterSecond = await query(`SELECT comment_count FROM facebook_posts WHERE post_id = $1;`, [testPostId]);
    assert(postAfterSecond.rows[0].comment_count === 2, 'Post comment_count incremented to 2');

    // 5. Cleanup Test Data
    await query(`DELETE FROM tenants WHERE id = $1;`, [tenantId]);
    console.log('\n🧹 Test tenant and related data cleanly purged.');

    console.log(`\n==============================================`);
    console.log(`🎯 Test Result: ${passed}/${total} assertions passed!`);
    console.log(`==============================================\n`);

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runCommentsPipelineTests();
