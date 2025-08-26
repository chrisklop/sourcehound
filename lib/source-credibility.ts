// Server-side module for source credibility assessment

import { getMediaRank, type MediaRankEntry } from './mediarank'
import { detectSourceType, type SourceType } from './source-credibility-server'

/**
 * Comprehensive source credibility scoring system
 * Integrates with MediaRank and extends to cover all source types
 */

export interface CredibilityAssessment {
  score: number // 0-100 credibility score
  sourceType: SourceType
  confidence: number // 0-100 confidence in the assessment
  factors: CredibilityFactor[]
  badge: string // Human-readable credibility level
  reasoning: string // Explanation of the score
  mediaRank?: MediaRankEntry // If it's a ranked news source
}

export interface CredibilityFactor {
  factor: string
  impact: number // -50 to +50 points
  description: string
}

/**
 * Domain patterns for high-credibility sources
 */
const CREDIBILITY_PATTERNS = {
  government: {
    domains: [
      '.gov', '.mil', 'who.int', 'europa.eu', 'nih.gov', 'cdc.gov', 'epa.gov',
      'fda.gov', 'nasa.gov', 'noaa.gov', 'census.gov', 'treasury.gov',
      'justice.gov', 'state.gov', 'defense.gov', 'energy.gov', 'commerce.gov',
      'ed.gov', 'hhs.gov', 'dhs.gov', 'va.gov', 'usda.gov', 'dot.gov',
      'doi.gov', 'dol.gov', 'hud.gov', 'sba.gov', 'ssa.gov'
    ],
    baseScore: 90,
    maxScore: 95
  },
  academic: {
    domains: [
      '.edu', 'scholar.google', 'pubmed.ncbi.nlm', 'arxiv.org', 'jstor.org',
      'researchgate.net', 'academia.edu', 'sciencedirect.com', 'springer.com',
      'nature.com', 'science.org', 'cell.com', 'nejm.org', 'bmj.com',
      'thelancet.com', 'plos.org', 'frontiersin.org', 'mdpi.com'
    ],
    baseScore: 85,
    maxScore: 92
  },
  factcheck: {
    domains: [
      'snopes.com', 'factcheck.org', 'politifact.com', 'fullfact.org',
      'checkur.org', 'africacheck.org', 'chequeado.com', 'faktisk.no',
      'afp.com', 'apnews.com/apfactcheck', 'reuters.com/fact-check',
      'washingtonpost.com/news/fact-checker', 'cnn.com/factsfirst',
      'factcheckni.org', 'dubawa.org', 'verafiles.org'
    ],
    baseScore: 80,
    maxScore: 87
  },
  international: {
    domains: [
      'un.org', 'worldbank.org', 'imf.org', 'oecd.org', 'unicef.org',
      'who.int', 'wto.org', 'unesco.org', 'unhcr.org', 'icrc.org'
    ],
    baseScore: 88,
    maxScore: 94
  }
}

/**
 * Suspicious domain patterns that reduce credibility
 */
const SUSPICIOUS_PATTERNS = [
  'fake', 'conspiracy', 'truth', 'exposed', 'secret', 'hidden',
  'leaked', 'shocking', 'banned', 'censored', 'suppressed'
]

/**
 * Known unreliable domains
 */
const UNRELIABLE_DOMAINS = [
  'infowars.com', 'breitbart.com', 'naturalnews.com', 'beforeitsnews.com',
  'worldnewsdailyreport.com', 'nationalreport.net', 'empirenews.net',
  'newswatch33.com', 'dailybuzzlive.com', 'relaynews.com'
]

/**
 * Calculate domain-based credibility score
 */
