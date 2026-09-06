import { NextRequest, NextResponse } from 'next/server';
import { query, getClient } from '@/lib/db';
import { hashPassword, createAccessToken, createRefreshToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = await checkRateLimit(`register:${ip}`, 10, 60);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many registration requests. Please try again in 1 minute.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { name, storeName, phone, email, password } = body;

    if (!name || !storeName || !phone || !password) {
      return NextResponse.json(
        { error: 'দয়া করে সব ফিল্ড পূরণ করুন: নাম, পেজের নাম, মোবাইল নম্বর এবং পাসওয়ার্ড' },
        { status: 400 }
      );
    }

    // Clean and validate Bangladeshi phone number
    const cleanPhone = phone.replace(/[\s\-()]/g, '').replace(/^(\+88|88)/, '');
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      return NextResponse.json(
        { error: 'সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর প্রদান করুন (যেমন: 017XXXXXXXX)' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' },
        { status: 400 }
      );
    }

    // Determine email (use provided or generate phone-based default)
    const userEmail = email && email.trim().length > 0 
      ? email.toLowerCase().trim() 
      : `${cleanPhone}@automa.store`;

    // Check existing phone
    const existingPhone = await query('SELECT id FROM users WHERE phone = $1;', [cleanPhone]);
    if (existingPhone.rows.length > 0) {
      return NextResponse.json(
        { error: 'এই মোবাইল নম্বর দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট তৈরি করা আছে। দয়া করে লগইন করুন।' },
        { status: 400 }
      );
    }

    // Check existing email
    const existingUser = await query('SELECT id FROM users WHERE email = $1;', [userEmail]);
    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট তৈরি করা আছে।' },
        { status: 400 }
      );
    }

    // Create Tenant and User in transaction
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const slug = storeName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') + `-${Date.now().toString().slice(-4)}`;

      const tenantRes = await client.query(
        `INSERT INTO tenants (name, slug, email, phone, plan, subscription_status, trial_ends_at, order_quota_monthly, max_channels)
         VALUES ($1, $2, $3, $4, 'starter', 'trialing', NOW() + INTERVAL '7 days', 500, 1)
         RETURNING id, name, slug, phone, plan, subscription_status, trial_ends_at;`,
        [storeName, slug, userEmail, cleanPhone]
      );
      const tenant = tenantRes.rows[0];

      const passwordHash = await hashPassword(password);
      const userRes = await client.query(
        `INSERT INTO users (tenant_id, name, email, phone, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, 'admin')
         RETURNING id, name, email, phone, role, tenant_id;`,
        [tenant.id, name, userEmail, cleanPhone, passwordHash]
      );
      const user = userRes.rows[0];

      await client.query('COMMIT');

      // Create Tokens
      const accessToken = await createAccessToken({
        userId: user.id,
        tenantId: tenant.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
      });

      const refreshToken = await createRefreshToken(user.id);

      const response = NextResponse.json({
        success: true,
        message: 'Registration successful',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          phone: tenant.phone,
          plan: tenant.plan,
        },
        accessToken,
      }, { status: 201 });

      // Set persistent session cookies (30 days)
      const thirtyDays = 30 * 24 * 60 * 60;
      const isProduction = process.env.NODE_ENV === 'production';

      response.cookies.set('accessToken', accessToken, {
        httpOnly: false,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: thirtyDays,
        path: '/',
      });

      response.cookies.set('token', accessToken, {
        httpOnly: false,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: thirtyDays,
        path: '/',
      });

      // Set HttpOnly refresh token cookie
      response.cookies.set('refresh_token', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: thirtyDays,
        path: '/',
      });

      return response;
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error during registration' },
      { status: 500 }
    );
  }
}
