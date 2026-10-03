import './setup.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { requestPersistentStorage } from '../storage.js';

const setStorageManager = (manager) => Object.defineProperty(globalThis.navigator, 'storage', { value: manager, configurable: true });
afterEach(() => { delete globalThis.navigator.storage; });

test('reports unsupported when the browser has no storage manager or no persist()', async () => {
    assert.equal(await requestPersistentStorage(), 'unsupported');
    setStorageManager({});
    assert.equal(await requestPersistentStorage(), 'unsupported');
});

test('does not ask again when storage is already persistent', async () => {
    let asked = 0;
    setStorageManager({ persisted: async () => true, persist: async () => { asked++; return true; } });
    assert.equal(await requestPersistentStorage(), 'already-persistent');
    assert.equal(asked, 0);
});

test('asks once and reports the answer', async () => {
    let asked = 0;
    setStorageManager({ persisted: async () => false, persist: async () => { asked++; return true; } });
    assert.equal(await requestPersistentStorage(), 'granted');
    assert.equal(asked, 1);
    setStorageManager({ persisted: async () => false, persist: async () => false });
    assert.equal(await requestPersistentStorage(), 'denied');
});

test('asks when the browser has persist() but no persisted()', async () => {
    setStorageManager({ persist: async () => true });
    assert.equal(await requestPersistentStorage(), 'granted');
});

test('an error from the browser is reported as denied and does not throw', async () => {
    const warn = console.warn;
    console.warn = () => {};
    try {
        setStorageManager({ persisted: async () => false, persist: async () => { throw new Error('blocked'); } });
        assert.equal(await requestPersistentStorage(), 'denied');
    } finally {
        console.warn = warn;
    }
});
