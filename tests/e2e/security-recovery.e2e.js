import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openApp, openTab, importBackup, storedDreams } from './helpers.js';
import { sampleBackup } from './sample-data.js';

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

const PIN = '2468';
const pinHash = (page) => page.evaluate(() => localStorage.getItem('dreamJournalPinHash'));
const resetTime = (page) => page.evaluate(() => localStorage.getItem('dreamJournalPinResetTime'));

/** Opens the app with a few dreams and a PIN, then reloads so it starts on the lock screen. */
async function openLocked() {
    const app = await openApp(browser, server.url);
    await importBackup(app.page, sampleBackup(5));
    await app.page.evaluate(async (pin) => (await import('/security.js')).storePinHash(pin), PIN);
    await app.page.reload({ waitUntil: 'load' });
    await app.page.waitForSelector('#lockScreenPinInput');
    return app;
}
/** Unlocks, locks again from Settings (as a user would) and opens the PIN overlay on top of the lock screen. */
async function openAtOverlay() {
    const app = await openLocked();
    await app.page.fill('#lockScreenPinInput', PIN);
    await app.page.click('[data-action="verify-lock-screen-pin"]');
    await app.page.waitForSelector('.entry');
    await openTab(app.page, 'settings');
    await app.page.click('#lockBtnSettings');
    await app.page.waitForSelector('#lockScreenPinInput');
    await app.page.evaluate(async () => (await import('/security.js')).showPinOverlay());
    await app.page.waitForSelector('#pinOverlay #pinInput');
    return app;
}
/** The overlay's Forgot PIN link is hidden; the recovery screen opens after three wrong PINs. */
async function failPinThreeTimes(page) {
    for (let i = 0; i < 3; i++) {
        // Clear the previous message so the wait below sees this attempt's answer, not the last one's
        await page.evaluate(() => { const f = document.querySelector('#pinFeedback'); if (f) f.textContent = ''; });
        await page.fill('#pinInput', '0000');
        await page.click('[data-action="verify-pin"]');
        await page.waitForFunction(() => /Incorrect PIN/.test(document.querySelector('#pinFeedback')?.innerText ?? '') || /PIN Recovery/.test(document.querySelector('#pinOverlay')?.innerText ?? ''), null, { timeout: 10000 });
    }
    await page.waitForFunction(() => /PIN Recovery/.test(document.querySelector('#pinOverlay')?.innerText ?? ''), null, { timeout: 10000 });
}
const titles = async (page) => (await storedDreams(page)).map(d => d.title).filter(t => t !== 'Untitled Dream');
const visibleText = (page) => page.innerText('body');
/** Waits until an element's text matches (handlers answer asynchronously); a timeout reports what the page showed. */
const waitForText = async (page, selector, pattern) => {
    try {
        await page.waitForFunction(
            ([sel, source]) => new RegExp(source).test(document.querySelector(sel)?.innerText ?? ''),
            [selector, pattern.source], { timeout: 10000 }
        );
    } catch (error) {
        const shown = await page.evaluate((sel) => ({
            text: document.querySelector(sel)?.innerText ?? null,
            overlay: document.querySelector('#pinOverlay')?.innerText ?? null,
            inputs: ['recovery1', 'recovery2', 'recovery3'].map(id => document.getElementById(id)?.value ?? null)
        }), selector);
        throw new Error(`${selector} never matched ${pattern}: ${JSON.stringify(shown)}`, { cause: error });
    }
};
const waitForPinRemoved = (page) => page.waitForFunction(() => localStorage.getItem('dreamJournalPinHash') === null, null, { timeout: 10000 });
const visibleTabCount = (page) => page.$$eval('.app-tab', all => all.filter(x => getComputedStyle(x).display !== 'none').length);
const reloadAndSeeDreams = async (page) => {
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.entry');
};
/** Opens the three-title recovery screen and waits for its first field to take the focus the app gives it after 100 ms. */
const openTitleRecovery = async (page, action) => {
    await page.click(`[data-action="${action}"]`);
    await page.waitForSelector('#recovery1');
    await page.waitForFunction(() => document.activeElement?.id === 'recovery1', null, { timeout: 5000 });
};
const fillTitles = async (page, [a, b, c]) => {
    await page.fill('#recovery1', a);
    await page.fill('#recovery2', b);
    await page.fill('#recovery3', c);
};

