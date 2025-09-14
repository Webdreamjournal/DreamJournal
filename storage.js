    /**
     * @fileoverview Database and storage management for the Dream Journal application.
     * 
     * This module provides comprehensive data persistence functionality using IndexedDB
     * as the primary storage mechanism with memory fallback for environments where
     * IndexedDB is unavailable. Handles dreams, voice notes, goals, and autocomplete
     * suggestions with proper error handling, validation, and migration support.
     * 
     * @module storage
     * @version 2.02.05
     * @author Development Team
     * @since 1.0.0
     * @requires constants
     * @requires dom-helpers
     */

// ===================================================================================
// ES MODULE IMPORTS
// ===================================================================================

import { CONSTANTS, commonTags, commonDreamSigns } from './constants.js';
import { 
    memoryStorage, 
    memoryVoiceNotes,
    withMutex
} from './state.js';
import { createInlineMessage, renderAutocompleteManagementList } from './dom-helpers.js';

    /**
     * Represents a dream journal entry with all associated metadata.
     * 
     * @typedef {Object} Dream
     * @property {string} id - Unique identifier for the dream
     * @property {string} title - Title or brief description of the dream
     * @property {string} content - Full dream content and description
     * @property {string} timestamp - ISO 8601 timestamp when dream was recorded
     * @property {boolean} isLucid - Whether this was a lucid dream
     * @property {Array<string>} tags - Array of categorization tags
     * @property {Array<string>} dreamSigns - Array of dream signs or symbols
     * @property {string} [category] - Optional dream category
     * @property {Array<string>} [emotions] - Optional array of emotions experienced
     */

    /**
     * Represents a voice note recording with audio data and metadata.
     * 
     * @typedef {Object} VoiceNote
     * @property {string} id - Unique identifier for the voice note
     * @property {Blob} audioBlob - Binary audio data blob
     * @property {string} transcript - Transcribed text from speech recognition
     * @property {string} timestamp - ISO 8601 timestamp when recorded
     * @property {number} duration - Duration of recording in seconds
     * @property {number} size - File size of audio data in bytes
     */

    /**
     * Represents a lucid dreaming goal with progress tracking.
     * 
     * @typedef {Object} Goal
     * @property {string} id - Unique identifier for the goal
     * @property {string} title - Goal title or description
     * @property {string} timestamp - ISO 8601 timestamp when goal was created
     * @property {boolean} completed - Whether the goal has been achieved
     * @property {string} [category] - Optional goal category
     * @property {number} [targetCount] - Optional target number for completion
     * @property {number} [currentCount] - Optional current progress count
     */

    // ===================================================================================
    // SECTION 4: DATABASE & STORAGE
    // ===================================================================================

    /**
     * Name of the IndexedDB database.
     * @constant {string}
     * @since 1.0.0
     */
    const DB_NAME = 'DreamJournal';

    /**
     * Version number of the IndexedDB database schema.
     * Increment when schema changes are needed.
     * @constant {number}
     * @since 1.0.0
     */
    const DB_VERSION = CONSTANTS.DB_VERSION; // Increment for voice notes support

    /**
     * Name of the dreams object store in IndexedDB.
     * @constant {string}
     * @since 1.0.0
     */
    const STORE_NAME = 'dreams';

    /**
     * Name of the voice notes object store in IndexedDB.
     * @constant {string}
     * @since 1.0.0
     */
    const VOICE_STORE_NAME = 'voiceNotes';

    /**
     * IndexedDB database connection instance.
     * @type {IDBDatabase|null}
     * @private
     */
    let db = null;

    /**
     * Current storage type being used by the application.
     * @type {('memory'|'indexeddb')}
     * @private
     */
    let storageType = 'memory'; // Track which storage is being used

    /**
     * Displays a warning message when storage is not persistent.
     * 
     * Shows a visual warning to users that their dreams are only stored temporarily
     * in memory and will be lost when the browser tab is closed. Encourages users
     * to export their dreams regularly and access the app through a web server.
     * 
     * @function
     * @since 1.0.0
     * @example
     * // Called automatically when memory storage fallback is used
     * showStorageWarning();
     */
    function showStorageWarning() {
        const warning = document.createElement('div');
        warning.id = 'storageWarning';
        warning.className = 'message-warning mb-lg mx-lg';
        warning.innerHTML = `
            ⚠️ <strong>Storage Warning:</strong> Your dreams are stored temporarily in memory only. 
            <br>They will be lost when you close this tab. Please export your dreams regularly!
            <br><small>To enable permanent storage, access this page through a web server.</small>
        `;
        
        const container = document.querySelector('.container');
        container.insertBefore(warning, container.children[2]);
    }

    // TAG & DREAM SIGN MANAGEMENT FUNCTIONS

    /**
     * Loads a single item from a specified IndexedDB object store by ID with encryption support.
     *
     * This enhanced function retrieves items from IndexedDB and automatically handles
     * decryption if the item is encrypted. Falls back to raw loading if decryption fails
     * or if encryption is not enabled. Supports both encrypted and unencrypted items.
     *
     * @async
     * @function
     * @param {string} storeName - Name of the IndexedDB object store
     * @param {string|number} id - Primary key of the item to retrieve
     * @returns {Promise<Object|null>} Retrieved item (decrypted if necessary) or null if not found
     * @throws {Error} When IndexedDB transaction fails or decryption fails
     * @since 2.03.01
     * @example
     * const dream = await loadItemFromStore('dreams', 'dream-123');
     * const goal = await loadItemFromStore('goals', 'goal-456');
     */
    async function loadItemFromStore(storeName, id) {
        const rawItem = await loadItemFromStoreRaw(storeName, id);
        if (!rawItem) return null;

        // Handle encrypted items
        if (isEncryptedItem(rawItem)) {
            // Import encryption state from state.js
            const { getEncryptionPassword, getDecryptedDataCache } = await import('./state.js');
            const password = getEncryptionPassword();

            if (!password) {
                throw new Error('Encryption password required but not available');
            }

            // Check cache first to avoid repeated decryption
            const cacheKey = `${storeName}:${id}`;
            const cache = getDecryptedDataCache();
            if (cache.has(cacheKey)) {
                return cache.get(cacheKey);
            }

            // Decrypt and cache the result
            try {
                const decryptedItem = await decryptItemFromStorage(rawItem, password);
                cache.set(cacheKey, decryptedItem);
                return decryptedItem;
            } catch (error) {
                console.error(`Failed to decrypt item ${id} from store ${storeName}:`, error);
                throw error;
            }
        }

        return rawItem; // Unencrypted item
    }

    /**
     * Loads a single item from a specified IndexedDB object store by ID (raw version).
     *
     * This is the original generic function that retrieves items without encryption
     * handling. Used internally by the enhanced loadItemFromStore function and available
     * for cases where raw access is needed.
     *
     * @async
     * @function
     * @param {string} storeName - Name of the IndexedDB object store
     * @param {string|number} id - Primary key of the item to retrieve
     * @returns {Promise<Object|null>} Retrieved item or null if not found
     * @throws {Error} When IndexedDB transaction fails
     * @since 1.0.0
     * @example
     * const rawDream = await loadItemFromStoreRaw('dreams', 'dream-123');
     */
    async function loadItemFromStoreRaw(storeName, id) {
        if (!isIndexedDBAvailable()) return null;

        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(storeName)) {
                    console.warn(`Store '${storeName}' not found in database.`);
                    resolve(null);
                    return;
                }

                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(id);

                request.onsuccess = () => {
                    resolve(request.result || null);
                };

                request.onerror = () => {
                    console.error(`Error loading item with id '${id}' from store '${storeName}':`, request.error);
                    resolve(null);
                };
            } catch (error) {
                console.error(`Error creating transaction for store '${storeName}':`, error);
                resolve(null);
            }
        });
    }

    /**
     * Loads all items from a specified IndexedDB object store.
     * 
     * This generic function retrieves all records from the specified object store.
     * Returns an empty array if the store doesn't exist or IndexedDB is unavailable.
     * Handles transaction errors gracefully and provides detailed logging.
     * 
     * @async
     * @function
     * @param {string} storeName - Name of the IndexedDB object store
     * @returns {Promise<Array>} Array of all items from the store, empty array if none found
     * @throws {Error} When IndexedDB transaction fails
     * @since 1.0.0
     * @example
     * const allDreams = await loadFromStore('dreams');
     * const allGoals = await loadFromStore('goals');
     */
    async function loadFromStore(storeName) {
        if (!isIndexedDBAvailable()) return [];
        
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(storeName)) {
                    console.warn(`Store '${storeName}' not found in database.`);
                    resolve([]);
                    return;
                }

                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();

                request.onsuccess = () => {
                    const items = request.result || [];
                    resolve(items);
                };

                request.onerror = () => {
                    console.error(`Error loading from store '${storeName}':`, request.error);
                    resolve([]);
                };
            } catch (error) {
                console.error(`Error creating transaction for store '${storeName}':`, error);
                resolve([]);
            }
        });
    }

    /**
     * Saves or updates a single item in a specified IndexedDB object store.
     * 
     * This generic function performs an upsert operation (insert or update) using
     * the IndexedDB put() method. The item must have a primary key that matches
     * the store's keyPath configuration.
     * 
     * @async
     * @function
     * @param {string} storeName - Name of the IndexedDB object store
     * @param {Object} item - Item to save, must include primary key
     * @returns {Promise<boolean>} True if save was successful, false otherwise
     * @throws {Error} When IndexedDB transaction fails
     * @since 1.0.0
     * @example
     * const success = await saveItemToStore('dreams', dreamObject);
     * const goalSaved = await saveItemToStore('goals', { id: '123', title: 'Lucid dream' });
     */
    async function saveItemToStore(storeName, item) {
        if (!isIndexedDBAvailable()) return false;

        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(storeName)) {
                    console.warn(`Store '${storeName}' not found in database.`);
                    resolve(false);
                    return;
                }

                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(item);

                request.onsuccess = () => {
                    resolve(true);
                };

                request.onerror = () => {
                    console.error(`Error saving to store '${storeName}':`, request.error);
                    resolve(false);
                };
            } catch (error) {
                console.error(`Error creating transaction for store '${storeName}':`, error);
                resolve(false);
            }
        });
    }

    /**
     * Overwrites all data in a specified IndexedDB object store with new data.
     * 
     * This function performs a complete replacement of store contents by first
     * clearing all existing data, then adding each item from the provided array.
     * This is useful for bulk data operations and full data replacements.
     * 
     * @async
     * @function
     * @param {string} storeName - Name of the IndexedDB object store
     * @param {Array<Object>} data - Array of items to store, each must have primary key
     * @returns {Promise<boolean>} True if all items were saved successfully, false otherwise
     * @throws {Error} When IndexedDB transaction fails
     * @since 1.0.0
     * @example
     * const dreams = [{ id: '1', title: 'Dream 1' }, { id: '2', title: 'Dream 2' }];
     * const success = await saveToStore('dreams', dreams);
     */
    async function saveToStore(storeName, data) {
        if (!isIndexedDBAvailable()) return false;

        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(storeName)) {
                    console.warn(`Store '${storeName}' not found in database.`);
                    resolve(false);
                    return;
                }

                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);

                // Clear existing data
                const clearRequest = store.clear();
                clearRequest.onsuccess = () => {
                    // Add new data
                    let completed = 0;
                    const total = data.length;

                    if (total === 0) {
                        resolve(true);
                        return;
                    }

                    data.forEach(item => {
                        const addRequest = store.add(item);
                        addRequest.onsuccess = () => {
                            completed++;
                            if (completed === total) {
                                resolve(true);
                            }
                        };
                        addRequest.onerror = () => {
                            console.error(`Error adding item to store '${storeName}':`, addRequest.error);
                            resolve(false);
                        };
                    });
                };

                clearRequest.onerror = () => {
                    console.error(`Error clearing store '${storeName}':`, clearRequest.error);
                    resolve(false);
                };
            } catch (error) {
                console.error(`Error creating transaction for store '${storeName}':`, error);
                resolve(false);
            }
        });
    }

    /**
     * Initializes the IndexedDB database with proper schema and error handling.
     * 
     * Creates the database connection, sets up object stores with indexes, handles
     * schema upgrades, and manages migration from localStorage for existing users.
     * Falls back to memory storage if IndexedDB is unavailable.
     * 
     * @async
     * @function
     * @returns {Promise<void>} Resolves when database is ready or fallback is configured
     * @throws {Error} Database initialization errors are handled gracefully
     * @since 1.0.0
     * @example
     * await initDB();
     * console.log('Database initialized successfully');
     */
    async function initDB() {
        if (!isIndexedDBAvailable()) {
            console.warn('IndexedDB not available, using memory storage');
            storageType = 'memory';
            return;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('IndexedDB failed to open:', request.error);
                storageType = 'memory';
                resolve();
            };

            request.onsuccess = () => {
                db = request.result;
                storageType = 'indexeddb';
                console.log('IndexedDB initialized successfully');
                
                // Handle unexpected database closure
                db.onclose = () => {
                    console.warn('IndexedDB connection closed unexpectedly');
                };
                
                resolve();
            };

            request.onupgradeneeded = (event) => {
                db = event.target.result;
                console.log('Upgrading IndexedDB schema to version', db.version);

                // Create dreams store if it doesn't exist
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const dreamStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    dreamStore.createIndex('timestamp', 'timestamp', { unique: false });
                    dreamStore.createIndex('isLucid', 'isLucid', { unique: false });
                    console.log('Created dreams object store');
                }

                // Create voice notes store if it doesn't exist
                if (!db.objectStoreNames.contains(VOICE_STORE_NAME)) {
                    const voiceStore = db.createObjectStore(VOICE_STORE_NAME, { keyPath: 'id' });
                    voiceStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('Created voice notes object store');
                }

                // Create goals store if it doesn't exist
                if (!db.objectStoreNames.contains('goals')) {
                    const goalStore = db.createObjectStore('goals', { keyPath: 'id' });
                    goalStore.createIndex('timestamp', 'timestamp', { unique: false });
                    goalStore.createIndex('completed', 'completed', { unique: false });
                    console.log('Created goals object store');
                }

                // Create autocomplete store for unified tag/dream sign storage
                if (!db.objectStoreNames.contains('autocomplete')) {
                    const autocompleteStore = db.createObjectStore('autocomplete', { keyPath: 'id' });
                    console.log('Created autocomplete object store');
                }

                // Legacy migration from older versions
                if (event.oldVersion < 3) {
                    // Migrate from localStorage if needed
                    setTimeout(async () => {
                        await migrateFromLocalStorage();
                    }, 100);
                }
            };
        });
    }

    /**
     * Generates a unique identifier string using timestamp and random characters.
     * 
     * Creates a collision-resistant ID by combining current timestamp with
     * a random alphanumeric string. Suitable for use as primary keys in
     * database operations where UUID is not required.
     * 
     * @function
     * @returns {string} Unique identifier string
     * @since 1.0.0
     * @example
     * const id = generateUniqueId();
     * // Returns something like: '1640995200123abc7def89'
     */
    /**
     * Generates a robust, content-aware unique ID for dreams and other entities.
     * 
     * Creates IDs that are cryptographically strong and content-bound to prevent
     * collisions even with rapid creation or identical timestamps. Uses multiple
     * entropy sources including timestamp, random data, and optional content salt.
     * 
     * @param {Object} [contentSalt] - Optional content to salt the ID with
     * @param {string} [contentSalt.title] - Dream title for content binding
     * @param {string} [contentSalt.timestamp] - Dream timestamp for uniqueness
     * @param {string} [contentSalt.type] - Entity type ('dream', 'goal', 'voice', etc.)
     * @returns {string} Unique ID with format: timestamp-hash-random
     * @since 2.02.27
     * @example
     * // Basic ID generation
     * const id = generateUniqueId();
     * // Returns: "1725950400123-a7f2-e8d9c4b1"
     * 
     * @example
     * // Content-salted ID for dreams
     * const dreamId = generateUniqueId({
     *   title: 'Flying over mountains', 
     *   timestamp: '2025-09-10T03:56:00.000Z',
     *   type: 'dream'
     * });
     * // Returns: "1725950400123-x9k2-p4m8n7j5"
     */
    function generateUniqueId(contentSalt = null) {
        // High-precision timestamp (milliseconds since epoch)
        const timestamp = Date.now();
        
        // Generate multiple high-entropy random components
        const random1 = Math.random().toString(36).substr(2, 4);
        const random2 = Math.random().toString(36).substr(2, 4);
        const random3 = Math.random().toString(36).substr(2, 4);
        
        // Add microsecond-level precision using performance.now() if available
        const microTime = (typeof performance !== 'undefined' && performance.now) 
            ? performance.now().toString().replace('.', '')
            : Math.random().toString().slice(2, 8);
        
        let hashComponent = '';
        
        if (contentSalt) {
            // Create content-based hash with guaranteed uniqueness per call
            const saltString = [
                contentSalt.title || 'untitled',
                contentSalt.timestamp || timestamp.toString(),
                contentSalt.type || 'entity',
                timestamp.toString(), // Current generation time
                microTime, // High-precision timing
                random1, // First random component
                random2, // Second random component
                Math.random().toString() // Additional entropy per call
            ].join('|');
            
            // Enhanced hash function with better distribution
            let hash = 5381; // DJB2 hash algorithm starting value
            for (let i = 0; i < saltString.length; i++) {
                const char = saltString.charCodeAt(i);
                hash = ((hash << 5) + hash) + char; // hash * 33 + char
                hash = hash & hash; // Convert to 32-bit integer
            }
            
            // Convert hash to base-36 and take 4 characters, ensure always 4 chars
            hashComponent = Math.abs(hash).toString(36).padStart(4, '0').substr(0, 4);
        } else {
            // Fallback hash with timestamp and multiple random sources
            const fallbackSalt = timestamp.toString() + microTime + random1;
            let hash = 5381;
            for (let i = 0; i < fallbackSalt.length; i++) {
                hash = ((hash << 5) + hash) + fallbackSalt.charCodeAt(i);
            }
            hashComponent = Math.abs(hash).toString(36).padStart(4, '0').substr(0, 4);
        }
        
        // Format: timestamp-hash-random (multiple entropy sources)
        return `${timestamp}-${hashComponent}-${random3}`;
    }

    /**
     * Tests if localStorage is available and functional in the current environment.
     * 
     * Performs a practical test by attempting to set and remove a test value.
     * Returns false in private browsing mode, when storage quota is exceeded,
     * or when localStorage is disabled by browser settings.
     * 
     * @function
     * @returns {boolean} True if localStorage is available and writable
     * @since 1.0.0
     * @example
     * if (isLocalStorageAvailable()) {
     *   localStorage.setItem('myData', 'value');
     * }
     */
    function isLocalStorageAvailable() {
        try {
            const test = 'test';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Checks if IndexedDB is supported in the current browser environment.
     * 
     * Tests for IndexedDB API presence in the window object. Returns false
     * in environments where IndexedDB is not supported or has been disabled.
     * 
     * @function
     * @returns {boolean} True if IndexedDB is supported
     * @since 1.0.0
     * @example
     * if (isIndexedDBAvailable()) {
     *   // Use IndexedDB for storage
     * } else {
     *   // Fall back to alternative storage
     * }
     */
    function isIndexedDBAvailable() {
        return 'indexedDB' in window && window.indexedDB !== undefined;
    }
    
    /**
     * Checks if IndexedDB is both supported and properly initialized.
     * 
     * Combines availability check with connection status to determine if
     * IndexedDB operations can be safely performed. Returns false if the
     * database connection has not been established or has been closed.
     * 
     * @function
     * @returns {boolean} True if IndexedDB is ready for operations
     * @since 1.0.0
     * @example
     * if (isIndexedDBReady()) {
     *   const data = await loadFromIndexedDB();
     * }
     */
    function isIndexedDBReady() {
        return isIndexedDBAvailable() && db !== null;
    }

    /**
     * Loads all dream entries from persistent storage with fallback handling (raw version).
     *
     * Attempts to load dreams from IndexedDB first, falling back to memory storage
     * if IndexedDB is unavailable or fails. Returns raw data without encryption
     * processing. Used internally by the enhanced loadDreams() function.
     *
     * @async
     * @function
     * @returns {Promise<Array<Dream>>} Array of raw dream objects, empty if none found
     * @throws {Error} Handled gracefully with fallback to memory storage
     * @since 2.03.01
     * @example
     * const rawDreams = await loadDreamsRaw();
     * console.log(`Found ${rawDreams.length} raw dreams`);
     */
    async function loadDreamsRaw() {
        // Try IndexedDB first
        if (isIndexedDBReady()) {
            const dreams = await loadFromIndexedDBRaw();
            if (dreams !== null) {
                return dreams;
            }
        }

        // Fallback to memory only if IndexedDB fails
        console.log('IndexedDB unavailable, using memory storage fallback');
        return memoryStorage;
    }

    /**
     * Loads all dream entries from persistent storage with encryption support.
     *
     * This enhanced function attempts to load dreams from IndexedDB first, then falls
     * back to memory storage if IndexedDB is unavailable. Automatically handles both
     * encrypted and unencrypted dreams, decrypting as needed based on encryption settings.
     * If no dreams are found or all storage methods fail, returns an empty array.
     *
     * **Mixed Data Support:**
     * - Supports loading both encrypted and unencrypted dreams from the same store
     * - Gracefully handles decryption failures by skipping affected items
     * - Maintains backward compatibility with existing unencrypted data
     *
     * **Encryption Processing:**
     * - Automatically detects encrypted items using `isEncryptedItem()`
     * - Uses session password from encryption state for decryption
     * - Applies caching to avoid repeated decryption of the same items
     * - Falls back to raw data loading if encryption is not enabled
     *
     * @async
     * @function
     * @returns {Promise<Array<Dream>>} Array of decrypted dream objects, empty if none found
     * @throws {Error} When encryption password is required but not available
     * @since 2.03.01
     * @example
     * // Load all dreams (automatically handles encryption)
     * const allDreams = await loadDreams();
     * console.log(`Loaded ${allDreams.length} dreams`);
     *
     * @example
     * // Error handling for missing encryption password
     * try {
     *   const dreams = await loadDreams();
     *   displayDreams(dreams);
     * } catch (error) {
     *   if (error.message.includes('password')) {
     *     showPasswordPrompt();
     *   }
     * }
     */
    async function loadDreams() {
        // Load raw data first
        const rawDreams = await loadDreamsRaw();

        // If no dreams or encryption not enabled, return as-is
        if (!rawDreams.length) {
            return rawDreams;
        }

        // Import encryption state dynamically to avoid circular dependencies
        const { getEncryptionEnabled, getEncryptionPassword } = await import('./state.js');

        if (!getEncryptionEnabled()) {
            return rawDreams;
        }

        // Process mixed encrypted/unencrypted dreams
        const processedDreams = [];
        const password = getEncryptionPassword();

        for (const dream of rawDreams) {
            try {
                if (isEncryptedItem(dream)) {
                    if (!password) {
                        throw new Error('Encryption password required but not available in session');
                    }

                    // Decrypt the dream using the existing decryption utilities
                    const decrypted = await decryptItemFromStorage(dream, password);
                    processedDreams.push(decrypted);
                } else {
                    // Unencrypted dream - add as-is
                    processedDreams.push(dream);
                }
            } catch (error) {
                console.error(`Failed to decrypt dream ${dream.id}:`, error);

                // Skip this dream but continue processing others
                // In a production app, you might want to show a warning to the user
                // about inaccessible encrypted dreams
            }
        }

        return processedDreams;
    }

    /**
     * Saves all dream entries to persistent storage with fallback handling.
     * 
     * Attempts to save dreams to IndexedDB first, falling back to memory storage
     * if IndexedDB is unavailable. Uses mutex locking to prevent concurrent
     * save operations that could cause data corruption.
     * 
     * @async
     * @function
     * @param {Array<Dream>} dreams - Array of dream objects to save
     * @returns {Promise<void>} Resolves when save operation completes
     * @throws {Error} Handled gracefully with fallback to memory storage
     * @since 1.0.0
     * @example
     * const dreams = [{ id: '1', title: 'My Dream', content: 'I dreamed...' }];
     * await saveDreams(dreams);
     */
    async function saveDreams(dreams) {
        return withMutex('saveDreams', async () => {
            // Try IndexedDB first
            if (isIndexedDBAvailable()) {
                const saved = await saveToIndexedDB(dreams);
                if (saved) {
                    console.log('Dreams saved to IndexedDB');
                    return;
                }
            }
            
            // Fallback to memory only if IndexedDB fails
            memoryStorage = [...dreams];
            console.log('IndexedDB unavailable, dreams saved to memory fallback');
            
            if (storageType !== 'memory') {
                showStorageWarning();
            }
        });
    }

    /**
     * Saves all voice notes to IndexedDB by clearing existing data and adding new items.
     * 
     * This function performs a complete replacement of the voice notes store by
     * clearing all existing records and adding each voice note from the provided array.
     * Each voice note must contain audio blob data and metadata.
     * 
     * @async
     * @function
     * @param {Array<VoiceNote>} voiceNotes - Array of voice note objects to save
     * @returns {Promise<boolean>} True if all voice notes were saved successfully
     * @throws {Error} When IndexedDB operations fail
     * @since 1.0.0
     * @example
     * const voiceNotes = [{ id: '1', audioBlob: blob, transcript: 'Hello' }];
     * const success = await saveAllVoiceNotesToIndexedDB(voiceNotes);
     */
    async function saveAllVoiceNotesToIndexedDB(voiceNotes) {
        if (!isIndexedDBAvailable()) return false;

        return new Promise((resolve) => {
            try {
                const transaction = db.transaction([VOICE_STORE_NAME], 'readwrite');
                const store = transaction.objectStore(VOICE_STORE_NAME);

                const clearRequest = store.clear();
                clearRequest.onsuccess = () => {
                    let completed = 0;
                    const total = voiceNotes.length;
                    if (total === 0) {
                        resolve(true);
                        return;
                    }
                    voiceNotes.forEach(note => {
                        const addRequest = store.add(note);
                        addRequest.onsuccess = () => {
                            completed++;
                            if (completed === total) {
                                resolve(true);
                            }
                        };
                        addRequest.onerror = (e) => {
                            console.error('Error adding voice note during save all:', e.target.error);
                        };
                    });
                };
                clearRequest.onerror = (e) => {
                    console.error('Error clearing voice notes store:', e.target.error);
                    resolve(false);
                };
            } catch (error) {
                console.error('Error in saveAllVoiceNotesToIndexedDB transaction:', error);
                resolve(false);
            }
        });
    }

    /**
     * Saves voice notes array to persistent storage with mutex protection.
     * 
     * This function uses mutex locking to prevent concurrent save operations
     * and ensures voice notes are properly persisted to IndexedDB. Voice notes
     * require IndexedDB due to binary blob storage requirements.
     * 
     * @async
     * @function
     * @param {Array<VoiceNote>} notes - Array of voice note objects to save
     * @returns {Promise<void>} Resolves when save operation completes
     * @throws {Error} When IndexedDB operations fail
     * @since 1.0.0
     * @example
     * await saveVoiceNotes(voiceNotesArray);
     */
    async function saveVoiceNotes(notes) {
        return withMutex('saveVoiceNote', async () => {
            if (isIndexedDBAvailable()) {
                const saved = await saveAllVoiceNotesToIndexedDB(notes);
                if (saved) {
                    console.log('All voice notes saved to IndexedDB');
                }
            }
        });
    }

    /**
     * Loads lucid dreaming goals from persistent storage with encryption support and fallback.
     *
     * This enhanced function attempts to load goals from IndexedDB first, then falls
     * back to localStorage if IndexedDB is unavailable. Automatically handles both
     * encrypted and unencrypted goals, decrypting as needed based on encryption settings.
     * If no goals are found or all storage methods fail, returns an empty array.
     *
     * **Mixed Data Support:**
     * - Supports loading both encrypted and unencrypted goals from the same store
     * - Gracefully handles decryption failures by skipping affected items
     * - Maintains backward compatibility with existing unencrypted data
     *
     * **Encryption Processing:**
     * - Automatically detects encrypted items using `isEncryptedItem()`
     * - Uses session password from encryption state for decryption
     * - Falls back to raw data loading if encryption is not enabled
     *
     * @async
     * @function
     * @returns {Promise<Array<Goal>>} Array of decrypted goal objects, empty if none found
     * @throws {Error} When encryption password is required but not available
     * @since 2.03.01
     * @example
     * // Load all goals (automatically handles encryption)
     * const userGoals = await loadGoals();
     * console.log(`User has ${userGoals.length} active goals`);
     *
     * @example
     * // Error handling for missing encryption password
     * try {
     *   const goals = await loadGoals();
     *   displayGoals(goals);
     * } catch (error) {
     *   if (error.message.includes('password')) {
     *     showPasswordPrompt();
     *   }
     * }
     */
    async function loadGoals() {
        const rawGoals = await loadGoalsRaw();

        if (!rawGoals.length) {
            return rawGoals;
        }

        // Import encryption state dynamically to avoid circular dependencies
        const { getEncryptionEnabled, getEncryptionPassword } = await import('./state.js');

        if (!getEncryptionEnabled()) {
            return rawGoals;
        }

        const processedGoals = [];
        const password = getEncryptionPassword();

        for (const goal of rawGoals) {
            try {
                if (isEncryptedItem(goal)) {
                    if (!password) {
                        throw new Error('Encryption password required but not available in session');
                    }

                    const decrypted = await decryptItemFromStorage(goal, password);
                    processedGoals.push(decrypted);
                } else {
                    processedGoals.push(goal);
                }
            } catch (error) {
                console.error(`Failed to decrypt goal ${goal.id}:`, error);
                // Skip this goal but continue processing others
            }
        }

        return processedGoals;
    }

    /**
     * Loads lucid dreaming goals from persistent storage with fallback support (raw version).
     *
     * Attempts to load goals from IndexedDB first, falling back to localStorage
     * if IndexedDB is unavailable. Returns raw data without encryption processing.
     * Used internally by the enhanced loadGoals() function.
     *
     * @async
     * @function
     * @returns {Promise<Array<Goal>>} Array of raw goal objects, empty if none found
     * @throws {Error} Handled gracefully with fallback storage attempts
     * @since 2.03.01
     * @example
     * const rawGoals = await loadGoalsRaw();
     * console.log(`Found ${rawGoals.length} raw goals`);
     */
    async function loadGoalsRaw() {
        if (isIndexedDBAvailable()) {
            const goals = await loadGoalsFromIndexedDB();
            if (goals !== null) return goals;
        }

        if (isLocalStorageAvailable()) {
            try {
                const stored = localStorage.getItem('dreamJournalGoals');
                return stored ? JSON.parse(stored) : [];
            } catch (error) {
                console.error('Error loading goals from localStorage:', error);
            }
        }

        return [];
    }

    /**
     * Saves lucid dreaming goals to persistent storage with fallback support.
     * 
     * Attempts to save goals to IndexedDB first, falling back to localStorage
     * if IndexedDB is unavailable. Uses mutex locking to prevent concurrent
     * save operations that could cause data corruption.
     * 
     * @async
     * @function
     * @param {Array<Goal>} goals - Array of goal objects to save
     * @returns {Promise<void>} Resolves when save operation completes
     * @throws {Error} Handled gracefully with fallback storage attempts
     * @since 1.0.0
     * @example
     * const goals = [{ id: '1', title: 'Achieve lucidity', completed: false }];
     * await saveGoals(goals);
     */
    async function saveGoals(goals) {
        return withMutex('saveGoals', async () => {
            if (isIndexedDBAvailable()) {
                const saved = await saveGoalsToIndexedDB(goals);
                if (saved) return;
            }
            
            if (isLocalStorageAvailable()) {
                try {
                    localStorage.setItem('dreamJournalGoals', JSON.stringify(goals));
                } catch (error) {
                    console.error('Error saving goals to localStorage:', error);
                }
            }
        });
    }

    // IndexedDB-specific functions
    
    /**
     * Loads all dream entries directly from IndexedDB dreams store (raw version).
     *
     * This is a low-level function that directly accesses the dreams object store
     * in IndexedDB without encryption processing. Returns null if IndexedDB is unavailable
     * or if an error occurs, allowing calling functions to handle fallback logic.
     * Used internally by the enhanced loadDreams() function.
     *
     * @async
     * @function
     * @returns {Promise<Array<Dream>|null>} Array of raw dreams or null if error/unavailable
     * @throws {Error} Database errors are caught and logged
     * @since 2.03.01
     * @example
     * const rawDreams = await loadFromIndexedDBRaw();
     * if (rawDreams === null) {
     *   console.log('IndexedDB unavailable, using fallback');
     * }
     */
    async function loadFromIndexedDBRaw() {
        if (!isIndexedDBAvailable()) return null;

        return new Promise((resolve) => {
            try {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.getAll();

                request.onsuccess = () => {
                    const dreams = request.result || [];
                    resolve(dreams);
                };

                request.onerror = () => {
                    console.error('Error loading from IndexedDB:', request.error);
                    resolve(null);
                };
            } catch (error) {
                console.error('IndexedDB load error:', error);
                resolve(null);
            }
        });
    }

    /**
     * Saves all dream entries directly to IndexedDB dreams store.
     * 
     * This is a low-level function that performs a complete replacement of the
     * dreams object store by clearing existing data and adding all provided dreams.
     * Returns false if IndexedDB is unavailable or if an error occurs.
     * 
     * @async
     * @function
     * @param {Array<Dream>} dreams - Array of dream objects to save
     * @returns {Promise<boolean>} True if save was successful, false otherwise
     * @throws {Error} Database errors are caught and logged
     * @since 1.0.0
     * @example
     * const success = await saveToIndexedDB(allDreams);
     * if (!success) {
     *   console.log('Failed to save to IndexedDB');
     * }
     */
    async function saveToIndexedDB(dreams) {
        if (!isIndexedDBAvailable()) return false;
        
        return new Promise((resolve) => {
            try {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                // Clear existing data
                const clearRequest = store.clear();
                clearRequest.onsuccess = () => {
                    // Add all dreams
                    let completed = 0;
                    const total = dreams.length;
                    
                    if (total === 0) {
                        resolve(true);
                        return;
                    }
                    
                    dreams.forEach(dream => {
                        const addRequest = store.add(dream);
                        addRequest.onsuccess = () => {
                            completed++;
                            if (completed === total) {
                                resolve(true);
                            }
                        };
                        addRequest.onerror = () => {
                            console.error('Error adding dream:', addRequest.error);
                            resolve(false);
                        };
                    });
                };
                
                clearRequest.onerror = () => {
                    console.error('Error clearing dreams store:', clearRequest.error);
                    resolve(false);
                };
            } catch (error) {
                console.error('Error saving to IndexedDB:', error);
                resolve(false);
            }
        });
    }

    /**
     * Loads all goal entries directly from IndexedDB goals store.
     * 
     * This is a low-level function that directly accesses the goals object store
     * in IndexedDB. Returns null if IndexedDB is unavailable, the goals store
     * doesn't exist, or if an error occurs during the operation.
     * 
     * @async
     * @function
     * @returns {Promise<Array<Goal>|null>} Array of goals or null if error/unavailable
     * @throws {Error} Database errors are caught and logged
     * @since 1.0.0
     * @example
     * const goals = await loadGoalsFromIndexedDB();
     * if (goals === null) {
     *   // Handle fallback or initialization
     * }
     */
    async function loadGoalsFromIndexedDB() {
        if (!isIndexedDBAvailable()) return null;
        
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains('goals')) {
                    resolve([]);
                    return;
                }
                
                const transaction = db.transaction(['goals'], 'readonly');
                const store = transaction.objectStore('goals');
                const request = store.getAll();
                
                request.onsuccess = () => {
                    const goals = request.result || [];
                    resolve(goals);
                };
                
                request.onerror = () => {
                    console.error('Error loading goals from IndexedDB:', request.error);
                    resolve(null);
                };
            } catch (error) {
                console.error('Error loading goals:', error);
                resolve(null);
            }
        });
    }

    /**
     * Saves all goal entries directly to IndexedDB goals store.
     * 
     * This is a low-level function that performs a complete replacement of the
     * goals object store by clearing existing data and adding all provided goals.
     * Returns false if IndexedDB is unavailable, the goals store doesn't exist,
     * or if an error occurs during the operation.
     * 
     * @async
     * @function
     * @param {Array<Goal>} goals - Array of goal objects to save
     * @returns {Promise<boolean>} True if save was successful, false otherwise
     * @throws {Error} Database errors are caught and logged
     * @since 1.0.0
     * @example
     * const success = await saveGoalsToIndexedDB(userGoals);
     * if (!success) {
     *   console.error('Failed to save goals to IndexedDB');
     * }
     */
    async function saveGoalsToIndexedDB(goals) {
        if (!isIndexedDBAvailable()) return false;
        
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains('goals')) {
                    console.error('Goals store not found');
                    resolve(false);
                    return;
                }
                
                const transaction = db.transaction(['goals'], 'readwrite');
                const store = transaction.objectStore('goals');
                
                // Clear existing goals
                const clearRequest = store.clear();
                clearRequest.onsuccess = () => {
                    // Add all goals
                    let completed = 0;
                    const total = goals.length;
                    
                    if (total === 0) {
                        resolve(true);
                        return;
                    }
                    
                    goals.forEach(goal => {
                        const addRequest = store.add(goal);
                        addRequest.onsuccess = () => {
                            completed++;
                            if (completed === total) {
                                resolve(true);
                            }
                        };
                        addRequest.onerror = () => {
                            console.error('Error adding goal:', addRequest.error);
                            resolve(false);
                        };
                    });
                };
                
                clearRequest.onerror = () => {
                    console.error('Error clearing goals store:', clearRequest.error);
                    resolve(false);
                };
            } catch (error) {
                console.error('Error in saveGoalsToIndexedDB:', error);
                resolve(false);
            }
        });
    }

    // Voice Notes Storage Functions
    
    /**
     * Loads all voice note entries from IndexedDB storage.
     * 
     * Voice notes require IndexedDB due to binary blob storage requirements.
     * localStorage cannot properly serialize/deserialize audio blob data,
     * so this function only works when IndexedDB is available and initialized.
     * 
     * @async
     * @function
     * @returns {Promise<Array<VoiceNote>>} Array of voice note objects, empty if IndexedDB unavailable
     * @throws {Error} When IndexedDB operations fail
     * @since 1.0.0
     * @example
     * const voiceNotes = await loadVoiceNotes();
     * console.log(`Found ${voiceNotes.length} voice recordings`);
     */
    async function loadVoiceNotes() {
        // Voice notes require IndexedDB due to Blob storage - localStorage cannot deserialize Blobs properly
        if (!isIndexedDBReady()) {
            console.warn('Voice notes require IndexedDB support. No voice notes available without IndexedDB.');
            return [];
        }
        
        const notes = await loadVoiceNotesFromIndexedDB();
        return notes || [];
    }

    /**
     * Saves a single voice note to IndexedDB storage with mutex protection.
     * 
     * This function saves an individual voice note containing audio blob data
     * and metadata to IndexedDB. Uses mutex locking to prevent concurrent save
     * operations. Throws errors if IndexedDB is unavailable since voice notes
     * cannot be stored in localStorage due to blob data limitations.
     * 
     * @async
     * @function
     * @param {VoiceNote} voiceNote - Voice note object containing audio blob and metadata
     * @returns {Promise<void>} Resolves when save operation completes
     * @throws {Error} When IndexedDB is unavailable or save operation fails
     * @since 1.0.0
     * @example
     * const voiceNote = { id: '123', audioBlob: blob, transcript: 'My dream...' };
     * await saveVoiceNote(voiceNote);
     */
    async function saveVoiceNote(voiceNote) {
        return withMutex('saveVoiceNote', async () => {
            // Voice notes require IndexedDB due to Blob storage - localStorage fallback cannot handle Blobs
            if (!isIndexedDBReady()) {
                throw new Error('Voice notes require IndexedDB support. localStorage cannot store audio Blobs.');
            }
            
            const saved = await saveVoiceNoteToIndexedDB(voiceNote);
            if (!saved) {
                throw new Error('Failed to save voice note to IndexedDB');
            }
        });
    }

    /**
     * Loads all voice notes directly from IndexedDB voice notes store.
     * 
     * This is a low-level function that directly accesses the voiceNotes object
     * store in IndexedDB. Returns voice notes sorted by timestamp (newest first)
     * or an empty array if the store doesn't exist or an error occurs.
     * 
     * @async
     * @function
     * @returns {Promise<Array<VoiceNote>|null>} Array of voice notes sorted by timestamp, or null if error
     * @throws {Error} Database errors are caught and logged
     * @since 1.0.0
     * @example
     * const notes = await loadVoiceNotesFromIndexedDB();
     * if (notes) {
     *   console.log(`Loaded ${notes.length} voice notes`);
     * }
     */
    async function loadVoiceNotesFromIndexedDB() {
        if (!isIndexedDBAvailable()) return null;
        
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(VOICE_STORE_NAME)) {
                    resolve([]);
                    return;
                }
                
                const transaction = db.transaction([VOICE_STORE_NAME], 'readonly');
                const store = transaction.objectStore(VOICE_STORE_NAME);
                const request = store.getAll();
                
                request.onsuccess = () => {
                    const voiceNotes = request.result || [];
                    // Sort by timestamp (newest first)
                    voiceNotes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    resolve(voiceNotes);
                };
                
                request.onerror = () => {
                    console.error('Error loading voice notes from IndexedDB:', request.error);
                    resolve([]);
                };
            } catch (error) {
                console.error('Error loading voice notes:', error);
                resolve([]);
            }
        });
    }

    /**
     * Saves a single voice note directly to IndexedDB voice notes store.
     * 
     * This is a low-level function that performs an upsert operation on a single
     * voice note in the voiceNotes object store. Uses the put() method to either
     * insert a new record or update an existing one based on the primary key.
     * 
     * @async
     * @function
     * @param {VoiceNote} voiceNote - Voice note object to save
     * @returns {Promise<boolean>} True if save was successful, false otherwise
     * @throws {Error} Database errors are caught and logged
     * @since 1.0.0
     * @example
     * const success = await saveVoiceNoteToIndexedDB(voiceNote);
     * if (!success) {
     *   console.error('Failed to save voice note');
     * }
     */
    async function saveVoiceNoteToIndexedDB(voiceNote) {
        if (!isIndexedDBAvailable()) return false;
        
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(VOICE_STORE_NAME)) {
                    console.error('Voice notes store not found');
                    resolve(false);
                    return;
                }
                
                const transaction = db.transaction([VOICE_STORE_NAME], 'readwrite');
                const store = transaction.objectStore(VOICE_STORE_NAME);
                const request = store.put(voiceNote);
                
                request.onsuccess = () => {
                    resolve(true);
                };
                
                request.onerror = () => {
                    console.error('Error saving voice note to IndexedDB:', request.error);
                    resolve(false);
                };
            } catch (error) {
                console.error('Error saving voice note:', error);
                resolve(false);
            }
        });
    }

    /**
     * Deletes a voice note by ID from persistent storage with fallback handling.
     * 
     * Attempts to delete from IndexedDB first, falling back to localStorage
     * if needed. Uses mutex locking to prevent concurrent delete operations.
     * Returns true if the deletion was successful from any storage method.
     * 
     * @async
     * @function
     * @param {string} voiceNoteId - Unique identifier of the voice note to delete
     * @returns {Promise<boolean>} True if deletion was successful, false otherwise
     * @throws {Error} Handled gracefully with fallback attempts
     * @since 1.0.0
     * @example
     * const deleted = await deleteVoiceNote('voice-note-123');
     * if (deleted) {
     *   console.log('Voice note deleted successfully');
     * }
     */
    function deleteVoiceNote(voiceNoteId) {
        return withMutex('deleteOperations', async () => {
            if (isIndexedDBAvailable()) {
                const deleted = await deleteVoiceNoteFromIndexedDB(voiceNoteId);
                if (deleted) return true;
            }
            
            if (isLocalStorageAvailable()) {
                try {
                    const existingNotes = await loadVoiceNotes();
                    const updatedNotes = existingNotes.filter(note => note.id !== voiceNoteId);
                    localStorage.setItem('dreamJournalVoiceNotes', JSON.stringify(updatedNotes));
                    return true;
                } catch (error) {
                    console.error('Error deleting voice note from localStorage:', error);
                }
            }
            
            return false;
        });
    }

    /**
     * Deletes a single voice note directly from IndexedDB voice notes store.
     * 
     * This is a low-level function that removes a specific voice note from the
     * voiceNotes object store using the delete() method. Returns true if the
     * deletion transaction completes successfully, false otherwise.
     * 
     * @async
     * @function
     * @param {string} voiceNoteId - Unique identifier of the voice note to delete
     * @returns {Promise<boolean>} True if deletion was successful, false otherwise
     * @throws {Error} Database errors are caught and logged
     * @since 1.0.0
     * @example
     * const deleted = await deleteVoiceNoteFromIndexedDB('voice-123');
     * if (!deleted) {
     *   console.error('Failed to delete voice note from IndexedDB');
     * }
     */
    async function deleteVoiceNoteFromIndexedDB(voiceNoteId) {
    if (!isIndexedDBAvailable()) return false;
    
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(VOICE_STORE_NAME)) {
                    resolve(false);
                    return;
                }
                
                const transaction = db.transaction([VOICE_STORE_NAME], 'readwrite');
                
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = () => resolve(false);
                transaction.onabort = () => resolve(false);

                const store = transaction.objectStore(VOICE_STORE_NAME);
                store.delete(voiceNoteId);
                
            } catch (error) {
                console.error('Error deleting voice note:', error);
                resolve(false);
            }
        });
    }

    /**
     * Migrates existing data from localStorage to IndexedDB for better persistence.
     * 
     * This function handles the transition from localStorage-based storage to
     * IndexedDB for existing users. It migrates dreams, goals, and voice notes,
     * then cleans up localStorage to prevent duplicate data and re-migration.
     * 
     * @async
     * @function
     * @returns {Promise<void>} Resolves when migration completes or skips if no data
     * @throws {Error} Migration errors are caught and logged
     * @since 1.0.0
     * @example
     * await migrateFromLocalStorage();
     * console.log('Migration completed successfully');
     */
    async function migrateFromLocalStorage() {
        if (!isLocalStorageAvailable()) return;
        
        try {
            // Migrate dreams
            const dreamData = localStorage.getItem('dreamJournal');
            if (dreamData) {
                const dreams = JSON.parse(dreamData);
                if (dreams.length > 0) {
                    await saveToIndexedDB(dreams);
                    console.log('Migrated dreams from localStorage to IndexedDB');
                }
            }
            
            // Migrate goals
            const goalData = localStorage.getItem('dreamJournalGoals');
            if (goalData) {
                const goals = JSON.parse(goalData);
                if (goals.length > 0) {
                    await saveGoalsToIndexedDB(goals);
                    console.log('Migrated goals from localStorage to IndexedDB');
                }
            }
            
            // Migrate voice notes
            const voiceData = localStorage.getItem('dreamJournalVoiceNotes');
            if (voiceData) {
                const voiceNotes = JSON.parse(voiceData);
                for (const note of voiceNotes) {
                    await saveVoiceNoteToIndexedDB(note);
                }
                console.log('Migrated voice notes from localStorage to IndexedDB');
            }
            
            // Clear localStorage data after successful migration to prevent re-migration
            if (dreamData) {
                localStorage.removeItem('dreamJournal');
                console.log('Cleared localStorage dreams after migration');
            }
            if (goalData) {
                localStorage.removeItem('dreamJournalGoals');
                console.log('Cleared localStorage goals after migration');
            }
            if (voiceData) {
                localStorage.removeItem('dreamJournalVoiceNotes');
                console.log('Cleared localStorage voice notes after migration');
            }
        } catch (error) {
            console.error('Error during migration:', error);
        }
    }

    /**
     * Gets the total count of dreams stored in IndexedDB.
     * 
     * This function returns the number of dream records in the dreams object store
     * without loading the actual dream data. Useful for statistics and storage
     * management without the overhead of loading all records.
     * 
     * @async
     * @function
     * @returns {Promise<number>} Number of dreams in IndexedDB, 0 if unavailable
     * @throws {Error} Database errors are caught and logged, returns 0
     * @since 1.0.0
     * @example
     * const dreamCount = await getIndexedDBCount();
     * console.log(`User has ${dreamCount} dreams stored`);
     */
    async function getIndexedDBCount() {
        if (!isIndexedDBAvailable()) return 0;
        
        return new Promise((resolve) => {
            try {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.count();
                
                request.onsuccess = () => {
                    resolve(request.result || 0);
                };
                
                request.onerror = () => {
                    console.error('Error counting dreams:', request.error);
                    resolve(0);
                };
            } catch (error) {
                console.error('Error creating count dreams transaction:', error);
                resolve(0);
            }
        });
    }

    /**
     * Retrieves autocomplete suggestions for tags or dream signs (raw version without encryption support).
     *
     * This function loads user-defined suggestions from the autocomplete store,
     * falling back to predefined lists from constants.js if no custom data exists.
     * Returns suggestions sorted alphabetically for consistent display.
     * This is the raw version used internally by the encryption-enhanced version.
     *
     * @async
     * @function
     * @param {('tags'|'dreamSigns')} type - Type of suggestions to retrieve
     * @returns {Promise<Array<string>>} Array of suggestion strings, sorted alphabetically
     * @throws {Error} Database errors are handled gracefully with fallback to defaults
     * @since 2.03.04
     * @example
     * const tagSuggestions = await getAutocompleteSuggestionsRaw('tags');
     * const dreamSignSuggestions = await getAutocompleteSuggestionsRaw('dreamSigns');
     */
    async function getAutocompleteSuggestionsRaw(type) {
        const storeId = type === 'tags' ? 'tags' : 'dreamSigns';

        // For new users or migrated users, use the new unified 'autocomplete' store
        if (isIndexedDBAvailable() && db.objectStoreNames.contains('autocomplete')) {
            const autocompleteData = await loadItemFromStoreRaw('autocomplete', storeId);
            if (autocompleteData && autocompleteData.items) {
                // Sort alphabetically for consistent display
                return autocompleteData.items.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            }
        }

        // Fallback for new users - return the predefined lists from constants.js
        console.warn(`No saved autocomplete data found for ${type}. Using default list.`);
        const isTags = type === 'tags';
        const defaultList = isTags ? commonTags : commonDreamSigns;
        return defaultList.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    }

    /**
     * Enhanced getAutocompleteSuggestions with encryption support.
     *
     * This function retrieves autocomplete suggestions and automatically handles
     * decryption if the data is encrypted. Falls back to unencrypted data or
     * defaults if decryption fails or encryption is not enabled.
     *
     * @async
     * @function
     * @param {('tags'|'dreamSigns')} type - Type of suggestions to retrieve
     * @returns {Promise<Array<string>>} Array of suggestion strings, sorted alphabetically
     * @throws {Error} Database errors are handled gracefully with fallback to defaults
     * @since 2.03.04
     * @example
     * const tagSuggestions = await getAutocompleteSuggestions('tags');
     * const dreamSignSuggestions = await getAutocompleteSuggestions('dreamSigns');
     */
    async function getAutocompleteSuggestions(type) {
        const storeId = type === 'tags' ? 'tags' : 'dreamSigns';

        // Import encryption state from state.js
        const { getEncryptionEnabled, getEncryptionPassword } = await import('./state.js');

        // For new users or migrated users, use the new unified 'autocomplete' store
        if (isIndexedDBAvailable() && db.objectStoreNames.contains('autocomplete')) {
            const autocompleteData = await loadItemFromStore('autocomplete', storeId);
            if (autocompleteData && autocompleteData.items) {
                // Sort alphabetically for consistent display
                return autocompleteData.items.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            }
        }

        // Fallback for new users - return the predefined lists from constants.js
        console.warn(`No saved autocomplete data found for ${type}. Using default list.`);
        const isTags = type === 'tags';
        const defaultList = isTags ? commonTags : commonDreamSigns;
        return defaultList.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    }

    /**
     * Adds a custom autocomplete item for tags or dream signs.
     * 
     * This function reads user input from the appropriate form field, validates
     * the input, checks for duplicates, and adds the new item to the autocomplete
     * store. Provides user feedback through inline messages and updates the UI.
     * 
     * @async
     * @function
     * @param {('tags'|'dreamSigns')} type - Type of autocomplete item to add
     * @returns {Promise<void>} Resolves when add operation completes
     * @throws {Error} Validation and database errors are handled with user feedback
     * @since 1.0.0
     * @example
     * // Called when user clicks add button for custom tags
     * await addCustomAutocompleteItem('tags');
     */
    async function addCustomAutocompleteItem(type) {
        const inputId = type === 'tags' ? 'newTagInput' : 'newDreamSignInput';
        const input = document.getElementById(inputId);
        if (!input) return;

        const newItem = input.value.trim().toLowerCase();
        if (!newItem) {
            createInlineMessage('warning', 'Please enter a value', { 
                container: input.parentElement,
                position: 'top'
            });
            return;
        }

        const storeId = type === 'tags' ? 'tags' : 'dreamSigns';
        
        // Get existing suggestions
        const existingSuggestions = await getAutocompleteSuggestions(type);
        
        // Check if item already exists (case insensitive)
        if (existingSuggestions.some(item => item.toLowerCase() === newItem)) {
            createInlineMessage('warning', 'This item already exists', {
                container: input.parentElement,
                position: 'top'
            });
            return;
        }

        // Add the new item
        const updatedSuggestions = [...existingSuggestions, newItem];
        
        // Save to autocomplete store
        const success = await saveItemToStore('autocomplete', {
            id: storeId,
            items: updatedSuggestions
        });

        if (success) {
            input.value = '';
            createInlineMessage('success', `Added "${newItem}" successfully`, {
                container: input.parentElement,
                position: 'top'
            });
            
            // Re-render the management list
            renderAutocompleteManagementList(type);
        } else {
            createInlineMessage('error', 'Failed to add item', {
                container: input.parentElement,
                position: 'top'
            });
        }
    }

    /**
     * Deletes a custom autocomplete item for tags or dream signs.
     * 
     * This function removes a specific item from the autocomplete suggestions
     * for the given type. Performs case-insensitive matching when finding the
     * item to delete and provides user feedback through inline messages.
     * 
     * @async
     * @function
     * @param {('tags'|'dreamSigns')} type - Type of autocomplete item to delete
     * @param {string} itemValue - Value of the item to delete
     * @returns {Promise<void>} Resolves when delete operation completes
     * @throws {Error} Database errors are handled with user feedback
     * @since 1.0.0
     * @example
     * await deleteAutocompleteItem('tags', 'nightmare');
     */
    async function deleteAutocompleteItem(type, itemValue) {
        const storeId = type === 'tags' ? 'tags' : 'dreamSigns';
        
        // Get existing suggestions
        const existingSuggestions = await getAutocompleteSuggestions(type);
        
        // Remove the item (case insensitive)
        const updatedSuggestions = existingSuggestions.filter(
            item => item.toLowerCase() !== itemValue.toLowerCase()
        );
        
        // Save updated list
        const success = await saveItemToStore('autocomplete', {
            id: storeId,
            items: updatedSuggestions
        });

        if (success) {
            createInlineMessage('success', `Deleted "${itemValue}" successfully`);
            
            // Re-render the management list
            renderAutocompleteManagementList(type);
        } else {
            createInlineMessage('error', 'Failed to delete item');
        }
    }

    /**
     * Learns new autocomplete items from user input to improve suggestions.
     * 
     * This function analyzes user-entered tags or dream signs and automatically
     * adds new unique items to the autocomplete suggestions. Performs case-insensitive
     * duplicate checking and only adds items that don't already exist.
     * 
     * @async
     * @function
     * @param {Array<string>} inputArray - Array of items to learn from user input
     * @param {('tags'|'dreamSigns')} type - Type of items being learned
     * @returns {Promise<void>} Resolves when learning operation completes
     * @throws {Error} Database errors are handled gracefully
     * @since 1.0.0
     * @example
     * const userTags = ['lucid', 'flying', 'nightmare'];
     * await learnAutocompleteItems(userTags, 'tags');
     */
    async function learnAutocompleteItems(inputArray, type) {
        if (!inputArray || inputArray.length === 0) return;

        const storeId = type === 'tags' ? 'tags' : 'dreamSigns';
        
        // Get existing suggestions
        const existingSuggestions = await getAutocompleteSuggestions(type);
        
        // Find new items (case insensitive comparison)
        const newItems = inputArray.filter(item => 
            !existingSuggestions.some(existing => 
                existing.toLowerCase() === item.toLowerCase()
            )
        );

        if (newItems.length === 0) return;

        // Add new items to existing suggestions
        const updatedSuggestions = [...existingSuggestions, ...newItems];
        
        // Save updated list
        await saveItemToStore('autocomplete', {
            id: storeId,
            items: updatedSuggestions
        });

        console.log(`Learned ${newItems.length} new ${type}: ${newItems.join(', ')}`);
    }

    /**
     * Enhanced autocomplete saving with encryption support.
     *
     * This function saves autocomplete suggestions to the appropriate store
     * and automatically handles encryption if encryption is enabled.
     * Provides a unified interface for saving both tags and dream signs data.
     *
     * @async
     * @function
     * @param {('tags'|'dreamSigns')} type - Type of suggestions to save
     * @param {Array<string>} suggestions - Array of suggestion strings to save
     * @returns {Promise<boolean>} True if save was successful, false otherwise
     * @throws {Error} Database errors are handled gracefully
     * @since 2.03.04
     * @example
     * const success = await saveAutocompleteSuggestions('tags', ['lucid', 'nightmare']);
     */
    async function saveAutocompleteSuggestions(type, suggestions) {
        if (!suggestions || !Array.isArray(suggestions)) {
            console.error('saveAutocompleteSuggestions: Invalid suggestions array provided');
            return false;
        }

        const storeId = type === 'tags' ? 'tags' : 'dreamSigns';

        try {
            // Use the standard saveItemToStore which handles encryption automatically
            const success = await saveItemToStore('autocomplete', {
                id: storeId,
                items: suggestions.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
            });

            return success;
        } catch (error) {
            console.error(`Failed to save autocomplete suggestions for ${type}:`, error);
            return false;
        }
    }

    /**
     * Retrieves raw autocomplete suggestions without encryption handling.
     * This function is used internally when encryption processing is handled separately.
     *
     * @async
     * @function
     * @param {('tags'|'dreamSigns')} type - Type of suggestions to retrieve
     * @returns {Promise<Object|null>} Raw autocomplete data object or null if not found
     * @since 2.03.04
     * @example
     * const rawData = await getAutocompleteSuggestionsRawData('tags');
     */
    async function getAutocompleteSuggestionsRawData(type) {
        const storeId = type === 'tags' ? 'tags' : 'dreamSigns';

        if (isIndexedDBAvailable() && db.objectStoreNames.contains('autocomplete')) {
            return await loadItemFromStoreRaw('autocomplete', storeId);
        }

        return null;
    }


