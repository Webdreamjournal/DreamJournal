/**
 * @fileoverview Single source of truth for the application version.
 *
 * index.html (footer), sw.js (cache name) and README.md (badge) cannot import this
 * module, so tests/version.test.js verifies they match APP_VERSION.
 *
 * @module Version
 */

export const APP_VERSION = '2.05.06';
