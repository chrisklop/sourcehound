/**
 * UTM parameter utilities for tracking external link clicks
 * This helps destination sites' analytics show traffic came from GenuVerity
 */

export interface UTMParams {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
}

/**
 * Add UTM parameters to external URLs for analytics tracking
 */
export function addUTMParameters(
  url: string, 
  customParams: Partial<UTMParams> = {}
): string {
  try {
    const urlObj = new URL(url)
    
    // Default UTM parameters for GenuVerity
    const defaultParams: UTMParams = {
      utm_source: 'genuverity',
      utm_medium: 'fact-check',
      utm_campaign: 'source-verification',
      utm_content: 'fact-check-source'
    }
    
    // Merge with custom parameters
    const utmParams = { ...defaultParams, ...customParams }
    
    // Add UTM parameters to URL
    Object.entries(utmParams).forEach(([key, value]) => {
      if (value) {
        urlObj.searchParams.set(key, value)
      }
    })
    
    return urlObj.toString()
  } catch (error) {
    // If URL parsing fails, return original URL
    console.warn('Failed to add UTM parameters to URL:', url, error)
    return url
  }
}

/**
 * Create UTM parameters based on context
 */
export function createContextualUTM(context: {
  sourceType?: string
  sourceRank?: number
  factCheckQuery?: string
  pageSection?: string
}): Partial<UTMParams> {
  const { sourceType, sourceRank, factCheckQuery, pageSection } = context
  
  const utmParams: Partial<UTMParams> = {}
  
  // Customize utm_medium based on source type
  if (sourceType) {
    switch (sourceType) {
      case 'academic':
        utmParams.utm_medium = 'academic-source'
        break
      case 'government':
        utmParams.utm_medium = 'government-source'
        break
      case 'news':
        utmParams.utm_medium = 'news-source'
        break
      case 'factcheck':
        utmParams.utm_medium = 'factcheck-source'
        break
      default:
        utmParams.utm_medium = 'web-source'
    }
  }
  
  // Add source ranking information
  if (sourceRank !== undefined) {
    utmParams.utm_content = `source-rank-${sourceRank}`
  }
  
  // Add fact-check query as campaign term (shortened)
  if (factCheckQuery) {
    const shortQuery = factCheckQuery.length > 50 
      ? factCheckQuery.substring(0, 50).replace(/\s+/g, '-').toLowerCase()
      : factCheckQuery.replace(/\s+/g, '-').toLowerCase()
    utmParams.utm_term = shortQuery
  }
  
  // Customize campaign based on page section
  if (pageSection) {
    utmParams.utm_campaign = `${pageSection}-verification`
  }
  
  return utmParams
}

/**
 * Enhanced external link component props
 */
export interface ExternalLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  sourceType?: string
  sourceRank?: number
  factCheckQuery?: string
  pageSection?: string
  customUTM?: Partial<UTMParams>
}

/**
 * Get tracking-enabled URL for external links
 */
export function getTrackedURL(
  url: string,
  context: {
    sourceType?: string
    sourceRank?: number
    factCheckQuery?: string
    pageSection?: string
    customUTM?: Partial<UTMParams>
  } = {}
): string {
  const { sourceType, sourceRank, factCheckQuery, pageSection, customUTM } = context
  
  // Don't add UTM to internal links or already-parametrized GenuVerity links
  try {
    const urlObj = new URL(url)
    if (urlObj.hostname.includes('genuverity') || urlObj.hostname.includes('localhost')) {
      return url
    }
  } catch {
    // Invalid URL, return as-is
    return url
  }
  
  // Create contextual UTM parameters
  const contextualUTM = createContextualUTM({
    sourceType,
    sourceRank,
    factCheckQuery,
    pageSection
  })
  
  // Merge with custom UTM parameters
  const finalUTM = { ...contextualUTM, ...customUTM }
  
  return addUTMParameters(url, finalUTM)
}

/**
 * Common UTM presets for different use cases
 */
export const UTM_PRESETS = {
  SOURCE_LINK: {
    utm_campaign: 'source-verification',
    utm_content: 'source-citation'
  },
  SUMMARY_LINK: {
    utm_campaign: 'source-summary',
    utm_content: 'summary-overlay'
  },
  CITATION_LINK: {
    utm_campaign: 'citation-reference',
    utm_content: 'inline-citation'
  },
  EXPORT_LINK: {
    utm_campaign: 'report-export',
    utm_content: 'exported-source'
  }
} as const