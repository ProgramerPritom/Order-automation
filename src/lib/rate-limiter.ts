import { saasRedis } from './redis';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Sliding window / fixed window rate limiter using Redis
 * @param identifier IP or TenantId or UserKey
 * @param limit Max requests allowed in window
 * @param windowSeconds Window duration in seconds
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 60,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;
  
  try {
    const current = await saasRedis.incr(key);
    
    // Set expiration on first hit
    if (current === 1) {
      await saasRedis.expire(key, windowSeconds);
    }

    const remaining = Math.max(0, limit - current);
    const success = current <= limit;

    return {
      success,
      limit,
      remaining,
      reset: windowSeconds,
    };
  } catch (error) {
    console.error('Rate limiter Redis error, allowing request through as fallback:', error);
    return {
      success: true,
      limit,
      remaining: 1,
      reset: windowSeconds,
    };
  }
}
