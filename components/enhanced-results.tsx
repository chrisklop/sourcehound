"use client"

import { useState, useEffect } from "react"
import { ResultsContent } from "@/components/results-content"
import { ExecutiveSummary } from "@/components/executive-summary"
import { ResultsTabs } from "@/components/results-tabs"
import { SourceFilters } from "@/components/source-filters"
import { EnhancedSearch } from "@/components/enhanced-search"
import { InteractiveCharts } from "@/components/interactive-charts"
import { VirtualizedSourceList } from "@/components/virtualized-source-list"
import { NextraResults } from "@/components/nextra-results"
import { AiSummaryStats } from "@/components/ai-source-summary"

interface EnhancedResultsProps {
  query?: string
  showProgress?: boolean
  useCards?: boolean
  useNextra?: boolean
  useInteractive?: boolean
  debugMode?: boolean
  forceRefresh?: boolean
}

interface FactCheckResult {
  verdict?: { label: string; confidence: number; summary?: string }
  sources?: any[]
  factCheckReviews?: any[]
  keyPoints?: any[]
  explanation?: string
  debug?: { processingTime?: number }
  errors?: { perplexity?: boolean }
}

export function EnhancedResults({ 
  query, 
  showProgress = true, 
  useCards = false,
  useNextra = false,
  useInteractive = false,
  debugMode = false,
  forceRefresh = false 
}: EnhancedResultsProps) {
  const [mounted, setMounted] = useState(false)
  const [factCheckData, setFactCheckData] = useState<FactCheckResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Citation handler for tab navigation
  const handleTabChange = (tab: string) => {
    console.log('[Enhanced] Citation tab change:', tab)
    setActiveTab(tab)
  }
  
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch fact-check data when useCards or useNextra is enabled and we have a query
  useEffect(() => {
    if (!mounted || (!useCards && !useNextra) || !query) return

    const fetchFactCheckData = async () => {
      try {
        setLoading(true)
        console.log("[Enhanced] Fetching fact-check data for query:", query)
        
        // Try to fetch existing result first
        const response = await fetch(`/api/fact-check?query=${encodeURIComponent(query)}`)
        
        if (response.ok) {
          const data = await response.json()
          console.log("[Enhanced] Received fact-check data:", data)
          console.log("[Enhanced] Sources count:", data?.sources?.length || 0)
          console.log("[Enhanced] First source:", data?.sources?.[0])
          setFactCheckData(data)
        } else {
          console.log("[Enhanced] No existing fact-check data found, status:", response.status)
          // Could trigger a new fact-check here if needed
        }
      } catch (error) {
        console.error("[Enhanced] Error fetching fact-check data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchFactCheckData()
  }, [mounted, useCards, useNextra, query])

  // For SSR safety, render skeleton until mounted
  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    )
  }

  // If useNextra is enabled, render Nextra documentation layout
  if (useNextra) {
    return (
      <NextraResults 
        factCheckData={factCheckData}
        query={query || ''}
      />
    )
  }

  // If useCards is enabled, render enhanced Phase 2 layout
  if (useCards) {
    // Show loading state while fetching data
    if (loading) {
      return (
        <div className="space-y-6">
          <div className="h-32 bg-muted rounded-lg animate-pulse" />
          <div className="h-64 bg-muted rounded-lg animate-pulse" />
          <div className="text-center text-muted-foreground">
            Loading enhanced results...
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Executive Summary Card */}
        <ExecutiveSummary 
          factCheckData={factCheckData}
          onTabChange={handleTabChange}
        />
        
        {/* Interactive Features (when enabled) */}
        {useInteractive && factCheckData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Enhanced Search */}
            <EnhancedSearch 
              factCheckData={factCheckData}
              className="lg:col-span-1"
            />
            
            {/* Source Filters */}
            <SourceFilters 
              sources={factCheckData.sources || []}
              onFiltersChange={(filters) => {
                console.log('[Enhanced] Filters changed:', filters)
              }}
              className="lg:col-span-1"
            />
            
            {/* Interactive Charts */}
            <InteractiveCharts 
              data={{ 
                sources: factCheckData.sources || [],
                factCheckData 
              }}
              className="lg:col-span-2"
            />
            
            {/* AI Summary Statistics */}
            <AiSummaryStats 
              sources={factCheckData.sources || []}
              className="lg:col-span-2"
            />
            
            {/* Virtualized Source List */}
            <VirtualizedSourceList 
              sources={factCheckData.sources || []}
              containerHeight={400}
              onSourceClick={(source, index) => {
                console.log('[Enhanced] Source clicked:', source, index)
              }}
              className="lg:col-span-2"
            />
          </div>
        )}
        
        {/* Tabbed Results Interface */}
        <ResultsTabs 
          factCheckData={factCheckData}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        >
          {/* Tab content will be rendered here */}
          <div className="p-4 text-muted-foreground">
            Enhanced tabbed content coming soon...
          </div>
        </ResultsTabs>
      </div>
    )
  }

  // Default to original results layout
  return (
    <ResultsContent 
      query={query} 
      showProgress={showProgress}
      debugMode={debugMode}
      forceRefresh={forceRefresh}
    />
  )
}