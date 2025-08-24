// Server-side module for enhancing sources using existing Perplexity content
// This provides instant "AI-style" summaries without additional API calls

import { assessSourceCredibility, type CredibilityAssessment } from './source-credibility-server'

export interface PerplexitySummary {
  sourceUrl: string
  summary: string
  relevance: 'high' | 'medium' | 'low'
  perspective: 'supports' | 'contradicts' | 'neutral' | 'mixed'
  keyInsights: string[]
  credibilityContext: string
  extractedQuotes: string[]
  confidence: number
  processingStatus: 'success' | 'partial' | 'failed'
  enhancementType: 'perplexity' // Distinguishes from AI summaries
}

/**
 * Create rich summaries using existing Perplexity content
 * This is instant and doesn't require additional API calls
 */
export function createPerplexitySummary(
  source: any,
  claim: string,
  sourceIndex: number
): PerplexitySummary {
  const credibilityAssessment = assessSourceCredibility(
    source.url,
    source.title,
    source.publishedAt
  )

  // Extract content from various Perplexity fields
  const content = extractPerplexityContent(source)
  const relevance = assessRelevance(source, content, sourceIndex)
  const perspective = assessPerspective(content, claim)
  const keyInsights = generateKeyInsights(source, credibilityAssessment, content)
  const extractedQuotes = extractQuotes(content)
  
  // Create intelligent summary
  const summary = createIntelligentSummary(source, content, credibilityAssessment, claim)
  
  return {
    sourceUrl: source.url,
    summary,
    relevance,
    perspective,
    keyInsights,
    credibilityContext: generateCredibilityContext(credibilityAssessment),
    extractedQuotes,
    confidence: calculateConfidence(content, credibilityAssessment, relevance),
    processingStatus: content.length > 0 ? 'success' : 'partial',
    enhancementType: 'perplexity'
  }
}

/**
 * Extract existing content from Perplexity source data
 */
function extractPerplexityContent(source: any): string {
  // Priority order for Perplexity content
  const contentSources = [
    source.metadata?.snippet,        // Perplexity snippet (most relevant)
    source.metadata?.fullAbstract,   // OpenAlex abstracts
    source.excerpt,                  // General excerpts
    source.description,              // General descriptions
    source.summary,                  // Existing summaries
    source.metadata?.description     // Additional metadata
  ]
  
  for (const content of contentSources) {
    if (content && typeof content === 'string' && content.length > 20) {
      return content.trim()
    }
  }
  
  return ''
}

/**
 * Assess relevance based on source position and content quality
 */
function assessRelevance(source: any, content: string, sourceIndex: number): 'high' | 'medium' | 'low' {
  // Perplexity orders results by relevance, so early results are more relevant
  if (sourceIndex < 3 && content.length > 100) return 'high'
  if (sourceIndex < 8 && content.length > 50) return 'medium'
  if (content.length > 20) return 'medium'
  return 'low'
}

/**
 * Assess perspective using content analysis
 */
function assessPerspective(content: string, claim: string): 'supports' | 'contradicts' | 'neutral' | 'mixed' {
  if (!content) return 'neutral'
  
  const contentLower = content.toLowerCase()
  const claimLower = claim.toLowerCase()
  
  // Look for supporting language
  const supportWords = ['confirms', 'supports', 'proves', 'shows', 'demonstrates', 'evidence for', 'true', 'correct', 'accurate']
  const contradictWords = ['disproves', 'contradicts', 'false', 'incorrect', 'myth', 'debunked', 'no evidence', 'refutes']
  
  const supportCount = supportWords.reduce((count, word) => 
    count + (contentLower.split(word).length - 1), 0)
  const contradictCount = contradictWords.reduce((count, word) => 
    count + (contentLower.split(word).length - 1), 0)
  
  if (supportCount > contradictCount && supportCount > 0) return 'supports'
  if (contradictCount > supportCount && contradictCount > 0) return 'contradicts'
  if (supportCount > 0 && contradictCount > 0) return 'mixed'
  
  return 'neutral'
}

/**
 * Generate key insights based on source type and content
 */
