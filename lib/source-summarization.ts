// Server-side module for AI source summarization

import { assessSourceCredibility, type CredibilityAssessment } from './source-credibility'

/**
 * AI Source Summarization System
 * Generates intelligent summaries for each source explaining its relevance,
 * credibility context, and key insights for the specific claim being fact-checked.
 */

export interface SourceSummary {
  sourceUrl: string
  summary: string
  relevance: 'high' | 'medium' | 'low'
  perspective: 'supports' | 'contradicts' | 'neutral' | 'mixed'
  keyInsights: string[]
  credibilityContext: string
  extractedQuotes: string[]
  confidence: number
  processingStatus: 'success' | 'failed' | 'partial'
  errorMessage?: string
}

export interface BatchSummaryResult {
  summaries: SourceSummary[]
  totalProcessed: number
  successCount: number
  failedCount: number
  averageConfidence: number
  processingTimeMs: number
}

/**
 * Summarize an individual source in context of a specific claim
 * Uses multi-tier approach: existing content → AI enhancement → fallback
 */
export async function summarizeSource(
  source: any,
  claim: string,
  signal?: AbortSignal
): Promise<SourceSummary> {
  const startTime = Date.now()
  
  try {
    // First assess the source's credibility
    const credibilityAssessment = assessSourceCredibility(
      source.url,
      source.title,
      source.publishedAt
    )

    // Check for existing content that can serve as summary
    const existingContent = extractExistingContent(source)
    
    if (existingContent && existingContent.length > 50) {
      // Use existing content (OpenAlex abstracts, snippets, etc.) with optional AI enhancement
      console.log(`[AI Summary] Using existing content for ${source.url}`)
      
      try {
        const enhancedSummary = await enhanceExistingContent(existingContent, source, claim, credibilityAssessment, signal)
        
        return {
          sourceUrl: source.url,
          summary: enhancedSummary.summary,
          relevance: enhancedSummary.relevance,
          perspective: enhancedSummary.perspective,
          keyInsights: enhancedSummary.keyInsights,
          credibilityContext: generateCredibilityContext(credibilityAssessment),
          extractedQuotes: enhancedSummary.extractedQuotes,
          confidence: enhancedSummary.confidence,
          processingStatus: 'success'
        }
      } catch (error) {
        // If AI enhancement fails, use content without AI analysis
        console.log(`[AI Summary] AI enhancement failed, using content directly for ${source.url}`)
        const directSummary = createSummaryFromContent(existingContent, source, credibilityAssessment)
        
        return {
          sourceUrl: source.url,
          summary: directSummary.summary,
          relevance: directSummary.relevance,
          perspective: directSummary.perspective,
          keyInsights: directSummary.keyInsights,
          credibilityContext: generateCredibilityContext(credibilityAssessment),
          extractedQuotes: directSummary.extractedQuotes,
          confidence: directSummary.confidence,
          processingStatus: 'success'
        }
      }
    } else {
      // No existing content, use full AI summarization
      console.log(`[AI Summary] Generating AI summary for ${source.url}`)
      const sourceContext = {
        title: source.title || 'Untitled Source',
        publisher: source.publisher || 'Unknown Publisher',
        url: source.url,
        domain: source.metadata?.domain || 'unknown',
        snippet: source.metadata?.snippet || '',
        sourceType: credibilityAssessment.sourceType,
        credibilityScore: credibilityAssessment.score,
        credibilityBadge: credibilityAssessment.badge
      }

      const aiSummary = await generateAISourceSummary(sourceContext, claim, signal)
      
      return {
        sourceUrl: source.url,
        summary: aiSummary.summary,
        relevance: aiSummary.relevance,
        perspective: aiSummary.perspective,
        keyInsights: aiSummary.keyInsights,
        credibilityContext: generateCredibilityContext(credibilityAssessment),
        extractedQuotes: aiSummary.extractedQuotes,
        confidence: aiSummary.confidence,
        processingStatus: 'success'
      }
    }
  } catch (error) {
    console.error(`[AI Summary] Failed to summarize source ${source.url}:`, error)
    
    // Fallback summary based on available metadata
    const fallbackSummary = generateFallbackSummary(source, claim)
    
    return {
      sourceUrl: source.url,
      summary: fallbackSummary.summary,
      relevance: 'medium',
      perspective: 'neutral',
      keyInsights: fallbackSummary.keyInsights,
      credibilityContext: fallbackSummary.credibilityContext,
      extractedQuotes: [],
      confidence: 0.4,
      processingStatus: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Extract existing content that can serve as a summary
 */
function extractExistingContent(source: any): string | null {
  // Priority order for existing content
  const contentSources = [
    source.metadata?.fullAbstract,     // OpenAlex abstracts
    source.metadata?.snippet,          // Perplexity snippets
    source.excerpt,                    // General excerpts
    source.description,                // General descriptions
    source.summary                     // Existing summaries
  ]
  
  for (const content of contentSources) {
    if (content && typeof content === 'string' && content.length > 50) {
      return content.trim()
    }
  }
  
  return null
}

/**
 * Enhance existing content with AI analysis for relevance and perspective
 */
async function enhanceExistingContent(
  content: string,
  source: any,
  claim: string,
  credibilityAssessment: any,
  signal?: AbortSignal
): Promise<{
  summary: string
  relevance: 'high' | 'medium' | 'low'
  perspective: 'supports' | 'contradicts' | 'neutral' | 'mixed'
  keyInsights: string[]
  extractedQuotes: string[]
  confidence: number
}> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  
  if (!OPENAI_API_KEY) {
    // Fallback without AI enhancement
    return {
      summary: `${source.title} provides relevant information about this topic. ${content.substring(0, 150)}...`,
      relevance: 'medium',
      perspective: 'neutral',
      keyInsights: [`Content from ${source.publisher || 'this source'}`, 'Provides context on the topic'],
      extractedQuotes: extractKeyQuotes(content),
      confidence: 0.6
    }
  }

  const controller = new AbortController()
  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }
  
  // Aggressive timeout for content enhancement (6 seconds)
  const timeoutId = setTimeout(() => controller.abort(), 6000)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-2024-04-09',
        messages: [
          {
            role: 'system',
            content: `You are analyzing how source content relates to a specific claim. The content is provided - just analyze its relevance and perspective.

Respond in valid JSON format:
{
  "summary": "2 sentence summary of how this content relates to the claim",
  "relevance": "high|medium|low",
  "perspective": "supports|contradicts|neutral|mixed",
  "keyInsights": ["insight 1", "insight 2"],
  "extractedQuotes": ["key quote 1", "key quote 2"],
  "confidence": 0.85
}`
          },
          {
            role: 'user',
            content: `Analyze how this content relates to the claim: "${claim}"

Source: ${source.title} (${source.publisher})
Content: ${content}

Focus on relevance and perspective relative to the claim.`
          }
        ],
        temperature: 0.1,
        max_tokens: 600
      })
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const responseContent = data.choices[0]?.message?.content

    if (!responseContent) {
      throw new Error("No content received from OpenAI")
    }

    // Parse JSON response
    const jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/) || responseContent.match(/\{[\s\S]*\}/)
    const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : responseContent
    
    const parsed = JSON.parse(jsonString)
    
    return {
      summary: parsed.summary || `This source provides relevant information about the topic.`,
      relevance: ['high', 'medium', 'low'].includes(parsed.relevance) ? parsed.relevance : 'medium',
      perspective: ['supports', 'contradicts', 'neutral', 'mixed'].includes(parsed.perspective) ? parsed.perspective : 'neutral',
      keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights.slice(0, 3) : [],
      extractedQuotes: Array.isArray(parsed.extractedQuotes) ? parsed.extractedQuotes.slice(0, 2) : extractKeyQuotes(content),
      confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.75
    }
  } catch (error) {
    clearTimeout(timeoutId)
    console.error('[AI Summary] Content enhancement failed:', error)
    
    // Fallback without AI
    return {
      summary: `${source.title} provides relevant information. ${content.substring(0, 120)}...`,
      relevance: 'medium',
      perspective: 'neutral',
      keyInsights: [`Information from ${source.publisher || 'this source'}`],
      extractedQuotes: extractKeyQuotes(content),
      confidence: 0.6
    }
  }
}

