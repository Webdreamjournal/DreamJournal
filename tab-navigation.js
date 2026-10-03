/**
 * @fileoverview Tab switching and tab panels, tab button visibility, the voice sub-tab, the date filter,
 *   and the Settings display and browser compatibility sync.
 *
 * @module TabNavigation
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { debugLog } from './logger.js';
import { CONSTANTS } from './constants.js';
import {
    setActiveAppTab,
    getAppLocked,
    getActiveAppTab,
    setAppLocked,
    setPreLockActiveTab,
    setActiveVoiceTab,
    getUnlocked
} from './state.js';
import { storageType } from './storage.js';
import { getResetTime, updateSecurityControls, isPinSetup } from './security.js';
import { renderGoalsTab, initializeGoalsTab } from './goalstab.js';
import { renderJournalTab } from './journaltab.js';
import { renderStatsTab, initializeStatsTab } from './statstab.js';
import { renderAdviceTab, initializeAdviceTab } from './advicetab.js';
import { displayVoiceNotes, getVoiceCapabilities } from './voice-notes.js';
import { renderSettingsTab, initializeSettingsTab } from './settingstab.js';
import { escapeHtml } from './ui-basics.js';
import { getCurrentTheme } from './preferences.js';

// ===================================================================================
// TAB MANAGEMENT SYSTEM
// ===================================================================================
// Complete tab switching system with dynamic content generation
// Handles lock screen transitions and tab-specific initialization
/**
 * Ensures the tab container infrastructure exists in the DOM.
 *
 * Creates the main tab content container element if it doesn't already exist
 * (for cases where the DOM structure is incomplete).
 * This function handles the foundational tab infrastructure setup.
 *
 * @returns {Element|null} The tab container element, or null if creation failed
 * @throws {Error} When required DOM elements for container creation are missing
 * @since 2.02.72
 * @example
 * // Ensure tab infrastructure exists before switching tabs
 * const container = ensureTabInfrastructure();
 * if (!container) {
 *   console.error('Failed to create tab infrastructure');
 *   return;
 * }
 *
 * @example
 * // Typical usage in tab switching
 * if (!ensureTabInfrastructure()) {
 *   console.error('Cannot switch tabs - infrastructure unavailable');
 *   return false;
 * }
 */
function ensureTabInfrastructure() {
    // Create the tab container if it is missing
    let tabContainer = document.querySelector('.tab-content-container');
    if (!tabContainer) {
        console.warn('Tab container not found, attempting to create it');

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
            debugLog('Tab container created successfully');
        } else {
            console.error('Cannot create tab container - missing DOM elements');
            return null;
        }
    }

    return tabContainer;
}

/**
 * Creates a single tab panel with appropriate content and accessibility attributes.
 *
 * Generates a complete tab panel DOM element with proper ARIA attributes, renders
 * tab-specific content using dedicated module functions, and handles error states
 * gracefully. Each tab type has specialized rendering logic for its unique content.
 *
 * @param {string} tabId - Tab panel identifier (e.g., 'journalTab', 'goalsTab', 'statsTab')
 * @param {Element} tabContainer - Container element to append the new panel to
 * @returns {Element|null} Created tab panel element, or null if creation failed
 * @throws {Error} When tabId is invalid or tabContainer is not provided
 * @since 2.02.72
 * @example
 * // Create a goals tab panel
 * const container = document.querySelector('.tab-content-container');
 * const panel = createTabPanel('goalsTab', container);
 *
 * @example
 * // Create journal tab with error handling
 * const panel = createTabPanel('journalTab', container);
 * if (!panel) {
 *   console.error('Failed to create journal tab panel');
 * }
 */
