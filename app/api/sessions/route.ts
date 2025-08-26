import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/session-manager'

// Legacy file-based fallback for migration
import fs from 'fs/promises'
import path from 'path'

const SESSIONS_FILE = path.join('/tmp', 'sourcehound-sessions.json')

// Legacy file operations for migration
async function loadLegacySessions(): Promise<Record<string, any>> {
  try {
    const data = await fs.readFile(SESSIONS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

async function migrateLegacySession(request: NextRequest): Promise<void> {
  try {
    const legacySessions = await loadLegacySessions()
    if (Object.keys(legacySessions).length === 0) return

    // Get current IP
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')  
    const cfConnectingIp = request.headers.get('cf-connecting-ip')
    const ipAddress = forwardedFor?.split(',')[0].trim() || realIp || cfConnectingIp || '127.0.0.1'

    // Check if this IP has legacy data
    const legacyData = legacySessions[ipAddress]
    if (legacyData) {
      console.log(`Migrating legacy session for IP: ${ipAddress}`)
      
      // Convert to new format and save
      await sessionManager.saveSession(request, {
        conversations: legacyData.conversations.map((conv: any) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        })),
        lastAccessed: legacyData.lastAccessed || new Date().toISOString(),
        metadata: {
          migrated: true,
          migratedAt: new Date().toISOString()
        }
      })
      
      // Remove from legacy storage
      delete legacySessions[ipAddress]
      await fs.writeFile(SESSIONS_FILE, JSON.stringify(legacySessions, null, 2))
      
      console.log(`Successfully migrated session for IP: ${ipAddress}`)
    }
  } catch (error) {
    console.error('Legacy migration error:', error)
  }
}

// GET /api/sessions - Load conversations for current IP
export async function GET(request: NextRequest) {
  try {
    // Try to migrate legacy data first
    await migrateLegacySession(request)
    
    // Load session using new database system
    const { data } = await sessionManager.getSession(request)
    
    return NextResponse.json({
      success: true,
      conversations: data.conversations
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
    const { conversations } = await request.json()
    
    if (!Array.isArray(conversations)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid conversations data'
      }, { status: 400 })
    }
    
    // Get current session to preserve metadata
    const { data: currentSession } = await sessionManager.getSession(request)
    
    // Update with new conversations
    const success = await sessionManager.saveSession(request, {
      conversations,
      lastAccessed: new Date().toISOString(),
      metadata: currentSession.metadata
    })
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Session saved successfully'
      })
    } else {
      throw new Error('Failed to save session')
    }
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
    const success = await sessionManager.deleteSession(request)
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Session cleared successfully'
      })
    } else {
      throw new Error('Failed to clear session')
    }
  } catch (error) {
    console.error('Error clearing session:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to clear session'
    }, { status: 500 })
  }
}