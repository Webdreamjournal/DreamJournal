/**
 * @fileoverview Dream Journal Constants & Configuration
 * 
 * Central repository for all application constants, templates, and configuration values.
 * Maintains single source of truth for consistent behavior across modules.
 * 
 * @module constants
 * @version 2.04.00
 * @author Dream Journal Development Team
 * @since 1.0.0
 */

// ===================================================================================
// DREAM JOURNAL CONSTANTS & CONFIGURATION
// ===================================================================================

/**
 * Storage key for dream form collapse state.
 *
 * Used to persist whether the dream entry form is collapsed or expanded
 * across browser sessions for better user experience.
 *
 * @constant {string}
 * @since 2.0.0
 */
const DREAM_FORM_COLLAPSE_KEY = 'dreamFormCollapsed';

// ===================================================================================
// SETTINGS PAGE COLLAPSE STATE KEYS
// ===================================================================================

/**
 * Storage key for settings appearance section collapse state.
 *
 * Used to persist whether the Appearance settings section is collapsed or expanded
 * across browser sessions for better user experience.
 *
 * @constant {string}
 * @since 2.04.01
 */
const SETTINGS_APPEARANCE_COLLAPSE_KEY = 'settingsAppearanceCollapsed';

/**
 * Storage key for settings security section collapse state.
 *
 * Used to persist whether the Security settings section is collapsed or expanded
 * across browser sessions for better user experience.
 *
 * @constant {string}
 * @since 2.04.01
 */
const SETTINGS_SECURITY_COLLAPSE_KEY = 'settingsSecurityCollapsed';

/**
 * Storage key for settings data management section collapse state.
 *
 * Used to persist whether the Data Management settings section is collapsed or expanded
 * across browser sessions for better user experience.
 *
 * @constant {string}
 * @since 2.04.01
 */
const SETTINGS_DATA_COLLAPSE_KEY = 'settingsDataCollapsed';

/**
 * Storage key for settings autocomplete section collapse state.
 *
 * Used to persist whether the Autocomplete Management settings section is collapsed or expanded
 * across browser sessions for better user experience.
 *
 * @constant {string}
 * @since 2.04.01
 */
const SETTINGS_AUTOCOMPLETE_COLLAPSE_KEY = 'settingsAutocompleteCollapsed';

/**
 * Storage key for settings cloud sync section collapse state.
 *
 * Used to persist whether the Cloud Sync settings section is collapsed or expanded
 * across browser sessions for better user experience.
 *
 * @constant {string}
 * @since 2.04.01
 */
const SETTINGS_CLOUD_SYNC_COLLAPSE_KEY = 'settingsCloudSyncCollapsed';

// ===================================================================================
// GOALS PAGE COLLAPSE STATE KEYS
// ===================================================================================

/**
 * Storage key for goals active section collapse state.
 *
 * Used to persist whether the Active Goals section is collapsed or expanded
 * across browser sessions for better user experience.
 *
 * @constant {string}
 * @since 2.04.01
 */
const GOALS_ACTIVE_COLLAPSE_KEY = 'goalsActiveCollapsed';

/**
 * Storage key for goals templates section collapse state.
 *
 * Used to persist whether the Quick Goal Templates section is collapsed or expanded
 * across browser sessions for better user experience.
 *
 * @constant {string}
 * @since 2.04.01
 */
const GOALS_TEMPLATES_COLLAPSE_KEY = 'goalsTemplatesCollapsed';

/**
 * Storage key for goals completed section collapse state.
 *
 * Used to persist whether the Completed Goals section is collapsed or expanded
 * across browser sessions for better user experience.
 *
 * @constant {string}
 * @since 2.04.01
 */
const GOALS_COMPLETED_COLLAPSE_KEY = 'goalsCompletedCollapsed';

// ===================================================================================
// ADVICE PAGE COLLAPSE STATE KEYS
// ===================================================================================

/**
 * Storage key for advice daily tip section collapse state.
 *
 * Used to persist whether the Daily Lucid Dreaming Tip section is collapsed or expanded
 * across browser sessions for better user experience.
 *
 * @constant {string}
 * @since 2.04.01
 */
const ADVICE_DAILY_TIP_COLLAPSE_KEY = 'adviceDailyTipCollapsed';

/**
 * Storage key for advice techniques section collapse state.
 *
 * Used to persist whether the Lucid Dreaming Techniques section is collapsed or expanded
 * across browser sessions for better user experience.
 *
 * @constant {string}
 * @since 2.04.01
 */
const ADVICE_TECHNIQUES_COLLAPSE_KEY = 'adviceTechniquesCollapsed';

