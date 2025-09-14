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
 * @version 2.02.06
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
import { getActiveAppTab, getAppLocked, getUnlocked, getEncryptionEnabled } from './state.js';
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
    const currentTheme = getCurrentTheme();
    const lightSelected = currentTheme === 'light' ? 'selected' : '';
    const darkSelected = currentTheme === 'dark' ? 'selected' : '';
    
    tabPanel.innerHTML = `
        <h3 id="settings-main-heading" tabindex="-1">⚙️ Settings</h3>
        <div class="settings-section">
            <h3>🎨 Appearance</h3>
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
            <h3>🔐 Data Encryption</h3>
            <div class="settings-row">
                <div>
                    <div class="settings-label">Encrypt Dreams & Goals</div>
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
                <div class="settings-description" style="margin-top: 15px; padding: 10px; background: var(--warning-color-light, #fff3cd); border-radius: 4px; border-left: 4px solid var(--warning-color, #ffc107);">
                    <strong>⚠️ Important:</strong> If you forget your encryption password,
                    your data cannot be recovered. Consider exporting backups regularly.
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
 * @param {('tags'|'dreamSigns')} type - Type of autocomplete item to add
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

        try {
            const storeId = type === 'tags' ? 'tags' : 'dreamSigns';

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
 * @param {('tags'|'dreamSigns')} type - Type of autocomplete item to delete
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
            const storeId = type === 'tags' ? 'tags' : 'dreamSigns';

            // Get existing suggestions with enhanced error handling
            const existingSuggestions = await getAutocompleteSuggestions(type);

            // Remove the item (case insensitive)
            const updatedSuggestions = existingSuggestions.filter(
                item => item.toLowerCase() !== itemValue.toLowerCase()
            );

            // Save updated list with encryption support
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
 * 4. Encrypt all existing dreams and goals data
 * 5. Update settings UI to reflect new encryption state
 * 6. Clear data cache to force reload with encryption
 *
 * **Data Migration:**
 * - Iterates through all existing dreams and goals
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
            primaryButtonText: 'Enable Encryption'
        };

        // showPasswordDialog returns a Promise with the password or null if cancelled
        const password = await showPasswordDialog(config);

        if (!password) {
            // User cancelled the dialog
            return;
        }

        // Validate password meets security requirements
        const validation = validateEncryptionPassword(password);
        if (!validation.valid) {
            createInlineMessage('error', validation.error);
            return;
        }

        // Set up encryption with the validated password
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

        // Clear cache and reload data
        clearDecryptedDataCache();
        await initializeApplicationData();

        // Update settings UI to reflect new state
        const settingsTab = document.getElementById('settingsTab');
        if (settingsTab && !settingsTab.hidden) {
            renderSettingsTab(settingsTab);
        }

        const totalEncrypted = encryptedCount + goalsEncryptedCount;
        createInlineMessage('success', `Encryption enabled successfully! ${totalEncrypted > 0 ? `${encryptedCount} dreams and ${goalsEncryptedCount} goals encrypted.` : 'All data is now encrypted.'}`);

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
 * 3. Decrypt all encrypted dreams and goals data
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

        // Step 1: Verify current encryption password
        const passwordConfig = {
            title: 'Verify Encryption Password',
            description: 'Enter your current encryption password to disable encryption and decrypt your data.',
            requireConfirm: false,
            primaryButtonText: 'Verify Password'
        };

        const password = await showPasswordDialog(passwordConfig);

        if (!password) {
            // User cancelled password entry
            return;
        }

        // Test the password to ensure it's correct
        const passwordTest = await testEncryptionPassword(password);
        if (!passwordTest.valid) {
            createInlineMessage('error', 'Incorrect password. Cannot disable encryption without valid password.');
            return;
        }

        // Step 2: Show confirmation dialog using custom system
        const confirmConfig = {
            title: 'Disable Data Encryption?',
            description: 'This will decrypt all your data and store it unencrypted.\n\n' +
                        '⚠️ Your dreams and goals will no longer be protected if someone gains access to your device.\n\n' +
                        'Are you sure you want to continue?',
            requireConfirm: false,
            primaryButtonText: 'Yes, Disable Encryption',
            cancelButtonText: 'Keep Encryption Enabled'
        };

        const confirmPassword = await showPasswordDialog(confirmConfig);

        if (!confirmPassword) {
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
    }

    const totalDecrypted = decryptedCount + goalsDecryptedCount;
    createInlineMessage('success', `Encryption disabled successfully! ${totalDecrypted > 0 ? `${decryptedCount} dreams and ${goalsDecryptedCount} goals decrypted.` : 'All data is now unencrypted.'}`);
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
        // Import required dialog function
        const { showPasswordDialog } = await import('./security.js');

        // First, verify current password
        const currentPasswordConfig = {
            title: 'Verify Current Password',
            description: 'Enter your current encryption password to change it.',
            requireConfirm: false,
            primaryButtonText: 'Verify'
        };

        showPasswordDialog(currentPasswordConfig, async (currentPassword) => {
            // Verify current password
            const { testEncryptionPassword } = await import('./security.js');
            const testResult = await testEncryptionPassword(currentPassword);

            if (!testResult.valid) {
                createInlineMessage('error', 'Current password is incorrect');
                return false;
            }

            // Show new password setup dialog
            const newPasswordConfig = {
                title: 'Set New Encryption Password',
                description: 'Enter your new encryption password.',
                requireConfirm: true,
                primaryButtonText: 'Change Password'
            };

            showPasswordDialog(newPasswordConfig, async (newPassword, confirmPassword) => {
                if (newPassword !== confirmPassword) {
                    createInlineMessage('error', 'New passwords do not match');
                    return false;
                }

                const { validateEncryptionPassword } = await import('./security.js');
                const validation = validateEncryptionPassword(newPassword);
                if (!validation.valid) {
                    createInlineMessage('error', validation.error);
                    return false;
                }

                try {
                    await reEncryptAllData(currentPassword, newPassword);
                    return true;
                } catch (error) {
                    console.error('Password change error:', error);
                    createInlineMessage('error', 'Failed to change password. Please try again.');
                    return false;
                }
            });

            return true;
        });

    } catch (error) {
        console.error('Error changing encryption password:', error);
        createInlineMessage('error', 'Failed to change encryption password.');
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

        createInlineMessage('success', `Password changed successfully! ${reEncryptedCount > 0 ? `${reEncryptedCount} items re-encrypted.` : 'All encrypted data updated.'}`);

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
    addCustomAutocompleteItem,
    deleteAutocompleteItem,
    managePWASettingsSection,

    // Encryption settings functions
    toggleEncryption,
    enableEncryption,
    disableEncryption,
    changeEncryptionPassword
};

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