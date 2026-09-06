import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DIRECT_URL or DATABASE_URL not set in environment.');
    process.exit(1);
  }

  console.log('🔄 Connecting to PostgreSQL database for migration...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully to Supabase Postgres.');

    const sqlPath = path.join(__dirname, '../db/reset_and_migrate.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🚀 Executing reset and migration script...');
    await client.query(sql);
    console.log('🎉 Migration script executed successfully!');

    // Verify created tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\n📋 Public Schema Tables in Database:');
    res.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.table_name}`);
    });

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
