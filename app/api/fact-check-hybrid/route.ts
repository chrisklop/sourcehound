import { type NextRequest, NextResponse } from "next/server"
import { updateProgress } from "../fact-check/progress"
import { generateSlug } from "@/lib/database"
import { logQuery } from "@/lib/query-logger"
import { intelligentSearch } from "@/lib/intelligent-router"
import { GoogleGenerativeAI, SchemaType, FunctionCallingMode } from "@google/generative-ai"
import { applyRateLimit, RATE_LIMIT_TIERS, rateLimiter } from "@/lib/rate-limiter"
import { authManager } from "@/lib/auth"
import { webhookManager } from "@/lib/webhook-manager"

// Initialize Gemini AI Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

interface ConsolidatedResult {
  verdict: {
    label: string
    confidence: number
    summary: string
    engineAgreement: boolean
    perplexityVerdict?: string
    geminiVerdict?: string
  }
  keyFindings: string[]
  explanation: string
  sources: any[]
  factCheckReviews: any[]
  engineResults: {
    perplexity: any
    gemini: any
  }
  metrics: {
    totalSources: number
    uniqueSources: number
    processingTime: number
    engineStatus: {
      perplexity: 'success' | 'failed' | 'partial'
      gemini: 'success' | 'failed' | 'partial'
    }
  }
  credibilityBreakdown?: {
    highCredibility: number
    mediumCredibility: number
    lowCredibility: number
    mediaRankSources: number
  }
}

