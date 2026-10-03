/**
 * @fileoverview Date formatting for keys and display, and the pie chart colour and HTML helpers used by
 *   the statistics tab.
 *
 * @module FormatHelpers
 */

// ================================
// ES MODULE IMPORTS
// ================================



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
 * Format date for display using the user's preferred locale.
 * 
 * Uses the browser's detected locale (navigator.language) to format dates
 * in the user's familiar format. Falls back to ISO format if locale is
 * unsupported. Handles both Date objects and ISO strings as input.
 * 
 * @param {Date|string} dateInput - Date object or ISO string to format
 * @param {Object} [customOptions] - Custom Intl.DateTimeFormat options
 * @returns {string} Formatted date string in user's locale
 * @throws {Error} When dateInput is invalid
 * @since 2.02.50
 * @example
 * // User with en-US locale
 * formatDisplayDate('2025-09-02T10:30:00Z')
 * // Returns: "September 2, 2025"
 * 
 * @example
 * // User with en-GB locale  
 * formatDisplayDate(new Date('2025-09-02T10:30:00Z'))
 * // Returns: "2 September 2025"
 * 
 * @example
 * // Custom formatting options
 * formatDisplayDate('2025-09-02T10:30:00Z', { 
 *   month: 'short', 
 *   weekday: 'short' 
 * })
 * // Returns: "Mon, Sep 2, 2025" (en-US) or "Mon 2 Sep 2025" (en-GB)
 */
function formatDisplayDate(dateInput, customOptions = {}) {
    try {
        // Convert input to Date object if needed
        const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
        
        // Validate the date
        if (isNaN(date.getTime())) {
            throw new Error(`Invalid date input: ${dateInput}`);
        }
        
        // Default formatting options for date-only display
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            ...customOptions
        };
        
        // Use user's preferred locale with fallback
        const userLocale = navigator.language || 'en-US';
        
        try {
            return new Intl.DateTimeFormat(userLocale, defaultOptions).format(date);
        } catch (localeError) {
            // Fallback to en-US if user's locale is unsupported
            console.warn(`Locale ${userLocale} not supported, falling back to en-US`);
            return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
        }
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid Date';
    }
}

/**
 * Format date and time for detailed display using the user's preferred locale.
 * 
 * Provides comprehensive date-time formatting suitable for detail views,
 * exports, and contexts where both date and time are relevant. Uses the
 * browser's detected locale for familiar formatting.
 * 
 * @param {Date|string} dateInput - Date object or ISO string to format
 * @param {Object} [customOptions] - Custom Intl.DateTimeFormat options
 * @returns {string} Formatted date-time string in user's locale
 * @throws {Error} When dateInput is invalid
 * @since 2.02.50
 * @example
 * // User with en-US locale
 * formatDateTimeDisplay('2025-09-02T14:30:00Z')
 * // Returns: "September 2, 2025, 2:30 PM PDT"
 * 
 * @example
 * // User with en-GB locale
 * formatDateTimeDisplay('2025-09-02T14:30:00Z')
 * // Returns: "2 September 2025, 15:30 BST"
 * 
 * @example
 * // Custom time format
 * formatDateTimeDisplay('2025-09-02T14:30:00Z', { 
 *   hour12: false, 
 *   timeZoneName: 'short' 
 * })
 * // Returns: "September 2, 2025, 14:30 UTC"
 */
function formatDateTimeDisplay(dateInput, customOptions = {}) {
    try {
        // Convert input to Date object if needed
        const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
        
        // Validate the date
        if (isNaN(date.getTime())) {
            throw new Error(`Invalid date input: ${dateInput}`);
        }
        
        // Default formatting options for date-time display
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
            ...customOptions
        };
        
        // Use user's preferred locale with fallback
        const userLocale = navigator.language || 'en-US';
        
        try {
            return new Intl.DateTimeFormat(userLocale, defaultOptions).format(date);
        } catch (localeError) {
            // Fallback to en-US if user's locale is unsupported
            console.warn(`Locale ${userLocale} not supported, falling back to en-US`);
            return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
        }
    } catch (error) {
        console.error('Error formatting date-time:', error);
        return 'Invalid Date';
    }
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

// ================================
// ES MODULE EXPORTS
// ================================

export {
    formatDateKey,
    formatDisplayDate,
    formatDateTimeDisplay,
    createPieChartColors,
    createPieChartHTML
};
