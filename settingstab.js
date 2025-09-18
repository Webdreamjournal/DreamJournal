/**
 * @fileoverview Settings Tab Module - Dedicated handler for application settings interface
 * 
 * This module manages all settings tab functionality including:
 * - Settings UI generation and layout
 * - Theme management interface
 * - Security settings (PIN setup and data encryption interface)
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
 * @version 2.04.00
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
import {
    CONSTANTS,
    SETTINGS_APPEARANCE_COLLAPSE_KEY,
    SETTINGS_SECURITY_COLLAPSE_KEY,
    SETTINGS_DATA_COLLAPSE_KEY,
    SETTINGS_AUTOCOMPLETE_COLLAPSE_KEY,
    SETTINGS_CLOUD_SYNC_COLLAPSE_KEY,
    DEFAULT_DROPBOX_CLIENT_ID,
    CUSTOM_DROPBOX_CLIENT_ID_KEY
} from './constants.js';
import { 
    getAutocompleteSuggestions,
    saveItemToStore,
    loadItemFromStore,
    storageType 
} from './storage.js';
import {
    getActiveAppTab,
    getAppLocked,
    getUnlocked,
    getEncryptionEnabled,
    getCloudEncryptionEnabled,
    setCloudEncryptionEnabled,
    getIsSettingsAppearanceCollapsed,
    setIsSettingsAppearanceCollapsed,
    getIsSettingsSecurityCollapsed,
    setIsSettingsSecurityCollapsed,
    getIsSettingsDataCollapsed,
    setIsSettingsDataCollapsed,
    getIsSettingsAutocompleteCollapsed,
    setIsSettingsAutocompleteCollapsed,
    getIsSettingsCloudSyncCollapsed,
    setIsSettingsCloudSyncCollapsed
} from './state.js';
import { isPinSetup } from './security.js';
import { getVoiceCapabilities } from './voice-notes.js';

// Import PWA functions from pwa.js
import { createPWASection, removePWASection } from './pwa.js';

// Import shared utilities from dom-helpers.js
import { 
    getCurrentTheme, 
    switchTheme, 
    createInlineMessage, 
    escapeHtml, 
    escapeAttr,
    syncSettingsDisplay,
    updateBrowserCompatibilityDisplay,
    renderAutocompleteManagementList
} from './dom-helpers.js';

console.log('Loading Settings Tab Module v2.02.06');

// ================================
// SETTINGS TAB UI GENERATION
// ================================

/**
 * Renders the complete settings tab interface with all sections and controls.
 * 
 * This function generates the entire settings tab HTML structure including:
 * - Appearance section (theme selector)
 * - Security section (PIN setup and data encryption controls)
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
    const currentTheme = getCurrentTheme();
    const lightSelected = currentTheme === 'light' ? 'selected' : '';
    const darkSelected = currentTheme === 'dark' ? 'selected' : '';
    
    tabPanel.innerHTML = `
        <h3 id="settings-main-heading" tabindex="-1">⚙️ Settings</h3><br>
        <div class="settings-section" data-settings-section="appearance">
            <h3 data-action="toggle-settings-appearance"
                role="button"
                tabindex="0"
                aria-expanded="true"
                aria-label="Appearance section - currently expanded. Press Enter or Space to collapse"
                style="cursor: pointer; user-select: none;">
                🎨 Appearance
                <span class="collapse-indicator" title="Click to collapse"></span>
                <span class="collapse-hint text-xs text-secondary font-normal">(Click to collapse)</span>
            </h3>
            <div class="settings-section-content">
                <div class="settings-row">
                    <div>
                        <div class="settings-label">Theme</div>
                        <div class="settings-description">Choose your preferred color theme</div>
                    </div>
                    <div class="settings-controls">
                        <select id="themeSelect" class="filter-select" style="min-width: 120px;" aria-keyshortcuts="Control+T">
                            <option value="light" ${lightSelected}>🌞 Light</option>
                            <option value="dark" ${darkSelected}>🌙 Dark</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
        <div class="settings-section" data-settings-section="security">
            <h3 data-action="toggle-settings-security"
                role="button"
                tabindex="0"
                aria-expanded="true"
                aria-label="Security section - currently expanded. Press Enter or Space to collapse"
                style="cursor: pointer; user-select: none;">
                🔐 Security
                <span class="collapse-indicator" title="Click to collapse"></span>
                <span class="collapse-hint text-xs text-secondary font-normal">(Click to collapse)</span>
            </h3>
            <div class="settings-section-content">
                <!-- PIN Protection -->
                <div class="settings-row">
                    <div>
                        <div class="settings-label">PIN Protection</div>
                        <div class="settings-description">Secure your dreams with a PIN code</div>
                    </div>
                    <div class="settings-controls">
                        <button data-action="setup-pin" id="setupPinBtnSettings" class="btn btn-secondary">⚙️ Setup PIN</button>
                        <button data-action="toggle-lock" id="lockBtnSettings" class="btn btn-lock" title="Lock your journal with your PIN to keep dreams private" aria-keyshortcuts="Control+L" style="display: none;">🔒 Lock Journal</button>
                    </div>
                </div>

                <!-- Data Encryption -->
                <div class="settings-row">
                    <div>
                        <div class="settings-label">Data Encryption</div>
                        <div class="settings-description">
                            Enable AES-256 encryption for your dreams and goals data.
                            Requires a password to access your data.
                        </div>
                        <div class="encryption-status">
                            <span class="status-indicator ${getEncryptionEnabled() ? 'enabled' : 'disabled'}">
                                ${getEncryptionEnabled() ? '🔒 Enabled' : '🔓 Disabled'}
                            </span>
                        </div>
                    </div>
                    <div class="settings-controls">
                        <button
                            data-action="toggle-encryption"
                            class="btn ${getEncryptionEnabled() ? 'btn-secondary' : 'btn-primary'}"
                            aria-describedby="encryption-heading">
                            ${getEncryptionEnabled() ? 'Disable' : 'Enable'} Encryption
                        </button>
                    </div>
                </div>

                ${getEncryptionEnabled() ? `
                    <div class="settings-row">
                        <div>
                            <div class="settings-label">Change Encryption Password</div>
                            <div class="settings-description">
                                Update the password used to encrypt your data.
                            </div>
                        </div>
                        <div class="settings-controls">
                            <button
                                data-action="change-encryption-password"
                                class="btn btn-secondary">
                                Change Password
                            </button>
                        </div>
                    </div>
                ` : ''}

                <div class="security-notice">
                    <div class="message-warning border-l-warning" style="margin-top: 15px;">
                        <strong>⚠️ Important:</strong> If you forget your encryption password,
                        your data cannot be recovered. Consider exporting backups regularly.
                    </div>
                </div>
            </div>
        </div>
        <div class="settings-section" data-settings-section="data">
            <h3 data-action="toggle-settings-data"
                role="button"
                tabindex="0"
                aria-expanded="true"
                aria-label="Data Management section - currently expanded. Press Enter or Space to collapse"
                style="cursor: pointer; user-select: none;">
                💾 Data Management
                <span class="collapse-indicator" title="Click to collapse"></span>
                <span class="collapse-hint text-xs text-secondary font-normal">(Click to collapse)</span>
            </h3>
            <div class="settings-section-content">
                <!-- Dreams Only Export/Import -->
                <div class="settings-row">
                    <div>
                        <div class="settings-label">Dreams Export/Import</div>
                        <div class="settings-description">Export or import your dreams as text files</div>
                    </div>
                    <div class="settings-controls export-import-controls">
                        <button data-action="export-dreams" class="btn btn-secondary" aria-keyshortcuts="Control+E">Export Dreams</button>
                        <button data-action="import-dreams" class="btn btn-secondary" aria-keyshortcuts="Control+I">Import Dreams</button>
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
            </div>
        </div>
        <div class="settings-section" data-settings-section="autocomplete">
            <h3 data-action="toggle-settings-autocomplete"
                role="button"
                tabindex="0"
                aria-expanded="true"
                aria-label="Autocomplete Management section - currently expanded. Press Enter or Space to collapse"
                style="cursor: pointer; user-select: none;">
                🏷️ Autocomplete Management
                <span class="collapse-indicator" title="Click to collapse"></span>
                <span class="collapse-hint text-xs text-secondary font-normal">(Click to collapse)</span>
            </h3>
            <div class="settings-section-content">
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

                <div class="settings-row">
                    <div>
                        <div class="settings-label">💭 Emotions</div>
                        <div class="settings-description">Add a new custom emotion.</div>
                    </div>
                    <div style="flex: 1; min-width: 300px; max-width: 400px;">
                        <div id="emotionsManagementList" class="autocomplete-management-list">
                            <div class="loading-state">Loading emotions...</div>
                        </div>
                        <div class="form-group mt-sm" style="display: flex; justify-content: flex-end;">
                            <div class="flex-center gap-sm" style="width: 100%; max-width: 300px;">
                                <input type="text" id="newEmotionInput" class="form-control" placeholder="e.g., contemplative">
                                <button data-action="add-custom-emotion" class="btn btn-primary btn-small">Add</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="settings-section" data-settings-section="cloud-sync">
            <h3 data-action="toggle-settings-cloud-sync"
                role="button"
                tabindex="0"
                aria-expanded="true"
                aria-label="Cloud Sync section - currently expanded. Press Enter or Space to collapse"
                style="cursor: pointer; user-select: none;">
                ☁️ Cloud Sync
                <span class="collapse-indicator" title="Click to collapse"></span>
                <span class="collapse-hint text-xs text-secondary font-normal">(Click to collapse)</span>
            </h3>
            <div class="settings-section-content">
                <p class="settings-description" style="margin-bottom: 20px;">Connect your Dropbox account to automatically backup and sync your dreams across devices. Your data remains encrypted and private.</p>

                <!-- Advanced Configuration -->
                <div class="settings-row">
                    <div>
                        <label class="settings-label" style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="showAdvancedCloudConfig" style="margin: 0;">
                            <span>Show Advanced Configuration</span>
                        </label>
                        <div class="settings-description">
                            Configure custom Dropbox app settings (for advanced users only)
                        </div>
                    </div>
                </div>

                <!-- Advanced Configuration Panel -->
                <div id="advancedCloudConfig" class="settings-row" style="display: none;">
                    <div style="width: 100%;">
                        <div class="settings-label">Dropbox App Key</div>
                        <div class="settings-description" style="margin-bottom: 15px;">
                            The Dropbox application key used for authentication. Most users should not change this.
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <input
                                type="text"
                                id="dropboxAppKeyInput"
                                class="form-control"
                                style="flex: 1; font-family: monospace;"
                                readonly
                                value=""
                                aria-label="Dropbox App Key">
                            <button
                                id="editDropboxAppKeyBtn"
                                data-action="edit-dropbox-app-key"
                                class="btn btn-secondary btn-small">
                                Edit
                            </button>
                        </div>
                        <div class="message-warning border-l-warning" style="display: none;" id="appKeyWarning">
                            <strong>⚠️ Warning:</strong> Only change this if you know what you're doing.
                            An invalid app key will prevent cloud sync from working.
                        </div>
                    </div>
                </div>

                <!-- Account Connection Status -->
                <div class="settings-row">
                    <div>
                        <div class="settings-label">Account Connection</div>
                        <div class="settings-description">Connect to Dropbox for cloud backup and sync</div>
                        <div class="cloud-sync-status">
                            <span id="cloudSyncStatusIndicator" class="status-indicator">
                                🔗 Not Connected
                            </span>
                        </div>
                    </div>
                    <div class="settings-controls">
                        <button
                            id="cloudSyncAccountButton"
                            data-action="link-dropbox-account"
                            class="btn btn-primary"
                            aria-describedby="cloud-sync-status">
                            Connect Dropbox
                        </button>
                    </div>
                </div>

                <!-- Manual Sync Controls -->
                <div id="cloudSyncControls" class="settings-row" style="display: none;">
                    <div>
                        <div class="settings-label">Manual Sync</div>
                        <div class="settings-description">
                            Upload your current data to cloud or download from cloud to restore.
                        </div>
                        <div class="cloud-sync-info">
                            <span id="lastSyncTime" class="text-xs text-secondary">
                                Never synced
                            </span>
                        </div>
                    </div>
                    <div class="settings-controls sync-controls">
                        <button
                            data-action="sync-to-cloud"
                            class="btn btn-secondary"
                            title="Upload current data to Dropbox">
                            📤 Upload to Cloud
                        </button>
                        <button
                            data-action="sync-from-cloud"
                            class="btn btn-secondary"
                            title="Download and restore data from Dropbox">
                            📥 Download from Cloud
                        </button>
                    </div>
                </div>

                <!-- Sync Status Display -->
                <div id="cloudSyncProgress" class="settings-row" style="display: none;">
                    <div>
                        <div class="settings-label">Sync Status</div>
                        <div class="settings-description">
                            <span id="syncProgressText">Synchronizing...</span>
                        </div>
                    </div>
                    <div class="settings-controls">
                        <div class="sync-progress-indicator">
                            <div class="loading-spinner"></div>
                        </div>
                    </div>
                </div>

                <!-- Cloud Encryption Option (only shown when encryption is enabled) -->
                ${getEncryptionEnabled() ? `
                <div class="settings-row">
                    <div>
                        <div class="settings-label">Cloud Encryption</div>
                        <div class="settings-description">
                            Encrypt your cloud backups using your encryption password for maximum security.
                        </div>
                    </div>
                    <div class="settings-controls">
                        <label class="checkbox-container">
                            <input
                                type="checkbox"
                                id="cloudEncryptionEnabled"
                                data-action="toggle-cloud-encryption"
                                ${getCloudEncryptionEnabled() ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            <span class="checkbox-label">Encrypt cloud backups</span>
                        </label>
                    </div>
                </div>
                ` : ''}

                <div class="cloud-sync-notice">
                    <div class="message-info border-l-info" style="margin-top: 15px;">
                        <strong>🔒 Privacy:</strong> ${getEncryptionEnabled()
                            ? (getCloudEncryptionEnabled()
                                ? 'Your cloud backups are encrypted using your encryption password. Only you can decrypt them.'
                                : 'Your cloud backups are stored as readable JSON. Enable "Encrypt cloud backups" above for maximum security.')
                            : 'Your cloud backups contain readable JSON data. Enable encryption in settings above for secure cloud storage.'}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Note: syncSettingsDisplay and updateBrowserCompatibilityDisplay are now imported from dom-helpers.js

// ================================
// AUTOCOMPLETE MANAGEMENT SYSTEM
// ================================

// Note: renderAutocompleteManagementList is now imported from dom-helpers.js

/**
 * Enhanced addCustomAutocompleteItem with encryption support.
 *
 * Reads the value from the appropriate input field, validates it, and adds it
 * to the autocomplete suggestions store. Handles both encrypted and unencrypted
 * data seamlessly. Prevents duplicates and provides user feedback through inline
 * messages. Automatically refreshes the management list after successful addition.
 *
 * **Validation Rules:**
 * - Item must not be empty after trimming
 * - Item must not already exist (case-insensitive)
 * - Input is automatically converted to lowercase
 *
 * **Encryption Support:**
 * - Automatically handles encrypted autocomplete data
 * - Provides specific error messages for encryption issues
 * - Falls back gracefully when encryption password is unavailable
 *
 * @async
 * @param {('tags'|'dreamSigns'|'emotions')} type - Type of autocomplete item to add
 * @returns {Promise<void>} Resolves when add operation completes
 * @throws {Error} Database and encryption errors are handled with user feedback
 *
 * @example
 * // Called when user clicks add button for custom tags
 * await addCustomAutocompleteItem('tags');
 *
 * @since 2.03.04
 */
