import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const setup = path.join(root, 'tests', 'setup.js');
const SKIP = new Set(['eslint.config.js', 'sw.js', 'theme-init.js', 'unsupported-browser.js']);

// The modules import each other in cycles. That works only while nothing uses an imported
// binding at load time, and whether it fails can depend on which module is loaded first.
// Each module is therefore imported first in a fresh process.
for (const file of fs.readdirSync(root).filter(f => f.endsWith('.js') && !SKIP.has(f)).sort()) {
    test(`${file} loads as the first import`, () => {
        const url = pathToFileUrl(path.join(root, file));
        const result = spawnSync(process.execPath, ['--import', setup, '-e', `import(${JSON.stringify(url)})`], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
    });
}

function pathToFileUrl(p) {
    return new URL(`file://${p}`).href;
}