function createTabPanel(tabId, tabContainer) {
    if (!tabId || !tabContainer) {
        console.error('createTabPanel: Missing required parameters');
        return null;
    }

    // Check if tab panel already exists
    if (document.getElementById(tabId)) {
        return document.getElementById(tabId);
    }

    const tabPanel = document.createElement('div');
    tabPanel.id = tabId;
    tabPanel.className = 'tab-panel';
    tabPanel.setAttribute('role', 'tabpanel');

    // Extract tab name from tabId (e.g., 'journalTab' -> 'journal')
    const panelTabName = tabId.replace('Tab', '');
    tabPanel.setAttribute('aria-labelledby', `tab-${panelTabName}`);

    try {
        if (tabId === 'goalsTab') {
            // Goals tab is now handled by the dedicated goalstab.js module
            renderGoalsTab(tabPanel);
        } else if (tabId === 'statsTab') {
            // Stats tab is now handled by the dedicated statstab.js module
            renderStatsTab(tabPanel);
        } else if (tabId === 'adviceTab') {
            // Advice tab is now handled by the dedicated advicetab.js module
            renderAdviceTab(tabPanel);
        } else if (tabId === 'settingsTab') {
            // Settings tab is now handled by the dedicated settingstab.js module
            renderSettingsTab(tabPanel);
        } else if (tabId === 'journalTab') {
            // Journal tab is now handled by the dedicated journaltab.js module
            renderJournalTab(tabPanel);
        } else if (tabId === 'lockTab') {
            // Generate lock screen content with timer instructions if applicable
            const resetTime = getResetTime();
            let timerInstructions = '';

            if (resetTime) {
                const remainingTime = resetTime - Date.now();
                if (remainingTime > 0) {
                    const hours = Math.ceil(remainingTime / (1000 * 60 * 60));
                    const days = Math.ceil(hours / 24);

                    let timeDisplay = '';
                    if (days > 1) {
                        timeDisplay = `${days} days`;
                    } else if (hours > 1) {
                        timeDisplay = `${hours} hours`;
                    } else {
                        timeDisplay = 'Less than 1 hour';
                    }

                    timerInstructions = `
                        <div class="message-base message-info mb-md text-sm">
                            ⏰ Recovery timer active (${timeDisplay} remaining)<br>
                            <span class="text-sm font-normal">Press "Forgot PIN?" again when timer expires to unlock</span>
                        </div>
                    `;
                }
            }

            tabPanel.innerHTML = `
                <div class="flex-center" style="min-height: 400px;">
                    <div class="card-elevated card-lg text-center max-w-sm w-full shadow-lg">
                        <div class="text-4xl mb-lg">🔒</div>
                        <h2 class="text-primary mb-md text-xl">Journal Locked</h2>
                        <p class="text-secondary mb-lg line-height-relaxed">
                            Your dream journal is protected with a PIN. Enter your PIN to access your dreams and all app features.
                        </p>
                        ${timerInstructions}
                        <input type="password" id="lockScreenPinInput" placeholder="Enter PIN" maxlength="6" class="input-pin w-full mb-lg">
                        <div class="flex-center gap-sm flex-wrap">
                            <button data-action="verify-lock-screen-pin" class="btn btn-primary">🔓 Unlock Journal</button>
                            <button data-action="show-lock-screen-forgot-pin" class="btn btn-secondary">Forgot PIN?</button>
                        </div>
                        <div id="lockScreenFeedback" class="mt-md p-sm feedback-container"></div>
                    </div>
                </div>
            `;
        } else {
            console.warn(`createTabPanel: Unknown tab ID: ${tabId}`);
            tabPanel.innerHTML = `<div class="message-error">Unknown tab: ${escapeHtml(tabId)}</div>`;
        }
    } catch (error) {
        console.error(`Error rendering ${tabId}:`, error);

        // Generate appropriate error message based on tab type
        const friendlyName = panelTabName.charAt(0).toUpperCase() + panelTabName.slice(1);
        tabPanel.innerHTML = `
            <div class="message-error">
                Error loading ${friendlyName} tab. Please refresh the page.
                <button data-action="reload-app" class="btn btn-primary mt-sm">Refresh</button>
            </div>
        `;
    }

    tabContainer.appendChild(tabPanel);
    return tabPanel;
}

/**
 * Updates the visual state of all tab elements to reflect the active tab.
 *
 * Manages the complete visual state transition when switching tabs, including
 * showing/hiding tab panels, updating button states with proper ARIA attributes,
 * and controlling footer visibility. Ensures consistent UI state across all
 * tab-related elements.
 *
 * @param {string} tabName - Name of the tab to make active ('journal', 'goals', etc.)
 * @returns {void}
 * @throws {TypeError} When tabName is not a valid string
 * @since 2.02.72
 * @example
 * // Update UI state for journal tab
 * updateTabVisualState('journal');
 * // All journal elements become active, others become inactive
 *
 * @example
 * // Update state with footer visibility control
 * updateTabVisualState('stats');
 * // Stats tab shown, footer hidden (only journal shows footer)
 */
