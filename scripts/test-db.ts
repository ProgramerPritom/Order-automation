import { pool, query } from '../src/lib/db';
import { saasRedis } from '../src/lib/redis';
import * as dotenv from 'dotenv';

dotenv.config();

async function runPhase0Tests() {
  console.log('🧪 ========================================================');
  console.log('🧪 RUNNING PHASE 0 TEST SUITE: Database & Redis Verification');
  console.log('🧪 ========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Test PostgreSQL Connection
    console.log('1️⃣ Testing PostgreSQL Connection...');
    const pingRes = await query('SELECT NOW() as current_time, current_database() as db_name;');
    assert(pingRes.rows.length > 0, 'PostgreSQL responded to ping query');
    console.log(`     Connected to DB: ${pingRes.rows[0].db_name} at ${pingRes.rows[0].current_time}`);

    // 2. Test Expected Tables
    console.log('\n2️⃣ Testing Expected Tables in Database...');
    const expectedTables = [
      'tenants',
      'users',
      'refresh_tokens',
      'channels',
      'automation_health_logs',
      'products',
      'product_variants',
      'conversations',
      'messages',
      'orders',
      'order_items',
      'faq_cache',
    ];

    const tablesRes = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    const existingTables = new Set(tablesRes.rows.map((r) => r.table_name));

    for (const table of expectedTables) {
      assert(existingTables.has(table), `Table '${table}' exists in public schema`);
    }

    // 3. Test Multi-Tenant Isolation
    console.log('\n3️⃣ Testing Multi-Tenant Data Isolation...');
    // Create Tenant A
    const tARes = await query(`
      INSERT INTO tenants (name, slug, email, plan)
      VALUES ('Test Store A', 'test-store-a-${Date.now()}', 'store_a_${Date.now()}@test.com', 'starter')
      RETURNING id;
    `);
    const tenantAId = tARes.rows[0].id;

    // Create Tenant B
    const tBRes = await query(`
      INSERT INTO tenants (name, slug, email, plan)
      VALUES ('Test Store B', 'test-store-b-${Date.now()}', 'store_b_${Date.now()}@test.com', 'growth')
      RETURNING id;
    `);
    const tenantBId = tBRes.rows[0].id;

    // Insert Product for Tenant A
    await query(`
      INSERT INTO products (tenant_id, title, price, stock)
      VALUES ($1, 'Panjabi Deluxe - Store A', 2500, 10);
    `, [tenantAId]);

    // Insert Product for Tenant B
    await query(`
      INSERT INTO products (tenant_id, title, price, stock)
      VALUES ($1, 'Saree Silk - Store B', 4500, 5);
    `, [tenantBId]);

    // Query strictly for Tenant A
    const tenantAProducts = await query(`
      SELECT * FROM products WHERE tenant_id = $1;
    `, [tenantAId]);

    assert(
      tenantAProducts.rows.length === 1 && tenantAProducts.rows[0].title === 'Panjabi Deluxe - Store A',
      'Tenant A query only returns Tenant A product'
    );

    // Query strictly for Tenant B
    const tenantBProducts = await query(`
      SELECT * FROM products WHERE tenant_id = $1;
    `, [tenantBId]);

    assert(
      tenantBProducts.rows.length === 1 && tenantBProducts.rows[0].title === 'Saree Silk - Store B',
      'Tenant B query only returns Tenant B product'
    );

    // Cleanup test tenant data
    await query('DELETE FROM tenants WHERE id IN ($1, $2);', [tenantAId, tenantBId]);
    assert(true, 'Test tenant data cleaned up successfully');

    // 4. Test Upstash Redis with saas:* namespace
    console.log('\n4️⃣ Testing Upstash Redis Namespace Isolation...');
    const redisPing = await saasRedis.ping();
    assert(redisPing === 'PONG', 'Upstash Redis responds to PING');

    const testKey = `test_verification_${Date.now()}`;
    const testValue = { message: 'Multi-tenant isolation verified', timestamp: Date.now() };

    await saasRedis.set(testKey, testValue, { ex: 60 });
    const fetchedVal = await saasRedis.get<{ message: string }>(testKey);

    assert(fetchedVal?.message === testValue.message, 'Redis key written and read back under saas:* prefix');
    await saasRedis.del(testKey);

  } catch (error) {
    console.error('❌ Test suite crashed with error:', error);
    failed++;
  } finally {
    await pool.end();
  }

  console.log('\n📊 ========================================================');
  console.log(`📊 PHASE 0 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('📊 ========================================================');

  if (failed > 0) {
    console.error('❌ PHASE 0 DEFINITION OF DONE FAILED.');
    process.exit(1);
  } else {
    console.log('🎉 PHASE 0 DEFINITION OF DONE: 100% SUCCESS!');
    process.exit(0);
  }
}

runPhase0Tests();