/**
 * Extract key quotes from content using simple heuristics
 */
function extractKeyQuotes(content: string): string[] {
  if (!content || content.length < 50) return []
  
  // Split by sentences and find meaningful quotes
  const sentences = content
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 200)
  
  // Take first 2 substantial sentences as quotes
  return sentences.slice(0, 2)
}

/**
 * Create summary directly from content without AI analysis
 */
function createSummaryFromContent(
  content: string,
  source: any,
  credibilityAssessment: any
): {
  summary: string
  relevance: 'high' | 'medium' | 'low'
  perspective: 'supports' | 'contradicts' | 'neutral' | 'mixed'
  keyInsights: string[]
  extractedQuotes: string[]
  confidence: number
} {
  // Create intelligent summary from content
  const truncatedContent = content.length > 200 ? content.substring(0, 200) + '...' : content
  
  // Determine relevance based on source type and content quality
  let relevance: 'high' | 'medium' | 'low' = 'medium'
  if (credibilityAssessment.sourceType === 'academic' && content.length > 500) {
    relevance = 'high'
  } else if (credibilityAssessment.sourceType === 'government' || credibilityAssessment.sourceType === 'factcheck') {
    relevance = 'high'
  } else if (content.length < 100) {
    relevance = 'low'
  }
  
  // Create summary based on source type
  let summary = ''
  switch (credibilityAssessment.sourceType) {
    case 'academic':
      summary = `This peer-reviewed research provides academic analysis relevant to the claim. ${truncatedContent}`
      break
    case 'government':
      summary = `This government source provides official information and data relevant to the claim. ${truncatedContent}`
      break
    case 'factcheck':
      summary = `This fact-checking organization provides professional verification relevant to the claim. ${truncatedContent}`
      break
    case 'news':
      summary = `This news source provides journalistic coverage and reporting on the topic. ${truncatedContent}`
      break
    default:
      summary = `This source provides information relevant to the claim. ${truncatedContent}`
  }
  
  // Generate insights based on content and source type
  const keyInsights = []
  if (credibilityAssessment.sourceType === 'academic') {
    keyInsights.push('Peer-reviewed research findings')
    keyInsights.push(`Published in ${source.publisher || 'academic journal'}`)
  } else if (credibilityAssessment.sourceType === 'government') {
    keyInsights.push('Official government position')
    keyInsights.push('Authoritative data and guidelines')
  } else if (credibilityAssessment.sourceType === 'factcheck') {
    keyInsights.push('Professional fact-checking analysis')
    keyInsights.push('Cross-referenced verification')
  } else {
    keyInsights.push(`Information from ${source.publisher || 'this source'}`)
    keyInsights.push('Provides context on the topic')
  }
  
  // Add content-specific insight if available
  if (content.length > 100) {
    keyInsights.push('Detailed content available for review')
  }
  
  return {
    summary,
    relevance,
    perspective: 'neutral', // Default to neutral without AI analysis
    keyInsights: keyInsights.slice(0, 3),
    extractedQuotes: extractKeyQuotes(content),
    confidence: 0.7 // Good confidence with direct content
  }
}

