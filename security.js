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
    isAppLocked,
    isUnlocked,
    setUnlocked,
    setAppLocked,
    setFailedPinAttempts,
    getFailedPinAttempts,
    preLockActiveTab,
    getPreLockActiveTab,
    setPreLockActiveTab,
    activeAppTab,
    setEncryptionPassword,
    clearDecryptedDataCache
} from './state.js';
import {
    renderPinScreen,
    showAllTabButtons,
    switchAppTab,
    createInlineMessage,
    hideAllTabButtons
} from './dom-helpers.js';
import {
    loadDreams,
    isLocalStorageAvailable,
    loadDreamsRaw,
    loadGoalsRaw,
    getAutocompleteSuggestionsRawData,
    putItemsInStores,
    isEncryptedItem,
    decryptItemFromStorage,
    encryptItemForStorage
} from './storage.js';
import { displayDreams } from './dream-crud.js';
import {
    clearDerivedKeys,
    generateSalt,
    generateIV,
    deriveKey,
    encryptData,
    decryptData,
    encryptStoredData,
    decryptStoredData
} from './security-crypto.js';
import {
    isPinSetup,
    removePinHash,
    registerFailedPinAttempt,
    getPinLockoutRemainingMs,
    formatPinLockoutMessage,
    verifyPinHash,
    getStoredPinData,
    getResetTime,
    removeResetTime,
    storeResetTime,
    storePinHash,
    hashPinSecure,
    timingSafeEqualHex,
    computePinLockoutMs
} from './pin-core.js';

// ================================
// TYPE DEFINITIONS
// ================================

/**
 * Configuration object for password dialog display.
 * 
 * @typedef {Object} PasswordDialogConfig
 * @property {string} title - Dialog title text
 * @property {string} description - Dialog description/instructions
 * @property {boolean} [requireConfirm=false] - Whether to show password confirmation field
 * @property {string} primaryButtonText - Text for primary action button
 * @since 2.0.0
 */

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
// 2. PASSWORD DIALOG SYSTEM
// ================================

/**
 * Displays a modal password dialog for export/import operations with configurable options.
 * 
 * Creates a customizable password entry dialog that supports both single password entry
 * and password confirmation modes. The dialog is fully accessible with proper focus management,
 * keyboard navigation (Enter key support), and inline error display. Returns a Promise that
 * resolves with the entered password or null if cancelled.
 * 
 * @async
 * @param {PasswordDialogConfig} config - Dialog configuration object
 * @param {string} config.title - Dialog title text
 * @param {string} config.description - Dialog description/instructions (supports HTML)
 * @param {boolean} [config.requireConfirm=false] - Whether to show password confirmation field
 * @param {string} config.primaryButtonText - Text for primary action button
 * @returns {Promise<string|null>} Entered password string, or null if cancelled
 * @since 2.0.0
 * @example
 * // Simple password entry
 * const password = await showPasswordDialog({
 *   title: 'Enter Password',
 *   description: 'Please enter your password to encrypt the export file.',
 *   primaryButtonText: 'Encrypt & Export'
 * });
 * 
 * @example
 * // Password entry with confirmation
 * const password = await showPasswordDialog({
 *   title: 'Create Password',
 *   description: 'Create a password to protect your exported dreams.',
 *   requireConfirm: true,
 *   primaryButtonText: 'Create Export'
 * });
 * if (password) {
 *   // User entered matching passwords
 *   await exportWithPassword(password);
 * } else {
 *   // User cancelled
 *   console.log('Export cancelled');
 * }
 */
