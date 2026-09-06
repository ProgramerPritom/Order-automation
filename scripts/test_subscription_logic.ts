import { pool, query } from '../src/lib/db';
import { checkTenantSubscription, activateMonthlyPlan } from '../src/lib/subscription';

async function testSubscription() {
  console.log('--- Testing Subscription & 14-Day Trial Evaluation ---');

  // 1. Check Demo Tenant (Active Pro Plan)
  const demoTenant = await query(`SELECT id FROM tenants WHERE slug = 'demo-aarong-fashion';`);
  const demoSub = await checkTenantSubscription(demoTenant.rows[0].id);
  console.log('1. Demo Tenant (Pro Plan):', {
    status: demoSub.status,
    isAllowed: demoSub.isAllowed,
    daysRemaining: demoSub.daysRemaining,
    plan: demoSub.plan,
    orderQuota: demoSub.orderQuota,
    message: demoSub.message,
  });

  if (demoSub.status !== 'active' || !demoSub.isAllowed) {
    throw new Error('Demo subscription should be active');
  }

  // 2. Create a Mock Trial Tenant
  const trialRes = await query(`
    INSERT INTO tenants (name, slug, email, phone, plan, subscription_status, trial_ends_at)
    VALUES ('Mock Trial Store', 'mock-trial-${Date.now()}', 'trial@test.com', '01711223344', 'starter', 'trialing', NOW() + INTERVAL '14 days')
    RETURNING id;
  `);
  const trialId = trialRes.rows[0].id;

  const trialSub = await checkTenantSubscription(trialId);
  console.log('2. Newly Registered Tenant (14-Day Trial):', {
    status: trialSub.status,
    isAllowed: trialSub.isAllowed,
    daysRemaining: trialSub.daysRemaining,
    message: trialSub.message,
  });

  if (trialSub.status !== 'trialing' || trialSub.daysRemaining < 13 || !trialSub.isAllowed) {
    throw new Error('Trial evaluation failed');
  }

  // 3. Simulate Upgrading to Monthly Pro Plan
  const upgradedSub = await activateMonthlyPlan(trialId, 'pro');
  console.log('3. Upgraded to Monthly Pro Plan:', {
    status: upgradedSub.status,
    isAllowed: upgradedSub.isAllowed,
    daysRemaining: upgradedSub.daysRemaining,
    plan: upgradedSub.plan,
    orderQuota: upgradedSub.orderQuota,
    message: upgradedSub.message,
  });

  if (upgradedSub.status !== 'active' || upgradedSub.plan !== 'pro' || upgradedSub.orderQuota !== -1) {
    throw new Error('Upgrade evaluation failed');
  }

  // Clean up mock
  await query(`DELETE FROM tenants WHERE id = $1;`, [trialId]);

  console.log('✅ ALL SUBSCRIPTION CONDITIONS & TRIAL LOGIC PASSED 100%!');
  process.exit(0);
}

testSubscription().catch((e) => {
  console.error('❌ Subscription Test Failed:', e);
  process.exit(1);
});
