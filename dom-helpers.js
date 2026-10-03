/**
 * @fileoverview DOM manipulation and UI component utilities for the Dream Journal application.
 * 
 * This module provides comprehensive DOM manipulation utilities, UI component creation functions,
 * and consistent styling helpers. All functions are designed to work with the application's
 * HSL-based theme system and centralized event handling via data-action attributes.
 * 
 * @module DOMHelpers
 * @version 2.05.06
 * @author Dream Journal Development Team
 * @since 1.0.0
 * @requires constants
 * @requires state
 * @example
 * import * as DOMHelpers from './dom-helpers.js';
 * 
 * const button = DOMHelpers.createActionButton('save-dream', '123', 'Save Dream');
 * DOMHelpers.createInlineMessage('success', 'Dream saved successfully!');
 */

// ===================================================================================
// ES MODULE IMPORTS
// ===================================================================================

import { debugLog } from './logger.js';
import {
    CONSTANTS,
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
    commonTags,
    commonDreamSigns,
    commonEmotions,
    getTipsCount
} from './constants.js';
import {
    setActiveAppTab,
    getAppLocked,
    getActiveAppTab,
    setAppLocked,
    setPreLockActiveTab,
    getUnlocked,
    setActiveVoiceTab,
    getIsDreamFormCollapsed,
    setIsDreamFormCollapsed,
    getIsSettingsAppearanceCollapsed,
    setIsSettingsAppearanceCollapsed,
    getIsSettingsSecurityCollapsed,
    setIsSettingsSecurityCollapsed,
    getIsSettingsDataCollapsed,
    setIsSettingsDataCollapsed,
    getIsSettingsAutocompleteCollapsed,
    setIsSettingsAutocompleteCollapsed,
    getIsSettingsCloudSyncCollapsed,
    setIsSettingsCloudSyncCollapsed,
    getIsGoalsActiveCollapsed,
    setIsGoalsActiveCollapsed,
    getIsGoalsTemplatesCollapsed,
    setIsGoalsTemplatesCollapsed,
    getIsGoalsCompletedCollapsed,
    setIsGoalsCompletedCollapsed,
    getIsAdviceDailyTipCollapsed,
    setIsAdviceDailyTipCollapsed,
    getIsAdviceTechniquesCollapsed,
    setIsAdviceTechniquesCollapsed,
    getIsAdviceGeneralCollapsed,
    setIsAdviceGeneralCollapsed,
    getIsJournalControlsCollapsed,
    setIsJournalControlsCollapsed,
    asyncMutex,
    getCurrentTipIndex
} from './state.js';
import { storageType, getAutocompleteSuggestions } from './storage.js';
import { getResetTime, updateSecurityControls, isPinSetup } from './security.js';
import { renderGoalsTab, initializeGoalsTab } from './goalstab.js';
import { renderJournalTab } from './journaltab.js';
import { renderStatsTab, initializeStatsTab } from './statstab.js';
import { renderAdviceTab, initializeAdviceTab, displayTipLazy } from './advicetab.js';
import { getVoiceCapabilities, displayVoiceNotes } from './voice-notes.js';
import { renderSettingsTab, initializeSettingsTab } from './settingstab.js';
import {
    escapeHtml,
    escapeAttr,
    createActionButton,
    announceLiveMessage,
    createInlineMessage,
    createMetaDisplay,
    createPaginationHTML
} from './ui-basics.js';
import {
    getCurrentTheme,
    storeTheme,
    applyTheme,
    switchTheme,
    getCurrentPaginationPreference,
    storePaginationPreference
} from './preferences.js';
import {
    formatDisplayDate,
    formatDateKey,
    formatDateTimeDisplay,
    createPieChartColors,
    createPieChartHTML
} from './format-helpers.js';

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
        lockTabButton.style.display = tabName === 'lock' ? 'block' : 'none';
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
            button.style.display = 'block';
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
// FORM STATE MANAGEMENT
// ===================================================================================

/**
 * Toggles dream form between expanded and collapsed states with optional focus management.
 * 
 * Provides a collapsible dream entry form interface that can be expanded for full
 * functionality or collapsed to save screen space. User preference is persisted
 * to localStorage for consistency across sessions. Includes accessibility-focused
 * option to move focus to first form field when expanding via keyboard.
 * 
 * @param {boolean} [shouldMoveFocus=false] - Whether to move focus to first form field when expanding (for keyboard accessibility)
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Toggle form state (expand if collapsed, collapse if expanded)
 * toggleDreamForm();
 * 
 * @example
 * // Toggle with focus management (typically for keyboard activation)
 * toggleDreamForm(true); // Focuses date field when expanding
 * 
 * @example
 * // State persists across browser sessions
 * toggleDreamForm(); // Collapses form
 * // Page reload - form remains collapsed
 */
function toggleDreamForm(shouldMoveFocus = false) {
        const fullForm = document.getElementById('dreamFormFull');
        const collapsedForm = document.getElementById('dreamFormCollapsed');
        
        if (!fullForm || !collapsedForm) return; // Safety check

        // Get the toggle buttons/headers
        const expandedHeader = fullForm.querySelector('[data-action="toggle-dream-form"]');
        const collapsedHeader = collapsedForm.querySelector('[data-action="toggle-dream-form"]');

        if (getIsDreamFormCollapsed()) {
            // Expand: show full form, hide collapsed
            fullForm.style.display = 'block';
            collapsedForm.style.display = 'none';
            setIsDreamFormCollapsed(false);
            
            // Update ARIA states for expanded form
            if (expandedHeader) {
                expandedHeader.setAttribute('aria-expanded', 'true');
                expandedHeader.setAttribute('aria-label', 'Record Your Dream form - currently expanded. Press Enter or Space to collapse');
            }
            if (collapsedHeader) {
                collapsedHeader.setAttribute('aria-expanded', 'true');
            }
            
            // Move focus to first form field if expansion was triggered by keyboard
            if (shouldMoveFocus) {
                // Use setTimeout to ensure the form is fully displayed before focusing
                setTimeout(() => {
                    const dateField = document.getElementById('dreamDate');
                    if (dateField) {
                        dateField.focus();
                    }
                }, 50);
            }
            
            try { localStorage.setItem(DREAM_FORM_COLLAPSE_KEY, 'false'); } catch (e) {}
        } else {
            // Collapse: hide full form, show collapsed
            fullForm.style.display = 'none';
            collapsedForm.style.display = 'block';
            setIsDreamFormCollapsed(true);
            
            // Update ARIA states for collapsed form
            if (collapsedHeader) {
                collapsedHeader.setAttribute('aria-expanded', 'false');
                collapsedHeader.setAttribute('aria-label', 'Record Your Dream form - currently collapsed. Press Enter or Space to expand');
            }
            if (expandedHeader) {
                expandedHeader.setAttribute('aria-expanded', 'false');
            }
            
            try { localStorage.setItem(DREAM_FORM_COLLAPSE_KEY, 'true'); } catch (e) {}
        }
    }

/**
 * Toggles the visibility of a specific settings section between expanded and collapsed states.
 *
 * This function provides collapsible functionality for settings page sections,
 * allowing users to show/hide section content to organize their interface.
 * State is persisted across browser sessions using localStorage for each section independently.
 *
 * **Supported Sections:**
 * - 'appearance': Appearance settings (theme, display preferences)
 * - 'security': Security settings (PIN, encryption, data protection)
 * - 'data': Data Management settings (export/import, backup/restore)
 * - 'autocomplete': Autocomplete Management settings (tags, dream signs, emotions)
 *
 * **Functionality:**
 * - Toggles section content visibility (show/hide)
 * - Updates ARIA attributes for accessibility
 * - Persists collapse state to localStorage
 * - Updates global application state
 * - Provides visual feedback with expand/collapse indicators
 *
 * **Accessibility Features:**
 * - Proper ARIA expanded/collapsed states
 * - Keyboard navigation support
 * - Screen reader announcements
 * - Focus management
 *
 * @async
 * @function
 * @param {('appearance'|'security'|'data'|'autocomplete')} sectionName - Name of the settings section to toggle
 * @returns {Promise<void>} Resolves when toggle operation completes
 * @throws {Error} When sectionName is invalid or required DOM elements are missing
 * @since 2.04.01
 *
 * @example
 * // Toggle the security settings section
 * await toggleSettingsSection('security');
 *
 * @example
 * // Toggle appearance section (typically called via data-action)
 * <h3 class="collapsible-heading">
 *   <button type="button" class="collapse-toggle" data-action="toggle-settings-appearance">
 *     🎨 Appearance <span class="collapse-indicator">🔽</span>
 *   </button>
 * </h3>
 */
