-- ==============================================================================
-- SOCIAL COMMERCE AI SAAS — DATABASE RESET & MIGRATION SCRIPT
-- Drops legacy tables and provisions clean multi-tenant PostgreSQL schema
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. Drop Legacy Tables (Safe Cleanup)
DROP TABLE IF EXISTS "applications" CASCADE;
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "branches" CASCADE;
DROP TABLE IF EXISTS "call_logs" CASCADE;
DROP TABLE IF EXISTS "campaign_templates" CASCADE;
DROP TABLE IF EXISTS "document_vault" CASCADE;
DROP TABLE IF EXISTS "form_field_mappings" CASCADE;
DROP TABLE IF EXISTS "institutions" CASCADE;
DROP TABLE IF EXISTS "leads" CASCADE;
DROP TABLE IF EXISTS "ledger_entries" CASCADE;
DROP TABLE IF EXISTS "marketing_accounts" CASCADE;
DROP TABLE IF EXISTS "marketing_assets" CASCADE;
DROP TABLE IF EXISTS "marketing_campaigns" CASCADE;
DROP TABLE IF EXISTS "marketing_settings" CASCADE;
DROP TABLE IF EXISTS "mock_interview_sessions" CASCADE;
DROP TABLE IF EXISTS "omnichannel_messages" CASCADE;
DROP TABLE IF EXISTS "programs" CASCADE;
DROP TABLE IF EXISTS "student_profiles" CASCADE;
DROP TABLE IF EXISTS "sub_agents" CASCADE;
DROP TABLE IF EXISTS "webhook_dead_letter_queue" CASCADE;

-- Drop previous SaaS tables if re-running
DROP TABLE IF EXISTS "order_items" CASCADE;
DROP TABLE IF EXISTS "orders" CASCADE;
DROP TABLE IF EXISTS "messages" CASCADE;
DROP TABLE IF EXISTS "conversations" CASCADE;
DROP TABLE IF EXISTS "product_variants" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;
DROP TABLE IF EXISTS "faq_cache" CASCADE;
DROP TABLE IF EXISTS "automation_health_logs" CASCADE;
DROP TABLE IF EXISTS "channels" CASCADE;
DROP TABLE IF EXISTS "refresh_tokens" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "tenants" CASCADE;

-- 3. Tenants (Organizations / Stores)
CREATE TABLE "tenants" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) UNIQUE NOT NULL,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "phone" VARCHAR(20),
    "plan" VARCHAR(50) DEFAULT 'starter',
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Users (Store Owners & Staff)
CREATE TABLE "users" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "phone" VARCHAR(20) UNIQUE,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) DEFAULT 'admin',
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Refresh Tokens (JWT Rotation Security)
CREATE TABLE "refresh_tokens" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked" BOOLEAN DEFAULT FALSE,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Social Channels (Facebook, Instagram, WhatsApp)
CREATE TABLE "channels" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "platform" VARCHAR(50) NOT NULL, -- 'facebook', 'instagram', 'whatsapp'
    "channel_identifier" VARCHAR(255) NOT NULL, -- page_id or phone_number_id
    "channel_name" VARCHAR(255) NOT NULL,
    "access_token" TEXT,
    "ai_active" BOOLEAN DEFAULT TRUE,
    "webhook_verified" BOOLEAN DEFAULT TRUE,
    "quality_rating" VARCHAR(50) DEFAULT 'GREEN',
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_platform_channel UNIQUE ("platform", "channel_identifier")
);

-- 7. Automation Health & n8n Telemetry Logs
CREATE TABLE "automation_health_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "service" VARCHAR(50) DEFAULT 'n8n',
    "status" VARCHAR(50) NOT NULL, -- 'healthy', 'degraded', 'down'
    "latency_ms" INT DEFAULT 0,
    "error_message" TEXT,
    "checked_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Products Catalog (with pgvector for RAG)
CREATE TABLE "products" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "price" NUMERIC(10, 2) NOT NULL DEFAULT 0,
    "stock" INT NOT NULL DEFAULT 0,
    "sku" VARCHAR(100),
    "image_url" TEXT,
    "embedding" vector(1536),
    "is_active" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Product Variants (Sizes, Colors)
CREATE TABLE "product_variants" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "name" VARCHAR(100) NOT NULL,
    "sku" VARCHAR(100),
    "price_override" NUMERIC(10, 2),
    "stock" INT NOT NULL DEFAULT 0
);

-- 10. Conversations & Human Handoff (Takeover)
CREATE TABLE "conversations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "channel_id" UUID NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
    "customer_identifier" VARCHAR(255) NOT NULL, -- PSID or WhatsApp number
    "customer_name" VARCHAR(255),
    "customer_phone" VARCHAR(50),
    "ai_muted_until" TIMESTAMPTZ, -- if active, bot will NOT reply
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_customer_channel UNIQUE ("channel_id", "customer_identifier")
);

-- 11. Messages
CREATE TABLE "messages" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
    "sender_type" VARCHAR(50) NOT NULL, -- 'customer', 'ai', 'human_agent'
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Orders
CREATE TABLE "orders" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_number" VARCHAR(50) NOT NULL,
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "customer_name" VARCHAR(255) NOT NULL,
    "customer_phone" VARCHAR(50) NOT NULL,
    "delivery_address" TEXT NOT NULL,
    "delivery_city" VARCHAR(100) DEFAULT 'Dhaka',
    "delivery_fee" NUMERIC(10, 2) DEFAULT 80,
    "subtotal" NUMERIC(10, 2) NOT NULL DEFAULT 0,
    "total_amount" NUMERIC(10, 2) NOT NULL DEFAULT 0,
    "status" VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'
    "channel_id" UUID REFERENCES "channels"("id") ON DELETE SET NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Order Items
CREATE TABLE "order_items" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
    "product_id" UUID REFERENCES "products"("id") ON DELETE SET NULL,
    "product_title" VARCHAR(255) NOT NULL,
    "variant_title" VARCHAR(100),
    "unit_price" NUMERIC(10, 2) NOT NULL,
    "quantity" INT NOT NULL DEFAULT 1,
    "total_price" NUMERIC(10, 2) NOT NULL
);

-- 14. FAQ Cache (Zero-Token Instant Answers)
CREATE TABLE "faq_cache" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "question_pattern" TEXT NOT NULL,
    "answer_template" TEXT NOT NULL,
    "category" VARCHAR(100) DEFAULT 'general',
    "hit_count" INT DEFAULT 0,
    "is_active" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Create Performance Indexes
CREATE INDEX idx_users_email ON "users"("email");
CREATE INDEX idx_channels_tenant ON "channels"("tenant_id");
CREATE INDEX idx_products_tenant ON "products"("tenant_id");
CREATE INDEX idx_orders_tenant ON "orders"("tenant_id");
CREATE INDEX idx_orders_status ON "orders"("status");
CREATE INDEX idx_conversations_customer ON "conversations"("channel_id", "customer_identifier");
CREATE INDEX idx_faq_tenant ON "faq_cache"("tenant_id");
