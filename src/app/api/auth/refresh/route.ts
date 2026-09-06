import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { rotateRefreshToken, createAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    const refreshToken =
      req.cookies.get('refresh_token')?.value ||
      body.refreshToken ||
      (headerToken && headerToken !== 'null' ? headerToken : null);

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token provided' },
        { status: 401 }
      );
    }

    const rotated = await rotateRefreshToken(refreshToken, body.userId);
    if (!rotated) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    // Fetch user and tenant details for new session
    const res = await query(
      `SELECT u.id, u.tenant_id, u.name, u.email, u.phone, u.role,
              t.name as tenant_name, t.slug as tenant_slug, t.plan as tenant_plan
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1;`,
      [rotated.userId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = res.rows[0];
    const newAccessToken = await createAccessToken({
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      accessToken: newAccessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      tenant: {
        id: user.tenant_id,
        name: user.tenant_name,
        slug: user.tenant_slug,
        plan: user.tenant_plan,
      },
    });

    const thirtyDays = 30 * 24 * 60 * 60;
    const isProduction = process.env.NODE_ENV === 'production';

    // Refresh client-accessible session tokens
    response.cookies.set('accessToken', newAccessToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: thirtyDays,
      path: '/',
    });

    response.cookies.set('token', newAccessToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: thirtyDays,
      path: '/',
    });

    // Refresh HttpOnly rotating refresh token
    response.cookies.set('refresh_token', rotated.newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: thirtyDays,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Refresh token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
