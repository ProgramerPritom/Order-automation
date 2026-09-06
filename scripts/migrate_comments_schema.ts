import { pool, query } from '../src/lib/db';

async function migrateCommentsSchema() {
  console.log('🔄 Provisioning Facebook Posts & Comments Schema...');
  try {
    // 1. Facebook Posts table
    await query(`
      CREATE TABLE IF NOT EXISTS "facebook_posts" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "channel_id" UUID REFERENCES "channels"("id") ON DELETE CASCADE,
        "post_id" VARCHAR(255) NOT NULL,
        "message" TEXT,
        "media_url" TEXT,
        "permalink_url" TEXT,
        "comment_count" INT DEFAULT 0,
        "created_time" TIMESTAMPTZ DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_tenant_post UNIQUE ("tenant_id", "post_id")
      );
    `);

    // 2. Facebook Comments table
    await query(`
      CREATE TABLE IF NOT EXISTS "facebook_comments" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "channel_id" UUID REFERENCES "channels"("id") ON DELETE CASCADE,
        "post_id" VARCHAR(255) NOT NULL,
        "comment_id" VARCHAR(255) NOT NULL,
        "customer_name" VARCHAR(255),
        "customer_id" VARCHAR(255),
        "comment_text" TEXT NOT NULL,
        "ai_reply_text" TEXT,
        "ai_replied" BOOLEAN DEFAULT FALSE,
        "private_reply_sent" BOOLEAN DEFAULT FALSE,
        "created_at" TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_comment_identifier UNIQUE ("comment_id")
      );
    `);

    // 3. Performance Indexes
    await query(`
      CREATE INDEX IF NOT EXISTS idx_fb_posts_tenant ON "facebook_posts"("tenant_id");
      CREATE INDEX IF NOT EXISTS idx_fb_posts_post_id ON "facebook_posts"("post_id");
      CREATE INDEX IF NOT EXISTS idx_fb_comments_tenant ON "facebook_comments"("tenant_id");
      CREATE INDEX IF NOT EXISTS idx_fb_comments_post_id ON "facebook_comments"("post_id");
      CREATE INDEX IF NOT EXISTS idx_fb_comments_comment_id ON "facebook_comments"("comment_id");
    `);

    console.log('✅ Facebook Posts & Comments schema successfully migrated!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateCommentsSchema();