function updateTabVisualState(tabName) {
    if (!tabName || typeof tabName !== 'string') {
        console.warn('updateTabVisualState: Invalid tab name provided');
        return;
    }

    // Update tab panels - show active, hide others
    const tabs = document.querySelectorAll('.tab-panel');
    tabs.forEach(tab => {
        const expectedId = tabName + 'Tab';
        if (tab.id === expectedId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Update tab buttons with ARIA states
    const tabButtons = document.querySelectorAll('.app-tab[role="tab"]');
    tabButtons.forEach(button => {
        const buttonTab = button.dataset.tab;
        if (buttonTab === tabName) {
            button.classList.add('active');
            button.setAttribute('aria-selected', 'true');
            button.setAttribute('tabindex', '0');
        } else {
            button.classList.remove('active');
            button.setAttribute('aria-selected', 'false');
            button.setAttribute('tabindex', '-1');
        }
    });

    // Show/hide footer based on active tab
    const footer = document.querySelector('footer');
    if (footer) {
        if (tabName === 'journal' && !getAppLocked()) {
            footer.style.display = 'block';
        } else {
            footer.style.display = 'none';
        }
    }

    // Update global app state
    setActiveAppTab(tabName);
}

/**
 * Handles tab-specific initialization, focus management, and accessibility features.
 *
 * Performs specialized setup for each tab type including initialization of tab-specific
 * functionality, focus management for accessibility, and ARIA announcements. Different
 * tabs have unique requirements for data loading, focus handling, and user interaction setup.
 *
 * @param {string} tabName - Name of the tab to initialize ('journal', 'goals', etc.)
 * @param {boolean} [isInitialLoad=false] - Whether this is the initial app load (affects ARIA announcements)
 * @returns {void}
 * @throws {TypeError} When tabName is not a valid string
 * @since 2.02.72
 * @example
 * // Handle journal tab activation with security setup
 * handleTabSpecificLogic('journal', false);
 * // Updates security controls, sets up journal-specific features
 *
 * @example
 * // Handle initial stats tab load without announcements
 * handleTabSpecificLogic('stats', true);
 * // Initializes calendar, skips ARIA announcements for initial load
 */
function handleTabSpecificLogic(tabName, isInitialLoad = false) {
    if (!tabName || typeof tabName !== 'string') {
        console.warn('handleTabSpecificLogic: Invalid tab name provided');
        return;
    }

    // Auto-focus PIN input on lock screen for accessibility
    if (tabName === 'lock') {
        setTimeout(() => {
            const lockScreenPinInput = document.getElementById('lockScreenPinInput');
            if (lockScreenPinInput) {
                lockScreenPinInput.focus();
            }
        }, CONSTANTS.FOCUS_DELAY_MS);
    }

    // Update security controls when switching to journal tab (for consistency)
    if (tabName === 'journal') {
        updateSecurityControls();
    }

    // Initialize calendar if stats tab is selected
    if (tabName === 'stats') {
        initializeStatsTab();
    }

    // Display goals if goals tab is selected
    if (tabName === 'goals') {
        // Initialize goals tab with fresh data when switching to goals tab
        // This ensures we always have the latest data
        initializeGoalsTab().catch(error => {
            console.error('Error initializing Goals tab:', error);
        });
    }

    // ALWAYS update settings when switching to settings tab (whether new or existing)
    if (tabName === 'settings') {
        // Initialize settings tab using the dedicated settingstab.js module
        try {
            initializeSettingsTab();
        } catch (error) {
            console.error('Error initializing settings tab:', error);
        }
    }

    // Initialize advice tab when switched to
    if (tabName === 'advice') {
        initializeAdviceTab().catch(error => {
            console.error('Failed to initialize advice tab:', error);
        });
    }

    // ARIA: Announce tab change (skip during initial load to avoid noise)
    if (!isInitialLoad) {
        const announcer = document.getElementById('route-announcer');
        if (announcer) {
            const friendlyTabName = tabName.charAt(0).toUpperCase() + tabName.slice(1);
            announcer.textContent = `Switched to ${friendlyTabName} page`;
        }
    }

    // ARIA: Move focus to main heading of new tab (skip during initial load)
    if (!isInitialLoad) {
        setTimeout(() => {
            // When the tab bar itself has focus (arrow keys, Enter, click) it keeps it, so the
            // next arrow press moves to the next tab; Tab then enters the panel
            if (document.activeElement?.matches('[role="tab"]')) return;
            const headingId = `${tabName}-main-heading`;
            const mainHeading = document.getElementById(headingId);
            if (mainHeading) {
                mainHeading.focus();
            }
        }, 150); // Small delay to ensure content is ready
    }
}

/**
 * Orchestrates application tab switching with clean separation of concerns.
 *
 * This refactored function provides a streamlined tab switching experience by
 * delegating specific responsibilities to focused helper functions. The orchestration
 * approach improves maintainability, testability, and code readability while
 * preserving all original functionality.
 *
 * **Refactoring Benefits:**
 * - **Single Responsibility**: Each helper function has one clear purpose
 * - **Improved Maintainability**: Changes to specific aspects are isolated
 * - **Better Testability**: Individual components can be unit tested
 * - **Reduced Complexity**: Main function is now under 50 lines vs 300+ lines
 * - **Enhanced Readability**: Clear flow and separation of concerns
 *
 * @param {('journal'|'goals'|'stats'|'advice'|'settings'|'lock')} tabName - Target tab identifier
 * @param {boolean} [isInitialLoad=false] - Whether this is the initial app load (affects ARIA announcements)
 * @returns {void}
 * @throws {TypeError} When tabName is not a valid tab identifier
 * @since 2.02.72
 * @example
 * // Switch to journal tab
 * switchAppTab('journal');
 *
 * @example
 * // Handle lock screen transition
 * switchAppTab('lock'); // Orchestrates lock state, UI updates, and focus management
 *
 * @example
 * // Tab switching with initialization
 * switchAppTab('stats'); // Infrastructure → Panels → UI → Specific Logic
 */
function switchAppTab(tabName, isInitialLoad = false) {
    // Input validation
    if (!tabName || !['journal', 'goals', 'stats', 'advice', 'settings', 'lock'].includes(tabName)) {
        console.warn('switchAppTab: Invalid or missing tab name');
        return;
    }

    // 1. LOCK SCREEN STATE MANAGEMENT
    // Handle lock screen transitions and tab button visibility
    if (tabName === 'lock') {
        // Switching TO lock screen
        if (!getAppLocked()) {
            setPreLockActiveTab(getActiveAppTab()); // Remember current tab
            setAppLocked(true);
            hideAllTabButtons();
        }
    } else {
        // Switching FROM lock screen to another tab
        if (getAppLocked()) {
            setAppLocked(false);
            showAllTabButtons();
        }
    }

    // Update lock tab button visibility based on app state
    const lockTabButton = document.querySelector('.app-tab[data-tab="lock"]');
    if (lockTabButton) {
        lockTabButton.style.display = tabName === 'lock' ? '' : 'none';
    }

    // 2. INFRASTRUCTURE SETUP
    // Ensure the tab container exists
    const tabContainer = ensureTabInfrastructure();
    if (!tabContainer) {
        console.error('switchAppTab: Failed to create tab infrastructure');
        return;
    }

    // 3. TAB PANEL CREATION
    // Create all required tab panels if they don't exist
    const requiredTabs = ['journalTab', 'goalsTab', 'statsTab', 'adviceTab', 'settingsTab', 'lockTab'];
    requiredTabs.forEach(tabId => {
        createTabPanel(tabId, tabContainer);
    });

    // Handle special case for existing journal tabs that may be empty
    const existingJournalTab = document.getElementById('journalTab');
    if (existingJournalTab && (!existingJournalTab.innerHTML.trim() || existingJournalTab.innerHTML.includes('Content dynamically generated by journaltab.js'))) {
        try {
            renderJournalTab(existingJournalTab);
        } catch (error) {
            console.error('Error rendering existing Journal tab:', error);
            existingJournalTab.innerHTML = `
                <div class="message-error">
                    Error loading Journal tab. Please refresh the page.
                    <button data-action="reload-app" class="btn btn-primary mt-sm">Refresh</button>
                </div>
            `;
        }
    }

    // 4. VISUAL STATE UPDATES
    // Update all UI elements to reflect the active tab
    updateTabVisualState(tabName);

    // 5. TAB-SPECIFIC LOGIC
    // Handle initialization, focus, and accessibility features
    handleTabSpecificLogic(tabName, isInitialLoad);
}

// ===================================================================================
// TAB BUTTON VISIBILITY CONTROL
// ===================================================================================

/**
 * Hides all tab buttons except the lock tab.
 * 
 * Used when the application is locked to restrict user access to only the lock screen.
 * Provides visual feedback that the application is in a secured state.
 * 
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Called when PIN protection activates
 * hideAllTabButtons();
 * // Only the lock tab button remains visible
 */
function hideAllTabButtons() {
    const tabButtons = document.querySelectorAll('.app-tab');
    tabButtons.forEach(button => {
        if (button.dataset.tab !== 'lock') {
            button.style.display = 'none';
        }
    });
    debugLog('Hid all tab buttons except lock tab');
}
        
/**
 * Shows all tab buttons except the lock tab.
 * 
 * Used when the application is unlocked to restore full navigation access.
 * The lock tab is hidden because users should use the lock button instead
 * of navigating directly to the lock tab.
 * 
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Called when PIN verification succeeds
 * showAllTabButtons();
 * // All main tabs become accessible again
 */
function showAllTabButtons() {
    const tabButtons = document.querySelectorAll('.app-tab');
    tabButtons.forEach(button => {
        if (button.dataset.tab !== 'lock') {
            // Clear the inline display so the stylesheet decides (the phone layout uses flex)
            button.style.display = '';
        }
    });
    debugLog('Showed all tab buttons');
}

// ===================================================================================
// SETTINGS SYNCHRONIZATION SYSTEM
// ===================================================================================

/**
 * Synchronizes settings display elements across different UI contexts.
 * 
 * Ensures consistency between various settings interfaces throughout the application,
 * including PIN controls, theme selectors, encryption checkboxes, and storage information.
 * Critical for maintaining UI state coherence across different tabs and contexts.
 * 
 * @returns {void}
 * @since 1.0.0
 * @todo Consider splitting into separate PIN, theme, and storage sync functions
 * @example
 * // Called when switching to settings tab
 * syncSettingsDisplay();
 * // Updates all settings controls to reflect current state
 * 
 * @example
 * // Called after PIN setup changes
 * syncSettingsDisplay();
 * // Updates PIN buttons and security indicators
 */
function syncSettingsDisplay() {
        // Sync PIN buttons
        const setupBtnSettings = document.getElementById('setupPinBtnSettings');
        const lockBtnSettings = document.getElementById('lockBtnSettings');
        
        if (setupBtnSettings && lockBtnSettings) {
            if (isPinSetup()) {
                if (getUnlocked()) {
                    lockBtnSettings.style.display = 'inline-block';
                    lockBtnSettings.textContent = '🔒 Lock';
                    setupBtnSettings.textContent = '⚙️ Change/Remove PIN';
                } else {
                    lockBtnSettings.style.display = 'none';
                    setupBtnSettings.textContent = '⚙️ Change/Remove PIN';
                }
            } else {
                lockBtnSettings.style.display = 'none';
                setupBtnSettings.textContent = '⚙️ Setup PIN';
            }
        }
        
        // Sync encryption checkbox
        const encryptionOriginal = document.getElementById('encryptionEnabled');
        const encryptionSettings = document.getElementById('encryptionEnabledSettings');
        
        if (encryptionOriginal && encryptionSettings) {
            encryptionSettings.checked = encryptionOriginal.checked;
            
            // Add sync event listeners
            encryptionSettings.addEventListener('change', function() {
                encryptionOriginal.checked = this.checked;
            });
            
            encryptionOriginal.addEventListener('change', function() {
                encryptionSettings.checked = this.checked;
            });
        }
        
        // Sync theme select - enhanced
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            const currentTheme = getCurrentTheme();
            themeSelect.value = currentTheme;
            
            // Double-check the value was set correctly
            if (themeSelect.value !== currentTheme) {
                debugLog('Theme select sync issue, forcing update');
                setTimeout(() => {
                    const themeSelectDelayed = document.getElementById('themeSelect');
                    if (themeSelectDelayed) {
                        themeSelectDelayed.value = currentTheme;
                    }
                }, 50);
            }
        }
        
        // Update storage info
        const storageTypeElement = document.getElementById('storageTypeDisplay');
        const storageStatusElement = document.getElementById('storageStatusDisplay');
        
        if (storageTypeElement && storageStatusElement) {
            switch (storageType) {
                case 'indexeddb':
                    storageTypeElement.textContent = 'Data stored in IndexedDB (recommended)';
                    storageStatusElement.textContent = '💾 IndexedDB';
                    storageStatusElement.style.color = 'var(--success-color)';
                    break;
                case 'localstorage':
                    storageTypeElement.textContent = 'Data stored in localStorage';
                    storageStatusElement.textContent = '📱 LocalStorage';
                    storageStatusElement.style.color = 'var(--info-color)';
                    break;
                case 'memory':
                    storageTypeElement.textContent = 'Data stored temporarily in memory only';
                    storageStatusElement.textContent = '⚠️ Memory Only';
                    storageStatusElement.style.color = 'var(--warning-color)';
                    break;
                default:
                    storageTypeElement.textContent = 'Storage type unknown';
                    storageStatusElement.textContent = '❓ Unknown';
                    storageStatusElement.style.color = 'var(--text-secondary)';
            }
        }
        
        // Update browser compatibility info
        updateBrowserCompatibilityDisplay();
    }

// ===================================================================================
// BROWSER COMPATIBILITY DISPLAY
// ===================================================================================

/**
 * Updates browser compatibility information in the settings interface.
 * 
 * Analyzes current browser capabilities and updates the compatibility display
 * to show support status for voice recording and transcription features.
 * Provides specific guidance for different browsers and their limitations.
 * 
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Called during settings tab initialization
 * updateBrowserCompatibilityDisplay();
 * // Shows "✅ Supported" for Chrome/Edge, "❌ Not Supported" for Firefox/Safari
 * 
 * @example
 * // Provides browser-specific feedback
 * // Chrome: "Your browser supports voice recording"
 * // Safari iOS: "Safari iOS has limited MediaRecorder support"
 */
function updateBrowserCompatibilityDisplay() {
        const voiceCapabilities = getVoiceCapabilities();
        
        // Voice Recording Status
        const voiceRecordingCompatibility = document.getElementById('voiceRecordingCompatibility');
        const voiceRecordingStatus = document.getElementById('voiceRecordingStatus');
        
        if (voiceRecordingCompatibility && voiceRecordingStatus) {
            if (voiceCapabilities.canRecord) {
                voiceRecordingCompatibility.textContent = 'Your browser supports voice recording';
                voiceRecordingStatus.textContent = '✅ Supported';
                voiceRecordingStatus.style.color = 'var(--success-color)';
            } else {
                if (voiceCapabilities.browser.isSafariMobile) {
                    voiceRecordingCompatibility.textContent = 'Safari iOS has limited MediaRecorder support';
                } else {
                    voiceRecordingCompatibility.textContent = 'Voice recording not supported in this browser';
                }
                voiceRecordingStatus.textContent = '❌ Not Supported';
                voiceRecordingStatus.style.color = 'var(--error-color)';
            }
        }
        
        // Transcription Status
        const transcriptionCompatibility = document.getElementById('transcriptionCompatibility');
        const transcriptionStatus = document.getElementById('transcriptionStatus');
        
        if (transcriptionCompatibility && transcriptionStatus) {
            if (voiceCapabilities.canTranscribe) {
                transcriptionCompatibility.textContent = 'Your browser supports speech transcription';
                transcriptionStatus.textContent = '✅ Supported';
                transcriptionStatus.style.color = 'var(--success-color)';
            } else {
                if (voiceCapabilities.browser.isFirefox) {
                    transcriptionCompatibility.textContent = 'Firefox does not support Speech Recognition API';
                } else if (voiceCapabilities.browser.isSafari) {
                    transcriptionCompatibility.textContent = 'Safari does not support Speech Recognition API';
                } else {
                    transcriptionCompatibility.textContent = 'Speech Recognition API not available in this browser';
                }
                transcriptionStatus.textContent = '❌ Not Supported';
                transcriptionStatus.style.color = 'var(--error-color)';
            }
        }
    }

// ===================================================================================
// VOICE TAB MANAGEMENT
// ===================================================================================

/**
 * Switches between voice recording tabs (record/stored).
 * 
 * Manages the voice recording interface tab system, handling the transition between
 * recording new voice notes and viewing stored voice notes. Automatically loads
 * voice notes when switching to the stored tab.
 * 
 * @param {('record'|'stored')} tabName - Target voice tab identifier
 * @returns {void}
 * @throws {TypeError} When tabName is not 'record' or 'stored'
 * @since 1.0.0
 * @example
 * // Switch to recording interface
 * switchVoiceTab('record');
 * 
 * @example
 * // Switch to stored notes and load them
 * switchVoiceTab('stored');
 * // Automatically calls displayVoiceNotes()
 */
function switchVoiceTab(tabName) {
        if (!tabName || (tabName !== 'record' && tabName !== 'stored')) return;
        
        // Update tab buttons
        const tabs = document.querySelectorAll('.voice-tab');
        tabs.forEach(tab => {
            const tabId = tab.dataset.tab;
            if (tabId === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Update tab panels
        const recordPanel = document.getElementById('voiceTabRecord');
        const storedPanel = document.getElementById('voiceTabStored');
        
        if (recordPanel && storedPanel) {
            if (tabName === 'record') {
                recordPanel.classList.add('active');
                recordPanel.style.display = 'block';
                storedPanel.classList.remove('active');
                storedPanel.style.display = 'none';
            } else {
                recordPanel.classList.remove('active');
                recordPanel.style.display = 'none';
                storedPanel.classList.add('active');
                storedPanel.style.display = 'block';
                
                // Load and display voice notes when switching to stored tab
                displayVoiceNotes();
            }
            
            setActiveVoiceTab(tabName);
        }
    }

// ===================================================================================
// DATE AND CHART UTILITY FUNCTIONS
// ===================================================================================

/**
 * Sets date filter inputs to a specific date and navigates to journal tab.
 * 
 * This utility function provides a centralized way to set both start and end date
 * filter inputs to the same date value, effectively creating a single-day filter.
 * It also handles the UI navigation by switching to the journal tab where the
 * filtered results will be displayed.
 * 
 * The function validates the input date, finds the required DOM elements, sets
 * their values, and switches to the journal tab. It returns a success indicator
 * that allows the caller to decide whether to trigger additional filtering.
 * This design prevents circular dependencies while maintaining clean separation
 * of concerns.
 * 
 * @param {string} dateString - Date string to set in both filter inputs (should be in YYYY-MM-DD format)
 * @returns {boolean} True if date was successfully set and tab switched, false otherwise
 * @throws {Error} Does not throw - returns false for any errors and logs them
 * @since 2.02.49
 * @example
 * // Set filter to specific date from calendar click
 * const success = setDateFilter('2024-01-15');
 * if (success) {
 *   debouncedFilter(); // Caller decides whether to trigger filtering
 * }
 * 
 * @example
 * // Handle invalid date gracefully
 * const success = setDateFilter('invalid-date');
 * console.log(success); // false - inputs unchanged, error logged
 * 
 * @example
 * // Typical usage in action handlers
 * 'go-to-date': (ctx) => {
 *   if (setDateFilter(ctx.element.dataset.date)) {
 *     debouncedFilter();
 *   }
 * }
 */
function setDateFilter(dateString) {
    try {
        // Validate input parameter
        if (!dateString || typeof dateString !== 'string') {
            console.warn('setDateFilter: Invalid date string provided:', dateString);
            return false;
        }
        
        // Find the date filter input elements
        const startDateInput = document.getElementById('startDateFilter');
        const endDateInput = document.getElementById('endDateFilter');
        
        // Validate DOM elements exist
        if (!startDateInput || !endDateInput) {
            console.error('setDateFilter: Date filter input elements not found');
            return false;
        }
        
        // Set both inputs to the same date for single-day filtering
        startDateInput.value = dateString;
        endDateInput.value = dateString;
        
        // Switch to journal tab where filtered results will be displayed
        switchAppTab('journal');
        
        // Return success - caller can decide whether to trigger filtering
        return true;
        
    } catch (error) {
        console.error('setDateFilter: Error setting date filter:', error);
        return false;
    }
}

// ================================
// ES MODULE EXPORTS
// ================================

export {
    switchAppTab,
    hideAllTabButtons,
    showAllTabButtons,
    syncSettingsDisplay,
    updateBrowserCompatibilityDisplay,
    switchVoiceTab,
    setDateFilter
};