function showPasswordDialog(config) {
        return new Promise((resolve) => {
            // Remove any existing password dialog
            const existingOverlay = document.querySelector('.pin-overlay[data-dialog="password"]');
            if (existingOverlay) existingOverlay.remove();

            const overlay = document.createElement('div');
            overlay.className = 'pin-overlay';
            overlay.style.display = 'flex';
            overlay.setAttribute('data-dialog', 'password');

            const confirmInputHTML = config.requireConfirm ? `
                <input type="password"
                       id="confirmPasswordInput"
                       class="pin-input"
                       placeholder="Confirm password"
                       maxlength="50"
                       style="margin-top: 10px;">
            ` : '';

            overlay.innerHTML = `
                <div class="pin-container">
                    <h2>🔒 ${config.title}</h2>
                    <p>${config.description}</p>
                    <input type="password"
                           id="passwordInput"
                           class="pin-input"
                           placeholder="Enter password"
                           maxlength="50">
                    ${confirmInputHTML}
                    <div class="pin-buttons">
                        <button class="btn btn-primary" id="confirmPasswordBtn">${config.primaryButtonText}</button>
                        <button class="btn btn-secondary" id="cancelPasswordBtn">Cancel</button>
                    </div>
                    <div id="passwordError" class="notification-message error"></div>
                </div>
            `;

            document.body.appendChild(overlay);
            
            const passwordInput = document.getElementById('passwordInput');
            const confirmInput = document.getElementById('confirmPasswordInput');
            const confirmBtn = document.getElementById('confirmPasswordBtn');
            const cancelBtn = document.getElementById('cancelPasswordBtn');
            
            passwordInput.focus();
            
/**
             * Removes the password dialog from the DOM.
             * @private
             */
            function cleanup() {
                document.body.removeChild(overlay);
            }
            
            /**
             * Handles password confirmation and validation.
             * Validates password entries, shows inline errors for mismatched passwords,
             * and resolves the Promise with the entered password.
             * @private
             */
            function handleConfirm() {
                const password = passwordInput.value;
                const confirmPassword = confirmInput ? confirmInput.value : password;
                const errorDiv = document.getElementById('passwordError');

                // Clear previous errors
                if (errorDiv) {
                    errorDiv.style.display = 'none';
                    errorDiv.textContent = '';
                }

                if (!password) {
                    showError('Please enter a password');
                    passwordInput.focus();
                    return;
                }

                if (config.requireConfirm && password !== confirmPassword) {
                    showError('Passwords do not match');
                    confirmInput.focus();
                    return;
                }

                // Run custom validation if provided
                if (config.validate && typeof config.validate === 'function') {
                    const validation = config.validate(password);
                    if (!validation.valid) {
                        showError(validation.error);
                        passwordInput.focus();
                        return;
                    }
                }

                cleanup();
                resolve(password);
            }

            /**
             * Shows error message in the dialog's error container.
             * @private
             * @param {string} message - Error message to display
             */
            function showError(message) {
                const errorDiv = document.getElementById('passwordError');
                if (errorDiv) {
                    errorDiv.textContent = message;
                    errorDiv.style.display = 'block';
                }
            }
            
            /**
             * Handles dialog cancellation.
             * Resolves the Promise with null to indicate cancellation.
             * @private
             */
            function handleCancel() {
                cleanup();
                resolve(null);
            }
            
            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            
            passwordInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    if (config.requireConfirm && !confirmInput.value) {
                        confirmInput.focus();
                    } else {
                        handleConfirm();
                    }
                }
            });
            
            if (confirmInput) {
                confirmInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        handleConfirm();
                    }
                });
            }
        });
    }

// ================================
// 8. UI CONTROLS & STATE MANAGEMENT 
// ================================

/**
 * Updates security control buttons visibility and state across all UI locations.
 * 
 * Manages the display and text of security-related buttons throughout the application.
 * The lock button is always visible for better UX, with logic handled in toggleLock().
 * Updates button text and tooltips based on current PIN status and lock state.
 * 
 * @todo Split into updateButtonStates(), updateButtonText(), and validateAppState() functions for better separation of concerns
 * @since 1.0.0
 * @example
 * // Update UI after PIN setup
 * await storePinHash(newPin);
 * updateSecurityControls(); // Shows "Lock Journal" and "Change/Remove PIN"
 * 
 * @example
 * // Update UI after PIN removal
 * removePinHash();
 * updateSecurityControls(); // Shows "Setup & Lock" and "Setup PIN"
 */
