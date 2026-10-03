/**
 * @fileoverview Encryption settings and dialogs: the password dialog, loading and saving the encryption
 *   flag, password validation and testing, the encrypt and decrypt progress dialogs, and
 *   reEncryptAllData for password changes.
 *
 * @module EncryptionSettings
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { setEncryptionPassword, clearDecryptedDataCache } from './state.js';
import {
    isLocalStorageAvailable,
    loadDreamsRaw,
    loadGoalsRaw,
    getAutocompleteSuggestionsRawData,
    putItemsInStores,
    isEncryptedItem,
    decryptItemFromStorage,
    encryptItemForStorage
} from './storage.js';
import { clearDerivedKeys } from './security-crypto.js';

// ================================
// TYPE DEFINITIONS
// ================================

/**
 * Configuration object for password dialog display.
 * 
 * @typedef {Object} PasswordDialogConfig
 * @property {string} title - Dialog title text
 * @property {string} description - Dialog description/instructions
 * @property {boolean} [requireConfirm=false] - Whether to show password confirmation field
 * @property {string} primaryButtonText - Text for primary action button
 * @since 2.0.0
 */
    
// ================================
// 2. PASSWORD DIALOG SYSTEM
// ================================

/**
 * Displays a modal password dialog for export/import operations with configurable options.
 * 
 * Creates a customizable password entry dialog that supports both single password entry
 * and password confirmation modes. The dialog is fully accessible with proper focus management,
 * keyboard navigation (Enter key support), and inline error display. Returns a Promise that
 * resolves with the entered password or null if cancelled.
 * 
 * @async
 * @param {PasswordDialogConfig} config - Dialog configuration object
 * @param {string} config.title - Dialog title text
 * @param {string} config.description - Dialog description/instructions (supports HTML)
 * @param {boolean} [config.requireConfirm=false] - Whether to show password confirmation field
 * @param {string} config.primaryButtonText - Text for primary action button
 * @returns {Promise<string|null>} Entered password string, or null if cancelled
 * @since 2.0.0
 * @example
 * // Simple password entry
 * const password = await showPasswordDialog({
 *   title: 'Enter Password',
 *   description: 'Please enter your password to encrypt the export file.',
 *   primaryButtonText: 'Encrypt & Export'
 * });
 * 
 * @example
 * // Password entry with confirmation
 * const password = await showPasswordDialog({
 *   title: 'Create Password',
 *   description: 'Create a password to protect your exported dreams.',
 *   requireConfirm: true,
 *   primaryButtonText: 'Create Export'
 * });
 * if (password) {
 *   // User entered matching passwords
 *   await exportWithPassword(password);
 * } else {
 *   // User cancelled
 *   console.log('Export cancelled');
 * }
 */
