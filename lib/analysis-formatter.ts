/**
 * Utility functions for formatting analysis text display
 */

/**
 * Transforms numbered analysis format into header-based format
 * Removes verdict numbers and confidence levels, converts to clean headers
 */
export function formatAnalysisText(text: string): string {
  if (!text) return text
  
  console.log('[formatAnalysisText] Input length:', text.length)
  console.log('[formatAnalysisText] Input preview:', text.substring(0, 300) + '...')

  let formatted = text

  // Handle the new API format that starts with **Analysis Summary** **False.**
  formatted = formatted
    // Convert **Analysis Summary** **Verdict** to clean header format
    .replace(/\*\*Analysis Summary\*\*\s*\*\*([^*]+)\*\*\s*/gi, '### Analysis Summary\n\n**Verdict:** $1\n\n')
    
    // Remove "Claim X:" prefixes and make them main headers  
    .replace(/\*\*Claim \d+:\s*([^*]+)\*\*/g, '## $1')
    
    // Remove numbered sections completely (verdict, confidence) with more flexible matching
    .replace(/\d+\.\s*\*\*Verdict:\*\*[^\n]*\n?/gi, '')
    .replace(/\d+\.\s*\*\*Confidence level:\*\*[^\n]*\n?/gi, '')
    
    // Convert numbered sections to headers with flexible spacing
    .replace(/\d+\.\s*\*\*Summary of findings:\*\*\s*/gi, '### Summary\n\n')
    .replace(/\d+\.\s*\*\*Key supporting points:\*\*\s*/gi, '### Key Evidence\n\n')
    .replace(/\d+\.\s*\*\*([^:]*?):\*\*\s*/gi, '### $1\n\n')
    
    // Handle current API alternative formats (from screenshot) - more specific patterns
    .replace(/---\s*\*\*Key Evidence\*\*\s*/gi, '\n\n### Key Evidence\n\n')
    .replace(/---\s*\*\*Detailed Findings\*\*\s*/gi, '\n\n### Detailed Findings\n\n')
    .replace(/\*\*Key Evidence\*\*\s*/gi, '### Key Evidence\n\n')
    .replace(/\*\*Detailed Findings\*\*\s*/gi, '### Detailed Findings\n\n')
    .replace(/\*\*Summary:\*\*\s*/gi, '### Summary\n\n')
    .replace(/\*\*Key points:\*\*\s*/gi, '### Key Evidence\n\n')
    .replace(/\*\*Supporting evidence:\*\*\s*/gi, '### Key Evidence\n\n')
    .replace(/\*\*Analysis:\*\*\s*/gi, '### Analysis\n\n')
    .replace(/\*\*Conclusion:\*\*\s*/gi, '### Conclusion\n\n')
    
    // Clean up excessive bold formatting in content
    .replace(/\*\*([^*]{1,50}):\*\*/g, '**$1:**')  // Keep section labels bold but cleaner
    .replace(/\*\*([^*]{2,10})\*\*\s*\*\*([^*]{2,10})\*\*/g, '**$1 $2**')  // Merge adjacent bold
    
    // Final cleanup - remove any remaining verdict/confidence lines
    .replace(/\d+\.\s*\*\*[^:]*(?:confidence|verdict)[^:]*:\*\*[^\n]*\n?/gi, '')
    
    // Clean up spacing
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[\n\s]+|[\n\s]+$/g, '')

  console.log('[formatAnalysisText] Output length:', formatted.length)  
  console.log('[formatAnalysisText] Output preview:', formatted.substring(0, 300) + '...')
  console.log('[formatAnalysisText] Changed:', text !== formatted)
  
  return formatted
}

/**
 * Applies green header styling to formatted analysis text
 */
export function styleAnalysisHeaders(text: string): string {
  if (!text) return text

  return text
    // Style main claim headers with larger green styling
    .replace(/## ([^\n]+)/g, '<h2 class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-4 mt-6">$1</h2>')
    
    // Style section headers with green styling
    .replace(/### ([^\n]+)/g, '<h3 class="text-lg font-semibold text-emerald-600 dark:text-emerald-400 mb-3 mt-5">$1</h3>')
    
    // Style bullet points
    .replace(/^- (.+)$/gm, '<div class="ml-4 mb-2 text-foreground">• $1</div>')
}

/**
 * Combined function to format and style analysis text
 */
export function processAnalysisText(text: string): string {
  const formatted = formatAnalysisText(text)
  return styleAnalysisHeaders(formatted)
}