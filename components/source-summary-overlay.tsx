"use client"

import { useState, useEffect } from 'react'
import { X, ExternalLink, Sparkles } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { TrackedExternalLink } from './tracked-external-link'

interface SourceSummaryOverlayProps {
  source: any
  isOpen: boolean
  onClose: () => void
  factCheckQuery?: string
}

export function SourceSummaryOverlay({ source, isOpen, onClose, factCheckQuery }: SourceSummaryOverlayProps) {
  const [summary, setSummary] = useState<string>('')

  useEffect(() => {
    if (isOpen && source) {
      generateQuickSummary(source)
    }
  }, [isOpen, source])

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden' // Prevent background scroll
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  const generateQuickSummary = (source: any) => {
    // Create a 3-paragraph summary from available source data
    const title = source.title || 'Untitled Source'
    const publisher = source.publisher || 'Unknown Publisher'
    const url = source.url || ''
    const domain = new URL(url).hostname.replace('www.', '') || 'unknown domain'
    
    // Get existing content
    const existingContent = source.metadata?.snippet || 
                           source.metadata?.fullAbstract || 
                           source.excerpt || 
                           source.description || 
                           'No content summary available.'

    // Get AI summary if available
    const aiSummary = source.aiSummary?.summary || ''
    const relevance = source.aiSummary?.relevance || 'medium'
    const perspective = source.aiSummary?.perspective || 'neutral'

    // Generate 3-paragraph summary
    let paragraph1 = `This source from ${publisher} (${domain}) provides ${relevance} relevance information with a ${perspective} perspective on the topic.`
    
    let paragraph2 = ''
    if (existingContent && existingContent !== 'No content summary available.') {
      const truncatedContent = existingContent.length > 300 ? 
        existingContent.substring(0, 300) + '...' : 
        existingContent
      paragraph2 = `Content Summary: ${truncatedContent}`
    } else {
      paragraph2 = `This ${getSourceTypeDescription(source)} source contains information relevant to the fact-check analysis. The source has been evaluated for credibility and relevance to provide context for the verification process.`
    }

    let paragraph3 = ''
    if (aiSummary) {
      paragraph3 = `AI Analysis: ${aiSummary.length > 200 ? aiSummary.substring(0, 200) + '...' : aiSummary}`
    } else {
      paragraph3 = `For detailed verification and complete source analysis, you can visit the original source directly. This source contributes to the overall fact-check assessment and provides supporting evidence for the analysis.`
    }

    const fullSummary = `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`
    setSummary(fullSummary)
  }

  const getSourceTypeDescription = (source: any) => {
    const type = source.type || 'web'
    switch (type) {
      case 'academic': return 'academic research'
      case 'government': return 'government'
      case 'news': return 'news'
      case 'factcheck': return 'fact-checking'
      default: return 'web'
    }
  }

  const getCredibilityColor = (source: any) => {
    const score = source.quality?.score || 50
    if (score >= 90) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    if (score >= 70) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    if (score >= 50) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Source Summary</span>
              <Badge className={getCredibilityColor(source)}>
                {source.quality?.score || 50}/100
              </Badge>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
              {source.title || 'Source Summary'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {source.publisher || 'Unknown Publisher'}
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="shrink-0 h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="prose prose-gray dark:prose-invert max-w-none">
            {summary.split('\n\n').map((paragraph, index) => (
              <p key={index} className="mb-4 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Click outside to close or press ESC
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
            
            <TrackedExternalLink
              href={source.url}
              sourceType={source.type}
              sourceRank={source.rank}
              factCheckQuery={factCheckQuery}
              pageSection="source-summary"
              customUTM={{
                utm_campaign: 'source-summary',
                utm_content: 'summary-overlay'
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/80 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Visit Source
            </TrackedExternalLink>
          </div>
        </div>
      </div>
    </div>
  )
}