/**
 * @fileoverview Global application state management for the Dream Journal application.
 * 
 * Central state repository for all application-wide variables and state tracking.
 * Maintains consistency across modules and prevents state conflicts. This module
 * provides a unified state management system including voice recording, navigation,
 * concurrency control, and UI state management.
 * 
 * @module State
 * @version 2.04.00
 * @author Dream Journal Development Team
 * @since 1.0.0
 * @requires none
 */

// ===================================================================================
// APPLICATION DATA STATE
// ===================================================================================

/**
 * Main array containing all dream journal entries.
 * 
 * This is the primary data structure for the application, storing all user-created
 * dream entries. The array is loaded from IndexedDB on app initialization and
 * kept in sync with the database through various CRUD operations.
 * 
 * Each dream entry contains properties like id, title, content, timestamp, emotions,
 * tags, dream signs, and lucidity status.
 * 
 * @type {Object[]}
 * @default []
 * @since 2.02.22
 * @example
 * // Access dreams array
 * console.log(dreams.length); // Number of dreams
 * 
 * // Add new dream (use saveDream function instead)
 * dreams.push(newDreamEntry);
 */
let dreams = [];

/**
 * Main array containing all user goals for lucid dreaming.
 * 
 * Stores all goals created by the user for tracking lucid dreaming progress.
 * Goals can be active or completed and include templates for common lucidity goals.
 * 
 * @type {Object[]}
 * @default []
 * @since 2.02.22
 */
let allGoals = [];

// ===================================================================================
// TAB & NAVIGATION STATE
// ===================================================================================

/**
 * Stores the active tab identifier before PIN lock activation to restore state after unlock.
 * 
 * Used by the PIN protection system to maintain user context when locking/unlocking
 * the application. This ensures users return to their previous tab after authentication.
 * 
 * @type {string}
 * @default 'journal'
 * @since 1.0.0
 */
let preLockActiveTab = 'journal';

// ===================================================================================
// VOICE RECORDING & TRANSCRIPTION STATE
// ===================================================================================

/**
 * MediaRecorder instance for capturing audio from the user's microphone.
 * 
 * This instance is created when voice recording begins and destroyed when recording
 * stops. Uses the browser's MediaRecorder API to capture audio in WebM format.
 * 
 * @type {MediaRecorder|null}
 * @default null
 * @since 1.0.0
 */
let mediaRecorder = null;

/**
 * Temporary storage array for audio data chunks during recording.
 * 
 * Accumulates Blob chunks from the MediaRecorder's ondataavailable event.
 * Cleared after each recording session and used to construct the final audio file.
 * 
 * @type {Blob[]}
 * @default []
 * @since 1.0.0
 */
let audioChunks = [];

/**
 * Timestamp marking when the current voice recording session started.
 * 
 * Used to calculate recording duration for display purposes and to implement
 * maximum recording time limits. Set when recording begins, cleared when stopped.
 * 
 * @type {number|null}
 * @default null
 * @since 1.0.0
 */
let recordingStartTime = null;

/**
 * Interval timer ID for updating the recording duration display.
 * 
 * Updates the recording time display every second during active recording.
 * Cleared when recording stops to prevent memory leaks.
 * 
 * @type {number|null}
 * @default null
 * @since 1.0.0
 */
let recordingTimer = null;

/**
 * Reference to the currently playing HTML audio element.
 * 
 * Tracks which voice note audio is currently playing to prevent multiple
 * simultaneous playback and enable proper pause/stop functionality.
 * 
 * @type {HTMLAudioElement|null}
 * @default null
 * @since 1.0.0
 */
let currentPlayingAudio = null;

/**
 * SpeechRecognition API instance for voice-to-text transcription.
 * 
 * Created when transcription begins using the browser's SpeechRecognition API.
 * Only available in Chrome and Edge browsers. Handles continuous recognition
 * with interim results for real-time transcription display.
 * 
 * @type {SpeechRecognition|null}
 * @default null
 * @since 1.0.0
 */
let speechRecognition = null;

/**
 * Accumulated transcription results from the speech recognition system.
 * 
 * Stores the final transcription text as it's recognized. Updated incrementally
 * as speech recognition processes audio input. Reset between transcription sessions.
 * 
 * @type {string}
 * @default ''
 * @since 1.0.0
 */
let recognitionResults = '';

/**
 * Flag indicating whether transcription is currently in progress.
 * 
 * Prevents concurrent transcription sessions and provides UI state feedback.
 * Set to true when transcription starts, false when it completes or errors.
 * 
 * @type {boolean}
 * @default false
 * @since 1.0.0
 */
let isTranscribing = false;
    
// ===================================================================================
// PERFORMANCE OPTIMIZATION STATE
// ===================================================================================

/**
 * Timer ID for debouncing search input to prevent excessive database queries.
 * 
 * Delays search execution until user stops typing for a specified period.
 * Improves performance by reducing the number of search operations performed
 * during rapid user input.
 * 
 * @type {number|null}
 * @default null
 * @since 1.0.0
 */