function calculateDomainScore(url: string, domain: string): { score: number, factors: CredibilityFactor[] } {
  const factors: CredibilityFactor[] = []
  let score = 50 // Base score for unknown domains

  // Check for high-credibility patterns
  for (const [type, config] of Object.entries(CREDIBILITY_PATTERNS)) {
    const matches = config.domains.some(pattern => 
      domain.includes(pattern) || url.includes(pattern)
    )
    if (matches) {
      score = config.baseScore
      factors.push({
        factor: `${type.charAt(0).toUpperCase() + type.slice(1)} Source`,
        impact: config.baseScore - 50,
        description: `Recognized as a ${type} source with high credibility standards`
      })
      break
    }
  }

  // Check MediaRank for news sources
  const mediaRank = getMediaRank(url)
  if (mediaRank) {
    const mediaScore = calculateMediaRankScore(mediaRank.rank)
    if (mediaScore > score) {
      score = mediaScore
      factors.push({
        factor: 'MediaRank Rating',
        impact: mediaScore - 50,
        description: `Ranked #${mediaRank.rank} in MediaRank credibility assessment`
      })
    }
  }

  // Check for suspicious patterns
  const suspiciousCount = SUSPICIOUS_PATTERNS.filter(pattern => 
    domain.toLowerCase().includes(pattern) || url.toLowerCase().includes(pattern)
  ).length

  if (suspiciousCount > 0) {
    const penalty = Math.min(suspiciousCount * 15, 30)
    score -= penalty
    factors.push({
      factor: 'Suspicious Domain Patterns',
      impact: -penalty,
      description: `Domain contains ${suspiciousCount} potentially misleading pattern(s)`
    })
  }

  // Check for known unreliable domains
  if (UNRELIABLE_DOMAINS.some(unreliable => domain.includes(unreliable))) {
    score = Math.min(score, 25)
    factors.push({
      factor: 'Known Unreliable Source',
      impact: -25,
      description: 'Domain is flagged as historically unreliable'
    })
  }

  // Domain age and structure bonuses (simplified heuristics)
  if (domain.length < 40 && !domain.includes('-') && domain.split('.').length <= 3) {
    factors.push({
      factor: 'Clean Domain Structure',
      impact: 5,
      description: 'Domain has clean, professional structure'
    })
    score += 5
  }

  return { score: Math.max(0, Math.min(100, score)), factors }
}

/**
 * Convert MediaRank ranking to credibility score
 */
function calculateMediaRankScore(rank: number): number {
  if (rank <= 10) return 85
  if (rank <= 25) return 80
  if (rank <= 50) return 75
  if (rank <= 100) return 70
  if (rank <= 200) return 65
  return 60
}

/**
 * Generate human-readable credibility badge
 */
function generateCredibilityBadge(score: number, sourceType: SourceType): string {
  if (sourceType === 'government' && score >= 90) return 'Authoritative'
  if (sourceType === 'academic' && score >= 85) return 'Peer Reviewed'
  if (sourceType === 'factcheck' && score >= 80) return 'Professional Verification'
  
  if (score >= 90) return 'Highly Credible'
  if (score >= 80) return 'Very Credible'
  if (score >= 70) return 'Credible'
  if (score >= 60) return 'Moderately Credible'
  if (score >= 50) return 'Limited Credibility'
  return 'Low Credibility'
}

/**
 * Generate reasoning explanation for the credibility score
 */
function generateReasoning(score: number, sourceType: SourceType, factors: CredibilityFactor[], mediaRank?: MediaRankEntry | null): string {
  let reasoning = `This source received a ${score}/100 credibility score based on multiple factors. `

  if (mediaRank) {
    reasoning += `It's ranked #${mediaRank.rank} by MediaRank among news sources. `
  }

  const positiveFactors = factors.filter(f => f.impact > 0)
  const negativeFactors = factors.filter(f => f.impact < 0)

  if (positiveFactors.length > 0) {
    reasoning += `Positive factors include: ${positiveFactors.map(f => f.factor.toLowerCase()).join(', ')}. `
  }

  if (negativeFactors.length > 0) {
    reasoning += `Negative factors include: ${negativeFactors.map(f => f.factor.toLowerCase()).join(', ')}. `
  }

  // Add source type context
  switch (sourceType) {
    case 'government':
      reasoning += 'Government sources are typically considered highly authoritative for official data and policy information.'
      break
    case 'academic':
      reasoning += 'Academic sources undergo peer review and scholarly scrutiny, providing high-quality research-based information.'
      break
    case 'factcheck':
      reasoning += 'Fact-checking organizations specialize in verification and maintain professional standards for accuracy.'
      break
    case 'news':
      reasoning += 'News sources vary in credibility based on editorial standards, fact-checking practices, and historical accuracy.'
      break
    case 'general':
      reasoning += 'General web sources require careful evaluation as they may not follow professional editorial standards.'
      break
  }

  return reasoning
}