/**
 * Storage key for advice general section collapse state.
 *
 * Used to persist whether the General Advice section is collapsed or expanded
 * across browser sessions for better user experience.
 *
 * @constant {string}
 * @since 2.04.01
 */
const ADVICE_GENERAL_COLLAPSE_KEY = 'adviceGeneralCollapsed';

// ===================================================================================
// JOURNAL PAGE COLLAPSE STATE KEYS
// ===================================================================================

/**
 * Storage key for journal controls section collapse state.
 *
 * Used to persist whether the Search & Filter Controls section is collapsed or expanded
 * across browser sessions for better user experience.
 *
 * @constant {string}
 * @since 2.04.01
 */
const JOURNAL_CONTROLS_COLLAPSE_KEY = 'journalControlsCollapsed';

// ===================================================================================
// CLOUD SYNC CONFIGURATION
// ===================================================================================

/**
 * Default Dropbox OAuth client ID for authentication.
 *
 * This is the default app key that works for most users. Advanced users can
 * override this in the settings if they want to use their own Dropbox app
 * (for example, if hosting on a different domain or experiencing rate limits).
 *
 * @constant {string}
 * @since 2.04.01
 */
const DEFAULT_DROPBOX_CLIENT_ID = 'q3er21gj468udt5';

/**
 * Storage key for custom Dropbox client ID.
 *
 * Used to store a user-configured Dropbox app key that overrides the default.
 * Only used by advanced users who need their own Dropbox app configuration.
 *
 * @constant {string}
 * @since 2.04.01
 */
const CUSTOM_DROPBOX_CLIENT_ID_KEY = 'customDropboxClientId';

/**
 * OAuth redirect URI for Dropbox authentication callback.
 *
 * The redirect URI that Dropbox will use to return users after authentication.
 * Must match exactly with the URI registered in the Dropbox app console.
 *
 * @constant {string}
 * @since 2.04.01
 */
const DROPBOX_REDIRECT_URI = window.location.origin + window.location.pathname;

/**
 * Storage key for cloud sync enabled status.
 *
 * Used to persist whether cloud sync functionality is enabled
 * across browser sessions.
 *
 * @constant {string}
 * @since 2.04.01
 */
const CLOUD_SYNC_ENABLED_KEY = 'cloudSyncEnabled';

/**
 * Storage key for automatic cloud sync preference.
 *
 * Used to persist user's preference for automatic cloud synchronization
 * across browser sessions.
 *
 * @constant {string}
 * @since 2.04.01
 */
const CLOUD_AUTO_SYNC_KEY = 'cloudAutoSync';

/**
 * Storage key for Dropbox access token.
 *
 * Used to securely store the encrypted Dropbox access token
 * for API authentication.
 *
 * @constant {string}
 * @since 2.04.01
 */
const DROPBOX_ACCESS_TOKEN_KEY = 'dropboxAccessToken';

/**
 * Storage key for Dropbox refresh token.
 *
 * Used to securely store the encrypted Dropbox refresh token
 * for automatic token renewal.
 *
 * @constant {string}
 * @since 2.04.01
 */
const DROPBOX_REFRESH_TOKEN_KEY = 'dropboxRefreshToken';

/**
 * Storage key for Dropbox token expiration time.
 *
 * Used to store the access token expiration timestamp
 * for automatic refresh handling.
 *
 * @constant {string}
 * @since 2.04.01
 */
const DROPBOX_TOKEN_EXPIRES_KEY = 'dropboxTokenExpires';

/**
 * Storage key for cloud backup encryption setting.
 *
 * When enabled, cloud backups are encrypted using the user's
 * encryption password before uploading to Dropbox. When disabled,
 * cloud backups are stored as plain JSON for portability.
 *
 * @constant {string}
 * @since 2.04.65
 */
const CLOUD_ENCRYPTION_ENABLED_KEY = 'cloudEncryptionEnabled';

/**
 * Storage key for last cloud sync timestamp.
 *
 * Used to track when the last successful cloud synchronization
 * occurred for display and automation purposes.
 *
 * @constant {string}
 * @since 2.04.01
 */
const LAST_CLOUD_SYNC_KEY = 'lastCloudSync';

/**
 * Storage key for pagination preference setting.
 *
 * Used to persist user's pagination preference (5, 10, 20, 50, endless, all)
 * across browser sessions for consistent user experience.
 *
 * @constant {string}
 * @since 2.04.01
 */
const PAGINATION_STORAGE_KEY = 'dreamJournalPaginationLimit';

/**
 * Default pagination limit when no user preference is saved.
 *
 * Fallback value used when localStorage is unavailable or no preference
 * has been set by the user. Matches the original default behavior.
 *
 * @constant {string}
 * @since 2.04.01
 */
