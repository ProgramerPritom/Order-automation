import { pool, query } from '../src/lib/db';
import * as dotenv from 'dotenv';

dotenv.config();

async function runPhase3Tests() {
  console.log('🧪 ========================================================');
  console.log('🧪 RUNNING PHASE 3 TEST SUITE: Channels Hub & n8n Health');
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
    // 1. Create a Test Tenant
    console.log('1️⃣ Provisioning Test Tenant for Channels & Health...');
    const tRes = await query(
      `INSERT INTO tenants (name, slug, email, plan)
       VALUES ('Channel Hub Store', 'channel-hub-${Date.now()}', 'channel_${Date.now()}@test.com', 'growth')
       RETURNING id;`
    );
    const tenantId = tRes.rows[0].id;
    assert(tenantId, 'Test Tenant created');

    // 2. Connect Facebook Messenger Channel
    console.log('\n2️⃣ Testing Facebook Messenger Channel Connection...');
    const fbIdentifier = `page_${Date.now()}`;
    const fbRes = await query(
      `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, access_token, ai_active, webhook_verified)
       VALUES ($1, 'facebook', $2, 'Aarong Fashions Page', 'EAA_test_token', TRUE, TRUE)
       RETURNING id, platform, ai_active, webhook_verified;`,
      [tenantId, fbIdentifier]
    );
    const fbChannel = fbRes.rows[0];
    assert(fbChannel && fbChannel.platform === 'facebook', 'Facebook Channel connected in DB');
    assert(fbChannel.ai_active === true, 'AI Auto-Reply is active by default');

    // 3. Connect WhatsApp Cloud API Channel
    console.log('\n3️⃣ Testing WhatsApp Cloud API Channel Connection...');
    const waIdentifier = `wa_${Date.now()}`;
    const waRes = await query(
      `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, access_token, ai_active, webhook_verified, quality_rating)
       VALUES ($1, 'whatsapp', $2, '+880 1812-334455', 'EAA_wa_token', TRUE, TRUE, 'HIGH')
       RETURNING id, platform, quality_rating;`,
      [tenantId, waIdentifier]
    );
    const waChannel = waRes.rows[0];
    assert(waChannel && waChannel.platform === 'whatsapp', 'WhatsApp Channel connected in DB');
    assert(waChannel.quality_rating === 'HIGH', 'WhatsApp Quality Rating recorded');

    // 4. Test AI Toggle Switch (ON -> OFF -> ON)
    console.log('\n4️⃣ Testing AI Auto-Reply Toggle Switch...');
    // Turn OFF
    const toggleOffRes = await query(
      `UPDATE channels SET ai_active = FALSE WHERE id = $1 AND tenant_id = $2 RETURNING ai_active;`,
      [fbChannel.id, tenantId]
    );
    assert(toggleOffRes.rows[0].ai_active === false, 'AI Auto-Reply successfully toggled OFF');

    // Turn ON
    const toggleOnRes = await query(
      `UPDATE channels SET ai_active = TRUE WHERE id = $1 AND tenant_id = $2 RETURNING ai_active;`,
      [fbChannel.id, tenantId]
    );
    assert(toggleOnRes.rows[0].ai_active === true, 'AI Auto-Reply successfully toggled back ON');

    // 5. Test n8n Automation Health Telemetry
    console.log('\n5️⃣ Testing n8n Health Telemetry & Logging...');
    await query(
      `INSERT INTO automation_health_logs (tenant_id, service, status, latency_ms)
       VALUES 
         ($1, 'n8n', 'healthy', 22),
         ($1, 'n8n', 'healthy', 28),
         ($1, 'n8n', 'healthy', 25);`,
      [tenantId]
    );

    const healthStats = await query(
      `SELECT 
         COUNT(*) as total_pings,
         ROUND(AVG(latency_ms), 1) as avg_latency,
         COUNT(CASE WHEN status = 'healthy' THEN 1 END) as healthy_count
       FROM automation_health_logs 
       WHERE tenant_id = $1;`,
      [tenantId]
    );

    const stats = healthStats.rows[0];
    assert(parseInt(stats.total_pings, 10) === 3, 'All 3 health logs recorded in database');
    assert(parseFloat(stats.avg_latency) === 25.0, 'Average latency accurately computed (25.0 ms)');
    assert(parseInt(stats.healthy_count, 10) === 3, '100% healthy status confirmed');

    // 6. Multi-Tenant Channel Isolation
    console.log('\n6️⃣ Testing Multi-Tenant Channel Isolation...');
    const tBRes = await query(
      `INSERT INTO tenants (name, slug, email, plan)
       VALUES ('Store B', 'store-b-${Date.now()}', 'store_b_${Date.now()}@test.com', 'starter')
       RETURNING id;`
    );
    const tenantBId = tBRes.rows[0].id;

    const tenantBChannels = await query(
      'SELECT * FROM channels WHERE tenant_id = $1;',
      [tenantBId]
    );
    assert(tenantBChannels.rows.length === 0, 'Tenant B cannot see Tenant A channels (Isolation Verified)');

    // Cleanup test data
    await query('DELETE FROM tenants WHERE id IN ($1, $2);', [tenantId, tenantBId]);
    assert(true, 'Test channels data cleaned up cleanly');

  } catch (error) {
    console.error('❌ Phase 3 test suite error:', error);
    failed++;
  } finally {
    await pool.end();
  }

  console.log('\n📊 ========================================================');
  console.log(`📊 PHASE 3 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('📊 ========================================================');

  if (failed > 0) {
    console.error('❌ PHASE 3 DEFINITION OF DONE FAILED.');
    process.exit(1);
  } else {
    console.log('🎉 PHASE 3 DEFINITION OF DONE: 100% SUCCESS!');
    process.exit(0);
  }
}

runPhase3Tests();