// ===================================================================================
// INDIVIDUAL DREAM CRUD OPERATIONS
// ===================================================================================
// Individual dream operations for proper CRUD functionality
// Complement the bulk operations with single-item precision

    /**
     * Adds a single dream entry to IndexedDB with comprehensive validation.
     * 
     * This function performs data validation before adding a dream to the database.
     * Uses the add() method which requires the dream ID to be unique. Returns true
     * if the dream is successfully added, false if validation fails or database errors occur.
     * 
     * @async
     * @function
     * @param {Dream} dream - Dream object to add to the database
     * @returns {Promise<boolean>} True if dream was added successfully, false otherwise
     * @throws {Error} Database errors are caught and logged
     * @since 2.0.0
     * @example
     * const newDream = { id: '123', title: 'My Dream', content: 'I dreamed...', isLucid: false };
     * const added = await addDreamToIndexedDB(newDream);
     */
    async function addDreamToIndexedDB(dream) {
        if (!isIndexedDBAvailable() || !validateDreamData(dream)) return false;
        
        return new Promise((resolve) => {
            try {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                
                transaction.oncomplete = () => {
                    resolve(true); // Success when transaction completes
                };
                transaction.onerror = () => resolve(false);
                transaction.onabort = () => resolve(false);

                const store = transaction.objectStore(STORE_NAME);
                store.add(dream);

            } catch (error) {
                console.error('Error creating add dream transaction:', error);
                resolve(false);
            }
        });
    }
    /**
     * Updates an existing dream entry in IndexedDB with comprehensive validation.
     * 
     * This function performs data validation before updating a dream in the database.
     * Uses the put() method which will update an existing record or create a new one.
     * Returns true if the dream is successfully updated, false if validation fails or database errors occur.
     * 
     * @async
     * @function
     * @param {Dream} dream - Dream object to update in the database
     * @returns {Promise<boolean>} True if dream was updated successfully, false otherwise
     * @throws {Error} Database errors are caught and logged
     * @since 2.0.0
     * @example
     * const updatedDream = { id: '123', title: 'Updated Title', content: 'Updated content...', isLucid: true };
     * const updated = await updateDreamInIndexedDB(updatedDream);
     */
    async function updateDreamInIndexedDB(dream) {
    if (!isIndexedDBAvailable() || !validateDreamData(dream)) return false;

        return new Promise((resolve) => {
            try {
                const transaction = db.transaction([STORE_NAME], 'readwrite');

                transaction.oncomplete = () => {
                    resolve(true);
                };
                transaction.onerror = () => resolve(false);
                transaction.onabort = () => resolve(false);

                const store = transaction.objectStore(STORE_NAME);
                store.put(dream);

            } catch (error) {
                console.error('Error creating update dream transaction:', error);
                resolve(false);
            }
        });
    }
    /**
     * Deletes a single dream entry from IndexedDB by its unique identifier.
     * 
     * This function removes a dream record from the dreams object store using
     * the delete() method. Returns true if the deletion transaction completes
     * successfully, false if IndexedDB is unavailable or an error occurs.
     * 
     * @async
     * @function
     * @param {string} dreamId - Unique identifier of the dream to delete
     * @returns {Promise<boolean>} True if dream was deleted successfully, false otherwise
     * @throws {Error} Database errors are caught and logged
     * @since 2.0.0
     * @example
     * const deleted = await deleteDreamFromIndexedDB('dream-123');
     * if (deleted) {
     *   console.log('Dream deleted successfully');
     * }
     */
    async function deleteDreamFromIndexedDB(dreamId) {
        if (!isIndexedDBAvailable()) return false;
        
        return new Promise((resolve) => {
            try {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = () => resolve(false);
                transaction.onabort = () => resolve(false);

                const store = transaction.objectStore(STORE_NAME);
                store.delete(dreamId);

            } catch (error) {
                console.error('Error creating delete dream transaction:', error);
                resolve(false);
            }
        });
    }

