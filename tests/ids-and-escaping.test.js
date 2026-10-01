import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateUniqueId, isSafeEntityId, sanitizeEntityIds } from '../storage.js';
import { escapeAttr } from '../dom-helpers.js';

const PAYLOADS = ['"><img src=x onerror=alert(1)>', "x' onmouseover='alert(1)", 'a b', '', 'a'.repeat(101), 42, null];

test('generated IDs are safe and unique', () => {
    const ids = new Set();
    for (let i = 0; i < 2000; i++) {
        const id = generateUniqueId({ title: 't', type: 'dream' });
        assert.ok(isSafeEntityId(id), id);
        ids.add(id);
    }
    assert.equal(ids.size, 2000);
});

test('isSafeEntityId rejects injection payloads', () => {
    for (const p of PAYLOADS) assert.equal(isSafeEntityId(p), false, String(p));
    assert.equal(isSafeEntityId('1725950400123-a7f2-e8d9c4b1'), true);
});

test('sanitizeEntityIds replaces only unsafe IDs', () => {
    const items = [{ id: 'keep-me_1', title: 'a' }, { id: PAYLOADS[0], title: 'b' }, { title: 'c' }];
    sanitizeEntityIds(items, 'dream');
    assert.equal(items[0].id, 'keep-me_1');
    assert.ok(items.every(i => isSafeEntityId(i.id)));
});

test('escapeAttr neutralises attribute breakout', () => {
    const out = escapeAttr(PAYLOADS[0]);
    assert.ok(!/[<>"']/.test(out));
    assert.equal(escapeAttr("a&b"), 'a&amp;b');
    assert.equal(escapeAttr(null), '');
});
