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

import { debugLog } from './logger.js';
import { CONSTANTS } from './constants.js';
import {
    getFailedPinAttempts,
    setFailedPinAttempts,
    getPreLockActiveTab,
    setUnlocked,
    isUnlocked,
    setAppLocked,
    isAppLocked,
    setPreLockActiveTab,
    activeAppTab
} from './state.js';
import {
    createInlineMessage,
    renderPinScreen,
    showAllTabButtons,
    switchAppTab,
    hideAllTabButtons
} from './dom-helpers.js';
import { isLocalStorageAvailable } from './storage.js';
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
    registerFailedPinAttempt,
    getPinLockoutRemainingMs,
    formatPinLockoutMessage,
    verifyPinHash,
    getStoredPinData,
    isPinSetup,
    removePinHash,
    getResetTime,
    removeResetTime,
    storePinHash,
    hashPinSecure,
    timingSafeEqualHex,
    computePinLockoutMs
} from './pin-core.js';
import {
    testEncryptionPassword,
    showDecryptionProgress,
    updateDecryptionProgress,
    showPasswordDialog,
    loadEncryptionSettings,
    saveEncryptionSettings,
    validateEncryptionPassword,
    showEncryptionProgress,
    updateEncryptionProgress,
    reEncryptAllData
} from './encryption-settings.js';
import { updateSecurityControls, showMessage, executePinRemoval, completePinRemoval } from './pin-controls.js';
import {
    returnToLockScreen,
    verifyLockScreenPin,
    showLockScreenForgotPin,
    showLockScreenMessage,
    showForgotEncryptionPassword,
    wipeAllData,
    confirmDataWipe
} from './lock-screen.js';
import {
    showTimerRecovery,
    startLockScreenTitleRecovery,
    verifyLockScreenDreamTitles,
    startTitleRecovery,
    verifyDreamTitles,
    startTimerRecovery,
    startLockScreenTimerRecovery,
    confirmLockScreenTimer,
    completeRecovery,
    updateTimerWarning,
    cancelResetTimer,
    confirmCancelTimer,
    confirmStartTimer
} from './pin-recovery.js';



/**
     * Verifies PIN entry from the main PIN overlay.
     * 
     * Handles PIN verification for the main application PIN overlay interface.
     * Gets PIN input from the overlay form, validates it against stored hash,
     * and processes authentication success or failure appropriately.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user submits PIN in main overlay
     * await verifyPin();
     * // Unlocks app or shows error message
     */
    async function verifyPin() {
        const enteredPin = document.getElementById('pinInput').value;
        const feedback = document.getElementById('pinFeedback');

        if (!enteredPin) {
            feedback.innerHTML = '<span style="color: var(--error-color);">Please enter your PIN</span>';
            return;
        }

        const lockoutMs = getPinLockoutRemainingMs();
        if (lockoutMs > 0) {
            feedback.textContent = formatPinLockoutMessage(lockoutMs);
            document.getElementById('pinInput').value = '';
            return;
        }

        try {
            const storedData = getStoredPinData();
            if (!storedData) {
                feedback.innerHTML = '<span style="color: var(--error-color);">No PIN found. Please set up a new PIN.</span>';
                return;
            }

            const isValid = await verifyPinHash(enteredPin, storedData);

            if (isValid) {
                setUnlocked(true);
                setFailedPinAttempts(0);
                hidePinOverlay();
                updateSecurityControls();

                // Load and display all application data after successful PIN authentication
                const { initializeApplicationData } = await import('./main.js');
                const { switchAppTab, showAllTabButtons } = await import('./dom-helpers.js');
                await initializeApplicationData(false);

                // Switch to the journal tab and show all tab buttons
                switchAppTab(getPreLockActiveTab() || 'journal');
                showAllTabButtons();

                setTimeout(() => {
                    const container = document.querySelector('.main-content');
                    createInlineMessage('success', 'Successfully unlocked! Welcome back to your dream journal.', {
                        container: container,
                        position: 'top',
                        duration: 3000
                    });
                }, 100);
            } else {
                registerFailedPinAttempt();
                feedback.innerHTML = '<span style="color: var(--error-color);">Incorrect PIN. Please try again.</span>';
                document.getElementById('pinInput').value = '';

                if (getFailedPinAttempts() >= CONSTANTS.FAILED_PIN_ATTEMPT_LIMIT) {
                    setTimeout(() => showForgotPin(), 100);
                }
            }
        } catch (error) {
            console.error('PIN verification error:', error);
            feedback.innerHTML = '<span style="color: var(--error-color);">PIN verification failed. Please try again.</span>';
            document.getElementById('pinInput').value = '';
        }
    }

