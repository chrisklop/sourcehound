// Pre-built webhook integrations for popular services
import { type WebhookPayload } from './webhook-manager'

export interface SlackMessage {
  text?: string
  blocks?: any[]
  attachments?: SlackAttachment[]
  channel?: string
  username?: string
  icon_emoji?: string
}

export interface SlackAttachment {
  color?: string
  fallback?: string
  title?: string
  title_link?: string
  text?: string
  fields?: SlackField[]
  footer?: string
  ts?: number
}

export interface SlackField {
  title: string
  value: string
  short?: boolean
}

export interface DiscordEmbed {
  title?: string
  description?: string
  url?: string
  color?: number
  fields?: DiscordField[]
  footer?: {
    text: string
    icon_url?: string
  }
  thumbnail?: {
    url: string
  }
  timestamp?: string
}

export interface DiscordField {
  name: string
  value: string
  inline?: boolean
}

export interface DiscordMessage {
  content?: string
  embeds?: DiscordEmbed[]
  username?: string
  avatar_url?: string
}

export class WebhookIntegrations {
  // Convert SourceHound webhook payload to Slack message
  static formatSlackMessage(payload: WebhookPayload): SlackMessage {
    switch (payload.event) {
      case 'fact_check.completed':
        return this.formatSlackFactCheckCompleted(payload)
      
      case 'fact_check.failed':
        return this.formatSlackFactCheckFailed(payload)
      
      case 'user.registered':
        return this.formatSlackUserRegistered(payload)
      
      case 'collaboration.started':
        return this.formatSlackCollaborationStarted(payload)
      
      case 'rate_limit.exceeded':
        return this.formatSlackRateLimitExceeded(payload)
      
      default:
        return this.formatSlackGeneric(payload)
    }
  }

  // Convert SourceHound webhook payload to Discord message
  static formatDiscordMessage(payload: WebhookPayload): DiscordMessage {
    switch (payload.event) {
      case 'fact_check.completed':
        return this.formatDiscordFactCheckCompleted(payload)
      
      case 'fact_check.failed':
        return this.formatDiscordFactCheckFailed(payload)
      
      case 'user.registered':
        return this.formatDiscordUserRegistered(payload)
      
      case 'collaboration.started':
        return this.formatDiscordCollaborationStarted(payload)
      
      case 'rate_limit.exceeded':
        return this.formatDiscordRateLimitExceeded(payload)
      
      default:
        return this.formatDiscordGeneric(payload)
    }
  }

  // Slack formatters
  private static formatSlackFactCheckCompleted(payload: WebhookPayload): SlackMessage {
    const data = payload.data
    const verdict = data.verdict
    const user = payload.user

    const color = verdict.label === 'True' ? '#36a64f' : 
                 verdict.label === 'False' ? '#ff0000' : '#ffaa00'

    const confidenceEmoji = verdict.confidence > 0.8 ? '🔴' : 
                           verdict.confidence > 0.6 ? '🟡' : '🟠'

    return {
      text: `Fact-check completed by ${user?.username || 'Anonymous'}`,
      attachments: [{
        color,
        fallback: `Fact-check result: ${verdict.label} (${Math.round(verdict.confidence * 100)}% confidence)`,
        title: '🔍 Fact-Check Results',
        fields: [
          {
            title: 'Query',
            value: data.query,
            short: false
          },
          {
            title: 'Verdict',
            value: `${verdict.label} ${confidenceEmoji}`,
            short: true
          },
          {
            title: 'Confidence',
            value: `${Math.round(verdict.confidence * 100)}%`,
            short: true
          },
          {
            title: 'Processing Time',
            value: `${(data.processingTime / 1000).toFixed(1)}s`,
            short: true
          },
          {
            title: 'Sources Found',
            value: data.sources?.length || 0,
            short: true
          }
        ],
        footer: 'SourceHound Fact-Check',
        ts: Math.floor(payload.timestamp / 1000)
      }]
    }
  }

  private static formatSlackFactCheckFailed(payload: WebhookPayload): SlackMessage {
    const data = payload.data
    const user = payload.user

    return {
      text: `❌ Fact-check failed for ${user?.username || 'Anonymous'}`,
      attachments: [{
        color: '#ff0000',
        fallback: `Fact-check failed: ${data.error}`,
        title: '🚨 Fact-Check Failed',
        fields: [
          {
            title: 'Query',
            value: data.query,
            short: false
          },
          {
            title: 'Error',
            value: data.error,
            short: false
          }
        ],
        footer: 'SourceHound Error',
        ts: Math.floor(payload.timestamp / 1000)
      }]
    }
  }

