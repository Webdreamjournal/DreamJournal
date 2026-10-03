/**
 * @fileoverview Security module for Dream Journal application cryptography and PIN management.
 * 
 * This module provides security functionality for the Dream Journal application,
 * including data encryption/decryption, PIN-based authentication, recovery systems, and
 * storage management. All cryptographic operations use the Web Crypto API
 * (AES-GCM for encryption, PBKDF2 with SHA-256 for key derivation).
 * 
 * Key Features:
 * - AES-GCM data encryption with password-based key derivation
 * - Secure PIN hashing with PBKDF2 and salt
 * - Backwards compatibility with legacy PIN formats
 * - Multi-factor recovery system (dream title verification + timer reset)
 * - Fallback storage system (IndexedDB → localStorage → memory)
 * - Complete PIN lifecycle management (setup, change, removal)
 * - Lock screen interface with PIN verification
 * - Password dialog system for import/export operations
 * 
 * This file only re-exports the security modules, so existing imports of './security.js'
 * (including dynamic import() calls) keep working: security-crypto.js, pin-core.js,
 * encryption-settings.js, pin-controls.js, lock-screen.js, pin-recovery.js, pin-overlay.js
 * and encryption-auth.js.
 * 
 * @module Security
 * @version 2.05.06
 * @author Dream Journal Development Team
 * @since 1.0.0
 * @requires constants
 * @requires storage
 * @requires dom-helpers
 * @example
 * // Encrypt data for export
 * const encrypted = await encryptData(JSON.stringify(data), password);
 * 
 * @example
 * // Setup PIN protection
 * const success = await storePinHash('123456');
 * if (success) {
 *   updateSecurityControls();
 * }
 */

// ================================
// ES MODULE IMPORTS
// ================================

import {
    generateSalt,
    generateIV,
    deriveKey,
    encryptData,
    decryptData,
    clearDerivedKeys,
    encryptStoredData,
    decryptStoredData
} from './security-crypto.js';
import {
    hashPinSecure,
    timingSafeEqualHex,
    computePinLockoutMs,
    registerFailedPinAttempt,
    getPinLockoutRemainingMs,
    verifyPinHash,
    isPinSetup,
    storePinHash,
    removePinHash,
    getResetTime,
    removeResetTime
} from './pin-core.js';
import {
    showPasswordDialog,
    loadEncryptionSettings,
    saveEncryptionSettings,
    validateEncryptionPassword,
    testEncryptionPassword,
    showEncryptionProgress,
    showDecryptionProgress,
    updateEncryptionProgress,
    reEncryptAllData,
    updateDecryptionProgress
} from './encryption-settings.js';
import { updateSecurityControls, executePinRemoval, completePinRemoval } from './pin-controls.js';
import {
    verifyLockScreenPin,
    showLockScreenForgotPin,
    showLockScreenMessage,
    returnToLockScreen,
    showForgotEncryptionPassword,
    wipeAllData,
    confirmDataWipe
} from './lock-screen.js';
import {
    startLockScreenTitleRecovery,
    verifyLockScreenDreamTitles,
    startTitleRecovery,
    verifyDreamTitles,
    showTimerRecovery,
    startTimerRecovery,
    startLockScreenTimerRecovery,
    confirmLockScreenTimer,
    completeRecovery,
    updateTimerWarning,
    cancelResetTimer,
    confirmCancelTimer,
    confirmStartTimer
} from './pin-recovery.js';
import {
    verifyPin,
    showPinOverlay,
    hidePinOverlay,
    showPinSetup,
    setupPin,
    showSetNewPinScreen,
    setupNewPin,
    showForgotPin,
    confirmNewPin,
    completePinSetup,
    resetPinOverlay,
    toggleLock
} from './pin-overlay.js';
import {
    getAuthenticationRequirements,
    showAuthenticationScreen,
    verifyEncryptionPassword
} from './encryption-auth.js';



// ================================
// ES MODULE EXPORTS
// ================================

export {
    // Cryptographic functions
    generateSalt,
    generateIV,
    deriveKey,
    encryptData,
    decryptData,
    encryptStoredData,
    decryptStoredData,
    clearDerivedKeys,
    
    // PIN management functions
    hashPinSecure,
    timingSafeEqualHex,
    computePinLockoutMs,
    registerFailedPinAttempt,
    getPinLockoutRemainingMs,
    isPinSetup,
    verifyPinHash,
    verifyPin,
    storePinHash,
    setupPin,
    setupNewPin,
    confirmNewPin,
    executePinRemoval,
    completePinRemoval,
    
    // UI functions
    showPasswordDialog,
    showPinSetup,
    showSetNewPinScreen,
    showForgotPin,
    showLockScreenForgotPin,
    updateSecurityControls,
    showPinOverlay,
    hidePinOverlay,
    resetPinOverlay,
    verifyLockScreenPin,
    returnToLockScreen,
    
    // Timer and recovery functions
    updateTimerWarning,
    cancelResetTimer,
    confirmCancelTimer,
    confirmStartTimer,
    confirmLockScreenTimer,
    startTitleRecovery,
    verifyDreamTitles,
    startTimerRecovery,
    showTimerRecovery,
    showLockScreenMessage,
    startLockScreenTimerRecovery,
    startLockScreenTitleRecovery,
    verifyLockScreenDreamTitles,
    completeRecovery,
    
    // Utility functions
    getResetTime,
    removeResetTime,
    removePinHash,

    // Encryption settings management
    loadEncryptionSettings,
    saveEncryptionSettings,
    validateEncryptionPassword,
    reEncryptAllData,

    // Authentication flow integration
    getAuthenticationRequirements,
    showAuthenticationScreen,
    verifyEncryptionPassword,
    testEncryptionPassword,

    // Encryption password recovery functions
    showForgotEncryptionPassword,
    wipeAllData,
    confirmDataWipe,

    // Progress dialog functions
    showEncryptionProgress,
    showDecryptionProgress,
    updateEncryptionProgress,
    updateDecryptionProgress,

    // Application control
    toggleLock,
    completePinSetup
};

    
