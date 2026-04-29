// Upstash Redis REST API implementation
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  symbols: string;
  timeframe?: string;
}

export class RedisCache {
  private static instance: RedisCache;
  private readonly CACHE_TTL = 30; // 30 seconds

  static getInstance(): RedisCache {
    if (!RedisCache.instance) {
      RedisCache.instance = new RedisCache();
    }
    return RedisCache.instance;
  }

  private async makeRequest(command: string): Promise<any> {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
      console.warn('Redis not configured - missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
      return null;
    }

    try {
      const response = await fetch(`${UPSTASH_URL}/${command}`, {
        headers: {
          'Authorization': `Bearer ${UPSTASH_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Redis request failed: ${response.status}`);
      }

      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error('Redis request error:', error);
      return null;
    }
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const result = await this.makeRequest(`get/${encodeURIComponent(key)}`);
      if (!result) return null;

      // Parse JSON data
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      return parsed as CacheEntry<T>;
    } catch (error) {
      console.error('Redis cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      const value = JSON.stringify(entry);
      await this.makeRequest(`setex/${encodeURIComponent(key)}/${this.CACHE_TTL}/${encodeURIComponent(value)}`);
    } catch (error) {
      console.error('Redis cache set error:', error);
      // Don't throw - cache failures shouldn't break the app
    }
  }

  async invalidate(key: string): Promise<void> {
    try {
      await this.makeRequest(`del/${encodeURIComponent(key)}`);
    } catch (error) {
      console.error('Redis cache invalidate error:', error);
    }
  }

  // Generate cache key for market data
  static getMarketDataKey(symbols: string[], timeframe: string): string {
    const sortedSymbols = [...symbols].sort().join(',');
    return `market:bubbles:${sortedSymbols}:${timeframe}`;
  }
}

// Export singleton instance
export const redisCache = RedisCache.getInstance();