/**
 * @fileoverview The lock screen: PIN entry, the PIN and encryption password forms, Forgot PIN, and
 *   wiping all data.
 *
 * @module LockScreen
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { debugLog } from './logger.js';
import { CONSTANTS } from './constants.js';
import { getFailedPinAttempts, setFailedPinAttempts, preLockActiveTab, setUnlocked, setAppLocked } from './state.js';
import { switchAppTab, showAllTabButtons, renderPinScreen } from './dom-helpers.js';
import { loadDreams } from './storage.js';
import { clearDerivedKeys } from './security-crypto.js';
import {
    registerFailedPinAttempt,
    getPinLockoutRemainingMs,
    formatPinLockoutMessage,
    verifyPinHash,
    getStoredPinData,
    removePinHash,
    getResetTime,
    removeResetTime,
    isPinSetup
} from './pin-core.js';
import { updateSecurityControls } from './pin-controls.js';
import { getAuthenticationRequirements } from './encryption-auth.js';

// ================================
// TYPE DEFINITIONS
// ================================

/**
 * Configuration object for PIN screen rendering.
 * 
 * @typedef {Object} PinScreenConfig
 * @property {string} title - Screen title
 * @property {string} icon - Emoji or icon character
 * @property {string} message - HTML message content
 * @property {Array<Object>} [inputs] - Input field configurations
 * @property {Array<Object>} [buttons] - Button configurations
 * @property {Array<Object>} [links] - Link configurations
 * @property {boolean} [feedbackContainer=false] - Whether to include feedback container
 * @since 2.0.0
 */

// ================================
// 9. LOCK SCREEN INTERFACE SYSTEM
// ================================

/**
 * Verifies PIN entered on the lock screen tab interface.
 * 
 * Handles PIN verification specifically for the lock screen tab, managing the unlock
 * transition and failed attempt tracking. On successful verification, unlocks the
 * application and restores the previously active tab. Manages UI feedback and
 * automatic form clearing.
 * 
 * @async
 * @since 2.0.0
 * @example
 * // Called when user clicks "Unlock Journal" on lock screen
 * await verifyLockScreenPin();
 * // Verifies PIN and transitions to unlocked state if correct
 */
async function verifyLockScreenPin() {
        const pinInput = document.getElementById('lockScreenPinInput');
        if (!pinInput) return;
        
        const enteredPin = pinInput.value;
        if (!enteredPin) {
            showLockScreenMessage('error', 'Please enter a PIN');
            return;
        }

        const lockoutMs = getPinLockoutRemainingMs();
        if (lockoutMs > 0) {
            pinInput.value = '';
            showLockScreenMessage('error', formatPinLockoutMessage(lockoutMs));
            return;
        }
        
        try {
            const storedData = getStoredPinData();
            const isValid = await verifyPinHash(enteredPin, storedData);
            
            if (isValid) {
                showLockScreenMessage('success', 'PIN verified! Unlocking journal...');
                
                setFailedPinAttempts(0);
                setUnlocked(true);
                setAppLocked(false);
                
                debugLog('Lock screen unlock successful - showing all tabs');
                
                pinInput.value = '';
                
                setTimeout(async () => {
                    showAllTabButtons();
                    const targetTab = (preLockActiveTab === 'lock') ? 'journal' : preLockActiveTab;
                    switchAppTab(targetTab);
                    updateSecurityControls();

                    // Load and display all application data after successful lock screen PIN authentication
                    const { initializeApplicationData } = await import('./main.js');
                    await initializeApplicationData(false);
                }, 200);
                
            } else {
                registerFailedPinAttempt();
                pinInput.value = '';
                if (getFailedPinAttempts() >= CONSTANTS.FAILED_PIN_ATTEMPT_LIMIT) {
                    showLockScreenMessage('error', 'Incorrect PIN. Use "Forgot PIN?" if needed.');
                } else {
                    showLockScreenMessage('error', 'Incorrect PIN. Please try again.');
                }
            }
        } catch (error) {
            console.error('Lock screen PIN verification error:', error);
            showLockScreenMessage('error', 'PIN verification failed. Please try again.');
            pinInput.value = '';
        }
    }
    