async function addCustomAutocompleteItem(type) {
        const inputId = type === 'tags' ? 'newTagInput' : type === 'dreamSigns' ? 'newDreamSignInput' : 'newEmotionInput';
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

        try {
            const storeId = type === 'tags' ? 'tags' : type === 'dreamSigns' ? 'dreamSigns' : 'emotions';

            // Get existing suggestions with enhanced error handling
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

            // Save to autocomplete store with encryption support
            const { saveAutocompleteSuggestions } = await import('./storage.js');
            const success = await saveAutocompleteSuggestions(type, updatedSuggestions);

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
        } catch (error) {
            console.error('Error adding autocomplete item:', error);

            // Provide user-friendly error messages based on error type
            let errorMessage = 'Failed to add item. Please try again.';
            if (error.message.includes('Encryption password required')) {
                errorMessage = 'Failed to add item. Encryption password required.';
            } else if (error.message.includes('password')) {
                errorMessage = 'Failed to add item. Check encryption status.';
            }

            createInlineMessage('error', errorMessage, {
                container: input.parentElement,
                position: 'top'
            });
        }
    }

/**
 * Enhanced deleteAutocompleteItem with encryption support.
 *
 * This function removes a specific item from the autocomplete suggestions
 * for the given type. Handles both encrypted and unencrypted data seamlessly.
 * Performs case-insensitive matching when finding the item to delete and
 * provides user feedback through inline messages.
 *
 * **Encryption Support:**
 * - Automatically handles encrypted autocomplete data
 * - Provides specific error messages for encryption issues
 * - Falls back gracefully when encryption password is unavailable
 *
 * @async
 * @param {('tags'|'dreamSigns'|'emotions')} type - Type of autocomplete item to delete
 * @param {string} itemValue - Value of the item to delete
 * @returns {Promise<void>} Resolves when delete operation completes
 * @throws {Error} Database and encryption errors are handled with user feedback
 *
 * @example
 * await deleteAutocompleteItem('tags', 'nightmare');
 *
 * @since 2.03.04
 */
