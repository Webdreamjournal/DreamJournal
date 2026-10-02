import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { APP_VERSION } from '../version.js';

const root = path.resolve(import.meta.dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('APP_VERSION looks like a version', () => {
    assert.match(APP_VERSION, /^\d+\.\d{2}\.\d{2}$/);
});

test('README badge, footer and service worker cache name match APP_VERSION', () => {
    const dashed = APP_VERSION.replace(/\./g, '-');
    assert.ok(read('README.md').includes(`version-${APP_VERSION}-blue.svg`), 'README badge');
    assert.ok(read('index.html').includes(`Dream Journal v${APP_VERSION} |`), 'index.html footer');
    assert.ok(read('sw.js').includes(`'dream-journal-v${dashed}'`), 'sw.js CACHE_NAME');
});

test('no module hard-codes a different version string', () => {
    const offenders = fs.readdirSync(root).filter(f => f.endsWith('.js') && f !== 'version.js')
        .filter(f => /(@version\s+|version:\s*'|Module v)\d+\.\d{2}\.\d{2}/.test(read(f))
            && [...read(f).matchAll(/(?:@version\s+|version:\s*'|Module v)(\d+\.\d{2}\.\d{2})/g)].some(m => m[1] !== APP_VERSION));
    assert.deepEqual(offenders, []);
});

test('every precached file exists and new modules are precached', () => {
    const sw = read('sw.js');
    const list = [...sw.matchAll(/^\s*'\.\/([^']+)',?\s*(?:\/\/.*)?$/gm)].map(m => m[1]).filter(f => f && !f.endsWith('/'));
    assert.ok(list.length > 20);
    for (const f of list) assert.ok(fs.existsSync(path.join(root, f)), `missing precache file ${f}`);
    for (const f of ['version.js', 'logger.js', 'device-key.js', 'dialog-focus.js', 'theme-init.js']) assert.ok(list.includes(f), `${f} not precached`);
});

test('modules do not call console.log directly (use debugLog)', () => {
    const offenders = fs.readdirSync(root).filter(f => f.endsWith('.js') && !['logger.js'].includes(f))
        .filter(f => /^\s*console\.(log|debug|info)\(/m.test(read(f)));
    assert.deepEqual(offenders, []);
});
