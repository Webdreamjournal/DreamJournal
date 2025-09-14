/**
 * @fileoverview Security module for Dream Journal application cryptography and PIN management.
 * 
 * This module provides comprehensive security functionality for the Dream Journal application,
 * including data encryption/decryption, PIN-based authentication, recovery systems, and
 * secure storage management. All cryptographic operations use the Web Crypto API with
 * industry-standard algorithms (AES-GCM for encryption, PBKDF2 for key derivation).
 * 
 * Key Features:
 * - AES-GCM data encryption with password-based key derivation
 * - Secure PIN hashing with PBKDF2 and salt
 * - Backwards compatibility with legacy PIN formats
 * - Multi-factor recovery system (dream title verification + timer reset)
 * - Fallback storage system (IndexedDB → localStorage → memory)
 * - Complete PIN lifecycle management (setup, change, removal)
 * - Lock screen interface with PIN verification
 * - Password dialog system for import/export operations
 * 
 * @module Security
 * @version 2.02.05
 * @author Dream Journal Development Team
 * @since 1.0.0
 * @requires constants
 * @requires storage
 * @requires dom-helpers
 * @example
 * // Encrypt data for export
 * const encrypted = await encryptData(JSON.stringify(data), password);
 * 
 * @example
 * // Setup PIN protection
 * const success = await storePinHash('123456');
 * if (success) {
 *   updateSecurityControls();
 * }
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { CONSTANTS } from './constants.js';
import {
    isAppLocked,
    isUnlocked,
    getFailedPinAttempts,
    setFailedPinAttempts,
    preLockActiveTab,
    setPreLockActiveTab,
    activeAppTab,
    setUnlocked,
    setAppLocked,
    setEncryptionPassword,
    clearDecryptedDataCache
} from './state.js';
import { createInlineMessage, switchAppTab, showAllTabButtons, hideAllTabButtons, renderPinScreen } from './dom-helpers.js';
import {
    isLocalStorageAvailable, loadDreams, saveItemToStore,
    loadDreamsRaw, loadGoalsRaw, getAutocompleteSuggestionsRaw,
    isEncryptedItem, decryptItemFromStorage, encryptItemForStorage
} from './storage.js';
import { displayDreams } from './dream-crud.js';

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

/**
 * Result object from secure PIN hashing operation.
 * 
 * @typedef {Object} SecurePinHashResult
 * @property {string} hash - Hexadecimal string representation of derived hash
 * @property {string} salt - Hexadecimal string representation of random salt
 * @since 2.0.0
 */

/**
 * PIN storage object for fallback memory storage system.
 * 
 * @typedef {Object} PinStorageState
 * @property {string|null} hash - Stored PIN hash (JSON string or legacy hash)
 * @property {number|null} resetTime - Timestamp for PIN reset timer expiration
 * @since 2.0.0
 */

/**
 * Configuration object for PIN screen rendering.
 * 
 * @typedef {Object} PinScreenConfig
 * @property {string} title - Screen title
 * @property {string} icon - Emoji or icon character
 * @property {string} message - HTML message content
 * @property {Array<Object>} [inputs] - Input field configurations
 * @property {Array<Object>} [buttons] - Button configurations
 * @property {Array<Object>} [links] - Link configurations
 * @property {boolean} [feedbackContainer=false] - Whether to include feedback container
 * @since 2.0.0
 */

// ================================
// 1. CRYPTOGRAPHIC UTILITIES
// ================================
    
/**
 * Generates a cryptographically secure random salt for encryption operations.
 * 
 * Uses the Web Crypto API's getRandomValues method to generate a 16-byte (128-bit)
 * salt for use in PBKDF2 key derivation. The salt ensures that identical passwords
 * produce different encryption keys, preventing rainbow table attacks.
 * 
 * @returns {Uint8Array} 16-byte cryptographically secure random salt
 * @throws {Error} When crypto.getRandomValues is not available
 * @since 2.0.0
 * @example
 * const salt = generateSalt();
 * console.log(salt.length); // 16
 * console.log(salt instanceof Uint8Array); // true
 */
function generateSalt() {
    return crypto.getRandomValues(new Uint8Array(16));
}
    
/**
 * Generates a cryptographically secure random initialization vector (IV) for AES-GCM encryption.
 * 
 * Creates a 12-byte (96-bit) IV which is the recommended size for AES-GCM mode.
 * Each encryption operation must use a unique IV to ensure semantic security.
 * The IV is not secret and is stored alongside the encrypted data.
 * 
 * @returns {Uint8Array} 12-byte cryptographically secure random IV
 * @throws {Error} When crypto.getRandomValues is not available
 * @since 2.0.0
 * @example
 * const iv = generateIV();
 * console.log(iv.length); // 12
 * console.log(iv instanceof Uint8Array); // true
 */
function generateIV() {
    return crypto.getRandomValues(new Uint8Array(12));
}
    
/**
 * Derives an AES-256-GCM encryption key from a password using PBKDF2.
 * 
 * Uses Password-Based Key Derivation Function 2 (PBKDF2) with SHA-256 hash function
 * and 100,000 iterations to derive a 256-bit AES key from the provided password and salt.
 * The high iteration count provides protection against brute-force attacks.
 * 
 * @async
 * @param {string} password - User-provided password for key derivation
 * @param {Uint8Array} salt - Cryptographically secure random salt (16 bytes)
 * @returns {Promise<CryptoKey>} AES-256-GCM key suitable for encrypt/decrypt operations
 * @throws {Error} When Web Crypto API operations fail
 * @since 2.0.0
 * @example
 * const salt = generateSalt();
 * const key = await deriveKey('mypassword', salt);
 * // Key can now be used for AES-GCM encryption/decryption
 */
async function deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}
    
/**
 * Encrypts string data using AES-256-GCM with password-based key derivation.
 * 
 * This function provides authenticated encryption of string data using a user-provided password.
 * The encryption process:
 * 1. Generates a random 16-byte salt and 12-byte IV
 * 2. Derives an AES-256 key using PBKDF2 with 100,000 iterations
 * 3. Encrypts the data using AES-GCM (provides both confidentiality and authenticity)
 * 4. Concatenates salt + IV + encrypted data into a single Uint8Array
 * 
 * The resulting format is: [16-byte salt][12-byte IV][encrypted data + auth tag]
 * 
 * @async
 * @param {string} data - Plain text data to encrypt
 * @param {string} password - Password for key derivation
 * @returns {Promise<Uint8Array>} Combined salt, IV, and encrypted data
 * @throws {Error} When encryption operations fail or invalid inputs provided
 * @since 2.0.0
 * @example
 * const plaintext = JSON.stringify({ dreams: [...] });
 * const encrypted = await encryptData(plaintext, 'user_password');
 * // encrypted can be saved to file or transmitted
 */
async function encryptData(data, password) {
    try {
        const encoder = new TextEncoder();
        const salt = generateSalt();
        const iv = generateIV();
        const key = await deriveKey(password, salt);
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encoder.encode(data)
        );
        
        // Combine salt, iv, and encrypted data
        const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        result.set(salt, 0);
        result.set(iv, salt.length);
        result.set(new Uint8Array(encrypted), salt.length + iv.length);
        
        return result;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}
    
/**
 * Decrypts AES-256-GCM encrypted data using password-based key derivation.
 * 
 * This function reverses the encryption process performed by encryptData():
 * 1. Extracts the salt (first 16 bytes) and IV (next 12 bytes) from the encrypted data
 * 2. Derives the same AES-256 key using PBKDF2 with the extracted salt
 * 3. Decrypts the remaining data using AES-GCM
 * 4. Returns the original plaintext string
 * 
 * AES-GCM provides authenticated decryption, so this function will fail if the data
 * has been tampered with or if the wrong password is used.
 * 
 * @async
 * @param {Uint8Array} encryptedData - Combined salt, IV, and encrypted data from encryptData()
 * @param {string} password - Password used for original encryption
 * @returns {Promise<string>} Original plaintext data
 * @throws {Error} When decryption fails due to incorrect password, corrupted data, or crypto errors
 * @since 2.0.0
 * @example
 * const encrypted = await encryptData('secret data', 'password');
 * const decrypted = await decryptData(encrypted, 'password');
 * console.log(decrypted); // 'secret data'
 * 
 * @example
 * // Handling decryption errors
 * try {
 *   const decrypted = await decryptData(encryptedData, userPassword);
 *   console.log('Decryption successful:', decrypted);
 * } catch (error) {
 *   console.error('Wrong password or corrupted file');
 * }
 */
async function decryptData(encryptedData, password) {
    try {
        const salt = encryptedData.slice(0, 16);
        const iv = encryptedData.slice(16, 28);
        const encrypted = encryptedData.slice(28);
        
        const key = await deriveKey(password, salt);
        
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encrypted
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data - incorrect password or corrupted file');
    }
}
    
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
// 3. PIN HASHING & VERIFICATION SYSTEM
// ================================

/**
 * Legacy PIN hashing function using simple character code accumulation.
 * 
 * @deprecated Since version 2.0.0 - kept only for backwards compatibility with existing PIN hashes.
 * This function uses a weak hashing algorithm and should not be used for new PIN storage.
 * New PINs should use hashPinSecure() which implements PBKDF2 with salt.
 * 
 * This function is only used during PIN verification to support users who set their
 * PIN before the security upgrade. After successful verification, the PIN should be
 * migrated to the secure format.
 * 
 * @param {string} pin - PIN string to hash (typically 4-6 digits)
 * @returns {string} Simple hash as string (not cryptographically secure)
 * @since 1.0.0
 * @example
 * // Only used internally for legacy PIN verification
 * const legacyHash = hashPinLegacy('123456');
 * console.log(typeof legacyHash); // 'string'
 */
function hashPinLegacy(pin) {
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
        const char = pin.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
}

/**
 * Securely hashes a PIN using PBKDF2 with salt and configurable iterations.
 * 
 * This function implements secure PIN storage using industry-standard PBKDF2
 * key derivation with SHA-256 hash function. Uses a random salt to prevent
 * rainbow table attacks and configurable iteration count for adjustable security.
 * The result includes both the derived hash and salt in hexadecimal format
 * for easy storage and retrieval.
 * 
 * @async
 * @param {string} pin - PIN string to hash (typically 4-6 digits)
 * @param {Uint8Array} [salt] - Optional salt bytes; generates new salt if not provided
 * @returns {Promise<SecurePinHashResult>} Object containing hex-encoded hash and salt
 * @throws {Error} When Web Crypto API operations fail or PIN is invalid
 * @since 2.0.0
 * @example
 * // Hash new PIN (generates random salt)
 * const result = await hashPinSecure('123456');
 * console.log(result.hash); // '3a7bd...' (64 hex characters)
 * console.log(result.salt); // '7f2c1...' (32 hex characters)
 * 
 * @example
 * // Hash PIN with existing salt (for verification)
 * const existingSalt = new Uint8Array([...]);
 * const result = await hashPinSecure('123456', existingSalt);
 * // result.hash can be compared with stored hash
 */
async function hashPinSecure(pin, salt = null) {
    try {
        if (!salt) salt = generateSalt();
        
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(pin),
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );
        
        // Derive bits instead of key to avoid extractability issues
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: CONSTANTS.CRYPTO_PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            CONSTANTS.CRYPTO_KEY_LENGTH
        );
        
        // Convert to hex strings for storage
        const hashArray = Array.from(new Uint8Array(derivedBits));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        const saltArray = Array.from(salt);
        const saltHex = saltArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return {
            hash: hashHex,
            salt: saltHex
        };
    } catch (error) {
        console.error('Secure PIN hashing error:', error);
        throw new Error('Failed to hash PIN securely');
    }
}

/**
 * Detects whether stored PIN data uses legacy or secure format for backwards compatibility.
 * 
 * Determines the format of stored PIN data to handle migration from legacy (simple hash string)
 * to secure format (JSON object with hash and salt). This enables seamless upgrade of existing
 * user PINs without requiring re-entry.
 * 
 * Format detection rules:
 * - Legacy: Plain string (simple hash) or non-JSON data
 * - Secure: Valid JSON string containing 'hash' and 'salt' properties
 * 
 * @param {string} storedData - Stored PIN data from storage system
 * @returns {boolean} True if data uses legacy format, false if secure format
 * @since 2.0.0
 * @example
 * // Legacy format detection
 * console.log(isLegacyPinFormat('12345678')); // true (plain hash string)
 * 
 * @example
 * // Secure format detection
 * const secureData = JSON.stringify({ hash: 'abc123...', salt: 'def456...' });
 * console.log(isLegacyPinFormat(secureData)); // false (JSON with hash/salt)
 * 
 * @example
 * // Usage in PIN verification
 * if (isLegacyPinFormat(storedData)) {
 *   // Use legacy verification method
 *   return hashPinLegacy(enteredPin) === storedData;
 * } else {
 *   // Use secure verification method
 *   const { hash, salt } = JSON.parse(storedData);
 *   return await verifySecurePin(enteredPin, hash, salt);
 * }
 */
function isLegacyPinFormat(storedData) {
    if (typeof storedData === 'string') {
        try {
            const parsed = JSON.parse(storedData);
            return !(parsed && parsed.hash && parsed.salt);
        } catch (e) {
            return true; // Not JSON, so it's legacy
        }
    }
    return true;
}
    
