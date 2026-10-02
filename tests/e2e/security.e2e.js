import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openApp, openTab, importBackup, storedDreams } from './helpers.js';
import { sampleBackup } from './sample-data.js';

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

const pinHash = (page) => page.evaluate(() => localStorage.getItem('dreamJournalPinHash'));
const feedback = (page) => page.evaluate(() => document.querySelector('#pinFeedback')?.innerText.trim() ?? '');
const unlockWithPin = async (page, pin) => {
    await page.fill('#lockScreenPinInput', pin);
    await page.click('[data-action="verify-lock-screen-pin"]');
    await page.waitForTimeout(1500);
};

test('PIN protection', async (t) => {
    const { page, context, problems } = await openApp(browser, server.url);
    await importBackup(page, sampleBackup(5));
    await openTab(page, 'settings');

    await t.test('setup rejects short and non-numeric PINs', async () => {
        await page.click('[data-action="setup-pin"]');
        await page.fill('#pinInput', '12');
        await page.click('[data-action="process-pin-setup"]');
        await page.waitForTimeout(400);
        assert.match(await feedback(page), /4-6 digits/);
        await page.fill('#pinInput', 'abcd');
        await page.click('[data-action="process-pin-setup"]');
        await page.waitForTimeout(400);
        assert.match(await feedback(page), /digits/);
        assert.equal(await pinHash(page), null);
    });

    await t.test('a mismatched confirmation restarts setup without storing a PIN', async () => {
        await page.fill('#pinInput', '2468');
        await page.click('[data-action="process-pin-setup"]');
        await page.fill('#pinInput', '1111');
        await page.click('[data-action="confirm-new-pin"]');
        await page.waitForTimeout(500);
        assert.match(await feedback(page), /do not match/);
        assert.equal(await pinHash(page), null);
    });

    await t.test('a matching confirmation stores a salted PBKDF2 hash, never the PIN', async () => {
        await page.fill('#pinInput', '2468');
        await page.click('[data-action="process-pin-setup"]');
        await page.fill('#pinInput', '2468');
        await page.click('[data-action="confirm-new-pin"]');
        await page.waitForTimeout(1000);
        const stored = await pinHash(page);
        assert.ok(!stored.includes('2468'));
        const { hash, salt } = JSON.parse(stored);
        assert.equal(hash.length, 64);
        assert.equal(salt.length, 32);
    });

    await t.test('after a reload only the lock screen is shown and no dreams are in the page', async () => {
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('#lockScreenPinInput');
        assert.equal(await page.locator('.entry').count(), 0);
        const visibleTabs = await page.$$eval('.app-tab', tabs => tabs.filter(x => getComputedStyle(x).display !== 'none').map(x => x.dataset.tab));
        assert.deepEqual(visibleTabs, ['lock']);
    });

    await t.test('a wrong PIN is refused; the right PIN restores every tab and the dreams', async () => {
        await unlockWithPin(page, '9999');
        assert.match(await page.innerText('body'), /incorrect/i);
        assert.equal(await page.locator('.entry').count(), 0);
        await unlockWithPin(page, '2468');
        await page.waitForSelector('.entry');
        const tabs = await page.$$eval('.app-tab', t => t.filter(x => getComputedStyle(x).display !== 'none').map(x => x.dataset.tab));
        assert.equal(tabs.length, 5);
    });

    await t.test('exporting works once unlocked', async () => {
        await openTab(page, 'settings');
        const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-all-data"]')]);
        assert.match(download.suggestedFilename(), /dream-journal-complete/);
    });

    await t.test('changing the PIN needs the current one, then the old PIN stops working', async () => {
        await page.click('[data-action="setup-pin"]');
        await page.fill('#pinInput', '0000');
        await page.click('[data-action="process-pin-setup"]');
        await page.waitForTimeout(1200);
        assert.match(await feedback(page), /incorrect/i);
        await page.fill('#pinInput', '2468');
        await page.click('[data-action="process-pin-setup"]');
        await page.click('[data-action="show-set-new-pin-screen"]');
        await page.fill('#pinInput', '1357');
        await page.click('[data-action="setup-new-pin"]');
        await page.fill('#pinInput', '1357');
        await page.click('[data-action="confirm-new-pin"]');
        await page.waitForSelector('[data-action="complete-pin-setup"]');
        await page.click('[data-action="complete-pin-setup"]');

        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('#lockScreenPinInput');
        await unlockWithPin(page, '2468');
        assert.ok(await page.locator('#lockScreenPinInput').isVisible(), 'old PIN unlocked the journal');
        await unlockWithPin(page, '1357');
        assert.ok(!(await page.locator('#lockScreenPinInput').isVisible()), 'new PIN did not unlock');
    });

    await t.test('removing the PIN deletes the hash and the journal opens without a lock screen', async () => {
        await openTab(page, 'settings');
        await page.click('[data-action="setup-pin"]');
        await page.fill('#pinInput', '1357');
        await page.click('[data-action="process-pin-setup"]');
        await page.click('[data-action="execute-pin-removal"]');
        await page.click('[data-action="complete-pin-removal"]');
        assert.equal(await pinHash(page), null);
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('.entry');
        assert.ok(!(await page.locator('#lockScreenPinInput').isVisible()));
    });

    assert.deepEqual(problems, []);
    await context.close();
});