let searchDebounceTimer = null;

/**
 * Timer ID for debouncing filter changes to optimize UI updates.
 * 
 * Prevents excessive re-rendering when users rapidly change filter options.
 * Delays filter application until user settles on final selections.
 * 
 * @type {number|null}
 * @default null
 * @since 1.0.0
 */
let filterDebounceTimer = null;
    
// ===================================================================================
// CONCURRENCY CONTROL SYSTEM
// ===================================================================================

/**
 * Mutex/Semaphore system for preventing race conditions in async operations.
 * 
 * Provides per-operation-type mutual exclusion locks to ensure only one operation
 * of each type runs at a time. Each mutex has a locked state and a queue for
 * pending operations, preventing data corruption and ensuring operation ordering.
 * 
 * @constant {Object<string, MutexState>}
 * @property {MutexState} displayDreams - Mutex for dream display operations
 * @property {MutexState} saveDreams - Mutex for dream save operations
 * @property {MutexState} saveGoals - Mutex for goal save operations
 * @property {MutexState} saveVoiceNote - Mutex for voice note save operations
 * @property {MutexState} voiceOperations - Mutex for voice recording operations
 * @property {MutexState} deleteOperations - Mutex for delete operations
 * @since 1.0.0
 */
const asyncMutex = {
    displayDreams: { locked: false, queue: [] },
    saveDreams: { locked: false, queue: [] },
    saveGoals: { locked: false, queue: [] },
    saveVoiceNote: { locked: false, queue: [] },
    voiceOperations: { locked: false, queue: [] },
    deleteOperations: { locked: false, queue: [] }
};

/**
 * Represents the state of a mutex lock.
 * 
 * @typedef {Object} MutexState
 * @property {boolean} locked - Whether the mutex is currently locked
 * @property {QueuedOperation[]} queue - Array of queued operations waiting for the lock
 * @since 1.0.0
 */

/**
 * Represents a queued operation waiting for mutex release.
 * 
 * @typedef {Object} QueuedOperation
 * @property {Function} operation - The async operation to execute
 * @property {Function} resolve - Promise resolve function
 * @property {Function} reject - Promise reject function
 * @since 1.0.0
 */
    
/**
 * Executes an async operation under mutex protection to prevent race conditions.
 * 
 * This function implements a generic mutex pattern that ensures only one operation
 * of a given type runs at a time. Operations are queued when the mutex is locked
 * and executed in FIFO order when the lock is released. This prevents data
 * corruption and ensures consistent state during concurrent operations.
 * 
 * @async
 * @param {string} mutexName - Name of the mutex to acquire (must exist in asyncMutex)
 * @param {Function} operation - Async operation to execute under mutex protection
 * @returns {Promise<*>} Promise that resolves with the operation's result
 * @throws {Error} Any error thrown by the operation
 * @since 1.0.0
 * @todo Consider splitting this into separate mutex creation and execution functions
 * @example
 * // Safely save a dream without race conditions
 * await withMutex('saveDreams', async () => {
 *   return await saveDreamToDatabase(dreamData);
 * });
 * 
 * @example
 * // Multiple operations will be queued and executed in order
 * withMutex('displayDreams', () => updateDreamList());
 * withMutex('displayDreams', () => updateDreamCount());
 */
async function withMutex(mutexName, operation) {
        const mutex = asyncMutex[mutexName];
        if (!mutex) {
            console.error(`Unknown mutex: ${mutexName}`);
            return operation(); // Fallback to direct execution if mutex not found
        }
        
        return new Promise((resolve, reject) => {
            const executeOperation = async () => {
                // Queue operation if mutex is currently locked
                if (mutex.locked) {
                    mutex.queue.push({ operation, resolve, reject });
                    return;
                }
                
                // Acquire mutex lock and execute operation
                mutex.locked = true;
                try {
                    const result = await operation();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    // Always release mutex lock
                    mutex.locked = false;
                    
                    // Process next queued operation if any exist
                    if (mutex.queue.length > 0) {
                        const next = mutex.queue.shift();
                        setTimeout(() => executeOperation.call(next), 0);
                    }
                }
            };
            
            executeOperation();
        });
    }
    
// ===================================================================================
// PAGINATION & ENDLESS SCROLL STATE
// ===================================================================================

/**
 * State management object for the endless scroll pagination system.
 * 
 * Tracks the current state of infinite scrolling functionality including
 * whether it's enabled, how many items are loaded, and loading status.
 * Used to implement smooth infinite scrolling for dream entries.
 * 
 * @constant {EndlessScrollState}
 * @property {boolean} enabled - Whether endless scroll is currently active
 * @property {number} loaded - Number of items currently loaded and displayed
 * @property {boolean} loading - Flag to prevent concurrent loading operations
 * @property {number} lastScrollTime - Timestamp of last scroll event for debouncing
 * @since 1.0.0
 */