// ================================
// 4. PIN STORAGE & MANAGEMENT
// ================================

/**
 * Checks if PIN protection is currently enabled in the application.
 * 
 * Determines whether a PIN has been set up by checking the appropriate storage system.
 * Works with both IndexedDB (preferred) and localStorage fallback systems to maintain
 * functionality across different browser environments.
 * 
 * @returns {boolean} True if PIN protection is enabled, false otherwise
 * @since 1.0.0
 * @example
 * if (isPinSetup()) {
 *   console.log('PIN protection is active');
 *   showLockButton();
 * } else {
 *   console.log('No PIN protection configured');
 *   showSetupButton();
 * }
 */
    
/**
     * Stores a PIN hash securely using the secure PBKDF2 format.
     * 
     * Creates a secure hash of the provided PIN using hashPinSecure() and stores it
     * in the appropriate storage system (IndexedDB or localStorage). Also stores
     * version information to track the PIN format for future compatibility.
     * 
     * @async
     * @param {string} pin - PIN string to hash and store (typically 4-6 digits)
     * @returns {Promise<boolean>} True if storage successful, false if failed
     * @throws {Error} When PIN hashing fails (re-thrown from hashPinSecure)
     * @since 2.0.0
     * @example
     * const success = await storePinHash('123456');
     * if (success) {
     *   console.log('PIN stored successfully');
     *   updateSecurityControls();
     * } else {
     *   console.error('Failed to store PIN');
     * }
     */
    
/**
     * Retrieves stored PIN data from the appropriate storage system.
     * 
     * Gets the stored PIN hash (either legacy format or secure JSON format)
     * from IndexedDB or localStorage depending on available storage type.
     * 
     * @returns {string|null} Stored PIN data string, or null if no PIN is stored
     * @since 1.0.0
     * @example
     * const storedData = getStoredPinData();
     * if (storedData) {
     *   if (isLegacyPinFormat(storedData)) {
     *     console.log('Legacy PIN format detected');
     *   } else {
     *     console.log('Secure PIN format detected');
     *   }
     * }
     */
    
/**
     * Verifies an entered PIN against stored hash data with format compatibility.
     * 
     * Handles verification for both legacy (simple hash) and secure (PBKDF2) PIN formats.
     * For legacy format, uses simple hash comparison. For secure format, recreates
     * the hash using the stored salt and compares with the stored hash.
     * 
     * @async
     * @param {string} enteredPin - PIN entered by user for verification
     * @param {string} storedData - Stored PIN data (legacy hash or secure JSON)
     * @returns {Promise<boolean>} True if PIN matches stored data, false otherwise
     * @since 1.0.0
     * @example
     * const storedData = getStoredPinData();
     * const isValid = await verifyPinHash(userEnteredPin, storedData);
     * if (isValid) {
     *   console.log('PIN verified successfully');
     *   unlockApplication();
     * } else {
     *   console.log('Invalid PIN');
     *   showErrorMessage();
     * }
     */
    
/**
     * Removes stored PIN hash data from all storage systems.
     * 
     * Completely removes PIN protection by deleting the stored hash and version
     * information from both IndexedDB and localStorage. This function effectively
     * disables PIN protection for the application.
     * 
     * @since 1.0.0
     * @example
     * // Remove PIN protection after user confirmation
     * if (await verifyPinHash(enteredPin, storedData)) {
     *   removePinHash();
     *   console.log('PIN protection disabled');
     *   updateSecurityControls();
     * }
     */
async function verifyPinHash(enteredPin, storedData) {
    if (!storedData || !enteredPin) return false;
    
    try {
        // Check for legacy format first
        if (isLegacyPinFormat(storedData)) {
            const legacyHash = hashPinLegacy(enteredPin);
            return legacyHash === storedData;
        }
        
        // Handle secure format
        const stored = JSON.parse(storedData);
        if (!stored.hash || !stored.salt) return false;
        
        // Convert hex salt back to Uint8Array
        const saltArray = [];
        for (let i = 0; i < stored.salt.length; i += 2) {
            saltArray.push(parseInt(stored.salt.substr(i, 2), 16));
        }
        const salt = new Uint8Array(saltArray);
        
        // Hash the entered PIN with the stored salt
        const hashedEntered = await hashPinSecure(enteredPin, salt);
        return hashedEntered.hash === stored.hash;
        
    } catch (error) {
        console.error('PIN verification error:', error);
        return false;
    }
}

// ================================
// 6. FALLBACK STORAGE SYSTEM
// ================================

/**
 * PIN storage object for fallback memory storage system.
 * 
 * Provides in-memory storage for PIN data when IndexedDB is unavailable.
 * This is a fallback mechanism to ensure PIN functionality works even in
 * restricted browser environments. Data stored here is lost on page refresh.
 * 
 * @type {PinStorageState}
 * @since 2.0.0
 */
let pinStorage = {
    hash: null,
    resetTime: null
};

/**
 * Checks if PIN protection is enabled using fallback storage system.
 * 
 * This is an alternative version of isPinSetup() that uses the fallback storage
 * approach. Prioritizes localStorage over memory storage for PIN hash detection.
 * Used when IndexedDB is not available.
 * 
 * @returns {boolean} True if PIN protection is enabled, false otherwise
 * @since 2.0.0
 * @example
 * // Check PIN status with fallback storage
 * if (isPinSetup()) {
 *   console.log('PIN protection active (fallback storage)');
 *   showLockButton();
 * } else {
 *   console.log('No PIN protection (fallback storage)');
 *   showSetupPrompt();
 * }
 */
function isPinSetup() {
    if (isLocalStorageAvailable()) {
        return localStorage.getItem('dreamJournalPinHash') !== null;
    }
    return pinStorage.hash !== null;
}

/**
 * Stores PIN hash securely using PBKDF2 with fallback storage system.
 * 
 * This is an alternative version of storePinHash() that uses the fallback storage
 * approach. Attempts localStorage first, then falls back to memory storage if needed.
 * Uses the secure PBKDF2 hashing format with salt for maximum security.
 * 
 * @async
 * @param {string} pin - PIN string to hash and store
 * @returns {Promise<boolean>} True if storage successful, false if failed
 * @since 2.0.0
 * @example
 * // Store PIN with fallback storage system
 * const success = await storePinHash('123456');
 * if (success) {
 *   console.log('PIN stored with fallback storage');
 * } else {
 *   console.error('Failed to store PIN');
 * }
 */
async function storePinHash(pin) {
        if (!pin) {
            return false;
        }
        
        try {
            // Use secure hashing
            const { hash, salt } = await hashPinSecure(pin);
            const secureData = JSON.stringify({ hash, salt, version: 'secure' });
            
            // Try localStorage first
            if (isLocalStorageAvailable()) {
                try {
                    localStorage.setItem('dreamJournalPinHash', secureData);
                    return true;
                } catch (error) {
                    console.error('Error storing secure PIN hash:', error);
                    // Fall through to memory storage
                }
            }
            
            // Fallback to memory storage
            pinStorage.hash = secureData;
            return true;
        } catch (error) {
            console.error('Error storing secure PIN hash:', error);
            return false;
        }
    }

/**
 * Retrieves stored PIN hash data from fallback storage system.
 * 
 * This is an alternative version of getStoredPinData() that uses the fallback storage
 * approach. Attempts localStorage first, then falls back to memory storage.
 * Returns stored PIN data for verification or null if not found.
 * 
 * @returns {string|null} Stored PIN data string, or null if no PIN is stored
 * @since 2.0.0
 * @example
 * // Get PIN data with fallback storage
 * const storedData = getStoredPinData();
 * if (storedData) {
 *   const isValid = await verifyPinHash(enteredPin, storedData);
 *   console.log('PIN verification result:', isValid);
 * } else {
 *   console.log('No PIN configured');
 * }
 */
function getStoredPinData() {
        // Try localStorage first
        if (isLocalStorageAvailable()) {
            const data = localStorage.getItem('dreamJournalPinHash');
            if (data) return data;
        }
        
        // Fallback to memory storage
        return pinStorage.hash;
    }

    // Verify PIN against stored hash - UPDATED to handle both legacy and secure formats

/**
     * Removes PIN hash data using fallback storage system.
     * 
     * This is an alternative version of removePinHash() that uses the fallback storage
     * approach. Removes PIN data from both localStorage and memory storage to ensure
     * complete cleanup. Works with both legacy and secure PIN formats.
     * 
     * @since 2.0.0
     * @example
     * // Remove PIN protection with fallback storage
     * removePinHash();
     * updateSecurityControls(); // Update UI to reflect PIN removal
     * console.log('PIN protection removed (fallback storage)');
     */
    function removePinHash() {
        // Remove from localStorage if available
        if (isLocalStorageAvailable()) {
            localStorage.removeItem('dreamJournalPinHash');
        }
        
        // Remove from memory storage
        pinStorage.hash = null;
    }

/**
     * Stores PIN reset timer expiration time using fallback storage system.
     * 
     * This is an alternative version of storeResetTime() that uses the fallback storage
     * approach. Attempts localStorage first, then falls back to memory storage if needed.
     * Returns success status to indicate whether storage was successful.
     * 
     * @param {number} time - Timestamp when PIN reset should activate
     * @returns {boolean} True if storage was successful
     * @since 2.0.0
     * @example
     * // Store reset time with fallback storage
     * const resetTime = Date.now() + (72 * 60 * 60 * 1000);
     * const success = storeResetTime(resetTime);
     * console.log('Reset time stored:', success);
     */
    function storeResetTime(time) {
        // Try localStorage first
        if (isLocalStorageAvailable()) {
            try {
                localStorage.setItem('dreamJournalPinResetTime', time.toString());
                return true;
            } catch (error) {
                console.error('storeResetTime: Failed to save to localStorage:', error);
            }
        }
        
        // Fallback to memory storage
        pinStorage.resetTime = time;
        return true;
    }

/**
     * Retrieves PIN reset timer expiration time using fallback storage system.
     * 
     * This is an alternative version of getResetTime() that uses the fallback storage
     * approach. Attempts localStorage first, then falls back to memory storage.
     * Returns null if no reset timer is active.
     * 
     * @returns {number|null} Timestamp when PIN reset activates, or null if no timer
     * @since 2.0.0
     * @example
     * // Check reset timer with fallback storage
     * const resetTime = getResetTime();
     * if (resetTime && resetTime < Date.now()) {
     *   console.log('PIN reset timer has expired');
     *   removePinHash();
     * }
     */
    function getResetTime() {
        // Try localStorage first
        if (isLocalStorageAvailable()) {
            const time = localStorage.getItem('dreamJournalPinResetTime');
            if (time) return parseInt(time);
        }
        
        // Fallback to memory storage
        return pinStorage.resetTime;
    }

/**
     * Removes PIN reset timer data using fallback storage system.
     * 
     * This is an alternative version of removeResetTime() that uses the fallback storage
     * approach. Removes timer data from both localStorage and memory storage to ensure
     * complete cleanup when timer is cancelled or expired.
     * 
     * @since 2.0.0
     * @example
     * // Cancel reset timer with fallback storage
     * removeResetTime();
     * updateTimerWarning(); // Hide warning banner
     * console.log('PIN reset timer cancelled (fallback storage)');
     */
    function removeResetTime() {
        // Remove from localStorage if available
        if (isLocalStorageAvailable()) {
            localStorage.removeItem('dreamJournalPinResetTime');
        }
        
        // Remove from memory storage
        pinStorage.resetTime = null;
    }

// ================================
// 8. UI CONTROLS & STATE MANAGEMENT 
// ================================

/**
 * Updates security control buttons visibility and state across all UI locations.
 * 
 * Manages the display and text of security-related buttons throughout the application.
 * The lock button is always visible for better UX, with logic handled in toggleLock().
 * Updates button text and tooltips based on current PIN status and lock state.
 * 
 * @todo Split into updateButtonStates(), updateButtonText(), and validateAppState() functions for better separation of concerns
 * @since 1.0.0
 * @example
 * // Update UI after PIN setup
 * await storePinHash(newPin);
 * updateSecurityControls(); // Shows "Lock Journal" and "Change/Remove PIN"
 * 
 * @example
 * // Update UI after PIN removal
 * removePinHash();
 * updateSecurityControls(); // Shows "Setup & Lock" and "Setup PIN"
 */
