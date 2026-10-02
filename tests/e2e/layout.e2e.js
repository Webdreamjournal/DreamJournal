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

test('phone: the tab bar scrolls so every tab can be reached', async () => {
    const { page, context } = await openApp(browser, server.url, VIEWPORTS[1]);
    await page.evaluate(() => { document.querySelector('[role="tablist"]').scrollLeft = 9999; });
    const right = await page.$eval('#tab-settings', el => el.getBoundingClientRect().right);
    assert.ok(right <= 391, `Settings tab ends at ${right}px`);
    await page.click('#tab-settings');
    await page.waitForSelector('#settingsTab', { state: 'visible' });
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
    test(`${vp.name}: long unbroken text stays inside its dream card`,
        { todo: 'Known bug: titles and content without spaces overflow the card on both desktop and phone (needs overflow-wrap in app.css)' },
        async () => {
            const { page, context } = await openApp(browser, server.url, vp);
            await importBackup(page, sampleBackup(2));
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
