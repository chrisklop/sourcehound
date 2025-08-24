"use client"

import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { TrackedExternalLink } from './tracked-external-link'

interface IntelligentSource {
  title: string
  url: string
  abstract?: string
  authors?: string[]
  publishedAt?: string
  publisher?: string
  type: string
  credibilityScore?: number
  rank: number
  domainRelevance: boolean
  metadata?: {
    sourceQuality?: string
    icon?: string
    badge?: string
    [key: string]: any
  }
}

interface SourceBreakdown {
  [type: string]: number
}

interface IntelligentSourceDisplayProps {
  sources: IntelligentSource[]
  sourceBreakdown: SourceBreakdown
  context: {
    domain: string
    confidence: number
    description: string
    keywords: string[]
  }
  searchSummary: string
  className?: string
}

export function IntelligentSourceDisplay({ 
  sources, 
  sourceBreakdown, 
  context, 
  searchSummary,
  className = "" 
}: IntelligentSourceDisplayProps) {
  
  if (sources.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center text-muted-foreground">
          No sources found through intelligent routing
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Domain Context Summary */}
      <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950">
        <CardHeader className="pb-3">
          <CardTitle className="text-emerald-800 dark:text-emerald-200">
            🧠 Intelligent Source Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-emerald-700 dark:text-emerald-300">Domain:</span>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200">
                {context.description}
              </Badge>
              <span className="text-muted-foreground">
                ({(context.confidence * 100).toFixed(1)}% confidence)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-emerald-700 dark:text-emerald-300">Keywords:</span>
              <div className="flex gap-1 flex-wrap">
                {context.keywords.map((keyword, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
            <p className="text-emerald-700 dark:text-emerald-300 mt-2">
              {searchSummary}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Source Type Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Source Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(sourceBreakdown).map(([type, count]) => (
              <div key={type} className="text-center">
                <div className="text-2xl font-bold text-primary">{count}</div>
                <div className="text-sm text-muted-foreground capitalize">
                  {type.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Source List */}
      <div className="space-y-4">
        {sources.map((source, index) => (
          <Card 
            key={index}
            className={`hover:shadow-lg transition-all duration-200 ${
              source.domainRelevance ? 'ring-1 ring-emerald-200 dark:ring-emerald-800' : ''
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      #{source.rank}
                    </span>
                    
                    {/* Source Type Badge with Icon */}
                    {source.metadata?.badge && (
                      <Badge 
                        variant="outline" 
                        className="text-xs"
                      >
                        {source.metadata.icon} {source.metadata.badge}
                      </Badge>
                    )}
                    
                    {/* Credibility Score */}
                    {source.credibilityScore && (
                      <Badge 
                        variant={source.credibilityScore >= 90 ? 'default' : source.credibilityScore >= 70 ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {source.credibilityScore}/100
                      </Badge>
                    )}
                    
                    {/* Domain Relevance Indicator */}
                    {source.domainRelevance && (
                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300">
                        🎯 Domain Match
                      </Badge>
                    )}
                  </div>
                  
                  <CardTitle className="text-lg">
                    <TrackedExternalLink
                      href={source.url}
                      sourceType={source.type}
                      sourceRank={source.rank}
                      factCheckQuery={context.description}
                      pageSection="intelligent-sources"
                      className="text-primary hover:text-primary/80 hover:underline"
                    >
                      {source.title}
                    </TrackedExternalLink>
                  </CardTitle>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-muted-foreground">
                      {source.publisher}
                    </p>
                    {source.publishedAt && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <p className="text-sm text-muted-foreground">
                          {new Date(source.publishedAt).toLocaleDateString()}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {/* Abstract */}
              {source.abstract && (
                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                  {source.abstract}
                </p>
              )}
              
              {/* Authors */}
              {source.authors && source.authors.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Authors:</span>
                  <div className="flex gap-1 flex-wrap">
                    {source.authors.map((author, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {author}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Source Quality Indicator */}
              {source.metadata?.sourceQuality && (
                <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                  ℹ️ {source.metadata.sourceQuality}
                </div>
              )}
              
              {/* Additional Metadata */}
              {source.metadata && Object.keys(source.metadata).length > 3 && (
                <details className="mt-3">
                  <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                    Show Additional Details
                  </summary>
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    {Object.entries(source.metadata).map(([key, value]) => {
                      if (['sourceQuality', 'icon', 'badge'].includes(key)) return null
                      if (typeof value === 'object') return null
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                          <span>{String(value)}</span>
                        </div>
                      )
                    })}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * Quick stats component for intelligent source summary
 */
export function IntelligentSourceStats({ 
  sources, 
  context 
}: { 
  sources: IntelligentSource[], 
  context: { domain: string, confidence: number } 
}) {
  const averageCredibility = sources.length > 0 
    ? sources.reduce((sum, s) => sum + (s.credibilityScore || 70), 0) / sources.length 
    : 0
    
  const domainMatches = sources.filter(s => s.domainRelevance).length
  const highCredibility = sources.filter(s => (s.credibilityScore || 70) >= 85).length
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
      <div className="text-center">
        <div className="text-2xl font-bold text-emerald-600">{sources.length}</div>
        <div className="text-sm text-muted-foreground">Total Sources</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600">{domainMatches}</div>
        <div className="text-sm text-muted-foreground">Domain Matches</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-600">{highCredibility}</div>
        <div className="text-sm text-muted-foreground">High Credibility</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-orange-600">{averageCredibility.toFixed(0)}</div>
        <div className="text-sm text-muted-foreground">Avg Score</div>
      </div>
    </div>
  )
}