function updateSecurityControls() {
        const lockBtn = document.getElementById('lockBtn');
        const lockBtnSettings = document.getElementById('lockBtnSettings');
        const setupBtnSettings = document.getElementById('setupPinBtnSettings');
        
        // Always show the lock button - much simpler UX!
        if (lockBtn) {
            lockBtn.style.display = 'inline-block';
            if (isPinSetup()) {
                if (isUnlocked && !isAppLocked) {
                    lockBtn.textContent = '🔒 Lock Journal';
                    lockBtn.title = 'Lock your journal with your PIN to keep dreams private';
                } else {
                    lockBtn.textContent = '🔓 Unlock Journal'; // This case shouldn't happen much since we use lock screen
                    lockBtn.title = 'Unlock your journal by entering your PIN';
                }
            } else {
                lockBtn.textContent = '🔒 Setup & Lock';
                lockBtn.title = 'Set up a PIN to secure your dreams, then lock the journal';
            }
        }
        
        // Show settings lock button only when PIN is set
        if (lockBtnSettings) {
            if (isPinSetup()) {
                lockBtnSettings.style.display = 'inline-block';
                if (isUnlocked && !isAppLocked) {
                    lockBtnSettings.textContent = '🔒 Lock Journal';
                    lockBtnSettings.title = 'Lock your journal with your PIN to keep dreams private';
                } else {
                    lockBtnSettings.textContent = '🔓 Unlock Journal';
                    lockBtnSettings.title = 'Unlock your journal by entering your PIN';
                }
            } else {
                // Hide lock button when no PIN is set
                lockBtnSettings.style.display = 'none';
            }
        }
        
        // Update setup button text (only exists in settings)
        if (setupBtnSettings) {
            setupBtnSettings.textContent = isPinSetup() ? '⚙️ Change/Remove PIN' : '⚙️ Setup PIN';
        }
        
        // Ensure correct app state
        if (!isPinSetup()) {
            setUnlocked(true);
            setAppLocked(false);
        }
    }

/**
     * Executes PIN removal after successful verification.
     * 
     * Actually removes the PIN hash from storage and shows success confirmation.
     * Sets application to unlocked state and prepares for completion workflow.
     * Handles any errors that occur during the removal process.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called after PIN verification succeeds for removal
     * await executePinRemoval();
     * // Removes PIN and shows success screen
     */
    async function executePinRemoval() {
        try {
            // Remove the PIN
            removePinHash();

            const pinContainer = document.querySelector('#pinOverlay .pin-container');
            renderPinScreen(pinContainer, {
                title: 'PIN Removed',
                icon: '✅',
                message: 'The PIN has been removed. The journal no longer asks for a PIN.',
                buttons: [
                    { text: 'Close', action: 'complete-pin-removal', class: 'btn-primary' }
                ]
            });

            setUnlocked(true);
        } catch (error) {
            console.error('Error removing PIN:', error);
            showMessage('error', 'Error removing PIN. Please try again.');
        }
    }

/**
     * Completes PIN removal workflow and restores normal application state.
     * 
     * Final cleanup after successful PIN removal. Resets overlay, unlocks application,
     * shows all UI elements, updates security controls, and refreshes dream display.
     * Ensures application returns to fully functional state without PIN protection.
     * 
     * @async
     * @since 2.0.0
     * @example
     * // Called after successful PIN removal completion
     * await completePinRemoval();
     * // Restores full application functionality without PIN protection
     */
    async function completePinRemoval() {
        resetPinOverlay();
        hidePinOverlay();
        
        // Reset failed attempts since PIN removal was successful
        setFailedPinAttempts(0);
        
        // PIN removed - unlock the app
        setUnlocked(true);
        setAppLocked(false);
        
        debugLog('PIN removal complete - ensuring tabs are visible');
        
        // Ensure all tabs are visible (PIN is removed, no need to hide)
        showAllTabButtons();
        
        updateSecurityControls();
        await displayDreams();
    }

