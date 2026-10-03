/**
 * @fileoverview Start-up authentication: which of PIN and encryption password is required, and verifying
 *   the encryption password on the lock screen.
 *
 * @module EncryptionAuth
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { getFailedPinAttempts } from './state.js';
import { createInlineMessage, switchAppTab, showAllTabButtons } from './dom-helpers.js';
import { isPinSetup, registerFailedPinAttempt, getPinLockoutRemainingMs, formatPinLockoutMessage } from './pin-core.js';
import { testEncryptionPassword, showDecryptionProgress, updateDecryptionProgress } from './encryption-settings.js';
import { showMessage } from './pin-controls.js';
import { returnToLockScreen } from './lock-screen.js';
import { hidePinOverlay } from './pin-overlay.js';

// ================================
// 13. AUTHENTICATION FLOW INTEGRATION
// ================================

/**
 * Determines what authentication is needed based on enabled features.
 *
 * Analyzes the current security configuration to determine which authentication
 * methods are required. Supports PIN-only, encryption-only, and dual authentication
 * modes, providing the foundation for smart authentication flow decisions.
 *
 * @async
 * @function
 * @returns {Promise<Object>} Authentication requirements object
 * @returns {boolean} returns.pinRequired - PIN authentication needed
 * @returns {boolean} returns.encryptionRequired - Encryption password needed
 * @returns {boolean} returns.bothEnabled - Both PIN and encryption are set up
 * @since 2.03.01
 * @example
 * const requirements = await getAuthenticationRequirements();
 * if (requirements.encryptionRequired) {
 *   showEncryptionPasswordScreen();
 * } else if (requirements.pinRequired) {
 *   showPinScreen();
 * }
 */
async function getAuthenticationRequirements() {
    const pinEnabled = isPinSetup();

    // Import encryption state
    const { getEncryptionEnabled } = await import('./state.js');
    const encryptionEnabled = getEncryptionEnabled();

    return {
        pinRequired: pinEnabled && !encryptionEnabled,  // PIN only if encryption is disabled
        encryptionRequired: encryptionEnabled           // Encryption takes priority over PIN
    };
}

/**
 * Shows the authentication screen.
 *
 * Authentication happens on the lock screen, which renders the encryption
 * password form when encryption is enabled and the PIN form otherwise (see
 * renderUnifiedAuthenticationScreen). This delegates to returnToLockScreen.
 *
 * @async
 * @function
 * @since 2.03.01
 * @example
 * // Called during app initialization when authentication is required
 * await showAuthenticationScreen();
 * // Shows the lock screen
 */
async function showAuthenticationScreen() {
    // All authentication now happens on the lock screen for consistency
    await returnToLockScreen();
}

/**
 * Verifies the entered encryption password and unlocks the app.
 *
 * Validates the encryption password by attempting to decrypt existing encrypted
 * data, then unlocks the application and loads all encrypted content. Handles
 * password verification failures and provides appropriate user feedback.
 *
 * @async
 * @function
 * @since 2.03.01
 * @example
 * // Called when user submits encryption password
 * await verifyEncryptionPassword();
 * // Tests password and unlocks app if correct
 */
