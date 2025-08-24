"use client"

import { useState } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Loader2, Sparkles, Zap } from 'lucide-react'
import { AiSourceSummary } from './ai-source-summary'

interface AiSourceEnhancerProps {
  source: any
  claim: string
  onEnhanced?: (source: any, aiSummary: any) => void
}

export function AiSourceEnhancer({ source, claim, onEnhanced }: AiSourceEnhancerProps) {
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [aiSummary, setAiSummary] = useState(source.aiSummary || null)
  const [error, setError] = useState<string | null>(null)
  
  const hasPerplexitySummary = source.metadata?.enhancementType === 'perplexity'
  const hasAiSummary = aiSummary?.enhancementType === 'openai'

  const enhanceWithAI = async () => {
    if (isEnhancing || hasAiSummary) return
    
    setIsEnhancing(true)
    setError(null)
    
    try {
      const response = await fetch('/api/enhance-source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source,
          claim
        })
      })
      
      if (!response.ok) {
        if (response.status === 408) {
          throw new Error('AI enhancement timed out. Please try again.')
        }
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to enhance source')
      }
      
      const data = await response.json()
      
      if (data.success && data.aiSummary) {
        setAiSummary(data.aiSummary)
        onEnhanced?.(source, data.aiSummary)
      } else {
        throw new Error('Invalid response from enhancement service')
      }
      
    } catch (error) {
      console.error('AI enhancement failed:', error)
      setError(error instanceof Error ? error.message : 'Enhancement failed')
    } finally {
      setIsEnhancing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Enhancement Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasPerplexitySummary && (
            <Badge variant="secondary" className="text-xs">
              <Zap className="w-3 h-3 mr-1" />
              Instant Summary
            </Badge>
          )}
          {hasAiSummary && (
            <Badge variant="default" className="text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              AI Enhanced
            </Badge>
          )}
        </div>
        
        {/* Enhancement Button */}
        {!hasAiSummary && (
          <Button
            onClick={enhanceWithAI}
            disabled={isEnhancing}
            size="sm"
            variant="outline"
            className="text-xs"
          >
            {isEnhancing ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Enhancing...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 mr-1" />
                Enhance with AI
              </>
            )}
          </Button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          {error}
          <Button
            onClick={() => setError(null)}
            size="sm"
            variant="ghost"
            className="ml-2 h-auto p-0 text-red-600 hover:text-red-800"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Summary Display */}
      {aiSummary ? (
        <AiSourceSummary 
          source={{ ...source, aiSummary }} 
          showExpanded={true}
          showEnhancementType={true}
        />
      ) : source.aiSummary ? (
        <AiSourceSummary 
          source={source} 
          showExpanded={true}
          showEnhancementType={true}
        />
      ) : (
        <div className="text-sm text-muted-foreground italic p-3 bg-muted/30 rounded-lg">
          Click "Enhance with AI" to generate a detailed analysis of how this source relates to the claim.
        </div>
      )}
    </div>
  )
}

interface BatchAiEnhancerProps {
  sources: any[]
  claim: string
  onBatchEnhanced?: (enhancedSources: any[]) => void
}

export function BatchAiEnhancer({ sources, claim, onBatchEnhanced }: BatchAiEnhancerProps) {
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  const sourcesWithoutAI = sources.filter(s => s.metadata?.enhancementType !== 'openai')
  const canEnhance = sourcesWithoutAI.length > 0

  const enhanceAllSources = async () => {
    if (isEnhancing || !canEnhance) return
    
    setIsEnhancing(true)
    setError(null)
    setProgress(0)
    
    try {
      // Limit to first 10 sources for batch enhancement
      const sourcesToEnhance = sourcesWithoutAI.slice(0, 10)
      
      const response = await fetch('/api/enhance-source', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sources: sourcesToEnhance,
          claim,
          maxSources: 10
        })
      })
      
      if (!response.ok) {
        if (response.status === 408) {
          throw new Error('Batch AI enhancement timed out. Try enhancing individual sources instead.')
        }
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to enhance sources')
      }
      
      const data = await response.json()
      
      if (data.success && data.enhancedSources) {
        // Update sources with AI summaries
        const updatedSources = sources.map(source => {
          const enhanced = data.enhancedSources.find((e: any) => e.sourceUrl === source.url)
          if (enhanced) {
            return {
              ...source,
              aiSummary: enhanced,
              metadata: {
                ...source.metadata,
                enhancementType: 'openai',
                hasAISummary: true
              }
            }
          }
          return source
        })
        
        onBatchEnhanced?.(updatedSources)
        setProgress(100)
      } else {
        throw new Error('Invalid response from batch enhancement service')
      }
      
    } catch (error) {
      console.error('Batch AI enhancement failed:', error)
      setError(error instanceof Error ? error.message : 'Batch enhancement failed')
    } finally {
      setIsEnhancing(false)
    }
  }

  if (!canEnhance) {
    return null
  }

  return (
    <div className="mb-6 p-4 bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-sm">AI Enhancement Available</h3>
          <p className="text-xs text-muted-foreground">
            Enhance {sourcesWithoutAI.length} sources with detailed AI analysis
          </p>
        </div>
        
        <Button
          onClick={enhanceAllSources}
          disabled={isEnhancing}
          size="sm"
          className="shrink-0"
        >
          {isEnhancing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enhancing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Enhance All ({sourcesWithoutAI.length})
            </>
          )}
        </Button>
      </div>
      
      {isEnhancing && (
        <div className="mt-3">
          <div className="text-xs text-muted-foreground mb-1">
            Processing sources with AI analysis...
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div 
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  )
}