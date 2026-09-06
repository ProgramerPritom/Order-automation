import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.warn('⚠️ Warning: Upstash Redis REST credentials missing.');
}

export const rawRedis = new Redis({
  url: url || '',
  token: token || '',
});

/**
 * Isolated Redis Client under `saas:*` namespace
 */
export const saasRedis = {
  prefixKey(key: string): string {
    return key.startsWith('saas:') ? key : `saas:${key}`;
  },

  async get<T = any>(key: string): Promise<T | null> {
    return rawRedis.get<T>(this.prefixKey(key));
  },

  async set(key: string, value: any, opts?: { ex?: number }): Promise<string | null> {
    if (opts?.ex) {
      return rawRedis.set(this.prefixKey(key), value, { ex: opts.ex });
    }
    return rawRedis.set(this.prefixKey(key), value);
  },

  async del(key: string): Promise<number> {
    return rawRedis.del(this.prefixKey(key));
  },

  async incr(key: string): Promise<number> {
    return rawRedis.incr(this.prefixKey(key));
  },

  async expire(key: string, seconds: number): Promise<number> {
    return rawRedis.expire(this.prefixKey(key), seconds);
  },

  async lpush(key: string, ...elements: any[]): Promise<number> {
    return rawRedis.lpush(this.prefixKey(key), ...elements);
  },

  async rpop<T = any>(key: string): Promise<T | null> {
    return rawRedis.rpop<T>(this.prefixKey(key));
  },

  async llen(key: string): Promise<number> {
    return rawRedis.llen(this.prefixKey(key));
  },

  async lrange<T = any>(key: string, start: number, stop: number): Promise<T[]> {
    return rawRedis.lrange<T>(this.prefixKey(key), start, stop);
  },

  async ping(): Promise<string> {
    return rawRedis.ping();
  },
};