const DEFAULT_PAGINATION_LIMIT = 'endless';

/**
 * Core application constants and configuration values.
 * 
 * Centralized configuration object containing all timing, limits, validation rules,
 * and system parameters used throughout the Dream Journal application. Organized
 * by functional domain for easy maintenance and reference.
 * 
 * @constant {Object}
 * @readonly
 * @property {number} VOICE_STORAGE_LIMIT - Maximum number of stored voice notes
 * @property {number} PIN_RESET_HOURS - Hours before PIN reset timer expires
 * @property {number} PIN_MIN_LENGTH - Minimum PIN length requirement
 * @property {number} PIN_MAX_LENGTH - Maximum PIN length allowed
 * @property {number} PASSWORD_MIN_LENGTH - Minimum password length for encryption
 * @property {number} FAILED_PIN_ATTEMPT_LIMIT - Max failed PIN attempts before lockout
 * @property {number} CRYPTO_SALT_SIZE - Salt size in bytes for PBKDF2 key derivation
 * @property {number} CRYPTO_IV_SIZE - Initialization vector size for AES-GCM encryption
 * @property {number} CRYPTO_PBKDF2_ITERATIONS - PBKDF2 iterations for security hardening
 * @property {number} CRYPTO_KEY_LENGTH - AES encryption key length in bits
 * @property {number} DEBOUNCE_SEARCH_MS - Search input debounce delay
 * @property {number} DEBOUNCE_FILTER_MS - Filter change debounce delay
 * @property {number} DEBOUNCE_SCROLL_MS - Scroll event debounce delay
 * @property {number} ENDLESS_SCROLL_THRESHOLD_PX - Distance from bottom to trigger infinite scroll
 * @property {number} ENDLESS_SCROLL_INCREMENT - Items to load per scroll event
 * @property {number} MAX_TAGS_PER_DREAM - Maximum tags allowed per dream entry
 * @property {number} MAX_TAG_LENGTH - Maximum characters allowed per tag
 * @property {number} AI_ANALYSIS_RECENT_LIMIT - Recent dreams included in AI export
 * @property {number} AI_ANALYSIS_TOTAL_LIMIT - Total dreams exported for AI analysis
 * @property {number} AI_ANALYSIS_THRESHOLD - Minimum word count for AI analysis inclusion
 * @property {number} LARGE_DATASET_THRESHOLD - Dream count considered large dataset
 * @property {number} AUTOCOMPLETE_MIN_CHARS - Minimum characters to trigger autocomplete
 * @property {number} AUTOCOMPLETE_MAX_RESULTS - Maximum autocomplete suggestions displayed
 * @property {number} DOM_TRAVERSAL_LEVELS - Maximum DOM levels traversed for action contexts
 * @property {number} TEXT_TRUNCATE_LENGTH - Character limit for text truncation
 * @property {number} PAGINATION_MAX_VISIBLE_PAGES - Maximum page numbers shown in pagination
 * @property {number} PAGINATION_CURRENT_PAGE_PROXIMITY - Pages shown around current page
 * @property {number} PAGINATION_ELLIPSIS_THRESHOLD - Threshold for showing pagination ellipsis
 * @property {number} BYTES_PER_KB - Bytes per kilobyte conversion factor
 * @property {number} BYTES_PER_MB - Bytes per megabyte conversion factor
 * @property {number} DB_VERSION - Current IndexedDB schema version
 * @property {number} DATETIME_LOCAL_SLICE_LENGTH - Length of datetime-local string slice
 * @property {number} MESSAGE_DURATION_SHORT - Short notification display duration (ms)
 * @property {number} MESSAGE_DURATION_MEDIUM - Medium notification display duration (ms)
 * @property {number} MESSAGE_DURATION_LONG - Long notification display duration (ms)
 * @property {number} MESSAGE_DURATION_EXTENDED - Extended notification display duration (ms)
 * @property {number} CLEANUP_DELAY_MS - Delay before cleaning up temporary elements
 * @property {number} FOCUS_DELAY_MS - Delay before focusing elements (prevents race conditions)
 * @property {number} BACKUP_UPDATE_DELAY_MS - Delay between backup progress updates
 * @property {number} DOWNLOAD_CLEANUP_DELAY_MS - Delay before cleaning up download URLs
 * @property {number} GOALS_PER_PAGE - Goals displayed per page in interface
 * @since 1.0.0
 * @example
 * // Access configuration values
 * const maxTags = CONSTANTS.MAX_TAGS_PER_DREAM; // 20
 * const searchDelay = CONSTANTS.DEBOUNCE_SEARCH_MS; // 300ms
 * 
 * @example
 * // Use in validation
 * if (dreamTags.length > CONSTANTS.MAX_TAGS_PER_DREAM) {
 *   showError('Too many tags');
 * }
 * 
 * @example
 * // Use in cryptographic operations
 * const saltArray = new Uint8Array(CONSTANTS.CRYPTO_SALT_SIZE);
 * crypto.getRandomValues(saltArray);
 */