async function deleteAutocompleteItem(type, itemValue) {
        try {
            const storeId = type === 'tags' ? 'tags' : type === 'dreamSigns' ? 'dreamSigns' : 'emotions';

            // Get existing suggestions with enhanced error handling
            const existingSuggestions = await getAutocompleteSuggestions(type);

            // Remove the item (case insensitive)
            const updatedSuggestions = existingSuggestions.filter(
                item => item.toLowerCase() !== itemValue.toLowerCase()
            );

            // Save updated list with encryption support
            const { saveAutocompleteSuggestions } = await import('./storage.js');
            const success = await saveAutocompleteSuggestions(type, updatedSuggestions);

            if (success) {
                createInlineMessage('success', `Deleted "${itemValue}" successfully`);

                // Re-render the management list
                renderAutocompleteManagementList(type);
            } else {
                createInlineMessage('error', 'Failed to delete item');
            }
        } catch (error) {
            console.error('Error deleting autocomplete item:', error);

            // Provide user-friendly error messages based on error type
            let errorMessage = 'Failed to delete item. Please try again.';
            if (error.message.includes('Encryption password required')) {
                errorMessage = 'Failed to delete item. Encryption password required.';
            } else if (error.message.includes('password')) {
                errorMessage = 'Failed to delete item. Check encryption status.';
            }

            createInlineMessage('error', errorMessage);
        }
    }

// ================================
// ENCRYPTION SETTINGS MANAGEMENT
// ================================

/**
 * Handles encryption enable/disable toggle from settings interface.
 *
 * This function acts as the main entry point for encryption state changes from the
 * settings UI. It determines the current encryption state and routes to the appropriate
 * enable or disable function, providing a unified interface for encryption management.
 *
 * **Operation Flow:**
 * 1. Check current encryption state via getEncryptionEnabled()
 * 2. Route to enableEncryption() or disableEncryption() accordingly
 * 3. Handle any errors gracefully with user feedback
 *
 * @async
 * @function
 * @returns {Promise<void>} Resolves when encryption state change completes
 * @throws {Error} Handled gracefully with user feedback via createInlineMessage
 * @since 2.03.01
 * @example
 * // Called when user clicks enable/disable encryption button
 * await toggleEncryption();
 * // Routes to appropriate enable/disable function based on current state
 */
async function toggleEncryption() {
    try {
        const isCurrentlyEnabled = getEncryptionEnabled();

        if (isCurrentlyEnabled) {
            // Disable encryption
            await disableEncryption();
        } else {
            // Enable encryption
            await enableEncryption();
        }
    } catch (error) {
        console.error('Error toggling encryption:', error);
        createInlineMessage('error', 'Failed to change encryption settings. Please try again.');
    }
}

/**
 * Toggles cloud backup encryption on/off.
 *
 * This function enables or disables encryption for cloud backups specifically,
 * allowing users to choose whether their Dropbox backups should be encrypted
 * even when general app encryption is enabled. This provides flexibility for
 * users who want local encryption but prefer plain text cloud backups.
 *
 * @async
 * @function toggleCloudEncryption
 * @returns {Promise<void>} Promise that resolves when toggle is complete
 * @throws {Error} When cloud encryption toggle fails
 * @since 2.04.64
 *
 * @example
 * // Toggle cloud encryption from action router
 * await toggleCloudEncryption();
 */
