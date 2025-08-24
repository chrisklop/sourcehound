"use client"

import { getTrackedURL, type ExternalLinkProps } from '@/lib/utm-tracking'

/**
 * External link component that automatically adds UTM tracking parameters
 * This helps destination sites' analytics show traffic came from GenuVerity
 */
export function TrackedExternalLink({
  href,
  children,
  className = '',
  sourceType,
  sourceRank,
  factCheckQuery,
  pageSection,
  customUTM,
  ...props
}: ExternalLinkProps & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  
  const trackedURL = getTrackedURL(href, {
    sourceType,
    sourceRank,
    factCheckQuery,
    pageSection,
    customUTM
  })
  
  return (
    <a
      href={trackedURL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      {...props}
    >
      {children}
    </a>
  )
}

/**
 * Simple wrapper for source links in fact-check results
 */
export function SourceLink({
  source,
  children,
  className = '',
  factCheckQuery,
  pageSection = 'sources'
}: {
  source: any
  children: React.ReactNode
  className?: string
  factCheckQuery?: string
  pageSection?: string
}) {
  return (
    <TrackedExternalLink
      href={source.url}
      sourceType={source.type}
      sourceRank={source.rank}
      factCheckQuery={factCheckQuery}
      pageSection={pageSection}
      className={className}
    >
      {children}
    </TrackedExternalLink>
  )
}

/**
 * Citation link wrapper for inline citations
 */
export function CitationLink({
  source,
  children,
  className = '',
  factCheckQuery
}: {
  source: any
  children: React.ReactNode
  className?: string
  factCheckQuery?: string
}) {
  return (
    <TrackedExternalLink
      href={source.url}
      sourceType={source.type}
      sourceRank={source.rank}
      factCheckQuery={factCheckQuery}
      pageSection="citation"
      customUTM={{
        utm_campaign: 'citation-reference',
        utm_content: 'inline-citation'
      }}
      className={className}
    >
      {children}
    </TrackedExternalLink>
  )
}