/**
     * Displays inline messages within the PIN overlay interface.
     * 
     * Shows feedback messages (error, success, info) in the appropriate message
     * containers within the PIN overlay. Clears existing messages before showing
     * new ones. Success messages automatically hide after configured duration.
     * 
     * @param {string} type - Message type ('error', 'success', 'info')
     * @param {string} message - Message text to display
     * @param {string} [elementId] - Optional specific element ID to use
     * @since 1.0.0
     * @example
     * // Show error message in PIN overlay
     * showMessage('error', 'Incorrect PIN. Please try again.');
     * 
     * @example
     * // Show success message that auto-hides
     * showMessage('success', 'PIN setup complete!');
     * 
     * @example
     * // Show message in specific element
     * showMessage('info', 'PIN must be 4-6 digits', 'customFeedback');
     */
    function showMessage(type, message, elementId = null) {
        // Clear all messages first
        document.getElementById('pinFeedback').style.display = 'none';
        document.getElementById('pinSuccess').style.display = 'none';
        document.getElementById('pinInfo').style.display = 'none';
        
        let element;
        if (elementId) {
            element = document.getElementById(elementId);
        } else {
            switch(type) {
                case 'error': element = document.getElementById('pinFeedback'); break;
                case 'success': element = document.getElementById('pinSuccess'); break;
                case 'info': element = document.getElementById('pinInfo'); break;
            }
        }
        
        if (element) {
            element.textContent = message;
            element.className = `notification-message ${type}`;
            element.style.display = 'block';
            
            // Auto-hide success messages after duration
            if (type === 'success') {
                setTimeout(() => {
                    element.style.display = 'none';
                }, CONSTANTS.MESSAGE_DURATION_MEDIUM);
            }
        }
    }

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
// 12. ENCRYPTION SETTINGS MANAGEMENT
// ================================

/**
 * Loads encryption settings from localStorage.
 *
 * Reads the encryption enabled setting from localStorage to determine if data
 * encryption is active. Returns false as default for new users or when
 * localStorage is unavailable, ensuring graceful fallback behavior.
 *
 * @function
 * @returns {boolean} True if encryption is enabled, false otherwise
 * @throws {Error} Storage errors are caught and logged, returns false
 * @since 2.03.01
 * @example
 * const encryptionEnabled = loadEncryptionSettings();
 * if (encryptionEnabled) {
 *   // Setup encryption authentication
 * }
 */
function loadEncryptionSettings() {
    if (!isLocalStorageAvailable()) return false;

    try {
        const setting = localStorage.getItem('dreamJournalEncryptionEnabled');
        return setting === 'true';
    } catch (error) {
        console.error('Failed to load encryption settings:', error);
        return false;
    }
}

/**
 * Saves encryption settings to localStorage.
 *
 * Persists the encryption enabled setting to localStorage and updates the
 * global encryption state. Returns true if the save operation was successful,
 * false if localStorage is unavailable or the operation failed.
 *
 * @async
 * @function
 * @param {boolean} enabled - Whether encryption should be enabled
 * @returns {Promise<boolean>} True if save was successful, false otherwise
 * @throws {Error} Storage errors are caught and logged, returns false
 * @since 2.03.01
 * @example
 * const success = await saveEncryptionSettings(true);
 * if (success) {
 *   console.log('Encryption enabled successfully');
 * }
 */
async function saveEncryptionSettings(enabled) {
    if (!isLocalStorageAvailable()) return false;

    try {
        localStorage.setItem('dreamJournalEncryptionEnabled', enabled.toString());

        // Update global encryption state
        const { setEncryptionEnabled } = await import('./state.js');
        setEncryptionEnabled(enabled);

        return true;
    } catch (error) {
        console.error('Failed to save encryption settings:', error);
        return false;
    }
}

/**
 * Validates an encryption password meets security requirements.
 *
 * Performs comprehensive validation of encryption passwords including length
 * requirements, character composition, and common password checks. Returns
 * detailed validation results for user feedback and security enforcement.
 *
 * @function
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with success flag and error message
 * @returns {boolean} returns.valid - Whether password meets all requirements
 * @returns {string} [returns.error] - Error message if validation fails
 * @since 2.03.01
 * @example
 * const validation = validateEncryptionPassword('mypassword123');
 * if (!validation.valid) {
 *   showError(validation.error);
 * }
 */
function validateEncryptionPassword(password) {
    if (!password) {
        return { valid: false, error: 'Password is required' };
    }

    if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters' };
    }

    if (password.length > 128) {
        return { valid: false, error: 'Password must be 128 characters or less' };
    }

    // Check for common weak passwords
    const commonPasswords = [
        'password', '12345678', 'qwerty', 'abc123', 'password123',
        'admin', 'letmein', 'welcome', '123456789', 'password1'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
        return { valid: false, error: 'Password is too common and easily guessed' };
    }

    // Additional security checks can be added here in the future
    return { valid: true };
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

