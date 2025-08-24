import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

interface QueryLog {
  id: string
  timestamp: string
  queryHash: string
  success: boolean
  processingTimeMs?: number
  resultType?: string
  errorType?: string
  sourceCount?: number
  method?: string
}

// Use environment-aware storage: in-memory for Vercel, file for local dev
const IS_VERCEL = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
const LOG_FILE = '/tmp/genuverity-query-log.json'

// In-memory storage for Vercel (will reset between deployments)
let inMemoryLogs: QueryLog[] = []

// Hash the query for privacy while keeping it useful for analysis
function hashQuery(query: string): string {
  return crypto.createHash('sha256').update(query.toLowerCase().trim()).digest('hex').substring(0, 16)
}

// Load existing logs (environment-aware)
async function loadLogs(): Promise<QueryLog[]> {
  if (IS_VERCEL) {
    // Use in-memory storage for Vercel
    return inMemoryLogs
  }
  
  try {
    const data = await fs.readFile(LOG_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    // File doesn't exist yet, return empty array
    return []
  }
}

// Save logs (environment-aware)
async function saveLogs(logs: QueryLog[]): Promise<void> {
  if (IS_VERCEL) {
    // Store in memory for Vercel
    inMemoryLogs = [...logs]
    return
  }
  
  try {
    await fs.writeFile(LOG_FILE, JSON.stringify(logs, null, 2))
  } catch (error) {
    console.error('[QueryLogger] Failed to save logs:', error)
  }
}

// Log a query attempt
export async function logQuery(query: string, success: boolean, metadata: {
  processingTimeMs?: number
  resultType?: string
  errorType?: string
  sourceCount?: number
  method?: string
} = {}): Promise<void> {
  try {
    const logs = await loadLogs()
    
    const logEntry: QueryLog = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      queryHash: hashQuery(query),
      success,
      ...metadata
    }
    
    logs.push(logEntry)
    
    // Keep only last 1000 entries to prevent file from growing too large
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000)
    }
    
    await saveLogs(logs)
    
    console.log(`[QueryLogger] Logged query: ${success ? 'SUCCESS' : 'FAILURE'} - Hash: ${logEntry.queryHash} (${IS_VERCEL ? 'in-memory' : 'file'})`)
  } catch (error) {
    console.error('[QueryLogger] Failed to log query:', error)
  }
}

// Get analytics (for future use)
export async function getQueryAnalytics(): Promise<{
  totalQueries: number
  successRate: number
  averageProcessingTime: number
  topErrorTypes: Record<string, number>
  queryFrequency: Record<string, number>
}> {
  try {
    const logs = await loadLogs()
    
    const successfulLogs = logs.filter(log => log.success)
    const successRate = logs.length > 0 ? (successfulLogs.length / logs.length) * 100 : 0
    
    const processingTimes = successfulLogs
      .filter(log => log.processingTimeMs)
      .map(log => log.processingTimeMs!)
    
    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
      : 0
    
    const errorTypes: Record<string, number> = {}
    logs.filter(log => !log.success && log.errorType).forEach(log => {
      errorTypes[log.errorType!] = (errorTypes[log.errorType!] || 0) + 1
    })
    
    const queryFrequency: Record<string, number> = {}
    logs.forEach(log => {
      queryFrequency[log.queryHash] = (queryFrequency[log.queryHash] || 0) + 1
    })
    
    return {
      totalQueries: logs.length,
      successRate,
      averageProcessingTime,
      topErrorTypes: errorTypes,
      queryFrequency
    }
  } catch (error) {
    console.error('[QueryLogger] Failed to get analytics:', error)
    return {
      totalQueries: 0,
      successRate: 0,
      averageProcessingTime: 0,
      topErrorTypes: {},
      queryFrequency: {}
    }
  }
}