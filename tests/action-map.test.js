import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourceFiles = [
    ...fs.readdirSync(root).filter(f => /\.(js|html)$/.test(f)),
    'src/app.js'
];

// Removes block comments and line comments, so an action named only in a JSDoc example does not count
function stripComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

const routerSource = stripComments(fs.readFileSync(path.join(root, 'action-router.js'), 'utf8'));
const mapStart = routerSource.indexOf('const ACTION_MAP = {');
const actionNames = [...routerSource.slice(mapStart).matchAll(/^\s*'([a-z0-9-]+)':\s/gm)].map(m => m[1]);

test('ACTION_MAP is found and has entries', () => {
    assert.ok(mapStart > 0);
    assert.ok(actionNames.length > 50, `only ${actionNames.length} actions found`);
});

test('every ACTION_MAP action is used by an element somewhere in the source', () => {
    const sources = sourceFiles.map(f => {
        const text = stripComments(fs.readFileSync(path.join(root, f), 'utf8'));
        // Drop the ACTION_MAP entries themselves, so an entry does not count as its own use
        return f === 'action-router.js' ? text.replace(/^\s*'[a-z0-9-]+':\s.*$/gm, '') : text;
    }).join('\n');

    // Names built at runtime, such as data-action="confirm-${config.type}-password"
    const templates = [...sources.matchAll(/data-action="([^"]*\$\{[^}]*\}[^"]*)"/g)]
        .filter(m => m[1].replace(/\$\{[^}]*\}/g, '').replace(/-/g, '').length >= 3) // `${action}` alone would match every name
        .map(m => new RegExp('^' + m[1].replace(/[.*+?^()|[\]\\]/g, '\\$&').replace(/\$\{[^}]*\}/g, '[a-z0-9-]+') + '$'));

    const unused = actionNames.filter(name => !sources.includes(name) && !templates.some(re => re.test(name)));
    assert.deepEqual(unused, [], `ACTION_MAP entries that nothing emits: ${unused.join(', ')}`);
});

test('ACTION_MAP has no duplicate keys', () => {
    const duplicates = actionNames.filter((name, i) => actionNames.indexOf(name) !== i);
    assert.deepEqual(duplicates, []);
});
