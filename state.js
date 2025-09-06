/**
 * @fileoverview Global application state management for the Dream Journal application.
 * 
 * Central state repository for all application-wide variables and state tracking.
 * Maintains consistency across modules and prevents state conflicts. This module
 * provides a unified state management system including voice recording, navigation,
 * concurrency control, and UI state management.
 * 
 * @module State
 * @version 2.02.05
 * @author Dream Journal Development Team
 * @since 1.0.0
 * @requires none
 */

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
 * Array containing all lucid dreaming goals loaded from storage.
 * 
 * Holds the complete dataset of user-defined lucid dreaming goals including
 * active and completed goals. Updated when goals are added, modified, or
 * deleted. Used as the data source for goal displays and calculations.
 * 
 * @type {Object[]}
 * @default []
 * @since 1.0.0
 */
let allGoals = [];

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