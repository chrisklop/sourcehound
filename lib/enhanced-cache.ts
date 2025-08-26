import { cache } from './cache'
import { db } from './db'
import crypto from 'crypto'

interface FactCheckResult {
  verdict: string
  confidence: number
  summary: string
  keyFindings: string[]
  sources: any[]
  factCheckReviews?: any[]
  explanation: string
  processingTime?: number
  timestamp: string
  cached?: boolean
  similarity?: number
}

interface CacheMetrics {
  hits: number
  misses: number
  hitRate: number
  totalQueries: number
  avgResponseTime: number
}

export class EnhancedFactCheckCache {
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalQueries: 0,
    avgResponseTime: 0
  }

  private generateQueryHash(query: string): string {
    // Normalize query for better matching
    const normalized = query.toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    return crypto.createHash('sha256').update(normalized).digest('hex')
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(/\s+/))
    const words2 = new Set(str2.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])
    
    return intersection.size / union.size
  }

  async get(query: string, options: { similarityThreshold?: number } = {}): Promise<FactCheckResult | null> {
    const startTime = Date.now()
    this.metrics.totalQueries++
    
    try {
      const queryHash = this.generateQueryHash(query)
      
      // Try exact match first from Redis
      let result = await cache.getFactCheck(query)
      if (result) {
        this.metrics.hits++
        this.updateMetrics(startTime)
        
        // Update hit count in database
        await db.factCheckCache.update({
          where: { queryHash },
          data: { 
            hitCount: { increment: 1 },
            lastHit: new Date()
          }
        }).catch(() => {}) // Ignore errors
        
        return {
          ...result,
          cached: true,
          similarity: 1.0
        }
      }

      // Try similarity search if exact match fails
      const { similarityThreshold = 0.85 } = options
      const similarResult = await this.findSimilarQuery(query, similarityThreshold)
      
      if (similarResult) {
        this.metrics.hits++
        this.updateMetrics(startTime)
        return {
          ...similarResult,
          cached: true,
          similarity: similarResult.similarity
        }
      }

      this.metrics.misses++
      this.updateMetrics(startTime)
      return null
      
    } catch (error) {
      console.error('Enhanced cache get error:', error)
      this.metrics.misses++
      this.updateMetrics(startTime)
      return null
    }
  }

  async set(query: string, result: FactCheckResult, options: { ttl?: number } = {}): Promise<boolean> {
    try {
      const queryHash = this.generateQueryHash(query)
      const { ttl = 86400 } = options // 24 hours default
      
      // Store in Redis for fast access
      const redisSuccess = await cache.setFactCheck(query, result)
      
      // Store in database for persistence and analytics
      try {
        await db.factCheckCache.upsert({
          where: { queryHash },
          update: {
            result: result as any,
            lastHit: new Date(),
            hitCount: { increment: 1 }
          },
          create: {
            queryHash,
            query,
            result: result as any,
            expiresAt: new Date(Date.now() + ttl * 1000),
            hitCount: 1
          }
        })
      } catch (dbError) {
        console.error('Database cache storage error:', dbError)
        // Continue even if DB fails, Redis is primary
      }
      
      return redisSuccess
    } catch (error) {
      console.error('Enhanced cache set error:', error)
      return false
    }
  }

  private async findSimilarQuery(query: string, threshold: number): Promise<any> {
    try {
      // Search recent database entries for similar queries
      const recentCaches = await db.factCheckCache.findMany({
        where: {
          expiresAt: { gt: new Date() },
          lastHit: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        },
        orderBy: { hitCount: 'desc' },
        take: 50 // Limit search scope
      })

      let bestMatch = null
      let bestSimilarity = 0

      for (const cached of recentCaches) {
        const similarity = this.calculateSimilarity(query, cached.query)
        
        if (similarity >= threshold && similarity > bestSimilarity) {
          bestSimilarity = similarity
          bestMatch = {
            ...(cached.result as any),
            similarity,
            originalQuery: cached.query
          }
        }
      }

      if (bestMatch) {
        // Also check if it's in Redis for faster future access
        const redisResult = await cache.getFactCheck(bestMatch.originalQuery)
        return redisResult || bestMatch
      }

      return null
    } catch (error) {
      console.error('Similar query search error:', error)
      return null
    }
  }

  private updateMetrics(startTime: number): void {
    const responseTime = Date.now() - startTime
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.totalQueries - 1) + responseTime) / 
      this.metrics.totalQueries
    
    this.metrics.hitRate = this.metrics.hits / this.metrics.totalQueries
  }

  async getMetrics(): Promise<CacheMetrics & { dbStats?: any }> {
    try {
      const dbStats = await db.factCheckCache.aggregate({
        _count: { id: true },
        _sum: { hitCount: true },
        _avg: { hitCount: true }
      })

      return {
        ...this.metrics,
        dbStats: {
          totalCachedQueries: dbStats._count.id,
          totalHits: dbStats._sum.hitCount,
          avgHitsPerQuery: dbStats._avg.hitCount
        }
      }
    } catch (error) {
      return this.metrics
    }
  }

  async cleanup(): Promise<number> {
    try {
      // Remove expired entries from database
      const result = await db.factCheckCache.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      })

      // Clean up low-hit entries older than 30 days
      const oldLowHitResult = await db.factCheckCache.deleteMany({
        where: {
          createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          hitCount: { lt: 3 }
        }
      })

      console.log(`Cleaned up ${result.count + oldLowHitResult.count} cache entries`)
      return result.count + oldLowHitResult.count
    } catch (error) {
      console.error('Cache cleanup error:', error)
      return 0
    }
  }

  // Advanced search with multiple strategies
  async intelligentSearch(query: string): Promise<FactCheckResult | null> {
    // Try different similarity thresholds
    const strategies = [
      { threshold: 0.95, name: 'exact' },
      { threshold: 0.85, name: 'high' },
      { threshold: 0.75, name: 'medium' },
      { threshold: 0.65, name: 'low' }
    ]

    for (const strategy of strategies) {
      const result = await this.get(query, { similarityThreshold: strategy.threshold })
      if (result) {
        console.log(`Cache hit with ${strategy.name} similarity: ${result.similarity}`)
        return result
      }
    }

    return null
  }
}

export const enhancedFactCheckCache = new EnhancedFactCheckCache()