async function toggleSettingsSection(sectionName) {
    try {
        // Validate section name
        const validSections = ['appearance', 'security', 'data', 'autocomplete', 'cloud-sync'];
        if (!validSections.includes(sectionName)) {
            throw new Error(`Invalid section name: ${sectionName}. Must be one of: ${validSections.join(', ')}`);
        }

        // Get the appropriate state functions and storage key
        const sectionConfig = {
            'appearance': {
                getter: getIsSettingsAppearanceCollapsed,
                setter: setIsSettingsAppearanceCollapsed,
                storageKey: SETTINGS_APPEARANCE_COLLAPSE_KEY,
                displayName: 'Appearance',
                emoji: '🎨'
            },
            'security': {
                getter: getIsSettingsSecurityCollapsed,
                setter: setIsSettingsSecurityCollapsed,
                storageKey: SETTINGS_SECURITY_COLLAPSE_KEY,
                displayName: 'Security',
                emoji: '🔐'
            },
            'data': {
                getter: getIsSettingsDataCollapsed,
                setter: setIsSettingsDataCollapsed,
                storageKey: SETTINGS_DATA_COLLAPSE_KEY,
                displayName: 'Data Management',
                emoji: '💾'
            },
            'autocomplete': {
                getter: getIsSettingsAutocompleteCollapsed,
                setter: setIsSettingsAutocompleteCollapsed,
                storageKey: SETTINGS_AUTOCOMPLETE_COLLAPSE_KEY,
                displayName: 'Autocomplete Management',
                emoji: '🏷️'
            },
            'cloud-sync': {
                getter: getIsSettingsCloudSyncCollapsed,
                setter: setIsSettingsCloudSyncCollapsed,
                storageKey: SETTINGS_CLOUD_SYNC_COLLAPSE_KEY,
                displayName: 'Cloud Sync',
                emoji: '☁️'
            }
        };

        const config = sectionConfig[sectionName];

        // Get the settings section element
        const sectionElement = document.querySelector(`[data-settings-section="${sectionName}"]`);
        if (!sectionElement) {
            throw new Error(`Settings section element not found for: ${sectionName}`);
        }

        // Get the toggle header and content area
        const toggleHeader = sectionElement.querySelector(`[data-action="toggle-settings-${sectionName}"]`);
        const contentArea = sectionElement.querySelector('.settings-section-content');
        const collapseIndicator = toggleHeader?.querySelector('.collapse-indicator');

        if (!toggleHeader || !contentArea) {
            throw new Error(`Required toggle elements not found for section: ${sectionName}`);
        }

        const isCurrentlyCollapsed = config.getter();

        if (isCurrentlyCollapsed) {
            // Expand: show content
            contentArea.style.display = 'block';
            config.setter(false);

            // Update ARIA states for expanded section
            toggleHeader.setAttribute('aria-expanded', 'true');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently expanded. Press Enter or Space to collapse`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to collapse');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to collapse)';
            }

            // Save expanded state
            try { localStorage.setItem(config.storageKey, 'false'); } catch (e) {}
        } else {
            // Collapse: hide content
            contentArea.style.display = 'none';
            config.setter(true);

            // Update ARIA states for collapsed section
            toggleHeader.setAttribute('aria-expanded', 'false');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently collapsed. Press Enter or Space to expand`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to expand');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to expand)';
            }

            // Save collapsed state
            try { localStorage.setItem(config.storageKey, 'true'); } catch (e) {}
        }

    } catch (error) {
        console.error(`Error toggling settings section "${sectionName}":`, error);
        throw error;
    }
}

/**
 * Toggles the collapse/expand state of a goals section with state persistence.
 *
 * This function handles the UI interactions for collapsing and expanding goals sections
 * including visual state updates, ARIA attribute management, localStorage persistence,
 * and focus management. It follows the same pattern as settings sections but works
 * specifically with goals sections.
 *
 * **Supported Sections:**
 * - 'active': Active Goals section
 * - 'templates': Quick Goal Templates section
 * - 'completed': Completed Goals section
 *
 * **State Management:**
 * - Updates visual indicators (arrows and hint text)
 * - Saves state to localStorage for persistence across sessions
 * - Updates ARIA attributes for screen readers
 * - Synchronizes with global application state
 *
 * **Error Handling:**
 * - Validates section names before processing
 * - Handles DOM element availability gracefully
 * - Provides fallback for localStorage access issues
 *
 * @async
 * @function toggleGoalsSection
 * @param {string} sectionName - Name of the goals section to toggle ('active', 'templates', 'completed')
 * @returns {Promise<void>} Promise that resolves when toggle operation completes
 * @throws {Error} When invalid section name is provided or required DOM elements are missing
 * @since 2.04.01
 *
 * @example
 * // Toggle the active goals section
 * await toggleGoalsSection('active');
 *
 * @example
 * // Toggle the templates section
 * await toggleGoalsSection('templates');
 */
async function toggleGoalsSection(sectionName) {
    try {
        // Validate section name
        const validSections = ['active', 'templates', 'completed'];
        if (!validSections.includes(sectionName)) {
            throw new Error(`Invalid goals section name: ${sectionName}. Must be one of: ${validSections.join(', ')}`);
        }

        // Get the appropriate state functions and storage key
        const sectionConfig = {
            'active': {
                getter: getIsGoalsActiveCollapsed,
                setter: setIsGoalsActiveCollapsed,
                storageKey: GOALS_ACTIVE_COLLAPSE_KEY,
                displayName: 'Active Goals',
                emoji: '🎯'
            },
            'templates': {
                getter: getIsGoalsTemplatesCollapsed,
                setter: setIsGoalsTemplatesCollapsed,
                storageKey: GOALS_TEMPLATES_COLLAPSE_KEY,
                displayName: 'Quick Goal Templates',
                emoji: '📈'
            },
            'completed': {
                getter: getIsGoalsCompletedCollapsed,
                setter: setIsGoalsCompletedCollapsed,
                storageKey: GOALS_COMPLETED_COLLAPSE_KEY,
                displayName: 'Completed Goals',
                emoji: '🏆'
            }
        };

        const config = sectionConfig[sectionName];
        if (!config) {
            throw new Error(`Goals section configuration not found for: ${sectionName}`);
        }

        // Get DOM elements
        const sectionElement = document.querySelector(`[data-goals-section="${sectionName}"]`);
        if (!sectionElement) {
            throw new Error(`Goals section element not found: [data-goals-section="${sectionName}"]`);
        }

        const toggleHeader = sectionElement.querySelector(`[data-action="toggle-goals-${sectionName}"]`);
        const contentArea = sectionElement.querySelector('.settings-section-content');

        if (!toggleHeader || !contentArea) {
            throw new Error(`Required elements not found in goals section: ${sectionName}`);
        }

        // Get current state and toggle
        const isCurrentlyCollapsed = config.getter();
        const collapseIndicator = toggleHeader.querySelector('.collapse-indicator');

        if (isCurrentlyCollapsed) {
            // Expand: show content
            contentArea.style.display = 'block';
            config.setter(false);

            // Update ARIA states for expanded section
            toggleHeader.setAttribute('aria-expanded', 'true');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently expanded. Press Enter or Space to collapse`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to collapse');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to collapse)';
            }

            // Save expanded state
            try { localStorage.setItem(config.storageKey, 'false'); } catch (e) {}
        } else {
            // Collapse: hide content
            contentArea.style.display = 'none';
            config.setter(true);

            // Update ARIA states for collapsed section
            toggleHeader.setAttribute('aria-expanded', 'false');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently collapsed. Press Enter or Space to expand`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to expand');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to expand)';
            }

            // Save collapsed state
            try { localStorage.setItem(config.storageKey, 'true'); } catch (e) {}
        }

    } catch (error) {
        console.error(`Error toggling goals section "${sectionName}":`, error);
        throw error;
    }
}

/**
 * Toggles the collapse/expand state of an advice section with state persistence.
 *
 * This function handles the UI interactions for collapsing and expanding advice sections
 * including visual state updates, ARIA attribute management, localStorage persistence,
 * and focus management. It follows the same pattern as settings and goals sections but works
 * specifically with advice sections.
 *
 * **Supported Sections:**
 * - 'daily-tip': Daily Lucid Dreaming Tip section
 * - 'techniques': Lucid Dreaming Techniques section
 * - 'general': General Advice section
 *
 * **State Management:**
 * - Updates visual indicators (arrows and hint text)
 * - Saves state to localStorage for persistence across sessions
 * - Updates ARIA attributes for screen readers
 * - Synchronizes with global application state
 *
 * **Error Handling:**
 * - Validates section names before processing
 * - Handles DOM element availability gracefully
 * - Provides fallback for localStorage access issues
 *
 * @async
 * @function toggleAdviceSection
 * @param {string} sectionName - Name of the advice section to toggle ('daily-tip', 'techniques', 'general')
 * @returns {Promise<void>} Promise that resolves when toggle operation completes
 * @throws {Error} When invalid section name is provided or required DOM elements are missing
 * @since 2.04.01
 *
 * @example
 * // Toggle the daily tip section
 * await toggleAdviceSection('daily-tip');
 *
 * @example
 * // Toggle the techniques section
 * await toggleAdviceSection('techniques');
 */