/**
     * Displays "Forgot PIN" recovery options on the lock screen.
     * 
     * Shows recovery options specifically within the lock screen tab interface.
     * Handles active timer detection, dream title verification setup, and timer-based
     * recovery initiation. Provides inline recovery interface without overlay modals.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called when user clicks "Forgot PIN?" on lock screen
     * await showLockScreenForgotPin();
     * // Shows recovery options inline within lock screen tab
     */
    async function showLockScreenForgotPin() {
        const resetTime = getResetTime();
        if (resetTime) {
            const remainingTime = resetTime - Date.now();
            if (remainingTime > 0) {
                const hours = Math.ceil(remainingTime / (1000 * 60 * 60));
                const days = Math.ceil(hours / 24);
                let timeDisplay = days > 1 ? `${days} days` : hours > 1 ? `${hours} hours` : 'Less than 1 hour';
                showLockScreenMessage('info', `Recovery timer active. Time remaining: ${timeDisplay}. Press "Forgot PIN?" again when timer expires to unlock.`);
            } else {
                removeResetTime();
                removePinHash();
                setUnlocked(true);
                setAppLocked(false);
                showAllTabButtons();
                switchAppTab(preLockActiveTab === 'lock' ? 'journal' : preLockActiveTab);
                updateSecurityControls();
                // Load and display the data, as after a successful PIN entry
                const { initializeApplicationData } = await import('./main.js');
                await initializeApplicationData(false);
            }
            return;
        }
        
        const dreams = await loadDreams();
        const validDreams = dreams.filter(d => d.title !== 'Untitled Dream');
        const lockCard = document.querySelector('#lockTab > div > div');

        if (lockCard) {
            renderPinScreen(lockCard, {
                title: 'PIN Recovery',
                icon: '🔑',
                message: `
                    <strong>Choose a recovery method to regain access:</strong>
                    <div class="card-sm mb-md text-left mt-lg">
                        <h4 class="text-primary mb-sm">📝 Dream Title Verification</h4>
                        <p class="text-secondary text-sm mb-sm">Enter 3 of your dream titles exactly as written (case-sensitive)</p>
                        <button data-action="start-lock-screen-title-recovery" class="btn btn-primary btn-small" ${validDreams.length < 3 ? 'disabled' : ''}>Verify Dream Titles</button>
                        ${validDreams.length < 3 ? `<p class="text-xs text-warning mt-sm">You need at least 3 dreams with custom titles to use this method. You have ${validDreams.length}.</p>` : ''}
                    </div>
                    <div class="card-sm mb-lg text-left">
                        <h4 class="text-warning mb-sm">⏰ 72-Hour Timer Reset</h4>
                        <p class="text-secondary text-sm mb-sm">Start a timer that will automatically remove your PIN after 72 hours</p>
                        <button data-action="start-lock-screen-timer-recovery" class="btn btn-primary btn-small">Start Timer Reset</button>
                    </div>
                `,
                buttons: [
                    { text: '← Back to PIN Entry', action: 'return-to-lock-screen', class: 'btn-secondary' }
                ],
                feedbackContainer: true
            });
        } else {
            showLockScreenMessage('error', 'Error accessing recovery options');
        }
    }
    
/**
     * Displays feedback messages on the lock screen interface.
     * 
     * Shows status messages (error, success, info) within the lock screen tab.
     * Automatically hides success messages after a configured duration.
     * Falls back to alternative feedback elements if primary element not found.
     * 
     * @param {string} type - Message type ('error', 'success', 'info')
     * @param {string} message - Message text to display
     * @since 2.0.0
     * @example
     * // Show error message on lock screen
     * showLockScreenMessage('error', 'Incorrect PIN. Please try again.');
     * 
     * @example
     * // Show success message that auto-hides
     * showLockScreenMessage('success', 'PIN verified! Unlocking journal...');
     */
    function showLockScreenMessage(type, message) {
        const feedbackDiv = document.getElementById('lockScreenFeedback') || document.getElementById('pinFeedback');
        if (!feedbackDiv) return;
        
        feedbackDiv.textContent = message;
        feedbackDiv.style.display = 'block';
        feedbackDiv.className = `notification-message ${type}`;
        
        if (type === 'success') {
            setTimeout(() => { if (feedbackDiv) feedbackDiv.style.display = 'none'; }, CONSTANTS.MESSAGE_DURATION_MEDIUM);
        }
    }
    