/**
 * Generate AI-powered source summary using OpenAI API
 */
async function generateAISourceSummary(
  sourceContext: any,
  claim: string,
  signal?: AbortSignal
): Promise<{
  summary: string
  relevance: 'high' | 'medium' | 'low'
  perspective: 'supports' | 'contradicts' | 'neutral' | 'mixed'
  keyInsights: string[]
  extractedQuotes: string[]
  confidence: number
}> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured")
  }

  const controller = new AbortController()
  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }
  
  // Aggressive timeout for source summarization (8 seconds)
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-2024-04-09',
        messages: [
          {
            role: 'system',
            content: `You are an expert research analyst specializing in source analysis and summarization. Your task is to analyze a source in the context of a specific claim and provide a comprehensive summary.

Respond in valid JSON format:
{
  "summary": "2-3 sentence summary of how this source relates to the claim",
  "relevance": "high|medium|low",
  "perspective": "supports|contradicts|neutral|mixed",
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "extractedQuotes": ["relevant quote 1", "relevant quote 2"],
  "confidence": 0.85
}

Guidelines:
- Focus on how the source specifically addresses the claim
- Identify whether it supports, contradicts, or provides neutral information
- Extract 2-4 key insights from the source
- Include relevant quotes if available in the snippet
- Rate relevance based on how directly it addresses the claim
- Confidence should reflect how much you can determine from available information`
          },
          {
            role: 'user',
            content: `Analyze this source in the context of the claim: "${claim}"

Source Information:
- Title: ${sourceContext.title}
- Publisher: ${sourceContext.publisher}
- Domain: ${sourceContext.domain}
- Type: ${sourceContext.sourceType}
- Credibility Score: ${sourceContext.credibilityScore}/100 (${sourceContext.credibilityBadge})
- Available Content: ${sourceContext.snippet || 'No content snippet available'}
- URL: ${sourceContext.url}

Provide a comprehensive analysis of how this source relates to the claim.`
          }
        ],
        temperature: 0.1,
        max_tokens: 800
      })
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("No content received from OpenAI")
    }

    // Parse JSON response
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/)
    const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content
    
    const parsed = JSON.parse(jsonString)
    
    // Validate and sanitize response
    return {
      summary: parsed.summary || "AI analysis of this source completed.",
      relevance: ['high', 'medium', 'low'].includes(parsed.relevance) ? parsed.relevance : 'medium',
      perspective: ['supports', 'contradicts', 'neutral', 'mixed'].includes(parsed.perspective) ? parsed.perspective : 'neutral',
      keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights.slice(0, 4) : [],
      extractedQuotes: Array.isArray(parsed.extractedQuotes) ? parsed.extractedQuotes.slice(0, 3) : [],
      confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.7
    }
  } catch (error) {
    clearTimeout(timeoutId)
    console.error('[AI Summary] OpenAI summarization failed:', error)
    throw error
  }
}

