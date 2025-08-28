import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { webhookManager } from '@/lib/webhook-manager'
import { applyRateLimit } from '@/lib/rate-limiter'

// POST /api/webhooks/test - Test webhook delivery
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const { allowed, headers } = await applyRateLimit(request, {
      windowSizeMs: 60 * 1000, // 1 minute
      maxRequests: 5, // 5 webhook tests per minute
      keyPrefix: 'rate_limit:webhooks_test'
    })
    
    if (!allowed) {
      return NextResponse.json({
        success: false,
        error: "Rate limit exceeded for webhook testing"
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

    // Get webhook
    const webhook = await webhookManager.getWebhook(webhookId)
    
    if (!webhook || webhook.userId !== user.id) {
      return NextResponse.json({
        success: false,
        error: 'Webhook not found'
      }, { status: 404 })
    }

    // Create test payload
    const testData = {
      test: true,
      message: 'This is a test webhook delivery from SourceHound',
      timestamp: new Date().toISOString(),
      user: {
        id: user.id,
        username: user.username
      },
      sampleData: {
        query: 'Test claim: The Earth is round',
        verdict: {
          label: 'True',
          confidence: 0.95,
          summary: 'The Earth is indeed round, as confirmed by scientific evidence.'
        },
        sources: [
          {
            title: 'Earth\'s Shape - NASA',
            url: 'https://nasa.gov/earth-shape',
            credibilityScore: 98
          }
        ]
      }
    }

    // Trigger test webhook
    await webhookManager.triggerEvent('fact_check.completed', testData, user)

    const response = NextResponse.json({
      success: true,
      message: 'Test webhook sent successfully',
      data: {
        webhookId: webhook.id,
        webhookName: webhook.name,
        testPayload: testData
      },
      timestamp: new Date().toISOString()
    })

    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    console.error('Webhook test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}