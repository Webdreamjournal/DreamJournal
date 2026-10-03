import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openApp, openTab, importBackup } from './helpers.js';
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

test('an existing version 5 database is upgraded: the meta store is added and the dreams stay', async () => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.route(/cdn\.jsdelivr\.net/, route => route.abort());
    // A same-origin page that is not the app, so the database can be built the way version 5 left it
    await page.goto(`${server.url}manifest.json`);
    await page.evaluate(() => new Promise((resolve, reject) => {
        const open = indexedDB.open('DreamJournal', 5);
        open.onupgradeneeded = () => {
            const db = open.result;
            const dreams = db.createObjectStore('dreams', { keyPath: 'id' });
            dreams.createIndex('timestamp', 'timestamp', { unique: false });
            dreams.createIndex('isLucid', 'isLucid', { unique: false });
            db.createObjectStore('voiceNotes', { keyPath: 'id' });
            db.createObjectStore('goals', { keyPath: 'id' });
            db.createObjectStore('autocomplete', { keyPath: 'id' });
            dreams.put({ id: 'old-1', title: 'Dream from version 5', content: 'kept', timestamp: new Date().toISOString(), isLucid: false });
        };
        open.onsuccess = () => { open.result.close(); resolve(); };
        open.onerror = () => reject(open.error);
    }));
    await page.goto(server.url, { waitUntil: 'load' });
    await page.waitForFunction(() => { const c = document.querySelector('.container'); return c && getComputedStyle(c).visibility === 'visible'; });
    await page.waitForSelector('.entry');
    assert.match(await page.innerText('body'), /Dream from version 5/);
    const schema = await page.evaluate(() => new Promise(resolve => {
        const open = indexedDB.open('DreamJournal');
        open.onsuccess = () => { const r = { version: open.result.version, stores: [...open.result.objectStoreNames].sort() }; open.result.close(); resolve(r); };
    }));
    assert.equal(schema.version, 6);
    assert.deepEqual(schema.stores, ['autocomplete', 'dreams', 'goals', 'meta', 'voiceNotes']);
    await context.close();
});

test('startup asks the browser for persistent storage once, and the app works whatever the answer', async (t) => {
    for (const [answer, script] of [
        ['granted', 'async () => true'],
        ['refused', 'async () => false'],
        ['an error', 'async () => { throw new Error("blocked"); }']
    ]) {
        await t.test(`persist() answered ${answer}`, async () => {
            const context = await browser.newContext({ serviceWorkers: 'block' });
            const page = await context.newPage();
            await page.route(/cdn\.jsdelivr\.net/, route => route.abort());
            await page.addInitScript((persistSource) => {
                window.__persistCalls = 0;
                const persist = eval(`(${persistSource})`);
                Object.defineProperty(navigator, 'storage', {
                    configurable: true,
                    value: { persisted: async () => false, persist: () => { window.__persistCalls++; return persist(); } }
                });
            }, script);
            const problems = [];
            page.on('pageerror', e => problems.push(e.message));
            await page.goto(server.url, { waitUntil: 'load' });
            await page.waitForFunction(() => { const c = document.querySelector('.container'); return c && getComputedStyle(c).visibility === 'visible'; });
            await page.waitForFunction(() => window.__persistCalls > 0, null, { timeout: 5000 });
            await page.waitForTimeout(300);
            assert.equal(await page.evaluate(() => window.__persistCalls), 1);
            assert.deepEqual(problems, []);
            await context.close();
        });
    }
});

test('when IndexedDB cannot be opened, the app falls back to memory storage and the autocomplete lists still show', async () => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.route(/cdn\.jsdelivr\.net/, route => route.abort());
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    // A database newer than the app expects makes indexedDB.open(name, 6) fail with a VersionError
    await page.goto(`${server.url}manifest.json`);
    await page.evaluate(() => new Promise((resolve, reject) => {
        const open = indexedDB.open('DreamJournal', 99);
        open.onupgradeneeded = () => open.result.createObjectStore('dreams', { keyPath: 'id' });
        open.onsuccess = () => { open.result.close(); resolve(); };
        open.onerror = () => reject(open.error);
    }));
    await page.goto(server.url, { waitUntil: 'load' });
    await page.waitForFunction(() => { const c = document.querySelector('.container'); return c && getComputedStyle(c).visibility === 'visible'; });
    await page.click('#tab-settings');
    await page.waitForSelector('#tagsManagementList .autocomplete-list-item');
    const lists = await page.evaluate(() => ['tagsManagementList', 'dreamSignsManagementList', 'emotionsManagementList']
        .map(id => ({ id, items: document.querySelectorAll(`#${id} .autocomplete-list-item`).length, error: !!document.querySelector(`#${id} .message-error`) })));
    for (const list of lists) {
        assert.equal(list.error, false, `${list.id} shows an error`);
        assert.ok(list.items > 0, `${list.id} is empty`);
    }
    const banner = page.locator('#storageBanner');
    assert.equal(await banner.getAttribute('role'), 'alert');
    assert.match(await banner.innerText(), /Nothing you save will be kept/);
    assert.deepEqual(pageErrors, []);
    await context.close();
});

// A same-origin page that is not the app, used to hold or upgrade the database from "another tab"
const openOtherTab = async (context, url) => {
    const other = await context.newPage();
    await other.goto(`${url}manifest.json`);
    return other;
};

