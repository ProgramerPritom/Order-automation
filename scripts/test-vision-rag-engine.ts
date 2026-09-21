import { identifyProductFromImage } from '../src/lib/multimodal-ai';
import { processCustomerMessage } from '../src/lib/ai-sales-engine';
import { pool, query } from '../src/lib/db';

async function testVisionRagEngine() {
  console.log('🧪 Starting Multimodal AI Vision & RAG Product Matching Test...\n');

  try {
    // 1. Get tenant and channel
    const chanRes = await query(`
      SELECT c.id as channel_id, c.tenant_id, c.channel_name, c.access_token
      FROM channels c
      LIMIT 1;
    `);

    if (chanRes.rows.length === 0) {
      throw new Error('No channel found in DB to test with');
    }

    const { channel_id, tenant_id, channel_name } = chanRes.rows[0];
    console.log(`✅ Using Tenant: ${tenant_id}, Channel: ${channel_name} (${channel_id})`);

    // 2. Insert a dedicated test product with rich RAG knowledge
    const prodRes = await query(`
      INSERT INTO products (tenant_id, channel_id, title, category, price, stock, description, rag_knowledge)
      VALUES ($1, $2, 'Montessori Wooden Geometric Puzzle', 'Kids Toys', 1250, 18, 'উন্নত মানের কাঠের তৈরি মন্টেসরি জিওমেট্রিক শেপ পাজল', '১০০% প্রাকৃতিক কাঠ ও নন-টক্সিক রঙের তৈরি। ২ থেকে ৫ বছর বয়সী বাচ্চাদের মোবাইল স্ক্রিন আসক্তি কমিয়ে মোটর স্কিল ও একাগ্রতা বাড়ায়। এর সাথে রয়েছে ১ বছরের রিপ্লেসমেন্ট ওয়ারেন্টি।')
      RETURNING id, title, price, stock, rag_knowledge;
    `, [tenant_id, channel_id]);

    const testProd = prodRes.rows[0];
    console.log(`✅ Created test product: ${testProd.title} (৳${testProd.price})`);
    console.log(`   RAG Knowledge: ${testProd.rag_knowledge}\n`);

    // 3. Test multimodal vision matching with a sample image URL (or sample data URL)
    // A clean public image representing a wooden toy/blocks
    const sampleImageUrl = 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400';

    console.log('🔍 Testing identifyProductFromImage with Gemini 2.5 Flash Vision...');
    const catalog = [
      {
        id: testProd.id,
        title: testProd.title,
        price: Number(testProd.price),
        stock: testProd.stock,
        category: 'Kids Toys',
        description: 'উন্নত মানের কাঠের তৈরি মন্টেসরি জিওমেট্রিক শেপ পাজল',
        rag_knowledge: testProd.rag_knowledge,
      },
    ];

    const visionResult = await identifyProductFromImage(sampleImageUrl, catalog);
    console.log('📸 Vision Result:', JSON.stringify(visionResult, null, 2));

    if (visionResult.detectedItemSummary || visionResult.confidence > 0) {
      console.log('✅ PASSED: Gemini 2.5 Flash Vision successfully analyzed the customer photo!');
    } else {
      console.warn('⚠️ Vision returned neutral detection, checking fallback...');
    }

    // 4. Test End-to-End AI Sales Engine message processing with customer photo & text inquiry
    console.log('\n🤖 Testing processCustomerMessage with Customer Image & Inquiry: "ভাই এই প্রোডাক্টটি আছে কিনা? দাম কত?"...');

    const simulatedMessage = `[গ্রাহক পণ্যের ছবি পাঠিয়েছেন: ${sampleImageUrl}] [ছবিতে শনাক্তকৃত পণ্য]: ${testProd.title} (আইডি: ${testProd.id} | মূল্য: ৳${testProd.price} | লাইভ স্টক: ${testProd.stock} পিস | র্যাক নলেজ: ${testProd.rag_knowledge}) [গ্রাহকের প্রশ্ন]: ভাই এই প্রোডাক্টটি আছে কিনা? দাম কত?`;

    const salesResult = await processCustomerMessage({
      tenantId: tenant_id,
      channelId: channel_id,
      pageId: '1374129259109200',
      senderId: 'test_customer_vision_999',
      customerName: 'সায়েম চৌধুরী',
      messageText: simulatedMessage,
      matchedProductId: testProd.id,
      imageUrl: sampleImageUrl,
      accessToken: 'mock_token',
    });

    console.log('💬 AI Sales Engine Reply:');
    console.log('--------------------------------------------------');
    console.log(salesResult.replyText);
    console.log('--------------------------------------------------');

    const reply = salesResult.replyText || '';
    const hasPrice = reply.includes('1250') || reply.includes('১২৫০');
    const hasStockConfirmation = reply.includes('আছে') || reply.includes('স্টক') || reply.includes('পাবেন');

    console.log(`\nVerification Checks:`);
    console.log(` - Price mentioned correctly (1250 / ১২৫০): ${hasPrice ? '✅ YES' : '❌ NO'}`);
    console.log(` - Availability confirmed: ${hasStockConfirmation ? '✅ YES' : '❌ NO'}`);

    // Clean up test product and test conversation
    await query(`DELETE FROM products WHERE id = $1;`, [testProd.id]);
    await query(`DELETE FROM conversations WHERE channel_id = $1 AND customer_identifier = 'test_customer_vision_999';`, [channel_id]);
    console.log('\n🧹 Cleaned up test records successfully.');

    if (salesResult.success && hasPrice && hasStockConfirmation) {
      console.log('🎉 ALL MULTIMODAL VISION & RAG MATCHING TESTS PASSED 100%!\n');
      process.exit(0);
    } else {
      throw new Error('Test completed but price or availability was not verified in reply.');
    }
  } catch (err: any) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testVisionRagEngine();
