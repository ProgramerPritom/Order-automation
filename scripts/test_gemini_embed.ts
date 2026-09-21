import * as dotenv from 'dotenv';
dotenv.config();

async function testGeminiEmbedding() {
  const apiKey = process.env.GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: {
        parts: [{ text: 'বাচ্চাদের খেলনা ও কাঠের ব্রেইন ডেভেলপমেন্ট পাজল' }],
      },
      outputDimensionality: 768,
    }),
  });

  const data = await res.json();
  if (data.embedding && data.embedding.values) {
    console.log('✅ Gemini Embedding Success! Dimension:', data.embedding.values.length);
    console.log('Sample values (first 5):', data.embedding.values.slice(0, 5));
  } else {
    console.error('❌ Embedding failed:', data);
    process.exit(1);
  }
  process.exit(0);
}

testGeminiEmbedding().catch((err) => {
  console.error(err);
  process.exit(1);
});
