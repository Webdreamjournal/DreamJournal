import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openApp, importBackup, storedDreams } from './helpers.js';
import { sampleBackup } from './sample-data.js';

let server, browser, page, context, problems;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

const titles = () => page.$$eval('.entry-title', els => els.map(e => e.textContent.trim()));

test('journal flows', async (t) => {
    ({ page, context, problems } = await openApp(browser, server.url));

    await t.test('saving an empty form is rejected and creates nothing', async () => {
        await page.click('[data-action="save-dream"]');
        await page.waitForTimeout(400);
        assert.equal((await titles()).length, 0);
        assert.match(await page.innerText('body'), /Please enter a dream description/);
    });

    await t.test('a dream with every field is listed with its metadata and the form clears', async () => {
        await page.fill('#dreamTitle', 'Full field dream');
        await page.fill('#dreamContent', 'Details of the full dream.');
        await page.check('#isLucid');
        await page.fill('#dreamEmotions', 'joy, wonder');
        await page.fill('#dreamTags', 'flying, water');
        await page.fill('#dreamSigns', 'floating');
        await page.click('[data-action="save-dream"]');
        const entry = page.locator('.entry', { hasText: 'Full field dream' });
        await entry.waitFor();
        const text = await entry.innerText();
        for (const word of ['joy', 'wonder', 'flying', 'water', 'floating']) assert.match(text, new RegExp(word, 'i'));
        assert.ok(await entry.evaluate(n => n.classList.contains('lucid')), 'lucid styling missing');
        assert.equal(await page.inputValue('#dreamTitle'), '');
    });

    await t.test('Ctrl+Enter saves from the form', async () => {
        await page.fill('#dreamTitle', 'Shortcut dream');
        await page.fill('#dreamContent', 'saved by keyboard');
        await page.press('#dreamContent', 'Control+Enter');
        await page.waitForSelector('.entry-title:has-text("Shortcut dream")');
    });

    await importBackup(page, sampleBackup(38), 40);

    await t.test('the list loads five at a time and more on scroll', async () => {
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('.entry');
        assert.equal((await titles()).length, 5);
        assert.match(await page.innerText('#paginationContainer'), /Showing 5 of 40 dreams/);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForFunction(() => document.querySelectorAll('.entry').length > 5);
    });

    await t.test('search by text and by tag', async () => {
        await page.fill('#searchBox', 'corridor');
        await page.waitForFunction(() => { const e = [...document.querySelectorAll('.entry-title')]; return e.length > 0 && e.every(x => /corridor/i.test(x.textContent)); });
        await page.fill('#searchBox', 'tag:flying');
        await page.waitForTimeout(800);
        assert.ok((await titles()).length > 0);
        await page.fill('#searchBox', '');
    });

    await t.test('lucid filter shows only lucid dreams and Clear restores the list', async () => {
        await page.selectOption('#filterSelect', 'lucid');
        await page.waitForTimeout(700);
        const flags = await page.$$eval('.entry', els => els.map(e => e.classList.contains('lucid')));
        assert.ok(flags.length > 0 && flags.every(Boolean));
        await page.click('[data-action="clear-search-filters"]');
        await page.waitForTimeout(700);
        const after = await page.$$eval('.entry', els => els.map(e => e.classList.contains('lucid')));
        assert.ok(after.some(x => !x), 'still filtered');
    });

    await t.test('sorting oldest first changes the first entry', async () => {
        const first = (await titles())[0];
        await page.selectOption('#sortSelect', { index: 1 });
        await page.waitForTimeout(700);
        assert.notEqual((await titles())[0], first);
        await page.selectOption('#sortSelect', { index: 0 });
    });

    await t.test('page-size selection switches to numbered pagination', async () => {
        await page.selectOption('#limitSelect', '10');
        await page.waitForTimeout(700);
        assert.equal((await titles()).length, 10);
        assert.ok(await page.locator('#paginationContainer [data-action="go-to-page"]').count() > 0);
        await page.selectOption('#limitSelect', 'endless');
    });

    await t.test('date range filter excludes older dreams', async () => {
        await page.fill('#startDateFilter', new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10));
        await page.waitForTimeout(700);
        const n = (await titles()).length;
        assert.ok(n > 0 && n < 38, `entries: ${n}`);
        await page.click('[data-action="clear-search-filters"]');
        await page.waitForTimeout(500);
    });

    await t.test('inline edit saves a changed title; cancelling keeps the original', async () => {
        await page.locator('.entry').first().locator('[data-action="edit-dream"]').click();
        await page.locator('input[id^="edit-title-"]').first().fill('Edited title ✓');
        await page.locator('[data-action="save-edit"]').first().click();
        await page.waitForSelector('.entry-title:has-text("Edited title ✓")');

        const second = page.locator('.entry').nth(1);
        const original = await second.locator('.entry-title').innerText();
        await second.locator('[data-action="edit-dream"]').click();
        await page.locator('input[id^="edit-title-"]').first().fill('SHOULD NOT SAVE');
        await page.locator('[data-action="cancel-edit"]').first().click();
        await page.waitForTimeout(300);
        assert.ok(!(await titles()).includes('SHOULD NOT SAVE'));
        assert.equal(await page.locator('.entry').nth(1).locator('.entry-title').innerText(), original);
    });

    await t.test('delete asks for confirmation and the confirm button reverts after its timeout', async () => {
        const entry = page.locator('.entry').nth(2);
        await entry.locator('[data-action="delete-dream"]').click();
        assert.equal(await entry.locator('[data-action="confirm-delete"]').count(), 1);
        await page.waitForTimeout(10600); // CONSTANTS.MESSAGE_DURATION_EXTENDED is 10s
        assert.equal(await entry.locator('[data-action="delete-dream"]').count(), 1, 'confirm button never reverted');
    });

    await t.test('a confirmed delete is permanent across reloads', async () => {
        const entry = page.locator('.entry').nth(2);
        const title = await entry.locator('.entry-title').innerText();
        await entry.locator('[data-action="delete-dream"]').click();
        await entry.locator('[data-action="confirm-delete"]').click();
        await page.waitForTimeout(800);
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('.entry');
        assert.ok(!(await storedDreams(page)).some(d => d.title === title));
    });

    assert.deepEqual(problems, []);
    await context.close();
});
