import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

/**
 * Shared ioredis client singleton.
 *
 * Used by RedisSafeModeStore and any other Redis consumers.
 * Connection errors are logged but do not crash the process — the app
 * can run without Redis (Safe Mode will fall back gracefully).
 */

let _redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (_redisClient) return _redisClient;

  _redisClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.info('Redis unavailable — disabling retries and using in-memory store');
        return null; // Stop retrying when Redis is not hosted
      }
      return Math.min(times * 200, 1000);
    },
    enableOfflineQueue: false,
    lazyConnect: false,
    enableReadyCheck: true,
  });

  _redisClient.on('connect', () => {
    logger.info('Redis connected');
  });

  _redisClient.on('error', (err) => {
    // Quiet error logging when retries finish
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('Connection is closed')) {
      logger.warn(`Redis connection unavailable: ${msg}`);
    }
  });

  _redisClient.on('reconnecting', () => {
    // Only log reconnecting during early attempts
  });

  return _redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (_redisClient) {
    await _redisClient.quit().catch(() => _redisClient?.disconnect());
    _redisClient = null;
  }
}
