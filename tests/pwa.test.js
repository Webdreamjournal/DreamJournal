import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('manifest theme_color matches the page theme-color meta tag', () => {
    const meta = html.match(/<meta name="theme-color" content="([^"]+)"/)[1];
    assert.equal(manifest.theme_color.toLowerCase(), meta.toLowerCase());
});

test('manifest icons and start_url exist on disk', () => {
    for (const icon of manifest.icons) {
        assert.ok(fs.existsSync(path.join(root, icon.src)), `missing icon ${icon.src}`);
    }
    assert.ok(fs.existsSync(path.join(root, manifest.start_url)), 'start_url missing');
});

test('every script referenced by index.html exists locally', () => {
    const srcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
    assert.ok(srcs.length >= 3);
    for (const s of srcs) assert.ok(fs.existsSync(path.join(root, s)), `missing script ${s}`);
});