/**
 * Generate credibility context explanation
 */
function generateCredibilityContext(credibilityAssessment: CredibilityAssessment): string {
  const { score, badge, sourceType, reasoning } = credibilityAssessment
  
  let context = `This source has a ${score}/100 credibility score (${badge}). `
  
  switch (sourceType) {
    case 'government':
      context += 'Government sources are typically authoritative for official data and policy information. '
      break
    case 'academic':
      context += 'Academic sources undergo peer review and scholarly scrutiny. '
      break
    case 'factcheck':
      context += 'Fact-checking organizations specialize in verification with professional standards. '
      break
    case 'news':
      context += 'News sources vary in credibility based on editorial standards and accuracy history. '
      break
    default:
      context += 'General web sources require careful evaluation for accuracy and bias. '
  }
  
  if (credibilityAssessment.mediaRank) {
    context += `Ranked #${credibilityAssessment.mediaRank.rank} by MediaRank among news sources.`
  }
  
  return context
}

/**
 * Generate fallback summary when AI summarization fails
 */
function generateFallbackSummary(source: any, claim: string): {
  summary: string
  keyInsights: string[]
  credibilityContext: string
} {
  const credibilityAssessment = assessSourceCredibility(source.url, source.title, source.publishedAt)
  
  const domain = source.metadata?.domain || 'unknown domain'
  const sourceType = credibilityAssessment.sourceType
  
  let summary = `Source from ${source.publisher || domain} `
  
  switch (sourceType) {
    case 'government':
      summary += 'provides official government information relevant to this claim.'
      break
    case 'academic':
      summary += 'offers academic research and scholarly analysis on this topic.'
      break
    case 'factcheck':
      summary += 'provides professional fact-checking analysis of related claims.'
      break
    case 'news':
      summary += 'reports on news and developments related to this claim.'
      break
    default:
      summary += 'provides information that may be relevant to this claim.'
  }
  
  const keyInsights = [
    `Source type: ${sourceType}`,
    `Publisher: ${source.publisher || domain}`,
    `Credibility score: ${credibilityAssessment.score}/100`
  ]
  
  if (source.publishedAt) {
    keyInsights.push(`Published: ${source.publishedAt}`)
  }
  
  return {
    summary,
    keyInsights,
    credibilityContext: generateCredibilityContext(credibilityAssessment)
  }
}

