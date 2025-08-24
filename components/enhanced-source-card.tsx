"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CredibilityBadge, detectSourceType, type SourceType } from "@/components/ui/credibility-badge"
import { ExternalLink, Calendar, User, Quote, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { AiSourceSummary, AiSourceSummaryCompact } from "@/components/ai-source-summary"

export interface EnhancedSource {
  url: string
  title: string
  excerpt?: string
  author?: string
  publishedDate?: string
  domain: string
  credibilityScore?: number
  sourceType?: SourceType
  citationCount?: number
  relevanceScore?: number
  tags?: string[]
  fullText?: string
  isExpanded?: boolean
}

interface EnhancedSourceCardProps {
  source: EnhancedSource
  showFullDetails?: boolean
  onExpand?: (expanded: boolean) => void
  className?: string
  size?: 'compact' | 'default' | 'detailed'
  onClick?: () => void
}

export function EnhancedSourceCard({ 
  source, 
  showFullDetails = false,
  onExpand,
  className,
  size = 'default',
  onClick
}: EnhancedSourceCardProps) {
  const [isExpanded, setIsExpanded] = useState(source.isExpanded || false)
  
  // Auto-detect source type if not provided
  const sourceType = source.sourceType || detectSourceType(source.url, source.title)
  
  // Handle expand/collapse
  const handleExpand = () => {
    const newExpanded = !isExpanded
    setIsExpanded(newExpanded)
    onExpand?.(newExpanded)
  }

  // Format published date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  // Truncate text for compact display
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength).trim() + '...'
  }

  const sizeClasses = {
    compact: 'p-3',
    default: 'p-4',
    detailed: 'p-6'
  }

  const textSizes = {
    compact: {
      title: 'text-sm',
      excerpt: 'text-xs',
      meta: 'text-xs'
    },
    default: {
      title: 'text-base',
      excerpt: 'text-sm',
      meta: 'text-xs'
    },
    detailed: {
      title: 'text-lg',
      excerpt: 'text-base',
      meta: 'text-sm'
    }
  }

  return (
    <Card 
      className={cn(
        "group hover:shadow-lg transition-all duration-200 border-l-4",
        sourceType === 'government' ? 'border-l-blue-500' :
        sourceType === 'academic' ? 'border-l-purple-500' :
        sourceType === 'factcheck' ? 'border-l-green-500' :
        sourceType === 'news' ? 'border-l-orange-500' : 'border-l-gray-500',
        onClick ? 'cursor-pointer' : '',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className={cn("pb-2", sizeClasses[size])}>
        {/* Header with credibility badge and metadata */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3 className={cn(
              "font-semibold text-foreground leading-tight mb-2 group-hover:text-primary transition-colors",
              textSizes[size].title
            )}>
              <a 
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {source.title}
              </a>
            </h3>
            
            {/* Domain and metadata row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "text-muted-foreground font-medium",
                textSizes[size].meta
              )}>
                {source.domain}
              </span>
              
              {source.publishedDate && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className={cn("text-muted-foreground", textSizes[size].meta)}>
                      {formatDate(source.publishedDate)}
                    </span>
                  </div>
                </>
              )}
              
              {source.author && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className={cn("text-muted-foreground", textSizes[size].meta)}>
                      {source.author}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Credibility Badge */}
          <div className="flex-shrink-0">
            <CredibilityBadge 
              sourceType={sourceType}
              credibilityScore={source.credibilityScore}
              size={size === 'compact' ? 'sm' : size === 'detailed' ? 'lg' : 'md'}
              showStars={size !== 'compact'}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn("pt-0", sizeClasses[size])}>
        {/* Excerpt/Preview */}
        {source.excerpt && (
          <div className="mb-3">
            <div className="flex items-start gap-2">
              <Quote className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className={cn(
                "text-muted-foreground leading-relaxed",
                textSizes[size].excerpt
              )}>
                {isExpanded ? source.excerpt : truncateText(source.excerpt, size === 'compact' ? 100 : 200)}
              </p>
            </div>
          </div>
        )}

        {/* Additional metadata */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Citation count */}
            {source.citationCount !== undefined && (
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-muted-foreground" />
                <span className={cn("text-muted-foreground", textSizes[size].meta)}>
                  {source.citationCount} citations
                </span>
              </div>
            )}

            {/* Relevance score */}
            {source.relevanceScore !== undefined && (
              <Badge variant="outline" className={cn(
                size === 'compact' ? 'text-xs px-1.5 py-0.5' : 'text-xs'
              )}>
                {Math.round(source.relevanceScore)}% relevant
              </Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Expand/Collapse button */}
            {(source.fullText || source.excerpt) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExpand}
                className="h-8 px-2 text-xs"
              >
                {isExpanded ? 'Show less' : 'Read more'}
              </Button>
            )}

            {/* External link */}
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 w-8 p-0"
            >
              <a 
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open source"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>

        {/* Tags */}
        {source.tags && source.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {source.tags.slice(0, isExpanded ? source.tags.length : 3).map((tag, i) => (
              <Badge 
                key={i} 
                variant="secondary" 
                className={cn(
                  "text-xs",
                  size === 'compact' ? 'px-1.5 py-0.5' : 'px-2 py-1'
                )}
              >
                {tag}
              </Badge>
            ))}
            {!isExpanded && source.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{source.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Expanded content */}
        {isExpanded && source.fullText && source.fullText !== source.excerpt && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="flex items-start gap-2">
              <Quote className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground text-sm leading-relaxed">
                {source.fullText}
              </p>
            </div>
          </div>
        )}

        {/* AI Summary */}
        {(source as any).aiSummary && (
          <div className="mt-4 pt-4 border-t border-border/50">
            {size === 'compact' ? (
              <AiSourceSummaryCompact source={source} />
            ) : (
              <AiSourceSummary source={source} showExpanded={isExpanded} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Utility function to convert basic source objects to EnhancedSource format
export function enhanceSource(basicSource: any): EnhancedSource {
  return {
    url: basicSource.url || basicSource.link || '',
    title: basicSource.title || basicSource.name || 'Untitled Source',
    excerpt: basicSource.excerpt || basicSource.summary || basicSource.description,
    author: basicSource.author || basicSource.publisher,
    publishedDate: basicSource.publishedDate || basicSource.date || basicSource.published_at,
    domain: basicSource.domain || (basicSource.url ? new URL(basicSource.url).hostname : 'Unknown'),
    credibilityScore: basicSource.credibilityScore || basicSource.score,
    sourceType: basicSource.sourceType,
    citationCount: basicSource.citationCount || basicSource.citations,
    relevanceScore: basicSource.relevanceScore || basicSource.relevance,
    tags: basicSource.tags || [],
    fullText: basicSource.fullText || basicSource.content
  }
}