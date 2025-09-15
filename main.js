/**
 * @fileoverview Main application initialization and lifecycle management module.
 * 
 * This module handles the complete application startup sequence, theme management,
 * event delegation setup, PWA functionality, browser compatibility checks, and
 * cleanup operations. It orchestrates the two-phase initialization process:
 * immediate setup for UI responsiveness and deferred setup for heavier operations.
 * 
 * The module manages:
 * - Application startup and initialization sequence
 * - Theme system initialization and persistence
 * - Event delegation and keyboard shortcuts
 * - PWA installation system and service worker registration
 * - Browser compatibility detection and fallbacks
 * - Memory cleanup and resource management
 * - PIN security system integration
 * - Tab container management and dynamic content
 * 
 * @module MainApplication
 * @version 2.02.05
 * @author Dream Journal Development Team
 * @since 1.0.0
 * @requires constants
 * @requires state
 * @requires storage
 * @requires dom-helpers
 * @requires security
 * @requires dream-crud
 * @requires voice-notes
 * @requires goals
 * @requires stats
 * @requires import-export
 * @requires action-router
 * @example
 * // The module initializes automatically on DOMContentLoaded
 * // No manual initialization required
 * 
 * // PWA installation can be triggered programmatically:
 * if (window.deferredPrompt) {
 *   await installPWA();
 * }
 */

// ================================
// ES MODULE IMPORTS
// ================================

// Foundation modules
import { CONSTANTS, loadDailyTips, commonTags, commonDreamSigns, DREAM_FORM_COLLAPSE_KEY } from './constants.js';
import {
    getDailyTips, setDailyTips, isUnlocked, isAppLocked, preLockActiveTab, failedPinAttempts,
    deleteTimeouts, voiceDeleteTimeouts, goalDeleteTimeouts, searchDebounceTimer, filterDebounceTimer,
    scrollDebounceTimer, recordingTimer, currentPlayingAudio, mediaRecorder,
    isDreamFormCollapsed, setIsDreamFormCollapsed, setUnlocked, setAppLocked, setPreLockActiveTab, getActiveAppTab,
    getEncryptionEnabled, setEncryptionEnabled
} from './state.js';

// Core utilities
import { 
    initDB, loadDreams, getIndexedDBCount, migrateFromLocalStorage,
    isIndexedDBAvailable, isLocalStorageAvailable, getAutocompleteSuggestions
} from './storage.js';
import { 
    getCurrentTheme, applyTheme, switchAppTab, hideAllTabButtons, 
    showAllTabButtons, createInlineMessage, setupTagAutocomplete, initializeAutocomplete, toggleDreamForm
} from './dom-helpers.js';

// Security system
import {
    isPinSetup, getResetTime, removeResetTime, removePinHash, updateTimerWarning,
    updateSecurityControls, verifyLockScreenPin, loadEncryptionSettings,
    getAuthenticationRequirements, showAuthenticationScreen
} from './security.js';

// Dream CRUD operations
import { 
    displayDreams, saveDream, debouncedSearch, debouncedFilter,
    removeEndlessScroll
} from './dream-crud.js';

// Voice notes system
import { updateRecordButtonState } from './voice-notes.js';

// Goals system - initGoals removed, now lazy-loaded via tab switching

// Journal tab system
import { initializeJournalTab } from './journaltab.js';

// Import/Export system
import { importEntries, importAllData } from './import-export.js';

// Action routing system
import { handleUnifiedClick, handleUnifiedChange, handleTabListKeydown, handleUnifiedKeydown } from './action-router.js';

// PWA installation system
import { installPWA, setupPWAInstall } from './pwa.js';

// ================================
// MAIN APPLICATION INITIALIZATION MODULE
// ================================
// Main application initialization and lifecycle management for the Dream Journal application
// Handles app startup, theme management, event delegation, browser compatibility, and cleanup

// ================================
// INITIALIZATION SUBSYSTEMS
// ================================

// ===================================================================================
// ADVICE TAB INITIALIZATION - MOVED TO ADVICETAB.JS
// ===================================================================================
// Note: initializeAdviceTab() function has been moved to advicetab.js module

