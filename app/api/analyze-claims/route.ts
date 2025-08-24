import { type NextRequest, NextResponse } from "next/server"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

interface Claim {
  id: number
  text: string
  priority: "high" | "medium" | "low"
  searchQuery: string
}

interface ClaimExtractionResult {
  claims: Claim[]
  inputType: "query" | "article"
  originalInput: string
  summary?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { input, sessionId } = body

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: "Input text is required" }, 
        { status: 400 }
      )
    }

    console.log(`[v0] Analyzing claims for sessionId: ${sessionId}`)

    // Determine input type (simple query vs full article)
    const inputType = determineInputType(input)
    
    // Extract claims using LLM
    const result = await extractClaimsWithLLM(input, inputType)
    
    const response: ClaimExtractionResult = {
      claims: result.claims,
      inputType,
      originalInput: input,
      summary: result.summary
    }

    console.log(`[v0] Extracted ${result.claims.length} claims from ${inputType}`)
    
    return NextResponse.json(response)
  } catch (error) {
    console.error("[v0] Claim extraction error:", error)
    return NextResponse.json(
      { error: "Failed to analyze claims" }, 
      { status: 500 }
    )
  }
}

function determineInputType(input: string): "query" | "article" {
  // Heuristics to determine if input is a simple query or full article
  const wordCount = input.trim().split(/\s+/).length
  const sentenceCount = input.split(/[.!?]+/).filter(s => s.trim().length > 0).length
  
  // If short and question-like, treat as query
  if (wordCount < 20 && (input.includes('?') || sentenceCount <= 2)) {
    return "query"
  }
  
  // If longer with multiple sentences, treat as article
  return sentenceCount > 3 ? "article" : "query"
}

async function extractClaimsWithLLM(input: string, inputType: "query" | "article") {
  const systemPrompt = `You are a fact-checking assistant. Extract all verifiable factual claims from this ${inputType}.

For each claim:
1. State it as a clear, atomic statement
2. Assign priority (high for central claims, medium for supporting claims, low for tangential)
3. Create an optimized search query to verify this claim

Respond in valid JSON format:
{
  "claims": [
    {
      "id": 1,
      "text": "specific verifiable claim",
      "priority": "high|medium|low",
      "searchQuery": "optimized search string"
    }
  ],
  "summary": "brief overview of main claims"
}`

  const userPrompt = `Input ${inputType}: ${input}`

  // Try OpenAI first, then Anthropic as fallback
  if (OPENAI_API_KEY) {
    try {
      return await callOpenAI(systemPrompt, userPrompt)
    } catch (error) {
      console.error("[v0] OpenAI failed, trying Anthropic:", error)
      if (ANTHROPIC_API_KEY) {
        return await callAnthropic(systemPrompt, userPrompt)
      }
      throw error
    }
  } else if (ANTHROPIC_API_KEY) {
    return await callAnthropic(systemPrompt, userPrompt)
  } else {
    throw new Error("No LLM API key configured (OPENAI_API_KEY or ANTHROPIC_API_KEY)")
  }
}

async function callOpenAI(systemPrompt: string, userPrompt: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 25000) // 25 second timeout
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4-turbo-2024-04-09',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1500 // Reduced for faster response
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

    return parseClaimExtractionResponse(content)
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

async function callAnthropic(systemPrompt: string, userPrompt: string) {
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
      max_tokens: 2000
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

  return parseClaimExtractionResponse(content)
}

function parseClaimExtractionResponse(content: string) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/)
    const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content
    
    const parsed = JSON.parse(jsonString)
    
    // Validate structure
    if (!parsed.claims || !Array.isArray(parsed.claims)) {
      throw new Error("Invalid response structure: missing claims array")
    }

    // Ensure each claim has required fields
    const validatedClaims = parsed.claims.map((claim: any, index: number) => ({
      id: claim.id || index + 1,
      text: claim.text || claim.claim || "",
      priority: ["high", "medium", "low"].includes(claim.priority) ? claim.priority : "medium",
      searchQuery: claim.searchQuery || claim.search_query || claim.text || ""
    })).filter((claim: Claim) => claim.text.trim().length > 0)

    return {
      claims: validatedClaims,
      summary: parsed.summary || "Claims extracted from input"
    }
  } catch (error) {
    console.error("[v0] Failed to parse LLM response:", error)
    console.error("[v0] Raw content:", content)
    
    // Fallback: treat entire input as single claim
    return {
      claims: [
        {
          id: 1,
          text: content.substring(0, 500), // Truncate if too long
          priority: "high" as const,
          searchQuery: content.substring(0, 200)
        }
      ],
      summary: "Fallback: treated as single claim due to parsing error"
    }
  }
}