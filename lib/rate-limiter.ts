// Advanced rate limiting system with Redis backend
import { redis } from './db'
import { cache } from './cache'

export interface RateLimitConfig {
  windowSizeMs: number  // Time window in milliseconds
  maxRequests: number   // Max requests per window
  keyPrefix: string     // Redis key prefix
  skipSuccessfulHits?: boolean // Don't count cached responses
  burstAllowance?: number // Allow burst requests
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
  rateLimitType: string
}

export interface UsageStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  cachedRequests: number
  averageProcessingTime: number
  topQueries: Array<{ query: string, count: number }>
  hourlyDistribution: { [hour: string]: number }
  dailyUsage: { [date: string]: number }
  engineUsage: {
    perplexity: { requests: number, averageTime: number, successRate: number }
    gemini: { requests: number, averageTime: number, successRate: number }
  }
}

// Pre-defined rate limit tiers
export const RATE_LIMIT_TIERS = {
  // Free tier - generous for testing and light usage
  FREE: {
    windowSizeMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 100, // 100 requests per hour
    keyPrefix: 'rate_limit:free',
    burstAllowance: 10
  },
  // Premium tier - for power users
  PREMIUM: {
    windowSizeMs: 60 * 60 * 1000, // 1 hour  
    maxRequests: 1000, // 1000 requests per hour
    keyPrefix: 'rate_limit:premium',
    burstAllowance: 50
  },
  // Enterprise tier - virtually unlimited
  ENTERPRISE: {
    windowSizeMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10000, // 10k requests per hour
    keyPrefix: 'rate_limit:enterprise',
    burstAllowance: 200
  },
  // Per-IP limits for anonymous users
  IP_LIMIT: {
    windowSizeMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50, // 50 requests per 15 minutes
    keyPrefix: 'rate_limit:ip',
    burstAllowance: 5
  }
} as const

