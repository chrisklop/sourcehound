"use client"

import { useState, useEffect } from 'react'

interface PWAInstallPrompt {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface UsePWAReturn {
  isInstalled: boolean
  isInstallable: boolean
  isOffline: boolean
  install: () => Promise<void>
  showInstallPrompt: boolean
  dismissInstallPrompt: () => void
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: Event & PWAInstallPrompt
  }
}

export function usePWA(): UsePWAReturn {
  const [isInstalled, setIsInstalled] = useState(false)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<PWAInstallPrompt | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)

  useEffect(() => {
    // Check if app is already installed
    const checkIfInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone === true ||
                          document.referrer.includes('android-app://')
      setIsInstalled(isStandalone)
    }

    // Check online/offline status
    const updateOnlineStatus = () => {
      setIsOffline(!navigator.onLine)
    }

    // Handle install prompt
    const handleBeforeInstallPrompt = (e: Event & PWAInstallPrompt) => {
      e.preventDefault()
      setInstallPrompt(e)
      setIsInstallable(true)
      
      // Show install prompt after a delay (better UX)
      setTimeout(() => {
        if (!isInstalled) {
          setShowInstallPrompt(true)
        }
      }, 5000)
    }

    // Handle app installed
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setShowInstallPrompt(false)
      setInstallPrompt(null)
      console.log('SourceHound PWA was installed')
    }

    // Register service worker
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
          })

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available
                  console.log('New version of SourceHound is available')
                  // Could show update notification here
                }
              })
            }
          })

          console.log('SourceHound Service Worker registered:', registration)
        } catch (error) {
          console.error('SourceHound Service Worker registration failed:', error)
        }
      }
    }

    // Initialize
    checkIfInstalled()
    updateOnlineStatus()
    registerServiceWorker()

    // Event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [isInstalled])

  const install = async () => {
    if (!installPrompt) return

    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      
      if (outcome === 'accepted') {
        console.log('User accepted PWA install')
      } else {
        console.log('User dismissed PWA install')
      }
      
      setInstallPrompt(null)
      setIsInstallable(false)
      setShowInstallPrompt(false)
    } catch (error) {
      console.error('PWA install failed:', error)
    }
  }

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false)
  }

  return {
    isInstalled,
    isInstallable,
    isOffline,
    install,
    showInstallPrompt,
    dismissInstallPrompt
  }
}

// Hook for offline conversation storage
export function useOfflineStorage() {
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    setIsSupported('indexedDB' in window)
  }, [])

  const storeConversations = async (conversations: any[]) => {
    if (!isSupported) return false

    try {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('SourceHoundOffline', 1)
        
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction(['conversations'], 'readwrite')
          const store = transaction.objectStore('conversations')
          
          const putRequest = store.put({
            id: 'pending',
            data: conversations,
            timestamp: Date.now()
          })
          
          putRequest.onsuccess = () => resolve(true)
          putRequest.onerror = () => reject(putRequest.error)
        }
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains('conversations')) {
            db.createObjectStore('conversations', { keyPath: 'id' })
          }
        }
      })
    } catch (error) {
      console.error('Failed to store conversations offline:', error)
      return false
    }
  }

  const getOfflineConversations = async () => {
    if (!isSupported) return null

    try {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('SourceHoundOffline', 1)
        
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction(['conversations'], 'readonly')
          const store = transaction.objectStore('conversations')
          const getRequest = store.get('pending')
          
          getRequest.onsuccess = () => {
            const result = getRequest.result
            resolve(result ? result.data : null)
          }
          getRequest.onerror = () => reject(getRequest.error)
        }
      })
    } catch (error) {
      console.error('Failed to get offline conversations:', error)
      return null
    }
  }

  const syncWhenOnline = async () => {
    if (!isSupported || navigator.onLine) return

    try {
      // Register for background sync if supported
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready
        await (registration as any).sync.register('sync-conversations')
      }
    } catch (error) {
      console.error('Failed to register background sync:', error)
    }
  }

  return {
    isSupported,
    storeConversations,
    getOfflineConversations,
    syncWhenOnline
  }
}