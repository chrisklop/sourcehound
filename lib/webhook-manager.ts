// Webhook management system for third-party integrations
import { redis } from './db'
import { authManager } from './auth'
import crypto from 'crypto'

export interface Webhook {
  id: string
  userId: string
  name: string
  url: string
  events: WebhookEvent[]
  secret?: string
  active: boolean
  headers?: { [key: string]: string }
  retryConfig: {
    maxRetries: number
    retryDelayMs: number
    backoffMultiplier: number
  }
  metadata: {
    createdAt: Date
    updatedAt: Date
    lastTriggeredAt?: Date
    totalDeliveries: number
    successfulDeliveries: number
    failedDeliveries: number
  }
  filters?: {
    userIds?: string[]
    queryPatterns?: string[]
    verdictLabels?: string[]
    confidenceThreshold?: number
  }
}

export type WebhookEvent = 
  | 'fact_check.completed'
  | 'fact_check.failed' 
  | 'user.registered'
  | 'user.login'
  | 'collaboration.started'
  | 'collaboration.ended'
  | 'rate_limit.exceeded'
  | 'system.health'

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: number
  webhookId: string
  data: any
  user?: {
    id: string
    username: string
    tier: string
  }
  signature?: string
}

export interface WebhookDelivery {
  id: string
  webhookId: string
  event: WebhookEvent
  payload: WebhookPayload
  url: string
  attempts: WebhookAttempt[]
  status: 'pending' | 'success' | 'failed' | 'retry'
  createdAt: Date
  completedAt?: Date
}

export interface WebhookAttempt {
  attemptNumber: number
  timestamp: Date
  httpStatus?: number
  responseBody?: string
  errorMessage?: string
  duration: number
}

class WebhookManager {
  // Create new webhook
  async createWebhook(userId: string, webhookData: Partial<Webhook>): Promise<{ webhook: Webhook | null, error: string | null }> {
    try {
      // Validate required fields
      if (!webhookData.name || !webhookData.url || !webhookData.events) {
        return { webhook: null, error: 'Name, URL, and events are required' }
      }

      // Validate URL format
      try {
        new URL(webhookData.url)
      } catch {
        return { webhook: null, error: 'Invalid URL format' }
      }

      // Validate events
      const validEvents: WebhookEvent[] = [
        'fact_check.completed', 'fact_check.failed', 'user.registered', 
        'user.login', 'collaboration.started', 'collaboration.ended',
        'rate_limit.exceeded', 'system.health'
      ]
      
      const invalidEvents = webhookData.events!.filter(event => !validEvents.includes(event))
      if (invalidEvents.length > 0) {
        return { webhook: null, error: `Invalid events: ${invalidEvents.join(', ')}` }
      }

      // Check user's webhook limit
      const userWebhooks = await this.getUserWebhooks(userId)
      const user = await authManager.getUserById(userId)
      const maxWebhooks = user?.tier === 'free' ? 3 : user?.tier === 'premium' ? 10 : 50

      if (userWebhooks.length >= maxWebhooks) {
        return { webhook: null, error: `Maximum ${maxWebhooks} webhooks allowed for ${user?.tier} tier` }
      }

      // Generate webhook ID and secret
      const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const secret = crypto.randomBytes(32).toString('hex')

      // Create webhook
      const webhook: Webhook = {
        id: webhookId,
        userId,
        name: webhookData.name,
        url: webhookData.url,
        events: webhookData.events,
        secret,
        active: webhookData.active ?? true,
        headers: webhookData.headers || {},
        retryConfig: webhookData.retryConfig || {
          maxRetries: 3,
          retryDelayMs: 1000,
          backoffMultiplier: 2
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          totalDeliveries: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0
        },
        filters: webhookData.filters
      }

      // Store webhook in Redis
      await redis.setex(
        `webhook:${webhookId}`,
        365 * 24 * 60 * 60, // 1 year
        JSON.stringify(webhook)
      )

      // Add to user's webhook list
      await redis.sadd(`user_webhooks:${userId}`, webhookId)
      await redis.expire(`user_webhooks:${userId}`, 365 * 24 * 60 * 60)

      // Index by events for efficient lookup
      for (const event of webhook.events) {
        await redis.sadd(`webhooks_by_event:${event}`, webhookId)
        await redis.expire(`webhooks_by_event:${event}`, 365 * 24 * 60 * 60)
      }

      console.log(`[Webhook] Created webhook ${webhookId} for user ${userId}`)
      return { webhook, error: null }

    } catch (error) {
      console.error('Error creating webhook:', error)
      return { webhook: null, error: 'Failed to create webhook' }
    }
  }

