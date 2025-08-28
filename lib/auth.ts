// JWT-based authentication system with Redis session management
import { SignJWT, jwtVerify } from 'jose'
import { NextRequest } from 'next/server'
import { redis } from './db'
import bcrypt from 'bcryptjs'

export interface User {
  id: string
  email: string
  username: string
  fullName: string
  role: 'admin' | 'premium' | 'user'
  tier: 'free' | 'premium' | 'enterprise'
  avatar?: string
  emailVerified: boolean
  twoFactorEnabled: boolean
  createdAt: Date
  lastLoginAt: Date
  settings: {
    theme: 'light' | 'dark' | 'auto'
    notifications: boolean
    collaborationDefault: boolean
    preferredEngines: string[]
  }
}

export interface AuthSession {
  userId: string
  sessionId: string
  email: string
  username: string
  role: 'admin' | 'premium' | 'user'
  tier: 'free' | 'premium' | 'enterprise'
  issuedAt: number
  expiresAt: number
}

export interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterData {
  email: string
  username: string
  fullName: string
  password: string
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-key-for-development-only'
)

const SESSION_DURATION = {
  short: 24 * 60 * 60 * 1000, // 24 hours
  long: 30 * 24 * 60 * 60 * 1000 // 30 days
}

export class AuthManager {
  // Generate JWT token
  async generateToken(user: User, rememberMe: boolean = false): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const duration = rememberMe ? SESSION_DURATION.long : SESSION_DURATION.short
    const expiresAt = Date.now() + duration

    const payload: AuthSession = {
      userId: user.id,
      sessionId,
      email: user.email,
      username: user.username,
      role: user.role,
      tier: user.tier,
      issuedAt: Date.now(),
      expiresAt
    }

    // Store session in Redis
    await redis.setex(
      `auth:session:${sessionId}`,
      Math.floor(duration / 1000),
      JSON.stringify(payload)
    )

    // Track user sessions
    await redis.sadd(`auth:user_sessions:${user.id}`, sessionId)
    await redis.expire(`auth:user_sessions:${user.id}`, Math.floor(duration / 1000))

