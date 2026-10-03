# Dream Journal: notes for AI sessions

Client-side PWA for dream journaling. Vanilla JS (ES modules), HTML and CSS, no build step, no framework. Served as static files (GitHub Pages serves the repo as is). Almost all of the code was written by AI and has had little human review, so the automated checks below are the main safety net.

## Commands

```sh
npm install
npm run lint   # ESLint, correctness rules only (undefined identifiers, assignments to imports, ...)
npm test       # node:test suites in tests/*.test.js (no browser needed)
npm run test:e2e   # Playwright smoke tests in tests/e2e/ (needs Chromium; set CHROMIUM_PATH to use an installed one)
python3 -m http.server 8000   # run the app locally, then open http://localhost:8000
```

Run `npm run lint` and `npm test` before every commit, and `npm run test:e2e` after changes to startup, locking, import, or the dream, goal and voice flows. CI (`.github/workflows/test.yml`) runs all three.

## Layout

All modules are flat in the repo root (not in `src/`, which only holds the entry point).

| File | Role |
| --- | --- |
| `index.html` | Static shell: header, tab buttons, PIN overlay, footer. Tab panels are rendered by JS. |
| `src/app.js` | Entry point. Calls `initializeApp` from `main.js` on `DOMContentLoaded`. |
| `main.js` | Startup order, lock/unlock state, `initializeApplicationData`, global event listeners. |
| `action-router.js` | Event delegation. Elements carry `data-action="..."`; `ACTION_MAP` maps each name to a handler. |
| `state.js` | All shared mutable state, behind getters and setters. |
| `storage.js` | IndexedDB (database `DreamJournal`, stores `dreams`, `goals`, `voiceNotes`), localStorage fallbacks, ID generation, autocomplete data. |
| `security.js` | Re-exports the security modules below, so `import ... from './security.js'` keeps working. Its export list is pinned by `tests/module-exports.test.js`. |
| `security-crypto.js` | AES-GCM and PBKDF2 helpers, the per-password derived-key cache. |
| `pin-core.js` | PIN hashing, lockout and storage of the PIN hash and reset time. No UI. |
| `pin-controls.js`, `pin-overlay.js`, `pin-recovery.js`, `lock-screen.js` | PIN UI: Settings controls, the overlay and PIN setup, recovery by titles or timer, the lock screen and data wipe. |
| `encryption-settings.js`, `encryption-auth.js` | Encryption flag, password dialog, progress dialogs and `reEncryptAllData`; start-up authentication and encryption password check. |
| `dom-helpers.js` | Re-exports the UI modules below, so `import ... from './dom-helpers.js'` keeps working. Its export list is pinned by `tests/module-exports.test.js`. |
| `ui-basics.js` | Action buttons, inline messages and live-region announcements, escaping (`escapeHtml`, `escapeAttr`), pagination control. |
| `tab-navigation.js`, `collapsible-sections.js` | Tab switching and panels, tab button visibility; collapse state of the form and Settings, Goals, Advice and Journal sections. |
| `preferences.js`, `format-helpers.js` | Theme and pagination preferences; date and pie chart formatting. |
| `autocomplete-ui.js`, `info-tooltips.js`, `tips-and-goals-ui.js`, `pin-screen.js` | Autocomplete interface, help tooltips, tip display and goal elements, PIN screen rendering. |
| `dream-crud.js`, `goalstab.js`, `voice-notes.js` | Dreams, goals and voice notes: forms, lists, edit and delete. |
| `journaltab.js`, `statstab.js`, `advicetab.js`, `settingstab.js` | Tab rendering. |
| `import-export.js` | JSON and text import and export. Imported data is untrusted. |
| `cloud-sync.js` | Optional Dropbox sync (OAuth PKCE). Needs the Dropbox SDK loaded from the CDN in `index.html`. |
| `device-key.js` | Non-extractable per-device key (IndexedDB) used to wrap Dropbox tokens at rest. |
| `form-validation.js` | Real-time field validation. Initialised from `renderJournalTab`. |
| `dialog-focus.js` | Watches for `.pin-overlay` / `.security-dialog-overlay` elements and gives them modal behaviour (focus, Tab trap, Escape, inert background). New dialogs get it by using one of those classes. |
| `constants.js` | `CONSTANTS`, storage keys, tips loading. `tips.json` holds the tip text. |
| `logger.js`, `version.js` | `debugLog` (silent unless `localStorage.dreamJournalDebug === 'true'`); `APP_VERSION`. |
| `sw.js`, `pwa.js`, `manifest.json` | Service worker, install prompt, manifest. |
| `theme-init.js`, `unsupported-browser.js` | Small non-module scripts, external so the CSP can forbid inline scripts. |