export async function POST(request: NextRequest) {
  let query: string | null = null
  let rateLimitResult: any = null
  let authenticatedUser: any = null
  
  try {
    const body = await request.json()
    const { query: bodyQuery, sessionId: providedSessionId } = body
    query = bodyQuery
    const sessionId = providedSessionId || `hybrid_${Date.now()}`

    console.log("[Hybrid] Processing dual-engine fact-check:", query)

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    // Check for authentication
    const authSession = await authManager.getSessionFromRequest(request)
    if (authSession) {
      authenticatedUser = await authManager.getUserById(authSession.userId)
      console.log(`[Hybrid] Authenticated user: ${authenticatedUser?.username} (${authenticatedUser?.tier})`)
    }

    // Determine rate limiting based on authentication
    let rateLimitConfig
    let rateLimitIdentifier

    if (authenticatedUser) {
      // Authenticated user - use tier-based rate limiting
      rateLimitConfig = authenticatedUser.tier === 'premium' ? RATE_LIMIT_TIERS.PREMIUM :
                       authenticatedUser.tier === 'enterprise' ? RATE_LIMIT_TIERS.ENTERPRISE :
                       RATE_LIMIT_TIERS.FREE
      rateLimitIdentifier = `user:${authenticatedUser.id}`
    } else {
      // Anonymous user - use IP-based rate limiting
      rateLimitConfig = RATE_LIMIT_TIERS.IP_LIMIT
      const forwarded = request.headers.get('x-forwarded-for')
      const realIP = request.headers.get('x-real-ip')
      const cfIP = request.headers.get('cf-connecting-ip')
      rateLimitIdentifier = forwarded?.split(',')[0].trim() || realIP || cfIP || 'unknown'
    }
    
    const { allowed, headers, result } = await applyRateLimit(request, rateLimitConfig, rateLimitIdentifier)
    rateLimitResult = result
    
    if (!allowed) {
      console.log(`[Hybrid] Rate limit exceeded for ${result.rateLimitType}:`, result)
      return NextResponse.json({
        error: "Rate limit exceeded",
        message: `Too many requests. Limit: ${result.limit} requests per hour. Try again in ${Math.ceil((result.retryAfter || 0) / 60)} minutes.`,
        rateLimitInfo: {
          limit: result.limit,
          remaining: result.remaining,
          resetTime: new Date(result.resetTime).toISOString(),
          retryAfter: result.retryAfter,
          tier: result.rateLimitType
        }
      }, { 
        status: 429,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      })
    }

    const slug = generateSlug(query)
    const startTime = Date.now()
    const factCheckResult = await performHybridFactCheck(query, sessionId, slug)
    const processingTime = Date.now() - startTime

    // Get IP for analytics logging
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cfIP = request.headers.get('cf-connecting-ip')
    const identifier = forwarded?.split(',')[0].trim() || realIP || cfIP || 'unknown'

    // Log analytics data
    await rateLimiter.checkRateLimit(
      identifier,
      rateLimitConfig,
      {
        query,
        cached: false,
        processingTime
      }
    )

    const response = NextResponse.json({ 
      ...factCheckResult, 
      slug, 
      cached: false,
      rateLimitInfo: {
        remaining: rateLimitResult.remaining,
        resetTime: new Date(rateLimitResult.resetTime).toISOString(),
        tier: rateLimitResult.rateLimitType
      },
      user: authenticatedUser ? {
        id: authenticatedUser.id,
        username: authenticatedUser.username,
        tier: authenticatedUser.tier,
        role: authenticatedUser.role
      } : null
    })
    
    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    // Trigger webhook event for fact-check completion
    if (authenticatedUser) {
      try {
        await webhookManager.triggerEvent('fact_check.completed', {
          query,
          verdict: factCheckResult.verdict,
          keyFindings: factCheckResult.keyFindings,
          sources: factCheckResult.sources,
          processingTime,
          slug,
          engineResults: factCheckResult.engineResults,
          credibilityBreakdown: factCheckResult.credibilityBreakdown
        }, authenticatedUser)
      } catch (webhookError) {
        console.error('[Webhook] Failed to trigger fact-check completion event:', webhookError)
        // Don't fail the main request if webhook fails
      }
    }
    
    return response
  } catch (error) {
    console.error("[Hybrid] POST Error:", error)
    if (query) {
      await logQuery(query, false, { 
        errorType: 'hybrid_api_error', 
        method: 'POST' 
      })
      
      // Log error in rate limiter for analytics
      if (rateLimitResult) {
        // Get IP for error logging
        const forwarded = request.headers.get('x-forwarded-for')
        const realIP = request.headers.get('x-real-ip')
        const cfIP = request.headers.get('cf-connecting-ip')
        const identifier = forwarded?.split(',')[0].trim() || realIP || cfIP || 'unknown'
        
        await rateLimiter.checkRateLimit(
          identifier,
          RATE_LIMIT_TIERS.IP_LIMIT,
          {
            query,
            cached: false,
            processingTime: 0
          }
        )
      }

      // Trigger webhook event for fact-check failure
      if (authenticatedUser) {
        try {
          await webhookManager.triggerEvent('fact_check.failed', {
            query,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now()
          }, authenticatedUser)
        } catch (webhookError) {
          console.error('[Webhook] Failed to trigger fact-check failure event:', webhookError)
        }
      }
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function performHybridFactCheck(query: string, sessionId: string, slug: string): Promise<ConsolidatedResult> {
  const startTime = Date.now()
  
  await updateProgress(sessionId, { 
    step: "initializing", 
    status: "in-progress", 
    message: "Initializing dual-engine fact-check...", 
    progress: 5,
    timestamp: Date.now()
  })

  // Phase 1: Parallel Engine Processing
  await updateProgress(sessionId, { 
    step: "querying-ai", 
    status: "in-progress", 
    message: "Running Perplexity + Gemini analysis in parallel...", 
    progress: 15,
    timestamp: Date.now()
  })

  const [perplexityResult, geminiResult] = await Promise.allSettled([
    runPerplexityEngine(query, sessionId),
    runGeminiEngine(query, sessionId)
  ])

  await updateProgress(sessionId, { 
    step: "processing", 
    status: "in-progress", 
    message: "Consolidating and deduplicating results...", 
    progress: 70,
    timestamp: Date.now()
  })

  // Phase 2: Result Consolidation
  const consolidatedResult = consolidateEngineResults(
    perplexityResult.status === 'fulfilled' ? perplexityResult.value : null,
    geminiResult.status === 'fulfilled' ? geminiResult.value : null,
    query
  )

  // Phase 3: Enhanced Processing
  await updateProgress(sessionId, { 
    step: "processing", 
    status: "in-progress", 
    message: "Enhancing consolidated sources...", 
    progress: 90,
    timestamp: Date.now()
  })

  const finalResult = await enhanceConsolidatedResult(consolidatedResult)

  await updateProgress(sessionId, { 
    step: "complete", 
    status: "completed", 
    message: "Hybrid analysis complete", 
    progress: 100, 
    timestamp: Date.now(),
    slug 
  })

  // Logging
  const processingTime = Date.now() - startTime
  await logQuery(query, true, {
    processingTimeMs: processingTime,
    resultType: "hybrid-dual-engine",
    sourceCount: finalResult.sources?.length || 0,
    method: 'POST'
  })

  finalResult.metrics.processingTime = processingTime
  return finalResult
}

async function runPerplexityEngine(query: string, sessionId: string) {
  try {
    console.log("[Hybrid] Starting Perplexity engine...")
    
    // Update progress with initial Perplexity status
    await updateProgress(sessionId, {
      step: "querying-ai",
      status: "in-progress",
      message: "🧠 Perplexity AI conducting comprehensive research...",
      details: "Analyzing multiple information sources and cross-referencing data",
      progress: 25,
      timestamp: Date.now(),
      currentAPI: "perplexity",
      engineDetails: {
        perplexity: { status: "Running comprehensive analysis", sources: 0 }
      }
    })
    
    const result = await intelligentSearch(query)
    
    // Update progress with Perplexity results
    await updateProgress(sessionId, {
      step: "querying-ai",
      status: "in-progress",
      message: "✅ Perplexity research complete - analyzing findings...",
      details: `Discovered ${result.sources?.length || 0} sources with ${result.sourceBreakdown?.high_credibility || 0} high-credibility sources`,
      progress: 45,
      timestamp: Date.now(),
      sourcesFound: result.sources?.length || 0,
      engineDetails: {
        perplexity: { 
          status: "Analysis complete", 
          sources: result.sources?.length || 0,
          processingTime: result.totalProcessingTime
        }
      },
      credibilityAnalysis: {
        highCredibility: result.sourceBreakdown?.authoritative || 0,
        mediumCredibility: result.sourceBreakdown?.credible || 0,
        lowCredibility: result.sourceBreakdown?.limited || 0,
        mediaRankSources: result.sourceBreakdown?.mediarank_verified || 0
      }
    })
    
    console.log("[Hybrid] Perplexity completed:", result.sources?.length || 0, "sources")
    return { status: 'success', data: result, engine: 'perplexity' }
  } catch (error) {
    console.error("[Hybrid] Perplexity engine failed:", error)
    
    await updateProgress(sessionId, {
      step: "querying-ai",
      status: "in-progress",
      message: "❌ Perplexity analysis encountered issues - continuing with available data...",
      progress: 35,
      timestamp: Date.now(),
      engineDetails: {
        perplexity: { status: "Failed", sources: 0 }
      }
    })
    
    return { status: 'failed', error, engine: 'perplexity' }
  }
}

async function runGeminiEngine(query: string, sessionId: string) {
  try {
    console.log("[Hybrid] Starting Gemini engine...")
    
    // Update progress with initial Gemini status
    await updateProgress(sessionId, {
      step: "querying-ai",
      status: "in-progress",
      message: "🤖 Gemini AI performing independent verification...",
      details: "Cross-referencing claims with authoritative sources and fact-checking databases",
      progress: 30,
      timestamp: Date.now(),
      currentAPI: "gemini",
      engineDetails: {
        gemini: { status: "Initializing verification process", sources: 0 }
      }
    })
    
    // Check if API key is available
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable not found")
    }
    
    console.log("[Hybrid] Gemini API key found, initializing model...")
    
    await updateProgress(sessionId, {
      step: "querying-ai",
      status: "in-progress",
      message: "⚡ Gemini Flash model activated - processing claim...",
      details: "Using Gemini 1.5 Flash for faster, more reliable verification",
      progress: 35,
      timestamp: Date.now(),
      engineDetails: {
        gemini: { status: "Processing verification request", sources: 0 }
      }
    })
    
    // Use Gemini Flash for better rate limits and faster responses
    const geminiFlash = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    })

    const systemPrompt = `You are a world-class fact-checking expert. Conduct a thorough investigation into the user's query using Google Search.
    
    Your response MUST be a single, valid JSON object with this exact structure:
    {
      "verdict": {
        "label": "True" | "False" | "Mixed" | "Unclear",
        "confidence": number (0.0 to 1.0),
        "summary": "One-sentence explanation of verdict."
      },
      "keyPoints": [
        "Key finding 1",
        "Key finding 2", 
        "Key finding 3"
      ],
      "explanation": "Detailed analysis with source citations [1], [2], etc.",
      "sources": [
        {
          "rank": 1,
          "title": "Source title",
          "url": "https://example.com",
          "publisher": "Publisher name",
          "snippet": "Relevant quote or summary"
        }
      ]
    }`

    const chat = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", 
      systemInstruction: systemPrompt 
    })
    
    await updateProgress(sessionId, {
      step: "querying-ai",
      status: "in-progress",
      message: "🔍 Gemini analyzing claim structure and searching for evidence...",
      progress: 50,
      timestamp: Date.now(),
      engineDetails: {
        gemini: { status: "Analyzing and fact-checking", sources: 0 }
      }
    })
    
    // Add timeout and better error handling for rate limits
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout
    
    try {
      const result = await chat.generateContent(`Fact-check this claim: "${query}"`)
      clearTimeout(timeoutId)
      
      const jsonText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim()
      console.log('[Hybrid] Gemini raw response:', jsonText.substring(0, 200) + '...')
      
      const parsedResult = JSON.parse(jsonText)
      
      // Validate the response has expected structure
      if (!parsedResult.verdict || !parsedResult.sources) {
        console.warn('[Hybrid] Gemini response missing expected fields, using partial data')
        parsedResult.verdict = parsedResult.verdict || { label: "Unclear", confidence: 0.5, summary: "Analysis incomplete" }
        parsedResult.sources = parsedResult.sources || []
      }
      
      console.log('[Hybrid] Gemini parsed result:', JSON.stringify(parsedResult, null, 2).substring(0, 300) + '...')
      
      // Update progress with successful result
      await updateProgress(sessionId, {
        step: "querying-ai",
        status: "in-progress",
        message: "✅ Gemini verification complete - cross-referencing findings...",
        details: `Gemini found ${parsedResult.sources?.length || 0} verification sources`,
        progress: 60,
        timestamp: Date.now(),
        sourcesFound: (parsedResult.sources?.length || 0),
        engineDetails: {
          gemini: { 
            status: "Verification complete", 
            sources: parsedResult.sources?.length || 0 
          }
        }
      })
      
      console.log("[Hybrid] Gemini completed:", parsedResult.sources?.length || 0, "sources")
      return { status: 'success', data: parsedResult, engine: 'gemini' }
    } catch (parseError) {
      clearTimeout(timeoutId)
      
      console.error('[Hybrid] Gemini parse error:', parseError)
      
      // If it's a JSON parse error, try to extract partial data
      if (parseError instanceof SyntaxError) {
        console.warn('[Hybrid] Gemini returned invalid JSON, attempting graceful fallback')
        return {
          verdict: { label: "Unclear", confidence: 0.5, summary: "Gemini analysis incomplete" },
          sources: [],
          keyPoints: ["Analysis partially completed"]
        }
      }
      throw parseError
    }
    
    // This line should never be reached due to the try/catch return statements above
  } catch (error) {
    console.error("[Hybrid] Gemini engine failed:", error)
    
    // Check if it's a rate limit error
    const isRateLimit = error instanceof Error && 
      (error.message.includes('429') || 
       error.message.includes('Too Many Requests') || 
       error.message.includes('quota'))
    
    const errorMessage = isRateLimit 
      ? "⏱️ Gemini rate limit reached - analysis continues with Perplexity..."
      : "⚠️ Gemini verification unavailable - proceeding with Perplexity analysis..."
      
    const errorDetails = isRateLimit
      ? "Gemini free tier quota exceeded. Hybrid system continues with Perplexity engine."
      : error instanceof Error ? `Gemini error: ${error.message}` : "Gemini service temporarily unavailable"
    
    await updateProgress(sessionId, {
      step: "querying-ai",
      status: "in-progress",
      message: errorMessage,
      details: errorDetails,
      progress: 55,
      timestamp: Date.now(),
      engineDetails: {
        gemini: { status: isRateLimit ? "Rate Limited" : "Failed", sources: 0 }
      }
    })
    
    return { status: 'failed', error, engine: 'gemini' }
  }
}

