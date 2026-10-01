/**
 * @fileoverview Debug logging gate.
 *
 * Verbose diagnostics go through debugLog() and are silent by default. To enable them,
 * run `localStorage.setItem('dreamJournalDebug', 'true')` in the browser console and
 * reload; remove the key (or set it to anything else) and reload to turn them off.
 * console.warn / console.error are unaffected and always print.
 *
 * @module Logger
 */

const DEBUG_STORAGE_KEY = 'dreamJournalDebug';

const debugEnabled = (() => {
    try {
        return localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
    } catch (e) {
        return false; // Storage unavailable (e.g. private browsing)
    }
})();

/**
 * Logs to the console only when debug logging is enabled.
 *
 * @param {...*} args - Values to log
 */
function debugLog(...args) {
    if (debugEnabled) {
        console.log(...args);
    }
}

export { debugLog, debugEnabled, DEBUG_STORAGE_KEY };
