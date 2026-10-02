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
    test(`${theme} theme: no axe violations on any tab`, async () => {
        assert.deepEqual(await scanAll(theme), {});
    });
}

test('no axe violations with an autocomplete list open', async () => {
    const { page, context } = await openApp(browser, server.url);
    await importBackup(page, sampleBackup(12));
    await page.click('#dreamTags');
    await page.keyboard.type('fl');
    await page.waitForSelector('.tag-autocomplete-dropdown .autocomplete-item', { state: 'visible' });
    assert.deepEqual(await scan(page), []);
    await context.close();
});

const insideDialog = (page) => page.evaluate(() => !!document.activeElement.closest('.pin-overlay, .security-dialog-overlay'));
const backgroundInert = (page) => page.evaluate(() => document.querySelector('.container').inert);
const activeAction = (page) => page.evaluate(() => document.activeElement.dataset.action || document.activeElement.id || document.activeElement.tagName);

test('dialogs take focus, keep Tab inside, close with Escape and return focus', async (t) => {
    const { page, context } = await openApp(browser, server.url);
    await importBackup(page, sampleBackup(3));
    await openTab(page, 'settings');

    await t.test('the PIN dialog', async () => {
        await page.focus('[data-action="setup-pin"]');
        await page.keyboard.press('Enter');
        await page.waitForSelector('#pinInput');
        assert.ok(await insideDialog(page), 'focus did not move into the dialog');
        assert.equal(await page.getAttribute('#pinOverlay', 'aria-modal'), 'true');
        assert.equal(await backgroundInert(page), true, 'the page behind the dialog is still reachable');
        for (let i = 0; i < 8; i++) {
            await page.keyboard.press('Tab');
            assert.ok(await insideDialog(page), `focus left the dialog after ${i + 1} Tab presses`);
        }
        for (let i = 0; i < 8; i++) {
            await page.keyboard.press('Shift+Tab');
            assert.ok(await insideDialog(page), `focus left the dialog after ${i + 1} Shift+Tab presses`);
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        assert.ok(!(await page.locator('#pinOverlay').isVisible()), 'Escape did not close the dialog');
        assert.equal(await backgroundInert(page), false, 'the page is still inert after the dialog closed');
        assert.equal(await activeAction(page), 'setup-pin', 'focus did not return to the button that opened the dialog');
    });

    await t.test('a script-created password dialog is labelled, focused and closes with Escape', async () => {
        await page.focus('[data-action="toggle-encryption"]');
        await page.keyboard.press('Enter');
        await page.waitForSelector('#passwordInput');
        assert.equal(await activeAction(page), 'passwordInput');
        const dialog = await page.evaluate(() => {
            const overlay = document.querySelector('.pin-overlay[data-dialog="password"]');
            const labelId = overlay.getAttribute('aria-labelledby');
            return { role: overlay.getAttribute('role'), modal: overlay.getAttribute('aria-modal'), label: document.getElementById(labelId)?.textContent ?? '', title: overlay.querySelector('h2').textContent };
        });
        assert.equal(dialog.role, 'dialog');
        assert.equal(dialog.modal, 'true');
        assert.ok(dialog.label.trim().length > 0, 'the dialog has no accessible name');
        assert.equal(dialog.label, dialog.title);
        await page.keyboard.press('Shift+Tab');
        assert.ok(await insideDialog(page), 'Shift+Tab left the dialog');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        assert.equal(await page.locator('.pin-overlay[data-dialog="password"]').count(), 0, 'Escape did not close the password dialog');
        assert.equal(await backgroundInert(page), false);
        assert.equal(await page.evaluate(() => localStorage.getItem('dreamJournalEncryptionEnabled')), null, 'Escape must not enable encryption');
        assert.equal(await activeAction(page), 'toggle-encryption');
    });

    await t.test('a dialog with only an OK button takes focus and Escape presses OK', async () => {
        await page.click('[data-action="toggle-encryption"]');
        await page.fill('#passwordInput', 'correct horse');
        await page.fill('#confirmPasswordInput', 'correct horse');
        await page.click('#confirmPasswordBtn');
        await page.waitForSelector('.security-dialog-overlay:has-text("Encryption Successful")', { timeout: 60000 });
        assert.ok(await insideDialog(page), 'focus is not inside the result dialog');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        assert.equal(await page.locator('.security-dialog-overlay').count(), 0, 'Escape did not close the result dialog');
        assert.equal(await backgroundInert(page), false);
    });

    await context.close();
});

test('arrow keys move between tabs while focus stays on the tab bar', async () => {
    const { page, context } = await openApp(browser, server.url);
    await page.focus('#tab-journal');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-goals');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-stats');
    assert.equal(await page.getAttribute('#tab-stats', 'aria-selected'), 'true');
    await page.keyboard.press('Home');
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-journal');
    await context.close();
});

test('collapsible section headers are buttons inside headings and toggle once per Enter or Space', async () => {
    const { page, context } = await openApp(browser, server.url);
    await openTab(page, 'settings');
    const toggle = page.locator('[data-action="toggle-settings-appearance"]');
    assert.equal(await toggle.evaluate(el => el.tagName), 'BUTTON');
    assert.equal(await toggle.evaluate(el => el.parentElement.tagName), 'H3');
    await toggle.focus();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await context.close();
});
