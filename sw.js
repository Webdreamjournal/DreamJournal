/**
 * @fileoverview Dream Journal Progressive Web App Service Worker.
 * 
 * This service worker provides comprehensive PWA functionality including offline support,
 * resource caching, automatic updates, and background synchronization. It implements a
 * cache-first strategy with network fallback to ensure optimal performance and reliability
 * even when the user is offline or has poor connectivity.
 * 
 * The service worker manages:
 * - Installation and activation lifecycle with automatic cache updates
 * - Cache-first network request interception with intelligent fallbacks
 * - Automatic cleanup of outdated caches during updates
 * - Background synchronization for connectivity restoration
 * - Push notification handling and app focusing
 * - Cross-client messaging for status updates
 * 
 * **Caching Strategy:**
 * 1. **Cache First**: Always check cache before network for faster loading
 * 2. **Network Fallback**: Fetch from network if not cached, then cache the result
 * 3. **Offline Fallback**: Serve main app from cache if network fails completely
 * 4. **Selective Caching**: Only cache same-origin GET requests for security
 * 
 * **Update Strategy:**
 * - Version-based cache names enable automatic updates
 * - Old caches are automatically cleaned up during activation
 * - Service worker can be force-updated via message passing
 * 
 * @version 2.04.00
 * @author Dream Journal Development Team
 * @since 2.0.0
 * @example
 * // Service worker is registered automatically by main.js:
 * // navigator.serviceWorker.register('./sw.js')
 * 
 * // Force service worker update:
 * // navigator.serviceWorker.controller.postMessage({type: 'SKIP_WAITING'})
 */

// ================================
// DREAM JOURNAL SERVICE WORKER
// ================================
// PWA service worker for offline functionality, caching, and app updates
// Provides cache-first strategy with network fallback for optimal performance

// ================================
// CACHE CONFIGURATION
// ================================

/**
 * Cache name with version identifier for automatic cache management.
 * 
 * The version number is incremented with each app deployment to ensure users
 * receive updates automatically. When this changes, old caches are cleaned up
 * during the service worker activation phase.
 * 
 * @constant {string}
 * @since 2.0.0
 */

const CACHE_NAME = 'dream-journal-v2-04-38';

/**
 * List of essential files to cache for complete offline functionality.
 * 
 * This array contains all critical application resources needed for the app
 * to function completely offline. The cache includes:
 * - Core HTML/CSS/JS files
 * - Application modules and dependencies
 * - Static assets (icons, data files)
 * - All JavaScript modules for full functionality
 * 
 * Files are cached during service worker installation and serve as the foundation
 * for offline operation. The cache-first strategy ensures these files load quickly
 * from cache even when online.
 * 
 * @constant {string[]}
 * @since 2.0.0
 */
const urlsToCache = [
  './',                    // Root directory
  './index.html',          // Main HTML file
  './app.css',   // Application styles
  './icons/logo.png',      // App logo
  './tips.json',           // Dream tips data
  './constants.js',        // App constants
  './state.js',           // Global state management
  './storage.js',         // IndexedDB operations
  './dom-helpers.js',     // DOM utilities
  './security.js',        // PIN protection and encryption
  './dream-crud.js',      // Dream management
  './voice-notes.js',     // Voice recording
  './goalstab.js',        // Goals system
  './statstab.js',        // Statistics and analytics
  './import-export.js',   // Data import/export
  './action-router.js',   // Event delegation
  './main.js'             // App initialization
];

// ================================
// SERVICE WORKER LIFECYCLE EVENTS
// ================================

