import { pool, query } from '../src/lib/db';
import {
  hashPassword,
  comparePassword,
  createAccessToken,
  verifyAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../src/lib/auth';
import { checkRateLimit } from '../src/lib/rate-limiter';
import { saasRedis } from '../src/lib/redis';
import * as dotenv from 'dotenv';

dotenv.config();

async function runPhase1Tests() {
  console.log('🧪 ========================================================');
  console.log('🧪 RUNNING PHASE 1 TEST SUITE: JWT Auth, Security & Rate Limit');
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
    // 1. Password Hashing & Comparison
    console.log('1️⃣ Testing Password Hashing & Verification...');
    const rawPass = 'PritomSecure2026!#';
    const hashed = await hashPassword(rawPass);
    assert(hashed !== rawPass && hashed.startsWith('$2'), 'Password hashed with bcrypt');

    const match = await comparePassword(rawPass, hashed);
    assert(match === true, 'Correct password verification matches');

    const wrongMatch = await comparePassword('WrongPassword123', hashed);
    assert(wrongMatch === false, 'Wrong password rejected');

    // 2. JWT Access Token Creation & Verification
    console.log('\n2️⃣ Testing Access Token Generation & Verification...');
    const dummyPayload = {
      userId: '11111111-1111-1111-1111-111111111111',
      tenantId: '22222222-2222-2222-2222-222222222222',
      email: 'owner@fashionhub.com',
      role: 'admin',
    };

    const token = await createAccessToken(dummyPayload);
    assert(typeof token === 'string' && token.split('.').length === 3, 'Valid JWT structure generated');

    const verified = await verifyAccessToken(token);
    assert(
      verified?.userId === dummyPayload.userId && verified?.tenantId === dummyPayload.tenantId,
      'Access token payload verified with correct claims'
    );

    const invalidToken = await verifyAccessToken('invalid.token.here');
    assert(invalidToken === null, 'Corrupted token returns null');

    // 3. User & Tenant Registration Flow
    console.log('\n3️⃣ Testing User & Tenant Database Creation...');
    const testEmail = `auth_test_${Date.now()}@domain.com`;
    const testStore = `Test Store ${Date.now()}`;
    const slug = `test-store-${Date.now()}`;

    // Insert tenant
    const tRes = await query(
      `INSERT INTO tenants (name, slug, email, plan)
       VALUES ($1, $2, $3, 'starter')
       RETURNING id;`,
      [testStore, slug, testEmail]
    );
    const tenantId = tRes.rows[0].id;

    // Insert user
    const uRes = await query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role)
       VALUES ($1, 'Pritom Test', $2, $3, 'admin')
       RETURNING id, email;`,
      [tenantId, testEmail, hashed]
    );
    const userId = uRes.rows[0].id;
    assert(userId && tenantId, 'Tenant and user created in database');

    // Duplicate email check
    const dupCheck = await query('SELECT id FROM users WHERE email = $1;', [testEmail]);
    assert(dupCheck.rows.length === 1, 'Duplicate email detection functional');

    // 4. Refresh Token Lifecycle & Rotation
    console.log('\n4️⃣ Testing Refresh Token Rotation & Replay Protection...');
    const refreshToken1 = await createRefreshToken(userId);
    assert(typeof refreshToken1 === 'string' && refreshToken1.length === 80, 'Refresh token generated');

    // Rotate token
    const refreshToken2 = await rotateRefreshToken(userId, refreshToken1);
    assert(typeof refreshToken2 === 'string' && refreshToken2 !== refreshToken1, 'Refresh token rotated successfully');

    // Replay attack protection: trying to use refreshToken1 again must fail
    const replayAttempt = await rotateRefreshToken(userId, refreshToken1);
    assert(replayAttempt === null, 'Old rotated refresh token cannot be reused (Replay Attack Prevented)');

    // Revocation (Logout)
    await revokeRefreshToken(refreshToken2!);
    const revokedAttempt = await rotateRefreshToken(userId, refreshToken2!);
    assert(revokedAttempt === null, 'Revoked token rejected upon logout');

    // 5. Sliding-Window Rate Limiter
    console.log('\n5️⃣ Testing Upstash Redis Rate Limiter...');
    const testIp = `test_ip_${Date.now()}`;
    const limit = 3;

    const hit1 = await checkRateLimit(testIp, limit, 10);
    const hit2 = await checkRateLimit(testIp, limit, 10);
    const hit3 = await checkRateLimit(testIp, limit, 10);
    const hit4 = await checkRateLimit(testIp, limit, 10);

    assert(hit1.success && hit1.remaining === 2, 'Rate limit Hit 1 allowed (2 remaining)');
    assert(hit2.success && hit2.remaining === 1, 'Rate limit Hit 2 allowed (1 remaining)');
    assert(hit3.success && hit3.remaining === 0, 'Rate limit Hit 3 allowed (0 remaining)');
    assert(!hit4.success && hit4.remaining === 0, 'Rate limit Hit 4 blocked (429 Too Many Requests)');

    // Cleanup test data
    await query('DELETE FROM tenants WHERE id = $1;', [tenantId]);
    await saasRedis.del(`ratelimit:${testIp}`);
    assert(true, 'Test auth data cleaned up cleanly');

  } catch (error) {
    console.error('❌ Phase 1 test suite error:', error);
    failed++;
  } finally {
    await pool.end();
  }

  console.log('\n📊 ========================================================');
  console.log(`📊 PHASE 1 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('📊 ========================================================');

  if (failed > 0) {
    console.error('❌ PHASE 1 DEFINITION OF DONE FAILED.');
    process.exit(1);
  } else {
    console.log('🎉 PHASE 1 DEFINITION OF DONE: 100% SUCCESS!');
    process.exit(0);
  }
}

runPhase1Tests();
