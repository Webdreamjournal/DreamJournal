// ===================================================================================
// GLOBAL APPLICATION STATE MANAGEMENT
// ===================================================================================
// Central state repository for all application-wide variables and state tracking
// Maintains consistency across modules and prevents state conflicts

// ===================================================================================
// TAB & NAVIGATION STATE
// ===================================================================================

// Pre-lock state preservation
let preLockActiveTab = 'journal'; // Stores active tab before PIN lock activation

// ===================================================================================
// VOICE RECORDING & TRANSCRIPTION STATE
// ===================================================================================

// Voice recording system state
let mediaRecorder = null; // MediaRecorder instance for audio capture
let audioChunks = []; // Temporary storage for audio data chunks
let recordingStartTime = null; // Timestamp when recording started
let recordingTimer = null; // Interval timer for recording duration display
let currentPlayingAudio = null; // Currently playing audio element reference

// Speech recognition system state
let speechRecognition = null; // SpeechRecognition API instance
let recognitionResults = ''; // Accumulated transcription results
let isTranscribing = false; // Flag indicating active transcription process
    
// ===================================================================================
// PERFORMANCE OPTIMIZATION STATE
// ===================================================================================

// Debouncing timers for performance optimization
let searchDebounceTimer = null; // Timer for search input debouncing
let filterDebounceTimer = null; // Timer for filter change debouncing
    
// ===================================================================================
// CONCURRENCY CONTROL SYSTEM
// ===================================================================================

// Mutex/Semaphore system for preventing race conditions in async operations
const asyncMutex = {
    displayDreams: { locked: false, queue: [] }, // Dream display operations
    saveDreams: { locked: false, queue: [] }, // Dream save operations
    saveGoals: { locked: false, queue: [] }, // Goal save operations
    saveVoiceNote: { locked: false, queue: [] }, // Voice note save operations
    voiceOperations: { locked: false, queue: [] }, // Voice recording operations
    deleteOperations: { locked: false, queue: [] } // Delete operations
};
    
// Generic mutex implementation for async operation serialization
// Ensures only one operation of a given type runs at a time
// TODO: Consider splitting this into separate mutex creation and execution functions
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

// Endless scroll system state management
const endlessScrollState = {
    enabled: false, // Whether endless scroll is currently active
    loaded: 0, // Number of items currently loaded
    loading: false, // Flag to prevent concurrent loading
    lastScrollTime: 0 // Timestamp of last scroll event for debouncing
};

// Scroll event debouncing timer
let scrollDebounceTimer = null;
    
// ===================================================================================
// FALLBACK STORAGE STATE
// ===================================================================================

// In-memory fallback storage for when IndexedDB isn't available
let memoryStorage = []; // Fallback storage for dreams
let memoryVoiceNotes = []; // Fallback storage for voice notes
    
// ===================================================================================
// UI STATE MANAGEMENT
// ===================================================================================

// Pagination state
let currentPage = 1; // Current page number for dream pagination

// Delete confirmation timeout tracking
let deleteTimeouts = {}; // Tracks delete confirmation timeouts by dream ID
let voiceDeleteTimeouts = {}; // Tracks voice note delete confirmation timeouts
    
// ===================================================================================
// SECURITY & PIN PROTECTION STATE
// ===================================================================================

// PIN protection system state
let isUnlocked = false; // Whether the app is currently unlocked
let failedPinAttempts = 0; // Counter for failed PIN entry attempts
    
// ===================================================================================
// FORM & TAB STATE MANAGEMENT
// ===================================================================================

// Dream form UI state
let isDreamFormCollapsed = false; // Whether the dream entry form is collapsed

// Voice interface tab state
let activeVoiceTab = 'record'; // Currently active voice tab ('record' or 'stored')

// Main application tab state
let activeAppTab = 'journal'; // Currently active main tab
let isAppLocked = false; // Whether the entire app interface is locked
    
// ===================================================================================
// FEATURE-SPECIFIC STATE
// ===================================================================================

// Daily tips navigation state
let currentTipIndex = 0; // Index of currently displayed tip

// Goals system state
let allGoals = []; // All goals data loaded from storage

// Goals pagination state
let activeGoalsPage = 1; // Current page for active goals
let completedGoalsPage = 1; // Current page for completed goals

// ===================================================================================
// CALENDAR & STATISTICS STATE
// ===================================================================================

// Calendar system state management
let calendarState = {
    date: new Date(), // Currently displayed calendar date
    dreamsByDate: {} // Dreams organized by date for calendar display
};