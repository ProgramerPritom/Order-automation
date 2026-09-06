import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Bearer token required' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyAccessToken(token);

    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token' }, { status: 401 });
    }

    const res = await query(
      `SELECT u.id, u.tenant_id, u.name, u.email, u.phone, u.role,
              t.name as tenant_name, t.slug as tenant_slug, t.phone as tenant_phone, t.plan as tenant_plan
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1 AND u.tenant_id = $2;`,
      [payload.userId, payload.tenantId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'User or tenant not found' }, { status: 404 });
    }

    const row = res.rows[0];

    return NextResponse.json({
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        role: row.role,
      },
      tenant: {
        id: row.tenant_id,
        name: row.tenant_name,
        slug: row.tenant_slug,
        phone: row.tenant_phone,
        plan: row.tenant_plan,
      },
    });
  } catch (error: any) {
    console.error('Me endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
