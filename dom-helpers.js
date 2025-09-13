/**
 * @fileoverview DOM manipulation and UI component utilities for the Dream Journal application.
 * 
 * This module provides comprehensive DOM manipulation utilities, UI component creation functions,
 * and consistent styling helpers. All functions are designed to work with the application's
 * HSL-based theme system and centralized event handling via data-action attributes.
 * 
 * @module DOMHelpers
 * @version 2.02.48
 * @author Dream Journal Development Team
 * @since 1.0.0
 * @requires constants
 * @requires state
 * @example
 * import * as DOMHelpers from './dom-helpers.js';
 * 
 * const button = DOMHelpers.createActionButton('save-dream', '123', 'Save Dream');
 * DOMHelpers.createInlineMessage('success', 'Dream saved successfully!');
 */

// ===================================================================================
// ES MODULE IMPORTS
// ===================================================================================

import { CONSTANTS, DREAM_FORM_COLLAPSE_KEY } from './constants.js';
import { 
    getActiveAppTab,
    setActiveAppTab,
    getAppLocked,
    setAppLocked,
    getPreLockActiveTab,
    setPreLockActiveTab,
    getDailyTips,
    getCurrentTipIndex,
    setCurrentTipIndex,
    getIsDreamFormCollapsed,
    setIsDreamFormCollapsed,
    asyncMutex,
    getActiveVoiceTab,
    setActiveVoiceTab
} from './state.js';
import { isLocalStorageAvailable, getAutocompleteSuggestions } from './storage.js';
import { getResetTime, updateSecurityControls } from './security.js';
import { initGoals, renderGoalsTab, initializeGoalsTab } from './goalstab.js';
import { renderJournalTab, initializeJournalTab } from './journaltab.js';
import { renderStatsTab, initializeStatsTab } from './statstab.js';
import { renderAdviceTab, initializeAdviceTab } from './advicetab.js';
import { displayVoiceNotes, getVoiceCapabilities } from './voice-notes.js';
import { renderSettingsTab, initializeSettingsTab } from './settingstab.js';

// ===================================================================================
// DOM & UI HELPER FUNCTIONS
// ===================================================================================
// Comprehensive DOM manipulation and UI component utilities
// Provides consistent styling, event handling, and user interface components

// ===================================================================================
// BUTTON & ACTION ELEMENT CREATION
// ===================================================================================

/**
 * Creates an action button with consistent data attributes and styling.
 * 
 * Automatically generates appropriate ID attributes based on action type and integrates
 * with the application's centralized event handling system via data-action attributes.
 * Supports custom styling and additional HTML attributes.
 * 
 * @param {string} action - The action identifier for event handling (e.g., 'save-dream', 'delete-voice-note')
 * @param {string|null} id - Unique identifier for the target item (used for data-*-id attributes)
 * @param {string} text - Button display text (will be HTML escaped)
 * @param {string} [className='btn'] - CSS classes to apply to the button
 * @param {Object} [extraAttrs={}] - Additional HTML attributes as key-value pairs
 * @returns {string} HTML string for the complete button element
 * @throws {TypeError} When action or text parameters are not strings
 * @since 1.0.0
 * @example
 * // Basic button
 * const saveBtn = createActionButton('save-dream', null, 'Save Dream');
 * // Returns: '<button data-action="save-dream" class="btn">Save Dream</button>'
 * 
 * @example
 * // Button with ID and custom styling
 * const editBtn = createActionButton('edit-dream', '123', 'Edit', 'btn btn-secondary', {
 *   title: 'Edit this dream entry',
 *   'aria-label': 'Edit dream'
 * });
 * 
 * @example
 * // Voice note button (auto-detects voice-note ID attribute)
 * const playBtn = createActionButton('play-voice-note', 'note-456', 'Play');
 * // Returns button with data-voice-note-id="note-456"
 */
function createActionButton(action, id, text, className = 'btn', extraAttrs = {}) {
        // Build extra attributes string with proper escaping
        const attrs = Object.entries(extraAttrs)
            .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
            .join(' ');
        
        // Auto-detect and set appropriate ID attribute based on action type
        const idAttr = id ? `data-${action.includes('dream') ? 'dream' : 'voice-note'}-id="${escapeAttr(id)}"` : '';
        
        return `<button data-action="${action}" ${idAttr} class="${className}" ${attrs}>${text}</button>`;
    }

// ===================================================================================
// MESSAGE & NOTIFICATION SYSTEM
// ===================================================================================

/**
 * Creates an inline notification message with consistent styling and auto-hide functionality.
 * 
 * Provides a unified notification system supporting multiple message types with customizable
 * display options. Messages can be automatically positioned and hidden after a specified duration.
 * Integrates with the application's CSS theme system for consistent styling.
 * 
 * @param {('success'|'error'|'warning'|'info')} type - Message type determining styling and auto-hide duration
 * @param {string} text - Message content to display (will be safely escaped)
 * @param {Object} [options={}] - Configuration options for message display
 * @param {Element|null} [options.container=null] - Target container to append message (if null, returns element only)
 * @param {('top'|'bottom')} [options.position='top'] - Insert position within container
 * @param {boolean} [options.autoHide=true] - Whether to automatically remove message after duration
 * @param {number} [options.duration] - Auto-hide duration in milliseconds (defaults: success=3000, others=5000)
 * @param {string} [options.className=''] - Additional CSS classes to apply
 * @returns {Element} The created message element
 * @throws {TypeError} When type is not a valid message type
 * @since 1.0.0
 * @example
 * // Basic success message with auto-hide
 * const container = document.getElementById('messagesContainer');
 * createInlineMessage('success', 'Dream saved successfully!', { container });
 * 
 * @example
 * // Error message with custom duration and positioning
 * createInlineMessage('error', 'Failed to save dream', {
 *   container: document.querySelector('.form-container'),
 *   position: 'bottom',
 *   duration: 8000,
 *   autoHide: true
 * });
 * 
 * @example
 * // Manual message handling (no container)
 * const msgElement = createInlineMessage('info', 'Processing request...');
 * // Manually append and control the message element
 * document.body.appendChild(msgElement);
 */
function createInlineMessage(type, text, options = {}) {
        const {
            container = null, // Target container to append message
            position = 'top', // Insert position: 'top' or 'bottom'
            autoHide = true, // Whether to automatically remove message
            duration = type === 'success' ? 3000 : 5000, // Auto-hide duration (success = 3s, others = 5s)
            className = '' // Additional CSS classes
        } = options;
        
        // Create message element with consistent styling
        const msg = document.createElement('div');
        msg.className = `message-base message-${type} ${className}`.trim();
        msg.textContent = text;
        
        // Insert message into specified container
        if (container) {
            if (position === 'top') {
                container.insertBefore(msg, container.firstChild);
            } else {
                container.appendChild(msg);
            }
            
            // Set up auto-hide timer if enabled
            if (autoHide) {
                setTimeout(() => {
                    if (msg && msg.parentNode) {
                        msg.remove();
                    }
                }, duration);
            }
        }
        
        return msg;
    }

/**
 * Creates a formatted metadata display with labels and values.
 * 
 * Processes an array of metadata items, filtering out empty values and formatting
 * them with consistent styling. Supports both labeled and value-only items with
 * HTML content support and automatic escaping for security.
 * 
 * @param {Array<MetaItem>} items - Array of metadata items to display
 * @returns {string} HTML string with formatted metadata items joined by bullet separators
 * @throws {TypeError} When items parameter is not an array
 * @since 1.0.0
 * @example
 * // Mixed labeled and value-only items
 * const metadata = createMetaDisplay([
 *   { label: 'Date', value: '2023-10-15' },
 *   { label: 'Type', value: 'Lucid Dream' },
 *   { value: 'High Vividness' },
 *   { label: 'Duration', value: '45 minutes', isHTML: false }
 * ]);
 * // Returns: "Date: 2023-10-15 • Type: Lucid Dream • High Vividness • Duration: 45 minutes"
 * 
 * @example
 * // With HTML content
 * const htmlMeta = createMetaDisplay([
 *   { label: 'Tags', value: '<span class="tag">lucid</span>', isHTML: true }
 * ]);
 */

