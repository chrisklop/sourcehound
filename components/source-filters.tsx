"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Filter, 
  X, 
  Calendar,
  Star,
  Shield,
  BookOpen,
  FileText,
  Globe,
  TrendingUp,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SourceFilters {
  sourceTypes: string[]
  credibilityRange: [number, number]
  dateRange: 'all' | 'week' | 'month' | 'year'
  minCitations: number
  sortBy: 'relevance' | 'credibility' | 'date' | 'citations'
  sortOrder: 'asc' | 'desc'
}

interface SourceFiltersProps {
  sources: any[]
  onFiltersChange: (filters: SourceFilters) => void
  className?: string
}

const defaultFilters: SourceFilters = {
  sourceTypes: [],
  credibilityRange: [0, 100],
  dateRange: 'all',
  minCitations: 0,
  sortBy: 'relevance',
  sortOrder: 'desc'
}

const sourceTypeConfig = {
  government: { icon: Shield, color: 'bg-blue-500', label: 'Government' },
  academic: { icon: BookOpen, color: 'bg-purple-500', label: 'Academic' },
  factcheck: { icon: Users, color: 'bg-green-500', label: 'Fact-Check' },
  news: { icon: FileText, color: 'bg-orange-500', label: 'News' },
  general: { icon: Globe, color: 'bg-gray-500', label: 'General' }
}

export function SourceFilters({ sources, onFiltersChange, className }: SourceFiltersProps) {
  const [filters, setFilters] = useState<SourceFilters>(defaultFilters)
  const [isExpanded, setIsExpanded] = useState(false)

  // Calculate statistics from sources
  const sourceTypeStats = Object.entries(sourceTypeConfig).map(([type, config]) => ({
    type,
    ...config,
    count: sources.filter(s => s.type === type || s.sourceType === type).length
  })).filter(stat => stat.count > 0)

  const credibilityStats = {
    min: Math.min(...sources.map(s => s.credibilityScore || 75)),
    max: Math.max(...sources.map(s => s.credibilityScore || 75)),
    avg: Math.round(sources.reduce((sum, s) => sum + (s.credibilityScore || 75), 0) / sources.length)
  }

  const updateFilters = (newFilters: Partial<SourceFilters>) => {
    const updated = { ...filters, ...newFilters }
    setFilters(updated)
    onFiltersChange(updated)
  }

  const clearFilters = () => {
    setFilters(defaultFilters)
    onFiltersChange(defaultFilters)
  }

  const hasActiveFilters = 
    filters.sourceTypes.length > 0 ||
    filters.credibilityRange[0] > 0 ||
    filters.credibilityRange[1] < 100 ||
    filters.dateRange !== 'all' ||
    filters.minCitations > 0

  return (
    <Card className={cn("border-2", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Source Filters</CardTitle>
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                {[
                  filters.sourceTypes.length > 0 ? `${filters.sourceTypes.length} types` : '',
                  filters.credibilityRange[0] > 0 || filters.credibilityRange[1] < 100 ? 'credibility' : '',
                  filters.dateRange !== 'all' ? filters.dateRange : '',
                  filters.minCitations > 0 ? 'citations' : ''
                ].filter(Boolean).join(', ')}
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
            <Button
              variant="ghost" 
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-xl font-bold text-primary">{sources.length}</div>
            <div className="text-xs text-muted-foreground">Total Sources</div>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-xl font-bold text-green-600">{credibilityStats.avg}</div>
            <div className="text-xs text-muted-foreground">Avg Credibility</div>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-xl font-bold text-blue-600">{sourceTypeStats.length}</div>
            <div className="text-xs text-muted-foreground">Source Types</div>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-xl font-bold text-purple-600">
              {credibilityStats.max - credibilityStats.min}
            </div>
            <div className="text-xs text-muted-foreground">Range</div>
          </div>
        </div>

        {isExpanded && (
          <>
            {/* Source Type Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Source Types
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {sourceTypeStats.map(({ type, icon: Icon, color, label, count }) => {
                  const isSelected = filters.sourceTypes.includes(type)
                  return (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            updateFilters({
                              sourceTypes: [...filters.sourceTypes, type]
                            })
                          } else {
                            updateFilters({
                              sourceTypes: filters.sourceTypes.filter(t => t !== type)
                            })
                          }
                        }}
                      />
                      <label
                        htmlFor={`type-${type}`}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <div className={cn("w-3 h-3 rounded-full", color)} />
                        <span className="text-sm">{label}</span>
                        <Badge variant="outline" className="text-xs">
                          {count}
                        </Badge>
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Credibility Range */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Star className="w-4 h-4" />
                Credibility Score: {filters.credibilityRange[0]} - {filters.credibilityRange[1]}
              </Label>
              <div className="px-2">
                <Slider
                  value={filters.credibilityRange}
                  onValueChange={(value) => 
                    updateFilters({ credibilityRange: value as [number, number] })
                  }
                  max={100}
                  min={0}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Publication Date
              </Label>
              <Select
                value={filters.dateRange}
                onValueChange={(value) => 
                  updateFilters({ dateRange: value as SourceFilters['dateRange'] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="week">Past Week</SelectItem>
                  <SelectItem value="month">Past Month</SelectItem>
                  <SelectItem value="year">Past Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Sort By
                </Label>
                <Select
                  value={filters.sortBy}
                  onValueChange={(value) => 
                    updateFilters({ sortBy: value as SourceFilters['sortBy'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="credibility">Credibility Score</SelectItem>
                    <SelectItem value="date">Publication Date</SelectItem>
                    <SelectItem value="citations">Citation Count</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Order</Label>
                <Select
                  value={filters.sortOrder}
                  onValueChange={(value) => 
                    updateFilters({ sortOrder: value as SourceFilters['sortOrder'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Highest First</SelectItem>
                    <SelectItem value="asc">Lowest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Showing filtered results
              </span>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-3 h-3 mr-1" />
                Clear All
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}