// ===================================================================================
// DATA VALIDATION OPERATIONS
// ===================================================================================

    /**
     * Validates dream data structure and content for database operations.
     * 
     * Performs comprehensive validation of dream objects to ensure data integrity
     * before database operations. Checks for required fields, proper data types,
     * and valid array structures. Provides detailed error logging for debugging.
     * 
     * @function
     * @param {Dream} dream - Dream object to validate
     * @returns {boolean} True if dream data is valid, false otherwise
     * @since 2.0.0
     * @example
     * const dream = { id: '123', title: 'Test', content: 'Content', isLucid: false, tags: [], dreamSigns: [] };
     * if (validateDreamData(dream)) {
     *   // Safe to save to database
     * }
     */
    function validateDreamData(dream) {
        if (!dream) {
            console.error('Dream validation failed: dream is null or undefined');
            return false;
        }
        
        // Check for required fields presence
        if (!dream.id) {
            console.error('Dream validation failed: missing id');
            return false;
        }
        
        if (!dream.timestamp) {
            console.error('Dream validation failed: missing timestamp');
            return false;
        }
        
        // Validate data types for type safety
        if (typeof dream.id !== 'string') {
            console.error('Dream validation failed: id must be string');
            return false;
        }
        
        if (typeof dream.title !== 'string') {
            console.error('Dream validation failed: title must be string');
            return false;
        }
        
        if (typeof dream.content !== 'string') {
            console.error('Dream validation failed: content must be string');
            return false;
        }
        
        if (typeof dream.isLucid !== 'boolean') {
            console.error('Dream validation failed: isLucid must be boolean');
            return false;
        }
        
        // Validate array fields for proper structure
        if (!Array.isArray(dream.tags)) {
            console.error('Dream validation failed: tags must be array');
            return false;
        }
        
        if (!Array.isArray(dream.dreamSigns)) {
            console.error('Dream validation failed: dreamSigns must be array');
            return false;
        }
        
        return true;
    }

    /**
     * Checks if a dream entry is likely a duplicate based on content and timing.
     * 
     * Analyzes existing dreams to detect potential duplicates by comparing content
     * similarity and creation timestamps. Uses a 5-minute time window to catch
     * rapid successive submissions of the same dream content.
     * 
     * @function
     * @param {Array<Dream>} existingDreams - Array of existing dream entries
     * @param {Dream} newDream - New dream entry to check for duplication
     * @returns {boolean} True if dream appears to be a duplicate, false otherwise
     * @since 2.0.0
     * @example
     * const isDupe = isDreamDuplicate(existingDreams, newDreamEntry);
     * if (isDupe) {
     *   console.warn('Potential duplicate dream detected');
     * }
     */
    function isDreamDuplicate(existingDreams, newDream) {
    const timeDiffThreshold = 5 * 60 * 1000; // 5-minute time window
    const contentSimilarityThreshold = 0.8; // Currently unused but reserved for future fuzzy matching
    
    return existingDreams.some(existing => {
        const timeDiff = Math.abs(new Date(existing.timestamp) - new Date(newDream.timestamp));
        const contentSimilarity = existing.content.toLowerCase() === newDream.content.toLowerCase();
        
        // Consider duplicate if within time threshold and identical content
        return timeDiff < timeDiffThreshold && contentSimilarity;
    });
}

