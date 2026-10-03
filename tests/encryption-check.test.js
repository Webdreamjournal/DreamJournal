import './setup.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { saveEncryptionCheck, removeEncryptionCheck, verifyEncryptionCheck, testEncryptionPassword } from '../encryption-settings.js';

// Node has no IndexedDB, so the check record goes through the localStorage fallback in storage.js.

beforeEach(async () => { await removeEncryptionCheck(); });

test('there is no check value until one is saved', async () => {
    assert.equal(await verifyEncryptionCheck('anything'), 'missing');
});

test('the right password is valid and any other is invalid', async () => {
    await saveEncryptionCheck('correct horse');
    assert.equal(await verifyEncryptionCheck('correct horse'), 'valid');
    assert.equal(await verifyEncryptionCheck('wrong horse'), 'invalid');
    assert.equal(await verifyEncryptionCheck(''), 'invalid');
});

test('the stored record is ciphertext and carries no plaintext', async () => {
    await saveEncryptionCheck('correct horse');
    const stored = localStorage.getItem('dreamJournalMeta:encryptionCheck');
    assert.ok(stored, 'record stored');
    const record = JSON.parse(stored);
    assert.equal(record.id, 'encryptionCheck');
    assert.ok(Array.isArray(record.data) && record.data.length > 28);
    assert.ok(!stored.includes('encryption-check'), 'plaintext check text found');
});

test('saving again replaces the value, so only the new password is valid', async () => {
    await saveEncryptionCheck('first password');
    await saveEncryptionCheck('second password');
    assert.equal(await verifyEncryptionCheck('second password'), 'valid');
    assert.equal(await verifyEncryptionCheck('first password'), 'invalid');
});

test('a damaged record is invalid for every password, not valid', async () => {
    await saveEncryptionCheck('correct horse');
    const record = JSON.parse(localStorage.getItem('dreamJournalMeta:encryptionCheck'));
    record.data[record.data.length - 1] ^= 0xff;
    localStorage.setItem('dreamJournalMeta:encryptionCheck', JSON.stringify(record));
    assert.equal(await verifyEncryptionCheck('correct horse'), 'invalid');
});

test('a record that is not a byte array counts as missing', async () => {
    localStorage.setItem('dreamJournalMeta:encryptionCheck', JSON.stringify({ id: 'encryptionCheck', data: 'nope' }));
    assert.equal(await verifyEncryptionCheck('correct horse'), 'missing');
});

test('testEncryptionPassword accepts the right password and names a wrong one', async () => {
    await saveEncryptionCheck('correct horse');
    assert.deepEqual(await testEncryptionPassword('correct horse'), { valid: true });
    const wrong = await testEncryptionPassword('wrong horse');
    assert.equal(wrong.valid, false);
    assert.equal(wrong.reason, 'wrong-password');
});

test('removing the check value returns to missing', async () => {
    await saveEncryptionCheck('correct horse');
    await removeEncryptionCheck();
    assert.equal(await verifyEncryptionCheck('correct horse'), 'missing');
});
