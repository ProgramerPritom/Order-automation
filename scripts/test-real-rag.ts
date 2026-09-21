import * as dotenv from 'dotenv';
dotenv.config();

import { query } from '../src/lib/db';
import { generateProductVector, searchCatalogSemantic } from '../src/lib/embeddings';

async function testPhase2() {
  console.log('🧪 Starting Phase 2 DoD Self-Test: Real Dense Vector Embeddings & Semantic RAG...\n');

  // 1. Get or create test tenant
  let tenantRes = await query(`SELECT id FROM tenants LIMIT 1;`);
  let tenantId: string;

  if (tenantRes.rows.length === 0) {
    const t = await query(`
      INSERT INTO tenants (name, slug, email)
      VALUES ('RAG Test Shop', 'rag-test-${Date.now()}', 'rag-test-${Date.now()}@test.com')
      RETURNING id;
    `);
    tenantId = t.rows[0].id;
  } else {
    tenantId = tenantRes.rows[0].id;
  }
  console.log(`✅ Using Tenant ID: ${tenantId}`);

  // 2. Generate Real Embedding Vectors for Product A and Product B
  console.log('🔄 Generating real 768-dim Gemini vector for Product A (Montessori Math Board)...');
  const prodAVector = await generateProductVector({
    title: 'Wooden Montessori Counting Board',
    category: 'Educational Toys',
    description: 'বাচ্চাদের সংখ্যা গণনা, গণিত ও মোটর স্কিল ডেভেলপমেন্টের জন্য কাঠের খেলনা',
    rag_knowledge: '৩ থেকে ৬ বছরের শিশুদের জন্য উপযোগী। সম্পূর্ণ পরিবেশবান্ধব মেটেরিয়াল।',
  });

  console.log('🔄 Generating real 768-dim Gemini vector for Product B (Winter Romper)...');
  const prodBVector = await generateProductVector({
    title: 'Baby Fleece Winter Romper',
    category: 'Clothing',
    description: 'বাচ্চাদের শীতের নরম তুলতুলে আরামদায়ক জ্যাকেট ও প্যান্ট সেট',
    rag_knowledge: '০ থেকে ২ বছর বয়সী শিশুদের শীতের প্রটেকশন দেয়। ওয়াশেবল কটন ফেব্রিক।',
  });

  // 3. Insert into database
  const insertARes = await query(
    `INSERT INTO products (tenant_id, title, description, category, price, stock, sku, embedding, rag_knowledge)
     VALUES ($1, $2, $3, $4, 1450, 20, $5, $6::vector, $7)
     RETURNING id, title;`,
    [
      tenantId,
      `Wooden Montessori Board ${Date.now()}`,
      'বাচ্চাদের সংখ্যা গণনা ও গণিত শেখার বোর্ড',
      'Educational',
      `SKU-RAG-A-${Date.now().toString().slice(-4)}`,
      prodAVector,
      '৩-৬ বছরের বাচ্চাদের গণিত শিক্ষা ও ব্রেইন ডেভেলপমেন্ট।',
    ]
  );
  const prodA = insertARes.rows[0];

  const insertBRes = await query(
    `INSERT INTO products (tenant_id, title, description, category, price, stock, sku, embedding, rag_knowledge)
     VALUES ($1, $2, $3, $4, 850, 25, $5, $6::vector, $7)
     RETURNING id, title;`,
    [
      tenantId,
      `Baby Winter Warm Romper ${Date.now()}`,
      'বাচ্চাদের শীতের প্রিমিয়াম আরামদায়ক পোশাক',
      'Clothing',
      `SKU-RAG-B-${Date.now().toString().slice(-4)}`,
      prodBVector,
      '০-২ বছর বয়সের শীতের উষ্ণ কাপড়।',
    ]
  );
  const prodB = insertBRes.rows[0];

  console.log(`✅ Inserted Product A: ${prodA.title} (ID: ${prodA.id})`);
  console.log(`✅ Inserted Product B: ${prodB.title} (ID: ${prodB.id})`);

  // 4. Test Semantic Query 1 (Should match Product A)
  const query1 = 'বাচ্চাদের ম্যাথ ও বুদ্ধির বিকাশের জন্য কি খেলনা আছে?';
  console.log(`\n🔍 Executing Semantic Search for: "${query1}"...`);
  const results1 = await searchCatalogSemantic(tenantId, query1, 2);

  console.log('Top Search Results:');
  results1.forEach((r, idx) => {
    console.log(`  ${idx + 1}. ${r.title} | Similarity: ${r.similarity} | Cat: ${r.category}`);
  });

  if (results1.length === 0 || results1[0].id !== prodA.id) {
    throw new Error(`❌ Semantic search 1 failed: Expected Product A at top, but got ${results1[0]?.title}`);
  }
  console.log('✅ Semantic Search 1 PASSED: Product A ranked #1 with high cosine similarity!');

  // 5. Test Semantic Query 2 (Should match Product B)
  const query2 = 'শীতকালে পরার জন্য ছোট বাচ্চার কোনো গরম কাপড় হবে?';
  console.log(`\n🔍 Executing Semantic Search for: "${query2}"...`);
  const results2 = await searchCatalogSemantic(tenantId, query2, 2);

  console.log('Top Search Results:');
  results2.forEach((r, idx) => {
    console.log(`  ${idx + 1}. ${r.title} | Similarity: ${r.similarity} | Cat: ${r.category}`);
  });

  if (results2.length === 0 || results2[0].id !== prodB.id) {
    throw new Error(`❌ Semantic search 2 failed: Expected Product B at top, but got ${results2[0]?.title}`);
  }
  console.log('✅ Semantic Search 2 PASSED: Product B ranked #1 with high cosine similarity!');

  // 6. Cleanup test records
  await query(`DELETE FROM products WHERE id IN ($1, $2);`, [prodA.id, prodB.id]);
  console.log('✅ Cleaned up temporary test products from database.');

  console.log('\n=============================================');
  console.log('🎉 PHASE 2 DOD PASSED 100%: REAL RAG VECTOR ENGINE VERIFIED!');
  console.log('=============================================\n');
}

testPhase2()
  .then(() => {
    // Normal completion
  })
  .catch((err) => {
    console.error('❌ Phase 2 DoD Test Failed:', err);
    process.exit(1);
  });
