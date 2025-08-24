"use client"

import { useState, useEffect } from 'react'
import { NextraLayout } from './nextra-layout'
import { OverviewTab } from './nextra-tabs/overview-tab'
import { HumanReviewsTab } from './nextra-tabs/human-reviews-tab'
import { VideoGrid } from './video-embeds'
import { extractVideoSources } from '@/lib/video-utils'
import { CitationText } from './citation-text'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { CredibilityBadge } from './ui/credibility-badge'
import { AiSourceSummary, AiSummaryStats } from './ai-source-summary'
import { SimpleSourceEnhancer, BatchSourceEnhancer } from './simple-source-enhancer'
import { TrackedExternalLink } from './tracked-external-link'

interface NextraResultsProps {
  factCheckData: any
  query: string
}

export function NextraResults({ factCheckData, query }: NextraResultsProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [enhancedSources, setEnhancedSources] = useState(factCheckData?.sources || [])
  
  // Update enhanced sources when factCheckData changes
  useEffect(() => {
    if (factCheckData?.sources) {
      console.log('[NextraResults] Updating enhanced sources:', factCheckData.sources.length, 'sources')
      setEnhancedSources(factCheckData.sources)
    } else {
      console.log('[NextraResults] No sources in factCheckData:', factCheckData)
    }
  }, [factCheckData])
  
  // Safety check for data
  if (!factCheckData) {
    return (
      <div className="text-center py-16">
        <div className="text-muted-foreground">Loading results...</div>
      </div>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab factCheckData={factCheckData} onTabChange={setActiveTab} />
      
      case 'human-reviews':
        return <HumanReviewsTab factCheckData={factCheckData} />
      
      case 'analysis':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">AI Analysis</h1>
              <p className="text-muted-foreground">
                Detailed analysis powered by advanced language models and research databases
              </p>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-gray dark:prose-invert max-w-none">
                  {factCheckData?.explanation ? (
                    <div className="leading-relaxed">
                      <CitationText
                        text={factCheckData.explanation}
                        sources={factCheckData?.sources || []}
                        onTabChange={setActiveTab}
                        formatAnalysis={true}
                      />
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Analysis unavailable</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )
      
      case 'sources':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Sources & References</h1>
              <p className="text-muted-foreground">
                {enhancedSources?.length || 0} sources analyzed for this fact-check
              </p>
              {/* Debug info */}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-muted-foreground mt-2">
                  Debug: factCheckData.sources={factCheckData?.sources?.length}, enhancedSources={enhancedSources?.length}
                </div>
              )}
            </div>
            
            {/* AI Summary Statistics */}
            <AiSummaryStats 
              sources={enhancedSources}
              className="mb-6"
            />
            
            {/* Batch Source Enhancement */}
            <BatchSourceEnhancer 
              sources={enhancedSources}
              onEnhanceAll={() => {
                // Optional: Could implement batch summary viewing here
                console.log('Batch enhancement requested for', enhancedSources.length, 'sources')
              }}
            />
            
            {/* Enhanced Source List with AI Enhancement Options */}
            {(enhancedSources.length > 0 || factCheckData?.sources?.length > 0) ? (
              <div className="space-y-4">
                {(enhancedSources.length > 0 ? enhancedSources : factCheckData?.sources || []).map((source: any, index: number) => (
                  <Card 
                    key={index} 
                    id={`source-${source.rank || index + 1}`}
                    className="hover:shadow-lg transition-all duration-200"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              #{source.rank || index + 1}
                            </span>
                            <CredibilityBadge 
                              sourceUrl={source.url}
                              sourceTitle={source.title}
                              publishedDate={source.publishedAt}
                              useAdvancedScoring={true}
                              showStars={true}
                              showScore={true}
                              size="sm"
                            />
                          </div>
                          <CardTitle className="text-lg">
                            <TrackedExternalLink
                              href={source.url}
                              sourceType={source.type}
                              sourceRank={source.rank}
                              factCheckQuery={query}
                              pageSection="sources"
                              className="text-primary hover:text-primary/80 hover:underline"
                            >
                              {source.title || source.url}
                            </TrackedExternalLink>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {source.publisher || 'Unknown Publisher'}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      {/* Simple Source Enhancer with overlay summaries */}
                      <SimpleSourceEnhancer 
                        source={source}
                        showBatchOption={index === 0} // Show batch option only on first source
                        onBatchEnhance={() => {
                          console.log('Batch enhancement requested')
                        }}
                        factCheckQuery={query}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No sources available
                </CardContent>
              </Card>
            )}
          </div>
        )
      
      case 'videos':
        const videoSources = extractVideoSources(factCheckData?.sources || [])
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Video Sources</h1>
              <p className="text-muted-foreground">
                {videoSources.length} video source{videoSources.length !== 1 ? 's' : ''} found for this fact-check
              </p>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Video Evidence</CardTitle>
              </CardHeader>
              <CardContent>
                <VideoGrid videos={videoSources} />
              </CardContent>
            </Card>
          </div>
        )
      
      case 'statistics':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Analysis Statistics</h1>
              <p className="text-muted-foreground">
                Detailed metrics and data from this fact-check analysis
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Processing Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {factCheckData?.debug?.processingTime ? 
                      `${Math.round(factCheckData.debug.processingTime / 1000)}s` : 
                      'N/A'
                    }
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Sources Analyzed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {factCheckData?.sources?.length || 0}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Human Reviews</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {factCheckData?.factCheckReviews?.length || 0}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Analysis Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium">
                    {factCheckData?.errors?.perplexity ? 'Limited Analysis' : 'Full AI + Human'}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Cache Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium">
                    {factCheckData?.cached ? 'Cached Result' : 'Fresh Analysis'}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Confidence Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {factCheckData?.verdict?.confidence ? 
                      `${Math.round(factCheckData.verdict.confidence * 100)}%` : 
                      'N/A'
                    }
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )
      
      default:
        return <OverviewTab factCheckData={factCheckData} />
    }
  }

  return (
    <NextraLayout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      factCheckData={factCheckData}
    >
      {renderTabContent()}
    </NextraLayout>
  )
}