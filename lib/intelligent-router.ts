/**
 * Intelligent API routing system for domain-specific fact-checking
 * Coordinates multiple data sources based on query classification
 */

import { classifyQuery, QueryContext, getDomainDescription } from './query-classifier'
import { 
  queryOpenAlex, 
  queryArXiv, 
  queryPubMed, 
  queryClinicalTrials,
  queryWorldBank,
  queryNASAEONET,
  queryGBIF,
  queryFederalRegister,
  queryGDELT,
  SourceResult 
} from './domain-apis'

export interface IntelligentSearchResult {
  sources: SourceResult[]
  context: QueryContext
  apiResults: { [apiName: string]: { sources: SourceResult[], processingTime: number, error?: string } }
  totalProcessingTime: number
  sourceBreakdown: { [type: string]: number }
  primaryAnalysis?: string // Store the main Perplexity analysis
  finalVerdict?: { label: string, confidence: number, summary: string }
}

export interface RouterConfig {
  maxSourcesPerAPI: number
  timeoutMs: number
  fallbackToGeneral: boolean
  parallelExecution: boolean
}

const DEFAULT_CONFIG: RouterConfig = {
  maxSourcesPerAPI: 200, // UNLIMITED comprehensive research - get ALL sources!
  timeoutMs: 30000, // Extended timeout for maximum source gathering
  fallbackToGeneral: true,
  parallelExecution: true
}

/**
 * Main intelligent routing function - Your Requested Process Flow:
 * 1. Primary Perplexity Query - Get comprehensive analysis + sources  
 * 2. Source Extraction - Pull all possible sources from response
 * 3. Secondary Tool Decision - If academic → OpenAlex, if news → additional APIs
 * 4. Final Perplexity Reasoning - Send ALL sources back for final verdict
 * 5. Response Synthesis - Combine analysis with source metadata
 */
export async function intelligentSearch(
  query: string, 
  config: Partial<RouterConfig> = {}
): Promise<IntelligentSearchResult> {
  const startTime = Date.now()
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  console.log(`[IntelligentRouter] Starting comprehensive fact-check for: "${query}"`)
  
  // Step 1: Primary Perplexity Query - Get comprehensive analysis + sources
  console.log(`[IntelligentRouter] Step 1: Primary Perplexity analysis`)
  const primaryPerplexityResult = await queryPerplexityForAnalysis(query)
  
  let allSources: SourceResult[] = [...primaryPerplexityResult.sources]
  let primaryAnalysis = primaryPerplexityResult.analysis
  const apiResults: { [apiName: string]: { sources: SourceResult[], processingTime: number, error?: string } } = {
    'perplexity-primary': { sources: primaryPerplexityResult.sources, processingTime: primaryPerplexityResult.processingTime }
  }
  
  // Step 2: Classify query for secondary tools
  const context = classifyQuery(query)
  console.log(`[IntelligentRouter] Step 2: Query classified as ${context.domain} (${(context.confidence * 100).toFixed(1)}% confidence)`)
  
  // Step 3: Secondary Tool Decision - Add specialized sources based on query type
  const secondaryAPIs: string[] = []
  
  // Always add Google Fact Check for professional reviews
  secondaryAPIs.push('google_factcheck')
  
  // Add domain-specific APIs
  if (context.domain === 'academic' || query.toLowerCase().includes('research') || query.toLowerCase().includes('study')) {
    secondaryAPIs.push('openalex')
    console.log(`[IntelligentRouter] Adding OpenAlex for academic content`)
  }
  
  // Add more sources for controversial topics that need comprehensive coverage
  const controversialKeywords = ['vaccine', 'climate', 'election', 'autism', 'covid', 'mask', 'hydroxychloroquine']
  if (controversialKeywords.some(keyword => query.toLowerCase().includes(keyword))) {
    // Do additional Perplexity searches with different strategies
    console.log(`[IntelligentRouter] Controversial topic detected - adding comprehensive source coverage`)
    secondaryAPIs.push('perplexity-research', 'perplexity-expert')
  }
  
  // Step 3: Execute secondary APIs in parallel
  if (secondaryAPIs.length > 0) {
    console.log(`[IntelligentRouter] Step 3: Querying ${secondaryAPIs.length} secondary APIs`)
    const secondaryPromises = secondaryAPIs.map(async (apiName) => {
      const result = await executeAPI(apiName, query, finalConfig.maxSourcesPerAPI)
      apiResults[apiName] = result
      return result.sources
    })
    
    const secondaryResults = await Promise.allSettled(secondaryPromises)
    secondaryResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        allSources.push(...result.value)
      }
    })
  }
  
  // Step 4: Deduplicate sources
  const uniqueSources = deduplicateSources(allSources)
  console.log(`[IntelligentRouter] Step 4: Collected ${uniqueSources.length} unique sources from ${Object.keys(apiResults).length} APIs`)
  
  // Step 5: Final Perplexity Reasoning - Send ALL sources back for final verdict
  console.log(`[IntelligentRouter] Step 5: Final reasoning with all sources`)
  const finalVerdict = await queryPerplexityForFinalVerdict(query, uniqueSources, primaryAnalysis)
  
  const sortedSources = sortSourcesByRelevance(uniqueSources, context)
  const sourceBreakdown = generateSourceBreakdown(sortedSources)
  const totalProcessingTime = Date.now() - startTime
  
  console.log(`[IntelligentRouter] Process complete in ${totalProcessingTime}ms`)
  console.log(`[IntelligentRouter] Final verdict: ${finalVerdict.label} (${Math.round(finalVerdict.confidence * 100)}% confidence)`)
  console.log(`[IntelligentRouter] Source breakdown:`, sourceBreakdown)
  
  return {
    sources: sortedSources,
    context,
    apiResults,
    totalProcessingTime,
    sourceBreakdown,
    primaryAnalysis,
    finalVerdict
  }
}