const CONSTANTS = {
        // Voice Recording System Limits
        VOICE_STORAGE_LIMIT: 5, // Maximum number of stored voice notes
        
        // Security & PIN Protection System
        PIN_RESET_HOURS: 72, // Hours before PIN reset timer expires
        PIN_MIN_LENGTH: 4, // Minimum PIN length
        PIN_MAX_LENGTH: 6, // Maximum PIN length
        PASSWORD_MIN_LENGTH: 4, // Minimum password length for encryption
        FAILED_PIN_ATTEMPT_LIMIT: 3, // Max failed attempts before lockout
        
        // Cryptographic Parameters for Encryption/Export
        CRYPTO_SALT_SIZE: 16, // Salt size in bytes for PBKDF2
        CRYPTO_IV_SIZE: 12, // Initialization vector size for AES-GCM
        CRYPTO_PBKDF2_ITERATIONS: 100000, // Key derivation iterations (security)
        CRYPTO_KEY_LENGTH: 256, // AES key length in bits
        
        // Performance Optimization & Debouncing
        DEBOUNCE_SEARCH_MS: 300, // Delay for search input debouncing
        DEBOUNCE_FILTER_MS: 150, // Delay for filter change debouncing
        DEBOUNCE_SCROLL_MS: 100, // Delay for scroll event debouncing
        ENDLESS_SCROLL_THRESHOLD_PX: 500, // Pixels from bottom to trigger load
        ENDLESS_SCROLL_INCREMENT: 5, // Number of items to load per scroll
        
        // Data Validation & Content Limits
        MAX_TAGS_PER_DREAM: 20, // Maximum tags allowed per dream entry
        MAX_TAG_LENGTH: 50, // Maximum characters per tag
        AI_ANALYSIS_RECENT_LIMIT: 15, // Recent dreams included in AI export
        AI_ANALYSIS_TOTAL_LIMIT: 20, // Total dreams to export for AI analysis
        AI_ANALYSIS_THRESHOLD: 50, // Word count threshold for analysis inclusion
        LARGE_DATASET_THRESHOLD: 50, // Dream count considered "large dataset"
        
        // User Interface & Autocomplete System
        AUTOCOMPLETE_MIN_CHARS: 2, // Minimum chars to trigger autocomplete
        AUTOCOMPLETE_MAX_RESULTS: 8, // Maximum autocomplete suggestions shown
        DOM_TRAVERSAL_LEVELS: 3, // Max levels to traverse for action contexts
        TEXT_TRUNCATE_LENGTH: 50, // Character limit for text truncation
        
        // Pagination Display Configuration
        PAGINATION_MAX_VISIBLE_PAGES: 7, // Maximum page numbers shown in pagination
        PAGINATION_CURRENT_PAGE_PROXIMITY: 4, // Pages shown around current page
        PAGINATION_ELLIPSIS_THRESHOLD: 3, // When to show "..." in pagination
        
        // File Size Calculations
        BYTES_PER_KB: 1024, // Bytes per kilobyte
        BYTES_PER_MB: 1048576, // Bytes per megabyte (1024 * 1024)
        
        // IndexedDB Configuration
        DB_VERSION: 5, // Current database schema version
        DATETIME_LOCAL_SLICE_LENGTH: 16, // Characters in datetime-local format
        
        // UI Timing & Animation Durations (milliseconds)
        MESSAGE_DURATION_SHORT: 3000, // Short notification display time
        MESSAGE_DURATION_MEDIUM: 5000, // Medium notification display time
        MESSAGE_DURATION_LONG: 7000, // Long notification display time
        MESSAGE_DURATION_EXTENDED: 10000, // Extended notification display time
        CLEANUP_DELAY_MS: 3000, // Delay before cleaning up temporary elements
        FOCUS_DELAY_MS: 100, // Delay before focusing elements (prevent race conditions)
        
        // File Operations & Storage Management
        BACKUP_UPDATE_DELAY_MS: 100, // Delay between backup progress updates
        DOWNLOAD_CLEANUP_DELAY_MS: 3000, // Delay before cleaning up download URLs
        
        // Pagination Configuration
        GOALS_PER_PAGE: 5 // Number of goals displayed per page in goals interface
    };
    
