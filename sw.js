// ================================
// DREAM JOURNAL SERVICE WORKER
// ================================
// PWA service worker for offline functionality, caching, and app updates
// Provides cache-first strategy with network fallback for optimal performance

// ================================
// CACHE CONFIGURATION
// ================================
// Cache name includes version for automatic cache management
// Update this version number when deploying new app versions
const CACHE_NAME = 'dream-journal-v2-02-08';

// Files to cache for offline functionality
// Includes all essential app files for complete offline experience
const urlsToCache = [
  './',                    // Root directory
  './index.html',          // Main HTML file
  './dream-journal.css',   // Application styles
  './constants.js',        // App constants
  './state.js',           // Global state management
  './storage.js',         // IndexedDB operations
  './dom-helpers.js',     // DOM utilities
  './security.js',        // PIN protection and encryption
  './dream-crud.js',      // Dream management
  './voice-notes.js',     // Voice recording
  './goals.js',           // Goals system
  './stats.js',           // Statistics and analytics
  './import-export.js',   // Data import/export
  './action-router.js',   // Event delegation
  './main.js'             // App initialization
];

// ================================
// SERVICE WORKER LIFECYCLE EVENTS
// ================================

/**
 * INSTALL EVENT
 * Triggered when service worker is first installed
 * Caches all essential files for offline use
 */
self.addEventListener('install', (event) => {
  console.log('Dream Journal SW: Installing service worker');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Dream Journal SW: Opened cache', CACHE_NAME);
        // Cache all essential files
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Dream Journal SW: All files cached successfully');
        // Skip waiting to activate the new service worker immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Dream Journal SW: Cache installation failed:', error);
      })
  );
});

/**
 * ACTIVATE EVENT
 * Triggered when service worker becomes active
 * Cleans up old caches and takes control of clients
 */
self.addEventListener('activate', (event) => {
  console.log('Dream Journal SW: Activating service worker');
  
  event.waitUntil(
    // Clean up old caches
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old Dream Journal caches but keep the current one
          if (cacheName !== CACHE_NAME && cacheName.startsWith('dream-journal-')) {
            console.log('Dream Journal SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Dream Journal SW: Old caches cleaned up');
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// ================================
// NETWORK REQUEST HANDLING
// ================================

/**
 * FETCH EVENT
 * Intercepts all network requests and serves from cache first
 * Cache-first strategy with network fallback for optimal performance
 */
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip non-HTTP(S) requests (chrome-extension, etc.)
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    // Try to get from cache first
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          console.log('Dream Journal SW: Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // Not in cache, try network
        console.log('Dream Journal SW: Fetching from network:', event.request.url);
        
        // Clone the request because it's a stream (can only be consumed once)
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response because it's a stream
          const responseToCache = response.clone();

          // Only cache same-origin requests
          if (event.request.url.startsWith(self.location.origin)) {
            caches.open(CACHE_NAME)
              .then((cache) => {
                console.log('Dream Journal SW: Caching new resource:', event.request.url);
                cache.put(event.request, responseToCache);
              });
          }

          return response;
        }).catch((error) => {
          console.log('Dream Journal SW: Network fetch failed, trying cache fallback:', error);
          // If network fails, try to return the main app from cache
          return caches.match('./index.html');
        });
      })
  );
});

// ================================
// BACKGROUND SYNC & MESSAGING
// ================================

/**
 * BACKGROUND SYNC EVENT
 * Handles background synchronization when app comes back online
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Dream Journal SW: Background sync triggered');
    
    event.waitUntil(
      // Notify all app instances that we're back online
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'BACK_ONLINE'
          });
        });
      })
    );
  }
});

/**
 * MESSAGE EVENT
 * Handles messages from the main application
 */
self.addEventListener('message', (event) => {
  console.log('Dream Journal SW: Received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // Force service worker to become active immediately
    self.skipWaiting();
  }
});

// ================================
// NOTIFICATION HANDLING
// ================================

/**
 * NOTIFICATION CLICK EVENT
 * Handles user clicks on push notifications
 * Focuses or opens the app when notifications are clicked
 */
self.addEventListener('notificationclick', (event) => {
  console.log('Dream Journal SW: Notification clicked');
  
  // Close the notification
  event.notification.close();

  event.waitUntil(
    // Try to focus existing app window or open new one
    clients.matchAll().then((clientList) => {
      // Look for an existing app window
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // No existing window found, open new one
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});