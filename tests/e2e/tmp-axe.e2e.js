import { test, before, after } from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { startServer, launchBrowser, openApp, openTab, importBackup } from './helpers.js';
import { sampleBackup } from './sample-data.js';
const axeSource = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });
for (const theme of ['dark', 'light']) test('axe ' + theme, async () => {
    const { page, context } = await openApp(browser, server.url);
    await importBackup(page, sampleBackup(12));
    await openTab(page, 'settings');
    await page.selectOption('#themeSelect', theme);
    for (const tab of ['journal', 'goals', 'stats', 'advice', 'settings']) {
        await openTab(page, tab);
        await page.evaluate(axeSource);
        const v = await page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target.join(' ') + ' :: ' + (n.any[0]?.message || n.all[0]?.message || n.none[0]?.message || '').slice(0, 120)) })));
        for (const x of v) console.log(`AXE ${theme} ${tab} ${x.id}\n   ` + x.nodes.slice(0, 6).join('\n   '));
    }
    await context.close();
});
