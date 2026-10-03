/**
 * @fileoverview Settings-tab PIN controls (button labels and lock state) and the PIN removal steps used
 *   by the change-PIN flow.
 *
 * @module PinControls
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { debugLog } from './logger.js';
import { CONSTANTS } from './constants.js';
import { isAppLocked, isUnlocked, setUnlocked, setAppLocked, setFailedPinAttempts } from './state.js';
import { renderPinScreen, showAllTabButtons } from './dom-helpers.js';
import { displayDreams } from './dream-crud.js';
import { isPinSetup, removePinHash } from './pin-core.js';
import { hidePinOverlay, resetPinOverlay } from './pin-overlay.js';

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
// ES MODULE EXPORTS
// ================================

export {
    updateSecurityControls,
    executePinRemoval,
    completePinRemoval,
    showMessage
};