/**
 * Execute a specific API call with error handling and timing
 */
async function executeAPI(
  apiName: string, 
  query: string, 
  maxResults: number
): Promise<{ sources: SourceResult[], processingTime: number, error?: string }> {
  const startTime = Date.now()
  
  try {
    let sources: SourceResult[] = []
    
    switch (apiName) {
      case 'openalex':
        sources = await queryOpenAlex(query, maxResults)
        break
      case 'arxiv':
        sources = await queryArXiv(query, maxResults)
        break
      case 'pubmed':
        sources = await queryPubMed(query, maxResults)
        break
      case 'clinicaltrials':
        sources = await queryClinicalTrials(query, maxResults)
        break
      case 'worldbank':
        sources = await queryWorldBank(query, maxResults)
        break
      case 'nasa_eonet':
        sources = await queryNASAEONET(query, maxResults)
        break
      case 'gbif':
        sources = await queryGBIF(query, maxResults)
        break
      case 'federalregister':
        sources = await queryFederalRegister(query, maxResults)
        break
      case 'gdelt':
        sources = await queryGDELT(query, maxResults)
        break
      case 'perplexity':
        sources = await queryPerplexityAPI(query, maxResults)
        break
      case 'perplexity-research':
        sources = await queryPerplexityResearchAPI(query, maxResults)
        break
      case 'perplexity-expert':
        sources = await queryPerplexityExpertAPI(query, maxResults)
        break
      case 'google_factcheck':
        sources = await queryGoogleFactCheckAPI(query, maxResults)
        break
      default:
        throw new Error(`Unknown API: ${apiName}`)
    }
    
    return {
      sources,
      processingTime: Date.now() - startTime
    }
    
  } catch (error) {
    return {
      sources: [],
      processingTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Remove duplicate sources based on URL and title similarity
 */
function deduplicateSources(sources: SourceResult[]): SourceResult[] {
  const seen = new Set<string>()
  const uniqueSources: SourceResult[] = []
  
  for (const source of sources) {
    const key = `${source.url}|${source.title.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueSources.push(source)
    }
  }
  
  return uniqueSources
}

/**
 * Sort sources by relevance based on context and credibility
 */
function sortSourcesByRelevance(sources: SourceResult[], context: QueryContext): SourceResult[] {
  return sources.sort((a, b) => {
    // Primary sort: credibility score
    const credibilityDiff = (b.credibilityScore || 70) - (a.credibilityScore || 70)
    if (Math.abs(credibilityDiff) > 5) return credibilityDiff
    
    // Secondary sort: domain-specific types get priority
    const domainTypes = getDomainPreferredTypes(context.domain)
    const aTypeScore = domainTypes.indexOf(a.type) !== -1 ? 10 : 0
    const bTypeScore = domainTypes.indexOf(b.type) !== -1 ? 10 : 0
    const typeDiff = bTypeScore - aTypeScore
    if (typeDiff !== 0) return typeDiff
    
    // Tertiary sort: publication date (newer first)
    if (a.publishedAt && b.publishedAt) {
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    }
    
    return 0
  })
}

/**
 * Get preferred source types for each domain
 */
function getDomainPreferredTypes(domain: string): string[] {
  const preferences: { [domain: string]: string[] } = {
    'academic': ['academic', 'preprint'],
    'biomedical': ['medical', 'clinical_trial', 'academic'],
    'physics': ['preprint', 'academic'],
    'mathematics': ['preprint', 'academic'],
    'computer_science': ['preprint', 'academic'],
    'clinical': ['clinical_trial', 'medical'],
    'economic': ['economic_data', 'government'],
    'environmental': ['environmental_event', 'government'],
    'biodiversity': ['biodiversity', 'academic'],
    'legal': ['government', 'academic'],
    'news': ['news', 'government']
  }
  
  return preferences[domain] || []
}

/**
 * Generate breakdown of sources by type
 */
function generateSourceBreakdown(sources: SourceResult[]): { [type: string]: number } {
  const breakdown: { [type: string]: number } = {}
  
  for (const source of sources) {
    breakdown[source.type] = (breakdown[source.type] || 0) + 1
  }
  
  return breakdown
}

/**
 * Get human-readable summary of the intelligent search
 */
export function getSearchSummary(result: IntelligentSearchResult): string {
  const { context, sources, sourceBreakdown } = result
  
  const domainDescription = getDomainDescription(context.domain)
  const totalSources = sources.length
  const topTypes = Object.entries(sourceBreakdown)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([type, count]) => `${count} ${type}`)
    .join(', ')
  
  return `Found ${totalSources} sources in ${domainDescription} domain. Sources include: ${topTypes}. Confidence: ${(context.confidence * 100).toFixed(1)}%`
}

/**
 * Enhanced source metadata for display
 */
export function enhanceSourceMetadata(source: SourceResult): SourceResult {
  const enhanced = { ...source }
  
  // Add enhanced metadata based on source type
  switch (source.type) {
    case 'academic':
      enhanced.metadata = {
        ...enhanced.metadata,
        sourceQuality: 'Peer-reviewed academic research',
        icon: '🎓',
        badge: 'Academic'
      }
      break
    case 'medical':
      enhanced.metadata = {
        ...enhanced.metadata,
        sourceQuality: 'Peer-reviewed medical literature',
        icon: '🏥',
        badge: 'Medical'
      }
      break
    case 'clinical_trial':
      enhanced.metadata = {
        ...enhanced.metadata,
        sourceQuality: 'Registered clinical trial',
        icon: '🧪',
        badge: 'Clinical Trial'
      }
      break
    case 'government':
      enhanced.metadata = {
        ...enhanced.metadata,
        sourceQuality: 'Official government document',
        icon: '🏛️',
        badge: 'Government'
      }
      break
    case 'preprint':
      enhanced.metadata = {
        ...enhanced.metadata,
        sourceQuality: 'Preprint (not peer-reviewed)',
        icon: '📄',
        badge: 'Preprint'
      }
      break
    default:
      enhanced.metadata = {
        ...enhanced.metadata,
        sourceQuality: 'General source',
        icon: '📰',
        badge: 'General'
      }
  }
  
  return enhanced
}

/**
 * Query Perplexity API with multiple search strategies and convert to SourceResult format
 */
async function queryPerplexityAPI(query: string, maxResults: number): Promise<SourceResult[]> {
  const allSources: SourceResult[] = []
  
  // Multiple search strategies to get comprehensive results
  const searchStrategies = [
    {
      name: 'fact-check',
      content: `Fact-check this claim: "${query}"`,
      recency: 'month'
    },
    {
      name: 'research',
      content: `Find research and evidence about: ${query}`,
      recency: 'year'
    },
    {
      name: 'sources',
      content: `What do authoritative sources say about: ${query}`,
      recency: 'month'
    }
  ]
  
  // Execute multiple searches in parallel for maximum coverage
  const searchPromises = searchStrategies.map(async (strategy) => {
    try {
      console.log(`[IntelligentRouter] Perplexity ${strategy.name} search for: "${query}"`)
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [{
            role: "user",
            content: strategy.content
          }],
          max_tokens: 2000,
          temperature: 0.1,
          return_citations: true,
          search_recency_filter: strategy.recency,
          top_k: 25, // Maximum sources from Perplexity
          web_search_options: {
            search_context_size: "high"
          }
        })
      })
      
      if (!response.ok) {
        throw new Error(`Perplexity ${strategy.name} API error: ${response.status}`)
      }
      
      const data = await response.json()
      const sources: SourceResult[] = []
      
      // Convert search_results to SourceResult format
      if (data.search_results) {
        data.search_results.forEach((result: any, index: number) => {
          sources.push({
            title: result.title || 'Untitled',
            url: result.url,
            type: 'news',
            publishedAt: result.date || null,
            abstract: result.snippet || '',
            metadata: {
              source: 'Perplexity',
              strategy: strategy.name,
              domain: new URL(result.url).hostname,
              lastUpdated: result.last_updated || null,
              relevance: 0.9 - (index * 0.1)
            }
          })
        })
      }
      
      // Also extract from citations if available
      if (data.citations) {
        data.citations.forEach((url: string, index: number) => {
          // Only add if not already in search_results
          const alreadyExists = sources.some(s => s.url === url)
          if (!alreadyExists) {
            try {
              const domain = new URL(url).hostname
              sources.push({
                title: `Source from ${domain}`,
                url: url,
                type: 'citation',
                publishedAt: undefined,
                abstract: 'Citation source',
                metadata: {
                  source: 'Perplexity',
                  strategy: `${strategy.name}-citation`,
                  domain: domain,
                  relevance: 0.7 - (index * 0.05)
                }
              })
            } catch (e) {
              // Invalid URL, skip
            }
          }
        })
      }
      
      return sources
    } catch (error) {
      console.error(`[IntelligentRouter] Perplexity ${strategy.name} error:`, error)
      return []
    }
  })
  
  // Wait for all searches to complete
  const results = await Promise.allSettled(searchPromises)
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      allSources.push(...result.value)
    }
  })
  
  // Deduplicate by URL
  const uniqueSources = allSources.reduce((unique: SourceResult[], source) => {
    if (!unique.some(u => u.url === source.url)) {
      unique.push(source)
    }
    return unique
  }, [])
  
  console.log(`[IntelligentRouter] Perplexity collected ${uniqueSources.length} unique sources from ${searchStrategies.length} strategies`)
  
  return uniqueSources.slice(0, maxResults)
}

/**
 * Query Google Fact Check API and convert to SourceResult format
 */
async function queryGoogleFactCheckAPI(query: string, maxResults: number): Promise<SourceResult[]> {
  try {
    const response = await fetch(
      `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(query)}&key=${process.env.GOOGLE_FACTCHECK_API_KEY}`
    )
    
    if (!response.ok) {
      throw new Error(`Google Fact Check API error: ${response.status}`)
    }
    
    const data = await response.json()
    const sources: SourceResult[] = []
    
    if (data.claims) {
      data.claims.forEach((claim: any) => {
        if (claim.claimReview) {
          claim.claimReview.forEach((review: any, index: number) => {
            sources.push({
              title: review.title || 'Fact Check Review',
              url: review.url,
              type: 'factcheck',
              publishedAt: review.reviewDate || null,
              abstract: `Rating: ${review.textualRating || 'Unknown'}`,
              publisher: review.publisher?.name || 'Unknown Publisher',
              metadata: {
                source: 'Google Fact Check',
                publisher: review.publisher?.name || 'Unknown Publisher',
                rating: review.textualRating,
                reviewDate: review.reviewDate,
                relevance: 0.95
              }
            })
          })
        }
      })
    }
    
    return sources.slice(0, maxResults)
  } catch (error) {
    console.error('[IntelligentRouter] Google Fact Check API error:', error)
    return []
  }
}

/**
 * Step 1: Query Perplexity for comprehensive analysis + sources
 */
async function queryPerplexityForAnalysis(query: string): Promise<{ sources: SourceResult[], analysis: string, processingTime: number }> {
  const startTime = Date.now()
  
  try {
    console.log(`[IntelligentRouter] Primary Perplexity analysis for: "${query}"`)
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: `You are a professional fact-checker. Analyze this claim with comprehensive research and provide your response in this format:

VERDICT: [True/False/Misleading/Mixed/Unclear] (Confidence: X%)

REASONING: Provide 3-4 clear, factual sentences that explain WHY this verdict was reached. Focus on:
- What the scientific evidence shows
- Key studies or expert consensus  
- Why alternative explanations are insufficient
- What the implications are

Each reasoning point should be a complete sentence with citations [1], [2], [3] to your sources. Avoid generic headers - write substantive content that actually explains the evidence.`
          },
          {
            role: "user",
            content: `Fact-check this claim: "${query}"`
          }
        ],
        max_tokens: 3000,
        temperature: 0.1,
        top_k: 25, // Maximum sources
        return_citations: true,
        search_recency_filter: "month",
        web_search_options: {
          search_context_size: "high"
        }
      })
    })
    
    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`)
    }
    
    const data = await response.json()
    const sources: SourceResult[] = []
    
    // Extract sources from search_results
    if (data.search_results) {
      data.search_results.forEach((result: any, index: number) => {
        sources.push({
          title: result.title || 'Untitled',
          url: result.url,
          type: 'news',
          publishedAt: result.date || undefined,
          abstract: result.snippet || '',
          metadata: {
            source: 'Perplexity-Primary',
            domain: new URL(result.url).hostname,
            lastUpdated: result.last_updated || undefined,
            relevance: 0.95 - (index * 0.02)
          }
        })
      })
    }
    
    // Extract from citations
    if (data.citations) {
      data.citations.forEach((url: string, index: number) => {
        if (!sources.some(s => s.url === url)) {
          try {
            const domain = new URL(url).hostname
            sources.push({
              title: `Additional source from ${domain}`,
              url: url,
              type: 'citation',
              publishedAt: undefined,
              abstract: 'Citation source from analysis',
              metadata: {
                source: 'Perplexity-Citation',
                domain: domain,
                relevance: 0.8 - (index * 0.02)
              }
            })
          } catch (e) {
            // Skip invalid URLs
          }
        }
      })
    }
    
    const analysis = data.choices?.[0]?.message?.content || 'Analysis not available'
    const processingTime = Date.now() - startTime
    
    console.log(`[IntelligentRouter] Primary analysis complete: ${sources.length} sources, ${processingTime}ms`)
    
    return {
      sources,
      analysis,
      processingTime
    }
  } catch (error) {
    console.error('[IntelligentRouter] Primary Perplexity error:', error)
    return {
      sources: [],
      analysis: 'Analysis failed',
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Step 5: Final Perplexity reasoning with all sources
 */
async function queryPerplexityForFinalVerdict(query: string, sources: SourceResult[], primaryAnalysis: string): Promise<{ label: string, confidence: number, summary: string }> {
  try {
    console.log(`[IntelligentRouter] Final verdict reasoning with ${sources.length} sources`)
    
    const sourceList = sources.slice(0, 20).map((source, index) => 
      `[${index + 1}] ${source.title} - ${source.url}`
    ).join('\n')
    
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: `You are a professional fact-checker making a final verdict. Based on the provided sources and initial analysis, give a definitive verdict.

Response format:
VERDICT: [True/False/Misleading/Mixed/Unclear]
CONFIDENCE: [0-100]%
SUMMARY: [Brief explanation of the verdict]

Be confident in your verdict when evidence is clear. For example, well-established scientific consensus should get high confidence (80-95%).`
          },
          {
            role: "user",
            content: `CLAIM: "${query}"

INITIAL ANALYSIS:
${primaryAnalysis}

ADDITIONAL SOURCES:
${sourceList}

Provide your final verdict based on all available evidence.`
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      })
    })
    
    if (!response.ok) {
      console.log(`[IntelligentRouter] Final verdict API error: ${response.status}`)
      return extractVerdictFromAnalysis(primaryAnalysis)
    }
    
    const data = await response.json()
    const finalResponse = data.choices?.[0]?.message?.content || ''
    
    return parseVerdictResponse(finalResponse) || extractVerdictFromAnalysis(primaryAnalysis)
  } catch (error) {
    console.error('[IntelligentRouter] Final verdict error:', error)
    return extractVerdictFromAnalysis(primaryAnalysis)
  }
}