/**
     * Returns to the main lock screen interface from recovery screens.
     * 
     * Rebuilds the main lock screen interface with PIN entry form and recovery options.
     * Includes active timer information if a reset timer is running. Ensures proper
     * focus management and tab activation.
     * 
     * @since 2.0.0
     * @example
     * // Return to main lock screen from recovery interface
     * returnToLockScreen();
     * // Shows main PIN entry interface with timer info if applicable
     */
    async function returnToLockScreen() {
        const lockTab = document.getElementById('lockTab');
        if (!lockTab) {
            // Fallback in case tab doesn't exist, though it should
            switchAppTab('lock');
            return;
        }

        // Render the appropriate authentication screen based on requirements
        await renderUnifiedAuthenticationScreen(lockTab);

        // Ensure the tab is active
        switchAppTab('lock');
    }

/**
 * Renders unified authentication screen supporting both PIN and encryption password.
 *
 * This function creates a smart authentication interface that adapts based on the
 * user's security configuration. It detects whether PIN, encryption, or both are
 * enabled and renders the appropriate interface with contextual messaging and
 * recovery options tailored to each authentication method.
 *
 * **Authentication Scenarios:**
 * - PIN only: Shows 6-digit PIN input with dream title/timer recovery
 * - Encryption only: Shows password input with data wipe recovery option
 * - Both enabled: Shows password input with PIN fallback and appropriate recovery
 *
 * @async
 * @function
 * @param {HTMLElement} containerElement - The lock tab element to render into
 * @returns {Promise<void>} Resolves when rendering is complete
 * @since 2.03.01
 * @private
 */
async function renderUnifiedAuthenticationScreen(containerElement) {
    const requirements = await getAuthenticationRequirements();

    // Check for active PIN recovery timer
    const resetTime = getResetTime();
    let timerInstructions = '';

    if (resetTime && requirements.pinRequired) {
        const remainingTime = resetTime - Date.now();
        if (remainingTime > 0) {
            const hours = Math.ceil(remainingTime / (1000 * 60 * 60));
            const days = Math.ceil(hours / 24);

            let timeDisplay = '';
            if (days > 1) {
                timeDisplay = `${days} days`;
            } else if (hours > 1) {
                timeDisplay = `${hours} hours`;
            } else {
                timeDisplay = 'Less than 1 hour';
            }

            timerInstructions = `
                <div class="message-base message-info mb-md text-sm">
                    ⏰ Recovery timer active (${timeDisplay} remaining)<br>
                    <span class="text-sm font-normal">Press "Forgot PIN?" again when timer expires to unlock</span>
                </div>
            `;
        }
    }

    // Determine the appropriate interface based on authentication requirements
    if (requirements.encryptionRequired) {
        // Encryption password interface (with or without PIN fallback)
        renderEncryptionAuthenticationScreen(containerElement, requirements, timerInstructions);
    } else if (requirements.pinRequired) {
        // PIN-only interface
        renderPinAuthenticationScreen(containerElement, timerInstructions);
    } else {
        // Should not happen, but fallback to PIN interface
        renderPinAuthenticationScreen(containerElement, timerInstructions);
    }
}

/**
 * Renders encryption password authentication interface.
 *
 * @async
 * @function
 * @param {HTMLElement} containerElement - Container to render into
 * @param {Object} requirements - Authentication requirements
 * @param {string} timerInstructions - Timer instruction HTML
 * @private
 */