/**
 * Predefined goal templates for common lucid dreaming objectives.
 * 
 * Template configurations that users can select to create standardized goals
 * for tracking lucid dreaming progress. Each template defines the goal type,
 * tracking period, target values, and visual representation.
 * 
 * @constant {Object}
 * @readonly
 * @property {GoalTemplate} lucid-monthly - Monthly lucid dream achievement goal
 * @property {GoalTemplate} recall-streak - Consecutive dream recall tracking
 * @property {GoalTemplate} journal-habit - Daily journaling consistency goal
 * @property {GoalTemplate} dream-signs - Dream signs identification and collection
 * @property {GoalTemplate} custom - User-defined custom goal template
 * @since 2.0.0
 * @example
 * // Access goal templates
 * const lucidGoal = GOAL_TEMPLATES['lucid-monthly'];
 * console.log(lucidGoal.title); // "Monthly Lucid Dreams"
 * 
 * @example
 * // Create goal from template
 * function createGoalFromTemplate(templateKey, customTarget) {
 *   const template = GOAL_TEMPLATES[templateKey];
 *   return {
 *     ...template,
 *     target: customTarget || template.target,
 *     createdAt: new Date()
 *   };
 * }
 */
const GOAL_TEMPLATES = {
        'lucid-monthly': {
            title: 'Monthly Lucid Dreams',
            description: 'Achieve lucid dreams this month',
            type: 'lucid_count', // Goal tracks lucid dream count
            period: 'monthly', // Resets monthly
            target: 3, // Target number of lucid dreams
            icon: '✨'
        },
        'recall-streak': {
            title: 'Dream Recall Streak',
            description: 'Remember dreams for consecutive days',
            type: 'recall_streak', // Goal tracks consecutive recall days
            period: 'streak', // Maintains running streak
            target: 7, // Target consecutive days
            icon: '🧠'
        },
        'journal-habit': {
            title: 'Daily Journaling',
            description: 'Write in dream journal consistently',
            type: 'journal_streak', // Goal tracks journaling consistency
            period: 'streak', // Maintains running streak
            target: 30, // Target consecutive days
            icon: '📝'
        },
        'dream-signs': {
            title: 'Dream Signs Collection',
            description: 'Identify and track dream signs',
            type: 'dream_signs_count', // Goal tracks unique dream signs
            period: 'total', // Cumulative total
            target: 10, // Target number of unique dream signs
            icon: '🔍'
        },
        'custom': {
            title: 'Custom Goal',
            description: 'Track your personal goal manually',
            type: 'custom', // User-defined goal type
            period: 'total', // Cumulative tracking
            target: 1, // Default target (user configurable)
            icon: '⭐'
        }
    };

/**
 * Loads daily tips from external JSON file for the tips system.
 * 
 * Asynchronously fetches tip data from the tips.json file to populate
 * the daily tips feature. Handles network errors gracefully by returning
 * an empty array as fallback, ensuring the application continues to function
 * even if tips cannot be loaded.
 * 
 * @async
 * @function
 * @returns {Promise<Array<TipObject>>} Promise that resolves to array of tip objects
 * @throws {Error} When fetch fails or response is not ok
 * @since 2.0.0
 * @example
 * const tips = await loadDailyTips();
 * if (tips.length > 0) {
 *   displayRandomTip(tips);
 * }
 * 
 * @example
 * // Handle loading errors gracefully
 * loadDailyTips()
 *   .then(tips => console.log(`Loaded ${tips.length} tips`))
 *   .catch(error => console.warn('Tips unavailable:', error));
 */
async function loadDailyTips() {
    try {
        const response = await fetch('./tips.json');
        if (!response.ok) {
            throw new Error(`Failed to load tips: ${response.status}`);
        }
        const tips = await response.json();
        return tips;
    } catch (error) {
        console.error('Error loading daily tips:', error);
        // Return empty array as fallback
        return [];
    }
}

/**
 * Gets the total count of available tips without loading all tip content.
 *
 * This optimized function loads the tips file but only returns the count,
 * allowing for efficient tip-of-the-day calculation without processing
 * all tip content upfront.
 *
 * @async
 * @function
 * @returns {Promise<number>} Total number of available tips
 * @throws {Error} When tips file cannot be loaded
 * @since 2.03.04
 * @example
 * const tipCount = await getTipsCount();
 * const todaysTipIndex = daysSinceEpoch % tipCount;
 */
async function getTipsCount() {
    try {
        const response = await fetch('./tips.json');
        if (!response.ok) {
            throw new Error(`Failed to load tips count: ${response.status}`);
        }
        const tips = await response.json();
        return tips.length;
    } catch (error) {
        console.error('Error getting tips count:', error);
        return 0;
    }
}