/**
 * Batch process multiple sources for summarization
 * Enhanced with better timeout handling and rate limiting
 */
export async function summarizeSourcesBatch(
  sources: any[],
  claim: string,
  options: {
    maxConcurrent?: number
    timeoutMs?: number
    signal?: AbortSignal
  } = {}
): Promise<BatchSummaryResult> {
  const startTime = Date.now()
  const { maxConcurrent = 3, timeoutMs = 45000 } = options // Reduced concurrency and timeout
  
  console.log(`[AI Summary] Starting batch summarization of ${sources.length} sources (max ${maxConcurrent} concurrent)`)
  
  // Create overall timeout for the entire batch operation
  const batchController = new AbortController()
  const batchTimeoutId = setTimeout(() => {
    console.log(`[AI Summary] Batch timeout after ${timeoutMs}ms`)
    batchController.abort()
  }, timeoutMs)
  
  // Combine external signal with batch timeout
  if (options.signal) {
    options.signal.addEventListener('abort', () => batchController.abort())
  }
  
  try {
    // Process sources in smaller batches to avoid overwhelming the API
    const batches: any[][] = []
    for (let i = 0; i < sources.length; i += maxConcurrent) {
      batches.push(sources.slice(i, i + maxConcurrent))
    }
    
    const summaries: SourceSummary[] = []
    let successCount = 0
    let failedCount = 0
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      
      // Check if we should abort
      if (batchController.signal.aborted) {
        console.log(`[AI Summary] Batch processing aborted at batch ${batchIndex + 1}/${batches.length}`)
        break
      }
      
      console.log(`[AI Summary] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} sources)`)
      
      const batchPromises = batch.map(source => {
        // Create individual timeout for each source (shorter than batch timeout)
        const sourceController = new AbortController()
        const sourceTimeoutId = setTimeout(() => sourceController.abort(), 12000) // 12 second per source
        
        // Chain abort signals
        if (batchController.signal.aborted) {
          sourceController.abort()
        }
        batchController.signal.addEventListener('abort', () => sourceController.abort())
        
        return summarizeSource(source, claim, sourceController.signal)
          .finally(() => clearTimeout(sourceTimeoutId))
      })
      
      const batchResults = await Promise.allSettled(batchPromises)
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          summaries.push(result.value)
          if (result.value.processingStatus === 'success') {
            successCount++
          } else {
            failedCount++
          }
        } else {
          failedCount++
          console.error('[AI Summary] Source processing error:', result.reason?.message || result.reason)
        }
      }
      
      // Longer delay between batches to respect API rate limits
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    clearTimeout(batchTimeoutId)
    
    const processingTimeMs = Date.now() - startTime
    const averageConfidence = summaries.length > 0 
      ? summaries.reduce((sum, s) => sum + s.confidence, 0) / summaries.length
      : 0
    
    console.log(`[AI Summary] Batch complete: ${successCount} success, ${failedCount} failed in ${processingTimeMs}ms`)
    
    return {
      summaries,
      totalProcessed: sources.length,
      successCount,
      failedCount,
      averageConfidence,
      processingTimeMs
    }
  } catch (error) {
    clearTimeout(batchTimeoutId)
    console.error('[AI Summary] Batch processing failed:', error)
    throw error
  }
}