/**
 * Additional Perplexity search strategies
 */
async function queryPerplexityResearchAPI(query: string, maxResults: number): Promise<SourceResult[]> {
  return await queryPerplexityWithStrategy(query, maxResults, 'research', `Find academic research and scientific studies about: ${query}`)
}

async function queryPerplexityExpertAPI(query: string, maxResults: number): Promise<SourceResult[]> {
  return await queryPerplexityWithStrategy(query, maxResults, 'expert', `What do medical experts and authorities say about: ${query}`)
}

async function queryPerplexityWithStrategy(query: string, maxResults: number, strategy: string, searchQuery: string): Promise<SourceResult[]> {
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [{
          role: "user",
          content: searchQuery
        }],
        max_tokens: 2000,
        temperature: 0.1,
        top_k: 20,
        return_citations: true,
        search_recency_filter: strategy === 'research' ? 'year' : 'month',
        web_search_options: {
          search_context_size: "high"
        }
      })
    })
    
    if (!response.ok) {
      throw new Error(`Perplexity ${strategy} API error: ${response.status}`)
    }
    
    const data = await response.json()
    const sources: SourceResult[] = []
    
    if (data.search_results) {
      data.search_results.forEach((result: any, index: number) => {
        sources.push({
          title: result.title || 'Untitled',
          url: result.url,
          type: strategy === 'research' ? 'academic' : 'news',
          publishedAt: result.date || undefined,
          abstract: result.snippet || '',
          metadata: {
            source: `Perplexity-${strategy}`,
            domain: new URL(result.url).hostname,
            lastUpdated: result.last_updated || undefined,
            relevance: 0.85 - (index * 0.02)
          }
        })
      })
    }
    
    return sources.slice(0, maxResults)
  } catch (error) {
    console.error(`[IntelligentRouter] Perplexity ${strategy} error:`, error)
    return []
  }
}

