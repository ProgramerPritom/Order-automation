import { query } from './db';

export interface SubscriptionStatus {
  isAllowed: boolean;
  status: 'trialing' | 'active' | 'past_due' | 'expired';
  plan: 'starter' | 'pro' | 'business';
  daysRemaining: number;
  orderQuota: number; // -1 for unlimited
  ordersUsed: number;
  maxChannels: number;
  message: string;
}

/**
 * Check a tenant's subscription or trial validity
 */
export async function checkTenantSubscription(tenantId: string): Promise<SubscriptionStatus> {
  const res = await query(
    `SELECT plan, subscription_status, trial_ends_at, current_period_ends_at, 
            order_quota_monthly, orders_count_current_month, max_channels
     FROM tenants
     WHERE id = $1;`,
    [tenantId]
  );

  if (res.rows.length === 0) {
    return {
      isAllowed: false,
      status: 'expired',
      plan: 'starter',
      daysRemaining: 0,
      orderQuota: 0,
      ordersUsed: 0,
      maxChannels: 0,
      message: 'টেন্যান্ট পাওয়া যায়নি',
    };
  }

  const row = res.rows[0];
  const now = new Date();
  const plan = (row.plan || 'starter') as 'starter' | 'pro' | 'business';
  const rawStatus = (row.subscription_status || 'trialing') as 'trialing' | 'active' | 'past_due' | 'expired';
  const orderQuota = row.order_quota_monthly ?? 500;
  const ordersUsed = row.orders_count_current_month ?? 0;
  const maxChannels = row.max_channels ?? 1;

  // Case 1: Active Paid Monthly Subscription
  if (rawStatus === 'active') {
    const periodEnd = row.current_period_ends_at ? new Date(row.current_period_ends_at) : null;
    const daysRemaining = periodEnd ? Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

    if (!periodEnd || periodEnd <= now) {
      // Period has expired
      await query(`UPDATE tenants SET subscription_status = 'past_due' WHERE id = $1;`, [tenantId]);
      return {
        isAllowed: false,
        status: 'past_due',
        plan,
        daysRemaining: 0,
        orderQuota,
        ordersUsed,
        maxChannels,
        message: 'আপনার চলতি মাসের সাবস্ক্রিপশনের মেয়াদ শেষ হয়েছে। সার্ভিস সচল রাখতে রিনিউ করুন।',
      };
    }

    // Check Monthly Order Quota (if not unlimited)
    if (orderQuota !== -1 && ordersUsed >= orderQuota) {
      return {
        isAllowed: false,
        status: 'active',
        plan,
        daysRemaining,
        orderQuota,
        ordersUsed,
        maxChannels,
        message: `চলতি মাসে আপনার নির্ধারিত ${orderQuota}টি অর্ডারের লিমিট শেষ হয়েছে। আনলিমিটেড অর্ডারের জন্য প্রো প্ল্যানে আপগ্রেড করুন।`,
      };
    }

    return {
      isAllowed: true,
      status: 'active',
      plan,
      daysRemaining,
      orderQuota,
      ordersUsed,
      maxChannels,
      message: `মাসিক ${plan.toUpperCase()} প্ল্যান সক্রিয় (${daysRemaining} দিন বাকি)`,
    };
  }

  // Case 2: 7-Day Free Trial
  const trialEnd = row.trial_ends_at ? new Date(row.trial_ends_at) : null;
  const daysRemaining = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

  if (!trialEnd || trialEnd <= now) {
    // 7 days expired
    await query(`UPDATE tenants SET subscription_status = 'expired' WHERE id = $1;`, [tenantId]);
    return {
      isAllowed: false,
      status: 'expired',
      plan: 'starter',
      daysRemaining: 0,
      orderQuota,
      ordersUsed,
      maxChannels,
      message: 'আপনার ৭ দিনের ফ্রি ট্রায়াল শেষ হয়েছে। সার্ভিস সচল রাখতে একটি মাসিক প্ল্যান বেছে নিন।',
    };
  }

  return {
    isAllowed: true,
    status: 'trialing',
    plan,
    daysRemaining,
    orderQuota,
    ordersUsed,
    maxChannels,
    message: `৭ দিনের ফ্রি ট্রায়াল চলছে (${daysRemaining} দিন বাকি)`,
  };
}

/**
 * Activate or Upgrade a Tenant to a Paid Monthly Plan
 */
export async function activateMonthlyPlan(
  tenantId: string, 
  plan: 'starter' | 'pro' | 'business'
) {
  const quotas = {
    starter: { quota: 500, channels: 1 },
    pro: { quota: -1, channels: 3 },       // unlimited orders, 3 channels
    business: { quota: -1, channels: 5 },  // unlimited orders, 5 channels
  };

  const config = quotas[plan] || quotas.starter;

  await query(
    `UPDATE tenants 
     SET 
       plan = $1,
       subscription_status = 'active',
       current_period_ends_at = NOW() + INTERVAL '30 days',
       order_quota_monthly = $2,
       orders_count_current_month = 0,
       max_channels = $3,
       updated_at = NOW()
     WHERE id = $4;`,
    [plan, config.quota, config.channels, tenantId]
  );

  return checkTenantSubscription(tenantId);
}