function consolidateEngineResults(perplexityResult: any, geminiResult: any, query: string): ConsolidatedResult {
  console.log("[Hybrid] Consolidating results from both engines...")
  
  // Initialize result structure
  const consolidatedResult: ConsolidatedResult = {
    verdict: {
      label: "Unclear",
      confidence: 0.3,
      summary: "Unable to determine verdict from available sources.",
      engineAgreement: false
    },
    keyFindings: [],
    explanation: "",
    sources: [],
    factCheckReviews: [],
    engineResults: {
      perplexity: perplexityResult?.data || null,
      gemini: geminiResult?.data || null
    },
    metrics: {
      totalSources: 0,
      uniqueSources: 0,
      processingTime: 0,
      engineStatus: {
        perplexity: perplexityResult?.status || 'failed',
        gemini: geminiResult?.status || 'failed'
      }
    }
  }

  // Consolidate verdicts
  const verdicts = []
  if (perplexityResult?.status === 'success' && perplexityResult.data?.verdict) {
    verdicts.push({ 
      engine: 'perplexity', 
      verdict: perplexityResult.data.verdict,
      confidence: perplexityResult.data.confidence || 0.5
    })
    consolidatedResult.verdict.perplexityVerdict = perplexityResult.data.verdict
  }
  
  if (geminiResult?.status === 'success' && geminiResult.data?.verdict) {
    verdicts.push({ 
      engine: 'gemini', 
      verdict: geminiResult.data.verdict.label,
      confidence: geminiResult.data.verdict.confidence || 0.5
    })
    consolidatedResult.verdict.geminiVerdict = geminiResult.data.verdict.label
  }

  // Determine final verdict
  if (verdicts.length === 2) {
    const agreement = verdicts[0].verdict.toLowerCase() === verdicts[1].verdict.toLowerCase()
    consolidatedResult.verdict.engineAgreement = agreement
    
    if (agreement) {
      // Engines agree - use higher confidence
      const bestVerdict = verdicts.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      )
      consolidatedResult.verdict.label = bestVerdict.verdict
      consolidatedResult.verdict.confidence = Math.min(0.95, (verdicts[0].confidence + verdicts[1].confidence) / 2 + 0.1)
      consolidatedResult.verdict.summary = `Both engines agree: ${bestVerdict.verdict}`
    } else {
      // Engines disagree - be conservative
      consolidatedResult.verdict.label = "Mixed"
      consolidatedResult.verdict.confidence = 0.6
      consolidatedResult.verdict.summary = `Engines disagree: Perplexity says ${verdicts[0].verdict}, Gemini says ${verdicts[1].verdict}`
    }
  } else if (verdicts.length === 1) {
    // Only one engine succeeded
    consolidatedResult.verdict.label = verdicts[0].verdict
    consolidatedResult.verdict.confidence = Math.max(0.4, verdicts[0].confidence - 0.1)
    consolidatedResult.verdict.summary = `Based on ${verdicts[0].engine} analysis: ${verdicts[0].verdict}`
  }

  // Consolidate sources with deduplication
  const allSources = []
  
  if (perplexityResult?.data?.sources) {
    allSources.push(...perplexityResult.data.sources.map((s: any) => ({
      ...s,
      engine: 'perplexity'
    })))
  }
  
  if (geminiResult?.data?.sources) {
    allSources.push(...geminiResult.data.sources.map((s: any) => ({
      ...s,
      engine: 'gemini'
    })))
  }

  // Deduplicate by URL
  const urlMap = new Map()
  allSources.forEach(source => {
    if (source.url && !urlMap.has(source.url)) {
      urlMap.set(source.url, source)
    } else if (source.url && urlMap.has(source.url)) {
      // Merge information from duplicate sources
      const existing = urlMap.get(source.url)
      existing.engines = existing.engines || [existing.engine]
      if (!existing.engines.includes(source.engine)) {
        existing.engines.push(source.engine)
      }
    }
  })

  consolidatedResult.sources = Array.from(urlMap.values())
    .map((source, index) => ({ ...source, rank: index + 1 }))
    .slice(0, 50) // Increased to top 50 for comprehensive analysis

  // Consolidate key findings
  const allKeyFindings = []
  if (perplexityResult?.data?.keyFindings) {
    allKeyFindings.push(...perplexityResult.data.keyFindings)
  }
  if (geminiResult?.data?.keyPoints) {
    allKeyFindings.push(...geminiResult.data.keyPoints)
  }
  
  consolidatedResult.keyFindings = [...new Set(allKeyFindings)].slice(0, 8)

  // Consolidate explanations
  const explanations = []
  if (perplexityResult?.data?.summary) {
    explanations.push(`**Perplexity Analysis:** ${perplexityResult.data.summary}`)
  }
  if (geminiResult?.data?.explanation) {
    explanations.push(`**Gemini Analysis:** ${geminiResult.data.explanation}`)
  }
  
  consolidatedResult.explanation = explanations.join('\n\n')

  // Add fact-check reviews if available
  if (perplexityResult?.data?.factCheckReviews) {
    consolidatedResult.factCheckReviews = perplexityResult.data.factCheckReviews
  }

  // Update metrics
  consolidatedResult.metrics.totalSources = allSources.length
  consolidatedResult.metrics.uniqueSources = consolidatedResult.sources.length

  console.log("[Hybrid] Consolidation complete:", {
    uniqueSources: consolidatedResult.metrics.uniqueSources,
    verdict: consolidatedResult.verdict.label,
    agreement: consolidatedResult.verdict.engineAgreement
  })

  return consolidatedResult
}

async function enhanceConsolidatedResult(result: ConsolidatedResult): Promise<ConsolidatedResult> {
  // Future enhancement: Add credibility scoring, source validation, etc.
  // For now, just return the result as-is
  return result
}