const endlessScrollState = {
    enabled: false,
    loaded: 0,
    loading: false,
    lastScrollTime: 0
};

/**
 * Endless scroll state configuration object.
 * 
 * @typedef {Object} EndlessScrollState
 * @property {boolean} enabled - Whether endless scroll is currently active
 * @property {number} loaded - Number of items currently loaded and displayed
 * @property {boolean} loading - Flag to prevent concurrent loading operations
 * @property {number} lastScrollTime - Timestamp of last scroll event for debouncing
 * @since 1.0.0
 */

/**
 * Timer ID for debouncing scroll events to improve performance.
 * 
 * Prevents excessive scroll event processing by delaying scroll handling
 * until scrolling stops for a brief period. Reduces CPU usage during
 * rapid scrolling.
 * 
 * @type {number|null}
 * @default null
 * @since 1.0.0
 */
let scrollDebounceTimer = null;
    
// ===================================================================================
// FALLBACK STORAGE STATE
// ===================================================================================

/**
 * In-memory fallback storage array for dream entries when IndexedDB is unavailable.
 * 
 * Provides temporary data persistence when the browser doesn't support IndexedDB
 * or when database operations fail. Data stored here is lost when the page reloads.
 * Used as a last resort to maintain basic functionality.
 * 
 * @type {Object[]}
 * @default []
 * @since 1.0.0
 */
let memoryStorage = [];

/**
 * In-memory fallback storage array for voice notes when IndexedDB is unavailable.
 * 
 * Stores voice note objects temporarily when persistent storage fails.
 * Includes audio blob data, transcriptions, and metadata. Data is lost on
 * page refresh but allows continued functionality during storage failures.
 * 
 * @type {Object[]}
 * @default []
 * @since 1.0.0
 */
let memoryVoiceNotes = [];
    
// ===================================================================================
// UI STATE MANAGEMENT
// ===================================================================================

/**
 * Current page number for dream entry pagination.
 * 
 * Tracks which page of dreams is currently displayed in the journal view.
 * Used by the pagination system to determine which dreams to load and display.
 * Resets to 1 when filters or search terms change.
 * 
 * @type {number}
 * @default 1
 * @since 1.0.0
 */
let currentPage = 1;

/**
 * Object tracking delete confirmation timeouts by dream entry ID.
 * 
 * Maps dream IDs to timeout IDs for the two-step delete confirmation system.
 * When a user clicks delete, a timeout is set and stored here. If they don't
 * confirm within the timeout period, the delete operation is cancelled.
 * 
 * @type {Object<string, number>}
 * @default {}
 * @since 1.0.0
 */
let deleteTimeouts = {};

/**
 * Object tracking voice note delete confirmation timeouts by voice note ID.
 * 
 * Similar to deleteTimeouts but specifically for voice note deletion.
 * Implements the same two-step confirmation pattern to prevent accidental
 * deletion of recorded voice notes.
 * 
 * @type {Object<string, number>}
 * @default {}
 * @since 1.0.0
 */
let voiceDeleteTimeouts = {};

/**
 * Object tracking goal delete confirmation timeouts by goal ID.
 * 
 * Similar to deleteTimeouts but specifically for goal deletion.
 * Implements the same two-step confirmation pattern to prevent accidental
 * deletion of user goals. When a user clicks delete, a timeout is set and
 * stored here. If they don't confirm within the timeout period, the delete
 * operation is cancelled.
 * 
 * @type {Object<string, number>}
 * @default {}
 * @since 2.02.06
 */
let goalDeleteTimeouts = {};
    
// ===================================================================================
// SECURITY & PIN PROTECTION STATE
// ===================================================================================

/**
 * Flag indicating whether the application is currently unlocked via PIN.
 * 
 * When PIN protection is enabled, this flag determines whether the user
 * has successfully authenticated and can access protected content.
 * Set to true after successful PIN entry, false when locked.
 * 
 * @type {boolean}
 * @default false
 * @since 1.0.0
 */
let isUnlocked = false;

/**
 * Counter for failed PIN entry attempts to implement security measures.
 * 
 * Tracks consecutive failed PIN attempts to implement progressive delays
 * or account lockouts. Resets to zero after successful authentication.
 * Used to enhance security against brute force attacks.
 * 
 * @type {number}
 * @default 0
 * @since 1.0.0
 */
let failedPinAttempts = 0;
    
// ===================================================================================
// FORM & TAB STATE MANAGEMENT
// ===================================================================================

/**
 * Flag indicating whether the dream entry form is currently collapsed.
 * 
 * Controls the visual state of the main dream entry form. When true,
 * the form is minimized to save screen space. When false, the full
 * form is displayed for dream entry.
 * 
 * @type {boolean}
 * @default false
 * @since 1.0.0
 */
let isDreamFormCollapsed = false;

// ===================================================================================
// SETTINGS PAGE COLLAPSE STATE
// ===================================================================================

