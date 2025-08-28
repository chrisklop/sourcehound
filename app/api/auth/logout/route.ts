import { NextRequest, NextResponse } from 'next/server'
import { authManager } from '@/lib/auth'
import { applyRateLimit } from '@/lib/rate-limiter'

// POST /api/auth/logout - Logout user and invalidate session
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const { allowed, headers } = await applyRateLimit(request, {
      windowSizeMs: 60 * 1000, // 1 minute
      maxRequests: 30, // 30 logout attempts per minute
      keyPrefix: 'rate_limit:auth_logout'
    })
    
    if (!allowed) {
      return NextResponse.json({
        success: false,
        error: "Too many logout attempts"
      }, { 
        status: 429,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      })
    }

    // Get current session
    const session = await authManager.getSessionFromRequest(request)
    
    if (session) {
      // Invalidate current session
      await authManager.invalidateSession(session.sessionId)
      console.log(`[Auth] User logged out: ${session.email} (${session.username})`)
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logout successful'
    })

    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    // Clear auth cookie
    response.cookies.set({
      name: 'auth-token',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Logout API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// GET /api/auth/logout - Alternative logout via GET (for convenience)
export async function GET(request: NextRequest) {
  return POST(request)
}