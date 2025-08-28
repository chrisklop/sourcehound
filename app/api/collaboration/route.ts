import { NextRequest, NextResponse } from 'next/server'
import { collaborationManager } from '@/lib/websocket-server'
import { applyRateLimit, RATE_LIMIT_TIERS } from '@/lib/rate-limiter'
import { redis } from '@/lib/db'

// GET /api/collaboration - Get collaboration statistics and active sessions
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const { allowed, headers } = await applyRateLimit(request, {
      windowSizeMs: 60 * 1000, // 1 minute
      maxRequests: 60, // 60 requests per minute
      keyPrefix: 'rate_limit:collaboration'
    })
    
    if (!allowed) {
      return NextResponse.json({
        error: "Rate limit exceeded",
        message: "Too many collaboration requests. Please wait before trying again."
      }, { 
        status: 429,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    const action = searchParams.get('action')

    let responseData: any = {}

    if (action === 'stats') {
      // Get overall collaboration statistics
      responseData = await collaborationManager.getConversationStats()
    } else if (conversationId) {
      // Get specific conversation data
      const participants = collaborationManager.getConversationParticipants(conversationId)
      
      // Get recent messages from Redis
      let recentMessages: any[] = []
      try {
        const messages = await redis.lrange(`collaboration:messages:${conversationId}`, 0, 19)
        recentMessages = messages.map(msg => JSON.parse(msg)).reverse()
      } catch (error) {
        console.error('Error fetching collaboration messages:', error)
      }

      responseData = {
        conversationId,
        participants,
        participantCount: participants.length,
        recentMessages,
        isActive: participants.length > 0
      }
    } else {
      // Get all active conversations
      const activeConversations = collaborationManager.getActiveConversations()
      responseData = {
        activeConversations: activeConversations.map(id => ({
          conversationId: id,
          participants: collaborationManager.getConversationParticipants(id),
          participantCount: collaborationManager.getConversationParticipants(id).length
        }))
      }
    }

    const response = NextResponse.json({
      success: true,
      data: responseData,
      timestamp: new Date().toISOString()
    })

    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    console.error('Collaboration API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POST /api/collaboration - Join or create a collaboration session
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const { allowed, headers } = await applyRateLimit(request, {
      windowSizeMs: 60 * 1000, // 1 minute
      maxRequests: 30, // 30 session operations per minute
      keyPrefix: 'rate_limit:collaboration_post'
    })
    
    if (!allowed) {
      return NextResponse.json({
        error: "Rate limit exceeded",
        message: "Too many collaboration session requests. Please wait before trying again."
      }, { 
        status: 429,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      })
    }

    const body = await request.json()
    const { action, conversationId, userId, username } = body

    if (!conversationId || !userId) {
      return NextResponse.json({
        success: false,
        error: 'conversationId and userId are required'
      }, { status: 400 })
    }

    let responseData: any = {}

    switch (action) {
      case 'create_session':
        // Store session metadata in Redis
        try {
          const sessionData = {
            conversationId,
            createdBy: userId,
            createdAt: Date.now(),
            settings: {
              maxParticipants: body.maxParticipants || 10,
              requireAuth: body.requireAuth || false,
              readOnly: body.readOnly || false
            }
          }

          await redis.setex(
            `collaboration:session:${conversationId}`,
            24 * 60 * 60, // 24 hours
            JSON.stringify(sessionData)
          )

          responseData = {
            sessionCreated: true,
            websocketUrl: `/api/collaboration/ws?conversationId=${conversationId}&userId=${userId}&username=${encodeURIComponent(username || 'Anonymous')}`,
            sessionData
          }
        } catch (error) {
          console.error('Error creating collaboration session:', error)
          return NextResponse.json({
            success: false,
            error: 'Failed to create collaboration session'
          }, { status: 500 })
        }
        break

      case 'join_session':
        // Check if session exists and get join URL
        try {
          const sessionExists = await redis.exists(`collaboration:session:${conversationId}`)
          
          if (!sessionExists) {
            return NextResponse.json({
              success: false,
              error: 'Collaboration session not found'
            }, { status: 404 })
          }

          responseData = {
            canJoin: true,
            websocketUrl: `/api/collaboration/ws?conversationId=${conversationId}&userId=${userId}&username=${encodeURIComponent(username || 'Anonymous')}`,
            participants: collaborationManager.getConversationParticipants(conversationId)
          }
        } catch (error) {
          console.error('Error checking collaboration session:', error)
          return NextResponse.json({
            success: false,
            error: 'Failed to check collaboration session'
          }, { status: 500 })
        }
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use "create_session" or "join_session"'
        }, { status: 400 })
    }

    const response = NextResponse.json({
      success: true,
      data: responseData,
      timestamp: new Date().toISOString()
    })

    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    console.error('Collaboration POST error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// DELETE /api/collaboration - Leave or cleanup collaboration session
export async function DELETE(request: NextRequest) {
  try {
    // Apply rate limiting
    const { allowed, headers } = await applyRateLimit(request, {
      windowSizeMs: 60 * 1000, // 1 minute
      maxRequests: 60, // 60 cleanup operations per minute
      keyPrefix: 'rate_limit:collaboration_delete'
    })
    
    if (!allowed) {
      return NextResponse.json({
        error: "Rate limit exceeded",
        message: "Too many collaboration cleanup requests."
      }, { 
        status: 429,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    const action = searchParams.get('action') || 'cleanup_session'

    if (!conversationId) {
      return NextResponse.json({
        success: false,
        error: 'conversationId is required'
      }, { status: 400 })
    }

    try {
      switch (action) {
        case 'cleanup_session':
          // Remove session data from Redis
          await redis.del(`collaboration:session:${conversationId}`)
          await redis.del(`collaboration:${conversationId}`)
          await redis.del(`collaboration:messages:${conversationId}`)
          break

        case 'clear_messages':
          // Clear only messages
          await redis.del(`collaboration:messages:${conversationId}`)
          break

        default:
          return NextResponse.json({
            success: false,
            error: 'Invalid action'
          }, { status: 400 })
      }

      const response = NextResponse.json({
        success: true,
        message: 'Collaboration session cleaned up successfully',
        timestamp: new Date().toISOString()
      })

      // Add rate limit headers
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      return response
    } catch (error) {
      console.error('Error cleaning up collaboration session:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to cleanup collaboration session'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Collaboration DELETE error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}