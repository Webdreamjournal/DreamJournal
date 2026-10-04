import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Static check that element ids named in the code exist somewhere. getElementById and
// querySelector calls on a missing id return null, and the code then skips its work, so
// a typo or a removed element fails quietly (the "Create Dream Entry" prompt looked for a
// class that was never in the page). Only string literals are checked: a call built from
// a variable or a template with ${} is out of reach of a static scan.

const root = path.resolve(import.meta.dirname, '..');
const sourceFiles = fs.readdirSync(root).filter(f => f.endsWith('.js') && f !== 'eslint.config.js').sort();
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Ids the scan cannot see being defined. Each entry needs a reason, and an entry that is no
// longer needed fails the test so the list does not collect stale names.
const ALLOWED = new Map([
    // Tab panels are created in tab-navigation.js with `tabPanel.id = tabId`
    ['goalsTab', 'tab panel created from a variable id'],
    ['settingsTab', 'tab panel created from a variable id'],
    ['lockTab', 'tab panel created from a variable id'],
    // Lookups of elements that no template contains. Each caller checks for null, so these do nothing today.
    ['voiceRecordingCompatibility', 'tab-navigation.js: no such element'],
    ['voiceRecordingStatus', 'tab-navigation.js: no such element'],
    ['transcriptionCompatibility', 'tab-navigation.js: no such element'],
    ['transcriptionStatus', 'tab-navigation.js: no such element'],
]);

function codeOnly(text) {
    // Drops whole-line comments (JSDoc examples mention ids that are not real)
    return text.split(/\r?\n/).filter(line => !/^\s*(\*|\/\/|\/\*)/.test(line)).join('\n');
}

const sources = Object.fromEntries(sourceFiles.map(f => [f, codeOnly(fs.readFileSync(path.join(root, f), 'utf8'))]));
const allText = html + '\n' + Object.values(sources).join('\n');

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const definedIds = new Set();
const idPatterns = [];
function addDefinition(value) {
    if (!value.includes('${')) {
        definedIds.add(value);
        return;
    }
    // id="edit-title-${id}" defines every id with that prefix. A template that is only ${...} has
    // no literal text to match on, so it defines nothing here and its ids go in ALLOWED.
    const parts = value.split(/\$\{[^}]*\}/);
    if (parts.join('').length === 0) return;
    idPatterns.push(new RegExp('^' + parts.map(escapeRegex).join('.+') + '$'));
}
for (const m of allText.matchAll(/\bid\s*=\s*\\?["']([^"'\\]+)["']/g)) addDefinition(m[1]);
// Field configs such as { id: 'recovery1', type: 'text', ... } that renderPinScreen turns into inputs
for (const m of allText.matchAll(/\{\s*id:\s*'([^']+)',\s*type:/g)) addDefinition(m[1]);
for (const m of allText.matchAll(/\.id\s*=\s*['"`]([^'"`]+)['"`]/g)) addDefinition(m[1]);
for (const m of allText.matchAll(/setAttribute\(\s*['"]id['"]\s*,\s*['"`]([^'"`]+)['"`]/g)) addDefinition(m[1]);

function isDefined(id) {
    return definedIds.has(id) || idPatterns.some(pattern => pattern.test(id));
}

const targets = [];
for (const [file, text] of Object.entries(sources)) {
    for (const m of text.matchAll(/getElementById\(\s*(['"`])([^'"`]*)\1\s*\)/g)) {
        if (!m[2].includes('${')) targets.push({ file, call: 'getElementById', id: m[2] });
    }
    for (const m of text.matchAll(/querySelector(?:All)?\(\s*(['"`])([^'"`]*)\1/g)) {
        if (m[2].includes('${')) continue;
        for (const token of m[2].matchAll(/#([A-Za-z_][\w-]*)/g)) targets.push({ file, call: `querySelector('${m[2]}')`, id: token[1] });
    }
}

test('the scan finds the ids and calls it is meant to check', () => {
    assert.ok(definedIds.size > 100, `only ${definedIds.size} ids found`);
    assert.ok(targets.length > 200, `only ${targets.length} lookups found`);
});

test('every literal getElementById and querySelector id exists in index.html or a rendered template', () => {
    const missing = targets.filter(t => !isDefined(t.id) && !ALLOWED.has(t.id));
    assert.deepEqual(
        missing.map(t => `${t.file}: ${t.call} -> #${t.id}`),
        [],
        'ids that nothing defines: fix the id, or add it to ALLOWED with a reason'
    );
});

test('every ALLOWED id is still looked up and still undefined to the scan', () => {
    for (const id of ALLOWED.keys()) {
        assert.ok(targets.some(t => t.id === id), `${id} is not looked up any more: remove it from ALLOWED`);
        assert.ok(!isDefined(id), `${id} is now defined where the scan can see it: remove it from ALLOWED`);
    }
});
