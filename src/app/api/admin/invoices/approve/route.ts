import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { approveInvoiceAndActivatePlan, rejectInvoice } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/invoices/approve
 * Super Admin approves or rejects a submitted payment invoice
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
    if (!auth || auth.role !== 'superadmin') {
      return NextResponse.json({ error: 'Superadmin privileges required' }, { status: 403 });
    }

    const body = await req.json();
    const { invoiceId, action = 'approve', reason } = body;

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    if (action === 'approve') {
      const updatedSub = await approveInvoiceAndActivatePlan(invoiceId);
      return NextResponse.json({
        success: true,
        message: 'পেমেন্ট অনুমোদিত হয়েছে এবং টেন্যান্টের প্যাকেজ ৩০ দিনের জন্য সক্রিয় করা হয়েছে!',
        subscription: updatedSub,
      });
    } else if (action === 'reject') {
      await rejectInvoice(invoiceId, reason);
      return NextResponse.json({
        success: true,
        message: 'ইনভয়েসটি সফলভাবে বাতিল (Rejected) করা হয়েছে।',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Approve invoice error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