/**
 * Represents a metadata item for display formatting.
 * 
 * @typedef {Object} MetaItem
 * @property {string} [label] - Optional label for the item (will be HTML escaped)
 * @property {string} value - Item value content
 * @property {boolean} [isHTML=false] - Whether value contains safe HTML (skips escaping)
 */
function createMetaDisplay(items) {
        return items
            .filter(item => item && item.value) // Remove empty/invalid items
            .map(item => {
                if (item.label) {
                    // Labeled item format: "Label: Value"
                    const labelHtml = escapeHtml(item.label);
                    const valueHtml = item.isHTML ? item.value : escapeHtml(item.value);
                    return `<span class="meta-item">${labelHtml}: ${valueHtml}</span>`;
                } else {
                    // Value-only format
                    const valueHtml = item.isHTML ? item.value : escapeHtml(item.value);
                    return `<span class="meta-item">${valueHtml}</span>`;
                }
            })
            .join(' • '); // Join with bullet separator
    }

// ===================================================================================
// SECURITY & SANITIZATION FUNCTIONS
// ===================================================================================

/**
 * Escapes HTML characters to prevent XSS attacks in user-generated content.
 * 
 * Uses the browser's DOM API to safely convert potentially dangerous characters
 * into their HTML entity equivalents. This approach ensures complete and reliable
 * escaping without maintaining custom character maps.
 * 
 * @param {*} text - Text content to escape (will be converted to string)
 * @returns {string} HTML-escaped string safe for insertion into DOM
 * @since 1.0.0
 * @example
 * const userInput = '<script>alert("xss")</script>';
 * const safe = escapeHtml(userInput);
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 * 
 * @example
 * // Handles null/undefined gracefully
 * escapeHtml(null); // Returns: ''
 * escapeHtml(undefined); // Returns: ''
 * escapeHtml(123); // Returns: '123'
 */
function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text); // Safely sets text content
    return div.innerHTML; // Returns HTML-escaped version
}

/**
 * Escapes HTML attribute values to prevent attribute injection attacks.
 * 
 * Specifically targets quote characters that could break out of HTML attributes.
 * Essential for safely inserting user content into HTML attribute values like
 * data attributes, titles, and other dynamic attributes.
 * 
 * @param {*} text - Attribute value to escape (will be converted to string)
 * @returns {string} Attribute-safe string with quotes properly escaped
 * @since 1.0.0
 * @example
 * const title = 'Dream about "flying" and other things';
 * const safeAttr = escapeAttr(title);
 * // Returns: 'Dream about &quot;flying&quot; and other things'
 * 
 * @example
 * // Usage in HTML attribute construction
 * const buttonHtml = `<button title="${escapeAttr(userTitle)}">Click</button>`;
 * 
 * @example
 * // Handles various input types
 * escapeAttr(null); // Returns: ''
 * escapeAttr("It's a 'test'"); // Returns: 'It&#39;s a &#39;test&#39;'
 */
function escapeAttr(text) {
    if (text == null) return '';
    return String(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===================================================================================
// PAGINATION SYSTEM
// ===================================================================================

/**
 * Generates complete pagination HTML with navigation buttons and page numbers.
 * 
 * Creates a full pagination interface including previous/next buttons, numbered page links,
 * and ellipsis indicators for large page counts. Integrates with the application's event
 * system using data-action attributes and provides proper accessibility features.
 * 
 * @param {number} currentPage - Currently active page number (1-based)
 * @param {number} totalPages - Total number of available pages
 * @param {string} actionPrefix - Action prefix for pagination buttons (e.g., 'paginate-dreams')
 * @returns {string} Complete HTML string for pagination component, or empty string if ≤1 page
 * @throws {TypeError} When currentPage or totalPages are not positive numbers
 * @throws {RangeError} When currentPage exceeds totalPages
 * @since 1.0.0
 * @example
 * // Basic pagination for dreams list
 * const paginationHtml = createPaginationHTML(3, 10, 'paginate-dreams');
 * // Creates pagination with buttons like data-action="paginate-dreams" data-page="4"
 * 
 * @example
 * // Single page (no pagination needed)
 * createPaginationHTML(1, 1, 'paginate-goals'); // Returns: ''
 * 
 * @example
 * // Large page count with ellipsis
 * createPaginationHTML(15, 50, 'paginate-entries');
 * // Results in: [‹ Previous] [1] [...] [13] [14] [15] [16] [17] [...] [50] [Next ›]
 */
function createPaginationHTML(currentPage, totalPages, actionPrefix) {
        // No pagination needed for single page
        if (totalPages <= 1) return '';
        
        let paginationHTML = '<nav aria-label="Dream entries pagination" role="navigation"><div class="pagination">';
        
        // Previous page button (only if not on first page)
        if (currentPage > 1) {
            paginationHTML += `<button data-action="${actionPrefix}" data-page="${currentPage - 1}" class="btn btn-outline btn-small">‹ Previous</button>`;
        }
        
        // Calculate visible page number range
        const maxVisiblePages = 5; // Maximum page numbers to show
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // Adjust start page if we're near the end to maintain max visible pages
        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // First page and ellipsis
        if (startPage > 1) {
            paginationHTML += `<button data-action="${actionPrefix}" data-page="1" class="btn btn-outline btn-small">1</button>`;
            if (startPage > 2) {
                paginationHTML += '<span class="pagination-ellipsis">...</span>';
            }
        }
        
        // Page number buttons
        for (let i = startPage; i <= endPage; i++) {
            const isCurrentPage = i === currentPage;
            const buttonClass = isCurrentPage ? 'btn btn-primary btn-small' : 'btn btn-outline btn-small';
            paginationHTML += `<button data-action="${actionPrefix}" 
                        data-page="${i}" 
                        class="${buttonClass}" 
                        ${isCurrentPage ? 'disabled aria-current="page"' : ''}
                        aria-label="Page ${i}${isCurrentPage ? ', current page' : ''}">${i}</button>`;
        }
        
        // Last page and ellipsis
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += '<span class="pagination-ellipsis">...</span>';
            }
            paginationHTML += `<button data-action="${actionPrefix}" data-page="${totalPages}" class="btn btn-outline btn-small">${totalPages}</button>`;
        }
        
        // Next button
        if (currentPage < totalPages) {
            paginationHTML += `<button data-action="${actionPrefix}" data-page="${currentPage + 1}" class="btn btn-outline btn-small">Next ›</button>`;
        }
        
        paginationHTML += '</div></nav>';
        return paginationHTML;
    }

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
// TAB MANAGEMENT SYSTEM
// ===================================================================================
// Complete tab switching system with dynamic content generation
// Handles lock screen transitions and tab-specific initialization
// TODO: Consider splitting this large function into separate tab creation and switching functions

/**
 * Switches between application tabs with dynamic content generation.
 * 
 * Comprehensive tab management system that handles tab switching, content creation,
 * lock screen transitions, and tab-specific initialization. Dynamically creates tab
 * content if it doesn't exist and manages application state during tab transitions.
 * 
 * @param {('journal'|'goals'|'stats'|'advice'|'settings'|'lock')} tabName - Target tab identifier
 * @returns {void}
 * @throws {TypeError} When tabName is not a valid tab identifier
 * @since 1.0.0
 * @todo Consider splitting this large function into separate tab creation and switching functions
 * @example
 * // Switch to journal tab
 * switchAppTab('journal');
 * 
 * @example
 * // Handle lock screen transition
 * switchAppTab('lock'); // Hides other tabs, shows lock interface
 * 
 * @example
 * // Tab-specific initialization
 * switchAppTab('stats'); // Automatically initializes calendar
 * switchAppTab('goals'); // Refreshes goals from storage
 */