/**
 * Initialize theme system by loading saved theme preference and applying it.
 * 
 * This function retrieves the user's saved theme preference from storage and applies
 * it to the application. It handles both light and dark themes using the HSL-based
 * CSS custom property system. If no saved theme exists, defaults to the system preference.
 * 
 * The theme system uses CSS custom properties for consistent theming across all components
 * and supports smooth transitions between theme changes.
 * 
 * @function
 * @returns {void}
 * @since 1.0.0
 * @example
 * initializeTheme();
 * // Theme is now loaded and applied to the application
 */
function initializeTheme() {
    const savedTheme = getCurrentTheme();
    applyTheme(savedTheme);
}

/**
 * Setup centralized event delegation system for all user interactions.
 * 
 * This function establishes the core event handling architecture using event delegation.
 * It registers unified handlers for click and change events on the document level,
 * allowing dynamic content to automatically inherit event handling without requiring
 * explicit event listener registration.
 * 
 * Additionally sets up specific file input handlers for data import functionality
 * that require direct event listener attachment due to their specialized nature.
 * 
 * The event delegation system uses data-action attributes to route events to
 * appropriate handlers via the ACTION_MAP in action-router.js.
 * 
 * @function
 * @returns {void}
 * @since 1.0.0
 * @example
 * setupEventDelegation();
 * // All interactive elements with data-action attributes now respond to events
 * 
 * @see {@link module:ActionRouter} For event routing implementation
 * @see {@link handleUnifiedClick} For click event handling
 * @see {@link handleUnifiedChange} For change event handling
 */
function setupEventDelegation() {
    document.addEventListener('click', handleUnifiedClick);
    document.addEventListener('change', handleUnifiedChange);
    
    // ARIA: Add keyboard navigation for tabs and general accessibility
    document.addEventListener('keydown', handleTabListKeydown);
    document.addEventListener('keydown', handleUnifiedKeydown);
    
    const importFileInput = document.getElementById('importFile');
    if (importFileInput) {
        importFileInput.addEventListener('change', importEntries);
    }
    
    const importAllDataFileInput = document.getElementById('importAllDataFile');
    if (importAllDataFileInput) {
        importAllDataFileInput.addEventListener('change', importAllData);
    }
}

/**
 * Register service worker for PWA functionality.
 * 
 * This function registers the service worker that enables Progressive Web App features
 * including offline functionality, resource caching, background sync, and automatic
 * updates. It sets up event listeners for service worker lifecycle events and handles
 * update notifications.
 * 
 * The service worker provides:
 * - Offline functionality with cached resources
 * - Automatic background updates
 * - Push notification capability (if implemented)
 * - Network status detection and recovery
 * 
 * Gracefully handles browsers that don't support service workers by silently failing.
 * 
 * @async
 * @function
 * @returns {Promise<void>} Promise that resolves when service worker is registered
 * @throws {Error} When service worker registration fails (logged but not thrown)
 * @since 2.0.0
 * @example
 * await registerServiceWorker();
 * // PWA functionality is now active with offline support
 * 
 * @see {@link sw.js} For service worker implementation
 */
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        // Determine the correct base path for the current environment
        const basePath = window.location.pathname.startsWith('/DreamJournal/') ? '/DreamJournal' : '';
        
        try {
            const registration = await navigator.serviceWorker.register(`${basePath}/sw.js`);
            console.log('ServiceWorker registered successfully:', registration.scope);
            
            // Handle service worker updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available, could show update notice
                            console.log('New service worker available');
                        }
                    });
                }
            });
            
            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'BACK_ONLINE') {
                    console.log('App is back online');
                    // Could show online status or refresh data
                }
            });
            
        } catch (error) {
            console.log('ServiceWorker registration failed:', error);
        }
    }
}

// ================================
// BROWSER COMPATIBILITY & UTILITIES
// ================================

/**
 * Check browser compatibility for modern CSS features.
 * 
 * This function tests the browser's support for CSS custom properties (CSS variables)
 * which are essential for the application's theme system. If the browser doesn't
 * support these features, it displays a prominent upgrade notice to inform users
 * that their browsing experience may be degraded.
 * 
 * The compatibility check specifically tests for HSL color function support with
 * CSS variables, which is required for the dynamic theme system to function properly.
 * 
 * The upgrade notice is styled to be highly visible and encourages users to update
 * to a modern browser for the best experience.
 * 
 * @function
 * @returns {void}
 * @since 1.0.0
 * @example
 * checkBrowserCompatibility();
 * // Upgrade notice shown if browser lacks CSS custom property support
 */
