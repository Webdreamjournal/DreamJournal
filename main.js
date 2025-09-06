// ================================
// MAIN APPLICATION INITIALIZATION MODULE
// ================================
// Main application initialization and lifecycle management for the Dream Journal application
// Handles app startup, theme management, event delegation, browser compatibility, and cleanup

// ================================
// INITIALIZATION SUBSYSTEMS
// ================================

/**
 * Initialize advice tab with deterministic tip of the day calculation
 * Uses first dream entry date as epoch, falling back to tip 1 if no dreams exist
 * @param {void}
 * @returns {Promise<void>}
 */
async function initializeAdviceTab() {
    // Load tips from JSON file and store globally
    dailyTips = await loadDailyTips();
    if (!dailyTips || dailyTips.length === 0) {
        return;
    }

    // Try to get the first dream entry date as epoch
    let epoch;
    let tipOfTheDayIndex = 0; // Default to tip 1 (index 0)
    
    try {
        const dreams = await loadDreams();
        if (dreams && dreams.length > 0) {
            // Find the earliest dream date
            const dreamDates = dreams
                .map(dream => new Date(dream.timestamp))
                .filter(date => !isNaN(date.getTime())) // Filter out invalid dates
                .sort((a, b) => a - b);
            
            if (dreamDates.length > 0) {
                epoch = dreamDates[0];
                const now = new Date();
                const diffTime = now - epoch;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                tipOfTheDayIndex = diffDays % dailyTips.length;
            }
        }
    } catch (error) {
        console.warn('Error loading dreams for tip calculation, using default tip 1:', error);
    }
    
    displayTip(tipOfTheDayIndex);
}

/**
 * Initialize theme system by loading saved theme preference and applying it
 * @param {void}
 * @returns {void}
 */
function initializeTheme() {
    const savedTheme = getCurrentTheme();
    applyTheme(savedTheme);
}

/**
 * Setup centralized event delegation system for all user interactions
 * Registers unified handlers for click and change events plus file inputs
 * @param {void}
 * @returns {void}
 */
function setupEventDelegation() {
    document.addEventListener('click', handleUnifiedClick);
    document.addEventListener('change', handleUnifiedChange);
    
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
 * Initialize autocomplete system with tag and dream sign suggestions
 * Loads suggestions from storage and falls back to defaults on error
 * @param {void}
 * @returns {Promise<void>}
 */
async function initializeAutocomplete() {
    try {
        const [tags, signs] = await Promise.all([
            getAutocompleteSuggestions('tags'),
            getAutocompleteSuggestions('dreamSigns')
        ]);
        setupTagAutocomplete('dreamTags', tags);
        setupTagAutocomplete('dreamSigns', signs);
    } catch (error) {
        console.error("Failed to initialize autocomplete:", error);
        setupTagAutocomplete('dreamTags', commonTags);
        setupTagAutocomplete('dreamSigns', commonDreamSigns);
    }
}

/**
 * Register service worker for PWA functionality
 * Handles offline functionality, caching, and app installation
 * @param {void}
 * @returns {Promise<void>}
 */
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js');
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
// PWA INSTALLATION SYSTEM
// ================================

// Global variable to store the beforeinstallprompt event
let deferredPrompt;

// Make deferredPrompt accessible globally for other modules
window.deferredPrompt = null;

// Make PWA functions accessible globally for other modules
window.createPWASection = null;
window.removePWASection = null;

/**
 * Create and inject PWA installation section into settings page
 * Only called when PWA installation becomes available
 * @param {void}
 * @returns {void}
 */
function createPWASection() {
    // Check if PWA section already exists
    const existingSection = document.querySelector('#pwaInstallSection');
    if (existingSection) {
        return;
    }
    
    // Find the security section to insert PWA section before it
    const securitySection = document.querySelector('.settings-section h3');
    if (!securitySection || !securitySection.textContent.includes('Security')) {
        return;
    }
    
    const securitySectionContainer = securitySection.parentElement;
    
    // Create PWA section HTML
    const pwaSection = document.createElement('div');
    pwaSection.className = 'settings-section';
    pwaSection.id = 'pwaInstallSection';
    pwaSection.innerHTML = `
        <h3>📱 Progressive Web App</h3>
        <div class="settings-row">
            <div>
                <div class="settings-label">Install App</div>
                <div class="settings-description">Install Dream Journal as a native app on your device</div>
            </div>
            <div class="settings-controls">
                <button data-action="install-pwa" id="installPwaButton" class="btn btn-primary">📱 Install App</button>
                <div id="pwaInstallStatus" class="text-secondary text-sm" style="display: none;"></div>
            </div>
        </div>
    `;
    
    // Insert PWA section before security section
    securitySectionContainer.parentElement.insertBefore(pwaSection, securitySectionContainer);
}

/**
 * Remove PWA installation section from settings page
 * Called when PWA is installed or no longer available
 * @param {void}
 * @returns {void}
 */
function removePWASection() {
    const pwaSection = document.querySelector('#pwaInstallSection');
    if (pwaSection) {
        pwaSection.remove();
    }
}

// Assign functions to window for global access
window.createPWASection = createPWASection;
window.removePWASection = removePWASection;

/**
 * Setup PWA installation system with beforeinstallprompt event listener
 * Shows PWA section when installation is available
 * @param {void}
 * @returns {void}
 */
function setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
        // Stash the event so it can be triggered later by the button
        deferredPrompt = e;
        window.deferredPrompt = e;

        // Create and show the PWA section in settings if we're on settings tab
        const settingsTab = document.getElementById('settingsTab');
        if (settingsTab && settingsTab.style.display !== 'none') {
            createPWASection();
        }
    });

    // Listen for the app being installed
    window.addEventListener('appinstalled', (e) => {
        console.log('PWA was installed');
        
        // Show success message for a few seconds then remove the section
        const statusDiv = document.querySelector('#pwaInstallStatus');
        if (statusDiv) {
            statusDiv.textContent = 'App has been installed successfully!';
            statusDiv.style.display = 'block';
            
            // Remove entire section after showing success message
            setTimeout(() => {
                removePWASection();
            }, 3000);
        } else {
            // If no status div, remove section immediately
            removePWASection();
        }
        
        // Clear the deferredPrompt
        deferredPrompt = null;
        window.deferredPrompt = null;
    });
}

