/**
 * @fileoverview AES-GCM and PBKDF2 helpers: salt and IV generation, key derivation, encryptData /
 *   decryptData for export files and tokens, and encryptStoredData / decryptStoredData,
 *   which keep one derived key per password and salt in memory for stored items.
 *
 * @module SecurityCrypto
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { CONSTANTS } from './constants.js';

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
 * Uses Password-Based Key Derivation Function 2 (PBKDF2) with SHA-256 and
 * `CONSTANTS.CRYPTO_PBKDF2_ITERATIONS` iterations to derive a 256-bit AES key from the
 * provided password and salt. Each call costs about 100 ms, which is why stored items
 * go through the key cache below instead of deriving a key per item.
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
            iterations: CONSTANTS.CRYPTO_PBKDF2_ITERATIONS,
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
 * 2. Derives an AES-256 key using PBKDF2 (`CONSTANTS.CRYPTO_PBKDF2_ITERATIONS` iterations)
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
        const salt = generateSalt();
        const key = await deriveKey(password, salt);
        return await sealWithKey(key, salt, data);
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Encrypts a string with an already derived key and packs the result as
 * [16-byte salt][12-byte IV][ciphertext + auth tag]. A new IV is generated per call.
 *
 * @param {CryptoKey} key - AES-GCM key derived from the password and `salt`
 * @param {Uint8Array} salt - The salt the key was derived with (stored with the data)
 * @param {string} data - Plain text to encrypt
 * @returns {Promise<Uint8Array>} Combined salt, IV and ciphertext
 */
async function sealWithKey(key, salt, data) {
    const iv = generateIV();
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        new TextEncoder().encode(data)
    );

    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);
    return result;
}

/**
 * Decrypts the [salt][IV][ciphertext] layout written by `sealWithKey` with a derived key.
 *
 * @param {CryptoKey} key - AES-GCM key derived from the password and the data's salt
 * @param {Uint8Array} encryptedData - Combined salt, IV and ciphertext
 * @returns {Promise<string>} Plain text
 */
async function openWithKey(key, encryptedData) {
    const iv = encryptedData.slice(16, 28);
    const encrypted = encryptedData.slice(28);
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
    );
    return new TextDecoder().decode(decrypted);
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
        const key = await deriveKey(password, salt);
        return await openWithKey(key, encryptedData);
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data - incorrect password or corrupted file');
    }
}

// ---- Stored items: one derived key per password and salt ----
//
// Deriving a key costs about 100 ms, so deriving one per stored dream made unlocking a
// journal take about 100 ms per dream. Stored items instead share a salt: the first salt
// used for a password becomes that password's "current" salt (generated when the first
// item is encrypted, or adopted from the first item decrypted), later items are encrypted
// under it, and the derived key is kept in memory. Each item still carries its own copy
// of the salt and a fresh IV, so items written with a different salt, and files made by
// encryptData, can still be decrypted, at one derivation per distinct salt.

const KEY_CACHE_MAX_PASSWORDS = 2; // old and new password during a password change

/** password -> { keys: Map<saltHex, Promise<CryptoKey>>, currentSalt: Uint8Array|null } */
const derivedKeyCache = new Map();

function saltToHex(salt) {
    return Array.from(salt, byte => byte.toString(16).padStart(2, '0')).join('');
}

function getKeyCacheEntry(password) {
    let entry = derivedKeyCache.get(password);
    if (entry) {
        derivedKeyCache.delete(password); // re-insert below so the most recently used stays last
    } else {
        entry = { keys: new Map(), currentSalt: null };
    }
    derivedKeyCache.set(password, entry);
    if (derivedKeyCache.size > KEY_CACHE_MAX_PASSWORDS) {
        derivedKeyCache.delete(derivedKeyCache.keys().next().value);
    }
    return entry;
}

/** Returns the derived key for this password and salt, deriving it only the first time. */
function getDerivedKey(password, salt) {
    const entry = getKeyCacheEntry(password);
    const id = saltToHex(salt);
    let pending = entry.keys.get(id);
    if (!pending) {
        pending = deriveKey(password, salt);
        entry.keys.set(id, pending);
        // A failed derivation is not kept, so the next call tries again
        pending.catch(() => {
            if (entry.keys.get(id) === pending) entry.keys.delete(id);
        });
        if (!entry.currentSalt) entry.currentSalt = salt.slice();
    }
    return pending;
}

/**
 * Forgets cached derived keys. Call when the session password is cleared or replaced.
 *
 * @param {string} [password] - Forget only this password's keys; omit to forget all
 */
function clearDerivedKeys(password) {
    if (password === undefined) {
        derivedKeyCache.clear();
    } else {
        derivedKeyCache.delete(password);
    }
}

/**
 * Encrypts a stored item (dream, goal, autocomplete data) under the shared key for `password`.
 * Produces the same layout as `encryptData`.
 *
 * @param {string} data - Plain text to encrypt
 * @param {string} password - Encryption password
 * @returns {Promise<Uint8Array>} Combined salt, IV and ciphertext
 */
async function encryptStoredData(data, password) {
    try {
        // No await between reading currentSalt and getDerivedKey, so concurrent calls agree on one salt
        const salt = getKeyCacheEntry(password).currentSalt || generateSalt();
        const key = await getDerivedKey(password, salt);
        return await sealWithKey(key, salt, data);
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypts a stored item written by `encryptStoredData` or `encryptData`, reusing the
 * derived key when the salt has been seen before.
 *
 * @param {Uint8Array} encryptedData - Combined salt, IV and ciphertext
 * @param {string} password - Encryption password
 * @returns {Promise<string>} Plain text
 */
async function decryptStoredData(encryptedData, password) {
    try {
        const key = await getDerivedKey(password, encryptedData.slice(0, 16));
        return await openWithKey(key, encryptedData);
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data - incorrect password or corrupted file');
    }
}

// ================================
// ES MODULE EXPORTS
// ================================

export {
    generateSalt,
    generateIV,
    deriveKey,
    encryptData,
    decryptData,
    clearDerivedKeys,
    encryptStoredData,
    decryptStoredData
};