function renderEncryptionAuthenticationScreen(containerElement, requirements, timerInstructions) {
    const title = '🔐 Enter Encryption Password';
    const description = 'Enter your encryption password to decrypt and access your dream journal data.';

    containerElement.innerHTML = `
        <div class="flex-center" style="min-height: 400px;">
            <div class="card-elevated card-lg text-center max-w-sm w-full shadow-lg">
                <div class="text-4xl mb-lg">🔐</div>
                <h2 class="text-primary mb-md text-xl">${title}</h2>
                <p class="text-secondary mb-lg line-height-relaxed">
                    ${description}
                </p>
                ${timerInstructions}
                <input type="password" id="lockScreenPasswordInput" placeholder="Enter encryption password" maxlength="128" class="input-pin w-full mb-lg">
                <div class="flex-center gap-sm flex-wrap">
                    <button data-action="verify-encryption-password" class="btn btn-primary">🔓 Unlock Journal</button>
                    <button data-action="show-forgot-encryption-password" class="btn btn-secondary">Forgot Password?</button>
                </div>
                <div id="lockScreenFeedback" class="mt-md p-sm feedback-container"></div>
            </div>
        </div>
    `;

    // Focus the password input and ensure it starts empty
    const passwordInput = document.getElementById('lockScreenPasswordInput');
    if (passwordInput) {
        passwordInput.value = ''; // Explicitly clear any retained value
        setTimeout(() => passwordInput.focus(), 100);
    }
}

/**
 * Renders PIN authentication interface (legacy interface for PIN-only scenarios).
 *
 * @function
 * @param {HTMLElement} containerElement - Container to render into
 * @param {string} timerInstructions - Timer instruction HTML
 * @private
 */
function renderPinAuthenticationScreen(containerElement, timerInstructions) {
    containerElement.innerHTML = `
        <div class="flex-center" style="min-height: 400px;">
            <div class="card-elevated card-lg text-center max-w-sm w-full shadow-lg">
                <div class="text-4xl mb-lg">🔒</div>
                <h2 class="text-primary mb-md text-xl">Journal Locked</h2>
                <p class="text-secondary mb-lg line-height-relaxed">
                    Your dream journal is protected with a PIN. Enter your PIN to access your dreams and all app features.
                </p>
                ${timerInstructions}
                <input type="password" id="lockScreenPinInput" placeholder="Enter PIN" maxlength="6" class="input-pin w-full mb-lg">
                <div class="flex-center gap-sm flex-wrap">
                    <button data-action="verify-lock-screen-pin" class="btn btn-primary">🔓 Unlock Journal</button>
                    <button data-action="show-lock-screen-forgot-pin" class="btn btn-secondary">Forgot PIN?</button>
                </div>
                <div id="lockScreenFeedback" class="mt-md p-sm feedback-container"></div>
            </div>
        </div>
    `;

    // Focus the PIN input and ensure it starts empty
    const pinInput = document.getElementById('lockScreenPinInput');
    if (pinInput) {
        pinInput.value = ''; // Explicitly clear any retained value
        setTimeout(() => pinInput.focus(), 100);
    }
}

/**
 * Shows forgot encryption password recovery options.
 *
 * Displays recovery options for users who have forgotten their encryption password.
 * Since encrypted data cannot be recovered without the password, the primary option
 * is complete data wipe with appropriate warnings and confirmations.
 *
 * @async
 * @function
 * @since 2.03.01
 * @example
 * // Called from lock screen "Forgot Password?" button
 * showForgotEncryptionPassword();
 */
async function showForgotEncryptionPassword() {
    const lockTab = document.getElementById('lockTab');
    if (!lockTab) return;

    const lockCard = lockTab.querySelector('.card-elevated') || lockTab;

    lockCard.innerHTML = `
        <div class="card-elevated card-lg text-center max-w-sm w-full shadow-lg">
            <div class="text-4xl mb-lg">🔐❓</div>
            <h2 class="text-primary mb-md text-xl">Forgot Encryption Password?</h2>
            <p class="text-secondary mb-lg line-height-relaxed">
                <strong style="color: var(--error-color);">⚠️ Important:</strong><br>
                Encrypted data cannot be recovered without your password. Your only option is to wipe all data and start fresh.
            </p>

            <div class="message-base message-error mb-lg text-sm">
                <strong>This will permanently delete:</strong><br>
                • All encrypted dreams and goals<br>
                • All app settings and preferences<br>
                • All voice notes and data<br>
                <br>
                <strong>This action cannot be undone!</strong>
            </div>

            <div class="flex-center gap-sm flex-wrap">
                <button data-action="wipe-all-data" class="btn btn-error">🗑️ Wipe All Data</button>
                <button data-action="return-to-lock-screen" class="btn btn-secondary">← Back</button>
            </div>
            <div id="lockScreenFeedback" class="mt-md p-sm feedback-container"></div>
        </div>
    `;
}

