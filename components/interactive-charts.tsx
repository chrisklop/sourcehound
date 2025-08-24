"use client"

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Star,
  Shield,
  BookOpen,
  FileText,
  Globe,
  Users,
  Calendar,
  Award,
  Target,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChartData {
  sources: Array<{
    type: string
    credibilityScore: number
    publishedDate?: string
    url: string
    title: string
  }>
  factCheckData?: any
}

interface InteractiveChartsProps {
  data: ChartData
  className?: string
}

const sourceTypeConfig = {
  government: { icon: Shield, color: 'hsl(221, 83%, 53%)', bgColor: 'bg-blue-500', label: 'Government' },
  academic: { icon: BookOpen, color: 'hsl(262, 83%, 58%)', bgColor: 'bg-purple-500', label: 'Academic' },
  factcheck: { icon: Users, color: 'hsl(142, 76%, 36%)', bgColor: 'bg-green-500', label: 'Fact-Check' },
  news: { icon: FileText, color: 'hsl(25, 95%, 53%)', bgColor: 'bg-orange-500', label: 'News' },
  general: { icon: Globe, color: 'hsl(215, 20%, 65%)', bgColor: 'bg-gray-500', label: 'General' }
}

export function InteractiveCharts({ data, className }: InteractiveChartsProps) {
  const [activeChart, setActiveChart] = useState<'distribution' | 'credibility' | 'timeline' | 'breakdown'>('distribution')

  // Calculate chart data
  const chartData = useMemo(() => {
    // Source type distribution
    const typeDistribution = data.sources.reduce((acc, source) => {
      const type = source.type || 'general'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Credibility score ranges
    const credibilityRanges = {
      'Excellent (90-100)': data.sources.filter(s => (s.credibilityScore || 75) >= 90).length,
      'Good (80-89)': data.sources.filter(s => {
        const score = s.credibilityScore || 75
        return score >= 80 && score < 90
      }).length,
      'Fair (70-79)': data.sources.filter(s => {
        const score = s.credibilityScore || 75
        return score >= 70 && score < 80
      }).length,
      'Poor (<70)': data.sources.filter(s => (s.credibilityScore || 75) < 70).length
    }

    // Timeline data (by month)
    const timelineData = data.sources
      .filter(s => s.publishedDate)
      .reduce((acc, source) => {
        const date = new Date(source.publishedDate!)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        acc[monthKey] = (acc[monthKey] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    // Summary stats
    const avgCredibility = Math.round(
      data.sources.reduce((sum, s) => sum + (s.credibilityScore || 75), 0) / data.sources.length
    )

    return {
      typeDistribution,
      credibilityRanges,
      timelineData,
      avgCredibility,
      totalSources: data.sources.length
    }
  }, [data.sources])

  const renderDistributionChart = () => {
    const total = chartData.totalSources
    const maxCount = Math.max(...Object.values(chartData.typeDistribution))

    return (
      <div className="space-y-4">
        {Object.entries(chartData.typeDistribution)
          .sort(([,a], [,b]) => b - a)
          .map(([type, count]) => {
            const config = sourceTypeConfig[type as keyof typeof sourceTypeConfig] || sourceTypeConfig.general
            const percentage = Math.round((count / total) * 100)
            const barWidth = (count / maxCount) * 100

            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={cn("p-2 rounded-full", config.bgColor)}>
                      <config.icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-medium">{config.label}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">{count}</Badge>
                    <span className="text-sm text-muted-foreground">{percentage}%</span>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className={cn("h-3 rounded-full transition-all duration-500", config.bgColor)}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            )
          })}
      </div>
    )
  }

  const renderCredibilityChart = () => {
    const total = chartData.totalSources
    const ranges = [
      { label: 'Excellent (90-100)', count: chartData.credibilityRanges['Excellent (90-100)'], color: 'bg-green-500', icon: Award },
      { label: 'Good (80-89)', count: chartData.credibilityRanges['Good (80-89)'], color: 'bg-blue-500', icon: Star },
      { label: 'Fair (70-79)', count: chartData.credibilityRanges['Fair (70-79)'], color: 'bg-yellow-500', icon: Target },
      { label: 'Poor (<70)', count: chartData.credibilityRanges['Poor (<70)'], color: 'bg-red-500', icon: Activity }
    ]

    return (
      <div className="space-y-6">
        {/* Credibility Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{chartData.avgCredibility}</div>
            <div className="text-xs text-muted-foreground">Average Score</div>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {ranges.filter(r => r.count > 0).length}
            </div>
            <div className="text-xs text-muted-foreground">Quality Tiers</div>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {ranges[0].count + ranges[1].count}
            </div>
            <div className="text-xs text-muted-foreground">High Quality</div>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(((ranges[0].count + ranges[1].count) / total) * 100)}%
            </div>
            <div className="text-xs text-muted-foreground">Reliable</div>
          </div>
        </div>

        {/* Credibility Distribution */}
        <div className="space-y-4">
          {ranges.map(({ label, count, color, icon: Icon }) => {
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={cn("p-2 rounded-full", color)}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-medium text-sm">{label}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">{count}</Badge>
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {percentage}%
                    </span>
                  </div>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderTimelineChart = () => {
    const sortedTimeline = Object.entries(chartData.timelineData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // Last 12 months

    const maxCount = Math.max(...sortedTimeline.map(([, count]) => count))

    if (sortedTimeline.length === 0) {
      return (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Timeline Data</h3>
          <p className="text-muted-foreground">
            Publication dates not available for sources
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Timeline Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-primary">
              {sortedTimeline.length}
            </div>
            <div className="text-xs text-muted-foreground">Months</div>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{maxCount}</div>
            <div className="text-xs text-muted-foreground">Peak Month</div>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(chartData.totalSources / sortedTimeline.length)}
            </div>
            <div className="text-xs text-muted-foreground">Avg/Month</div>
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="space-y-3">
          {sortedTimeline.map(([month, count]) => {
            const barHeight = (count / maxCount) * 100
            const date = new Date(month + '-01')
            const monthName = date.toLocaleDateString('en-US', { 
              month: 'short', 
              year: '2-digit' 
            })

            return (
              <div key={month} className="flex items-end space-x-3">
                <div className="w-16 text-xs text-muted-foreground text-right">
                  {monthName}
                </div>
                <div className="flex-1 bg-muted rounded-full h-6 flex items-end">
                  <div
                    className="bg-primary rounded-full h-full transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${barHeight}%` }}
                  >
                    {barHeight > 30 && (
                      <span className="text-xs text-primary-foreground font-medium">
                        {count}
                      </span>
                    )}
                  </div>
                </div>
                {barHeight <= 30 && (
                  <div className="w-8 text-xs text-muted-foreground">
                    {count}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderBreakdownChart = () => {
    // Combined analysis
    const highCredibility = data.sources.filter(s => (s.credibilityScore || 75) >= 85)
    const governmentSources = data.sources.filter(s => s.type === 'government')
    const academicSources = data.sources.filter(s => s.type === 'academic')
    const recentSources = data.sources.filter(s => {
      if (!s.publishedDate) return false
      const sourceDate = new Date(s.publishedDate)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      return sourceDate >= sixMonthsAgo
    })

    const insights = [
      {
        label: 'High Credibility Sources',
        value: highCredibility.length,
        total: chartData.totalSources,
        icon: Star,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
        description: 'Sources with credibility score ≥ 85'
      },
      {
        label: 'Authoritative Sources',
        value: governmentSources.length + academicSources.length,
        total: chartData.totalSources,
        icon: Shield,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100 dark:bg-blue-900/20',
        description: 'Government and academic sources'
      },
      {
        label: 'Recent Publications',
        value: recentSources.length,
        total: chartData.totalSources,
        icon: TrendingUp,
        color: 'text-green-600',
        bgColor: 'bg-green-100 dark:bg-green-900/20',
        description: 'Published within last 6 months'
      },
      {
        label: 'Quality Coverage',
        value: Math.round(((highCredibility.length + governmentSources.length + academicSources.length) / chartData.totalSources) * 100),
        total: 100,
        icon: Award,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100 dark:bg-purple-900/20',
        description: 'High-quality source percentage',
        isPercentage: true
      }
    ]

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {insights.map((insight) => {
            const percentage = insight.isPercentage 
              ? insight.value 
              : Math.round((insight.value / insight.total) * 100)

            return (
              <Card key={insight.label} className={cn("border-l-4", insight.bgColor)}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={cn("p-2 rounded-full", insight.bgColor)}>
                        <insight.icon className={cn("w-5 h-5", insight.color)} />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{insight.label}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {insight.description}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("text-2xl font-bold", insight.color)}>
                      {insight.value}{insight.isPercentage ? '%' : ''}
                    </span>
                    <Badge variant="outline">
                      {percentage}%
                    </Badge>
                  </div>
                  
                  <Progress value={percentage} className="h-2" />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  const charts = [
    { id: 'distribution', label: 'Source Types', icon: PieChart },
    { id: 'credibility', label: 'Credibility', icon: Star },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
    { id: 'breakdown', label: 'Analysis', icon: BarChart3 }
  ] as const

  return (
    <Card className={cn("border-2", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Source Analytics</CardTitle>
            <Badge variant="secondary" className="ml-2">
              {chartData.totalSources} sources
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Chart Navigation */}
        <div className="flex flex-wrap gap-2">
          {charts.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={activeChart === id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveChart(id)}
              className="flex items-center space-x-2"
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </Button>
          ))}
        </div>

        {/* Chart Content */}
        <div className="min-h-[300px]">
          {activeChart === 'distribution' && renderDistributionChart()}
          {activeChart === 'credibility' && renderCredibilityChart()}
          {activeChart === 'timeline' && renderTimelineChart()}
          {activeChart === 'breakdown' && renderBreakdownChart()}
        </div>
      </CardContent>
    </Card>
  )
}