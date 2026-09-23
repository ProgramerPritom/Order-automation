import { NextRequest, NextResponse } from 'next/server';
import { executeDataRetentionCleanup } from '@/lib/data-retention';

export const dynamic = 'force-dynamic';

/**
 * GET / POST /api/cron/data-retention
 * Automated cron trigger to purge customer messages older than 90/180 days
 * Complies with Meta Webhook Data Retention & GDPR requirements
 */
export async function GET(req: NextRequest) {
  return handleRetention(req);
}

export async function POST(req: NextRequest) {
  return handleRetention(req);
}

async function handleRetention(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const authHeader = req.headers.get('authorization');
    const secretParam = searchParams.get('secret') || req.headers.get('x-cron-secret');
    const cronSecret = process.env.CRON_SECRET || 'saas_cron_secret_key_2026';

    const isAuthorized =
      authHeader === `Bearer ${cronSecret}` ||
      secretParam === cronSecret ||
      process.env.NODE_ENV !== 'production';

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
    }

    const days = parseInt(searchParams.get('days') || process.env.DATA_RETENTION_DAYS || '90', 10);
    const tenantId = searchParams.get('tenantId') || undefined;

    const result = await executeDataRetentionCleanup(days, tenantId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Cron data retention exception:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
