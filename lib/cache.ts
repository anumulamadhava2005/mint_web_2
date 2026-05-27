import { createClient, type RedisClientType } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let client: RedisClientType | null = null;
let connectionFailed = false;
let lastConnectAttempt = 0;
const RECONNECT_INTERVAL_MS = 5000;

async function getClient(): Promise<RedisClientType | null> {
  if (client) return client;
  // Allow reconnect attempts after a cooldown
  const now = Date.now();
  if (connectionFailed && now - lastConnectAttempt < RECONNECT_INTERVAL_MS) return null;
  lastConnectAttempt = now;
  try {
    connectionFailed = false;
    client = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy() {
          // Fail fast on connection loss/failure; getClient handles reconnect attempts via cooldown
          return false;
        },
        connectTimeout: 1000,
      }
    }) as RedisClientType;
    client.on("error", () => {
      connectionFailed = true;
      client = null;
    });
    await client.connect();
    return client;
  } catch {
    connectionFailed = true;
    client = null;
    return null;
  }
}

// TTL presets (seconds)
export const TTL = {
  SESSION: 300,       // 5 min — validate-token results
  PROJECT_META: 60,   // 1 min — project ownership / is_public checks
  DESIGN_DATA: 30,    // 30s — design-data / mobile-config (polled)
  COMMIT_VERSION: 10, // 10s — latest commit version (sync polling)
} as const;

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = await getClient();
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    if (!val) return null;
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = await getClient();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    // Non-fatal: cache miss is acceptable
  }
}

export async function cacheInvalidate(...keys: string[]): Promise<void> {
  const redis = await getClient();
  if (!redis) return;
  try {
    if (keys.length > 0) await redis.del(keys);
  } catch {
    // Non-fatal
  }
}

export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  const redis = await getClient();
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(keys);
  } catch {
    // Non-fatal
  }
}

// Convenience: get-or-set with TTL
export async function cacheable<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const fresh = await fetcher();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

/**
 * Cache stampede prevention via Redis SETNX lock.
 * When a hot key expires and many requests arrive simultaneously,
 * only one request runs the fetcher. Others wait and use the fresh value.
 */
export async function cacheableWithLock<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
  lockTimeoutMs: number = 5000,
): Promise<T> {
  // Fast path: cache hit
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const redis = await getClient();
  if (!redis) {
    // Redis down — fall through to direct fetch
    return fetcher();
  }

  const lockKey = `lock:${key}`;
  try {
    // Try to acquire lock (SETNX with expiry)
    const acquired = await redis.set(lockKey, "1", { NX: true, PX: lockTimeoutMs });

    if (acquired) {
      // We won the lock — execute fetcher and populate cache
      try {
        const fresh = await fetcher();
        await cacheSet(key, fresh, ttlSeconds);
        return fresh;
      } finally {
        await redis.del(lockKey).catch(() => {});
      }
    }

    // Another request holds the lock — wait for it to populate cache
    const deadline = Date.now() + lockTimeoutMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
      const val = await cacheGet<T>(key);
      if (val !== null) return val;
    }

    // Timeout: fallback to direct fetch
    return fetcher();
  } catch {
    return fetcher();
  }
}

