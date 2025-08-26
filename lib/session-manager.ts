import { db, redis } from './db'
import { cache } from './cache'
import crypto from 'crypto'

export interface SessionData {
  conversations: Conversation[]
  lastAccessed: string
  metadata?: {
    userAgent?: string
    location?: string
    preferences?: any
    migrated?: boolean
    migratedAt?: string
  }
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  metadata?: {
    tags?: string[]
    archived?: boolean
    shared?: boolean
  }
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isLoading?: boolean
  sources?: any[]
  factCheckData?: any
  metadata?: {
    processingTime?: number
    model?: string
    tokensUsed?: number
  }
}

export class SessionManager {
  private generateSessionId(ipAddress: string): string {
    return crypto.createHash('sha256').update(`${ipAddress}:${Date.now()}`).digest('hex').slice(0, 32)
  }

  private getIpAddress(request: Request): string {
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const cfConnectingIp = request.headers.get('cf-connecting-ip')
    
    return forwardedFor?.split(',')[0].trim() || 
           realIp || 
           cfConnectingIp || 
           '127.0.0.1'
  }

  // Hybrid approach: Database for persistence, Redis for fast access
  async getSession(request: Request): Promise<{ sessionId: string; data: SessionData }> {
    const ipAddress = this.getIpAddress(request)
    const userAgent = request.headers.get('user-agent') || undefined

    try {
      // First try Redis cache
      const cacheKey = `session:${ipAddress}`
      let sessionData = await cache.get<SessionData>(cacheKey)
      
      if (!sessionData) {
        // Fall back to database
        const dbSession = await db.session.findFirst({
          where: { ipAddress },
          orderBy: { updatedAt: 'desc' },
          include: {
            user: {
              include: {
                conversations: {
                  include: {
                    messages: {
                      orderBy: { timestamp: 'asc' }
                    }
                  },
                  orderBy: { updatedAt: 'desc' }
                }
              }
            }
          }
        })

        if (dbSession) {
          // Convert database format to session format
          sessionData = {
            conversations: dbSession.user?.conversations.map(conv => ({
              id: conv.id,
              title: conv.title,
              createdAt: conv.createdAt,
              updatedAt: conv.updatedAt,
              messages: conv.messages.map(msg => ({
                id: msg.id,
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
                timestamp: msg.timestamp,
                isLoading: msg.isLoading,
                sources: msg.sources as any[],
                factCheckData: msg.factCheckData
              }))
            })) || [],
            lastAccessed: dbSession.updatedAt.toISOString(),
            metadata: {
              userAgent
            }
          }
          
          // Cache for fast access
          await cache.setSession(cacheKey, sessionData)
        }
      }

      // Create new session if none exists
      if (!sessionData) {
        sessionData = {
          conversations: [],
          lastAccessed: new Date().toISOString(),
          metadata: { userAgent }
        }
      }

      return {
        sessionId: this.generateSessionId(ipAddress),
        data: sessionData
      }
    } catch (error) {
      console.error('Session get error:', error)
      // Fallback to empty session
      return {
        sessionId: this.generateSessionId(ipAddress),
        data: {
          conversations: [],
          lastAccessed: new Date().toISOString(),
          metadata: { userAgent }
        }
      }
    }
  }

