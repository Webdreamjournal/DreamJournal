import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { startServer, launchBrowser, openApp, openTab, importBackup } from './helpers.js';
import { sampleBackup } from './sample-data.js';

const axeSource = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

const TABS = ['journal', 'goals', 'stats', 'advice', 'settings'];

/** Accessibility problems that are already known. A new rule id appearing in a scan fails the suite. */
const KNOWN_RULES = {
    'select-name': 'filter, sort, month and theme <select> elements have no accessible label',
    'color-contrast': 'white on #6469f2 buttons (4.33:1) and the light-theme "(Click to collapse)" hint (3.31:1)',
    'heading-order': 'headings skip levels',
    'landmark-one-main': 'the page has no <main> landmark',
    'region': 'content outside landmarks',
    'aria-allowed-role': 'role="button" on <h3> section headers',
    'scrollable-region-focusable': 'scrollable autocomplete lists cannot be reached by keyboard'
};

async function scan(page) {
    await page.evaluate(axeSource);
    return page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })));
}

async function scanAll(theme) {
    const { page, context } = await openApp(browser, server.url);
    await importBackup(page, sampleBackup(12));
    await openTab(page, 'settings');
    await page.selectOption('#themeSelect', theme);
    const found = {};
    for (const tab of TABS) {
        await openTab(page, tab);
        for (const v of await scan(page)) (found[v.id] ??= []).push(`${tab} (${v.nodes})`);
    }
    await context.close();
    return found;
}

for (const theme of ['dark', 'light']) {
    test(`${theme} theme: no new kinds of accessibility violation`, async () => {
        const found = await scanAll(theme);
        const unknown = Object.keys(found).filter(id => !(id in KNOWN_RULES));
        assert.deepEqual(unknown, [], `new axe rules failing: ${unknown.map(id => `${id} on ${found[id].join(', ')}`).join('; ')}`);
    });

    test(`${theme} theme: no accessibility violations at all`,
        { todo: `Known issues: ${Object.entries(KNOWN_RULES).map(([k, v]) => `${k} (${v})`).join('; ')}` },
        async () => {
            assert.deepEqual(await scanAll(theme), {});
        });
}

test('dialogs move focus inside, keep it there and close with Escape',
    { todo: 'Known gap: the PIN overlay does not take focus, Tab leaves it and Escape does nothing' },
    async () => {
        const { page, context } = await openApp(browser, server.url);
        await openTab(page, 'settings');
        await page.click('[data-action="setup-pin"]');
        await page.waitForSelector('#pinInput');
        const inDialog = () => page.evaluate(() => !!document.activeElement.closest('.pin-overlay'));
        assert.ok(await inDialog(), 'focus did not move into the dialog');
        for (let i = 0; i < 6; i++) {
            await page.keyboard.press('Tab');
            assert.ok(await inDialog(), `focus left the dialog after ${i + 1} Tab presses`);
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        assert.ok(!(await page.locator('.pin-overlay').first().isVisible()), 'Escape did not close the dialog');
        await context.close();
    });

test('arrow keys move between tabs while focus stays on the tab bar',
    { todo: 'Known gap: after ArrowRight, focus jumps into the new panel heading, so a second arrow press does nothing' },
    async () => {
        const { page, context } = await openApp(browser, server.url);
        await page.focus('#tab-journal');
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-goals');
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-stats');
        await context.close();
    });
