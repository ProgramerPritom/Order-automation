import * as dotenv from 'dotenv';
dotenv.config();
import { query } from '../src/lib/db';

async function main() {
  const res = await query(`
    SELECT atttypmod 
    FROM pg_attribute 
    WHERE attrelid = 'products'::regclass AND attname = 'embedding';
  `);
  console.log('Embedding type mod:', res.rows);
  // In pgvector, atttypmod stores dimension
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