/**
 * Current collapse state of the Appearance settings section.
 *
 * Controls the visibility of the Appearance settings section content.
 * When true, the section is collapsed to save screen space. When false,
 * the full section content is displayed.
 *
 * @type {boolean}
 * @default false
 * @since 2.04.01
 */
let isSettingsAppearanceCollapsed = false;

/**
 * Current collapse state of the Security settings section.
 *
 * Controls the visibility of the Security settings section content.
 * When true, the section is collapsed to save screen space. When false,
 * the full section content is displayed.
 *
 * @type {boolean}
 * @default false
 * @since 2.04.01
 */
let isSettingsSecurityCollapsed = false;

/**
 * Current collapse state of the Data Management settings section.
 *
 * Controls the visibility of the Data Management settings section content.
 * When true, the section is collapsed to save screen space. When false,
 * the full section content is displayed.
 *
 * @type {boolean}
 * @default false
 * @since 2.04.01
 */
let isSettingsDataCollapsed = false;

/**
 * Current collapse state of the Autocomplete Management settings section.
 *
 * Controls the visibility of the Autocomplete Management settings section content.
 * When true, the section is collapsed to save screen space. When false,
 * the full section content is displayed.
 *
 * @type {boolean}
 * @default false
 * @since 2.04.01
 */
let isSettingsAutocompleteCollapsed = false;

// ===================================================================================
// VOICE INTERFACE STATE
// ===================================================================================

/**
 * Currently active tab in the voice interface section.
 *
 * Determines which voice-related interface is displayed to the user.
 * Valid values are 'record' for the recording interface and 'stored'
 * for the stored voice notes interface.
 *
 * @type {('record'|'stored')}
 * @default 'record'
 * @since 1.0.0
 */
let activeVoiceTab = 'record';

/**
 * Currently active main application tab identifier.
 * 
 * Tracks which primary section of the application is currently displayed.
 * Valid values include 'journal', 'voice', 'goals', 'stats', and 'settings'.
 * 
 * @type {string}
 * @default 'journal'
 * @since 1.0.0
 */
let activeAppTab = 'journal';

/**
 * Flag indicating whether the entire application interface is locked.
 * 
 * When true, the main application interface is hidden and only the
 * PIN entry screen is shown. Different from isUnlocked which tracks
 * authentication status.
 * 
 * @type {boolean}
 * @default false
 * @since 1.0.0
 */
let isAppLocked = false;
    
// ===================================================================================
// FEATURE-SPECIFIC STATE
// ===================================================================================

/**
 * Index of the currently displayed daily tip.
 * 
 * Tracks which tip from the daily tips array is currently shown to the user.
 * Used for navigation between tips and to ensure users see different tips
 * across sessions.
 * 
 * @type {number}
 * @default 0
 * @since 1.0.0
 */
let currentTipIndex = 0;


/**
 * Current page number for active goals pagination.
 * 
 * Tracks which page of active (incomplete) goals is currently displayed.
 * Used by the goals pagination system to show the appropriate subset
 * of active goals to the user.
 * 
 * @type {number}
 * @default 1
 * @since 1.0.0
 */
let activeGoalsPage = 1;

/**
 * Current page number for completed goals pagination.
 * 
 * Tracks which page of completed goals is currently displayed.
 * Separate from active goals to allow independent navigation through
 * different goal states.
 * 
 * @type {number}
 * @default 1
 * @since 1.0.0
 */
let completedGoalsPage = 1;

// ===================================================================================
// CALENDAR & STATISTICS STATE
// ===================================================================================

/**
 * State object for the calendar system in the statistics view.
 * 
 * Manages the current calendar display state including which month/year
 * is shown and cached dream data organized by date for efficient rendering.
 * The calendar displays dream frequency and allows navigation to specific dates.
 * 
 * @type {CalendarState}
 * @property {Date} date - Currently displayed calendar month/year
 * @property {Object<string, Object[]>} dreamsByDate - Dreams organized by date string keys
 * @since 1.0.0
 */
let calendarState = {
    date: new Date(),
    dreamsByDate: {}
};

/**
 * Calendar state configuration object.
 * 
 * @typedef {Object} CalendarState
 * @property {Date} date - Currently displayed calendar date (month/year)
 * @property {Object<string, Object[]>} dreamsByDate - Dreams organized by date for calendar display
 * @since 1.0.0
 */

/**
 * Array of daily lucid dreaming tips loaded from external JSON file.
 * 
 * Contains inspirational and educational tips about lucid dreaming that are
 * displayed randomly to users. Populated asynchronously during app initialization.
 * Empty until the tips file is successfully loaded.
 * 
 * @type {string[]}
 * @default []
 * @since 1.0.0
 */
let dailyTips = [];

// ===================================================================================
// ENCRYPTION STATE
// ===================================================================================

/**
 * Current encryption password for session-based decryption.
 *
 * Kept in memory only during authenticated sessions. Used to decrypt encrypted
 * data on demand without requiring password re-entry during app usage.
 * Cleared when app is locked or session ends for security.
 *
 * @type {string|null}
 * @default null
 * @since 2.03.01
 */
