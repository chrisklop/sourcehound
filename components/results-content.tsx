"use client"

import { useEffect, useState } from "react"
import { VerdictBadge } from "@/components/verdict-badge"
import { FactCheckReviews } from "@/components/fact-check-reviews"
import { SourcesTable } from "@/components/sources-table"
import { InfoBox } from "@/components/info-box"
import { VideoEmbed } from "@/components/video-embed"
import { ShareButton } from "@/components/share-button"
import { ExportDropdown } from "@/components/export-dropdown"
import { ResultsSkeleton } from "@/components/results-skeleton"
import { ErrorBoundary } from "@/components/error-boundary"
import { ProgressBar } from "@/components/progress-bar"
import { AnalysisModeDropdown } from "@/components/analysis-mode-dropdown"

interface FactCheckResult {
  originalQuery?: string
  normalizedQuery?: string
  verdict: {
    label: "True" | "False" | "Mixed" | "Unclear" | "Needs More Evidence"
    confidence: number
    summary: string
  }
  keyPoints: string[]
  explanation: string
  factCheckReviews: Array<{
    publisher: string
    title: string
    url: string
    rating?: string
    reviewedAt?: string
  }>
  sources: Array<{
    rank: number
    url: string
    title: string
    publisher?: string
    publishedAt?: string
    type: "primary" | "secondary" | "factcheck" | "academic" | "news" | "government"
  }>
  metadata?: {
    claimant?: string
    firstSeen?: string
    topics?: string[]
  }
  debug?: {
    perplexityResponse?: any
    googleResponse?: any
    processingTime?: number
  }
  errors?: {
    perplexity?: string
    google?: string
  }
  slug?: string
  cached?: boolean
  cachedAt?: string
  updatedAt?: string
}

interface ResultsContentProps {
  query?: string
  initialResult?: FactCheckResult
  showProgress?: boolean
  debugMode?: boolean
  forceRefresh?: boolean
}