function updateSecurityControls() {
        const lockBtn = document.getElementById('lockBtn');
        const lockBtnSettings = document.getElementById('lockBtnSettings');
        const setupBtnSettings = document.getElementById('setupPinBtnSettings');
        
        // Always show the lock button - much simpler UX!
        if (lockBtn) {
            lockBtn.style.display = 'inline-block';
            if (isPinSetup()) {
                if (isUnlocked && !isAppLocked) {
                    lockBtn.textContent = '🔒 Lock Journal';
                    lockBtn.title = 'Lock your journal with your PIN to keep dreams private';
                } else {
                    lockBtn.textContent = '🔓 Unlock Journal'; // This case shouldn't happen much since we use lock screen
                    lockBtn.title = 'Unlock your journal by entering your PIN';
                }
            } else {
                lockBtn.textContent = '🔒 Setup & Lock';
                lockBtn.title = 'Set up a PIN to secure your dreams, then lock the journal';
            }
        }
        
        // Always show settings lock button too
        if (lockBtnSettings) {
            lockBtnSettings.style.display = 'inline-block';
            if (isPinSetup()) {
                if (isUnlocked && !isAppLocked) {
                    lockBtnSettings.textContent = '🔒 Lock Journal';
                    lockBtnSettings.title = 'Lock your journal with your PIN to keep dreams private';
                } else {
                    lockBtnSettings.textContent = '🔓 Unlock Journal';
                    lockBtnSettings.title = 'Unlock your journal by entering your PIN';
                }
            } else {
                lockBtnSettings.textContent = '🔒 Setup & Lock';
                lockBtnSettings.title = 'Set up a PIN to secure your dreams, then lock the journal';
            }
        }
        
        // Update setup button text (only exists in settings)
        if (setupBtnSettings) {
            setupBtnSettings.textContent = isPinSetup() ? '⚙️ Change/Remove PIN' : '⚙️ Setup PIN';
        }
        
        // Ensure correct app state
        if (!isPinSetup()) {
            setUnlocked(true);
            setAppLocked(false);
        }
    }

