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

    await t.test('the setup confirmation says the PIN is a screen lock and does not encrypt', async () => {
        const text = await page.innerText('#pinOverlay');
        assert.match(text, /does not encrypt/);
        assert.doesNotMatch(text, /advanced encryption|now protected/);
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

test('enabling encryption that fails part way changes nothing', async (t) => {
    const { page, context, problems } = await openApp(browser, server.url);
    await importBackup(page, sampleBackup(3));
    await openTab(page, 'settings');
    const readStore = (name) => page.evaluate((storeName) => new Promise(resolve => {
        const open = indexedDB.open('DreamJournal');
        open.onsuccess = () => {
            const all = open.result.transaction(storeName).objectStore(storeName).getAll();
            all.onsuccess = () => { open.result.close(); resolve(JSON.stringify(all.result)); };
        };
    }), name);
    await page.evaluate(() => new Promise(resolve => {
        const open = indexedDB.open('DreamJournal');
        open.onsuccess = () => {
            const tx = open.result.transaction(['goals', 'autocomplete'], 'readwrite');
            tx.objectStore('goals').put({
                id: 'goal_seeded_1', title: 'Seeded goal title', description: 'seeded goal text',
                type: 'custom', status: 'active', createdAt: new Date().toISOString()
            });
            tx.objectStore('autocomplete').put({ id: 'tags', items: ['seededtagalpha', 'seededtagbeta'] });
            tx.oncomplete = () => { open.result.close(); resolve(); };
        };
    }));
    const snapshot = async () => JSON.stringify([await readStore('dreams'), await readStore('goals'), await readStore('autocomplete'), await readStore('meta')]);
    const startEncryption = async () => {
        await page.click('[data-action="toggle-encryption"]');
        await page.fill('#passwordInput', 'correct horse');
        await page.fill('#confirmPasswordInput', 'correct horse');
        await page.click('#confirmPasswordBtn');
    };

    await t.test('a write that throws after the dreams were queued rolls the whole transaction back', async () => {
        const before = await snapshot();
        // Dreams are put first; the first goal put then throws, as a failing request in the same transaction would
        await page.evaluate(() => {
            window.__originalPut = IDBObjectStore.prototype.put;
            IDBObjectStore.prototype.put = function (...args) {
                if (this.name === 'goals') throw new DOMException('forced failure', 'DataError');
                return window.__originalPut.apply(this, args);
            };
        });
        await startEncryption();
        await page.waitForSelector('.security-dialog-overlay:has-text("Failed to enable encryption")', { timeout: 60000 });
        await page.click('.security-dialog-overlay button');

        assert.equal(await snapshot(), before, 'stored data changed although enabling encryption failed');
        assert.ok(!(await readStore('dreams')).includes('"encrypted":true'));
        assert.equal(await readStore('meta'), '[]', 'a check value was stored');
        assert.equal(await page.evaluate(() => localStorage.getItem('dreamJournalEncryptionEnabled')), null);
        assert.equal(await page.evaluate(async () => (await import('/state.js')).getEncryptionEnabled()), false);
        assert.equal(await page.evaluate(async () => (await import('/state.js')).getEncryptionPassword?.() ?? null), null);
    });

    await t.test('after the failure the same steps succeed and encrypt everything', async () => {
        await page.evaluate(() => { IDBObjectStore.prototype.put = window.__originalPut; });
        await startEncryption();
        await page.waitForSelector('.security-dialog-overlay:has-text("Encryption Successful")', { timeout: 60000 });
        await page.click('.security-dialog-overlay button');
        assert.match(await readStore('dreams'), /"encrypted":true/);
        assert.ok(!(await readStore('goals')).includes('Seeded goal title'));
        assert.ok(!(await readStore('autocomplete')).includes('seededtagalpha'));
        assert.notEqual(await readStore('meta'), '[]');
        assert.equal(await page.evaluate(() => localStorage.getItem('dreamJournalEncryptionEnabled')), 'true');
    });

    // The forced failure is logged by the code that handles it
    assert.deepEqual(problems.filter(p => !/Error setting up encryption|Encryption error|Error saving to stores|Error writing to stores|Write to stores was aborted/.test(p)), []);
    await context.close();
});

test('the stored check record decides whether the journal is encrypted', async (t) => {
    const { page, context, problems } = await openApp(browser, server.url);
    await importBackup(page, sampleBackup(3));
    await openTab(page, 'settings');
    const flag = () => page.evaluate(() => localStorage.getItem('dreamJournalEncryptionEnabled'));
    const deleteCheckRecord = () => page.evaluate(() => new Promise(resolve => {
        const open = indexedDB.open('DreamJournal');
        open.onsuccess = () => {
            const tx = open.result.transaction('meta', 'readwrite');
            tx.objectStore('meta').delete('encryptionCheck');
            tx.oncomplete = () => { open.result.close(); resolve(); };
        };
    }));
    const waitForPasswordScreen = async () => {
        await page.waitForSelector('#lockScreenPasswordInput');
        assert.equal(await page.locator('.entry').count(), 0);
    };

    await t.test('set up encrypted data', async () => {
        await page.click('[data-action="toggle-encryption"]');
        await page.fill('#passwordInput', 'correct horse');
        await page.fill('#confirmPasswordInput', 'correct horse');
        await page.click('#confirmPasswordBtn');
        await page.waitForSelector('.security-dialog-overlay:has-text("Encryption Successful")', { timeout: 60000 });
        await page.click('.security-dialog-overlay button');
        assert.equal(await flag(), 'true');
    });

    await t.test('with the flag missing the app still asks for the password, and the flag comes back', async () => {
        await page.evaluate(() => localStorage.removeItem('dreamJournalEncryptionEnabled'));
        await page.reload({ waitUntil: 'load' });
        await waitForPasswordScreen();
        assert.equal(await flag(), 'true');
    });

    await t.test('with the flag set to false the app still asks for the password', async () => {
        await page.evaluate(() => localStorage.setItem('dreamJournalEncryptionEnabled', 'false'));
        await page.reload({ waitUntil: 'load' });
        await waitForPasswordScreen();
        assert.equal(await flag(), 'true');
    });

    await t.test('a journal without a check record but with encrypted dreams stays encrypted', async () => {
        await deleteCheckRecord();
        await page.reload({ waitUntil: 'load' });
        await waitForPasswordScreen();
        assert.equal(await flag(), 'true');
    });

    await t.test('the right password still unlocks it', async () => {
        await page.fill('#lockScreenPasswordInput', 'correct horse');
        await page.click('[data-action="verify-encryption-password"]');
        await page.waitForSelector('#decryption-progress-dialog:has-text("Decryption Successful")', { timeout: 30000 });
        await page.waitForSelector('.entry');
        assert.equal((await storedDreams(page)).length, 3);
    });

    assert.deepEqual(problems.filter(p => !/Encryption flag corrected/.test(p)), []);
    await context.close();
});

test('a leftover encryption flag on a journal with no encrypted data is cleared', async () => {
    const { page, context, problems } = await openApp(browser, server.url);
    await importBackup(page, sampleBackup(3));
    await page.evaluate(() => localStorage.setItem('dreamJournalEncryptionEnabled', 'true'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.entry');
    assert.equal(await page.locator('#lockScreenPasswordInput').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('dreamJournalEncryptionEnabled')), 'false');
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

    // First 16 bytes of each stored item are its salt
    const storedSalts = (store = 'dreams') => page.evaluate((storeName) => new Promise(resolve => {
        const open = indexedDB.open('DreamJournal');
        open.onsuccess = () => {
            const all = open.result.transaction(storeName).objectStore(storeName).getAll();
            all.onsuccess = () => {
                open.result.close();
                resolve(all.result.map(d => Array.from(d.data.slice(0, 16), b => b.toString(16).padStart(2, '0')).join('')));
            };
        };
    }), store);
    const rawStore = (store) => page.evaluate((storeName) => new Promise(resolve => {
        const open = indexedDB.open('DreamJournal');
        open.onsuccess = () => {
            const all = open.result.transaction(storeName).objectStore(storeName).getAll();
            all.onsuccess = () => { open.result.close(); resolve(JSON.stringify(all.result)); };
        };
    }), store);

    // The encryption check value lives in the meta store; its first 16 bytes are the salt, as for stored items
    const metaRecord = () => page.evaluate(() => new Promise(resolve => {
        const open = indexedDB.open('DreamJournal');
        open.onsuccess = () => {
            const get = open.result.transaction('meta').objectStore('meta').get('encryptionCheck');
            get.onsuccess = () => { open.result.close(); resolve(get.result ?? null); };
        };
    }));
    const hex = (bytes) => Array.from(bytes.slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
    const deleteMetaRecord = () => page.evaluate(() => new Promise(resolve => {
        const open = indexedDB.open('DreamJournal');
        open.onsuccess = () => {
            const tx = open.result.transaction('meta', 'readwrite');
            tx.objectStore('meta').delete('encryptionCheck');
            tx.oncomplete = () => { open.result.close(); resolve(); };
        };
    }));
    // Flips the last byte of the first stored dream so it no longer decrypts; returns the original record
    const damageFirstDream = () => page.evaluate(() => new Promise(resolve => {
        const open = indexedDB.open('DreamJournal');
        open.onsuccess = () => {
            const tx = open.result.transaction('dreams', 'readwrite');
            const store = tx.objectStore('dreams');
            const all = store.getAll();
            let original;
            all.onsuccess = () => {
                original = all.result[0];
                const data = new Uint8Array(original.data);
                data[data.length - 1] ^= 0xff;
                store.put({ ...original, data });
            };
            tx.oncomplete = () => { open.result.close(); resolve(original); };
        };
    }));
    const restoreDream = (record) => page.evaluate((original) => new Promise(resolve => {
        const open = indexedDB.open('DreamJournal');
        open.onsuccess = () => {
            const tx = open.result.transaction('dreams', 'readwrite');
            tx.objectStore('dreams').put(original);
            tx.oncomplete = () => { open.result.close(); resolve(); };
        };
    }), record);
    // After a successful unlock the dialog closes by itself; it waits for OK only when items were skipped
    const dismissDecryptionSuccess = async ({ closesItself = true } = {}) => {
        await page.waitForSelector('#decryption-progress-dialog:has-text("Decryption Successful")', { timeout: 30000 });
        if (closesItself) await page.waitForSelector('#decryption-progress-dialog', { state: 'detached', timeout: 10000 });
        else await page.click('#decryption-progress-dialog button');
    };

    // The sample backup has no goals or autocomplete data, so store some directly
    await page.evaluate(() => new Promise(resolve => {
        const open = indexedDB.open('DreamJournal');
        open.onsuccess = () => {
            const tx = open.result.transaction(['goals', 'autocomplete'], 'readwrite');
            tx.objectStore('goals').put({
                id: 'goal_seeded_1', title: 'Seeded goal title', description: 'seeded goal text',
                type: 'custom', status: 'active', createdAt: new Date().toISOString()
            });
            tx.objectStore('autocomplete').put({ id: 'tags', items: ['seededtagalpha', 'seededtagbeta'] });
            tx.oncomplete = () => { open.result.close(); resolve(); };
        };
    }));
    const unlockWithPassword = async (password) => {
        await page.waitForSelector('#lockScreenPasswordInput');
        await page.fill('#lockScreenPasswordInput', password);
        await page.click('[data-action="verify-encryption-password"]');
    };

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
        assert.ok(!(await rawStore('goals')).includes('Seeded goal title'), 'goal stored as plaintext');
        assert.match(await rawStore('goals'), /"encrypted":true/);
        assert.ok(!(await rawStore('autocomplete')).includes('seededtagalpha'), 'autocomplete stored as plaintext');
    });

    await t.test('the stored dreams share one salt, so one key derivation covers the journal', async () => {
        const salts = await storedSalts();
        assert.equal(salts.length, 3);
        assert.equal(new Set(salts).size, 1);
    });

    await t.test('enabling encryption also stores an encrypted check value under the journal salt', async () => {
        const check = await metaRecord();
        assert.ok(check, 'no check value stored');
        assert.ok(check.data.length > 28);
        assert.ok(!JSON.stringify(check).includes('encryption-check'), 'plaintext in the check value');
        assert.equal(hex(check.data), (await storedSalts())[0]);
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
        await dismissDecryptionSuccess();
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

    await t.test('a dream saved in a later session reuses the journal salt', async () => {
        const salts = await storedSalts();
        assert.equal(salts.length, 4);
        assert.equal(new Set(salts).size, 1);
    });

    await t.test('changing the password re-encrypts under a new salt; only the new password unlocks', async () => {
        const [oldSalt] = await storedSalts();
        await openTab(page, 'settings');
        await page.click('[data-action="change-encryption-password"]');
        const verifyDialog = page.locator('.pin-overlay:has-text("Verify Encryption Password")');
        await verifyDialog.waitFor();
        assert.doesNotMatch(await verifyDialog.innerText(), /disable encryption/);
        await page.fill('#passwordInput', 'correct horse');
        await page.click('#confirmPasswordBtn');
        await page.waitForSelector('.pin-overlay:has-text("Set New Encryption Password")');
        await page.fill('#passwordInput', 'battery staple');
        await page.fill('#confirmPasswordInput', 'battery staple');
        await page.click('#confirmPasswordBtn');
        await page.waitForSelector('.security-dialog-overlay:has-text("password changed")', { timeout: 60000 });
        await page.click('.security-dialog-overlay button');

        const salts = await storedSalts();
        assert.equal(salts.length, 4);
        assert.equal(new Set(salts).size, 1);
        assert.notEqual(salts[0], oldSalt);
        assert.ok(!(await rawDreams()).includes('Encrypted era dream'));

        // Goals and autocomplete data move to the new key as well: still ciphertext, same new salt
        const [dreamSalt] = salts;
        assert.equal(hex((await metaRecord()).data), dreamSalt, 'the check value was not re-keyed with the journal');
        assert.ok(!(await rawStore('goals')).includes('Seeded goal title'));
        assert.ok(!(await rawStore('autocomplete')).includes('seededtagalpha'));
        assert.deepEqual(await storedSalts('goals'), [dreamSalt]);
        assert.ok((await storedSalts('autocomplete')).length >= 1);
        assert.deepEqual([...new Set(await storedSalts('autocomplete'))], [dreamSalt]);

        await page.reload({ waitUntil: 'load' });
        await unlockWithPassword('correct horse');
        await page.waitForSelector('.security-dialog-overlay:has-text("Incorrect password")', { timeout: 30000 });
        await page.click('.security-dialog-overlay button');
        await unlockWithPassword('battery staple');
        await dismissDecryptionSuccess();
        await page.waitForSelector('.entry');
        const titles = (await storedDreams(page)).map(d => d.title);
        assert.equal(titles.length, 4);
        assert.ok(titles.includes('Encrypted era dream'));
        const readable = await page.evaluate(async () => {
            const storage = await import('/storage.js');
            const goals = await storage.loadGoals();
            const tags = await storage.getAutocompleteSuggestions('tags');
            return { goals: goals.map(g => g.title), tags: tags.filter(t => t.startsWith('seededtag')) };
        });
        assert.deepEqual(readable.goals, ['Seeded goal title']);
        assert.deepEqual(readable.tags, ['seededtagalpha', 'seededtagbeta']);
    });

    await t.test('a re-encryption that fails part way changes nothing in storage', async () => {
        const snapshot = async () => JSON.stringify([await rawDreams(), await rawStore('goals'), await rawStore('autocomplete')]);
        // Damage the stored goal so decrypting it fails after the dreams have been processed
        const damageGoal = (restore) => page.evaluate((shouldRestore) => new Promise(resolve => {
            const open = indexedDB.open('DreamJournal');
            open.onsuccess = () => {
                const tx = open.result.transaction('goals', 'readwrite');
                const store = tx.objectStore('goals');
                const get = store.getAll();
                get.onsuccess = () => {
                    const goal = get.result[0];
                    if (shouldRestore) {
                        store.put(window.__originalGoal);
                    } else {
                        window.__originalGoal = goal;
                        const data = new Uint8Array(goal.data);
                        data[data.length - 1] ^= 0xff;
                        store.put({ ...goal, data });
                    }
                };
                tx.oncomplete = () => { open.result.close(); resolve(); };
            };
        }), restore);

        await damageGoal(false);
        const before = await snapshot();
        const outcome = await page.evaluate(async () => {
            const { reEncryptAllData } = await import('/security.js');
            try {
                await reEncryptAllData('battery staple', 'another new password');
                return 'resolved';
            } catch (error) {
                return 'rejected';
            }
        });
        assert.equal(outcome, 'rejected');
        assert.equal(await snapshot(), before, 'stored data changed although the re-encryption failed');
        await damageGoal(true);
        // The journal still opens with the real password
        await page.reload({ waitUntil: 'load' });
        await unlockWithPassword('battery staple');
        await dismissDecryptionSuccess();
        await page.waitForSelector('.entry');
        assert.equal((await storedDreams(page)).length, 4);
    });

    await t.test('a damaged dream does not stop the right password; the unlock says what could not be read', async () => {
        const original = await damageFirstDream();
        await page.reload({ waitUntil: 'load' });
        // A wrong password is still refused, as a wrong password
        await unlockWithPassword('not the password');
        await page.waitForSelector('.security-dialog-overlay:has-text("Incorrect password")', { timeout: 30000 });
        await page.click('.security-dialog-overlay button');
        // The right password is accepted although the first dream cannot be decrypted
        await unlockWithPassword('battery staple');
        // With a skipped item the dialog waits for OK, so the note about it is read
        await page.waitForSelector('#decryption-progress-dialog:has-text("could not be decrypted")', { timeout: 30000 });
        await page.waitForTimeout(2500);
        assert.ok(await page.locator('#decryption-progress-dialog').isVisible(), 'the dialog closed by itself although an item was skipped');
        await dismissDecryptionSuccess({ closesItself: false });
        await page.waitForSelector('.entry');
        assert.equal((await storedDreams(page)).length, 3);
        await page.waitForFunction(() => /1 stored item could not be decrypted/.test(document.body.innerText), null, { timeout: 10000 });
        await restoreDream(original);
        await page.reload({ waitUntil: 'load' });
        await unlockWithPassword('battery staple');
        await dismissDecryptionSuccess();
        await page.waitForSelector('.entry');
        assert.equal((await storedDreams(page)).length, 4);
        assert.ok(!/could not be decrypted/.test(await page.innerText('body')), 'warning shown for an intact journal');
    });

    await t.test('a journal from before the check value existed still unlocks, and gets one', async () => {
        await deleteMetaRecord();
        await page.reload({ waitUntil: 'load' });
        await unlockWithPassword('not the password');
        await page.waitForSelector('.security-dialog-overlay:has-text("Incorrect password")', { timeout: 30000 });
        await page.click('.security-dialog-overlay button');
        assert.equal(await metaRecord(), null, 'a wrong password must not create a check value');
        await unlockWithPassword('battery staple');
        await dismissDecryptionSuccess();
        await page.waitForSelector('.entry');
        assert.ok(await metaRecord(), 'the check value was not created');
    });

    await t.test('pressing Enter on Cancel in the disable-encryption confirmation keeps encryption on', async () => {
        await openTab(page, 'settings');
        await page.click('[data-action="toggle-encryption"]');
        await page.waitForSelector('.pin-overlay:has-text("Verify Encryption Password")');
        await page.fill('#passwordInput', 'battery staple');
        await page.click('#confirmPasswordBtn');
        const confirmDialog = page.locator('.pin-overlay:has-text("Disable Data Encryption?")');
        await confirmDialog.waitFor();
        assert.equal(await page.evaluate(() => document.activeElement.id), 'cancelBtn', 'the confirmation dialog should start on its safer Cancel button');
        await page.keyboard.press('Enter');
        await confirmDialog.waitFor({ state: 'detached' });
        await page.waitForTimeout(500);
        assert.equal(await page.evaluate(() => localStorage.getItem('dreamJournalEncryptionEnabled')), 'true');
        assert.ok(!(await rawDreams()).includes('Encrypted era dream'), 'dreams were decrypted by pressing Enter on Cancel');
        assert.equal(await page.locator('.security-dialog-overlay').count(), 0, 'no decryption progress dialog should appear');
    });

    await t.test('disabling encryption stores the dreams as readable data again', async () => {
        await openTab(page, 'settings');
        await page.click('[data-action="toggle-encryption"]');
        await page.waitForSelector('.pin-overlay:has-text("Verify Encryption Password")');
        await page.fill('#passwordInput', 'battery staple');
        await page.click('#confirmPasswordBtn');
        const confirmDialog = page.locator('.pin-overlay:has-text("Disable Data Encryption?")');
        await confirmDialog.waitFor();
        assert.equal(await page.evaluate(() => document.activeElement.id), 'cancelBtn', 'the confirmation dialog should start on its safer Cancel button');
        // Shift+Tab from Cancel reaches the confirm button; Enter on it confirms
        await page.keyboard.press('Shift+Tab');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'confirmBtn');
        await page.keyboard.press('Enter');
        await page.waitForSelector('.security-dialog-overlay:has-text("Decryption Successful")', { timeout: 60000 });
        await page.click('.security-dialog-overlay button');
        const raw = await rawDreams();
        assert.ok(raw.includes('Encrypted era dream'), 'dreams are still encrypted');
        assert.ok(!/"encrypted":true/.test(raw));
        assert.equal(await page.evaluate(() => localStorage.getItem('dreamJournalEncryptionEnabled')), 'false');
        assert.equal(await metaRecord(), null, 'the check value was kept after encryption was turned off');
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('.entry');
        assert.equal((await storedDreams(page)).length, 4);
    });

    // The app logs console errors for the deliberate wrong-password attempt and the damaged dream above
    assert.deepEqual(problems.filter(p => !/Decryption error: OperationError|Re-encryption error|Failed to decrypt dream/.test(p)), []);
    await context.close();
});
