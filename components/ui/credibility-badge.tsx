"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { assessSourceCredibility } from "@/lib/source-credibility"
import { detectSourceType } from "@/lib/source-credibility-server"

// Source type definitions with icons and styling
export const SOURCE_TYPES = {
  government: {
    icon: '🏛️',
    label: 'Government',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    credibilityRange: [90, 95]
  },
  academic: {
    icon: '🎓',
    label: 'Academic',  
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    credibilityRange: [85, 90]
  },
  factcheck: {
    icon: '✅',
    label: 'Fact Check',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', 
    credibilityRange: [80, 85]
  },
  news: {
    icon: '📰',
    label: 'News',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    credibilityRange: [50, 80]
  },
  general: {
    icon: '🌐',
    label: 'Web',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    credibilityRange: [30, 70]
  }
} as const

export type SourceType = keyof typeof SOURCE_TYPES

interface CredibilityBadgeProps {
  sourceType?: SourceType
  credibilityScore?: number
  showScore?: boolean
  showStars?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  // New props for advanced scoring
  sourceUrl?: string
  sourceTitle?: string
  publishedDate?: string
  useAdvancedScoring?: boolean
}

// Generate star rating based on credibility score
function generateStars(score: number): string {
  const stars = Math.round((score / 100) * 5)
  return '⭐'.repeat(Math.max(0, Math.min(5, stars)))
}

// Get credibility level text
function getCredibilityLevel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'High'
  if (score >= 70) return 'Good'
  if (score >= 60) return 'Fair'
  return 'Limited'
}

export function CredibilityBadge({ 
  sourceType, 
  credibilityScore,
  showScore = true,
  showStars = false,
  size = 'md',
  className,
  sourceUrl,
  sourceTitle,
  publishedDate,
  useAdvancedScoring = false
}: CredibilityBadgeProps) {
  // Use advanced scoring if URL provided and enabled
  let finalSourceType = sourceType
  let score = credibilityScore

  if (useAdvancedScoring && sourceUrl) {
    const assessment = assessSourceCredibility(sourceUrl, sourceTitle, publishedDate)
    finalSourceType = assessment.sourceType === 'other' ? 'general' : assessment.sourceType as SourceType
    score = assessment.score
  } else if (!finalSourceType && sourceUrl) {
    // Fallback to basic detection if no source type provided
    const detected = detectSourceType(sourceUrl, sourceTitle)
    finalSourceType = detected === 'other' ? 'general' : detected as SourceType
  }

  // Default to 'general' if still no source type
  finalSourceType = finalSourceType || 'general'
  
  const sourceConfig = SOURCE_TYPES[finalSourceType]
  
  // Use calculated score or generate from range if none provided
  if (!score) {
    score = Math.floor(
      Math.random() * (sourceConfig.credibilityRange[1] - sourceConfig.credibilityRange[0]) + 
      sourceConfig.credibilityRange[0]
    )
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2.5 py-1.5', 
    lg: 'text-base px-3 py-2'
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Main source type badge */}
      <Badge 
        variant="secondary"
        className={cn(
          sourceConfig.color,
          sizeClasses[size],
          "font-medium border-0"
        )}
      >
        <span className="mr-1.5">{sourceConfig.icon}</span>
        {sourceConfig.label}
      </Badge>

      {/* Credibility score */}
      {showScore && (
        <Badge 
          variant="outline"
          className={cn(
            sizeClasses[size],
            score >= 90 ? 'border-green-500 text-green-700 dark:text-green-400' :
            score >= 80 ? 'border-blue-500 text-blue-700 dark:text-blue-400' :
            score >= 70 ? 'border-yellow-500 text-yellow-700 dark:text-yellow-400' :
            'border-red-500 text-red-700 dark:text-red-400'
          )}
        >
          {score}/100
        </Badge>
      )}

      {/* Star rating */}
      {showStars && (
        <span 
          className={cn(
            "text-yellow-500",
            size === 'sm' ? 'text-xs' :
            size === 'md' ? 'text-sm' : 'text-base'
          )}
          title={`${generateStars(score).length}/5 stars`}
        >
          {generateStars(score)}
        </span>
      )}
    </div>
  )
}


// Export utility for testing
export { generateStars, getCredibilityLevel }