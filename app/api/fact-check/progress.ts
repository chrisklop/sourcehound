// Progress tracking for fact-check operations
interface ProgressUpdate {
  step: string
  status: "starting" | "in-progress" | "completed" | "error"
  message?: string
  details?: string
  progress: number
  timestamp: number
  slug?: string
}

// In-memory storage for progress updates
const progressStore = new Map<string, ProgressUpdate[]>()

export function updateProgress(sessionId: string, update: ProgressUpdate) {
  if (!sessionId) return

  console.log(`[v0] Progress update for ${sessionId}:`, update)

  if (!progressStore.has(sessionId)) {
    progressStore.set(sessionId, [])
  }

  const updates = progressStore.get(sessionId)!
  
  // Check if we already have an entry for this step
  const existingIndex = updates.findIndex(existing => existing.step === update.step)
  
  if (existingIndex !== -1) {
    // Update the existing entry
    updates[existingIndex] = { ...updates[existingIndex], ...update }
    console.log(`[v0] Updated existing step '${update.step}' with status '${update.status}'`)
  } else {
    // Add new entry
    updates.push(update)
    console.log(`[v0] Added new step '${update.step}' with status '${update.status}'`)
  }

  // Keep only the last 20 updates per session to prevent memory leaks
  if (updates.length > 20) {
    updates.splice(0, updates.length - 20)
  }

  // Clean up old sessions (older than 1 hour)
  const oneHourAgo = Date.now() - 60 * 60 * 1000
  for (const [id, sessionUpdates] of progressStore.entries()) {
    const lastUpdate = sessionUpdates[sessionUpdates.length - 1]
    if (lastUpdate && lastUpdate.timestamp < oneHourAgo) {
      progressStore.delete(id)
    }
  }
}

export function getProgress(sessionId: string): ProgressUpdate[] {
  return progressStore.get(sessionId) || []
}

export function clearProgress(sessionId: string) {
  progressStore.delete(sessionId)
}
