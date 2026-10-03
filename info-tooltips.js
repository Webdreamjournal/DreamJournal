/**
 * @fileoverview Reusable info tooltip and the help tooltips for the dream form, smart search and export
 *   format.
 *
 * @module InfoTooltips
 */

// ================================
// ES MODULE IMPORTS
// ================================



/**
 * Creates and displays a reusable information tooltip with custom content.
 *
 * This is a generic tooltip system that can be used throughout the application
 * to display contextual help, explanations, or additional information. The tooltip
 * automatically positions itself to stay within viewport bounds and includes
 * smart mobile/desktop responsive behavior.
 *
 * @function showInfoTooltip
 * @param {Object} config - Tooltip configuration object
 * @param {string} config.triggerId - ID of the element that triggered the tooltip (for positioning)
 * @param {string} config.tooltipId - Unique ID for the tooltip element
 * @param {string} config.title - Tooltip title/heading text
 * @param {string} config.content - Main tooltip content (HTML allowed)
 * @param {string} [config.closeAction='close-tooltip'] - Data-action for close button
 * @param {string} [config.closeText='Got it!'] - Text for close button
 * @param {number} [config.autoCloseMs=10000] - Auto-close timeout in milliseconds
 * @param {string} [config.className='info-tooltip'] - Additional CSS class name
 * @returns {void}
 * @since 2.04.38
 *
 * @example
 * // Basic usage with custom content
 * showInfoTooltip({
 *     triggerId: 'help-icon',
 *     tooltipId: 'feature-help-tooltip',
 *     title: 'Feature Help',
 *     content: '<p>This feature helps you...</p>'
 * });
 *
 * @example
 * // Advanced usage with custom options
 * showInfoTooltip({
 *     triggerId: 'export-info-icon',
 *     tooltipId: 'export-help',
 *     title: 'Export Options',
 *     content: `<div class="options">
 *         <div class="option"><strong>Option 1:</strong> Description</div>
 *         <div class="option"><strong>Option 2:</strong> Description</div>
 *     </div>`,
 *     closeAction: 'close-export-help',
 *     closeText: 'Close',
 *     autoCloseMs: 15000,
 *     className: 'export-tooltip'
 * });
 */