  private static formatSlackUserRegistered(payload: WebhookPayload): SlackMessage {
    const data = payload.data
    const user = payload.user

    return {
      text: `👋 New user registered: ${user?.username}`,
      attachments: [{
        color: '#36a64f',
        title: '🎉 New User Registration',
        fields: [
          {
            title: 'Username',
            value: user?.username || 'Unknown',
            short: true
          },
          {
            title: 'Tier',
            value: user?.tier || 'free',
            short: true
          }
        ],
        footer: 'SourceHound Registration',
        ts: Math.floor(payload.timestamp / 1000)
      }]
    }
  }

  private static formatSlackCollaborationStarted(payload: WebhookPayload): SlackMessage {
    const data = payload.data
    const user = payload.user

    return {
      text: `🤝 Collaboration session started by ${user?.username}`,
      attachments: [{
        color: '#0099cc',
        title: '👥 Collaboration Started',
        fields: [
          {
            title: 'Conversation ID',
            value: data.conversationId,
            short: true
          },
          {
            title: 'Started by',
            value: user?.username || 'Unknown',
            short: true
          }
        ],
        footer: 'SourceHound Collaboration',
        ts: Math.floor(payload.timestamp / 1000)
      }]
    }
  }

  private static formatSlackRateLimitExceeded(payload: WebhookPayload): SlackMessage {
    const data = payload.data
    const user = payload.user

    return {
      text: `⚠️ Rate limit exceeded for ${user?.username}`,
      attachments: [{
        color: '#ff9900',
        title: '🚫 Rate Limit Exceeded',
        fields: [
          {
            title: 'User',
            value: user?.username || 'Anonymous',
            short: true
          },
          {
            title: 'Limit Type',
            value: data.limitType || 'Unknown',
            short: true
          },
          {
            title: 'Requests Remaining',
            value: data.remaining || 0,
            short: true
          }
        ],
        footer: 'SourceHound Rate Limiting',
        ts: Math.floor(payload.timestamp / 1000)
      }]
    }
  }

  private static formatSlackGeneric(payload: WebhookPayload): SlackMessage {
    return {
      text: `📡 ${payload.event.replace('_', ' ')} event triggered`,
      attachments: [{
        color: '#0099cc',
        title: `🔔 ${payload.event}`,
        text: JSON.stringify(payload.data, null, 2),
        footer: 'SourceHound Event',
        ts: Math.floor(payload.timestamp / 1000)
      }]
    }
  }

  // Discord formatters
  private static formatDiscordFactCheckCompleted(payload: WebhookPayload): DiscordMessage {
    const data = payload.data
    const verdict = data.verdict
    const user = payload.user

    const color = verdict.label === 'True' ? 0x36a64f : 
                 verdict.label === 'False' ? 0xff0000 : 0xffaa00

    const confidenceEmoji = verdict.confidence > 0.8 ? '🔴' : 
                           verdict.confidence > 0.6 ? '🟡' : '🟠'

    return {
      embeds: [{
        title: '🔍 Fact-Check Completed',
        description: `Results for query by ${user?.username || 'Anonymous'}`,
        color,
        fields: [
          {
            name: 'Query',
            value: data.query.length > 1000 ? `${data.query.substring(0, 1000)}...` : data.query,
            inline: false
          },
          {
            name: 'Verdict',
            value: `${verdict.label} ${confidenceEmoji}`,
            inline: true
          },
          {
            name: 'Confidence',
            value: `${Math.round(verdict.confidence * 100)}%`,
            inline: true
          },
          {
            name: 'Processing Time',
            value: `${(data.processingTime / 1000).toFixed(1)}s`,
            inline: true
          },
          {
            name: 'Sources',
            value: `${data.sources?.length || 0} sources analyzed`,
            inline: true
          }
        ],
        footer: {
          text: 'SourceHound Fact-Check'
        },
        timestamp: new Date(payload.timestamp).toISOString()
      }]
    }
  }

