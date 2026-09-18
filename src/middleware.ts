import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_saas_default_2026';
const secretKey = new TextEncoder().encode(JWT_SECRET);

interface TokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  phone?: string;
  role: string;
}

async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return {
      userId: payload.userId as string,
      tenantId: payload.tenantId as string,
      email: payload.email as string,
      phone: payload.phone as string | undefined,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Extract access token from cookies
  const token =
    req.cookies.get('accessToken')?.value ||
    req.cookies.get('token')?.value ||
    null;

  const payload = token ? await verifyToken(token) : null;
  const isSuperAdmin = payload?.role === 'superadmin';

  // -------------------------------------------------------------
  // 1. ADMIN ROUTE PROTECTION (/admin/:path*)
  // -------------------------------------------------------------
  if (pathname.startsWith('/admin')) {
    // Case 1.1: The dedicated admin login page (/admin/login)
    if (pathname === '/admin/login') {
      // If already authenticated as superadmin, redirect directly to admin dashboard
      if (isSuperAdmin) {
        return NextResponse.redirect(new URL('/admin', req.url));
      }
      return NextResponse.next();
    }

    // Case 1.2: Protected Admin Pages (/admin, /admin/...)
    // A) Unauthenticated -> Redirect strictly to /admin/login (NEVER to /login)
    if (!payload) {
      const loginUrl = new URL('/admin/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // B) Authenticated as non-superadmin (regular merchant/staff)
    // Prevent access and redirect to their own merchant dashboard
    if (!isSuperAdmin) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // C) Verified superadmin -> Allow access
    return NextResponse.next();
  }

  // -------------------------------------------------------------
  // 2. MERCHANT DASHBOARD PROTECTION (/dashboard/:path*)
  // -------------------------------------------------------------
  if (pathname.startsWith('/dashboard')) {
    if (!payload) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // -------------------------------------------------------------
  // 3. REGULAR MERCHANT LOGIN PAGE (/login)
  // -------------------------------------------------------------
  if (pathname === '/login') {
    if (payload) {
      // Superadmin visiting /login gets sent to /admin
      if (isSuperAdmin) {
        return NextResponse.redirect(new URL('/admin', req.url));
      }
      // Merchant visiting /login gets sent to /dashboard
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/login',
  ],
};
