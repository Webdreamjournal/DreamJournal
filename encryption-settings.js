/**
 * @fileoverview Encryption settings and dialogs: the password dialog, loading and saving the encryption
 *   flag, password validation and testing, the encrypt and decrypt progress dialogs,
 *   encryptAllData for turning encryption on, and reEncryptAllData for password changes.
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
    isIndexedDBAvailable,
    isIndexedDBReady,
    loadMetaRecord,
    saveMetaRecord,
    deleteMetaRecord,
    isEncryptedItem,
    decryptItemFromStorage,
    encryptItemForStorage
} from './storage.js';
import { clearDerivedKeys, encryptStoredData, decryptStoredData } from './security-crypto.js';

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
 * Corrects the localStorage encryption flag from what IndexedDB holds.
 *
 * The encryption check record in the meta store is written in the same transaction as the encrypted
 * data, so it is the source of truth; the localStorage flag can be lost or left behind separately
 * (cleared site data, an interrupted change). Rules, applied only when IndexedDB is open:
 * - check record present: encryption is on; a missing or false flag is set to true.
 * - no check record and the flag is true: a journal encrypted before the record existed has encrypted
 *   dreams or goals and stays on; with none, the flag is set to false.
 * - no check record and the flag is not true: nothing is read and the flag is left as it is.
 * When IndexedDB is not open (memory storage, blocked or closed), nothing is changed.
 * A correction also updates the encryption state, through saveEncryptionSettings.
 *
 * @async
 * @function
 * @returns {Promise<boolean>} The encryption flag after reconciling
 * @example
 * await initDB();
 * const encrypted = await reconcileEncryptionFlag();
 */