async function toggleAdviceSection(sectionName) {
    try {
        // Validate section name
        const validSections = ['daily-tip', 'techniques', 'general'];
        if (!validSections.includes(sectionName)) {
            throw new Error(`Invalid advice section name: ${sectionName}. Must be one of: ${validSections.join(', ')}`);
        }

        // Get the appropriate state functions and storage key
        const sectionConfig = {
            'daily-tip': {
                getter: getIsAdviceDailyTipCollapsed,
                setter: setIsAdviceDailyTipCollapsed,
                storageKey: ADVICE_DAILY_TIP_COLLAPSE_KEY,
                displayName: 'Daily Lucid Dreaming Tip',
                emoji: '💡'
            },
            'techniques': {
                getter: getIsAdviceTechniquesCollapsed,
                setter: setIsAdviceTechniquesCollapsed,
                storageKey: ADVICE_TECHNIQUES_COLLAPSE_KEY,
                displayName: 'Lucid Dreaming Techniques',
                emoji: '📚'
            },
            'general': {
                getter: getIsAdviceGeneralCollapsed,
                setter: setIsAdviceGeneralCollapsed,
                storageKey: ADVICE_GENERAL_COLLAPSE_KEY,
                displayName: 'General Advice',
                emoji: '💡'
            }
        };

        const config = sectionConfig[sectionName];
        if (!config) {
            throw new Error(`Advice section configuration not found for: ${sectionName}`);
        }

        // Get DOM elements
        const sectionElement = document.querySelector(`[data-advice-section="${sectionName}"]`);
        if (!sectionElement) {
            throw new Error(`Advice section element not found: [data-advice-section="${sectionName}"]`);
        }

        const toggleHeader = sectionElement.querySelector(`[data-action="toggle-advice-${sectionName}"]`);
        const contentArea = sectionElement.querySelector('.settings-section-content');

        if (!toggleHeader || !contentArea) {
            throw new Error(`Required elements not found in advice section: ${sectionName}`);
        }

        // Get current state and toggle
        const isCurrentlyCollapsed = config.getter();
        const collapseIndicator = toggleHeader.querySelector('.collapse-indicator');

        if (isCurrentlyCollapsed) {
            // Expand: show content
            contentArea.style.display = 'block';
            config.setter(false);

            // Update ARIA states for expanded section
            toggleHeader.setAttribute('aria-expanded', 'true');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently expanded. Press Enter or Space to collapse`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to collapse');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to collapse)';
            }

            // Save expanded state
            try { localStorage.setItem(config.storageKey, 'false'); } catch (e) {}
        } else {
            // Collapse: hide content
            contentArea.style.display = 'none';
            config.setter(true);

            // Update ARIA states for collapsed section
            toggleHeader.setAttribute('aria-expanded', 'false');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently collapsed. Press Enter or Space to expand`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to expand');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to expand)';
            }

            // Save collapsed state
            try { localStorage.setItem(config.storageKey, 'true'); } catch (e) {}
        }

    } catch (error) {
        console.error(`Error toggling advice section "${sectionName}":`, error);
        throw error;
    }
}

/**
 * Toggles the collapse/expand state of a journal section with state persistence.
 *
 * This function handles the UI interactions for collapsing and expanding journal sections
 * including visual state updates, ARIA attribute management, localStorage persistence,
 * and focus management. It follows the same pattern as other section toggles but works
 * specifically with journal sections.
 *
 * **Supported Sections:**
 * - 'controls': Search & Filter Controls section
 *
 * **State Management:**
 * - Updates visual indicators (arrows and hint text)
 * - Saves state to localStorage for persistence across sessions
 * - Updates ARIA attributes for screen readers
 * - Synchronizes with global application state
 *
 * **Error Handling:**
 * - Validates section names before processing
 * - Handles DOM element availability gracefully
 * - Provides fallback for localStorage access issues
 *
 * @async
 * @function toggleJournalSection
 * @param {string} sectionName - Name of the journal section to toggle ('controls')
 * @returns {Promise<void>} Promise that resolves when toggle operation completes
 * @throws {Error} When invalid section name is provided or required DOM elements are missing
 * @since 2.04.01
 *
 * @example
 * // Toggle the controls section
 * await toggleJournalSection('controls');
 */
async function toggleJournalSection(sectionName) {
    try {
        // Validate section name
        const validSections = ['controls'];
        if (!validSections.includes(sectionName)) {
            throw new Error(`Invalid journal section name: ${sectionName}. Must be one of: ${validSections.join(', ')}`);
        }

        // Get the appropriate state functions and storage key
        const sectionConfig = {
            'controls': {
                getter: getIsJournalControlsCollapsed,
                setter: setIsJournalControlsCollapsed,
                storageKey: JOURNAL_CONTROLS_COLLAPSE_KEY,
                displayName: 'Search & Filter Controls',
                emoji: '🔍'
            }
        };

        const config = sectionConfig[sectionName];
        if (!config) {
            throw new Error(`Journal section configuration not found for: ${sectionName}`);
        }

        // Get DOM elements
        const sectionElement = document.querySelector(`[data-journal-section="${sectionName}"]`);
        if (!sectionElement) {
            throw new Error(`Journal section element not found: [data-journal-section="${sectionName}"]`);
        }

        const toggleHeader = sectionElement.querySelector(`[data-action="toggle-journal-${sectionName}"]`);
        const contentArea = sectionElement.querySelector('.settings-section-content');

        if (!toggleHeader || !contentArea) {
            throw new Error(`Required elements not found in journal section: ${sectionName}`);
        }

        // Get current state and toggle
        const isCurrentlyCollapsed = config.getter();
        const collapseIndicator = toggleHeader.querySelector('.collapse-indicator');

        if (isCurrentlyCollapsed) {
            // Expand: show content
            contentArea.style.display = 'block';
            config.setter(false);

            // Update ARIA states for expanded section
            toggleHeader.setAttribute('aria-expanded', 'true');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently expanded. Press Enter or Space to collapse`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to collapse');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to collapse)';
            }

            // Save expanded state
            try { localStorage.setItem(config.storageKey, 'false'); } catch (e) {}
        } else {
            // Collapse: hide content
            contentArea.style.display = 'none';
            config.setter(true);

            // Update ARIA states for collapsed section
            toggleHeader.setAttribute('aria-expanded', 'false');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently collapsed. Press Enter or Space to expand`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to expand');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to expand)';
            }

            // Save collapsed state
            try { localStorage.setItem(config.storageKey, 'true'); } catch (e) {}
        }

    } catch (error) {
        console.error(`Error toggling journal section "${sectionName}":`, error);
        throw error;
    }
}

// ===================================================================================
// LOADING STATE MANAGEMENT
// ===================================================================================

/**
 * Displays loading indicator during search/filter operations.
 * 
 * Shows a search-specific loading indicator in the entries container, with protection
 * against duplicate indicators. Only displays if the display mutex is not locked,
 * preventing conflicts with other display operations.
 * 
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Show loading before search operation
 * showSearchLoading();
 * performSearchOperation().then(() => {
 *   hideSearchLoading();
 * });
 * 
 * @example
 * // Automatic duplicate prevention
 * showSearchLoading();
 * showSearchLoading(); // Second call has no effect
 */
function showSearchLoading() {
        const container = document.getElementById('entriesContainer');
        if (container && !asyncMutex.displayDreams.locked) {
            const existingLoader = container.querySelector('.loading-state');
            if (!existingLoader) {
                const loader = document.createElement('div');
                loader.className = 'loading-state';
                loader.innerHTML = '🔍 Searching dreams...';
                container.appendChild(loader);
            }
        }
    }

/**
 * Hides search/filter loading indicator.
 * 
 * Removes any active loading indicators from the entries container, typically
 * called after search or filter operations complete.
 * 
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Hide loading after search completes
 * performSearch().finally(() => {
 *   hideSearchLoading();
 * });
 */
function hideSearchLoading() {
        const container = document.getElementById('entriesContainer');
        if (container) {
            const loader = container.querySelector('.loading-state');
            if (loader) {
                loader.remove();
            }
        }
    }

    

