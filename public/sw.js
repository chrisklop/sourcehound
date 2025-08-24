// Service Worker for SourceHound PWA
// Version 1.0.0

const CACHE_NAME = 'sourcehound-v1.0.0'
const STATIC_CACHE_NAME = 'sourcehound-static-v1.0.0'
const API_CACHE_NAME = 'sourcehound-api-v1.0.0'

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/enhanced',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
]

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /^.*\/api\/sessions$/,
  /^.*\/api\/health$/,
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('SourceHound SW: Installing...')
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_ASSETS)
      }),
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  )
})

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('SourceHound SW: Activating...')
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE_NAME && 
                cacheName !== API_CACHE_NAME) {
              console.log('SourceHound SW: Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  )
})

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }
  
  // Handle different types of requests
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE_NAME))
  } else if (isAPIRequest(request)) {
    event.respondWith(networkFirstStrategy(request, API_CACHE_NAME))
  } else if (isPageRequest(request)) {
    event.respondWith(staleWhileRevalidateStrategy(request, CACHE_NAME))
  } else {
    event.respondWith(networkFirstStrategy(request, CACHE_NAME))
  }
})

// Check if request is for static assets
function isStaticAsset(request) {
  const url = new URL(request.url)
  return url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/) ||
         url.pathname === '/manifest.json'
}

// Check if request is for API
function isAPIRequest(request) {
  const url = new URL(request.url)
  return url.pathname.startsWith('/api/') ||
         API_CACHE_PATTERNS.some(pattern => pattern.test(request.url))
}

// Check if request is for a page
function isPageRequest(request) {
  const url = new URL(request.url)
  return request.mode === 'navigate' || 
         url.pathname === '/' || 
         url.pathname.startsWith('/enhanced')
}

// Cache First Strategy - for static assets
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.log('SourceHound SW: Cache first failed:', error)
    // Return offline fallback if available
    return await getOfflineFallback(request)
  }
}

// Network First Strategy - for API calls
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      // Only cache successful responses
      if (request.url.includes('/api/sessions') || 
          request.url.includes('/api/health')) {
        cache.put(request, networkResponse.clone())
      }
    }
    return networkResponse
  } catch (error) {
    console.log('SourceHound SW: Network first failed, trying cache:', error)
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    // Return offline response for API calls
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'This feature requires an internet connection'
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Stale While Revalidate Strategy - for pages
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  }).catch(() => {
    // Network failed, return cached version
    return cachedResponse
  })
  
  // Return cached version immediately if available, otherwise wait for network
  return cachedResponse || fetchPromise
}

// Get offline fallback response
async function getOfflineFallback(request) {
  if (isPageRequest(request)) {
    const cache = await caches.open(STATIC_CACHE_NAME)
    return await cache.match('/') || new Response('Offline', { status: 503 })
  }
  
  return new Response('Offline', { status: 503 })
}

// Background sync for conversation data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-conversations') {
    event.waitUntil(syncConversations())
  }
})

// Sync conversations when back online
async function syncConversations() {
  try {
    console.log('SourceHound SW: Syncing conversations...')
    
    // Get pending conversations from IndexedDB
    const pendingData = await getPendingConversations()
    
    if (pendingData && pendingData.length > 0) {
      // Send to server
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversations: pendingData })
      })
      
      if (response.ok) {
        await clearPendingConversations()
        console.log('SourceHound SW: Conversations synced successfully')
      }
    }
  } catch (error) {
    console.error('SourceHound SW: Sync failed:', error)
  }
}

// IndexedDB helpers for offline storage
function getPendingConversations() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SourceHoundOffline', 1)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction(['conversations'], 'readonly')
      const store = transaction.objectStore('conversations')
      const getRequest = store.get('pending')
      
      getRequest.onsuccess = () => resolve(getRequest.result?.data || [])
      getRequest.onerror = () => reject(getRequest.error)
    }
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('conversations')) {
        db.createObjectStore('conversations', { keyPath: 'id' })
      }
    }
  })
}

function clearPendingConversations() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SourceHoundOffline', 1)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction(['conversations'], 'readwrite')
      const store = transaction.objectStore('conversations')
      const deleteRequest = store.delete('pending')
      
      deleteRequest.onsuccess = () => resolve()
      deleteRequest.onerror = () => reject(deleteRequest.error)
    }
  })
}

// Handle push notifications (future feature)
self.addEventListener('push', (event) => {
  if (!event.data) return
  
  const data = event.data.json()
  const options = {
    body: data.body || 'New update available',
    icon: '/icon-192x192.png',
    badge: '/icon-96x96.png',
    tag: 'sourcehound-notification',
    data: data.url || '/'
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'SourceHound', options)
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  const url = event.notification.data || '/'
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clients => {
      // Check if there's already a window open
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }
      
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})

console.log('SourceHound Service Worker loaded')