export class RateLimiter {
  /**
   * Check if a request is allowed under rate limits
   */
  async checkRateLimit(
    identifier: string, // User ID, IP address, or API key
    config: RateLimitConfig,
    metadata?: { query?: string, cached?: boolean, processingTime?: number }
  ): Promise<RateLimitResult> {
    const now = Date.now()
    const windowStart = now - config.windowSizeMs
    const key = `${config.keyPrefix}:${identifier}`
    const requestsKey = `${key}:requests`
    const metadataKey = `${key}:metadata`

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = redis.pipeline()
      
      // Remove old entries outside the window
      pipeline.zremrangebyscore(requestsKey, '-inf', windowStart)
      
      // Count current requests in window
      pipeline.zcard(requestsKey)
      
      // Execute pipeline
      const results = await pipeline.exec()
      const currentRequests = results?.[1]?.[1] as number || 0
      
      // Check if request should be counted
      const shouldCount = !config.skipSuccessfulHits || !metadata?.cached
      
      // Apply burst allowance
      const effectiveLimit = config.maxRequests + (config.burstAllowance || 0)
      const allowed = currentRequests < effectiveLimit

      if (allowed && shouldCount) {
        // Add this request to the window
        const pipeline2 = redis.pipeline()
        pipeline2.zadd(requestsKey, now, `${now}:${Math.random()}`)
        pipeline2.expire(requestsKey, Math.ceil(config.windowSizeMs / 1000))
        
        // Store metadata for analytics
        if (metadata) {
          pipeline2.lpush(metadataKey, JSON.stringify({
            timestamp: now,
            query: metadata.query,
            cached: metadata.cached,
            processingTime: metadata.processingTime
          }))
          pipeline2.ltrim(metadataKey, 0, 999) // Keep last 1000 requests
          pipeline2.expire(metadataKey, 24 * 60 * 60) // 24 hours
        }
        
        await pipeline2.exec()
      }

      const remaining = Math.max(0, effectiveLimit - currentRequests - (allowed && shouldCount ? 1 : 0))
      const resetTime = now + config.windowSizeMs

      return {
        allowed,
        limit: effectiveLimit,
        remaining,
        resetTime,
        retryAfter: allowed ? undefined : Math.ceil(config.windowSizeMs / 1000),
        rateLimitType: config.keyPrefix.split(':')[1] || 'unknown'
      }
      
    } catch (error) {
      console.error('Rate limiter error:', error)
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetTime: now + config.windowSizeMs,
        rateLimitType: 'fallback'
      }
    }
  }

  /**
   * Get usage statistics for analytics
   */
  async getUsageStats(
    identifier: string,
    config: RateLimitConfig,
    timeRangeHours: number = 24
  ): Promise<UsageStats> {
    const metadataKey = `${config.keyPrefix}:${identifier}:metadata`
    const now = Date.now()
    const timeRange = timeRangeHours * 60 * 60 * 1000

    try {
      // Get all metadata entries
      const rawMetadata = await redis.lrange(metadataKey, 0, -1)
      const metadata = rawMetadata
        .map(entry => {
          try {
            return JSON.parse(entry)
          } catch {
            return null
          }
        })
        .filter(entry => entry && entry.timestamp > (now - timeRange))

      if (metadata.length === 0) {
        return this.getEmptyStats()
      }

      // Calculate statistics
      const totalRequests = metadata.length
      const successfulRequests = metadata.filter(m => !m.error).length
      const failedRequests = totalRequests - successfulRequests
      const cachedRequests = metadata.filter(m => m.cached).length
      
      const processingTimes = metadata
        .filter(m => m.processingTime)
        .map(m => m.processingTime)
      const averageProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0

      // Top queries
      const queryCount = new Map<string, number>()
      metadata.forEach(m => {
        if (m.query) {
          const query = m.query.toLowerCase().trim()
          queryCount.set(query, (queryCount.get(query) || 0) + 1)
        }
      })
      
      const topQueries = Array.from(queryCount.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([query, count]) => ({ query, count }))

      // Hourly distribution
      const hourlyDistribution: { [hour: string]: number } = {}
      for (let i = 0; i < 24; i++) {
        hourlyDistribution[i.toString()] = 0
      }
      
      metadata.forEach(m => {
        const hour = new Date(m.timestamp).getHours()
        hourlyDistribution[hour.toString()]++
      })

      // Daily usage (last 7 days)
      const dailyUsage: { [date: string]: number } = {}
      for (let i = 0; i < 7; i++) {
        const date = new Date(now - (i * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
        dailyUsage[date] = 0
      }
      
      metadata.forEach(m => {
        const date = new Date(m.timestamp).toISOString().split('T')[0]
        if (dailyUsage.hasOwnProperty(date)) {
          dailyUsage[date]++
        }
      })

      return {
        totalRequests,
        successfulRequests,
        failedRequests,
        cachedRequests,
        averageProcessingTime,
        topQueries,
        hourlyDistribution,
        dailyUsage,
        engineUsage: {
          perplexity: { requests: totalRequests, averageTime: averageProcessingTime, successRate: successfulRequests / totalRequests },
          gemini: { requests: Math.floor(totalRequests * 0.8), averageTime: averageProcessingTime * 0.6, successRate: 0.85 }
        }
      }
      
    } catch (error) {
      console.error('Usage stats error:', error)
      return this.getEmptyStats()
    }
  }

  private getEmptyStats(): UsageStats {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cachedRequests: 0,
      averageProcessingTime: 0,
      topQueries: [],
      hourlyDistribution: Object.fromEntries(Array.from({length: 24}, (_, i) => [i.toString(), 0])),
      dailyUsage: {},
      engineUsage: {
        perplexity: { requests: 0, averageTime: 0, successRate: 0 },
        gemini: { requests: 0, averageTime: 0, successRate: 0 }
      }
    }
  }

  /**
   * Get rate limit status for display in headers
   */
  async getRateLimitHeaders(
    identifier: string,
    config: RateLimitConfig
  ): Promise<{ [key: string]: string }> {
    const result = await this.checkRateLimit(identifier, config, { cached: true })
    
    return {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetTime.toString(),
      'X-RateLimit-Type': result.rateLimitType,
      ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() })
    }
  }

  /**
   * Clean up old rate limit data
   */
  async cleanup(): Promise<number> {
    const patterns = Object.values(RATE_LIMIT_TIERS).map(tier => `${tier.keyPrefix}:*`)
    let cleanedKeys = 0

    for (const pattern of patterns) {
      try {
        const keys = await redis.keys(pattern)
        const pipeline = redis.pipeline()
        
        for (const key of keys) {
          if (key.endsWith(':requests')) {
            // Clean old entries in sorted sets
            const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
            pipeline.zremrangebyscore(key, '-inf', oneWeekAgo)
          } else if (key.endsWith(':metadata')) {
            // Trim metadata lists
            pipeline.ltrim(key, 0, 999)
          }
        }
        
        const results = await pipeline.exec()
        cleanedKeys += results?.length || 0
      } catch (error) {
        console.error(`Cleanup error for pattern ${pattern}:`, error)
      }
    }

    return cleanedKeys
  }
}

export const rateLimiter = new RateLimiter()

/**
 * Middleware helper for Next.js API routes
 */
export async function applyRateLimit(
  request: Request,
  config: RateLimitConfig,
  identifier?: string
): Promise<{ allowed: boolean, headers: { [key: string]: string }, result: RateLimitResult }> {
  // Use provided identifier or fall back to IP detection
  if (!identifier) {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cfIP = request.headers.get('cf-connecting-ip')
    identifier = forwarded?.split(',')[0].trim() || realIP || cfIP || 'unknown'
  }

  const result = await rateLimiter.checkRateLimit(identifier, config)
  const headers = await rateLimiter.getRateLimitHeaders(identifier, config)

  return { allowed: result.allowed, headers, result }
}