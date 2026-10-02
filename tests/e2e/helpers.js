import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };

/** Serves the repo root on a random local port. */
export function startServer() {
    const server = http.createServer((req, res) => {
        const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
        if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.writeHead(404); res.end('not found'); return;
        }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
        url: `http://127.0.0.1:${server.address().port}/`,
        close: () => new Promise(r => server.close(r))
    })));
}

/**
 * Launches Chromium (set CHROMIUM_PATH to use a preinstalled browser).
 * The fake-media flags let voice-note tests record without a real microphone.
 */
export function launchBrowser() {
    return chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || undefined,
        args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
    });
}

/**
 * Opens a fresh page, blocking the external Dropbox SDK so runs do not depend on the network.
 * Collects uncaught errors, CSP violations and console errors in `problems`.
 * Options: width/height/mobile for the viewport, permissions for the browser context.
 */
export async function openApp(browser, url, { width = 1280, height = 800, mobile = false, permissions = [] } = {}) {
    const context = await browser.newContext({
        viewport: { width, height }, isMobile: mobile, hasTouch: mobile, permissions,
        serviceWorkers: 'block', acceptDownloads: true
    });
    const page = await context.newPage();
    const problems = [];
    await page.route(/cdn\.jsdelivr\.net/, route => route.abort());
    page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
    page.on('console', m => {
        const text = m.text();
        if (/Content Security Policy|violates the following/i.test(text)) problems.push(`csp: ${text.slice(0, 160)}`);
        // Headless Chromium has no speech service; the app logs this when recording
        // A reload aborts in-flight fetches (e.g. tips.json), which the app logs as "Failed to fetch"
        else if (m.type() === 'error' && !/net::ERR_FAILED|Speech recognition error|Failed to fetch/.test(text)) problems.push(`console.error: ${text.slice(0, 160)}`);
    });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.container')).visibility === 'visible');
    return { page, context, problems };
}

export const openTab = async (page, tab) => {
    await page.click(`[data-action="switch-app-tab"][data-tab="${tab}"]`);
    await page.waitForTimeout(300);
};

/** All dreams currently in storage (read through the app's own loader). */
export const storedDreams = (page) => page.evaluate(async () => (await import('/storage.js')).loadDreams());

/**
 * Imports a "complete data" JSON backup through the Settings tab and waits until the data has
 * been written to IndexedDB (loadDreams() answers from memory before the write finishes).
 */
export async function importBackup(page, backup, expectedDreams = backup.data.dreams?.length ?? 0) {
    await openTab(page, 'settings');
    await page.setInputFiles('#importAllDataFile', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.waitForFunction(async (n) => (await (await import('/storage.js')).loadDreams()).length >= n, expectedDreams, { timeout: 30000 });
    await page.waitForFunction(() => new Promise(resolve => {
        const open = indexedDB.open('DreamJournal');
        open.onsuccess = () => {
            const count = open.result.transaction('dreams').objectStore('dreams').count();
            count.onsuccess = () => { open.result.close(); resolve(count.result > 0); };
        };
    }), null, { timeout: 30000 });
    await page.waitForTimeout(500);
    await openTab(page, 'journal');
}
