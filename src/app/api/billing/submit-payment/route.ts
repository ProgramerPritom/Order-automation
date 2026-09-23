import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { submitManualPayment, SAAS_PLANS } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/submit-payment
 * Allows merchants to submit their bKash / Nagad / Rocket transaction ID & sender phone
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
    const { plan = 'pro', paymentMethod = 'bkash', senderNumber, transactionId, notes } = body;

    if (!senderNumber || senderNumber.trim().length < 6) {
      return NextResponse.json(
        { error: 'অনুগ্রহ করে সঠিক প্রেরক মোবাইল নম্বর বা একাউন্ট নম্বর দিন।' },
        { status: 400 }
      );
    }

    if (!transactionId || transactionId.trim().length < 4) {
      return NextResponse.json(
        { error: 'অনুগ্রহ করে সঠিক ট্রানজ্যাকশন আইডি (TrxID) দিন।' },
        { status: 400 }
      );
    }

    const planInfo = SAAS_PLANS[plan];
    if (!planInfo) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    const invoice = await submitManualPayment({
      tenantId: auth.tenantId,
      plan: plan as any,
      paymentMethod: paymentMethod as any,
      senderNumber: senderNumber.trim(),
      transactionId: transactionId.trim().toUpperCase(),
      amount: planInfo.priceBdt,
      notes: notes?.trim(),
    });

    return NextResponse.json({
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      message: `আপনার পেমেন্ট রিকোয়েস্ট (TrxID: ${transactionId.trim().toUpperCase()}) সফলভাবে জমা হয়েছে। অ্যাডমিন ভেরিফাই করার সাথে সাথে প্যাকেজটি সক্রিয় হয়ে যাবে।`,
    });
  } catch (error: any) {
    console.error('Submit payment error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
