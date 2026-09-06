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
      `SELECT name, about_shop, business_category, support_phone, showroom_address,
              delivery_inside_dhaka, delivery_outside_dhaka,
              delivery_time_dhaka, delivery_time_outside,
              return_policy, ai_tone, custom_rules
       FROM tenants
       WHERE id = $1;`,
      [payload.tenantId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, knowledge: res.rows[0] });
  } catch (error: any) {
    console.error('Fetch knowledge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
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

    const body = await req.json();
    const {
      about_shop,
      business_category,
      support_phone,
      showroom_address,
      delivery_inside_dhaka,
      delivery_outside_dhaka,
      delivery_time_dhaka,
      delivery_time_outside,
      return_policy,
      ai_tone,
      custom_rules,
    } = body;

    await query(
      `UPDATE tenants
       SET 
         about_shop = COALESCE($1, about_shop),
         business_category = COALESCE($2, business_category),
         support_phone = COALESCE($3, support_phone),
         showroom_address = COALESCE($4, showroom_address),
         delivery_inside_dhaka = COALESCE($5, delivery_inside_dhaka),
         delivery_outside_dhaka = COALESCE($6, delivery_outside_dhaka),
         delivery_time_dhaka = COALESCE($7, delivery_time_dhaka),
         delivery_time_outside = COALESCE($8, delivery_time_outside),
         return_policy = COALESCE($9, return_policy),
         ai_tone = COALESCE($10, ai_tone),
         custom_rules = COALESCE($11, custom_rules),
         updated_at = NOW()
       WHERE id = $12;`,
      [
        about_shop,
        business_category,
        support_phone,
        showroom_address,
        delivery_inside_dhaka,
        delivery_outside_dhaka,
        delivery_time_dhaka,
        delivery_time_outside,
        return_policy,
        ai_tone,
        custom_rules,
        payload.tenantId,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'আপনার শপের তথ্য ও এআই নলেজ সফলভাবে সেভ করা হয়েছে!',
    });
  } catch (error: any) {
    console.error('Update knowledge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