async function verifyEncryptionPassword() {
    // Check for both popup (encryptionPassword) and lock screen (lockScreenPasswordInput) inputs
    const passwordInput = document.getElementById('lockScreenPasswordInput') || document.getElementById('encryptionPassword');
    const password = passwordInput?.value?.trim();

    if (!password) {
        // Show error in appropriate container
        const feedback = document.getElementById('lockScreenFeedback');
        if (feedback) {
            feedback.innerHTML = '<div class="message-base message-error">Please enter your password</div>';
        } else {
            showMessage('error', 'Please enter your password');
        }
        return;
    }

    const lockoutMs = getPinLockoutRemainingMs();
    if (lockoutMs > 0) {
        showMessage('error', formatPinLockoutMessage(lockoutMs));
        return;
    }

    // Disable unlock button to prevent multiple attempts
    setUnlockButtonState(false);

    try {
        // Show progress dialog for password verification
        showDecryptionProgress('decrypting');
        updateDecryptionProgress('Verifying encryption password...');

        // Test password by attempting to decrypt known encrypted data
        const testResult = await testEncryptionPassword(password);

        if (testResult.valid) {
            // Import state management functions
            const {
                setEncryptionPassword,
                setUnlocked,
                setAppLocked,
                getPreLockActiveTab
            } = await import('./state.js');

            // Import initialization function
            const { initializeApplicationData } = await import('./main.js');
            const { getUndecryptableItemCount } = await import('./storage.js');

            updateDecryptionProgress('Password verified! Loading encrypted data...');

            setEncryptionPassword(password);
            setUnlocked(true);
            setAppLocked(false);

            // Clear the password input field for security
            if (passwordInput) {
                passwordInput.value = '';
            }

            // Load and decrypt all data with progress updates
            await initializeApplicationData(false, (message) => {
                updateDecryptionProgress(message);
            });

            // The password was accepted, so items that did not decrypt are damaged, not wrongly keyed
            const undecryptable = getUndecryptableItemCount();

            updateDecryptionProgress('Finalizing application setup...');

            hidePinOverlay();
            switchAppTab(getPreLockActiveTab() || 'journal');
            showAllTabButtons();

            // Show success and transition to main app
            // The dialog closes by itself when everything loaded; if items were skipped it waits for OK so the note is read
            await showDecryptionProgress('success', undecryptable
                ? 'Welcome back! Your data has been loaded, except for some items that could not be decrypted.'
                : 'Welcome back! Your encrypted data has been loaded successfully.',
                undecryptable ? {} : { autoCloseMs: 1800 });

            // Show additional success message in main app
            setTimeout(() => {
                const container = document.querySelector('.main-content');
                createInlineMessage('success', 'Dream journal unlocked and ready!', {
                    container: container,
                    position: 'top',
                    duration: 3000
                });
                if (undecryptable) {
                    const noun = undecryptable === 1 ? 'stored item' : 'stored items';
                    createInlineMessage('warning', `${undecryptable} ${noun} could not be decrypted and ${undecryptable === 1 ? 'is' : 'are'} not shown. ${undecryptable === 1 ? 'It' : 'They'} may be damaged. Your password is correct and your other data is unaffected.`, {
                        container: container,
                        position: 'top',
                        duration: 20000
                    });
                }
            }, 100);

        } else {
            // Re-enable button for retry
            setUnlockButtonState(true);

            registerFailedPinAttempt();
            const attempts = getFailedPinAttempts();

            // Enhanced error feedback with attempt tracking
            const feedback = document.getElementById('lockScreenFeedback');
            let errorMessage = 'Incorrect password. Please try again.';

            if (attempts >= 3) {
                errorMessage = 'Multiple failed attempts. Please check your password or use "Forgot Password?" if needed.';
            } else if (attempts > 1) {
                errorMessage = `Incorrect password (attempt ${attempts}). Please try again.`;
            }

            if (feedback) {
                feedback.innerHTML = `<div class="message-base message-error">${errorMessage}</div>`;
            } else {
                showMessage('error', errorMessage);
            }

            // Hide progress dialog and restore input focus
            await showDecryptionProgress('error', 'Incorrect password. Please try again.');
            passwordInput.value = '';
            passwordInput.focus();
        }
    } catch (error) {
        console.error('Password verification error:', error);

        // Re-enable button on error
        setUnlockButtonState(true);

        // Show error in appropriate container
        const feedback = document.getElementById('lockScreenFeedback');
        if (feedback) {
            feedback.innerHTML = '<div class="message-base message-error">Error verifying password. Please try again.</div>';
        } else {
            showMessage('error', 'Error verifying password. Please try again.');
        }

        // Show error dialog and restore input focus
        await showDecryptionProgress('error', 'An error occurred during password verification. Please try again.');
        passwordInput.value = '';
        passwordInput.focus();
    }
}

/**
 * Manages the state of the unlock button during password verification.
 *
 * This helper function enables or disables the unlock button to prevent
 * multiple submission attempts during password verification and decryption
 * operations. It provides visual feedback to users about the operation state.
 *
 * **Affected Controls:**
 * - Unlock Journal button (data-action="verify-encryption-password")
 * - Updates button text to indicate operation status
 * - Disables/enables button interaction
 *
 * @function
 * @param {boolean} enabled - Whether the unlock button should be enabled (true) or disabled (false)
 * @returns {void}
 * @since 2.04.78
 *
 * @example
 * // Disable unlock button during processing
 * setUnlockButtonState(false);
 * // ... perform password verification and decryption ...
 * setUnlockButtonState(true); // Re-enable on error (success transitions to main app)
 */
function setUnlockButtonState(enabled) {
    // Find unlock button
    const unlockButton = document.querySelector('[data-action="verify-encryption-password"]');
    if (unlockButton) {
        unlockButton.disabled = !enabled;
        if (!enabled) {
            unlockButton.textContent = '🔓 Unlocking...';
        } else {
            unlockButton.textContent = '🔓 Unlock Journal';
        }

        // Add visual feedback for disabled state
        if (!enabled) {
            unlockButton.style.opacity = '0.6';
            unlockButton.style.cursor = 'not-allowed';
        } else {
            unlockButton.style.opacity = '';
            unlockButton.style.cursor = '';
        }
    }
}

// ================================
// ES MODULE EXPORTS
// ================================

export {
    getAuthenticationRequirements,
    showAuthenticationScreen,
    verifyEncryptionPassword
};