function showInfoTooltip(config) {
    const {
        triggerId,
        tooltipId,
        title,
        content,
        closeAction = 'close-tooltip',
        closeText = 'Got it!',
        autoCloseMs = 30000,
        className = 'info-tooltip'
    } = config;

    // Remove any existing tooltip with the same ID
    const existingTooltip = document.getElementById(tooltipId);
    if (existingTooltip) {
        existingTooltip.remove();
    }

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.id = tooltipId;
    tooltip.className = `export-info-tooltip ${className}`;
    tooltip.innerHTML = `
        <div class="tooltip-content">
            <h4>${title}</h4>
            <div class="tooltip-body">
                ${content}
            </div>
            <div class="tooltip-footer">
                <button data-action="${closeAction}" class="btn btn-secondary btn-small">${closeText}</button>
            </div>
        </div>
    `;

    // Add ARIA attributes for accessibility
    tooltip.setAttribute('role', 'dialog');
    tooltip.setAttribute('aria-labelledby', `${tooltipId}-title`);
    tooltip.setAttribute('aria-describedby', `${tooltipId}-content`);

    // Position tooltip like a context menu - anchored to the trigger element
    const triggerElement = document.getElementById(triggerId) || document.querySelector(`[data-action="${triggerId}"]`);

    // Add tooltip to DOM first (invisible) so we can measure its actual dimensions
    tooltip.style.visibility = 'hidden';
    tooltip.style.position = 'fixed';
    tooltip.style.top = '0px';
    tooltip.style.left = '0px';
    document.body.appendChild(tooltip);

    if (triggerElement) {
        const rect = triggerElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const actualTooltipRect = tooltip.getBoundingClientRect();
        const actualHeight = actualTooltipRect.height;
        const actualWidth = actualTooltipRect.width;
        const tooltipWidth = Math.min(actualWidth, Math.min(400, viewportWidth - 20));

        // Context menu style positioning: decide above or below based on available space and actual height
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        // Use larger buffer for desktop to account for browser chrome and scrollbars
        const positionBuffer = viewportWidth > 768 ? 130 : 120;
        const showAbove = spaceBelow < actualHeight + positionBuffer && spaceAbove >= actualHeight + positionBuffer;

        let topPosition;
        if (showAbove) {
            // Position above: bottom of tooltip near the icon
            topPosition = Math.max(10, rect.top - actualHeight - 5);
        } else {
            // Position below: top of tooltip near the icon
            topPosition = rect.bottom + 5;
            // If it would go off bottom, move up as much as needed
            const bottomBuffer = viewportWidth > 768 ? 130 : 110;
            if (topPosition + actualHeight > viewportHeight - bottomBuffer) {
                // Use larger buffer for desktop to account for browser chrome
                topPosition = Math.max(110, viewportHeight - actualHeight - bottomBuffer);
            }
        }

        // Horizontal positioning: anchor to icon like a context menu
        let leftPosition;
        if (viewportWidth <= 480) {
            // Mobile: Full width with margins
            leftPosition = 10;
            tooltip.style.right = '10px';
            tooltip.style.width = 'auto';
        } else {
            // Desktop: Context menu style - right edge of tooltip near icon
            // Try to position so the tooltip's right edge is near the icon
            leftPosition = rect.left - tooltipWidth + rect.width + 5;

            // If that puts it off the left edge, position it to the right of the icon instead
            if (leftPosition < 10) {
                leftPosition = rect.right + 5;
                // If that puts it off the right edge, use maximum left position
                if (leftPosition + tooltipWidth > viewportWidth - 10) {
                    leftPosition = viewportWidth - tooltipWidth - 10;
                }
            }

            // Final bounds check
            leftPosition = Math.max(10, Math.min(leftPosition, viewportWidth - tooltipWidth - 10));
            tooltip.style.width = tooltipWidth + 'px';
        }

        // Apply final positioning and make visible
        tooltip.style.top = topPosition + 'px';
        tooltip.style.left = leftPosition + 'px';
        tooltip.style.visibility = 'visible';
    }

    // Focus on the close button for keyboard navigation
    const closeButton = tooltip.querySelector(`[data-action="${closeAction}"]`);
    if (closeButton) {
        closeButton.focus();
    }

    // Auto-close after specified time or on outside click
    const autoCloseTimeout = setTimeout(() => {
        if (document.getElementById(tooltipId)) {
            tooltip.remove();
        }
    }, autoCloseMs);

    // Close on outside click
    const handleOutsideClick = (event) => {
        if (!tooltip.contains(event.target) && !triggerElement.contains(event.target)) {
            clearTimeout(autoCloseTimeout);
            tooltip.remove();
            document.removeEventListener('click', handleOutsideClick);
        }
    };

    // Delay adding the outside click listener to prevent immediate closure
    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
    }, 100);
}

/**
 * Shows export format information tooltip for Export Range functionality.
 *
 * This function is a convenience wrapper around showInfoTooltip() specifically
 * for the Export Range feature. It displays information about the two export
 * format options available when using the Export Range button.
 *
 * @function showExportFormatInfo
 * @returns {void}
 * @since 2.04.36
 *
 * @example
 * // Called via action delegation system
 * // data-action="show-export-info"
 * showExportFormatInfo();
 */
function showExportFormatInfo() {
    showInfoTooltip({
        triggerId: 'show-export-info',
        tooltipId: 'export-info-tooltip',
        title: 'Export Range Formats',
        content: `
            <div class="format-explanation">
                <div class="format-option">
                    <strong>🔲 Unchecked (Simple Export):</strong>
                    <p>Exports dreams in clean text format with title, date, type, content, emotions, tags, and dream signs. Perfect for personal reading or simple analysis.</p>
                </div>
                <div class="format-option">
                    <strong>☑️ Checked (AI Analysis):</strong>
                    <p>Exports dreams with comprehensive AI analysis prompt including statistics and detailed instructions for pattern recognition. Ready to paste into AI tools like ChatGPT or Claude.</p>
                </div>
            </div>
        `,
        closeAction: 'close-export-info',
        closeText: 'Got it!',
        autoCloseMs: 10000,
        className: 'export-tooltip'
    });
}

/**
 * Closes any information tooltip by ID.
 *
 * This is a generic function to close tooltips created by showInfoTooltip().
 * Can be used to close specific tooltips or as a general close handler.
 *
 * @function closeInfoTooltip
 * @param {string} [tooltipId] - ID of specific tooltip to close. If not provided, closes common tooltip IDs
 * @returns {void}
 * @since 2.04.38
 *
 * @example
 * // Close specific tooltip
 * closeInfoTooltip('my-tooltip-id');
 *
 * @example
 * // Close common tooltips (export, help, etc.)
 * closeInfoTooltip();
 */
