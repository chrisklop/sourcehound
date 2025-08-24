"use client"

import { useState, useRef, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { EnhancedSourceCard, EnhancedSource } from '@/components/enhanced-source-card'
import { InteractiveCharts } from '@/components/interactive-charts'
import { 
  Search, 
  Filter, 
  Grid3x3, 
  List, 
  Maximize2, 
  Minimize2,
  SlidersHorizontal,
  BookOpen,
  Eye,
  MousePointer,
  ZoomIn,
  ZoomOut,
  Move3D
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CanvasSourceBrowserProps {
  sources: EnhancedSource[]
  isExpanded?: boolean
  onExpand?: (expanded: boolean) => void
  onSourceSelect?: (source: EnhancedSource) => void
  className?: string
}

type ViewMode = 'canvas' | 'grid' | 'list'
type FilterType = 'all' | 'government' | 'academic' | 'factcheck' | 'news' | 'general'

export function CanvasSourceBrowser({ 
  sources, 
  isExpanded = false, 
  onExpand,
  onSourceSelect,
  className 
}: CanvasSourceBrowserProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('canvas')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [selectedSource, setSelectedSource] = useState<EnhancedSource | null>(null)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)

  // Filter and search sources
  const filteredSources = useMemo(() => {
    return sources.filter(source => {
      const matchesSearch = searchQuery === '' || 
        source.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        source.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        source.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesFilter = filterType === 'all' || source.sourceType === filterType
      
      return matchesSearch && matchesFilter
    })
  }, [sources, searchQuery, filterType])

  // Calculate canvas layout for sources
  const canvasLayout = useMemo(() => {
    const layout: Array<EnhancedSource & { x: number, y: number, credibilityCluster: number }> = []
    const cols = Math.ceil(Math.sqrt(filteredSources.length))
    const spacing = 320 // Card width + margin
    
    filteredSources.forEach((source, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      
      // Add some randomness to make it look more organic
      const offsetX = (Math.random() - 0.5) * 40
      const offsetY = (Math.random() - 0.5) * 40
      
      layout.push({
        ...source,
        x: col * spacing + offsetX,
        y: row * 250 + offsetY, // Card height + margin
        credibilityCluster: Math.floor((source.credibilityScore || 75) / 20) // Group by credibility
      })
    })
    
    return layout
  }, [filteredSources])

  // Handle canvas dragging
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (viewMode !== 'canvas') return
    setIsDragging(true)
    setDragStart({ x: e.clientX - canvasPosition.x, y: e.clientY - canvasPosition.y })
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || viewMode !== 'canvas') return
    setCanvasPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleCanvasMouseUp = () => {
    setIsDragging(false)
  }

  // Handle zoom
  const handleZoomIn = () => {
    setCanvasZoom(prev => Math.min(prev * 1.2, 3))
  }

  const handleZoomOut = () => {
    setCanvasZoom(prev => Math.max(prev * 0.8, 0.3))
  }

  const handleResetView = () => {
    setCanvasZoom(1)
    setCanvasPosition({ x: 0, y: 0 })
  }

  // Source selection
  const handleSourceClick = (source: EnhancedSource) => {
    setSelectedSource(source)
    onSourceSelect?.(source)
  }

  const filterOptions = [
    { value: 'all', label: 'All Sources', count: sources.length },
    { value: 'government', label: 'Government', count: sources.filter(s => s.sourceType === 'government').length },
    { value: 'academic', label: 'Academic', count: sources.filter(s => s.sourceType === 'academic').length },
    { value: 'factcheck', label: 'Fact Check', count: sources.filter(s => s.sourceType === 'factcheck').length },
    { value: 'news', label: 'News', count: sources.filter(s => s.sourceType === 'news').length },
    { value: 'general', label: 'General', count: sources.filter(s => s.sourceType === 'general').length }
  ]

  const renderCanvasView = () => (
    <div className="relative w-full h-full overflow-hidden bg-muted/30 rounded-lg">
      {/* Canvas Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleZoomOut}
          className="h-8 w-8 p-0"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs bg-background px-2 py-1 rounded border">
          {Math.round(canvasZoom * 100)}%
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleZoomIn}
          className="h-8 w-8 p-0"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleResetView}
        >
          <Move3D className="h-4 w-4 mr-1" />
          Reset
        </Button>
      </div>

      {/* Canvas Viewport */}
      <div
        ref={canvasRef}
        className={cn(
          "w-full h-full cursor-grab relative",
          isDragging && "cursor-grabbing"
        )}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
      >
        <div
          className="absolute top-0 left-0"
          style={{
            transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasZoom})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.2s ease'
          }}
        >
          {canvasLayout.map((source, index) => (
            <div
              key={`${source.url}-${index}`}
              className="absolute cursor-pointer transition-all duration-200 hover:z-10 hover:scale-105"
              style={{
                left: `${source.x}px`,
                top: `${source.y}px`,
                width: '280px'
              }}
              onClick={(e) => {
                e.stopPropagation()
                handleSourceClick(source)
              }}
            >
              <EnhancedSourceCard
                source={source}
                size="compact"
                className={cn(
                  "shadow-lg transition-all duration-200",
                  selectedSource?.url === source.url && "ring-2 ring-primary shadow-xl",
                  "hover:shadow-2xl hover:scale-105"
                )}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Canvas Mini-map */}
      <div className="absolute bottom-4 right-4 w-32 h-24 bg-background/90 border rounded-lg p-2">
        <div className="text-xs text-muted-foreground mb-1">Overview</div>
        <div className="relative w-full h-full bg-muted/50 rounded">
          {canvasLayout.slice(0, 20).map((source, index) => (
            <div
              key={index}
              className={cn(
                "absolute w-1 h-1 rounded-full",
                source.sourceType === 'government' ? 'bg-blue-500' :
                source.sourceType === 'academic' ? 'bg-purple-500' :
                source.sourceType === 'factcheck' ? 'bg-green-500' :
                source.sourceType === 'news' ? 'bg-orange-500' : 'bg-gray-500'
              )}
              style={{
                left: `${(source.x / 2000) * 100}%`,
                top: `${(source.y / 1500) * 100}%`
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredSources.map((source, index) => (
        <EnhancedSourceCard
          key={`${source.url}-${index}`}
          source={source}
          size="default"
          onClick={() => handleSourceClick(source)}
          className={cn(
            selectedSource?.url === source.url && "ring-2 ring-primary"
          )}
        />
      ))}
    </div>
  )

  const renderListView = () => (
    <div className="space-y-3">
      {filteredSources.map((source, index) => (
        <EnhancedSourceCard
          key={`${source.url}-${index}`}
          source={source}
          size="compact"
          onClick={() => handleSourceClick(source)}
          className={cn(
            "hover:shadow-md transition-shadow",
            selectedSource?.url === source.url && "ring-2 ring-primary"
          )}
        />
      ))}
    </div>
  )

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Source Browser</CardTitle>
            <Badge variant="secondary">
              {filteredSources.length} of {sources.length}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {onExpand && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onExpand(!isExpanded)}
                className="h-8 w-8 p-0"
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-4 pt-2">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-8"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-1">
              {filterOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={filterType === option.value ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilterType(option.value as FilterType)}
                  className="h-7 px-2 text-xs"
                  disabled={option.count === 0}
                >
                  {option.label}
                  {option.count > 0 && (
                    <Badge variant="outline" className="ml-1 h-4 px-1 text-xs">
                      {option.count}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* View Mode */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === 'canvas' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('canvas')}
              className="h-6 w-6 p-0"
            >
              <MousePointer className="h-3 w-3" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-6 w-6 p-0"
            >
              <Grid3x3 className="h-3 w-3" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-6 w-6 p-0"
            >
              <List className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <div className={cn(
          "flex gap-6",
          isExpanded ? "h-[800px]" : "h-[500px]"
        )}>
          {/* Main View */}
          <div className="flex-1">
            <ScrollArea className="h-full p-4">
              {viewMode === 'canvas' && renderCanvasView()}
              {viewMode === 'grid' && renderGridView()}
              {viewMode === 'list' && renderListView()}
            </ScrollArea>
          </div>

          {/* Side Panel */}
          <div className="w-80 border-l bg-muted/30">
            <div className="p-4 h-full flex flex-col">
              {selectedSource ? (
                <div className="space-y-4 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm">Source Details</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSource(null)}
                      className="h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </div>
                  
                  <ScrollArea className="flex-1">
                    <EnhancedSourceCard
                      source={selectedSource}
                      size="detailed"
                      showFullDetails
                      className="border-0 shadow-none"
                    />
                  </ScrollArea>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-medium text-sm">Analytics</h3>
                  <InteractiveCharts 
                    data={{ 
                      sources: filteredSources.map(s => ({
                        type: s.sourceType || 'general',
                        credibilityScore: s.credibilityScore || 75,
                        publishedDate: s.publishedDate,
                        url: s.url,
                        title: s.title
                      }))
                    }}
                    className="border-0 shadow-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}