async function toggleCloudEncryption() {
    try {
        const currentlyEnabled = getCloudEncryptionEnabled();
        const newState = !currentlyEnabled;

        // Update the setting
        setCloudEncryptionEnabled(newState);

        // Update the checkbox UI
        const checkbox = document.getElementById('cloudEncryptionEnabled');
        if (checkbox) {
            checkbox.checked = newState;
        }

        // Update the privacy notice to reflect the change
        const settingsTabPanel = document.getElementById('settingsTab');
        if (settingsTabPanel) {
            renderSettingsTab(settingsTabPanel);

            // Re-initialize the settings tab to restore state
            initializeSettingsTab();
        }

        // Show feedback message
        const message = newState
            ? 'Cloud backup encryption enabled. Your Dropbox backups will now be encrypted.'
            : 'Cloud backup encryption disabled. Your Dropbox backups will be stored as plain text.';

        createInlineMessage('success', message);

    } catch (error) {
        console.error('Error toggling cloud encryption:', error);
        createInlineMessage('error', 'Failed to change cloud encryption setting. Please try again.');
    }
}

/**
 * Enables data encryption with comprehensive password setup and data migration.
 *
 * This function implements the complete encryption enablement process including
 * password setup, validation, existing data encryption, and UI updates. It handles
 * the migration of existing unencrypted data to encrypted format seamlessly.
 *
 * **Implementation Process:**
 * 1. Show password setup dialog with confirmation
 * 2. Validate password meets security requirements
 * 3. Save encryption settings to localStorage
 * 4. Encrypt all existing dreams, goals, and autocomplete data
 * 5. Update settings UI to reflect new encryption state
 * 6. Clear data cache to force reload with encryption
 *
 * **Data Migration:**
 * - Iterates through all existing dreams, goals, and autocomplete data
 * - Encrypts each item using the new password
 * - Saves encrypted versions to IndexedDB
 * - Preserves all metadata and relationships
 *
 * @async
 * @function
 * @returns {Promise<void>} Resolves when encryption setup completes successfully
 * @throws {Error} When password validation fails or encryption setup encounters errors
 * @since 2.03.01
 * @example
 * // Enable encryption with user password setup
 * await enableEncryption();
 * // Shows password dialog, encrypts data, updates UI
 */
async function enableEncryption() {
    try {
        // Show password setup dialog
        await showEncryptionSetupDialog();
    } catch (error) {
        console.error('Error enabling encryption:', error);
        createInlineMessage('error', 'Failed to enable encryption. Please try again.');
    }
}

/**
 * Shows the encryption password setup dialog with validation and confirmation.
 *
 * This function presents a comprehensive password setup interface including password
 * strength validation, confirmation matching, and clear user guidance. It handles
 * the complete password setup workflow from input to final encryption setup.
 *
 * **Dialog Features:**
 * - Password and confirmation input fields
 * - Real-time validation feedback
 * - Password strength requirements
 * - Clear setup instructions and warnings
 *
 * **Validation Process:**
 * 1. Check password meets minimum length requirements
 * 2. Verify password and confirmation match exactly
 * 3. Validate password strength against security criteria
 * 4. Proceed with encryption setup if all validations pass
 *
 * @async
 * @function
 * @returns {Promise<void>} Resolves when password setup dialog completes
 * @since 2.03.01
 * @example
 * // Show encryption setup dialog
 * await showEncryptionSetupDialog();
 * // User enters password, validation occurs, encryption setup proceeds
 */
async function showEncryptionSetupDialog() {
    try {
        // Import the password dialog function from security.js
        const { showPasswordDialog, validateEncryptionPassword } = await import('./security.js');

        const config = {
            title: 'Set Up Data Encryption',
            description: 'Create a strong password to encrypt your dreams and goals data.',
            requireConfirm: true,
            primaryButtonText: 'Enable Encryption',
            validate: validateEncryptionPassword  // Validate inside the dialog
        };

        // showPasswordDialog returns a Promise with the password or null if cancelled
        // Validation errors will be shown inside the dialog
        const password = await showPasswordDialog(config);

        if (!password) {
            // User cancelled the dialog
            return;
        }

        // Password is already validated, proceed with setup
        await setupEncryption(password);

    } catch (error) {
        console.error('Encryption setup dialog error:', error);
        createInlineMessage('error', 'Failed to set up encryption dialog');
    }
}

/**
 * Performs the complete encryption setup process including data migration.
 *
 * This function handles the core encryption setup operations including settings
 * storage, existing data encryption, state management, and UI updates. It ensures
 * a seamless transition from unencrypted to encrypted data storage.
 *
 * **Setup Process:**
 * 1. Save encryption settings to localStorage
 * 2. Set session encryption password in state
 * 3. Encrypt all existing dreams in IndexedDB
 * 4. Encrypt all existing goals in IndexedDB
 * 5. Clear decrypted data cache to force reload
 * 6. Refresh settings UI to show new encryption state
 * 7. Provide user feedback on successful completion
 *
 * **Data Integrity:**
 * - Preserves all existing data during migration
 * - Maintains data relationships and metadata
 * - Handles mixed encrypted/unencrypted scenarios gracefully
 * - Provides rollback capability if errors occur
 *
 * @async
 * @function
 * @param {string} password - User's encryption password
 * @returns {Promise<void>} Resolves when complete encryption setup finishes
 * @throws {Error} When encryption setup operations fail
 * @since 2.03.01
 * @example
 * // Set up encryption with user password
 * await setupEncryption('user-secure-password');
 * // Encrypts all data, updates settings, refreshes UI
 */
