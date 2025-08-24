import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { headers } from 'next/headers'

const SESSIONS_FILE = path.join('/tmp', 'sourcehound-sessions.json')

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isLoading?: boolean
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

interface SessionData {
  conversations: Conversation[]
  lastAccessed: string
}

// Get client IP address
function getClientIP(request: NextRequest): string {
  const headersList = headers()
  
  // Check various headers for IP address
  const xForwardedFor = headersList.get('x-forwarded-for')
  const xRealIP = headersList.get('x-real-ip')
  const cfConnectingIP = headersList.get('cf-connecting-ip')
  
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return xForwardedFor.split(',')[0].trim()
  }
  
  if (xRealIP) return xRealIP
  if (cfConnectingIP) return cfConnectingIP
  
  // Fallback to connection remote address
  return request.ip || 'unknown'
}

// Load all sessions from file
async function loadSessions(): Promise<Record<string, SessionData>> {
  try {
    const data = await fs.readFile(SESSIONS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

// Save all sessions to file
async function saveSessions(sessions: Record<string, SessionData>): Promise<void> {
  try {
    await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2))
  } catch (error) {
    console.error('Error saving sessions:', error)
  }
}

// GET /api/sessions - Load conversations for current IP
export async function GET(request: NextRequest) {
  try {
    const clientIP = getClientIP(request)
    const sessions = await loadSessions()
    const sessionData = sessions[clientIP] || { conversations: [], lastAccessed: new Date().toISOString() }
    
    // Update last accessed time
    sessionData.lastAccessed = new Date().toISOString()
    sessions[clientIP] = sessionData
    await saveSessions(sessions)
    
    return NextResponse.json({
      success: true,
      conversations: sessionData.conversations
    })
  } catch (error) {
    console.error('Error loading session:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to load session'
    }, { status: 500 })
  }
}

// POST /api/sessions - Save conversations for current IP
export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request)
    const { conversations } = await request.json()
    
    if (!Array.isArray(conversations)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid conversations data'
      }, { status: 400 })
    }
    
    const sessions = await loadSessions()
    
    sessions[clientIP] = {
      conversations,
      lastAccessed: new Date().toISOString()
    }
    
    await saveSessions(sessions)
    
    return NextResponse.json({
      success: true,
      message: 'Session saved successfully'
    })
  } catch (error) {
    console.error('Error saving session:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to save session'
    }, { status: 500 })
  }
}

// DELETE /api/sessions - Clear conversations for current IP
export async function DELETE(request: NextRequest) {
  try {
    const clientIP = getClientIP(request)
    const sessions = await loadSessions()
    
    if (sessions[clientIP]) {
      delete sessions[clientIP]
      await saveSessions(sessions)
    }
    
    return NextResponse.json({
      success: true,
      message: 'Session cleared successfully'
    })
  } catch (error) {
    console.error('Error clearing session:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to clear session'
    }, { status: 500 })
  }
}