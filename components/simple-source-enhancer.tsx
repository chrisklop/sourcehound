"use client"

import { useState } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Sparkles, Eye, BookOpen } from 'lucide-react'
import { SourceSummaryOverlay } from './source-summary-overlay'

interface SimpleSourceEnhancerProps {
  source: any
  showBatchOption?: boolean
  onBatchEnhance?: () => void
  factCheckQuery?: string
}

export function SimpleSourceEnhancer({ 
  source, 
  showBatchOption = false, 
  onBatchEnhance,
  factCheckQuery 
}: SimpleSourceEnhancerProps) {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  
  const hasPerplexitySummary = source.metadata?.enhancementType === 'perplexity'
  const hasAiSummary = source.aiSummary?.enhancementType === 'openai'

  const openSummary = () => {
    setIsOverlayOpen(true)
  }

  return (
    <>
      <div className="space-y-4">
        {/* Enhancement Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasPerplexitySummary && (
              <Badge variant="secondary" className="text-xs">
                <BookOpen className="w-3 h-3 mr-1" />
                Quick Summary Available
              </Badge>
            )}
            {hasAiSummary && (
              <Badge variant="default" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Enhanced
              </Badge>
            )}
          </div>
          
          {/* View Summary Button */}
          <Button
            onClick={openSummary}
            size="sm"
            variant="outline"
            className="text-xs"
          >
            <Eye className="w-3 h-3 mr-1" />
            View Summary
          </Button>
        </div>

        {/* Basic Source Info */}
        <div className="text-sm text-muted-foreground space-y-2">
          {source.aiSummary?.summary && (
            <p className="line-clamp-2">
              {source.aiSummary.summary.substring(0, 120)}...
            </p>
          )}
          
          <div className="flex items-center gap-2 text-xs">
            {source.aiSummary?.relevance && (
              <span className="capitalize">
                Relevance: {source.aiSummary.relevance}
              </span>
            )}
            {source.aiSummary?.perspective && (
              <span className="capitalize">
                • Perspective: {source.aiSummary.perspective}
              </span>
            )}
          </div>
        </div>

        {/* Batch Enhancement Option */}
        {showBatchOption && onBatchEnhance && (
          <div className="pt-2 border-t border-border">
            <Button
              onClick={onBatchEnhance}
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Enhance All Sources
            </Button>
          </div>
        )}
      </div>

      {/* Summary Overlay */}
      <SourceSummaryOverlay
        source={source}
        isOpen={isOverlayOpen}
        onClose={() => setIsOverlayOpen(false)}
        factCheckQuery={factCheckQuery}
      />
    </>
  )
}

interface BatchSourceEnhancerProps {
  sources: any[]
  onEnhanceAll?: () => void
}

export function BatchSourceEnhancer({ sources, onEnhanceAll }: BatchSourceEnhancerProps) {
  const sourcesWithoutEnhancement = sources.filter(s => !s.aiSummary?.enhancementType)
  
  if (sourcesWithoutEnhancement.length === 0) {
    return null
  }

  return (
    <div className="mb-6 p-4 bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-sm">Quick Summaries Available</h3>
          <p className="text-xs text-muted-foreground">
            View detailed summaries for {sources.length} sources
          </p>
        </div>
        
        <Button
          onClick={onEnhanceAll}
          size="sm"
          variant="outline"
        >
          <Eye className="w-4 h-4 mr-2" />
          View All Summaries
        </Button>
      </div>
    </div>
  )
}