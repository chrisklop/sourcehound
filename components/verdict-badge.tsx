interface VerdictBadgeProps {
  verdict: "True" | "False" | "Mixed" | "Unclear" | "Needs More Evidence"
  className?: string
}

export function VerdictBadge({ verdict, className = "" }: VerdictBadgeProps) {
  const getVerdictStyles = (verdict: string) => {
    switch (verdict) {
      case "True":
        return "bg-emerald-100 text-emerald-800 border-emerald-200"
      case "False":
        return "bg-rose-100 text-rose-800 border-rose-200"
      case "Mixed":
      case "Unclear":
        return "bg-amber-100 text-amber-800 border-amber-200"
      case "Needs More Evidence":
        return "bg-slate-100 text-slate-800 border-slate-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getVerdictStyles(verdict)} ${className}`}
    >
      {verdict}
    </span>
  )
}
