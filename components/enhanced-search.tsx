"use client"

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { 
  Search, 
  X, 
  FileText, 
  Users, 
  BookOpen, 
  Highlighter,
  ArrowRight,
  Filter
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchResult {
  type: 'analysis' | 'keypoint' | 'source' | 'review'
  title: string
  content: string
  matches: { text: string; context: string }[]
  sourceIndex?: number
  confidence?: number
}

interface EnhancedSearchProps {
  factCheckData: any
  onResultClick?: (result: SearchResult) => void
  onTabChange?: (tab: string) => void
  className?: string
}

export function EnhancedSearch({ 
  factCheckData, 
  onResultClick, 
  onTabChange, 
  className 
}: EnhancedSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTypes, setSearchTypes] = useState({
    analysis: true,
    keypoints: true,
    sources: true,
    reviews: true
  })
  const [isExpanded, setIsExpanded] = useState(false)

  // Search through all fact-check content
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []

    const query = searchQuery.toLowerCase()
    const results: SearchResult[] = []

    // Helper function to find matches in text
    const findMatches = (text: string, maxMatches = 3) => {
      const words = query.split(' ').filter(w => w.length > 2)
      const matches: { text: string; context: string }[] = []
      
      words.forEach(word => {
        const regex = new RegExp(`(.{0,30})(${word})(.{0,30})`, 'gi')
        const textMatches = text.match(regex)
        
        if (textMatches) {
          textMatches.slice(0, maxMatches).forEach(match => {
            const contextMatch = match.match(regex)
            if (contextMatch) {
              matches.push({
                text: contextMatch[2],
                context: match
              })
            }
          })
        }
      })
      
      return matches
    }

    // Search in main analysis
    if (searchTypes.analysis && factCheckData.explanation) {
      const analysisText = factCheckData.explanation.toLowerCase()
      if (analysisText.includes(query)) {
        const matches = findMatches(factCheckData.explanation)
        if (matches.length > 0) {
          results.push({
            type: 'analysis',
            title: 'Detailed Analysis',
            content: factCheckData.explanation,
            matches,
            confidence: 95
          })
        }
      }
    }

    // Search in key points
    if (searchTypes.keypoints && factCheckData.keyPoints) {
      factCheckData.keyPoints.forEach((point: string, index: number) => {
        const pointText = point.toLowerCase()
        if (pointText.includes(query)) {
          const matches = findMatches(point)
          if (matches.length > 0) {
            results.push({
              type: 'keypoint',
              title: `Key Finding #${index + 1}`,
              content: point,
              matches,
              confidence: 90
            })
          }
        }
      })
    }

    // Search in sources
    if (searchTypes.sources && factCheckData.sources) {
      factCheckData.sources.forEach((source: any, index: number) => {
        const searchableText = `${source.title} ${source.excerpt || ''} ${source.publisher || ''}`.toLowerCase()
        if (searchableText.includes(query)) {
          const matches = findMatches(`${source.title} ${source.excerpt || ''}`)
          if (matches.length > 0) {
            results.push({
              type: 'source',
              title: source.title,
              content: source.excerpt || source.title,
              matches,
              sourceIndex: index,
              confidence: source.credibilityScore || 75
            })
          }
        }
      })
    }

    // Search in human reviews
    if (searchTypes.reviews && factCheckData.factCheckReviews) {
      factCheckData.factCheckReviews.forEach((review: any, index: number) => {
        const reviewText = `${review.title} ${review.textualRating || ''}`.toLowerCase()
        if (reviewText.includes(query)) {
          const matches = findMatches(review.title)
          if (matches.length > 0) {
            results.push({
              type: 'review',
              title: review.title,
              content: review.title,
              matches,
              confidence: 85
            })
          }
        }
      })
    }

    // Sort by relevance (more matches = higher relevance)
    return results.sort((a, b) => {
      const aScore = a.matches.length * (a.confidence || 0)
      const bScore = b.matches.length * (b.confidence || 0)
      return bScore - aScore
    })
  }, [searchQuery, factCheckData, searchTypes])

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'analysis': return FileText
      case 'keypoint': return Highlighter
      case 'source': return BookOpen
      case 'review': return Users
      default: return FileText
    }
  }

  const getTypeColor = (type: SearchResult['type']) => {
    switch (type) {
      case 'analysis': return 'bg-blue-500'
      case 'keypoint': return 'bg-green-500'
      case 'source': return 'bg-purple-500'
      case 'review': return 'bg-orange-500'
      default: return 'bg-gray-500'
    }
  }

  const handleResultClick = (result: SearchResult) => {
    // Navigate to appropriate tab based on result type
    if (onTabChange) {
      switch (result.type) {
        case 'analysis':
          onTabChange('analysis')
          break
        case 'keypoint':
          onTabChange('overview')
          break
        case 'source':
          onTabChange('sources')
          break
        case 'review':
          onTabChange('human-reviews')
          break
      }
    }
    
    onResultClick?.(result)
  }

  const highlightText = (text: string, highlight: string) => {
    if (!highlight) return text
    
    const regex = new RegExp(`(${highlight})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <Card className={cn("border-2", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Search className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Search Results</CardTitle>
            {searchResults.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost" 
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Filter className="w-4 h-4 mr-1" />
            {isExpanded ? 'Collapse' : 'Options'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search analysis, key findings, sources, and reviews..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              onClick={() => setSearchQuery('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Search Options */}
        {isExpanded && (
          <div className="space-y-4 pt-2 border-t">
            <Label className="text-sm font-medium">Search in:</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { key: 'analysis', label: 'Analysis', icon: FileText, color: 'text-blue-600' },
                { key: 'keypoints', label: 'Key Points', icon: Highlighter, color: 'text-green-600' },
                { key: 'sources', label: 'Sources', icon: BookOpen, color: 'text-purple-600' },
                { key: 'reviews', label: 'Reviews', icon: Users, color: 'text-orange-600' }
              ].map(({ key, label, icon: Icon, color }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`search-${key}`}
                    checked={searchTypes[key as keyof typeof searchTypes]}
                    onCheckedChange={(checked) => 
                      setSearchTypes(prev => ({ ...prev, [key]: checked }))
                    }
                  />
                  <label
                    htmlFor={`search-${key}`}
                    className="flex items-center space-x-2 cursor-pointer text-sm"
                  >
                    <Icon className={cn("w-4 h-4", color)} />
                    <span>{label}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchQuery.trim() && (
          <div className="space-y-4">
            {searchResults.length > 0 ? (
              searchResults.map((result, index) => {
                const TypeIcon = getTypeIcon(result.type)
                const typeColor = getTypeColor(result.type)
                
                return (
                  <Card
                    key={index}
                    className="hover:shadow-md transition-shadow cursor-pointer border-l-4"
                    style={{ borderLeftColor: typeColor.replace('bg-', '#') }}
                    onClick={() => handleResultClick(result)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={cn("p-2 rounded-full", typeColor)}>
                            <TypeIcon className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h3 className="font-medium text-sm">{result.title}</h3>
                            <Badge variant="outline" className="text-xs mt-1">
                              {result.type}
                            </Badge>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                      
                      <div className="space-y-2">
                        {result.matches.slice(0, 2).map((match, matchIndex) => (
                          <div key={matchIndex} className="text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                            <span className="font-mono text-xs">
                              ...{highlightText(match.context, match.text)}...
                            </span>
                          </div>
                        ))}
                      </div>
                      
                      {result.matches.length > 2 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          +{result.matches.length - 2} more match{result.matches.length - 2 !== 1 ? 'es' : ''}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            ) : (
              <div className="text-center py-8">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No results found</h3>
                <p className="text-muted-foreground mb-4">
                  Try different keywords or check your search options
                </p>
                <Badge variant="outline">
                  Searched in {Object.values(searchTypes).filter(Boolean).length} content types
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Search Tips */}
        {!searchQuery.trim() && (
          <div className="text-center py-6 text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              Search across analysis, key findings, sources, and reviews
            </p>
            <p className="text-xs mt-1">
              Try keywords like "climate", "evidence", "study", or "consensus"
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}