let encryptionPassword = null;

/**
 * Flag indicating whether data encryption is enabled.
 *
 * Loaded from localStorage on app initialization. When true, dreams and goals
 * data will be encrypted using AES-256-GCM before storage in IndexedDB.
 * Controls encryption behavior throughout the application.
 *
 * @type {boolean}
 * @default false
 * @since 2.03.01
 */
let encryptionEnabled = false;

/**
 * Cache of decrypted data for current session to improve performance.
 *
 * Prevents repeated decryption operations during app usage by storing
 * decrypted items keyed by store name and ID. Cleared on app lock,
 * password change, or session end. Improves user experience by avoiding
 * decryption delays for recently accessed data.
 *
 * @type {Map<string, any>}
 * @default new Map()
 * @since 2.03.01
 */
let decryptedDataCache = new Map();

// ===================================================================================
// MODULE EXPORTS
// ===================================================================================

// ===================================================================================
// STATE MANAGEMENT FUNCTIONS
// ===================================================================================

/**
 * Sets the active application tab.
 * 
 * @param {string} tabName - The tab name to set as active
 * @since 2.02.06
 */
function setActiveAppTab(tabName) {
    activeAppTab = tabName;
}

/**
 * Gets the current active application tab.
 * 
 * @returns {string} Current active tab name
 * @since 2.02.06
 */
function getActiveAppTab() {
    return activeAppTab;
}

/**
 * Sets the application lock state.
 * 
 * @param {boolean} locked - Whether the app should be locked
 * @since 2.02.06
 */
function setAppLocked(locked) {
    isAppLocked = locked;
}

/**
 * Gets the current application lock state.
 * 
 * @returns {boolean} Whether the app is currently locked
 * @since 2.02.06
 */
function getAppLocked() {
    return isAppLocked;
}

/**
 * Sets the pre-lock active tab for restoration after unlock.
 * 
 * @param {string} tabName - The tab name to remember
 * @since 2.02.06
 */
function setPreLockActiveTab(tabName) {
    preLockActiveTab = tabName;
}

/**
 * Gets the pre-lock active tab.
 * 
 * @returns {string} The tab that was active before locking
 * @since 2.02.06
 */
function getPreLockActiveTab() {
    return preLockActiveTab;
}

/**
 * Sets the unlock state for PIN protection.
 * 
 * @param {boolean} unlocked - Whether the app should be unlocked
 * @since 2.02.06
 */
function setUnlocked(unlocked) {
    isUnlocked = unlocked;
}

/**
 * Gets the current unlock state.
 * 
 * @returns {boolean} Whether the app is currently unlocked
 * @since 2.02.06
 */
function getUnlocked() {
    return isUnlocked;
}

/**
 * Sets the global goals array.
 * 
 * @param {Object[]} goals - The goals array to set
 * @since 2.02.06
 */
function setAllGoals(goals) {
    allGoals = goals;
}

/**
 * Gets the current goals array.
 * 
 * @returns {Object[]} The current goals array
 * @since 2.02.06
 */
function getAllGoals() {
    return allGoals;
}

/**
 * Sets the active goals page number.
 * 
 * @param {number} page - The page number to set
 * @since 2.02.06
 */
function setActiveGoalsPage(page) {
    activeGoalsPage = page;
}

/**
 * Gets the current active goals page number.
 * 
 * @returns {number} The current active goals page number
 * @since 2.02.06
 */
function getActiveGoalsPage() {
    return activeGoalsPage;
}

/**
 * Sets the completed goals page number.
 * 
 * @param {number} page - The page number to set
 * @since 2.02.06
 */
function setCompletedGoalsPage(page) {
    completedGoalsPage = page;
}

/**
 * Gets the current completed goals page number.
 * 
 * @returns {number} The current completed goals page number
 * @since 2.02.06
 */
function getCompletedGoalsPage() {
    return completedGoalsPage;
}

/**
 * Sets the dream form collapsed state.
 * 
 * @param {boolean} collapsed - Whether the dream form is collapsed
 * @since 2.02.06
 */
function setIsDreamFormCollapsed(collapsed) {
    isDreamFormCollapsed = collapsed;
}

/**
 * Gets the current dream form collapsed state.
 *
 * @returns {boolean} True if the dream form is collapsed, false otherwise
 * @since 2.02.06
 */
function getIsDreamFormCollapsed() {
    return isDreamFormCollapsed;
}

// ===================================================================================
// SETTINGS PAGE COLLAPSE STATE GETTERS/SETTERS
// ===================================================================================

/**
 * Sets the appearance settings section collapsed state.
 *
 * @param {boolean} collapsed - Whether the appearance settings section is collapsed
 * @returns {void}
 * @since 2.04.01
 * @example
 * // Collapse the appearance settings section
 * setIsSettingsAppearanceCollapsed(true);
 */
function setIsSettingsAppearanceCollapsed(collapsed) {
    isSettingsAppearanceCollapsed = collapsed;
}