test('lock screen: PIN recovery with dream titles', async (t) => {
    const { page, context, problems } = await openLocked();
    const names = await titles(page);
    assert.ok(names.length >= 3);

    await t.test('the recovery screen offers both methods', async () => {
        await page.click('[data-action="show-lock-screen-forgot-pin"]');
        await page.waitForSelector('[data-action="start-lock-screen-title-recovery"]');
        assert.match(await visibleText(page), /Dream Title Verification/);
        assert.match(await visibleText(page), /72-Hour Timer Reset/);
    });

    await t.test('empty, repeated and wrong titles are refused and the PIN stays', async () => {
        await openTitleRecovery(page, 'start-lock-screen-title-recovery');
        await page.click('[data-action="verify-lock-screen-dream-titles"]');
        await waitForText(page, 'body', /enter all 3/i);
        await fillTitles(page, [names[0], names[0], names[1]]);
        await page.click('[data-action="verify-lock-screen-dream-titles"]');
        await waitForText(page, 'body', /3 DIFFERENT/);
        await fillTitles(page, [names[0], names[1], 'not a real title']);
        await page.click('[data-action="verify-lock-screen-dream-titles"]');
        await waitForText(page, 'body', /did not match/);
        assert.ok(await pinHash(page));
    });

    await t.test('three real titles remove the PIN and open the journal', async () => {
        await fillTitles(page, names.slice(0, 3));
        await page.click('[data-action="verify-lock-screen-dream-titles"]');
        await waitForPinRemoved(page);
        assert.equal(await pinHash(page), null);
        await reloadAndSeeDreams(page);
        assert.ok(!(await page.locator('#lockScreenPinInput').isVisible()), 'the reloaded journal opens without a lock screen');
    });

    assert.deepEqual(problems, []);
    await context.close();
});

test('lock screen: dreams are listed straight after PIN recovery by titles', async () => {
    const { page, context, problems } = await openLocked();
    const names = await titles(page);
    await page.click('[data-action="show-lock-screen-forgot-pin"]');
    await openTitleRecovery(page, 'start-lock-screen-title-recovery');
    await fillTitles(page, names.slice(0, 3));
    await page.click('[data-action="verify-lock-screen-dream-titles"]');
    await waitForPinRemoved(page);
    await page.waitForSelector('.entry', { state: 'visible', timeout: 10000 });
    assert.equal(await visibleTabCount(page), 5);
    assert.deepEqual(problems, []);
    await context.close();
});

test('lock screen: the 72-hour timer', async (t) => {
    const { page, context, problems } = await openLocked();

    await t.test('starting the timer stores a reset time about 72 hours away and returns to the lock screen', async () => {
        await page.click('[data-action="show-lock-screen-forgot-pin"]');
        await page.click('[data-action="start-lock-screen-timer-recovery"]');
        await page.click('[data-action="confirm-lock-screen-timer"]');
        const hours = ((await resetTime(page)) - Date.now()) / 3600000;
        assert.ok(hours > 71.9 && hours < 72.1, `reset time is ${hours} hours away`);
        await page.waitForSelector('#lockScreenPinInput', { timeout: 10000 });
        assert.match(await visibleText(page), /Recovery timer active/);
    });

    await t.test('pressing Forgot PIN while the timer runs reports the time left and keeps the PIN', async () => {
        await page.click('[data-action="show-lock-screen-forgot-pin"]');
        assert.match(await page.innerText('#lockScreenFeedback'), /Recovery timer active/);
        assert.ok(await pinHash(page));
    });

    await t.test('once the timer has passed, Forgot PIN removes the PIN and unlocks', async () => {
        await page.evaluate(() => localStorage.setItem('dreamJournalPinResetTime', String(Date.now() - 1000)));
        await page.click('[data-action="show-lock-screen-forgot-pin"]');
        await waitForPinRemoved(page);
        assert.equal(await resetTime(page), null);
        await page.waitForSelector('.entry', { state: 'visible', timeout: 10000 });
        assert.equal(await visibleTabCount(page), 5);
    });

    assert.deepEqual(problems, []);
    await context.close();
});

