interface VideoEmbedProps {
  sources: Array<{
    url: string
    title: string
    publisher?: string
  }>
}

export function VideoEmbed({ sources }: VideoEmbedProps) {
  // Filter for embeddable video sources
  const videoSources = sources.filter(source => {
    const url = source.url.toLowerCase()
    return (
      url.includes('youtube.com/watch') ||
      url.includes('youtu.be/') ||
      url.includes('vimeo.com/') ||
      url.includes('dailymotion.com/') ||
      url.includes('twitch.tv/') ||
      url.includes('ted.com/talks')
    )
  })

  if (videoSources.length === 0) return null

  // Get the first embeddable video (prioritizing quality sources)
  const primaryVideo = videoSources[0]
  
  const getEmbedUrl = (url: string): string | null => {
    // YouTube
    if (url.includes('youtube.com/watch')) {
      const videoId = url.match(/[?&]v=([^&]+)/)?.[1]
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null
    }
    
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0]
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null
    }
    
    // Vimeo
    if (url.includes('vimeo.com/')) {
      const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1]
      return videoId ? `https://player.vimeo.com/video/${videoId}` : null
    }
    
    // TED Talks
    if (url.includes('ted.com/talks')) {
      const talkId = url.match(/talks\/([^?\/]+)/)?.[1]
      return talkId ? `https://embed.ted.com/talks/${talkId}` : null
    }
    
    return null
  }

  const embedUrl = getEmbedUrl(primaryVideo.url)
  if (!embedUrl) return null

  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground mb-2">Related Video</h3>
        <p className="text-sm text-muted-foreground">
          Video source from {primaryVideo.publisher || 'external provider'}
        </p>
      </div>
      
      <div className="p-4">
        <div className="relative w-full" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
          <iframe
            src={embedUrl}
            title={primaryVideo.title}
            className="absolute top-0 left-0 w-full h-full rounded-lg"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        
        <div className="mt-3">
          <h4 className="font-medium text-sm text-foreground mb-1 line-clamp-2">
            {primaryVideo.title}
          </h4>
          <a
            href={primaryVideo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
          >
            Watch on {primaryVideo.publisher || 'original site'} →
          </a>
        </div>
      </div>
      
      {videoSources.length > 1 && (
        <div className="px-4 pb-4">
          <details className="group">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              +{videoSources.length - 1} more video{videoSources.length - 1 !== 1 ? 's' : ''}
            </summary>
            <div className="mt-2 space-y-2">
              {videoSources.slice(1, 4).map((video, index) => (
                <a
                  key={index}
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors line-clamp-2"
                >
                  {video.title}
                </a>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}