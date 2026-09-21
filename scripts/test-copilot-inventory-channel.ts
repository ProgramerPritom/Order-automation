import { config } from 'dotenv';
config();
import { query } from '../src/lib/db';
import { processMerchantWhatsAppMessage } from '../src/lib/whatsapp-merchant-copilot';

async function runTest() {
  console.log('🧪 Starting Phase 3 DoD Self-Test: Inventory Stock & Channel Automation Control Skills...\n');

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

  // 2. Insert test product with initial stock = 5
  const prodRes = await query(
    `INSERT INTO products (tenant_id, title, price, stock, sku, is_active)
     VALUES ($1, 'Montessori Magic Board 7766', 1500, 5, 'SKU-7766', TRUE)
     RETURNING id, stock;`,
    [tenantId]
  );
  const productId = prodRes.rows[0].id;
  console.log(`✅ Provisioned Test Product: ID ${productId}, Initial Stock: 5`);

  // Ensure Facebook channel exists
  let channelRes = await query(`SELECT id, ai_active FROM channels WHERE tenant_id = $1 AND platform = 'facebook' LIMIT 1;`, [tenantId]);
  let channelId: string;
  if (channelRes.rows.length > 0) {
    channelId = channelRes.rows[0].id;
  } else {
    const newChan = await query(
      `INSERT INTO channels (tenant_id, platform, channel_name, channel_identifier, ai_active)
       VALUES ($1, 'facebook', 'Test Shop Page', 'test_page_101', TRUE) RETURNING id;`,
      [tenantId]
    );
    channelId = newChan.rows[0].id;
  }

  // 3. Test Action 1: Update Product Stock via WhatsApp
  console.log(`\n--- [ACTION 1: Update Product Stock via WhatsApp] ---`);
  const stockMsg = 'Montessori Magic Board 7766 এর স্টক 25 পিস করো';
  console.log(`👤 Owner Message: "${stockMsg}"`);
  const stockRes = await processMerchantWhatsAppMessage(userPhone, stockMsg);
  console.log('🤖 WhatsApp Copilot Reply:\n' + stockRes.replyText);

  // Verify in PostgreSQL
  const dbProd = await query(`SELECT stock FROM products WHERE id = $1;`, [productId]);
  if (dbProd.rows[0].stock !== 25) {
    throw new Error(`Action 1 Failed: DB stock is ${dbProd.rows[0].stock}, expected 25`);
  }
  console.log(`✅ Action 1 PASSED: Product stock successfully updated to 25 in database!`);

  // 4. Test Action 2: Disable Facebook AI Bot via WhatsApp
  console.log(`\n--- [ACTION 2: Disable AI Bot via WhatsApp] ---`);
  const disableMsg = 'ফেসবুক বট বন্ধ করো';
  console.log(`👤 Owner Message: "${disableMsg}"`);
  const disableRes = await processMerchantWhatsAppMessage(userPhone, disableMsg);
  console.log('🤖 WhatsApp Copilot Reply:\n' + disableRes.replyText);

  // Verify in PostgreSQL
  const dbChan1 = await query(`SELECT ai_active FROM channels WHERE id = $1;`, [channelId]);
  if (dbChan1.rows[0].ai_active !== false) {
    throw new Error(`Action 2 Failed: Channel ai_active is ${dbChan1.rows[0].ai_active}, expected false`);
  }
  console.log(`✅ Action 2 PASSED: Facebook Channel AI active is now FALSE in database!`);

  // 5. Test Action 3: Enable Facebook AI Bot via WhatsApp
  console.log(`\n--- [ACTION 3: Enable AI Bot via WhatsApp] ---`);
  const enableMsg = 'ফেসবুক বট চালু করো';
  console.log(`👤 Owner Message: "${enableMsg}"`);
  const enableRes = await processMerchantWhatsAppMessage(userPhone, enableMsg);
  console.log('🤖 WhatsApp Copilot Reply:\n' + enableRes.replyText);

  // Verify in PostgreSQL
  const dbChan2 = await query(`SELECT ai_active FROM channels WHERE id = $1;`, [channelId]);
  if (dbChan2.rows[0].ai_active !== true) {
    throw new Error(`Action 3 Failed: Channel ai_active is ${dbChan2.rows[0].ai_active}, expected true`);
  }
  console.log(`✅ Action 3 PASSED: Facebook Channel AI active is now TRUE in database!`);

  // 6. Test Action 4: Mute AI / Human Takeover for a Customer
  console.log(`\n--- [ACTION 4: Human Takeover / Mute Customer via WhatsApp] ---`);
  const testPhone = '01799887766';
  const convRes = await query(
    `INSERT INTO conversations (tenant_id, channel_id, customer_identifier, customer_name, customer_phone)
     VALUES ($1, $2, $3, 'ফারহানা ইয়াসমিন', $4) RETURNING id;`,
    [tenantId, channelId, `psid_${testPhone}`, testPhone]
  );
  const convId = convRes.rows[0].id;

  const takeoverMsg = `টেকওভার ${testPhone}`;
  console.log(`👤 Owner Message: "${takeoverMsg}"`);
  const takeoverRes = await processMerchantWhatsAppMessage(userPhone, takeoverMsg);
  console.log('🤖 WhatsApp Copilot Reply:\n' + takeoverRes.replyText);

  // Verify in PostgreSQL
  const dbConv = await query(`SELECT ai_muted_until FROM conversations WHERE id = $1;`, [convId]);
  const mutedUntil = dbConv.rows[0].ai_muted_until;
  if (!mutedUntil || new Date(mutedUntil).getTime() <= Date.now()) {
    throw new Error(`Action 4 Failed: ai_muted_until is not set to future date: ${mutedUntil}`);
  }
  console.log(`✅ Action 4 PASSED: AI Muted until ${mutedUntil} in database!`);

  // 7. Clean up test records
  await query(`DELETE FROM conversations WHERE id = $1;`, [convId]);
  await query(`DELETE FROM products WHERE id = $1;`, [productId]);
  console.log('\n✅ Cleaned up temporary test artifacts from database.');

  console.log('\n=============================================');
  console.log('🎉 PHASE 3 DOD PASSED 100%: INVENTORY & CHANNEL CONTROL SKILLS VERIFIED!');
  console.log('=============================================\n');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Phase 3 DoD Test Failed:', err);
  process.exit(1);
});
