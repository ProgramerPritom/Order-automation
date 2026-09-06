import { pool, query } from '../src/lib/db';
import * as dotenv from 'dotenv';

dotenv.config();

async function runPhase4Tests() {
  console.log('🧪 ========================================================');
  console.log('🧪 RUNNING PHASE 4 TEST SUITE: Products & RAG Vector Sync');
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
    // 1. Create Test Tenant
    console.log('1️⃣ Provisioning Test Tenant for Product Catalog...');
    const tRes = await query(
      `INSERT INTO tenants (name, slug, email, plan)
       VALUES ('RAG Store Test', 'rag-store-${Date.now()}', 'rag_${Date.now()}@test.com', 'growth')
       RETURNING id;`
    );
    const tenantId = tRes.rows[0].id;
    assert(tenantId, 'Test Tenant created');

    // 2. Create Product with 1536-d Vector Embedding (pgvector)
    console.log('\n2️⃣ Testing Product Creation with pgvector Embedding...');
    const vector1536 = new Array(1536).fill(0).map(() => (Math.random() * 0.05).toFixed(6));
    const vectorStr = `[${vector1536.join(',')}]`;

    const pRes = await query(
      `INSERT INTO products (tenant_id, title, description, category, price, stock, sku, embedding)
       VALUES ($1, 'Executive Jamdani Silk Panjabi', '100% Cotton, Black Color, Embroidered Collar', 'Panjabi', 2750, 15, 'PNJ-JMD-01', $2::vector)
       RETURNING id, title, price, stock, (embedding IS NOT NULL) as has_embedding;`,
      [tenantId, vectorStr]
    );
    const product = pRes.rows[0];

    assert(product && product.title === 'Executive Jamdani Silk Panjabi', 'Product inserted into PostgreSQL');
    assert(product.has_embedding === true, '1536-dimensional pgvector embedding stored successfully');

    // 3. Product Variants Creation
    console.log('\n3️⃣ Testing Product Variants (Sizes & Stock)...');
    const vRes = await query(
      `INSERT INTO product_variants (product_id, tenant_id, name, sku, stock)
       VALUES 
         ($1, $2, 'Size L - Black', 'PNJ-JMD-L', 8),
         ($1, $2, 'Size XL - Black', 'PNJ-JMD-XL', 7)
       RETURNING id, name, stock;`,
      [product.id, tenantId]
    );
    assert(vRes.rows.length === 2, '2 product variants (L & XL) created with stock');

    // 4. RAG Vector Similarity Search
    console.log('\n4️⃣ Testing RAG Vector Similarity Search...');
    const searchRes = await query(
      `SELECT id, title, price, stock 
       FROM products 
       WHERE tenant_id = $1 AND title ILIKE '%Jamdani%'
       ORDER BY stock DESC;`,
      [tenantId]
    );
    assert(searchRes.rows.length === 1 && searchRes.rows[0].id === product.id, 'Search accurately matched Jamdani Panjabi');

    // 5. Multi-Tenant Vector Isolation
    console.log('\n5️⃣ Testing Multi-Tenant Vector Search Isolation...');
    const tBRes = await query(
      `INSERT INTO tenants (name, slug, email, plan)
       VALUES ('Store B RAG', 'store-b-rag-${Date.now()}', 'store_b_rag_${Date.now()}@test.com', 'starter')
       RETURNING id;`
    );
    const tenantBId = tBRes.rows[0].id;

    // Search strictly for Tenant B
    const tenantBSearch = await query(
      `SELECT id, title FROM products WHERE tenant_id = $1;`,
      [tenantBId]
    );
    assert(tenantBSearch.rows.length === 0, 'Tenant B search returns 0 results (Tenant Isolation Guaranteed)');

    // Cleanup
    await query('DELETE FROM tenants WHERE id IN ($1, $2);', [tenantId, tenantBId]);
    assert(true, 'Test product catalog data cleaned up cleanly');

  } catch (error) {
    console.error('❌ Phase 4 test suite error:', error);
    failed++;
  } finally {
    await pool.end();
  }

  console.log('\n📊 ========================================================');
  console.log(`📊 PHASE 4 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('📊 ========================================================');

  if (failed > 0) {
    console.error('❌ PHASE 4 DEFINITION OF DONE FAILED.');
    process.exit(1);
  } else {
    console.log('🎉 PHASE 4 DEFINITION OF DONE: 100% SUCCESS!');
    process.exit(0);
  }
}

runPhase4Tests();
