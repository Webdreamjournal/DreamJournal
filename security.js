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
    preLockActiveTab,
    setAppLocked,
    isUnlocked,
    isAppLocked,
    setPreLockActiveTab,
    activeAppTab
} from './state.js';
import {
    createInlineMessage,
    renderPinScreen,
    switchAppTab,
    showAllTabButtons,
    hideAllTabButtons
} from './dom-helpers.js';
import { loadDreams, isLocalStorageAvailable } from './storage.js';
import { displayDreams } from './dream-crud.js';
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
    removePinHash,
    removeResetTime,
    storeResetTime,
    getResetTime,
    isPinSetup,
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
    showLockScreenMessage,
    returnToLockScreen,
    verifyLockScreenPin,
    showLockScreenForgotPin,
    showForgotEncryptionPassword,
    wipeAllData,
    confirmDataWipe
} from './lock-screen.js';



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

/**
     * Initiates dream title recovery specifically on the lock screen.
     * 
     * Sets up the dream title verification interface within the lock screen tab.
     * Similar to startTitleRecovery() but designed for inline lock screen display
     * rather than overlay modal presentation.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user selects title recovery from lock screen
     * await startLockScreenTitleRecovery();
     * // Shows title input form within lock screen tab
     */
    async function startLockScreenTitleRecovery() {
        const lockCard = document.querySelector('#lockTab > div > div');
        renderPinScreen(lockCard, {
            title: 'Verify Dream Titles',
            icon: '📝',
            message: 'Enter exactly 3 of your dream titles as they appear in your journal.<br><em class="text-sm">Must match exactly, including capitalization</em>',
            inputs: [
                { id: 'recovery1', type: 'text', placeholder: 'Dream title 1', class: 'form-control' },
                { id: 'recovery2', type: 'text', placeholder: 'Dream title 2', class: 'form-control' },
                { id: 'recovery3', type: 'text', placeholder: 'Dream title 3', class: 'form-control' }
            ],
            buttons: [
                { text: 'Verify Titles', action: 'verify-lock-screen-dream-titles', class: 'btn-primary' },
                { text: '← Back', action: 'show-lock-screen-forgot-pin', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }
    
/**
     * Verifies dream titles entered on the lock screen recovery interface.
     * 
     * Validates entered dream titles specifically within the lock screen context.
     * On successful verification, removes PIN protection and transitions to unlocked
     * state. Handles error display and form management within lock screen interface.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user submits titles on lock screen recovery
     * await verifyLockScreenDreamTitles();
     * // Verifies titles and unlocks if valid, shows error if not
     */
    async function verifyLockScreenDreamTitles() {
        const title1 = document.getElementById('recovery1')?.value.trim();
        const title2 = document.getElementById('recovery2')?.value.trim();
        const title3 = document.getElementById('recovery3')?.value.trim();
        
        if (!title1 || !title2 || !title3) {
            showLockScreenMessage('error', 'Please enter all 3 dream titles');
            return;
        }
        
        const dreams = await loadDreams();
        const dreamTitles = dreams.filter(d => d.title !== 'Untitled Dream').map(d => d.title);
        
        const titles = [title1, title2, title3];
        const uniqueTitles = [...new Set(titles)];
        
        if (uniqueTitles.length !== 3) {
            showLockScreenMessage('error', 'Please enter 3 DIFFERENT dream titles. Each title must be unique.');
            return;
        }
        
        if (titles.every(t => dreamTitles.includes(t))) {
            removePinHash();
            removeResetTime();
            showLockScreenMessage('success', 'Recovery successful! Your PIN has been removed. Unlocking journal...');
            setUnlocked(true);
            setAppLocked(false);
            setFailedPinAttempts(0);
            updateTimerWarning();
            
            setTimeout(async () => {
                showAllTabButtons();
                const targetTab = (preLockActiveTab === 'lock') ? 'journal' : preLockActiveTab;
                switchAppTab(targetTab);
                updateSecurityControls();

                // Load and display the data, as after a successful PIN entry
                const { initializeApplicationData } = await import('./main.js');
                await initializeApplicationData(false);
            }, 2000);
        } else {
            showLockScreenMessage('error', 'One or more titles did not match. Please try again.');
            document.getElementById('recovery1').value = '';
            document.getElementById('recovery2').value = '';
            document.getElementById('recovery3').value = '';
            document.getElementById('recovery1').focus();
        }
    }

/**
     * Initiates the dream title recovery process for PIN reset.
     * 
     * Loads user's dreams and filters for those with custom titles (excluding "Untitled Dream").
     * If sufficient dreams exist (minimum 3), displays the title verification interface.
     * If insufficient dreams, redirects to timer-based recovery.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user selects "Verify Dream Titles" option
     * await startTitleRecovery();
     * // Shows form with 3 title input fields or error message
     */
    async function startTitleRecovery() {
        const dreams = await loadDreams();
        const validDreams = dreams.filter(d => d.title !== 'Untitled Dream');
        const pinContainer = document.querySelector('#pinOverlay .pin-container');

        if (validDreams.length < 3) {
            renderPinScreen(pinContainer, {
                title: 'PIN Recovery',
                icon: '🔑',
                message: '<span style="color: var(--error-color);">You need at least 3 dreams with custom titles to use this recovery method.</span><br><br>Please use the 72-hour timer option instead.',
                buttons: [
                    { text: 'Start 72hr Timer', action: 'start-timer-recovery', class: 'btn-secondary', id: 'timerBtn' },
                    { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
                ],
                feedbackContainer: false
            });
            return;
        }

        renderPinScreen(pinContainer, {
            title: 'Verify Your Dreams',
            icon: '🔑',
            message: 'Enter exactly 3 of your dream titles:<br><em class="text-sm text-secondary">Must match exactly, including capitalisation</em>',
            inputs: [
                { id: 'recovery1', type: 'text', placeholder: 'Dream title 1', class: 'form-control' },
                { id: 'recovery2', type: 'text', placeholder: 'Dream title 2', class: 'form-control' },
                { id: 'recovery3', type: 'text', placeholder: 'Dream title 3', class: 'form-control' }
            ],
            buttons: [
                { text: 'Verify Titles', action: 'verify-dream-titles', class: 'btn-primary' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }

/**
     * Verifies entered dream titles against stored dreams for PIN recovery.
     * 
     * Validates that the user has entered exactly 3 different dream titles that match
     * existing dreams in their journal. If verification succeeds, removes PIN protection
     * and completes the recovery process. Titles must match exactly (case-sensitive).
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user submits dream title verification form
     * await verifyDreamTitles();
     * // Removes PIN if titles match, shows error if they don't
     */
    async function verifyDreamTitles() {
        const title1 = document.getElementById('recovery1').value.trim();
        const title2 = document.getElementById('recovery2').value.trim();
        const title3 = document.getElementById('recovery3').value.trim();
        const feedback = document.getElementById('pinFeedback');
        
        if (!title1 || !title2 || !title3) {
            feedback.innerHTML = '<span style="color: var(--error-color);">Please enter all 3 dream titles</span>';
            return;
        }
        
        const dreams = await loadDreams();
        const validDreams = dreams.filter(d => d.title !== 'Untitled Dream');
        const dreamTitles = validDreams.map(d => d.title);
        
        const titles = [title1, title2, title3];
        const uniqueTitles = [...new Set(titles)];
        
        if (uniqueTitles.length !== 3) {
            feedback.innerHTML = '<span style="color: var(--error-color);">Please enter 3 DIFFERENT dream titles. Each title must be unique.</span>';
            return;
        }
        
        const allValid = titles.every(t => dreamTitles.includes(t));
        
        if (allValid) {
            removePinHash();
            removeResetTime();
            
            const pinContainer = document.querySelector('#pinOverlay .pin-container');
            renderPinScreen(pinContainer, {
                title: 'Recovery Successful',
                icon: '✅',
                message: '<span style="color: var(--success-color);">Your PIN has been removed. You can now set a new secure PIN.</span><br><br>Click below to continue.',
                buttons: [
                    { text: 'Continue', action: 'complete-recovery', class: 'btn-primary' }
                ]
            });
            
            setUnlocked(true);
            setFailedPinAttempts(0);
            updateTimerWarning();
        } else {
            feedback.innerHTML = '<span style="color: var(--error-color);">One or more titles did not match. Please try again with exact titles from your dreams.</span>';
        }
    }

/**
     * Shows the running PIN reset timer on the PIN overlay.
     *
     * Displayed when the user starts the 72-hour timer, or opens "Forgot PIN?" while a
     * timer is already counting down. Offers cancelling the timer or closing the overlay.
     *
     * @param {number} remainingMs - Milliseconds left on the reset timer
     * @since 2.05.06
     */
    function showTimerRecovery(remainingMs) {
        const totalHours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
        const days = Math.floor(totalHours / 24);
        const hours = totalHours % 24;
        const remaining = days > 0 ? `${days} day(s) ${hours} hour(s)` : `${hours} hour(s)`;
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'PIN Reset Timer Active',
            icon: '⏳',
            message: `Your PIN will be removed automatically in about <strong>${remaining}</strong>.<br><br>` +
                '<span style="color: var(--text-secondary);">Your dreams will remain safe and will not be deleted. ' +
                'You can cancel the timer at any time.</span>',
            buttons: [
                { text: 'Cancel Timer', action: 'cancel-timer', class: 'btn-secondary' },
                { text: 'Close', action: 'hide-pin-overlay', class: 'btn-primary' }
            ]
        });
    }

/**
     * Initiates the timer-based PIN recovery process.
     * 
     * Displays a confirmation dialog explaining the 72-hour timer recovery method.
     * Shows warning that PIN will be automatically removed after the timer expires,
     * with assurance that dreams will remain safe during the process.
     * 
     * @since 2.0.0
     * @example
     * // Called when user selects "Start 72hr Timer" option
     * startTimerRecovery();
     * // Shows confirmation dialog with timer warning
     */
    function startTimerRecovery() {
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'Confirm Timer Reset',
            icon: '⏳',
            message: '<span style="color: var(--error-color); font-weight: 600;">⚠️ Warning</span><br><br>' +
                        'This will start a 72-hour countdown. After 72 hours, your PIN will be automatically removed.<br><br>' +
                        '<span style="color: var(--text-secondary);">Your dreams will remain safe and will not be deleted.</span><br><br>' +
                        'Do you want to continue?',
            buttons: [
                { text: 'Yes, Start Timer', action: 'confirm-start-timer', class: 'btn-primary' },
                { text: 'No, Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ]
        });
    }
    
/**
     * Initiates timer-based recovery specifically on the lock screen.
     * 
     * Shows timer recovery confirmation interface within the lock screen tab.
     * Similar to startTimerRecovery() but designed for inline lock screen display
     * rather than overlay modal presentation.
     * 
     * @since 2.0.0
     * @example
     * // Called when user selects timer recovery from lock screen
     * startLockScreenTimerRecovery();
     * // Shows timer confirmation within lock screen tab
     */
    function startLockScreenTimerRecovery() {
        const lockCard = document.querySelector('#lockTab > div > div');
        renderPinScreen(lockCard, {
            title: '72-Hour Timer Reset',
            icon: '⏰',
            message: `
                <div class="message-base message-warning mb-lg text-left">
                    <h4 class="mb-sm">⚠️ Important Warning</h4>
                    <p class="mb-sm line-height-relaxed">This will start a 72-hour countdown. After the timer expires, your PIN will be automatically removed.</p>
                    <p class="font-semibold" style="margin: 0;">Your dreams will remain safe and will not be deleted.</p>
                </div>
                <p class="text-secondary mb-lg line-height-relaxed">Do you want to start the 72-hour recovery timer?</p>`,
            buttons: [
                { text: 'Start Timer', action: 'confirm-lock-screen-timer', class: 'btn-primary' },
                { text: '← Cancel', action: 'show-lock-screen-forgot-pin', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }
    
/**
     * Confirms and activates the PIN reset timer from the lock screen.
     * 
     * Starts the PIN reset timer and shows confirmation within the lock screen interface.
     * Updates timer warning banner and returns to main lock screen after showing
     * success message. Provides user feedback about timer activation.
     * 
     * @since 2.0.0
     * @example
     * // Called when user confirms timer start from lock screen
     * confirmLockScreenTimer();
     * // Starts timer and shows success message on lock screen
     */
    function confirmLockScreenTimer() {
        const resetTime = Date.now() + (CONSTANTS.PIN_RESET_HOURS * 60 * 60 * 1000);
        storeResetTime(resetTime);
        updateTimerWarning();
        showLockScreenMessage('success', '72-hour recovery timer started! You can check back later or use dream title recovery.');
        setTimeout(returnToLockScreen, 3000);
    }

/**
     * Completes the PIN recovery process and restores application access.
     * 
     * Resets PIN overlay, unlocks application, shows all tab buttons, updates UI controls,
     * displays dreams, and shows success message. This is the final step after successful
     * PIN recovery via either dream title verification or timer expiration.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called after successful dream title verification
     * if (titlesMatchStored) {
     *   removePinHash();
     *   await completeRecovery(); // Unlocks app and shows success message
     * }
     */
    async function completeRecovery() {
        resetPinOverlay();
        hidePinOverlay();
        
        setUnlocked(true);
        setAppLocked(false);
        
        debugLog('PIN overlay recovery complete - showing all tabs');
        
        showAllTabButtons();
        
        updateSecurityControls();
        updateTimerWarning();
        await displayDreams();
        
        const container = document.querySelector('.main-content');
        if (container) {
            createInlineMessage('success', 'Recovery complete! You can now set a new PIN from the security controls if desired.', {
                container: container,
                position: 'top',
                duration: 5000
            });
        }
    }

/**
 * Updates the PIN reset timer warning banner display and calculates remaining time.
 * 
 * Manages the visibility and content of the timer warning banner that appears when
 * a PIN reset timer is active. Calculates remaining time and formats display text
 * appropriately (days vs hours vs less than 1 hour). Hides banner when no timer
 * is active or when timer has expired.
 * 
 * @todo Split into calculateRemainingTime() and updateTimerDisplay() functions for better separation of concerns
 * @since 2.0.0
 * @example
 * // Update timer display after starting/cancelling timer
 * storeResetTime(Date.now() + 72 * 60 * 60 * 1000);
 * updateTimerWarning(); // Shows "3 days remaining" banner
 * 
 * @example
 * // Hide timer warning after cancellation
 * removeResetTime();
 * updateTimerWarning(); // Hides warning banner
 */
function updateTimerWarning() {
    const warningBanner = document.getElementById('timerWarning');
    const warningTime = document.getElementById('timerWarningTime');
    
    if (!warningBanner || !warningTime) return;
    
    const resetTime = getResetTime();
    if (resetTime) {
        const remainingMs = resetTime - Date.now();
        if (remainingMs > 0) {
            const hours = Math.ceil(remainingMs / (1000 * 60 * 60));
            const days = Math.ceil(hours / 24);
            
            let timeDisplay = '';
            if (days > 1) {
                timeDisplay = `${days} days remaining`;
            } else if (hours > 1) {
                timeDisplay = `${hours} hours remaining`;
            } else {
                timeDisplay = 'Less than 1 hour remaining';
            }
            
            warningTime.textContent = `(${timeDisplay})`;
            warningBanner.classList.add('active');
        } else {
            warningBanner.classList.remove('active');
        }
    } else {
        warningBanner.classList.remove('active');
    }
}

/**
 * Displays PIN cancellation interface for active timer reset.
 * 
 * Shows a PIN entry form to allow users to cancel an active PIN reset timer by
 * entering their current PIN. This provides a way to stop the automatic
 * PIN removal if the user remembers their PIN before the timer expires.
 * 
 * @since 2.0.0
 * @example
 * // Called when user clicks "Cancel Timer" button
 * cancelResetTimer();
 * // Shows PIN entry form for timer cancellation
 */
function cancelResetTimer() {
        const pinOverlay = document.getElementById('pinOverlay');
        const pinContainer = pinOverlay.querySelector('.pin-container');
        
        renderPinScreen(pinContainer, {
            title: 'Cancel PIN Reset',
            icon: '⚠️',
            message: 'To cancel the pending PIN reset, please enter your current PIN.',
            inputs: [
                { id: 'pinInput', type: 'password', placeholder: 'Enter current PIN', class: 'pin-input', maxLength: 6 }
            ],
            buttons: [
                { text: 'Confirm Cancellation', action: 'confirm-cancel-timer', class: 'btn-primary' },
                { text: 'Back', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
        
        pinOverlay.style.display = 'flex';
    }

/**
     * Executes timer cancellation after PIN verification.
     * 
     * Verifies the entered PIN against stored data and cancels the active reset timer
     * if verification succeeds. Shows success message and hides timer warning banner.
     * If PIN is incorrect, timer remains active.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user submits PIN for timer cancellation
     * await confirmCancelTimer();
     * // Cancels timer if PIN is correct, shows error if not
     */
    async function confirmCancelTimer() {
        const enteredPin = document.getElementById('pinInput').value;
        if (!enteredPin) {
            showMessage('error', 'Please enter your PIN.');
            return;
        }

        const storedData = getStoredPinData();
        const isValid = await verifyPinHash(enteredPin, storedData);

        if (isValid) {
            removeResetTime();
            updateTimerWarning();
            hidePinOverlay();

            // Show a success message in the main content area
            const container = document.querySelector('.main-content');
            if (container) {
                createInlineMessage('success', 'PIN reset timer has been successfully cancelled.', {
                    container: document.querySelector('.container'),
                    position: 'top',
                    duration: 5000
                });
            }
        } else {
            showMessage('error', 'Incorrect PIN. The reset timer remains active.');
        }
    }

/**
     * Confirms and activates the PIN reset timer.
     * 
     * Calculates the expiration time based on configured hours (typically 72),
     * stores the reset time, and displays the active timer interface. Also activates
     * the warning banner to remind user of pending reset.
     * 
     * @since 2.0.0
     * @example
     * // Called when user confirms timer start
     * confirmStartTimer();
     * // Starts 72-hour countdown and shows timer interface
     */
    function confirmStartTimer() {
        const resetTime = Date.now() + (CONSTANTS.PIN_RESET_HOURS * 60 * 60 * 1000); // hours from now
        storeResetTime(resetTime);
        showTimerRecovery(CONSTANTS.PIN_RESET_HOURS * 60 * 60 * 1000);
        updateTimerWarning(); // Show warning banner
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

    
