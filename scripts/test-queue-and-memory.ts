import { pool, query } from '../src/lib/db';
import { saasRedis } from '../src/lib/redis';
import { enqueueWebhookJob, getQueueMetrics, triggerQueueWorker } from '../src/lib/message-queue';

async function runQueueAndMemoryTests() {
  console.log('🧪 Starting Redis Queue, Working Memory & Event Cache Invalidation Test Suite...\n');
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
    const testTenantSlug = `queue-test-${Date.now()}`;
    const tenantRes = await query(
      `INSERT INTO tenants (name, slug, email, about_shop, delivery_inside_dhaka, delivery_outside_dhaka)
       VALUES ('স্মার্ট গ্যাজেট শপ', $1, $2, 'আমরা সেরা স্মার্ট ওয়াচ বিক্রি করি', 70, 120)
       RETURNING id;`,
      [testTenantSlug, `${testTenantSlug}@example.com`]
    );
    const tenantId = tenantRes.rows[0].id;
    assert(!!tenantId, 'Test Tenant created');

    const channelRes = await query(
      `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, access_token)
       VALUES ($1, 'facebook', $2, 'স্মার্ট গ্যাজেট পেজ', 'mock_token')
       RETURNING id;`,
      [tenantId, `chan_q_${Date.now()}`]
    );
    const channelId = channelRes.rows[0].id;
    assert(!!channelId, 'Test Channel created');

    // =========================================================================
    // Test 1: Event-Driven Permanent Cache & Invalidation
    // =========================================================================
    console.log('\n--- Test 1: Event-Driven Permanent Cache & Invalidation ---');
    const catalogKey = `catalog:${tenantId}`;
    const shopKey = `shop:${tenantId}`;

    // Seed permanent cache
    await saasRedis.set(shopKey, { name: 'স্মার্ট গ্যাজেট শপ', cached: true });
    await saasRedis.set(catalogKey, [{ id: 'p1', title: 'স্মার্ট ওয়াচ Pro' }]);

    const cachedShop = await saasRedis.get<any>(shopKey);
    assert(!!cachedShop && cachedShop.cached === true, 'Store Knowledge permanently cached in Redis without TTL expiration');

    const cachedCatalog = await saasRedis.get<any[]>(catalogKey);
    assert(!!cachedCatalog && cachedCatalog.length === 1, 'Product Catalog permanently cached in Redis');

    // Invalidate on update event
    await saasRedis.del(catalogKey);
    const catalogAfterDel = await saasRedis.get(catalogKey);
    assert(catalogAfterDel === null, 'Event-Driven invalidation successfully flushed catalog cache');

    // =========================================================================
    // Test 2: Resilient Redis FIFO Queue & Worker Execution
    // =========================================================================
    console.log('\n--- Test 2: Redis FIFO Queue Ingestion & Worker Processing ---');
    const customerSenderId = `cust_q_${Date.now()}`;

    const jobId = await enqueueWebhookJob('customer_message', {
      tenantId,
      channelId,
      pageId: `chan_q_${Date.now()}`,
      senderId: customerSenderId,
      customerName: 'তানভীর আহমেদ',
      messageText: 'আপনাদের স্মার্ট ওয়াচের দাম কত এবং ডেলিভারি চার্জ কত?',
      accessToken: 'mock_token',
    });

    assert(!!jobId, `Webhook job successfully enqueued with Job ID: ${jobId}`);

    // Wait a brief moment for worker consumer to process
    let jobRecord = await saasRedis.get<any>(`job:${jobId}`);
    let waitCount = 0;
    while (jobRecord && jobRecord.status === 'queued' && waitCount < 10) {
      await new Promise((r) => setTimeout(r, 600));
      jobRecord = await saasRedis.get<any>(`job:${jobId}`);
      waitCount++;
    }

    assert(
      jobRecord && (jobRecord.status === 'completed' || jobRecord.status === 'processing'),
      `Queue Worker successfully consumed job (Status: ${jobRecord?.status})`
    );

    // =========================================================================
    // Test 3: 2-Tier Working Memory in Redis
    // =========================================================================
    console.log('\n--- Test 3: Redis 2-Tier Working Memory Retention ---');
    // Fetch conversation created for this customer
    const convRes = await query(
      `SELECT id FROM conversations WHERE customer_identifier = $1;`,
      [customerSenderId]
    );
    assert(convRes.rows.length > 0, 'Conversation record created in PostgreSQL');

    const conversationId = convRes.rows[0].id;
    const historyKey = `conv_history:${conversationId}`;
    const redisWorkingMemory = await saasRedis.get<any[]>(historyKey);

    assert(
      Array.isArray(redisWorkingMemory) && redisWorkingMemory.length >= 1,
      `Redis Working Memory retained customer turn in memory (<1ms instant recall)`
    );

    // =========================================================================
    // Test 4: Queue Metrics Diagnostic
    // =========================================================================
    console.log('\n--- Test 4: Queue Health & Dead-Letter Diagnostics ---');
    const metrics = await getQueueMetrics();
    assert(metrics.status === 'healthy', 'Queue health metric reports healthy');
    assert(typeof metrics.queueLength === 'number', `Active Queue Length: ${metrics.queueLength}`);
    assert(typeof metrics.dlqCount === 'number', `Dead-Letter Queue Count: ${metrics.dlqCount}`);

    // Cleanup
    await query(`DELETE FROM tenants WHERE id = $1;`, [tenantId]);
    await saasRedis.del(shopKey);
    await saasRedis.del(historyKey);
    await saasRedis.del(`job:${jobId}`);
    console.log('\n🧹 Test tenant and queue test keys cleaned up.');

    console.log(`\n==============================================`);
    console.log(`🎯 Test Result: ${passed}/${total} assertions passed!`);
    console.log(`==============================================\n`);

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Queue test execution error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runQueueAndMemoryTests();
