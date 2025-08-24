import { SourceFilters } from '@/components/source-filters'

export interface FilterableSource {
  url: string
  title: string
  type?: string
  sourceType?: string
  credibilityScore?: number
  publishedAt?: string
  publishedDate?: string
  date?: string
  citationCount?: number
  relevanceScore?: number
  rank?: number
}

export function applySourceFilters(
  sources: FilterableSource[], 
  filters: SourceFilters
): FilterableSource[] {
  let filtered = [...sources]

  // Filter by source type
  if (filters.sourceTypes.length > 0) {
    filtered = filtered.filter(source => {
      const sourceType = source.type || source.sourceType || 'general'
      return filters.sourceTypes.includes(sourceType)
    })
  }

  // Filter by credibility range
  filtered = filtered.filter(source => {
    const credibility = source.credibilityScore || 75
    return credibility >= filters.credibilityRange[0] && 
           credibility <= filters.credibilityRange[1]
  })

  // Filter by date range
  if (filters.dateRange !== 'all') {
    const now = new Date()
    const cutoffDate = new Date()
    
    switch (filters.dateRange) {
      case 'week':
        cutoffDate.setDate(now.getDate() - 7)
        break
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1)
        break
      case 'year':
        cutoffDate.setFullYear(now.getFullYear() - 1)
        break
    }

    filtered = filtered.filter(source => {
      const sourceDate = source.publishedAt || source.publishedDate || source.date
      if (!sourceDate) return true // Keep sources without dates
      
      const publishedDate = new Date(sourceDate)
      return publishedDate >= cutoffDate
    })
  }

  // Filter by minimum citations
  if (filters.minCitations > 0) {
    filtered = filtered.filter(source => {
      const citations = source.citationCount || 0
      return citations >= filters.minCitations
    })
  }

  // Sort results
  filtered.sort((a, b) => {
    let aValue: number
    let bValue: number

    switch (filters.sortBy) {
      case 'credibility':
        aValue = a.credibilityScore || 75
        bValue = b.credibilityScore || 75
        break
      case 'date':
        const aDate = a.publishedAt || a.publishedDate || a.date || '2000-01-01'
        const bDate = b.publishedAt || b.publishedDate || b.date || '2000-01-01'
        aValue = new Date(aDate).getTime()
        bValue = new Date(bDate).getTime()
        break
      case 'citations':
        aValue = a.citationCount || 0
        bValue = b.citationCount || 0
        break
      case 'relevance':
      default:
        aValue = a.relevanceScore || a.rank || 0
        bValue = b.relevanceScore || b.rank || 0
        break
    }

    if (filters.sortOrder === 'asc') {
      return aValue - bValue
    } else {
      return bValue - aValue
    }
  })

  return filtered
}

export function getSourceFilterStats(sources: FilterableSource[]) {
  const totalSources = sources.length
  
  // Source type distribution
  const typeStats = sources.reduce((acc, source) => {
    const type = source.type || source.sourceType || 'general'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Credibility statistics
  const credibilityScores = sources.map(s => s.credibilityScore || 75)
  const credibilityStats = {
    min: Math.min(...credibilityScores),
    max: Math.max(...credibilityScores),
    avg: Math.round(credibilityScores.reduce((sum, score) => sum + score, 0) / credibilityScores.length)
  }

  // Date range analysis
  const dates = sources
    .map(s => s.publishedAt || s.publishedDate || s.date)
    .filter(Boolean)
    .map(date => new Date(date!))
    .sort((a, b) => a.getTime() - b.getTime())
  
  const dateStats = {
    earliest: dates.length > 0 ? dates[0] : null,
    latest: dates.length > 0 ? dates[dates.length - 1] : null,
    total: dates.length
  }

  return {
    totalSources,
    typeStats,
    credibilityStats,
    dateStats
  }
}

export function generateFilterSummary(filters: SourceFilters, totalSources: number): string {
  const parts: string[] = []

  if (filters.sourceTypes.length > 0) {
    parts.push(`${filters.sourceTypes.length} source type${filters.sourceTypes.length > 1 ? 's' : ''}`)
  }

  if (filters.credibilityRange[0] > 0 || filters.credibilityRange[1] < 100) {
    parts.push(`credibility ${filters.credibilityRange[0]}-${filters.credibilityRange[1]}`)
  }

  if (filters.dateRange !== 'all') {
    parts.push(`from ${filters.dateRange}`)
  }

  if (filters.minCitations > 0) {
    parts.push(`min ${filters.minCitations} citations`)
  }

  if (parts.length === 0) {
    return `Showing all ${totalSources} sources`
  }

  return `Filtering by ${parts.join(', ')}`
}