// ================================
// 10. PIN OVERLAY MANAGEMENT
// ================================

/**
 * Shows the PIN overlay for authentication or setup procedures.
 * 
 * Displays the modal PIN overlay interface for various PIN operations.
 * Resets to default state, clears failed attempt counter, and handles proper
 * focus management. Skips display if application is already unlocked with PIN setup.
 * 
 * @since 1.0.0
 * @example
 * // Show PIN overlay for authentication
 * if (!isUnlocked) {
 *   showPinOverlay(); // Displays PIN entry interface
 * }
 * 
 * @example
 * // Show PIN overlay when trying to access secured feature
 * if (requiresAuthentication && !isUnlocked) {
 *   showPinOverlay();
 * }
 */
function showPinOverlay() {
        if (isUnlocked && isPinSetup()) return;
        
        setFailedPinAttempts(0);
        resetPinOverlay(); // Reset to default state
        document.getElementById('pinOverlay').style.display = 'flex';
        // Focus trapping, Escape and focus return are handled by dialog-focus.js

        setTimeout(() => {
            const pinInput = document.getElementById('pinInput');
            if (pinInput) pinInput.focus();
        }, CONSTANTS.FOCUS_DELAY_MS);
    }

/**
     * Hides the PIN overlay modal interface.
     * 
     * Conceals the PIN overlay and resets it to default state for next use.
     * Used when PIN operations are completed, cancelled, or when application
     * needs to return to normal operation.
     * 
     * @since 1.0.0
     * @example
     * // Hide overlay after successful authentication
     * if (pinVerified) {
     *   hidePinOverlay();
     *   showMainInterface();
     * }
     * 
     * @example
     * // Hide overlay on user cancellation
     * hidePinOverlay();
     * returnToPreviousState();
     */
    function hidePinOverlay() {
        const overlay = document.getElementById('pinOverlay');

        overlay.style.display = 'none';
        resetPinOverlay();
    }

