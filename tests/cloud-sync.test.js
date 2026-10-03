import './setup.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// The Dropbox SDK is loaded from a CDN in the browser, so these tests supply a stand-in whose token
// calls go through a mocked fetch. They check what cloud-sync.js does with concurrent callers: how
// many token requests actually leave the page.

const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
let requests;
let failNext;
let delayMs;

globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), body: init?.body });
    await new Promise(resolve => setTimeout(resolve, delayMs));
    if (failNext) { failNext = false; throw new Error('network down'); }
    return { ok: true, json: async () => ({ access_token: `access-${requests.length}`, refresh_token: 'refresh-new', expires_in: 14400 }) };
};

class FakeDropboxAuth {
    setRefreshToken(token) { this.refreshToken = token; }
    setCodeVerifier(verifier) { this.codeVerifier = verifier; }
    async refreshAccessToken() {
        const response = await fetch(TOKEN_URL, { method: 'POST', body: `grant_type=refresh_token&refresh_token=${this.refreshToken}` });
        return { result: await response.json() };
    }
    async getAccessTokenFromCode(redirectUri, code) {
        const response = await fetch(TOKEN_URL, { method: 'POST', body: `grant_type=authorization_code&code=${code}&code_verifier=${this.codeVerifier}` });
        return { result: await response.json() };
    }
}
class FakeDropbox {
    async usersGetCurrentAccount() { return { result: { email: 'someone@example.com', name: { display_name: 'Someone' } } }; }
}
globalThis.Dropbox = { DropboxAuth: FakeDropboxAuth, Dropbox: FakeDropbox };
globalThis.history = { replaceState() {} };
globalThis.sessionStorage = (() => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; })();

const { isAuthenticated, initializeCloudSync } = await import('../cloud-sync.js');
const { setDropboxAccessToken, setDropboxRefreshToken, getDropboxAccessToken, setEncryptionEnabled, setEncryptionPassword } = await import('../state.js');
const { DROPBOX_TOKEN_EXPIRES_KEY } = await import('../constants.js');

beforeEach(() => {
    requests = [];
    failNext = false;
    delayMs = 30;
    globalThis.location.search = '';
    // With an encryption password the tokens are stored with encryptData; without one they would need IndexedDB
    setEncryptionEnabled(true);
    setEncryptionPassword('test password');
    setDropboxAccessToken('old-access');
    setDropboxRefreshToken('refresh-old');
    localStorage.setItem(DROPBOX_TOKEN_EXPIRES_KEY, String(Date.now() - 1000));
});

const expire = () => localStorage.setItem(DROPBOX_TOKEN_EXPIRES_KEY, String(Date.now() - 1000));

test('two concurrent checks with an expired token send one refresh request', async () => {
    const [a, b] = await Promise.all([isAuthenticated(), isAuthenticated()]);
    assert.deepEqual([a, b], [true, true]);
    assert.equal(requests.length, 1, `requests: ${requests.map(r => r.body).join(' | ')}`);
    assert.notEqual(getDropboxAccessToken(), 'old-access', 'the new token was stored');
});

test('five concurrent checks still send one request', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => isAuthenticated()));
    assert.deepEqual(results, [true, true, true, true, true]);
    assert.equal(requests.length, 1);
});

test('a check after the refresh has finished sends a new request', async () => {
    assert.equal(await isAuthenticated(), true);
    expire();
    assert.equal(await isAuthenticated(), true);
    assert.equal(requests.length, 2);
});

test('a failed refresh reports false to every waiting caller, then the next call tries again', async () => {
    failNext = true;
    const [a, b] = await Promise.all([isAuthenticated(), isAuthenticated()]);
    assert.deepEqual([a, b], [false, false]);
    assert.equal(requests.length, 1);
    assert.equal(await isAuthenticated(), true);
    assert.equal(requests.length, 2);
});

test('two concurrent start-ups with an OAuth code in the URL exchange the code once', async () => {
    globalThis.location.search = '?code=one-time-code';
    sessionStorage.setItem('dropbox_code_verifier', 'verifier-123');
    await Promise.all([initializeCloudSync(), initializeCloudSync()]);
    const exchanges = requests.filter(r => String(r.body).includes('authorization_code'));
    assert.equal(exchanges.length, 1, `requests: ${requests.map(r => r.body).join(' | ')}`);
    assert.match(getDropboxAccessToken(), /^enc:v1:/, 'the exchanged token was stored');
});