async function reconcileEncryptionFlag() {
    const flag = loadEncryptionSettings();
    if (!isIndexedDBReady()) return flag;

    try {
        let encrypted;
        if (await loadMetaRecord(ENCRYPTION_CHECK_ID)) {
            encrypted = true;
        } else if (flag) {
            const items = [...await loadDreamsRaw(), ...await loadGoalsRaw()];
            encrypted = items.some(isEncryptedItem);
        } else {
            return flag;
        }
        if (encrypted !== flag) {
            console.warn(`Encryption flag corrected to ${encrypted} from the stored data`);
            if (!(await saveEncryptionSettings(encrypted))) return flag;
        }
        return encrypted;
    } catch (error) {
        console.error('Could not reconcile the encryption flag:', error);
        return flag;
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
 * Id of the meta record that holds the encryption check value.
 * @constant {string}
 */
const ENCRYPTION_CHECK_ID = 'encryptionCheck';

/**
 * Text stored, encrypted, as the encryption check value. Decrypting it back proves that a
 * password is the one the journal was encrypted with, without touching any dream or goal.
 * @constant {string}
 */
const ENCRYPTION_CHECK_TEXT = 'dream-journal-encryption-check-v1';

/**
 * Builds the encryption check record for a password. It is encrypted like a stored item, so it shares
 * the password's derived key and salt and costs no extra key derivation.
 *
 * @async
 * @param {string} password - Encryption password
 * @returns {Promise<{id: string, version: number, data: number[]}>} Record for the meta store
 */
async function createEncryptionCheckRecord(password) {
    const encrypted = await encryptStoredData(ENCRYPTION_CHECK_TEXT, password);
    return { id: ENCRYPTION_CHECK_ID, version: 1, data: Array.from(encrypted) };
}

/**
 * Stores the encryption check value for a password, replacing any earlier one.
 *
 * @async
 * @param {string} password - Encryption password
 * @returns {Promise<void>}
 * @throws {Error} When the record could not be stored
 */
async function saveEncryptionCheck(password) {
    if (!(await saveMetaRecord(await createEncryptionCheckRecord(password)))) {
        throw new Error('The encryption check value could not be saved');
    }
}

/**
 * Deletes the encryption check value (used when encryption is turned off).
 *
 * @async
 * @returns {Promise<void>}
 * @throws {Error} When the record could not be deleted
 */
async function removeEncryptionCheck() {
    if (!(await deleteMetaRecord(ENCRYPTION_CHECK_ID))) {
        throw new Error('The encryption check value could not be removed');
    }
}

/**
 * Compares a password with the stored encryption check value.
 *
 * @async
 * @param {string} password - Password to check
 * @returns {Promise<'valid'|'invalid'|'missing'>} 'valid' if the password decrypts the check value,
 *   'invalid' if it does not, 'missing' if there is no check value (a journal encrypted before it existed)
 */
async function verifyEncryptionCheck(password) {
    const record = await loadMetaRecord(ENCRYPTION_CHECK_ID);
    if (!record || !Array.isArray(record.data)) return 'missing';
    try {
        const text = await decryptStoredData(new Uint8Array(record.data), password);
        return text === ENCRYPTION_CHECK_TEXT ? 'valid' : 'invalid';
    } catch (error) {
        return 'invalid';
    }
}

/**
 * Tests whether a password is the journal's encryption password.
 *
 * Uses the encryption check value, so the answer does not depend on any single dream: a correct
 * password is accepted even if some stored item is damaged, and a wrong one is rejected as a wrong
 * password, not as damaged data. A journal encrypted before the check value existed has none; the
 * password is then tested against the first encrypted dream, and on success the check value is
 * created for next time.
 *
 * @async
 * @function
 * @param {string} password - Password to test for validity
 * @returns {Promise<Object>} Test result with validity and error information
 * @returns {boolean} returns.valid - Whether the password is the encryption password
 * @returns {string} [returns.reason] - 'wrong-password' when the check value rejected it
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
        const check = await verifyEncryptionCheck(password);
        if (check === 'valid') return { valid: true };
        if (check === 'invalid') return { valid: false, reason: 'wrong-password', error: 'Incorrect password' };

        // No check value: test against the first encrypted dream
        const { loadFromStore } = await import('./storage.js');
        const dreams = await loadFromStore('dreams');
        const encryptedDream = dreams.find(d => isEncryptedItem(d));

        if (encryptedDream) {
            await decryptItemFromStorage(encryptedDream, password);
            try {
                await saveEncryptionCheck(password);
            } catch (error) {
                console.warn('Could not store the encryption check value:', error.message);
            }
            return { valid: true };
        }
        // No encrypted data to test against - assume valid for first-time setup
        return { valid: true };
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
 * @param {Object} [options] - Display options
 * @param {number} [options.autoCloseMs] - For 'success': close the dialog by itself after this many ms
 *   (the OK button still closes it at once)
 * @returns {Promise<void>} Resolves when the dialog is dismissed or has closed itself
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
async function showDecryptionProgress(operation, message = '', options = {}) {
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
        // Any earlier timer for this dialog must not close what is shown now
        const autoCloseId = Symbol('autoClose');
        dialog.autoCloseId = null;

        if (canDismiss) {
            // Add event listener for OK button
            const okButton = dialog.querySelector('#decryption-progress-ok');
            const close = () => {
                if (dialog.parentNode) document.body.removeChild(dialog);
                resolve();
            };
            okButton.addEventListener('click', close);

            if (operation === 'success' && options.autoCloseMs > 0) {
                dialog.autoCloseId = autoCloseId;
                setTimeout(() => { if (dialog.autoCloseId === autoCloseId) close(); }, options.autoCloseMs);
            }
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
 * Encrypts all stored dreams, goals and autocomplete data under a password, for turning encryption on.
 *
 * Every item that is not yet encrypted is encrypted in memory first, and the encryption check value
 * is built with them. Everything is then written in one IndexedDB transaction, so the stores end up
 * either entirely plain text or entirely encrypted with the check value present. If an item cannot be
 * encrypted or the write does not commit, nothing is stored, the password's cached key is dropped and
 * the error is thrown. This function does not set the encryption flag or the session password; the
 * caller does that after it resolves.
 *
 * @async
 * @function
 * @param {string} password - Encryption password
 * @returns {Promise<{dreams: number, goals: number, autocomplete: number}>} Number of items encrypted per store
 * @throws {Error} When IndexedDB is not available, an item cannot be encrypted or the write does not commit
 * @example
 * const counts = await encryptAllData('new-password');
 */
async function encryptAllData(password) {
    try {
        if (!isIndexedDBAvailable()) {
            throw new Error('Encryption needs IndexedDB, which is not available');
        }
        const pending = { dreams: [], goals: [], autocomplete: [] };

        const encryptItems = async (items, target) => {
            for (const item of items) {
                if (isEncryptedItem(item)) continue;
                target.push(await encryptItemForStorage(item, password));
            }
        };

        updateEncryptionProgress('Processing dreams...');
        await encryptItems(await loadDreamsRaw(), pending.dreams);

        updateEncryptionProgress('Processing goals...');
        await encryptItems(await loadGoalsRaw(), pending.goals);

        updateEncryptionProgress('Processing autocomplete data...');
        for (const type of ['tags', 'dreamSigns', 'emotions']) {
            const stored = await getAutocompleteSuggestionsRawData(type);
            if (stored) await encryptItems([stored], pending.autocomplete);
        }

        updateEncryptionProgress('Saving encrypted data...');
        // The check value goes in the same transaction as the data it verifies
        const stores = Object.fromEntries(Object.entries(pending).filter(([, items]) => items.length > 0));
        stores.meta = [await createEncryptionCheckRecord(password)];
        if (!(await putItemsInStores(stores))) {
            throw new Error('The encrypted data could not be saved');
        }

        clearDecryptedDataCache();
        return { dreams: pending.dreams.length, goals: pending.goals.length, autocomplete: pending.autocomplete.length };
    } catch (error) {
        // Nothing was written, so the stored data is still plain text
        clearDerivedKeys(password);
        console.error('Encryption error:', error);
        throw error;
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
        // The check value goes in the same transaction, so the data and the value that verifies the
        // password are never stored under different passwords
        const checkRecord = await createEncryptionCheckRecord(newPassword);
        if (isIndexedDBAvailable()) stores.meta = [checkRecord];
        if (Object.keys(stores).length > 0 && !(await putItemsInStores(stores))) {
            throw new Error('The re-encrypted data could not be saved');
        }
        if (!isIndexedDBAvailable() && !(await saveMetaRecord(checkRecord))) {
            throw new Error('The encryption check value could not be saved');
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
    reconcileEncryptionFlag,
    loadEncryptionSettings,
    saveEncryptionSettings,
    validateEncryptionPassword,
    testEncryptionPassword,
    saveEncryptionCheck,
    removeEncryptionCheck,
    verifyEncryptionCheck,
    showEncryptionProgress,
    showDecryptionProgress,
    updateEncryptionProgress,
    encryptAllData,
    reEncryptAllData,
    updateDecryptionProgress
};
