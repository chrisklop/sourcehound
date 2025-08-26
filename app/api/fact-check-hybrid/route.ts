import { type NextRequest, NextResponse } from "next/server"
import { updateProgress } from "../fact-check/progress"
import { generateSlug } from "@/lib/database"
import { logQuery } from "@/lib/query-logger"
import { intelligentSearch } from "@/lib/intelligent-router"
import { GoogleGenerativeAI, SchemaType, FunctionCallingMode } from "@google/generative-ai"

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
}

export async function POST(request: NextRequest) {
  let query: string | null = null
  
  try {
    const body = await request.json()
    const { query: bodyQuery, sessionId: providedSessionId } = body
    query = bodyQuery
    const sessionId = providedSessionId || `hybrid_${Date.now()}`

    console.log("[Hybrid] Processing dual-engine fact-check:", query)

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    const slug = generateSlug(query)
    const result = await performHybridFactCheck(query, sessionId, slug)

    return NextResponse.json({ ...result, slug, cached: false })
  } catch (error) {
    console.error("[Hybrid] POST Error:", error)
    if (query) {
      await logQuery(query, false, { 
        errorType: 'hybrid_api_error', 
        method: 'POST' 
      })
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
    const result = await intelligentSearch(query)
    console.log("[Hybrid] Perplexity completed:", result.sources?.length || 0, "sources")
    return { status: 'success', data: result, engine: 'perplexity' }
  } catch (error) {
    console.error("[Hybrid] Perplexity engine failed:", error)
    return { status: 'failed', error, engine: 'perplexity' }
  }
}

async function runGeminiEngine(query: string, sessionId: string) {
  try {
    console.log("[Hybrid] Starting Gemini engine...")
    
    // Check if API key is available
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable not found")
    }
    
    console.log("[Hybrid] Gemini API key found, initializing model...")
    
    // Simplified Gemini model without function calling for better compatibility
    const geminiPro = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
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
      model: "gemini-1.5-pro", 
      systemInstruction: systemPrompt 
    })
    
    const result = await chat.generateContent(`Fact-check this claim: "${query}"`)
    const jsonText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim()
    const parsedResult = JSON.parse(jsonText)
    
    console.log("[Hybrid] Gemini completed:", parsedResult.sources?.length || 0, "sources")
    return { status: 'success', data: parsedResult, engine: 'gemini' }
  } catch (error) {
    console.error("[Hybrid] Gemini engine failed:", error)
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
    .slice(0, 30) // Limit to top 30

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