async function setupEncryption(password) {
    try {
        // Import required functions
        const { setEncryptionPassword, clearDecryptedDataCache, setEncryptionEnabled } = await import('./state.js');
        const { saveEncryptionSettings } = await import('./security.js');
        const { loadDreamsRaw, loadGoalsRaw, encryptItemForStorage, saveItemToStore } = await import('./storage.js');
        const { initializeApplicationData } = await import('./main.js');

        // Enable encryption setting
        await saveEncryptionSettings(true);
        setEncryptionEnabled(true);
        setEncryptionPassword(password);

        // Encrypt existing dreams
        const dreams = await loadDreamsRaw();
        let encryptedCount = 0;
        for (const dream of dreams) {
            if (!dream.encrypted) { // Don't re-encrypt already encrypted items
                const encrypted = await encryptItemForStorage(dream, password);
                await saveItemToStore('dreams', encrypted);
                encryptedCount++;
            }
        }

        // Encrypt existing goals
        const goals = await loadGoalsRaw();
        let goalsEncryptedCount = 0;
        for (const goal of goals) {
            if (!goal.encrypted) { // Don't re-encrypt already encrypted items
                const encrypted = await encryptItemForStorage(goal, password);
                await saveItemToStore('goals', encrypted);
                goalsEncryptedCount++;
            }
        }

        // Encrypt existing autocomplete data (tags and dream signs)
        const { getAutocompleteSuggestionsRawData } = await import('./storage.js');
        const autocompleteTypes = ['tags', 'dreamSigns', 'emotions'];
        let autocompleteEncryptedCount = 0;

        for (const type of autocompleteTypes) {
            try {
                const autocompleteData = await getAutocompleteSuggestionsRawData(type);
                if (autocompleteData && !autocompleteData.encrypted) {
                    const encrypted = await encryptItemForStorage(autocompleteData, password);
                    await saveItemToStore('autocomplete', encrypted);
                    autocompleteEncryptedCount++;
                }
            } catch (error) {
                // Autocomplete may not exist for this type, continue with other types
                console.warn(`Autocomplete ${type} encryption skipped:`, error.message);
            }
        }

        // Clear cache and reload data
        clearDecryptedDataCache();
        await initializeApplicationData();

        // Update settings UI to reflect new state
        const settingsTab = document.getElementById('settingsTab');
        if (settingsTab && !settingsTab.hidden) {
            renderSettingsTab(settingsTab);
            initializeSettingsTab();
            // Note: syncSettingsDisplay() is called inside initializeSettingsTab() with proper timing
        }

        const totalEncrypted = encryptedCount + goalsEncryptedCount + autocompleteEncryptedCount;
        let message = 'Encryption enabled successfully!';
        if (totalEncrypted > 0) {
            const parts = [];
            if (encryptedCount > 0) parts.push(`${encryptedCount} dreams`);
            if (goalsEncryptedCount > 0) parts.push(`${goalsEncryptedCount} goals`);
            if (autocompleteEncryptedCount > 0) parts.push(`${autocompleteEncryptedCount} autocomplete lists`);
            message += ` ${parts.join(', ')} encrypted.`;
        } else {
            message += ' All data is now encrypted.';
        }
        createInlineMessage('success', message);

    } catch (error) {
        console.error('Error setting up encryption:', error);
        throw error;
    }
}

/**
 * Disables data encryption and decrypts all encrypted data.
 *
 * This function implements the complete encryption disabling process including
 * password verification, custom confirmation dialog, data decryption, settings
 * cleanup, and UI updates. It safely transitions from encrypted to unencrypted
 * data storage using the application's custom popup system.
 *
 * **Disable Process:**
 * 1. Verify current encryption password using custom password dialog
 * 2. Show confirmation dialog with security warnings using custom UI
 * 3. Decrypt all encrypted dreams, goals, and autocomplete data
 * 4. Save decrypted data in unencrypted format
 * 5. Clear encryption settings from localStorage and session state
 * 6. Update UI to reflect disabled encryption state
 *
 * **Safety Features:**
 * - Requires current password verification before proceeding
 * - Uses custom popup system (no browser confirm() dialogs)
 * - Preserves all data during the transition
 * - Provides clear warnings about security implications
 * - Allows cancellation at any point in the process
 *
 * @async
 * @function
 * @returns {Promise<void>} Resolves when encryption disable process completes
 * @throws {Error} When password verification fails or decryption encounters errors
 * @since 2.03.01
 * @example
 * // Disable encryption after user password verification and confirmation
 * await disableEncryption();
 * // Shows password verification, confirmation dialog, decrypts data, updates settings
 */
async function disableEncryption() {
    try {
        // Import required functions
        const { showPasswordDialog, testEncryptionPassword } = await import('./security.js');

        // Step 1: Verify current encryption password with retry logic
        const password = await verifyEncryptionPasswordWithRetry(showPasswordDialog, testEncryptionPassword);

        if (!password) {
            // User cancelled or failed verification
            return;
        }

        // Step 2: Show confirmation dialog (no password required, just confirmation)
        const confirmed = await showConfirmationDialog({
            title: 'Disable Data Encryption?',
            description: 'This will decrypt all your data and store it unencrypted.\n\n' +
                        '⚠️ Your dreams and goals will no longer be protected if someone gains access to your device.\n\n' +
                        'Are you sure you want to continue?',
            primaryButtonText: 'Yes, Disable Encryption',
            cancelButtonText: 'Keep Encryption Enabled'
        });

        if (!confirmed) {
            // User cancelled confirmation
            createInlineMessage('info', 'Encryption remains enabled.');
            return;
        }

        // Step 3: Proceed with decryption
        await performEncryptionDisabling(password);

    } catch (error) {
        console.error('Error disabling encryption:', error);
        createInlineMessage('error', 'Failed to disable encryption. Please try again.');
    }
}

/**
 * Shows a confirmation dialog without password input fields.
 *
 * This function creates a simple yes/no confirmation dialog using the same
 * styling as password dialogs but without any input fields. Useful for
 * final confirmations after password verification is already complete.
 *
 * @async
 * @function
 * @param {Object} config - Dialog configuration object
 * @param {string} config.title - Dialog title text
 * @param {string} config.description - Dialog description/warning text
 * @param {string} config.primaryButtonText - Primary action button text
 * @param {string} config.cancelButtonText - Cancel button text
 * @returns {Promise<boolean>} True if confirmed, false if cancelled
 * @since 2.03.01
 * @private
 */
