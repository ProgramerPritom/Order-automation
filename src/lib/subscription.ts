import { query } from './db';

export interface SubscriptionStatus {
  isAllowed: boolean;
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'expired';
  plan: 'starter' | 'pro' | 'business';
  daysRemaining: number;
  inGracePeriod?: boolean;
  graceDaysRemaining?: number;
  orderQuota: number; // -1 for unlimited
  ordersUsed: number;
  maxChannels: number;
  message: string;
}

export interface PlanPricing {
  id: 'starter' | 'pro' | 'business';
  name: string;
  nameBn: string;
  priceBdt: number;
  orderQuota: number;
  maxChannels: number;
  features: string[];
}

/**
 * Official SaaS Pricing Tiers (Exact Match with Homepage)
 */
export const SAAS_PLANS: Record<string, PlanPricing> = {
  starter: {
    id: 'starter',
    name: 'বেসিক প্ল্যান (Starter)',
    nameBn: 'বেসিক প্ল্যান (Starter)',
    priceBdt: 990,
    orderQuota: 500,
    maxChannels: 1,
    features: [
      '১টি ফেসবুক পেজ কানেকশন',
      'মাসে ৫০০টি পর্যন্ত নিশ্চিত অর্ডার গ্রহণ',
      '২৪/৭ ইনস্ট্যান্ট অটো রিপ্লাই ও প্রডাক্ট শোকেস',
      'সঠিক ফোন নম্বর (১১ ডিজিট) ও ঠিকানা যাচাই',
      'ঢাকার ভেতরে ৮০ ও বাইরে ১৫০ টাকা চার্জ অটো যোগ',
      'রিয়েল-টাইম অর্ডার ম্যানেজমেন্ট ড্যাশবোর্ড',
      'ডেইলি সেলস রিপোর্ট ভিউ',
    ],
  },
  pro: {
    id: 'pro',
    name: 'প্রো প্ল্যান (Pro)',
    nameBn: 'প্রো প্ল্যান (সবচেয়ে জনপ্রিয়)',
    priceBdt: 1990,
    orderQuota: -1, // Unlimited
    maxChannels: 3,
    features: [
      'ফেসবুক + হোয়াটসঅ্যাপ + ইনস্টাগ্রাম ৩টি চ্যানেল',
      'আনলিমিটেড মেসেজ ও আনলিমিটেড অর্ডার (নো লিমিট)',
      'সাইজ (M, L, XL), কালার ও স্টক রিয়েল-টাইম যাচাই',
      '১-ক্লিকে নিজে কথা বলার সুবিধা (হিউম্যান টেকওভার)',
      'দৈনিক ও মাসিক সেলস রিপোর্ট ডাউনলোড (Excel / CSV)',
      'নতুন অর্ডার আসলে টেলিগ্রাম ও ড্যাশবোর্ডে পুশ অ্যালার্ট',
      'ডেলিভারি চার্জ অটোমেটিক ক্যালকুলেশন',
      '২৪/৭ ভিআইপি প্রায়োরিটি সাপোর্ট',
    ],
  },
  business: {
    id: 'business',
    name: 'বিজনেস প্ল্যান (Business)',
    nameBn: 'বিজনেস প্ল্যান (Business)',
    priceBdt: 3490,
    orderQuota: -1,
    maxChannels: 5,
    features: [
      'সর্বোচ্চ ৫টি সোশ্যাল পেজ ও হোয়াটসঅ্যাপ কানেক্ট',
      'আনলিমিটেড প্রোডাক্ট ক্যাটালগ ও আনলিমিটেড অর্ডার',
      'কুরিয়ার অটো বুকিং রেডি (Steadfast ও Pathao)',
      'টিম মেম্বারদের জন্য আলাদা স্টাফ অ্যাকাউন্ট',
      'কাস্টমার ডাটাবেজ ও ফুল রিপোর্ট এক্সপোর্ট (CSV)',
      'কাস্টম ব্র্যান্ড টোন ও শপ পলিসি ইন্টিগ্রেশন',
      'ডেডিকেটেড অ্যাকাউন্ট ম্যানেজার সাপোর্ট',
    ],
  },
};

/**
 * Official Payment Receiver Accounts (Configurable via ENV or Default)
 */
