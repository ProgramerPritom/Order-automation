import { config } from 'dotenv';
config();
import { query } from '../src/lib/db';
import { processMerchantWhatsAppMessage } from '../src/lib/whatsapp-merchant-copilot';

async function runTest() {
  console.log('🧪 Starting Phase 2 DoD Self-Test: Agentic Order Management Skills over WhatsApp...\n');

  // 1. Identify active tenant & owner
  const tenantRes = await query(
    `SELECT t.id as tenant_id, t.name as store_name, u.phone as user_phone, u.name as user_name
     FROM tenants t
     JOIN users u ON u.tenant_id = t.id
     WHERE u.phone IS NOT NULL AND u.phone != ''
     ORDER BY t.created_at ASC LIMIT 1;`
  );

  if (tenantRes.rows.length === 0) {
    throw new Error('No tenant with phone found in database!');
  }

  const { tenant_id: tenantId, store_name: storeName, user_phone: userPhone, user_name: userName } = tenantRes.rows[0];
  console.log(`✅ Identified Store: "${storeName}", Owner: "${userName}", Phone: ${userPhone}`);

  // 2. Insert test product with stock = 10
  const prodRes = await query(
    `INSERT INTO products (tenant_id, title, price, stock, sku, is_active)
     VALUES ($1, 'Test Montessori Board 9988', 1200, 10, 'SKU-9988', TRUE)
     RETURNING id, stock;`,
    [tenantId]
  );
  const productId = prodRes.rows[0].id;
  console.log(`✅ Provisioned Test Product: ID ${productId}, Initial Stock: 10`);

  // 3. Create a real test order in 'pending' status
  const testOrderNo = `KS-9988${Math.floor(10 + Math.random() * 89)}`;
  const orderRes = await query(
    `INSERT INTO orders (
       tenant_id, order_number, customer_name, customer_phone, delivery_address,
       delivery_city, delivery_fee, subtotal, total_amount, status, created_at
     ) VALUES ($1, $2, 'আরিফুল ইসলাম', '01755554433', 'বাসা ৪, রোড ২, মিরপুর ঢাকা', 'Dhaka', 80, 2400, 2480, 'pending', NOW())
     RETURNING id, order_number, status;`,
    [tenantId, testOrderNo]
  );
  const orderId = orderRes.rows[0].id;

  // Insert order item (2 units)
  await query(
    `INSERT INTO order_items (order_id, product_id, product_title, unit_price, quantity, total_price)
     VALUES ($1, $2, 'Test Montessori Board 9988', 1200, 2, 2400);`,
    [orderId, productId]
  );
  // Simulating inventory reduction upon order creation: stock 10 -> 8
  await query(`UPDATE products SET stock = 8 WHERE id = $1;`, [productId]);
  console.log(`✅ Provisioned Test Order #${testOrderNo} in 'pending' status, current stock: 8`);

  // 4. Test Lookup Action: "অর্ডার #KS-XXXX"
  console.log(`\n--- [ACTION 1: Lookup Order Details] ---`);
  const lookupQuery = `অর্ডার #${testOrderNo}`;
  console.log(`👤 Owner Query: "${lookupQuery}"`);
  const lookupRes = await processMerchantWhatsAppMessage(userPhone, lookupQuery);
  console.log('🤖 WhatsApp Copilot Reply:\n' + lookupRes.replyText);

  if (!lookupRes.replyText.includes(testOrderNo) || !lookupRes.replyText.includes('আরিফুল ইসলাম')) {
    throw new Error('Action 1 Failed: Lookup response does not contain order or customer name');
  }
  console.log('✅ Action 1 PASSED: Order details looked up accurately!');

  // 5. Test Confirm Action: "অর্ডার #KS-XXXX কনফার্ম করো"
  console.log(`\n--- [ACTION 2: Confirm Order] ---`);
  const confirmQuery = `অর্ডার #${testOrderNo} কনফার্ম করো`;
  console.log(`👤 Owner Action: "${confirmQuery}"`);
  const confirmRes = await processMerchantWhatsAppMessage(userPhone, confirmQuery);
  console.log('🤖 WhatsApp Copilot Reply:\n' + confirmRes.replyText);

  // Verify in DB
  const dbCheck1 = await query(`SELECT status FROM orders WHERE id = $1;`, [orderId]);
  if (dbCheck1.rows[0].status !== 'confirmed') {
    throw new Error(`Action 2 Failed: DB status is ${dbCheck1.rows[0].status}, expected 'confirmed'`);
  }
  console.log(`✅ Action 2 PASSED: Order #${testOrderNo} status updated to CONFIRMED in database!`);

  // 6. Test Ship Action: "কুরিয়ার #KS-XXXX"
  console.log(`\n--- [ACTION 3: Ship Order] ---`);
  const shipQuery = `কুরিয়ার #${testOrderNo}`;
  console.log(`👤 Owner Action: "${shipQuery}"`);
  const shipRes = await processMerchantWhatsAppMessage(userPhone, shipQuery);
  console.log('🤖 WhatsApp Copilot Reply:\n' + shipRes.replyText);

  // Verify in DB
  const dbCheck2 = await query(`SELECT status, courier_name, courier_status FROM orders WHERE id = $1;`, [orderId]);
  if (dbCheck2.rows[0].status !== 'shipped' || dbCheck2.rows[0].courier_status !== 'in_transit') {
    throw new Error(`Action 3 Failed: DB status is ${dbCheck2.rows[0].status}, expected 'shipped'`);
  }
  console.log(`✅ Action 3 PASSED: Order #${testOrderNo} status updated to SHIPPED (In-Transit) in database!`);

  // 7. Test Cancel Action: "বাতিল #KS-XXXX" & verify atomic stock restoration
  console.log(`\n--- [ACTION 4: Cancel Order & Restore Stock] ---`);
  const cancelQuery = `বাতিল #${testOrderNo}`;
  console.log(`👤 Owner Action: "${cancelQuery}"`);
  const cancelRes = await processMerchantWhatsAppMessage(userPhone, cancelQuery);
  console.log('🤖 WhatsApp Copilot Reply:\n' + cancelRes.replyText);

  // Verify in DB
  const dbCheck3 = await query(`SELECT status FROM orders WHERE id = $1;`, [orderId]);
  const prodCheck = await query(`SELECT stock FROM products WHERE id = $1;`, [productId]);

  if (dbCheck3.rows[0].status !== 'cancelled') {
    throw new Error(`Action 4 Failed: DB status is ${dbCheck3.rows[0].status}, expected 'cancelled'`);
  }
  if (prodCheck.rows[0].stock !== 10) {
    throw new Error(`Action 4 Failed: Product stock is ${prodCheck.rows[0].stock}, expected restored to 10`);
  }
  console.log(`✅ Action 4 PASSED: Order cancelled and stock restored to 10 in database!`);

  // 8. Clean up test records
  await query(`DELETE FROM order_items WHERE order_id = $1;`, [orderId]);
  await query(`DELETE FROM orders WHERE id = $1;`, [orderId]);
  await query(`DELETE FROM products WHERE id = $1;`, [productId]);
  console.log('\n✅ Cleaned up temporary test artifacts from database.');

  console.log('\n=============================================');
  console.log('🎉 PHASE 2 DOD PASSED 100%: AGENTIC ORDER MANAGEMENT SKILLS VERIFIED!');
  console.log('=============================================\n');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Phase 2 DoD Test Failed:', err);
  process.exit(1);
});
