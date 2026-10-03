/**
 * @fileoverview Dream Journal Progressive Web App Service Worker.
 * 
 * This service worker provides comprehensive PWA functionality including offline support,
 * resource caching, automatic updates, and background synchronization. It implements a
 * network-first strategy with cache fallback to ensure optimal performance and reliability
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
 * @version 2.05.06
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
// Provides network-first strategy with cache fallback for optimal performance

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

const CACHE_NAME = 'dream-journal-v2-05-06';

/** Maximum time to wait for the network before falling back to the cache. */
const NETWORK_TIMEOUT_MS = 4000;

/** Set to true while debugging the service worker; logging is silent otherwise. */
const DEBUG = false;
const debugLog = (...args) => { if (DEBUG) console.log('Dream Journal SW:', ...args); };

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
 * for offline operation. Requests are served network-first (see the fetch handler),
 * so these cached copies are the offline fallback.
 * 
 * @constant {string[]}
 * @since 2.0.0
 */
const urlsToCache = [
  './',                    // Root directory
  './index.html',          // Main HTML file
  './src/app.js',          // ES Module entry point
  './theme-init.js',       // Theme initialisation
  './unsupported-browser.js', // Old-browser fallback message
  './manifest.json',       // PWA manifest
  './icons/icon-192.png',  // PWA icons
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './app.css',             // Application styles
  './icons/logo.png',      // App logo
  './tips.json',           // Dream tips data
  './constants.js',        // App constants
  './version.js',          // App version
  './logger.js',           // Debug logging gate
  './device-key.js',       // Device key for token storage
  './dialog-focus.js',     // Focus handling for modal dialogs
  './state.js',            // Global state management
  './storage.js',          // IndexedDB operations
  './dom-helpers.js',      // DOM utilities

  './ui-basics.js',           // UI building blocks and escaping

  './preferences.js',         // Theme and pagination preferences

  './format-helpers.js',      // Date and chart formatting

  './info-tooltips.js',       // Info and help tooltips

  './collapsible-sections.js',// Collapsible sections

  './autocomplete-ui.js',     // Autocomplete interface

  './tips-and-goals-ui.js',   // Tips and goal elements

  './pin-screen.js',          // PIN screen rendering

  './tab-navigation.js',      // Tab navigation
  './form-validation.js',  // Form validation system
  './security.js',         // PIN protection and encryption

  './security-crypto.js',     // AES-GCM and PBKDF2 helpers

  './pin-core.js',            // PIN hashing, lockout and storage

  './encryption-settings.js', // Encryption settings and dialogs

  './pin-controls.js',        // Settings PIN controls

  './lock-screen.js',         // Lock screen

  './pin-recovery.js',        // PIN recovery

  './pin-overlay.js',         // PIN overlay and setup

  './encryption-auth.js',     // Start-up authentication
  './dream-crud.js',       // Dream management
  './voice-notes.js',      // Voice recording
  './pwa.js',              // PWA installation system
  './journaltab.js',       // Journal tab rendering
  './goalstab.js',         // Goals system
  './statstab.js',         // Statistics and analytics
  './advicetab.js',        // Advice tab rendering
  './settingstab.js',      // Settings tab rendering
  './import-export.js',    // Data import/export
  './action-router.js',    // Event delegation
  './cloud-sync.js',       // Cloud synchronization
  './main.js'              // App initialization
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
  debugLog('Installing service worker');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        debugLog('Opened cache', CACHE_NAME);
        // Cache all essential files
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        debugLog('All files cached successfully');
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
  debugLog('Activating service worker');
  
  event.waitUntil(
    // Clean up old caches
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old Dream Journal caches but keep the current one
          if (cacheName !== CACHE_NAME && cacheName.startsWith('dream-journal-')) {
            debugLog('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      debugLog('Old caches cleaned up');
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// ================================
// NETWORK REQUEST HANDLING
// ================================

/**
 * Network request interception handler implementing a network-first strategy.
 *
 * Fresh code is preferred so deployments reach users without a manual cache-name bump;
 * the cache is the offline fallback.
 *
 * **Request flow (same-origin GET requests only):**
 * 1. Try the network, waiting at most NETWORK_TIMEOUT_MS
 * 2. On success, refresh the cached copy and return the response
 * 3. On failure or timeout, serve the cached copy
 * 4. For page navigations with nothing cached, fall back to the cached app shell
 *
 * **Safety rules:**
 * - Cross-origin requests are not intercepted (the browser handles them directly)
 * - Navigations are cached under './index.html' only, and any URL carrying OAuth
 *   parameters (code/state/error) is never written to the cache
 * - Non-navigation requests never receive index.html as a fallback (a script or
 *   stylesheet that resolves to HTML only causes confusing errors)
 *
 * @function
 * @param {FetchEvent} event - Service worker fetch event containing request details
 * @listens fetch
 * @since 2.0.0
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Only handle same-origin http(s) requests
  if (!url.protocol.startsWith('http') || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(networkFirst(request, url));
});

/**
 * Fetches from the network with a timeout, updating the cache; falls back to the cache.
 *
 * @param {Request} request - The intercepted request
 * @param {URL} url - Parsed request URL
 * @returns {Promise<Response>} Network response, cached response, or an offline error response
 */
async function networkFirst(request, url) {
  const isNavigation = request.mode === 'navigate';
  const cacheKey = isNavigation ? './index.html' : request;

  try {
    const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);

    if (response && response.status === 200 && response.type === 'basic' && !hasOAuthParams(url)) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy)).catch(() => {});
    }
    return response;
  } catch (error) {
    debugLog('Network failed, trying cache:', request.url, error);

    const cached = await caches.match(cacheKey);
    if (cached) {
      return cached;
    }
    return new Response('Offline and not cached', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/**
 * Rejects if the network does not answer within the timeout, so the cache can take over.
 *
 * @param {Request} request - Request to send
 * @param {number} timeoutMs - Maximum wait in milliseconds
 * @returns {Promise<Response>} The network response
 */
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout')), timeoutMs);
    fetch(request).then(
      (response) => { clearTimeout(timer); resolve(response); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

/**
 * Detects OAuth redirect parameters so authorisation codes are never cached.
 *
 * @param {URL} url - Request URL
 * @returns {boolean} True if the URL carries code, state or error parameters
 */
function hasOAuthParams(url) {
  return url.searchParams.has('code') || url.searchParams.has('state') || url.searchParams.has('error');
}

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
    debugLog('Background sync triggered');
    
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
  debugLog('Received message:', event.data);
  
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
  debugLog('Notification clicked');
  
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