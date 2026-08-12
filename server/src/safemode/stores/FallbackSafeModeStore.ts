import type { Redis } from 'ioredis';
import { ISafeModeStore, SafeModeTier } from '../types';
import { RedisSafeModeStore } from './RedisSafeModeStore';
import { MemorySafeModeStore } from './MemorySafeModeStore';
import { logger } from '../../config/logger';

/**
 * FallbackSafeModeStore
 *
 * Wraps RedisSafeModeStore as primary and MemorySafeModeStore as fallback.
 * If Redis is unavailable or an operation throws a Redis connection error,
 * it dynamically routes calls to the in-memory store so the server stays operational.
 */
export class FallbackSafeModeStore implements ISafeModeStore {
  private readonly primary: RedisSafeModeStore;
  private readonly fallback: MemorySafeModeStore;
  private useFallback = false;

  constructor(redisClient: Redis) {
    this.primary = new RedisSafeModeStore(redisClient);
    this.fallback = new MemorySafeModeStore();

    redisClient.on('error', () => {
      if (!this.useFallback) {
        logger.warn('Redis unavailable — Safe Mode falling back to MemorySafeModeStore');
        this.useFallback = true;
      }
    });

    redisClient.on('ready', () => {
      if (this.useFallback) {
        logger.info('Redis connection restored — Safe Mode returning to RedisSafeModeStore');
        this.useFallback = false;
      }
    });
  }

  private async exec<T>(op: (store: ISafeModeStore) => Promise<T>): Promise<T> {
    if (this.useFallback) {
      return op(this.fallback);
    }
    try {
      return await op(this.primary);
    } catch (err) {
      if (!this.useFallback) {
        logger.warn('Redis store operation failed — falling back to memory store', {
          err: err instanceof Error ? err.message : String(err),
        });
        this.useFallback = true;
      }
      return op(this.fallback);
    }
  }

  isEnabled(phoneId: string): Promise<boolean> {
    return this.exec((s) => s.isEnabled(phoneId));
  }

  setEnabled(phoneId: string, enabled: boolean): Promise<void> {
    return this.exec((s) => s.setEnabled(phoneId, enabled));
  }

  getTier(phoneId: string): Promise<SafeModeTier> {
    return this.exec((s) => s.getTier(phoneId));
  }

  setTier(phoneId: string, tier: SafeModeTier): Promise<void> {
    return this.exec((s) => s.setTier(phoneId, tier));
  }

  getStartedAt(phoneId: string): Promise<string | null> {
    return this.exec((s) => s.getStartedAt(phoneId));
  }

  setStartedAt(phoneId: string, isoDate: string): Promise<void> {
    return this.exec((s) => s.setStartedAt(phoneId, isoDate));
  }

  getSentToday(phoneId: string): Promise<number> {
    return this.exec((s) => s.getSentToday(phoneId));
  }

  incrementSentToday(phoneId: string): Promise<number> {
    return this.exec((s) => s.incrementSentToday(phoneId));
  }

  getNewChatsToday(phoneId: string): Promise<number> {
    return this.exec((s) => s.getNewChatsToday(phoneId));
  }

  incrementNewChatsToday(phoneId: string): Promise<number> {
    return this.exec((s) => s.incrementNewChatsToday(phoneId));
  }

  setKnownChatCount(phoneId: string, count: number): Promise<void> {
    return this.exec((s) => s.setKnownChatCount(phoneId, count));
  }

  getKnownChatCount(phoneId: string): Promise<number> {
    return this.exec((s) => s.getKnownChatCount(phoneId));
  }

  hasSeenJid(phoneId: string, toJid: string): Promise<boolean> {
    return this.exec((s) => s.hasSeenJid(phoneId, toJid));
  }

  markJidSeen(phoneId: string, toJid: string): Promise<void> {
    return this.exec((s) => s.markJidSeen(phoneId, toJid));
  }

  getLastSentAt(phoneId: string): Promise<number | null> {
    return this.exec((s) => s.getLastSentAt(phoneId));
  }

  setLastSentAt(phoneId: string, tsMs: number): Promise<void> {
    return this.exec((s) => s.setLastSentAt(phoneId, tsMs));
  }

  incrementReplies(phoneId: string): Promise<number> {
    return this.exec((s) => s.incrementReplies(phoneId));
  }

  getTotalReplies(phoneId: string): Promise<number> {
    return this.exec((s) => s.getTotalReplies(phoneId));
  }

  incrementTotalSent(phoneId: string): Promise<number> {
    return this.exec((s) => s.incrementTotalSent(phoneId));
  }

  getTotalSent(phoneId: string): Promise<number> {
    return this.exec((s) => s.getTotalSent(phoneId));
  }

  reset(phoneId: string): Promise<void> {
    return this.exec((s) => s.reset(phoneId));
  }
}
