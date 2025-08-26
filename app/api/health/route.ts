import { NextResponse } from "next/server"
import { healthCheck } from "@/lib/db"
import { cache } from "@/lib/cache"
import { sessionManager } from "@/lib/session-manager"

export async function GET() {
  const startTime = Date.now()
  
  try {
    // Test database connections
    const dbHealth = await healthCheck()
    
    // Test cache
    const cacheStats = await cache.getStats()
    
    // Get session statistics
    const sessionStats = await sessionManager.getSessionStats()
    
    const responseTime = Date.now() - startTime
    
    return NextResponse.json({
      ok: dbHealth.postgres && dbHealth.redis,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        postgres: {
          status: dbHealth.postgres ? 'healthy' : 'unhealthy',
          connected: dbHealth.postgres
        },
        redis: {
          status: dbHealth.redis ? 'healthy' : 'unhealthy',
          connected: dbHealth.redis,
          ...cacheStats
        },
        sessions: sessionStats
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasDatabase: !!process.env.DATABASE_URL,
        hasRedis: !!process.env.REDIS_URL
      }
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
      responseTime: `${Date.now() - startTime}ms`
    }, { status: 500 })
  }
}
