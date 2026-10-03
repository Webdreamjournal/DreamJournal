import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openApp, openTab, importBackup } from './helpers.js';
import { sampleBackup } from './sample-data.js';

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

const expanded = (page, action) => page.locator(`[data-action="${action}"]`).first().getAttribute('aria-expanded');

test('collapsible sections open and close on every tab', async (t) => {
    const { page, context, problems } = await openApp(browser, server.url);
    const sections = {
        goals: ['toggle-goals-active', 'toggle-goals-templates', 'toggle-goals-completed'],
        advice: ['toggle-advice-daily-tip', 'toggle-advice-techniques', 'toggle-advice-general'],
        settings: ['toggle-settings-appearance', 'toggle-settings-security', 'toggle-settings-data', 'toggle-settings-autocomplete'],
        journal: ['toggle-journal-controls']
    };
    for (const [tab, actions] of Object.entries(sections)) {
        await t.test(`${tab}: ${actions.length} section(s) collapse and expand`, async () => {
            await openTab(page, tab);
            for (const action of actions) {
                const before = await expanded(page, action);
                await page.locator(`[data-action="${action}"]`).first().click();
                await page.waitForTimeout(400);
                assert.notEqual(await expanded(page, action), before, `${action} did not change`);
                await page.locator(`[data-action="${action}"]`).first().click();
                await page.waitForTimeout(400);
                assert.equal(await expanded(page, action), before, `${action} did not return`);
            }
        });
    }

    await t.test('the dream form collapses to its header and expands again', async () => {
        await openTab(page, 'journal');
        const field = page.locator('#dreamTitle');
        assert.ok(await field.isVisible());
        await page.locator('[data-action="toggle-settings-dream"]:visible').first().click();
        await page.waitForTimeout(400);
        assert.ok(!(await field.isVisible()), 'form still visible after collapsing');
        await page.locator('[data-action="toggle-settings-dream"]:visible').first().click();
        await page.waitForTimeout(400);
        assert.ok(await field.isVisible(), 'form not visible after expanding');
    });

    assert.deepEqual(problems, []);
    await context.close();
});

test('help tooltips open and close', async (t) => {
    const { page, context, problems } = await openApp(browser, server.url);
    await openTab(page, 'journal');
    const cases = [
        ['show-emotions-help', 'emotions-help-tooltip', 'close-emotions-help'],
        ['show-tags-help', 'tags-help-tooltip', 'close-tags-help'],
        ['show-dream-signs-help', 'dream-signs-help-tooltip', 'close-dream-signs-help'],
        ['show-smart-search-help', 'smart-search-help-tooltip', 'close-smart-search-help'],
        ['show-export-info', null, 'close-export-info']
    ];
    for (const [open, id, close] of cases) {
        await t.test(`${open} shows a tooltip and ${close} removes it`, async () => {
            await page.locator(`[data-action="${open}"]`).first().click();
            const tooltip = page.locator(id ? `#${id}` : '.export-info-tooltip');
            await tooltip.first().waitFor({ state: 'visible' });
            assert.ok((await tooltip.first().innerText()).trim().length > 20, 'tooltip has no text');
            await page.locator(`[data-action="${close}"]`).first().click();
            await page.waitForFunction((sel) => !document.querySelector(sel), id ? `#${id}` : '.export-info-tooltip', { timeout: 5000 });
        });
    }
    assert.deepEqual(problems, []);
    await context.close();
});

test('stats: a calendar day opens the journal on that date', async (t) => {
    const { page, context, problems } = await openApp(browser, server.url);
    await importBackup(page, sampleBackup(12));

    await t.test('clicking a calendar day with dreams opens the journal filtered to that date', async () => {
        await openTab(page, 'stats');
        const day = page.locator('[data-action="go-to-date"]').first();
        await day.waitFor();
        await day.click();
        await page.waitForSelector('#journalTab', { state: 'visible' });
        assert.ok(await page.locator('.entry').count() > 0);
    });

    assert.deepEqual(problems, []);
    await context.close();
});

test('goals pagination and the daily tip navigation', async (t) => {
    const { page, context, problems } = await openApp(browser, server.url);
    await page.evaluate(() => new Promise(resolve => {
        const open = indexedDB.open('DreamJournal');
        open.onsuccess = () => {
            const tx = open.result.transaction('goals', 'readwrite');
            for (let i = 1; i <= 7; i++) {
                tx.objectStore('goals').put({ id: `goal_page_${i}`, title: `Paged goal ${i}`, description: '', type: 'custom', status: 'active', target: 3, progress: 0, createdAt: new Date(2026, 0, i).toISOString() });
            }
            tx.oncomplete = () => { open.result.close(); resolve(); };
        };
    }));
    await page.reload({ waitUntil: 'load' });

    await t.test('seven goals are split over two pages', async () => {
        await openTab(page, 'goals');
        await page.waitForSelector('[id^="goal-"]');
        assert.equal(await page.locator('[id^="goal-"]:has-text("Paged goal")').count(), 5);
        await page.locator('.pagination button:has-text("Next")').first().click();
        await page.waitForFunction(() => document.querySelectorAll('[id^="goal-"]').length === 2, null, { timeout: 5000 });
        await page.locator('.pagination button:has-text("Previous")').first().click();
        await page.waitForFunction(() => document.querySelectorAll('[id^="goal-"]').length === 5, null, { timeout: 5000 });
    });

    await t.test('the next and previous tip buttons change the tip', async () => {
        await openTab(page, 'advice');
        await page.waitForFunction(() => /Tip \d+ of \d+/.test(document.getElementById('tipCounter')?.innerText ?? ''), null, { timeout: 10000 });
        const first = { text: await page.innerText('#tipText'), counter: await page.innerText('#tipCounter') };
        await page.click('#nextTip');
        await page.waitForFunction((c) => document.getElementById('tipCounter').innerText !== c, first.counter, { timeout: 5000 });
        assert.notEqual(await page.innerText('#tipText'), first.text);
        await page.click('#prevTip');
        await page.waitForFunction((c) => document.getElementById('tipCounter').innerText === c, first.counter, { timeout: 5000 });
        assert.equal(await page.innerText('#tipText'), first.text);
    });

    assert.deepEqual(problems, []);
    await context.close();
});