/**
 * Gets the current appearance settings section collapsed state.
 *
 * @returns {boolean} True if the appearance settings section is collapsed, false otherwise
 * @since 2.04.01
 * @example
 * // Check if appearance section is collapsed
 * const isCollapsed = getIsSettingsAppearanceCollapsed();
 */
function getIsSettingsAppearanceCollapsed() {
    return isSettingsAppearanceCollapsed;
}

/**
 * Sets the security settings section collapsed state.
 *
 * @param {boolean} collapsed - Whether the security settings section is collapsed
 * @returns {void}
 * @since 2.04.01
 * @example
 * // Collapse the security settings section
 * setIsSettingsSecurityCollapsed(true);
 */
function setIsSettingsSecurityCollapsed(collapsed) {
    isSettingsSecurityCollapsed = collapsed;
}

/**
 * Gets the current security settings section collapsed state.
 *
 * @returns {boolean} True if the security settings section is collapsed, false otherwise
 * @since 2.04.01
 * @example
 * // Check if security section is collapsed
 * const isCollapsed = getIsSettingsSecurityCollapsed();
 */
function getIsSettingsSecurityCollapsed() {
    return isSettingsSecurityCollapsed;
}

/**
 * Sets the data management settings section collapsed state.
 *
 * @param {boolean} collapsed - Whether the data settings section is collapsed
 * @returns {void}
 * @since 2.04.01
 * @example
 * // Collapse the data management settings section
 * setIsSettingsDataCollapsed(true);
 */
function setIsSettingsDataCollapsed(collapsed) {
    isSettingsDataCollapsed = collapsed;
}

/**
 * Gets the current data management settings section collapsed state.
 *
 * @returns {boolean} True if the data settings section is collapsed, false otherwise
 * @since 2.04.01
 * @example
 * // Check if data section is collapsed
 * const isCollapsed = getIsSettingsDataCollapsed();
 */
function getIsSettingsDataCollapsed() {
    return isSettingsDataCollapsed;
}

/**
 * Sets the autocomplete management settings section collapsed state.
 *
 * @param {boolean} collapsed - Whether the autocomplete settings section is collapsed
 * @returns {void}
 * @since 2.04.01
 * @example
 * // Collapse the autocomplete management settings section
 * setIsSettingsAutocompleteCollapsed(true);
 */
function setIsSettingsAutocompleteCollapsed(collapsed) {
    isSettingsAutocompleteCollapsed = collapsed;
}

/**
 * Gets the current autocomplete management settings section collapsed state.
 *
 * @returns {boolean} True if the autocomplete settings section is collapsed, false otherwise
 * @since 2.04.01
 * @example
 * // Check if autocomplete section is collapsed
 * const isCollapsed = getIsSettingsAutocompleteCollapsed();
 */
function getIsSettingsAutocompleteCollapsed() {
    return isSettingsAutocompleteCollapsed;
}

// ===================================================================================
// PAGINATION STATE GETTERS/SETTERS
// ===================================================================================

/**
 * Sets the current page number for pagination.
 *
 * @param {number} page - The page number to set
 * @since 2.02.06
 */
function setCurrentPage(page) {
    currentPage = page;
}

/**
 * Gets the current page number for pagination.
 * 
 * @returns {number} The current page number
 * @since 2.02.06
 */
function getCurrentPage() {
    return currentPage;
}

/**
 * Sets the scroll debounce timer.
 * 
 * @param {number|null} timer - The timer ID or null
 * @since 2.02.06
 */
function setScrollDebounceTimer(timer) {
    scrollDebounceTimer = timer;
}

/**
 * Gets the current scroll debounce timer.
 * 
 * @returns {number|null} The timer ID or null
 * @since 2.02.06
 */
function getScrollDebounceTimer() {
    return scrollDebounceTimer;
}

/**
 * Sets the search debounce timer.
 * 
 * @param {number|null} timer - The timer ID or null
 * @since 2.02.06
 */
function setSearchDebounceTimer(timer) {
    searchDebounceTimer = timer;
}

/**
 * Gets the current search debounce timer.
 * 
 * @returns {number|null} The timer ID or null
 * @since 2.02.06
 */
function getSearchDebounceTimer() {
    return searchDebounceTimer;
}

/**
 * Sets the filter debounce timer.
 * 
 * @param {number|null} timer - The timer ID or null
 * @since 2.02.06
 */
function setFilterDebounceTimer(timer) {
    filterDebounceTimer = timer;
}

/**
 * Gets the current filter debounce timer.
 * 
 * @returns {number|null} The timer ID or null
 * @since 2.02.06
 */
function getFilterDebounceTimer() {
    return filterDebounceTimer;
}

/**
 * Sets the active voice tab.
 * 
 * @param {string} tabName - The voice tab name to set
 * @since 2.02.06
 */
function setActiveVoiceTab(tabName) {
    activeVoiceTab = tabName;
}