/**
     * Displays the PIN removal interface within the overlay.
     * 
     * Shows a confirmation screen for removing PIN protection. Requires current PIN
     * verification before allowing removal. Warns user that dreams will no longer
     * be secured after PIN removal.
     * 
     * @since 1.0.0
     * @example
     * // Called when user clicks "Remove PIN" button
     * showRemovePin();
     * // Shows PIN entry form with removal warning
     */
    function showRemovePin() {
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'Remove PIN Protection',
            icon: '⚠️',
            message: 'Enter your current PIN to remove protection. Your dreams will no longer be secured.',
            inputs: [
                { id: 'pinInput', type: 'password', placeholder: 'Enter current PIN', class: 'pin-input', maxLength: 6 }
            ],
            buttons: [
                { text: 'Remove PIN', action: 'confirm-remove-pin', class: 'btn-primary' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
        document.getElementById('pinOverlay').style.display = 'flex';
    }

/**
     * Executes PIN removal after successful verification.
     * 
     * Actually removes the PIN hash from storage and shows success confirmation.
     * Sets application to unlocked state and prepares for completion workflow.
     * Handles any errors that occur during the removal process.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called after PIN verification succeeds for removal
     * await executePinRemoval();
     * // Removes PIN and shows success screen
     */
    async function executePinRemoval() {
        try {
            // Remove the PIN
            removePinHash();

            const pinContainer = document.querySelector('#pinOverlay .pin-container');
            renderPinScreen(pinContainer, {
                title: 'PIN Removed',
                icon: '✅',
                message: 'PIN protection has been removed. Your dreams are no longer secured.',
                buttons: [
                    { text: 'Close', action: 'complete-pin-removal', class: 'btn-primary' }
                ]
            });

            setUnlocked(true);
        } catch (error) {
            console.error('Error removing PIN:', error);
            showMessage('error', 'Error removing PIN. Please try again.');
        }
    }

/**
     * Confirms PIN removal by verifying the entered current PIN.
     * 
     * Validates the user's current PIN before allowing removal. Supports both
     * legacy and secure PIN formats. Proceeds to executePinRemoval() if verification
     * succeeds, shows error message if PIN is incorrect.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user submits PIN for removal confirmation
     * await confirmRemovePin();
     * // Verifies PIN and removes if correct, shows error if not
     */
    async function confirmRemovePin() {
        const enteredPin = document.getElementById('pinInput').value;
        
        if (!enteredPin) {
            showMessage('error', 'Please enter your current PIN');
            return;
        }
        
        try {
            const storedData = getStoredPinData();
            const isValid = await verifyPinHash(enteredPin, storedData);
            
            if (!isValid) {
                const message = document.getElementById('pinMessage');
                message.textContent = 'Incorrect PIN. Please try again.';
                message.style.color = 'var(--error-color)';
                document.getElementById('pinInput').value = '';
                return;
            }
            
            await executePinRemoval();
            
        } catch (error) {
            console.error('Error removing PIN:', error);
            showMessage('error', 'Error removing PIN. Please try again.');
        }
    }

/**
     * Completes PIN removal workflow and restores normal application state.
     * 
     * Final cleanup after successful PIN removal. Resets overlay, unlocks application,
     * shows all UI elements, updates security controls, and refreshes dream display.
     * Ensures application returns to fully functional state without PIN protection.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called after successful PIN removal completion
     * await completePinRemoval();
     * // Restores full application functionality without PIN protection
     */
    async function completePinRemoval() {
        resetPinOverlay();
        hidePinOverlay();
        
        // Reset failed attempts since PIN removal was successful
        setFailedPinAttempts(0);
        
        // PIN removed - unlock the app
        setUnlocked(true);
        setAppLocked(false);
        
        console.log('PIN removal complete - ensuring tabs are visible');
        
        // Ensure all tabs are visible (PIN is removed, no need to hide)
        showAllTabButtons();
        
        updateSecurityControls();
        await displayDreams();
    }

/**
     * Displays inline messages within the PIN overlay interface.
     * 
     * Shows feedback messages (error, success, info) in the appropriate message
     * containers within the PIN overlay. Clears existing messages before showing
     * new ones. Success messages automatically hide after configured duration.
     * 
     * @param {string} type - Message type ('error', 'success', 'info')
     * @param {string} message - Message text to display
     * @param {string} [elementId] - Optional specific element ID to use
     * @since 1.0.0
     * @example
     * // Show error message in PIN overlay
     * showMessage('error', 'Incorrect PIN. Please try again.');
     * 
     * @example
     * // Show success message that auto-hides
     * showMessage('success', 'PIN setup complete!');
     * 
     * @example
     * // Show message in specific element
     * showMessage('info', 'PIN must be 4-6 digits', 'customFeedback');
     */
    function showMessage(type, message, elementId = null) {
        // Clear all messages first
        document.getElementById('pinFeedback').style.display = 'none';
        document.getElementById('pinSuccess').style.display = 'none';
        document.getElementById('pinInfo').style.display = 'none';
        
        let element;
        if (elementId) {
            element = document.getElementById(elementId);
        } else {
            switch(type) {
                case 'error': element = document.getElementById('pinFeedback'); break;
                case 'success': element = document.getElementById('pinSuccess'); break;
                case 'info': element = document.getElementById('pinInfo'); break;
            }
        }
        
        if (element) {
            element.textContent = message;
            element.className = `notification-message ${type}`;
            element.style.display = 'block';
            
            // Auto-hide success messages after duration
            if (type === 'success') {
                setTimeout(() => {
                    element.style.display = 'none';
                }, CONSTANTS.MESSAGE_DURATION_MEDIUM);
            }
        }
    }

// ================================
// 9. LOCK SCREEN INTERFACE SYSTEM
// ================================

/**
 * Verifies PIN entered on the lock screen tab interface.
 * 
 * Handles PIN verification specifically for the lock screen tab, managing the unlock
 * transition and failed attempt tracking. On successful verification, unlocks the
 * application and restores the previously active tab. Manages UI feedback and
 * automatic form clearing.
 * 
 * @async
 * @since 2.0.0
 * @example
 * // Called when user clicks "Unlock Journal" on lock screen
 * await verifyLockScreenPin();
 * // Verifies PIN and transitions to unlocked state if correct
 */
async function verifyLockScreenPin() {
        const pinInput = document.getElementById('lockScreenPinInput');
        if (!pinInput) return;
        
        const enteredPin = pinInput.value;
        if (!enteredPin) {
            showLockScreenMessage('error', 'Please enter a PIN');
            return;
        }
        
        try {
            const storedData = getStoredPinData();
            const isValid = await verifyPinHash(enteredPin, storedData);
            
            if (isValid) {
                showLockScreenMessage('success', 'PIN verified! Unlocking journal...');
                
                setFailedPinAttempts(0);
                setUnlocked(true);
                setAppLocked(false);
                
                console.log('Lock screen unlock successful - showing all tabs');
                
                pinInput.value = '';
                
                setTimeout(() => {
                    showAllTabButtons();
                    const targetTab = (preLockActiveTab === 'lock') ? 'journal' : preLockActiveTab;
                    switchAppTab(targetTab);
                    updateSecurityControls();
                }, 200);
                
            } else {
                setFailedPinAttempts(getFailedPinAttempts() + 1);
                pinInput.value = '';
                if (getFailedPinAttempts() >= CONSTANTS.FAILED_PIN_ATTEMPT_LIMIT) {
                    showLockScreenMessage('error', 'Incorrect PIN. Use "Forgot PIN?" if needed.');
                } else {
                    showLockScreenMessage('error', 'Incorrect PIN. Please try again.');
                }
            }
        } catch (error) {
            console.error('Lock screen PIN verification error:', error);
            showLockScreenMessage('error', 'PIN verification failed. Please try again.');
            pinInput.value = '';
        }
    }

/**
     * Verifies PIN entry from the main PIN overlay.
     * 
     * Handles PIN verification for the main application PIN overlay interface.
     * Gets PIN input from the overlay form, validates it against stored hash,
     * and processes authentication success or failure appropriately.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user submits PIN in main overlay
     * await verifyPin();
     * // Unlocks app or shows error message
     */
    async function verifyPin() {
        const enteredPin = document.getElementById('pinInput').value;
        const feedback = document.getElementById('pinFeedback');

        if (!enteredPin) {
            feedback.innerHTML = '<span style="color: var(--error-color);">Please enter your PIN</span>';
            return;
        }

        try {
            const storedData = getStoredPinData();
            if (!storedData) {
                feedback.innerHTML = '<span style="color: var(--error-color);">No PIN found. Please set up a new PIN.</span>';
                return;
            }

            const isValid = await verifyPinHash(enteredPin, storedData);

            if (isValid) {
                setUnlocked(true);
                setFailedPinAttempts(0);
                hidePinOverlay();
                updateSecurityControls();
                displayDreams();

                setTimeout(() => {
                    const container = document.querySelector('.main-content');
                    createInlineMessage('success', 'Successfully unlocked! Welcome back to your dream journal.', {
                        container: container,
                        position: 'top',
                        duration: 3000
                    });
                }, 100);
            } else {
                setFailedPinAttempts(getFailedPinAttempts() + 1);
                feedback.innerHTML = '<span style="color: var(--error-color);">Incorrect PIN. Please try again.</span>';
                document.getElementById('pinInput').value = '';

                if (getFailedPinAttempts() >= CONSTANTS.PIN_MAX_ATTEMPTS) {
                    setTimeout(() => showForgotPin(), 100);
                }
            }
        } catch (error) {
            console.error('PIN verification error:', error);
            feedback.innerHTML = '<span style="color: var(--error-color);">PIN verification failed. Please try again.</span>';
            document.getElementById('pinInput').value = '';
        }
    }
    
/**
     * Displays "Forgot PIN" recovery options on the lock screen.
     * 
     * Shows recovery options specifically within the lock screen tab interface.
     * Handles active timer detection, dream title verification setup, and timer-based
     * recovery initiation. Provides inline recovery interface without overlay modals.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user clicks "Forgot PIN?" on lock screen
     * await showLockScreenForgotPin();
     * // Shows recovery options inline within lock screen tab
     */
    async function showLockScreenForgotPin() {
        const resetTime = getResetTime();
        if (resetTime) {
            const remainingTime = resetTime - Date.now();
            if (remainingTime > 0) {
                const hours = Math.ceil(remainingTime / (1000 * 60 * 60));
                const days = Math.ceil(hours / 24);
                let timeDisplay = days > 1 ? `${days} days` : hours > 1 ? `${hours} hours` : 'Less than 1 hour';
                showLockScreenMessage('info', `Recovery timer active. Time remaining: ${timeDisplay}. Press "Forgot PIN?" again when timer expires to unlock.`);
            } else {
                removeResetTime();
                removePinHash();
                setUnlocked(true);
                setAppLocked(false);
                switchAppTab(preLockActiveTab);
                updateSecurityControls();
            }
            return;
        }
        
        const dreams = await loadDreams();
        const validDreams = dreams.filter(d => d.title !== 'Untitled Dream');
        const lockCard = document.querySelector('#lockTab > div > div');

        if (lockCard) {
            renderPinScreen(lockCard, {
                title: 'PIN Recovery',
                icon: '🔑',
                message: `
                    <strong>Choose a recovery method to regain access:</strong>
                    <div class="card-sm mb-md text-left mt-lg">
                        <h4 class="text-primary mb-sm">📝 Dream Title Verification</h4>
                        <p class="text-secondary text-sm mb-sm">Enter 3 of your dream titles exactly as written (case-sensitive)</p>
                        <button data-action="start-lock-screen-title-recovery" class="btn btn-primary btn-small" ${validDreams.length < 3 ? 'disabled' : ''}>Verify Dream Titles</button>
                        ${validDreams.length < 3 ? `<p class="text-xs text-warning mt-sm">You need at least 3 dreams with custom titles to use this method. You have ${validDreams.length}.</p>` : ''}
                    </div>
                    <div class="card-sm mb-lg text-left">
                        <h4 class="text-warning mb-sm">⏰ 72-Hour Timer Reset</h4>
                        <p class="text-secondary text-sm mb-sm">Start a timer that will automatically remove your PIN after 72 hours</p>
                        <button data-action="start-lock-screen-timer-recovery" class="btn btn-primary btn-small">Start Timer Reset</button>
                    </div>
                `,
                buttons: [
                    { text: '← Back to PIN Entry', action: 'return-to-lock-screen', class: 'btn-secondary' }
                ],
                feedbackContainer: true
            });
        } else {
            showLockScreenMessage('error', 'Error accessing recovery options');
        }
    }
    
/**
     * Displays feedback messages on the lock screen interface.
     * 
     * Shows status messages (error, success, info) within the lock screen tab.
     * Automatically hides success messages after a configured duration.
     * Falls back to alternative feedback elements if primary element not found.
     * 
     * @param {string} type - Message type ('error', 'success', 'info')
     * @param {string} message - Message text to display
     * @since 2.0.0
     * @example
     * // Show error message on lock screen
     * showLockScreenMessage('error', 'Incorrect PIN. Please try again.');
     * 
     * @example
     * // Show success message that auto-hides
     * showLockScreenMessage('success', 'PIN verified! Unlocking journal...');
     */
    function showLockScreenMessage(type, message) {
        const feedbackDiv = document.getElementById('lockScreenFeedback') || document.getElementById('pinFeedback');
        if (!feedbackDiv) return;
        
        feedbackDiv.textContent = message;
        feedbackDiv.style.display = 'block';
        feedbackDiv.className = `notification-message ${type}`;
        
        if (type === 'success') {
            setTimeout(() => { if (feedbackDiv) feedbackDiv.style.display = 'none'; }, CONSTANTS.MESSAGE_DURATION_MEDIUM);
        }
    }
    
/**
     * Returns to the main lock screen interface from recovery screens.
     * 
     * Rebuilds the main lock screen interface with PIN entry form and recovery options.
     * Includes active timer information if a reset timer is running. Ensures proper
     * focus management and tab activation.
     * 
     * @since 2.0.0
     * @example
     * // Return to main lock screen from recovery interface
     * returnToLockScreen();
     * // Shows main PIN entry interface with timer info if applicable
     */
    async function returnToLockScreen() {
        const lockTab = document.getElementById('lockTab');
        if (!lockTab) {
            // Fallback in case tab doesn't exist, though it should
            switchAppTab('lock');
            return;
        }

        // Render the appropriate authentication screen based on requirements
        await renderUnifiedAuthenticationScreen(lockTab);

        // Ensure the tab is active
        switchAppTab('lock');
    }

/**
 * Renders unified authentication screen supporting both PIN and encryption password.
 *
 * This function creates a smart authentication interface that adapts based on the
 * user's security configuration. It detects whether PIN, encryption, or both are
 * enabled and renders the appropriate interface with contextual messaging and
 * recovery options tailored to each authentication method.
 *
 * **Authentication Scenarios:**
 * - PIN only: Shows 6-digit PIN input with dream title/timer recovery
 * - Encryption only: Shows password input with data wipe recovery option
 * - Both enabled: Shows password input with PIN fallback and appropriate recovery
 *
 * @async
 * @function
 * @param {HTMLElement} containerElement - The lock tab element to render into
 * @returns {Promise<void>} Resolves when rendering is complete
 * @since 2.03.01
 * @private
 */
async function renderUnifiedAuthenticationScreen(containerElement) {
    const requirements = await getAuthenticationRequirements();

    // Check for active PIN recovery timer
    const resetTime = getResetTime();
    let timerInstructions = '';

    if (resetTime && requirements.pinRequired) {
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

    // Determine the appropriate interface based on authentication requirements
    if (requirements.encryptionRequired) {
        // Encryption password interface (with or without PIN fallback)
        renderEncryptionAuthenticationScreen(containerElement, requirements, timerInstructions);
    } else if (requirements.pinRequired) {
        // PIN-only interface
        renderPinAuthenticationScreen(containerElement, timerInstructions);
    } else {
        // Should not happen, but fallback to PIN interface
        renderPinAuthenticationScreen(containerElement, timerInstructions);
    }
}

/**
 * Renders encryption password authentication interface.
 *
 * @async
 * @function
 * @param {HTMLElement} containerElement - Container to render into
 * @param {Object} requirements - Authentication requirements
 * @param {string} timerInstructions - Timer instruction HTML
 * @private
 */
function renderEncryptionAuthenticationScreen(containerElement, requirements, timerInstructions) {
    let title = '🔐 Enter Encryption Password';
    let description = 'Enter your encryption password to decrypt and access your dream journal data.';
    let switchToPinOption = '';

    if (requirements.bothEnabled) {
        title = '🔐 Enter Password or PIN';
        description = 'Enter your encryption password to decrypt your data, or use your PIN for quicker access.';
        switchToPinOption = `
            <button data-action="switch-to-pin-entry" class="btn btn-secondary">Use PIN Instead</button>
        `;
    }

    containerElement.innerHTML = `
        <div class="flex-center" style="min-height: 400px;">
            <div class="card-elevated card-lg text-center max-w-sm w-full shadow-lg">
                <div class="text-4xl mb-lg">🔐</div>
                <h2 class="text-primary mb-md text-xl">${title}</h2>
                <p class="text-secondary mb-lg line-height-relaxed">
                    ${description}
                </p>
                ${timerInstructions}
                <input type="password" id="lockScreenPasswordInput" placeholder="Enter encryption password" maxlength="128" class="input-pin w-full mb-lg">
                <div class="flex-center gap-sm flex-wrap">
                    <button data-action="verify-encryption-password" class="btn btn-primary">🔓 Unlock Journal</button>
                    ${switchToPinOption}
                    <button data-action="show-forgot-encryption-password" class="btn btn-secondary">Forgot Password?</button>
                </div>
                <div id="lockScreenFeedback" class="mt-md p-sm feedback-container"></div>
            </div>
        </div>
    `;

    // Focus the password input
    const passwordInput = document.getElementById('lockScreenPasswordInput');
    if (passwordInput) {
        setTimeout(() => passwordInput.focus(), 100);
    }
}

/**
 * Renders PIN authentication interface (legacy interface for PIN-only scenarios).
 *
 * @function
 * @param {HTMLElement} containerElement - Container to render into
 * @param {string} timerInstructions - Timer instruction HTML
 * @private
 */
function renderPinAuthenticationScreen(containerElement, timerInstructions) {
    containerElement.innerHTML = `
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

    // Focus the PIN input
    const pinInput = document.getElementById('lockScreenPinInput');
    if (pinInput) {
        setTimeout(() => pinInput.focus(), 100);
    }
}

/**
 * Shows forgot encryption password recovery options.
 *
 * Displays recovery options for users who have forgotten their encryption password.
 * Since encrypted data cannot be recovered without the password, the primary option
 * is complete data wipe with appropriate warnings and confirmations.
 *
 * @async
 * @function
 * @since 2.03.01
 * @example
 * // Called from lock screen "Forgot Password?" button
 * showForgotEncryptionPassword();
 */
async function showForgotEncryptionPassword() {
    const lockTab = document.getElementById('lockTab');
    if (!lockTab) return;

    const lockCard = lockTab.querySelector('.card-elevated') || lockTab;

    lockCard.innerHTML = `
        <div class="card-elevated card-lg text-center max-w-sm w-full shadow-lg">
            <div class="text-4xl mb-lg">🔐❓</div>
            <h2 class="text-primary mb-md text-xl">Forgot Encryption Password?</h2>
            <p class="text-secondary mb-lg line-height-relaxed">
                <strong style="color: var(--error-color);">⚠️ Important:</strong><br>
                Encrypted data cannot be recovered without your password. Your only option is to wipe all data and start fresh.
            </p>

            <div class="message-base message-error mb-lg text-sm">
                <strong>This will permanently delete:</strong><br>
                • All encrypted dreams and goals<br>
                • All app settings and preferences<br>
                • All voice notes and data<br>
                <br>
                <strong>This action cannot be undone!</strong>
            </div>

            <div class="flex-center gap-sm flex-wrap">
                <button data-action="wipe-all-data" class="btn btn-error">🗑️ Wipe All Data</button>
                <button data-action="return-to-lock-screen" class="btn btn-secondary">← Back</button>
            </div>
            <div id="lockScreenFeedback" class="mt-md p-sm feedback-container"></div>
        </div>
    `;
}

/**
 * Performs complete data wipe for forgotten encryption password recovery.
 *
 * This is a nuclear option that completely wipes all user data when encryption
 * password is forgotten. Provides multiple confirmation steps to prevent
 * accidental data loss, then clears all databases and settings.
 *
 * @async
 * @function
 * @since 2.03.01
 * @example
 * // Called after user confirms data wipe
 * await wipeAllData();
 */
async function wipeAllData() {
    const lockTab = document.getElementById('lockTab');
    if (!lockTab) return;

    const lockCard = lockTab.querySelector('.card-elevated') || lockTab;

    // Show final confirmation
    lockCard.innerHTML = `
        <div class="card-elevated card-lg text-center max-w-sm w-full shadow-lg">
            <div class="text-4xl mb-lg">⚠️</div>
            <h2 class="text-primary mb-md text-xl">Final Confirmation</h2>
            <p class="text-secondary mb-lg line-height-relaxed">
                Type <strong>DELETE EVERYTHING</strong> to confirm complete data wipe:
            </p>

            <input type="text" id="wipeConfirmationInput" placeholder="Type: DELETE EVERYTHING" class="input-pin w-full mb-lg">

            <div class="flex-center gap-sm flex-wrap">
                <button data-action="confirm-data-wipe" class="btn btn-error">🗑️ Confirm Wipe</button>
                <button data-action="show-forgot-encryption-password" class="btn btn-secondary">← Back</button>
            </div>
            <div id="lockScreenFeedback" class="mt-md p-sm feedback-container"></div>
        </div>
    `;

    // Focus the confirmation input
    const confirmInput = document.getElementById('wipeConfirmationInput');
    if (confirmInput) {
        setTimeout(() => confirmInput.focus(), 100);
    }
}

/**
 * Switches from encryption password entry to PIN entry mode.
 *
 * For users with both encryption and PIN enabled, this allows switching
 * to the faster PIN authentication method instead of entering the full
 * encryption password.
 *
 * @function
 * @since 2.03.01
 * @example
 * // Called from "Use PIN Instead" button
 * switchToPinEntry();
 */
function switchToPinEntry() {
    const lockTab = document.getElementById('lockTab');
    if (!lockTab) return;

    // Re-render with PIN interface
    renderPinAuthenticationScreen(lockTab, '');
}

/**
 * Confirms and executes complete data wipe after user confirmation.
 *
 * Validates the confirmation text and performs complete application data wipe
 * including IndexedDB, localStorage, and session data. This is irreversible
 * and completely resets the application to fresh install state.
 *
 * @async
 * @function
 * @since 2.03.01
 * @example
 * // Called after user types confirmation text
 * await confirmDataWipe();
 */
async function confirmDataWipe() {
    const confirmInput = document.getElementById('wipeConfirmationInput');
    const feedback = document.getElementById('lockScreenFeedback');

    if (!confirmInput || !feedback) return;

    const confirmText = confirmInput.value.trim();

    if (confirmText !== 'DELETE EVERYTHING') {
        feedback.innerHTML = '<div class="message-base message-error">Please type exactly: DELETE EVERYTHING</div>';
        confirmInput.focus();
        return;
    }

    try {
        feedback.innerHTML = '<div class="message-base message-info">Wiping all data...</div>';

        // Import required functions
        const {
            setEncryptionEnabled,
            setEncryptionPassword,
            clearDecryptedDataCache,
            setUnlocked,
            setAppLocked
        } = await import('./state.js');

        // Clear IndexedDB databases
        const databases = await indexedDB.databases();
        for (const db of databases) {
            if (db.name && db.name.includes('Dream')) {
                const deleteReq = indexedDB.deleteDatabase(db.name);
                await new Promise((resolve, reject) => {
                    deleteReq.onsuccess = () => resolve();
                    deleteReq.onerror = () => reject(deleteReq.error);
                });
            }
        }

        // Clear all localStorage
        if (typeof(Storage) !== "undefined" && localStorage) {
            localStorage.clear();
        }

        // Clear all session state
        setEncryptionEnabled(false);
        setEncryptionPassword(null);
        clearDecryptedDataCache();
        setUnlocked(false);
        setAppLocked(false);

        // Clear any PIN settings
        removePinHash();
        removeResetTime();

        // Show success message and redirect
        const lockTab = document.getElementById('lockTab');
        if (lockTab) {
            lockTab.innerHTML = `
                <div class="flex-center" style="min-height: 400px;">
                    <div class="card-elevated card-lg text-center max-w-sm w-full shadow-lg">
                        <div class="text-4xl mb-lg">✅</div>
                        <h2 class="text-primary mb-md text-xl">Data Wiped Successfully</h2>
                        <p class="text-secondary mb-lg line-height-relaxed">
                            All application data has been permanently deleted. The app will reload with a fresh start.
                        </p>
                        <button onclick="window.location.reload()" class="btn btn-primary">🔄 Reload Application</button>
                    </div>
                </div>
            `;
        }

    } catch (error) {
        console.error('Error during data wipe:', error);
        feedback.innerHTML = '<div class="message-base message-error">Error wiping data. Please try again or reload the application.</div>';
    }
}

/**
     * Initiates dream title recovery specifically on the lock screen.
     * 
     * Sets up the dream title verification interface within the lock screen tab.
     * Similar to startTitleRecovery() but designed for inline lock screen display
     * rather than overlay modal presentation.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user selects title recovery from lock screen
     * await startLockScreenTitleRecovery();
     * // Shows title input form within lock screen tab
     */
    async function startLockScreenTitleRecovery() {
        const lockCard = document.querySelector('#lockTab > div > div');
        renderPinScreen(lockCard, {
            title: 'Verify Dream Titles',
            icon: '📝',
            message: 'Enter exactly 3 of your dream titles as they appear in your journal.<br><em class="text-sm">Must match exactly, including capitalization</em>',
            inputs: [
                { id: 'recovery1', type: 'text', placeholder: 'Dream title 1', class: 'form-control' },
                { id: 'recovery2', type: 'text', placeholder: 'Dream title 2', class: 'form-control' },
                { id: 'recovery3', type: 'text', placeholder: 'Dream title 3', class: 'form-control' }
            ],
            buttons: [
                { text: 'Verify Titles', action: 'verify-lock-screen-dream-titles', class: 'btn-primary' },
                { text: '← Back', action: 'show-lock-screen-forgot-pin', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }
    
/**
     * Verifies dream titles entered on the lock screen recovery interface.
     * 
     * Validates entered dream titles specifically within the lock screen context.
     * On successful verification, removes PIN protection and transitions to unlocked
     * state. Handles error display and form management within lock screen interface.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user submits titles on lock screen recovery
     * await verifyLockScreenDreamTitles();
     * // Verifies titles and unlocks if valid, shows error if not
     */
    async function verifyLockScreenDreamTitles() {
        const title1 = document.getElementById('recovery1')?.value.trim();
        const title2 = document.getElementById('recovery2')?.value.trim();
        const title3 = document.getElementById('recovery3')?.value.trim();
        
        if (!title1 || !title2 || !title3) {
            showLockScreenMessage('error', 'Please enter all 3 dream titles');
            return;
        }
        
        const dreams = await loadDreams();
        const dreamTitles = dreams.filter(d => d.title !== 'Untitled Dream').map(d => d.title);
        
        const titles = [title1, title2, title3];
        const uniqueTitles = [...new Set(titles)];
        
        if (uniqueTitles.length !== 3) {
            showLockScreenMessage('error', 'Please enter 3 DIFFERENT dream titles. Each title must be unique.');
            return;
        }
        
        if (titles.every(t => dreamTitles.includes(t))) {
            removePinHash();
            removeResetTime();
            showLockScreenMessage('success', 'Recovery successful! Your PIN has been removed. Unlocking journal...');
            setUnlocked(true);
            setAppLocked(false);
            setFailedPinAttempts(0);
            updateTimerWarning();
            
            setTimeout(() => {
                showAllTabButtons();
                const targetTab = (preLockActiveTab === 'lock') ? 'journal' : preLockActiveTab;
                switchAppTab(targetTab);
                updateSecurityControls();
            }, 2000);
        } else {
            showLockScreenMessage('error', 'One or more titles did not match. Please try again.');
            document.getElementById('recovery1').value = '';
            document.getElementById('recovery2').value = '';
            document.getElementById('recovery3').value = '';
            document.getElementById('recovery1').focus();
        }
    }

/**
     * Initiates the dream title recovery process for PIN reset.
     * 
     * Loads user's dreams and filters for those with custom titles (excluding "Untitled Dream").
     * If sufficient dreams exist (minimum 3), displays the title verification interface.
     * If insufficient dreams, redirects to timer-based recovery.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user selects "Verify Dream Titles" option
     * await startTitleRecovery();
     * // Shows form with 3 title input fields or error message
     */
    async function startTitleRecovery() {
        const dreams = await loadDreams();
        const validDreams = dreams.filter(d => d.title !== 'Untitled Dream');
        const pinContainer = document.querySelector('#pinOverlay .pin-container');

        if (validDreams.length < 3) {
            renderPinScreen(pinContainer, {
                title: 'PIN Recovery',
                icon: '🔑',
                message: '<span style="color: var(--error-color);">You need at least 3 dreams with custom titles to use this recovery method.</span><br><br>Please use the 72-hour timer option instead.',
                buttons: [
                    { text: 'Start 72hr Timer', action: 'start-timer-recovery', class: 'btn-secondary', id: 'timerBtn' },
                    { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
                ],
                feedbackContainer: false
            });
            return;
        }

        renderPinScreen(pinContainer, {
            title: 'Verify Your Dreams',
            icon: '🔑',
            message: 'Enter exactly 3 of your dream titles:<br><em class="text-sm text-secondary">Must match exactly, including capitalisation</em>',
            inputs: [
                { id: 'recovery1', type: 'text', placeholder: 'Dream title 1', class: 'form-control' },
                { id: 'recovery2', type: 'text', placeholder: 'Dream title 2', class: 'form-control' },
                { id: 'recovery3', type: 'text', placeholder: 'Dream title 3', class: 'form-control' }
            ],
            buttons: [
                { text: 'Verify Titles', action: 'verify-dream-titles', class: 'btn-primary' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }

/**
     * Verifies entered dream titles against stored dreams for PIN recovery.
     * 
     * Validates that the user has entered exactly 3 different dream titles that match
     * existing dreams in their journal. If verification succeeds, removes PIN protection
     * and completes the recovery process. Titles must match exactly (case-sensitive).
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user submits dream title verification form
     * await verifyDreamTitles();
     * // Removes PIN if titles match, shows error if they don't
     */
    async function verifyDreamTitles() {
        const title1 = document.getElementById('recovery1').value.trim();
        const title2 = document.getElementById('recovery2').value.trim();
        const title3 = document.getElementById('recovery3').value.trim();
        const feedback = document.getElementById('pinFeedback');
        
        if (!title1 || !title2 || !title3) {
            feedback.innerHTML = '<span style="color: var(--error-color);">Please enter all 3 dream titles</span>';
            return;
        }
        
        const dreams = await loadDreams();
        const validDreams = dreams.filter(d => d.title !== 'Untitled Dream');
        const dreamTitles = validDreams.map(d => d.title);
        
        const titles = [title1, title2, title3];
        const uniqueTitles = [...new Set(titles)];
        
        if (uniqueTitles.length !== 3) {
            feedback.innerHTML = '<span style="color: var(--error-color);">Please enter 3 DIFFERENT dream titles. Each title must be unique.</span>';
            return;
        }
        
        const allValid = titles.every(t => dreamTitles.includes(t));
        
        if (allValid) {
            removePinHash();
            removeResetTime();
            
            const pinContainer = document.querySelector('#pinOverlay .pin-container');
            renderPinScreen(pinContainer, {
                title: 'Recovery Successful',
                icon: '✅',
                message: '<span style="color: var(--success-color);">Your PIN has been removed. You can now set a new secure PIN.</span><br><br>Click below to continue.',
                buttons: [
                    { text: 'Continue', action: 'complete-recovery', class: 'btn-primary' }
                ]
            });
            
            setUnlocked(true);
            setFailedPinAttempts(0);
            updateTimerWarning();
        } else {
            feedback.innerHTML = '<span style="color: var(--error-color);">One or more titles did not match. Please try again with exact titles from your dreams.</span>';
        }
    }

/**
     * Initiates the timer-based PIN recovery process.
     * 
     * Displays a confirmation dialog explaining the 72-hour timer recovery method.
     * Shows warning that PIN will be automatically removed after the timer expires,
     * with assurance that dreams will remain safe during the process.
     * 
     * @since 2.0.0
     * @example
     * // Called when user selects "Start 72hr Timer" option
     * startTimerRecovery();
     * // Shows confirmation dialog with timer warning
     */
    function startTimerRecovery() {
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'Confirm Timer Reset',
            icon: '⏳',
            message: '<span style="color: var(--error-color); font-weight: 600;">⚠️ Warning</span><br><br>' +
                        'This will start a 72-hour countdown. After 72 hours, your PIN will be automatically removed.<br><br>' +
                        '<span style="color: var(--text-secondary);">Your dreams will remain safe and will not be deleted.</span><br><br>' +
                        'Do you want to continue?',
            buttons: [
                { text: 'Yes, Start Timer', action: 'confirm-start-timer', class: 'btn-primary' },
                { text: 'No, Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ]
        });
    }
    
/**
     * Initiates timer-based recovery specifically on the lock screen.
     * 
     * Shows timer recovery confirmation interface within the lock screen tab.
     * Similar to startTimerRecovery() but designed for inline lock screen display
     * rather than overlay modal presentation.
     * 
     * @since 2.0.0
     * @example
     * // Called when user selects timer recovery from lock screen
     * startLockScreenTimerRecovery();
     * // Shows timer confirmation within lock screen tab
     */
    function startLockScreenTimerRecovery() {
        const lockCard = document.querySelector('#lockTab > div > div');
        renderPinScreen(lockCard, {
            title: '72-Hour Timer Reset',
            icon: '⏰',
            message: `
                <div class="message-base message-warning mb-lg text-left">
                    <h4 class="mb-sm">⚠️ Important Warning</h4>
                    <p class="mb-sm line-height-relaxed">This will start a 72-hour countdown. After the timer expires, your PIN will be automatically removed.</p>
                    <p class="font-semibold" style="margin: 0;">Your dreams will remain safe and will not be deleted.</p>
                </div>
                <p class="text-secondary mb-lg line-height-relaxed">Do you want to start the 72-hour recovery timer?</p>`,
            buttons: [
                { text: 'Start Timer', action: 'confirm-lock-screen-timer', class: 'btn-primary' },
                { text: '← Cancel', action: 'show-lock-screen-forgot-pin', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }
    
/**
     * Confirms and activates the PIN reset timer from the lock screen.
     * 
     * Starts the PIN reset timer and shows confirmation within the lock screen interface.
     * Updates timer warning banner and returns to main lock screen after showing
     * success message. Provides user feedback about timer activation.
     * 
     * @since 2.0.0
     * @example
     * // Called when user confirms timer start from lock screen
     * confirmLockScreenTimer();
     * // Starts timer and shows success message on lock screen
     */
    function confirmLockScreenTimer() {
        const resetTime = Date.now() + (CONSTANTS.PIN_RESET_HOURS * 60 * 60 * 1000);
        storeResetTime(resetTime);
        updateTimerWarning();
        showLockScreenMessage('success', '72-hour recovery timer started! You can check back later or use dream title recovery.');
        setTimeout(returnToLockScreen, 3000);
    }

/**
     * Completes the PIN recovery process and restores application access.
     * 
     * Resets PIN overlay, unlocks application, shows all tab buttons, updates UI controls,
     * displays dreams, and shows success message. This is the final step after successful
     * PIN recovery via either dream title verification or timer expiration.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called after successful dream title verification
     * if (titlesMatchStored) {
     *   removePinHash();
     *   await completeRecovery(); // Unlocks app and shows success message
     * }
     */
    async function completeRecovery() {
        resetPinOverlay();
        hidePinOverlay();
        
        setUnlocked(true);
        setAppLocked(false);
        
        console.log('PIN overlay recovery complete - showing all tabs');
        
        showAllTabButtons();
        
        updateSecurityControls();
        updateTimerWarning();
        await displayDreams();
        
        const container = document.querySelector('.main-content');
        if (container) {
            createInlineMessage('success', 'Recovery complete! You can now set a new PIN from the security controls if desired.', {
                container: container,
                position: 'top',
                duration: 5000
            });
        }
    }

/**
 * Updates the PIN reset timer warning banner display and calculates remaining time.
 * 
 * Manages the visibility and content of the timer warning banner that appears when
 * a PIN reset timer is active. Calculates remaining time and formats display text
 * appropriately (days vs hours vs less than 1 hour). Hides banner when no timer
 * is active or when timer has expired.
 * 
 * @todo Split into calculateRemainingTime() and updateTimerDisplay() functions for better separation of concerns
 * @since 2.0.0
 * @example
 * // Update timer display after starting/cancelling timer
 * storeResetTime(Date.now() + 72 * 60 * 60 * 1000);
 * updateTimerWarning(); // Shows "3 days remaining" banner
 * 
 * @example
 * // Hide timer warning after cancellation
 * removeResetTime();
 * updateTimerWarning(); // Hides warning banner
 */
function updateTimerWarning() {
    const warningBanner = document.getElementById('timerWarning');
    const warningTime = document.getElementById('timerWarningTime');
    
    if (!warningBanner || !warningTime) return;
    
    const resetTime = getResetTime();
    if (resetTime) {
        const remainingMs = resetTime - Date.now();
        if (remainingMs > 0) {
            const hours = Math.ceil(remainingMs / (1000 * 60 * 60));
            const days = Math.ceil(hours / 24);
            
            let timeDisplay = '';
            if (days > 1) {
                timeDisplay = `${days} days remaining`;
            } else if (hours > 1) {
                timeDisplay = `${hours} hours remaining`;
            } else {
                timeDisplay = 'Less than 1 hour remaining';
            }
            
            warningTime.textContent = `(${timeDisplay})`;
            warningBanner.classList.add('active');
        } else {
            warningBanner.classList.remove('active');
        }
    } else {
        warningBanner.classList.remove('active');
    }
}

/**
 * Displays PIN cancellation interface for active timer reset.
 * 
 * Shows a PIN entry form to allow users to cancel an active PIN reset timer by
 * entering their current PIN. This provides a way to stop the automatic
 * PIN removal if the user remembers their PIN before the timer expires.
 * 
 * @since 2.0.0
 * @example
 * // Called when user clicks "Cancel Timer" button
 * cancelResetTimer();
 * // Shows PIN entry form for timer cancellation
 */
function cancelResetTimer() {
        const pinOverlay = document.getElementById('pinOverlay');
        const pinContainer = pinOverlay.querySelector('.pin-container');
        
        renderPinScreen(pinContainer, {
            title: 'Cancel PIN Reset',
            icon: '⚠️',
            message: 'To cancel the pending PIN reset, please enter your current PIN.',
            inputs: [
                { id: 'pinInput', type: 'password', placeholder: 'Enter current PIN', class: 'pin-input', maxLength: 6 }
            ],
            buttons: [
                { text: 'Confirm Cancellation', action: 'confirm-cancel-timer', class: 'btn-primary' },
                { text: 'Back', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
        
        pinOverlay.style.display = 'flex';
    }

/**
     * Executes timer cancellation after PIN verification.
     * 
     * Verifies the entered PIN against stored data and cancels the active reset timer
     * if verification succeeds. Shows success message and hides timer warning banner.
     * If PIN is incorrect, timer remains active.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user submits PIN for timer cancellation
     * await confirmCancelTimer();
     * // Cancels timer if PIN is correct, shows error if not
     */
    async function confirmCancelTimer() {
        const enteredPin = document.getElementById('pinInput').value;
        if (!enteredPin) {
            showMessage('error', 'Please enter your PIN.');
            return;
        }

        const storedData = getStoredPinData();
        const isValid = await verifyPinHash(enteredPin, storedData);

        if (isValid) {
            removeResetTime();
            updateTimerWarning();
            hidePinOverlay();

            // Show a success message in the main content area
            const container = document.querySelector('.main-content');
            if (container) {
                createInlineMessage('success', 'PIN reset timer has been successfully cancelled.', {
                    container: document.querySelector('.container'),
                    position: 'top',
                    duration: 5000
                });
            }
        } else {
            showMessage('error', 'Incorrect PIN. The reset timer remains active.');
        }
    }

/**
     * Confirms and activates the PIN reset timer.
     * 
     * Calculates the expiration time based on configured hours (typically 72),
     * stores the reset time, and displays the active timer interface. Also activates
     * the warning banner to remind user of pending reset.
     * 
     * @since 2.0.0
     * @example
     * // Called when user confirms timer start
     * confirmStartTimer();
     * // Starts 72-hour countdown and shows timer interface
     */
    function confirmStartTimer() {
        const resetTime = Date.now() + (CONSTANTS.PIN_RESET_HOURS * 60 * 60 * 1000); // hours from now
        storeResetTime(resetTime);
        showTimerRecovery(CONSTANTS.PIN_RESET_HOURS * 60 * 60 * 1000);
        updateTimerWarning(); // Show warning banner
    }

/**
     * Restores and refreshes the timer warning banner display.
     * 
     * Simple wrapper function that calls updateTimerWarning() to restore or refresh
     * the timer warning banner state. Used when the banner needs to be shown again
     * after being hidden or when the timer state needs to be refreshed.
     * 
     * @since 2.0.0
     * @example
     * // Restore timer warning banner after user action
     * restoreWarningBanner();
     * // Refreshes banner display with current timer status
     */
    function restoreWarningBanner() {
        updateTimerWarning();
    }

// ================================
// 10. PIN OVERLAY MANAGEMENT
// ================================

/**
 * Shows the PIN overlay for authentication or setup procedures.
 * 
 * Displays the modal PIN overlay interface for various PIN operations.
 * Resets to default state, clears failed attempt counter, and handles proper
 * focus management. Skips display if application is already unlocked with PIN setup.
 * 
 * @since 1.0.0
 * @example
 * // Show PIN overlay for authentication
 * if (!isUnlocked) {
 *   showPinOverlay(); // Displays PIN entry interface
 * }
 * 
 * @example
 * // Show PIN overlay when trying to access secured feature
 * if (requiresAuthentication && !isUnlocked) {
 *   showPinOverlay();
 * }
 */
function showPinOverlay() {
        if (isUnlocked && isPinSetup()) return;
        
        setFailedPinAttempts(0);
        resetPinOverlay(); // Reset to default state
        document.getElementById('pinOverlay').style.display = 'flex';
        
        // ARIA: Add focus trapping and escape key support
        const cleanupFocusTrap = trapFocusInPinOverlay();
        const overlay = document.getElementById('pinOverlay');
        overlay._cleanupFocusTrap = cleanupFocusTrap;
        document.addEventListener('keydown', handlePinOverlayEscape);
        
        setTimeout(() => {
            const pinInput = document.getElementById('pinInput');
            if (pinInput) pinInput.focus();
        }, CONSTANTS.FOCUS_DELAY_MS);
    }

/**
 * Simple focus trap for PIN dialogs
 * @returns {Function} Cleanup function to remove event listeners
 * @since 2.02.53
 */
function trapFocusInPinOverlay() {
    const overlay = document.getElementById('pinOverlay');
    if (!overlay || overlay.style.display === 'none') return;
    
    const focusableElements = overlay.querySelectorAll(
        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    function handleTabKey(e) {
        if (e.key !== 'Tab') return;
        
        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }
    
    overlay.addEventListener('keydown', handleTabKey);
    
    // Return cleanup function
    return () => overlay.removeEventListener('keydown', handleTabKey);
}

/**
 * Handle escape key for PIN overlay
 * @param {KeyboardEvent} e - The keyboard event
 * @since 2.02.53
 */
function handlePinOverlayEscape(e) {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('pinOverlay');
        if (overlay && overlay.style.display !== 'none') {
            hidePinOverlay();
        }
    }
}

/**
     * Hides the PIN overlay modal interface.
     * 
     * Conceals the PIN overlay and resets it to default state for next use.
     * Used when PIN operations are completed, cancelled, or when application
     * needs to return to normal operation.
     * 
     * @since 1.0.0
     * @example
     * // Hide overlay after successful authentication
     * if (pinVerified) {
     *   hidePinOverlay();
     *   showMainInterface();
     * }
     * 
     * @example
     * // Hide overlay on user cancellation
     * hidePinOverlay();
     * returnToPreviousState();
     */
    function hidePinOverlay() {
        const overlay = document.getElementById('pinOverlay');
        
        // ARIA: Clean up focus trap and escape key listener
        if (overlay._cleanupFocusTrap) {
            overlay._cleanupFocusTrap();
            overlay._cleanupFocusTrap = null;
        }
        document.removeEventListener('keydown', handlePinOverlayEscape);
        
        overlay.style.display = 'none';
        resetPinOverlay();
    }

/**
     * Displays the PIN setup interface within the overlay.
     * 
     * Shows the appropriate PIN setup screen based on current PIN status.
     * For new PIN setup, shows creation interface. For existing PIN, shows
     * current PIN verification before allowing changes. Handles proper UI
     * state and focus management.
     * 
     * @since 1.0.0
     * @example
     * // Show PIN setup for new user
     * showPinSetup(); // Shows "Create PIN" interface
     * 
     * @example
     * // Show PIN setup for existing user (change PIN)
     * showPinSetup(); // Shows "Enter current PIN" interface first
     */
    function showPinSetup() {
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        const isChangingPin = isPinSetup();

        renderPinScreen(pinContainer, {
            title: isChangingPin ? 'Change/Remove PIN' : 'Setup PIN',
            icon: '⚙️',
            message: isChangingPin ? 'Enter your current PIN to change it.' : 'Create a 4-6 digit PIN to protect your dreams.',
            inputs: [
                { id: 'pinInput', type: 'password', placeholder: isChangingPin ? 'Current PIN' : 'New PIN (4-6 digits)', class: 'pin-input', maxLength: 6 }
            ],
            buttons: [
                { text: isChangingPin ? 'Verify Current PIN' : 'Continue', action: 'process-pin-setup', class: 'btn-primary' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
        document.getElementById('pinOverlay').style.display = 'flex';
    }

// ================================
// 11. PIN SETUP & CHANGE WORKFLOW
// ================================

/**
 * Processes PIN setup or change requests with comprehensive validation.
 * 
 * Main function for handling PIN setup and modification workflows. Validates PIN format
 * (4-6 digits), handles both new PIN creation and existing PIN changes. For new PINs,
 * proceeds to confirmation step. For existing PINs, verifies current PIN first.
 * 
 * @async
 * @since 1.0.0
 * @example
 * // Called when user submits PIN setup form
 * await setupPin();
 * // Validates input and proceeds to next step based on PIN status
 * 
 * @example
 * // PIN format validation
 * // Input: '12345' -> Proceeds to confirmation
 * // Input: '123' -> Shows error (too short)
 * // Input: 'abcd' -> Shows error (not digits)
 */
async function setupPin() {
        const enteredPin = document.getElementById('pinInput').value;
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        
        if (!enteredPin || enteredPin.length < CONSTANTS.PIN_MIN_LENGTH || enteredPin.length > CONSTANTS.PIN_MAX_LENGTH || !/^\d+$/.test(enteredPin)) {
            showMessage('error', `PIN must be ${CONSTANTS.PIN_MIN_LENGTH}-${CONSTANTS.PIN_MAX_LENGTH} digits.`);
            document.getElementById('pinInput').value = '';
            return;
        }
        
        if (isPinSetup()) {
            const storedData = getStoredPinData();
            const isValid = await verifyPinHash(enteredPin, storedData);
            if (!isValid) {
                showMessage('error', 'Current PIN is incorrect. Please try again.');
                document.getElementById('pinInput').value = '';
                return;
            }
            renderPinScreen(pinContainer, {
                title: 'Change or Remove PIN',
                icon: '⚙️',
                message: 'Your current PIN is correct. What would you like to do?',
                buttons: [
                    { text: 'Set New PIN', action: 'show-set-new-pin-screen', class: 'btn-primary' },
                    { text: 'Remove PIN', action: 'execute-pin-removal', class: 'btn-delete' },
                    { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
                ],
                feedbackContainer: false
            });
        } else {
            window.tempNewPin = enteredPin;
            renderPinScreen(pinContainer, {
                title: 'Confirm PIN',
                icon: '⚙️',
                message: 'Enter the same PIN again to confirm.',
                inputs: [ { id: 'pinInput', type: 'password', placeholder: 'Confirm PIN', class: 'pin-input', maxLength: 6 } ],
                buttons: [
                    { text: 'Setup PIN', action: 'confirm-new-pin', class: 'btn-primary' },
                    { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
                ],
                feedbackContainer: true
            });
        }
    }

/**
     * Displays the "Enter New PIN" screen during PIN change workflow.
     * 
     * Second step of PIN change process after current PIN verification.
     * Shows interface for entering a new PIN with validation requirements.
     * Part of the multi-step PIN change workflow.
     * 
     * @since 2.0.0
     * @example
     * // Called after successful current PIN verification
     * showSetNewPinScreen();
     * // Shows "Enter new PIN" interface
     */
    function showSetNewPinScreen() {
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'Enter New PIN',
            icon: '⚙️',
            message: 'Enter your new 4-6 digit PIN.',
            inputs: [ { id: 'pinInput', type: 'password', placeholder: 'New PIN (4-6 digits)', class: 'pin-input', maxLength: 6 } ],
            buttons: [
                { text: 'Continue', action: 'setup-new-pin', class: 'btn-primary' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }

/**
     * Processes new PIN entry during PIN change workflow.
     * 
     * Third step of PIN change process. Validates new PIN format and proceeds
     * to confirmation step. Temporarily stores new PIN for final confirmation.
     * Includes comprehensive format validation (length, digit-only).
     * 
     * @since 2.0.0
     * @example
     * // Called when user submits new PIN during change process
     * setupNewPin();
     * // Validates format and proceeds to confirmation if valid
     */
    function setupNewPin() {
        const enteredPin = document.getElementById('pinInput').value;
        if (!enteredPin || enteredPin.length < CONSTANTS.PIN_MIN_LENGTH || enteredPin.length > CONSTANTS.PIN_MAX_LENGTH || !/^\d+$/.test(enteredPin)) {
            showMessage('error', `PIN must be ${CONSTANTS.PIN_MIN_LENGTH}-${CONSTANTS.PIN_MAX_LENGTH} digits.`);
            document.getElementById('pinInput').value = '';
            return;
        }
        
        window.tempNewPin = enteredPin;
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'Confirm New PIN',
            icon: '⚙️',
            message: 'Enter the same PIN again to confirm.',
            inputs: [ { id: 'pinInput', type: 'password', placeholder: 'Confirm new PIN', class: 'pin-input', maxLength: 6 } ],
            buttons: [
                { text: 'Change PIN', action: 'confirm-new-pin', class: 'btn-primary' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }

/**
     * Displays the "Forgot PIN" recovery options interface.
     * 
     * Shows recovery options for users who have forgotten their PIN. Handles three scenarios:
     * 1. Active timer - shows remaining time or auto-unlocks if expired
     * 2. No timer - presents choice between dream title verification or timer start
     * 
     * Recovery methods:
     * - Dream title verification: User enters 3 dream titles for immediate unlock
     * - 72-hour timer: Automatically removes PIN after specified time period
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user clicks "Forgot PIN?" link
     * await showForgotPin();
     * // Displays appropriate recovery interface based on current state
     */
    async function showForgotPin() {
        const resetTime = getResetTime();
        if (resetTime) {
            const remainingTime = resetTime - Date.now();
            if (remainingTime > 0) {
                showTimerRecovery(remainingTime);
                return;
            } else {
                // Timer expired, allow reset
                removeResetTime();
                removePinHash();
                setUnlocked(true);
                setFailedPinAttempts(0);
                hidePinOverlay();
                updateSecurityControls();
                displayDreams();
                
                setTimeout(() => {
                    const container = document.querySelector('.main-content');
                    createInlineMessage('info', 'PIN reset timer has expired. Your PIN has been removed. You can set a new one if desired.', {
                        container: container,
                        position: 'top',
                        duration: 8000
                    });
                }, 100);
                return;
            }
        }

        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'PIN Recovery',
            icon: '🔑',
            message: '<strong>Choose a recovery method:</strong><br><br>' +
                        '<strong>Option 1:</strong> Enter 3 of your dream titles exactly as written<br>' +
                        '<em style="font-size: 0.9em; color: var(--text-secondary);">(Note: "Untitled Dream" entries are not valid)</em><br><br>' +
                        '<strong>Option 2:</strong> Wait 72 hours for automatic reset<br>' +
                        '<em style="font-size: 0.9em; color: var(--text-secondary);">(Your dreams will remain safe)</em>',
            buttons: [
                { text: 'Verify Dream Titles', action: 'start-title-recovery', class: 'btn-primary' },
                { text: 'Start 72hr Timer', action: 'start-timer-recovery', class: 'btn-secondary', id: 'timerBtn' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }

/**
     * Final confirmation step for new PIN creation or change.
     * 
     * Validates that entered PIN matches the temporary PIN, then securely hashes
     * and stores the new PIN using PBKDF2. Shows success interface on completion
     * and handles cleanup of temporary data. This is the final step in both
     * PIN setup and PIN change workflows.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user confirms new PIN
     * await confirmNewPin();
     * // Stores PIN securely and shows success message
     */
    async function confirmNewPin() {
        const enteredPin = document.getElementById('pinInput').value;
        if (enteredPin !== window.tempNewPin) {
            showMessage('error', 'PINs do not match. Please start over.');
            setTimeout(() => {
                resetPinOverlay();
                showPinSetup();
            }, 2000);
            return;
        }
        
        try {
            const success = await storePinHash(window.tempNewPin);
            if (success) {
                const pinContainer = document.querySelector('#pinOverlay .pin-container');
                renderPinScreen(pinContainer, {
                    title: 'PIN Setup Complete',
                    icon: '✅',
                    message: `Secure PIN has been set successfully! Your dreams are now protected${isLocalStorageAvailable() ? ' with advanced encryption' : ' using memory storage (PIN will reset on refresh)'}.`,
                    buttons: [
                        { text: 'Close', action: 'complete-pin-setup', class: 'btn-primary' }
                    ]
                });
                delete window.tempNewPin;
                setUnlocked(true);
            } else {
                showMessage('error', 'Error: Failed to save secure PIN. Please try again.');
            }
        } catch (error) {
            console.error('Error setting up secure PIN:', error);
            showMessage('error', 'Error: Failed to setup secure PIN. Please try again.');
        }
    }

/**
     * Completes PIN setup workflow and restores normal application state.
     * 
     * Final cleanup and state management after successful PIN setup or change.
     * Resets overlay, unlocks application, shows all UI elements, updates security
     * controls, and refreshes dream display. Ensures application returns to
     * fully functional state after PIN operations.
     * 
     * @async
     * @since 1.0.0
     * @example
     * // Called after successful PIN setup completion
     * await completePinSetup();
     * // Restores full application functionality with PIN protection active
     */
    async function completePinSetup() {
        resetPinOverlay();
        hidePinOverlay();
        setFailedPinAttempts(0);
        setUnlocked(true);
        setAppLocked(false);
        console.log('PIN setup complete - ensuring tabs are visible');
        showAllTabButtons();
        updateSecurityControls();
        await displayDreams();
    }

/**
     * Resets PIN overlay to default authentication state.
     * 
     * Restores the PIN overlay to its standard PIN entry interface with default
     * buttons and links. Clears failed attempt counter and configures appropriate
     * visibility for setup/removal options based on current PIN status.
     * 
     * @since 1.0.0
     * @example
     * // Reset overlay after completed operation
     * resetPinOverlay();
     * // Shows standard "Enter PIN" interface
     * 
     * @example
     * // Reset overlay before showing for authentication
     * resetPinOverlay();
     * showPinOverlay();
     */
    function resetPinOverlay() {
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        if (!pinContainer) return;
        
        setFailedPinAttempts(0);
        
        renderPinScreen(pinContainer, {
            title: 'Enter PIN',
            icon: '🔒',
            message: 'Your dreams are protected. Enter your PIN to access them.',
            inputs: [ { id: 'pinInput', type: 'password', placeholder: 'Enter PIN', class: 'pin-input', maxLength: 6 } ],
            buttons: [
                { text: 'Unlock', action: 'verify-pin', class: 'btn-primary', id: 'pinMainBtn' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary', id: 'cancelPinBtn' }
            ],
            links: [
                { text: 'Setup new PIN', action: 'show-pin-setup', id: 'pinSetupLink', style: isPinSetup() ? 'display:none' : '' },
                { text: 'Remove PIN protection', action: 'show-remove-pin', id: 'removePinLink', style: !isPinSetup() || !isUnlocked ? 'display:none' : '' },
                { text: 'Forgot PIN?', action: 'show-forgot-pin', id: 'forgotPinLink', style: 'display:none' }
            ],
            feedbackContainer: true
        });
    }

/**
     * Toggles the application lock state between locked and unlocked.
     * 
     * Main function for locking/unlocking the application. If no PIN is set up,
     * prompts user to create one first. If PIN exists, toggles between locked
     * (showing lock screen) and unlocked (normal operation) states. Manages
     * tab visibility and preserves user's active tab for restoration.
     * 
     * @async
     * @since 1.0.0
     * @example
     * // Lock application (if PIN is set up)
     * await toggleLock();
     * // Switches to lock screen and hides other tabs
     * 
     * @example
     * // Attempt lock without PIN setup
     * await toggleLock();
     * // Shows message and prompts PIN setup
     */
    async function toggleLock() {
        if (!isPinSetup()) {
            const container = document.querySelector('.main-content');
            if (container) {
                createInlineMessage('info', 'First, set up a PIN to protect your dreams, then you can lock your journal.', {
                    container: container,
                    position: 'top',
                    duration: 4000
                });
            }
            showPinSetup();
            return;
        }
        
        if (isUnlocked && !isAppLocked) {
            setUnlocked(false);
            setAppLocked(true);
            setPreLockActiveTab(activeAppTab);
            console.log('Locking app - hiding other tabs');
            hideAllTabButtons();
            switchAppTab('lock');
            updateSecurityControls();
        } else {
            showPinOverlay();
        }
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

// ================================
// 13. AUTHENTICATION FLOW INTEGRATION
// ================================

/**
 * Determines what authentication is needed based on enabled features.
 *
 * Analyzes the current security configuration to determine which authentication
 * methods are required. Supports PIN-only, encryption-only, and dual authentication
 * modes, providing the foundation for smart authentication flow decisions.
 *
 * @async
 * @function
 * @returns {Promise<Object>} Authentication requirements object
 * @returns {boolean} returns.pinRequired - PIN authentication needed
 * @returns {boolean} returns.encryptionRequired - Encryption password needed
 * @returns {boolean} returns.bothEnabled - Both PIN and encryption are set up
 * @since 2.03.01
 * @example
 * const requirements = await getAuthenticationRequirements();
 * if (requirements.encryptionRequired) {
 *   showEncryptionPasswordScreen();
 * } else if (requirements.pinRequired) {
 *   showPinScreen();
 * }
 */
async function getAuthenticationRequirements() {
    const pinEnabled = isPinSetup();

    // Import encryption state
    const { getEncryptionEnabled } = await import('./state.js');
    const encryptionEnabled = getEncryptionEnabled();

    return {
        pinRequired: pinEnabled && !encryptionEnabled,
        encryptionRequired: encryptionEnabled,
        bothEnabled: pinEnabled && encryptionEnabled
    };
}

/**
 * Shows appropriate authentication screen based on enabled features.
 *
 * Smart authentication dispatcher that determines which authentication screen
 * to display based on the current security configuration. Prioritizes encryption
 * password entry when both PIN and encryption are enabled, as encryption password
 * can bypass PIN protection.
 *
 * @async
 * @function
 * @since 2.03.01
 * @example
 * // Called during app initialization when authentication is required
 * await showAuthenticationScreen();
 * // Shows encryption password screen, PIN screen, or appropriate combination
 */
async function showAuthenticationScreen() {
    // All authentication now happens on the lock screen for consistency
    await returnToLockScreen();
}

/**
 * Shows the encryption password entry screen.
 *
 * Displays the password entry interface for accessing encrypted data. Supports
 * dual authentication scenarios where both PIN and encryption are enabled,
 * providing appropriate context and alternative authentication options.
 *
 * @async
 * @function
 * @since 2.03.01
 * @example
 * // Show encryption password screen
 * showEncryptionPasswordScreen();
 * // Displays password entry with appropriate context and options
 */
async function showEncryptionPasswordScreen() {
    const requirements = await getAuthenticationRequirements();

    let title, message;
    if (requirements.bothEnabled) {
        title = 'Enter Encryption Password';
        message = 'Your encryption password will bypass PIN protection and decrypt your data.';
    } else {
        title = 'Enter Password';
        message = 'Enter your password to access your encrypted data.';
    }

    const pinContainer = document.querySelector('#pinOverlay .pin-container');
    const config = {
        title,
        icon: '🔒',
        message,
        inputs: [
            {
                id: 'encryptionPassword',
                type: 'password',
                placeholder: 'Enter password',
                class: 'pin-input',
                autocomplete: 'current-password'
            }
        ],
        buttons: [
            {
                text: 'Unlock',
                action: 'verify-encryption-password',
                class: 'btn-primary'
            }
        ],
        links: requirements.bothEnabled ? [
            {
                text: 'Use PIN instead',
                action: 'switch-to-pin-entry',
                class: 'forgot-pin-link'
            }
        ] : [],
        feedbackContainer: true
    };

    renderPinScreen(pinContainer, config);
    document.getElementById('pinOverlay').style.display = 'flex';

    // Focus the password input
    setTimeout(() => {
        const passwordInput = document.getElementById('encryptionPassword');
        if (passwordInput) passwordInput.focus();
    }, CONSTANTS.FOCUS_DELAY_MS);
}

/**
 * Verifies the entered encryption password and unlocks the app.
 *
 * Validates the encryption password by attempting to decrypt existing encrypted
 * data, then unlocks the application and loads all encrypted content. Handles
 * password verification failures and provides appropriate user feedback.
 *
 * @async
 * @function
 * @since 2.03.01
 * @example
 * // Called when user submits encryption password
 * await verifyEncryptionPassword();
 * // Tests password and unlocks app if correct
 */
async function verifyEncryptionPassword() {
    // Check for both popup (encryptionPassword) and lock screen (lockScreenPasswordInput) inputs
    const passwordInput = document.getElementById('lockScreenPasswordInput') || document.getElementById('encryptionPassword');
    const password = passwordInput?.value?.trim();

    if (!password) {
        // Show error in appropriate container
        const feedback = document.getElementById('lockScreenFeedback');
        if (feedback) {
            feedback.innerHTML = '<div class="message-base message-error">Please enter your password</div>';
        } else {
            showMessage('error', 'Please enter your password');
        }
        return;
    }

    try {
        // Test password by attempting to decrypt known encrypted data
        const testResult = await testEncryptionPassword(password);

        if (testResult.valid) {
            // Import state management functions
            const {
                setEncryptionPassword,
                setUnlocked,
                setAppLocked,
                getPreLockActiveTab
            } = await import('./state.js');

            // Import initialization function
            const { initializeApplicationData } = await import('./main.js');

            setEncryptionPassword(password);
            setUnlocked(true);
            setAppLocked(false);

            // Load and decrypt all data
            await initializeApplicationData();

            hidePinOverlay();
            switchAppTab(getPreLockActiveTab() || 'journal');
            showAllTabButtons();

            const container = document.querySelector('.main-content');
            createInlineMessage('success', 'Data decrypted and ready!', {
                container: container,
                position: 'top',
                duration: 3000
            });
        } else {
            setFailedPinAttempts(getFailedPinAttempts() + 1);

            // Show error in appropriate container
            const feedback = document.getElementById('lockScreenFeedback');
            if (feedback) {
                feedback.innerHTML = '<div class="message-base message-error">Incorrect password. Please try again.</div>';
            } else {
                showMessage('error', 'Incorrect password. Please try again.');
            }

            passwordInput.value = '';
            passwordInput.focus();
        }
    } catch (error) {
        console.error('Password verification error:', error);

        // Show error in appropriate container
        const feedback = document.getElementById('lockScreenFeedback');
        if (feedback) {
            feedback.innerHTML = '<div class="message-base message-error">Error verifying password. Please try again.</div>';
        } else {
            showMessage('error', 'Error verifying password. Please try again.');
        }

        passwordInput.value = '';
        passwordInput.focus();
    }
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


// ================================
// ENHANCED PASSWORD SCREENS (Phase 5.2)
// ================================

/**
 * Global reference to current password dialog overlay for cleanup.
 * Used by hidePasswordDialog() to remove the currently displayed dialog.
 *
 * @type {HTMLElement|null}
 * @private
 * @since 2.03.05
 */
let currentPasswordDialog = null;

/**
 * Hides and removes the currently displayed password dialog.
 *
 * Removes the password dialog overlay from the DOM and clears the global
 * reference. This function provides a clean way to programmatically dismiss
 * password dialogs, especially useful for success scenarios or error handling.
 *
 * @function
 * @returns {void}
 * @since 2.03.05
 * @example
 * // Show password dialog, then hide it on success
 * showChangeEncryptionPasswordDialog();
 * // ... user enters passwords and validation succeeds ...
 * hidePasswordDialog();
 * createInlineMessage('Password changed successfully!', 'success');
 */
function hidePasswordDialog() {
    if (currentPasswordDialog && currentPasswordDialog.parentNode) {
        currentPasswordDialog.parentNode.removeChild(currentPasswordDialog);
        currentPasswordDialog = null;
    }
}

/**
 * Shows enhanced password change dialog for encryption.
 *
 * Displays a comprehensive password change dialog with three input fields:
 * current password, new password, and confirmation. Uses action-based button
 * system for integration with the existing action router. The dialog includes
 * proper accessibility features and integrates with the app's UI theme.
 *
 * This function creates a more advanced password dialog than the basic
 * showPasswordDialog(), supporting multiple labeled inputs and action-based
 * event handling for seamless integration with the application's event system.
 *
 * @function
 * @returns {void}
 * @since 2.03.05
 * @example
 * // Display password change dialog
 * showChangeEncryptionPasswordDialog();
 * // Dialog appears with three password fields and action buttons
 * // User interaction handled by action router
 */
function showChangeEncryptionPasswordDialog() {
    const config = {
        title: 'Change Encryption Password',
        description: 'Enter your current password, then set a new password.',
        inputs: [
            {
                type: 'password',
                id: 'currentPassword',
                placeholder: 'Current password',
                label: 'Current Password'
            },
            {
                type: 'password',
                id: 'newPassword',
                placeholder: 'New password',
                label: 'New Password'
            },
            {
                type: 'password',
                id: 'confirmPassword',
                placeholder: 'Confirm new password',
                label: 'Confirm New Password'
            }
        ],
        buttons: [
            {
                text: 'Change Password',
                action: 'confirm-change-encryption-password',
                class: 'btn btn-primary'
            },
            {
                text: 'Cancel',
                action: 'cancel-password-dialog',
                class: 'btn btn-secondary'
            }
        ],
        primaryButtonText: 'Change Password'
    };

    showEnhancedPasswordDialog(config);
}

/**
 * Shows an enhanced password dialog with multiple inputs and action buttons.
 *
 * Creates a customizable password dialog that supports multiple labeled input fields
 * and action-based buttons for integration with the application's event routing system.
 * This is an enhanced version of the basic showPasswordDialog() that supports more
 * complex scenarios like password changes with validation.
 *
 * @private
 * @function
 * @param {Object} config - Dialog configuration object
 * @param {string} config.title - Dialog title text
 * @param {string} config.description - Dialog description/instructions
 * @param {Array<Object>} config.inputs - Input field configurations
 * @param {string} config.inputs[].type - Input type (e.g., 'password')
 * @param {string} config.inputs[].id - Input element ID
 * @param {string} config.inputs[].placeholder - Input placeholder text
 * @param {string} config.inputs[].label - Input label text
 * @param {Array<Object>} config.buttons - Button configurations
 * @param {string} config.buttons[].text - Button text
 * @param {string} config.buttons[].action - Data-action attribute value
 * @param {string} config.buttons[].class - Button CSS classes
 * @returns {void}
 * @since 2.03.05
 */
function showEnhancedPasswordDialog(config) {
    // Remove existing dialog if present
    hidePasswordDialog();

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.display = 'flex';

    // Generate input fields HTML
    const inputsHTML = config.inputs.map(input => `
        <div class="form-group">
            <label for="${input.id}" class="form-label">${input.label}</label>
            <input type="${input.type}"
                   id="${input.id}"
                   placeholder="${input.placeholder}"
                   class="form-control mb-sm"
                   style="width: 100%">
        </div>
    `).join('');

    // Generate buttons HTML
    const buttonsHTML = config.buttons.map(button => `
        <button class="${button.class}"
                data-action="${button.action}">
            ${button.text}
        </button>
    `).join('');

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>${config.title}</h2>
            <p class="mb-md">${config.description}</p>

            ${inputsHTML}

            <div class="button-group">
                ${buttonsHTML}
            </div>

            <div id="passwordDialogFeedback" class="notification-message error" style="display: none;"></div>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    currentPasswordDialog = overlay;

    // Focus first input field
    const firstInput = modal.querySelector('input');
    if (firstInput) {
        firstInput.focus();
    }

    // Add Enter key support
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const primaryButton = modal.querySelector('[data-action="confirm-change-encryption-password"]');
            if (primaryButton) {
                primaryButton.click();
            }
        }
    });
}

/**
 * Processes encryption password change request.
 *
 * Handles the complete password change workflow including validation,
 * current password verification, and re-encryption of all encrypted data
 * with the new password. Provides comprehensive error handling and user
 * feedback throughout the process.
 *
 * This function performs the following steps:
 * 1. Validates input fields and password requirements
 * 2. Verifies the current password is correct
 * 3. Re-encrypts all encrypted data with the new password
 * 4. Updates the session encryption password
 * 5. Provides success feedback and closes the dialog
 *
 * @async
 * @function
 * @returns {Promise<void>}
 * @since 2.03.05
 * @throws {Error} When password change fails due to validation or re-encryption errors
 * @example
 * // Called automatically by action router when user clicks "Change Password"
 * // action-router.js handles the data-action="confirm-change-encryption-password"
 * await confirmChangeEncryptionPassword();
 */
async function confirmChangeEncryptionPassword() {
    const currentPassword = document.getElementById('currentPassword')?.value;
    const newPassword = document.getElementById('newPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    const feedbackDiv = document.getElementById('passwordDialogFeedback');

    /**
     * Shows error message in the dialog feedback area.
     * @private
     */
    function showDialogError(message) {
        if (feedbackDiv) {
            feedbackDiv.textContent = message;
            feedbackDiv.style.display = 'block';
        }
    }

    // Validation
    if (!currentPassword) {
        showDialogError('Please enter your current password');
        document.getElementById('currentPassword')?.focus();
        return;
    }

    if (!newPassword) {
        showDialogError('Please enter a new password');
        document.getElementById('newPassword')?.focus();
        return;
    }

    if (newPassword !== confirmPassword) {
        showDialogError('New passwords do not match');
        document.getElementById('confirmPassword')?.focus();
        return;
    }

    const validation = validateEncryptionPassword(newPassword);
    if (!validation.valid) {
        showDialogError(validation.error);
        document.getElementById('newPassword')?.focus();
        return;
    }

    try {
        // Test current password
        const testResult = await testEncryptionPassword(currentPassword);
        if (!testResult.valid) {
            showDialogError('Current password is incorrect');
            document.getElementById('currentPassword')?.focus();
            return;
        }

        // Show progress feedback
        showDialogError('Changing password... Please wait.');
        feedbackDiv.className = 'notification-message info';

        // Re-encrypt all data with new password
        await reEncryptAllData(currentPassword, newPassword);

        // Update session password
        setEncryptionPassword(newPassword);

        hidePasswordDialog();
        createInlineMessage('Encryption password changed successfully!', 'success');

    } catch (error) {
        console.error('Password change error:', error);
        showDialogError('Failed to change password. Please try again.');
        feedbackDiv.className = 'notification-message error';
    }
}

/**
 * Re-encrypts all encrypted data with a new password.
 *
 * Performs a comprehensive re-encryption operation across all encrypted data stores
 * (dreams, goals, and autocomplete) when the user changes their encryption password.
 * This function ensures data remains accessible with the new password while maintaining
 * complete data integrity throughout the process.
 *
 * The function processes each data type sequentially:
 * 1. Dreams: Decrypts with old password, re-encrypts with new password
 * 2. Goals: Decrypts with old password, re-encrypts with new password
 * 3. Autocomplete: Decrypts with old password, re-encrypts with new password
 * 4. Clears decrypted data cache to force reload with new password
 *
 * @async
 * @function
 * @param {string} oldPassword - Current encryption password for decryption
 * @param {string} newPassword - New encryption password for re-encryption
 * @returns {Promise<void>}
 * @since 2.03.05
 * @throws {Error} When re-encryption fails for any data type
 * @example
 * // Re-encrypt all data when user changes password
 * await reEncryptAllData('oldPassword123', 'newPassword456');
 * // All encrypted data now uses newPassword456
 */
async function reEncryptAllData(oldPassword, newPassword) {
    try {
        // Re-encrypt dreams
        const dreams = await loadDreamsRaw();
        for (const dream of dreams) {
            if (isEncryptedItem(dream)) {
                const decrypted = await decryptItemFromStorage(dream, oldPassword);
                const reEncrypted = await encryptItemForStorage(decrypted, newPassword);
                await saveItemToStore('dreams', reEncrypted);
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

        // Re-encrypt autocomplete (handle both tags and dreamSigns)
        const autocompleteTypes = ['tags', 'dreamSigns'];
        for (const type of autocompleteTypes) {
            try {
                const autocomplete = await getAutocompleteSuggestionsRaw(type);
                if (autocomplete && isEncryptedItem(autocomplete)) {
                    const decrypted = await decryptItemFromStorage(autocomplete, oldPassword);
                    const reEncrypted = await encryptItemForStorage(decrypted, newPassword);
                    await saveItemToStore('autocomplete', reEncrypted);
                }
            } catch (error) {
                // Autocomplete may not exist for this type, continue with other types
                console.warn(`Autocomplete ${type} re-encryption skipped:`, error.message);
            }
        }

        // Clear cache to force reload with new password
        clearDecryptedDataCache();

    } catch (error) {
        console.error('Re-encryption error:', error);
        throw new Error('Failed to re-encrypt data with new password');
    }
}

/**
 * Cancels the current password dialog operation.
 *
 * Handles the cancel action for password dialogs by hiding the dialog
 * and providing appropriate user feedback. This function is called when
 * the user clicks the "Cancel" button in password change dialogs.
 *
 * @function
 * @returns {void}
 * @since 2.03.05
 * @example
 * // Called automatically by action router when user clicks "Cancel"
 * // action-router.js handles the data-action="cancel-password-dialog"
 * cancelPasswordDialog();
 */
function cancelPasswordDialog() {
    hidePasswordDialog();
}

// ================================
// ES MODULE EXPORTS
// ================================

export {
    // Cryptographic functions
    generateSalt,
    generateIV,
    deriveKey,
    encryptData,
    decryptData,
    
    // PIN management functions
    hashPinLegacy,
    hashPinSecure,
    isLegacyPinFormat,
    isPinSetup,
    verifyPinHash,
    verifyPin,
    storePinHash,
    setupPin,
    setupNewPin,
    confirmNewPin,
    confirmRemovePin,
    executePinRemoval,
    completePinRemoval,
    
    // UI functions
    showPasswordDialog,
    showPinSetup,
    showSetNewPinScreen,
    showRemovePin,
    showForgotPin,
    showLockScreenForgotPin,
    updateSecurityControls,
    showPinOverlay,
    hidePinOverlay,
    resetPinOverlay,
    verifyLockScreenPin,
    returnToLockScreen,
    
    // Timer and recovery functions
    updateTimerWarning,
    cancelResetTimer,
    confirmCancelTimer,
    confirmStartTimer,
    confirmLockScreenTimer,
    startTitleRecovery,
    verifyDreamTitles,
    startTimerRecovery,
    startLockScreenTimerRecovery,
    startLockScreenTitleRecovery,
    verifyLockScreenDreamTitles,
    restoreWarningBanner,
    completeRecovery,
    
    // Utility functions
    getResetTime,
    removeResetTime,
    removePinHash,

    // Encryption settings management
    loadEncryptionSettings,
    saveEncryptionSettings,
    validateEncryptionPassword,

    // Authentication flow integration
    getAuthenticationRequirements,
    showAuthenticationScreen,
    showEncryptionPasswordScreen,
    verifyEncryptionPassword,
    testEncryptionPassword,
    switchToPinEntry,

    // Enhanced password screens (Phase 5.2)
    hidePasswordDialog,
    showChangeEncryptionPasswordDialog,
    confirmChangeEncryptionPassword,
    reEncryptAllData,
    cancelPasswordDialog,

    // Encryption password recovery functions
    showForgotEncryptionPassword,
    wipeAllData,
    confirmDataWipe,

    // Application control
    toggleLock,
    completePinSetup
};

    