  // Get webhook by ID
  async getWebhook(webhookId: string): Promise<Webhook | null> {
    try {
      const webhookData = await redis.get(`webhook:${webhookId}`)
      if (!webhookData) return null

      return JSON.parse(webhookData)
    } catch (error) {
      console.error('Error getting webhook:', error)
      return null
    }
  }

  // Get user's webhooks
  async getUserWebhooks(userId: string): Promise<Webhook[]> {
    try {
      const webhookIds = await redis.smembers(`user_webhooks:${userId}`)
      const webhooks: Webhook[] = []

      for (const webhookId of webhookIds) {
        const webhook = await this.getWebhook(webhookId)
        if (webhook) {
          webhooks.push(webhook)
        }
      }

      return webhooks.sort((a, b) => new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime())
    } catch (error) {
      console.error('Error getting user webhooks:', error)
      return []
    }
  }

  // Update webhook
  async updateWebhook(webhookId: string, userId: string, updates: Partial<Webhook>): Promise<boolean> {
    try {
      const webhook = await this.getWebhook(webhookId)
      if (!webhook || webhook.userId !== userId) {
        return false
      }

      // Validate URL if updated
      if (updates.url) {
        try {
          new URL(updates.url)
        } catch {
          return false
        }
      }

      // Update webhook
      const updatedWebhook = {
        ...webhook,
        ...updates,
        metadata: {
          ...webhook.metadata,
          updatedAt: new Date()
        }
      }

      // Store updated webhook
      await redis.setex(
        `webhook:${webhookId}`,
        365 * 24 * 60 * 60,
        JSON.stringify(updatedWebhook)
      )

      // Update event indexes if events changed
      if (updates.events && JSON.stringify(updates.events) !== JSON.stringify(webhook.events)) {
        // Remove from old event indexes
        for (const event of webhook.events) {
          await redis.srem(`webhooks_by_event:${event}`, webhookId)
        }
        
        // Add to new event indexes
        for (const event of updates.events) {
          await redis.sadd(`webhooks_by_event:${event}`, webhookId)
          await redis.expire(`webhooks_by_event:${event}`, 365 * 24 * 60 * 60)
        }
      }

      console.log(`[Webhook] Updated webhook ${webhookId}`)
      return true
    } catch (error) {
      console.error('Error updating webhook:', error)
      return false
    }
  }

  // Delete webhook
  async deleteWebhook(webhookId: string, userId: string): Promise<boolean> {
    try {
      const webhook = await this.getWebhook(webhookId)
      if (!webhook || webhook.userId !== userId) {
        return false
      }

      // Remove from Redis
      await redis.del(`webhook:${webhookId}`)
      
      // Remove from user's webhook list
      await redis.srem(`user_webhooks:${userId}`, webhookId)

      // Remove from event indexes
      for (const event of webhook.events) {
        await redis.srem(`webhooks_by_event:${event}`, webhookId)
      }

      // Clean up deliveries (keep recent ones for analytics)
      const deliveryKeys = await redis.keys(`webhook_delivery:${webhookId}:*`)
      if (deliveryKeys.length > 0) {
        await redis.del(...deliveryKeys)
      }

      console.log(`[Webhook] Deleted webhook ${webhookId}`)
      return true
    } catch (error) {
      console.error('Error deleting webhook:', error)
      return false
    }
  }

  // Trigger webhook event
  async triggerEvent(event: WebhookEvent, data: any, user?: any): Promise<void> {
    try {
      // Get webhooks subscribed to this event
      const webhookIds = await redis.smembers(`webhooks_by_event:${event}`)
      
      if (webhookIds.length === 0) {
        return
      }

      console.log(`[Webhook] Triggering ${event} event for ${webhookIds.length} webhooks`)

      // Process each webhook
      for (const webhookId of webhookIds) {
        const webhook = await this.getWebhook(webhookId)
        if (!webhook || !webhook.active) {
          continue
        }

        // Apply filters if configured
        if (!this.passesFilters(webhook, event, data, user)) {
          continue
        }

        // Create and queue delivery
        await this.queueDelivery(webhook, event, data, user)
      }
    } catch (error) {
      console.error('Error triggering webhook event:', error)
    }
  }

