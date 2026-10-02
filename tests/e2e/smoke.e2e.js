import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openApp } from './helpers.js';

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

const addDream = async (page, title, content) => {
    await page.fill('#dreamTitle', title);
    await page.fill('#dreamContent', content);
    await page.click('[data-action="save-dream"]');
};

test('app loads without errors or CSP violations and every tab opens', async () => {
    const { page, context, problems } = await openApp(browser, server.url);
    for (const tab of ['stats', 'goals', 'advice', 'settings', 'journal']) {
        await page.click(`[data-action="switch-app-tab"][data-tab="${tab}"]`);
        await page.waitForTimeout(250);
    }
    assert.deepEqual(problems, []);
    await context.close();
});

test('a saved dream is listed, survives a reload, and can be deleted', async () => {
    const { page, context, problems } = await openApp(browser, server.url);
    await addDream(page, 'Flying over a lake', 'I was gliding above calm water.');
    await page.waitForSelector('.entry-title:has-text("Flying over a lake")');

    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.entry-title:has-text("Flying over a lake")');

    const entry = page.locator('.entry', { hasText: 'Flying over a lake' });
    await entry.locator('[data-action="delete-dream"]').click();
    await entry.locator('[data-action="confirm-delete"]').click();
    await page.waitForSelector('.entry-title:has-text("Flying over a lake")', { state: 'detached' });
    assert.deepEqual(problems, []);
    await context.close();
});

test('importing a dream with a hostile ID neither runs script nor keeps the ID', async () => {
    const { page, context, problems } = await openApp(browser, server.url);
    const hostileId = '"><img src=x onerror="window.__pwned=1">';
    await page.click('[data-action="switch-app-tab"][data-tab="settings"]');
    await page.setInputFiles('#importAllDataFile', {
        name: 'backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({
            data: { dreams: [{ id: hostileId, title: 'Hostile import', content: 'body', timestamp: new Date().toISOString() }] }
        }))
    });
    await page.click('[data-action="switch-app-tab"][data-tab="journal"]');
    await page.waitForSelector('.entry-title:has-text("Hostile import")');

    const storedIds = await page.evaluate(async () => (await (await import('/storage.js')).loadDreams()).map(d => d.id));
    assert.ok(storedIds.length > 0 && storedIds.every(id => /^[A-Za-z0-9_-]+$/.test(id)), `unsafe stored ID: ${storedIds}`);

    const entry = page.locator('.entry', { hasText: 'Hostile import' });
    await entry.locator('[data-action="delete-dream"]').click(); // exercises the rebuilt-button path
    await entry.locator('[data-action="confirm-delete"]').click();
    await page.waitForTimeout(300);

    assert.equal(await page.evaluate(() => window.__pwned), undefined, 'injected handler ran');
    assert.deepEqual(problems, []);
    await context.close();
});

test('wrong PINs trigger a lockout on the lock screen', async () => {
    const { page, context, problems } = await openApp(browser, server.url);
    await page.evaluate(async () => {
        const security = await import('/security.js');
        const state = await import('/state.js');
        localStorage.setItem('dreamJournalPinHash', JSON.stringify(await security.hashPinSecure('4321')));
        state.setAppLocked(true);
        state.setUnlocked(false);
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#lockScreenPinInput');
    for (let i = 0; i < 3; i++) {
        await page.fill('#lockScreenPinInput', '1111');
        await page.click('[data-action="verify-lock-screen-pin"]');
        await page.waitForTimeout(1200);
    }
    await page.fill('#lockScreenPinInput', '4321'); // correct PIN is refused while locked out
    await page.click('[data-action="verify-lock-screen-pin"]');
    await page.waitForSelector('text=Too many incorrect attempts');

    await page.reload({ waitUntil: 'load' }); // lockout survives a reload
    await page.waitForSelector('#lockScreenPinInput');
    await page.fill('#lockScreenPinInput', '4321');
    await page.click('[data-action="verify-lock-screen-pin"]');
    await page.waitForSelector('text=Too many incorrect attempts');
    assert.deepEqual(problems, []);
    await context.close();
});
