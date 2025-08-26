import { PrismaClient } from '@prisma/client'
import { Redis } from 'ioredis'

declare global {
  var prisma: PrismaClient | undefined
  var redis: Redis | null | undefined
}

// Prisma Client (PostgreSQL)
export const db = globalThis.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db
}

// Redis Client - only connect if REDIS_URL is available
export const redis = process.env.REDIS_URL 
  ? (globalThis.redis ?? new Redis(
      process.env.REDIS_URL,
      {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 5000,
        commandTimeout: 5000,
      }
    ))
  : null

if (process.env.NODE_ENV !== 'production') {
  globalThis.redis = redis
}

// Redis connection handlers - only if Redis is available
if (redis) {
  redis.on('connect', () => {
    console.log('✅ Redis connected')
  })

  redis.on('error', (error) => {
    console.error('❌ Redis connection error:', error)
  })

  redis.on('disconnect', () => {
    console.log('⚠️ Redis disconnected')
  })
}

// Database utilities
export async function healthCheck() {
  // Skip database checks if no DATABASE_URL is configured (e.g., Vercel build)
  if (!process.env.DATABASE_URL) {
    return { postgres: false, redis: false, reason: 'No database configured' }
  }

  try {
    // Test PostgreSQL connection
    await db.$queryRaw`SELECT 1`
    
    // Test Redis connection only if available
    const redisOk = redis ? await redis.ping().then(() => true).catch(() => false) : false
    
    return { postgres: true, redis: redisOk }
  } catch (error) {
    console.error('Database health check failed:', error)
    
    const postgresOk = await db.$queryRaw`SELECT 1`.then(() => true).catch(() => false)
    const redisOk = redis ? await redis.ping().then(() => true).catch(() => false) : false
    
    return { postgres: postgresOk, redis: redisOk }
  }
}

// Clean up connections on process exit
process.on('beforeExit', async () => {
  await db.$disconnect()
  if (redis) {
    await redis.quit()
  }
})