function switchAppTab(tabName, isInitialLoad = false) {
        if (!tabName || !['journal', 'goals', 'stats', 'advice', 'settings', 'lock'].includes(tabName)) return;
        
        // Handle lock screen transitions
        if (tabName === 'lock') {
            // Switching TO lock screen
            if (!getAppLocked()) {
                setPreLockActiveTab(getActiveAppTab()); // Remember current tab
                setAppLocked(true);
                hideAllTabButtons();
            }
        } else {
            // Switching FROM lock screen to another tab
            if (getAppLocked()) {
                setAppLocked(false);
                showAllTabButtons();
            }
        }
        
        // Update the lock tab button visibility based on app state
        const lockTabButton = document.querySelector('.app-tab[data-tab="lock"]');
        if (lockTabButton) {
            if (tabName === 'lock') {
                // Show lock tab button when on lock screen
                lockTabButton.style.display = 'block';
            } else {
                // Hide lock tab button when not on lock screen (users should use lock button instead)
                lockTabButton.style.display = 'none';
            }
        }
        
        // CRITICAL FIX: Ensure tab container exists with robust fallback
        let tabContainer = document.querySelector('.tab-content-container');
        if (!tabContainer) {
            console.warn('Tab container not found during switchAppTab, attempting to create it');
            
            const containerDiv = document.querySelector('.container');
            const appTabs = document.querySelector('.app-tabs');
            
            if (containerDiv && appTabs) {
                tabContainer = document.createElement('div');
                tabContainer.className = 'tab-content-container';
                tabContainer.style.cssText = `
                    background: var(--bg-primary);
                    min-height: 400px;
                    overflow-x: hidden;
                `;
                
                appTabs.parentNode.insertBefore(tabContainer, appTabs.nextSibling);
                console.log('Tab container created during switchAppTab');
            } else {
                console.error('Cannot create tab container - missing DOM elements');
                return;
            }
        }
        
        // Ensure all tab panels exist
        const requiredTabs = ['journalTab', 'goalsTab', 'statsTab', 'adviceTab', 'settingsTab', 'lockTab'];
        requiredTabs.forEach(tabId => {
            if (!document.getElementById(tabId)) {
                const tabPanel = document.createElement('div');
                tabPanel.id = tabId;
                tabPanel.className = 'tab-panel';
                tabPanel.setAttribute('role', 'tabpanel');
                // Extract tab name from tabId (e.g., 'journalTab' -> 'journal')
                const panelTabName = tabId.replace('Tab', '');
                tabPanel.setAttribute('aria-labelledby', `tab-${panelTabName}`);
                
                if (tabId === 'goalsTab') {
                    // Goals tab is now handled by the dedicated goalstab.js module
                    try {
                        renderGoalsTab(tabPanel);
                    } catch (error) {
                        console.error('Error rendering Goals tab:', error);
                        tabPanel.innerHTML = '<div class="error-message">Error loading Goals tab. Please refresh the page.</div>';
                    }
                } else if (tabId === 'statsTab') {
                    // Stats tab is now handled by the dedicated statstab.js module
                    try {
                        renderStatsTab(tabPanel);
                    } catch (error) {
                        console.error('Error rendering stats tab:', error);
                        tabPanel.innerHTML = `
                            <div class="message-error">
                                Failed to load statistics tab. Please refresh and try again.
                            </div>
                        `;
                    }
                } else if (tabId === 'adviceTab') {
                    // Advice tab is now handled by the dedicated advicetab.js module
                    try {
                        renderAdviceTab(tabPanel);
                    } catch (error) {
                        console.error('Error rendering advice tab:', error);
                        // Fallback if advicetab.js fails
                        tabPanel.innerHTML = `
                            <div class="message-base message-error">
                                <h3>Advice Loading...</h3>
                                <p>The advice interface is temporarily unavailable. Please refresh the page and try again.</p>
                                <p class="text-sm">Error details: ${escapeHtml(error.message)}</p>
                            </div>
                        `;
                    }
                } else if (tabId === 'settingsTab') {
                    // Settings tab is now handled by the dedicated settingstab.js module
                    try {
                        renderSettingsTab(tabPanel);
                    } catch (error) {
                        console.error('Error rendering settings tab:', error);
                        tabPanel.innerHTML = `
                            <div class="message-base message-error">
                                <h3>Settings Temporarily Unavailable</h3>
                                <p>There was an error loading the settings interface. Please refresh the page and try again.</p>
                                <p class="text-sm">Error details: ${error.message}</p>
                            </div>
                        `;
                    }
                } else if (tabId === 'journalTab') {
                    // Journal tab is now handled by the dedicated journaltab.js module
                    try {
                        renderJournalTab(tabPanel);
                    } catch (error) {
                        console.error('Error rendering Journal tab:', error);
                        tabPanel.innerHTML = `
                            <div class="message-error">
                                Error loading Journal tab. Please refresh the page.
                                <button onclick="location.reload()" class="btn btn-primary mt-sm">Refresh</button>
                            </div>
                        `;
                    }
                } else if (tabId === 'lockTab') {
                    // Check if there's an active timer to show instructional text
                    const resetTime = getResetTime();
                    let timerInstructions = '';
                    
                    if (resetTime) {
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
                    
                    tabPanel.innerHTML = `
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
                }
                
                tabContainer.appendChild(tabPanel);
            }
        });
        
        // Render content for existing tabs that may be empty
        const existingJournalTab = document.getElementById('journalTab');
        if (existingJournalTab && (!existingJournalTab.innerHTML.trim() || existingJournalTab.innerHTML.includes('Content dynamically generated by journaltab.js'))) {
            try {
                renderJournalTab(existingJournalTab);
            } catch (error) {
                console.error('Error rendering existing Journal tab:', error);
                existingJournalTab.innerHTML = `
                    <div class="message-error">
                        Error loading Journal tab. Please refresh the page.
                        <button onclick="location.reload()" class="btn btn-primary mt-sm">Refresh</button>
                    </div>
                `;
            }
        }
        
        // Update tab panels
        const tabs = document.querySelectorAll('.tab-panel');
        
        tabs.forEach(tab => {
            const expectedId = tabName + 'Tab';
            if (tab.id === expectedId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Update tab buttons with ARIA states
        const tabButtons = document.querySelectorAll('.app-tab[role="tab"]');
        tabButtons.forEach(button => {
            const buttonTab = button.dataset.tab;
            if (buttonTab === tabName) {
                button.classList.add('active');
                button.setAttribute('aria-selected', 'true');
                button.setAttribute('tabindex', '0');
            } else {
                button.classList.remove('active');
                button.setAttribute('aria-selected', 'false');
                button.setAttribute('tabindex', '-1');
            }
        });
        
        // Show/hide footer based on active tab
        const footer = document.querySelector('footer');
        if (footer) {
            if (tabName === 'journal' && !getAppLocked()) {
                footer.style.display = 'block';
            } else {
                footer.style.display = 'none';
            }
        }
        
        setActiveAppTab(tabName);
        
        // Auto-focus PIN input on lock screen
        if (tabName === 'lock') {
            setTimeout(() => {
                const lockScreenPinInput = document.getElementById('lockScreenPinInput');
                if (lockScreenPinInput) {
                    lockScreenPinInput.focus();
                }
            }, CONSTANTS.FOCUS_DELAY_MS);
        }
        
        // Update security controls when switching to journal tab (for consistency)
        if (tabName === 'journal') {
            updateSecurityControls();
        }
        
        // Initialize calendar if stats tab is selected
        if (tabName === 'stats') {
            initializeStatsTab();
        }
        
        // Display goals if goals tab is selected
        if (tabName === 'goals') {
            // Initialize goals tab with fresh data when switching to goals tab
            // This ensures we always have the latest data
            initializeGoalsTab().catch(error => {
                console.error('Error initializing Goals tab:', error);
            });
        }

        // ALWAYS update settings when switching to settings tab (whether new or existing)
        if (tabName === 'settings') {
            // Initialize settings tab using the dedicated settingstab.js module
            try {
                initializeSettingsTab();
            } catch (error) {
                console.error('Error initializing settings tab:', error);
            }
        }

        // Initialize advice tab when switched to
        if (tabName === 'advice') {
            initializeAdviceTab().catch(error => {
                console.error('Failed to initialize advice tab:', error);
            });
        }

        // ARIA: Announce tab change (skip during initial load)
        if (!isInitialLoad) {
            const announcer = document.getElementById('route-announcer');
            if (announcer) {
                const friendlyTabName = tabName.charAt(0).toUpperCase() + tabName.slice(1);
                announcer.textContent = `Switched to ${friendlyTabName} page`;
            }
        }

        // ARIA: Move focus to main heading of new tab (skip during initial load)
        if (!isInitialLoad) {
            setTimeout(() => {
                const headingId = `${tabName}-main-heading`;
                const mainHeading = document.getElementById(headingId);
                if (mainHeading) {
                    mainHeading.focus();
                }
            }, 150); // Small delay to ensure content is ready
        }
    }

// ===================================================================================
// TAB BUTTON VISIBILITY CONTROL
// ===================================================================================

/**
 * Hides all tab buttons except the lock tab.
 * 
 * Used when the application is locked to restrict user access to only the lock screen.
 * Provides visual feedback that the application is in a secured state.
 * 
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Called when PIN protection activates
 * hideAllTabButtons();
 * // Only the lock tab button remains visible
 */
function hideAllTabButtons() {
    const tabButtons = document.querySelectorAll('.app-tab');
    tabButtons.forEach(button => {
        if (button.dataset.tab !== 'lock') {
            button.style.display = 'none';
        }
    });
    console.log('Hid all tab buttons except lock tab');
}
        
/**
 * Shows all tab buttons except the lock tab.
 * 
 * Used when the application is unlocked to restore full navigation access.
 * The lock tab is hidden because users should use the lock button instead
 * of navigating directly to the lock tab.
 * 
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Called when PIN verification succeeds
 * showAllTabButtons();
 * // All main tabs become accessible again
 */
function showAllTabButtons() {
    const tabButtons = document.querySelectorAll('.app-tab');
    tabButtons.forEach(button => {
        if (button.dataset.tab !== 'lock') {
            button.style.display = 'block';
        }
    });
    console.log('Showed all tab buttons');
}

// ===================================================================================
// SETTINGS SYNCHRONIZATION SYSTEM
// ===================================================================================

/**
 * Synchronizes settings display elements across different UI contexts.
 * 
 * Ensures consistency between various settings interfaces throughout the application,
 * including PIN controls, theme selectors, encryption checkboxes, and storage information.
 * Critical for maintaining UI state coherence across different tabs and contexts.
 * 
 * @returns {void}
 * @since 1.0.0
 * @todo Consider splitting into separate PIN, theme, and storage sync functions
 * @example
 * // Called when switching to settings tab
 * syncSettingsDisplay();
 * // Updates all settings controls to reflect current state
 * 
 * @example
 * // Called after PIN setup changes
 * syncSettingsDisplay();
 * // Updates PIN buttons and security indicators
 */
function syncSettingsDisplay() {
        // Sync PIN buttons
        const setupBtnSettings = document.getElementById('setupPinBtnSettings');
        const lockBtnSettings = document.getElementById('lockBtnSettings');
        
        if (setupBtnSettings && lockBtnSettings) {
            if (isPinSetup()) {
                if (isUnlocked) {
                    lockBtnSettings.style.display = 'inline-block';
                    lockBtnSettings.textContent = '🔒 Lock';
                    setupBtnSettings.textContent = '⚙️ Change/Remove PIN';
                } else {
                    lockBtnSettings.style.display = 'none';
                    setupBtnSettings.textContent = '⚙️ Change/Remove PIN';
                }
            } else {
                lockBtnSettings.style.display = 'none';
                setupBtnSettings.textContent = '⚙️ Setup PIN';
            }
        }
        
        // Sync encryption checkbox
        const encryptionOriginal = document.getElementById('encryptionEnabled');
        const encryptionSettings = document.getElementById('encryptionEnabledSettings');
        
        if (encryptionOriginal && encryptionSettings) {
            encryptionSettings.checked = encryptionOriginal.checked;
            
            // Add sync event listeners
            encryptionSettings.addEventListener('change', function() {
                encryptionOriginal.checked = this.checked;
            });
            
            encryptionOriginal.addEventListener('change', function() {
                encryptionSettings.checked = this.checked;
            });
        }
        
        // Sync theme select - enhanced
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            const currentTheme = getCurrentTheme();
            themeSelect.value = currentTheme;
            
            // Double-check the value was set correctly
            if (themeSelect.value !== currentTheme) {
                console.log('Theme select sync issue, forcing update');
                setTimeout(() => {
                    const themeSelectDelayed = document.getElementById('themeSelect');
                    if (themeSelectDelayed) {
                        themeSelectDelayed.value = currentTheme;
                    }
                }, 50);
            }
        }
        
        // Update storage info
        const storageTypeElement = document.getElementById('storageTypeDisplay');
        const storageStatusElement = document.getElementById('storageStatusDisplay');
        
        if (storageTypeElement && storageStatusElement) {
            switch (storageType) {
                case 'indexeddb':
                    storageTypeElement.textContent = 'Data stored in IndexedDB (recommended)';
                    storageStatusElement.textContent = '💾 IndexedDB';
                    storageStatusElement.style.color = 'var(--success-color)';
                    break;
                case 'localstorage':
                    storageTypeElement.textContent = 'Data stored in localStorage';
                    storageStatusElement.textContent = '📱 LocalStorage';
                    storageStatusElement.style.color = 'var(--info-color)';
                    break;
                case 'memory':
                    storageTypeElement.textContent = 'Data stored temporarily in memory only';
                    storageStatusElement.textContent = '⚠️ Memory Only';
                    storageStatusElement.style.color = 'var(--warning-color)';
                    break;
                default:
                    storageTypeElement.textContent = 'Storage type unknown';
                    storageStatusElement.textContent = '❓ Unknown';
                    storageStatusElement.style.color = 'var(--text-secondary)';
            }
        }
        
        // Update browser compatibility info
        updateBrowserCompatibilityDisplay();
    }

// ===================================================================================
// BROWSER COMPATIBILITY DISPLAY
// ===================================================================================

/**
 * Updates browser compatibility information in the settings interface.
 * 
 * Analyzes current browser capabilities and updates the compatibility display
 * to show support status for voice recording and transcription features.
 * Provides specific guidance for different browsers and their limitations.
 * 
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Called during settings tab initialization
 * updateBrowserCompatibilityDisplay();
 * // Shows "✅ Supported" for Chrome/Edge, "❌ Not Supported" for Firefox/Safari
 * 
 * @example
 * // Provides browser-specific feedback
 * // Chrome: "Your browser supports voice recording"
 * // Safari iOS: "Safari iOS has limited MediaRecorder support"
 */
function updateBrowserCompatibilityDisplay() {
        const voiceCapabilities = getVoiceCapabilities();
        
        // Voice Recording Status
        const voiceRecordingCompatibility = document.getElementById('voiceRecordingCompatibility');
        const voiceRecordingStatus = document.getElementById('voiceRecordingStatus');
        
        if (voiceRecordingCompatibility && voiceRecordingStatus) {
            if (voiceCapabilities.canRecord) {
                voiceRecordingCompatibility.textContent = 'Your browser supports voice recording';
                voiceRecordingStatus.textContent = '✅ Supported';
                voiceRecordingStatus.style.color = 'var(--success-color)';
            } else {
                if (voiceCapabilities.browser.isSafariMobile) {
                    voiceRecordingCompatibility.textContent = 'Safari iOS has limited MediaRecorder support';
                } else {
                    voiceRecordingCompatibility.textContent = 'Voice recording not supported in this browser';
                }
                voiceRecordingStatus.textContent = '❌ Not Supported';
                voiceRecordingStatus.style.color = 'var(--error-color)';
            }
        }
        
        // Transcription Status
        const transcriptionCompatibility = document.getElementById('transcriptionCompatibility');
        const transcriptionStatus = document.getElementById('transcriptionStatus');
        
        if (transcriptionCompatibility && transcriptionStatus) {
            if (voiceCapabilities.canTranscribe) {
                transcriptionCompatibility.textContent = 'Your browser supports speech transcription';
                transcriptionStatus.textContent = '✅ Supported';
                transcriptionStatus.style.color = 'var(--success-color)';
            } else {
                if (voiceCapabilities.browser.isFirefox) {
                    transcriptionCompatibility.textContent = 'Firefox does not support Speech Recognition API';
                } else if (voiceCapabilities.browser.isSafari) {
                    transcriptionCompatibility.textContent = 'Safari does not support Speech Recognition API';
                } else {
                    transcriptionCompatibility.textContent = 'Speech Recognition API not available in this browser';
                }
                transcriptionStatus.textContent = '❌ Not Supported';
                transcriptionStatus.style.color = 'var(--error-color)';
            }
        }
    }

// ===================================================================================
// VOICE TAB MANAGEMENT
// ===================================================================================

/**
 * Switches between voice recording tabs (record/stored).
 * 
 * Manages the voice recording interface tab system, handling the transition between
 * recording new voice notes and viewing stored voice notes. Automatically loads
 * voice notes when switching to the stored tab.
 * 
 * @param {('record'|'stored')} tabName - Target voice tab identifier
 * @returns {void}
 * @throws {TypeError} When tabName is not 'record' or 'stored'
 * @since 1.0.0
 * @example
 * // Switch to recording interface
 * switchVoiceTab('record');
 * 
 * @example
 * // Switch to stored notes and load them
 * switchVoiceTab('stored');
 * // Automatically calls displayVoiceNotes()
 */
function switchVoiceTab(tabName) {
        if (!tabName || (tabName !== 'record' && tabName !== 'stored')) return;
        
        // Update tab buttons
        const tabs = document.querySelectorAll('.voice-tab');
        tabs.forEach(tab => {
            const tabId = tab.dataset.tab;
            if (tabId === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Update tab panels
        const recordPanel = document.getElementById('voiceTabRecord');
        const storedPanel = document.getElementById('voiceTabStored');
        
        if (recordPanel && storedPanel) {
            if (tabName === 'record') {
                recordPanel.classList.add('active');
                recordPanel.style.display = 'block';
                storedPanel.classList.remove('active');
                storedPanel.style.display = 'none';
            } else {
                recordPanel.classList.remove('active');
                recordPanel.style.display = 'none';
                storedPanel.classList.add('active');
                storedPanel.style.display = 'block';
                
                // Load and display voice notes when switching to stored tab
                displayVoiceNotes();
            }
            
            setActiveVoiceTab(tabName);
        }
    }

// ===================================================================================
// FORM STATE MANAGEMENT
// ===================================================================================

/**
 * Toggles dream form between expanded and collapsed states.
 * 
 * Provides a collapsible dream entry form interface that can be expanded for full
 * functionality or collapsed to save screen space. User preference is persisted
 * to localStorage for consistency across sessions.
 * 
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Toggle form state (expand if collapsed, collapse if expanded)
 * toggleDreamForm();
 * 
 * @example
 * // State persists across browser sessions
 * toggleDreamForm(); // Collapses form
 * // Page reload - form remains collapsed
 */
function toggleDreamForm() {
        const fullForm = document.getElementById('dreamFormFull');
        const collapsedForm = document.getElementById('dreamFormCollapsed');
        
        if (!fullForm || !collapsedForm) return; // Safety check

        if (getIsDreamFormCollapsed()) {
            // Expand: show full form, hide collapsed
            fullForm.style.display = 'block';
            collapsedForm.style.display = 'none';
            setIsDreamFormCollapsed(false);
            try { localStorage.setItem(DREAM_FORM_COLLAPSE_KEY, 'false'); } catch (e) {}
        } else {
            // Collapse: hide full form, show collapsed
            fullForm.style.display = 'none';
            collapsedForm.style.display = 'block';
            setIsDreamFormCollapsed(true);
            try { localStorage.setItem(DREAM_FORM_COLLAPSE_KEY, 'true'); } catch (e) {}
        }
    }

// ===================================================================================
// LOADING STATE MANAGEMENT
// ===================================================================================

/**
 * Displays loading indicator during search/filter operations.
 * 
 * Shows a search-specific loading indicator in the entries container, with protection
 * against duplicate indicators. Only displays if the display mutex is not locked,
 * preventing conflicts with other display operations.
 * 
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Show loading before search operation
 * showSearchLoading();
 * performSearchOperation().then(() => {
 *   hideSearchLoading();
 * });
 * 
 * @example
 * // Automatic duplicate prevention
 * showSearchLoading();
 * showSearchLoading(); // Second call has no effect
 */
function showSearchLoading() {
        const container = document.getElementById('entriesContainer');
        if (container && !asyncMutex.displayDreams.locked) {
            const existingLoader = container.querySelector('.loading-state');
            if (!existingLoader) {
                const loader = document.createElement('div');
                loader.className = 'loading-state';
                loader.innerHTML = '🔍 Searching dreams...';
                container.appendChild(loader);
            }
        }
    }

/**
 * Hides search/filter loading indicator.
 * 
 * Removes any active loading indicators from the entries container, typically
 * called after search or filter operations complete.
 * 
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Hide loading after search completes
 * performSearch().finally(() => {
 *   hideSearchLoading();
 * });
 */
function hideSearchLoading() {
        const container = document.getElementById('entriesContainer');
        if (container) {
            const loader = container.querySelector('.loading-state');
            if (loader) {
                loader.remove();
            }
        }
    }

    

// ===================================================================================
// AUTOCOMPLETE MANAGEMENT INTERFACE
// ===================================================================================

/**
 * Initialize autocomplete system with tag and dream sign suggestions.
 * 
 * This function sets up the autocomplete functionality for dream tags and dream signs
 * input fields. It loads previously used suggestions from IndexedDB storage to provide
 * personalized autocomplete options based on the user's history. If storage access fails,
 * it falls back to predefined common tags and dream signs from the constants module.
 * 
 * The autocomplete system helps users quickly enter consistent tags and dream signs,
 * improving data quality and user experience during dream entry creation.
 * 
 * @async
 * @function
 * @returns {Promise<void>} Promise that resolves when autocomplete is initialized
 * @throws {Error} When storage access fails (handled gracefully with fallback)
 * @since 1.5.0
 * @example
 * await initializeAutocomplete();
 * // Tag and dream sign inputs now have autocomplete functionality
 * 
 * @see {@link getAutocompleteSuggestions} For suggestion retrieval
 * @see {@link setupTagAutocomplete} For autocomplete UI setup
 */
async function initializeAutocomplete() {
    try {
        const [tags, signs] = await Promise.all([
            getAutocompleteSuggestions('tags'),
            getAutocompleteSuggestions('dreamSigns')
        ]);
        setupTagAutocomplete('dreamTags', tags);
        setupTagAutocomplete('dreamSigns', signs);
    } catch (error) {
        console.error("Failed to initialize autocomplete:", error);
        setupTagAutocomplete('dreamTags', commonTags);
        setupTagAutocomplete('dreamSigns', commonDreamSigns);
    }
}

/**
 * Renders autocomplete management list for tags or dream signs.
 * 
 * Creates an interactive list of autocomplete suggestions with delete functionality.
 * Handles loading states, empty states, and error conditions gracefully. All items
 * are treated uniformly with delete capabilities.
 * 
 * @async
 * @param {('tags'|'dreamSigns')} type - Type of autocomplete items to render
 * @returns {Promise<void>}
 * @throws {TypeError} When type is not 'tags' or 'dreamSigns'
 * @throws {Error} When autocomplete suggestions cannot be loaded
 * @since 1.0.0
 * @example
 * // Render tags management interface
 * await renderAutocompleteManagementList('tags');
 * 
 * @example
 * // Render dream signs management interface
 * await renderAutocompleteManagementList('dreamSigns');
 * 
 * @example
 * // Error handling
 * try {
 *   await renderAutocompleteManagementList('tags');
 * } catch (error) {
 *   console.error('Failed to render management list:', error);
 * }
 */
async function renderAutocompleteManagementList(type) {
        const containerId = type === 'tags' ? 'tagsManagementList' : 'dreamSignsManagementList';
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<div class="loading-state">Loading...</div>';

        try {
            // Get the unified list of suggestions. This now correctly reads from the new store.
            const suggestions = await getAutocompleteSuggestions(type);

            if (suggestions.length === 0) {
                container.innerHTML = `<div class="no-entries" style="padding: 15px;">No custom items added yet.</div>`;
                return;
            }

            // All items are now treated the same. No more 'default' vs 'user' distinction.
            const listHtml = suggestions.map(item => {
                return `
                    <div class="autocomplete-list-item">
                        <span class="item-value">${escapeHtml(item)}</span>
                        <div class="flex-center gap-sm">
                            <button data-action="delete-autocomplete-item" data-item-type="${type}" data-item-id="${escapeAttr(item)}" class="btn btn-delete btn-small">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = listHtml;
        } catch (error) {
            console.error(`Error rendering ${type} list:`, error);
            container.innerHTML = `<div class="message-error">Failed to load ${type} list.</div>`;
        }
    }

/**
 * Sets up autocomplete functionality for tag input fields.
 * 
 * Creates a dropdown interface with suggestions that filters based on user input.
 * Supports comma-separated tag entry and prevents duplicate tag suggestions.
 * Includes click-outside handling and keyboard navigation support.
 * 
 * @param {string} inputId - ID of the input element to enhance with autocomplete
 * @param {string[]} suggestions - Array of available tag suggestions
 * @returns {void}
 * @throws {TypeError} When inputId is not a string or suggestions is not an array
 * @since 1.0.0
 * @example
 * // Setup autocomplete for dream tags
 * const tagSuggestions = ['lucid', 'nightmare', 'flying', 'recurring'];
 * setupTagAutocomplete('dreamTagsInput', tagSuggestions);
 * 
 * @example
 * // Autocomplete behavior
 * // User types "lu" -> shows "lucid" in dropdown
 * // User clicks "lucid" -> input becomes "lucid, "
 * // User types "fl" -> shows "flying" (filters out already selected)
 */
function setupTagAutocomplete(inputId, suggestions) {
        const input = document.getElementById(inputId);
        if (!input || !Array.isArray(suggestions)) return;

        // Remove existing listener to prevent duplicates
        if (input.autocompleteListener) {
            input.removeEventListener('input', input.autocompleteListener);
        }
        if (input.autocompleteDropdown) {
            input.autocompleteDropdown.remove();
        }

        // Create autocomplete dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'tag-autocomplete-dropdown';
        input.autocompleteDropdown = dropdown;

        // Position container relatively
        if (input.parentElement) {
            input.parentElement.style.position = 'relative';
            input.parentElement.appendChild(dropdown);
        }

        const listener = function() {
            const value = this.value.toLowerCase();
            const lastComma = value.lastIndexOf(',');
            const currentTag = lastComma >= 0 ? value.substring(lastComma + 1).trim() : value.trim();

            if (currentTag.length < CONSTANTS.AUTOCOMPLETE_MIN_CHARS) {
                dropdown.style.display = 'none';
                return;
            }

            const matches = suggestions.filter(suggestion => 
                suggestion.toLowerCase().includes(currentTag) &&
                !value.toLowerCase().includes(suggestion.toLowerCase())
            ).slice(0, CONSTANTS.AUTOCOMPLETE_MAX_RESULTS);

            if (matches.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            dropdown.innerHTML = matches.map(match => 
                `<div class="autocomplete-item" data-tag="${escapeAttr(match)}">
                    ${escapeHtml(match)}
                </div>`
            ).join('');

            dropdown.style.display = 'block';

            // Add click handlers
            dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', function() {
                    const tag = this.dataset.tag;
                    if (tag) {
                        const currentValue = input.value;
                        const lastComma = currentValue.lastIndexOf(',');
                        
                        if (lastComma >= 0) {
                            input.value = currentValue.substring(0, lastComma + 1) + ' ' + tag + ', ';
                        } else {
                            input.value = tag + ', ';
                        }
                        
                        dropdown.style.display = 'none';
                        input.focus();
                    }
                });
            });
        };
        
        input.autocompleteListener = listener;
        input.addEventListener('input', listener);

        // Hide dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (dropdown && !input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }


// ===================================================================================
// PIN SECURITY & ACCESS CONTROL SYSTEM
// ===================================================================================
// Unified PIN interface rendering system for various PIN operations
// Supports setup, verification, change, and removal workflows

/**
 * Renders unified PIN screen interface with configurable inputs and buttons.
 * 
 * Provides a flexible PIN interface system that can be configured for different
 * security operations including setup, verification, change, and removal workflows.
 * Generates consistent UI components with proper security attributes and auto-focus.
 * 
 * @param {Element} targetElement - DOM element to render the PIN interface into
 * @param {PinScreenConfig} config - Configuration object for the PIN interface
 * @returns {void}
 * @throws {TypeError} When targetElement is not a valid DOM element
 * @throws {TypeError} When config is missing required properties
 * @since 1.0.0
 * @example
 * // PIN setup interface
 * const container = document.getElementById('pinContainer');
 * renderPinScreen(container, {
 *   title: 'Setup PIN',
 *   icon: '🔐',
 *   message: 'Create a 4-6 digit PIN to secure your dreams.',
 *   inputs: [{
 *     id: 'newPin',
 *     type: 'password',
 *     placeholder: 'Enter new PIN',
 *     maxLength: '6'
 *   }],
 *   buttons: [{
 *     action: 'setup-pin',
 *     text: 'Create PIN',
 *     class: 'btn btn-primary'
 *   }]
 * });
 * 
 * @example
 * // PIN verification interface
 * renderPinScreen(container, {
 *   title: 'Enter PIN',
 *   inputs: [{ id: 'verifyPin', type: 'password', placeholder: 'PIN' }],
 *   buttons: [{ action: 'verify-pin', text: 'Unlock', class: 'btn btn-primary' }],
 *   feedbackContainer: true
 * });
 */

/**
 * Configuration object for PIN screen rendering.
 * 
 * @typedef {Object} PinScreenConfig
 * @property {string} title - Screen title text
 * @property {string} [icon] - Optional emoji or icon to display
 * @property {string} [message] - Optional descriptive message
 * @property {PinInputConfig[]} [inputs] - Array of input field configurations
 * @property {PinButtonConfig[]} [buttons] - Array of button configurations
 * @property {PinLinkConfig[]} [links] - Array of link configurations
 * @property {boolean} [feedbackContainer=false] - Whether to include feedback containers
 */

/**
 * Configuration for PIN input fields.
 * 
 * @typedef {Object} PinInputConfig
 * @property {string} id - Input element ID
 * @property {string} type - Input type (usually 'password' or 'text')
 * @property {string} placeholder - Placeholder text
 * @property {string} [maxLength] - Maximum input length
 * @property {string} [value] - Default value
 * @property {string} [class] - CSS classes
 */

/**
 * Configuration for PIN buttons.
 * 
 * @typedef {Object} PinButtonConfig
 * @property {string} action - Data-action attribute value
 * @property {string} text - Button display text
 * @property {string} class - CSS classes
 * @property {string} [id] - Button element ID
 */

/**
 * Configuration for PIN links.
 * 
 * @typedef {Object} PinLinkConfig
 * @property {string} action - Data-action attribute value
 * @property {string} text - Link display text
 * @property {string} [id] - Link element ID
 * @property {string} [style] - Inline CSS styles
 */
function renderPinScreen(targetElement, config) {
        if (!targetElement || !config) return;

        let inputsHTML = '';
        if (config.inputs) {
            inputsHTML = config.inputs.map(input => {
                const valueAttr = input.value ? `value="${escapeAttr(input.value)}"` : '';
                const inputClass = input.class || 'form-control';
                return `<input
                    type="${input.type}"
                    id="${input.id}"
                    class="${inputClass}"
                    placeholder="${escapeAttr(input.placeholder)}"
                    ${input.maxLength ? `maxlength="${input.maxLength}"` : ''}
                    ${valueAttr}
                    style="margin-bottom: 10px;"
                >`;
            }).join('');
        }

        let buttonsHTML = '';
        if (config.buttons) {
            buttonsHTML = config.buttons.map(button => `
                <button
                    data-action="${button.action}"
                    class="btn ${button.class}"
                    ${button.id ? `id="${button.id}"` : ''}
                >
                    ${escapeHtml(button.text)}
                </button>
            `).join('');
        }

        let linksHTML = '';
        if (config.links) {
            linksHTML = config.links.map(link => `
                <span
                    data-action="${link.action}"
                    class="pin-setup-link"
                    ${link.id ? `id="${link.id}"` : ''}
                    style="${link.style || ''}"
                >
                    ${escapeHtml(link.text)}
                </span>
            `).join('');
        }

        const iconHTML = config.icon ? `<div class="text-4xl mb-lg">${config.icon}</div>` : '';
        const messageHTML = config.message ? `<p id="pinMessage" class="text-secondary mb-lg line-height-relaxed">${config.message}</p>` : '';
        const feedbackHTML = config.feedbackContainer ? `<div id="pinFeedback" class="notification-message"></div><div id="pinSuccess" class="notification-message"></div><div id="pinInfo" class="notification-message"></div>` : '';

        targetElement.innerHTML = `
            ${iconHTML}
            <h2 id="pinTitle" class="text-primary mb-md text-xl">${escapeHtml(config.title)}</h2>
            ${messageHTML}
            <div id="pinInputsContainer">${inputsHTML}</div>
            <div class="pin-buttons">
                ${buttonsHTML}
            </div>
            <div id="pinLinksContainer" style="margin-top: 15px;">${linksHTML}</div>
            ${feedbackHTML}
        `;

        // Auto-focus the first input if it exists
        if (config.inputs && config.inputs.length > 0) {
            setTimeout(() => {
                const firstInput = document.getElementById(config.inputs[0].id);
                if (firstInput) {
                    firstInput.focus();
                }
            }, CONSTANTS.FOCUS_DELAY_MS);
        }
    }

// ===================================================================================
// DATE AND CHART UTILITY FUNCTIONS
// ===================================================================================

/**
 * Format date as YYYY-MM-DD string for consistent date key generation.
 * 
 * This utility function ensures consistent date formatting across the application,
 * handling timezone issues and providing zero-padded output suitable for use as
 * object keys in date-based grouping operations.
 * 
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string in YYYY-MM-DD format
 * @throws {TypeError} When date parameter is not a Date object
 * @since 1.0.0
 * @example
 * const key = formatDateKey(new Date('2024-01-05'));
 * console.log(key); // '2024-01-05'
 * 
 * @example
 * // Used for grouping dreams by date
 * const dreamsByDate = {};
 * dreams.forEach(dream => {
 *   const key = formatDateKey(new Date(dream.timestamp));
 *   if (!dreamsByDate[key]) dreamsByDate[key] = [];
 *   dreamsByDate[key].push(dream);
 * });
 */
function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Create standardized pie chart colors and gradient for dream type visualization.
 * 
 * Generates consistent color scheme using CSS custom properties to ensure
 * all pie charts maintain visual consistency across the application. Uses
 * CSS conic-gradient for smooth chart rendering.
 * 
 * @param {number} lucidPercentage - Percentage of lucid dreams (0-100)
 * @returns {Object} Object with lucidColor, regularColor, and gradient properties
 * @throws {RangeError} When lucidPercentage is not between 0 and 100
 * @since 1.0.0
 * @example
 * const colors = createPieChartColors(35.5);
 * console.log(colors.lucidColor); // 'var(--success-color)'
 * console.log(colors.gradient); // 'conic-gradient(var(--success-color) 0% 35.50%, ...)'
 * 
 * @example
 * // Used in chart rendering
 * const lucidPercentage = (lucidDreams / totalDreams) * 100;
 * const colors = createPieChartColors(lucidPercentage);
 * element.style.background = colors.gradient;
 */
function createPieChartColors(lucidPercentage) {
    const lucidColor = 'var(--success-color)';
    const regularColor = 'var(--info-color)';
    const gradient = `conic-gradient(${lucidColor} 0% ${lucidPercentage.toFixed(2)}%, ${regularColor} ${lucidPercentage.toFixed(2)}% 100%)`;
    return { lucidColor, regularColor, gradient };
}

/**
 * Generate standardized pie chart HTML with legend.
 * 
 * Creates complete HTML structure for pie charts including the chart visual,
 * center display, and color-coded legend. Ensures consistent formatting and
 * accessibility across all chart implementations in the application.
 * 
 * @param {string} title - Chart title displayed above the chart
 * @param {number} totalDreams - Total number of dreams for center display
 * @param {number} lucidDreams - Number of lucid dreams for legend
 * @param {number} regularDreams - Number of regular dreams for legend
 * @param {string} gradient - CSS conic-gradient string for chart background
 * @param {string} lucidColor - CSS color for lucid dreams legend box
 * @param {string} regularColor - CSS color for regular dreams legend box
 * @returns {string} Complete HTML string for pie chart with legend
 * @throws {TypeError} When title is not a string or numbers are not valid
 * @since 1.0.0
 * @example
 * const chartHTML = createPieChartHTML(
 *   'Monthly Dreams',
 *   25, 10, 15,
 *   'conic-gradient(...)',
 *   'var(--success-color)',
 *   'var(--info-color)'
 * );
 * container.innerHTML = chartHTML;
 */
function createPieChartHTML(title, totalDreams, lucidDreams, regularDreams, gradient, lucidColor, regularColor) {
    const lucidPercentage = (lucidDreams / totalDreams) * 100;
    const regularPercentage = 100 - lucidPercentage;
    
    return `
        <h3 class="text-primary mb-md">${title}</h3>
        <div class="pie-chart-container">
            <div class="pie-chart" style="background: ${gradient};">
                <div class="pie-chart-center">
                    <div class="pie-chart-total">${totalDreams}</div>
                    <div class="pie-chart-label">Dreams</div>
                </div>
            </div>
            <div class="pie-chart-legend">
                <div class="legend-item">
                    <div class="legend-color-box" style="background: ${lucidColor};"></div>
                    <span>Lucid (${lucidDreams}) - ${lucidPercentage.toFixed(1)}%</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color-box" style="background: ${regularColor};"></div>
                    <span>Regular (${regularDreams}) - ${regularPercentage.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    `;
}

// ===================================================================================
// TIP DISPLAY & NAVIGATION SYSTEM
// ===================================================================================

/**
 * Displays a tip at the specified index with safe bounds checking.
 * 
 * Updates both the tip content display and counter information in the advice tab.
 * Uses modulo arithmetic to handle negative indices and out-of-bounds values safely,
 * ensuring the tip system is robust against invalid input.
 * 
 * @param {number} index - Tip index to display (can be negative or out of bounds)
 * @returns {void}
 * @throws {TypeError} When index is not a number
 * @since 1.0.0
 * @example
 * // Display first tip
 * displayTip(0);
 * 
 * @example
 * // Negative index wraps to end
 * displayTip(-1); // Shows last tip
 * 
 * @example
 * // Out of bounds index wraps around
 * displayTip(1000); // Shows tip at (1000 % totalTips)
 */
function displayTip(index) {
    const tipTextElement = document.getElementById('tipText');
    const tipCounterElement = document.getElementById('tipCounter');

    if (tipTextElement && tipCounterElement && getDailyTips() && getDailyTips().length > 0) {
        // Ensure index is within bounds and handle negative numbers using modulo arithmetic
        const safeIndex = ((index % getDailyTips().length) + getDailyTips().length) % getDailyTips().length;

        const tip = getDailyTips()[safeIndex];
        // Display tip with proper HTML escaping for security
        tipTextElement.innerHTML = `<h4 class="text-primary mb-md">${escapeHtml(tip.category)}</h4><p class="line-height-loose">${escapeHtml(tip.text)}</p>`;
        tipCounterElement.textContent = `${safeIndex + 1} / ${getDailyTips().length}`;
        setCurrentTipIndex(safeIndex); // Update global state
    }
}

/**
 * Handles tip navigation in the specified direction.
 * 
 * Provides navigation controls for the daily tips system, supporting both forward
 * and backward navigation with automatic bounds handling via the displayTip function.
 * 
 * @param {('next'|'prev')} direction - Navigation direction
 * @returns {void}
 * @throws {TypeError} When direction is not 'next' or 'prev'
 * @since 1.0.0
 * @example
 * // Navigate to next tip
 * handleTipNavigation('next');
 * 
 * @example
 * // Navigate to previous tip
 * handleTipNavigation('prev');
 */
function handleTipNavigation(direction) {
    let newIndex = getCurrentTipIndex();
    if (direction === 'next') {
        newIndex++;
    } else {
        newIndex--;
    }
    displayTip(newIndex); // displayTip handles bounds checking
}

// ===================================================================================
// GOALS UI GENERATION UTILITIES
// ===================================================================================

/**
 * Gets human-readable label for goal type for display purposes.
 * 
 * This function maps goal type enum values to user-friendly display labels
 * that are shown in the progress section of goal cards.
 * 
 * @function getGoalTypeLabel
 * @param {string} type - Goal type to get label for ('lucid_count', 'recall_streak', etc.)
 * @returns {string} Human-readable label for the goal type
 * @since 2.02.47
 * @example
 * const label = getGoalTypeLabel('lucid_count');
 * console.log(label); // "lucid dreams"
 * 
 * @example
 * const streakLabel = getGoalTypeLabel('recall_streak');
 * console.log(streakLabel); // "day streak"
 */
function getGoalTypeLabel(type) {
    const labels = {
        'lucid_count': 'lucid dreams',
        'recall_streak': 'day streak',
        'journal_streak': 'day streak',
        'dream_signs_count': 'dream signs',
        'custom': ''
    };
    return labels[type] || '';
}

/**
 * Creates complete HTML element for goal display with progress bars and action buttons.
 * 
 * This function generates a comprehensive goal card UI element including title, description,
 * progress visualization, action buttons, and metadata. It handles both active and completed
 * goal states with different UI configurations.
 * 
 * @function createGoalElement
 * @param {Object} goal - Goal object to create element for
 * @param {Object} progress - Calculated progress data with current and message properties
 * @param {boolean} [isCompleted=false] - Whether goal is in completed state
 * @returns {HTMLElement} Complete DOM element for goal display
 * @since 2.02.47
 * @example
 * const goal = { id: '123', title: 'Lucid Dreams', type: 'lucid_count', target: 5 };
 * const progress = { current: 3, message: '3 lucid dreams this month' };
 * const element = createGoalElement(goal, progress, false);
 * document.getElementById('container').appendChild(element);
 * 
 * @example
 * // Create completed goal element
 * const completedElement = createGoalElement(goal, progress, true);
 */
function createGoalElement(goal, progress, isCompleted = false) {
    const goalDiv = document.createElement('div');
    goalDiv.className = `card-md goal-card mb-md ${isCompleted ? 'completed' : ''}`;
    goalDiv.id = `goal-${goal.id}`;
    
    const progressPercent = Math.min((progress.current / goal.target) * 100, 100);
    const statusClass = progressPercent === 100 ? 'success' : progressPercent >= 50 ? 'warning' : 'primary';
    
    goalDiv.innerHTML = `
        <div class="flex-between mb-md">
            <h4>${escapeHtml(goal.icon)} ${escapeHtml(goal.title)}</h4>
            <div class="goal-actions">
                ${!isCompleted ? `
                    <button data-action="edit-goal" data-goal-id="${goal.id}" class="btn btn-outline btn-small">Edit</button>
                    <button data-action="complete-goal" data-goal-id="${goal.id}" class="btn btn-success btn-small">Complete</button>
                ` : `
                    <button data-action="reactivate-goal" data-goal-id="${goal.id}" class="btn btn-warning btn-small">Reactivate</button>
                `}
                <button data-action="delete-goal" data-goal-id="${goal.id}" class="btn btn-error btn-small">Delete</button>
            </div>
        </div>
        <p class="text-secondary mb-md">${escapeHtml(goal.description)}</p>
        <div class="goal-progress-section">
            <div class="flex-between mb-sm">
                <span class="font-semibold">Progress:</span>
                <span class="status-${statusClass}">${progress.current} / ${goal.target} ${getGoalTypeLabel(goal.type)}</span>
            </div>
            <div class="progress-bar" 
                 role="progressbar" 
                 aria-valuenow="${progress.current}" 
                 aria-valuemin="0" 
                 aria-valuemax="${goal.target}"
                 aria-label="Goal progress: ${progress.current} of ${goal.target} ${getGoalTypeLabel(goal.type)}">
                <div class="progress-fill progress-${statusClass}" style="width: ${progressPercent}%;"></div>
            </div>
            ${progress.message ? `<p class="text-secondary text-sm mt-sm">${progress.message}</p>` : ''}
            ${goal.type === 'custom' && !isCompleted ? `
                <div class="custom-goal-controls mt-md">
                    <div class="flex-center gap-md">
                        <button data-action="decrease-goal-progress" data-goal-id="${goal.id}" class="btn btn-outline btn-small" ${progress.current <= 0 ? 'disabled' : ''}>➖</button>
                        <span class="font-semibold">Manual Tracking</span>
                        <button data-action="increase-goal-progress" data-goal-id="${goal.id}" class="btn btn-outline btn-small">➕</button>
                    </div>
                </div>
            ` : ''}
        </div>
        <div class="flex-between text-sm text-secondary">
            <div>
                <span>Created: ${new Date(goal.createdAt).toLocaleDateString()}</span>
                ${isCompleted && goal.completedAt ? `<br><span>Completed: ${new Date(goal.completedAt).toLocaleDateString()}</span>` : ''}
            </div>
            <span>${goal.period === 'monthly' ? 'Monthly Goal' : goal.period === 'streak' ? 'Streak Goal' : 'Total Goal'}</span>
        </div>
    `;
    
    return goalDiv;
}

// ===================================================================================
// MODULE EXPORTS
// ===================================================================================

// Export all functions for ES module compatibility
export {
    // Button & Action Element Creation
    createActionButton,
    
    // Message & Notification System
    createInlineMessage,
    
    // Display & Layout Helpers
    createMetaDisplay,
    createPaginationHTML,
    
    // Utility Functions
    escapeHtml,
    escapeAttr,
    
    // Theme Management
    getCurrentTheme,
    storeTheme,
    applyTheme,
    switchTheme,
    
    // Tab Management
    switchAppTab,
    switchVoiceTab,
    hideAllTabButtons,
    showAllTabButtons,
    
    // UI State Management
    syncSettingsDisplay,
    updateBrowserCompatibilityDisplay,
    toggleDreamForm,
    
    // Search & Loading States
    showSearchLoading,
    hideSearchLoading,
    
    // Autocomplete System
    initializeAutocomplete,
    setupTagAutocomplete,
    renderAutocompleteManagementList,
    
    
    // Tips System
    displayTip,
    handleTipNavigation,
    
    // Date and Chart Utilities
    formatDateKey,
    createPieChartColors,
    createPieChartHTML,
    
    // Goals UI Utilities
    getGoalTypeLabel,
    createGoalElement,
    
    // Security UI
    renderPinScreen
};

// Functions are now properly exported as ES modules for clean dependency management