/**
 * Enhanced source extraction with AI summaries
 * Now with better error handling and timeout management
 */
export async function enhanceSourcesWithSummaries(
  sources: any[],
  claim: string,
  signal?: AbortSignal
): Promise<any[]> {
  console.log(`[AI Summary] Enhancing ${sources.length} sources with AI summaries`)
  
  // Process ALL sources - no limits for comprehensive research!
  console.log(`[AI Summary] Processing ${sources.length} sources for AI enhancement`)
  
  try {
    // Batch process summaries with conservative timeout
    const batchResult = await summarizeSourcesBatch(sources, claim, { 
      signal,
      maxConcurrent: 2, // Very conservative
      timeoutMs: 30000   // 30 second total timeout
    })
    
    // Merge summaries back into sources
    const enhancedSources = sources.map(source => {
      const summary = batchResult.summaries.find(s => s.sourceUrl === source.url)
      
      if (summary) {
        return {
          ...source,
          aiSummary: summary,
          metadata: {
            ...source.metadata,
            hasAISummary: true,
            summaryRelevance: summary.relevance,
            summaryPerspective: summary.perspective,
            summaryConfidence: summary.confidence
          }
        }
      }
      
      return {
        ...source,
        metadata: {
          ...source.metadata,
          hasAISummary: false
        }
      }
    })
    
    console.log(`[AI Summary] Enhanced sources: ${batchResult.successCount}/${sources.length} with AI summaries (${Math.round(batchResult.averageConfidence * 100)}% avg confidence)`)
    
    return enhancedSources
  } catch (error) {
    console.error('[AI Summary] Enhancement failed, returning sources without AI summaries:', error)
    
    // Return sources without AI summaries if enhancement fails
    return sources.map(source => ({
      ...source,
      metadata: {
        ...source.metadata,
        hasAISummary: false,
        aiSummaryError: error instanceof Error ? error.message : 'Unknown error'
      }
    }))
  }
}

/**
 * Get summary statistics for a collection of sources
 */
export function getSourceSummaryStats(sources: any[]): {
  totalSources: number
  withSummaries: number
  byRelevance: { high: number, medium: number, low: number }
  byPerspective: { supports: number, contradicts: number, neutral: number, mixed: number }
  averageConfidence: number
} {
  const withSummaries = sources.filter(s => s.aiSummary)
  
  const byRelevance = {
    high: withSummaries.filter(s => s.aiSummary?.relevance === 'high').length,
    medium: withSummaries.filter(s => s.aiSummary?.relevance === 'medium').length,
    low: withSummaries.filter(s => s.aiSummary?.relevance === 'low').length
  }
  
  const byPerspective = {
    supports: withSummaries.filter(s => s.aiSummary?.perspective === 'supports').length,
    contradicts: withSummaries.filter(s => s.aiSummary?.perspective === 'contradicts').length,
    neutral: withSummaries.filter(s => s.aiSummary?.perspective === 'neutral').length,
    mixed: withSummaries.filter(s => s.aiSummary?.perspective === 'mixed').length
  }
  
  const averageConfidence = withSummaries.length > 0
    ? withSummaries.reduce((sum, s) => sum + (s.aiSummary?.confidence || 0), 0) / withSummaries.length
    : 0
  
  return {
    totalSources: sources.length,
    withSummaries: withSummaries.length,
    byRelevance,
    byPerspective,
    averageConfidence
  }
}