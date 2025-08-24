"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { FixedSizeList as List } from 'react-window'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EnhancedSourceCard } from '@/components/enhanced-source-card'
import { CredibilityBadge, detectSourceType } from '@/components/ui/credibility-badge'
import { 
  Search, 
  Filter,
  ArrowUp,
  ArrowDown,
  Zap,
  BarChart3,
  Eye,
  Layout
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface VirtualizedSourceListProps {
  sources: Array<{
    url: string
    title: string
    domain?: string
    type?: string
    sourceType?: string
    publishedDate?: string
    publishedAt?: string
    credibilityScore?: number
    excerpt?: string
    relevanceScore?: number
    citationCount?: number
    tags?: string[]
    rank?: number
  }>
  onSourceClick?: (source: any, index: number) => void
  className?: string
  itemHeight?: number
  containerHeight?: number
  enableSearch?: boolean
  enableVirtualization?: boolean
  showPerformanceStats?: boolean
}

// Individual source item component for virtualization
const VirtualizedSourceItem = ({ 
  index, 
  style, 
  data 
}: { 
  index: number
  style: React.CSSProperties
  data: {
    sources: any[]
    onSourceClick?: (source: any, index: number) => void
    searchQuery: string
    viewMode: 'compact' | 'detailed'
  }
}) => {
  const { sources, onSourceClick, searchQuery, viewMode } = data
  const source = sources[index]

  const handleClick = useCallback(() => {
    onSourceClick?.(source, index)
  }, [source, index, onSourceClick])

  const highlightMatch = useCallback((text: string, query: string) => {
    if (!query) return text
    
    const regex = new RegExp(`(${query})`, 'gi')
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    )
  }, [])

  if (viewMode === 'compact') {
    return (
      <div style={style} className="px-4">
        <Card 
          className="mb-2 hover:shadow-md transition-shadow cursor-pointer"
          onClick={handleClick}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    #{source.rank || index + 1}
                  </Badge>
                  <CredibilityBadge
                    sourceType={detectSourceType(source.url, source.title)}
                    credibilityScore={source.credibilityScore}
                    showScore={true}
                    showStars={false}
                    size="sm"
                  />
                </div>
                <h3 className="font-medium text-sm mb-1 line-clamp-2">
                  {highlightMatch(source.title, searchQuery)}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {source.domain || new URL(source.url).hostname}
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="text-xs text-muted-foreground">
                  {source.publishedDate || source.publishedAt 
                    ? new Date(source.publishedDate || source.publishedAt).toLocaleDateString()
                    : 'No date'
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div style={style} className="px-4">
      <div className="mb-4">
        <EnhancedSourceCard
          source={{
            url: source.url,
            title: source.title,
            domain: source.domain || new URL(source.url).hostname,
            publishedDate: source.publishedDate || source.publishedAt,
            credibilityScore: source.credibilityScore,
            sourceType: source.type || source.sourceType,
            excerpt: source.excerpt,
            relevanceScore: source.relevanceScore,
            citationCount: source.citationCount,
            tags: source.tags
          }}
          size="default"
          onClick={() => handleClick()}
        />
      </div>
    </div>
  )
}

export function VirtualizedSourceList({
  sources,
  onSourceClick,
  className,
  itemHeight = 120,
  containerHeight = 600,
  enableSearch = true,
  enableVirtualization = true,
  showPerformanceStats = true
}: VirtualizedSourceListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact')
  const [isVirtualized, setIsVirtualized] = useState(enableVirtualization)
  const [renderTime, setRenderTime] = useState(0)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 })
  const [containerWidth, setContainerWidth] = useState(400)
  
  const listRef = useRef<List>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Measure container width on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Filter sources based on search query
  const filteredSources = useMemo(() => {
    const start = performance.now()
    
    let filtered = sources
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = sources.filter(source =>
        source.title.toLowerCase().includes(query) ||
        source.excerpt?.toLowerCase().includes(query) ||
        (source.domain || new URL(source.url).hostname).toLowerCase().includes(query) ||
        (source.type || source.sourceType)?.toLowerCase().includes(query)
      )
    }
    
    const end = performance.now()
    setRenderTime(end - start)
    
    return filtered
  }, [sources, searchQuery])

  // Calculate performance metrics
  const performanceMetrics = useMemo(() => {
    const totalSources = sources.length
    const filteredCount = filteredSources.length
    const currentHeight = viewMode === 'compact' ? 120 : 200
    const maxVisible = Math.ceil(containerHeight / currentHeight)
    const renderedSources = isVirtualized ? maxVisible : filteredCount
    
    return {
      totalSources,
      filteredCount,
      renderedSources,
      virtualizationRatio: totalSources > 0 ? (renderedSources / totalSources) * 100 : 0,
      memoryEfficiency: totalSources > 0 ? ((totalSources - renderedSources) / totalSources) * 100 : 0
    }
  }, [sources.length, filteredSources.length, containerHeight, viewMode, isVirtualized])

  const handleScroll = useCallback(({ visibleStartIndex, visibleStopIndex }: any) => {
    setVisibleRange({
      start: visibleStartIndex,
      end: visibleStopIndex
    })
  }, [])

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToItem(0, 'start')
  }, [])

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToItem(filteredSources.length - 1, 'end')
  }, [filteredSources.length])

  const itemData = useMemo(() => ({
    sources: filteredSources,
    onSourceClick,
    searchQuery,
    viewMode
  }), [filteredSources, onSourceClick, searchQuery, viewMode])

  const currentItemHeight = viewMode === 'compact' ? 120 : 200

  return (
    <Card className={cn("border-2", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <Layout className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Source List</CardTitle>
            <Badge variant="secondary" className="ml-2">
              {filteredSources.length} of {sources.length}
            </Badge>
            {isVirtualized && (
              <Badge variant="outline" className="bg-green-100 dark:bg-green-900/20">
                <Zap className="w-3 h-3 mr-1" />
                Virtualized
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'compact' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('compact')}
            >
              Compact
            </Button>
            <Button
              variant={viewMode === 'detailed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('detailed')}
            >
              Detailed
            </Button>
            <Button
              variant={isVirtualized ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsVirtualized(!isVirtualized)}
              className="hidden md:flex"
            >
              <Zap className="w-4 h-4 mr-1" />
              Virtual
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search */}
        {enableSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search sources by title, domain, or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {/* Performance Stats */}
        {showPerformanceStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-4 bg-muted/30 rounded-lg">
            <div className="text-center">
              <div className="text-lg font-bold text-primary">
                {performanceMetrics.filteredCount}
              </div>
              <div className="text-xs text-muted-foreground">Filtered</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {performanceMetrics.renderedSources}
              </div>
              <div className="text-xs text-muted-foreground">Rendered</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {Math.round(performanceMetrics.virtualizationRatio)}%
              </div>
              <div className="text-xs text-muted-foreground">Efficiency</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">
                {renderTime.toFixed(1)}ms
              </div>
              <div className="text-xs text-muted-foreground">Filter Time</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-orange-600">
                {visibleRange.start + 1}-{Math.min(visibleRange.end + 1, filteredSources.length)}
              </div>
              <div className="text-xs text-muted-foreground">Visible</div>
            </div>
          </div>
        )}

        {/* Navigation Controls */}
        {isVirtualized && filteredSources.length > 10 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={scrollToTop}>
                <ArrowUp className="w-4 h-4 mr-1" />
                Top
              </Button>
              <Button variant="outline" size="sm" onClick={scrollToBottom}>
                <ArrowDown className="w-4 h-4 mr-1" />
                Bottom
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Viewing {visibleRange.start + 1}-{Math.min(visibleRange.end + 1, filteredSources.length)} of {filteredSources.length}
            </div>
          </div>
        )}

        {/* Source List */}
        <div 
          ref={containerRef}
          className="border rounded-lg"
          style={{ height: containerHeight }}
        >
          {filteredSources.length > 0 ? (
            isVirtualized ? (
              <List
                ref={listRef}
                height={containerHeight}
                width={containerWidth}
                itemCount={filteredSources.length}
                itemSize={currentItemHeight}
                itemData={itemData}
                onItemsRendered={handleScroll}
                overscanCount={3}
              >
                {VirtualizedSourceItem}
              </List>
            ) : (
              <div className="h-full overflow-y-auto">
                {filteredSources.map((source, index) => (
                  <VirtualizedSourceItem
                    key={`${source.url}-${index}`}
                    index={index}
                    style={{ height: currentItemHeight }}
                    data={itemData}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No sources found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search criteria
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Performance Info */}
        {showPerformanceStats && isVirtualized && (
          <div className="text-xs text-muted-foreground text-center p-2 bg-green-50 dark:bg-green-900/10 rounded">
            <Zap className="w-3 h-3 inline mr-1" />
            Virtualization active: Only rendering {performanceMetrics.renderedSources} sources instead of {performanceMetrics.totalSources} 
            (saving {Math.round(performanceMetrics.memoryEfficiency)}% memory)
          </div>
        )}
      </CardContent>
    </Card>
  )
}