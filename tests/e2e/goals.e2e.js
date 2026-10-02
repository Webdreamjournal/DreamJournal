import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openApp, openTab } from './helpers.js';

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

test('goal lifecycle', async (t) => {
    const { page, context, problems } = await openApp(browser, server.url);
    await openTab(page, 'goals');
    const goal = () => page.locator('[id^="goal-"]', { hasText: 'Meditate nightly' }).first();

    await t.test('a custom goal can be created and appears under Active Goals', async () => {
        await page.click('[data-action="create-goal"]');
        await page.fill('#goalTitle', 'Meditate nightly');
        await page.selectOption('#goalType', 'custom');
        await page.fill('#goalTarget', '3');
        await page.click('[data-action="save-goal"]');
        await goal().waitFor();
        assert.match(await goal().innerText(), /0 \/ 3/);
    });

    await t.test('progress can be increased and is disabled below zero', async () => {
        await goal().locator('[data-action="increase-goal-progress"]').click();
        await page.waitForTimeout(400);
        assert.match(await goal().innerText(), /1 \/ 3/);
        await goal().locator('[data-action="decrease-goal-progress"]').click();
        await page.waitForTimeout(400);
        assert.ok(await goal().locator('[data-action="decrease-goal-progress"]').isDisabled());
    });

    await t.test('completing moves the goal to Completed and reactivating brings it back', async () => {
        await goal().locator('[data-action="complete-goal"]').click();
        await page.locator('[data-action="reactivate-goal"]').first().waitFor();
        await page.locator('[data-action="reactivate-goal"]').first().click();
        await goal().locator('[data-action="complete-goal"]').waitFor();
    });

    await t.test('a template opens a pre-filled form that can be cancelled', async () => {
        await page.click('[data-action="create-template-goal"] >> nth=0');
        await page.waitForSelector('#goalType');
        assert.ok((await page.inputValue('#goalTitle')).length > 0, 'title not pre-filled');
        await page.click('[data-action="cancel-goal-dialog"]');
        await page.waitForTimeout(300);
    });

    await t.test('goals persist across a reload and a confirmed delete removes them', async () => {
        await page.reload({ waitUntil: 'load' });
        await openTab(page, 'goals');
        await goal().waitFor();
        await goal().locator('[data-action="delete-goal"]').click();
        await goal().locator('[data-action="confirm-delete-goal"]').click();
        await page.waitForTimeout(600);
        assert.equal(await page.locator('[id^="goal-"]', { hasText: 'Meditate nightly' }).count(), 0);
    });

    assert.deepEqual(problems, []);
    await context.close();
});