## Rules that have caused bugs here

- **Imports are read-only.** Never assign to a variable imported from another module (`state.js` values such as `failedPinAttempts` or `memoryStorage`). Add and use a setter in `state.js`. The app was split from one large file, and leftover assignments like this threw at runtime.
- **Every identifier must be imported.** Functions that used to share one scope now need explicit imports. Circular imports exist and work because exports are only used at call time, not at module load. `npm run lint` reports anything unresolved.
- **Never put untrusted strings into HTML unescaped.** Dream text, tags, and especially IDs from imports or Dropbox come from files. Use `escapeHtml` for text and `escapeAttr` for attribute values, or set `textContent`. Use `CSS.escape` when an ID goes into a selector. Imported dream and goal IDs are validated or replaced by `sanitizeEntityIds` (`storage.js`).
- **No inline scripts or inline event handlers.** `index.html` has a Content-Security-Policy that forbids them (`tests/csp.test.js` checks this). Add a `data-action` and a handler in `ACTION_MAP` instead of `onclick`.
- **No `console.log`.** Use `debugLog` from `logger.js`. `console.warn` and `console.error` are fine.
- **Key derivation settings live in `CONSTANTS`** (`CRYPTO_PBKDF2_ITERATIONS`). The PIN lockout settings are there too. The PIN is a screen lock, not encryption. Stored data is protected only when the user enables encryption.
- **Stored items share one derived key.** One PBKDF2 derivation takes about 100 ms, so dreams, goals and autocomplete data go through `encryptStoredData` / `decryptStoredData` (`security-crypto.js`), which keep a derived key per password and salt in memory. Calling `encryptData` per item (a new salt each time) makes unlocking cost about 100 ms per dream; `encryptData` is for exported files and tokens. Call `clearDerivedKeys()` when the session password is cleared or replaced. `tests/security.test.js` counts derivations.
- **Changing the password goes through `reEncryptAllData`** (`encryption-settings.js`), which decrypts and re-encrypts everything in memory and then writes all stores in one transaction (`putItemsInStores`, `storage.js`). Do not save re-encrypted items one at a time: a failure part way leaves data under two passwords.
- **A password is verified with the encryption check value, not with a dream.** `encryption-settings.js` stores an encrypted known text in the `meta` store (`saveEncryptionCheck`); `testEncryptionPassword` decrypts it, so a damaged dream cannot make the right password fail. Enabling encryption saves it, `reEncryptAllData` re-keys it in the same transaction as the data, and disabling encryption removes it. A journal without one is tested against its first encrypted dream, and the value is then created.
- **Collapsible sections use a button inside a heading**, not `role="button"` on the heading: `<h3 class="collapsible-heading"><button class="collapse-toggle" data-action="...">`. Tab titles are `<h2 id="<tab>-main-heading">`, which receives focus after a tab switch from outside the tab bar. `tests/e2e/a11y.e2e.js` runs axe on every tab in both themes and expects no violations.
- **`form-validation.js` must run after the dream form exists.** It is called at the end of `renderJournalTab`, because the form is created by JS after startup.

## Versioning and the service worker

- The version is in `version.js`. The README badge, the `index.html` footer and `CACHE_NAME` in `sw.js` must match it (`tests/version.test.js` checks).
- `sw.js` is network-first with a cache fallback. New files that must work offline go in its `urlsToCache` list (`tests/version.test.js` checks that every listed file exists and that the newer modules are included).

## Comments

- Comments state what the code does, and why when that is not obvious. They do not promise anything: no "guaranteed", "robust", "industry-standard", "secure" as a selling point (`tests/comments.test.js` bans the common ones).
- Update or delete a comment when the code it describes changes. Out-of-date comments have misled previous sessions (for example a doc comment claiming unique IDs that the code did not guarantee).
- Existing JSDoc blocks are kept. Do not strip them in bulk.

## File conventions

- Some `.js` files use CRLF line endings and others use LF (`file *.js` shows which). Keep each file's existing endings. A tool that rewrites a whole file can silently convert every line and produce a huge diff, so check `git diff --stat` after editing.
- Mostly four-space indentation (`sw.js` uses two). Some files wrap most functions in an extra four-space indent; match the surrounding file.
