import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONSTANTS } from '../constants.js';
import {
    encryptData, decryptData, encryptStoredData, decryptStoredData, clearDerivedKeys, hashPinSecure, verifyPinHash,
    timingSafeEqualHex, computePinLockoutMs, registerFailedPinAttempt
} from '../security.js';
import { setFailedPinAttempts, getFailedPinAttempts, getPinLockoutUntil } from '../state.js';

test('encryptData/decryptData round-trips', async () => {
    const enc = await encryptData('a dream about flying', 'correct horse');
    assert.ok(enc instanceof Uint8Array);
    assert.equal(await decryptData(enc, 'correct horse'), 'a dream about flying');
});

test('decryptData rejects a wrong password and tampered data', async () => {
    const enc = await encryptData('secret', 'pw-one');
    await assert.rejects(() => decryptData(enc, 'pw-two'));
    const tampered = enc.slice();
    tampered[tampered.length - 1] ^= 1;
    await assert.rejects(() => decryptData(tampered, 'pw-one'));
});

test('encryption uses a fresh salt/IV each time', async () => {
    const a = await encryptData('same', 'pw');
    const b = await encryptData('same', 'pw');
    assert.notDeepEqual(a, b);
});

/** Counts PBKDF2 derivations made while `fn` runs. */
async function countDerivations(fn) {
    const original = crypto.subtle.deriveKey;
    let count = 0;
    crypto.subtle.deriveKey = function (...args) { count++; return original.apply(this, args); };
    try {
        await fn();
    } finally {
        crypto.subtle.deriveKey = original;
    }
    return count;
}

test('stored items round-trip and use the same layout as encryptData', async () => {
    clearDerivedKeys();
    const enc = await encryptStoredData('a dream about flying', 'pw-stored');
    assert.equal(await decryptStoredData(enc, 'pw-stored'), 'a dream about flying');
    assert.equal(await decryptData(enc, 'pw-stored'), 'a dream about flying');
    const fromFile = await encryptData('exported text', 'pw-stored');
    assert.equal(await decryptStoredData(fromFile, 'pw-stored'), 'exported text');
});

test('stored items for one password share a salt but not an IV', async () => {
    clearDerivedKeys();
    const items = await Promise.all([1, 2, 3].map(n => encryptStoredData(`dream ${n}`, 'pw-shared')));
    const salts = new Set(items.map(i => Buffer.from(i.slice(0, 16)).toString('hex')));
    const ivs = new Set(items.map(i => Buffer.from(i.slice(16, 28)).toString('hex')));
    assert.equal(salts.size, 1);
    assert.equal(ivs.size, 3);
});

test('a journal of stored items is encrypted and decrypted with one key derivation', async () => {
    clearDerivedKeys();
    let items;
    const encryptCount = await countDerivations(async () => {
        items = [];
        for (let n = 0; n < 20; n++) items.push(await encryptStoredData(`dream ${n}`, 'pw-count'));
    });
    assert.equal(encryptCount, 1);

    clearDerivedKeys(); // a new session starts with an empty cache
    const decryptCount = await countDerivations(async () => {
        for (const item of items) await decryptStoredData(item, 'pw-count');
    });
    assert.equal(decryptCount, 1);
});

test('concurrent stored-item calls derive once and agree on the salt', async () => {
    clearDerivedKeys();
    let items;
    const count = await countDerivations(async () => {
        items = await Promise.all(Array.from({ length: 10 }, (_, n) => encryptStoredData(`dream ${n}`, 'pw-concurrent')));
    });
    assert.equal(count, 1);
    assert.equal(new Set(items.map(i => Buffer.from(i.slice(0, 16)).toString('hex'))).size, 1);
});

test('items written with different salts each cost one derivation to read', async () => {
    clearDerivedKeys();
    const a = await encryptData('from one salt', 'pw-salts');
    const b = await encryptData('from another salt', 'pw-salts');
    const count = await countDerivations(async () => {
        assert.equal(await decryptStoredData(a, 'pw-salts'), 'from one salt');
        assert.equal(await decryptStoredData(b, 'pw-salts'), 'from another salt');
        assert.equal(await decryptStoredData(a, 'pw-salts'), 'from one salt');
    });
    assert.equal(count, 2);
});

