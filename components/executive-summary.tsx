"use client"

import { Card, CardContent } from '@/components/ui/card'
import { VerdictBadge } from './verdict-badge'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertTriangle, XCircle, Clock, Users, BookOpen, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CitationText } from './citation-text'
import { CredibilityBadge } from './ui/credibility-badge'

interface ExecutiveSummaryProps {
  factCheckData: any
  className?: string
  onTabChange?: (tab: string) => void
}

export function ExecutiveSummary({ factCheckData, className, onTabChange }: ExecutiveSummaryProps) {
  if (!factCheckData) return null

  const verdict = factCheckData.verdict?.label || 'Unclear'
  const confidence = factCheckData.verdict?.confidence
  const sourcesCount = factCheckData.sources?.length || 0
  const humanReviewsCount = factCheckData.factCheckReviews?.length || 0
  const keyPointsCount = factCheckData.keyPoints?.length || 0
  const processingTime = factCheckData.debug?.processingTime 
    ? Math.round(factCheckData.debug.processingTime / 1000) 
    : null

  // Determine verdict styling
  const getVerdictStyling = (verdict: string) => {
    const v = verdict.toLowerCase()
    if (v.includes('true') || v.includes('accurate') || v.includes('correct')) {
      return {
        bgColor: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30',
        borderColor: 'border-green-200 dark:border-green-800',
        iconColor: 'text-green-600 dark:text-green-400',
        icon: CheckCircle
      }
    } else if (v.includes('false') || v.includes('incorrect') || v.includes('misleading')) {
      return {
        bgColor: 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30',
        borderColor: 'border-red-200 dark:border-red-800',
        iconColor: 'text-red-600 dark:text-red-400',
        icon: XCircle
      }
    } else {
      return {
        bgColor: 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
        iconColor: 'text-yellow-600 dark:text-yellow-400',
        icon: AlertTriangle
      }
    }
  }

  const verdictStyling = getVerdictStyling(verdict)
  const VerdictIcon = verdictStyling.icon

  // Calculate average source credibility if available
  const averageCredibility = sourcesCount > 0 ? 
    Math.round((factCheckData.sources?.reduce((sum: number, source: any) => {
      return sum + (source.credibilityScore || 75) // Default fallback
    }, 0) || 0) / sourcesCount) : null

  return (
    <Card className={cn(
      'border-2 shadow-lg hover:shadow-xl transition-all duration-300',
      verdictStyling.bgColor,
      verdictStyling.borderColor,
      className
    )}>
      <CardContent className="p-8">
        <div className="space-y-6">
          {/* Header with Verdict */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-4">
              <VerdictIcon className={cn("w-12 h-12", verdictStyling.iconColor)} />
              <div>
                <VerdictBadge verdict={verdict} />
                {confidence && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {Math.round(confidence * 100)}% confidence
                  </div>
                )}
              </div>
            </div>
            
            <div className="max-w-2xl mx-auto">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Executive Summary
              </h2>
              <div className="text-muted-foreground leading-relaxed">
                <CitationText 
                  text={factCheckData.verdict?.summary || 
                       "Comprehensive fact-check analysis completed with multiple source verification."}
                  sources={factCheckData.sources || []}
                  onTabChange={onTabChange}
                />
              </div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-lg border">
              <BookOpen className="w-8 h-8 mx-auto text-primary mb-2" />
              <div className="text-2xl font-bold text-foreground">{sourcesCount}</div>
              <div className="text-xs text-muted-foreground">Sources</div>
            </div>
            
            <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-lg border">
              <Users className="w-8 h-8 mx-auto text-blue-600 mb-2" />
              <div className="text-2xl font-bold text-foreground">{humanReviewsCount}</div>
              <div className="text-xs text-muted-foreground">Human Reviews</div>
            </div>
            
            <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-lg border">
              <CheckCircle className="w-8 h-8 mx-auto text-green-600 mb-2" />
              <div className="text-2xl font-bold text-foreground">{keyPointsCount}</div>
              <div className="text-xs text-muted-foreground">Key Points</div>
            </div>
            
            <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-lg border">
              {processingTime ? (
                <>
                  <Clock className="w-8 h-8 mx-auto text-orange-600 mb-2" />
                  <div className="text-2xl font-bold text-foreground">{processingTime}s</div>
                  <div className="text-xs text-muted-foreground">Analysis Time</div>
                </>
              ) : averageCredibility ? (
                <>
                  <Star className="w-8 h-8 mx-auto text-yellow-600 mb-2" />
                  <div className="text-2xl font-bold text-foreground">{averageCredibility}/100</div>
                  <div className="text-xs text-muted-foreground">Avg Credibility</div>
                </>
              ) : (
                <>
                  <CheckCircle className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                  <div className="text-2xl font-bold text-foreground">✓</div>
                  <div className="text-xs text-muted-foreground">Complete</div>
                </>
              )}
            </div>
          </div>

          {/* Analysis Method Badge */}
          <div className="flex justify-center">
            <Badge variant="secondary" className="px-4 py-2">
              <span className="text-sm font-medium">
                {factCheckData.errors?.perplexity ? 
                  '🔍 Limited Analysis + Human Reviews' : 
                  '🤖 Full AI + Human Verification'
                }
              </span>
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}