import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authManager } from '@/lib/auth'
import { applyRateLimit } from '@/lib/rate-limiter'

// PUT /api/auth/profile - Update user profile
export async function PUT(request: NextRequest) {
  try {
    // Apply rate limiting
    const { allowed, headers } = await applyRateLimit(request, {
      windowSizeMs: 60 * 1000, // 1 minute
      maxRequests: 20, // 20 profile updates per minute
      keyPrefix: 'rate_limit:auth_profile'
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

    const body = await request.json()
    const { fullName, username, avatar, settings } = body

    // Validate updates
    const updates: any = {}

    if (fullName !== undefined) {
      if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100) {
        return NextResponse.json({
          success: false,
          error: 'Invalid full name',
          message: 'Full name must be between 2 and 100 characters'
        }, { status: 400 })
      }
      updates.fullName = fullName.trim()
    }

    if (username !== undefined) {
      if (username !== user.username) {
        const usernameValidation = authManager.validateUsername(username)
        if (!usernameValidation.valid) {
          return NextResponse.json({
            success: false,
            error: 'Invalid username',
            message: usernameValidation.errors.join(', ')
          }, { status: 400 })
        }
        updates.username = username.trim()
      }
    }

    if (avatar !== undefined) {
      if (typeof avatar === 'string' && avatar.length > 500) {
        return NextResponse.json({
          success: false,
          error: 'Invalid avatar',
          message: 'Avatar URL too long'
        }, { status: 400 })
      }
      updates.avatar = avatar
    }

    if (settings !== undefined) {
      if (typeof settings === 'object' && settings !== null) {
        // Validate settings object
        const validSettings = {
          theme: settings.theme,
          notifications: settings.notifications,
          collaborationDefault: settings.collaborationDefault,
          preferredEngines: settings.preferredEngines
        }

        // Validate theme
        if (validSettings.theme && !['light', 'dark', 'auto'].includes(validSettings.theme)) {
          return NextResponse.json({
            success: false,
            error: 'Invalid theme',
            message: 'Theme must be light, dark, or auto'
          }, { status: 400 })
        }

        // Validate preferred engines
        if (validSettings.preferredEngines && Array.isArray(validSettings.preferredEngines)) {
          const validEngines = ['perplexity', 'gemini', 'openai']
          const invalidEngines = validSettings.preferredEngines.filter(engine => 
            typeof engine !== 'string' || !validEngines.includes(engine)
          )
          if (invalidEngines.length > 0) {
            return NextResponse.json({
              success: false,
              error: 'Invalid preferred engines',
              message: `Valid engines are: ${validEngines.join(', ')}`
            }, { status: 400 })
          }
        }

        updates.settings = { ...user.settings, ...validSettings }
      }
    }

    // Apply updates
    const success = await authManager.updateUser(user.id, updates)
    
    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Update failed',
        message: 'Unable to update profile'
      }, { status: 500 })
    }

    // Get updated user
    const updatedUser = await authManager.getUserById(user.id)
    
    if (!updatedUser) {
      return NextResponse.json({
        success: false,
        error: 'Update verification failed'
      }, { status: 500 })
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        tier: updatedUser.tier,
        avatar: updatedUser.avatar,
        emailVerified: updatedUser.emailVerified,
        twoFactorEnabled: updatedUser.twoFactorEnabled,
        settings: updatedUser.settings
      }
    })

    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    console.log(`[Auth] Profile updated for user: ${updatedUser.email} (${updatedUser.username})`)

    return response
  } catch (error) {
    console.error('Profile update API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// GET /api/auth/profile - Get detailed user profile (same as /me but with more details)
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const { allowed, headers } = await applyRateLimit(request, {
      windowSizeMs: 60 * 1000, // 1 minute
      maxRequests: 60, // 60 requests per minute
      keyPrefix: 'rate_limit:auth_profile_get'
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

    // Create response with full profile details
    const response = NextResponse.json({
      success: true,
      profile: {
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
        expiresAt: session.expiresAt,
        timeRemaining: Math.max(0, session.expiresAt - Date.now())
      },
      capabilities: {
        canCreateCollaborations: true,
        maxCollaborators: user.tier === 'free' ? 5 : user.tier === 'premium' ? 25 : 100,
        dailyQueryLimit: user.tier === 'free' ? 50 : user.tier === 'premium' ? 1000 : 10000,
        canAccessAnalytics: user.role === 'admin' || user.tier !== 'free',
        canExportData: user.tier !== 'free'
      }
    })

    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    console.error('Profile GET API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}