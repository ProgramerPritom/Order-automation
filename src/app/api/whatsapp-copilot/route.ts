import { NextRequest, NextResponse } from 'next/server';
import { processMerchantWhatsAppMessage } from '@/lib/whatsapp-merchant-copilot';

/**
 * POST /api/whatsapp-copilot
 * Universal webhook & backend endpoint for WhatsApp AI Assistant
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Extract sender phone & message text from various webhook payload formats
    const senderPhone =
      body.senderPhone ||
      body.phone ||
      body.sender ||
      body.from ||
      body.From ||
      (body.key && body.key.remoteJid ? body.key.remoteJid.split('@')[0] : '') ||
      '01712345678';

    const messageText =
      body.messageText ||
      body.message ||
      body.text ||
      body.body ||
      body.Body ||
      (body.message && body.message.conversation) ||
      '';

    if (!messageText || typeof messageText !== 'string') {
      return NextResponse.json(
        { error: 'messageText is required' },
        { status: 400 }
      );
    }

    const result = await processMerchantWhatsAppMessage(senderPhone, messageText);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('WhatsApp Copilot API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/whatsapp-copilot?phone=...&msg=...
 * Useful for easy testing via browser or health check
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone') || '01712345678';
    const msg = searchParams.get('msg') || searchParams.get('text') || 'মেনু';

    const result = await processMerchantWhatsAppMessage(phone, msg);

    return NextResponse.json({
      success: true,
      endpoint: '/api/whatsapp-copilot',
      testQuery: { phone, msg },
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
