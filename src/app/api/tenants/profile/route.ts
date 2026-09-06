import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken, hashPassword, comparePassword } from '@/lib/auth';
import { checkTenantSubscription } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

async function getAuthTenant(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  return verifyAccessToken(token);
}

/**
 * GET /api/tenants/profile - Fetch user and tenant profile details
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user details
    const userRes = await query(
      `SELECT id, name, email, phone, role, created_at 
       FROM users 
       WHERE id = $1 LIMIT 1;`,
      [auth.userId]
    );

    // Fetch tenant details
    const tenantRes = await query(
      `SELECT id, name, slug, email, plan, subscription_status, trial_ends_at, 
              current_period_ends_at, business_category, support_phone, 
              showroom_address, about_shop, created_at
       FROM tenants 
       WHERE id = $1 LIMIT 1;`,
      [auth.tenantId]
    );

    if (userRes.rows.length === 0 || tenantRes.rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const tenant = tenantRes.rows[0];
    const subEvaluation = await checkTenantSubscription(auth.tenantId);

    return NextResponse.json({
      user: userRes.rows[0],
      tenant: {
        ...tenant,
        subscription_evaluation: subEvaluation,
      },
    });
  } catch (error: any) {
    console.error('Fetch profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/tenants/profile - Update user profile, shop details, or password
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      phone,
      shop_name,
      business_category,
      support_phone,
      showroom_address,
      current_password,
      new_password,
    } = body;

    // 1. Update User basic info
    if (name || phone) {
      await query(
        `UPDATE users 
         SET name = COALESCE($1, name),
             phone = COALESCE($2, phone)
         WHERE id = $3;`,
        [name || null, phone || null, auth.userId]
      );
    }

    // 2. Update Tenant details
    if (shop_name || business_category !== undefined || support_phone !== undefined || showroom_address !== undefined) {
      await query(
        `UPDATE tenants 
         SET name = COALESCE($1, name),
             business_category = COALESCE($2, business_category),
             support_phone = COALESCE($3, support_phone),
             showroom_address = COALESCE($4, showroom_address),
             updated_at = NOW()
         WHERE id = $5;`,
        [
          shop_name || null,
          business_category ?? null,
          support_phone ?? null,
          showroom_address ?? null,
          auth.tenantId,
        ]
      );
    }

    // 3. Password Change (if requested)
    if (new_password) {
      if (!current_password) {
        return NextResponse.json({ error: 'বর্তমান পাসওয়ার্ড প্রদান করুন' }, { status: 400 });
      }

      const pwRes = await query(`SELECT password_hash FROM users WHERE id = $1;`, [auth.userId]);
      const currentHash = pwRes.rows[0]?.password_hash;
      const valid = await comparePassword(current_password, currentHash);

      if (!valid) {
        return NextResponse.json({ error: 'বর্তমান পাসওয়ার্ড সঠিক নয়' }, { status: 400 });
      }

      if (new_password.length < 6) {
        return NextResponse.json({ error: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' }, { status: 400 });
      }

      const newHash = await hashPassword(new_password);
      await query(`UPDATE users SET password_hash = $1 WHERE id = $2;`, [newHash, auth.userId]);
    }

    return NextResponse.json({
      success: true,
      message: 'প্রোফাইল ও সেটিংস সফলভাবে আপডেট হয়েছে!',
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
