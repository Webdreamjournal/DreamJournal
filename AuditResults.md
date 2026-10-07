# Audit results

Audit of Dream Journal v2.05.06, commit `164414c`, carried out on 7 October 2026.

This is a point-in-time review. It records what was found, how sure the finding is, and where in the code to look. It does not change any code.

## Contents

1. [Summary](#summary)
2. [Scope and method](#scope-and-method)
3. [Baseline checks](#baseline-checks)
4. [Findings](#findings)
5. [Checked and found sound](#checked-and-found-sound)
6. [Test gaps](#test-gaps)
7. [Suggested order of work](#suggested-order-of-work)
8. [What this audit did not cover](#what-this-audit-did-not-cover)

## Summary

The codebase is in better shape than its "little human review" disclaimer suggests. Escaping of dream text is consistent, the cryptography is used correctly, the Content-Security-Policy works, and the existing lint, unit and browser suites pass apart from one browser test (see below).

The serious problems are not in the cryptography. They are in the **write paths around it**. Encryption is applied by individual callers rather than by the storage layer, so several ordinary actions silently write plain text back into an encrypted journal. Imports are the second weak area: the complete-data import and the Dropbox restore trust the shape of the file far more than the text import does.

| Severity | Count | Meaning |
| --- | --- | --- |
| High | 2 | Breaks a documented security or data-integrity promise during ordinary use. |
| Medium | 5 | Needs a crafted file or a specific condition, or hides or loses data in a narrower case. |
| Low | 11 | Robustness, accessibility, hardening and maintainability. |

Headline findings:

* **H1.** With encryption on, completing, reactivating or deleting a goal, changing a custom goal's progress, and importing a text file all rewrite stored data as plain text. The UI keeps saying encryption is on. Reproduced.
* **H2.** With encryption on, a complete-data JSON import fails with a database error, yet the app reports "Successfully imported" and shows a "database could not open" banner. Reproduced.
* **M1.** Goal fields from an imported or Dropbox file reach `innerHTML` without escaping. Script execution is stopped by the CSP, but markup injection works, and the CSP's `cdn.jsdelivr.net` allowance is wider than it needs to be. Reproduced.

## Scope and method

**What was reviewed.** The 44 JavaScript files (about 35,000 lines, of which 47% of non-blank lines are comments), `index.html`, `sw.js`, `manifest.json`, the CI workflow, the README and `AGENTS.md`. `security-crypto.js`, `pin-core.js`, `device-key.js` and `sw.js` were read in full. For the PIN, lock-screen, import and export, Dropbox and storage modules, I read the parts that handle secrets, untrusted input or persistence. Everything else was reviewed by searching for risky patterns (HTML injection sites, unescaped template values, storage writes, global state, unused code) and reading each hit.

**How findings are labelled.**

* **Reproduced:** I ran it against the unmodified app in headless Chromium, using the repo's own Playwright helpers, and observed the result.
* **Read:** Established by reading the code. Not run.

Nothing in the repository was modified to reproduce these. The probe scripts were temporary and are not part of this change; the reproduction steps below are enough to turn them into e2e tests.

## Baseline checks

| Check | Result |
| --- | --- |
| `npm run lint` | Clean. |
| `npm test` | 106 of 106 pass. |
| `npm audit` | 0 known vulnerabilities (dev dependencies only; the app ships no npm packages). |
| `npm run test:e2e` | 64 top-level tests: 63 pass, 1 fails (see [L5](#l5-the-smart-search-help-tooltip-close-button-can-fall-below-the-viewport)). Three runs, same result each time. |
| Dropbox SDK | Pinned to `dropbox@10.34.0` with a Subresource Integrity hash. |

## Findings

### High

#### H1. With encryption on, ordinary actions write plain text back to IndexedDB

**Evidence:** Reproduced. **Files:** `storage.js` (`saveDreams` around line 907, `saveGoals` 1120, `replaceStoreContents` 1229, `saveToStore` 400), `goalstab.js` (1395, 1427, 1551), `action-router.js` (885, 937), `import-export.js` (662, 1022, 1096), `cloud-sync.js` (867 to 874).

The storage functions `saveDreams`, `saveGoals` and `saveToStore` write whatever objects they are given. Encryption is applied only by certain callers (`encryptItemForStorage` in `dream-crud.js`, `goalstab.js` create and update, and `encryption-settings.js`). The loaders return decrypted objects, so any caller that does "load, change, save" writes plain text.

Observed in the browser:

* After enabling encryption with two goals present, clicking **Complete** on one goal left **2 of 2** goal records as plain text, titles readable.
* After enabling encryption with three dreams present, importing a small `.txt` file left **5 of 5** dream records as plain text, including the three that had been encrypted.

Other callers with the same pattern, found by reading: reactivating a goal, deleting a goal, the custom-goal progress buttons, the goals half of the JSON import, and the Dropbox restore (`importCloudData`).

Why it matters: the README says "When on, dreams, goals and suggestion lists are encrypted" (Privacy and security, Encryption). The encryption flag and the stored check value stay in place, so the lock screen still asks for the password and nothing tells the user their data is now readable on disk. The loaders accept a mix of encrypted and plain records, which hides the problem. The encryption tests cover turning encryption on and off, and saving a dream or goal, but not these paths.

Reproduce: import a backup with a goal, enable encryption in Settings, open Goals and click Complete, then read the `goals` store in DevTools (Application, IndexedDB, `DreamJournal`). Records have no `encrypted: true`.

Suggested fix: do the encryption inside the storage layer, so no caller can forget it. `saveDreams`, `saveGoals` and `saveToStore` should encrypt each item when encryption is on and a session password exists, or refuse to write (and say so) when encryption is on and no password is available. Replace "rewrite the whole store" with per-item `put` where only one item changed (as `dream-crud.js` already does for dreams).

#### H2. With encryption on, the complete-data JSON import fails but reports success

**Evidence:** Reproduced. **Files:** `storage.js` (`loadDreams` 827), `import-export.js` (1013, 1020 to 1022), `storage.js` (`saveDreams` 907).

When encryption is on, `loadDreams()` returns the cached decrypted array itself, not a copy. Confirmed in the browser: with encryption off two calls return different arrays; with encryption on they return the same array, and pushing onto the first makes the second one longer.

`importAllData` relies on getting fresh copies. It pushes each imported dream onto `currentDreams` (line 1013), then calls `loadDreams()` again (line 1020) and appends `newDreams`. With encryption on, both are the same array, so every imported dream is present twice, and IndexedDB rejects the write with `ConstraintError: Key already exists`.

Observed:

* The database kept its original 3 rows.
* The page showed "Successfully imported 1 dreams, 0 goals!".
* A banner said "Storage is not available. Nothing you save will be kept. Dream Journal could not open its database", which is wrong: the database was open and one write was rejected.
* The imported dream appeared in the journal (from memory) even though it was not stored. A later write (the text import in H1) then saved it, as plain text.

Two separate defects are involved:

1. The decrypted cache hands out its own array instead of a copy.
2. `saveDreams` turns any failed write into "fall back to memory and show the storage banner", and returns nothing, so callers cannot tell. Every import path therefore reports success after a failed save.

Suggested fix: return copies from `loadDreams`/`loadGoals` (or freeze the cached arrays so a push throws in tests), and make `saveDreams` and `saveGoals` return or throw on failure so import code can report it. The "database could not open" banner should be reserved for the case where it could not open.

### Medium

#### M1. Goal fields from imported or Dropbox data are written into HTML unescaped

**Evidence:** Reproduced. **Files:** `tips-and-goals-ui.js` (190, 196, 197, 200), `goalstab.js` (1045 to 1046), `import-export.js` (1034 to 1039, 1086), `cloud-sync.js` (874), `index.html` (CSP, line 25).

`createGoalElement` interpolates `progress.current`, `goal.target` and `progress.message` into an `innerHTML` template without `escapeHtml`. For a custom goal, `progress.current` and `progress.message` come straight from the stored `currentProgress` field. The JSON import and the Dropbox restore store goal objects without checking field types: only `id` is validated by `sanitizeEntityIds`. `AGENTS.md` rule "Never put untrusted strings into HTML unescaped" is not met here.

Observed: importing a goal with `currentProgress` set to `<b id="inj-progress">P</b>` and `target` set to a string containing a closing quote and tag put real `<b>` and `<i>` elements into the goals tab, and the attribute value broke out of `aria-valuemax`.

What stops it becoming script execution: an `<img onerror=...>` payload was injected and **did not run**; the browser reported "Refused to execute inline event handler". The CSP is doing real work here.

What the CSP does not stop:

* `style-src` includes `'unsafe-inline'`, so injected markup can restyle or overlay the page (for example a fake unlock prompt).
* `script-src` allows the whole host `https://cdn.jsdelivr.net`, not only the Dropbox SDK file. In the browser, a script tag pointing at an arbitrary jsDelivr path inside an injected `srcdoc` iframe was **not** refused by the CSP, while one pointing at `evil.example` was. jsDelivr serves any published npm package, so an attacker who can get markup into the page may be able to load their own code. That is a chain of two weaknesses, and I did not try to build a working exploit, but the first link (markup injection) is real and the second (a host-wide script allowance) is a known CSP weakness.

The attack needs a victim to import a hostile file, or someone with write access to the victim's Dropbox app folder. What is at stake if it escalated to script execution is the journal itself, and the Dropbox tokens, which page script can ask the browser to decrypt (`device-key.js` says as much).

Suggested fix, in this order: escape `progress.current`, `progress.message` and `goal.target` in `createGoalElement` (or build the element with `textContent`); coerce goal numbers (`Number.isFinite`, clamp) and enumerated fields (`type`, `period`, `status`) when importing; narrow `script-src` to the exact SDK URL (`https://cdn.jsdelivr.net/npm/dropbox@10.34.0/dist/Dropbox-sdk.min.js`; CSP allows a full path); consider dropping `'unsafe-inline'` from `style-src` by moving the remaining `style="..."` attributes into classes.

#### M2. The Dropbox restore is not atomic and ignores write failures

**Evidence:** Read (the plain-text part is covered by H1, which was reproduced for other paths). **File:** `cloud-sync.js` (`importCloudData`, 855 to 923).

`importCloudData` first calls `saveToStore('dreams', [])`, which commits an empty dreams store, and only then calls `saveToStore('dreams', <cloud data>)` in a second transaction. `saveToStore` resolves `false` on any failure, and `importCloudData` never looks at the result. If the second write fails (a duplicate id in the cloud file, a quota error, the tab closing), the local journal is left empty and the function still returns `success: true` ("Data imported successfully from cloud").

There is a confirmation dialog before a download ("Download Anyway - Lose Local Changes"), so replacing local data is intended. Losing it on a failed write is not.

The README already describes the encryption changes as single-transaction. This path predates `putItemsInStores` and was not moved over.

Suggested fix: build the full set of items first, then write dreams, goals and autocomplete data in one `putItemsInStores`-style transaction that clears and fills together, and check the result. Encrypt the items on the way in (H1).

#### M3. The complete-data import does not validate what it stores

**Evidence:** Reproduced. **File:** `import-export.js` (973 to 1016, 1105 to 1112, 1175 to 1190).

The text import runs each dream through `validateDreamData` (line 397). The complete-data import does not call it. It only fills in missing fields. Observed with a crafted file:

* A dream whose `timestamp` is `"not-a-date"` is stored (with `dateString: "Invalid Date"`) but **never shown**: `filterDreams` silently drops any dream with an unparseable date (`dream-crud.js` line 692). It still counts toward exports and storage, and cannot be edited or deleted from the UI.
* A dream whose `title` is an object is shown as `[object Object]`.
* The same bad timestamp adds `NaN` to the Stats tab's year drop-down.
* One non-string value in `autocomplete.tags` throws `tag.toLowerCase is not a function` at line 1112. By then the dreams and goals have already been saved, but the autocomplete and settings sections are skipped and the user sees only "Complete import error: ...". A second attempt skips the already-saved dreams as duplicates, which makes the first failure hard to notice.
* Nothing in the import is atomic: dreams, goals, tag lists and settings are saved in separate steps.

Suggested fix: one shared `normaliseDream` / `normaliseGoal` function (string coercion, date check, array-of-string check, enumerated values) used by the text import, the JSON import and the Dropbox restore, with a count of rejected entries in the result message. Skip bad entries instead of aborting.

#### M4. The PIN lockout is not applied to every place a PIN is checked

**Evidence:** Read. **Files:** `lock-screen.js` (`confirmDataWipe`, 622), `pin-recovery.js` (`confirmCancelTimer`, 489 to 497; `verifyDreamTitles`, 190), `pin-overlay.js` (264).

The throttle (30 seconds from the third failure, doubling to 15 minutes) is enforced in only three places: the lock screen (`lock-screen.js` 79 and 113), the PIN overlay (`pin-overlay.js` 71 and 111) and the encryption password prompt (`encryption-auth.js` 110 and 194). Four other code paths check a PIN or an equivalent secret with no lockout check and no failed-attempt count:

* The PIN field in the lock screen's "delete everything" confirmation. Because this screen is reachable while the journal is locked, it works as an unthrottled PIN guesser.
* "Cancel timer" on the reset-timer banner.
* The "current PIN" step when changing or removing a PIN.
* Recovery by dream titles. A wrong set of titles is not counted, so there is no limit on attempts.

Impact is limited by the design the README states: the PIN is a screen lock, the lockout counter lives in `localStorage` and can be edited by anyone with developer tools, and a 4 to 6 digit PIN has at most 1,000,000 values, which is about 28 hours on one thread at the 100 ms per derivation the code comments cite, and far less with native tools. Still, the visible throttle is inconsistent with what the README promises.

Suggested fix: move the "check lockout, verify, count failure, clear on success" sequence into one function in `pin-core.js` and call it from every path. Count wrong title sets as failed attempts.

#### M5. A failed service-worker precache is treated as a successful install

**Evidence:** Read. **File:** `sw.js` (install handler, 186 to 204).

`cache.addAll(urlsToCache)` is all-or-nothing: if any one of the 52 requests fails, nothing is cached. The `.catch` at line 201 only logs, so the install still succeeds. When the new worker activates, its `activate` handler deletes every other `dream-journal-` cache, including the previous complete one. The result is an active worker with an empty cache and no old one to fall back on. The app still works online, and the cache refills as pages are fetched, but a user who goes offline straight after an update (on a poor connection, which is when a precache fails) gets "Offline and not cached".

Suggested fix: let the failure propagate (remove the `.catch`, or rethrow) so the old worker and its cache stay in service and the install is retried.

### Low

#### L1. Any link containing `?code=` signs the user out of Dropbox

**Evidence:** Reproduced. **File:** `cloud-sync.js` (`exchangeAuthorizationCode`, 401 to 475; `initializeCloudSync`, 2253).

At start-up, if the URL has a `code` parameter and there is no stored PKCE verifier, the code throws and the `catch` calls `clearAuthenticationState()`, which deletes the stored Dropbox tokens. With tokens stored, opening `/?code=anything` removed both the access and refresh tokens. The user has to reconnect. No data is lost and nothing is leaked, but a crafted link can do it. Fix: only treat `code` as an OAuth callback when a verifier is present, and do not clear existing tokens when it is not.

#### L2. The new PIN stays in a global variable after Cancel or a mismatch

**Evidence:** Read. **File:** `pin-overlay.js` (282, 346, 446, 456, 467).

During PIN setup the first entry is stored in `window.tempNewPin`. It is deleted only after a successful confirmation. Cancelling, or entering a non-matching confirmation, leaves the plain PIN on `window` until the page is reloaded. Fix: keep it in a closure or `state.js`, and clear it in `hidePinOverlay`.

#### L3. Some goal type and period combinations never make progress

**Evidence:** Read. **Files:** `goalstab.js` (`calculateGoalProgress`, 1010 to 1026; `buildGoalFormHTML`, 1083 onwards), `goalstab.js` (`validateGoalForm`, 244).

The "Lucid Dreams Count" type only counts anything when the period is "Monthly". With "Consecutive Days" or "All Time Total" the code falls out of the `switch` with `current = 0` and an empty message, so the goal stays at 0 forever with no explanation. The form lets you choose any combination. Fix: either count lucid dreams for the other periods, or restrict the period list for each type.

#### L4. Imported settings are not validated

**Evidence:** Reproduced. **File:** `import-export.js` (1175 to 1192).

The complete-data import writes the `theme` value to `localStorage` and replaces the whole `document.body.className` with `theme-<value>`; the Dropbox restore checks the theme against `light`, `dark` and `auto`, but this path does not. A value like `x injected-class` was applied for the session and stored (the app recovered to the dark theme on reload). `paginationLimit` is stored as given (`99999` was accepted). Impact is small; the fix is to reuse the allow-list from the Dropbox path.

#### L5. The smart-search help tooltip close button can fall below the viewport

**Evidence:** Reproduced. **File:** `info-tooltips.js` (136); test `tests/e2e/ui-helpers.e2e.js` ("help tooltips open and close").

This is the one failing browser test. At 1280 by 800 the smart-search tooltip is 735 px tall and is placed at `top = Math.max(110, ...)`. The floor of 110 px wins, so its bottom edge is at 845 px and the "Got it!" button sits at y = 801, one pixel below the viewport. The tooltip is `position: fixed`, so it cannot be scrolled. At 1280 by 1000 and on a 390 by 844 phone the button is visible. Browser windows shorter than about 830 px (common on laptops) are affected. The tooltip can still be dismissed by clicking elsewhere, and it closes itself after 30 seconds, so this is a layout defect and not a dead end.

The result may differ on CI, because the tooltip's height depends on font metrics; the unmodified test failed three times in a row in this environment. Fix: clamp `topPosition` so that `top + height` stays inside the viewport, and let the tooltip body scroll when it is taller than the space available.

#### L6. Several dialogs point `aria-labelledby` at ids that do not exist

**Evidence:** Read. **Files:** `goalstab.js` (1172, `goalDialogTitle`), `cloud-sync.js` (1270 `conflict-dialog-title`, 1507 `upload-conflict-dialog-title`), `info-tooltips.js` (96 to 97, `<tooltipId>-title` and `<tooltipId>-content`).

No element has any of these ids. `dialog-focus.js` adds a label only when `aria-labelledby` is absent, so these dialogs have no accessible name. The axe test covers each tab but not these dialogs. Fix: give the headings the ids, or remove the attribute and let `dialog-focus.js` assign one.

#### L7. "Setup new PIN" and "Forgot PIN?" cannot be reached by keyboard

**Evidence:** Read. **Files:** `index.html` (236 to 237), `pin-screen.js` (141 to 150).

Both are `<span data-action="...">` with no `role`, no `tabindex`, and no key handler. A keyboard or screen-reader user can reach the PIN prompt but not the recovery path. The voice-note progress bar (`voice-notes.js` 1556) is a `div` with `data-action="seek-audio"` and no role or `tabindex` either. The goal-template cards are `div`s with `data-action`, but each contains a real button, so they work from the keyboard. Fix for the PIN links: use `<button type="button" class="pin-setup-link">`.

#### L8. A few shared values live on `window` instead of in `state.js`

**Evidence:** Read. **Files:** `goalstab.js` (`window.editingGoalId`, 559, 1330, 1362, 1589), `pin-overlay.js` (`window.tempNewPin`), `main.js` (`window.tabScrollCleanup`), `pwa.js` (`window.deferredPrompt`), `cloud-sync.js` and `settingstab.js` (`window.CloudSync`, `window.SettingsTab`).

`AGENTS.md` says shared mutable state sits behind getters and setters in `state.js`. `editingGoalId` is the risky one: `editGoal` sets it and relies on every way of closing the dialog to clear it, otherwise the next "Create goal" would update the old goal instead. Cancel and save both clear it today; a new way of closing the dialog could forget to.

#### L9. The OAuth request sends no `state` value

**Evidence:** Read. **File:** `cloud-sync.js` (327).

PKCE binds the code to the verifier held in `sessionStorage`, which already blocks the usual login-CSRF attack, so this is a hardening point only. Adding a random `state` that is checked on return is cheap and is what the Dropbox documentation recommends.

#### L10. Stale, misplaced and unused code and comments

**Evidence:** Read.

* `pin-core.js` has doc blocks attached to the wrong things: the doc for `removePinHash` sits above `verifyPinHash` (268 to 283), four doc blocks (116 to 198) describe functions defined further down, and several say "alternative version of X" for an X that no longer exists. `AGENTS.md` already warns that out-of-date comments have misled earlier sessions, and asks that JSDoc is moved or corrected rather than stripped.
* The `sw.js` file header describes a "Cache First" strategy; the code is network-first.
* `sw.js` has `sync` and `notificationclick` handlers, but nothing in the app registers a sync or shows a notification, so they never run. The `notificationclick` handler also compares against `'/'`, which would be wrong on a project-page URL.
* ESLint runs correctness rules only, by design. Turning on `no-unused-vars` (arguments and caught errors ignored) reports 68 unused variables or imports, mostly in `main.js` (16), `settingstab.js` (12) and `cloud-sync.js` (10).
* `manifest.json` has `"id": "/index.html"`. That resolves to the root of the host, so on a shared GitHub Pages domain it can collide with another app. A relative id such as `"./"` avoids that.

#### L11. Smaller robustness points

**Evidence:** Read.

* Duplicate detection in both imports is a nested scan (`find` plus `some` over the whole journal for every imported dream). It is fine for hundreds or a few thousand dreams and would freeze the page at tens of thousands. A `Map` keyed by id would remove it.
* `saveGoals(getAllGoals())` rewrites the whole goals store from one tab's memory. Two tabs open at once can overwrite each other's goal changes. The `withMutex` lock is per tab only.
* The goal icon field uses `maxlength="2"` and `icon.length > 2`, which count UTF-16 units. Many emoji (flags, skin-tone and joined sequences) are longer than 2 and are rejected.
* `parseInt` is called without a radix in `pin-core.js` (`getResetTime`) and `cloud-sync.js` (`isAuthenticated`). Values are always decimal, so this is style only.
* Voice notes are never encrypted, even when encryption is on. This is documented in the README (the data table and the limitations list), so it is a known limit and not a defect.
* There is no automatic lock after inactivity. This is documented in the README.

## Checked and found sound

* **Escaping of dream data.** Titles, content, emotions, tags, dream signs and voice-note transcripts are escaped with `escapeHtml` or `escapeAttr` everywhere they are rendered (`dream-crud.js`, `voice-notes.js`, `autocomplete-ui.js`, `statstab.js`). The edit form escapes values into attributes and the textarea body. IDs go through `escapeAttr`, and `CSS.escape` in selectors.
* **Dropbox dialogs.** Upload and download progress messages, which can carry Dropbox file names and server error text, are escaped before display. `createInlineMessage` uses `textContent`.
* **Cryptography.** AES-256-GCM, a 12-byte random IV per operation, a 16-byte random salt, PBKDF2-SHA256 at 600,000 iterations (a unit test enforces the OWASP minimum), non-extractable derived keys, and a constant-time hash comparison for the PIN. The shared-key cache is bounded to two passwords and has tests for concurrency, wrong passwords and re-keying.
* **Encryption on/off and password change.** `encryptAllData`, `decryptAllData` and `reEncryptAllData` write in one transaction, and the check value decides whether the journal is encrypted. The e2e suite injects failures and confirms nothing changes. (The gaps are in the other write paths, H1 and H2.)
* **Dropbox tokens.** Wrapped with either the journal password or a per-device non-extractable key before they reach `localStorage`.
* **Content-Security-Policy.** No inline scripts or handlers are allowed, and the app complies: `tests/csp.test.js` checks it, and the e2e helper fails any test that sees a CSP violation. An injected inline handler was blocked in the browser (M1).
* **PIN input.** 4 to 6 digits, enforced with a regular expression at both setup steps.
* **No dangerous APIs.** No `eval`, `new Function`, string-argument timers or `document.write`. No `console.log` outside `logger.js`. `Math.random` is not used for anything security-related (IDs use `crypto.getRandomValues`).
* **OAuth.** PKCE with S256, a verifier kept in `sessionStorage` and removed afterwards, de-duplicated token refresh and code exchange (with unit tests), and OAuth URLs are never put in the service-worker cache.
* **Listener growth.** I suspected the autocomplete set-up added a document click listener on every call. Counted in the browser, the number stayed flat across repeated tab switches (1, then 4, then 4, 4, 4), so no leak.
* **Repository hygiene.** A pattern search for keys, tokens and private keys found none (the Dropbox app key in `constants.js` is a public client id, which is normal for PKCE), `node_modules` and QA screenshots are ignored, the licence is present, the version is consistent across `version.js`, the README badge, the footer and `sw.js`, and a test enforces it.

## Test gaps

The existing suites are thorough on start-up, locking, encryption set-up and layout. None of them exercise the paths behind H1, H2, M1 and M3:

| Missing test | Would have caught |
| --- | --- |
| Enable encryption, then complete, reactivate and delete a goal, and read the raw store. | H1 |
| Enable encryption, then run the text import and the JSON import, and read the raw stores and the page messages. | H1, H2 |
| Call `loadDreams()` twice with encryption on and check the arrays are independent. | H2 |
| Import a file with hostile goal fields and check the goals tab for injected elements. | M1 |
| Import a file with a bad timestamp, a non-string tag and a non-object title. | M3 |
| Restore from Dropbox with an unreachable or failing write (fake the Dropbox SDK). | M2 |
| Wrong PIN in the wipe confirmation and in "cancel timer", repeated past the limit. | M4 |
| A service-worker install where one precache request fails. | M5 |
| Axe scan of open dialogs (goal dialog, conflict dialog, tooltips). | L6 |

Each of these can reuse `tests/e2e/helpers.js` (`importBackup`, `openTab`) and the raw-store readers already in `security.e2e.js`.

## Suggested order of work

1. **Encryption in the storage layer (H1, H2, M2).** One change fixes a whole family: make `saveDreams`, `saveGoals` and `saveToStore` encrypt on the way in, return copies from the decrypted cache, return a success value, and make the Dropbox restore a single checked transaction. Add the three e2e tests above first, so they fail before the fix and pass after.
2. **One normaliser for imported data (M1, M3, L4).** A shared `normaliseDream` and `normaliseGoal` used by the text import, the JSON import and the Dropbox restore, plus escaping in `createGoalElement`. Then narrow `script-src` to the exact SDK URL.
3. **One PIN check function (M4, L2).** Lockout, verify, count and clear in a single place, used by every path.
4. **Service-worker install (M5, L10).** A small change: let the failure propagate.
5. **Everything else (L1, L3, L5 to L11)** can go in any order. L5 fixes the failing browser test and is a good first small change.

## What this audit did not cover

* **Dropbox against the real service.** There were no credentials, so upload, download, refresh and the conflict dialogs were read and unit-tested only, not run end to end. M2 in particular is from reading.
* **Browsers other than Chromium.** The README already notes that Firefox and Safari are not covered by the automated tests; I did not add coverage.
* **Voice recording and speech recognition** beyond reading the rendering code. The e2e suite covers recording with a fake microphone and passes.
* **Real-device performance and memory.** The e2e perf test passes, but it runs on a fast machine with a small journal.
* **Every line.** About 35,000 lines were reviewed by targeted reading and pattern searches, so a defect in a rarely used branch of a large file (`statstab.js`, `settingstab.js`, `voice-notes.js`) could have been missed.
* **Hosting.** HTTP headers (`frame-ancestors`, HSTS and similar) depend on the host. GitHub Pages does not allow custom headers, and a `<meta>` CSP cannot set `frame-ancestors`, which the comment in `index.html` already notes.
* **Differences between this environment and CI.** The failing tooltip test may pass on CI if its fonts give a shorter tooltip (see L5).