// ===================================================================================
// AUTOCOMPLETE MANAGEMENT INTERFACE
// ===================================================================================

/**
 * Initialize autocomplete system with tag and dream sign suggestions.
 * 
 * This function sets up the autocomplete functionality for dream tags and dream signs
 * input fields. It loads previously used suggestions from IndexedDB storage to provide
 * personalized autocomplete options based on the user's history. If storage access fails,
 * it falls back to predefined common tags and dream signs from the constants module.
 * 
 * The autocomplete system helps users quickly enter consistent tags and dream signs,
 * improving data quality and user experience during dream entry creation.
 * 
 * @async
 * @function
 * @returns {Promise<void>} Promise that resolves when autocomplete is initialized
 * @throws {Error} When storage access fails (handled gracefully with fallback)
 * @since 1.5.0
 * @example
 * await initializeAutocomplete();
 * // Tag and dream sign inputs now have autocomplete functionality
 * 
 * @see {@link getAutocompleteSuggestions} For suggestion retrieval
 * @see {@link setupTagAutocomplete} For autocomplete UI setup
 */
async function initializeAutocomplete() {
    try {
        // Check if encryption is enabled
        const { getEncryptionEnabled } = await import('./state.js');

        if (getEncryptionEnabled()) {
            // For encrypted data, set up lazy loading autocomplete
            // Data will only be decrypted when user actually focuses on input fields
            setupLazySecureAutocomplete('dreamTags', 'tags');
            setupLazySecureAutocomplete('dreamSigns', 'dreamSigns');
            setupLazySecureAutocomplete('dreamEmotions', 'emotions');
        } else {
            // For unencrypted data, use normal initialization
            const [tags, signs, emotions] = await Promise.all([
                getAutocompleteSuggestions('tags'),
                getAutocompleteSuggestions('dreamSigns'),
                getAutocompleteSuggestions('emotions')
            ]);
            setupTagAutocomplete('dreamTags', tags);
            setupTagAutocomplete('dreamSigns', signs);
            setupTagAutocomplete('dreamEmotions', emotions);
        }
    } catch (error) {
        console.error("Failed to initialize autocomplete:", error);
        setupTagAutocomplete('dreamTags', commonTags);
        setupTagAutocomplete('dreamSigns', commonDreamSigns);
        setupTagAutocomplete('dreamEmotions', commonEmotions);
    }
}

/**
 * Sets up secure lazy-loading autocomplete for encrypted data.
 *
 * This function implements a security-conscious approach to autocomplete for encrypted data.
 * Instead of loading and decrypting all autocomplete data at startup, it only decrypts
 * data when the user actually focuses on the input field, and clears it from memory
 * after a timeout to minimize exposure of sensitive data.
 *
 * **Security Features:**
 * - Data is only decrypted when needed (on focus)
 * - Decrypted data is cleared from memory after use
 * - Reduces exposure window for sensitive autocomplete data
 * - Falls back to common defaults if decryption fails
 *
 * @async
 * @function
 * @param {string} elementId - ID of the input element to attach autocomplete to
 * @param {('tags'|'dreamSigns')} dataType - Type of autocomplete data to load
 * @returns {void}
 * @since 2.03.04
 * @example
 * setupLazySecureAutocomplete('dreamTags', 'tags');
 * // Autocomplete data will only be decrypted when user focuses on the input
 */
async function setupLazySecureAutocomplete(elementId, dataType) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let decryptedData = null;
    let timeoutId = null;

    // Function to clear sensitive data from memory
    const clearSensitiveData = () => {
        if (decryptedData) {
            // Overwrite array contents for security
            decryptedData.fill('');
            decryptedData = null;
        }
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    // Set up focus event to decrypt data on demand
    element.addEventListener('focus', async () => {
        try {
            // Clear any existing timeout
            if (timeoutId) clearTimeout(timeoutId);

            // Decrypt data if not already available
            if (!decryptedData) {
                const { getAutocompleteSuggestions } = await import('./storage.js');
                decryptedData = await getAutocompleteSuggestions(dataType);
            }

            // Set up autocomplete with decrypted data
            setupTagAutocomplete(elementId, decryptedData);

            // Set timeout to clear data after 5 minutes of inactivity
            timeoutId = setTimeout(clearSensitiveData, 5 * 60 * 1000);

        } catch (error) {
            console.error(`Failed to load secure autocomplete for ${dataType}:`, error);
            // Fall back to default data
            const { commonTags, commonDreamSigns } = await import('./constants.js');
            const fallbackData = dataType === 'tags' ? commonTags : commonDreamSigns;
            setupTagAutocomplete(elementId, fallbackData);
        }
    });

    // Clear data when user leaves the field
    element.addEventListener('blur', () => {
        // Set a shorter timeout when user leaves the field
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(clearSensitiveData, 30 * 1000); // 30 seconds
    });

    // Clear data when page is about to unload
    window.addEventListener('beforeunload', clearSensitiveData);
}

/**
 * Renders autocomplete management list for tags or dream signs.
 *
 * Creates an interactive list of autocomplete suggestions with delete functionality.
 * Handles loading states, empty states, and error conditions gracefully. All items
 * are treated uniformly with delete capabilities.
 * 
 * @async
 * @param {('tags'|'dreamSigns'|'emotions')} type - Type of autocomplete items to render
 * @returns {Promise<void>}
 * @throws {TypeError} When type is not 'tags', 'dreamSigns', or 'emotions'
 * @throws {Error} When autocomplete suggestions cannot be loaded
 * @since 1.0.0
 * @example
 * // Render tags management interface
 * await renderAutocompleteManagementList('tags');
 *
 * @example
 * // Render dream signs management interface
 * await renderAutocompleteManagementList('dreamSigns');
 *
 * @example
 * // Render emotions management interface
 * await renderAutocompleteManagementList('emotions');
 * 
 * @example
 * // Error handling
 * try {
 *   await renderAutocompleteManagementList('tags');
 * } catch (error) {
 *   console.error('Failed to render management list:', error);
 * }
 */
