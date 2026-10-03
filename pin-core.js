/**
 * @fileoverview PIN hashing and verification, failed-attempt lockout, and storage of the PIN hash and
 *   the recovery reset time (localStorage with an in-memory fallback). No UI.
 *
 * @module PinCore
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { CONSTANTS } from './constants.js';
import { getFailedPinAttempts, setFailedPinAttempts, setPinLockoutUntil, getPinLockoutUntil } from './state.js';
import { isLocalStorageAvailable } from './storage.js';
import { generateSalt } from './security-crypto.js';

// ================================
// TYPE DEFINITIONS
// ================================

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
    
// ================================
// 3. PIN HASHING & VERIFICATION SYSTEM
// ================================

/**
 * Securely hashes a PIN using PBKDF2 with salt and configurable iterations.
 * 
 * This function stores a PIN as a PBKDF2 (SHA-256) hash. Uses a random salt to prevent
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
 * Compares two hex strings in time independent of where they first differ.
 *
 * @param {string} a - First hex string
 * @param {string} b - Second hex string
 * @returns {boolean} True when both strings are identical
 */
function timingSafeEqualHex(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

/**
 * Computes how long entry is locked after a number of consecutive failures.
 *
 * No lockout up to FAILED_PIN_ATTEMPT_LIMIT failures; after that the delay starts at
 * PIN_LOCKOUT_BASE_MS and doubles with each further failure, capped at PIN_LOCKOUT_MAX_MS.
 *
 * @param {number} attempts - Consecutive failed attempts
 * @returns {number} Lockout duration in milliseconds (0 for none)
 */
function computePinLockoutMs(attempts) {
    const over = attempts - CONSTANTS.FAILED_PIN_ATTEMPT_LIMIT;
    if (!(over >= 0)) return 0;
    return Math.min(CONSTANTS.PIN_LOCKOUT_BASE_MS * Math.pow(2, over), CONSTANTS.PIN_LOCKOUT_MAX_MS);
}

/**
 * Records a failed PIN/password attempt and starts a persisted lockout when due.
 * The counter and lockout survive page reloads.
 *
 * @returns {number} Total failed attempts so far
 */
function registerFailedPinAttempt() {
    const attempts = getFailedPinAttempts() + 1;
    setFailedPinAttempts(attempts);
    const lockoutMs = computePinLockoutMs(attempts);
    if (lockoutMs > 0) {
        setPinLockoutUntil(Date.now() + lockoutMs);
    }
    return attempts;
}

/**
 * Gets the remaining lockout time, in milliseconds.
 *
 * @returns {number} Milliseconds until entry is allowed again (0 when not locked out)
 */
function getPinLockoutRemainingMs() {
    return Math.max(0, getPinLockoutUntil() - Date.now());
}

/**
 * Formats a lockout message such as "Too many attempts. Try again in 30 seconds."
 *
 * @param {number} ms - Remaining lockout in milliseconds
 * @returns {string} User-facing message
 */
function formatPinLockoutMessage(ms) {
    const seconds = Math.ceil(ms / 1000);
    const wait = seconds >= 60 ? `${Math.ceil(seconds / 60)} minute(s)` : `${seconds} second(s)`;
    return `Too many incorrect attempts. Try again in ${wait}.`;
}

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
        const stored = JSON.parse(storedData);
        if (!stored.hash || !stored.salt) return false;

        // Convert hex salt back to Uint8Array
        const saltArray = [];
        for (let i = 0; i < stored.salt.length; i += 2) {
            saltArray.push(parseInt(stored.salt.substr(i, 2), 16));
        }
        const salt = new Uint8Array(saltArray);

        // Hash the entered PIN with the stored salt and compare without early exit
        const hashedEntered = await hashPinSecure(enteredPin, salt);
        return timingSafeEqualHex(hashedEntered.hash, stored.hash);

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
// ES MODULE EXPORTS
// ================================

export {
    hashPinSecure,
    timingSafeEqualHex,
    computePinLockoutMs,
    registerFailedPinAttempt,
    getPinLockoutRemainingMs,
    formatPinLockoutMessage,
    verifyPinHash,
    isPinSetup,
    storePinHash,
    getStoredPinData,
    removePinHash,
    storeResetTime,
    getResetTime,
    removeResetTime
};
