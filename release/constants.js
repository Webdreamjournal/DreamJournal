// ===================================================================================
// DREAM JOURNAL CONSTANTS & CONFIGURATION
// ===================================================================================
// Central repository for all application constants, templates, and configuration values
// Maintains single source of truth for consistent behavior across modules

// UI State Management Keys
const DREAM_FORM_COLLAPSE_KEY = 'dreamFormCollapsed';
    
// Core Application Constants
// Centralized configuration values used throughout the application
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
    
// Predefined Goal Templates
// Template configurations for common lucid dreaming goals
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
 * Load daily tips from external JSON file
 * @returns {Promise<Array>} Promise that resolves to array of tip objects
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

// ===================================================================================
// TAGS & AUTOCOMPLETE SYSTEM
// ===================================================================================

// Common Dream Tags for Autocomplete
// Predefined tag suggestions to help users categorize dreams consistently
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

// Dream Signs Database
// Common elements that can trigger lucidity when recognized in dreams
// Organized by type for systematic reality check training
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
    