function showPasswordDialog(config) {
        return new Promise((resolve) => {
            // Remove any existing password dialog
            const existingOverlay = document.querySelector('.pin-overlay[data-dialog="password"]');
            if (existingOverlay) existingOverlay.remove();

            const overlay = document.createElement('div');
            overlay.className = 'pin-overlay';
            overlay.style.display = 'flex';
            overlay.setAttribute('data-dialog', 'password');

            const confirmInputHTML = config.requireConfirm ? `
                <input type="password"
                       id="confirmPasswordInput"
                       class="pin-input"
                       placeholder="Confirm password"
                       maxlength="50"
                       style="margin-top: 10px;">
            ` : '';

            overlay.innerHTML = `
                <div class="pin-container">
                    <h2>🔒 ${config.title}</h2>
                    <p>${config.description}</p>
                    <input type="password"
                           id="passwordInput"
                           class="pin-input"
                           placeholder="Enter password"
                           maxlength="50">
                    ${confirmInputHTML}
                    <div class="pin-buttons">
                        <button class="btn btn-primary" id="confirmPasswordBtn">${config.primaryButtonText}</button>
                        <button class="btn btn-secondary" id="cancelPasswordBtn">Cancel</button>
                    </div>
                    <div id="passwordError" class="notification-message error"></div>
                </div>
            `;

            document.body.appendChild(overlay);
            
            const passwordInput = document.getElementById('passwordInput');
            const confirmInput = document.getElementById('confirmPasswordInput');
            const confirmBtn = document.getElementById('confirmPasswordBtn');
            const cancelBtn = document.getElementById('cancelPasswordBtn');
            
            passwordInput.focus();
            
/**
             * Removes the password dialog from the DOM.
             * @private
             */
            function cleanup() {
                document.body.removeChild(overlay);
            }
            
            /**
             * Handles password confirmation and validation.
             * Validates password entries, shows inline errors for mismatched passwords,
             * and resolves the Promise with the entered password.
             * @private
             */
            function handleConfirm() {
                const password = passwordInput.value;
                const confirmPassword = confirmInput ? confirmInput.value : password;
                const errorDiv = document.getElementById('passwordError');

                // Clear previous errors
                if (errorDiv) {
                    errorDiv.style.display = 'none';
                    errorDiv.textContent = '';
                }

                if (!password) {
                    showError('Please enter a password');
                    passwordInput.focus();
                    return;
                }

                if (config.requireConfirm && password !== confirmPassword) {
                    showError('Passwords do not match');
                    confirmInput.focus();
                    return;
                }

                // Run custom validation if provided
                if (config.validate && typeof config.validate === 'function') {
                    const validation = config.validate(password);
                    if (!validation.valid) {
                        showError(validation.error);
                        passwordInput.focus();
                        return;
                    }
                }

                cleanup();
                resolve(password);
            }

            /**
             * Shows error message in the dialog's error container.
             * @private
             * @param {string} message - Error message to display
             */
            function showError(message) {
                const errorDiv = document.getElementById('passwordError');
                if (errorDiv) {
                    errorDiv.textContent = message;
                    errorDiv.style.display = 'block';
                }
            }
            
            /**
             * Handles dialog cancellation.
             * Resolves the Promise with null to indicate cancellation.
             * @private
             */
            function handleCancel() {
                cleanup();
                resolve(null);
            }
            
            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            
            passwordInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    if (config.requireConfirm && !confirmInput.value) {
                        confirmInput.focus();
                    } else {
                        handleConfirm();
                    }
                }
            });
            
            if (confirmInput) {
                confirmInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        handleConfirm();
                    }
                });
            }
        });
    }

// ================================
// 12. ENCRYPTION SETTINGS MANAGEMENT
// ================================

/**
 * Loads encryption settings from localStorage.
 *
 * Reads the encryption enabled setting from localStorage to determine if data
 * encryption is active. Returns false as default for new users or when
 * localStorage is unavailable, ensuring graceful fallback behavior.
 *
 * @function
 * @returns {boolean} True if encryption is enabled, false otherwise
 * @throws {Error} Storage errors are caught and logged, returns false
 * @since 2.03.01
 * @example
 * const encryptionEnabled = loadEncryptionSettings();
 * if (encryptionEnabled) {
 *   // Setup encryption authentication
 * }
 */
function loadEncryptionSettings() {
    if (!isLocalStorageAvailable()) return false;

    try {
        const setting = localStorage.getItem('dreamJournalEncryptionEnabled');
        return setting === 'true';
    } catch (error) {
        console.error('Failed to load encryption settings:', error);
        return false;
    }
}

/**
 * Saves encryption settings to localStorage.
 *
 * Persists the encryption enabled setting to localStorage and updates the
 * global encryption state. Returns true if the save operation was successful,
 * false if localStorage is unavailable or the operation failed.
 *
 * @async
 * @function
 * @param {boolean} enabled - Whether encryption should be enabled
 * @returns {Promise<boolean>} True if save was successful, false otherwise
 * @throws {Error} Storage errors are caught and logged, returns false
 * @since 2.03.01
 * @example
 * const success = await saveEncryptionSettings(true);
 * if (success) {
 *   console.log('Encryption enabled successfully');
 * }
 */
async function saveEncryptionSettings(enabled) {
    if (!isLocalStorageAvailable()) return false;

    try {
        localStorage.setItem('dreamJournalEncryptionEnabled', enabled.toString());

        // Update global encryption state
        const { setEncryptionEnabled } = await import('./state.js');
        setEncryptionEnabled(enabled);

        return true;
    } catch (error) {
        console.error('Failed to save encryption settings:', error);
        return false;
    }
}

/**
 * Validates an encryption password meets security requirements.
 *
 * Performs comprehensive validation of encryption passwords including length
 * requirements, character composition, and common password checks. Returns
 * detailed validation results for user feedback and security enforcement.
 *
 * @function
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with success flag and error message
 * @returns {boolean} returns.valid - Whether password meets all requirements
 * @returns {string} [returns.error] - Error message if validation fails
 * @since 2.03.01
 * @example
 * const validation = validateEncryptionPassword('mypassword123');
 * if (!validation.valid) {
 *   showError(validation.error);
 * }
 */