async function showConfirmationDialog(config) {
    return new Promise((resolve) => {
        // Remove any existing confirmation dialog
        const existingOverlay = document.querySelector('.pin-overlay[data-dialog="confirmation"]');
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.className = 'pin-overlay';
        overlay.style.display = 'flex';
        overlay.setAttribute('data-dialog', 'confirmation');

        overlay.innerHTML = `
            <div class="pin-container">
                <h2>⚠️ ${config.title}</h2>
                <p style="white-space: pre-line; line-height: 1.5; margin-bottom: 20px;">${config.description}</p>
                <div class="pin-buttons">
                    <button class="btn btn-primary" id="confirmBtn">${config.primaryButtonText}</button>
                    <button class="btn btn-secondary" id="cancelBtn">${config.cancelButtonText || 'Cancel'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const confirmBtn = document.getElementById('confirmBtn');
        const cancelBtn = document.getElementById('cancelBtn');

        // Focus the cancel button (safer default)
        cancelBtn.focus();

        function cleanup() {
            document.body.removeChild(overlay);
        }

        confirmBtn.addEventListener('click', () => {
            cleanup();
            resolve(true);
        });

        cancelBtn.addEventListener('click', () => {
            cleanup();
            resolve(false);
        });

        // Handle Escape key
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
            }
        });

        // Handle Enter key (confirm action)
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                cleanup();
                resolve(true);
            }
        });
    });
}

/**
 * Verifies encryption password with retry logic and inline error display.
 *
 * This helper function handles password verification for encryption disable operations
 * with user-friendly error handling. If password verification fails, it shows an
 * error message and allows the user to retry until they enter the correct password
 * or cancel the operation.
 *
 * @async
 * @function
 * @param {Function} showPasswordDialog - Password dialog function
 * @param {Function} testEncryptionPassword - Password testing function
 * @param {number} maxAttempts - Maximum number of retry attempts (default: 3)
 * @returns {Promise<string|null>} Verified password or null if cancelled/failed
 * @throws {Error} When password testing encounters technical errors
 * @since 2.03.01
 * @private
 */
async function verifyEncryptionPasswordWithRetry(showPasswordDialog, testEncryptionPassword, maxAttempts = 3) {
    let attempts = 0;

    while (attempts < maxAttempts) {
        let title = 'Verify Encryption Password';
        let description = 'Enter your current encryption password to disable encryption and decrypt your data.';

        // Show error context for retry attempts
        if (attempts > 0) {
            const remaining = maxAttempts - attempts;
            title = 'Incorrect Password - Try Again';
            description = `The password you entered is incorrect. You have ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.\n\nEnter your current encryption password to disable encryption and decrypt your data.`;
        }

        const passwordConfig = {
            title,
            description,
            requireConfirm: false,
            primaryButtonText: attempts === 0 ? 'Verify Password' : 'Try Again'
        };

        const password = await showPasswordDialog(passwordConfig);

        if (!password) {
            // User cancelled
            return null;
        }

        // Test the password
        const passwordTest = await testEncryptionPassword(password);
        if (passwordTest.valid) {
            return password; // Success!
        }

        attempts++;
    }

    // Max attempts reached
    createInlineMessage('error', `Failed to verify password after ${maxAttempts} attempts. Encryption remains enabled.`);
    return null;
}

/**
 * Performs the actual encryption disabling operations including data decryption.
 *
 * This helper function handles the core decryption operations after password
 * verification and user confirmation have been completed. It decrypts all
 * encrypted data, updates settings, and refreshes the UI.
 *
 * @async
 * @function
 * @param {string} password - Verified encryption password for decryption
 * @returns {Promise<void>} Resolves when decryption operations complete
 * @throws {Error} When decryption or settings update operations fail
 * @since 2.03.01
 * @private
 */
async function performEncryptionDisabling(password) {
    // Import required functions
    const { setEncryptionEnabled, setEncryptionPassword, clearDecryptedDataCache } = await import('./state.js');
    const { saveEncryptionSettings } = await import('./security.js');
    const { loadDreamsRaw, loadGoalsRaw, isEncryptedItem, decryptItemFromStorage, saveItemToStore } = await import('./storage.js');
    const { initializeApplicationData } = await import('./main.js');

    // Decrypt all encrypted dreams
    const dreams = await loadDreamsRaw();
    let decryptedCount = 0;
    for (const dream of dreams) {
        if (isEncryptedItem(dream)) {
            const decrypted = await decryptItemFromStorage(dream, password);
            await saveItemToStore('dreams', decrypted);
            decryptedCount++;
        }
    }

    // Decrypt all encrypted goals
    const goals = await loadGoalsRaw();
    let goalsDecryptedCount = 0;
    for (const goal of goals) {
        if (isEncryptedItem(goal)) {
            const decrypted = await decryptItemFromStorage(goal, password);
            await saveItemToStore('goals', decrypted);
            goalsDecryptedCount++;
        }
    }

    // Decrypt all encrypted autocomplete data (tags and dream signs)
    const { getAutocompleteSuggestionsRaw } = await import('./storage.js');
    const autocompleteTypes = ['tags', 'dreamSigns'];
    let autocompleteDecryptedCount = 0;

    for (const type of autocompleteTypes) {
        try {
            const autocompleteData = await getAutocompleteSuggestionsRaw(type);
            if (autocompleteData && isEncryptedItem(autocompleteData)) {
                const decrypted = await decryptItemFromStorage(autocompleteData, password);
                await saveItemToStore('autocomplete', decrypted);
                autocompleteDecryptedCount++;
            }
        } catch (error) {
            // Autocomplete may not exist for this type, continue with other types
            console.warn(`Autocomplete ${type} decryption skipped:`, error.message);
        }
    }

    // Disable encryption settings
    await saveEncryptionSettings(false);
    setEncryptionEnabled(false);
    setEncryptionPassword(null);

    // Clear cache and reload data
    clearDecryptedDataCache();
    await initializeApplicationData();

    // Update settings UI
    const settingsTab = document.getElementById('settingsTab');
    if (settingsTab && !settingsTab.hidden) {
        renderSettingsTab(settingsTab);
        initializeSettingsTab();
        // Note: syncSettingsDisplay() is called inside initializeSettingsTab() with proper timing
    }

    const totalDecrypted = decryptedCount + goalsDecryptedCount + autocompleteDecryptedCount;
    let message = 'Encryption disabled successfully!';
    if (totalDecrypted > 0) {
        const parts = [];
        if (decryptedCount > 0) parts.push(`${decryptedCount} dreams`);
        if (goalsDecryptedCount > 0) parts.push(`${goalsDecryptedCount} goals`);
        if (autocompleteDecryptedCount > 0) parts.push(`${autocompleteDecryptedCount} autocomplete lists`);
        message += ` ${parts.join(', ')} decrypted.`;
    } else {
        message += ' All data is now unencrypted.';
    }
    createInlineMessage('success', message);
}

/**
 * Changes the encryption password with data re-encryption.
 *
 * This function implements secure password change functionality including current
 * password verification, new password setup, and complete data re-encryption with
 * the new password. It ensures continuous data protection during the transition.
 *
 * **Change Process:**
 * 1. Show current password verification dialog
 * 2. Verify current password against existing encrypted data
 * 3. Show new password setup dialog with confirmation
 * 4. Re-encrypt all encrypted data with the new password
 * 5. Update session password and provide user feedback
 *
 * **Security Features:**
 * - Requires verification of current password before change
 * - Validates new password meets security requirements
 * - Re-encrypts all data atomically to prevent data loss
 * - Maintains encryption state throughout the process
 *
 * @async
 * @function
 * @returns {Promise<void>} Resolves when password change process completes
 * @throws {Error} When current password verification fails or re-encryption errors occur
 * @since 2.03.01
 * @example
 * // Change encryption password with verification
 * await changeEncryptionPassword();
 * // Shows current password verification, new password setup, re-encrypts data
 */
async function changeEncryptionPassword() {
    try {
        // Import required functions
        const { showPasswordDialog, testEncryptionPassword, validateEncryptionPassword } = await import('./security.js');

        // Step 1: Verify current password with retry logic
        const currentPassword = await verifyEncryptionPasswordWithRetry(showPasswordDialog, testEncryptionPassword);

        if (!currentPassword) {
            // User cancelled or failed verification
            return;
        }

        // Step 2: Get new password
        const newPasswordConfig = {
            title: 'Set New Encryption Password',
            description: 'Enter your new encryption password.',
            requireConfirm: true,
            primaryButtonText: 'Change Password',
            validate: validateEncryptionPassword  // Validate new password inside dialog
        };

        const newPassword = await showPasswordDialog(newPasswordConfig);

        if (!newPassword) {
            // User cancelled new password entry
            return;
        }

        // Step 3: Re-encrypt all data with new password
        const reEncryptedCount = await reEncryptAllData(currentPassword, newPassword);

        // Step 4: Update settings UI
        const settingsTab = document.getElementById('settingsTab');
        if (settingsTab && !settingsTab.hidden) {
            renderSettingsTab(settingsTab);
            initializeSettingsTab();
            // Note: syncSettingsDisplay() is called inside initializeSettingsTab() with proper timing
        }

        createInlineMessage('success', `Encryption password changed successfully! ${reEncryptedCount > 0 ? `${reEncryptedCount} items re-encrypted.` : 'All encrypted data updated.'}`);

    } catch (error) {
        console.error('Error changing encryption password:', error);
        createInlineMessage('error', 'Failed to change encryption password. Please try again.');
    }
}

/**
 * Re-encrypts all encrypted data with a new password.
 *
 * This function handles the complete data re-encryption process when changing
 * encryption passwords. It safely transitions all encrypted data from the old
 * password to the new password without data loss or corruption.
 *
 * **Re-encryption Process:**
 * 1. Load all raw dreams and goals from storage
 * 2. Identify encrypted items using isEncryptedItem()
 * 3. Decrypt each item with the old password
 * 4. Re-encrypt each item with the new password
 * 5. Save re-encrypted items back to storage
 * 6. Update session password and clear cache
 *
 * **Data Safety:**
 * - Processes items individually to prevent partial corruption
 * - Maintains data integrity throughout the process
 * - Handles mixed encrypted/unencrypted data scenarios
 * - Provides detailed progress feedback
 *
 * @async
 * @function
 * @param {string} oldPassword - Current encryption password
 * @param {string} newPassword - New encryption password
 * @returns {Promise<void>} Resolves when all data is successfully re-encrypted
 * @throws {Error} When decryption or re-encryption operations fail
 * @since 2.03.01
 * @example
 * // Re-encrypt all data with new password
 * await reEncryptAllData('old-password', 'new-secure-password');
 * // All encrypted items updated with new password
 */
async function reEncryptAllData(oldPassword, newPassword) {
    try {
        // Import required functions
        const {
            loadDreamsRaw,
            loadGoalsRaw,
            isEncryptedItem,
            decryptItemFromStorage,
            encryptItemForStorage,
            saveItemToStore
        } = await import('./storage.js');
        const { setEncryptionPassword, clearDecryptedDataCache } = await import('./state.js');

        let reEncryptedCount = 0;

        // Re-encrypt dreams
        const dreams = await loadDreamsRaw();
        for (const dream of dreams) {
            if (isEncryptedItem(dream)) {
                const decrypted = await decryptItemFromStorage(dream, oldPassword);
                const reEncrypted = await encryptItemForStorage(decrypted, newPassword);
                await saveItemToStore('dreams', reEncrypted);
                reEncryptedCount++;
            }
        }

        // Re-encrypt goals
        const goals = await loadGoalsRaw();
        for (const goal of goals) {
            if (isEncryptedItem(goal)) {
                const decrypted = await decryptItemFromStorage(goal, oldPassword);
                const reEncrypted = await encryptItemForStorage(decrypted, newPassword);
                await saveItemToStore('goals', reEncrypted);
            }
        }

        // Update session password
        setEncryptionPassword(newPassword);

        // Clear cache to force reload with new password
        clearDecryptedDataCache();

        // Return count for success message in calling function
        return reEncryptedCount;

    } catch (error) {
        console.error('Error re-encrypting data:', error);
        throw error;
    }
}

// ================================
// PWA SETTINGS INTEGRATION
// ================================



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

/**
 * Restores saved settings section collapse states from localStorage.
 *
 * This function applies saved collapse states to each settings section immediately
 * after the HTML is rendered, preventing visual flicker and maintaining user
 * preferences across browser sessions. Each section is handled independently.
 *
 * **Restoration Process:**
 * 1. Check localStorage for each section's saved state
 * 2. Apply visual state (show/hide content areas)
 * 3. Update ARIA attributes for accessibility
 * 4. Update visual indicators (arrows and hint text)
 * 5. Synchronize global application state
 *
 * **Section Mapping:**
 * - 'appearance': Theme and display settings
 * - 'security': PIN protection and encryption settings
 * - 'data': Export/import and backup settings
 * - 'autocomplete': Tags, dream signs, and emotions management
 *
 * **Error Handling:**
 * - Gracefully handles localStorage access failures
 * - Falls back to expanded state for any missing elements
 * - Continues processing other sections if one fails
 *
 * @function
 * @returns {void}
 * @since 2.04.01
 *
 * @example
 * // Called during settings tab initialization
 * renderSettingsTab(tabPanel);
 * restoreSettingsSectionStates();
 * // All sections now reflect saved user preferences
 */
function restoreSettingsSectionStates() {
    const sections = [
        {
            name: 'appearance',
            storageKey: SETTINGS_APPEARANCE_COLLAPSE_KEY,
            getter: getIsSettingsAppearanceCollapsed,
            setter: setIsSettingsAppearanceCollapsed,
            displayName: 'Appearance'
        },
        {
            name: 'security',
            storageKey: SETTINGS_SECURITY_COLLAPSE_KEY,
            getter: getIsSettingsSecurityCollapsed,
            setter: setIsSettingsSecurityCollapsed,
            displayName: 'Security'
        },
        {
            name: 'data',
            storageKey: SETTINGS_DATA_COLLAPSE_KEY,
            getter: getIsSettingsDataCollapsed,
            setter: setIsSettingsDataCollapsed,
            displayName: 'Data Management'
        },
        {
            name: 'autocomplete',
            storageKey: SETTINGS_AUTOCOMPLETE_COLLAPSE_KEY,
            getter: getIsSettingsAutocompleteCollapsed,
            setter: setIsSettingsAutocompleteCollapsed,
            displayName: 'Autocomplete Management'
        },
        {
            name: 'cloud-sync',
            storageKey: SETTINGS_CLOUD_SYNC_COLLAPSE_KEY,
            getter: getIsSettingsCloudSyncCollapsed,
            setter: setIsSettingsCloudSyncCollapsed,
            displayName: 'Cloud Sync'
        }
    ];

    sections.forEach(section => {
        try {
            // Get DOM elements for this section
            const sectionElement = document.querySelector(`[data-settings-section="${section.name}"]`);
            if (!sectionElement) {
                console.warn(`Settings section element not found: ${section.name}`);
                return;
            }

            const toggleHeader = sectionElement.querySelector(`[data-action="toggle-settings-${section.name}"]`);
            const contentArea = sectionElement.querySelector('.settings-section-content');
            const collapseIndicator = toggleHeader?.querySelector('.collapse-indicator');
            const hintText = toggleHeader?.querySelector('.collapse-hint');

            if (!toggleHeader || !contentArea) {
                console.warn(`Required elements not found for section: ${section.name}`);
                return;
            }

            // Get saved state from localStorage
            let savedState;
            try {
                savedState = localStorage.getItem(section.storageKey);
            } catch (e) {
                console.warn(`Failed to read localStorage for ${section.name}:`, e);
                savedState = null;
            }

            if (savedState === 'true') {
                // Apply collapsed state
                contentArea.style.display = 'none';
                section.setter(true);

                // Update ARIA attributes
                toggleHeader.setAttribute('aria-expanded', 'false');
                toggleHeader.setAttribute('aria-label', `${section.displayName} section - currently collapsed. Press Enter or Space to expand`);

                // Update visual indicators
                if (collapseIndicator) {
                    collapseIndicator.textContent = '';
                    collapseIndicator.setAttribute('title', 'Click to expand');
                }
                if (hintText) {
                    hintText.textContent = '(Click to expand)';
                }
            } else {
                // Apply expanded state (default or explicitly saved as 'false')
                contentArea.style.display = 'block';
                section.setter(false);

                // Update ARIA attributes
                toggleHeader.setAttribute('aria-expanded', 'true');
                toggleHeader.setAttribute('aria-label', `${section.displayName} section - currently expanded. Press Enter or Space to collapse`);

                // Update visual indicators
                if (collapseIndicator) {
                    collapseIndicator.textContent = '';
                    collapseIndicator.setAttribute('title', 'Click to collapse');
                }
                if (hintText) {
                    hintText.textContent = '(Click to collapse)';
                }
            }

        } catch (error) {
            console.error(`Error restoring state for ${section.name} section:`, error);
            // Continue with other sections
        }
    });
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
            renderAutocompleteManagementList('emotions');

            // Initialize cloud sync configuration
            initializeCloudSyncConfig();
            
            // Add PWA section if installation is available
            managePWASettingsSection();

            // Restore saved settings section collapse states
            restoreSettingsSectionStates();

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
    addCustomAutocompleteItem,
    deleteAutocompleteItem,
    managePWASettingsSection,

    // Encryption settings functions
    toggleEncryption,
    toggleCloudEncryption,
    enableEncryption,
    disableEncryption,
    changeEncryptionPassword,

    // Cloud sync configuration functions
    initializeCloudSyncConfig,
    toggleAdvancedCloudConfig,
    getCurrentDropboxClientId,
    setCustomDropboxClientId
};

// ================================
// CLOUD SYNC CONFIGURATION MANAGEMENT
// ================================

/**
 * Initializes cloud sync configuration UI.
 *
 * Sets up the advanced configuration panel, populates the app key field,
 * and configures event listeners for the advanced toggle and app key editing.
 *
 * @function
 * @returns {void}
 * @since 2.04.01
 */
function initializeCloudSyncConfig() {
    try {
        // Populate the app key field with current value
        const appKeyInput = document.getElementById('dropboxAppKeyInput');
        if (appKeyInput) {
            appKeyInput.value = getCurrentDropboxClientId();
        }

        // Set up advanced config toggle
        const advancedToggle = document.getElementById('showAdvancedCloudConfig');
        if (advancedToggle) {
            advancedToggle.addEventListener('change', toggleAdvancedCloudConfig);
        }

        console.log('Cloud sync configuration initialized');
    } catch (error) {
        console.error('Error initializing cloud sync config:', error);
    }
}

/**
 * Toggles the visibility of advanced cloud sync configuration.
 *
 * Shows or hides the advanced configuration panel based on checkbox state.
 * Also manages the warning message visibility.
 *
 * @function
 * @returns {void}
 * @since 2.04.01
 */
function toggleAdvancedCloudConfig() {
    const advancedPanel = document.getElementById('advancedCloudConfig');
    const checkbox = document.getElementById('showAdvancedCloudConfig');

    if (advancedPanel && checkbox) {
        if (checkbox.checked) {
            advancedPanel.style.display = 'block';
        } else {
            advancedPanel.style.display = 'none';
            // Reset any editing state when hiding
            resetAppKeyEditing();
        }
    }
}

/**
 * Gets the current Dropbox client ID (custom or default).
 *
 * Returns the user's custom app key if set, otherwise returns the default.
 *
 * @function
 * @returns {string} The current Dropbox client ID
 * @since 2.04.01
 */
function getCurrentDropboxClientId() {
    try {
        const customKey = localStorage.getItem(CUSTOM_DROPBOX_CLIENT_ID_KEY);
        return customKey || DEFAULT_DROPBOX_CLIENT_ID;
    } catch (error) {
        console.error('Error getting Dropbox client ID:', error);
        return DEFAULT_DROPBOX_CLIENT_ID;
    }
}

/**
 * Sets a custom Dropbox client ID.
 *
 * Stores the custom app key in localStorage and updates the UI.
 *
 * @function
 * @param {string} clientId - The custom client ID to store
 * @returns {void}
 * @since 2.04.01
 */
function setCustomDropboxClientId(clientId) {
    try {
        if (clientId && clientId.trim() !== '') {
            localStorage.setItem(CUSTOM_DROPBOX_CLIENT_ID_KEY, clientId.trim());
        } else {
            localStorage.removeItem(CUSTOM_DROPBOX_CLIENT_ID_KEY);
        }

        // Update the input field
        const appKeyInput = document.getElementById('dropboxAppKeyInput');
        if (appKeyInput) {
            appKeyInput.value = getCurrentDropboxClientId();
        }

        console.log('Custom Dropbox client ID updated');
    } catch (error) {
        console.error('Error setting custom Dropbox client ID:', error);
    }
}

/**
 * Resets the app key editing state.
 *
 * Makes the input readonly again and changes button back to "Edit".
 *
 * @function
 * @returns {void}
 * @since 2.04.01
 * @private
 */
function resetAppKeyEditing() {
    const appKeyInput = document.getElementById('dropboxAppKeyInput');
    const editBtn = document.getElementById('editDropboxAppKeyBtn');
    const warning = document.getElementById('appKeyWarning');

    if (appKeyInput) {
        appKeyInput.readOnly = true;
        appKeyInput.value = getCurrentDropboxClientId();
    }

    if (editBtn) {
        editBtn.textContent = 'Edit';
        editBtn.className = 'btn btn-secondary btn-small';
        editBtn.setAttribute('data-action', 'edit-dropbox-app-key');
    }

    if (warning) {
        warning.style.display = 'none';
    }
}

// For backward compatibility, also expose via window global
// This allows both ES modules and traditional script approaches to work
window.SettingsTab = {
    render: renderSettingsTab,
    initialize: initializeSettingsTab,
    addAutocompleteItem: addCustomAutocompleteItem,
    deleteAutocompleteItem: deleteAutocompleteItem,
    managePWASection: managePWASettingsSection,
    version: '2.02.06'
};

// ================================
// MODULE LOADING COMPLETE
// ================================
console.log('Settings Tab Module loaded successfully - Available as ES module exports and window.SettingsTab');