test('a database upgrade in another tab closes this tab\'s connection and asks for a reload', async () => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.route(/cdn\.jsdelivr\.net/, route => route.abort());
    await page.goto(server.url, { waitUntil: 'load' });
    await page.waitForFunction(() => { const c = document.querySelector('.container'); return c && getComputedStyle(c).visibility === 'visible'; });
    await page.waitForSelector('#tab-journal');
    assert.equal(await page.locator('#storageBanner').count(), 0, 'banner shown before anything went wrong');

    // The upgrade only completes if the app tab closes its connection when it gets versionchange
    const other = await openOtherTab(context, server.url);
    const upgraded = await other.evaluate(() => new Promise((resolve, reject) => {
        const open = indexedDB.open('DreamJournal', 7);
        let blocked = false;
        open.onblocked = () => { blocked = true; };
        open.onsuccess = () => { open.result.close(); resolve({ blocked }); };
        open.onerror = () => reject(open.error);
    }));
    assert.equal(upgraded.blocked, false, 'the app tab kept its connection open');
    await page.waitForSelector('#storageBanner[data-kind="updated"]');
    assert.match(await page.innerText('#storageBanner'), /updated in another tab/);

    // The reload button reloads; the app is older than the database, so it falls back to the memory banner
    await Promise.all([page.waitForNavigation(), page.click('#storageBanner button')]);
    await page.waitForSelector('#storageBanner[data-kind="memory"]');
    await context.close();
});

/** Upgrades the database from a second page and waits until the app page has shown the "updated" banner. */
const upgradeFromOtherTab = async (context, page) => {
    const other = await openOtherTab(context, server.url);
    await other.evaluate(() => new Promise((resolve, reject) => {
        const open = indexedDB.open('DreamJournal', 7);
        open.onsuccess = () => { open.result.close(); resolve(); };
        open.onerror = () => reject(open.error);
    }));
    await page.waitForSelector('#storageBanner[data-kind="updated"]');
};

test('after another tab upgraded the database, saving a new dream is refused and the form keeps what was typed', async () => {
    const { page, context } = await openApp(browser, server.url);
    await importBackup(page, sampleBackup(2));
    await page.fill('#dreamTitle', 'Typed before the upgrade');
    await page.fill('#dreamContent', 'This text must not be lost.');
    await upgradeFromOtherTab(context, page);

    await page.click('[data-action="save-dream"]');
    await page.waitForSelector('#dreamFormFull .message-error:has-text("Reload the page first")');
    assert.equal(await page.inputValue('#dreamTitle'), 'Typed before the upgrade');
    assert.equal(await page.inputValue('#dreamContent'), 'This text must not be lost.');
    assert.equal(await page.locator('.message-success:has-text("Dream saved")').count(), 0);
    assert.equal(await page.locator('.entry').count(), 2, 'a dream was added to the list');
    await context.close();
});

test('after another tab upgraded the database, saving an inline dream edit is refused and the edit keeps what was typed', async () => {
    const { page, context } = await openApp(browser, server.url);
    await importBackup(page, sampleBackup(2));
    const entry = page.locator('.entry').first();
    await entry.locator('[data-action="edit-dream"]').click();
    await entry.locator('textarea[id^="edit-content-"]').fill('Edited text that must stay');
    await upgradeFromOtherTab(context, page);

    await entry.locator('[data-action="save-edit"]').click();
    await entry.locator('.message-error:has-text("Reload the page first")').waitFor();
    assert.equal(await entry.locator('textarea[id^="edit-content-"]').inputValue(), 'Edited text that must stay');
    await context.close();
});

test('after another tab upgraded the database, saving a goal is refused and the form keeps what was typed', async () => {
    const { page, context } = await openApp(browser, server.url);
    await openTab(page, 'goals');
    await page.click('[data-action="create-goal"]');
    await page.fill('#goalTitle', 'Goal typed before the upgrade');
    await page.selectOption('#goalType', 'custom');
    await page.fill('#goalTarget', '3');
    await upgradeFromOtherTab(context, page);

    await page.click('[data-action="save-goal"]');
    await page.waitForSelector('.message-error:has-text("Reload the page first")');
    assert.equal(await page.inputValue('#goalTitle'), 'Goal typed before the upgrade');
    assert.equal(await page.locator('[id^="goal-"]:has-text("Goal typed before the upgrade")').count(), 0);
    await context.close();
});

test('an open connection to an older database blocks the upgrade: the banner says so and clears once it closes', async () => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const other = await openOtherTab(context, server.url);
    // Version 5 database held open without a versionchange handler, like a tab running older code
    await other.evaluate(() => new Promise((resolve, reject) => {
        const open = indexedDB.open('DreamJournal', 5);
        open.onupgradeneeded = () => {
            const db = open.result;
            db.createObjectStore('dreams', { keyPath: 'id' }).createIndex('timestamp', 'timestamp');
            db.createObjectStore('voiceNotes', { keyPath: 'id' });
            db.createObjectStore('goals', { keyPath: 'id' });
            db.createObjectStore('autocomplete', { keyPath: 'id' });
        };
        open.onsuccess = () => { window.__heldConnection = open.result; resolve(); };
        open.onerror = () => reject(open.error);
    }));
    const page = await context.newPage();
    await page.route(/cdn\.jsdelivr\.net/, route => route.abort());
    await page.goto(server.url, { waitUntil: 'load' });
    await page.waitForSelector('#storageBanner[data-kind="blocked"]');
    assert.match(await page.innerText('#storageBanner'), /Close the other Dream Journal tabs/);

    await other.evaluate(() => window.__heldConnection.close());
    await page.waitForSelector('#storageBanner', { state: 'detached', timeout: 10000 });
    await page.waitForSelector('#tagsManagementList, #tab-settings');
    await page.click('#tab-settings');
    await page.waitForSelector('#tagsManagementList .autocomplete-list-item');
    await context.close();
});