function validateEncryptionPassword(password) {
    if (!password) {
        return { valid: false, error: 'Password is required' };
    }

    if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters' };
    }

    if (password.length > 128) {
        return { valid: false, error: 'Password must be 128 characters or less' };
    }

    // Check for common weak passwords
    const commonPasswords = [
        'password', '12345678', 'qwerty', 'abc123', 'password123',
        'admin', 'letmein', 'welcome', '123456789', 'password1'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
        return { valid: false, error: 'Password is too common and easily guessed' };
    }

    // Additional security checks can be added here in the future
    return { valid: true };
}

/**
 * Tests if a password can decrypt existing encrypted data.
 *
 * Validates an encryption password by attempting to decrypt any available
 * encrypted content. This is used during password verification to ensure
 * the entered password is correct without exposing the actual data.
 *
 * @async
 * @function
 * @param {string} password - Password to test for validity
 * @returns {Promise<Object>} Test result with validity and error information
 * @returns {boolean} returns.valid - Whether password successfully decrypts data
 * @returns {string} [returns.error] - Error message if test fails
 * @since 2.03.01
 * @example
 * const testResult = await testEncryptionPassword('userpassword');
 * if (testResult.valid) {
 *   // Password is correct
 * }
 */
async function testEncryptionPassword(password) {
    try {
        // Import storage functions
        const { loadFromStore, isEncryptedItem, decryptItemFromStorage } = await import('./storage.js');

        // Try to decrypt any encrypted item to verify password
        const dreams = await loadFromStore('dreams');
        const encryptedDream = dreams.find(d => isEncryptedItem(d));

        if (encryptedDream) {
            await decryptItemFromStorage(encryptedDream, password);
            return { valid: true };
        } else {
            // No encrypted data to test against - assume valid for first-time setup
            return { valid: true };
        }
    } catch (error) {
        return { valid: false, error: error.message };
    }
}


/**
 * Shows a modal progress popup during encryption operations.
 *
 * Creates a non-dismissible modal dialog that displays encryption progress
 * and prevents user interaction until the operation completes. The popup
 * shows loading state, then success or error state with appropriate messaging.
 *
 * **Features:**
 * - Non-dismissible during operation (no overlay click, ESC key disabled)
 * - Loading spinner and progress text during encryption
 * - Success/error state with appropriate icons and messages
 * - OK button only enabled after operation completes
 * - Proper ARIA attributes for accessibility
 * - Follows established cloud sync progress dialog pattern
 *
 * **Operation States:**
 * - 'encrypting': Shows loading spinner with progress message
 * - 'success': Shows success icon with completion message
 * - 'error': Shows error icon with failure message
 *
 * @async
 * @function
 * @param {string} operation - The operation being performed ('encrypting', 'success', 'error')
 * @param {string} [message] - Optional custom message for the operation
 * @returns {Promise<void>} Resolves when user dismisses the completed dialog
 * @throws {Error} When dialog creation or operation fails
 * @since 2.04.01
 *
 * @example
 * // Show encryption progress
 * showEncryptionProgress('encrypting');
 * try {
 *   await performEncryption();
 *   await showEncryptionProgress('success', 'Encryption completed successfully!');
 * } catch (error) {
 *   await showEncryptionProgress('error', 'Encryption failed: ' + error.message);
 * }
 */
