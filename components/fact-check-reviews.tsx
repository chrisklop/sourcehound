interface FactCheckReview {
  publisher: string
  title: string
  url: string
  rating?: string
  reviewedAt?: string
}

interface FactCheckReviewsProps {
  reviews: FactCheckReview[]
}

export function FactCheckReviews({ reviews }: FactCheckReviewsProps) {
  if (reviews.length === 0) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {reviews.map((review, index) => (
        <div key={index} className="border border-border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-foreground text-sm leading-tight">{review.title}</h3>
              {review.rating && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded flex-shrink-0">
                  {review.rating}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span className="font-medium">{review.publisher}</span>
              {review.reviewedAt && <span>{new Date(review.reviewedAt).toLocaleDateString()}</span>}
            </div>

            <a
              href={review.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
            >
              Read full review
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}
