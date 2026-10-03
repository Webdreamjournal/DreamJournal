/**
 * @fileoverview Theme and pagination preferences: reading, storing and applying them (localStorage).
 *
 * @module Preferences
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { isLocalStorageAvailable } from './storage.js';

// ===================================================================================
// ADVICE TAB & TIPS SYSTEM - MOVED TO ADVICETAB.JS
// ===================================================================================
// Note: displayTip() and handleTipNavigation() functions have been moved to advicetab.js module

// ===================================================================================
// THEME MANAGEMENT SYSTEM
// ===================================================================================
// Complete theme switching system with localStorage persistence
// Supports light and dark themes with fallback handling

/**
 * Retrieves the current theme preference from localStorage.
 * 
 * Attempts to read the user's theme preference from localStorage with a fallback
 * to dark theme if no preference is stored or localStorage is unavailable.
 * 
 * @returns {('light'|'dark')} Current theme preference, defaults to 'dark'
 * @since 1.0.0
 * @example
 * const theme = getCurrentTheme();
 * console.log('Current theme:', theme); // 'light' or 'dark'
 * 
 * @example
 * // Fallback behavior when localStorage unavailable
 * // Always returns 'dark' as safe default
 */
function getCurrentTheme() {
        if (isLocalStorageAvailable()) {
            return localStorage.getItem('dreamJournalTheme') || 'dark';
        }
        return 'dark';
    }

/**
 * Stores theme preference to localStorage with error handling.
 * 
 * Safely persists the user's theme choice to localStorage, with graceful error
 * handling for cases where localStorage is unavailable or storage quota is exceeded.
 * 
 * @param {('light'|'dark')} theme - Theme preference to store
 * @returns {void}
 * @throws {TypeError} When theme is not a valid theme string
 * @since 1.0.0
 * @example
 * storeTheme('dark');
 * storeTheme('light');
 * 
 * @example
 * // Graceful handling of storage errors
 * storeTheme('dark'); // Warns in console if storage fails, doesn't throw
 */
function storeTheme(theme) {
        if (isLocalStorageAvailable()) {
            try {
                localStorage.setItem('dreamJournalTheme', theme);
            } catch (error) {
                console.warn('Failed to store theme preference:', error);
            }
        }
    }

/**
 * Applies theme to document root and updates UI controls.
 * 
 * Sets the data-theme attribute on the document root element and updates any
 * theme selection controls in the UI. Validates the theme value and provides
 * a safe fallback to dark theme for invalid inputs.
 * 
 * @param {('light'|'dark')} theme - Theme to apply to the application
 * @returns {void}
 * @since 1.0.0
 * @example
 * applyTheme('dark');
 * // Sets document.documentElement.setAttribute('data-theme', 'dark')
 * 
 * @example
 * // Invalid theme falls back to dark
 * applyTheme('invalid'); // Applies 'dark' theme instead
 * applyTheme(null); // Applies 'dark' theme instead
 */
function applyTheme(theme) {
        if (!theme || !['light', 'dark'].includes(theme)) {
            theme = 'dark';
        }
        
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update theme select if it exists
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.value = theme;
        }
        
        storeTheme(theme);
    }

/**
 * Switches theme with validation and user feedback.
 * 
 * Comprehensive theme switching function that validates input, applies the new theme,
 * updates all UI controls, and provides user feedback. Includes sophisticated feedback
 * positioning to display messages in the most appropriate location.
 * 
 * @param {('light'|'dark')} newTheme - New theme to apply
 * @returns {void}
 * @throws {TypeError} When newTheme is not a valid theme string
 * @since 1.0.0
 * @todo Consider splitting into separate theme switching and UI feedback functions
 * @example
 * // Switch to light theme with automatic feedback
 * switchTheme('light');
 * // Updates theme, shows "Switched to light theme!" message
 * 
 * @example
 * // Invalid theme is ignored
 * switchTheme('invalid'); // No action taken
 * switchTheme(null); // No action taken
 */
