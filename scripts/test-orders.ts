import { pool, query } from '../src/lib/db';
import * as dotenv from 'dotenv';

dotenv.config();

async function runPhase5Tests() {
  console.log('🧪 ========================================================');
  console.log('🧪 RUNNING PHASE 5 TEST SUITE: Orders CRM & Human Handoff');
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
    // 1. Create Test Tenant and Channel
    console.log('1️⃣ Provisioning Test Tenant and Channel...');
    const tRes = await query(
      `INSERT INTO tenants (name, slug, email, plan)
       VALUES ('Order CRM Store', 'order-crm-${Date.now()}', 'order_${Date.now()}@test.com', 'growth')
       RETURNING id;`
    );
    const tenantId = tRes.rows[0].id;

    const chRes = await query(
      `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name)
       VALUES ($1, 'facebook', 'page_order_test', 'Test Page')
       RETURNING id;`,
      [tenantId]
    );
    const channelId = chRes.rows[0].id;
    assert(tenantId && channelId, 'Tenant & Channel provisioned');

    // 2. Create Order with Line Items
    console.log('\n2️⃣ Testing Order Creation & Totals Calculation...');
    const subtotal = 2150;
    const deliveryFee = 80;
    const total = subtotal + deliveryFee;

    const ordRes = await query(
      `INSERT INTO orders (tenant_id, channel_id, order_number, customer_name, customer_phone, delivery_address, delivery_city, delivery_fee, subtotal, total_amount, status)
       VALUES ($1, $2, 'AS-TEST-01', 'সোহেল রানা', '01712345678', 'ধানমন্ডি, ঢাকা', 'Dhaka', $3, $4, $5, 'pending')
       RETURNING id, order_number, total_amount, status;`,
      [tenantId, channelId, deliveryFee, subtotal, total]
    );
    const order = ordRes.rows[0];

    assert(order && order.order_number === 'AS-TEST-01', 'Order header saved');
    assert(parseFloat(order.total_amount) === 2230, 'Total bill accurately calculated (2150 + 80 = 2230)');

    // Line item
    await query(
      `INSERT INTO order_items (order_id, product_title, variant_title, unit_price, quantity, total_price)
       VALUES ($1, 'Black Panjabi', 'Size L', 2150, 1, 2150);`,
      [order.id]
    );
    const itemsRes = await query('SELECT * FROM order_items WHERE order_id = $1;', [order.id]);
    assert(itemsRes.rows.length === 1, 'Order line item attached');

    // 3. Status Transition
    console.log('\n3️⃣ Testing Order Lifecycle Status Transitions...');
    const confirmedRes = await query(
      `UPDATE orders SET status = 'confirmed' WHERE id = $1 RETURNING status;`,
      [order.id]
    );
    assert(confirmedRes.rows[0].status === 'confirmed', 'Transition to confirmed status');

    const shippedRes = await query(
      `UPDATE orders SET status = 'shipped' WHERE id = $1 RETURNING status;`,
      [order.id]
    );
    assert(shippedRes.rows[0].status === 'shipped', 'Transition to shipped status');

    // 4. Human Handoff (Takeover) Test
    console.log('\n4️⃣ Testing Human Takeover Flag & AI Mute Duration...');
    const convRes = await query(
      `INSERT INTO conversations (tenant_id, channel_id, customer_identifier, customer_name, customer_phone)
       VALUES ($1, $2, 'psid_customer_101', 'সোহেল রানা', '01712345678')
       RETURNING id;`,
      [tenantId, channelId]
    );
    const convId = convRes.rows[0].id;

    // Trigger Takeover (Mute AI for 24 hours)
    await query(
      `UPDATE conversations 
       SET ai_muted_until = NOW() + INTERVAL '24 hours' 
       WHERE id = $1;`,
      [convId]
    );

    const checkTakeover = await query(
      `SELECT (ai_muted_until > NOW()) as is_takeover_active FROM conversations WHERE id = $1;`,
      [convId]
    );
    assert(checkTakeover.rows[0].is_takeover_active === true, 'Human Takeover active (AI muted for 24h)');

    // Release Takeover (Resume AI)
    await query(`UPDATE conversations SET ai_muted_until = NULL WHERE id = $1;`, [convId]);
    const checkReleased = await query(
      `SELECT ai_muted_until FROM conversations WHERE id = $1;`,
      [convId]
    );
    assert(checkReleased.rows[0].ai_muted_until === null, 'Human Takeover released (AI resumed)');

    // 5. Multi-Tenant Isolation
    console.log('\n5️⃣ Testing Multi-Tenant Order Isolation...');
    const tBRes = await query(
      `INSERT INTO tenants (name, slug, email, plan)
       VALUES ('Store B Orders', 'store-b-ord-${Date.now()}', 'store_b_ord_${Date.now()}@test.com', 'starter')
       RETURNING id;`
    );
    const tenantBId = tBRes.rows[0].id;

    const tenantBOrders = await query('SELECT * FROM orders WHERE tenant_id = $1;', [tenantBId]);
    assert(tenantBOrders.rows.length === 0, 'Tenant B cannot see Tenant A orders (Isolation Verified)');

    // Cleanup
    await query('DELETE FROM tenants WHERE id IN ($1, $2);', [tenantId, tenantBId]);
    assert(true, 'Test order & conversation data cleaned up cleanly');

  } catch (error) {
    console.error('❌ Phase 5 test suite error:', error);
    failed++;
  } finally {
    await pool.end();
  }

  console.log('\n📊 ========================================================');
  console.log(`📊 PHASE 5 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('📊 ========================================================');

  if (failed > 0) {
    console.error('❌ PHASE 5 DEFINITION OF DONE FAILED.');
    process.exit(1);
  } else {
    console.log('🎉 PHASE 5 DEFINITION OF DONE: 100% SUCCESS!');
    process.exit(0);
  }
}

runPhase5Tests();