/**
 * Tests if a password can decrypt existing encrypted data.
 *
 * Validates an encryption password by attempting to decrypt any available
 * encrypted content. This is used during password verification to ensure
 * the entered password is correct without exposing the actual data.
 *
 * @async
 * @function
 * @param {string} password - Password to test for validity
 * @returns {Promise<Object>} Test result with validity and error information
 * @returns {boolean} returns.valid - Whether password successfully decrypts data
 * @returns {string} [returns.error] - Error message if test fails
 * @since 2.03.01
 * @example
 * const testResult = await testEncryptionPassword('userpassword');
 * if (testResult.valid) {
 *   // Password is correct
 * }
 */
async function testEncryptionPassword(password) {
    try {
        // Import storage functions
        const { loadFromStore, isEncryptedItem, decryptItemFromStorage } = await import('./storage.js');

        // Try to decrypt any encrypted item to verify password
        const dreams = await loadFromStore('dreams');
        const encryptedDream = dreams.find(d => isEncryptedItem(d));

        if (encryptedDream) {
            await decryptItemFromStorage(encryptedDream, password);
            return { valid: true };
        } else {
            // No encrypted data to test against - assume valid for first-time setup
            return { valid: true };
        }
    } catch (error) {
        return { valid: false, error: error.message };
    }
}


/**
 * Shows a modal progress popup during encryption operations.
 *
 * Creates a non-dismissible modal dialog that displays encryption progress
 * and prevents user interaction until the operation completes. The popup
 * shows loading state, then success or error state with appropriate messaging.
 *
 * **Features:**
 * - Non-dismissible during operation (no overlay click, ESC key disabled)
 * - Loading spinner and progress text during encryption
 * - Success/error state with appropriate icons and messages
 * - OK button only enabled after operation completes
 * - Proper ARIA attributes for accessibility
 * - Follows established cloud sync progress dialog pattern
 *
 * **Operation States:**
 * - 'encrypting': Shows loading spinner with progress message
 * - 'success': Shows success icon with completion message
 * - 'error': Shows error icon with failure message
 *
 * @async
 * @function
 * @param {string} operation - The operation being performed ('encrypting', 'success', 'error')
 * @param {string} [message] - Optional custom message for the operation
 * @returns {Promise<void>} Resolves when user dismisses the completed dialog
 * @throws {Error} When dialog creation or operation fails
 * @since 2.04.01
 *
 * @example
 * // Show encryption progress
 * showEncryptionProgress('encrypting');
 * try {
 *   await performEncryption();
 *   await showEncryptionProgress('success', 'Encryption completed successfully!');
 * } catch (error) {
 *   await showEncryptionProgress('error', 'Encryption failed: ' + error.message);
 * }
 */
