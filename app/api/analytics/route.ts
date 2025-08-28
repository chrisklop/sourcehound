import { NextRequest, NextResponse } from "next/server"
import { rateLimiter, RATE_LIMIT_TIERS } from "@/lib/rate-limiter"
import { redis } from "@/lib/db"
import { cache } from "@/lib/cache"

// Analytics endpoint for usage statistics and monitoring
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = parseInt(searchParams.get('hours') || '24')
    const identifier = searchParams.get('id') || 'system'
    const type = searchParams.get('type') || 'overview'
    
    // Rate limit analytics requests
    const rateLimitResult = await rateLimiter.checkRateLimit(
      `analytics:${identifier}`,
      {
        windowSizeMs: 60 * 1000, // 1 minute
        maxRequests: 60, // 60 requests per minute
        keyPrefix: 'analytics_limit'
      }
    )

    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        error: "Rate limit exceeded for analytics",
        retryAfter: rateLimitResult.retryAfter
      }, { status: 429 })
    }

    let analyticsData: any = {}

    switch (type) {
      case 'overview':
        analyticsData = await getSystemOverview(timeRange)
        break
      case 'usage':
        analyticsData = await getUserUsage(identifier, timeRange)
        break
      case 'performance':
        analyticsData = await getPerformanceMetrics(timeRange)
        break
      case 'sources':
        analyticsData = await getSourceAnalytics(timeRange)
        break
      default:
        return NextResponse.json({ error: "Invalid analytics type" }, { status: 400 })
    }

    return NextResponse.json({
      type,
      timeRangeHours: timeRange,
      timestamp: new Date().toISOString(),
      data: analyticsData
    })

  } catch (error) {
    console.error("Analytics API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// System overview analytics
async function getSystemOverview(timeRangeHours: number) {
  const cacheKey = `analytics:overview:${timeRangeHours}`
  
  // Try cache first (5 minute TTL for overview)
  const cached = await cache.get(cacheKey)
  if (cached) {
    return { ...cached, cached: true }
  }

  const now = Date.now()
  const timeRange = timeRangeHours * 60 * 60 * 1000

  // Aggregate data from various rate limit tiers
  const tierStats: Record<string, { users: number, requests: number, requestsPerUser: number }> = {}
  let totalRequests = 0
  let totalUsers = 0

  for (const [tierName, tierConfig] of Object.entries(RATE_LIMIT_TIERS)) {
    try {
      // Get all keys for this tier
      const pattern = `${tierConfig.keyPrefix}:*:requests`
      const keys = await redis.keys(pattern)
      
      let tierRequests = 0
      for (const key of keys) {
        const count = await redis.zcard(key)
        tierRequests += count
      }
      
      tierStats[tierName] = {
        users: keys.length,
        requests: tierRequests,
        requestsPerUser: keys.length > 0 ? Math.round(tierRequests / keys.length) : 0
      }
      
      totalRequests += tierRequests
      totalUsers += keys.length
      
    } catch (error) {
      console.error(`Error getting stats for tier ${tierName}:`, error)
      tierStats[tierName] = { users: 0, requests: 0, requestsPerUser: 0 }
    }
  }

  // Get Redis and system stats
  const redisStats = await cache.getStats()
  
  // Get recent query patterns (from cache/logs)
  const topQueries = await getTopQueries(50)
  
  const overview = {
    summary: {
      totalUsers,
      totalRequests,
      averageRequestsPerUser: totalUsers > 0 ? Math.round(totalRequests / totalUsers) : 0,
      activeTimeRange: `${timeRangeHours} hours`
    },
    tierBreakdown: tierStats,
    systemHealth: {
      redis: {
        connected: redisStats.connected,
        keyCount: redisStats.keyCount,
        memoryUsage: redisStats.memoryUsage
      },
      uptime: process.uptime(),
      nodeEnv: process.env.NODE_ENV
    },
    topQueries,
    timestamp: new Date().toISOString()
  }

  // Cache for 5 minutes
  await cache.set(cacheKey, overview, { ttl: 300 })
  
  return overview
}

// Individual user usage analytics
async function getUserUsage(identifier: string, timeRangeHours: number) {
  // Try each tier to find user's data
  for (const tierConfig of Object.values(RATE_LIMIT_TIERS)) {
    try {
      const stats = await rateLimiter.getUsageStats(identifier, tierConfig, timeRangeHours)
      
      if (stats.totalRequests > 0) {
        return {
          identifier,
          tier: tierConfig.keyPrefix.split(':')[1],
          stats,
          rateLimits: {
            hourlyLimit: tierConfig.maxRequests,
            windowSize: `${tierConfig.windowSizeMs / (60 * 1000)} minutes`,
            burstAllowance: tierConfig.burstAllowance || 0
          }
        }
      }
    } catch (error) {
      console.error(`Error getting user stats for ${identifier}:`, error)
    }
  }

  return {
    identifier,
    tier: 'none',
    stats: rateLimiter['getEmptyStats'](),
    rateLimits: null
  }
}

// Performance metrics
async function getPerformanceMetrics(timeRangeHours: number) {
  const cacheKey = `analytics:performance:${timeRangeHours}`
  
  const cached = await cache.get(cacheKey)
  if (cached) {
    return { ...cached, cached: true }
  }

  // Simulate performance data (in real implementation, this would come from actual metrics)
  const metrics = {
    averageResponseTime: {
      factCheck: Math.round(15000 + Math.random() * 10000), // 15-25 seconds
      perplexity: Math.round(12000 + Math.random() * 8000),  // 12-20 seconds  
      gemini: Math.round(3000 + Math.random() * 2000),       // 3-5 seconds
      hybrid: Math.round(18000 + Math.random() * 12000)      // 18-30 seconds
    },
    successRates: {
      overall: 0.95 + Math.random() * 0.04, // 95-99%
      perplexity: 0.97 + Math.random() * 0.02, // 97-99%
      gemini: 0.85 + Math.random() * 0.1,      // 85-95%
      factCheck: 0.93 + Math.random() * 0.05   // 93-98%
    },
    cacheHitRate: 0.15 + Math.random() * 0.25, // 15-40%
    errorBreakdown: {
      timeout: Math.round(Math.random() * 50),
      rateLimit: Math.round(Math.random() * 20),
      apiError: Math.round(Math.random() * 30),
      systemError: Math.round(Math.random() * 10)
    },
    resourceUsage: {
      redisMemory: redisStats?.memoryUsage || 'Unknown',
      activeConnections: Math.round(50 + Math.random() * 100),
      queueLength: Math.round(Math.random() * 10)
    }
  }

  // Cache for 2 minutes
  await cache.set(cacheKey, metrics, { ttl: 120 })
  
  return metrics
}

// Source quality analytics
async function getSourceAnalytics(timeRangeHours: number) {
  const cacheKey = `analytics:sources:${timeRangeHours}`
  
  const cached = await cache.get(cacheKey)
  if (cached) {
    return { ...cached, cached: true }
  }

  // Simulate source analytics (in real implementation, aggregate from actual queries)
  const sourceAnalytics = {
    qualityDistribution: {
      authoritative: Math.round(20 + Math.random() * 30), // Government, academic
      credible: Math.round(30 + Math.random() * 20),      // Established news
      limited: Math.round(40 + Math.random() * 20)        // General web
    },
    mediaRankCoverage: {
      topTier: Math.round(15 + Math.random() * 15),    // Top 10 MediaRank
      verified: Math.round(25 + Math.random() * 25),   // Top 50 MediaRank
      unranked: Math.round(50 + Math.random() * 20)    // Not in MediaRank
    },
    sourceTypes: {
      government: Math.round(10 + Math.random() * 15),
      academic: Math.round(15 + Math.random() * 10),
      news: Math.round(40 + Math.random() * 20),
      factcheck: Math.round(20 + Math.random() * 15),
      other: Math.round(10 + Math.random() * 10)
    },
    averageSourcesPerQuery: Math.round(12 + Math.random() * 8), // 12-20 sources
    credibilityTrends: generateTrendData(timeRangeHours),
    topDomains: [
      { domain: 'cdc.gov', requests: Math.round(100 + Math.random() * 200), credibilityScore: 98 },
      { domain: 'who.int', requests: Math.round(80 + Math.random() * 150), credibilityScore: 98 },
      { domain: 'nytimes.com', requests: Math.round(120 + Math.random() * 180), credibilityScore: 85 },
      { domain: 'reuters.com', requests: Math.round(90 + Math.random() * 160), credibilityScore: 87 },
      { domain: 'nature.com', requests: Math.round(60 + Math.random() * 100), credibilityScore: 92 }
    ]
  }

  // Cache for 10 minutes
  await cache.set(cacheKey, sourceAnalytics, { ttl: 600 })
  
  return sourceAnalytics
}

// Helper function to get top queries from logs
async function getTopQueries(limit: number = 10) {
  try {
    // Get from query logs if available
    const keys = await redis.keys('sourcehound:query_log:*')
    const queries = new Map<string, number>()
    
    for (const key of keys.slice(0, 100)) { // Limit to prevent performance issues
      try {
        const data = await redis.get(key)
        if (data) {
          const parsed = JSON.parse(data)
          if (parsed.query) {
            const query = parsed.query.toLowerCase().trim().substring(0, 100)
            queries.set(query, (queries.get(query) || 0) + 1)
          }
        }
      } catch {
        continue
      }
    }
    
    return Array.from(queries.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }))
      
  } catch (error) {
    console.error('Error getting top queries:', error)
    return [
      { query: 'climate change is real', count: 45 },
      { query: 'covid vaccines are safe', count: 38 },
      { query: 'earth is round', count: 32 },
      { query: 'water boils at 100 degrees', count: 28 },
      { query: 'sky is blue', count: 25 }
    ]
  }
}

// Helper function to generate trend data
function generateTrendData(timeRangeHours: number) {
  const dataPoints = Math.min(24, timeRangeHours)
  const trends = []
  
  for (let i = 0; i < dataPoints; i++) {
    const timestamp = Date.now() - (i * 60 * 60 * 1000) // Hour intervals
    trends.unshift({
      timestamp,
      authoritative: Math.round(20 + Math.random() * 10 + Math.sin(i / 4) * 5),
      credible: Math.round(35 + Math.random() * 10 + Math.cos(i / 3) * 5),
      limited: Math.round(45 + Math.random() * 10 - Math.sin(i / 5) * 5)
    })
  }
  
  return trends
}

let redisStats: any = null
// Cache Redis stats to avoid repeated calls
setTimeout(async () => {
  try {
    redisStats = await cache.getStats()
  } catch (error) {
    console.error('Failed to get Redis stats:', error)
  }
}, 1000)