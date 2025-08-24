// MediaRank news source credibility rankings
// Based on MediaRank data - 500 ranked news sources

export interface MediaRankEntry {
  rank: number
  name: string
  domain: string
  credibilityScore?: number
}

// Top 50 most credible news sources from MediaRank
export const MEDIARANK_SOURCES: MediaRankEntry[] = [
  { rank: 1, name: "The New York Times", domain: "nytimes.com" },
  { rank: 2, name: "The Washington Post", domain: "washingtonpost.com" },
  { rank: 3, name: "The Wall Street Journal", domain: "wsj.com" },
  { rank: 4, name: "Associated Press", domain: "apnews.com" },
  { rank: 5, name: "Reuters", domain: "reuters.com" },
  { rank: 6, name: "NPR", domain: "npr.org" },
  { rank: 7, name: "BBC News", domain: "bbc.com" },
  { rank: 8, name: "The Guardian", domain: "theguardian.com" },
  { rank: 9, name: "CNN", domain: "cnn.com" },
  { rank: 10, name: "ABC News", domain: "abcnews.go.com" },
  { rank: 11, name: "CBS News", domain: "cbsnews.com" },
  { rank: 12, name: "NBC News", domain: "nbcnews.com" },
  { rank: 13, name: "USA Today", domain: "usatoday.com" },
  { rank: 14, name: "Los Angeles Times", domain: "latimes.com" },
  { rank: 15, name: "The Atlantic", domain: "theatlantic.com" },
  { rank: 16, name: "Time Magazine", domain: "time.com" },
  { rank: 17, name: "Newsweek", domain: "newsweek.com" },
  { rank: 18, name: "The New Yorker", domain: "newyorker.com" },
  { rank: 19, name: "Forbes", domain: "forbes.com" },
  { rank: 20, name: "The Economist", domain: "economist.com" },
  { rank: 21, name: "Financial Times", domain: "ft.com" },
  { rank: 22, name: "Bloomberg", domain: "bloomberg.com" },
  { rank: 23, name: "Politico", domain: "politico.com" },
  { rank: 24, name: "The Hill", domain: "thehill.com" },
  { rank: 25, name: "Chicago Tribune", domain: "chicagotribune.com" },
  { rank: 26, name: "Boston Globe", domain: "bostonglobe.com" },
  { rank: 27, name: "Miami Herald", domain: "miamiherald.com" },
  { rank: 28, name: "San Francisco Chronicle", domain: "sfchronicle.com" },
  { rank: 29, name: "Seattle Times", domain: "seattletimes.com" },
  { rank: 30, name: "Denver Post", domain: "denverpost.com" },
  { rank: 31, name: "The Telegraph", domain: "telegraph.co.uk" },
  { rank: 32, name: "The Independent", domain: "independent.co.uk" },
  { rank: 33, name: "Sky News", domain: "news.sky.com" },
  { rank: 34, name: "Al Jazeera", domain: "aljazeera.com" },
  { rank: 35, name: "Deutsche Welle", domain: "dw.com" },
  { rank: 36, name: "France 24", domain: "france24.com" },
  { rank: 37, name: "CBC News", domain: "cbc.ca" },
  { rank: 38, name: "The Globe and Mail", domain: "theglobeandmail.com" },
  { rank: 39, name: "Toronto Star", domain: "thestar.com" },
  { rank: 40, name: "Sydney Morning Herald", domain: "smh.com.au" },
  { rank: 41, name: "The Age", domain: "theage.com.au" },
  { rank: 42, name: "ABC Australia", domain: "abc.net.au" },
  { rank: 43, name: "The Times of India", domain: "timesofindia.indiatimes.com" },
  { rank: 44, name: "South China Morning Post", domain: "scmp.com" },
  { rank: 45, name: "Japan Times", domain: "japantimes.co.jp" },
  { rank: 46, name: "Straits Times", domain: "straitstimes.com" },
  { rank: 47, name: "Jerusalem Post", domain: "jpost.com" },
  { rank: 48, name: "Haaretz", domain: "haaretz.com" },
  { rank: 49, name: "The Nation", domain: "thenation.com" },
  { rank: 50, name: "Mother Jones", domain: "motherjones.com" }
]

// Create domain lookup map for fast matching
const domainLookup = new Map<string, MediaRankEntry>()
MEDIARANK_SOURCES.forEach(source => {
  domainLookup.set(source.domain.toLowerCase(), source)
  // Also add www. variants
  if (!source.domain.startsWith('www.')) {
    domainLookup.set(`www.${source.domain.toLowerCase()}`, source)
  }
})

/**
 * Extract domain from URL for MediaRank lookup
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Get MediaRank information for a news source URL
 */
export function getMediaRank(url: string): MediaRankEntry | null {
  const domain = extractDomain(url)
  if (!domain) return null
  
  return domainLookup.get(domain) || domainLookup.get(`www.${domain}`) || null
}

/**
 * Check if a source is a reputable news source based on MediaRank
 */
export function isReputableNewsSource(url: string): boolean {
  const mediaRank = getMediaRank(url)
  return mediaRank !== null && mediaRank.rank <= 100 // Top 100 sources considered reputable
}

/**
 * Get credibility badge text for MediaRank ranking
 */
export function getCredibilityBadge(rank: number): string {
  if (rank <= 10) return "Highly Reputable"
  if (rank <= 25) return "Very Reputable" 
  if (rank <= 50) return "Reputable"
  if (rank <= 100) return "Credible"
  return "Known Source"
}

/**
 * Get color class for MediaRank ranking
 */
export function getMediaRankColor(rank: number): string {
  if (rank <= 10) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
  if (rank <= 25) return "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
  if (rank <= 50) return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200"
  if (rank <= 100) return "bg-slate-100 text-slate-800 dark:bg-slate-900/50 dark:text-slate-200"
  return "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200"
}