export const PAYMENT_ACCOUNTS = {
  bkash: {
    number: process.env.BKASH_MERCHANT_NUMBER || '01712-345678',
    type: 'Personal (Send Money / ক্যাশ আউট)',
    instructions: 'আপনার বিকাশ অ্যাপ থেকে সেন্ড মানি করুন এবং TrxID নিচে বসান।',
  },
  nagad: {
    number: process.env.NAGAD_MERCHANT_NUMBER || '01812-345678',
    type: 'Personal (Send Money)',
    instructions: 'নগদ অ্যাপ বা *167# ডায়াল করে সেন্ড মানি করুন এবং TrxID নিচে বসান।',
  },
  rocket: {
    number: process.env.ROCKET_MERCHANT_NUMBER || '01912-345678-9',
    type: 'Personal',
    instructions: 'রকেট একাউন্ট থেকে সেন্ড মানি করুন।',
  },
  bank: {
    bankName: 'City Bank Ltd / BRAC Bank',
    accountName: 'ShopPilot Technologies Ltd',
    accountNumber: '1102938475001',
    branch: 'Gulshan Branch, Dhaka',
  },
};

/**
 * Check a tenant's subscription or trial validity with automated lifecycle enforcement
 */
export async function checkTenantSubscription(tenantId: string): Promise<SubscriptionStatus> {
  const res = await query(
    `SELECT plan, subscription_status, trial_ends_at, current_period_ends_at, 
            grace_period_ends_at, order_quota_monthly, orders_count_current_month, max_channels
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
  const rawStatus = (row.subscription_status || 'trialing') as 'trialing' | 'active' | 'past_due' | 'suspended' | 'expired';
  const orderQuota = row.order_quota_monthly ?? 500;
  const ordersUsed = row.orders_count_current_month ?? 0;
  const maxChannels = row.max_channels ?? 1;

  // Case 1: Active or Past Due Paid Monthly Subscription
  if (rawStatus === 'active' || rawStatus === 'past_due') {
    const periodEnd = row.current_period_ends_at ? new Date(row.current_period_ends_at) : null;
    const graceEnd = row.grace_period_ends_at ? new Date(row.grace_period_ends_at) : null;
    const daysRemaining = periodEnd ? Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

    // Has billing period ended?
    if (!periodEnd || periodEnd <= now) {
      // Check 3-day grace period
      if (graceEnd && graceEnd > now) {
        const graceDays = Math.ceil((graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (rawStatus !== 'past_due') {
          await query(`UPDATE tenants SET subscription_status = 'past_due' WHERE id = $1;`, [tenantId]);
        }
        return {
          isAllowed: true, // Still allowed during 3-day grace period
          status: 'past_due',
          plan,
          daysRemaining: 0,
          inGracePeriod: true,
          graceDaysRemaining: graceDays,
          orderQuota,
          ordersUsed,
          maxChannels,
          message: `সাবস্ক্রিপশনের মেয়াদ শেষ হয়েছে। ৩ দিনের গ্রেস পিরিয়ড চলছে (${graceDays} দিন বাকি)। সেবা নিরবচ্ছিন্ন রাখতে রিনিউ করুন।`,
        };
      }

      // If grace period has passed, set status to suspended
      await query(`UPDATE tenants SET subscription_status = 'suspended' WHERE id = $1;`, [tenantId]);
      return {
        isAllowed: false,
        status: 'suspended',
        plan,
        daysRemaining: 0,
        orderQuota,
        ordersUsed,
        maxChannels,
        message: 'বিল পরিশোধ না করায় আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত রয়েছে। পুনরায় চালু করতে প্যাকেজ রিনিউ করুন।',
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

  // Case 2: Suspended Status
  if (rawStatus === 'suspended') {
    return {
      isAllowed: false,
      status: 'suspended',
      plan,
      daysRemaining: 0,
      orderQuota,
      ordersUsed,
      maxChannels,
      message: 'আপনার অ্যাকাউন্টটি স্থগিত রয়েছে। পুনরায় চালু করতে প্যাকেজ রিনিউ করুন।',
    };
  }

  // Case 3: 7-Day Free Trial
  const trialEnd = row.trial_ends_at ? new Date(row.trial_ends_at) : null;
  const daysRemaining = trialEnd ? Math.min(7, Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))) : 0;

  if (!trialEnd || trialEnd <= now) {
    // 7 days trial expired
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
 * Submit an MFS / Manual payment verification request (Stored as pending_approval)
 */
export async function submitManualPayment(params: {
  tenantId: string;
  plan: 'starter' | 'pro' | 'business';
  paymentMethod: 'bkash' | 'nagad' | 'rocket' | 'bank';
  senderNumber: string;
  transactionId: string;
  amount?: number;
  notes?: string;
}) {
  const { tenantId, plan, paymentMethod, senderNumber, transactionId, amount: customAmount, notes } = params;
  const planInfo = SAAS_PLANS[plan] || SAAS_PLANS.starter;
  const amount = customAmount !== undefined ? customAmount : planInfo.priceBdt;

  const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const dueDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const res = await query(
    `INSERT INTO invoices (
      tenant_id, invoice_number, amount, currency, plan, status, gateway, 
      payment_method, sender_number, transaction_id, period_start, period_end, due_date, metadata
    ) VALUES ($1, $2, $3, 'BDT', $4, 'pending_approval', 'manual_mfs', $5, $6, $7, $8, $9, $10, $11)
    RETURNING *;`,
    [
      tenantId,
      invoiceNumber,
      amount,
      plan,
      paymentMethod.toUpperCase(),
      senderNumber,
      transactionId.trim(),
      now,
      periodEnd,
      dueDate,
      JSON.stringify({ notes: notes || '' }),
    ]
  );

  return res.rows[0];
}

/**
 * Super Admin: Approve an invoice and activate subscription for 30 days
 */
export async function approveInvoiceAndActivatePlan(invoiceId: string) {
  const invRes = await query(`SELECT * FROM invoices WHERE id = $1;`, [invoiceId]);
  if (invRes.rows.length === 0) {
    throw new Error('Invoice not found');
  }

  const invoice = invRes.rows[0];
  const plan = invoice.plan as 'starter' | 'pro' | 'business';
  const planInfo = SAAS_PLANS[plan] || SAAS_PLANS.pro;

  // 1. Mark invoice as paid
  await query(
    `UPDATE invoices 
     SET status = 'paid', paid_at = NOW(), updated_at = NOW() 
     WHERE id = $1;`,
    [invoice.id]
  );

  // 2. Activate or extend tenant subscription by 30 days
  await query(
    `UPDATE tenants 
     SET 
       plan = $1,
       subscription_status = 'active',
       current_period_ends_at = NOW() + INTERVAL '30 days',
       grace_period_ends_at = NOW() + INTERVAL '33 days',
       order_quota_monthly = $2,
       orders_count_current_month = 0,
       max_channels = $3,
       updated_at = NOW()
     WHERE id = $4;`,
    [plan, planInfo.orderQuota, planInfo.maxChannels, invoice.tenant_id]
  );

  return checkTenantSubscription(invoice.tenant_id);
}

/**
 * Super Admin: Reject a submitted payment
 */
export async function rejectInvoice(invoiceId: string, reason?: string) {
  await query(
    `UPDATE invoices 
     SET status = 'rejected', rejection_reason = $1, updated_at = NOW() 
     WHERE id = $2;`,
    [reason || 'Invalid transaction ID or payment not received', invoiceId]
  );
}

/**
 * Retrieve tenant invoices list
 */
export async function getTenantInvoices(tenantId: string) {
  const res = await query(
    `SELECT id, invoice_number, amount, currency, plan, status, gateway, 
            sender_number, transaction_id, payment_method, period_start, period_end, due_date, paid_at, created_at
     FROM invoices
     WHERE tenant_id = $1
     ORDER BY created_at DESC;`,
    [tenantId]
  );
  return res.rows;
}

/**
 * Generate a sequential invoice for a tenant subscription
 */
export async function createTenantInvoice(params: {
  tenantId: string;
  plan: 'starter' | 'pro' | 'business';
  gateway?: string;
  paymentMethod?: string;
  customAmount?: number;
  metadata?: Record<string, any>;
}) {
  const { tenantId, plan, gateway = 'aamarpay', paymentMethod, customAmount, metadata = {} } = params;
  const planInfo = SAAS_PLANS[plan] || SAAS_PLANS.starter;
  const amount = customAmount !== undefined ? customAmount : planInfo.priceBdt;

  const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const dueDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const res = await query(
    `INSERT INTO invoices (
      tenant_id, invoice_number, amount, currency, plan, status, gateway, 
      payment_method, period_start, period_end, due_date, metadata
    ) VALUES ($1, $2, $3, 'BDT', $4, 'unpaid', $5, $6, $7, $8, $9, $10)
    RETURNING *;`,
    [
      tenantId,
      invoiceNumber,
      amount,
      plan,
      gateway,
      paymentMethod || null,
      now,
      periodEnd,
      dueDate,
      JSON.stringify(metadata),
    ]
  );

  return res.rows[0];
}

/**
 * Confirm payment and activate or extend tenant subscription
 */
export async function processPaymentSuccess(params: {
  invoiceId?: string;
  invoiceNumber?: string;
  tenantId?: string;
  plan?: 'starter' | 'pro' | 'business';
  transactionId: string;
  gateway: string;
  paymentMethod?: string;
  amountPaid?: number;
}) {
  const { invoiceId, invoiceNumber, tenantId: inputTenantId, plan: inputPlan, transactionId, gateway, paymentMethod } = params;

  let invoice: any = null;
  if (invoiceId) {
    const invRes = await query(`SELECT * FROM invoices WHERE id = $1;`, [invoiceId]);
    invoice = invRes.rows[0];
  } else if (invoiceNumber) {
    const invRes = await query(`SELECT * FROM invoices WHERE invoice_number = $1;`, [invoiceNumber]);
    invoice = invRes.rows[0];
  }

  const tenantId = invoice ? invoice.tenant_id : inputTenantId;
  const plan = invoice ? invoice.plan : (inputPlan || 'pro');

  if (!tenantId) {
    throw new Error('Tenant ID could not be identified for payment confirmation');
  }

  const planInfo = SAAS_PLANS[plan] || SAAS_PLANS.pro;

  if (invoice) {
    await query(
      `UPDATE invoices 
       SET status = 'paid', 
           transaction_id = $1, 
           gateway = $2, 
           payment_method = COALESCE($3, payment_method),
           paid_at = NOW(),
           updated_at = NOW()
       WHERE id = $4;`,
      [transactionId, gateway, paymentMethod || 'Online Gateway', invoice.id]
    );
  }

  await query(
    `UPDATE tenants 
     SET 
       plan = $1,
       subscription_status = 'active',
       current_period_ends_at = NOW() + INTERVAL '30 days',
       grace_period_ends_at = NOW() + INTERVAL '33 days',
       order_quota_monthly = $2,
       orders_count_current_month = 0,
       max_channels = $3,
       billing_gateway = $4,
       updated_at = NOW()
     WHERE id = $5;`,
    [plan, planInfo.orderQuota, planInfo.maxChannels, gateway, tenantId]
  );

  return checkTenantSubscription(tenantId);
}

/**
 * Direct Manual / Admin Plan Activation
 */
export async function activateMonthlyPlan(
  tenantId: string, 
  plan: 'starter' | 'pro' | 'business'
) {
  const planInfo = SAAS_PLANS[plan] || SAAS_PLANS.starter;

  await query(
    `UPDATE tenants 
     SET 
       plan = $1,
       subscription_status = 'active',
       current_period_ends_at = NOW() + INTERVAL '30 days',
       grace_period_ends_at = NOW() + INTERVAL '33 days',
       order_quota_monthly = $2,
       orders_count_current_month = 0,
       max_channels = $3,
       updated_at = NOW()
     WHERE id = $4;`,
    [plan, planInfo.orderQuota, planInfo.maxChannels, tenantId]
  );

  return checkTenantSubscription(tenantId);
}

/**
 * Retrieve all pending and submitted payment invoices for Super Admin
 */
export async function getAllInvoicesForAdmin() {
  const res = await query(
    `SELECT i.*, t.name as tenant_name, t.customer_billing_phone, u.email as user_email
     FROM invoices i
     JOIN tenants t ON i.tenant_id = t.id
     LEFT JOIN users u ON u.tenant_id = t.id
     ORDER BY i.created_at DESC
     LIMIT 50;`
  );
  return res.rows;
}

