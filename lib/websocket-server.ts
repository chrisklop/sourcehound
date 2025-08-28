// WebSocket server for real-time collaboration
import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { redis } from './db'
import { rateLimiter, RATE_LIMIT_TIERS } from './rate-limiter'

export interface CollaborationMessage {
  type: 'join' | 'leave' | 'message' | 'typing' | 'presence' | 'sync'
  conversationId: string
  userId: string
  username?: string
  data?: any
  timestamp: number
}

export interface UserPresence {
  userId: string
  username: string
  lastSeen: number
  isTyping: boolean
  cursor?: number
}

export interface CollaborationSession {
  conversationId: string
  participants: Map<string, UserPresence>
  lastActivity: number
  messages: CollaborationMessage[]
}

class CollaborationManager {
  private sessions = new Map<string, CollaborationSession>()
  private userConnections = new Map<string, Set<WebSocket>>()
  private wss: WebSocketServer | null = null

  initialize(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/api/collaboration/ws'
    })

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request)
    })

    // Cleanup inactive sessions every 5 minutes
    setInterval(() => this.cleanupInactiveSessions(), 5 * 60 * 1000)

    console.log('WebSocket collaboration server initialized')
  }

  private async handleConnection(ws: WebSocket, request: IncomingMessage) {
    console.log('New WebSocket connection established')
    
    // Extract connection info
    const url = new URL(request.url!, `http://${request.headers.host}`)
    const conversationId = url.searchParams.get('conversationId')
    const userId = url.searchParams.get('userId') || `anonymous_${Date.now()}`
    const username = url.searchParams.get('username') || 'Anonymous User'

    if (!conversationId) {
      ws.close(1008, 'Conversation ID required')
      return
    }

    // Rate limiting for WebSocket connections
    const clientIP = this.getClientIP(request)
    try {
      const rateLimitResult = await rateLimiter.checkRateLimit(
        clientIP,
        {
          windowSizeMs: 60 * 1000, // 1 minute
          maxRequests: 30, // 30 connections per minute
          keyPrefix: 'rate_limit:websocket'
        }
      )

      if (!rateLimitResult.allowed) {
        ws.close(1008, 'Rate limit exceeded')
        return
      }
    } catch (error) {
      console.error('Rate limit error for WebSocket:', error)
      // Continue without rate limiting if Redis fails
    }

    // Add user to conversation
    await this.addUserToConversation(conversationId, userId, username, ws)

    // Set up message handlers
    ws.on('message', async (data) => {
      try {
        const message: CollaborationMessage = JSON.parse(data.toString())
        await this.handleMessage(conversationId, userId, message, ws)
      } catch (error) {
        console.error('Error handling WebSocket message:', error)
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }))
      }
    })

    // Handle disconnection
    ws.on('close', async () => {
      await this.removeUserFromConversation(conversationId, userId, ws)
    })

    // Send initial sync
    await this.sendInitialSync(conversationId, userId, ws)
  }

  private getClientIP(request: IncomingMessage): string {
    const forwarded = request.headers['x-forwarded-for'] as string
    const realIP = request.headers['x-real-ip'] as string
    const cfIP = request.headers['cf-connecting-ip'] as string
    
    return forwarded?.split(',')[0].trim() || realIP || cfIP || '127.0.0.1'
  }

  private async addUserToConversation(
    conversationId: string, 
    userId: string, 
    username: string, 
    ws: WebSocket
  ) {
    // Get or create session
    let session = this.sessions.get(conversationId)
    if (!session) {
      session = {
        conversationId,
        participants: new Map(),
        lastActivity: Date.now(),
        messages: []
      }
      this.sessions.set(conversationId, session)
    }

    // Add user presence
    session.participants.set(userId, {
      userId,
      username,
      lastSeen: Date.now(),
      isTyping: false
    })

    // Track user connection
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set())
    }
    this.userConnections.get(userId)!.add(ws)

    // Store in Redis for persistence
    try {
      await redis.hset(`collaboration:${conversationId}`, userId, JSON.stringify({
        userId,
        username,
        joinedAt: Date.now(),
        lastSeen: Date.now()
      }))
      
      await redis.expire(`collaboration:${conversationId}`, 24 * 60 * 60) // 24 hours
    } catch (error) {
      console.error('Error storing collaboration data in Redis:', error)
    }

    // Notify other participants
    await this.broadcastToConversation(conversationId, {
      type: 'presence',
      conversationId,
      userId,
      username,
      data: {
        action: 'joined',
        participants: Array.from(session.participants.values())
      },
      timestamp: Date.now()
    }, userId) // Exclude the user who just joined

    console.log(`User ${username} (${userId}) joined conversation ${conversationId}`)
  }

  private async removeUserFromConversation(
    conversationId: string, 
    userId: string, 
    ws: WebSocket
  ) {
    const session = this.sessions.get(conversationId)
    if (!session) return

    // Remove user presence
    const user = session.participants.get(userId)
    session.participants.delete(userId)

    // Remove connection
    const userConnections = this.userConnections.get(userId)
    if (userConnections) {
      userConnections.delete(ws)
      if (userConnections.size === 0) {
        this.userConnections.delete(userId)
      }
    }

    // Update Redis
    try {
      await redis.hdel(`collaboration:${conversationId}`, userId)
    } catch (error) {
      console.error('Error removing collaboration data from Redis:', error)
    }

    // Notify other participants
    if (user) {
      await this.broadcastToConversation(conversationId, {
        type: 'presence',
        conversationId,
        userId,
        data: {
          action: 'left',
          participants: Array.from(session.participants.values())
        },
        timestamp: Date.now()
      })

      console.log(`User ${user.username} (${userId}) left conversation ${conversationId}`)
    }

    // Clean up empty sessions
    if (session.participants.size === 0) {
      this.sessions.delete(conversationId)
      try {
        await redis.del(`collaboration:${conversationId}`)
      } catch (error) {
        console.error('Error cleaning up collaboration session:', error)
      }
    }
  }

  private async handleMessage(
    conversationId: string,
    userId: string,
    message: CollaborationMessage,
    ws: WebSocket
  ) {
    const session = this.sessions.get(conversationId)
    if (!session) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Conversation not found'
      }))
      return
    }

    const user = session.participants.get(userId)
    if (!user) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'User not in conversation'
      }))
      return
    }

    // Update user activity
    user.lastSeen = Date.now()
    session.lastActivity = Date.now()

    switch (message.type) {
      case 'typing':
        await this.handleTypingIndicator(conversationId, userId, message.data?.isTyping || false)
        break
      
      case 'message':
        await this.handleChatMessage(conversationId, userId, message)
        break
      
      case 'sync':
        await this.handleSyncRequest(conversationId, userId, ws)
        break

      default:
        console.warn(`Unknown message type: ${message.type}`)
    }
  }

  private async handleTypingIndicator(
    conversationId: string,
    userId: string,
    isTyping: boolean
  ) {
    const session = this.sessions.get(conversationId)
    if (!session) return

    const user = session.participants.get(userId)
    if (!user) return

    user.isTyping = isTyping

    // Broadcast typing status to other participants
    await this.broadcastToConversation(conversationId, {
      type: 'typing',
      conversationId,
      userId,
      data: { isTyping },
      timestamp: Date.now()
    }, userId)
  }

  private async handleChatMessage(
    conversationId: string,
    userId: string,
    message: CollaborationMessage
  ) {
    const session = this.sessions.get(conversationId)
    if (!session) return

    // Store message in session
    session.messages.push(message)

    // Keep only last 100 messages in memory
    if (session.messages.length > 100) {
      session.messages = session.messages.slice(-100)
    }

    // Store in Redis for persistence
    try {
      await redis.lpush(
        `collaboration:messages:${conversationId}`,
        JSON.stringify(message)
      )
      await redis.ltrim(`collaboration:messages:${conversationId}`, 0, 999) // Keep last 1000
      await redis.expire(`collaboration:messages:${conversationId}`, 24 * 60 * 60)
    } catch (error) {
      console.error('Error storing collaboration message:', error)
    }

    // Broadcast to all participants
    await this.broadcastToConversation(conversationId, message)
  }

  private async handleSyncRequest(
    conversationId: string,
    userId: string,
    ws: WebSocket
  ) {
    await this.sendInitialSync(conversationId, userId, ws)
  }

  private async sendInitialSync(
    conversationId: string,
    userId: string,
    ws: WebSocket
  ) {
    const session = this.sessions.get(conversationId)
    if (!session) return

    // Send current participants
    ws.send(JSON.stringify({
      type: 'sync',
      conversationId,
      data: {
        participants: Array.from(session.participants.values()),
        recentMessages: session.messages.slice(-20) // Last 20 messages
      },
      timestamp: Date.now()
    }))
  }

  private async broadcastToConversation(
    conversationId: string,
    message: CollaborationMessage,
    excludeUserId?: string
  ) {
    const session = this.sessions.get(conversationId)
    if (!session) return

    const messageStr = JSON.stringify(message)

    for (const [participantId, participant] of session.participants) {
      if (excludeUserId && participantId === excludeUserId) continue

      const connections = this.userConnections.get(participantId)
      if (!connections) continue

      for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(messageStr)
          } catch (error) {
            console.error(`Error sending message to user ${participantId}:`, error)
          }
        }
      }
    }
  }

  private cleanupInactiveSessions() {
    const now = Date.now()
    const maxInactivity = 2 * 60 * 60 * 1000 // 2 hours

    for (const [conversationId, session] of this.sessions) {
      if (now - session.lastActivity > maxInactivity) {
        console.log(`Cleaning up inactive collaboration session: ${conversationId}`)
        this.sessions.delete(conversationId)
        
        // Clean up Redis data
        redis.del(`collaboration:${conversationId}`)
          .catch(error => console.error('Error cleaning up Redis collaboration data:', error))
      }
    }
  }

  // Public methods for external use
  getActiveConversations(): string[] {
    return Array.from(this.sessions.keys())
  }

  getConversationParticipants(conversationId: string): UserPresence[] {
    const session = this.sessions.get(conversationId)
    return session ? Array.from(session.participants.values()) : []
  }

  async getConversationStats() {
    return {
      activeSessions: this.sessions.size,
      totalConnections: Array.from(this.userConnections.values())
        .reduce((sum, connections) => sum + connections.size, 0),
      sessionsPerConversation: Array.from(this.sessions.entries())
        .map(([id, session]) => ({
          conversationId: id,
          participants: session.participants.size,
          lastActivity: session.lastActivity
        }))
    }
  }
}

export const collaborationManager = new CollaborationManager()