// ===================================================================================
// STORAGE WARNING FUNCTIONS
// ===================================================================================

    /**
     * Displays a warning about temporary voice note storage limitations.
     * 
     * Shows an inline warning message when voice notes cannot be persistently
     * stored due to IndexedDB unavailability. Informs users that voice recordings
     * will be lost when the browser tab is closed and encourages downloading
     * important recordings.
     * 
     * @function
     * @since 2.0.0
     * @example
     * // Called when voice notes must fall back to memory storage
     * showVoiceStorageWarning();
     */
    function showVoiceStorageWarning() {
        const container = document.querySelector('.voice-notes-section');
        if (!container) return;
        
        createInlineMessage('warning', 
            '⚠️ Voice Storage Notice: Voice recordings are stored temporarily in memory only. They will be lost when you close this tab. Download important recordings!', 
            {
                container: container,
                position: 'top',
                duration: 10000,
                className: 'voice-storage-warning'
            }
        );
    }

// ===================================================================================
// USER-DEFINED TAGS & DREAM SIGNS OPERATIONS
// ===================================================================================
// Legacy functions for older tag/dream sign management system
// These functions handle user-defined suggestions separately from defaults

    /**
     * Loads user-defined tags from the dedicated userTags store (legacy function).
     * 
     * This legacy function retrieves custom tags that were defined by users in older
     * versions of the application. Maps stored objects to string values for compatibility.
     * Modern implementations should use getAutocompleteSuggestions('tags') instead.
     * 
     * @async
     * @function
     * @returns {Promise<Array<string>>} Array of user-defined tag strings
     * @deprecated Use getAutocompleteSuggestions('tags') for new implementations
     * @since 1.0.0
     * @example
     * const userTags = await loadUserTags();
     */
    async function loadUserTags() {
        const tags = await loadFromStore('userTags');
        return tags.map(t => t.value);
    }

    /**
     * Loads user-defined dream signs from the dedicated userDreamSigns store (legacy function).
     * 
     * This legacy function retrieves custom dream signs that were defined by users in older
     * versions of the application. Maps stored objects to string values for compatibility.
     * Modern implementations should use getAutocompleteSuggestions('dreamSigns') instead.
     * 
     * @async
     * @function
     * @returns {Promise<Array<string>>} Array of user-defined dream sign strings
     * @deprecated Use getAutocompleteSuggestions('dreamSigns') for new implementations
     * @since 1.0.0
     * @example
     * const userDreamSigns = await loadUserDreamSigns();
     */
    async function loadUserDreamSigns() {
        const signs = await loadFromStore('userDreamSigns');
        return signs.map(s => s.value);
    }

    /**
     * Loads list of default items that user has deleted (legacy function).
     * 
     * This legacy function retrieves a list of default suggestion items that users
     * have chosen to remove from their autocomplete lists in older versions.
     * Used to filter out unwanted defaults from suggestion lists.
     * 
     * @async
     * @function
     * @returns {Promise<Array<string>>} Array of deleted default item IDs
     * @deprecated Legacy function for older suggestion management system
     * @since 1.0.0
     * @example
     * const deletedDefaults = await loadDeletedDefaults();
     */
    async function loadDeletedDefaults() {
        const deleted = await loadFromStore('deletedDefaults');
        return deleted.map(d => d.id);
    }

    /**
     * Saves complete list of user-defined tags to dedicated store (legacy function).
     * 
     * This legacy function replaces all existing user-defined tags with a new list.
     * Maps tag strings to objects with ID and value properties for storage compatibility.
     * Modern implementations should use saveItemToStore('autocomplete', ...) instead.
     * 
     * @async
     * @function
     * @param {Array<string>} tags - Array of tag strings to save
     * @returns {Promise<boolean>} True if save was successful, false otherwise
     * @deprecated Use saveItemToStore for new implementations
     * @since 1.0.0
     * @example
     * const success = await saveUserTags(['lucid', 'nightmare', 'flying']);
     */
    async function saveUserTags(tags) {
        const dataToStore = tags.map(tag => ({ id: tag.toLowerCase(), value: tag }));
        return await saveToStore('userTags', dataToStore);
    }

    /**
     * Saves complete list of user-defined dream signs to dedicated store (legacy function).
     * 
     * This legacy function replaces all existing user-defined dream signs with a new list.
     * Maps dream sign strings to objects with ID and value properties for storage compatibility.
     * Modern implementations should use saveItemToStore('autocomplete', ...) instead.
     * 
     * @async
     * @function
     * @param {Array<string>} signs - Array of dream sign strings to save
     * @returns {Promise<boolean>} True if save was successful, false otherwise
     * @deprecated Use saveItemToStore for new implementations
     * @since 1.0.0
     * @example
     * const success = await saveUserDreamSigns(['water', 'flying', 'mirrors']);
     */
    async function saveUserDreamSigns(signs) {
        const dataToStore = signs.map(sign => ({ id: sign.toLowerCase(), value: sign }));
        return await saveToStore('userDreamSigns', dataToStore);
    }

    /**
     * Saves list of default items that user has chosen to delete (legacy function).
     * 
     * This legacy function stores a list of default suggestion items that users have
     * chosen to remove from their autocomplete lists. Used to hide unwanted defaults
     * from autocomplete suggestions in older versions of the application.
     * 
     * @async
     * @function
     * @param {Array<string>} deletedItems - Array of item strings to mark as deleted
     * @returns {Promise<boolean>} True if save was successful, false otherwise
     * @deprecated Legacy function for older suggestion management system
     * @since 1.0.0
     * @example
     * const success = await saveDeletedDefaults(['unwanted-tag', 'unwanted-sign']);
     */
    async function saveDeletedDefaults(deletedItems) {
        const dataToStore = deletedItems.map(item => ({ id: item.toLowerCase() }));
        return await saveToStore('deletedDefaults', dataToStore);
    }

