"use client"

import { useState } from 'react'
import { Play } from 'lucide-react'
import { VideoSource } from '@/lib/video-utils'

interface VideoEmbedProps {
  video: VideoSource
  className?: string
}

export function YouTubeEmbed({ video, className = "" }: VideoEmbedProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  
  return (
    <div className={`relative aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden ${className}`}>
      {!isLoaded && (
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer group"
          onClick={() => setIsLoaded(true)}
        >
          {video.thumbnail && (
            <img 
              src={video.thumbnail}
              alt={video.title || 'Video thumbnail'}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
          <Play className="w-16 h-16 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
        </div>
      )}
      
      {isLoaded && (
        <iframe
          src={video.embedUrl}
          title={video.title || 'YouTube video'}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  )
}

export function TikTokEmbed({ video, className = "" }: VideoEmbedProps) {
  return (
    <div className={`relative aspect-[9/16] max-w-sm bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden ${className}`}>
      <iframe
        src={`https://www.tiktok.com/embed/v2/${video.id}`}
        title={video.title || 'TikTok video'}
        className="w-full h-full"
        allow="encrypted-media;"
        allowFullScreen
      />
    </div>
  )
}

interface VideoGridProps {
  videos: VideoSource[]
}

export function VideoGrid({ videos }: VideoGridProps) {
  if (videos.length === 0) {
    return (
      <div className="text-center py-12">
        <Play className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">No video sources found for this fact-check</p>
      </div>
    )
  }
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {videos.map((video, index) => (
        <div key={`${video.platform}-${video.id}`} className="space-y-3">
          {video.platform === 'youtube' ? (
            <YouTubeEmbed video={video} />
          ) : (
            <TikTokEmbed video={video} />
          )}
          
          {video.title && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm line-clamp-2">{video.title}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="capitalize">{video.platform}</span>
                <span>•</span>
                <a 
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                >
                  View original
                </a>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}