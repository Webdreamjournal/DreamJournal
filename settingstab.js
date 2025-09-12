/**
 * @fileoverview Settings Tab Module - Dedicated handler for application settings interface
 * 
 * This module manages all settings tab functionality including:
 * - Settings UI generation and layout  
 * - Theme management interface
 * - Security settings (PIN setup interface)
 * - Data management (export/import UI)
 * - Autocomplete management interface
 * - PWA installation interface
 * - Settings synchronization across UI contexts
 * 
 * The settings tab acts as the central configuration hub for the Dream Journal application,
 * providing users with access to appearance preferences, security options, data management
 * tools, and customization features. This module coordinates with other modules to present
 * a unified settings experience while maintaining clean separation of concerns.
 * 
 * **Module Dependencies:**
 * - constants.js: Configuration constants and settings defaults
 * - state.js: Global application state (theme, security status, etc.)  
 * - dom-helpers.js: Core DOM utilities and theme functions
 * - security.js: PIN setup and security functionality
 * - storage.js: Autocomplete data management functions
 * - import-export.js: Data export/import functionality (functions only)
 * - pwa.js: Progressive Web App installation features
 * 
 * **Key Features:**
 * - Dynamic settings interface generation
 * - Real-time settings synchronization
 * - Integrated export/import controls
 * - Autocomplete data management
 * - Browser compatibility detection
 * - PWA installation integration
 * 
 * @module settingstab  
 * @version 2.02.05
 * @since 2.02.05
 * @author Dream Journal Application
 */

// ================================
// MODULE INITIALIZATION CHECK
// ================================
if (typeof window === 'undefined') {
    throw new Error('settingstab.js must be loaded in a browser environment');
}

// ================================
// ES MODULE IMPORTS
// ================================

// Import required dependencies
import { CONSTANTS } from './constants.js';
import { 
    getAutocompleteSuggestions,
    saveItemToStore,
    loadItemFromStore,
    storageType 
} from './storage.js';
import { activeAppTab, isAppLocked, isUnlocked } from './state.js';
import { isPinSetup } from './security.js';
import { getVoiceCapabilities } from './voice-notes.js';

// Note: To avoid circular dependencies with dom-helpers.js (which imports this module),
// we access some functions through the global scope rather than importing them directly.
// These functions are available globally: getCurrentTheme, switchTheme, createInlineMessage, 
// escapeHtml, escapeAttr, updateSecurityControls

console.log('Loading Settings Tab Module v2.02.05');

// ================================
// SETTINGS TAB UI GENERATION
// ================================

/**
 * Renders the complete settings tab interface with all sections and controls.
 * 
 * This function generates the entire settings tab HTML structure including:
 * - Appearance section (theme selector)
 * - Security section (PIN setup controls)
 * - Data management section (export/import controls) 
 * - Autocomplete management section (tags and dream signs)
 * 
 * The function dynamically determines current theme settings to pre-select
 * the appropriate theme option and builds a comprehensive settings interface
 * that integrates with the existing action routing system.
 * 
 * **HTML Structure Generated:**
 * ```html
 * <div class="settings-section">...</div>  <!-- Appearance -->
 * <div class="settings-section">...</div>  <!-- Security -->
 * <div class="settings-section">...</div>  <!-- Data Management -->
 * <div class="settings-section">...</div>  <!-- Autocomplete -->
 * ```
 * 
 * **Integration Points:**
 * - Uses data-action attributes for event routing via action-router.js
 * - References DOM elements by ID for settings synchronization
 * - Coordinates with theme system via getCurrentTheme()
 * 
 * @param {HTMLElement} tabPanel - The target container element for the settings interface
 * @returns {void}
 * 
 * @example
 * const settingsContainer = document.getElementById('settingsTab');
 * renderSettingsTab(settingsContainer);
 * // Settings interface is now populated with all controls
 * 
 * @since 2.02.05
 */