/**
 * Performs complete data wipe for forgotten encryption password recovery.
 *
 * This is a nuclear option that completely wipes all user data when encryption
 * password is forgotten. Provides multiple confirmation steps to prevent
 * accidental data loss. When PIN protection is configured, requires both PIN
 * verification and text confirmation for enhanced security. For non-PIN users,
 * uses text confirmation only for backward compatibility.
 *
 * @async
 * @function
 * @since 2.03.01
 * @example
 * // Called after user confirms data wipe
 * await wipeAllData();
 */
async function wipeAllData() {
    const lockTab = document.getElementById('lockTab');
    if (!lockTab) return;

    const lockCard = lockTab.querySelector('.card-elevated') || lockTab;
    const hasPinProtection = isPinSetup();

    if (hasPinProtection) {
        // Enhanced confirmation for PIN-protected accounts
        lockCard.innerHTML = `
            <div class="card-elevated card-lg text-center max-w-sm w-full shadow-lg">
                <div class="text-4xl mb-lg">🔐⚠️</div>
                <h2 class="text-primary mb-md text-xl">Enhanced Security Confirmation</h2>
                <p class="text-secondary mb-lg line-height-relaxed">
                    <strong>PIN protection detected.</strong><br>
                    For your security, you must verify your identity with both your PIN and confirmation text.
                </p>

                <div class="mb-lg">
                    <label for="wipePinInput" class="block text-sm font-medium text-secondary mb-sm">Enter your PIN:</label>
                    <input
                        type="password"
                        id="wipePinInput"
                        placeholder="Enter PIN"
                        class="input-pin w-full mb-md"
                        maxlength="6"
                        aria-label="Enter your PIN to verify identity before data wipe"
                        aria-describedby="wipePinHelp"
                    >
                    <div id="wipePinHelp" class="text-xs text-secondary">Your 4-6 digit PIN is required to proceed</div>
                </div>

                <div class="mb-lg">
                    <label for="wipeConfirmationInput" class="block text-sm font-medium text-secondary mb-sm">Type confirmation text:</label>
                    <input
                        type="text"
                        id="wipeConfirmationInput"
                        placeholder="Type: DELETE EVERYTHING"
                        class="input-pin w-full"
                        aria-label="Type DELETE EVERYTHING to confirm complete data wipe"
                        aria-describedby="wipeConfirmHelp"
                    >
                    <div id="wipeConfirmHelp" class="text-xs text-secondary">Must type exactly: DELETE EVERYTHING</div>
                </div>

                <div class="flex-center gap-sm flex-wrap">
                    <button data-action="confirm-data-wipe" class="btn btn-error" aria-describedby="wipeButtonHelp">
                        🗑️ Confirm Wipe
                    </button>
                    <button data-action="show-forgot-pin" class="btn btn-secondary">
                        🔑 Forgot PIN?
                    </button>
                    <button data-action="show-forgot-encryption-password" class="btn btn-secondary">
                        ← Back
                    </button>
                </div>
                <div id="wipeButtonHelp" class="sr-only">Requires both valid PIN and exact confirmation text to proceed</div>
                <div id="lockScreenFeedback" class="mt-md p-sm feedback-container" role="alert" aria-live="polite"></div>
            </div>
        `;

        // Focus the PIN input first
        const pinInput = document.getElementById('wipePinInput');
        if (pinInput) {
            setTimeout(() => pinInput.focus(), 100);
        }
    } else {
        // Standard confirmation for non-PIN accounts (backward compatibility)
        lockCard.innerHTML = `
            <div class="card-elevated card-lg text-center max-w-sm w-full shadow-lg">
                <div class="text-4xl mb-lg">⚠️</div>
                <h2 class="text-primary mb-md text-xl">Final Confirmation</h2>
                <p class="text-secondary mb-lg line-height-relaxed">
                    Type <strong>DELETE EVERYTHING</strong> to confirm complete data wipe:
                </p>

                <input
                    type="text"
                    id="wipeConfirmationInput"
                    placeholder="Type: DELETE EVERYTHING"
                    class="input-pin w-full mb-lg"
                    aria-label="Type DELETE EVERYTHING to confirm complete data wipe"
                    aria-describedby="wipeConfirmHelp"
                >
                <div id="wipeConfirmHelp" class="text-xs text-secondary mb-lg">Must type exactly: DELETE EVERYTHING</div>

                <div class="flex-center gap-sm flex-wrap">
                    <button data-action="confirm-data-wipe" class="btn btn-error">🗑️ Confirm Wipe</button>
                    <button data-action="show-forgot-encryption-password" class="btn btn-secondary">← Back</button>
                </div>
                <div id="lockScreenFeedback" class="mt-md p-sm feedback-container" role="alert" aria-live="polite"></div>
            </div>
        `;

        // Focus the confirmation input
        const confirmInput = document.getElementById('wipeConfirmationInput');
        if (confirmInput) {
            setTimeout(() => confirmInput.focus(), 100);
        }
    }
}


