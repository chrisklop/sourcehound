import { NextRequest, NextResponse } from 'next/server'
import { authManager, type RegisterData } from '@/lib/auth'
import { applyRateLimit } from '@/lib/rate-limiter'

// POST /api/auth/register - Register new user
export async function POST(request: NextRequest) {
  try {
    // Apply strict rate limiting for registration
    const { allowed, headers } = await applyRateLimit(request, {
      windowSizeMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5, // 5 registration attempts per hour
      keyPrefix: 'rate_limit:auth_register'
    })
    
    if (!allowed) {
      return NextResponse.json({
        success: false,
        error: "Too many registration attempts",
        message: "Please wait before trying to register again."
      }, { 
        status: 429,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      })
    }

    const body = await request.json()
    const { email, username, fullName, password }: RegisterData = body

    // Validate required fields
    if (!email || !username || !fullName || !password) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
        message: 'Email, username, full name, and password are required'
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

    // Validate username
    const usernameValidation = authManager.validateUsername(username)
    if (!usernameValidation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid username',
        message: usernameValidation.errors.join(', ')
      }, { status: 400 })
    }

    // Validate password strength
    const passwordValidation = authManager.validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Weak password',
        message: passwordValidation.errors.join(', ')
      }, { status: 400 })
    }

    // Validate full name
    if (fullName.trim().length < 2 || fullName.trim().length > 100) {
      return NextResponse.json({
        success: false,
        error: 'Invalid full name',
        message: 'Full name must be between 2 and 100 characters'
      }, { status: 400 })
    }

    // Attempt registration
    const { user, error } = await authManager.registerUser({
      email: email.trim(),
      username: username.trim(),
      fullName: fullName.trim(),
      password
    })

    if (error || !user) {
      return NextResponse.json({
        success: false,
        error: error || 'Registration failed',
        message: error || 'Unable to create account'
      }, { status: 400 })
    }

    // Generate authentication token
    const token = await authManager.generateToken(user, false)

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        tier: user.tier,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
        settings: user.settings
      },
      token,
      requiresEmailVerification: !user.emailVerified
    })

    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: 'auth-token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    })

    console.log(`[Auth] New user registered: ${user.email} (${user.username})`)

    return response
  } catch (error) {
    console.error('Registration API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'Registration failed due to server error'
    }, { status: 500 })
  }
}