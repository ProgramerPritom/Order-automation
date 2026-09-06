import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { checkTenantSubscription, activateMonthlyPlan } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

async function getAuthPayload(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token =
    (authHeader?.startsWith('Bearer ') && authHeader.split(' ')[1] !== 'null')
      ? authHeader.split(' ')[1]
      : req.cookies.get('accessToken')?.value || req.cookies.get('token')?.value;

  if (!token) return null;
  return verifyAccessToken(token);
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getAuthPayload(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await checkTenantSubscription(payload.tenantId);
    return NextResponse.json({ success: true, subscription });
  } catch (error: any) {
    console.error('Subscription check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getAuthPayload(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { plan } = body;

    if (!['starter', 'pro', 'business'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    const updatedSubscription = await activateMonthlyPlan(payload.tenantId, plan);
    return NextResponse.json({
      success: true,
      message: `মাসিক ${plan.toUpperCase()} প্ল্যান সফলভাবে সক্রিয় করা হয়েছে!`,
      subscription: updatedSubscription,
    });
  } catch (error: any) {
    console.error('Subscription upgrade error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
