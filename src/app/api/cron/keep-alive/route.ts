import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { saasRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * GET / POST /api/cron/keep-alive
 * 
 * Pings Supabase PostgreSQL and Upstash Redis to keep them active.
 * Prevents Supabase Free Tier from pausing after 7 days of inactivity.
 * Can be triggered daily/hourly via Vercel Cron, GitHub Actions, or cron-job.org.
 */
export async function GET(req: NextRequest) {
  return handleKeepAlive(req);
}

export async function POST(req: NextRequest) {
  return handleKeepAlive(req);
}

async function handleKeepAlive(req: NextRequest) {
  const startTime = Date.now();
  const results: {
    postgres: { status: string; latencyMs?: number; dbTime?: string; error?: string };
    redis: { status: string; latencyMs?: number; response?: string; error?: string };
    timestamp: string;
    totalDurationMs: number;
  } = {
    postgres: { status: 'pending' },
    redis: { status: 'pending' },
    timestamp: new Date().toISOString(),
    totalDurationMs: 0,
  };

  // Optional Secret Validation: if CRON_SECRET is configured, check token (allow bypassing in development or if desired)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && process.env.REQUIRE_CRON_AUTH === 'true') {
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const secretParam = searchParams.get('secret') || req.headers.get('x-cron-secret');

    const isAuthorized =
      authHeader === `Bearer ${cronSecret}` ||
      secretParam === cronSecret ||
      process.env.NODE_ENV !== 'production';

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
    }
  }

  // 1. Ping Supabase PostgreSQL
  const pgStart = Date.now();
  try {
    const pgRes = await query<{ current_time: string; db_name: string }>(
      'SELECT NOW() as current_time, current_database() as db_name;'
    );
    results.postgres = {
      status: 'active',
      latencyMs: Date.now() - pgStart,
      dbTime: pgRes.rows[0]?.current_time,
    };
  } catch (error: any) {
    console.error('[Keep-Alive] Supabase PostgreSQL ping failed:', error);
    results.postgres = {
      status: 'error',
      latencyMs: Date.now() - pgStart,
      error: error.message || 'PostgreSQL connection failed',
    };
  }

  // 2. Ping Upstash Redis
  const redisStart = Date.now();
  try {
    const pingResponse = await saasRedis.ping();
    results.redis = {
      status: 'active',
      latencyMs: Date.now() - redisStart,
      response: pingResponse,
    };
  } catch (error: any) {
    console.error('[Keep-Alive] Upstash Redis ping failed:', error);
    results.redis = {
      status: 'error',
      latencyMs: Date.now() - redisStart,
      error: error.message || 'Redis ping failed',
    };
  }

  results.totalDurationMs = Date.now() - startTime;

  const isHealthy = results.postgres.status === 'active' && results.redis.status === 'active';

  return NextResponse.json(
    {
      success: isHealthy,
      message: isHealthy
        ? 'Supabase PostgreSQL & Upstash Redis pinged successfully. Activity refreshed!'
        : 'Keep-alive completed with some warnings/errors.',
      ...results,
    },
    { status: isHealthy ? 200 : 207 }
  );
}