test('a wrong password fails, does not poison the right one, and different passwords do not share keys', async () => {
    clearDerivedKeys();
    const enc = await encryptStoredData('private', 'pw-right');
    await assert.rejects(() => decryptStoredData(enc, 'pw-wrong'));
    await assert.rejects(() => decryptStoredData(enc, 'pw-wrong'));
    assert.equal(await decryptStoredData(enc, 'pw-right'), 'private');
    const other = await encryptStoredData('private', 'pw-other');
    assert.notDeepEqual(other.slice(0, 16), enc.slice(0, 16));
});

test('changing the password re-encrypts under a new salt without thrashing the cache', async () => {
    clearDerivedKeys();
    const old = [];
    for (let n = 0; n < 5; n++) old.push(await encryptStoredData(`dream ${n}`, 'pw-old'));
    const count = await countDerivations(async () => {
        for (const item of old) {
            const plain = await decryptStoredData(item, 'pw-old');
            const next = await encryptStoredData(plain, 'pw-new');
            assert.equal(await decryptStoredData(next, 'pw-new'), plain);
        }
    });
    // One derivation for the old key (already cached) is free; only the new password derives, once
    assert.equal(count, 1);
    clearDerivedKeys('pw-old');
    const reread = await countDerivations(() => decryptStoredData(old[0], 'pw-old'));
    assert.equal(reread, 1);
});

test('tampered stored data is rejected', async () => {
    clearDerivedKeys();
    const enc = await encryptStoredData('secret', 'pw-tamper');
    const tampered = enc.slice();
    tampered[tampered.length - 1] ^= 1;
    await assert.rejects(() => decryptStoredData(tampered, 'pw-tamper'));
});

test('PBKDF2 iterations meet the OWASP minimum', () => {
    assert.ok(CONSTANTS.CRYPTO_PBKDF2_ITERATIONS >= 600000);
});

test('PIN hash verifies correct PIN only', async () => {
    const stored = JSON.stringify(await hashPinSecure('1234'));
    assert.equal(await verifyPinHash('1234', stored), true);
    assert.equal(await verifyPinHash('1235', stored), false);
});

test('legacy / malformed PIN data is rejected', async () => {
    assert.equal(await verifyPinHash('1234', '12345678'), false);
    assert.equal(await verifyPinHash('1234', '{"hash":"x"}'), false);
    assert.equal(await verifyPinHash('', JSON.stringify(await hashPinSecure('1234'))), false);
});

test('timingSafeEqualHex', () => {
    assert.equal(timingSafeEqualHex('abcd', 'abcd'), true);
    assert.equal(timingSafeEqualHex('abcd', 'abce'), false);
    assert.equal(timingSafeEqualHex('abcd', 'abc'), false);
    assert.equal(timingSafeEqualHex(null, 'abc'), false);
});

test('lockout schedule: none, then doubling, capped', () => {
    const limit = CONSTANTS.FAILED_PIN_ATTEMPT_LIMIT;
    assert.equal(computePinLockoutMs(0), 0);
    assert.equal(computePinLockoutMs(limit - 1), 0);
    assert.equal(computePinLockoutMs(limit), CONSTANTS.PIN_LOCKOUT_BASE_MS);
    assert.equal(computePinLockoutMs(limit + 1), CONSTANTS.PIN_LOCKOUT_BASE_MS * 2);
    assert.equal(computePinLockoutMs(limit + 50), CONSTANTS.PIN_LOCKOUT_MAX_MS);
});

test('failed attempts persist and trigger a stored lockout', () => {
    setFailedPinAttempts(0);
    for (let i = 0; i < CONSTANTS.FAILED_PIN_ATTEMPT_LIMIT; i++) registerFailedPinAttempt();
    assert.equal(localStorage.getItem('dreamJournalFailedPinAttempts'), String(CONSTANTS.FAILED_PIN_ATTEMPT_LIMIT));
    assert.ok(getPinLockoutUntil() > Date.now());
    setFailedPinAttempts(0);
    assert.equal(getFailedPinAttempts(), 0);
    assert.equal(getPinLockoutUntil(), 0);
});
