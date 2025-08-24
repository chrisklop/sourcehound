import { NextRequest, NextResponse } from 'next/server'

interface AnalysisRenderRequest {
  base_analysis: string
  style: string
  claim_id?: string
}

interface AnalysisStyle {
  prompt: string
  processing_instructions: string
}

const ANALYSIS_STYLES: Record<string, AnalysisStyle> = {
  summary: {
    prompt: "REWRITE this fact-check analysis as a single, clear, powerful sentence that captures the essential verdict and most compelling evidence. REQUIREMENTS: 1) State the verdict (true/false/mixed) clearly, 2) Include the single most important piece of supporting evidence, 3) Be direct and conclusive, 4) Use active voice, 5) No more than 25 words total, 6) Use **bold formatting** for the verdict and key terms, 7) Include at least one citation reference [1] from the original sources. Make this punchy and definitive.",
    processing_instructions: "Complete rewrite as one powerful sentence - clear verdict plus strongest evidence, under 25 words, direct and conclusive with bold formatting and citations."
  },
  detailed: {
    prompt: "REWRITE this fact-check analysis as a comprehensive, well-structured examination that is significantly longer and more detailed than the original. REQUIREMENTS: 1) Add extensive depth to evidence evaluation with specific examples, 2) Include broader historical and scientific context, 3) Elaborate on implications and consequences, 4) Provide thorough step-by-step reasoning for the conclusion, 5) Use clear **bold section headings** like **Evidence Analysis**, **Historical Context**, **Scientific Consensus**, 6) Add detailed explanations for each key point with **bold key terms**, 7) Include methodology discussion, 8) Expand citations significantly - add at least 5-10 more citation references [1][2][3] throughout the text to support each major point. Make this at least 2-3 times longer than the original with substantially more analytical depth.",
    processing_instructions: "Complete rewrite with extensive expansion - add deep analysis, broader context, detailed methodology, comprehensive evidence evaluation, bold formatting for headings and key terms, and significantly more citations throughout."
  },
  professional: {
    prompt: "REWRITE this fact-check analysis as a professional executive briefing for business leaders and decision-makers. REQUIREMENTS: 1) Use formal business language and tone, 2) Include detailed risk assessment with specific risk factors, 3) Provide numerical confidence levels and statistical context, 4) Add strategic implications for organizations, 5) Include actionable recommendations with implementation steps, 6) Structure with **bold section headings**: **Executive Summary**, **Key Findings**, **Risk Assessment**, **Strategic Implications**, **Recommendations**, 7) Focus on business impact and decision-making implications, 8) Use **bold formatting** for all risk levels, confidence percentages, and critical business terms, 9) Add extensive citations [1][2][3] to support all statistical claims and recommendations. Make this professional and comprehensive.",
    processing_instructions: "Complete rewrite for executives - formal tone, risk analysis, strategic implications, actionable recommendations, business-focused perspective with bold formatting and extensive citations."
  },
  scholarly: {
    prompt: "REWRITE this fact-check analysis as a comprehensive academic paper suitable for scholarly publication. REQUIREMENTS: 1) Use formal academic language with proper scholarly tone, 2) Include extensive literature review and citation context, 3) Add rigorous methodology discussion with epistemological considerations, 4) Provide detailed statistical analysis and evidence evaluation, 5) Include limitations section and areas for future research, 6) Structure with **bold academic headings**: **Abstract**, **Introduction**, **Methodology**, **Results**, **Discussion**, **Conclusion**, **Limitations**, 7) Add theoretical frameworks and scholarly discourse, 8) Use **bold formatting** for all statistical findings, research terms, and theoretical concepts, 9) Significantly expand citations - include at least 15-20 citation references [1][2][3] distributed throughout all sections to support academic claims. Make this a substantial academic work that could be submitted for peer review.",
    processing_instructions: "Complete academic rewrite - scholarly tone, extensive literature context, rigorous methodology, statistical analysis, peer-review quality depth with comprehensive bold formatting and extensive academic citations."
  },
  grandpa: {
    prompt: "REWRITE this fact-check analysis in simple, warm, conversational language that anyone can understand and enjoy reading. REQUIREMENTS: 1) Use everyday analogies and familiar comparisons, 2) Avoid all technical jargon and complex terms, 3) Explain concepts like you're talking to family over coffee, 4) Make it engaging and relatable with storytelling elements, 5) Use simple sentence structure and common words, 6) Add folksy wisdom and practical examples, 7) Keep the same factual content but make it accessible and friendly, 8) Use **bold formatting** for important points and key takeaways to help readers follow along, 9) Include citations [1][2] but explain them in simple terms like 'according to the experts' or 'the research shows'. Write like you're having a heart-to-heart conversation with someone you care about.",
    processing_instructions: "Complete rewrite in plain, conversational style - simple language, everyday analogies, storytelling approach, warm accessible tone with helpful bold formatting and user-friendly citations."
  },
  "dog-walk": {
    prompt: "REWRITE this fact-check analysis using the Socratic method to guide the reader through logical reasoning and discovery. REQUIREMENTS: 1) Start with fundamental questions about the claim, 2) Ask probing questions that make the reader think critically, 3) Guide the reader step-by-step through the evidence using questions, 4) Use 'What if...' and 'How might...' and 'Why would...' questions, 5) Let the reader discover contradictions and supporting evidence through guided questioning, 6) Build the logical chain through a series of thought-provoking questions, 7) Lead the reader to the conclusion naturally through their own reasoning process, 8) Use **bold formatting** for key questions and important discovery moments, 9) Include citations [1][2][3] within the questioning flow - ask questions like 'But what does this research [1] suggest about..?' or 'How does this evidence [2] challenge the claim?' Write as if you're walking with someone and asking thoughtful questions that help them think through the problem themselves.",
    processing_instructions: "Complete rewrite using Socratic questioning method - guide reader through logical discovery with probing questions, step-by-step reasoning, natural conclusion building, bold formatting for key questions, and citations integrated into the questioning flow."
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[v0] Analysis render API called')
    
    const body = await request.json() as AnalysisRenderRequest
    const { base_analysis, style, claim_id } = body

    if (!base_analysis || !style) {
      return NextResponse.json(
        { error: 'Missing required parameters: base_analysis and style' },
        { status: 400 }
      )
    }

    const analysisStyle = ANALYSIS_STYLES[style]
    if (!analysisStyle) {
      return NextResponse.json(
        { error: `Invalid style: ${style}. Available styles: ${Object.keys(ANALYSIS_STYLES).join(', ')}` },
        { status: 400 }
      )
    }

    console.log(`[v0] Rendering analysis in ${style} style with LLM`)

    // Use OpenAI GPT-4 to rewrite the analysis in the specified style
    const renderedAnalysis = await renderAnalysisWithLLM(base_analysis, analysisStyle, style)

    return NextResponse.json({
      success: true,
      rendered_analysis: renderedAnalysis,
      style: style,
      claim_id: claim_id,
      processing_time: Date.now()
    })

  } catch (error) {
    console.error('[v0] Analysis render error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to render analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function renderAnalysisWithLLM(
  baseAnalysis: string, 
  style: AnalysisStyle, 
  styleId: string
): Promise<string> {
  const cleanAnalysis = baseAnalysis
    .replace(/citations:\s*\d+\.\s*[^,]+,\s*[^,]+,.*?(?=\n|$)/gi, "")
    .replace(/^\s*\d+\.\s*[^,]+,\s*[^,]+,.*$/gm, "")
    .replace(/^\s*\*\*Verdict:\*\*.*$/gm, "") // Remove verdict lines
    .replace(/^\s*\*\*Confidence level:\*\*.*$/gm, "") // Remove confidence lines
    .trim()

  try {
    // Try OpenAI GPT-4 first (better for text rewriting)
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (openaiApiKey) {
      console.log(`[v0] Using OpenAI GPT-4 for ${styleId} style rendering`)
      return await callOpenAI(cleanAnalysis, style.prompt, openaiApiKey)
    }

    // Fallback to Perplexity (but with fixed configuration)
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY
    if (perplexityApiKey) {
      console.log(`[v0] Using Perplexity for ${styleId} style rendering`)
      return await callPerplexity(cleanAnalysis, style.prompt, perplexityApiKey)
    }

    // Final fallback to Anthropic Claude
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY
    if (anthropicApiKey) {
      console.log(`[v0] Using Anthropic Claude for ${styleId} style rendering`)
      return await callAnthropic(cleanAnalysis, style.prompt, anthropicApiKey)
    }

    // If no API keys available, return original
    console.log('[v0] No LLM API keys available, returning original analysis')
    return cleanAnalysis

  } catch (error) {
    console.error(`[v0] LLM rendering failed for ${styleId}:`, error)
    return cleanAnalysis // Fallback to original
  }
}

async function callPerplexity(analysis: string, stylePrompt: string, apiKey: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout for Perplexity

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'llama-3.1-70b-instruct',
        messages: [
          {
            role: 'system',
            content: `You are a professional fact-check analysis writer. ${stylePrompt}\n\nPreserve any citation numbers [1], [2], [3] etc. that appear in the original text exactly as they are. Focus on rewriting the provided text according to the style requirements.`
          },
          {
            role: 'user',
            content: `Please rewrite this fact-check analysis according to the specified style:\n\n${analysis}`
          }
        ],
        max_tokens: stylePrompt.includes('single, clear sentence') ? 50 : 
                   stylePrompt.includes('comprehensive academic') ? 2000 : 1000,
        temperature: 0.3
      }),
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || analysis

  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Perplexity request timed out')
    }
    throw error
  }
}

