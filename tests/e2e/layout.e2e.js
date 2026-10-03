import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openApp, openTab, importBackup } from './helpers.js';
import { sampleBackup } from './sample-data.js';

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

const TABS = ['journal', 'goals', 'stats', 'advice', 'settings'];
const VIEWPORTS = [{ name: 'desktop', width: 1280, height: 800 }, { name: 'phone', width: 390, height: 844, mobile: true }];

for (const vp of VIEWPORTS) {
    test(`${vp.name}: no tab causes sideways page scrolling`, async () => {
        const { page, context, problems } = await openApp(browser, server.url, vp);
        await importBackup(page, sampleBackup(12));
        for (const tab of TABS) {
            await openTab(page, tab);
            const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
            assert.ok(scrollWidth <= clientWidth + 1, `${tab}: page is ${scrollWidth}px wide in a ${clientWidth}px viewport`);
        }
        assert.deepEqual(problems, []);
        await context.close();
    });
}

for (const width of [360, 375, 390, 414]) {
    test(`phone ${width}px: all five tabs fit on screen without scrolling, and each can be used`, async () => {
        const { page, context } = await openApp(browser, server.url, { width, height: 800, mobile: true });
        const layout = await page.evaluate(() => {
            const bar = document.querySelector('[role="tablist"]');
            const tabs = [...bar.querySelectorAll('.app-tab')].filter(t => getComputedStyle(t).display !== 'none');
            return {
                scrolls: bar.scrollWidth > bar.clientWidth + 1,
                tabs: tabs.map(t => { const r = t.getBoundingClientRect(); return { tab: t.dataset.tab, left: r.left, right: r.right, height: r.height }; }),
                viewport: window.innerWidth
            };
        });
        assert.equal(layout.tabs.length, 5);
        assert.equal(layout.scrolls, false, 'the tab bar needs sideways scrolling');
        for (const t of layout.tabs) {
            assert.ok(t.left >= 0 && t.right <= layout.viewport, `${t.tab} tab is cut off (${t.left}..${t.right} in ${layout.viewport}px)`);
            assert.ok(t.height >= 44, `${t.tab} tab is ${t.height}px tall`);
        }
        await page.click('#tab-settings');
        await page.waitForSelector('#settingsTab', { state: 'visible' });
        await page.click('#tab-advice');
        await page.waitForSelector('#adviceTab', { state: 'visible' });
        await context.close();
    });
}

test('phone: buttons and other controls are at least 44 px, checkboxes at least 24 px', async () => {
    const { page, context } = await openApp(browser, server.url, { width: 390, height: 844, mobile: true });
    await importBackup(page, sampleBackup(12));
    const tooSmall = {};
    for (const tab of TABS) {
        await openTab(page, tab);
        const found = await page.evaluate(() => [...document.querySelectorAll('button, [data-action], select, input:not([type="hidden"]):not([type="file"]), textarea')]
            .filter(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && el.offsetParent !== null; })
            .map(el => {
                const r = el.getBoundingClientRect();
                const minimum = el.type === 'checkbox' || el.type === 'radio' ? 24 : 44;
                const name = `${el.tagName.toLowerCase()}${el.dataset.action ? `[${el.dataset.action}]` : ''}${el.id ? `#${el.id}` : ''}`;
                return { name, w: Math.round(r.width), h: Math.round(r.height), minimum };
            })
            .filter(x => x.w < x.minimum || x.h < x.minimum));
        for (const f of found) (tooSmall[`${f.name} ${f.w}x${f.h} (needs ${f.minimum})`] ??= []).push(tab);
    }
    assert.deepEqual(tooSmall, {});
    await context.close();
});

test('the chosen theme is applied and survives a reload', async () => {
    const { page, context } = await openApp(browser, server.url);
    await openTab(page, 'settings');
    await page.selectOption('#themeSelect', 'light');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    await context.close();
});

for (const vp of VIEWPORTS) {
    test(`${vp.name}: long unbroken text stays inside its dream card`, async () => {
        const { page, context } = await openApp(browser, server.url, vp);
        const backup = sampleBackup(2);
        backup.data.dreams[0].emotions = 'e'.repeat(150);
        await importBackup(page, backup);
        // Text that overflows does not enlarge its box, so compare scrollWidth with clientWidth
        const overflow = await page.evaluate(() => {
            const card = document.querySelector('#entry-seed-1000');
            const limit = card.getBoundingClientRect().right;
            return [card, ...card.querySelectorAll('*')]
                .filter(e => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > limit + 1)
                .map(e => `${e.tagName}.${String(e.className).split(' ')[0]}`);
        });
        assert.deepEqual(overflow, []);
        await context.close();
    });
}