  // Check if webhook passes filters
  private passesFilters(webhook: Webhook, event: WebhookEvent, data: any, user?: any): boolean {
    if (!webhook.filters) return true

    const filters = webhook.filters

    // User ID filter
    if (filters.userIds && filters.userIds.length > 0) {
      if (!user || !filters.userIds.includes(user.id)) {
        return false
      }
    }

    // Query pattern filter
    if (filters.queryPatterns && filters.queryPatterns.length > 0) {
      if (!data.query) return false
      
      const queryLower = data.query.toLowerCase()
      const hasMatch = filters.queryPatterns.some(pattern => 
        queryLower.includes(pattern.toLowerCase())
      )
      if (!hasMatch) return false
    }

    // Verdict label filter
    if (filters.verdictLabels && filters.verdictLabels.length > 0) {
      if (!data.verdict || !filters.verdictLabels.includes(data.verdict.label)) {
        return false
      }
    }

    // Confidence threshold filter
    if (filters.confidenceThreshold !== undefined) {
      if (!data.verdict || data.verdict.confidence < filters.confidenceThreshold) {
        return false
      }
    }

    return true
  }

  // Queue webhook delivery
  private async queueDelivery(webhook: Webhook, event: WebhookEvent, data: any, user?: any): Promise<void> {
    try {
      const deliveryId = `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Create payload
      const payload: WebhookPayload = {
        event,
        timestamp: Date.now(),
        webhookId: webhook.id,
        data,
        user: user ? {
          id: user.id,
          username: user.username,
          tier: user.tier
        } : undefined
      }

      // Add signature if webhook has secret
      if (webhook.secret) {
        payload.signature = this.generateSignature(JSON.stringify(payload), webhook.secret)
      }

      // Create delivery record
      const delivery: WebhookDelivery = {
        id: deliveryId,
        webhookId: webhook.id,
        event,
        payload,
        url: webhook.url,
        attempts: [],
        status: 'pending',
        createdAt: new Date()
      }

      // Store delivery
      await redis.setex(
        `webhook_delivery:${webhook.id}:${deliveryId}`,
        7 * 24 * 60 * 60, // 7 days
        JSON.stringify(delivery)
      )

      // Queue for processing
      await redis.lpush('webhook_delivery_queue', deliveryId)

      // Process delivery immediately (in background)
      setImmediate(() => this.processDelivery(deliveryId))

    } catch (error) {
      console.error('Error queuing webhook delivery:', error)
    }
  }

  // Process webhook delivery
  private async processDelivery(deliveryId: string): Promise<void> {
    try {
      // Find delivery record
      const deliveryKeys = await redis.keys(`webhook_delivery:*:${deliveryId}`)
      if (deliveryKeys.length === 0) {
        return
      }

      const deliveryData = await redis.get(deliveryKeys[0])
      if (!deliveryData) {
        return
      }

      const delivery: WebhookDelivery = JSON.parse(deliveryData)
      const webhook = await this.getWebhook(delivery.webhookId)
      
      if (!webhook) {
        return
      }

      // Attempt delivery
      let success = false
      let attempt = 1
      
      while (attempt <= webhook.retryConfig.maxRetries && !success) {
        const attemptResult = await this.attemptDelivery(webhook, delivery, attempt)
        delivery.attempts.push(attemptResult)

        if (attemptResult.httpStatus && attemptResult.httpStatus >= 200 && attemptResult.httpStatus < 300) {
          success = true
          delivery.status = 'success'
          delivery.completedAt = new Date()
          
          // Update webhook stats
          await this.updateWebhookStats(webhook.id, true)
          
          console.log(`[Webhook] Delivery ${deliveryId} succeeded on attempt ${attempt}`)
        } else {
          attempt++
          if (attempt <= webhook.retryConfig.maxRetries) {
            // Wait before retry with exponential backoff
            const delay = webhook.retryConfig.retryDelayMs * Math.pow(webhook.retryConfig.backoffMultiplier, attempt - 2)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }

      if (!success) {
        delivery.status = 'failed'
        delivery.completedAt = new Date()
        await this.updateWebhookStats(webhook.id, false)
        console.log(`[Webhook] Delivery ${deliveryId} failed after ${webhook.retryConfig.maxRetries} attempts`)
      }

      // Update delivery record
      await redis.setex(
        deliveryKeys[0],
        7 * 24 * 60 * 60,
        JSON.stringify(delivery)
      )

    } catch (error) {
      console.error('Error processing webhook delivery:', error)
    }
  }

  // Attempt single webhook delivery
  private async attemptDelivery(webhook: Webhook, delivery: WebhookDelivery, attemptNumber: number): Promise<WebhookAttempt> {
    const startTime = Date.now()
    const attempt: WebhookAttempt = {
      attemptNumber,
      timestamp: new Date(),
      duration: 0
    }

    try {
      // Prepare headers
      const headers: { [key: string]: string } = {
        'Content-Type': 'application/json',
        'User-Agent': 'SourceHound-Webhook/1.0',
        'X-Webhook-Event': delivery.event,
        'X-Webhook-ID': webhook.id,
        'X-Delivery-ID': delivery.id,
        ...webhook.headers
      }

      if (delivery.payload.signature) {
        headers['X-Hub-Signature-256'] = `sha256=${delivery.payload.signature}`
      }

      // Make HTTP request
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(delivery.payload),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      attempt.httpStatus = response.status
      attempt.responseBody = await response.text()
      attempt.duration = Date.now() - startTime

      return attempt

    } catch (error) {
      attempt.errorMessage = error instanceof Error ? error.message : 'Unknown error'
      attempt.duration = Date.now() - startTime
      return attempt
    }
  }

  // Generate HMAC signature for webhook security
  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
  }

  // Verify webhook signature
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret)
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  }

  // Update webhook delivery statistics
  private async updateWebhookStats(webhookId: string, success: boolean): Promise<void> {
    try {
      const webhook = await this.getWebhook(webhookId)
      if (!webhook) return

      webhook.metadata.totalDeliveries++
      webhook.metadata.lastTriggeredAt = new Date()
      
      if (success) {
        webhook.metadata.successfulDeliveries++
      } else {
        webhook.metadata.failedDeliveries++
      }

      await redis.setex(
        `webhook:${webhookId}`,
        365 * 24 * 60 * 60,
        JSON.stringify(webhook)
      )
    } catch (error) {
      console.error('Error updating webhook stats:', error)
    }
  }

  // Get webhook delivery history
  async getWebhookDeliveries(webhookId: string, limit: number = 50): Promise<WebhookDelivery[]> {
    try {
      const deliveryKeys = await redis.keys(`webhook_delivery:${webhookId}:*`)
      const deliveries: WebhookDelivery[] = []

      // Get deliveries (limited)
      const limitedKeys = deliveryKeys.slice(0, limit)
      
      for (const key of limitedKeys) {
        const deliveryData = await redis.get(key)
        if (deliveryData) {
          deliveries.push(JSON.parse(deliveryData))
        }
      }

      // Sort by creation time (newest first)
      return deliveries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } catch (error) {
      console.error('Error getting webhook deliveries:', error)
      return []
    }
  }

  // Get system webhook statistics
  async getWebhookStats(): Promise<any> {
    try {
      const webhookKeys = await redis.keys('webhook:*')
      const totalWebhooks = webhookKeys.length

      let activeWebhooks = 0
      let totalDeliveries = 0
      let successfulDeliveries = 0
      let failedDeliveries = 0

      // Sample webhooks for stats (to avoid performance issues)
      const sampleSize = Math.min(100, webhookKeys.length)
      const sampleKeys = webhookKeys.slice(0, sampleSize)

      for (const key of sampleKeys) {
        const webhookData = await redis.get(key)
        if (webhookData) {
          const webhook: Webhook = JSON.parse(webhookData)
          if (webhook.active) activeWebhooks++
          
          totalDeliveries += webhook.metadata.totalDeliveries
          successfulDeliveries += webhook.metadata.successfulDeliveries
          failedDeliveries += webhook.metadata.failedDeliveries
        }
      }

      // Extrapolate if we sampled
      if (sampleSize < totalWebhooks) {
        const ratio = totalWebhooks / sampleSize
        activeWebhooks = Math.round(activeWebhooks * ratio)
        totalDeliveries = Math.round(totalDeliveries * ratio)
        successfulDeliveries = Math.round(successfulDeliveries * ratio)
        failedDeliveries = Math.round(failedDeliveries * ratio)
      }

      return {
        totalWebhooks,
        activeWebhooks,
        totalDeliveries,
        successfulDeliveries,
        failedDeliveries,
        successRate: totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0
      }
    } catch (error) {
      console.error('Error getting webhook stats:', error)
      return {
        totalWebhooks: 0,
        activeWebhooks: 0,
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        successRate: 0
      }
    }
  }
}

export const webhookManager = new WebhookManager()