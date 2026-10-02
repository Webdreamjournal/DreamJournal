import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, launchBrowser, openApp, openTab, importBackup, storedDreams } from './helpers.js';
import { sampleBackup } from './sample-data.js';

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

const exportAs = async (page, action) => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.click(`[data-action="${action}"]`)]);
    return { name: download.suggestedFilename(), path: await download.path() };
};

test('complete data export and import', async (t) => {
    const { page, context, problems } = await openApp(browser, server.url);
    await importBackup(page, sampleBackup(38));
    await openTab(page, 'settings');

    await t.test('the JSON export contains every dream and the other data sections', async () => {
        const file = await exportAs(page, 'export-all-data');
        const backup = JSON.parse(fs.readFileSync(file.path, 'utf8'));
        assert.equal(backup.data.dreams.length, 38);
        for (const key of ['goals', 'settings', 'autocomplete', 'metadata']) assert.ok(key in backup.data, `missing ${key}`);
        fs.writeFileSync(`${file.path}.keep.json`, JSON.stringify(backup));
        t.exportedPath = `${file.path}.keep.json`;
    });

    await t.test('re-importing the same JSON skips duplicates', async () => {
        await page.setInputFiles('#importAllDataFile', t.exportedPath);
        await page.waitForTimeout(1500);
        assert.equal((await storedDreams(page)).length, 38);
    });

    await t.test('awkward text (HTML, quotes, paragraph break, non-Latin) survives a JSON import intact', async () => {
        const dreams = await storedDreams(page);
        const awkward = dreams.find(d => d.id === 'seed-1000');
        assert.match(awkward.content, /<b>html<\/b> & "quotes"/);
        assert.match(awkward.content, /\n\n/, 'paragraph break lost');
        const unicode = dreams.find(d => d.id === 'seed-1001');
        assert.equal(unicode.title, '日本語のタイトル – ünïcödé');
    });

    assert.deepEqual(problems, []);
    await context.close();
});

test('text export and import', async (t) => {
    const { page, context } = await openApp(browser, server.url);
    await importBackup(page, sampleBackup(10));
    await openTab(page, 'settings');

    await t.test('the text export keeps special characters', async () => {
        const file = await exportAs(page, 'export-dreams');
        const text = fs.readFileSync(file.path, 'utf8');
        assert.ok(text.includes('<b>html</b> & "quotes"'));
        t.textPath = file.path;
    });

    await t.test('re-importing a text export does not duplicate dreams',
        { todo: 'Known bug: the text importer drops blank lines inside dream content (import-export.js, importEntries), so dreams with paragraph breaks no longer match and are added again' },
        async () => {
            const before = (await storedDreams(page)).length;
            await page.setInputFiles('#importFile', t.textPath);
            await page.waitForTimeout(1500);
            assert.equal((await storedDreams(page)).length, before);
        });

    await context.close();
});

test('imported IDs that are unsafe are replaced', async () => {
    const { page, context, problems } = await openApp(browser, server.url);
    const backup = sampleBackup(1);
    backup.data.dreams[0].id = '"><img src=x onerror="window.__pwned=1">';
    await importBackup(page, backup);
    const [dream] = await storedDreams(page);
    assert.match(dream.id, /^[A-Za-z0-9_-]+$/);
    assert.equal(await page.evaluate(() => window.__pwned), undefined);
    assert.deepEqual(problems, []);
    await context.close();
});
