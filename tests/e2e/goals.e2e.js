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

test('lucid dream count goals', async (t) => {
    const { page, context, problems } = await openApp(browser, server.url);
    const logDream = async (content, { lucid = false, date } = {}) => {
        await page.fill('#dreamContent', content);
        if (date) await page.fill('#dreamDate', date);
        await page.setChecked('#isLucid', lucid);
        await page.click('[data-action="save-dream"]');
        await page.locator('.entry', { hasText: content }).waitFor();
    };
    await logDream('A lucid dream from today', { lucid: true });
    await logDream('A lucid dream from years ago', { lucid: true, date: '2020-01-15T08:00' });
    await logDream('A dream that was not lucid');
    await openTab(page, 'goals');

    const periodOptions = () => page.$$eval('#goalPeriod option', options => options.map(o => o.value));
    const card = (title) => page.locator('[id^="goal-"]', { hasText: title }).first();
    const createLucidGoal = async (title, period) => {
        await page.click('[data-action="create-goal"]');
        await page.fill('#goalTitle', title);
        await page.selectOption('#goalType', 'lucid_count');
        await page.selectOption('#goalPeriod', period);
        await page.fill('#goalTarget', '5');
        await page.click('[data-action="save-goal"]');
        await card(title).waitFor();
    };

    await t.test('the Time Period field offers only the periods the Goal Type counts by', async () => {
        await page.click('[data-action="create-goal"]');
        await page.waitForSelector('#goalType');
        assert.deepEqual(await periodOptions(), ['monthly', 'total']);
        assert.ok(await page.isVisible('#goalPeriod'));
        for (const [type, period] of [['recall_streak', 'streak'], ['journal_streak', 'streak'], ['dream_signs_count', 'total'], ['custom', 'total']]) {
            await page.selectOption('#goalType', type);
            assert.deepEqual(await periodOptions(), [period], type);
            assert.ok(await page.isHidden('#goalPeriod'), `${type} offers a period choice`);
            assert.notEqual((await page.innerText('#goalProgressHelp')).trim(), '', `${type} has no help text`);
        }
        await page.selectOption('#goalType', 'lucid_count');
        assert.ok(await page.isVisible('#goalPeriod'));
        await page.selectOption('#goalPeriod', 'total');
        assert.match(await page.innerText('#goalProgressHelp'), /every lucid dream/);
        await page.click('[data-action="cancel-goal-dialog"]');
    });

    await t.test('an All Time Total goal counts every lucid dream', async () => {
        await createLucidGoal('Lucid dreams overall', 'total');
        const text = await card('Lucid dreams overall').innerText();
        assert.match(text, /2 \/ 5/);
        assert.match(text, /2 lucid dreams in total/);
    });

    await t.test('a Monthly goal counts only the month it was created in', async () => {
        await createLucidGoal('Lucid dreams this month', 'monthly');
        const text = await card('Lucid dreams this month').innerText();
        assert.match(text, /1 \/ 5/);
        assert.match(text, /1 lucid dream in /);
    });

    await t.test('editing a goal shows its stored period', async () => {
        await card('Lucid dreams overall').locator('[data-action="edit-goal"]').click();
        await page.waitForFunction(() => document.getElementById('goalTitle')?.value === 'Lucid dreams overall');
        assert.equal(await page.inputValue('#goalPeriod'), 'total');
        await page.click('[data-action="cancel-goal-dialog"]');
    });

    assert.deepEqual(problems, []);
    await context.close();
});
