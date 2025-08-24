import { type NextRequest, NextResponse } from "next/server"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

interface ClaimVerification {
  claim: {
    id: number
    text: string
    priority: "high" | "medium" | "low"
    searchQuery: string
  }
  verdict: "TRUE" | "FALSE" | "PARTIALLY_TRUE" | "UNVERIFIABLE"
  confidence: number
  explanation: string
  supportingSources: number[]
  contradictingSources: number[]
  nuance?: string
}

interface SynthesisResult {
  verifications: ClaimVerification[]
  overallCredibility: "high" | "medium" | "low"
  keyFindings: string[]
  sourcesQuality: {
    averageScore: number
    highQuality: number
    totalSources: number
  }
  confidence: number
  summary: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { claimResults, sources, sessionId } = body

    if (!claimResults || !Array.isArray(claimResults)) {
      return NextResponse.json(
        { error: "claimResults array is required" }, 
        { status: 400 }
      )
    }

    console.log(`[v0] Synthesizing verification for ${claimResults.length} claims, sessionId: ${sessionId}`)

    // Prepare structured data for synthesis
    const structuredData = prepareClaimsWithSources(claimResults, sources || [])
    
    // Use LLM to synthesize final analysis
    const synthesisResult = await synthesizeWithLLM(structuredData)
    
    console.log(`[v0] Synthesis complete: ${synthesisResult.overallCredibility} credibility, ${synthesisResult.confidence} confidence`)
    
    return NextResponse.json(synthesisResult)
  } catch (error) {
    console.error("[v0] Synthesis error:", error)
    return NextResponse.json(
      { error: "Failed to synthesize verification results" }, 
      { status: 500 }
    )
  }
}

function prepareClaimsWithSources(claimResults: any[], sources: any[]) {
  return claimResults.map((claimResult, index) => {
    const { claim, perplexity, factCheck } = claimResult
    
    // Extract relevant sources for this claim
    const claimSources = sources.filter(source => 
      source.metadata?.citationNumber || 
      source.title?.toLowerCase().includes(claim.text.toLowerCase().split(' ')[0]) ||
      index === 0 // First few sources for first claim as fallback
    ).slice(0, 5)
    
    return {
      claim,
      perplexityResponse: perplexity?.choices?.[0]?.message?.content || null,
      factCheckData: factCheck?.claims || [],
      availableSources: claimSources,
      index
    }
  })
}

async function synthesizeWithLLM(structuredData: any[]) {
  const systemPrompt = `You are a fact-checking analyst. Analyze these claims against the retrieved evidence and provide a comprehensive synthesis.

For each claim, determine:
1. Verdict: TRUE / FALSE / PARTIALLY_TRUE / UNVERIFIABLE
2. Confidence score (0.0-1.0)
3. Detailed explanation
4. Supporting source IDs (based on source ranks provided)
5. Contradicting source IDs
6. Important nuance or context

Then provide an overall assessment of credibility and key findings.

Respond in valid JSON format:
{
  "verifications": [
    {
      "claim": { "id": 1, "text": "claim text" },
      "verdict": "TRUE|FALSE|PARTIALLY_TRUE|UNVERIFIABLE",
      "confidence": 0.85,
      "explanation": "detailed explanation",
      "supportingSources": [1, 2, 3],
      "contradictingSources": [4],
      "nuance": "important context"
    }
  ],
  "overallCredibility": "high|medium|low",
  "keyFindings": ["finding1", "finding2"],
  "sourcesQuality": {
    "averageScore": 85,
    "highQuality": 3,
    "totalSources": 5
  },
  "confidence": 0.8,
  "summary": "overall synthesis summary"
}`

  const userPrompt = `Claims and Evidence Analysis:

${structuredData.map((data, index) => `
**Claim ${data.claim.id}: ${data.claim.text}**
Priority: ${data.claim.priority}

AI Analysis:
${data.perplexityResponse || 'No AI analysis available'}

Fact-Check Reviews:
${data.factCheckData.length > 0 ? 
  data.factCheckData.slice(0, 3).map((fc: any) => 
    `- ${fc.claimReview?.[0]?.publisher?.name || 'Unknown'}: ${fc.claimReview?.[0]?.textualRating || 'No rating'}`
  ).join('\n') : 
  'No fact-check reviews found'
}

Available Sources:
${data.availableSources.map((source: any) => 
  `[${source.rank}] ${source.title} (${source.publisher}) - Quality: ${source.quality?.score || 'Unknown'}/100`
).join('\n')}

---
`).join('\n')}

Please analyze each claim thoroughly and provide the synthesis in the specified JSON format.`

  // Try OpenAI first, then Anthropic as fallback
  if (OPENAI_API_KEY) {
    try {
      return await callOpenAIForSynthesis(systemPrompt, userPrompt)
    } catch (error) {
      console.error("[v0] OpenAI synthesis failed, trying Anthropic:", error)
      if (ANTHROPIC_API_KEY) {
        return await callAnthropicForSynthesis(systemPrompt, userPrompt)
      }
      throw error
    }
  } else if (ANTHROPIC_API_KEY) {
    return await callAnthropicForSynthesis(systemPrompt, userPrompt)
  } else {
    throw new Error("No LLM API key configured for synthesis")
  }
}

async function callOpenAIForSynthesis(systemPrompt: string, userPrompt: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-2024-04-09',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 3000
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error("No content received from OpenAI")
  }

  return parseSynthesisResponse(content)
}

async function callAnthropicForSynthesis(systemPrompt: string, userPrompt: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANTHROPIC_API_KEY}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 3000
    })
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.content[0]?.text

  if (!content) {
    throw new Error("No content received from Anthropic")
  }

  return parseSynthesisResponse(content)
}

function parseSynthesisResponse(content: string): SynthesisResult {
  try {
    // Extract JSON from the response
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/)
    const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content
    
    const parsed = JSON.parse(jsonString)
    
    // Validate and structure the response
    const verifications: ClaimVerification[] = (parsed.verifications || []).map((v: any) => ({
      claim: v.claim || { id: 1, text: "Unknown claim" },
      verdict: ["TRUE", "FALSE", "PARTIALLY_TRUE", "UNVERIFIABLE"].includes(v.verdict) ? v.verdict : "UNVERIFIABLE",
      confidence: Math.max(0, Math.min(1, v.confidence || 0.5)),
      explanation: v.explanation || "No explanation provided",
      supportingSources: Array.isArray(v.supportingSources) ? v.supportingSources : [],
      contradictingSources: Array.isArray(v.contradictingSources) ? v.contradictingSources : [],
      nuance: v.nuance || null
    }))

    return {
      verifications,
      overallCredibility: ["high", "medium", "low"].includes(parsed.overallCredibility) ? parsed.overallCredibility : "medium",
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
      sourcesQuality: {
        averageScore: parsed.sourcesQuality?.averageScore || 70,
        highQuality: parsed.sourcesQuality?.highQuality || 0,
        totalSources: parsed.sourcesQuality?.totalSources || 0
      },
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.6)),
      summary: parsed.summary || "Analysis completed"
    }
  } catch (error) {
    console.error("[v0] Failed to parse synthesis response:", error)
    console.error("[v0] Raw content:", content)
    
    // Fallback response
    return {
      verifications: [],
      overallCredibility: "medium",
      keyFindings: ["Synthesis parsing failed"],
      sourcesQuality: {
        averageScore: 0,
        highQuality: 0,
        totalSources: 0
      },
      confidence: 0.3,
      summary: "Synthesis analysis encountered parsing errors"
    }
  }
}