/**
 * Gets the current active voice tab.
 * 
 * @returns {string} The current active voice tab name
 * @since 2.02.06
 */
function getActiveVoiceTab() {
    return activeVoiceTab;
}

/**
 * Sets the media recorder instance.
 * 
 * @param {MediaRecorder|null} recorder - The MediaRecorder instance or null
 * @since 2.02.06
 */
function setMediaRecorder(recorder) {
    mediaRecorder = recorder;
}

/**
 * Gets the current media recorder instance.
 * 
 * @returns {MediaRecorder|null} The MediaRecorder instance or null
 * @since 2.02.06
 */
function getMediaRecorder() {
    return mediaRecorder;
}

/**
 * Sets the audio chunks array.
 * 
 * @param {Array} chunks - The audio chunks array
 * @since 2.02.06
 */
function setAudioChunks(chunks) {
    audioChunks = chunks;
}

/**
 * Gets the current audio chunks array.
 * 
 * @returns {Array} The audio chunks array
 * @since 2.02.06
 */
function getAudioChunks() {
    return audioChunks;
}

/**
 * Sets the current playing audio element.
 * 
 * @param {HTMLAudioElement|null} audio - The audio element or null
 * @since 2.02.06
 */
function setCurrentPlayingAudio(audio) {
    currentPlayingAudio = audio;
}

/**
 * Gets the current playing audio element.
 * 
 * @returns {HTMLAudioElement|null} The current playing audio element or null
 * @since 2.02.06
 */
function getCurrentPlayingAudio() {
    return currentPlayingAudio;
}

/**
 * Sets the recording start time.
 * 
 * @param {number|null} time - The recording start time or null
 * @since 2.02.06
 */
function setRecordingStartTime(time) {
    recordingStartTime = time;
}

/**
 * Gets the current recording start time.
 * 
 * @returns {number|null} The recording start time or null
 * @since 2.02.06
 */
function getRecordingStartTime() {
    return recordingStartTime;
}

/**
 * Sets the recognition results.
 * 
 * @param {string} results - The recognition results string
 * @since 2.02.06
 */
function setRecognitionResults(results) {
    recognitionResults = results;
}

/**
 * Gets the current recognition results.
 * 
 * @returns {string} The recognition results string
 * @since 2.02.06
 */
function getRecognitionResults() {
    return recognitionResults;
}

/**
 * Sets the speech recognition instance.
 * 
 * @param {SpeechRecognition|null} recognition - The speech recognition instance or null
 * @since 2.02.06
 */
function setSpeechRecognition(recognition) {
    speechRecognition = recognition;
}

/**
 * Gets the current speech recognition instance.
 * 
 * @returns {SpeechRecognition|null} The speech recognition instance or null
 * @since 2.02.06
 */
function getSpeechRecognition() {
    return speechRecognition;
}

/**
 * Sets the transcribing state.
 * 
 * @param {boolean} transcribing - Whether transcribing is active
 * @since 2.02.06
 */
function setIsTranscribing(transcribing) {
    isTranscribing = transcribing;
}

/**
 * Gets the current transcribing state.
 * 
 * @returns {boolean} Whether transcribing is active
 * @since 2.02.06
 */
function getIsTranscribing() {
    return isTranscribing;
}

/**
 * Sets the recording timer.
 * 
 * @param {number|null} timer - The recording timer ID or null
 * @since 2.02.06
 */
function setRecordingTimer(timer) {
    recordingTimer = timer;
}

/**
 * Gets the current recording timer.
 * 
 * @returns {number|null} The recording timer ID or null
 * @since 2.02.06
 */
function getRecordingTimer() {
    return recordingTimer;
}

/**
 * Sets the daily tips array.
 * 
 * @param {Array} tips - The daily tips array
 * @since 2.02.06
 */
function setDailyTips(tips) {
    dailyTips = tips;
}

/**
 * Gets the current daily tips array.
 * 
 * @returns {Array} The daily tips array
 * @since 2.02.06
 */
function getDailyTips() {
    return dailyTips;
}

/**
 * Sets the current tip index.
 * 
 * @param {number} index - The tip index to set
 * @since 2.02.06
 */
function setCurrentTipIndex(index) {
    currentTipIndex = index;
}

/**
 * Gets the current tip index.
 * 
 * @returns {number} The current tip index
 * @since 2.02.06
 */
function getCurrentTipIndex() {
    return currentTipIndex;
}

/**
 * Sets the failed PIN attempts count.
 * 
 * @param {number} attempts - The number of failed PIN attempts
 * @since 2.02.06
 */
function setFailedPinAttempts(attempts) {
    failedPinAttempts = attempts;
}

/**
 * Gets the current failed PIN attempts count.
 * 
 * @returns {number} The number of failed PIN attempts
 * @since 2.02.06
 */
function getFailedPinAttempts() {
    return failedPinAttempts;
}

/**
 * Gets the current encryption password for the session.
 *
 * @returns {string|null} The current encryption password or null if not set
 * @since 2.03.01
 */