function closeInfoTooltip(tooltipId = null) {
    if (tooltipId) {
        const tooltip = document.getElementById(tooltipId);
        if (tooltip) {
            tooltip.remove();
        }
    } else {
        // Close common tooltip IDs if no specific ID provided
        const commonTooltipIds = ['export-info-tooltip', 'help-tooltip', 'info-tooltip'];
        commonTooltipIds.forEach(id => {
            const tooltip = document.getElementById(id);
            if (tooltip) {
                tooltip.remove();
            }
        });
    }
}

/**
 * Closes the export format information tooltip.
 *
 * This function is a specific wrapper for closing the export format tooltip.
 * Maintained for backward compatibility with existing action delegation.
 *
 * @function closeExportFormatInfo
 * @returns {void}
 * @since 2.04.36
 *
 * @example
 * // Called via action delegation system
 * // data-action="close-export-info"
 * closeExportFormatInfo();
 */
function closeExportFormatInfo() {
    closeInfoTooltip('export-info-tooltip');
}

/**
 * Shows emotions field help tooltip with common emotion examples.
 *
 * Displays a helpful tooltip with common emotions that users can experience
 * in dreams, providing examples to help with dream journaling.
 *
 * @function showEmotionsHelp
 * @returns {void}
 * @since 2.04.39
 *
 * @example
 * // Called via action delegation system
 * // data-action="show-emotions-help"
 * showEmotionsHelp();
 */
function showEmotionsHelp() {
    showInfoTooltip({
        triggerId: 'show-emotions-help',
        tooltipId: 'emotions-help-tooltip',
        title: 'Common Dream Emotions',
        content: `
            <div class="help-content">
                <p>Dreams often contain intense emotions. Here are common ones to help you identify and track emotional patterns:</p>
                <div class="emotion-categories">
                    <div class="emotion-group">
                        <strong>Positive:</strong> happy, joyful, excited, peaceful, curious, amazed, loved, confident
                    </div>
                    <div class="emotion-group">
                        <strong>Negative:</strong> anxious, scared, angry, sad, confused, frustrated, guilty, embarrassed
                    </div>
                    <div class="emotion-group">
                        <strong>Neutral:</strong> calm, surprised, nostalgic, focused, detached, observant
                    </div>
                </div>
                <p><small><em>Tip: You can enter multiple emotions separated by commas</em></small></p>
            </div>
        `,
        closeAction: 'close-emotions-help',
        closeText: 'Got it!',
        autoCloseMs: 12000,
        className: 'form-help-tooltip'
    });
}

/**
 * Shows tags field help tooltip with tagging guidance.
 *
 * Displays helpful information about how to tag dreams effectively
 * for better organization and searchability.
 *
 * @function showTagsHelp
 * @returns {void}
 * @since 2.04.39
 *
 * @example
 * // Called via action delegation system
 * // data-action="show-tags-help"
 * showTagsHelp();
 */
function showTagsHelp() {
    showInfoTooltip({
        triggerId: 'show-tags-help',
        tooltipId: 'tags-help-tooltip',
        title: 'Dream Tagging Guide',
        content: `
            <div class="help-content">
                <p>Tags help you organize and search your dreams. Consider including:</p>
                <div class="tag-categories">
                    <div class="tag-group">
                        <strong>🏠 Places:</strong> home, school, work, beach, forest, city, unknown-place
                    </div>
                    <div class="tag-group">
                        <strong>👥 People:</strong> family, friends, strangers, celebrities, childhood-friends
                    </div>
                    <div class="tag-group">
                        <strong>🎭 Themes:</strong> flying, falling, chasing, lost, exam, travel, adventure
                    </div>
                    <div class="tag-group">
                        <strong>🐕 Objects/Animals:</strong> car, phone, animals, water, fire, technology
                    </div>
                </div>
                <p><small><em>Tip: Use simple, consistent tags separated by commas for easy searching</em></small></p>
            </div>
        `,
        closeAction: 'close-tags-help',
        closeText: 'Got it!',
        autoCloseMs: 15000,
        className: 'form-help-tooltip'
    });
}

