import { pool, query } from '../src/lib/db';
import { searchCatalogSemantic } from '../src/lib/embeddings';

async function testChannelProductIsolation() {
  console.log('🧪 Starting Multi-Page & Multi-Tenant Product Isolation Test...\n');

  try {
    // 1. Get or create a test tenant
    const tenantRes = await query(`SELECT id FROM tenants LIMIT 1;`);
    if (tenantRes.rows.length === 0) {
      throw new Error('No tenant found in DB');
    }
    const tenantId = tenantRes.rows[0].id;

    // 2. Create 2 mock channels for this tenant
    const chan1Res = await query(`
      INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, access_token)
      VALUES ($1, 'facebook', 'mock_page_toy_101', 'Kids Toy World', 'mock_token_1')
      ON CONFLICT (platform, channel_identifier) DO UPDATE SET channel_name = EXCLUDED.channel_name
      RETURNING id;
    `, [tenantId]);
    const channel1Id = chan1Res.rows[0].id;

    const chan2Res = await query(`
      INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, access_token)
      VALUES ($1, 'facebook', 'mock_page_fashion_202', 'Elite Panjabi & Fashion', 'mock_token_2')
      ON CONFLICT (platform, channel_identifier) DO UPDATE SET channel_name = EXCLUDED.channel_name
      RETURNING id;
    `, [tenantId]);
    const channel2Id = chan2Res.rows[0].id;

    console.log(`✅ Provisioned 2 distinct channels for Tenant ${tenantId}:`);
    console.log(`   - Channel 1 (Toys): ${channel1Id}`);
    console.log(`   - Channel 2 (Fashion): ${channel2Id}\n`);

    // 3. Create products: 1 for Channel 1, 1 for Channel 2, 1 Global
    const p1 = await query(`
      INSERT INTO products (tenant_id, channel_id, title, category, price, stock, description, rag_knowledge)
      VALUES ($1, $2, 'Montessori Wooden Building Blocks', 'Toys', 1450, 20, 'বাচ্চাদের ক্রিয়েটিভ খেলনা', '৩ থেকে ৮ বছর বয়সীদের ব্রেন ডেভেলপমেন্টের জন্য উপযুক্ত।')
      RETURNING id, title;
    `, [tenantId, channel1Id]);

    const p2 = await query(`
      INSERT INTO products (tenant_id, channel_id, title, category, price, stock, description, rag_knowledge)
      VALUES ($1, $2, 'Premium Silk Embroidered Panjabi', 'Fashion', 3200, 15, 'ঈদ কালেকশন প্রিমিয়াম পাঞ্জাবি', '১০০% পিওর সিল্ক ও হাতের কাজের এমব্রয়ডারি।')
      RETURNING id, title;
    `, [tenantId, channel2Id]);

    const p3 = await query(`
      INSERT INTO products (tenant_id, channel_id, title, category, price, stock, description, rag_knowledge)
      VALUES ($1, NULL, 'Universal Gift Box Packaging', 'Packaging', 150, 100, 'সকল পণ্যের সাথে গিফট বক্স', 'প্রিমিয়াম প্যাকেজিং।')
      RETURNING id, title;
    `, [tenantId]);

    console.log('✅ Created 3 test products:');
    console.log(`   1. [Channel 1 Only]: ${p1.rows[0].title} (ID: ${p1.rows[0].id})`);
    console.log(`   2. [Channel 2 Only]: ${p2.rows[0].title} (ID: ${p2.rows[0].id})`);
    console.log(`   3. [Global - All Channels]: ${p3.rows[0].title} (ID: ${p3.rows[0].id})\n`);

    // 4. Test Query for Channel 1 (Toys Page)
    const ch1Products = await query(`
      SELECT id, title, channel_id FROM products 
      WHERE tenant_id = $1 AND (channel_id IS NULL OR channel_id = $2)
      ORDER BY created_at DESC;
    `, [tenantId, channel1Id]);

    const ch1Titles = ch1Products.rows.map(r => r.title);
    console.log('🔍 Channel 1 (Toys) query results:', ch1Titles);

    const ch1HasToy = ch1Titles.includes('Montessori Wooden Building Blocks');
    const ch1HasGlobal = ch1Titles.includes('Universal Gift Box Packaging');
    const ch1HasPanjabi = ch1Titles.includes('Premium Silk Embroidered Panjabi');

    if (ch1HasToy && ch1HasGlobal && !ch1HasPanjabi) {
      console.log('✅ PASSED: Channel 1 correctly retrieved Toy & Global products, and EXCLUDED Fashion Panjabi!');
    } else {
      throw new Error(`FAILED: Channel 1 leakage detected! (Toy: ${ch1HasToy}, Global: ${ch1HasGlobal}, Panjabi: ${ch1HasPanjabi})`);
    }

    // 5. Test Query for Channel 2 (Fashion Page)
    const ch2Products = await query(`
      SELECT id, title, channel_id FROM products 
      WHERE tenant_id = $1 AND (channel_id IS NULL OR channel_id = $2)
      ORDER BY created_at DESC;
    `, [tenantId, channel2Id]);

    const ch2Titles = ch2Products.rows.map(r => r.title);
    console.log('🔍 Channel 2 (Fashion) query results:', ch2Titles);

    const ch2HasToy = ch2Titles.includes('Montessori Wooden Building Blocks');
    const ch2HasGlobal = ch2Titles.includes('Universal Gift Box Packaging');
    const ch2HasPanjabi = ch2Titles.includes('Premium Silk Embroidered Panjabi');

    if (ch2HasPanjabi && ch2HasGlobal && !ch2HasToy) {
      console.log('✅ PASSED: Channel 2 correctly retrieved Fashion & Global products, and EXCLUDED Toy Blocks!');
    } else {
      throw new Error(`FAILED: Channel 2 leakage detected! (Toy: ${ch2HasToy}, Global: ${ch2HasGlobal}, Panjabi: ${ch2HasPanjabi})`);
    }

    // 6. Test Semantic Search with Channel Scoping
    console.log('\n🔍 Testing semantic/text RAG search with channel scoping...');
    const ragCh1 = await searchCatalogSemantic(tenantId, 'পাঞ্জাবি আছে কি?', 5, channel1Id);
    console.log('   RAG search for "পাঞ্জাবি" on Channel 1 (Toys):', ragCh1.map(r => r.title));
    const ch1FoundPanjabi = ragCh1.some(r => r.title.includes('Panjabi'));
    if (!ch1FoundPanjabi) {
      console.log('✅ PASSED: Semantic search on Toys channel did NOT leak Fashion Panjabi!');
    } else {
      throw new Error('FAILED: Semantic search on Channel 1 leaked Panjabi from Channel 2!');
    }

    // Clean up test records
    await query(`DELETE FROM products WHERE id IN ($1, $2, $3);`, [p1.rows[0].id, p2.rows[0].id, p3.rows[0].id]);
    await query(`DELETE FROM channels WHERE id IN ($1, $2);`, [channel1Id, channel2Id]);
    console.log('\n🧹 Cleaned up test records successfully.');
    console.log('🎉 ALL MULTI-PAGE CHANNEL ISOLATION TESTS PASSED 100%!\n');

    process.exit(0);
  } catch (err: any) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testChannelProductIsolation();
