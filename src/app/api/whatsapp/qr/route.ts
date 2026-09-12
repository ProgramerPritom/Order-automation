import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppService } from '@/lib/whatsapp-baileys-service';
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
 * Returns the current status of the WhatsApp bot & QR DataURL (auto-starts if idle)
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = await getAuthTenantId(req);
    const wa = getWhatsAppService();

    // If bot is idle, auto-trigger start to generate QR code
    if (wa.status === 'idle') {
      await wa.start(tenantId);
    }

    // If starting and waiting for initial QR code, wait up to 3 seconds
    if (wa.status === 'starting' && !wa.qrDataUrl) {
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 200));
        const current = (wa as any).status;
        if (current === 'qr_ready' || current === 'connected') break;
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
 * Start session, disconnect session, or check status
 */
export async function POST(req: NextRequest) {
  try {
    const tenantId = await getAuthTenantId(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'start';

    const wa = getWhatsAppService();

    if (action === 'disconnect') {
      const result = await wa.disconnect();
      return NextResponse.json({
        success: true,
        message: 'WhatsApp session disconnected',
        ...result,
      });
    }

    if (action === 'start') {
      const result = await wa.start(tenantId);
      return NextResponse.json({
        success: true,
        message: 'WhatsApp session started',
        ...result,
      });
    }

    return NextResponse.json({
      success: true,
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
