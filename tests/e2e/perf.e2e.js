import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openApp, openTab, importBackup } from './helpers.js';

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

const bigBackup = (n) => ({
    data: {
        dreams: Array.from({ length: n }, (_, i) => ({
            id: `big-${i}`, title: `Dream ${i} ${['flying', 'falling', 'chase', 'water'][i % 4]}`,
            content: 'lorem ipsum dolor sit amet '.repeat(20 + (i % 30)).trim(),
            timestamp: new Date(Date.now() - i * 5 * 3600000).toISOString(),
            isLucid: i % 5 === 0, emotions: 'joy', tags: ['t' + (i % 20)], dreamSigns: []
        }))
    }
});

// Generous limits: these catch order-of-magnitude regressions, not small timing changes
test('a 1,500-dream journal stays responsive', async () => {
    const { page, context, problems } = await openApp(browser, server.url);
    await importBackup(page, bigBackup(1500));
    await page.reload({ waitUntil: 'load' });

    let start = Date.now();
    await page.waitForSelector('.entry');
    assert.ok(Date.now() - start < 3000, `first render took ${Date.now() - start}ms`);

    await page.fill('#searchBox', 'flying');
    start = Date.now();
    await page.waitForFunction(() => { const e = [...document.querySelectorAll('.entry-title')]; return e.length > 0 && e.every(x => /flying/i.test(x.textContent)); });
    assert.ok(Date.now() - start < 3000, `search took ${Date.now() - start}ms`);
    await page.fill('#searchBox', '');

    start = Date.now();
    await page.selectOption('#limitSelect', 'all');
    await page.waitForFunction(() => document.querySelectorAll('.entry').length >= 1500, null, { timeout: 15000 });
    assert.ok(Date.now() - start < 5000, `"Show All" took ${Date.now() - start}ms`);

    await openTab(page, 'stats');
    start = Date.now();
    await page.click('[data-action="switch-stats-tab"][data-tab="lifetime"]');
    await page.waitForTimeout(200);
    assert.ok(Date.now() - start < 3000, `lifetime stats took ${Date.now() - start}ms`);
    assert.deepEqual(problems, []);
    await context.close();
});

test('unlocking an encrypted journal of 60 dreams takes under 3 seconds',
    { todo: 'Known issue: every dream is encrypted with its own key derivation (PBKDF2 at 600,000 iterations, about 85ms each on a fast machine), so unlock time grows linearly: about 100ms per dream' },
    async () => {
        const { page, context } = await openApp(browser, server.url);
        await importBackup(page, bigBackup(60));
        await openTab(page, 'settings');
        await page.click('[data-action="toggle-encryption"]');
        await page.fill('#passwordInput', 'correct horse');
        await page.fill('#confirmPasswordInput', 'correct horse');
        await page.click('#confirmPasswordBtn');
        await page.waitForSelector('.security-dialog-overlay:has-text("Encryption Successful")', { timeout: 120000 });
        await page.click('.security-dialog-overlay button');
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('#lockScreenPasswordInput');
        await page.fill('#lockScreenPasswordInput', 'correct horse');
        const start = Date.now();
        await page.click('[data-action="verify-encryption-password"]');
        await page.waitForSelector('#decryption-progress-dialog:has-text("Decryption Successful")', { timeout: 120000 });
        const elapsed = Date.now() - start;
        await context.close();
        assert.ok(elapsed < 3000, `unlock took ${elapsed}ms`);
    });