  private static formatDiscordFactCheckFailed(payload: WebhookPayload): DiscordMessage {
    const data = payload.data
    const user = payload.user

    return {
      embeds: [{
        title: '🚨 Fact-Check Failed',
        description: `Error occurred during fact-check for ${user?.username || 'Anonymous'}`,
        color: 0xff0000,
        fields: [
          {
            name: 'Query',
            value: data.query.length > 1000 ? `${data.query.substring(0, 1000)}...` : data.query,
            inline: false
          },
          {
            name: 'Error',
            value: data.error,
            inline: false
          }
        ],
        footer: {
          text: 'SourceHound Error'
        },
        timestamp: new Date(payload.timestamp).toISOString()
      }]
    }
  }

  private static formatDiscordUserRegistered(payload: WebhookPayload): DiscordMessage {
    const user = payload.user

    return {
      embeds: [{
        title: '🎉 New User Registered',
        description: `Welcome to SourceHound!`,
        color: 0x36a64f,
        fields: [
          {
            name: 'Username',
            value: user?.username || 'Unknown',
            inline: true
          },
          {
            name: 'Tier',
            value: (user?.tier || 'free').toUpperCase(),
            inline: true
          }
        ],
        footer: {
          text: 'SourceHound Registration'
        },
        timestamp: new Date(payload.timestamp).toISOString()
      }]
    }
  }

  private static formatDiscordCollaborationStarted(payload: WebhookPayload): DiscordMessage {
    const data = payload.data
    const user = payload.user

    return {
      embeds: [{
        title: '👥 Collaboration Started',
        description: `New collaboration session initiated`,
        color: 0x0099cc,
        fields: [
          {
            name: 'Conversation ID',
            value: data.conversationId,
            inline: true
          },
          {
            name: 'Started by',
            value: user?.username || 'Unknown',
            inline: true
          }
        ],
        footer: {
          text: 'SourceHound Collaboration'
        },
        timestamp: new Date(payload.timestamp).toISOString()
      }]
    }
  }

  private static formatDiscordRateLimitExceeded(payload: WebhookPayload): DiscordMessage {
    const data = payload.data
    const user = payload.user

    return {
      embeds: [{
        title: '🚫 Rate Limit Exceeded',
        description: `Rate limit reached for user`,
        color: 0xff9900,
        fields: [
          {
            name: 'User',
            value: user?.username || 'Anonymous',
            inline: true
          },
          {
            name: 'Limit Type',
            value: data.limitType || 'Unknown',
            inline: true
          },
          {
            name: 'Requests Remaining',
            value: (data.remaining || 0).toString(),
            inline: true
          }
        ],
        footer: {
          text: 'SourceHound Rate Limiting'
        },
        timestamp: new Date(payload.timestamp).toISOString()
      }]
    }
  }

  private static formatDiscordGeneric(payload: WebhookPayload): DiscordMessage {
    return {
      embeds: [{
        title: `🔔 ${payload.event.replace('_', ' ')}`,
        description: 'Event triggered in SourceHound',
        color: 0x0099cc,
        fields: [
          {
            name: 'Event Data',
            value: '```json\n' + JSON.stringify(payload.data, null, 2).substring(0, 1000) + '\n```',
            inline: false
          }
        ],
        footer: {
          text: 'SourceHound Event'
        },
        timestamp: new Date(payload.timestamp).toISOString()
      }]
    }
  }

  // Get integration-specific webhook templates
  static getSlackTemplate(eventType: string): Partial<any> {
    return {
      name: `Slack - ${eventType}`,
      url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK',
      events: [eventType],
      headers: {
        'Content-Type': 'application/json'
      },
      retryConfig: {
        maxRetries: 3,
        retryDelayMs: 1000,
        backoffMultiplier: 2
      }
    }
  }

  static getDiscordTemplate(eventType: string): Partial<any> {
    return {
      name: `Discord - ${eventType}`,
      url: 'https://discord.com/api/webhooks/YOUR/DISCORD/WEBHOOK',
      events: [eventType],
      headers: {
        'Content-Type': 'application/json'
      },
      retryConfig: {
        maxRetries: 3,
        retryDelayMs: 1000,
        backoffMultiplier: 2
      }
    }
  }

  static getMicrosoftTeamsTemplate(eventType: string): Partial<any> {
    return {
      name: `Teams - ${eventType}`,
      url: 'https://outlook.office.com/webhook/YOUR/TEAMS/WEBHOOK',
      events: [eventType],
      headers: {
        'Content-Type': 'application/json'
      },
      retryConfig: {
        maxRetries: 3,
        retryDelayMs: 2000,
        backoffMultiplier: 2
      }
    }
  }
}