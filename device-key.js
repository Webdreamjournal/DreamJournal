/**
 * @fileoverview Per-device, non-extractable encryption key for secrets stored at rest.
 *
 * Used for Dropbox OAuth tokens when the user has not enabled data encryption (or the
 * encryption password is not available), so tokens never sit readable in localStorage.
 *
 * The AES-GCM key is generated with extractable=false and persisted as a CryptoKey object
 * in a dedicated IndexedDB database. Its raw bytes can never be read by JavaScript, so a
 * copy of the localStorage contents (profile backup, sync, storage dump, devtools
 * screenshot) is useless without the browser's own key store.
 *
 * Limits: script running on the page can still ask the browser to decrypt, so this does
 * not replace XSS defences (see the CSP); it protects the token at rest.
 *
 * @module DeviceKey
 */

const DEVICE_KEY_DB_NAME = 'DreamJournalDeviceKey';
const DEVICE_KEY_STORE = 'keys';
const DEVICE_KEY_ID = 'token-wrapping-key';

/** Prefix marking a value as wrapped with the device key. */
const DEVICE_KEY_PREFIX = 'dev:v1:';

const IV_LENGTH = 12;

/**
 * IndexedDB-backed key store.
 *
 * @returns {{get: function(): Promise<CryptoKey|undefined>, put: function(CryptoKey): Promise<void>}}
 */
function createIndexedDbKeyStore() {
    const open = () => new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB is not available'));
            return;
        }
        const request = indexedDB.open(DEVICE_KEY_DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(DEVICE_KEY_STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    const run = async (mode, action) => {
        const db = await open();
        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(DEVICE_KEY_STORE, mode);
                const request = action(tx.objectStore(DEVICE_KEY_STORE));
                tx.oncomplete = () => resolve(request.result);
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error);
            });
        } finally {
            db.close();
        }
    };

    return {
        get: () => run('readonly', (store) => store.get(DEVICE_KEY_ID)),
        put: (key) => run('readwrite', (store) => store.put(key, DEVICE_KEY_ID)).then(() => undefined)
    };
}

const defaultStore = createIndexedDbKeyStore();

/**
 * Returns the device key, creating and persisting it on first use.
 *
 * @param {Object} [store] - Key store (injectable for tests)
 * @returns {Promise<CryptoKey>} Non-extractable AES-GCM key
 */
async function getOrCreateDeviceKey(store = defaultStore) {
    const existing = await store.get();
    if (existing) return existing;

    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await store.put(key);
    return key;
}

/**
 * Encrypts a string with the device key.
 *
 * @param {string} plaintext - Value to protect
 * @param {Object} [store] - Key store (injectable for tests)
 * @returns {Promise<string>} "dev:v1:" + base64(iv || ciphertext)
 */
async function encryptWithDeviceKey(plaintext, store = defaultStore) {
    const key = await getOrCreateDeviceKey(store);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)));
    const combined = new Uint8Array(iv.length + cipher.length);
    combined.set(iv, 0);
    combined.set(cipher, iv.length);
    let binary = '';
    combined.forEach(b => { binary += String.fromCharCode(b); });
    return DEVICE_KEY_PREFIX + btoa(binary);
}

/**
 * Decrypts a value produced by encryptWithDeviceKey.
 *
 * @param {string} stored - "dev:v1:..." string
 * @param {Object} [store] - Key store (injectable for tests)
 * @returns {Promise<string|null>} Plaintext, or null if the key is missing or the data is invalid
 */
async function decryptWithDeviceKey(stored, store = defaultStore) {
    if (typeof stored !== 'string' || !stored.startsWith(DEVICE_KEY_PREFIX)) return null;
    try {
        const key = await store.get();
        if (!key) return null;
        const combined = Uint8Array.from(atob(stored.slice(DEVICE_KEY_PREFIX.length)), c => c.charCodeAt(0));
        const iv = combined.slice(0, IV_LENGTH);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined.slice(IV_LENGTH));
        return new TextDecoder().decode(plain);
    } catch (error) {
        console.error('Failed to decrypt value with device key:', error);
        return null;
    }
}

export { encryptWithDeviceKey, decryptWithDeviceKey, getOrCreateDeviceKey, DEVICE_KEY_PREFIX };