test('locking from Settings and the PIN overlay', async (t) => {
    const { page, context, problems } = await openLocked();
    await page.fill('#lockScreenPinInput', PIN);
    await page.click('[data-action="verify-lock-screen-pin"]');
    await page.waitForSelector('.entry');
    await openTab(page, 'settings');

    await t.test('Lock Journal in Settings shows the lock screen and hides the other tabs', async () => {
        await page.click('#lockBtnSettings');
        await page.waitForSelector('#lockScreenPinInput');
        const tabs = await page.$$eval('.app-tab', all => all.filter(x => getComputedStyle(x).display !== 'none').map(x => x.dataset.tab));
        assert.deepEqual(tabs, ['lock']);
    });

    await t.test('the PIN overlay refuses a wrong PIN and accepts the right one', async () => {
        await page.evaluate(async () => (await import('/security.js')).showPinOverlay());
        await page.waitForSelector('#pinOverlay #pinInput');
        await page.fill('#pinInput', '0000');
        await page.click('[data-action="verify-pin"]');
        await page.waitForFunction(() => /Incorrect PIN/.test(document.querySelector('#pinFeedback')?.innerText ?? ''), null, { timeout: 10000 });
        await page.fill('#pinInput', PIN);
        await page.click('[data-action="verify-pin"]');
        await page.waitForFunction(() => [...document.querySelectorAll('.app-tab')].filter(x => getComputedStyle(x).display !== 'none').length === 5, null, { timeout: 10000 });
        assert.ok(!(await page.locator('#pinOverlay').isVisible()));
        assert.equal(await visibleTabCount(page), 5);
        assert.ok(await page.locator('#lockBtnSettings').isVisible(), 'the journal returns to the tab that was open when it was locked');
    });

    assert.deepEqual(problems, []);
    await context.close();
});

test('PIN overlay: recovery by dream titles', async (t) => {
    const { page, context, problems } = await openAtOverlay();
    const names = await titles(page);
    await failPinThreeTimes(page);

    await t.test('wrong titles are refused', async () => {
        await openTitleRecovery(page, 'start-title-recovery');
        await page.click('[data-action="verify-dream-titles"]');
        await waitForText(page, '#pinFeedback', /enter all 3/i);
        await fillTitles(page, [names[0], names[1], 'nope']);
        await page.click('[data-action="verify-dream-titles"]');
        await waitForText(page, '#pinFeedback', /did not match/);
        assert.ok(await pinHash(page));
    });

    await t.test('right titles remove the PIN, and Continue returns to the journal', async () => {
        await fillTitles(page, names.slice(0, 3));
        await page.click('[data-action="verify-dream-titles"]');
        await page.click('[data-action="complete-recovery"]');
        await page.waitForFunction(() => /Recovery complete/.test(document.body.innerText), null, { timeout: 10000 });
        assert.equal(await pinHash(page), null);
        assert.ok(!(await page.locator('#pinOverlay').isVisible()));
        assert.ok(await page.locator('[data-action="switch-app-tab"][data-tab="journal"]').isVisible(), 'tab buttons are back');
    });

    assert.deepEqual(problems, []);
    await context.close();
});