test('data encryption', async (t) => {
    const { page, context, problems } = await openApp(browser, server.url);
    await importBackup(page, sampleBackup(3));
    await openTab(page, 'settings');
    const dialogText = () => page.evaluate(() => document.querySelector('.security-dialog-overlay')?.innerText ?? '');
    const rawDreams = () => page.evaluate(() => new Promise(resolve => {
        const open = indexedDB.open('DreamJournal');
        open.onsuccess = () => {
            const all = open.result.transaction('dreams').objectStore('dreams').getAll();
            all.onsuccess = () => { open.result.close(); resolve(JSON.stringify(all.result)); };
        };
    }));

    await t.test('mismatched passwords are rejected and nothing is encrypted', async () => {
        await page.click('[data-action="toggle-encryption"]');
        await page.fill('#passwordInput', 'correct horse');
        await page.fill('#confirmPasswordInput', 'different');
        await page.click('#confirmPasswordBtn');
        await page.waitForTimeout(500);
        assert.ok(await page.locator('#passwordInput').isVisible(), 'dialog closed');
        assert.equal(await page.evaluate(() => localStorage.getItem('dreamJournalEncryptionEnabled')), null);
    });

    await t.test('enabling encryption leaves only ciphertext in IndexedDB', async () => {
        await page.fill('#passwordInput', 'correct horse');
        await page.fill('#confirmPasswordInput', 'correct horse');
        await page.click('#confirmPasswordBtn');
        await page.waitForSelector('.security-dialog-overlay:has-text("Encryption Successful")', { timeout: 60000 });
        await page.click('.security-dialog-overlay button');
        const raw = await rawDreams();
        assert.match(raw, /"encrypted":true/);
        assert.ok(!/Flying over a lake|Back at school|corridor/.test(raw), 'plaintext found in IndexedDB');
    });

    await t.test('after a reload the journal stays locked until the right password is given', async () => {
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('#lockScreenPasswordInput');
        assert.equal(await page.locator('.entry').count(), 0);

        await page.fill('#lockScreenPasswordInput', 'wrong password');
        await page.click('[data-action="verify-encryption-password"]');
        await page.waitForSelector('.security-dialog-overlay:has-text("Incorrect password")', { timeout: 30000 });
        await page.click('.security-dialog-overlay button'); // the error is a dialog that must be dismissed
        assert.equal(await page.locator('.entry').count(), 0);

        await page.fill('#lockScreenPasswordInput', 'correct horse');
        await page.click('[data-action="verify-encryption-password"]');
        await page.waitForSelector('#decryption-progress-dialog:has-text("Decryption Successful")', { timeout: 30000 });
        await page.click('#decryption-progress-dialog button'); // success is a dialog that must be dismissed
        await page.waitForSelector('.entry');
        assert.equal((await storedDreams(page)).length, 3);
    });

    await t.test('dreams saved while encrypted are also stored as ciphertext', async () => {
        await page.fill('#dreamTitle', 'Encrypted era dream');
        await page.fill('#dreamContent', 'saved under encryption');
        await page.click('[data-action="save-dream"]');
        await page.waitForSelector('.entry-title:has-text("Encrypted era dream")');
        await page.waitForTimeout(1500);
        assert.ok(!(await rawDreams()).includes('Encrypted era dream'));
    });

    // The app logs a console error for the deliberate wrong-password attempt above
    assert.deepEqual(problems.filter(p => !/Decryption error: OperationError/.test(p)), []);
    await context.close();
});
