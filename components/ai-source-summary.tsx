"use client"

import { useState } from 'react'
import { ChevronDown, ChevronUp, Lightbulb, Quote, Brain, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CredibilityBadge } from '@/components/ui/credibility-badge'
import type { SourceSummary } from '@/lib/source-summarization'

interface AiSourceSummaryProps {
  source: any
  showExpanded?: boolean
  showEnhancementType?: boolean
  className?: string
}

export function AiSourceSummary({ source, showExpanded = false, showEnhancementType = false, className = "" }: AiSourceSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(showExpanded)
  const aiSummary: SourceSummary | undefined = source.aiSummary

  if (!aiSummary) {
    return null
  }

  const getPerspectiveColor = (perspective: string) => {
    switch (perspective) {
      case 'supports': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'contradicts': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      case 'mixed': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const getRelevanceIcon = (relevance: string) => {
    switch (relevance) {
      case 'high': return '🎯'
      case 'medium': return '📍'
      case 'low': return '📌'
      default: return '📄'
    }
  }

  return (
    <div className={`border rounded-lg p-4 space-y-3 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 ${className}`}>
      {/* Header with AI indicator */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Brain className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
              AI Analysis
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {getRelevanceIcon(aiSummary.relevance)} {aiSummary.relevance.charAt(0).toUpperCase() + aiSummary.relevance.slice(1)} relevance
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline"
            className={`text-xs ${getPerspectiveColor(aiSummary.perspective)}`}
          >
            {aiSummary.perspective}
          </Badge>
          
          {aiSummary.processingStatus === 'failed' && (
            <AlertCircle className="w-4 h-4 text-amber-500" />
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-2">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {aiSummary.summary}
        </p>
        
        {/* Confidence indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>AI Confidence: {Math.round(aiSummary.confidence * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Expandable detailed analysis */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8">
            <span>Detailed Analysis</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-3 pt-2">
          {/* Key Insights */}
          {aiSummary.keyInsights && aiSummary.keyInsights.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200">Key Insights</h5>
              </div>
              <ul className="space-y-1 ml-6">
                {aiSummary.keyInsights.map((insight, index) => (
                  <li key={index} className="text-sm text-gray-600 dark:text-gray-400 list-disc">
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Extracted Quotes */}
          {aiSummary.extractedQuotes && aiSummary.extractedQuotes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Quote className="w-4 h-4 text-indigo-500" />
                <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200">Key Quotes</h5>
              </div>
              <div className="space-y-2 ml-6">
                {aiSummary.extractedQuotes.map((quote, index) => (
                  <blockquote key={index} className="text-sm text-gray-600 dark:text-gray-400 italic border-l-2 border-indigo-200 dark:border-indigo-700 pl-3">
                    "{quote}"
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          {/* Credibility Context */}
          {aiSummary.credibilityContext && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <CredibilityBadge 
                  sourceUrl={source.url}
                  sourceTitle={source.title}
                  size="sm"
                  showScore={false}
                />
                Source Context
              </h5>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed ml-6">
                {aiSummary.credibilityContext}
              </p>
            </div>
          )}

          {/* Error message if processing failed */}
          {aiSummary.processingStatus === 'failed' && aiSummary.errorMessage && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Processing Note</span>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                AI summarization partially failed: {aiSummary.errorMessage}
              </p>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/**
 * Compact version for use in source lists
 */
export function AiSourceSummaryCompact({ source, className = "" }: AiSourceSummaryProps) {
  const aiSummary: SourceSummary | undefined = source.aiSummary

  if (!aiSummary) {
    return null
  }

  const getPerspectiveEmoji = (perspective: string) => {
    switch (perspective) {
      case 'supports': return '✅'
      case 'contradicts': return '❌'
      case 'mixed': return '⚖️'
      default: return '📄'
    }
  }

  return (
    <div className={`text-xs text-gray-600 dark:text-gray-400 space-y-1 ${className}`}>
      <div className="flex items-center gap-2">
        <Brain className="w-3 h-3 text-blue-500" />
        <span className="flex items-center gap-1">
          {getPerspectiveEmoji(aiSummary.perspective)}
          <span className="capitalize">{aiSummary.perspective}</span>
        </span>
        <span className="text-gray-400">•</span>
        <span>{Math.round(aiSummary.confidence * 100)}% confidence</span>
      </div>
      <p className="leading-tight line-clamp-2">
        {aiSummary.summary}
      </p>
    </div>
  )
}

/**
 * Statistics summary for a collection of AI-analyzed sources
 */
interface AiSummaryStatsProps {
  sources: any[]
  className?: string
}

export function AiSummaryStats({ sources, className = "" }: AiSummaryStatsProps) {
  const sourcesWithAI = sources.filter(s => s.aiSummary)
  
  if (sourcesWithAI.length === 0) {
    return null
  }

  const stats = {
    total: sources.length,
    analyzed: sourcesWithAI.length,
    supports: sourcesWithAI.filter(s => s.aiSummary?.perspective === 'supports').length,
    contradicts: sourcesWithAI.filter(s => s.aiSummary?.perspective === 'contradicts').length,
    mixed: sourcesWithAI.filter(s => s.aiSummary?.perspective === 'mixed').length,
    neutral: sourcesWithAI.filter(s => s.aiSummary?.perspective === 'neutral').length,
    avgConfidence: sourcesWithAI.reduce((sum, s) => sum + (s.aiSummary?.confidence || 0), 0) / sourcesWithAI.length
  }

  return (
    <div className={`bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          AI Analysis Summary
        </h4>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="text-gray-600 dark:text-gray-400">
          <span className="font-medium">{stats.analyzed}</span> of <span className="font-medium">{stats.total}</span> sources analyzed
        </div>
        <div className="text-gray-600 dark:text-gray-400">
          <span className="font-medium">{Math.round(stats.avgConfidence * 100)}%</span> avg confidence
        </div>
      </div>
      
      <div className="flex gap-2 text-xs">
        <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
          ✅ {stats.supports} Support
        </Badge>
        <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
          ❌ {stats.contradicts} Contradict
        </Badge>
        {stats.mixed > 0 && (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
            ⚖️ {stats.mixed} Mixed
          </Badge>
        )}
        {stats.neutral > 0 && (
          <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
            📄 {stats.neutral} Neutral
          </Badge>
        )}
      </div>
    </div>
  )
}