    // Create JWT
    const jwt = await new SignJWT(payload as any)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt / 1000))
      .sign(JWT_SECRET)

    return jwt
  }

  // Verify JWT token
  async verifyToken(token: string): Promise<AuthSession | null> {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET) as { payload: any }
      
      // Check if session exists in Redis
      const sessionData = await redis.get(`auth:session:${payload.sessionId}`)
      if (!sessionData) {
        return null // Session expired or invalidated
      }

      const session: AuthSession = JSON.parse(sessionData)
      
      // Verify expiration
      if (Date.now() > session.expiresAt) {
        await this.invalidateSession(session.sessionId)
        return null
      }

      return session
    } catch (error) {
      console.error('Token verification failed:', error)
      return null
    }
  }

  // Extract auth session from request
  async getSessionFromRequest(request: NextRequest): Promise<AuthSession | null> {
    // Try Authorization header first
    const authHeader = request.headers.get('Authorization')
    let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    // Fall back to cookie
    if (!token) {
      token = request.cookies.get('auth-token')?.value || null
    }

    if (!token) return null

    return this.verifyToken(token)
  }

  // Hash password
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12
    return bcrypt.hash(password, saltRounds)
  }

  // Verify password
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  // Register new user
  async registerUser(data: RegisterData): Promise<{ user: User | null, error: string | null }> {
    try {
      // Check if email already exists
      const existingEmailUser = await redis.get(`auth:email:${data.email.toLowerCase()}`)
      if (existingEmailUser) {
        return { user: null, error: 'Email already registered' }
      }

      // Check if username already exists
      const existingUsernameUser = await redis.get(`auth:username:${data.username.toLowerCase()}`)
      if (existingUsernameUser) {
        return { user: null, error: 'Username already taken' }
      }

      // Create user
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const hashedPassword = await this.hashPassword(data.password)
      
      const user: User = {
        id: userId,
        email: data.email.toLowerCase(),
        username: data.username,
        fullName: data.fullName,
        role: 'user',
        tier: 'free',
        emailVerified: false,
        twoFactorEnabled: false,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        settings: {
          theme: 'auto',
          notifications: true,
          collaborationDefault: false,
          preferredEngines: ['perplexity', 'gemini']
        }
      }

      // Store user data
      await redis.setex(
        `auth:user:${userId}`,
        365 * 24 * 60 * 60, // 1 year
        JSON.stringify(user)
      )

      // Store password separately
      await redis.setex(
        `auth:password:${userId}`,
        365 * 24 * 60 * 60,
        hashedPassword
      )

      // Create indexes
      await redis.setex(`auth:email:${user.email}`, 365 * 24 * 60 * 60, userId)
      await redis.setex(`auth:username:${user.username.toLowerCase()}`, 365 * 24 * 60 * 60, userId)

      // Send welcome notification (placeholder)
      console.log(`New user registered: ${user.email} (${user.username})`)

      return { user, error: null }
    } catch (error) {
      console.error('Registration error:', error)
      return { user: null, error: 'Registration failed' }
    }
  }

  // Authenticate user login
  async loginUser(credentials: LoginCredentials): Promise<{ user: User | null, token: string | null, error: string | null }> {
    try {
      // Find user by email
      const userId = await redis.get(`auth:email:${credentials.email.toLowerCase()}`)
      if (!userId) {
        return { user: null, token: null, error: 'Invalid credentials' }
      }

      // Get user data
      const userData = await redis.get(`auth:user:${userId}`)
      if (!userData) {
        return { user: null, token: null, error: 'User not found' }
      }

      const user: User = JSON.parse(userData)

      // Get password hash
      const passwordHash = await redis.get(`auth:password:${userId}`)
      if (!passwordHash) {
        return { user: null, token: null, error: 'Authentication failed' }
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(credentials.password, passwordHash)
      if (!isValidPassword) {
        return { user: null, token: null, error: 'Invalid credentials' }
      }

      // Update last login
      user.lastLoginAt = new Date()
      await redis.setex(`auth:user:${userId}`, 365 * 24 * 60 * 60, JSON.stringify(user))

      // Generate token
      const token = await this.generateToken(user, credentials.rememberMe)

      return { user, token, error: null }
    } catch (error) {
      console.error('Login error:', error)
      return { user: null, token: null, error: 'Login failed' }
    }
  }

  // Get user by ID
  async getUserById(userId: string): Promise<User | null> {
    try {
      const userData = await redis.get(`auth:user:${userId}`)
      if (!userData) return null

      return JSON.parse(userData)
    } catch (error) {
      console.error('Error fetching user:', error)
      return null
    }
  }

  // Update user
  async updateUser(userId: string, updates: Partial<User>): Promise<boolean> {
    try {
      const user = await this.getUserById(userId)
      if (!user) return false

      const updatedUser = { ...user, ...updates }
      await redis.setex(
        `auth:user:${userId}`,
        365 * 24 * 60 * 60,
        JSON.stringify(updatedUser)
      )

      return true
    } catch (error) {
      console.error('Error updating user:', error)
      return false
    }
  }

  // Invalidate session
  async invalidateSession(sessionId: string): Promise<void> {
    try {
      // Get session data to find user
      const sessionData = await redis.get(`auth:session:${sessionId}`)
      if (sessionData) {
        const session: AuthSession = JSON.parse(sessionData)
        await redis.srem(`auth:user_sessions:${session.userId}`, sessionId)
      }

      // Remove session
      await redis.del(`auth:session:${sessionId}`)
    } catch (error) {
      console.error('Error invalidating session:', error)
    }
  }

  // Logout user (invalidate all sessions)
  async logoutUser(userId: string): Promise<void> {
    try {
      // Get all user sessions
      const sessions = await redis.smembers(`auth:user_sessions:${userId}`)
      
      // Delete all sessions
      const pipeline = redis.pipeline()
      sessions.forEach(sessionId => {
        pipeline.del(`auth:session:${sessionId}`)
      })
      pipeline.del(`auth:user_sessions:${userId}`)
      
      await pipeline.exec()
    } catch (error) {
      console.error('Error logging out user:', error)
    }
  }

  // Get user statistics
  async getUserStats(): Promise<any> {
    try {
      const userKeys = await redis.keys('auth:user:*')
      const totalUsers = userKeys.length

      let activeUsers = 0
      let premiumUsers = 0
      let adminUsers = 0

      // Count active sessions (rough estimate)
      const sessionKeys = await redis.keys('auth:session:*')
      activeUsers = sessionKeys.length

      // Get detailed stats (sample first 100 users)
      const sampleSize = Math.min(100, userKeys.length)
      const sampleKeys = userKeys.slice(0, sampleSize)
      
      const pipeline = redis.pipeline()
      sampleKeys.forEach(key => pipeline.get(key))
      const results = await pipeline.exec()

      results?.forEach((result) => {
        if (result && result[1]) {
          try {
            const user: User = JSON.parse(result[1] as string)
            if (user.tier === 'premium' || user.tier === 'enterprise') premiumUsers++
            if (user.role === 'admin') adminUsers++
          } catch (error) {
            // Skip invalid user data
          }
        }
      })

      // Extrapolate if we sampled
      if (sampleSize < totalUsers) {
        const ratio = totalUsers / sampleSize
        premiumUsers = Math.round(premiumUsers * ratio)
        adminUsers = Math.round(adminUsers * ratio)
      }

      return {
        totalUsers,
        activeUsers,
        premiumUsers,
        adminUsers,
        freeUsers: totalUsers - premiumUsers
      }
    } catch (error) {
      console.error('Error getting user stats:', error)
      return {
        totalUsers: 0,
        activeUsers: 0,
        premiumUsers: 0,
        adminUsers: 0,
        freeUsers: 0
      }
    }
  }

  // Validate password strength
  validatePassword(password: string): { valid: boolean, errors: string[] } {
    const errors: string[] = []

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long')
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // Validate email format
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Validate username
  validateUsername(username: string): { valid: boolean, errors: string[] } {
    const errors: string[] = []

    if (username.length < 3) {
      errors.push('Username must be at least 3 characters long')
    }

    if (username.length > 30) {
      errors.push('Username must be no more than 30 characters long')
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, underscores, and dashes')
    }

    if (/^[_-]|[_-]$/.test(username)) {
      errors.push('Username cannot start or end with underscore or dash')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

export const authManager = new AuthManager()

// Middleware helper for protected routes
export async function requireAuth(request: NextRequest): Promise<{ authorized: boolean, user: User | null, session: AuthSession | null }> {
  const session = await authManager.getSessionFromRequest(request)
  
  if (!session) {
    return { authorized: false, user: null, session: null }
  }

  const user = await authManager.getUserById(session.userId)
  
  return {
    authorized: !!user,
    user,
    session
  }
}

// Role-based access control
export async function requireRole(request: NextRequest, requiredRole: 'admin' | 'premium' | 'user'): Promise<{ authorized: boolean, user: User | null }> {
  const { authorized, user } = await requireAuth(request)
  
  if (!authorized || !user) {
    return { authorized: false, user: null }
  }

  const roleHierarchy = { user: 1, premium: 2, admin: 3 }
  const hasPermission = roleHierarchy[user.role] >= roleHierarchy[requiredRole]

  return {
    authorized: hasPermission,
    user: hasPermission ? user : null
  }
}