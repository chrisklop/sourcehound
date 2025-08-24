// Server-side source credibility assessment (simplified for server use)

export type SourceType = 'government' | 'academic' | 'news' | 'factcheck' | 'encyclopedia' | 'social' | 'other'

export interface CredibilityAssessment {
  score: number
  badge: string
  sourceType: SourceType
  reasoning: string
  mediaRank?: {
    rank: number
    outlet: string
    score: number
  }
}

/**
 * Simplified source type detection for server-side use
 */
export function detectSourceType(url: string, title?: string): SourceType {
  const domain = url.toLowerCase()
  
  // Government sources
  if (domain.includes('.gov') || domain.includes('.mil') || 
      domain.includes('europa.eu') || domain.includes('who.int') ||
      domain.includes('cdc.gov') || domain.includes('epa.gov') ||
      domain.includes('nasa.gov') || domain.includes('noaa.gov')) {
    return 'government'
  }
  
  // Academic sources
  if (domain.includes('.edu') || domain.includes('arxiv.org') ||
      domain.includes('pubmed') || domain.includes('scholar.google') ||
      domain.includes('researchgate') || domain.includes('nature.com') ||
      domain.includes('science.org') || domain.includes('cell.com') ||
      domain.includes('springer.com') || domain.includes('wiley.com') ||
      domain.includes('elsevier.com') || domain.includes('ieee.org') ||
      domain.includes('acm.org') || domain.includes('jstor.org')) {
    return 'academic'
  }
  
  // Fact-checking sources
  if (domain.includes('snopes.com') || domain.includes('factcheck.org') ||
      domain.includes('politifact.com') || domain.includes('fullfact.org') ||
      domain.includes('factchecker') || domain.includes('truthorfiction') ||
      domain.includes('checkyourfact') || domain.includes('afp.com/factcheck')) {
    return 'factcheck'
  }
  
  // Encyclopedia
  if (domain.includes('wikipedia.org') || domain.includes('britannica.com') ||
      domain.includes('encyclopedia')) {
    return 'encyclopedia'
  }
  
  // News sources (basic detection)
  if (domain.includes('reuters.com') || domain.includes('ap.org') ||
      domain.includes('bbc.') || domain.includes('cnn.com') ||
      domain.includes('nytimes.com') || domain.includes('washingtonpost.com') ||
      domain.includes('theguardian.com') || domain.includes('wsj.com') ||
      domain.includes('npr.org') || domain.includes('pbs.org') ||
      domain.includes('news') || domain.includes('times') ||
      domain.includes('post') || domain.includes('herald') ||
      domain.includes('tribune') || domain.includes('journal')) {
    return 'news'
  }
  
  // Social media
  if (domain.includes('twitter.com') || domain.includes('x.com') ||
      domain.includes('facebook.com') || domain.includes('instagram.com') ||
      domain.includes('tiktok.com') || domain.includes('youtube.com') ||
      domain.includes('reddit.com') || domain.includes('linkedin.com')) {
    return 'social'
  }
  
  return 'other'
}

/**
 * Basic credibility scoring for server-side use
 */
export function assessSourceCredibility(
  url: string,
  title?: string,
  publishedDate?: string
): CredibilityAssessment {
  const sourceType = detectSourceType(url, title)
  let score = 50 // Base score
  let reasoning = ''
  
  // Score by source type
  switch (sourceType) {
    case 'government':
      score = 95
      reasoning = 'Government source - official and authoritative'
      break
    case 'academic':
      score = 90
      reasoning = 'Academic source - peer-reviewed and scholarly'
      break
    case 'factcheck':
      score = 85
      reasoning = 'Fact-checking organization - professional verification'
      break
    case 'encyclopedia':
      score = 80
      reasoning = 'Encyclopedia - curated and referenced content'
      break
    case 'news':
      score = 75
      reasoning = 'News source - journalistic standards'
      break
    case 'social':
      score = 30
      reasoning = 'Social media - user-generated content'
      break
    default:
      score = 50
      reasoning = 'General web source - requires verification'
  }
  
  // Date freshness factor
  if (publishedDate) {
    const pubDate = new Date(publishedDate)
    const daysSince = Math.floor((Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSince < 30) {
      score += 5 // Recent content bonus
      reasoning += '; recent publication'
    } else if (daysSince > 365 * 3) {
      score -= 10 // Old content penalty
      reasoning += '; older content'
    }
  }
  
  // Clamp score
  score = Math.max(10, Math.min(100, score))
  
  // Determine badge
  let badge = ''
  if (score >= 90) badge = 'Excellent'
  else if (score >= 80) badge = 'Very Good'
  else if (score >= 70) badge = 'Good'
  else if (score >= 50) badge = 'Fair'
  else badge = 'Poor'
  
  return {
    score,
    badge,
    sourceType,
    reasoning
  }
}