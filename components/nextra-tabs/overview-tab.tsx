"use client"

import { VerdictBadge } from "../verdict-badge"
import { CitationText } from "../citation-text"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"

interface OverviewTabProps {
  factCheckData: any
  onTabChange?: (tab: string) => void
}

export function OverviewTab({ factCheckData, onTabChange }: OverviewTabProps) {

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Executive Summary</h1>
        <p className="text-muted-foreground">
          Comprehensive fact-check analysis with verdict and confidence assessment
        </p>
      </div>

      {/* Verdict Card */}
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center space-x-4">
            <VerdictBadge verdict={factCheckData?.verdict?.label || "Unclear"} />
            {factCheckData?.verdict?.confidence && (
              <div className="text-sm text-muted-foreground">
                {Math.round(factCheckData.verdict.confidence * 100)}% confidence
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-lg leading-relaxed">
            <CitationText
              text={factCheckData?.verdict?.summary || "Analysis unavailable"}
              sources={factCheckData?.sources || []}
              onTabChange={onTabChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Key Findings */}
      {factCheckData?.keyPoints?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Key Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {factCheckData.keyPoints.map((point: string, index: number) => (
                <li key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                  <span className="text-muted-foreground leading-relaxed">
                    <CitationText
                      text={point}
                      sources={factCheckData.sources || []}
                      onTabChange={onTabChange}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-primary">
              {factCheckData?.sources?.length || 0}
            </div>
            <div className="text-sm text-muted-foreground">Sources Analyzed</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-primary">
              {factCheckData?.factCheckReviews?.length || 0}
            </div>
            <div className="text-sm text-muted-foreground">Human Reviews</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-primary">
              {factCheckData?.keyPoints?.length || 0}
            </div>
            <div className="text-sm text-muted-foreground">Key Points</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}