/**
 * Confirms and executes complete data wipe after user confirmation.
 *
 * Validates user input based on PIN protection status. For PIN-protected accounts,
 * requires both valid PIN verification and exact confirmation text. For non-PIN
 * accounts, validates confirmation text only. Performs complete application data
 * wipe including IndexedDB, localStorage, and session data when validation passes.
 * This operation is irreversible and completely resets the application to fresh
 * install state.
 *
 * @async
 * @function
 * @since 2.03.01
 * @example
 * // Called after user provides required confirmation(s)
 * await confirmDataWipe();
 *
 * @example
 * // For PIN-protected accounts - validates both PIN and text
 * // For non-PIN accounts - validates text only
 * await confirmDataWipe();
 */
async function confirmDataWipe() {
    debugLog('confirmDataWipe: Function called');
    const confirmInput = document.getElementById('wipeConfirmationInput');
    const feedback = document.getElementById('lockScreenFeedback');
    const hasPinProtection = isPinSetup();

    if (!confirmInput || !feedback) {
        debugLog('confirmDataWipe: Missing elements - confirmInput:', !!confirmInput, 'feedback:', !!feedback);
        return;
    }

    if (hasPinProtection) {
        // Enhanced validation for PIN-protected accounts
        const pinInput = document.getElementById('wipePinInput');
        if (!pinInput) {
            debugLog('confirmDataWipe: Missing PIN input element');
            feedback.innerHTML = '<div class="message-base message-error">PIN input not found. Please refresh and try again.</div>';
            return;
        }

        const enteredPin = pinInput.value.trim();
        const confirmText = confirmInput.value.trim();

        debugLog('confirmDataWipe: PIN-protected validation - PIN length:', enteredPin.length, 'text:', JSON.stringify(confirmText));

        // Validate PIN first
        if (!enteredPin || enteredPin.length < 4) {
            debugLog('confirmDataWipe: PIN validation failed - insufficient length');
            feedback.innerHTML = '<div class="message-base message-error" role="alert">Please enter your PIN to verify your identity.</div>';
            pinInput.focus();
            return;
        }

        // Verify PIN against stored hash
        try {
            const storedData = getStoredPinData();
            const isPinValid = await verifyPinHash(enteredPin, storedData);

            if (!isPinValid) {
                debugLog('confirmDataWipe: PIN verification failed');
                feedback.innerHTML = '<div class="message-base message-error" role="alert">Incorrect PIN. Please verify your PIN and try again.</div>';
                pinInput.value = '';
                pinInput.focus();
                return;
            }

            debugLog('confirmDataWipe: PIN verification successful');
        } catch (error) {
            console.error('confirmDataWipe: PIN verification error:', error);
            feedback.innerHTML = '<div class="message-base message-error" role="alert">PIN verification failed. Please try again.</div>';
            pinInput.focus();
            return;
        }

        // Validate confirmation text
        if (confirmText !== 'DELETE EVERYTHING') {
            debugLog('confirmDataWipe: Text validation failed for PIN-protected account');
            feedback.innerHTML = '<div class="message-base message-error" role="alert">Please type exactly: DELETE EVERYTHING</div>';
            confirmInput.focus();
            return;
        }

        debugLog('confirmDataWipe: Both PIN and text validation passed for PIN-protected account');
    } else {
        // Standard validation for non-PIN accounts (backward compatibility)
        const confirmText = confirmInput.value.trim();
        debugLog('confirmDataWipe: Non-PIN validation - text:', JSON.stringify(confirmText));

        if (confirmText !== 'DELETE EVERYTHING') {
            debugLog('confirmDataWipe: Text validation failed for non-PIN account');
            feedback.innerHTML = '<div class="message-base message-error" role="alert">Please type exactly: DELETE EVERYTHING</div>';
            confirmInput.focus();
            return;
        }

        debugLog('confirmDataWipe: Text validation passed for non-PIN account');
    }

    debugLog('confirmDataWipe: All validations passed, proceeding with wipe');

    try {
        debugLog('confirmDataWipe: Starting data wipe process');
        feedback.innerHTML = '<div class="message-base message-info">Wiping all data...</div>';

        // Import required functions
        debugLog('confirmDataWipe: Importing state functions');
        const {
            setEncryptionEnabled,
            setEncryptionPassword,
            clearDecryptedDataCache,
            setUnlocked,
            setAppLocked
        } = await import('./state.js');

        // Clear IndexedDB databases
        debugLog('confirmDataWipe: Getting database list');
        const databases = await indexedDB.databases();
        debugLog('confirmDataWipe: Found databases:', databases.map(db => db.name));

        // First, close any existing database connections
        debugLog('confirmDataWipe: Closing any open database connections');
        const { closeDB } = await import('./storage.js');
        closeDB();

        for (const db of databases) {
            if (db.name && db.name.includes('Dream')) {
                debugLog('confirmDataWipe: Deleting database:', db.name);
                const deleteReq = indexedDB.deleteDatabase(db.name);
                await new Promise((resolve, reject) => {
                    deleteReq.onsuccess = () => {
                        debugLog('confirmDataWipe: Successfully deleted database:', db.name);
                        resolve();
                    };
                    deleteReq.onerror = () => {
                        console.error('confirmDataWipe: Failed to delete database:', db.name, deleteReq.error);
                        reject(deleteReq.error);
                    };
                    deleteReq.onblocked = () => {
                        console.warn('confirmDataWipe: Database deletion blocked, retrying:', db.name);
                        // Database deletion is blocked, try to force close and retry
                        setTimeout(() => {
                            debugLog('confirmDataWipe: Retrying database deletion after block:', db.name);
                        }, 1000);
                    };
                });
            }
        }

        // Clear all localStorage
        debugLog('confirmDataWipe: Clearing localStorage');
        if (typeof(Storage) !== "undefined" && localStorage) {
            localStorage.clear();
            debugLog('confirmDataWipe: localStorage cleared');
        }

        // Clear all session state
        debugLog('confirmDataWipe: Clearing session state');
        setEncryptionEnabled(false);
        setEncryptionPassword(null);
        clearDerivedKeys();
        clearDecryptedDataCache();
        setUnlocked(false);
        setAppLocked(false);

        // Clear any PIN settings
        debugLog('confirmDataWipe: Clearing PIN settings');
        removePinHash();
        removeResetTime();

        // Show success message and redirect
        debugLog('confirmDataWipe: Showing success message');
        const lockTab = document.getElementById('lockTab');
        if (lockTab) {
            lockTab.innerHTML = `
                <div class="flex-center" style="min-height: 400px;">
                    <div class="card-elevated card-lg text-center max-w-sm w-full shadow-lg">
                        <div class="text-4xl mb-lg">✅</div>
                        <h2 class="text-primary mb-md text-xl">Data Wiped Successfully</h2>
                        <p class="text-secondary mb-lg line-height-relaxed">
                            All application data has been permanently deleted. The app will reload with a fresh start.
                        </p>
                        <button data-action="reload-app" class="btn btn-primary">🔄 Reload Application</button>
                    </div>
                </div>
            `;
        }

    } catch (error) {
        console.error('Error during data wipe:', error);
        feedback.innerHTML = '<div class="message-base message-error">Error wiping data. Please try again or reload the application.</div>';
    }
}

// ================================
// ES MODULE EXPORTS
// ================================

export {
    verifyLockScreenPin,
    showLockScreenForgotPin,
    showLockScreenMessage,
    returnToLockScreen,
    showForgotEncryptionPassword,
    wipeAllData,
    confirmDataWipe
};
