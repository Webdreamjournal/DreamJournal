import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONSTANTS } from '../constants.js';
import {
    encryptData, decryptData, hashPinSecure, verifyPinHash,
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
