import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { getTenantInvoices, checkTenantSubscription, SAAS_PLANS, PAYMENT_ACCOUNTS } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

/**
 * GET /api/billing/invoices
 * Returns dynamic plans, payment receiver details, invoices, and subscription status
 */
export async function GET(req: NextRequest) {
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

    const [invoices, subscription] = await Promise.all([
      getTenantInvoices(auth.tenantId),
      checkTenantSubscription(auth.tenantId),
    ]);

    return NextResponse.json({
      success: true,
      subscription,
      plans: SAAS_PLANS,
      paymentAccounts: PAYMENT_ACCOUNTS,
      invoices,
      userRole: auth.role,
    });
  } catch (error: any) {
    console.error('Fetch invoices error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
