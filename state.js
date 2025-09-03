    // ===================================================================================
    // SECTION 2: GLOBAL APPLICATION STATE
    // ===================================================================================

    let preLockActiveTab = 'journal'; // Remember which tab was active before locking

    // Voice recording variables
    let mediaRecorder = null;
    let audioChunks = [];
    let recordingStartTime = null;
    let recordingTimer = null;
    let currentPlayingAudio = null;
    
    // Speech recognition variables
    let speechRecognition = null;
    let recognitionResults = '';
    let isTranscribing = false;
    
    // Performance optimization: Debouncing utilities
    let searchDebounceTimer = null;
    let filterDebounceTimer = null;
    
    // Mutex/Semaphore system for preventing race conditions
    const asyncMutex = {
        displayDreams: { locked: false, queue: [] },
        saveDreams: { locked: false, queue: [] },
        saveGoals: { locked: false, queue: [] },
        voiceOperations: { locked: false, queue: [] },
        deleteOperations: { locked: false, queue: [] }
    };
    
    // Generic mutex implementation
    async function withMutex(mutexName, operation) {
        const mutex = asyncMutex[mutexName];
        if (!mutex) {
            console.error(`Unknown mutex: ${mutexName}`);
            return operation();
        }
        
        return new Promise((resolve, reject) => {
            const executeOperation = async () => {
                if (mutex.locked) {
                    mutex.queue.push({ operation, resolve, reject });
                    return;
                }
                
                mutex.locked = true;
                try {
                    const result = await operation();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    mutex.locked = false;
                    
                    // Process next item in queue
                    if (mutex.queue.length > 0) {
                        const next = mutex.queue.shift();
                        setTimeout(() => executeOperation.call(next), 0);
                    }
                }
            };
            
            executeOperation();
        });
    }
    
    // Endless scroll variables (with proper state management)
    const endlessScrollState = {
        enabled: false,
        loaded: 0,
        loading: false,
        lastScrollTime: 0
    };
    
    let scrollDebounceTimer = null;
    
    // In-memory fallback for when storage isn't available
    let memoryStorage = [];
    let memoryVoiceNotes = [];
    
    // UI state variables
    let currentPage = 1;
    let deleteTimeouts = {}; // Track delete confirmation timeouts
    let voiceDeleteTimeouts = {}; // Track voice note delete confirmation timeouts
    
    // PIN protection state
    let isUnlocked = false;
    let failedPinAttempts = 0;
    
    // UI form state
    let isDreamFormCollapsed = false;
    
    // Voice tab state
    let activeVoiceTab = 'record';
    
    // Main app tab state
    let activeAppTab = 'journal';
    let isAppLocked = false;
    
    // Tips navigation state
    let currentTipIndex = 0;
    
    // Goals data state
    let allGoals = [];
    
    // Goals pagination state
    let activeGoalsPage = 1;
    let completedGoalsPage = 1;

    // CALENDAR & STATS SYSTEM

    let calendarState = {
        date: new Date(),
        dreamsByDate: {}
    };