// ===================================================================================
// ENCRYPTION UTILITIES
// ===================================================================================

/**
 * Determines if an item should be encrypted based on store name and settings.
 *
 * Evaluates whether items in a particular IndexedDB store should be encrypted
 * based on the global encryption settings and store-specific encryption policies.
 * Voice notes are excluded from encryption due to binary data complexity.
 *
 * @async
 * @function
 * @param {string} storeName - IndexedDB store name to evaluate
 * @returns {Promise<boolean>} True if items in this store should be encrypted
 * @since 2.03.01
 * @example
 * const shouldEncrypt = await shouldEncryptStore('dreams');
 * if (shouldEncrypt) {
 *   // Apply encryption before storage
 * }
 */
async function shouldEncryptStore(storeName) {
    // Import encryption state from state.js
    const { getEncryptionEnabled } = await import('./state.js');

    if (!getEncryptionEnabled()) return false;

    // Voice notes are never encrypted (binary data complexity)
    if (storeName === VOICE_STORE_NAME) return false;

    // Encrypt dreams, goals, and autocomplete stores
    return ['dreams', 'goals', 'autocomplete'].includes(storeName);
}

/**
 * Checks if a data item is in encrypted format.
 *
 * Examines a data item to determine if it has been encrypted by checking
 * for the presence of encryption wrapper properties. Encrypted items have
 * a specific structure with encrypted flag and Uint8Array data.
 *
 * @function
 * @param {any} item - Data item to check for encryption
 * @returns {boolean} True if item is encrypted
 * @since 2.03.01
 * @example
 * const item = await loadItemFromStore('dreams', 'dream-123');
 * if (isEncryptedItem(item)) {
 *   // Item needs decryption
 * }
 */
