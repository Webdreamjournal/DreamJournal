import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptWithDeviceKey, decryptWithDeviceKey, getOrCreateDeviceKey, DEVICE_KEY_PREFIX } from '../device-key.js';

const memoryStore = () => {
    let key;
    return { get: async () => key, put: async (k) => { key = k; } };
};

test('round-trips and never exposes the plaintext', async () => {
    const store = memoryStore();
    const wrapped = await encryptWithDeviceKey('sl.refresh-token-123', store);
    assert.ok(wrapped.startsWith(DEVICE_KEY_PREFIX));
    assert.ok(!wrapped.includes('sl.refresh-token-123'));
    assert.equal(await decryptWithDeviceKey(wrapped, store), 'sl.refresh-token-123');
});

test('device key is non-extractable and reused', async () => {
    const store = memoryStore();
    const key = await getOrCreateDeviceKey(store);
    assert.equal(key.extractable, false);
    await assert.rejects(() => crypto.subtle.exportKey('raw', key));
    assert.strictEqual(await getOrCreateDeviceKey(store), key);
});

test('uses a fresh IV each time', async () => {
    const store = memoryStore();
    assert.notEqual(await encryptWithDeviceKey('same', store), await encryptWithDeviceKey('same', store));
});

test('returns null for a different key, tampered data, or foreign values', async () => {
    const wrapped = await encryptWithDeviceKey('secret', memoryStore());
    assert.equal(await decryptWithDeviceKey(wrapped, memoryStore()), null); // other device's (empty) store
    const store = memoryStore();
    const good = await encryptWithDeviceKey('secret', store);
    const flipped = good.slice(0, -4) + (good.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    assert.equal(await decryptWithDeviceKey(flipped, store), null);
    assert.equal(await decryptWithDeviceKey('plain-token', store), null);
    assert.equal(await decryptWithDeviceKey(null, store), null);
});
