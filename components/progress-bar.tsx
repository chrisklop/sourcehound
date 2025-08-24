"use client"

import { useEffect, useState } from "react"
import { CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react"

interface ProgressUpdate {
  step: string
  status: "starting" | "in-progress" | "completed" | "error"
  message?: string
  details?: string
  progress: number
  timestamp: number
  slug?: string
}

interface ProgressBarProps {
  sessionId: string
  onComplete?: (data: any) => void
  onError?: (error: string) => void
}

export function ProgressBar({ sessionId, onComplete, onError }: ProgressBarProps) {
  const [updates, setUpdates] = useState<ProgressUpdate[]>([])
  const [currentProgress, setCurrentProgress] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    let pollInterval: NodeJS.Timeout
    let lastUpdateCount = 0

    const pollForUpdates = async () => {
      try {
        console.log("[v0] ProgressBar polling for sessionId:", sessionId)
        const response = await fetch(`/api/fact-check-progress?sessionId=${sessionId}`)
        if (!response.ok) throw new Error("Failed to fetch progress")

        const data = await response.json()
        const newUpdates = data.updates || []

        // Only update if we have new updates
        if (newUpdates.length > lastUpdateCount) {
          setUpdates(newUpdates)
          lastUpdateCount = newUpdates.length

          const latestUpdate = newUpdates[newUpdates.length - 1]
          if (latestUpdate) {
            setCurrentProgress(latestUpdate.progress)

            // Check both the latest update and the API's isComplete flag
            if ((latestUpdate.status === "completed" && latestUpdate.progress === 100) || data.isComplete) {
              console.log("[v0] ProgressBar: Completion detected, calling onComplete callback")
              setIsComplete(true)
              clearInterval(pollInterval)
              onComplete?.(latestUpdate)
            } else if (latestUpdate.status === "error") {
              clearInterval(pollInterval)
              onError?.(latestUpdate.details || latestUpdate.message)
            }
          }
        }
        
        // Also check for completion even if no new updates (in case we missed it)
        if (data.isComplete && !isComplete) {
          console.log("[v0] ProgressBar: API indicates completion, calling onComplete callback")
          setIsComplete(true)
          clearInterval(pollInterval)
          const latestUpdate = newUpdates[newUpdates.length - 1]
          onComplete?.(latestUpdate)
        }
      } catch (error) {
        console.error("[v0] Progress polling error:", error)
        // Don't call onError for polling failures, just log them
      }
    }

    // Start polling immediately, then every 500ms
    pollForUpdates()
    pollInterval = setInterval(pollForUpdates, 500)

    return () => {
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [sessionId, onComplete, onError])

  const getActualStepStatus = (update: ProgressUpdate, index: number, allUpdates: ProgressUpdate[]) => {
    // Simplified logic: just use the actual status from the API
    // The API now properly marks completed steps
    return update.status
  }

  const getStepIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
      case "in-progress":
      case "starting":
        return <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />
    }
  }

  const latestUpdate = updates[updates.length - 1]

  return (
    <div className="w-full p-6 bg-card border border-border shadow-lg rounded-xl">
      {/* Main Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-foreground">Fact-Checking Analysis</h3>
          <span className="text-sm font-medium text-muted-foreground">{Math.round(currentProgress)}%</span>
        </div>

        <div className="w-full bg-muted/30 rounded-full h-3 mb-2">
          <div
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-400 dark:to-emerald-500 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${currentProgress}%` }}
          />
        </div>

        {latestUpdate && latestUpdate.status !== "completed" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getStepIcon(latestUpdate.status)}
            <span className="font-medium">{latestUpdate.message || `${latestUpdate.step} in progress...`}</span>
          </div>
        )}
      </div>

      {/* Detailed Steps - 3 Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {updates.map((update, index) => {
          const actualStatus = getActualStepStatus(update, index, updates)

          return (
            <div
              key={`${update.step}-${update.timestamp}`}
              className={`flex flex-col items-start gap-2 p-4 rounded-lg transition-all duration-300 ${
                index === updates.length - 1
                  ? "bg-muted/50 dark:bg-emerald-950/30 border border-muted-foreground/20 dark:border-emerald-800/50"
                  : "bg-muted/30 border border-border/50"
              }`}
            >
              <div className="flex items-center gap-2 w-full">
                <div className="flex-shrink-0">{getStepIcon(actualStatus)}</div>
                <p className="text-sm font-medium text-foreground flex-1">{update.message || update.step}</p>
              </div>
              <div className="w-full text-xs text-muted-foreground">
                {new Date(update.timestamp).toLocaleTimeString()}
              </div>
              {update.details && (
                <p className="text-xs text-muted-foreground w-full">{update.details}</p>
              )}
            </div>
          )
        })}
      </div>

      {isComplete && (
        <div className="mt-4 p-3 bg-muted/50 dark:bg-emerald-950/30 border border-muted-foreground/20 dark:border-emerald-800/50 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-foreground dark:text-emerald-200">
              Analysis complete! Loading results...
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
