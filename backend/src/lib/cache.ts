import { createClient, RedisClientType } from "redis";

/**
 * Cache configuration
 */
const CACHE_TTL = {
  PRODUCTS: 60 * 5, // 5 minutes
  PRODUCT_DETAIL: 60 * 5, // 5 minutes
  CUSTOMER_PRICES: 60 * 10, // 10 minutes
  SESSION: 60 * 15, // 15 minutes
  STOCK_LEVELS: 60, // 1 minute (more volatile)
};

/**
 * Cache key prefixes
 */
const CACHE_PREFIX = {
  PRODUCTS: "products:",
  PRODUCT: "product:",
  CUSTOMER_PRICES: "customer_prices:",
  SESSION: "session:",
  STOCK: "stock:",
};

/**
 * Redis cache manager with fallback to in-memory cache
 */
class CacheManager {
  private redis: RedisClientType | null = null;
  private memoryCache: Map<string, { value: any; expiry: number }> = new Map();
  private isRedisAvailable = false;

  /**
   * Initialize cache connection
   */
  async connect(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.log("📦 Cache: Using in-memory cache (REDIS_URL not configured)");
      return;
    }

    try {
      this.redis = createClient({ url: redisUrl });

      this.redis.on("error", (err) => {
        console.error("Redis connection error:", err);
        this.isRedisAvailable = false;
      });

      this.redis.on("connect", () => {
        console.log("🔴 Redis: Connected successfully");
        this.isRedisAvailable = true;
      });

      this.redis.on("reconnecting", () => {
        console.log("🔴 Redis: Reconnecting...");
      });

      await this.redis.connect();
      this.isRedisAvailable = true;
    } catch (error) {
      console.warn("⚠️ Redis connection failed, using in-memory cache:", error);
      this.isRedisAvailable = false;
    }
  }

  /**
   * Disconnect from cache
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
      this.redis = null;
      this.isRedisAvailable = false;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.isRedisAvailable && this.redis) {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : null;
      }

      // Fallback to memory cache
      const cached = this.memoryCache.get(key);
      if (cached && cached.expiry > Date.now()) {
        return cached.value as T;
      }

      // Expired, remove from cache
      if (cached) {
        this.memoryCache.delete(key);
      }

      return null;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);

      if (this.isRedisAvailable && this.redis) {
        await this.redis.setEx(key, ttlSeconds, serialized);
        return;
      }

      // Fallback to memory cache
      this.memoryCache.set(key, {
        value,
        expiry: Date.now() + ttlSeconds * 1000,
      });
    } catch (error) {
      console.error("Cache set error:", error);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      if (this.isRedisAvailable && this.redis) {
        await this.redis.del(key);
        return;
      }

      this.memoryCache.delete(key);
    } catch (error) {
      console.error("Cache delete error:", error);
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      if (this.isRedisAvailable && this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
        return;
      }

      // Fallback: delete matching keys from memory cache
      const regex = new RegExp(pattern.replace("*", ".*"));
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
        }
      }
    } catch (error) {
      console.error("Cache deletePattern error:", error);
    }
  }

  /**
   * Get or set cache value (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const value = await fetchFn();

    // Cache the result
    await this.set(key, value, ttlSeconds);

    return value;
  }

  /**
   * Clear all cache (for testing or maintenance)
   */
  async clear(): Promise<void> {
    try {
      if (this.isRedisAvailable && this.redis) {
        await this.redis.flushDb();
        return;
      }

      this.memoryCache.clear();
    } catch (error) {
      console.error("Cache clear error:", error);
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.isRedisAvailable || true; // Always true because we have memory fallback
  }

  // ========== Domain-specific cache methods ==========

  /**
   * Cache products list
   */
  async cacheProducts(
    tenantId: string,
    params: Record<string, any>,
    products: any
  ): Promise<void> {
    const key = `${CACHE_PREFIX.PRODUCTS}${tenantId}:${this.hashParams(params)}`;
    await this.set(key, products, CACHE_TTL.PRODUCTS);
  }

  /**
   * Get cached products list
   */
  async getCachedProducts(
    tenantId: string,
    params: Record<string, any>
  ): Promise<any | null> {
    const key = `${CACHE_PREFIX.PRODUCTS}${tenantId}:${this.hashParams(params)}`;
    return this.get(key);
  }

  /**
   * Cache single product
   */
  async cacheProduct(productId: string, product: any): Promise<void> {
    const key = `${CACHE_PREFIX.PRODUCT}${productId}`;
    await this.set(key, product, CACHE_TTL.PRODUCT_DETAIL);
  }

  /**
   * Get cached product
   */
  async getCachedProduct(productId: string): Promise<any | null> {
    const key = `${CACHE_PREFIX.PRODUCT}${productId}`;
    return this.get(key);
  }

  /**
   * Cache customer prices
   */
  async cacheCustomerPrices(
    customerId: string,
    prices: any
  ): Promise<void> {
    const key = `${CACHE_PREFIX.CUSTOMER_PRICES}${customerId}`;
    await this.set(key, prices, CACHE_TTL.CUSTOMER_PRICES);
  }

  /**
   * Get cached customer prices
   */
  async getCachedCustomerPrices(customerId: string): Promise<any | null> {
    const key = `${CACHE_PREFIX.CUSTOMER_PRICES}${customerId}`;
    return this.get(key);
  }

  /**
   * Cache user session
   */
  async cacheSession(userId: string, session: any): Promise<void> {
    const key = `${CACHE_PREFIX.SESSION}${userId}`;
    await this.set(key, session, CACHE_TTL.SESSION);
  }

  /**
   * Get cached session
   */
  async getCachedSession(userId: string): Promise<any | null> {
    const key = `${CACHE_PREFIX.SESSION}${userId}`;
    return this.get(key);
  }

  /**
   * Invalidate session cache
   */
  async invalidateSession(userId: string): Promise<void> {
    const key = `${CACHE_PREFIX.SESSION}${userId}`;
    await this.delete(key);
  }

  /**
   * Cache stock levels
   */
  async cacheStockLevels(tenantId: string, levels: any): Promise<void> {
    const key = `${CACHE_PREFIX.STOCK}${tenantId}`;
    await this.set(key, levels, CACHE_TTL.STOCK_LEVELS);
  }

  /**
   * Get cached stock levels
   */
  async getCachedStockLevels(tenantId: string): Promise<any | null> {
    const key = `${CACHE_PREFIX.STOCK}${tenantId}`;
    return this.get(key);
  }

  /**
   * Invalidate all product caches for a tenant
   */
  async invalidateProductCache(tenantId: string): Promise<void> {
    await this.deletePattern(`${CACHE_PREFIX.PRODUCTS}${tenantId}:*`);
  }

  /**
   * Invalidate specific product cache
   */
  async invalidateProductDetailCache(productId: string): Promise<void> {
    await this.delete(`${CACHE_PREFIX.PRODUCT}${productId}`);
  }

  /**
   * Invalidate customer price cache
   */
  async invalidateCustomerPriceCache(customerId: string): Promise<void> {
    await this.delete(`${CACHE_PREFIX.CUSTOMER_PRICES}${customerId}`);
  }

  /**
   * Invalidate stock cache for tenant
   */
  async invalidateStockCache(tenantId: string): Promise<void> {
    await this.delete(`${CACHE_PREFIX.STOCK}${tenantId}`);
  }

  /**
   * Hash params for cache key
   */
  private hashParams(params: Record<string, any>): string {
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}:${JSON.stringify(params[k])}`)
      .join("|");
    return Buffer.from(sorted).toString("base64").slice(0, 32);
  }
}

// Export singleton instance
export const cache = new CacheManager();

// Export TTLs for external use
export { CACHE_TTL, CACHE_PREFIX };