test('PIN overlay: the 72-hour timer can be started and cancelled with the PIN', async (t) => {
    const { page, context, problems } = await openAtOverlay();
    await failPinThreeTimes(page);

    await t.test('starting the timer shows the countdown screen and the warning banner', async () => {
        await page.click('[data-action="start-timer-recovery"]');
        await page.click('[data-action="confirm-start-timer"]');
        assert.match(await page.innerText('#pinOverlay'), /PIN Reset Timer Active/);
        assert.ok(await resetTime(page));
        assert.ok(await page.evaluate(() => document.getElementById('timerWarning').classList.contains('active')));
    });

    await t.test('Forgot PIN while the timer runs shows the countdown again', async () => {
        await page.click('[data-action="hide-pin-overlay"]');
        await page.evaluate(async () => { const s = await import('/security.js'); s.showPinOverlay(); await s.showForgotPin(); });
        assert.match(await page.innerText('#pinOverlay'), /PIN Reset Timer Active/);
    });

    await t.test('cancelling needs the right PIN', async () => {
        await page.click('#pinOverlay [data-action="cancel-timer"]');
        await page.fill('#pinInput', '0000');
        await page.click('[data-action="confirm-cancel-timer"]');
        await page.waitForFunction(() => /Incorrect PIN/.test(document.querySelector('#pinOverlay')?.innerText ?? ''), null, { timeout: 10000 });
        assert.ok(await resetTime(page));
        await page.fill('#pinInput', PIN);
        await page.click('[data-action="confirm-cancel-timer"]');
        await page.waitForFunction(() => localStorage.getItem('dreamJournalPinResetTime') === null, null, { timeout: 10000 });
        assert.ok(!(await page.evaluate(() => document.getElementById('timerWarning').classList.contains('active'))));
        assert.ok(await pinHash(page), 'cancelling the timer must keep the PIN');
    });

    assert.deepEqual(problems, []);
    await context.close();
});

test('forgotten encryption password: wiping all data', async (t) => {
    const { page, context, problems } = await openApp(browser, server.url);
    await importBackup(page, sampleBackup(3));
    await openTab(page, 'settings');
    await page.click('[data-action="toggle-encryption"]');
    await page.fill('#passwordInput', 'correct horse');
    await page.fill('#confirmPasswordInput', 'correct horse');
    await page.click('#confirmPasswordBtn');
    await page.waitForSelector('.security-dialog-overlay:has-text("Encryption Successful")', { timeout: 60000 });
    await page.click('.security-dialog-overlay button');
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#lockScreenPasswordInput');

    await t.test('the warning screen explains that nothing can be recovered', async () => {
        await page.click('[data-action="show-forgot-encryption-password"]');
        assert.match(await visibleText(page), /cannot be recovered without your password/);
        await page.click('[data-action="return-to-lock-screen"]');
        await page.waitForSelector('#lockScreenPasswordInput');
        await page.click('[data-action="show-forgot-encryption-password"]');
    });

    await t.test('the wipe needs the exact confirmation text', async () => {
        await page.click('[data-action="wipe-all-data"]');
        await page.waitForSelector('#wipeConfirmationInput');
        await page.fill('#wipeConfirmationInput', 'delete everything');
        await page.click('[data-action="confirm-data-wipe"]');
        assert.match(await page.innerText('#lockScreenFeedback'), /DELETE EVERYTHING/);
        assert.equal(await page.evaluate(() => localStorage.getItem('dreamJournalEncryptionEnabled')), 'true');
    });

    await t.test('with the exact text the databases and settings are deleted', async () => {
        await page.fill('#wipeConfirmationInput', 'DELETE EVERYTHING');
        await page.click('[data-action="confirm-data-wipe"]');
        await page.waitForSelector('[data-action="reload-app"]', { timeout: 30000 });
        assert.equal(await page.evaluate(() => localStorage.getItem('dreamJournalEncryptionEnabled')), null);
        await page.click('[data-action="reload-app"]');
        await page.waitForFunction(() => { const c = document.querySelector('.container'); return c && getComputedStyle(c).visibility === 'visible'; });
        assert.equal(await page.locator('.entry').count(), 0);
        assert.equal((await storedDreams(page)).length, 0);
    });

    assert.deepEqual(problems, []);
    await context.close();
});
