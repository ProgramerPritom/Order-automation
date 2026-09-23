import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { getAllInvoicesForAdmin } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/invoices
 * Returns all submitted invoices for Super Admin review
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
    if (!auth || auth.role !== 'superadmin') {
      return NextResponse.json({ error: 'Superadmin privileges required' }, { status: 403 });
    }

    const invoices = await getAllInvoicesForAdmin();
    return NextResponse.json({ success: true, invoices });
  } catch (error: any) {
    console.error('Admin invoices error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