async function renderAutocompleteManagementList(type) {
        const containerId = type === 'tags' ? 'tagsManagementList' : type === 'dreamSigns' ? 'dreamSignsManagementList' : 'emotionsManagementList';
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<div class="loading-state">Loading...</div>';

        try {
            // Get the unified list of suggestions. This now correctly reads from the new store.
            const suggestions = await getAutocompleteSuggestions(type);

            if (suggestions.length === 0) {
                container.innerHTML = `<div class="no-entries" style="padding: 15px;">No custom items added yet.</div>`;
                return;
            }

            // All items are now treated the same. No more 'default' vs 'user' distinction.
            const listHtml = suggestions.map(item => {
                return `
                    <div class="autocomplete-list-item">
                        <span class="item-value">${escapeHtml(item)}</span>
                        <div class="flex-center gap-sm">
                            <button data-action="delete-autocomplete-item" data-item-type="${type}" data-item-id="${escapeAttr(item)}" class="btn btn-delete btn-small">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = listHtml;
        } catch (error) {
            console.error(`Error rendering ${type} list:`, error);

            // Provide user-friendly error messages based on error type
            let errorMessage = `Failed to load ${type} list.`;
            if (error.message.includes('Encryption password required')) {
                errorMessage = `Failed to load ${type} list. Encryption password required.`;
            } else if (error.message.includes('password')) {
                errorMessage = `Failed to load ${type} list. Check encryption status.`;
            }

            container.innerHTML = `<div class="message-error">${errorMessage}</div>`;
        }
    }

/**
 * Sets up autocomplete functionality for tag input fields.
 * 
 * Creates a dropdown interface with suggestions that filters based on user input.
 * Supports comma-separated tag entry and prevents duplicate tag suggestions.
 * Includes click-outside handling and keyboard navigation support.
 * 
 * @param {string} inputId - ID of the input element to enhance with autocomplete
 * @param {string[]} suggestions - Array of available tag suggestions
 * @returns {void}
 * @throws {TypeError} When inputId is not a string or suggestions is not an array
 * @since 1.0.0
 * @example
 * // Setup autocomplete for dream tags
 * const tagSuggestions = ['lucid', 'nightmare', 'flying', 'recurring'];
 * setupTagAutocomplete('dreamTagsInput', tagSuggestions);
 * 
 * @example
 * // Autocomplete behavior
 * // User types "lu" -> shows "lucid" in dropdown
 * // User clicks "lucid" -> input becomes "lucid, "
 * // User types "fl" -> shows "flying" (filters out already selected)
 */
function setupTagAutocomplete(inputId, suggestions) {
        const input = document.getElementById(inputId);
        if (!input || !Array.isArray(suggestions)) return;

        // Remove existing listener to prevent duplicates
        if (input.autocompleteListener) {
            input.removeEventListener('input', input.autocompleteListener);
        }
        if (input.autocompleteDropdown) {
            input.autocompleteDropdown.remove();
        }

        // Create autocomplete dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'tag-autocomplete-dropdown';
        input.autocompleteDropdown = dropdown;

        // Position container relatively
        if (input.parentElement) {
            input.parentElement.style.position = 'relative';
            input.parentElement.appendChild(dropdown);
        }

        const listener = function() {
            const value = this.value.toLowerCase();
            const lastComma = value.lastIndexOf(',');
            const currentTag = lastComma >= 0 ? value.substring(lastComma + 1).trim() : value.trim();

            if (currentTag.length < CONSTANTS.AUTOCOMPLETE_MIN_CHARS) {
                dropdown.style.display = 'none';
                return;
            }

            const matches = suggestions.filter(suggestion => 
                suggestion.toLowerCase().includes(currentTag) &&
                !value.toLowerCase().includes(suggestion.toLowerCase())
            ).slice(0, CONSTANTS.AUTOCOMPLETE_MAX_RESULTS);

            if (matches.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            dropdown.innerHTML = matches.map(match => 
                `<div class="autocomplete-item" data-tag="${escapeAttr(match)}">
                    ${escapeHtml(match)}
                </div>`
            ).join('');

            dropdown.style.display = 'block';

            // Add click handlers
            dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', function() {
                    const tag = this.dataset.tag;
                    if (tag) {
                        const currentValue = input.value;
                        const lastComma = currentValue.lastIndexOf(',');
                        
                        if (lastComma >= 0) {
                            input.value = currentValue.substring(0, lastComma + 1) + ' ' + tag + ', ';
                        } else {
                            input.value = tag + ', ';
                        }
                        
                        dropdown.style.display = 'none';
                        input.focus();
                    }
                });
            });
        };
        
        input.autocompleteListener = listener;
        input.addEventListener('input', listener);

        // Hide dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (dropdown && !input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }


// ===================================================================================
// PIN SECURITY & ACCESS CONTROL SYSTEM
// ===================================================================================
// Unified PIN interface rendering system for various PIN operations
// Supports setup, verification, change, and removal workflows

/**
 * Renders unified PIN screen interface with configurable inputs and buttons.
 * 
 * Provides a flexible PIN interface system that can be configured for different
 * security operations including setup, verification, change, and removal workflows.
 * Generates consistent UI components with proper security attributes and auto-focus.
 * 
 * @param {Element} targetElement - DOM element to render the PIN interface into
 * @param {PinScreenConfig} config - Configuration object for the PIN interface
 * @returns {void}
 * @throws {TypeError} When targetElement is not a valid DOM element
 * @throws {TypeError} When config is missing required properties
 * @since 1.0.0
 * @example
 * // PIN setup interface
 * const container = document.getElementById('pinContainer');
 * renderPinScreen(container, {
 *   title: 'Setup PIN',
 *   icon: '🔐',
 *   message: 'Create a 4-6 digit PIN to secure your dreams.',
 *   inputs: [{
 *     id: 'newPin',
 *     type: 'password',
 *     placeholder: 'Enter new PIN',
 *     maxLength: '6'
 *   }],
 *   buttons: [{
 *     action: 'setup-pin',
 *     text: 'Create PIN',
 *     class: 'btn btn-primary'
 *   }]
 * });
 * 
 * @example
 * // PIN verification interface
 * renderPinScreen(container, {
 *   title: 'Enter PIN',
 *   inputs: [{ id: 'verifyPin', type: 'password', placeholder: 'PIN' }],
 *   buttons: [{ action: 'verify-pin', text: 'Unlock', class: 'btn btn-primary' }],
 *   feedbackContainer: true
 * });
 */

/**
 * Configuration object for PIN screen rendering.
 * 
 * @typedef {Object} PinScreenConfig
 * @property {string} title - Screen title text
 * @property {string} [icon] - Optional emoji or icon to display
 * @property {string} [message] - Optional descriptive message
 * @property {PinInputConfig[]} [inputs] - Array of input field configurations
 * @property {PinButtonConfig[]} [buttons] - Array of button configurations
 * @property {PinLinkConfig[]} [links] - Array of link configurations
 * @property {boolean} [feedbackContainer=false] - Whether to include feedback containers
 */

/**
 * Configuration for PIN input fields.
 * 
 * @typedef {Object} PinInputConfig
 * @property {string} id - Input element ID
 * @property {string} type - Input type (usually 'password' or 'text')
 * @property {string} placeholder - Placeholder text
 * @property {string} [maxLength] - Maximum input length
 * @property {string} [value] - Default value
 * @property {string} [class] - CSS classes
 */

/**
 * Configuration for PIN buttons.
 * 
 * @typedef {Object} PinButtonConfig
 * @property {string} action - Data-action attribute value
 * @property {string} text - Button display text
 * @property {string} class - CSS classes
 * @property {string} [id] - Button element ID
 */

/**
 * Configuration for PIN links.
 * 
 * @typedef {Object} PinLinkConfig
 * @property {string} action - Data-action attribute value
 * @property {string} text - Link display text
 * @property {string} [id] - Link element ID
 * @property {string} [style] - Inline CSS styles
 */
function renderPinScreen(targetElement, config) {
        if (!targetElement || !config) return;

        let inputsHTML = '';
        if (config.inputs) {
            inputsHTML = config.inputs.map(input => {
                const valueAttr = input.value ? `value="${escapeAttr(input.value)}"` : '';
                const inputClass = input.class || 'form-control';
                return `<input
                    type="${input.type}"
                    id="${input.id}"
                    class="${inputClass}"
                    placeholder="${escapeAttr(input.placeholder)}"
                    ${input.maxLength ? `maxlength="${input.maxLength}"` : ''}
                    ${valueAttr}
                    style="margin-bottom: 10px;"
                >`;
            }).join('');
        }

        let buttonsHTML = '';
        if (config.buttons) {
            buttonsHTML = config.buttons.map(button => `
                <button
                    data-action="${button.action}"
                    class="btn ${button.class}"
                    ${button.id ? `id="${button.id}"` : ''}
                >
                    ${escapeHtml(button.text)}
                </button>
            `).join('');
        }

        let linksHTML = '';
        if (config.links) {
            linksHTML = config.links.map(link => `
                <span
                    data-action="${link.action}"
                    class="pin-setup-link"
                    ${link.id ? `id="${link.id}"` : ''}
                    style="${link.style || ''}"
                >
                    ${escapeHtml(link.text)}
                </span>
            `).join('');
        }

        const iconHTML = config.icon ? `<div class="text-4xl mb-lg">${config.icon}</div>` : '';
        const messageHTML = config.message ? `<p id="pinMessage" class="text-secondary mb-lg line-height-relaxed">${config.message}</p>` : '';
        const feedbackHTML = config.feedbackContainer ? `<div id="pinFeedback" class="notification-message"></div><div id="pinSuccess" class="notification-message"></div><div id="pinInfo" class="notification-message"></div>` : '';

        targetElement.innerHTML = `
            ${iconHTML}
            <h2 id="pinTitle" class="text-primary mb-md text-xl">${escapeHtml(config.title)}</h2>
            ${messageHTML}
            <div id="pinInputsContainer">${inputsHTML}</div>
            <div class="pin-buttons">
                ${buttonsHTML}
            </div>
            <div id="pinLinksContainer" style="margin-top: 15px;">${linksHTML}</div>
            ${feedbackHTML}
        `;

        // Auto-focus the first input if it exists
        if (config.inputs && config.inputs.length > 0) {
            setTimeout(() => {
                const firstInput = document.getElementById(config.inputs[0].id);
                if (firstInput) {
                    firstInput.focus();
                }
            }, CONSTANTS.FOCUS_DELAY_MS);
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

// ===================================================================================
// TIP DISPLAY & NAVIGATION SYSTEM
// ===================================================================================

/**
 * Displays a tip at the specified index with safe bounds checking.
 * 
 * Updates both the tip content display and counter information in the advice tab.
 * Uses modulo arithmetic to handle negative indices and out-of-bounds values safely,
 * so invalid input does not throw.
 * 
 * @async
 * @param {number} index - Tip index to display (can be negative or out of bounds)
 * @returns {Promise<void>} Promise that resolves when tip is displayed
 * @throws {TypeError} When index is not a number
 * @throws {Error} When tip loading fails
 * @since 1.0.0
 * @example
 * // Display first tip
 * displayTip(0);
 * 
 * @example
 * // Negative index wraps to end
 * displayTip(-1); // Shows last tip
 * 
 * @example
 * // Out of bounds index wraps around
 * displayTip(1000); // Shows tip at (1000 % totalTips)
 */
async function displayTip(index) {
    try {
        // Get total tips count for bounds checking
        const totalTips = await getTipsCount();

        if (totalTips === 0) {
            console.warn('No tips available for display');
            return;
        }

        // Ensure index is within bounds and handle negative numbers using modulo arithmetic
        const safeIndex = ((index % totalTips) + totalTips) % totalTips;

        // Use the lazy loading display function
        await displayTipLazy(safeIndex, totalTips);

    } catch (error) {
        console.error('Error displaying tip:', error);

        // Show error message to user
        const tipTextElement = document.getElementById('tipText');
        if (tipTextElement) {
            tipTextElement.innerHTML = `
                <div class="text-center">
                    <h4 class="text-primary mb-md">Tip Temporarily Unavailable</h4>
                    <p class="text-secondary">There was an error loading this tip. Please try again.</p>
                </div>
            `;
        }
    }
}

/**
 * Handles tip navigation in the specified direction.
 * 
 * Provides navigation controls for the daily tips system, supporting both forward
 * and backward navigation with automatic bounds handling via the displayTip function.
 * 
 * @async
 * @param {('next'|'prev')} direction - Navigation direction
 * @returns {Promise<void>} Promise that resolves when navigation is complete
 * @throws {TypeError} When direction is not 'next' or 'prev'
 * @throws {Error} When tip loading fails during navigation
 * @since 1.0.0
 * @example
 * // Navigate to next tip
 * handleTipNavigation('next');
 * 
 * @example
 * // Navigate to previous tip
 * handleTipNavigation('prev');
 */
async function handleTipNavigation(direction) {
    let newIndex = getCurrentTipIndex();
    if (direction === 'next') {
        newIndex++;
    } else {
        newIndex--;
    }
    await displayTip(newIndex); // displayTip handles bounds checking
}

// ===================================================================================
// GOALS UI GENERATION UTILITIES
// ===================================================================================

/**
 * Gets human-readable label for goal type for display purposes.
 * 
 * This function maps goal type enum values to user-friendly display labels
 * that are shown in the progress section of goal cards.
 * 
 * @function getGoalTypeLabel
 * @param {string} type - Goal type to get label for ('lucid_count', 'recall_streak', etc.)
 * @returns {string} Human-readable label for the goal type
 * @since 2.02.47
 * @example
 * const label = getGoalTypeLabel('lucid_count');
 * console.log(label); // "lucid dreams"
 * 
 * @example
 * const streakLabel = getGoalTypeLabel('recall_streak');
 * console.log(streakLabel); // "day streak"
 */
function getGoalTypeLabel(type) {
    const labels = {
        'lucid_count': 'lucid dreams',
        'recall_streak': 'day streak',
        'journal_streak': 'day streak',
        'dream_signs_count': 'dream signs',
        'custom': ''
    };
    return labels[type] || '';
}

/**
 * Creates complete HTML element for goal display with progress bars and action buttons.
 * 
 * This function generates a comprehensive goal card UI element including title, description,
 * progress visualization, action buttons, and metadata. It handles both active and completed
 * goal states with different UI configurations.
 * 
 * @function createGoalElement
 * @param {Object} goal - Goal object to create element for
 * @param {Object} progress - Calculated progress data with current and message properties
 * @param {boolean} [isCompleted=false] - Whether goal is in completed state
 * @returns {HTMLElement} Complete DOM element for goal display
 * @since 2.02.47
 * @example
 * const goal = { id: '123', title: 'Lucid Dreams', type: 'lucid_count', target: 5 };
 * const progress = { current: 3, message: '3 lucid dreams this month' };
 * const element = createGoalElement(goal, progress, false);
 * document.getElementById('container').appendChild(element);
 * 
 * @example
 * // Create completed goal element
 * const completedElement = createGoalElement(goal, progress, true);
 */
function createGoalElement(goal, progress, isCompleted = false) {
    const goalDiv = document.createElement('div');
    goalDiv.className = `card-md goal-card mb-md ${isCompleted ? 'completed' : ''}`;
    goalDiv.id = `goal-${goal.id}`;
    
    const progressPercent = Math.min((progress.current / goal.target) * 100, 100);
    const statusClass = progressPercent === 100 ? 'success' : progressPercent >= 50 ? 'warning' : 'primary';
    
    goalDiv.innerHTML = `
        <div class="flex-between mb-md">
            <h4>${escapeHtml(goal.icon)} ${escapeHtml(goal.title)}</h4>
            <div class="goal-actions">
                ${!isCompleted ? `
                    <button data-action="edit-goal" data-goal-id="${escapeAttr(goal.id)}" class="btn btn-outline btn-small">Edit</button>
                    <button data-action="complete-goal" data-goal-id="${escapeAttr(goal.id)}" class="btn btn-success btn-small">Complete</button>
                ` : `
                    <button data-action="reactivate-goal" data-goal-id="${escapeAttr(goal.id)}" class="btn btn-warning btn-small">Reactivate</button>
                `}
                <button data-action="delete-goal" data-goal-id="${escapeAttr(goal.id)}" class="btn btn-error btn-small">Delete</button>
            </div>
        </div>
        <p class="text-secondary mb-md">${escapeHtml(goal.description)}</p>
        <div class="goal-progress-section">
            <div class="flex-between mb-sm">
                <span class="font-semibold">Progress:</span>
                <span class="status-${statusClass}">${progress.current} / ${goal.target} ${getGoalTypeLabel(goal.type)}</span>
            </div>
            <div class="progress-bar" 
                 role="progressbar" 
                 aria-valuenow="${progress.current}" 
                 aria-valuemin="0" 
                 aria-valuemax="${goal.target}"
                 aria-label="Goal progress: ${progress.current} of ${goal.target} ${getGoalTypeLabel(goal.type)}">
                <div class="progress-fill progress-${statusClass}" style="width: ${progressPercent}%;"></div>
            </div>
            ${progress.message ? `<p class="text-secondary text-sm mt-sm">${progress.message}</p>` : ''}
            ${goal.type === 'custom' && !isCompleted ? `
                <div class="custom-goal-controls mt-md">
                    <div class="flex-center gap-md">
                        <button data-action="decrease-goal-progress" data-goal-id="${escapeAttr(goal.id)}" class="btn btn-outline btn-small" ${progress.current <= 0 ? 'disabled' : ''}>➖</button>
                        <span class="font-semibold">Manual Tracking</span>
                        <button data-action="increase-goal-progress" data-goal-id="${escapeAttr(goal.id)}" class="btn btn-outline btn-small">➕</button>
                    </div>
                </div>
            ` : ''}
        </div>
        <div class="flex-between text-sm text-secondary">
            <div>
                <span>Created: ${formatDisplayDate(goal.createdAt)}</span>
                ${isCompleted && goal.completedAt ? `<br><span>Completed: ${formatDisplayDate(goal.completedAt)}</span>` : ''}
            </div>
            <span>${goal.period === 'monthly' ? 'Monthly Goal' : goal.period === 'streak' ? 'Streak Goal' : 'Total Goal'}</span>
        </div>
    `;
    
    return goalDiv;
}

/**
 * Creates and displays a reusable information tooltip with custom content.
 *
 * This is a generic tooltip system that can be used throughout the application
 * to display contextual help, explanations, or additional information. The tooltip
 * automatically positions itself to stay within viewport bounds and includes
 * smart mobile/desktop responsive behavior.
 *
 * @function showInfoTooltip
 * @param {Object} config - Tooltip configuration object
 * @param {string} config.triggerId - ID of the element that triggered the tooltip (for positioning)
 * @param {string} config.tooltipId - Unique ID for the tooltip element
 * @param {string} config.title - Tooltip title/heading text
 * @param {string} config.content - Main tooltip content (HTML allowed)
 * @param {string} [config.closeAction='close-tooltip'] - Data-action for close button
 * @param {string} [config.closeText='Got it!'] - Text for close button
 * @param {number} [config.autoCloseMs=10000] - Auto-close timeout in milliseconds
 * @param {string} [config.className='info-tooltip'] - Additional CSS class name
 * @returns {void}
 * @since 2.04.38
 *
 * @example
 * // Basic usage with custom content
 * showInfoTooltip({
 *     triggerId: 'help-icon',
 *     tooltipId: 'feature-help-tooltip',
 *     title: 'Feature Help',
 *     content: '<p>This feature helps you...</p>'
 * });
 *
 * @example
 * // Advanced usage with custom options
 * showInfoTooltip({
 *     triggerId: 'export-info-icon',
 *     tooltipId: 'export-help',
 *     title: 'Export Options',
 *     content: `<div class="options">
 *         <div class="option"><strong>Option 1:</strong> Description</div>
 *         <div class="option"><strong>Option 2:</strong> Description</div>
 *     </div>`,
 *     closeAction: 'close-export-help',
 *     closeText: 'Close',
 *     autoCloseMs: 15000,
 *     className: 'export-tooltip'
 * });
 */
function showInfoTooltip(config) {
    const {
        triggerId,
        tooltipId,
        title,
        content,
        closeAction = 'close-tooltip',
        closeText = 'Got it!',
        autoCloseMs = 30000,
        className = 'info-tooltip'
    } = config;

    // Remove any existing tooltip with the same ID
    const existingTooltip = document.getElementById(tooltipId);
    if (existingTooltip) {
        existingTooltip.remove();
    }

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.id = tooltipId;
    tooltip.className = `export-info-tooltip ${className}`;
    tooltip.innerHTML = `
        <div class="tooltip-content">
            <h4>${title}</h4>
            <div class="tooltip-body">
                ${content}
            </div>
            <div class="tooltip-footer">
                <button data-action="${closeAction}" class="btn btn-secondary btn-small">${closeText}</button>
            </div>
        </div>
    `;

    // Add ARIA attributes for accessibility
    tooltip.setAttribute('role', 'dialog');
    tooltip.setAttribute('aria-labelledby', `${tooltipId}-title`);
    tooltip.setAttribute('aria-describedby', `${tooltipId}-content`);

    // Position tooltip like a context menu - anchored to the trigger element
    const triggerElement = document.getElementById(triggerId) || document.querySelector(`[data-action="${triggerId}"]`);

    // Add tooltip to DOM first (invisible) so we can measure its actual dimensions
    tooltip.style.visibility = 'hidden';
    tooltip.style.position = 'fixed';
    tooltip.style.top = '0px';
    tooltip.style.left = '0px';
    document.body.appendChild(tooltip);

    if (triggerElement) {
        const rect = triggerElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const actualTooltipRect = tooltip.getBoundingClientRect();
        const actualHeight = actualTooltipRect.height;
        const actualWidth = actualTooltipRect.width;
        const tooltipWidth = Math.min(actualWidth, Math.min(400, viewportWidth - 20));

        // Context menu style positioning: decide above or below based on available space and actual height
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        // Use larger buffer for desktop to account for browser chrome and scrollbars
        const positionBuffer = viewportWidth > 768 ? 130 : 120;
        const showAbove = spaceBelow < actualHeight + positionBuffer && spaceAbove >= actualHeight + positionBuffer;

        let topPosition;
        if (showAbove) {
            // Position above: bottom of tooltip near the icon
            topPosition = Math.max(10, rect.top - actualHeight - 5);
        } else {
            // Position below: top of tooltip near the icon
            topPosition = rect.bottom + 5;
            // If it would go off bottom, move up as much as needed
            const bottomBuffer = viewportWidth > 768 ? 130 : 110;
            if (topPosition + actualHeight > viewportHeight - bottomBuffer) {
                // Use larger buffer for desktop to account for browser chrome
                topPosition = Math.max(110, viewportHeight - actualHeight - bottomBuffer);
            }
        }

        // Horizontal positioning: anchor to icon like a context menu
        let leftPosition;
        if (viewportWidth <= 480) {
            // Mobile: Full width with margins
            leftPosition = 10;
            tooltip.style.right = '10px';
            tooltip.style.width = 'auto';
        } else {
            // Desktop: Context menu style - right edge of tooltip near icon
            // Try to position so the tooltip's right edge is near the icon
            leftPosition = rect.left - tooltipWidth + rect.width + 5;

            // If that puts it off the left edge, position it to the right of the icon instead
            if (leftPosition < 10) {
                leftPosition = rect.right + 5;
                // If that puts it off the right edge, use maximum left position
                if (leftPosition + tooltipWidth > viewportWidth - 10) {
                    leftPosition = viewportWidth - tooltipWidth - 10;
                }
            }

            // Final bounds check
            leftPosition = Math.max(10, Math.min(leftPosition, viewportWidth - tooltipWidth - 10));
            tooltip.style.width = tooltipWidth + 'px';
        }

        // Apply final positioning and make visible
        tooltip.style.top = topPosition + 'px';
        tooltip.style.left = leftPosition + 'px';
        tooltip.style.visibility = 'visible';
    }

    // Focus on the close button for keyboard navigation
    const closeButton = tooltip.querySelector(`[data-action="${closeAction}"]`);
    if (closeButton) {
        closeButton.focus();
    }

    // Auto-close after specified time or on outside click
    const autoCloseTimeout = setTimeout(() => {
        if (document.getElementById(tooltipId)) {
            tooltip.remove();
        }
    }, autoCloseMs);

    // Close on outside click
    const handleOutsideClick = (event) => {
        if (!tooltip.contains(event.target) && !triggerElement.contains(event.target)) {
            clearTimeout(autoCloseTimeout);
            tooltip.remove();
            document.removeEventListener('click', handleOutsideClick);
        }
    };

    // Delay adding the outside click listener to prevent immediate closure
    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
    }, 100);
}

/**
 * Shows export format information tooltip for Export Range functionality.
 *
 * This function is a convenience wrapper around showInfoTooltip() specifically
 * for the Export Range feature. It displays information about the two export
 * format options available when using the Export Range button.
 *
 * @function showExportFormatInfo
 * @returns {void}
 * @since 2.04.36
 *
 * @example
 * // Called via action delegation system
 * // data-action="show-export-info"
 * showExportFormatInfo();
 */
function showExportFormatInfo() {
    showInfoTooltip({
        triggerId: 'show-export-info',
        tooltipId: 'export-info-tooltip',
        title: 'Export Range Formats',
        content: `
            <div class="format-explanation">
                <div class="format-option">
                    <strong>🔲 Unchecked (Simple Export):</strong>
                    <p>Exports dreams in clean text format with title, date, type, content, emotions, tags, and dream signs. Perfect for personal reading or simple analysis.</p>
                </div>
                <div class="format-option">
                    <strong>☑️ Checked (AI Analysis):</strong>
                    <p>Exports dreams with comprehensive AI analysis prompt including statistics and detailed instructions for pattern recognition. Ready to paste into AI tools like ChatGPT or Claude.</p>
                </div>
            </div>
        `,
        closeAction: 'close-export-info',
        closeText: 'Got it!',
        autoCloseMs: 10000,
        className: 'export-tooltip'
    });
}

/**
 * Closes any information tooltip by ID.
 *
 * This is a generic function to close tooltips created by showInfoTooltip().
 * Can be used to close specific tooltips or as a general close handler.
 *
 * @function closeInfoTooltip
 * @param {string} [tooltipId] - ID of specific tooltip to close. If not provided, closes common tooltip IDs
 * @returns {void}
 * @since 2.04.38
 *
 * @example
 * // Close specific tooltip
 * closeInfoTooltip('my-tooltip-id');
 *
 * @example
 * // Close common tooltips (export, help, etc.)
 * closeInfoTooltip();
 */
function closeInfoTooltip(tooltipId = null) {
    if (tooltipId) {
        const tooltip = document.getElementById(tooltipId);
        if (tooltip) {
            tooltip.remove();
        }
    } else {
        // Close common tooltip IDs if no specific ID provided
        const commonTooltipIds = ['export-info-tooltip', 'help-tooltip', 'info-tooltip'];
        commonTooltipIds.forEach(id => {
            const tooltip = document.getElementById(id);
            if (tooltip) {
                tooltip.remove();
            }
        });
    }
}

/**
 * Closes the export format information tooltip.
 *
 * This function is a specific wrapper for closing the export format tooltip.
 * Maintained for backward compatibility with existing action delegation.
 *
 * @function closeExportFormatInfo
 * @returns {void}
 * @since 2.04.36
 *
 * @example
 * // Called via action delegation system
 * // data-action="close-export-info"
 * closeExportFormatInfo();
 */
function closeExportFormatInfo() {
    closeInfoTooltip('export-info-tooltip');
}

/**
 * Shows emotions field help tooltip with common emotion examples.
 *
 * Displays a helpful tooltip with common emotions that users can experience
 * in dreams, providing examples to help with dream journaling.
 *
 * @function showEmotionsHelp
 * @returns {void}
 * @since 2.04.39
 *
 * @example
 * // Called via action delegation system
 * // data-action="show-emotions-help"
 * showEmotionsHelp();
 */
function showEmotionsHelp() {
    showInfoTooltip({
        triggerId: 'show-emotions-help',
        tooltipId: 'emotions-help-tooltip',
        title: 'Common Dream Emotions',
        content: `
            <div class="help-content">
                <p>Dreams often contain intense emotions. Here are common ones to help you identify and track emotional patterns:</p>
                <div class="emotion-categories">
                    <div class="emotion-group">
                        <strong>Positive:</strong> happy, joyful, excited, peaceful, curious, amazed, loved, confident
                    </div>
                    <div class="emotion-group">
                        <strong>Negative:</strong> anxious, scared, angry, sad, confused, frustrated, guilty, embarrassed
                    </div>
                    <div class="emotion-group">
                        <strong>Neutral:</strong> calm, surprised, nostalgic, focused, detached, observant
                    </div>
                </div>
                <p><small><em>Tip: You can enter multiple emotions separated by commas</em></small></p>
            </div>
        `,
        closeAction: 'close-emotions-help',
        closeText: 'Got it!',
        autoCloseMs: 12000,
        className: 'form-help-tooltip'
    });
}

/**
 * Shows tags field help tooltip with tagging guidance.
 *
 * Displays helpful information about how to tag dreams effectively
 * for better organization and searchability.
 *
 * @function showTagsHelp
 * @returns {void}
 * @since 2.04.39
 *
 * @example
 * // Called via action delegation system
 * // data-action="show-tags-help"
 * showTagsHelp();
 */
function showTagsHelp() {
    showInfoTooltip({
        triggerId: 'show-tags-help',
        tooltipId: 'tags-help-tooltip',
        title: 'Dream Tagging Guide',
        content: `
            <div class="help-content">
                <p>Tags help you organize and search your dreams. Consider including:</p>
                <div class="tag-categories">
                    <div class="tag-group">
                        <strong>🏠 Places:</strong> home, school, work, beach, forest, city, unknown-place
                    </div>
                    <div class="tag-group">
                        <strong>👥 People:</strong> family, friends, strangers, celebrities, childhood-friends
                    </div>
                    <div class="tag-group">
                        <strong>🎭 Themes:</strong> flying, falling, chasing, lost, exam, travel, adventure
                    </div>
                    <div class="tag-group">
                        <strong>🐕 Objects/Animals:</strong> car, phone, animals, water, fire, technology
                    </div>
                </div>
                <p><small><em>Tip: Use simple, consistent tags separated by commas for easy searching</em></small></p>
            </div>
        `,
        closeAction: 'close-tags-help',
        closeText: 'Got it!',
        autoCloseMs: 15000,
        className: 'form-help-tooltip'
    });
}

/**
 * Shows dream signs field help tooltip with lucidity trigger explanation.
 *
 * Explains what dream signs are and how to use them to improve
 * lucid dreaming practice and dream awareness.
 *
 * @function showDreamSignsHelp
 * @returns {void}
 * @since 2.04.39
 *
 * @example
 * // Called via action delegation system
 * // data-action="show-dream-signs-help"
 * showDreamSignsHelp();
 */
function showDreamSignsHelp() {
    showInfoTooltip({
        triggerId: 'show-dream-signs-help',
        tooltipId: 'dream-signs-help-tooltip',
        title: '⚡ Dream Signs Explained',
        content: `
            <div class="help-content">
                <p><strong>Dream signs are recurring elements that can trigger lucidity!</strong></p>
                <p>Track these patterns to improve dream awareness and increase your chances of becoming lucid:</p>
                <div class="dream-signs-categories">
                    <div class="signs-group">
                        <strong>🔄 Common Signs:</strong> flying, impossible architecture, dead people alive, broken technology, weird text/numbers
                    </div>
                    <div class="signs-group">
                        <strong>🎯 Personal Signs:</strong> specific locations from your past, recurring dream characters, familiar impossible scenarios
                    </div>
                    <div class="signs-group">
                        <strong>💡 Reality Check Triggers:</strong> mirrors, clocks, light switches, hands, reading text
                    </div>
                </div>
                <p><small><em>Tip: Review your dream signs regularly to recognize patterns and improve lucid dreaming!</em></small></p>
            </div>
        `,
        closeAction: 'close-dream-signs-help',
        closeText: 'Got it!',
        autoCloseMs: 15000,
        className: 'form-help-tooltip'
    });
}

/**
 * Shows smart search help tooltip with advanced search syntax explanation.
 *
 * Displays comprehensive help for the smart search feature, explaining field-specific
 * search prefixes and providing examples of advanced search queries. This helps users
 * discover and effectively use the smart search functionality for precise dream filtering.
 *
 * @function showSmartSearchHelp
 * @returns {void}
 * @since 2.04.01
 *
 * @example
 * // Called via action delegation system
 * // data-action="show-smart-search-help"
 * showSmartSearchHelp();
 */
function showSmartSearchHelp() {
    showInfoTooltip({
        triggerId: 'show-smart-search-help',
        tooltipId: 'smart-search-help-tooltip',
        title: '🔍 Smart Search Guide',
        content: `
            <div class="help-content">
                <p><strong>Use field-specific prefixes to search precisely!</strong></p>
                <div class="smart-search-examples">
                    <div class="search-group">
                        <strong>📝 Field Prefixes:</strong>
                        <ul>
                            <li><code>title:</code> - Search only in dream titles</li>
                            <li><code>content:</code> - Search only in dream descriptions</li>
                            <li><code>emotion:</code> - Search only in emotions field</li>
                            <li><code>tag:</code> - Search only in tags</li>
                            <li><code>sign:</code> - Search only in dream signs</li>
                        </ul>
                    </div>
                    <div class="search-group">
                        <strong>💡 Examples:</strong>
                        <ul>
                            <li><code>title:flying</code> - Dreams with "flying" in title</li>
                            <li><code>tag:lucid emotion:happy</code> - Lucid dreams with happy emotions</li>
                            <li><code>content:nightmare family</code> - Dreams with "nightmare" in content OR "family" anywhere</li>
                            <li><code>title:"vacation dream"</code> - Use quotes for phrases with spaces</li>
                        </ul>
                    </div>
                    <div class="search-group">
                        <strong>🚀 Pro Tips:</strong>
                        <ul>
                            <li>Mix field searches with general terms</li>
                            <li>Multiple field searches work together (AND logic)</li>
                            <li>No prefix = search all fields (backward compatible)</li>
                            <li>Case-insensitive matching for all searches</li>
                        </ul>
                    </div>
                </div>
                <p><small><em>Smart search makes finding specific dreams fast and precise!</em></small></p>
            </div>
        `,
        closeAction: 'close-smart-search-help',
        closeText: 'Got it!',
        autoCloseMs: 20000,
        className: 'form-help-tooltip smart-search-tooltip'
    });
}

// ===================================================================================
// MODULE EXPORTS
// ===================================================================================

// Export all functions for ES module compatibility
export {
    // Button & Action Element Creation
    createActionButton,
    
    // Message & Notification System
    announceLiveMessage,
    createInlineMessage,
    
    // Display & Layout Helpers
    createMetaDisplay,
    createPaginationHTML,
    
    // Utility Functions
    escapeHtml,
    escapeAttr,
    
    // Theme Management
    getCurrentTheme,
    storeTheme,
    applyTheme,
    switchTheme,

    // Pagination Preference Management
    getCurrentPaginationPreference,
    storePaginationPreference,
    
    // Tab Management
    switchAppTab,
    switchVoiceTab,
    hideAllTabButtons,
    showAllTabButtons,
    
    // UI State Management
    syncSettingsDisplay,
    updateBrowserCompatibilityDisplay,
    toggleDreamForm,
    toggleSettingsSection,
    toggleGoalsSection,
    toggleAdviceSection,
    toggleJournalSection,

    // Search & Loading States
    showSearchLoading,
    hideSearchLoading,
    
    // Autocomplete System
    initializeAutocomplete,
    setupLazySecureAutocomplete,
    setupTagAutocomplete,
    renderAutocompleteManagementList,
    
    
    // Tips System
    displayTip,
    handleTipNavigation,
    
    // Date and Chart Utilities
    setDateFilter,
    formatDateKey,
    formatDisplayDate,
    formatDateTimeDisplay,
    createPieChartColors,
    createPieChartHTML,
    
    // Goals UI Utilities
    getGoalTypeLabel,
    createGoalElement,
    
    // Security UI
    renderPinScreen,

    // Tooltip System (Reusable)
    showInfoTooltip,
    closeInfoTooltip,

    // Export Info System (Specific)
    showExportFormatInfo,
    closeExportFormatInfo,

    // Dream Form Help System
    showEmotionsHelp,
    showTagsHelp,
    showDreamSignsHelp,
    showSmartSearchHelp
};

// Functions are now properly exported as ES modules for clean dependency management

