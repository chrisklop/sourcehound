interface InfoBoxProps {
  result?: {
    verdict: {
      label: "True" | "False" | "Mixed" | "Unclear" | "Needs More Evidence"
      confidence: number
    }
    sources: Array<{
      type: "primary" | "secondary" | "factcheck" | "academic" | "news" | "government"
      publisher?: string
    }>
    factCheckReviews: Array<{
      publisher: string
    }>
    errors?: {
      perplexity?: string
      google?: string
    }
  }
}

export function InfoBox({ result }: InfoBoxProps) {
  if (!result) return null

  const sources = result.sources || []
  const factCheckSources = sources.filter((s) => s.type === "factcheck").length
  const primarySources = sources.filter((s) => s.type === "primary").length
  const secondarySources = sources.filter((s) => s.type === "secondary").length
  const academicSources = sources.filter((s) => s.type === "academic").length
  const governmentSources = sources.filter((s) => s.type === "government").length
  const newsSources = sources.filter((s) => s.type === "news").length

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <h3 className="font-semibold text-foreground mb-3">Analysis Details</h3>

      <div className="space-y-3 text-sm">
        <div>
          <dt className="font-medium text-foreground">Verdict</dt>
          <dd className="text-muted-foreground mt-1">{result.verdict?.label || "Unclear"}</dd>
        </div>

        <div>
          <dt className="font-medium text-foreground">Total Sources</dt>
          <dd className="text-muted-foreground mt-1">{sources.length}</dd>
        </div>

        {factCheckSources > 0 && (
          <div>
            <dt className="font-medium text-foreground">Fact-Check Sources</dt>
            <dd className="text-muted-foreground mt-1">{factCheckSources}</dd>
          </div>
        )}

        {primarySources > 0 && (
          <div>
            <dt className="font-medium text-foreground">Primary Sources</dt>
            <dd className="text-muted-foreground mt-1">{primarySources}</dd>
          </div>
        )}

        {secondarySources > 0 && (
          <div>
            <dt className="font-medium text-foreground">Secondary Sources</dt>
            <dd className="text-muted-foreground mt-1">{secondarySources}</dd>
          </div>
        )}

        {academicSources > 0 && (
          <div>
            <dt className="font-medium text-foreground">Academic Sources</dt>
            <dd className="text-muted-foreground mt-1">{academicSources}</dd>
          </div>
        )}

        {governmentSources > 0 && (
          <div>
            <dt className="font-medium text-foreground">Government Sources</dt>
            <dd className="text-muted-foreground mt-1">{governmentSources}</dd>
          </div>
        )}

        {newsSources > 0 && (
          <div>
            <dt className="font-medium text-foreground">News Sources</dt>
            <dd className="text-muted-foreground mt-1">{newsSources}</dd>
          </div>
        )}

        {(result.factCheckReviews || []).length > 0 && (
          <div>
            <dt className="font-medium text-foreground">Human Reviews</dt>
            <dd className="text-muted-foreground mt-1">
              {(result.factCheckReviews || []).length} professional fact-checks
            </dd>
          </div>
        )}

        <div>
          <dt className="font-medium text-foreground">Analysis Status</dt>
          <dd className="mt-1">
            {result.errors?.perplexity && result.errors?.google ? (
              <span className="text-red-600 dark:text-red-400 text-xs">Limited (services unavailable)</span>
            ) : result.errors?.perplexity ? (
              <span className="text-amber-600 dark:text-amber-400 text-xs">Partial (AI analysis limited)</span>
            ) : result.errors?.google ? (
              <span className="text-amber-600 dark:text-amber-400 text-xs">Partial (reviews unavailable)</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 text-xs">Complete</span>
            )}
          </dd>
        </div>
      </div>
    </div>
  )
}
