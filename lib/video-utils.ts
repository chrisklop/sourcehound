// Video URL detection and processing utilities

export interface VideoSource {
  id: string
  platform: 'youtube' | 'tiktok'
  url: string
  embedUrl: string
  title?: string
  thumbnail?: string
}

// Extract YouTube video ID from various URL formats
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  
  return null
}

// Extract TikTok video ID from URL
export function extractTikTokId(url: string): string | null {
  const match = url.match(/tiktok\.com\/.*\/video\/(\d+)/)
  return match ? match[1] : null
}

// Detect if URL is a video platform
export function isVideoUrl(url: string): boolean {
  return url.includes('youtube.com') || 
         url.includes('youtu.be') || 
         url.includes('tiktok.com')
}

// Convert video URL to embed format
export function getVideoEmbed(url: string, title?: string): VideoSource | null {
  // YouTube
  const youtubeId = extractYouTubeId(url)
  if (youtubeId) {
    return {
      id: youtubeId,
      platform: 'youtube',
      url,
      embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
      title,
      thumbnail: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`
    }
  }
  
  // TikTok
  const tiktokId = extractTikTokId(url)
  if (tiktokId) {
    return {
      id: tiktokId,
      platform: 'tiktok', 
      url,
      embedUrl: url, // TikTok uses original URL for embedding
      title
    }
  }
  
  return null
}

// Extract all video sources from fact-check sources
export function extractVideoSources(sources: any[]): VideoSource[] {
  const videos: VideoSource[] = []
  
  for (const source of sources) {
    if (source.url && isVideoUrl(source.url)) {
      const videoEmbed = getVideoEmbed(source.url, source.title)
      if (videoEmbed) {
        videos.push(videoEmbed)
      }
    }
  }
  
  return videos
}