/**
 * Daily tip cache for instant loading.
 *
 * This cache stores the current day's tip to avoid loading the entire tips.json
 * file when users navigate to the advice tab. The cache is populated during
 * app initialization and includes the tip content and metadata.
 *
 * @type {Object|null}
 * @private
 * @since 2.04.01
 */
let _dailyTipCache = null;

/**
 * Caches the daily tip during app initialization for instant loading.
 *
 * This function calculates the tip-of-the-day index based on the user's
 * dream history and pre-loads just that tip into memory. This eliminates
 * the need to load the entire 400+ tip JSON file when users visit the
 * advice tab, providing instant loading.
 *
 * @async
 * @function
 * @param {Array} dreams - User's dream entries for tip calculation
 * @returns {Promise<Object|null>} Cached tip object or null if caching failed
 * @throws {Error} When tip caching fails
 * @since 2.04.01
 * @example
 * const dreams = await loadDreams();
 * const cachedTip = await cacheDailyTip(dreams);
 * // Daily tip is now cached for instant loading
 */
async function cacheDailyTip(dreams = []) {
    try {
        // Get tips count and calculate tip-of-the-day index
        const tipCount = await getTipsCount();
        if (tipCount === 0) {
            console.warn('No tips available for caching');
            return null;
        }

        let tipOfTheDayIndex = 0; // Default to tip 1 (index 0)

        if (dreams && dreams.length > 0) {
            // Find the earliest dream date
            const dreamDates = dreams
                .map(dream => new Date(dream.timestamp))
                .filter(date => !isNaN(date.getTime()))
                .sort((a, b) => a - b);

            if (dreamDates.length > 0) {
                const epoch = dreamDates[0];
                const now = new Date();
                const diffTime = now - epoch;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                tipOfTheDayIndex = diffDays % tipCount;
            }
        }

        // Load just the specific tip needed
        const tip = await loadTipByIndex(tipOfTheDayIndex);
        if (tip) {
            _dailyTipCache = {
                ...tip,
                index: tipOfTheDayIndex,
                totalTips: tipCount,
                cachedAt: Date.now()
            };
            console.log(`Daily tip cached: Tip ${tipOfTheDayIndex + 1} of ${tipCount}`);
            return _dailyTipCache;
        }

        return null;
    } catch (error) {
        console.error('Error caching daily tip:', error);
        return null;
    }
}

/**
 * Retrieves the cached daily tip for instant loading.
 *
 * This function returns the pre-cached daily tip without any network requests,
 * providing instant loading when users navigate to the advice tab. Falls back
 * to loading the tip if cache is empty.
 *
 * @function
 * @returns {Object|null} Cached tip object or null if not cached
 * @since 2.04.01
 * @example
 * const cachedTip = getCachedDailyTip();
 * if (cachedTip) {
 *   displayTip(cachedTip);
 * } else {
 *   // Fallback to lazy loading
 *   await loadTipByIndex(0);
 * }
 */
function getCachedDailyTip() {
    return _dailyTipCache;
}

/**
 * Clears the daily tip cache.
 *
 * Used for testing or when tip cache needs to be refreshed.
 *
 * @function
 * @since 2.04.01
 */
function clearDailyTipCache() {
    _dailyTipCache = null;
}

/**
 * Loads a specific tip by its index, with caching for performance.
 *
 * This function provides efficient access to individual tips without loading
 * the entire tips array. It includes caching to prevent repeated network
 * requests for the same tip data.
 *
 * @async
 * @function
 * @param {number} index - Zero-based index of the tip to load
 * @returns {Promise<Object|null>} Tip object with category and text, or null if not found
 * @throws {Error} When tip index is invalid or tips cannot be loaded
 * @since 2.03.04
 * @example
 * const tip = await loadTipByIndex(42);
 * if (tip) {
 *   console.log(`${tip.category}: ${tip.text}`);
 * }
 */
async function loadTipByIndex(index) {
    // Input validation
    if (typeof index !== 'number' || index < 0) {
        console.warn('loadTipByIndex: Invalid index provided:', index);
        return null;
    }

    // Check cache first
    if (loadTipByIndex._cache && loadTipByIndex._cache[index]) {
        return loadTipByIndex._cache[index];
    }

    try {
        // Load full tips array (could be optimized further with server-side indexing)
        const response = await fetch('./tips.json');
        if (!response.ok) {
            throw new Error(`Failed to load tip: ${response.status}`);
        }
        const tips = await response.json();

        // Validate index
        if (index >= tips.length) {
            console.warn('loadTipByIndex: Index out of bounds:', index, 'Total tips:', tips.length);
            return null;
        }

        // Initialize cache if needed
        if (!loadTipByIndex._cache) {
            loadTipByIndex._cache = {};
        }

        // Cache the tip and return it
        const tip = tips[index];
        loadTipByIndex._cache[index] = tip;
        return tip;

    } catch (error) {
        console.error('Error loading tip by index:', index, error);
        return null;
    }
}