/**
     * Displays the PIN setup interface within the overlay.
     * 
     * Shows the appropriate PIN setup screen based on current PIN status.
     * For new PIN setup, shows creation interface. For existing PIN, shows
     * current PIN verification before allowing changes. Handles proper UI
     * state and focus management.
     * 
     * @since 1.0.0
     * @example
     * // Show PIN setup for new user
     * showPinSetup(); // Shows "Create PIN" interface
     * 
     * @example
     * // Show PIN setup for existing user (change PIN)
     * showPinSetup(); // Shows "Enter current PIN" interface first
     */
    function showPinSetup() {
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        const isChangingPin = isPinSetup();

        renderPinScreen(pinContainer, {
            title: isChangingPin ? 'Change/Remove PIN' : 'Setup PIN',
            icon: '⚙️',
            message: isChangingPin ? 'Enter your current PIN to change it.' : 'Create a 4-6 digit PIN to lock your journal.',
            inputs: [
                { id: 'pinInput', type: 'password', placeholder: isChangingPin ? 'Current PIN' : 'New PIN (4-6 digits)', class: 'pin-input', maxLength: 6 }
            ],
            buttons: [
                { text: isChangingPin ? 'Verify Current PIN' : 'Continue', action: 'process-pin-setup', class: 'btn-primary' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
        document.getElementById('pinOverlay').style.display = 'flex';
    }

// ================================
// 11. PIN SETUP & CHANGE WORKFLOW
// ================================

/**
 * Processes PIN setup or change requests with comprehensive validation.
 * 
 * Main function for handling PIN setup and modification workflows. Validates PIN format
 * (4-6 digits), handles both new PIN creation and existing PIN changes. For new PINs,
 * proceeds to confirmation step. For existing PINs, verifies current PIN first.
 * 
 * @async
 * @since 1.0.0
 * @example
 * // Called when user submits PIN setup form
 * await setupPin();
 * // Validates input and proceeds to next step based on PIN status
 * 
 * @example
 * // PIN format validation
 * // Input: '12345' -> Proceeds to confirmation
 * // Input: '123' -> Shows error (too short)
 * // Input: 'abcd' -> Shows error (not digits)
 */
async function setupPin() {
        const enteredPin = document.getElementById('pinInput').value;
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        
        if (!enteredPin || enteredPin.length < CONSTANTS.PIN_MIN_LENGTH || enteredPin.length > CONSTANTS.PIN_MAX_LENGTH || !/^\d+$/.test(enteredPin)) {
            showMessage('error', `PIN must be ${CONSTANTS.PIN_MIN_LENGTH}-${CONSTANTS.PIN_MAX_LENGTH} digits.`);
            document.getElementById('pinInput').value = '';
            return;
        }
        
        if (isPinSetup()) {
            const storedData = getStoredPinData();
            const isValid = await verifyPinHash(enteredPin, storedData);
            if (!isValid) {
                showMessage('error', 'Current PIN is incorrect. Please try again.');
                document.getElementById('pinInput').value = '';
                return;
            }
            renderPinScreen(pinContainer, {
                title: 'Change or Remove PIN',
                icon: '⚙️',
                message: 'Your current PIN is correct. What would you like to do?',
                buttons: [
                    { text: 'Set New PIN', action: 'show-set-new-pin-screen', class: 'btn-primary' },
                    { text: 'Remove PIN', action: 'execute-pin-removal', class: 'btn-delete' },
                    { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
                ],
                feedbackContainer: false
            });
        } else {
            window.tempNewPin = enteredPin;
            renderPinScreen(pinContainer, {
                title: 'Confirm PIN',
                icon: '⚙️',
                message: 'Enter the same PIN again to confirm.',
                inputs: [ { id: 'pinInput', type: 'password', placeholder: 'Confirm PIN', class: 'pin-input', maxLength: 6 } ],
                buttons: [
                    { text: 'Setup PIN', action: 'confirm-new-pin', class: 'btn-primary' },
                    { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
                ],
                feedbackContainer: true
            });
        }
    }

/**
     * Displays the "Enter New PIN" screen during PIN change workflow.
     * 
     * Second step of PIN change process after current PIN verification.
     * Shows interface for entering a new PIN with validation requirements.
     * Part of the multi-step PIN change workflow.
     * 
     * @since 2.0.0
     * @example
     * // Called after successful current PIN verification
     * showSetNewPinScreen();
     * // Shows "Enter new PIN" interface
     */
    function showSetNewPinScreen() {
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'Enter New PIN',
            icon: '⚙️',
            message: 'Enter your new 4-6 digit PIN.',
            inputs: [ { id: 'pinInput', type: 'password', placeholder: 'New PIN (4-6 digits)', class: 'pin-input', maxLength: 6 } ],
            buttons: [
                { text: 'Continue', action: 'setup-new-pin', class: 'btn-primary' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }

/**
     * Processes new PIN entry during PIN change workflow.
     * 
     * Third step of PIN change process. Validates new PIN format and proceeds
     * to confirmation step. Temporarily stores new PIN for final confirmation.
     * Includes comprehensive format validation (length, digit-only).
     * 
     * @since 2.0.0
     * @example
     * // Called when user submits new PIN during change process
     * setupNewPin();
     * // Validates format and proceeds to confirmation if valid
     */
    function setupNewPin() {
        const enteredPin = document.getElementById('pinInput').value;
        if (!enteredPin || enteredPin.length < CONSTANTS.PIN_MIN_LENGTH || enteredPin.length > CONSTANTS.PIN_MAX_LENGTH || !/^\d+$/.test(enteredPin)) {
            showMessage('error', `PIN must be ${CONSTANTS.PIN_MIN_LENGTH}-${CONSTANTS.PIN_MAX_LENGTH} digits.`);
            document.getElementById('pinInput').value = '';
            return;
        }
        
        window.tempNewPin = enteredPin;
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'Confirm New PIN',
            icon: '⚙️',
            message: 'Enter the same PIN again to confirm.',
            inputs: [ { id: 'pinInput', type: 'password', placeholder: 'Confirm new PIN', class: 'pin-input', maxLength: 6 } ],
            buttons: [
                { text: 'Change PIN', action: 'confirm-new-pin', class: 'btn-primary' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }

/**
     * Displays the "Forgot PIN" recovery options interface.
     * 
     * Shows recovery options for users who have forgotten their PIN. Handles three scenarios:
     * 1. Active timer - shows remaining time or auto-unlocks if expired
     * 2. No timer - presents choice between dream title verification or timer start
     * 
     * Recovery methods:
     * - Dream title verification: User enters 3 dream titles for immediate unlock
     * - 72-hour timer: Automatically removes PIN after specified time period
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user clicks "Forgot PIN?" link
     * await showForgotPin();
     * // Displays appropriate recovery interface based on current state
     */
    async function showForgotPin() {
        const resetTime = getResetTime();
        if (resetTime) {
            const remainingTime = resetTime - Date.now();
            if (remainingTime > 0) {
                showTimerRecovery(remainingTime);
                return;
            } else {
                // Timer expired, allow reset
                removeResetTime();
                removePinHash();
                setUnlocked(true);
                setFailedPinAttempts(0);
                hidePinOverlay();
                updateSecurityControls();

                // Load and display all application data after timer expiration recovery
                const { initializeApplicationData } = await import('./main.js');
                await initializeApplicationData(true);
                
                setTimeout(() => {
                    const container = document.querySelector('.main-content');
                    createInlineMessage('info', 'PIN reset timer has expired. Your PIN has been removed. You can set a new one if desired.', {
                        container: container,
                        position: 'top',
                        duration: 8000
                    });
                }, 100);
                return;
            }
        }

        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'PIN Recovery',
            icon: '🔑',
            message: '<strong>Choose a recovery method:</strong><br><br>' +
                        '<strong>Option 1:</strong> Enter 3 of your dream titles exactly as written<br>' +
                        '<em style="font-size: 0.9em; color: var(--text-secondary);">(Note: "Untitled Dream" entries are not valid)</em><br><br>' +
                        '<strong>Option 2:</strong> Wait 72 hours for automatic reset<br>' +
                        '<em style="font-size: 0.9em; color: var(--text-secondary);">(Your dreams will remain safe)</em>',
            buttons: [
                { text: 'Verify Dream Titles', action: 'start-title-recovery', class: 'btn-primary' },
                { text: 'Start 72hr Timer', action: 'start-timer-recovery', class: 'btn-secondary', id: 'timerBtn' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }

/**
     * Final confirmation step for new PIN creation or change.
     * 
     * Validates that entered PIN matches the temporary PIN, then securely hashes
     * and stores the new PIN using PBKDF2. Shows success interface on completion
     * and handles cleanup of temporary data. This is the final step in both
     * PIN setup and PIN change workflows.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user confirms new PIN
     * await confirmNewPin();
     * // Stores PIN securely and shows success message
     */
    async function confirmNewPin() {
        const enteredPin = document.getElementById('pinInput').value;
        if (enteredPin !== window.tempNewPin) {
            setTimeout(() => {
                resetPinOverlay();
                showPinSetup();
                showMessage('error', 'PINs do not match. Please try again.');
            }, 1);
            return;
        }
        
        try {
            const success = await storePinHash(window.tempNewPin);
            if (success) {
                const pinContainer = document.querySelector('#pinOverlay .pin-container');
                renderPinScreen(pinContainer, {
                    title: 'PIN Setup Complete',
                    icon: '✅',
                    message: `PIN set. The journal will ask for it when it is locked or reopened. The PIN is a screen lock and does not encrypt your dreams; turn on encryption in Settings for that.${isLocalStorageAvailable() ? '' : ' Local storage is unavailable, so the PIN is kept in memory only and resets on refresh.'}`,
                    buttons: [
                        { text: 'Close', action: 'complete-pin-setup', class: 'btn-primary' }
                    ]
                });
                delete window.tempNewPin;
                setUnlocked(true);
            } else {
                showMessage('error', 'Error: Failed to save secure PIN. Please try again.');
            }
        } catch (error) {
            console.error('Error setting up secure PIN:', error);
            showMessage('error', 'Error: Failed to setup secure PIN. Please try again.');
        }
    }

/**
     * Completes PIN setup workflow and restores normal application state.
     * 
     * Final cleanup and state management after successful PIN setup or change.
     * Resets overlay, unlocks application, shows all UI elements, updates security
     * controls, and refreshes dream display. Ensures application returns to
     * fully functional state after PIN operations.
     * 
     * @async
     * @since 1.0.0
     * @example
     * // Called after successful PIN setup completion
     * await completePinSetup();
     * // Restores full application functionality with PIN protection active
     */
    async function completePinSetup() {
        resetPinOverlay();
        hidePinOverlay();
        setFailedPinAttempts(0);
        setUnlocked(true);
        setAppLocked(false);
        debugLog('PIN setup complete - ensuring tabs are visible');
        showAllTabButtons();
        updateSecurityControls();

        // Load and display all application data after PIN setup
        const { initializeApplicationData } = await import('./main.js');
        await initializeApplicationData(false);
    }

/**
     * Resets PIN overlay to default authentication state.
     * 
     * Restores the PIN overlay to its standard PIN entry interface with default
     * buttons and links. Clears failed attempt counter and configures appropriate
     * visibility for setup/removal options based on current PIN status.
     * 
     * @since 1.0.0
     * @example
     * // Reset overlay after completed operation
     * resetPinOverlay();
     * // Shows standard "Enter PIN" interface
     * 
     * @example
     * // Reset overlay before showing for authentication
     * resetPinOverlay();
     * showPinOverlay();
     */
    function resetPinOverlay() {
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        if (!pinContainer) return;
        
        setFailedPinAttempts(0);
        
        renderPinScreen(pinContainer, {
            title: 'Enter PIN',
            icon: '🔒',
            message: 'The journal is locked. Enter your PIN to open it.',
            inputs: [ { id: 'pinInput', type: 'password', placeholder: 'Enter PIN', class: 'pin-input', maxLength: 6 } ],
            buttons: [
                { text: 'Unlock', action: 'verify-pin', class: 'btn-primary', id: 'pinMainBtn' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary', id: 'cancelPinBtn' }
            ],
            links: [
                { text: 'Setup new PIN', action: 'show-pin-setup', id: 'pinSetupLink', style: isPinSetup() ? 'display:none' : '' },
                { text: 'Forgot PIN?', action: 'show-forgot-pin', id: 'forgotPinLink', style: 'display:none' }
            ],
            feedbackContainer: true
        });
    }

/**
     * Toggles the application lock state between locked and unlocked.
     * 
     * Main function for locking/unlocking the application. If no PIN is set up,
     * prompts user to create one first. If PIN exists, toggles between locked
     * (showing lock screen) and unlocked (normal operation) states. Manages
     * tab visibility and preserves user's active tab for restoration.
     * 
     * @async
     * @since 1.0.0
     * @example
     * // Lock application (if PIN is set up)
     * await toggleLock();
     * // Switches to lock screen and hides other tabs
     * 
     * @example
     * // Attempt lock without PIN setup
     * await toggleLock();
     * // Shows message and prompts PIN setup
     */
    async function toggleLock() {
        if (!isPinSetup()) {
            const container = document.querySelector('.main-content');
            if (container) {
                createInlineMessage('info', 'First, set up a PIN, then you can lock your journal.', {
                    container: container,
                    position: 'top',
                    duration: 4000
                });
            }
            showPinSetup();
            return;
        }
        
        if (isUnlocked && !isAppLocked) {
            setUnlocked(false);
            setAppLocked(true);
            setPreLockActiveTab(activeAppTab);
            debugLog('Locking app - hiding other tabs');
            hideAllTabButtons();
            switchAppTab('lock');
            updateSecurityControls();
        } else {
            showPinOverlay();
        }
    }

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

            updateDecryptionProgress('Finalizing application setup...');

            hidePinOverlay();
            switchAppTab(getPreLockActiveTab() || 'journal');
            showAllTabButtons();

            // Show success and transition to main app
            await showDecryptionProgress('success', 'Welcome back! Your encrypted data has been loaded successfully.');

            // Show additional success message in main app
            setTimeout(() => {
                const container = document.querySelector('.main-content');
                createInlineMessage('success', 'Dream journal unlocked and ready!', {
                    container: container,
                    position: 'top',
                    duration: 3000
                });
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

    
