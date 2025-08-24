export function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-pulse">
      {/* Main content skeleton */}
      <div className="lg:col-span-3 space-y-8">
        {/* Header skeleton */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-6 w-20 bg-gray-200 rounded-full" />
            <div className="h-6 w-16 bg-gray-200 rounded" />
          </div>
          <div className="h-8 w-3/4 bg-gray-200 rounded" />
          <div className="flex items-center gap-4 border-b border-gray-200 pb-4">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
        </div>

        {/* Summary skeleton */}
        <div className="space-y-3">
          <div className="h-6 w-24 bg-gray-200 rounded" />
          <div className="h-4 w-full bg-gray-200 rounded" />
          <div className="h-4 w-2/3 bg-gray-200 rounded" />
        </div>

        {/* Key Points skeleton */}
        <div className="space-y-3">
          <div className="h-6 w-28 bg-gray-200 rounded" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 bg-gray-200 rounded-full mt-2" />
                <div className="h-4 flex-1 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Explanation skeleton */}
        <div className="space-y-3">
          <div className="h-6 w-32 bg-gray-200 rounded" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-full bg-gray-200 rounded" />
                <div className="h-4 w-5/6 bg-gray-200 rounded" />
                <div className="h-4 w-3/4 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Sources skeleton */}
        <div className="space-y-3">
          <div className="h-6 w-20 bg-gray-200 rounded" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 border border-gray-200 rounded">
                <div className="h-4 w-8 bg-gray-200 rounded" />
                <div className="h-4 flex-1 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar skeleton */}
      <div className="hidden lg:block space-y-4">
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="h-5 w-24 bg-gray-200 rounded" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
            <div className="h-4 w-1/2 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
