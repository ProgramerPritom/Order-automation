import { pool, query } from '../src/lib/db';
import { processCustomerMessage } from '../src/lib/ai-sales-engine';

async function runNativeEngineTests() {
  console.log('🧪 Starting Native AI Sales Engine & Multi-Turn Memory Test Suite...\n');
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
    const testTenantSlug = `test-shop-${Date.now()}`;
    const tenantRes = await query(
      `INSERT INTO tenants (name, slug, email, about_shop, delivery_inside_dhaka, delivery_outside_dhaka)
       VALUES ('ঢাকা প্রিমিয়াম শপ', $1, $2, 'আমরা সেরা প্রিমিয়াম জুতা বিক্রি করি', 80, 150)
       RETURNING id;`,
      [testTenantSlug, `${testTenantSlug}@example.com`]
    );
    const tenantId = tenantRes.rows[0].id;
    assert(!!tenantId, 'Test Tenant created in PostgreSQL');

    // Create a product with initial stock 10
    const prodRes = await query(
      `INSERT INTO products (tenant_id, title, price, stock, sku, is_active)
       VALUES ($1, 'অরিজিনাল লেদার স্নিকার্স', 1250, 10, 'SNK-01', TRUE)
       RETURNING id, stock;`,
      [tenantId]
    );
    const productId = prodRes.rows[0].id;
    assert(!!productId, 'Test Product created with stock 10');

    // Create channel
    const channelIdGen = `chan_${Date.now()}`;
    const channelRes = await query(
      `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, access_token)
       VALUES ($1, 'facebook', $2, 'ঢাকা প্রিমিয়াম ফেসবুক পেজ', 'mock_token')
       RETURNING id;`,
      [tenantId, channelIdGen]
    );
    const channelId = channelRes.rows[0].id;
    assert(!!channelId, 'Test Channel created in PostgreSQL');

    const customerSenderId = `cust_${Date.now()}`;

    // 2. Multi-Turn Test: Turn 1 (Inquiry)
    console.log('\n--- Turn 1: Product Inquiry ---');
    const turn1Res = await processCustomerMessage({
      tenantId,
      channelId,
      pageId: channelIdGen,
      senderId: customerSenderId,
      customerName: 'আব্দুর রহিম',
      messageText: 'ভাইয়া আপনাদের অরিজিনাল লেদার স্নিকার্স কি এভেইলেবল আছে? দাম কত?',
      accessToken: 'mock_token',
    });

    assert(turn1Res.success, 'Turn 1 processed successfully');
    assert(!!turn1Res.replyText && turn1Res.replyText.length > 5, 'Turn 1 AI generated meaningful Bengali reply');
    assert(!turn1Res.orderCreated, 'Turn 1 did NOT create order (inquiry phase)');

    // Verify messages saved in DB
    const msgs1 = await query(
      `SELECT m.sender_type, m.content 
       FROM messages m 
       JOIN conversations c ON m.conversation_id = c.id 
       WHERE c.customer_identifier = $1 
       ORDER BY m.created_at ASC;`,
      [customerSenderId]
    );
    assert(msgs1.rows.length === 2, '2 messages stored in DB (1 customer + 1 AI)');

    // 3. Multi-Turn Test: Turn 2 (Order Placement with Context)
    console.log('\n--- Turn 2: Order Placement with Multi-Turn Memory ---');
    const turn2Res = await processCustomerMessage({
      tenantId,
      channelId,
      pageId: channelIdGen,
      senderId: customerSenderId,
      customerName: 'আব্দুর রহিম',
      messageText: 'হ্যাঁ ১ জোড়া দেন। নাম: আব্দুর রহিম, ফোন: 01712345678, ঠিকানা: বাড়ি ১২, রোড ৫, ধানমন্ডি, ঢাকা।',
      accessToken: 'mock_token',
    });

    assert(turn2Res.success, 'Turn 2 processed successfully');
    assert(!!turn2Res.orderCreated, 'Turn 2 AI detected and confirmed order');
    assert(!!turn2Res.orderNumber, `Order created with number: ${turn2Res.orderNumber}`);

    // Verify stock decremented
    const updatedProd = await query(`SELECT stock FROM products WHERE id = $1;`, [productId]);
    assert(updatedProd.rows[0].stock === 9, 'Product stock decremented from 10 to 9');

    // Verify order in database
    const orderInDb = await query(
      `SELECT customer_name, customer_phone, delivery_city, total_amount, status 
       FROM orders WHERE order_number = $1;`,
      [turn2Res.orderNumber]
    );
    assert(orderInDb.rows.length > 0, 'Order verified in PostgreSQL orders table');
    assert(orderInDb.rows[0].customer_phone === '01712345678', 'Customer phone accurately parsed');

    // 4. Test Human Takeover Muting Guard
    console.log('\n--- Test 3: Human Takeover Guard ---');
    // Mute AI for this conversation for 24 hours
    await query(
      `UPDATE conversations 
       SET ai_muted_until = NOW() + INTERVAL '24 hours' 
       WHERE customer_identifier = $1;`,
      [customerSenderId]
    );

    const turn3Res = await processCustomerMessage({
      tenantId,
      channelId,
      pageId: channelIdGen,
      senderId: customerSenderId,
      messageText: 'হ্যালো ভাইয়া?',
      accessToken: 'mock_token',
    });

    assert(turn3Res.success && turn3Res.isMuted === true, 'AI successfully silenced when human takeover is active');

    // 5. Cleanup test data
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

runNativeEngineTests();
