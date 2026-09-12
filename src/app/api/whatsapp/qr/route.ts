import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppService, resetWhatsAppService } from '@/lib/whatsapp-baileys-service';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getAuthTenantId(req: NextRequest): Promise<string | undefined> {
  const authHeader = req.headers.get('authorization');
  const token =
    authHeader?.startsWith('Bearer ') && authHeader.split(' ')[1] !== 'null'
      ? authHeader.split(' ')[1]
      : req.cookies.get('accessToken')?.value || req.cookies.get('token')?.value;

  if (!token) return undefined;
  const payload = await verifyAccessToken(token);
  return payload?.tenantId;
}

/**
 * GET /api/whatsapp/qr
 * Returns current WhatsApp bot status & QR DataURL (auto-starts if idle)
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = await getAuthTenantId(req);
    const wa = getWhatsAppService();

    // If bot is idle, auto-trigger start to generate QR code in background
    if (wa.status === 'idle') {
      wa.start(tenantId).catch((err) => console.error('Auto-start WhatsApp error:', err));
    }

    // If starting and waiting for initial QR code, wait a brief moment (max 1.5s)
    if (wa.status === 'starting' && !wa.qrDataUrl) {
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 180));
        const current = (wa as any).status;
        if (current === 'qr_ready' || current === 'connected' || wa.qrDataUrl) break;
      }
    }

    return NextResponse.json({
      success: true,
      ...wa.getStatus(),
    });
  } catch (error: any) {
    console.error('GET /api/whatsapp/qr error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/whatsapp/qr
 * Start session, restart session, or disconnect / logout
 */
export async function POST(req: NextRequest) {
  try {
    const tenantId = await getAuthTenantId(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'start';

    if (action === 'greeting') {
      const wa = getWhatsAppService();
      const sent = await wa.sendWelcomeGreeting();
      return NextResponse.json({
        success: sent,
        message: sent
          ? 'টেস্ট মেসেজ সফলভাবে আপনার হোয়াটসঅ্যাপে পাঠানো হয়েছে!'
          : 'হোয়াটসঅ্যাপ সংযোগ সক্রিয় নেই বা প্রস্তুত নয়।',
        ...wa.getStatus(),
      });
    }

    if (action === 'disconnect') {
      const wa = await resetWhatsAppService();
      return NextResponse.json({
        success: true,
        message: 'WhatsApp session disconnected & logged out',
        ...wa.getStatus(),
      });
    }

    if (action === 'restart') {
      const wa = await resetWhatsAppService();
      wa.start(tenantId).catch((err) => console.error('Restart WhatsApp error:', err));
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 180));
        if (wa.status === 'qr_ready' || wa.qrDataUrl) break;
      }
      return NextResponse.json({
        success: true,
        message: 'WhatsApp session restarted',
        ...wa.getStatus(),
      });
    }

    const wa = getWhatsAppService();
    wa.start(tenantId).catch((err) => console.error('Start WhatsApp error:', err));
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 180));
      if (wa.status === 'qr_ready' || wa.qrDataUrl) break;
    }

    return NextResponse.json({
      success: true,
      message: 'WhatsApp session started',
      ...wa.getStatus(),
    });
  } catch (error: any) {
    console.error('POST /api/whatsapp/qr error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

