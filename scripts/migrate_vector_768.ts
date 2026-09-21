import * as dotenv from 'dotenv';
dotenv.config();
import { query } from '../src/lib/db';

async function migrate() {
  console.log('🔄 Migrating products.embedding column from vector(1536) to vector(768)...');
  await query(`ALTER TABLE products ALTER COLUMN embedding TYPE vector(768);`);
  console.log('✅ Altered column successfully to vector(768)!');

  const res = await query(`
    SELECT atttypmod 
    FROM pg_attribute 
    WHERE attrelid = 'products'::regclass AND attname = 'embedding';
  `);
  console.log('New Embedding dimension:', res.rows[0].atttypmod);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
