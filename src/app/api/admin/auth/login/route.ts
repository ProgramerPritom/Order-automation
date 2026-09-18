import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { comparePassword, createAccessToken, createRefreshToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    
    // Strict rate limit on admin login attempts: max 5 attempts per minute per IP
    const rateLimit = await checkRateLimit(`admin-login:${ip}`, 5, 60);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'অতিরিক্ত লগইন চেষ্টার কারণে সাময়িকভাবে ব্লক করা হয়েছে। ১ মিনিট পর চেষ্টা করুন।' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { identifier, phone, email, password } = body;
    const rawInput = (identifier || phone || email || '').toString().trim();

    if (!rawInput || !password) {
      return NextResponse.json(
        { error: 'এডমিন মোবাইল নম্বর/ইমেইল এবং পাসওয়ার্ড প্রদান করুন' },
        { status: 400 }
      );
    }

    const cleanEmail = rawInput.toLowerCase();
    const cleanPhone = rawInput.replace(/[\s\-()]/g, '').replace(/^(\+88|88)/, '');

    // Query admin_users first
    let res = await query(
      `SELECT id, name, email, phone, password_hash, role
       FROM admin_users
       WHERE email = $1 OR phone = $2;`,
      [cleanEmail, cleanPhone]
    );

    let user;
    let tenantId = 'platform-superadmin';
    let tenantName = 'ShopPilot Master Admin';
    let tenantSlug = 'platform-superadmin';

    if (res.rows.length > 0) {
      user = res.rows[0];
    } else {
      // Fallback check in users table
      const fallbackRes = await query(
        `SELECT u.id, u.tenant_id, u.name, u.email, u.phone, u.password_hash, u.role,
                t.name as tenant_name, t.slug as tenant_slug, t.plan as tenant_plan
         FROM users u
         JOIN tenants t ON u.tenant_id = t.id
         WHERE (u.email = $1 OR u.phone = $2) AND u.role = 'superadmin';`,
        [cleanEmail, cleanPhone]
      );
      if (fallbackRes.rows.length > 0) {
        user = fallbackRes.rows[0];
        tenantId = user.tenant_id;
        tenantName = user.tenant_name;
        tenantSlug = user.tenant_slug;
      }
    }

    if (!user) {
      // Check if this is a regular merchant trying to access admin login
      const merchantCheck = await query(
        `SELECT id, role FROM users WHERE email = $1 OR phone = $2;`,
        [cleanEmail, cleanPhone]
      );
      if (merchantCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'অননুমোদিত প্রবেশাধিকার: এই পোর্টালটি শুধুমাত্র সুপার এডমিনদের জন্য নির্ধারিত। অনুগ্রহ করে মার্চেন্ট লগইন ব্যবহার করুন।' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: 'ভুল এডমিন ক্রেডেনশিয়াল' },
        { status: 401 }
      );
    }

    // Verify Password
    const passwordMatch = await comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'ভুল এডমিন ক্রেডেনশিয়াল' },
        { status: 401 }
      );
    }

    // STRICT ROLE GUARD: Reject non-superadmin users
    if (user.role !== 'superadmin') {
      return NextResponse.json(
        { 
          error: 'অননুমোদিত প্রবেশাধিকার: এই পোর্টালটি শুধুমাত্র সুপার এডমিনদের জন্য নির্ধারিত। অনুগ্রহ করে মার্চেন্ট লগইন ব্যবহার করুন।' 
        },
        { status: 403 }
      );
    }

    // Create Tokens
    const accessToken = await createAccessToken({
      userId: user.id,
      tenantId: tenantId,
      email: user.email || 'admin@automastore.ai',
      phone: user.phone,
      role: 'superadmin',
    });

    const refreshToken = await createRefreshToken(user.id);

    const response = NextResponse.json({
      success: true,
      message: 'সুপার এডমিন লগইন সফল হয়েছে',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'superadmin',
      },
      tenant: {
        id: tenantId,
        name: tenantName,
        slug: tenantSlug,
        plan: 'business',
      },
      accessToken,
    });

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

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: thirtyDays,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Internal server error during admin login' },
      { status: 500 }
    );
  }
}