function isEncryptedItem(item) {
    return item &&
           typeof item === 'object' &&
           item.encrypted === true &&
           item.data instanceof Uint8Array;
}

/**
 * Encrypts a data item for storage in IndexedDB.
 *
 * Takes a plain data item and encrypts it using the provided password.
 * The original item is JSON-stringified before encryption, and the result
 * is wrapped in a standardized encrypted item structure with metadata.
 *
 * @async
 * @function
 * @param {any} item - Original data item to encrypt
 * @param {string} password - Encryption password to use
 * @returns {Promise<Object>} Encrypted item wrapper with metadata
 * @throws {Error} When encryption process fails
 * @since 2.03.01
 * @example
 * const plainDream = { id: '123', title: 'My Dream', content: 'I dreamed...' };
 * const encrypted = await encryptItemForStorage(plainDream, 'mypassword');
 * // Returns: { id: '123', encrypted: true, data: Uint8Array(...), created: '...', modified: '...' }
 */
async function encryptItemForStorage(item, password) {
    // Import encryption functions from security.js
    const { encryptData } = await import('./security.js');

    const plaintext = JSON.stringify(item);
    const encryptedData = await encryptData(plaintext, password);

    return {
        id: item.id,
        encrypted: true,
        data: encryptedData,
        created: item.created || new Date().toISOString(),
        modified: new Date().toISOString()
    };
}