  async saveSession(request: Request, data: SessionData): Promise<boolean> {
    const ipAddress = this.getIpAddress(request)
    const userAgent = request.headers.get('user-agent') || undefined

    try {
      // Save to both Redis and Database
      const cacheKey = `session:${ipAddress}`
      
      // Update cache immediately
      await cache.setSession(cacheKey, {
        ...data,
        lastAccessed: new Date().toISOString()
      })

      // Persist to database (upsert user and conversations)
      await db.$transaction(async (tx) => {
        // Find or create user
        let user = await tx.user.findUnique({
          where: { ipAddress }
        })

        if (!user) {
          user = await tx.user.create({
            data: {
              ipAddress,
              name: `User-${ipAddress.slice(-4)}`
            }
          })
        }

        // Find existing session or create new one
        const existingSession = await tx.session.findFirst({
          where: { ipAddress }
        })

        if (existingSession) {
          await tx.session.update({
            where: { id: existingSession.id },
            data: {
              data: data as any,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              updatedAt: new Date()
            }
          })
        } else {
          await tx.session.create({
            data: {
              userId: user.id,
              ipAddress,
              data: data as any,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
          })
        }

        // Sync conversations to database
        for (const conversation of data.conversations) {
          await tx.conversation.upsert({
            where: { id: conversation.id },
            update: {
              title: conversation.title,
              updatedAt: new Date(conversation.updatedAt)
            },
            create: {
              id: conversation.id,
              title: conversation.title,
              userId: user.id,
              ipAddress,
              createdAt: new Date(conversation.createdAt),
              updatedAt: new Date(conversation.updatedAt)
            }
          })

          // Sync messages
          for (const message of conversation.messages) {
            await tx.message.upsert({
              where: { id: message.id },
              update: {
                content: message.content,
                sources: message.sources as any,
                factCheckData: message.factCheckData as any
              },
              create: {
                id: message.id,
                conversationId: conversation.id,
                role: message.role,
                content: message.content,
                sources: message.sources as any,
                factCheckData: message.factCheckData as any,
                timestamp: new Date(message.timestamp)
              }
            })
          }
        }
      })

      return true
    } catch (error) {
      console.error('Session save error:', error)
      
      // At least save to cache if database fails
      try {
        const cacheKey = `session:${ipAddress}`
        await cache.setSession(cacheKey, data)
        return true
      } catch (cacheError) {
        console.error('Cache save error:', cacheError)
        return false
      }
    }
  }

  async deleteSession(request: Request): Promise<boolean> {
    const ipAddress = this.getIpAddress(request)

    try {
      // Delete from cache
      const cacheKey = `session:${ipAddress}`
      await cache.deleteSession(cacheKey)

      // Delete from database
      await db.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { ipAddress },
          include: { conversations: true }
        })

        if (user) {
          // Delete all messages in conversations
          for (const conv of user.conversations) {
            await tx.message.deleteMany({
              where: { conversationId: conv.id }
            })
          }
          
          // Delete conversations
          await tx.conversation.deleteMany({
            where: { userId: user.id }
          })
          
          // Delete sessions
          await tx.session.deleteMany({
            where: { userId: user.id }
          })
          
          // Delete user
          await tx.user.delete({
            where: { id: user.id }
          })
        }
      })

      return true
    } catch (error) {
      console.error('Session delete error:', error)
      return false
    }
  }

  // Analytics and management
  async getSessionStats(): Promise<any> {
    // Skip database stats if no DATABASE_URL configured
    if (!process.env.DATABASE_URL) {
      return {
        totalUsers: 0,
        totalSessions: 0,
        totalConversations: 0,
        totalMessages: 0,
        activeSessionsLast24h: 0,
        status: 'Database not configured'
      }
    }

    try {
      const [userCount, sessionCount, conversationCount, messageCount] = await Promise.all([
        db.user.count(),
        db.session.count(),
        db.conversation.count(),
        db.message.count()
      ])

      const recentSessions = await db.session.count({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })

      return {
        totalUsers: userCount,
        totalSessions: sessionCount,
        totalConversations: conversationCount,
        totalMessages: messageCount,
        activeSessionsLast24h: recentSessions
      }
    } catch (error) {
      console.error('Session stats error:', error)
      return {
        totalUsers: 0,
        totalSessions: 0,
        totalConversations: 0,
        totalMessages: 0,
        activeSessionsLast24h: 0,
        status: 'Database unavailable',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await db.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      })

      console.log(`Cleaned up ${result.count} expired sessions`)
      return result.count
    } catch (error) {
      console.error('Session cleanup error:', error)
      return 0
    }
  }
}

export const sessionManager = new SessionManager()