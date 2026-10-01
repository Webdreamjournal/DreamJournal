import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('index.html declares a CSP that forbids inline scripts', () => {
    const m = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
    assert.ok(m, 'CSP meta tag missing');
    const scriptSrc = m[1].split(';').map(s => s.trim()).find(d => d.startsWith('script-src'));
    assert.ok(scriptSrc && !/unsafe-inline|unsafe-eval/.test(scriptSrc), scriptSrc);
    assert.match(m[1], /object-src 'none'/);
});

test('index.html has no inline scripts or event-handler attributes', () => {
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)];
    assert.equal(inline.length, 0, 'inline <script> found');
    assert.equal(/\son[a-z]+\s*=/i.test(html), false, 'inline handler attribute found');
});

test('no JS source builds inline onclick handlers', () => {
    const offenders = fs.readdirSync(root).filter(f => f.endsWith('.js'))
        .filter(f => /\bon(click|change|input|submit|load|error)=["']/.test(fs.readFileSync(path.join(root, f), 'utf8')));
    assert.deepEqual(offenders, []);
});