async function showEncryptionProgress(operation, message = '') {
    return new Promise((resolve) => {
        let dialog = document.getElementById('encryption-progress-dialog');

        if (!dialog) {
            // Create dialog if it doesn't exist
            dialog = document.createElement('div');
            dialog.id = 'encryption-progress-dialog';
            dialog.className = 'security-dialog-overlay progress-dialog';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'encryption-progress-title');
            document.body.appendChild(dialog);
        }

        let dialogHtml = '';
        let canDismiss = false;

        if (operation === 'encrypting') {
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="encryption-progress-title">🔒 Encrypting Data</h3>
                    <div class="progress-spinner">
                        <div class="spinner"></div>
                    </div>
                    <p id="encryption-progress-message">Encrypting your data...</p>
                    <p><small>Please wait, do not close this window.</small></p>
                    <div class="dialog-actions">
                        <button id="encryption-progress-ok" class="btn btn-primary" disabled>
                            Please Wait...
                        </button>
                    </div>
                </div>
            `;
        } else if (operation === 'success') {
            canDismiss = true;
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="encryption-progress-title">✅ Encryption Successful</h3>
                    <p>${message || 'Your data has been successfully encrypted.'}</p>
                    <div class="dialog-actions">
                        <button id="encryption-progress-ok" class="btn btn-primary">
                            OK
                        </button>
                    </div>
                </div>
            `;
        } else if (operation === 'error') {
            canDismiss = true;
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="encryption-progress-title">❌ Encryption Failed</h3>
                    <p>${message || 'An error occurred while encrypting your data.'}</p>
                    <div class="dialog-actions">
                        <button id="encryption-progress-ok" class="btn btn-primary">
                            OK
                        </button>
                    </div>
                </div>
            `;
        }

        dialog.innerHTML = dialogHtml;

        if (canDismiss) {
            // Add event listener for OK button
            const okButton = dialog.querySelector('#encryption-progress-ok');
            okButton.addEventListener('click', () => {
                document.body.removeChild(dialog);
                resolve();
            });
        }

        if (!canDismiss) {
            // Disable ESC key and overlay click
            dialog.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            document.addEventListener('keydown', function preventEsc(e) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
        }
    });
}

/**
 * Shows a modal progress popup during decryption operations.
 *
 * Creates a non-dismissible modal dialog that displays decryption progress
 * and prevents user interaction until the operation completes. The popup
 * shows loading state, then success or error state with appropriate messaging.
 *
 * **Features:**
 * - Non-dismissible during operation (no overlay click, ESC key disabled)
 * - Loading spinner and progress text during decryption
 * - Success/error state with appropriate icons and messages
 * - OK button only enabled after operation completes
 * - Proper ARIA attributes for accessibility
 * - Follows established cloud sync progress dialog pattern
 *
 * **Operation States:**
 * - 'decrypting': Shows loading spinner with progress message
 * - 'success': Shows success icon with completion message
 * - 'error': Shows error icon with failure message
 *
 * @async
 * @function
 * @param {string} operation - The operation being performed ('decrypting', 'success', 'error')
 * @param {string} [message] - Optional custom message for the operation
 * @returns {Promise<void>} Resolves when user dismisses the completed dialog
 * @throws {Error} When dialog creation or operation fails
 * @since 2.04.01
 *
 * @example
 * // Show decryption progress
 * showDecryptionProgress('decrypting');
 * try {
 *   await performDecryption();
 *   await showDecryptionProgress('success', 'Decryption completed successfully!');
 * } catch (error) {
 *   await showDecryptionProgress('error', 'Decryption failed: ' + error.message);
 * }
 */
async function showDecryptionProgress(operation, message = '') {
    return new Promise((resolve) => {
        let dialog = document.getElementById('decryption-progress-dialog');

        if (!dialog) {
            // Create dialog if it doesn't exist
            dialog = document.createElement('div');
            dialog.id = 'decryption-progress-dialog';
            dialog.className = 'security-dialog-overlay progress-dialog';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'decryption-progress-title');
            document.body.appendChild(dialog);
        }

        let dialogHtml = '';
        let canDismiss = false;

        if (operation === 'decrypting') {
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="decryption-progress-title">🔓 Decrypting Data</h3>
                    <div class="progress-spinner">
                        <div class="spinner"></div>
                    </div>
                    <p id="decryption-progress-message">Decrypting your data...</p>
                    <p><small>Please wait, do not close this window.</small></p>
                    <div class="dialog-actions">
                        <button id="decryption-progress-ok" class="btn btn-primary" disabled>
                            Please Wait...
                        </button>
                    </div>
                </div>
            `;
        } else if (operation === 'success') {
            canDismiss = true;
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="decryption-progress-title">✅ Decryption Successful</h3>
                    <p>${message || 'Your data has been successfully decrypted.'}</p>
                    <div class="dialog-actions">
                        <button id="decryption-progress-ok" class="btn btn-primary">
                            OK
                        </button>
                    </div>
                </div>
            `;
        } else if (operation === 'error') {
            canDismiss = true;
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="decryption-progress-title">❌ Decryption Failed</h3>
                    <p>${message || 'An error occurred while decrypting your data.'}</p>
                    <div class="dialog-actions">
                        <button id="decryption-progress-ok" class="btn btn-primary">
                            OK
                        </button>
                    </div>
                </div>
            `;
        }

        dialog.innerHTML = dialogHtml;

        if (canDismiss) {
            // Add event listener for OK button
            const okButton = dialog.querySelector('#decryption-progress-ok');
            okButton.addEventListener('click', () => {
                document.body.removeChild(dialog);
                resolve();
            });
        }

        if (!canDismiss) {
            // Disable ESC key and overlay click
            dialog.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            document.addEventListener('keydown', function preventEsc(e) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
        }
    });
}