function getEncryptionPassword() {
    return encryptionPassword;
}

/**
 * Sets the encryption password for the current session.
 *
 * @param {string|null} password - The encryption password to set or null to clear
 * @since 2.03.01
 */
function setEncryptionPassword(password) {
    encryptionPassword = password;
}

/**
 * Gets whether data encryption is currently enabled.
 *
 * @returns {boolean} True if encryption is enabled, false otherwise
 * @since 2.03.01
 */
function getEncryptionEnabled() {
    return encryptionEnabled;
}

/**
 * Sets whether data encryption should be enabled.
 *
 * @param {boolean} enabled - Whether encryption should be enabled
 * @since 2.03.01
 */
function setEncryptionEnabled(enabled) {
    encryptionEnabled = enabled;
}

/**
 * Gets the decrypted data cache for the current session.
 *
 * @returns {Map<string, any>} The decrypted data cache map
 * @since 2.03.01
 */
function getDecryptedDataCache() {
    return decryptedDataCache;
}

/**
 * Clears all entries from the decrypted data cache.
 *
 * Used when locking the app, changing passwords, or ending sessions
 * to ensure cached decrypted data is properly cleared for security.
 *
 * @since 2.03.01
 */
function clearDecryptedDataCache() {
    decryptedDataCache.clear();
}

// Export all global state variables and functions for ES module compatibility
export {
    // Application Data State
    dreams,
    allGoals,
    
    // Tab & Navigation State
    preLockActiveTab,
    
    // State Management Functions
    setActiveAppTab,
    getActiveAppTab,
    setAppLocked,
    getAppLocked,
    setPreLockActiveTab,
    getPreLockActiveTab,
    setUnlocked,
    getUnlocked,
    setAllGoals,
    getAllGoals,
    setActiveGoalsPage,
    getActiveGoalsPage,
    setCompletedGoalsPage,
    getCompletedGoalsPage,
    setIsDreamFormCollapsed,
    getIsDreamFormCollapsed,
    setIsSettingsAppearanceCollapsed,
    getIsSettingsAppearanceCollapsed,
    setIsSettingsSecurityCollapsed,
    getIsSettingsSecurityCollapsed,
    setIsSettingsDataCollapsed,
    getIsSettingsDataCollapsed,
    setIsSettingsAutocompleteCollapsed,
    getIsSettingsAutocompleteCollapsed,
    setCurrentPage,
    getCurrentPage,
    setScrollDebounceTimer,
    getScrollDebounceTimer,
    setSearchDebounceTimer,
    getSearchDebounceTimer,
    setFilterDebounceTimer,
    getFilterDebounceTimer,
    setActiveVoiceTab,
    getActiveVoiceTab,
    setMediaRecorder,
    getMediaRecorder,
    setAudioChunks,
    getAudioChunks,
    setCurrentPlayingAudio,
    getCurrentPlayingAudio,
    setRecordingStartTime,
    getRecordingStartTime,
    setRecognitionResults,
    getRecognitionResults,
    setSpeechRecognition,
    getSpeechRecognition,
    setIsTranscribing,
    getIsTranscribing,
    setRecordingTimer,
    getRecordingTimer,
    setDailyTips,
    getDailyTips,
    setCurrentTipIndex,
    getCurrentTipIndex,
    setFailedPinAttempts,
    getFailedPinAttempts,
    getEncryptionPassword,
    setEncryptionPassword,
    getEncryptionEnabled,
    setEncryptionEnabled,
    getDecryptedDataCache,
    clearDecryptedDataCache,

    // Voice Recording & Transcription State
    mediaRecorder,
    audioChunks,
    recordingStartTime,
    recordingTimer,
    currentPlayingAudio,
    speechRecognition,
    recognitionResults,
    isTranscribing,
    
    // Performance Optimization State
    searchDebounceTimer,
    filterDebounceTimer,
    
    // Concurrency Control System
    asyncMutex,
    withMutex,
    
    // Pagination & Endless Scroll State
    endlessScrollState,
    scrollDebounceTimer,
    
    // Fallback Storage State
    memoryStorage,
    memoryVoiceNotes,
    
    // UI State Management
    currentPage,
    deleteTimeouts,
    voiceDeleteTimeouts,
    goalDeleteTimeouts,
    
    // Security & PIN Protection State
    isUnlocked,
    failedPinAttempts,
    
    // Form & Tab State Management
    isDreamFormCollapsed,
    isSettingsAppearanceCollapsed,
    isSettingsSecurityCollapsed,
    isSettingsDataCollapsed,
    isSettingsAutocompleteCollapsed,
    activeVoiceTab,
    activeAppTab,
    isAppLocked,
    
    // Feature-Specific State
    currentTipIndex,
    activeGoalsPage,
    completedGoalsPage,
    
    // Calendar & Statistics State
    calendarState,
    dailyTips,

    // Encryption State
    encryptionPassword,
    encryptionEnabled,
    decryptedDataCache
};