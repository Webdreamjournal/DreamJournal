import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const BANNED = /\b(guarantee[sd]?|bulletproof|unbreakable|foolproof|military[- ]grade|industry[- ]standard|robust(ly|ness)?)\b/i;

test('code comments describe behaviour without guarantees or marketing language', () => {
    const offenders = [];
    for (const file of fs.readdirSync(root).filter(f => f.endsWith('.js'))) {
        fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).forEach((line, i) => {
            if (/^\s*(\/\/|\/\*|\*)/.test(line) && BANNED.test(line)) {
                offenders.push(`${file}:${i + 1}: ${line.trim().slice(0, 80)}`);
            }
        });
    }
    assert.deepEqual(offenders, [], 'Reword these comments to state what the code does (see CLAUDE.md)');
});