function switchTheme(newTheme) {
        if (!newTheme || !['light', 'dark'].includes(newTheme)) {
            return;
        }
        
        applyTheme(newTheme);
        
        // Update any visible theme selects
        const themeSelects = document.querySelectorAll('#themeSelect');
        themeSelects.forEach(select => {
            if (select.value !== newTheme) {
                select.value = newTheme;
            }
        });
        
        // Show feedback specifically in the Appearance settings section
        const appearanceSection = document.querySelector('.settings-section h3');
        let targetContainer = null;
        
        if (appearanceSection && appearanceSection.textContent.includes('Appearance')) {
            targetContainer = appearanceSection.parentElement;
        }
        
        // Fallback to active tab if appearance section not found
        if (!targetContainer) {
            targetContainer = document.querySelector('.tab-panel.active');
        }
        
        if (targetContainer) {
            // Remove any existing theme messages first
            const existingMsg = targetContainer.querySelector('.theme-feedback-message');
            if (existingMsg) {
                existingMsg.remove();
            }
            
            // Create the message element directly for precise placement
            const msgDiv = document.createElement('div');
            msgDiv.className = 'theme-feedback-message';
            msgDiv.style.cssText = `
                background: var(--notification-success-bg);
                color: var(--success-color);
                padding: 10px 15px;
                border-radius: var(--border-radius);
                margin: 10px 0;
                font-weight: var(--font-weight-semibold);
                text-align: center;
                font-size: 14px;
            `;
            msgDiv.textContent = `Switched to ${newTheme} theme!`;
            
            // Find the appearance section and insert after it
            if (appearanceSection && appearanceSection.textContent.includes('Appearance')) {
                const appearanceDiv = appearanceSection.parentElement;
                appearanceDiv.insertBefore(msgDiv, appearanceDiv.children[1]);
            } else {
                // Fallback to inserting at the top
                targetContainer.insertBefore(msgDiv, targetContainer.firstChild);
            }
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                if (msgDiv && msgDiv.parentNode) {
                    msgDiv.remove();
                }
            }, 3000);
        }
    }

// ===================================================================================
// PAGINATION PREFERENCE MANAGEMENT
// ===================================================================================
// Complete pagination preference system with localStorage persistence
// Supports saving and loading user's pagination limit preference

/**
 * Retrieves the current pagination preference from localStorage.
 *
 * Attempts to read the user's pagination preference from localStorage with a fallback
 * to the default pagination limit if no preference is stored or localStorage is unavailable.
 *
 * @returns {string} Current pagination preference ('5', '10', '20', '50', 'endless', 'all'), defaults to 'endless'
 * @since 2.04.01
 * @example
 * const paginationLimit = getCurrentPaginationPreference();
 * console.log('Current pagination:', paginationLimit); // 'endless', '10', etc.
 *
 * @example
 * // Fallback behavior when localStorage unavailable
 * // Always returns 'endless' as safe default
 */
function getCurrentPaginationPreference() {
    if (isLocalStorageAvailable()) {
        return localStorage.getItem('dreamJournalPaginationLimit') || 'endless';
    }
    return 'endless';
}

/**
 * Stores pagination preference to localStorage with error handling.
 *
 * Safely persists the user's pagination preference to localStorage, with graceful error
 * handling for cases where localStorage is unavailable or storage quota is exceeded.
 *
 * @param {string} preference - Pagination preference to store ('5', '10', '20', '50', 'endless', 'all')
 * @returns {void}
 * @since 2.04.01
 * @example
 * storePaginationPreference('10');
 * storePaginationPreference('endless');
 *
 * @example
 * // Graceful handling of storage errors
 * storePaginationPreference('20'); // Warns in console if storage fails, doesn't throw
 */
function storePaginationPreference(preference) {
    if (isLocalStorageAvailable()) {
        try {
            localStorage.setItem('dreamJournalPaginationLimit', preference);
        } catch (error) {
            console.warn('Failed to store pagination preference:', error);
        }
    }
}

// ================================
// ES MODULE EXPORTS
// ================================

export {
    getCurrentTheme,
    storeTheme,
    applyTheme,
    switchTheme,
    getCurrentPaginationPreference,
    storePaginationPreference
};
