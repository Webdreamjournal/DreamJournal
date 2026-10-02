import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, launchBrowser, openApp } from './helpers.js';

let server, browser;
before(async () => { server = await startServer(); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

test('voice notes (fake microphone)', async (t) => {
    const { page, context, problems } = await openApp(browser, server.url, { permissions: ['microphone'] });
    // Blobs cannot be returned from page.evaluate, so read their size and type inside the page
    const notes = () => page.evaluate(async () => (await (await import('/storage.js')).loadVoiceNotes())
        .map(n => ({ id: n.id, size: n.audioBlob.size, type: n.audioBlob.type, duration: n.duration })));
    // The Stop button pulses while recording, so Playwright never sees it as "stable": force the click.
    const record = async (ms) => {
        if (!(await page.isVisible('[data-action="toggle-recording"]'))) await page.locator('[data-action="switch-voice-tab"]').first().click();
        await page.click('[data-action="toggle-recording"]', { force: true });
        await page.waitForTimeout(ms);
        await page.click('[data-action="toggle-recording"]', { force: true });
        await page.waitForTimeout(1200);
    };

    await t.test('recording stores a note with real audio data', async () => {
        await record(2500);
        const [note] = await notes();
        assert.ok(note.size > 1000, `blob size ${note.size}`);
        assert.match(note.type, /^audio\//);
    });

    await t.test('play switches the control to pause', async () => {
        await page.click('[data-action="play-voice"]');
        await page.locator('[data-action="pause-voice"]').waitFor();
    });

    await t.test('download returns an audio file', async () => {
        const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="download-voice"]')]);
        assert.ok(fs.statSync(await download.path()).size > 1000);
    });

    await t.test('the note survives a reload', async () => {
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(800);
        assert.equal((await notes()).length, 1);
    });

    await t.test('the five-note limit disables recording', async () => {
        for (let i = 0; i < 4; i++) await record(1200);
        assert.equal((await notes()).length, 5);
        assert.ok(await page.$eval('[data-action="toggle-recording"]', e => e.disabled && /storage full/i.test(e.innerText)));
    });

    await t.test('delete needs confirmation, then removes the note', async () => {
        await page.locator('[data-action="switch-voice-tab"]').nth(1).click();
        await page.locator('[data-action="delete-voice"]').first().click();
        await page.locator('[data-action="confirm-delete-voice"]').first().click();
        await page.waitForTimeout(800);
        assert.equal((await notes()).length, 4);
    });

    assert.deepEqual(problems, []);
    await context.close();
});
