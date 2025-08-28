import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { applyRateLimit } from '@/lib/rate-limiter'

// GET /api/auth/me - Get current user profile
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const { allowed, headers } = await applyRateLimit(request, {
      windowSizeMs: 60 * 1000, // 1 minute
      maxRequests: 120, // 120 requests per minute
      keyPrefix: 'rate_limit:auth_me'
    })
    
    if (!allowed) {
      return NextResponse.json({
        success: false,
        error: "Rate limit exceeded"
      }, { 
        status: 429,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      })
    }

    // Check authentication
    const { authorized, user, session } = await requireAuth(request)
    
    if (!authorized || !user || !session) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      }, { status: 401 })
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        tier: user.tier,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        settings: user.settings
      },
      session: {
        sessionId: session.sessionId,
        issuedAt: session.issuedAt,
        expiresAt: session.expiresAt
      }
    })

    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    console.error('Auth me API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}