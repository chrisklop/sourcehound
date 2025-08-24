import { getMediaRank, getCredibilityBadge, getMediaRankColor } from "@/lib/mediarank"

interface Source {
  rank: number
  url: string
  title: string
  publisher?: string
  publishedAt?: string
  type: "primary" | "secondary" | "factcheck" | "academic" | "news" | "government"
}

interface SourcesTableProps {
  sources: Source[]
}

export function SourcesTable({ sources }: SourcesTableProps) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case "primary":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
      case "factcheck":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
      case "academic":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200"
      case "government":
        return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200"
      case "news":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "primary":
        return "Primary Source"
      case "factcheck":
        return "Fact Check"
      case "secondary":
        return "Secondary Source"
      case "academic":
        return "Academic"
      case "government":
        return "Government"
      case "news":
        return "News"
      default:
        return type
    }
  }

  const PrimaryBadgeIcon = () => (
    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  )

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border border-border rounded-lg"
        role="table"
        aria-label="Sources used for fact-checking"
      >
        <thead className="bg-muted/50">
          <tr role="row">
            <th
              className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              role="columnheader"
              scope="col"
            >
              Rank
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              role="columnheader"
              scope="col"
            >
              Source
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              role="columnheader"
              scope="col"
            >
              Publisher
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              role="columnheader"
              scope="col"
            >
              Date
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              role="columnheader"
              scope="col"
            >
              Type
            </th>
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-border" role="rowgroup">
          {sources.map((source, index) => (
            <tr key={index} className="hover:bg-muted/50 transition-colors" role="row">
              <td className="px-4 py-3 text-sm font-medium" role="cell">
                <div className="flex items-center gap-2">
                  {source.rank}
                  {source.type === "primary" && (
                    <div className="flex items-center" title="Primary Source - Authoritative and direct">
                      <PrimaryBadgeIcon />
                    </div>
                  )}
                </div>
              </td>
              <td className="px-4 py-3" role="cell">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 rounded transition-colors"
                  aria-describedby={`source-${index}-desc`}
                >
                  {source.title}
                </a>
                <span id={`source-${index}-desc`} className="sr-only">
                  Opens in new tab
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground" role="cell">
                {source.publisher || "Unknown"}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground" role="cell">
                {source.publishedAt ? new Date(source.publishedAt).toLocaleDateString() : "—"}
              </td>
              <td className="px-4 py-3" role="cell">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(source.type)}`}
                    aria-label={getTypeLabel(source.type)}
                  >
                    {source.type === "primary" && <PrimaryBadgeIcon />}
                    {getTypeLabel(source.type)}
                  </span>
                  
                  {/* MediaRank badge for news sources */}
                  {source.type === "news" && (() => {
                    const mediaRank = getMediaRank(source.url)
                    if (mediaRank) {
                      return (
                        <span
                          className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getMediaRankColor(mediaRank.rank)}`}
                          title={`MediaRank #${mediaRank.rank} - ${getCredibilityBadge(mediaRank.rank)}`}
                        >
                          #{mediaRank.rank} {getCredibilityBadge(mediaRank.rank)}
                        </span>
                      )
                    }
                    return null
                  })()}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}