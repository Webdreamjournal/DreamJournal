/**
 * @fileoverview Progressive Web App (PWA) installation and management module.
 * 
 * This module handles PWA installation prompts, user interaction with installation UI,
 * and manages the deferred installation prompt lifecycle. It provides a clean interface
 * for PWA installation functionality that can be used across different modules without
 * creating circular dependencies.
 * 
 * @module PWA
 * @version 2.02.22
 * @author Dream Journal Development Team
 * @since 2.02.22
 * @example
 * import { installPWA, setupPWAInstall } from './pwa.js';
 * 
 * // Setup PWA installation system
 * setupPWAInstall();
 * 
 * // Install PWA when user clicks button
 * await installPWA();
 */

// ================================
// PWA INSTALLATION SYSTEM
// ================================

/**
 * Global variable to store the browser's beforeinstallprompt event.
 * This event is captured and deferred until the user explicitly chooses to install the PWA.
 * 
 * @type {Event|null}
 * @global
 * @since 2.02.22
 */
let deferredPrompt;

/**
 * Handle PWA installation when user clicks the install button.
 * 
 * This function processes the deferred installation prompt that was captured during
 * the beforeinstallprompt event. It shows the browser's installation dialog and
 * handles the user's response, cleaning up the UI accordingly.
 * 
 * @async
 * @function
 * @returns {Promise<void>} Promise that resolves when installation handling is complete
 * @since 2.02.22
 * @example
 * // Called automatically when user clicks install button
 * await installPWA();
 * // Installation prompt shown and result handled
 */
async function installPWA() {
    if (!deferredPrompt) {
        console.log('No install prompt available');
        return;
    }

    try {
        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // Clear the deferredPrompt
        deferredPrompt = null;
        
        // Hide the install button regardless of user choice
        const installButton = document.querySelector('#installPwaButton');
        if (installButton) {
            installButton.style.display = 'none';
        }
    } catch (error) {
        console.error('Error during PWA installation:', error);
        // Clear the prompt on error
        deferredPrompt = null;
    }
}

/**
 * Create and inject PWA installation section into settings page.
 * 
 * This function dynamically creates and injects a PWA installation section into the
 * settings page when PWA installation becomes available (triggered by the beforeinstallprompt
 * event). The section includes an install button and status display.
 * 
 * The function prevents duplicate sections by checking for existing PWA sections and
 * strategically places the new section before the security section for optimal UX flow.
 * 
 * @function
 * @returns {void}
 * @since 2.02.22
 * @example
 * createPWASection();
 * // PWA installation UI now appears in settings
 */
function createPWASection() {
    // Check if PWA section already exists
    const existingSection = document.querySelector('#pwaInstallSection');
    if (existingSection) {
        return;
    }
    
    // Find the security section to insert PWA section before it
    const securitySection = document.querySelector('.settings-section h3');
    if (!securitySection || !securitySection.textContent.includes('Security')) {
        return;
    }
    
    const securitySectionContainer = securitySection.parentElement;
    
    // Create PWA section HTML
    const pwaSection = document.createElement('div');
    pwaSection.className = 'settings-section';
    pwaSection.id = 'pwaInstallSection';
    pwaSection.innerHTML = `
        <h3>📱 Progressive Web App</h3>
        <div class="settings-row">
            <div>
                <div class="settings-label">Install App</div>
                <div class="settings-description">Install Dream Journal as a native app on your device</div>
            </div>
            <div class="settings-controls">
                <button data-action="install-pwa" id="installPwaButton" class="btn btn-primary">📱 Install App</button>
                <div id="pwaInstallStatus" class="text-secondary text-sm" style="display: none;"></div>
            </div>
        </div>
    `;
    
    // Insert PWA section before security section
    securitySectionContainer.parentElement.insertBefore(pwaSection, securitySectionContainer);
}

/**
 * Remove PWA installation section from settings page.
 * 
 * This function removes the PWA installation section from the settings page when it's
 * no longer needed. This occurs when the app has been successfully installed or when
 * the browser indicates PWA installation is no longer available.
 * 
 * Provides clean UI management by removing installation prompts after they've served
 * their purpose, preventing user confusion and interface clutter.
 * 
 * @function
 * @returns {void}
 * @since 2.02.22
 * @example
 * removePWASection();
 * // PWA installation UI is removed from settings
 */
function removePWASection() {
    const pwaSection = document.querySelector('#pwaInstallSection');
    if (pwaSection) {
        pwaSection.remove();
    }
}

/**
 * Set up PWA installation event listeners and prompt management.
 * 
 * This function registers the beforeinstallprompt event listener to capture
 * the browser's PWA installation prompt and defer it for user-initiated installation.
 * It also handles the appinstalled event for cleanup after successful installation.
 * 
 * @function
 * @returns {void}
 * @since 2.02.22
 * @example
 * setupPWAInstall();
 * // PWA installation system is now active and will respond to browser events
 */
function setupPWAInstall() {
    // Capture the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        // Stash the event so it can be triggered later by the button
        deferredPrompt = e;
        window.deferredPrompt = e;

        // Create and show the PWA section in settings if we're on settings tab
        const settingsTab = document.getElementById('settingsTab');
        if (settingsTab && settingsTab.style.display !== 'none') {
            createPWASection();
        }
    });

    // Handle successful PWA installation
    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        
        // Show success message for a few seconds then remove the section
        const statusDiv = document.querySelector('#pwaInstallStatus');
        if (statusDiv) {
            statusDiv.textContent = 'App has been installed successfully!';
            statusDiv.style.display = 'block';
            
            // Remove entire section after showing success message
            setTimeout(() => {
                removePWASection();
            }, 3000);
        } else {
            // If no status div, remove section immediately
            removePWASection();
        }
        
        // Clear the deferredPrompt
        deferredPrompt = null;
        window.deferredPrompt = null;
    });
}

// ================================
// MODULE EXPORTS
// ================================

export {
    installPWA,
    setupPWAInstall,
    createPWASection,
    removePWASection
};