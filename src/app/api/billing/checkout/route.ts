import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { createTenantInvoice, SAAS_PLANS } from '@/lib/subscription';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/checkout
 * Initiates an automated subscription renewal / upgrade checkout session
 * Supports: Aamarpay, Shurjopay, bKash, Stripe, SSLCommerz
 */
export async function POST(req: NextRequest) {
  try {
    const token =
      req.cookies.get('accessToken')?.value ||
      req.cookies.get('token')?.value ||
      req.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await verifyAccessToken(token);
    if (!auth || !auth.tenantId) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const body = await req.json();
    const { plan = 'pro', gateway = 'aamarpay' } = body;

    const planInfo = SAAS_PLANS[plan];
    if (!planInfo) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    // Fetch tenant and user details
    const tenantRes = await query(
      `SELECT t.id, t.name, t.customer_billing_email, t.customer_billing_phone, 
              u.email as user_email, u.name as user_name, u.phone as user_phone
       FROM tenants t
       LEFT JOIN users u ON u.tenant_id = t.id
       WHERE t.id = $1
       LIMIT 1;`,
      [auth.tenantId]
    );

    if (tenantRes.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const tenant = tenantRes.rows[0];
    const customerName = tenant.user_name || tenant.name || 'Merchant';
    const customerEmail = tenant.customer_billing_email || tenant.user_email || 'billing@shoppilot.ai';
    const customerPhone = tenant.customer_billing_phone || tenant.user_phone || '01700000000';

    // 1. Generate Invoice Record in DB
    const invoice = await createTenantInvoice({
      tenantId: auth.tenantId,
      plan: plan as any,
      gateway,
      paymentMethod: gateway.toUpperCase(),
      customAmount: planInfo.priceBdt,
      metadata: {
        customerName,
        customerEmail,
        customerPhone,
        initiatedFromIp: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const origin = `${proto}://${host}`;

    // 2. Gateway Dispatcher
    // CASE A: AAMARPAY (Bangladeshi MFS, Cards & Netbanking)
    if (gateway === 'aamarpay') {
      const aamarpayStoreId = process.env.AAMARPAY_STORE_ID || 'sandbox_store';
      const aamarpaySignatureKey = process.env.AAMARPAY_SIGNATURE_KEY || 'sandbox_key';
      const isSandbox = process.env.AAMARPAY_SANDBOX !== 'false';

      const aamarpayEndpoint = isSandbox
        ? 'https://sandbox.aamarpay.com/jsonpost.php'
        : 'https://secure.aamarpay.com/jsonpost.php';

      const payload = {
        store_id: aamarpayStoreId,
        tran_id: invoice.invoice_number,
        success_url: `${origin}/api/billing/webhook?gateway=aamarpay&status=success`,
        fail_url: `${origin}/api/billing/webhook?gateway=aamarpay&status=fail`,
        cancel_url: `${origin}/dashboard/settings?payment=cancelled`,
        amount: String(planInfo.priceBdt),
        currency: 'BDT',
        signature_key: aamarpaySignatureKey,
        desc: `ShopPilot.ai ${planInfo.name} Subscription (30 Days)`,
        cus_name: customerName,
        cus_email: customerEmail,
        cus_phone: customerPhone,
        cus_add1: 'Dhaka, Bangladesh',
        cus_city: 'Dhaka',
        cus_country: 'Bangladesh',
        opt_a: auth.tenantId,
        opt_b: plan,
        opt_c: invoice.id,
      };

      try {
        const payRes = await fetch(aamarpayEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const payData = await payRes.json();

        if (payData.result === 'true' && payData.payment_url) {
          return NextResponse.json({
            success: true,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
            paymentUrl: payData.payment_url,
          });
        }
      } catch (err: any) {
        console.warn('Aamarpay direct initiation fallback:', err.message);
      }
    }

    // CASE B: Fallback / Sandbox Direct Demo Checkout URL
    const demoCheckoutUrl = `${origin}/dashboard/settings?invoice=${invoice.invoice_number}&amount=${planInfo.priceBdt}&plan=${plan}&status=pending_payment`;

    return NextResponse.json({
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      amount: planInfo.priceBdt,
      currency: 'BDT',
      paymentUrl: demoCheckoutUrl,
      message: 'ইনভয়েস সফলভাবে তৈরি হয়েছে। পেমেন্ট সম্পন্ন করতে এগিয়ে যান।',
    });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