/**
 * Helper functions for verdict parsing
 */
function parseVerdictResponse(response: string): { label: string, confidence: number, summary: string } | null {
  try {
    const verdictMatch = response.match(/VERDICT:\s*(True|False|Misleading|Mixed|Unclear)/i)
    const confidenceMatch = response.match(/CONFIDENCE:\s*(\d+)%?/i)
    const summaryMatch = response.match(/SUMMARY:\s*(.*?)(?:\n|$)/i)
    
    if (verdictMatch) {
      const label = verdictMatch[1]
      const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.6
      const summary = summaryMatch ? summaryMatch[1].trim() : 'Verdict based on available evidence'
      
      return { label, confidence, summary }
    }
    
    return null
  } catch (error) {
    return null
  }
}

function extractVerdictFromAnalysis(analysis: string): { label: string, confidence: number, summary: string } {
  // Look for verdict indicators in the analysis
  const lowerAnalysis = analysis.toLowerCase()
  
  if (lowerAnalysis.includes('false') || lowerAnalysis.includes('debunked') || lowerAnalysis.includes('no evidence')) {
    return { label: 'False', confidence: 0.8, summary: 'Evidence contradicts the claim' }
  } else if (lowerAnalysis.includes('true') || lowerAnalysis.includes('confirmed') || lowerAnalysis.includes('supported')) {
    return { label: 'True', confidence: 0.8, summary: 'Evidence supports the claim' }
  } else if (lowerAnalysis.includes('misleading') || lowerAnalysis.includes('partially')) {
    return { label: 'Misleading', confidence: 0.7, summary: 'Claim contains misleading information' }
  } else {
    return { label: 'Unclear', confidence: 0.4, summary: 'Insufficient evidence for verification' }
  }
}