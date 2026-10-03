/**
 * @fileoverview PIN recovery by dream titles and by the 72-hour timer, on the lock screen and in the PIN
 *   overlay, plus the timer warning banner.
 *
 * @module PinRecovery
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { debugLog } from './logger.js';
import { CONSTANTS } from './constants.js';
import { setFailedPinAttempts, preLockActiveTab, setUnlocked, setAppLocked } from './state.js';
import { renderPinScreen, switchAppTab, showAllTabButtons, createInlineMessage } from './dom-helpers.js';
import { loadDreams } from './storage.js';
import { displayDreams } from './dream-crud.js';
import {
    removePinHash,
    removeResetTime,
    storeResetTime,
    getResetTime,
    verifyPinHash,
    getStoredPinData
} from './pin-core.js';
import { updateSecurityControls, showMessage } from './pin-controls.js';
import { showLockScreenMessage, returnToLockScreen } from './lock-screen.js';
import { hidePinOverlay, resetPinOverlay } from './pin-overlay.js';

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
// ES MODULE EXPORTS
// ================================

export {
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
};
