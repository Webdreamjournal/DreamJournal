import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as security from '../security.js';
import * as domHelpers from '../dom-helpers.js';

// These two modules are imported by name from many other files, including through dynamic
// import() calls that lint cannot check. Their public export lists are pinned here so that
// moving code between files cannot silently drop or rename an export.

const SECURITY_EXPORTS = [
    'cancelResetTimer',
    'clearDerivedKeys',
    'completePinRemoval',
    'completePinSetup',
    'completeRecovery',
    'computePinLockoutMs',
    'confirmCancelTimer',
    'confirmDataWipe',
    'confirmLockScreenTimer',
    'confirmNewPin',
    'confirmStartTimer',
    'decryptData',
    'decryptStoredData',
    'deriveKey',
    'encryptAllData',
    'encryptData',
    'encryptStoredData',
    'executePinRemoval',
    'generateIV',
    'generateSalt',
    'getAuthenticationRequirements',
    'getPinLockoutRemainingMs',
    'getResetTime',
    'hashPinSecure',
    'hidePinOverlay',
    'isPinSetup',
    'loadEncryptionSettings',
    'reEncryptAllData',
    'reconcileEncryptionFlag',
    'registerFailedPinAttempt',
    'removeEncryptionCheck',
    'removePinHash',
    'removeResetTime',
    'resetPinOverlay',
    'returnToLockScreen',
    'saveEncryptionCheck',
    'saveEncryptionSettings',
    'setupNewPin',
    'setupPin',
    'showAuthenticationScreen',
    'showDecryptionProgress',
    'showEncryptionProgress',
    'showForgotEncryptionPassword',
    'showForgotPin',
    'showLockScreenForgotPin',
    'showLockScreenMessage',
    'showPasswordDialog',
    'showPinOverlay',
    'showPinSetup',
    'showSetNewPinScreen',
    'showTimerRecovery',
    'startLockScreenTimerRecovery',
    'startLockScreenTitleRecovery',
    'startTimerRecovery',
    'startTitleRecovery',
    'storePinHash',
    'testEncryptionPassword',
    'timingSafeEqualHex',
    'toggleLock',
    'updateDecryptionProgress',
    'updateEncryptionProgress',
    'updateSecurityControls',
    'updateTimerWarning',
    'validateEncryptionPassword',
    'verifyDreamTitles',
    'verifyEncryptionPassword',
    'verifyLockScreenDreamTitles',
    'verifyLockScreenPin',
    'verifyPin',
    'verifyPinHash',
    'wipeAllData'
];

const DOM_HELPERS_EXPORTS = [
    'announceLiveMessage',
    'applyTheme',
    'closeExportFormatInfo',
    'closeInfoTooltip',
    'createActionButton',
    'createGoalElement',
    'createInlineMessage',
    'createMetaDisplay',
    'createPaginationHTML',
    'createPieChartColors',
    'createPieChartHTML',
    'displayTip',
    'escapeAttr',
    'escapeHtml',
    'formatDateKey',
    'formatDateTimeDisplay',
    'formatDisplayDate',
    'getCurrentPaginationPreference',
    'getCurrentTheme',
    'getGoalTypeLabel',
    'handleTipNavigation',
    'hideAllTabButtons',
    'hideSearchLoading',
    'initializeAutocomplete',
    'renderAutocompleteManagementList',
    'renderPinScreen',
    'setDateFilter',
    'setupLazySecureAutocomplete',
    'setupTagAutocomplete',
    'showAllTabButtons',
    'showDreamSignsHelp',
    'showEmotionsHelp',
    'showExportFormatInfo',
    'showInfoTooltip',
    'showSearchLoading',
    'showSmartSearchHelp',
    'showTagsHelp',
    'storePaginationPreference',
    'storeTheme',
    'switchAppTab',
    'switchTheme',
    'switchVoiceTab',
    'syncSettingsDisplay',
    'toggleAdviceSection',
    'toggleDreamForm',
    'toggleGoalsSection',
    'toggleJournalSection',
    'toggleSettingsSection',
    'updateBrowserCompatibilityDisplay'
];

test('security.js exports exactly the expected names', () => {
    assert.deepEqual(Object.keys(security).sort(), SECURITY_EXPORTS);
});

test('dom-helpers.js exports exactly the expected names', () => {
    assert.deepEqual(Object.keys(domHelpers).sort(), DOM_HELPERS_EXPORTS);
});

test('every export of security.js and dom-helpers.js is a function', () => {
    for (const [file, mod] of [['security.js', security], ['dom-helpers.js', domHelpers]]) {
        for (const [name, value] of Object.entries(mod)) assert.equal(typeof value, 'function', `${file}: ${name}`);
    }
});
