import { NextRequest, NextResponse } from 'next/server'
import { intelligentSearch, getSearchSummary, enhanceSourceMetadata } from '@/lib/intelligent-router'
import { classifyQuery } from '@/lib/query-classifier'

/**
 * Enhanced fact-check API with intelligent domain-specific routing
 * Routes queries to the most appropriate authoritative sources
 */

interface IntelligentFactCheckRequest {
  query: string
  maxSources?: number
  enableParallel?: boolean
  domainHint?: string
}

interface IntelligentFactCheckResponse {
  success: boolean
  query: string
  context: {
    domain: string
    confidence: number
    description: string
    keywords: string[]
  }
  sources: any[]
  sourceBreakdown: { [type: string]: number }
  searchSummary: string
  apiResults: { [apiName: string]: { sources: any[], processingTime: number, error?: string } }
  totalProcessingTime: number
  metadata: {
    intelligentRouting: boolean
    totalAPIsUsed: number
    fallbackUsed: boolean
  }
  errors?: any
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json() as IntelligentFactCheckRequest
    const { query, maxSources = 25, enableParallel = true, domainHint } = body
    
    console.log(`[IntelligentFactCheck] Starting intelligent fact-check for: "${query}"`)
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }
    
    // Step 1: Classify the query
    const context = classifyQuery(query)
    console.log(`[IntelligentFactCheck] Query classified as: ${context.domain}`)
    
    // Override domain if hint is provided
    if (domainHint && domainHint !== 'auto') {
      context.domain = domainHint
      context.confidence = 0.9 // High confidence for manual override
      console.log(`[IntelligentFactCheck] Domain overridden to: ${domainHint}`)
    }
    
    // Step 2: Execute intelligent search
    const searchResult = await intelligentSearch(query, {
      maxSourcesPerAPI: Math.ceil(maxSources / context.suggestedAPIs.length),
      parallelExecution: enableParallel,
      fallbackToGeneral: true,
      timeoutMs: 20000
    })
    
    // Step 3: Enhance source metadata for display
    const enhancedSources = searchResult.sources.map(source => ({
      ...enhanceSourceMetadata(source),
      rank: searchResult.sources.indexOf(source) + 1,
      domainRelevance: context.keywords.some(keyword => 
        source.title.toLowerCase().includes(keyword.toLowerCase()) ||
        source.abstract?.toLowerCase().includes(keyword.toLowerCase())
      )
    }))
    
    // Step 4: Generate search summary
    const searchSummary = getSearchSummary(searchResult)
    
    // Step 5: Analyze API performance
    const totalAPIsUsed = Object.keys(searchResult.apiResults).length
    const successfulAPIs = Object.values(searchResult.apiResults).filter(r => !r.error).length
    const fallbackUsed = 'perplexity' in searchResult.apiResults && context.domain !== 'general'
    
    const response: IntelligentFactCheckResponse = {
      success: true,
      query,
      context: {
        domain: context.domain,
        confidence: context.confidence,
        description: getDomainDescription(context.domain),
        keywords: context.keywords
      },
      sources: enhancedSources,
      sourceBreakdown: searchResult.sourceBreakdown,
      searchSummary,
      apiResults: searchResult.apiResults,
      totalProcessingTime: Date.now() - startTime,
      metadata: {
        intelligentRouting: true,
        totalAPIsUsed,
        fallbackUsed
      }
    }
    
    console.log(`[IntelligentFactCheck] Completed in ${response.totalProcessingTime}ms`)
    console.log(`[IntelligentFactCheck] Found ${enhancedSources.length} sources across ${totalAPIsUsed} APIs`)
    console.log(`[IntelligentFactCheck] Success rate: ${successfulAPIs}/${totalAPIsUsed} APIs`)
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('[IntelligentFactCheck] Error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Intelligent fact-check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        totalProcessingTime: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')
  
  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter is required' },
      { status: 400 }
    )
  }
  
  // Convert GET to POST for consistent handling
  const body = { 
    query,
    maxSources: parseInt(searchParams.get('maxSources') || '25'),
    enableParallel: searchParams.get('parallel') !== 'false',
    domainHint: searchParams.get('domain') || undefined
  }
  
  const request2 = new Request(request.url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  })
  
  return POST(request2 as NextRequest)
}

// Helper function (duplicated here to avoid import issues)
function getDomainDescription(domain: string): string {
  const descriptions: { [domain: string]: string } = {
    'academic': 'Academic Research & Scholarly Literature',
    'biomedical': 'Biomedical & Health Sciences',
    'physics': 'Physics & Physical Sciences',
    'mathematics': 'Mathematics & Mathematical Sciences',
    'computer_science': 'Computer Science & Technology',
    'clinical': 'Clinical Trials & Medical Research',
    'economic': 'Economics & Financial Data',
    'environmental': 'Environmental & Natural Events',
    'biodiversity': 'Biodiversity & Species Data',
    'legal': 'Legal & Regulatory Information',
    'news': 'News & Current Events',
    'general': 'General Knowledge & Web Search'
  }

  return descriptions[domain] || 'General Information'
}