// ===================================================================================
// TYPE DEFINITIONS
// ===================================================================================

/**
 * @typedef {Object} GoalTemplate
 * @property {string} title - Display name for the goal template
 * @property {string} description - Detailed description of the goal
 * @property {GoalType} type - Type of goal tracking mechanism
 * @property {GoalPeriod} period - Time period or tracking scope for the goal
 * @property {number} target - Target value or count to achieve
 * @property {string} icon - Emoji icon representing the goal visually
 * @since 2.0.0
 */

/**
 * Goal tracking type enumeration.
 * 
 * @typedef {('lucid_count'|'recall_streak'|'journal_streak'|'dream_signs_count'|'custom')} GoalType
 */

/**
 * Goal period/scope enumeration.
 * 
 * @typedef {('monthly'|'streak'|'total')} GoalPeriod
 */

// ===================================================================================
// TAGS & AUTOCOMPLETE SYSTEM
// ===================================================================================

/**
 * @typedef {Object} TipObject
 * @property {string} id - Unique identifier for the tip
 * @property {string} title - Tip title or category
 * @property {string} content - Main tip content
 * @property {string[]} [tags] - Optional tags for categorization
 * @property {string} [difficulty] - Difficulty level (beginner, intermediate, advanced)
 * @since 2.0.0
 */

/**
 * Common dream tags for autocomplete suggestions.
 * 
 * Predefined tag collection that provides autocomplete suggestions to help users
 * categorize their dreams consistently. Tags are organized by thematic categories
 * (people, places, objects, activities, themes) to cover the most common dream
 * elements reported in dream research.
 * 
 * @constant {string[]}
 * @readonly
 * @since 1.0.0
 * @example
 * // Used in autocomplete functionality
 * const matchingTags = commonTags.filter(tag => 
 *   tag.toLowerCase().includes(userInput.toLowerCase())
 * );
 * 
 * @example
 * // Get random dream tag suggestion
 * const randomTag = commonTags[Math.floor(Math.random() * commonTags.length)];
 */
const commonTags = [
        // People
        'family', 'friends', 'strangers', 'children', 'elderly', 'celebrities', 'deceased-relatives',
        // Places
        'home', 'school', 'work', 'nature', 'city', 'ocean', 'mountains', 'forest', 'space', 'underground',
        // Objects
        'animals', 'vehicles', 'technology', 'weapons', 'books', 'mirrors', 'doors', 'stairs', 'bridges',
        // Activities
        'flying', 'running', 'swimming', 'dancing', 'singing', 'fighting', 'escaping', 'searching', 'traveling',
        // Themes
        'adventure', 'romance', 'horror', 'fantasy', 'sci-fi', 'mystery', 'spiritual', 'nostalgic', 'surreal'
    ];

/**
 * Common dream signs database for lucidity training.
 * 
 * Comprehensive collection of dream elements that commonly appear in dreams
 * and can serve as reality check triggers for lucid dreaming practice.
 * Organized by categories to help users systematically train their awareness
 * of dream inconsistencies and impossibilities.
 * 
 * Based on lucid dreaming research and common dream themes reported
 * in dream journals and scientific literature.
 * 
 * @constant {string[]}
 * @readonly
 * @since 2.0.0
 * @example
 * // Check if dream contains common dream signs
 * const dreamSigns = findDreamSigns(dreamContent, commonDreamSigns);
 * if (dreamSigns.length > 0) {
 *   suggestRealityChecks(dreamSigns);
 * }
 * 
 * @example
 * // Filter dream signs by category
 * const realityCheckSigns = commonDreamSigns.filter(sign => 
 *   ['text-changing', 'clocks-wrong', 'hands-distorted'].includes(sign)
 * );
 */
const commonDreamSigns = [
        // Reality Check Triggers
        'flying', 'impossible-architecture', 'text-changing', 'clocks-wrong', 'hands-distorted', 'light-switches-broken',
        // Impossible Events
        'teleportation', 'shapeshifting', 'breathing-underwater', 'floating-objects', 'gravity-defying',
        // Dead People/Past
        'deceased-alive', 'childhood-home', 'past-relationships', 'extinct-animals', 'historical-figures',
        // Distorted Reality
        'mirror-reflections-wrong', 'phone-not-working', 'doors-lead-nowhere', 'infinite-rooms', 'size-changes',
        // Recurring Personal Signs
        'teeth-falling-out', 'being-chased', 'cant-run-fast', 'naked-in-public', 'late-for-exam', 'lost-vehicle'
    ];

