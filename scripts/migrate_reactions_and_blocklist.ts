import { pool } from '../src/lib/db';

async function migrate() {
  console.log('--- Starting Reactions & Blocklist Migration ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create page_blocked_users table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS page_blocked_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        channel_id UUID NOT NULL,
        facebook_user_id TEXT NOT NULL,
        user_name TEXT,
        post_id TEXT,
        reason TEXT DEFAULT 'angry_bot',
        blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(tenant_id, facebook_user_id)
      );
    `);
    console.log('✓ Created page_blocked_users table');

    // 2. Add hide_reactions_internal and last_reaction_sync to facebook_posts
    await client.query(`
      ALTER TABLE facebook_posts 
      ADD COLUMN IF NOT EXISTS hide_reactions_internal BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS last_reaction_sync TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS reaction_summary JSONB DEFAULT '{}'::jsonb;
    `);
    console.log('✓ Added reaction fields to facebook_posts table');

    await client.query('COMMIT');
    console.log('--- Migration Completed Successfully ---');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