/**
 * Shows dream signs field help tooltip with lucidity trigger explanation.
 *
 * Explains what dream signs are and how to use them to improve
 * lucid dreaming practice and dream awareness.
 *
 * @function showDreamSignsHelp
 * @returns {void}
 * @since 2.04.39
 *
 * @example
 * // Called via action delegation system
 * // data-action="show-dream-signs-help"
 * showDreamSignsHelp();
 */
function showDreamSignsHelp() {
    showInfoTooltip({
        triggerId: 'show-dream-signs-help',
        tooltipId: 'dream-signs-help-tooltip',
        title: '⚡ Dream Signs Explained',
        content: `
            <div class="help-content">
                <p><strong>Dream signs are recurring elements that can trigger lucidity!</strong></p>
                <p>Track these patterns to improve dream awareness and increase your chances of becoming lucid:</p>
                <div class="dream-signs-categories">
                    <div class="signs-group">
                        <strong>🔄 Common Signs:</strong> flying, impossible architecture, dead people alive, broken technology, weird text/numbers
                    </div>
                    <div class="signs-group">
                        <strong>🎯 Personal Signs:</strong> specific locations from your past, recurring dream characters, familiar impossible scenarios
                    </div>
                    <div class="signs-group">
                        <strong>💡 Reality Check Triggers:</strong> mirrors, clocks, light switches, hands, reading text
                    </div>
                </div>
                <p><small><em>Tip: Review your dream signs regularly to recognize patterns and improve lucid dreaming!</em></small></p>
            </div>
        `,
        closeAction: 'close-dream-signs-help',
        closeText: 'Got it!',
        autoCloseMs: 15000,
        className: 'form-help-tooltip'
    });
}

/**
 * Shows smart search help tooltip with advanced search syntax explanation.
 *
 * Displays comprehensive help for the smart search feature, explaining field-specific
 * search prefixes and providing examples of advanced search queries. This helps users
 * discover and effectively use the smart search functionality for precise dream filtering.
 *
 * @function showSmartSearchHelp
 * @returns {void}
 * @since 2.04.01
 *
 * @example
 * // Called via action delegation system
 * // data-action="show-smart-search-help"
 * showSmartSearchHelp();
 */
function showSmartSearchHelp() {
    showInfoTooltip({
        triggerId: 'show-smart-search-help',
        tooltipId: 'smart-search-help-tooltip',
        title: '🔍 Smart Search Guide',
        content: `
            <div class="help-content">
                <p><strong>Use field-specific prefixes to search precisely!</strong></p>
                <div class="smart-search-examples">
                    <div class="search-group">
                        <strong>📝 Field Prefixes:</strong>
                        <ul>
                            <li><code>title:</code> - Search only in dream titles</li>
                            <li><code>content:</code> - Search only in dream descriptions</li>
                            <li><code>emotion:</code> - Search only in emotions field</li>
                            <li><code>tag:</code> - Search only in tags</li>
                            <li><code>sign:</code> - Search only in dream signs</li>
                        </ul>
                    </div>
                    <div class="search-group">
                        <strong>💡 Examples:</strong>
                        <ul>
                            <li><code>title:flying</code> - Dreams with "flying" in title</li>
                            <li><code>tag:lucid emotion:happy</code> - Lucid dreams with happy emotions</li>
                            <li><code>content:nightmare family</code> - Dreams with "nightmare" in content OR "family" anywhere</li>
                            <li><code>title:"vacation dream"</code> - Use quotes for phrases with spaces</li>
                        </ul>
                    </div>
                    <div class="search-group">
                        <strong>🚀 Pro Tips:</strong>
                        <ul>
                            <li>Mix field searches with general terms</li>
                            <li>Multiple field searches work together (AND logic)</li>
                            <li>No prefix = search all fields (backward compatible)</li>
                            <li>Case-insensitive matching for all searches</li>
                        </ul>
                    </div>
                </div>
                <p><small><em>Smart search makes finding specific dreams fast and precise!</em></small></p>
            </div>
        `,
        closeAction: 'close-smart-search-help',
        closeText: 'Got it!',
        autoCloseMs: 20000,
        className: 'form-help-tooltip smart-search-tooltip'
    });
}

// ================================
// ES MODULE EXPORTS
// ================================

export {
    showInfoTooltip,
    showExportFormatInfo,
    closeInfoTooltip,
    closeExportFormatInfo,
    showEmotionsHelp,
    showTagsHelp,
    showDreamSignsHelp,
    showSmartSearchHelp
};
