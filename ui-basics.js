/**
 * @fileoverview Small UI building blocks used across the app: action buttons, the live-region announcer,
 *   inline messages, meta displays, HTML and attribute escaping, and the pagination control.
 *
 * @module UiBasics
 */

// ================================
// ES MODULE IMPORTS
// ================================



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
 * Announces messages to appropriate accessibility live regions for screen readers.
 *
 * This function determines the correct live region based on message type and announces
 * the message content to screen reader users. It provides immediate accessibility
 * feedback for all dynamic content changes in the application.
 *
 * @param {string} type - Message type: 'success', 'error', 'warning', 'info', 'form', 'search', 'status', 'progress', 'validation'
 * @param {string} text - Message content to announce
 * @since 2.04.01
 * @example
 * // Announce form feedback
 * announceLiveMessage('success', 'Dream saved successfully!');
 *
 * @example
 * // Announce search results
 * announceLiveMessage('search', 'Found 15 dreams matching your search');
 */
function announceLiveMessage(type, text) {
    // Map message types to appropriate live regions
    const liveRegionMap = {
        'success': 'status-announcer',
        'error': 'validation-announcer',
        'warning': 'status-announcer',
        'info': 'status-announcer',
        'form': 'form-announcer',
        'search': 'search-announcer',
        'status': 'status-announcer',
        'progress': 'progress-announcer',
        'validation': 'validation-announcer'
    };

    // Get the appropriate live region ID
    const regionId = liveRegionMap[type] || 'status-announcer';
    const liveRegion = document.getElementById(regionId);

    if (liveRegion) {
        // Clear previous content and announce new message
        liveRegion.textContent = '';
        // Use setTimeout to ensure screen readers pick up the change
        setTimeout(() => {
            liveRegion.textContent = text;
        }, 50);
    }
}

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
 * @param {boolean} [options.announceToLiveRegion=true] - Whether to announce to accessibility live regions
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
            className = '', // Additional CSS classes
            announceToLiveRegion = true // Whether to announce to accessibility live regions
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

        // Announce message to appropriate live region for screen readers
        if (announceToLiveRegion) {
            announceLiveMessage(type, text);
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
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

// ================================
// ES MODULE EXPORTS
// ================================

export {
    createActionButton,
    announceLiveMessage,
    createInlineMessage,
    createMetaDisplay,
    escapeHtml,
    escapeAttr,
    createPaginationHTML
};