async function showEncryptionProgress(operation, message = '') {
    return new Promise((resolve) => {
        let dialog = document.getElementById('encryption-progress-dialog');

        if (!dialog) {
            // Create dialog if it doesn't exist
            dialog = document.createElement('div');
            dialog.id = 'encryption-progress-dialog';
            dialog.className = 'security-dialog-overlay progress-dialog';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'encryption-progress-title');
            document.body.appendChild(dialog);
        }

        let dialogHtml = '';
        let canDismiss = false;

        if (operation === 'encrypting') {
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="encryption-progress-title">🔒 Encrypting Data</h3>
                    <div class="progress-spinner">
                        <div class="spinner"></div>
                    </div>
                    <p id="encryption-progress-message">Encrypting your data...</p>
                    <p><small>Please wait, do not close this window.</small></p>
                    <div class="dialog-actions">
                        <button id="encryption-progress-ok" class="btn btn-primary" disabled>
                            Please Wait...
                        </button>
                    </div>
                </div>
            `;
        } else if (operation === 'success') {
            canDismiss = true;
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="encryption-progress-title">✅ Encryption Successful</h3>
                    <p>${message || 'Your data has been successfully encrypted.'}</p>
                    <div class="dialog-actions">
                        <button id="encryption-progress-ok" class="btn btn-primary">
                            OK
                        </button>
                    </div>
                </div>
            `;
        } else if (operation === 'error') {
            canDismiss = true;
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="encryption-progress-title">❌ Encryption Failed</h3>
                    <p>${message || 'An error occurred while encrypting your data.'}</p>
                    <div class="dialog-actions">
                        <button id="encryption-progress-ok" class="btn btn-primary">
                            OK
                        </button>
                    </div>
                </div>
            `;
        }

        dialog.innerHTML = dialogHtml;

        if (canDismiss) {
            // Add event listener for OK button
            const okButton = dialog.querySelector('#encryption-progress-ok');
            okButton.addEventListener('click', () => {
                document.body.removeChild(dialog);
                resolve();
            });
        }

        if (!canDismiss) {
            // Disable ESC key and overlay click
            dialog.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            document.addEventListener('keydown', function preventEsc(e) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
        }
    });
}

/**
 * Shows a modal progress popup during decryption operations.
 *
 * Creates a non-dismissible modal dialog that displays decryption progress
 * and prevents user interaction until the operation completes. The popup
 * shows loading state, then success or error state with appropriate messaging.
 *
 * **Features:**
 * - Non-dismissible during operation (no overlay click, ESC key disabled)
 * - Loading spinner and progress text during decryption
 * - Success/error state with appropriate icons and messages
 * - OK button only enabled after operation completes
 * - Proper ARIA attributes for accessibility
 * - Follows established cloud sync progress dialog pattern
 *
 * **Operation States:**
 * - 'decrypting': Shows loading spinner with progress message
 * - 'success': Shows success icon with completion message
 * - 'error': Shows error icon with failure message
 *
 * @async
 * @function
 * @param {string} operation - The operation being performed ('decrypting', 'success', 'error')
 * @param {string} [message] - Optional custom message for the operation
 * @returns {Promise<void>} Resolves when user dismisses the completed dialog
 * @throws {Error} When dialog creation or operation fails
 * @since 2.04.01
 *
 * @example
 * // Show decryption progress
 * showDecryptionProgress('decrypting');
 * try {
 *   await performDecryption();
 *   await showDecryptionProgress('success', 'Decryption completed successfully!');
 * } catch (error) {
 *   await showDecryptionProgress('error', 'Decryption failed: ' + error.message);
 * }
 */
async function showDecryptionProgress(operation, message = '') {
    return new Promise((resolve) => {
        let dialog = document.getElementById('decryption-progress-dialog');

        if (!dialog) {
            // Create dialog if it doesn't exist
            dialog = document.createElement('div');
            dialog.id = 'decryption-progress-dialog';
            dialog.className = 'security-dialog-overlay progress-dialog';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'decryption-progress-title');
            document.body.appendChild(dialog);
        }

        let dialogHtml = '';
        let canDismiss = false;

        if (operation === 'decrypting') {
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="decryption-progress-title">🔓 Decrypting Data</h3>
                    <div class="progress-spinner">
                        <div class="spinner"></div>
                    </div>
                    <p id="decryption-progress-message">Decrypting your data...</p>
                    <p><small>Please wait, do not close this window.</small></p>
                    <div class="dialog-actions">
                        <button id="decryption-progress-ok" class="btn btn-primary" disabled>
                            Please Wait...
                        </button>
                    </div>
                </div>
            `;
        } else if (operation === 'success') {
            canDismiss = true;
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="decryption-progress-title">✅ Decryption Successful</h3>
                    <p>${message || 'Your data has been successfully decrypted.'}</p>
                    <div class="dialog-actions">
                        <button id="decryption-progress-ok" class="btn btn-primary">
                            OK
                        </button>
                    </div>
                </div>
            `;
        } else if (operation === 'error') {
            canDismiss = true;
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="decryption-progress-title">❌ Decryption Failed</h3>
                    <p>${message || 'An error occurred while decrypting your data.'}</p>
                    <div class="dialog-actions">
                        <button id="decryption-progress-ok" class="btn btn-primary">
                            OK
                        </button>
                    </div>
                </div>
            `;
        }

        dialog.innerHTML = dialogHtml;

        if (canDismiss) {
            // Add event listener for OK button
            const okButton = dialog.querySelector('#decryption-progress-ok');
            okButton.addEventListener('click', () => {
                document.body.removeChild(dialog);
                resolve();
            });
        }

        if (!canDismiss) {
            // Disable ESC key and overlay click
            dialog.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            document.addEventListener('keydown', function preventEsc(e) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
        }
    });
}

