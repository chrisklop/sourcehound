import { redis } from './db'
import crypto from 'crypto'

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  prefix?: string
  compress?: boolean
}

const DEFAULT_TTL = 3600 // 1 hour
const DEFAULT_PREFIX = 'sourcehound'

export class Cache {
  private getKey(key: string, prefix?: string): string {
    return `${prefix || DEFAULT_PREFIX}:${key}`
  }

  private hashQuery(query: string): string {
    return crypto.createHash('sha256').update(query.toLowerCase().trim()).digest('hex').slice(0, 16)
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const fullKey = this.getKey(key, options.prefix)
      const value = await redis.get(fullKey)
      
      if (!value) return null
      
      const parsed = JSON.parse(value)
      
      // Update access time for LRU tracking
      await redis.expire(fullKey, options.ttl || DEFAULT_TTL)
      
      return parsed.data
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.getKey(key, options.prefix)
      const ttl = options.ttl || DEFAULT_TTL
      
      const cacheData = {
        data: value,
        timestamp: Date.now(),
        ttl
      }
      
      await redis.setex(fullKey, ttl, JSON.stringify(cacheData))
      return true
    } catch (error) {
      console.error('Cache set error:', error)
      return false
    }
  }

  async del(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.getKey(key, options.prefix)
      const result = await redis.del(fullKey)
      return result > 0
    } catch (error) {
      console.error('Cache delete error:', error)
      return false
    }
  }

  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.getKey(key, options.prefix)
      const result = await redis.exists(fullKey)
      return result === 1
    } catch (error) {
      console.error('Cache exists error:', error)
      return false
    }
  }

  // Fact-check specific methods
  async getFactCheck(query: string): Promise<any | null> {
    const hash = this.hashQuery(query)
    return this.get(hash, { prefix: 'factcheck', ttl: 86400 }) // 24 hours
  }

  async setFactCheck(query: string, result: any): Promise<boolean> {
    const hash = this.hashQuery(query)
    return this.set(hash, result, { prefix: 'factcheck', ttl: 86400 })
  }

  // Similar query matching for fact-checks
  async findSimilarFactCheck(query: string, threshold = 0.8): Promise<any | null> {
    try {
      // Get all fact-check keys
      const pattern = this.getKey('*', 'factcheck')
      const keys = await redis.keys(pattern)
      
      const queryWords = new Set(query.toLowerCase().split(/\s+/))
      let bestMatch = null
      let bestSimilarity = 0
      
      for (const key of keys.slice(0, 100)) { // Limit search
        try {
          const cached = await redis.get(key)
          if (!cached) continue
          
          const data = JSON.parse(cached)
          if (!data.originalQuery) continue
          
          // Simple word-based similarity
          const cachedWords = new Set(data.originalQuery.toLowerCase().split(/\s+/))
          const intersection = new Set([...queryWords].filter(x => cachedWords.has(x)))
          const union = new Set([...queryWords, ...cachedWords])
          const similarity = intersection.size / union.size
          
          if (similarity > threshold && similarity > bestSimilarity) {
            bestSimilarity = similarity
            bestMatch = {
              ...data.data,
              similarity,
              originalQuery: data.originalQuery
            }
          }
        } catch (err) {
          continue // Skip invalid entries
        }
      }
      
      return bestMatch
    } catch (error) {
      console.error('Similar fact-check search error:', error)
      return null
    }
  }

  // Session management
  async getSession(sessionId: string): Promise<any | null> {
    return this.get(sessionId, { prefix: 'session', ttl: 604800 }) // 7 days
  }

  async setSession(sessionId: string, data: any): Promise<boolean> {
    return this.set(sessionId, data, { prefix: 'session', ttl: 604800 })
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.del(sessionId, { prefix: 'session' })
  }

  // Bulk operations
  async clearByPattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(`${DEFAULT_PREFIX}:${pattern}`)
      if (keys.length === 0) return 0
      
      const result = await redis.del(...keys)
      return result
    } catch (error) {
      console.error('Cache clear by pattern error:', error)
      return 0
    }
  }

  async getStats(): Promise<any> {
    try {
      const info = await redis.info('memory')
      const keyCount = await redis.dbsize()
      
      return {
        keyCount,
        memoryUsage: info.match(/used_memory_human:(.+)/)?.[1]?.trim(),
        connected: true
      }
    } catch (error) {
      return { connected: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}

export const cache = new Cache()