/**
 * Service worker installation event handler.
 * 
 * Triggered when the service worker is first installed or when a new version
 * becomes available. This handler caches all essential application files to
 * enable complete offline functionality.
 * 
 * The installation process:
 * 1. Opens the versioned cache storage
 * 2. Adds all files from urlsToCache to the cache
 * 3. Calls skipWaiting() to activate immediately
 * 4. Handles any caching errors gracefully
 * 
 * The event.waitUntil() ensures the installation doesn't complete until all
 * files are successfully cached, preventing incomplete offline functionality.
 * 
 * @function
 * @param {ExtendableEvent} event - Service worker install event
 * @listens install
 * @since 2.0.0
 * @example
 * // Triggered automatically by browser when service worker updates
 * // self.addEventListener('install', (event) => { ... })
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
 * Service worker activation event handler.
 * 
 * Triggered when the service worker becomes active, either for the first time
 * or after an update. This handler performs cleanup operations and takes control
 * of all app instances.
 * 
 * The activation process:
 * 1. Identifies and deletes outdated Dream Journal caches
 * 2. Preserves the current cache version
 * 3. Takes immediate control of all open app instances
 * 4. Logs cleanup operations for debugging
 * 
 * Cache cleanup ensures that storage space isn't consumed by obsolete cached
 * resources while maintaining the current version's cache for optimal performance.
 * 
 * @function
 * @param {ExtendableEvent} event - Service worker activate event
 * @listens activate
 * @since 2.0.0
 * @example
 * // Triggered automatically after service worker installation
 * // self.addEventListener('activate', (event) => { ... })
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
 * Network request interception handler implementing cache-first strategy.
 * 
 * This handler intercepts all network requests and serves them using a cache-first
 * approach with intelligent fallbacks. The strategy provides optimal performance
 * by serving cached resources immediately while maintaining up-to-date content.
 * 
 * **Request Flow:**
 * 1. Check if resource exists in cache
 * 2. If cached, serve immediately (fast response)
 * 3. If not cached, fetch from network
 * 4. Cache successful network responses for future use
 * 5. If network fails, attempt offline fallback to main app
 * 
 * **Filtering Logic:**
 * - Only processes GET requests (safe operations)
 * - Skips non-HTTP(S) requests (extensions, file://, etc.)
 * - Only caches same-origin responses for security
 * - Validates response status before caching
 * 
 * This approach ensures the app loads quickly from cache while keeping content
 * fresh and providing graceful offline fallbacks.
 * 
 * @function
 * @param {FetchEvent} event - Service worker fetch event containing request details
 * @listens fetch
 * @since 2.0.0
 * @example
 * // Triggered automatically for all network requests
 * // self.addEventListener('fetch', (event) => { ... })
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
 * Background synchronization event handler.
 * 
 * Handles background sync events triggered when the app regains connectivity
 * after being offline. This enables the app to perform deferred operations
 * and notify all open instances that connectivity has been restored.
 * 
 * **Sync Process:**
 * 1. Listens for 'background-sync' tagged events
 * 2. Finds all open app instances (clients)
 * 3. Posts 'BACK_ONLINE' message to each client
 * 4. Allows app instances to refresh data or retry failed operations
 * 
 * This feature enables graceful handling of connectivity changes and helps
 * maintain data consistency across network interruptions.
 * 
 * @function
 * @param {SyncEvent} event - Background sync event with tag identifier
 * @listens sync
 * @since 2.0.0
 * @example
 * // Triggered when network connectivity is restored
 * // navigator.serviceWorker.ready.then(reg => reg.sync.register('background-sync'))
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
 * Inter-context messaging handler.
 * 
 * Handles messages sent from the main application to the service worker,
 * enabling bidirectional communication between the app and service worker contexts.
 * This allows the app to control service worker behavior and request specific actions.
 * 
 * **Supported Message Types:**
 * - `SKIP_WAITING`: Forces immediate service worker activation
 * - Future: Could handle cache refresh, sync triggers, etc.
 * 
 * The messaging system enables the app to control update timing and trigger
 * service worker operations as needed for optimal user experience.
 * 
 * @function
 * @param {ExtendableMessageEvent} event - Message event containing data from main app
 * @listens message
 * @since 2.0.0
 * @example
 * // Send message from main app to service worker:
 * // navigator.serviceWorker.controller.postMessage({type: 'SKIP_WAITING'})
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
 * Push notification click event handler.
 * 
 * Handles user interactions with push notifications by managing app window focus
 * and navigation. When users click notifications, this handler ensures they're
 * taken to the appropriate app instance or opens a new one if needed.
 * 
 * **Click Handling Process:**
 * 1. Closes the clicked notification
 * 2. Searches for existing app windows/tabs
 * 3. Focuses existing window if found
 * 4. Opens new app window if no existing instance
 * 5. Ensures smooth user experience across notification interactions
 * 
 * This provides seamless notification-to-app navigation, preventing multiple
 * app instances while ensuring users can always access the app from notifications.
 * 
 * @function
 * @param {NotificationEvent} event - Notification click event with notification details
 * @listens notificationclick
 * @since 2.0.0
 * @example
 * // Triggered automatically when user clicks push notifications
 * // self.addEventListener('notificationclick', (event) => { ... })
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