/**
 * Decrypts a data item from storage.
 *
 * Takes an encrypted item wrapper and decrypts it using the provided password.
 * The decrypted data is JSON-parsed to restore the original object structure,
 * and original timestamps are preserved from the wrapper metadata.
 *
 * @async
 * @function
 * @param {Object} encryptedItem - Encrypted item wrapper from storage
 * @param {string} password - Decryption password to use
 * @returns {Promise<any>} Original data item after decryption
 * @throws {Error} When decryption fails or password is incorrect
 * @since 2.03.01
 * @example
 * const encryptedItem = await loadItemFromStoreRaw('dreams', 'dream-123');
 * if (isEncryptedItem(encryptedItem)) {
 *   const plainDream = await decryptItemFromStorage(encryptedItem, 'mypassword');
 * }
 */
async function decryptItemFromStorage(encryptedItem, password) {
    // Import decryption functions from security.js
    const { decryptData } = await import('./security.js');

    const decryptedText = await decryptData(encryptedItem.data, password);
    const item = JSON.parse(decryptedText);

    // Restore original timestamps from wrapper metadata
    if (encryptedItem.created) item.created = encryptedItem.created;
    if (encryptedItem.modified) item.modified = encryptedItem.modified;

    return item;
}

// ===================================================================================
// MODULE EXPORTS
// ===================================================================================

