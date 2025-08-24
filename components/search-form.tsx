"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/progress-bar"

interface SearchFormProps {
  compact?: boolean
  initialQuery?: string | null
}

export function SearchForm({ compact = false, initialQuery }: SearchFormProps) {
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const router = useRouter()

  // Set initial query from prop (for compact mode)
  useEffect(() => {
    if (compact && initialQuery) {
      setQuery(initialQuery)
    }
  }, [compact, initialQuery])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.log("[v0] Frontend generated sessionId:", newSessionId)
    setSessionId(newSessionId)

    try {
      console.log("[v0] Starting fact-check request for:", query.trim())

      // Start the fact-check process and wait for the session confirmation
      const response = await fetch("/api/fact-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: query.trim(), sessionId: newSessionId }),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      // The fact-check process is now running in the background
      // Progress tracking will handle the completion and navigation
      console.log("[v0] Fact-check process started, showing progress...")
      
    } catch (error) {
      console.error("[v0] Search error details:", {
        error: error,
        message: error instanceof Error ? error.message : "Unknown error",
        query: query.trim(),
        sessionId: newSessionId,
      })
      setIsLoading(false)
      setSessionId(null)

      alert(`Search failed: ${error instanceof Error ? error.message : "Unknown error occurred"}`)
    }
  }

  const handleProgressComplete = async (data: any) => {
    console.log("[v0] Progress complete!")
    console.log("[v0] Progress completion data:", data)
    
    try {
      // Reset loading state first
      setIsLoading(false)
      setSessionId(null)
      
      // Navigate to results page with query parameter to show results inline
      router.push(`/?query=${encodeURIComponent(query.trim())}&results=true&nextra=true&sessionId=${sessionId}`)
      
      // Trigger navigation event for URL change detection
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('navigationComplete'))
        
        // Scroll to results after navigation is processed
        setTimeout(() => {
          const resultsElement = document.querySelector('[data-results-section]')
          if (resultsElement) {
            resultsElement.scrollIntoView({ behavior: 'smooth' })
          }
        }, 200)
      }, 100)
    } catch (error) {
      console.error("[v0] Error in progress completion:", error)
      setIsLoading(false)
      setSessionId(null)
    }
  }

  const handleProgressError = (error: string) => {
    console.error("Progress error:", error)
    setIsLoading(false)
    setSessionId(null)
  }

  if (compact) {
    return (
      <div className="space-y-2 w-full">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full" role="search" aria-label="Fact-check search">
          <div className="flex-1 relative">
            <label htmlFor="fact-check-query-compact" className="sr-only">
              Enter a claim to fact-check
            </label>
            <input
              id="fact-check-query-compact"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter a claim to fact-check..."
              className="w-full px-4 py-2 pr-8 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              disabled={isLoading}
              aria-required="true"
              autoComplete="off"
              onFocus={(e) => e.target.select()} // Select all text when focused for easy replacement
            />
            {/* Clear button */}
            {query && !isLoading && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <Button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            {isLoading ? "..." : "Search"}
          </Button>
        </form>
        
        {/* Progress bar for compact form */}
        {isLoading && sessionId && (
          <div className="w-full">
            <ProgressBar sessionId={sessionId} onComplete={handleProgressComplete} onError={handleProgressError} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4" role="search" aria-label="Fact-check search">
        <div className="relative">
          <label htmlFor="fact-check-query" className="sr-only">
            Enter a claim to fact-check
          </label>
          <input
            id="fact-check-query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a claim to fact-check..."
            className="w-full px-6 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            disabled={isLoading}
            aria-describedby="search-help"
            aria-required="true"
            autoComplete="off"
          />
          <div id="search-help" className="sr-only">
            Enter any claim or statement you want to fact-check. Press Enter or click Search to begin.
          </div>
        </div>
        <Button
          type="submit"
          disabled={!query.trim() || isLoading}
          className="w-full py-4 text-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          aria-describedby={isLoading ? "loading-status" : undefined}
        >
          {isLoading ? "Analyzing..." : "Search"}
        </Button>
        {isLoading && (
          <div id="loading-status" className="sr-only" aria-live="polite">
            Searching for fact-check information
          </div>
        )}
      </form>

      {isLoading && sessionId && (
        <ProgressBar sessionId={sessionId} onComplete={handleProgressComplete} onError={handleProgressError} />
      )}
    </div>
  )
}
