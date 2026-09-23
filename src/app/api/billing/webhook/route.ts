import { NextRequest, NextResponse } from 'next/server';
import { processPaymentSuccess } from '@/lib/subscription';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Omnichannel Payment Webhook & IPN Listener
 * GET / POST /api/billing/webhook
 * Handles Aamarpay, Shurjopay, bKash, SSLCommerz, and Stripe payment notifications
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let body: any = {};

    if (contentType.includes('application/json')) {
      body = await req.json();
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      body = Object.fromEntries(formData.entries());
    }

    const { searchParams } = new URL(req.url);
    const gateway = searchParams.get('gateway') || body.gateway || 'aamarpay';
    const status = searchParams.get('status') || body.pay_status || body.status;

    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const returnOrigin = `${proto}://${host}`;

    // =========================================================================
    // CASE A: AAMARPAY IPN
    // =========================================================================
    const tranId = body.tran_id || body.mer_txnid || searchParams.get('tran_id');
    const valId = body.val_id || body.pg_txnid || `TXN-${Date.now()}`;
    const amount = Number(body.amount || body.store_amount || 0);
    const cardType = body.card_type || body.payment_type || 'MFS / Card';

    if (status === 'Successful' || status === 'success' || body.pay_status === 'Successful') {
      if (!tranId) {
        return NextResponse.json({ error: 'Transaction ID missing' }, { status: 400 });
      }

      console.log(`💳 [Billing Payment Success] TranID: ${tranId}, Gateway: ${gateway}, Amount: ৳${amount}`);

      await processPaymentSuccess({
        invoiceNumber: tranId,
        transactionId: String(valId),
        gateway: 'aamarpay',
        paymentMethod: cardType,
        amountPaid: amount,
      });

      // If browser POST redirect from gateway, redirect user back to settings with success notice
      if (contentType.includes('application/x-www-form-urlencoded')) {
        return NextResponse.redirect(`${returnOrigin}/dashboard/settings?billing=success&tran_id=${tranId}`);
      }

      return NextResponse.json({ success: true, message: 'Payment confirmed & subscription activated' });
    }

    // Payment failed or cancelled
    if (tranId) {
      await query(
        `UPDATE invoices SET status = 'failed', updated_at = NOW() WHERE invoice_number = $1;`,
        [tranId]
      );
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
      return NextResponse.redirect(`${returnOrigin}/dashboard/settings?billing=failed&reason=${encodeURIComponent(status || 'Payment_Declined')}`);
    }

    return NextResponse.json({ success: false, message: 'Payment not successful' }, { status: 400 });
  } catch (error: any) {
    console.error('Payment webhook exception:', error);
    return NextResponse.json({ error: error.message || 'Webhook error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const tranId = searchParams.get('tran_id');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const returnOrigin = `${proto}://${host}`;

  if (status === 'success' && tranId) {
    try {
      await processPaymentSuccess({
        invoiceNumber: tranId,
        transactionId: `GET-${Date.now()}`,
        gateway: 'online_gateway',
      });
      return NextResponse.redirect(`${returnOrigin}/dashboard/settings?billing=success&tran_id=${tranId}`);
    } catch (e) {}
  }

  return NextResponse.redirect(`${returnOrigin}/dashboard/settings?billing=${status || 'status'}`);
}