async function callOpenAI(analysis: string, stylePrompt: string, apiKey: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 25000) // 25 second timeout

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4-turbo-2024-04-09',
        messages: [
          {
            role: 'system',
            content: `You are a professional fact-check analysis writer. ${stylePrompt}\n\nPreserve any citation numbers [1], [2], [3] etc. that appear in the original text exactly as they are.`
          },
          {
            role: 'user',
            content: `Please rewrite this fact-check analysis according to the specified style:\n\n${analysis}`
          }
        ],
        max_tokens: stylePrompt.includes('single, clear sentence') ? 50 : 
                   stylePrompt.includes('comprehensive academic') ? 2000 : 1000,
        temperature: 0.3,
      }),
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || analysis

  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('OpenAI request timed out')
    }
    throw error
  }
}

async function callAnthropic(analysis: string, stylePrompt: string, apiKey: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 25000) // 25 second timeout

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: stylePrompt.includes('single, clear sentence') ? 50 : 
                   stylePrompt.includes('comprehensive academic') ? 2000 : 1000,
        messages: [
          {
            role: 'user',
            content: `You are a professional fact-check analysis writer. ${stylePrompt}\n\nPreserve any citation numbers [1], [2], [3] etc. that appear in the original text exactly as they are.\n\nPlease rewrite this fact-check analysis according to the specified style:\n\n${analysis}`
          }
        ],
      }),
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`)
    }

    const data = await response.json()
    return data.content[0]?.text || analysis

  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Anthropic request timed out')
    }
    throw error
  }
}