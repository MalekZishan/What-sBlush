/**
 * Safe Mode singleton — shared across the entire server process.
 *
 * Imported by whatsapp.service.ts (socket wiring) and app.ts (router mount).
 * Using a module-level singleton ensures one instance of SafeModeManager
 * regardless of import order.
 */
import { SafeModeManager } from '../safemode/SafeModeManager';
import { FallbackSafeModeStore } from '../safemode/stores/FallbackSafeModeStore';
import { MemorySafeModeStore } from '../safemode/stores/MemorySafeModeStore';
import { getRedisClient } from './redis';
import { logger } from './logger';

let _safeModeManager: SafeModeManager | null = null;

export function getSafeModeManager(): SafeModeManager {
  if (_safeModeManager) return _safeModeManager;

  try {
    const redisClient = getRedisClient();
    const store = new FallbackSafeModeStore(redisClient);
    _safeModeManager = new SafeModeManager(store);
    logger.info('SafeModeManager initialized with FallbackSafeModeStore');
  } catch (err) {
    logger.warn('Failed to create SafeModeStore — falling back to MemorySafeModeStore', {
      err: err instanceof Error ? err.message : String(err),
    });
    _safeModeManager = new SafeModeManager(new MemorySafeModeStore());
  }

  return _safeModeManager;
}
