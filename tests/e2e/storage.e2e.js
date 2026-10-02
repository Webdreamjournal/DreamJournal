import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openApp } from './helpers.js';
import { sampleBackup } from './sample-data.js';

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

/**
 * Runs `save` in the page while recording every readwrite IndexedDB transaction, and
 * reports whether each one had committed by the time the save promise resolved.
 */
const committedWhenResolved = (page, saveName, items) => page.evaluate(async ({ saveName, items }) => {
    const storage = await import('/storage.js');
    const original = IDBDatabase.prototype.transaction;
    const writes = [];
    IDBDatabase.prototype.transaction = function (...args) {
        const tx = original.apply(this, args);
        if (tx.mode === 'readwrite') {
            const record = { stores: [...tx.objectStoreNames], committed: false };
            tx.addEventListener('complete', () => { record.committed = true; });
            writes.push(record);
        }
        return tx;
    };
    try {
        await storage[saveName](items);
    } finally {
        IDBDatabase.prototype.transaction = original;
    }
    return writes;
}, { saveName, items });

test('saves resolve after the IndexedDB transaction has committed', async (t) => {
    const { page, context, problems } = await openApp(browser, server.url);
    const { dreams } = sampleBackup(50).data;

    await t.test('saveDreams', async () => {
        const writes = await committedWhenResolved(page, 'saveDreams', dreams);
        assert.ok(writes.length > 0, 'no write transaction was seen');
        assert.ok(writes.every(w => w.committed), `uncommitted at resolve: ${JSON.stringify(writes)}`);
    });

    await t.test('saveGoals', async () => {
        const writes = await committedWhenResolved(page, 'saveGoals', [{ id: 'g1', title: 'Goal', status: 'active' }]);
        assert.ok(writes.length > 0, 'no write transaction was seen');
        assert.ok(writes.every(w => w.committed), `uncommitted at resolve: ${JSON.stringify(writes)}`);
    });

    await t.test('a failing write reports false and keeps the previous data', async () => {
        const result = await page.evaluate(async () => {
            const storage = await import('/storage.js');
            await storage.saveToIndexedDB([{ id: 'keep-1', title: 'Keep', content: 'x' }]);
            // Two items with the same id make the second add() fail, which aborts the transaction
            const ok = await storage.saveToIndexedDB([{ id: 'dup', title: 'a', content: 'a' }, { id: 'dup', title: 'b', content: 'b' }]);
            const raw = await storage.loadDreamsRaw();
            return { ok, ids: raw.map(d => d.id) };
        });
        assert.equal(result.ok, false);
        assert.deepEqual(result.ids, ['keep-1']);
    });

    // The failing-write test logs the expected errors; nothing else should be reported
    assert.deepEqual(problems.filter(p => !/Error writing to dreams store|aborted|Error adding/.test(p)), []);
    await context.close();
});