export function ResultsContent({
  query: propQuery,
  initialResult,
  showProgress: propShowProgress = true,
  debugMode = false,
  forceRefresh = false,
}: ResultsContentProps) {
  const [urlSessionId, setUrlSessionId] = useState<string | null>(null)
  
  // Get sessionId from URL client-side
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    setUrlSessionId(urlParams.get("sessionId"))
  }, [])
  
  const urlQuery = propQuery

  const query = propQuery || urlQuery

  const [result, setResult] = useState<FactCheckResult | null>(initialResult || null)
  const [loading, setLoading] = useState(false) // Start as false, only set to true when search starts
  const [searchStarted, setSearchStarted] = useState(false) // Track if search has started
  const [error, setError] = useState<string | null>(null)
  const [sessionId] = useState(() => urlSessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [showProgress, setShowProgress] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [analysisMode, setAnalysisMode] = useState("detailed")
  const [renderedAnalysis, setRenderedAnalysis] = useState<string | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisCache, setAnalysisCache] = useState<Record<string, string>>({})

  const renderTextWithClickableCitations = (text: string, sources: any[]) => {
    if (!text || !sources || !sources.length) return text

    return text.split(/(\[\d+\])/g).map((part, index) => {
      const match = part.match(/\[(\d+)\]/)
      if (match) {
        const citationNumber = Number.parseInt(match[1])
        const source = sources.find((s) => s.rank === citationNumber)
        if (source) {
          return (
            <a
              key={index}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium hover:underline transition-colors"
              title={`${source.title} - ${source.publisher || "Unknown publisher"}`}
            >
              {part}
            </a>
          )
        }
      }
      return part
    })
  }

  const formatDetailedAnalysis = (text: string, sources: any[]) => {
    if (!text) return null

    // Enhanced cleaning to remove metadata and improve structure
    const cleanText = text
      .replace(/citations:\s*\d+\.\s*[^,]+,\s*[^,]+,.*?(?=\n|$)/gi, "")
      .replace(/^\s*\d+\.\s*[^,]+,\s*[^,]+,.*$/gm, "")
      .replace(/^\s*\*\*Verdict:\*\*.*$/gm, "") // Remove verdict lines
      .replace(/^\s*\*\*Confidence level:\*\*.*$/gm, "") // Remove confidence lines
      .replace(/^\s*\*\*Summary.*?\*\*.*$/gm, "") // Remove summary headers
      .replace(/^\s*\d+\.\s*\*\*Verdict:\*\*.*$/gm, "") // Remove numbered verdict
      .replace(/^\s*\d+\.\s*\*\*Confidence.*?\*\*.*$/gm, "") // Remove numbered confidence
      .replace(/^\s*\d+\.\s*\*\*Summary.*?\*\*.*$/gm, "") // Remove numbered summary
      .trim()

    // Split into sections and paragraphs with better detection
    const sections = cleanText.split(/\n\n+/)
    
    return sections.map((section, sectionIndex) => {
      if (!section.trim()) return null

      // Check if this is a main heading (starts with **)
      if (section.match(/^\*\*[^*]+\*\*/)) {
        const headingMatch = section.match(/^\*\*([^*]+)\*\*:?\s*([\s\S]*)$/)
        if (headingMatch) {
          const [, heading, content] = headingMatch
          return (
            <div key={sectionIndex} className="mb-6">
              <h3 className="text-lg font-semibold text-foreground mb-3">{heading}</h3>
              {content.trim() && (
                <div className="space-y-3">
                  {content.trim().split(/\n\n+/).map((paragraph, pIndex) => 
                    formatParagraph(paragraph, sources, `${sectionIndex}-${pIndex}`)
                  )}
                </div>
              )}
            </div>
          )
        }
      }

      // Check if this is a numbered list section
      if (section.includes('\n1. ') || section.match(/^\d+\./)) {
        return (
          <div key={sectionIndex} className="mb-6">
            {formatListSection(section, sources, sectionIndex)}
          </div>
        )
      }

      // Regular paragraph
      return formatParagraph(section, sources, sectionIndex.toString())
    }).filter(Boolean)
  }

  const formatListSection = (section: string, sources: any[], sectionIndex: number) => {
    const lines = section.split('\n')
    const paragraphs: React.ReactNode[] = []

    let currentParagraph = ''
    for (const line of lines) {
      if (line.match(/^\d+\.\s*\*\*[^*]+\*\*/)) {
        // Save previous paragraph if exists
        if (currentParagraph.trim()) {
          paragraphs.push(formatParagraph(currentParagraph, sources, `${sectionIndex}-${paragraphs.length}`))
          currentParagraph = ''
        }
        
        // Process the numbered item as a new paragraph
        const content = line.replace(/^\d+\.\s*/, '').trim()
        paragraphs.push(formatParagraph(content, sources, `${sectionIndex}-${paragraphs.length}`))
      } else if (line.trim()) {
        currentParagraph += (currentParagraph ? ' ' : '') + line.trim()
      } else if (currentParagraph.trim()) {
        paragraphs.push(formatParagraph(currentParagraph, sources, `${sectionIndex}-${paragraphs.length}`))
        currentParagraph = ''
      }
    }

    // Add any remaining paragraph
    if (currentParagraph.trim()) {
      paragraphs.push(formatParagraph(currentParagraph, sources, `${sectionIndex}-${paragraphs.length}`))
    }

    return <div className="space-y-4">{paragraphs}</div>
  }

  const formatParagraph = (text: string, sources: any[], key: string) => {
    if (!text.trim()) return null

    // Extract citations first
    const citations = text.match(/\[\d+\]/g) || []
    
    // Process markdown formatting and add emphasis to affirming statements
    let processedText = text
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
    
    // Make affirming statements and positive conclusions more prominent
    const affirmingPatterns = [
      /(is supported by|confirmed by|evidence shows|clearly demonstrates|scientifically proven|established fact|conclusively shows)/gi,
      /(reliable|credible|authentic|legitimate|verified|validated|substantiated)/gi,
      /(not supported|no evidence|contradicted by|disputed by|lacks credibility)/gi
    ]

    affirmingPatterns.forEach(pattern => {
      processedText = processedText.replace(pattern, '<strong class="font-bold text-foreground">$1</strong>')
    })

    // Split text by citations to handle them properly
    const parts = text.split(/(\[\d+\])/g)
    
    return (
      <p key={key} className="text-muted-foreground leading-relaxed mb-4 last:mb-0">
        {parts.map((part, index) => {
          if (part.match(/\[\d+\]/)) {
            // This is a citation
            return renderTextWithClickableCitations(part, sources)
          } else {
            // This is regular text - process it
            let partText = part
              .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
              .replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
            
            affirmingPatterns.forEach(pattern => {
              partText = partText.replace(pattern, '<strong class="font-bold text-foreground">$1</strong>')
            })
            
            return <span key={index} dangerouslySetInnerHTML={{ __html: partText }} />
          }
        })}
      </p>
    )
  }

  const handleModeChange = async (newMode: string) => {
    if (!result?.explanation || newMode === analysisMode) return

    console.log(`[v0] Switching analysis mode to: ${newMode}`)

    // Check cache first
    if (analysisCache[newMode]) {
      console.log(`[v0] Using cached analysis for mode: ${newMode}`)
      setAnalysisMode(newMode)
      setRenderedAnalysis(analysisCache[newMode])
      return
    }

    setAnalysisLoading(true)

    try {
      const response = await fetch('/api/analysis/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base_analysis: result.explanation,
          style: newMode,
          claim_id: sessionId
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to render analysis: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success) {
        console.log(`[v0] Successfully rendered analysis for mode: ${newMode}`)
        setAnalysisMode(newMode)
        setRenderedAnalysis(data.rendered_analysis)
        
        // Cache the result
        setAnalysisCache(prev => ({
          ...prev,
          [newMode]: data.rendered_analysis
        }))
      } else {
        throw new Error(data.error || 'Failed to render analysis')
      }
    } catch (err) {
      console.error('[v0] Analysis mode change error:', err)
      // Fall back to original analysis
      setAnalysisMode(newMode)
      setRenderedAnalysis(result.explanation)
    } finally {
      setAnalysisLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (!query) return

    setRefreshing(true)
    setError(null)
    setShowProgress(true)

    try {
      console.log("[v0] Refreshing fact-check for query:", query)
      const response = await fetch(
        `/api/fact-check?query=${encodeURIComponent(query)}&sessionId=${sessionId}&refresh=true`,
      )

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
      setShowProgress(false)
      // Clear analysis cache when refreshing
      setAnalysisCache({})
      setRenderedAnalysis(null)
      setAnalysisMode("detailed")
      console.log("[v0] Successfully refreshed result data")
    } catch (err) {
      console.log("[v0] Refresh error:", err)
      setShowProgress(false)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!query || (initialResult && !forceRefresh)) return

    const fetchResults = async () => {
      try {
        console.log("[v0] Starting fact-check API call for query:", query)
        setLoading(true)
        setSearchStarted(true)
        setError(null)
        setShowProgress(propShowProgress)

        console.log("[v0] Making fetch request with session ID:", sessionId)
        const refreshParam = forceRefresh ? "&refresh=true" : ""
        const response = await fetch(
          `/api/fact-check?query=${encodeURIComponent(query)}&sessionId=${sessionId}${refreshParam}`,
        )

        console.log("[v0] Received response:", response.status, response.statusText)

        if (!response.ok) {
          console.log("[v0] Response not OK, throwing error")
          throw new Error(`Server error: ${response.status}`)
        }

        console.log("[v0] Parsing JSON response...")
        const data = await response.json()
        console.log("[v0] Parsed data:", data)
        console.log("[v0] FactCheck Reviews count:", data.factCheckReviews?.length || 0)
        console.log("[v0] FactCheck Reviews data:", data.factCheckReviews)
        setResult(data)
        setShowProgress(false)
        console.log("[v0] Successfully set result data")
      } catch (err) {
        console.log("[v0] Error occurred:", err)
        setShowProgress(false)
        setError(err instanceof Error ? err.message : "An unexpected error occurred")
      } finally {
        console.log("[v0] Setting loading to false")
        setLoading(false)
      }
    }

    fetchResults()
  }, [query, sessionId, forceRefresh, initialResult, propShowProgress])

  if (!query) {
    return (
      <div className="text-center py-16" role="alert" aria-live="polite">
        <div className="text-muted-foreground text-lg">No query provided</div>
        <p className="text-sm text-muted-foreground mt-2">Please enter a claim to fact-check.</p>
      </div>
    )
  }

  if ((loading && showProgress) || refreshing) {
    return (
      <div className="max-w-full mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold leading-tight mb-4">{result?.normalizedQuery || query}</h1>
          <p className="text-muted-foreground text-lg">
            {refreshing
              ? "Refreshing analysis with latest data..."
              : "Analyzing claim with AI and professional fact-checkers..."}
          </p>
        </div>
        <ProgressBar
          sessionId={sessionId}
          onComplete={(data) => {
            console.log("[v0] Progress complete, data received:", data)
          }}
          onError={(errorMsg) => {
            console.log("[v0] Progress error:", errorMsg)
            setError(errorMsg)
            setShowProgress(false)
            setLoading(false)
            setRefreshing(false)
            setTimedOut(true)
          }}
        />
      </div>
    )
  }

  if (loading && searchStarted) {
    return (
      <div role="status" aria-live="polite" aria-label="Loading fact-check results">
        <ResultsSkeleton />
        <span className="sr-only">Loading fact-check results for: {query}</span>
      </div>
    )
  }

  if (error || timedOut) {
    return <ErrorBoundary error={error} timedOut={timedOut} onRetry={handleRefresh} partialData={result} />
  }

  if (!result) {
    return (
      <div className="text-center py-16" role="alert" aria-live="polite">
        <div className="text-muted-foreground text-lg">No results found</div>
        <p className="text-sm text-muted-foreground mt-2">
          We couldn't find any information about this claim. Try rephrasing your query.
        </p>
      </div>
    )
  }

  const timestamp = result.cachedAt
    ? new Date(result.cachedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
      <main className="lg:col-span-2 xl:col-span-3 2xl:col-span-4 space-y-8" role="main">
        <header className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold leading-tight">{result?.normalizedQuery || query}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-b border-border pb-4">
            <span>
              {result.cached ? "Cached" : "Generated"} on {timestamp}
            </span>
            <span aria-hidden="true">•</span>
            <span>{(result.sources || []).length} sources analyzed</span>
            {result.errors?.perplexity && (
              <>
                <span aria-hidden="true">•</span>
                <span className="text-amber-600 dark:text-amber-400" role="alert">
                  Analysis limited (service unavailable)
                </span>
              </>
            )}
            {result.errors?.google && (
              <>
                <span aria-hidden="true">•</span>
                <span className="text-amber-600 dark:text-amber-400" role="alert">
                  Fact-check reviews unavailable
                </span>
              </>
            )}
          </div>
        </header>

        <section aria-labelledby="summary-heading" className="bg-card border border-border rounded-xl p-6">
          <h2 id="summary-heading" className="text-xl font-semibold mb-4">
            Executive Summary
          </h2>
          <p className="text-muted-foreground leading-relaxed text-lg">
            {renderTextWithClickableCitations(result.verdict?.summary || "Analysis unavailable", result.sources || [])}
          </p>
        </section>

        {(result.factCheckReviews || []).length > 0 ? (
          <section aria-labelledby="human-reviews-heading" className="bg-card border border-border rounded-xl p-6">
            <h2 id="human-reviews-heading" className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 dark:bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                H
              </span>
              Human Fact-Check Reviews ({(result.factCheckReviews || []).length})
            </h2>
            <p className="text-muted-foreground mb-4 text-sm">
              Professional fact-checkers have previously reviewed similar claims. Here's what they found:
            </p>
            <FactCheckReviews reviews={result.factCheckReviews || []} />
          </section>
        ) : result.errors?.google ? (
          <section aria-labelledby="human-reviews-heading" className="bg-card border border-border rounded-xl p-6">
            <h2 id="human-reviews-heading" className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 dark:bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                H
              </span>
              Human Fact-Check Reviews
            </h2>
            <div
              className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
              role="alert"
            >
              <p className="text-amber-800 dark:text-amber-200">
                <strong>Human fact-check reviews unavailable:</strong> We couldn't retrieve additional professional
                fact-check reviews at this time. The AI analysis below is based on our comprehensive source evaluation.
              </p>
            </div>
          </section>
        ) : (
          <section aria-labelledby="human-reviews-heading" className="bg-card border border-border rounded-xl p-6">
            <h2 id="human-reviews-heading" className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 dark:bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                H
              </span>
              Human Fact-Check Reviews (0)
            </h2>
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <p className="text-muted-foreground">
                <strong>No existing fact-check reviews found:</strong> Professional fact-checkers haven't previously
                reviewed this specific claim. Our AI analysis below provides comprehensive evaluation based on available
                sources.
              </p>
            </div>
          </section>
        )}

        {(result.keyPoints || []).length > 0 && (
          <section aria-labelledby="key-points-heading">
            <h2 id="key-points-heading" className="text-xl font-semibold mb-6">
              Key Findings
            </h2>
            <div className="space-y-6">
              {(result.keyPoints || []).map((point, index) => {
                // Extract key theme from the point for header
                const extractKeyTheme = (text: string) => {
                  // Look for key economic/scientific terms to create focused headers
                  const themes = [
                    { pattern: /economic.*(growth|expansion|data)/i, title: "Economic Growth Data" },
                    { pattern: /employment|unemployment|job/i, title: "Employment Status" },
                    { pattern: /inflation|price/i, title: "Inflation Indicators" },
                    { pattern: /gdp|gross domestic/i, title: "GDP Analysis" },
                    { pattern: /market|stock|financial/i, title: "Market Conditions" },
                    { pattern: /government|official|federal/i, title: "Official Government Data" },
                    { pattern: /forecast|prediction|outlook/i, title: "Economic Outlook" },
                    { pattern: /evidence|study|research/i, title: "Research Evidence" },
                    { pattern: /consensus|expert|economist/i, title: "Expert Consensus" },
                    { pattern: /indicator|metric|measure/i, title: "Economic Indicators" }
                  ]
                  
                  for (const theme of themes) {
                    if (theme.pattern.test(text)) {
                      return theme.title
                    }
                  }
                  
                  // Fallback: extract first few words and capitalize
                  const words = text.split(' ').slice(0, 3).join(' ')
                  return words.length > 2 ? words.charAt(0).toUpperCase() + words.slice(1) : `Finding ${index + 1}`
                }
                
                const themeTitle = extractKeyTheme(point)
                
                return (
                  <div key={index} className="bg-card border border-border rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      {themeTitle}
                    </h3>
                    <div className="text-muted-foreground leading-relaxed">
                      {renderTextWithClickableCitations(point, result.sources || [])}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {result.explanation && (
          <section aria-labelledby="analysis-heading">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 id="analysis-heading" className="text-xl font-semibold">
                  Analysis
                </h2>
                <div className="flex items-center gap-2 px-2 py-1 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-purple-400">AI Rewritable</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Rewrite style:
                </span>
                <AnalysisModeDropdown 
                  onModeChange={handleModeChange}
                  currentMode={analysisMode}
                  disabled={analysisLoading || !!result.errors?.perplexity}
                />
              </div>
            </div>
            {result.errors?.perplexity ? (
              <div
                className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl p-4"
                role="alert"
              >
                <p className="text-amber-800 dark:text-amber-200">
                  <strong>Analysis unavailable:</strong> Our analysis service is currently experiencing issues. The
                  summary and sources below are still available.
                </p>
              </div>
            ) : (
              <div className="prose prose-gray dark:prose-invert max-w-none bg-card border border-border rounded-xl p-6 relative">
                {renderedAnalysis && analysisMode !== 'detailed' && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-md">
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                    <span className="text-xs text-purple-400 font-medium">AI Rewritten</span>
                  </div>
                )}
                {analysisLoading && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium">AI is rewriting analysis...</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                        <span className="text-xs text-purple-400">Using advanced language models</span>
                      </div>
                    </div>
                  </div>
                )}
                {formatDetailedAnalysis(renderedAnalysis || result.explanation, result.sources || [])}
              </div>
            )}
          </section>
        )}

        {(result.sources || []).length > 0 && (
          <section aria-labelledby="sources-heading">
            <h2 id="sources-heading" className="text-xl font-semibold mb-4">
              Sources & References ({(result.sources || []).length})
            </h2>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="bg-muted/50 px-6 py-3 border-b border-border">
                <p className="text-sm text-muted-foreground">
                  Sources are ranked by authority, relevance, and recency. Primary sources and fact-checking
                  organizations are prioritized.
                </p>
              </div>
              <SourcesTable sources={result.sources || []} />
            </div>
          </section>
        )}

        {debugMode && result.debug && (
          <section aria-labelledby="debug-heading" className="no-print">
            <h2 id="debug-heading" className="text-xl font-semibold mb-3">
              Debug Information
            </h2>
            <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-4">
              {result.debug.processingTime && (
                <div>
                  <strong>Processing Time:</strong> {result.debug.processingTime}ms
                </div>
              )}
              {result.debug.perplexityResponse && (
                <details className="space-y-2">
                  <summary className="cursor-pointer font-medium">Perplexity Response</summary>
                  <pre className="text-xs bg-card p-2 rounded border border-border overflow-auto max-h-64">
                    {JSON.stringify(result.debug.perplexityResponse, null, 2)}
                  </pre>
                </details>
              )}
              {result.debug.googleResponse && (
                <details className="space-y-2">
                  <summary className="cursor-pointer font-medium">Google Response</summary>
                  <pre className="text-xs bg-card p-2 rounded border border-border overflow-auto max-h-64">
                    {JSON.stringify(result.debug.googleResponse, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </section>
        )}
      </main>

      <aside className="space-y-6" role="complementary" aria-label="Verdict and analysis details">
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="text-center space-y-4">
            <div className="scale-125">
              <VerdictBadge verdict={result.verdict?.label || "Unclear"} />
            </div>
            <div className="space-y-2 w-full">
              <ShareButton slug={result.slug} query={query} verdict={result.verdict} />
              <ExportDropdown result={result} query={query} />
            </div>
            {result.cached && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-muted hover:bg-muted/80 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            )}
          </div>
        </div>

        <div className="hidden lg:block">
          <InfoBox result={result} />
        </div>

        <div className="hidden lg:block">
          <VideoEmbed sources={result.sources || []} />
        </div>
      </aside>
    </div>
  )
}
