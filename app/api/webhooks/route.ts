import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRole } from '@/lib/auth'
import { webhookManager, type Webhook, type WebhookEvent } from '@/lib/webhook-manager'
import { applyRateLimit } from '@/lib/rate-limiter'

// GET /api/webhooks - Get user's webhooks
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const { allowed, headers } = await applyRateLimit(request, {
      windowSizeMs: 60 * 1000, // 1 minute
      maxRequests: 60, // 60 requests per minute
      keyPrefix: 'rate_limit:webhooks_get'
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
    const { authorized, user } = await requireAuth(request)
    
    if (!authorized || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const webhookId = searchParams.get('id')

    let responseData: any = {}

    if (webhookId) {
      // Get specific webhook
      const webhook = await webhookManager.getWebhook(webhookId)
      
      if (!webhook || webhook.userId !== user.id) {
        return NextResponse.json({
          success: false,
          error: 'Webhook not found'
        }, { status: 404 })
      }

      // Get delivery history
      const deliveries = await webhookManager.getWebhookDeliveries(webhookId, 20)
      
      responseData = {
        webhook: {
          ...webhook,
          // Don't expose secret in API response
          secret: webhook.secret ? '***' : undefined
        },
        deliveries
      }
    } else {
      // Get all user webhooks
      const webhooks = await webhookManager.getUserWebhooks(user.id)
      
      responseData = {
        webhooks: webhooks.map(webhook => ({
          ...webhook,
          // Don't expose secrets in list
          secret: webhook.secret ? '***' : undefined
        })),
        limits: {
          current: webhooks.length,
          maximum: user.tier === 'free' ? 3 : user.tier === 'premium' ? 10 : 50
        }
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
    console.error('Webhooks GET error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POST /api/webhooks - Create new webhook
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const { allowed, headers } = await applyRateLimit(request, {
      windowSizeMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 webhook creations per minute
      keyPrefix: 'rate_limit:webhooks_post'
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
    const { authorized, user } = await requireAuth(request)
    
    if (!authorized || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { 
      name, 
      url, 
      events, 
      active = true, 
      headers: customHeaders,
      retryConfig,
      filters
    } = body

    // Validate required fields
    if (!name || !url || !events || !Array.isArray(events)) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
        message: 'name, url, and events array are required'
      }, { status: 400 })
    }

    // Validate webhook name
    if (name.length < 3 || name.length > 100) {
      return NextResponse.json({
        success: false,
        error: 'Invalid name',
        message: 'Name must be between 3 and 100 characters'
      }, { status: 400 })
    }

    // Create webhook
    const { webhook, error } = await webhookManager.createWebhook(user.id, {
      name: name.trim(),
      url: url.trim(),
      events: events as WebhookEvent[],
      active,
      headers: customHeaders,
      retryConfig,
      filters
    })

    if (error || !webhook) {
      return NextResponse.json({
        success: false,
        error: error || 'Failed to create webhook',
        message: error || 'Unable to create webhook'
      }, { status: 400 })
    }

    const response = NextResponse.json({
      success: true,
      message: 'Webhook created successfully',
      data: {
        webhook: {
          ...webhook,
          // Include secret only in creation response
          secret: webhook.secret
        }
      },
      timestamp: new Date().toISOString()
    })

    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    console.error('Webhooks POST error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// PUT /api/webhooks - Update webhook
export async function PUT(request: NextRequest) {
  try {
    // Apply rate limiting
    const { allowed, headers } = await applyRateLimit(request, {
      windowSizeMs: 60 * 1000, // 1 minute
      maxRequests: 30, // 30 webhook updates per minute
      keyPrefix: 'rate_limit:webhooks_put'
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
    const { authorized, user } = await requireAuth(request)
    
    if (!authorized || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const webhookId = searchParams.get('id')

    if (!webhookId) {
      return NextResponse.json({
        success: false,
        error: 'Missing webhook ID',
        message: 'Webhook ID is required in query parameters'
      }, { status: 400 })
    }

    const body = await request.json()
    const updates = body

    // Remove fields that shouldn't be updated via API
    delete updates.id
    delete updates.userId
    delete updates.secret
    delete updates.metadata

    // Update webhook
    const success = await webhookManager.updateWebhook(webhookId, user.id, updates)
    
    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Update failed',
        message: 'Webhook not found or update failed'
      }, { status: 404 })
    }

    // Get updated webhook
    const updatedWebhook = await webhookManager.getWebhook(webhookId)

    const response = NextResponse.json({
      success: true,
      message: 'Webhook updated successfully',
      data: {
        webhook: updatedWebhook ? {
          ...updatedWebhook,
          secret: updatedWebhook.secret ? '***' : undefined
        } : null
      },
      timestamp: new Date().toISOString()
    })

    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    console.error('Webhooks PUT error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// DELETE /api/webhooks - Delete webhook
export async function DELETE(request: NextRequest) {
  try {
    // Apply rate limiting
    const { allowed, headers } = await applyRateLimit(request, {
      windowSizeMs: 60 * 1000, // 1 minute
      maxRequests: 20, // 20 webhook deletions per minute
      keyPrefix: 'rate_limit:webhooks_delete'
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
    const { authorized, user } = await requireAuth(request)
    
    if (!authorized || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const webhookId = searchParams.get('id')

    if (!webhookId) {
      return NextResponse.json({
        success: false,
        error: 'Missing webhook ID',
        message: 'Webhook ID is required in query parameters'
      }, { status: 400 })
    }

    // Delete webhook
    const success = await webhookManager.deleteWebhook(webhookId, user.id)
    
    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Deletion failed',
        message: 'Webhook not found or deletion failed'
      }, { status: 404 })
    }

    const response = NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully',
      timestamp: new Date().toISOString()
    })

    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    console.error('Webhooks DELETE error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}