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

/** Launches Chromium (set CHROMIUM_PATH to use a preinstalled browser). */
export function launchBrowser() {
    return chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
}

/**
 * Opens a fresh page, blocking the external Dropbox SDK so runs do not depend on the network.
 * Collects uncaught errors and CSP violations in `problems`.
 */
export async function openApp(browser, url) {
    const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true });
    const page = await context.newPage();
    const problems = [];
    await page.route(/cdn\.jsdelivr\.net/, route => route.abort());
    page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
    page.on('console', m => {
        if (/Content Security Policy|violates the following/i.test(m.text())) problems.push(`csp: ${m.text().slice(0, 160)}`);
    });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.container')).visibility === 'visible');
    return { page, context, problems };
}
