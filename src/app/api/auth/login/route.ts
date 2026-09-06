import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { comparePassword, createAccessToken, createRefreshToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    
    // Strict rate limit on login attempts: max 5 attempts per minute per IP
    const rateLimit = await checkRateLimit(`login:${ip}`, 5, 60);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please wait 1 minute before trying again.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { identifier, emailOrPhone, email, phone, password } = body;
    const rawInput = (identifier || emailOrPhone || phone || email || '').toString().trim();

    if (!rawInput || !password) {
      return NextResponse.json(
        { error: 'মোবাইল নম্বর অথবা ইমেইল এবং পাসওয়ার্ড প্রদান করুন' },
        { status: 400 }
      );
    }

    const cleanEmail = rawInput.toLowerCase();
    const cleanPhone = rawInput.replace(/[\s\-()]/g, '').replace(/^(\+88|88)/, '');

    // Query user and tenant by either email or phone number
    const res = await query(
      `SELECT u.id, u.tenant_id, u.name, u.email, u.phone, u.password_hash, u.role,
              t.name as tenant_name, t.slug as tenant_slug, t.plan as tenant_plan
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.email = $1 OR u.phone = $2;`,
      [cleanEmail, cleanPhone]
    );

    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: 'ভুল মোবাইল নম্বর/ইমেইল অথবা পাসওয়ার্ড' },
        { status: 401 }
      );
    }

    const user = res.rows[0];
    const passwordMatch = await comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'ভুল মোবাইল নম্বর/ইমেইল অথবা পাসওয়ার্ড' },
        { status: 401 }
      );
    }

    // Create Tokens
    const accessToken = await createAccessToken({
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });

    const refreshToken = await createRefreshToken(user.id);

    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
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
      accessToken,
    });

    // Set HttpOnly refresh token cookie
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error during login' },
      { status: 500 }
    );
  }
}
