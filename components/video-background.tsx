"use client"

import { useEffect, useRef, useState } from 'react'

export function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playAttempted, setPlayAttempted] = useState(false)
  
  console.log('VideoBackground component rendering')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const attemptPlay = async () => {
      try {
        console.log('Attempting to play video...')
        await video.play()
        setIsPlaying(true)
        console.log('Video is playing successfully!')
      } catch (error) {
        console.warn('Video autoplay failed:', error)
        setIsPlaying(false)
        
        // Try to play on any user interaction
        const playOnInteraction = async () => {
          try {
            await video.play()
            setIsPlaying(true)
            console.log('Video started playing after user interaction')
            document.removeEventListener('click', playOnInteraction)
            document.removeEventListener('keydown', playOnInteraction)
            document.removeEventListener('touchstart', playOnInteraction)
          } catch (err) {
            console.error('Failed to play video even after user interaction:', err)
          }
        }

        document.addEventListener('click', playOnInteraction)
        document.addEventListener('keydown', playOnInteraction)
        document.addEventListener('touchstart', playOnInteraction)
      }
    }

    const handleCanPlay = () => {
      console.log('Video can play')
      if (!playAttempted) {
        setPlayAttempted(true)
        attemptPlay()
      }
    }

    const handleLoadedData = () => console.log('Video data loaded')
    const handleLoadStart = () => console.log('Video load started')
    const handlePlay = () => {
      console.log('Video play event fired')
      setIsPlaying(true)
    }
    const handlePause = () => {
      console.log('Video pause event fired')
      setIsPlaying(false)
    }
    const handleError = (e: Event) => console.error('Video error:', e)

    video.addEventListener('loadstart', handleLoadStart)
    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('error', handleError)

    return () => {
      video.removeEventListener('loadstart', handleLoadStart)
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('error', handleError)
    }
  }, [playAttempted])

  return (
    <>
      {/* Video background with better autoplay handling */}
      <video
        ref={videoRef}
        loop
        muted
        playsInline
        preload="auto"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: -10,
          opacity: isPlaying ? 0.3 : 0.1,
          transition: 'opacity 0.5s ease'
        }}
      >
        <source src="/transbg.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      
      {/* Status indicator */}
      <div
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          background: isPlaying ? 'rgba(0,255,0,0.7)' : 'rgba(255,165,0,0.7)',
          color: 'white',
          padding: '4px 8px',
          fontSize: '12px',
          zIndex: 9999,
          borderRadius: '4px'
        }}
      >
        Video: {isPlaying ? 'Playing' : 'Ready (click to play)'}
      </div>
    </>
  )
}