/**
 * Updates the message in an active encryption progress dialog.
 *
 * This helper function allows updating the progress message while
 * the encryption dialog is already showing, useful for providing
 * detailed feedback during long operations.
 *
 * @function
 * @param {string} message - The new message to display
 * @returns {void}
 * @since 2.04.01
 *
 * @example
 * // Update progress message during encryption
 * updateEncryptionProgress('Processing dreams...');
 * // ... encrypt dreams ...
 * updateEncryptionProgress('Processing goals...');
 */
function updateEncryptionProgress(message) {
    const messageElement = document.getElementById('encryption-progress-message');
    if (messageElement) {
        messageElement.textContent = message;
    }
}

/**
 * Re-encrypts all encrypted dreams, goals and autocomplete data under a new password.
 *
 * Every encrypted item is decrypted with the old password and encrypted with the new one
 * in memory first, so a wrong password or a damaged item throws before anything is written.
 * The results are then written in one IndexedDB transaction, so the stores end up either
 * entirely under the old password or entirely under the new one. Items that are not
 * encrypted are left as they are. On success the session password is replaced, the old
 * password's cached key is dropped and the decrypted-data cache is cleared.
 *
 * @async
 * @function
 * @param {string} oldPassword - Current encryption password
 * @param {string} newPassword - New encryption password
 * @returns {Promise<number>} Number of items re-encrypted (dreams, goals and autocomplete lists)
 * @throws {Error} When an item cannot be decrypted or the write does not commit; stored data is unchanged
 * @since 2.03.05
 * @example
 * const count = await reEncryptAllData('old-password', 'new-password');
 */
async function reEncryptAllData(oldPassword, newPassword) {
    try {
        const pending = { dreams: [], goals: [], autocomplete: [] };

        const reEncryptItems = async (items, target) => {
            for (const item of items) {
                if (!isEncryptedItem(item)) continue;
                const decrypted = await decryptItemFromStorage(item, oldPassword);
                target.push(await encryptItemForStorage(decrypted, newPassword));
            }
        };

        updateEncryptionProgress('Re-encrypting dreams...');
        await reEncryptItems(await loadDreamsRaw(), pending.dreams);

        updateEncryptionProgress('Re-encrypting goals...');
        await reEncryptItems(await loadGoalsRaw(), pending.goals);

        updateEncryptionProgress('Re-encrypting autocomplete data...');
        for (const type of ['tags', 'dreamSigns', 'emotions']) {
            const stored = await getAutocompleteSuggestionsRawData(type);
            if (stored) await reEncryptItems([stored], pending.autocomplete);
        }

        updateEncryptionProgress('Saving re-encrypted data...');
        const stores = Object.fromEntries(Object.entries(pending).filter(([, items]) => items.length > 0));
        if (Object.keys(stores).length > 0 && !(await putItemsInStores(stores))) {
            throw new Error('The re-encrypted data could not be saved');
        }

        setEncryptionPassword(newPassword);
        clearDerivedKeys(oldPassword);
        clearDecryptedDataCache();

        return pending.dreams.length + pending.goals.length + pending.autocomplete.length;
    } catch (error) {
        // Nothing was written, so the stored data still uses the old password
        clearDerivedKeys(newPassword);
        console.error('Re-encryption error:', error);
        throw error;
    }
}

/**
 * Updates the message in an active decryption progress dialog.
 *
 * This helper function allows updating the progress message while
 * the decryption dialog is already showing, useful for providing
 * detailed feedback during long operations.
 *
 * @function
 * @param {string} message - The new message to display
 * @returns {void}
 * @since 2.04.01
 *
 * @example
 * // Update progress message during decryption
 * updateDecryptionProgress('Processing dreams...');
 * // ... decrypt dreams ...
 * updateDecryptionProgress('Processing goals...');
 */
function updateDecryptionProgress(message) {
    const messageElement = document.getElementById('decryption-progress-message');
    if (messageElement) {
        messageElement.textContent = message;
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

    
