/**
 * @fileoverview The PIN overlay: opening and closing it, PIN entry, setting up and changing the PIN, and
 *   the lock toggle.
 *
 * @module PinOverlay
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
    registerFailedPinAttempt,
    getPinLockoutRemainingMs,
    formatPinLockoutMessage,
    verifyPinHash,
    getStoredPinData,
    isPinSetup,
    removePinHash,
    getResetTime,
    removeResetTime,
    storePinHash
} from './pin-core.js';
import { updateSecurityControls, showMessage } from './pin-controls.js';
import { showTimerRecovery } from './pin-recovery.js';

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
// ES MODULE EXPORTS
// ================================

export {
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
};
