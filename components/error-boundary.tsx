"use client"

interface ErrorBoundaryProps {
  error: string | null
  timedOut: boolean
  onRetry: () => void
  partialData?: any
}

export function ErrorBoundary({ error, timedOut, onRetry, partialData }: ErrorBoundaryProps) {
  return (
    <div className="space-y-6">
      {/* Error message */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6" role="alert" aria-live="assertive">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              {timedOut ? "Request Timed Out" : "Service Temporarily Unavailable"}
            </h3>
            <p className="text-red-700 mb-4">
              {timedOut
                ? "The fact-check request took longer than expected. This might be due to a complex query or high server load."
                : error || "We're experiencing technical difficulties. Please try again in a moment."}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onRetry}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              >
                Try Again
              </button>
              <a
                href="/"
                className="inline-flex items-center px-4 py-2 bg-white text-red-600 text-sm font-medium rounded-lg border border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              >
                New Search
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Partial data if available */}
      {partialData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">Partial Results Available</h4>
          <p className="text-blue-700 text-sm">
            Some information was retrieved before the error occurred. This data may be incomplete.
          </p>
        </div>
      )}
    </div>
  )
}