/**
 * Handle PWA installation when user clicks the install button
 * Shows browser's install prompt and handles the result
 * @param {void}
 * @returns {Promise<void>}
 */
async function installPWA() {
    if (!deferredPrompt) {
        console.log('No install prompt available');
        return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // Clear the deferredPrompt
    deferredPrompt = null;
    
    // Hide the install button regardless of user choice
    const installButton = document.querySelector('#installPwaButton');
    if (installButton) {
        installButton.style.display = 'none';
    }
    
    // Update status
    const statusDiv = document.querySelector('#pwaInstallStatus');
    if (statusDiv) {
        if (outcome === 'accepted') {
            statusDiv.textContent = 'Installing app...';
        } else {
            statusDiv.textContent = 'Installation cancelled';
        }
        statusDiv.style.display = 'block';
    }
}

/**
 * Check browser compatibility for modern CSS features
 * Shows upgrade notice for browsers that don't support CSS custom properties
 * @param {void}
 * @returns {void}
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
 * Ensure tab container exists for dynamic tab content creation
 * Creates tab container if missing to prevent tab switching errors
 * @param {void}
 * @returns {Promise<void>}
 * 
 * TODO: Consider moving to dom-helpers.js as createTabContainer() utility function
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
 * Set current date and time as default for new dream entries
 * Formats datetime for HTML datetime-local input compatibility
 * @param {void}
 * @returns {void}
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
 * Setup cleanup handlers for page unload to prevent memory leaks
 * Clears all timers, stops media, and removes event listeners
 * @param {number} timerWarningInterval - Timer interval ID for warning updates
 * @returns {void}
 */
function setupCleanupHandlers(timerWarningInterval) {
    window.addEventListener('beforeunload', function() {
        try {
            Object.keys(deleteTimeouts).forEach(dreamId => clearTimeout(deleteTimeouts[dreamId]));
            Object.keys(voiceDeleteTimeouts).forEach(voiceNoteId => clearTimeout(voiceDeleteTimeouts[voiceNoteId]));
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
 * Setup additional event listeners for search, filtering, and keyboard shortcuts
 * Handles input events not covered by the main event delegation system
 * @param {void}
 * @returns {void}
 * 
 * TODO: Consider splitting into setupSearchEventListeners() and setupKeyboardShortcuts() functions
 * for better separation of search input handling vs keyboard interaction handling
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
 * Initialize application data display and handle PIN timer expiration messaging
 * Loads dreams, voice notes, and voice capabilities with error handling
 * @param {boolean} timerExpiredAndRemovedPin - Whether PIN timer expired on this load
 * @returns {Promise<void>}
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
 * Restore dream form collapse state from localStorage preference
 * Handles localStorage access errors gracefully
 * @param {void}
 * @returns {void}
 */
function restoreDreamFormState() {
    try {
        if (localStorage.getItem(DREAM_FORM_COLLAPSE_KEY) === 'true') {
            isDreamFormCollapsed = false;
            toggleDreamForm();
        }
    } catch (e) {
        // Silently handle localStorage access errors
    }
}

// ================================
// MAIN APPLICATION STARTUP SEQUENCE
// ================================

/**
 * Main application initialization sequence
 * Handles two-phase startup: immediate setup then slower initialization tasks
 * 
 * TODO: Consider splitting into initializeImmediateSetup() and initializeDelayedSetup() functions
 * for better separation of fast startup vs slower initialization tasks
 */
document.addEventListener('DOMContentLoaded', async function() {
    
    // ================================
    // PHASE 1: IMMEDIATE SETUP
    // ================================
    // Fast, synchronous initialization to prevent content flashing
    
    checkBrowserCompatibility();
    initializeTheme();
    
    // Handle PIN timer expiration and determine initial app state
    const resetTime = getResetTime();
    let timerExpiredAndRemovedPin = false;
    if (resetTime && (resetTime - Date.now() <= 0)) {
        removeResetTime();
        removePinHash();
        isUnlocked = true;
        isAppLocked = false;
        failedPinAttempts = 0;
        timerExpiredAndRemovedPin = true;
    }
    const pinIsSetUp = isPinSetup();

    // Initialize app in correct state based on PIN setup and timer status
    if (pinIsSetUp && !timerExpiredAndRemovedPin) {
        isUnlocked = false;
        isAppLocked = true;
        preLockActiveTab = 'journal';
        switchAppTab('lock'); 
        hideAllTabButtons();
    } else {
        isUnlocked = true;
        isAppLocked = false;
        switchAppTab('journal');
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
    await initGoals();
    
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
    
    // Display initial application data and restore user preferences
    await initializeApplicationData(timerExpiredAndRemovedPin);
    
    // Restore dream form collapse state preference
    restoreDreamFormState();
});