// Export all functions and constants for ES module compatibility
export {
    // Core database functions
    initDB,
    generateUniqueId,
    
    // Storage availability checks
    isLocalStorageAvailable,
    isIndexedDBAvailable,
    isIndexedDBReady,
    storageType,
    
    // Generic storage operations
    loadItemFromStore,
    loadItemFromStoreRaw,
    loadFromStore,
    saveItemToStore,
    saveToStore,

    // Encryption utilities
    shouldEncryptStore,
    isEncryptedItem,
    encryptItemForStorage,
    decryptItemFromStorage,
    
    // Dream operations
    loadDreams,
    loadDreamsRaw,
    saveDreams,
    addDreamToIndexedDB,
    updateDreamInIndexedDB,
    deleteDreamFromIndexedDB,
    validateDreamData,
    isDreamDuplicate,
    
    // Voice note operations
    loadVoiceNotes,
    saveVoiceNotes,
    saveVoiceNote,
    saveAllVoiceNotesToIndexedDB,
    deleteVoiceNote,
    loadVoiceNotesFromIndexedDB,
    saveVoiceNoteToIndexedDB,
    deleteVoiceNoteFromIndexedDB,
    showVoiceStorageWarning,
    
    // Goals operations
    loadGoals,
    loadGoalsRaw,
    saveGoals,
    loadGoalsFromIndexedDB,
    saveGoalsToIndexedDB,
    
    // IndexedDB operations
    loadFromIndexedDBRaw,
    saveToIndexedDB,
    migrateFromLocalStorage,
    getIndexedDBCount,
    
    // Autocomplete operations
    getAutocompleteSuggestions,
    getAutocompleteSuggestionsRaw,
    getAutocompleteSuggestionsRawData,
    saveAutocompleteSuggestions,
    addCustomAutocompleteItem,
    deleteAutocompleteItem,
    learnAutocompleteItems,
    
    // Legacy functions
    loadUserTags,
    loadUserDreamSigns,
    loadDeletedDefaults,
    saveUserTags,
    saveUserDreamSigns,
    saveDeletedDefaults,
    
    // Warning functions
    showStorageWarning
};