/**
 * Calculate confidence in the credibility assessment
 */
function calculateConfidence(sourceType: SourceType, factors: CredibilityFactor[], mediaRank?: MediaRankEntry | null): number {
  let confidence = 60 // Base confidence

  // Higher confidence for well-known source types
  switch (sourceType) {
    case 'government':
    case 'academic':
      confidence += 25
      break
    case 'factcheck':
      confidence += 20
      break
    case 'news':
      confidence += mediaRank ? 20 : 10
      break
    case 'general':
      confidence += 5
      break
  }

  // Higher confidence with more assessment factors
  confidence += Math.min(factors.length * 3, 15)

  return Math.min(100, confidence)
}

/**
 * Main function to assess source credibility
 */
export function assessSourceCredibility(url: string, title?: string, publishedDate?: string): CredibilityAssessment {
  // Extract domain and detect source type
  let domain: string
  try {
    domain = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    domain = url.toLowerCase()
  }

  const sourceType = detectSourceType(url, title)
  
  // Calculate domain-based score
  const { score: domainScore, factors } = calculateDomainScore(url, domain)
  
  // Apply time-based adjustments
  if (publishedDate) {
    try {
      const pubDate = new Date(publishedDate)
      const ageInDays = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24)
      
      if (ageInDays < 7) {
        factors.push({
          factor: 'Recent Publication',
          impact: 3,
          description: 'Recently published content (within 7 days)'
        })
      } else if (ageInDays > 1825) { // 5+ years old
        factors.push({
          factor: 'Older Content',
          impact: -5,
          description: 'Content is over 5 years old, may be outdated'
        })
      }
    } catch {
      // Invalid date, ignore
    }
  }

  // Final score calculation
  const adjustments = factors.reduce((sum, factor) => sum + factor.impact, 0)
  let finalScore = 50 + adjustments
  
  // Ensure score is within bounds
  finalScore = Math.max(0, Math.min(100, finalScore))
  
  // Get MediaRank info if available
  const mediaRank = getMediaRank(url)
  
  // Calculate confidence
  const confidence = calculateConfidence(sourceType, factors, mediaRank)
  
  // Generate badge and reasoning
  const badge = generateCredibilityBadge(finalScore, sourceType)
  const reasoning = generateReasoning(finalScore, sourceType, factors, mediaRank)

  return {
    score: Math.round(finalScore),
    sourceType,
    confidence: Math.round(confidence),
    factors,
    badge,
    reasoning,
    mediaRank: mediaRank || undefined
  }
}

/**
 * Batch assess multiple sources for efficiency
 */
export function assessMultipleSources(sources: Array<{ url: string, title?: string, publishedDate?: string }>): CredibilityAssessment[] {
  return sources.map(source => assessSourceCredibility(source.url, source.title, source.publishedDate))
}

/**
 * Get quick credibility score (lightweight version)
 */
export function getQuickCredibilityScore(url: string): number {
  const assessment = assessSourceCredibility(url)
  return assessment.score
}

/**
 * Filter sources by minimum credibility threshold
 */
export function filterByCredibility(sources: Array<{ url: string, title?: string }>, minScore: number = 60): Array<{ url: string, title?: string, credibilityScore: number }> {
  return sources
    .map(source => ({
      ...source,
      credibilityScore: getQuickCredibilityScore(source.url)
    }))
    .filter(source => source.credibilityScore >= minScore)
    .sort((a, b) => b.credibilityScore - a.credibilityScore)
}

/**
 * Export types and constants for external use
 */
export { CREDIBILITY_PATTERNS, SUSPICIOUS_PATTERNS, UNRELIABLE_DOMAINS }