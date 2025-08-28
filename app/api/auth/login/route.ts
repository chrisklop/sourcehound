import { NextRequest, NextResponse } from 'next/server'
import { authManager, type LoginCredentials } from '@/lib/auth'
import { applyRateLimit } from '@/lib/rate-limiter'

// POST /api/auth/login - Authenticate user
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for login attempts
    const { allowed, headers } = await applyRateLimit(request, {
      windowSizeMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10, // 10 login attempts per 15 minutes
      keyPrefix: 'rate_limit:auth_login'
    })
    
    if (!allowed) {
      return NextResponse.json({
        success: false,
        error: "Too many login attempts",
        message: "Please wait before trying to login again."
      }, { 
        status: 429,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      })
    }

    const body = await request.json()
    const { email, password, rememberMe = false }: LoginCredentials = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Missing credentials',
        message: 'Email and password are required'
      }, { status: 400 })
    }

    // Validate email format
    if (!authManager.validateEmail(email)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email format',
        message: 'Please provide a valid email address'
      }, { status: 400 })
    }

    // Attempt login
    const { user, token, error } = await authManager.loginUser({
      email: email.trim(),
      password,
      rememberMe
    })

    if (error || !user || !token) {
      // Generic error message for security
      return NextResponse.json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid email or password'
      }, { status: 401 })
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
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
        settings: user.settings,
        lastLoginAt: user.lastLoginAt
      },
      token
    })

    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    // Set secure HTTP-only cookie
    const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60 // 30 days or 24 hours
    response.cookies.set({
      name: 'auth-token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: cookieMaxAge,
      path: '/'
    })

    console.log(`[Auth] User logged in: ${user.email} (${user.username})`)

    return response
  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'Login failed due to server error'
    }, { status: 500 })
  }
}