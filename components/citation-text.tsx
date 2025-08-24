"use client"

import { renderTextWithClickableCitations } from './citation-link'
import { processAnalysisText } from '@/lib/analysis-formatter'

interface CitationTextProps {
  text: string
  sources: any[]
  onTabChange?: (tab: string) => void
  className?: string
  formatAnalysis?: boolean
}

export function CitationText({ text, sources, onTabChange, className, formatAnalysis = false }: CitationTextProps) {
  // Auto-detect if this text needs formatting based on content patterns
  const needsFormatting = formatAnalysis || (text && (
    text.includes('**Claim 1:') || 
    text.includes('**Claim 2:') || 
    text.includes('1. **Verdict:**') || 
    text.includes('2. **Confidence level:**') ||
    text.includes('3. **Summary of findings:**') ||
    text.includes('4. **Key supporting points:**') ||
    /\d+\.\s*\*\*Verdict\*\*/.test(text) ||
    /\d+\.\s*\*\*Confidence level\*\*/.test(text) ||
    // More aggressive patterns to catch all numbered format variations
    /\*\*Claim \d+:/.test(text) ||
    /\d+\.\s*\*\*[^:]*\*\*/.test(text) ||
    // New patterns for current API format
    text.includes('**Analysis Summary**') ||
    text.includes('**Key Evidence**') ||
    text.includes('**Detailed Findings**') ||
    // Detect excessive asterisk formatting that needs cleanup
    (text.match(/\*\*[^*]+\*\*\s*\*\*[^*]+\*\*/g)?.length || 0) > 2
  ))
  
  console.log('[CitationText] Text preview:', text ? text.substring(0, 200) + '...' : 'no text')
  console.log('[CitationText] Text needs formatting:', needsFormatting, 'formatAnalysis:', formatAnalysis)
  console.log('[CitationText] Detection checks:', {
    hasClaim1: text?.includes('**Claim 1:'),
    hasVerdict: text?.includes('1. **Verdict:**'),
    hasConfidence: text?.includes('2. **Confidence level:**'),
    hasSummary: text?.includes('3. **Summary of findings:**'),
    hasKeyPoints: text?.includes('4. **Key supporting points:**'),
    regexVerdict: text ? /\d+\.\s*\*\*Verdict\*\*/.test(text) : false,
    regexConfidence: text ? /\d+\.\s*\*\*Confidence level\*\*/.test(text) : false,
    regexClaim: text ? /\*\*Claim \d+:/.test(text) : false,
    regexNumbered: text ? /\d+\.\s*\*\*[^:]*\*\*/.test(text) : false,
    // New format detection
    hasAnalysisSummary: text?.includes('**Analysis Summary**'),
    hasKeyEvidence: text?.includes('**Key Evidence**'),
    hasDetailedFindings: text?.includes('**Detailed Findings**'),
    excessiveAsterisks: text ? (text.match(/\*\*[^*]+\*\*\s*\*\*[^*]+\*\*/g)?.length || 0) > 2 : false
  })
  
  // Process the text to convert numbered format to headers if needed
  // Always apply formatting when formatAnalysis=true, regardless of auto-detection
  const processedText = (needsFormatting || formatAnalysis) ? processAnalysisText(text) : text
  
  if (needsFormatting || formatAnalysis) {
    // For formatted analysis, render as HTML with styled headers
    const htmlContent = renderTextWithClickableCitations({ 
      text: processedText, 
      sources, 
      onTabChange,
      isFormatted: true
    })
    
    // Debug logging
    console.log('[CitationText] Original text:', text?.substring(0, 100) + '...')
    console.log('[CitationText] Processed text:', processedText?.substring(0, 100) + '...')
    console.log('[CitationText] HTML content type:', typeof htmlContent)
    console.log('[CitationText] HTML content preview:', 
      typeof htmlContent === 'string' ? htmlContent.substring(0, 100) + '...' : 'React elements')
    
    return (
      <div 
        className={className}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    )
  }
  
  // For regular text, render normally
  return (
    <div className={className}>
      {renderTextWithClickableCitations({ text: processedText, sources, onTabChange })}
    </div>
  )
}

/**
 * Hook to handle tab changes for citation clicks
 */
export function useCitationHandler() {
  const handleTabChange = (tab: string) => {
    // This could be enhanced to trigger actual tab changes in the parent component
    console.log('[Citation] Switching to tab:', tab)
  }

  return { handleTabChange }
}