function generateKeyInsights(source: any, credibility: CredibilityAssessment, content: string): string[] {
  const insights: string[] = []
  
  // Source type insights
  switch (credibility.sourceType) {
    case 'academic':
      insights.push('Peer-reviewed research findings')
      if (source.publishedAt) insights.push(`Published ${new Date(source.publishedAt).getFullYear()}`)
      break
    case 'government':
      insights.push('Official government position')
      insights.push('Authoritative data source')
      break
    case 'factcheck':
      insights.push('Professional fact-checking analysis')
      insights.push('Cross-referenced verification')
      break
    case 'news':
      insights.push(`Reported by ${source.publisher || 'news outlet'}`)
      if (credibility.mediaRank) {
        insights.push(`MediaRank #${credibility.mediaRank.rank} news source`)
      }
      break
    default:
      insights.push(`Information from ${source.publisher || 'web source'}`)
  }
  
  // Content-based insights
  if (content.length > 200) {
    insights.push('Detailed content available')
  }
  
  if (source.metadata?.date) {
    const sourceDate = new Date(source.metadata.date)
    const daysSince = Math.floor((Date.now() - sourceDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysSince < 7) {
      insights.push('Recent publication')
    } else if (daysSince < 30) {
      insights.push('Published this month')
    }
  }
  
  return insights.slice(0, 3) // Limit to 3 insights
}

/**
 * Extract meaningful quotes from content
 */
function extractQuotes(content: string): string[] {
  if (!content || content.length < 50) return []
  
  // Split by sentences and find meaningful quotes
  const sentences = content
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 25 && s.length < 150)
    .filter(s => !s.includes('http')) // Filter out URLs
  
  // Take first 2 substantial sentences as quotes
  return sentences.slice(0, 2)
}

/**
 * Create intelligent summary based on source type and content
 */
function createIntelligentSummary(source: any, content: string, credibility: CredibilityAssessment, claim: string): string {
  const sourceType = credibility.sourceType
  const publisher = source.publisher || 'this source'
  
  let prefix = ''
  switch (sourceType) {
    case 'academic':
      prefix = 'This peer-reviewed research'
      break
    case 'government':
      prefix = 'This government source'
      break
    case 'factcheck':
      prefix = 'This fact-checking organization'
      break
    case 'news':
      prefix = `${publisher}`
      break
    default:
      prefix = 'This source'
  }
  
  if (content.length > 150) {
    const truncatedContent = content.substring(0, 150) + '...'
    return `${prefix} provides relevant analysis: "${truncatedContent}"`
  } else if (content.length > 50) {
    return `${prefix} reports: "${content}"`
  } else {
    return `${prefix} provides information relevant to this claim from ${publisher}.`
  }
}

/**
 * Generate credibility context explanation
 */
function generateCredibilityContext(credibilityAssessment: CredibilityAssessment): string {
  const { score, badge, sourceType, reasoning } = credibilityAssessment
  
  let context = `Credibility: ${score}/100 (${badge}). `
  
  switch (sourceType) {
    case 'government':
      context += 'Government sources provide authoritative data and official positions.'
      break
    case 'academic':
      context += 'Academic sources undergo peer review and scholarly scrutiny.'
      break
    case 'factcheck':
      context += 'Fact-checking organizations use professional verification standards.'
      break
    case 'news':
      context += 'News credibility varies based on editorial standards and track record.'
      break
    default:
      context += 'General web sources require careful evaluation for accuracy.'
  }
  
  if (credibilityAssessment.mediaRank) {
    context += ` Ranked #${credibilityAssessment.mediaRank.rank} by MediaRank.`
  }
  
  return context
}

/**
 * Calculate confidence based on content quality and source credibility
 */
function calculateConfidence(content: string, credibility: CredibilityAssessment, relevance: string): number {
  let confidence = 0.5 // Base confidence
  
  // Content quality factor
  if (content.length > 200) confidence += 0.2
  else if (content.length > 100) confidence += 0.1
  else if (content.length > 50) confidence += 0.05
  
  // Credibility factor
  if (credibility.score >= 90) confidence += 0.2
  else if (credibility.score >= 70) confidence += 0.1
  else if (credibility.score >= 50) confidence += 0.05
  
  // Relevance factor
  if (relevance === 'high') confidence += 0.1
  else if (relevance === 'medium') confidence += 0.05
  
  return Math.min(0.95, Math.max(0.3, confidence)) // Clamp between 0.3 and 0.95
}

/**
 * Enhance all sources with Perplexity-based summaries
 */
export function enhanceSourcesWithPerplexity(sources: any[], claim: string): any[] {
  console.log(`[Perplexity Enhancement] Processing ${sources.length} sources with instant summaries`)
  
  const enhancedSources = sources.map((source, index) => {
    const perplexitySummary = createPerplexitySummary(source, claim, index)
    
    return {
      ...source,
      aiSummary: perplexitySummary, // Compatible with existing UI components
      metadata: {
        ...source.metadata,
        hasAISummary: true,
        summaryRelevance: perplexitySummary.relevance,
        summaryPerspective: perplexitySummary.perspective,
        summaryConfidence: perplexitySummary.confidence,
        enhancementType: 'perplexity'
      }
    }
  })
  
  const successCount = enhancedSources.filter(s => s.aiSummary.processingStatus === 'success').length
  console.log(`[Perplexity Enhancement] Enhanced ${successCount}/${sources.length} sources with instant summaries`)
  
  return enhancedSources
}