import { type NextRequest, NextResponse } from "next/server"
import { summarizeSource } from "@/lib/source-summarization"

/**
 * On-demand AI source enhancement endpoint
 * Called when user clicks "Generate AI Summary" for individual sources
 */
export async function POST(request: NextRequest) {
  try {
    const { source, claim } = await request.json()

    if (!source || !claim) {
      return NextResponse.json(
        { error: "Missing required fields: source and claim" },
        { status: 400 }
      )
    }

    console.log(`[AI Enhancement] Generating AI summary for: ${source.url}`)

    // Create abort controller with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.log('[AI Enhancement] Request timeout')
      controller.abort()
    }, 15000) // 15 second timeout for individual source

    try {
      // Generate AI summary for this specific source
      const aiSummary = await summarizeSource(source, claim, controller.signal)
      
      clearTimeout(timeoutId)
      
      console.log(`[AI Enhancement] Successfully generated AI summary: ${aiSummary.processingStatus}`)

      return NextResponse.json({
        success: true,
        aiSummary,
        enhancementType: 'openai'
      })

    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[AI Enhancement] Request was aborted due to timeout')
        return NextResponse.json(
          { error: "Request timeout - AI enhancement took too long" },
          { status: 408 }
        )
      }

      throw error
    }

  } catch (error) {
    console.error('[AI Enhancement] Failed to enhance source:', error)

    return NextResponse.json(
      { 
        error: "Failed to generate AI summary", 
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

/**
 * Batch enhancement endpoint for multiple sources
 */
export async function PUT(request: NextRequest) {
  try {
    const { sources, claim, maxSources = 10 } = await request.json()

    if (!sources || !Array.isArray(sources) || !claim) {
      return NextResponse.json(
        { error: "Missing required fields: sources (array) and claim" },
        { status: 400 }
      )
    }

    // Limit batch size to prevent timeouts
    const limitedSources = sources.slice(0, maxSources)
    console.log(`[AI Enhancement] Batch processing ${limitedSources.length} sources`)

    // Create abort controller with longer timeout for batch
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.log('[AI Enhancement] Batch timeout')
      controller.abort()
    }, 45000) // 45 second timeout for batch

    try {
      // Process sources with conservative concurrency
      const enhancedSources = []
      const batchSize = 3
      
      for (let i = 0; i < limitedSources.length; i += batchSize) {
        const batch = limitedSources.slice(i, i + batchSize)
        
        const batchPromises = batch.map(source => 
          summarizeSource(source, claim, controller.signal)
            .catch(error => ({
              sourceUrl: source.url,
              summary: "AI enhancement failed for this source",
              relevance: 'medium' as const,
              perspective: 'neutral' as const,
              keyInsights: ["Enhancement failed"],
              credibilityContext: "AI analysis unavailable",
              extractedQuotes: [],
              confidence: 0.3,
              processingStatus: 'failed' as const,
              errorMessage: error.message
            }))
        )
        
        const batchResults = await Promise.all(batchPromises)
        enhancedSources.push(...batchResults)
        
        // Small delay between batches
        if (i + batchSize < limitedSources.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      clearTimeout(timeoutId)
      
      const successCount = enhancedSources.filter(s => s.processingStatus === 'success').length
      console.log(`[AI Enhancement] Batch complete: ${successCount}/${limitedSources.length} successful`)

      return NextResponse.json({
        success: true,
        enhancedSources,
        successCount,
        totalProcessed: limitedSources.length,
        enhancementType: 'openai'
      })

    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[AI Enhancement] Batch request was aborted due to timeout')
        return NextResponse.json(
          { error: "Batch timeout - AI enhancement took too long" },
          { status: 408 }
        )
      }

      throw error
    }

  } catch (error) {
    console.error('[AI Enhancement] Batch enhancement failed:', error)

    return NextResponse.json(
      { 
        error: "Failed to enhance sources", 
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}