/**
 * Common emotions for autocomplete suggestions.
 *
 * Comprehensive collection of emotional states commonly experienced in dreams
 * to provide autocomplete suggestions for the emotions field. Organized by
 * emotional categories to cover the full spectrum of human emotional experience
 * in dream states, from basic emotions to complex mixed feelings.
 *
 * Based on emotion research, dream content analysis, and common emotional
 * experiences reported in dream journals and psychological literature.
 *
 * @constant {string[]}
 * @readonly
 * @since 2.04.01
 * @example
 * // Used in autocomplete functionality for emotions field
 * const matchingEmotions = commonEmotions.filter(emotion =>
 *   emotion.toLowerCase().includes(userInput.toLowerCase())
 * );
 *
 * @example
 * // Check if dream contains specific emotional categories
 * const positiveEmotions = commonEmotions.filter(emotion =>
 *   ['happy', 'joyful', 'excited', 'peaceful', 'content'].includes(emotion)
 * );
 */
const commonEmotions = [
        // Positive Emotions
        'happy', 'joyful', 'excited', 'peaceful', 'content', 'grateful', 'amazed', 'euphoric', 'blissful', 'serene',
        'cheerful', 'delighted', 'elated', 'enthusiastic', 'optimistic', 'satisfied', 'proud', 'confident', 'hopeful', 'inspired',
        // Negative Emotions
        'sad', 'angry', 'scared', 'anxious', 'frustrated', 'disappointed', 'lonely', 'jealous', 'guilty', 'ashamed',
        'depressed', 'irritated', 'worried', 'panicked', 'terrified', 'furious', 'enraged', 'heartbroken', 'devastated', 'overwhelmed',
        // Complex/Mixed Emotions
        'confused', 'conflicted', 'bittersweet', 'nostalgic', 'melancholic', 'ambivalent', 'surprised', 'shocked', 'stunned', 'bewildered',
        'curious', 'intrigued', 'suspicious', 'doubtful', 'uncertain', 'hesitant', 'indifferent', 'numb', 'empty', 'restless',
        // Social Emotions
        'embarrassed', 'rejected', 'abandoned', 'loved', 'appreciated', 'accepted', 'included', 'misunderstood', 'betrayed', 'supported',
        // Physical/Sensory Emotions
        'energetic', 'tired', 'exhausted', 'refreshed', 'uncomfortable', 'relaxed', 'tense', 'calm', 'agitated', 'alert'
    ];

// ===================================================================================
// MODULE EXPORTS
// ===================================================================================

// Export all constants, templates, and functions for ES module compatibility
export {
    DREAM_FORM_COLLAPSE_KEY,
    SETTINGS_APPEARANCE_COLLAPSE_KEY,
    SETTINGS_SECURITY_COLLAPSE_KEY,
    SETTINGS_DATA_COLLAPSE_KEY,
    SETTINGS_AUTOCOMPLETE_COLLAPSE_KEY,
    SETTINGS_CLOUD_SYNC_COLLAPSE_KEY,
    GOALS_ACTIVE_COLLAPSE_KEY,
    GOALS_TEMPLATES_COLLAPSE_KEY,
    GOALS_COMPLETED_COLLAPSE_KEY,
    ADVICE_DAILY_TIP_COLLAPSE_KEY,
    ADVICE_TECHNIQUES_COLLAPSE_KEY,
    ADVICE_GENERAL_COLLAPSE_KEY,
    JOURNAL_CONTROLS_COLLAPSE_KEY,
    DEFAULT_DROPBOX_CLIENT_ID,
    CUSTOM_DROPBOX_CLIENT_ID_KEY,
    DROPBOX_REDIRECT_URI,
    CLOUD_SYNC_ENABLED_KEY,
    CLOUD_AUTO_SYNC_KEY,
    CLOUD_ENCRYPTION_ENABLED_KEY,
    DROPBOX_ACCESS_TOKEN_KEY,
    DROPBOX_REFRESH_TOKEN_KEY,
    DROPBOX_TOKEN_EXPIRES_KEY,
    LAST_CLOUD_SYNC_KEY,
    PAGINATION_STORAGE_KEY,
    DEFAULT_PAGINATION_LIMIT,
    CONSTANTS,
    GOAL_TEMPLATES,
    loadDailyTips,
    getTipsCount,
    loadTipByIndex,
    cacheDailyTip,
    getCachedDailyTip,
    clearDailyTipCache,
    commonTags,
    commonDreamSigns,
    commonEmotions
};

