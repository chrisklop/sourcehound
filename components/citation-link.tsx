"use client"

import { useState } from 'react'
import { CredibilityBadge } from './ui/credibility-badge'

interface CitationLinkProps {
  citationNumber: number
  source: any
  onTabChange?: (tab: string) => void
  children: React.ReactNode
}

export function CitationLink({ citationNumber, source, onTabChange, children }: CitationLinkProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    
    if (onTabChange) {
      // Switch to sources tab and scroll to the specific source
      onTabChange('sources')
      
      // Small delay to allow tab to switch, then scroll to source
      setTimeout(() => {
        // Try multiple possible source element IDs
        const possibleIds = [
          `source-${citationNumber}`,
          `source-${source.rank || citationNumber}`, 
          `source-${citationNumber - 1}` // Zero-indexed fallback
        ]
        
        let sourceElement = null
        for (const id of possibleIds) {
          sourceElement = document.getElementById(id)
          if (sourceElement) break
        }
        
        if (sourceElement) {
          sourceElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          })
          // Enhanced highlight effect
          sourceElement.classList.add('bg-primary/20', 'border-primary', 'border-2', 'rounded')
          setTimeout(() => {
            sourceElement.classList.remove('bg-primary/20', 'border-primary', 'border-2', 'rounded')
          }, 3000)
        } else {
          console.warn(`Could not find source element for citation ${citationNumber}`)
          // Fallback to opening the URL directly
          if (source.url) {
            window.open(source.url, '_blank', 'noopener,noreferrer')
          }
        }
      }, 150)
    } else {
      // Fallback to direct external link
      if (source.url) {
        window.open(source.url, '_blank', 'noopener,noreferrer')
      }
    }
  }

  return (
    <span className="relative">
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1 text-xs font-bold text-white bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 rounded border border-gray-600 dark:border-gray-500 hover:border-gray-500 dark:hover:border-gray-400 transition-all duration-200 cursor-pointer hover:scale-105 shadow-sm hover:shadow-md"
        title={`${source.title} - ${source.publisher || "Unknown publisher"}`}
      >
        {children}
      </button>
      
      {/* Enhanced Tooltip with Credibility Badge */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
          <div className="bg-popover text-popover-foreground px-4 py-3 rounded-lg shadow-lg border max-w-sm">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm leading-tight">{source.title}</div>
                {source.publisher && (
                  <div className="text-muted-foreground text-xs mt-1">{source.publisher}</div>
                )}
              </div>
              <div className="flex-shrink-0">
                <CredibilityBadge 
                  sourceUrl={source.url}
                  sourceTitle={source.title}
                  publishedDate={source.publishedAt || source.date}
                  useAdvancedScoring={true}
                  showScore={false}
                  showStars={true}
                  size="sm"
                />
              </div>
            </div>
            <div className="text-xs text-primary font-medium">
              {onTabChange ? '🔗 Click to view in Sources tab' : '🔗 Click to open source'}
            </div>
          </div>
        </div>
      )}
    </span>
  )
}

interface RenderCitationsProps {
  text: string
  sources: any[]
  onTabChange?: (tab: string) => void
  isFormatted?: boolean
}

export function renderTextWithClickableCitations({ text, sources, onTabChange, isFormatted }: RenderCitationsProps) {
  if (!text || !sources || !sources.length) return text
  
  // If isFormatted is true, we're dealing with HTML content, return as string
  if (isFormatted) {
    // For HTML content, we need to process citations within the HTML
    const citationRegex = /\[(\d+)\]/g
    return text.replace(citationRegex, (match, citationNumber) => {
      const num = Number.parseInt(citationNumber)
      // Find source by rank first, then by index
      let source = sources.find((s) => s.rank === num)
      if (!source && sources[num - 1]) {
        source = sources[num - 1]
      }
      
      if (source) {
        return `<span class="citation-link inline-flex items-center px-1 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors" data-citation="${num}" title="${source.title || source.url}">[${citationNumber}]</span>`
      }
      return match
    })
  }

  // Enhanced regex to match various citation formats: [1], [2], [1][2][3], etc.
  // This splits on citation patterns while preserving them
  const parts = text.split(/(\[\d+\](?:\[\d+\])*)/g)
  
  return parts.map((part, index) => {
    // Check if this part contains citations
    if (part.match(/^\[\d+\]/)) {
      // Handle multiple consecutive citations like [1][2][3]
      const citations = part.match(/\[\d+\]/g) || []
      
      return (
        <span key={`citations-${index}`} className="inline-flex gap-1">
          {citations.map((citation, citationIndex) => {
            const match = citation.match(/\[(\d+)\]/)
            if (match) {
              const citationNumber = Number.parseInt(match[1])
              // Try to find source by rank first, then by index
              let source = sources.find((s) => s.rank === citationNumber)
              if (!source && citationNumber <= sources.length) {
                source = sources[citationNumber - 1]
              }
              
              if (source) {
                return (
                  <CitationLink
                    key={`citation-${index}-${citationNumber}`}
                    citationNumber={citationNumber}
                    source={source}
                    onTabChange={onTabChange}
                  >
                    {citation}
                  </CitationLink>
                )
              }
            }
            return <span key={`invalid-citation-${citationIndex}`}>{citation}</span>
          })}
        </span>
      )
    }
    
    return <span key={`text-${index}`}>{part}</span>
  })
}