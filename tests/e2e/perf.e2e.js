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

test('enabling encryption and unlocking a journal of 200 dreams stays under 5 seconds each', async () => {
    const { page, context } = await openApp(browser, server.url);
    await importBackup(page, bigBackup(200));
    await openTab(page, 'settings');
    await page.click('[data-action="toggle-encryption"]');
    await page.fill('#passwordInput', 'correct horse');
    await page.fill('#confirmPasswordInput', 'correct horse');
    let start = Date.now();
    await page.click('#confirmPasswordBtn');
    await page.waitForSelector('.security-dialog-overlay:has-text("Encryption Successful")', { timeout: 120000 });
    const enableMs = Date.now() - start;
    await page.click('.security-dialog-overlay button');
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#lockScreenPasswordInput');
    await page.fill('#lockScreenPasswordInput', 'correct horse');
    start = Date.now();
    await page.click('[data-action="verify-encryption-password"]');
    await page.waitForSelector('#decryption-progress-dialog:has-text("Decryption Successful")', { timeout: 120000 });
    const unlockMs = Date.now() - start;
    await context.close();
    // One key derivation (about 100ms) serves the whole journal; before, each dream cost about 100ms
    assert.ok(enableMs < 5000, `enabling encryption took ${enableMs}ms`);
    assert.ok(unlockMs < 5000, `unlock took ${unlockMs}ms`);
});
