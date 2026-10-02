// Manual QA helper (not part of CI): saves full-page screenshots of every tab, in both
// themes and at desktop and phone sizes, into qa-screenshots/ for visual review.
// Run with:  npm run qa:screenshots   (set CHROMIUM_PATH to use a preinstalled Chromium)
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launchBrowser, openApp, openTab, importBackup } from '../e2e/helpers.js';
import { sampleBackup } from '../e2e/sample-data.js';

const out = path.resolve(import.meta.dirname, '..', '..', 'qa-screenshots');
fs.mkdirSync(out, { recursive: true });

const server = await startServer();
const browser = await launchBrowser();
const sizes = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844, mobile: true } };

for (const [sizeName, size] of Object.entries(sizes)) {
    for (const theme of ['dark', 'light']) {
        const { page, context } = await openApp(browser, server.url, size);
        await importBackup(page, sampleBackup(38));
        await openTab(page, 'settings');
        await page.selectOption('#themeSelect', theme);
        for (const tab of ['journal', 'goals', 'stats', 'advice', 'settings']) {
            await openTab(page, tab);
            await page.waitForTimeout(400);
            const file = path.join(out, `${sizeName}-${theme}-${tab}.png`);
            await page.screenshot({ path: file, fullPage: true });
            console.log(file);
        }
        await context.close();
    }
}
await browser.close();
await server.close();