/**
 * Updates the message in an active encryption progress dialog.
 *
 * This helper function allows updating the progress message while
 * the encryption dialog is already showing, useful for providing
 * detailed feedback during long operations.
 *
 * @function
 * @param {string} message - The new message to display
 * @returns {void}
 * @since 2.04.01
 *
 * @example
 * // Update progress message during encryption
 * updateEncryptionProgress('Processing dreams...');
 * // ... encrypt dreams ...
 * updateEncryptionProgress('Processing goals...');
 */
function updateEncryptionProgress(message) {
    const messageElement = document.getElementById('encryption-progress-message');
    if (messageElement) {
        messageElement.textContent = message;
    }
}

/**
 * Re-encrypts all encrypted dreams, goals and autocomplete data under a new password.
 *
 * Every encrypted item is decrypted with the old password and encrypted with the new one
 * in memory first, so a wrong password or a damaged item throws before anything is written.
 * The results are then written in one IndexedDB transaction, so the stores end up either
 * entirely under the old password or entirely under the new one. Items that are not
 * encrypted are left as they are. On success the session password is replaced, the old
 * password's cached key is dropped and the decrypted-data cache is cleared.
 *
 * @async
 * @function
 * @param {string} oldPassword - Current encryption password
 * @param {string} newPassword - New encryption password
 * @returns {Promise<number>} Number of items re-encrypted (dreams, goals and autocomplete lists)
 * @throws {Error} When an item cannot be decrypted or the write does not commit; stored data is unchanged
 * @since 2.03.05
 * @example
 * const count = await reEncryptAllData('old-password', 'new-password');
 */
async function reEncryptAllData(oldPassword, newPassword) {
    try {
        const pending = { dreams: [], goals: [], autocomplete: [] };

        const reEncryptItems = async (items, target) => {
            for (const item of items) {
                if (!isEncryptedItem(item)) continue;
                const decrypted = await decryptItemFromStorage(item, oldPassword);
                target.push(await encryptItemForStorage(decrypted, newPassword));
            }
        };

        updateEncryptionProgress('Re-encrypting dreams...');
        await reEncryptItems(await loadDreamsRaw(), pending.dreams);

        updateEncryptionProgress('Re-encrypting goals...');
        await reEncryptItems(await loadGoalsRaw(), pending.goals);

        updateEncryptionProgress('Re-encrypting autocomplete data...');
        for (const type of ['tags', 'dreamSigns', 'emotions']) {
            const stored = await getAutocompleteSuggestionsRawData(type);
            if (stored) await reEncryptItems([stored], pending.autocomplete);
        }

        updateEncryptionProgress('Saving re-encrypted data...');
        const stores = Object.fromEntries(Object.entries(pending).filter(([, items]) => items.length > 0));
        if (Object.keys(stores).length > 0 && !(await putItemsInStores(stores))) {
            throw new Error('The re-encrypted data could not be saved');
        }

        setEncryptionPassword(newPassword);
        clearDerivedKeys(oldPassword);
        clearDecryptedDataCache();

        return pending.dreams.length + pending.goals.length + pending.autocomplete.length;
    } catch (error) {
        // Nothing was written, so the stored data still uses the old password
        clearDerivedKeys(newPassword);
        console.error('Re-encryption error:', error);
        throw error;
    }
}

/**
 * Updates the message in an active decryption progress dialog.
 *
 * This helper function allows updating the progress message while
 * the decryption dialog is already showing, useful for providing
 * detailed feedback during long operations.
 *
 * @function
 * @param {string} message - The new message to display
 * @returns {void}
 * @since 2.04.01
 *
 * @example
 * // Update progress message during decryption
 * updateDecryptionProgress('Processing dreams...');
 * // ... decrypt dreams ...
 * updateDecryptionProgress('Processing goals...');
 */
function updateDecryptionProgress(message) {
    const messageElement = document.getElementById('decryption-progress-message');
    if (messageElement) {
        messageElement.textContent = message;
    }
}

// ================================
// ES MODULE EXPORTS
// ================================

export {
    showPasswordDialog,
    loadEncryptionSettings,
    saveEncryptionSettings,
    validateEncryptionPassword,
    testEncryptionPassword,
    showEncryptionProgress,
    showDecryptionProgress,
    updateEncryptionProgress,
    reEncryptAllData,
    updateDecryptionProgress
};
