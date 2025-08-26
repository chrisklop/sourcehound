// Enhanced progress tracking for fact-check operations with full transparency
interface ProgressUpdate {
  step: string
  status: "starting" | "in-progress" | "completed" | "error"
  message?: string
  details?: string
  progress: number
  timestamp: number
  slug?: string
  // Enhanced transparency fields
  substeps?: ProgressSubstep[]
  sourcesFound?: number
  currentAPI?: string
  apiStatus?: { [apiName: string]: 'pending' | 'running' | 'completed' | 'failed' }
  credibilityAnalysis?: {
    highCredibility: number
    mediumCredibility: number
    lowCredibility: number
    mediaRankSources: number
  }
  engineDetails?: {
    perplexity?: { status: string, sources: number, processingTime?: number }
    gemini?: { status: string, sources: number, processingTime?: number }
  }
}

interface ProgressSubstep {
  name: string
  status: "pending" | "running" | "completed" | "failed"
  details?: string
  timestamp: number
  duration?: number
}

// In-memory storage for progress updates
const progressStore = new Map<string, ProgressUpdate[]>()

export function updateProgress(sessionId: string, update: ProgressUpdate) {
  if (!sessionId) return

  console.log(`[Progress] ${sessionId}: ${update.step} - ${update.message}`, {
    progress: `${update.progress}%`,
    sources: update.sourcesFound,
    api: update.currentAPI,
    credibility: update.credibilityAnalysis
  })

  if (!progressStore.has(sessionId)) {
    progressStore.set(sessionId, [])
  }

  const updates = progressStore.get(sessionId)!
  
  // Check if we already have an entry for this step
  const existingIndex = updates.findIndex(existing => existing.step === update.step)
  
  if (existingIndex !== -1) {
    // Update the existing entry with detailed merging
    const existing = updates[existingIndex]
    updates[existingIndex] = { 
      ...existing, 
      ...update,
      // Merge substeps intelligently
      substeps: mergeSubsteps(existing.substeps || [], update.substeps || []),
      // Merge API status
      apiStatus: { ...existing.apiStatus, ...update.apiStatus },
      // Update engine details
      engineDetails: { ...existing.engineDetails, ...update.engineDetails }
    }
    console.log(`[Progress] Updated step '${update.step}' - Status: ${update.status}`)
  } else {
    // Add new entry
    updates.push(update)
    console.log(`[Progress] Added new step '${update.step}' - ${update.message}`)
  }

  // Keep only the last 30 updates per session for detailed tracking
  if (updates.length > 30) {
    updates.splice(0, updates.length - 30)
  }

  // Clean up old sessions (older than 2 hours for better user experience)
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
  for (const [id, sessionUpdates] of progressStore.entries()) {
    const lastUpdate = sessionUpdates[sessionUpdates.length - 1]
    if (lastUpdate && lastUpdate.timestamp < twoHoursAgo) {
      progressStore.delete(id)
    }
  }
}

// Helper function to merge substeps intelligently
function mergeSubsteps(existing: ProgressSubstep[], incoming: ProgressSubstep[]): ProgressSubstep[] {
  const merged = [...existing]
  
  for (const newSubstep of incoming) {
    const existingIndex = merged.findIndex(s => s.name === newSubstep.name)
    if (existingIndex !== -1) {
      // Update existing substep
      merged[existingIndex] = { 
        ...merged[existingIndex], 
        ...newSubstep,
        duration: newSubstep.status === 'completed' && merged[existingIndex].timestamp 
          ? newSubstep.timestamp - merged[existingIndex].timestamp 
          : merged[existingIndex].duration
      }
    } else {
      // Add new substep
      merged.push(newSubstep)
    }
  }
  
  return merged
}

export function getProgress(sessionId: string): ProgressUpdate[] {
  return progressStore.get(sessionId) || []
}

export function clearProgress(sessionId: string) {
  progressStore.delete(sessionId)
}