function checkBrowserCompatibility() {
    if (!CSS.supports('color', 'hsl(var(--test))')) {
        const body = document.body;
        const notice = document.createElement('div');
        notice.className = 'message-error';
        notice.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 9999;
        `;
        notice.innerHTML = '⚠️ Your browser is outdated and may not display themes correctly. Please update to a modern browser.';
        body.insertBefore(notice, body.firstChild);
    }
}

/**
 * Ensure tab container exists for dynamic tab content creation.
 * 
 * This function verifies that the tab content container element exists in the DOM
 * and creates it if missing. This prevents errors during tab switching operations
 * and ensures consistent layout structure for dynamic tab content.
 * 
 * The container is created with appropriate styling to match the application's
 * design system and is positioned correctly within the main application layout.
 * This function is particularly important for handling edge cases where the
 * DOM structure might be incomplete during initialization.
 * 
 * @async
 * @function
 * @returns {Promise<void>} Promise that resolves when tab container is ensured
 * @since 2.0.0
 * @todo Consider moving to dom-helpers.js as createTabContainer() utility function
 * @example
 * await ensureTabContainerExists();
 * // Tab container now exists and tab switching will work properly
 */
async function ensureTabContainerExists() {
    let tabContainer = document.querySelector('.tab-content-container');
    if (!tabContainer) {
        const containerDiv = document.querySelector('.container');
        const appTabs = document.querySelector('.app-tabs');
        if (containerDiv && appTabs) {
            tabContainer = document.createElement('div');
            tabContainer.className = 'tab-content-container';
            tabContainer.style.cssText = `
                background: var(--bg-primary);
                min-height: 400px;
                overflow-x: hidden;
            `;
            appTabs.parentNode.insertBefore(tabContainer, appTabs.nextSibling);
        }
    }
}

/**
 * Set current date and time as default for new dream entries.
 * 
 * This function sets the dream date input field to the current date and time,
 * providing a sensible default for new dream entries. The datetime is formatted
 * specifically for HTML datetime-local input compatibility (ISO format without timezone).
 * 
 * This improves user experience by eliminating the need to manually set the date
 * and time for dreams that occurred recently, while still allowing users to modify
 * the timestamp for dreams from previous days.
 * 
 * @function
 * @returns {void}
 * @since 1.0.0
 * @example
 * setDefaultDreamDateTime();
 * // Dream date input now shows current date/time as default
 */
function setDefaultDreamDateTime() {
    const dreamDateInput = document.getElementById('dreamDate');
    if (dreamDateInput) {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const localDatetimeString = `${year}-${month}-${day}T${hours}:${minutes}`;
        dreamDateInput.value = localDatetimeString;
    }
}

/**
 * Setup cleanup handlers for page unload to prevent memory leaks.
 * 
 * This function registers a beforeunload event listener that performs comprehensive
 * cleanup of all application resources when the page is about to be unloaded.
 * This prevents memory leaks and ensures proper resource management.
 * 
 * The cleanup process handles:
 * - Clearing all timeout and interval timers
 * - Stopping any active audio playback
 * - Stopping any active media recording
 * - Removing scroll event listeners
 * - Cleaning up any other dynamic resources
 * 
 * @function
 * @param {number} timerWarningInterval - Timer interval ID for PIN warning updates
 * @returns {void}
 * @since 1.0.0
 * @example
 * const timerInterval = setInterval(updateTimerWarning, 60000);
 * setupCleanupHandlers(timerInterval);
 * // Cleanup handlers now registered for page unload
 */
function setupCleanupHandlers(timerWarningInterval) {
    window.addEventListener('beforeunload', function() {
        try {
            Object.keys(deleteTimeouts).forEach(dreamId => clearTimeout(deleteTimeouts[dreamId]));
            Object.keys(voiceDeleteTimeouts).forEach(voiceNoteId => clearTimeout(voiceDeleteTimeouts[voiceNoteId]));
            Object.keys(goalDeleteTimeouts).forEach(goalId => clearTimeout(goalDeleteTimeouts[goalId]));
            if (timerWarningInterval) clearInterval(timerWarningInterval);
            if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
            if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
            if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
            if (recordingTimer) clearInterval(recordingTimer);
            if (currentPlayingAudio) currentPlayingAudio.pause();
            if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
            removeEndlessScroll();
        } catch (error) {
            console.log('Cleanup error during page unload:', error);
        }
    });
}

/**
 * Setup additional event listeners for search, filtering, and keyboard shortcuts.
 * 
 * This function sets up specialized event listeners that require direct attachment
 * rather than event delegation. These include input field listeners for search
 * functionality, filter controls, and keyboard shortcuts that enhance user productivity.
 * 
 * The function handles:
 * - Search input with debouncing for performance
 * - Filter and sort control changes with debouncing
 * - Date range filter inputs
 * - Keyboard shortcuts (Ctrl+Enter for saving, Enter for PIN verification)
 * - Global keyboard interactions for accessibility
 * 
 * @function
 * @returns {void}
 * @since 1.0.0
 * @todo Consider splitting into setupSearchEventListeners() and setupKeyboardShortcuts() functions for better separation of search input handling vs keyboard interaction handling
 * @example
 * setupAdditionalEventListeners();
 * // Search, filter, and keyboard shortcut functionality now active
 */
function setupAdditionalEventListeners() {
    const searchBox = document.getElementById('searchBox');
    const filterSelect = document.getElementById('filterSelect');
    const sortSelect = document.getElementById('sortSelect');
    const limitSelect = document.getElementById('limitSelect');
    const dreamContent = document.getElementById('dreamContent');
    const pinInput = document.getElementById('pinInput');
    
    if (searchBox) searchBox.addEventListener('input', () => debouncedSearch(CONSTANTS.DEBOUNCE_SEARCH_MS));
    if (filterSelect) filterSelect.addEventListener('change', () => debouncedFilter(CONSTANTS.DEBOUNCE_FILTER_MS));
    if (sortSelect) sortSelect.addEventListener('change', () => debouncedFilter(CONSTANTS.DEBOUNCE_FILTER_MS));
    if (limitSelect) limitSelect.addEventListener('change', () => debouncedFilter(CONSTANTS.DEBOUNCE_FILTER_MS));

    const startDateInput = document.getElementById('startDateFilter');
    const endDateInput = document.getElementById('endDateFilter');
    if (startDateInput) startDateInput.addEventListener('change', () => debouncedFilter(CONSTANTS.DEBOUNCE_FILTER_MS));
    if (endDateInput) endDateInput.addEventListener('change', () => debouncedFilter(CONSTANTS.DEBOUNCE_FILTER_MS));
    
    if (dreamContent) dreamContent.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') saveDream(); });
    if (pinInput) pinInput.addEventListener('keypress', e => { if (e.key === 'Enter') document.getElementById('pinMainBtn')?.click(); });
    
    document.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            const lockScreenPinInput = document.getElementById('lockScreenPinInput');
            if (lockScreenPinInput && document.activeElement === lockScreenPinInput) {
                verifyLockScreenPin();
            }
        }
    });
}

/**
 * Initialize application data display and handle PIN timer expiration messaging.
 * 
 * This function loads and displays the core application data including dreams,
 * voice recording capabilities, and security controls. It handles the initial
 * data presentation to the user and manages error states gracefully.
 * 
 * The function also handles PIN timer expiration messaging, showing an informative
 * message when the user's PIN has been automatically removed due to the reset timer
 * expiring, allowing them to set a new PIN if desired.
 * 
 * @async
 * @function
 * @param {boolean} timerExpiredAndRemovedPin - Whether PIN timer expired during this session load
 * @returns {Promise<void>} Promise that resolves when application data is initialized
 * @throws {Error} When dream loading fails (handled gracefully with error UI)
 * @since 1.0.0
 * @example
 * await initializeApplicationData(false);
 * // Application data loaded and displayed to user
 * 
 * await initializeApplicationData(true);
 * // Application data loaded and PIN expiration message shown
 */
async function initializeApplicationData(timerExpiredAndRemovedPin) {
    try {
        await displayDreams();
        await updateRecordButtonState();
        // Only load voice notes if stored tab is active (removed unconditional displayVoiceNotes call)
        updateSecurityControls();
        
        setTimeout(() => updateRecordButtonState(), 100);

        if (timerExpiredAndRemovedPin) {
            const container = document.querySelector('.main-content');
            if (container) {
                createInlineMessage('info', 'PIN reset timer has expired. Your PIN has been removed. You can set a new one if desired.', {
                    container: container, position: 'top', duration: 8000
                });
            }
        }
    } catch (error) {
        console.error('Error displaying dreams on page load:', error);
        const container = document.getElementById('entriesContainer');
        if (container) {
            container.innerHTML = `<div class="no-entries"><h3>⚠️ Error Loading Dreams</h3><p>There was a problem loading your dreams. Please refresh the page.</p><button onclick="location.reload()" class="btn btn-primary" style="margin-top: 15px;">🔄 Refresh Page</button></div>`;
        }
    }
}

/**
 * Restore dream form collapse state from localStorage preference.
 * 
 * This function restores the user's preferred dream form collapse state from
 * localStorage, maintaining UI consistency across browser sessions. If the user
 * previously collapsed the dream form, it will be restored to that state.
 * 
 * The function handles localStorage access errors gracefully by silently ignoring
 * them, ensuring that localStorage issues don't prevent application functionality.
 * This provides a smooth degradation when localStorage is unavailable.
 * 
 * @function
 * @returns {void}
 * @since 1.5.0
 * @example
 * restoreDreamFormState();
 * // Dream form collapse state restored from user preference
 */
function restoreDreamFormState() {
    try {
        const fullForm = document.getElementById('dreamFormFull');
        const collapsedForm = document.getElementById('dreamFormCollapsed');
        
        // Safety check - ensure both form elements exist
        if (!fullForm || !collapsedForm) {
            console.warn('Dream form elements not found during state restoration');
            return;
        }
        
        // Check if state was already applied by journaltab.js during rendering
        // If either form is visible, state was already restored, so skip redundant work
        if (fullForm.style.display === 'block' || collapsedForm.style.display === 'block') {
            return;
        }
        
        // State not yet applied (both forms still hidden by CSS), apply it now
        const savedState = localStorage.getItem(DREAM_FORM_COLLAPSE_KEY);
        
        if (savedState === 'true') {
            // User previously collapsed the form, restore collapsed state
            setIsDreamFormCollapsed(true);
            fullForm.style.display = 'none';
            collapsedForm.style.display = 'block';
        } else {
            // Default expanded state OR no saved preference - show expanded form
            setIsDreamFormCollapsed(false);
            fullForm.style.display = 'block';
            collapsedForm.style.display = 'none';
        }
    } catch (e) {
        // Fallback to expanded state if localStorage access fails
        try {
            const fullForm = document.getElementById('dreamFormFull');
            const collapsedForm = document.getElementById('dreamFormCollapsed');
            if (fullForm && collapsedForm) {
                setIsDreamFormCollapsed(false);
                fullForm.style.display = 'block';
                collapsedForm.style.display = 'none';
            }
        } catch (fallbackError) {
            console.warn('Failed to restore dream form state and fallback failed:', fallbackError);
        }
    }
}

// ================================
// MAIN APPLICATION STARTUP SEQUENCE
// ================================

/**
 * Main application initialization sequence with smart authentication.
 *
 * This is the primary entry point for application initialization, designed to
 * orchestrate a two-phase startup process that optimizes perceived performance
 * and prevents content flashing. Enhanced with smart authentication logic that
 * automatically determines which security method to use based on user configuration.
 *
 * **Phase 1: Immediate Setup**
 * - Fast, synchronous operations that must complete before UI is visible
 * - Browser compatibility checks
 * - Theme initialization
 * - Encryption settings loading
 * - Smart authentication requirements analysis
 * - Appropriate authentication screen display
 * - Initial UI state configuration
 *
 * **Phase 2: Deferred Initialization**
 * - Slower, asynchronous operations that can happen after UI is responsive
 * - Service worker registration
 * - Database initialization
 * - Data migration
 * - Event listener setup
 * - Application data loading
 *
 * **Smart Authentication Logic:**
 * - If encryption is enabled, shows encryption password screen
 * - If only PIN is enabled, shows PIN screen
 * - If both are enabled, prioritizes encryption password (bypasses PIN)
 * - If neither is enabled, proceeds normally
 * - Handles PIN reset timer expiration gracefully
 *
 * This approach ensures the user sees a responsive interface immediately while
 * heavier initialization tasks complete in the background, with seamless
 * authentication integration that adapts to the user's security configuration.
 *
 * @async
 * @function
 * @since 1.0.0
 * @version 2.03.05
 * @todo Consider splitting into initializeImmediateSetup() and initializeDelayedSetup() functions for better separation of fast startup vs slower initialization tasks
 * @example
 * // Called by app entry point:
 * import { initializeApp } from './main.js';
 * document.addEventListener('DOMContentLoaded', initializeApp);
 *
 * @example
 * // Smart authentication scenarios:
 * // 1. Encryption enabled: Shows password screen
 * // 2. PIN only: Shows PIN screen
 * // 3. Both enabled: Shows password screen (encryption bypasses PIN)
 * // 4. Neither: Normal app initialization
 */
async function initializeApp() {

    // ================================
    // PHASE 1: IMMEDIATE SETUP
    // ================================
    // Fast, synchronous initialization to prevent content flashing

    checkBrowserCompatibility();
    initializeTheme();

    // Load encryption settings and update global state
    const encryptionEnabled = loadEncryptionSettings();
    setEncryptionEnabled(encryptionEnabled);

    // Handle PIN timer expiration and determine initial app state
    const resetTime = getResetTime();
    let timerExpiredAndRemovedPin = false;
    if (resetTime && (resetTime - Date.now() <= 0)) {
        removeResetTime();
        removePinHash();
        setUnlocked(true);
        setAppLocked(false);
        failedPinAttempts = 0;
        timerExpiredAndRemovedPin = true;
    }

    // Determine authentication needs using smart authentication logic
    const requirements = await getAuthenticationRequirements();

    // Initialize app in correct state based on authentication requirements
    if ((requirements.encryptionRequired || requirements.pinRequired) && !timerExpiredAndRemovedPin) {
        setAppLocked(true);
        setUnlocked(false);
        setPreLockActiveTab('journal');

        // Use smart authentication to show appropriate screen
        if (requirements.pinRequired && !requirements.encryptionRequired) {
            // PIN only - show lock tab
            switchAppTab('lock', true);
        } else {
            // Encryption required (with or without PIN) - show encryption password screen
            switchAppTab('journal', true);
            showAuthenticationScreen();
        }
        hideAllTabButtons();
    } else {
        setUnlocked(true);
        setAppLocked(false);
        switchAppTab('journal', true);
        showAllTabButtons();
    }

    // Make application visible after correct initial state is set
    document.querySelector('.container').style.visibility = 'visible';
    
    // ================================
    // PHASE 2: DEFERRED INITIALIZATION
    // ================================
    // Slower initialization tasks that can happen after UI is visible

    // Register service worker for PWA functionality
    registerServiceWorker();
    
    // Setup PWA installation system
    setupPWAInstall();

    setupEventDelegation();

    await initDB();

    // Ensure tab container exists for dynamic tab content creation
    await ensureTabContainerExists();
    
    // Migrate legacy data from localStorage if needed (first-time setup only)
    if (isIndexedDBAvailable() && isLocalStorageAvailable()) {
        const existingDreamCount = await getIndexedDBCount();
        if (existingDreamCount === 0) {
            await migrateFromLocalStorage();
        }
    }
    
    // Set current datetime as default for new dream entries
    setDefaultDreamDateTime();
    
    // Setup security and timer systems
    updateTimerWarning();
    const timerWarningInterval = setInterval(updateTimerWarning, 60000);
    updateSecurityControls();
    
    // Setup cleanup handlers to prevent memory leaks
    setupCleanupHandlers(timerWarningInterval);
    
    // Setup additional event listeners and keyboard shortcuts
    setupAdditionalEventListeners();
    
    // Initialize autocomplete system
    initializeAutocomplete();

    // Only load application data if authentication is not required (prevents console spam)
    if (!((requirements.encryptionRequired || requirements.pinRequired) && !timerExpiredAndRemovedPin)) {
        // Display initial application data and restore user preferences
        await initializeApplicationData(timerExpiredAndRemovedPin);

        // Initialize Journal tab if it's the active tab
        if (getActiveAppTab() === 'journal') {
            await initializeJournalTab();
        }
    }

    // Restore dream form collapse state preference
    restoreDreamFormState();
}

// ================================
// ES MODULE EXPORTS
// ================================

export {
    // Main application initialization
    initializeApp,
    
    // Application initialization functions  
    // initializeAdviceTab moved to advicetab.js module
    initializeTheme,
    setupEventDelegation,
    registerServiceWorker,
    
    
    // Browser compatibility and utilities
    checkBrowserCompatibility,
    ensureTabContainerExists,
    setDefaultDreamDateTime,
    setupCleanupHandlers,
    setupAdditionalEventListeners,
    
    // Application data initialization
    initializeApplicationData,
    restoreDreamFormState
};