function renderSettingsTab(tabPanel) {
    // Get current theme to set correct option as selected
    const currentTheme = (typeof getCurrentTheme === 'function') ? getCurrentTheme() : 'light';
    const lightSelected = currentTheme === 'light' ? 'selected' : '';
    const darkSelected = currentTheme === 'dark' ? 'selected' : '';
    
    tabPanel.innerHTML = `
        <div class="settings-section">
            <h3>🎨 Appearance</h3>
            <div class="settings-row">
                <div>
                    <div class="settings-label">Theme</div>
                    <div class="settings-description">Choose your preferred color theme</div>
                </div>
                <div class="settings-controls">
                    <select id="themeSelect" class="filter-select" style="min-width: 120px;">
                        <option value="light" ${lightSelected}>🌞 Light</option>
                        <option value="dark" ${darkSelected}>🌙 Dark</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="settings-section">
            <h3>🔐 Security</h3>
            <div class="settings-row">
                <div>
                    <div class="settings-label">PIN Protection</div>
                    <div class="settings-description">Secure your dreams with a PIN code</div>
                </div>
                <div class="settings-controls">
                    <button data-action="setup-pin" id="setupPinBtnSettings" class="btn btn-secondary">⚙️ Setup PIN</button>
                </div>
            </div>
        </div>
        <div class="settings-section">
            <h3>💾 Data Management</h3>
            
            <!-- Dreams Only Export/Import -->
            <div class="settings-row">
                <div>
                    <div class="settings-label">Dreams Export/Import</div>
                    <div class="settings-description">Export or import your dreams as text files</div>
                </div>
                <div class="settings-controls export-import-controls">
                    <button data-action="export-dreams" class="btn btn-secondary">Export Dreams</button>
                    <button data-action="import-dreams" class="btn btn-secondary">Import Dreams</button>
                    <div class="encryption-option flex-center gap-sm">
                        <input type="checkbox" id="encryptionEnabled" class="form-checkbox">
                        <label for="encryptionEnabled" class="form-label-inline text-primary">🔐 Password Protected</label>
                    </div>
                </div>
            </div>
            
            <!-- Complete Data Export/Import -->
            <div class="settings-row">
                <div>
                    <div class="settings-label">Complete Data Export/Import</div>
                    <div class="settings-description">Export or import restorable data (dreams, goals, settings) as a JSON file. <br> Voice notes excluded.</div>
                </div>
                <div class="settings-controls export-import-controls">
                    <button data-action="export-all-data" class="btn btn-primary">Export All Data</button>
                    <button data-action="import-all-data" class="btn btn-primary">Import All Data</button>
                    <div class="encryption-option flex-center gap-sm">
                        <input type="checkbox" id="fullDataEncryption" class="form-checkbox">
                        <label for="fullDataEncryption" class="form-label-inline text-primary">🔐 Password Protected</label>
                    </div>
                </div>
            </div>
            
            <!-- AI Analysis Export -->
            <div class="settings-row">
                <div>
                    <div class="settings-label">AI Analysis Export</div>
                    <div class="settings-description">Export a prompt for analysis by an AI model</div>
                </div>
                <div class="settings-controls">
                    <button data-action="export-ai" class="btn btn-success">Export for AI Analysis</button>
                </div>
            </div>
        </div>
        <div class="settings-section">
            <h3>🏷️ Autocomplete Management</h3>
            <p class="settings-description" style="margin-bottom: 20px;">Manage the suggestions that appear when you type tags and dream signs. Add your own items, or delete any you don't use.</p>
            
            <div class="settings-row">
                <div>
                    <div class="settings-label">Tags & Themes</div>
                    <div class="settings-description">Add a new custom tag or theme.</div>
                </div>
                <div style="flex: 1; min-width: 300px; max-width: 400px;">
                    <div id="tagsManagementList" class="autocomplete-management-list">
                        <div class="loading-state">Loading tags...</div>
                    </div>
                    <div class="form-group mt-sm" style="display: flex; justify-content: flex-end;">
                        <div class="flex-center gap-sm" style="width: 100%; max-width: 300px;">
                            <input type="text" id="newTagInput" class="form-control" placeholder="e.g., recurring-nightmare">
                            <button data-action="add-custom-tag" class="btn btn-primary btn-small">Add</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="settings-row">
                <div>
                    <div class="settings-label">⚡ Dream Signs</div>
                    <div class="settings-description">Add a new custom dream sign.</div>
                </div>
                <div style="flex: 1; min-width: 300px; max-width: 400px;">
                    <div id="dreamSignsManagementList" class="autocomplete-management-list">
                        <div class="loading-state">Loading dream signs...</div>
                    </div>
                    <div class="form-group mt-sm" style="display: flex; justify-content: flex-end;">
                        <div class="flex-center gap-sm" style="width: 100%; max-width: 300px;">
                            <input type="text" id="newDreamSignInput" class="form-control" placeholder="e.g., extra-fingers">
                            <button data-action="add-custom-dream-sign" class="btn btn-primary btn-small">Add</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ================================
// SETTINGS SYNCHRONIZATION SYSTEM
// ================================

/**
 * Synchronizes settings display elements across different UI contexts.
 * 
 * Ensures consistency between various settings interfaces throughout the application,
 * including PIN buttons, theme selectors, and encryption checkboxes. Called whenever
 * the settings interface needs to reflect the current application state.
 * 
 * **Key Responsibilities:**
 * - PIN button state synchronization based on setup status and lock state
 * - Theme selector value updates to match current theme
 * - Storage type and status display updates
 * 
 * @example
 * // Called when switching to settings tab
 * syncSettingsDisplay();
 * // Updates all settings controls to reflect current state
 * 
 * @example
 * // Called after PIN setup changes
 * syncSettingsDisplay();
 * 
 * @since 2.02.05
 */
function syncSettingsDisplay() {
        // Sync PIN buttons
        const setupBtnSettings = document.getElementById('setupPinBtnSettings');
        const lockBtnSettings = document.getElementById('lockBtnSettings');
        
        if (setupBtnSettings && lockBtnSettings) {
            if (isPinSetup()) {
                if (isUnlocked) {
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
            const currentTheme = (typeof getCurrentTheme === 'function') ? getCurrentTheme() : 'light';
            themeSelect.value = currentTheme;
            
            // Double-check the value was set correctly
            if (themeSelect.value !== currentTheme) {
                console.log('Theme select sync issue, forcing update');
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
            const currentStorageType = storageType || 'unknown';
            switch (currentStorageType) {
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
                    break;
            }
        }
        
        // Update browser compatibility info
        updateBrowserCompatibilityDisplay();
    }

// ================================
// BROWSER COMPATIBILITY SYSTEM
// ================================

/**
 * Updates browser compatibility information in the settings interface.
 * 
 * Analyzes current browser capabilities and updates the compatibility display
 * to show support status for voice recording and transcription features.
 * Provides specific guidance for different browsers and their limitations.
 * 
 * @returns {void}
 * @since 2.02.05
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

// ================================
// AUTOCOMPLETE MANAGEMENT SYSTEM
// ================================

/**
 * Renders the autocomplete management list for tags or dream signs.
 * 
 * Creates a dynamic list interface showing all available autocomplete suggestions
 * for the specified type with delete functionality. Handles loading states and
 * error conditions with appropriate user feedback.
 * 
 * **Key Features:**
 * - Loads suggestions from autocomplete store
 * - Renders interactive list with delete buttons
 * - Handles empty state and error conditions
 * - Integrates with action routing system
 * 
 * @async
 * @param {('tags'|'dreamSigns')} type - Type of autocomplete list to render
 * @returns {Promise<void>} Resolves when rendering completes
 * @throws {Error} Database errors are handled with user feedback
 * 
 * @example
 * await renderAutocompleteManagementList('tags');
 * // Displays list of tag suggestions with delete buttons
 * 
 * @example
 * await renderAutocompleteManagementList('dreamSigns');
 * // Displays list of dream sign suggestions with delete buttons
 * 
 * @since 2.02.05
 */
async function renderAutocompleteManagementList(type) {
        const containerId = type === 'tags' ? 'tagsManagementList' : 'dreamSignsManagementList';
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
            container.innerHTML = `<div class="message-error">Failed to load ${type} list.</div>`;
        }
    }

/**
 * Adds a custom autocomplete item for tags or dream signs.
 * 
 * Reads the value from the appropriate input field, validates it, and adds it
 * to the autocomplete suggestions store. Prevents duplicates and provides user
 * feedback through inline messages. Automatically refreshes the management list
 * after successful addition.
 * 
 * **Validation Rules:**
 * - Item must not be empty after trimming
 * - Item must not already exist (case-insensitive)
 * - Input is automatically converted to lowercase
 * 
 * @async
 * @param {('tags'|'dreamSigns')} type - Type of autocomplete item to add
 * @returns {Promise<void>} Resolves when add operation completes
 * @throws {Error} Database errors are handled with user feedback
 * 
 * @example
 * // Called when user clicks add button for custom tags
 * await addCustomAutocompleteItem('tags');
 * 
 * @since 2.02.05
 */
async function addCustomAutocompleteItem(type) {
        const inputId = type === 'tags' ? 'newTagInput' : 'newDreamSignInput';
        const input = document.getElementById(inputId);
        if (!input) return;

        const newItem = input.value.trim().toLowerCase();
        if (!newItem) {
            createInlineMessage('warning', 'Please enter a value', { 
                container: input.parentElement,
                position: 'top'
            });
            return;
        }

        const storeId = type === 'tags' ? 'tags' : 'dreamSigns';
        
        // Get existing suggestions
        const existingSuggestions = await getAutocompleteSuggestions(type);
        
        // Check if item already exists (case insensitive)
        if (existingSuggestions.some(item => item.toLowerCase() === newItem)) {
            createInlineMessage('warning', 'This item already exists', {
                container: input.parentElement,
                position: 'top'
            });
            return;
        }

        // Add the new item
        const updatedSuggestions = [...existingSuggestions, newItem];
        
        // Save to autocomplete store
        const success = await saveItemToStore('autocomplete', {
            id: storeId,
            items: updatedSuggestions
        });

        if (success) {
            input.value = '';
            createInlineMessage('success', `Added "${newItem}" successfully`, {
                container: input.parentElement,
                position: 'top'
            });
            
            // Re-render the management list
            renderAutocompleteManagementList(type);
        } else {
            createInlineMessage('error', 'Failed to add item', {
                container: input.parentElement,
                position: 'top'
            });
        }
    }

/**
 * Deletes a custom autocomplete item for tags or dream signs.
 * 
 * This function removes a specific item from the autocomplete suggestions
 * for the given type. Performs case-insensitive matching when finding the
 * item to delete and provides user feedback through inline messages.
 * 
 * @async
 * @param {('tags'|'dreamSigns')} type - Type of autocomplete item to delete
 * @param {string} itemValue - Value of the item to delete
 * @returns {Promise<void>} Resolves when delete operation completes
 * @throws {Error} Database errors are handled with user feedback
 * 
 * @example
 * await deleteAutocompleteItem('tags', 'nightmare');
 * 
 * @since 2.02.05
 */
async function deleteAutocompleteItem(type, itemValue) {
        const storeId = type === 'tags' ? 'tags' : 'dreamSigns';
        
        // Get existing suggestions
        const existingSuggestions = await getAutocompleteSuggestions(type);
        
        // Remove the item (case insensitive)
        const updatedSuggestions = existingSuggestions.filter(
            item => item.toLowerCase() !== itemValue.toLowerCase()
        );
        
        // Save updated list
        const success = await saveItemToStore('autocomplete', {
            id: storeId,
            items: updatedSuggestions
        });

        if (success) {
            createInlineMessage('success', `Deleted "${itemValue}" successfully`);
            
            // Re-render the management list
            renderAutocompleteManagementList(type);
        } else {
            createInlineMessage('error', 'Failed to delete item');
        }
    }

// ================================
// PWA SETTINGS INTEGRATION
// ================================

/**
 * Creates and injects PWA installation section into settings page.
 * 
 * This function dynamically creates a PWA installation interface within the
 * settings page when PWA installation becomes available (triggered by the beforeinstallprompt
 * event). The section is inserted before the security section and provides users
 * with a native app installation option.
 * 
 * **Features:**
 * - Dynamic PWA section creation
 * - Proper positioning in settings layout
 * - Integration with PWA installation flow
 * - Prevents duplicate section creation
 * 
 * @function
 * @returns {void}
 * @since 2.02.05
 * @example
 * createPWASection();
 * // PWA installation UI now appears in settings
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
 * Remove PWA installation section from settings page.
 * 
 * This function removes the PWA installation section from the settings page when it's
 * no longer needed. This occurs when the app has been successfully installed or when
 * the browser indicates PWA installation is no longer available.
 * 
 * Provides clean UI management by removing installation prompts after they've served
 * their purpose, preventing user confusion and interface clutter.
 * 
 * @function
 * @returns {void}
 * @since 2.02.05
 * @example
 * removePWASection();
 * // PWA installation UI is removed from settings
 */
function removePWASection() {
    const pwaSection = document.querySelector('#pwaInstallSection');
    if (pwaSection) {
        pwaSection.remove();
    }
}

/**
 * Manages PWA installation section visibility in settings.
 * 
 * This function coordinates the display of PWA installation options in the settings
 * interface based on current browser support and installation state. Called during
 * settings tab initialization to ensure proper PWA integration.
 * 
 * **Key Responsibilities:**
 * - Check PWA installation availability
 * - Create PWA section if installation prompt is available
 * - Clean up PWA section if no longer needed
 * 
 * @function
 * @returns {void}
 * @since 2.02.05
 * @example
 * managePWASettingsSection();
 * // PWA section appears or is removed based on availability
 */
function managePWASettingsSection() {
    try {
        // Check if PWA installation is available
        if (window.deferredPrompt) {
            createPWASection();
        } else {
            // Remove PWA section if it exists but installation is no longer available
            removePWASection();
        }
    } catch (error) {
        console.error('Error managing PWA settings section:', error);
    }
}

// ================================
// SETTINGS TAB INITIALIZATION
// ================================

/**
 * Initializes the settings tab when it becomes active.
 * 
 * This function coordinates the initialization of all settings tab components
 * including settings synchronization, browser compatibility updates, and
 * autocomplete management loading. Called whenever the settings tab is
 * switched to or needs to be refreshed.
 * 
 * **Initialization Sequence:**
 * 1. Synchronize all settings display elements
 * 2. Update browser compatibility information  
 * 3. Load autocomplete management interfaces
 * 4. Initialize PWA installation section if applicable
 * 5. Set up theme selector event listeners
 * 
 * @returns {void}
 * 
 * @example
 * // Called when switching to settings tab
 * initializeSettingsTab();
 * // All settings components are now properly initialized
 * 
 * @since 2.02.05
 */
function initializeSettingsTab() {
    try {
        // Use setTimeout to allow DOM to fully render first
        setTimeout(() => {
            // Update security controls and PIN button states
            if (typeof updateSecurityControls === 'function') {
                updateSecurityControls();
            }
            
            // Always update theme select - this fixes the tab switching issue
            const themeSelect = document.getElementById('themeSelect');
            if (themeSelect) {
                const currentTheme = getCurrentTheme();
                
                // Update the select value
                themeSelect.value = currentTheme;
                
                // Also update the selected attribute in the DOM
                themeSelect.querySelectorAll('option').forEach(option => {
                    if (option.value === currentTheme) {
                        option.selected = true;
                        option.setAttribute('selected', 'selected');
                    } else {
                        option.selected = false;
                        option.removeAttribute('selected');
                    }
                });
                
                // Add event listener if not already added
                if (!themeSelect.hasAttribute('data-listener-added')) {
                    themeSelect.addEventListener('change', function() {
                        switchTheme(this.value);
                    });
                    themeSelect.setAttribute('data-listener-added', 'true');
                }
            }

            // Render autocomplete management lists
            renderAutocompleteManagementList('tags');
            renderAutocompleteManagementList('dreamSigns');
            
            // Add PWA section if installation is available
            managePWASettingsSection();
            
            // Synchronize all settings display elements
            syncSettingsDisplay();
            
            console.log('Settings tab initialized successfully');
            
        }, CONSTANTS.FOCUS_DELAY_MS || 100);
        
    } catch (error) {
        console.error('Error initializing settings tab:', error);
        // Show user-friendly error message
        const settingsTab = document.getElementById('settingsTab');
        if (settingsTab) {
            settingsTab.innerHTML = `
                <div class="message-base message-error">
                    <h3>Settings Temporarily Unavailable</h3>
                    <p>There was an error loading the settings interface. Please refresh the page and try again.</p>
                    <p class="text-sm">Error details: ${error.message}</p>
                </div>
            `;
        }
    }
}

// ================================
// MODULE EXPORTS
// ================================

/**
 * ES Module exports for the Settings Tab Module.
 * 
 * This exports the key functions that other modules need to interact
 * with the settings tab functionality. Designed for ES module import/export system.
 * 
 * @since 2.02.05
 */
export {
    renderSettingsTab,
    initializeSettingsTab,
    syncSettingsDisplay,
    updateBrowserCompatibilityDisplay,
    renderAutocompleteManagementList,
    addCustomAutocompleteItem,
    deleteAutocompleteItem,
    createPWASection,
    removePWASection,
    managePWASettingsSection
};

// For backward compatibility, also expose via window global
// This allows both ES modules and traditional script approaches to work
window.SettingsTab = {
    render: renderSettingsTab,
    initialize: initializeSettingsTab,
    sync: syncSettingsDisplay,
    updateCompatibility: updateBrowserCompatibilityDisplay,
    renderAutocompleteList: renderAutocompleteManagementList,
    addAutocompleteItem: addCustomAutocompleteItem,
    deleteAutocompleteItem: deleteAutocompleteItem,
    createPWASection: createPWASection,
    removePWASection: removePWASection,
    managePWASection: managePWASettingsSection,
    version: '2.02.05'
};

// ================================
// MODULE LOADING COMPLETE
// ================================
console.log('Settings Tab Module loaded successfully - Available as ES module exports and window.SettingsTab');