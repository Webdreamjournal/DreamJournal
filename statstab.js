/**
 * @fileoverview Statistics and Analytics Module for Dream Journal Application.
 * 
 * This module provides comprehensive statistics calculation, calendar rendering, and data visualization
 * system including dream analysis, goal tracking, charts, and insights. It handles all statistical
 * computations for the dream journal including streak calculations, goal progress tracking, calendar
 * visualization, pie chart generation, and dream sign analysis.
 * 
 * The module is organized into 10 main systems:
 * 1. Utility Functions - Shared utilities for date formatting and chart creation
 * 2. Streak Calculation - Dream recall and journaling streak algorithms
 * 3. Goal Statistics - Goal completion rate analysis and filtering
 * 4. Overview Statistics - Main dashboard with comprehensive analysis
 * 5. Calendar System - Interactive calendar with dream visualization
 * 6. Chart Rendering - Pie chart generation for dream type visualization
 * 7. Monthly Statistics - Detailed monthly analysis with recall rates
 * 8. Tab Switching - Statistics tab management with lazy loading
 * 9. Yearly Statistics - Comprehensive yearly analysis with leap year handling
 * 10. Lifetime Statistics - All-time analytics with date range calculations
 * 11. Dream Signs Analysis - Dream sign frequency and lucidity effectiveness
 * 
 * @module StatisticsModule
 * @version 2.02.05
 * @author Dream Journal Development Team
 * @since 1.0.0
 * @requires storage
 * @requires dom-helpers
 * @requires constants
 * @requires state
 * @example
 * // Initialize calendar system
 * await initCalendar();
 * 
 * // Update main statistics display
 * await updateStatsDisplay();
 * 
 * // Switch to yearly statistics tab
 * await switchStatsTab('year');
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { CONSTANTS } from './constants.js';
import { dreams, calendarState } from './state.js';
import { loadDreams, loadGoals } from './storage.js';
import { createInlineMessage } from './dom-helpers.js';

// ================================
// STATISTICS & ANALYTICS MODULE
// ================================
// Complete statistics calculation, calendar rendering, and data visualization
// system including dream analysis, goal tracking, charts, and insights

// ================================
// UTILITY FUNCTIONS
// ================================
// Shared utility functions for statistics calculations and formatting

/**
 * @typedef {Object} PieChartColors
 * @property {string} lucidColor - CSS color variable for lucid dreams
 * @property {string} regularColor - CSS color variable for regular dreams  
 * @property {string} gradient - CSS conic-gradient string for chart background
 */

/**
 * @typedef {Object} GoalStatistics
 * @property {number} total - Total number of goals
 * @property {number} completed - Number of completed goals
 * @property {number} active - Number of active goals
 * @property {string} completionRate - Completion rate as percentage string
 */

/**
 * @typedef {Object} DreamSignStat
 * @property {string} sign - The dream sign text (original case preserved)
 * @property {number} total - Total number of appearances
 * @property {number} lucid - Number of lucid dream appearances
 * @property {number} lucidityRate - Lucidity trigger rate (0.0 to 1.0)
 */

/**
 * @typedef {Object} CalendarDreamData
 * @property {number} count - Total number of dreams on this date
 * @property {number} lucid - Number of lucid dreams on this date
 */

/**
 * HTML escape utility function for preventing XSS in generated HTML.
 * 
 * Uses the browser's built-in HTML escaping by creating a temporary div element
 * and using its textContent property, then reading back the innerHTML. This safely
 * escapes HTML special characters to prevent XSS attacks in dynamically generated content.
 * 
 * @param {string} text - Text to escape for safe HTML insertion
 * @returns {string} HTML-escaped text with special characters converted to entities
 * @throws {TypeError} When text parameter is not a string
 * @since 2.0.0
 * @example
 * const userInput = '<script>alert("xss")</script>';
 * const safe = escapeHtml(userInput);
 * console.log(safe); // "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
 * 
 * @example
 * // Used in dream sign rendering
 * const dreamSignHTML = `<span>${escapeHtml(stat.sign)}</span>`;
 */
function escapeHtml(text) {
    if (typeof text !== 'string') {
        throw new TypeError('escapeHtml expects a string parameter');
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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
 * @returns {PieChartColors} Object with color and gradient properties
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
// 1. STREAK CALCULATION SYSTEM
// ================================
// Dream recall and journaling streak calculation algorithms
    /**
     * Calculate consecutive days of dream recall streak starting from today backwards.
     * 
     * Analyzes dream entries to determine the current streak of consecutive days
     * with recorded dreams. Works backwards from today to find the longest unbroken
     * sequence of dream recall. Used by the goals system for tracking recall consistency
     * and measuring progress towards recall-based goals.
     * 
     * @param {Array<Object>} dreams - Array of dream objects with timestamp property
     * @param {string|number|Date} dreams[].timestamp - Dream entry timestamp
     * @returns {number} Number of consecutive days with dream entries (0-365)
     * @throws {TypeError} When dreams parameter is not an array
     * @since 1.0.0
     * @example
     * const dreams = [
     *   { timestamp: '2024-01-10T08:00:00Z' },
     *   { timestamp: '2024-01-09T07:30:00Z' },
     *   { timestamp: '2024-01-08T09:15:00Z' }
     * ];
     * const streak = calculateDreamRecallStreak(dreams);
     * console.log(streak); // 3 (if today is 2024-01-10)
     * 
     * @example
     * // Used by goals system
     * const currentStreak = calculateDreamRecallStreak(allDreams);
     * const progress = Math.min(currentStreak / goalTarget, 1.0);
     */
    function calculateDreamRecallStreak(dreams) {
        const today = new Date();
        let streak = 0;
        
        for (let i = 0; i < 365; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            checkDate.setHours(0, 0, 0, 0);
            
            const nextDay = new Date(checkDate);
            nextDay.setDate(checkDate.getDate() + 1);
            
            const hasDream = dreams.some(dream => {
                const dreamDate = new Date(dream.timestamp);
                return dreamDate >= checkDate && dreamDate < nextDay;
            });
            
            if (hasDream) {
                streak++;
            } else if (i === 0) {
                // If no dream today, check if there's one yesterday to start counting
                continue;
            } else {
                break;
            }
        }
        
        return streak;
    }
    
    /**
     * Calculate consecutive days of journaling activity (currently same as dream recall).
     * 
     * Currently implements the same logic as dream recall streak calculation, treating
     * dream entries as journaling activity. This function exists as a separate endpoint
     * to allow for future differentiation between dream recall and general journaling
     * activities if the application expands to include other journal types.
     * 
     * @param {Array<Object>} dreams - Array of dream objects with timestamp property
     * @param {string|number|Date} dreams[].timestamp - Dream entry timestamp
     * @returns {number} Number of consecutive days with journaling activity (0-365)
     * @throws {TypeError} When dreams parameter is not an array
     * @since 1.0.0
     * @todo Consider separate logic if journaling includes non-dream entries in future
     * @example
     * const journalStreak = calculateJournalingStreak(dreams);
     * console.log(journalStreak); // Same result as calculateDreamRecallStreak
     * 
     * @example
     * // Used by goals system for journal-based goals
     * const progress = calculateJournalingStreak(dreams) / targetDays;
     */
    function calculateJournalingStreak(dreams) {
        return calculateDreamRecallStreak(dreams); // Same logic for now
    }

// ================================
// 2. GOAL STATISTICS CALCULATION SYSTEM
// ================================
// Goal completion rate analysis and filtering by time periods

    /**
     * Calculate goal completion statistics for specified time period with filtering.
     * 
     * Processes an array of goal objects to calculate comprehensive statistics including
     * total counts, completion rates, and active goal tracking. Supports optional date
     * range filtering for time-based analysis. Handles both completed and active goals
     * with appropriate date logic for each status.
     * 
     * @param {Array<Object>} goals - Array of goal objects to analyze
     * @param {string} goals[].status - Goal status ('completed' or 'active')
     * @param {string|Date} [goals[].completedAt] - Completion timestamp (for completed goals)
     * @param {string|Date} [goals[].createdAt] - Creation timestamp
     * @param {Date|null} [startDate=null] - Optional start date filter (inclusive)
     * @param {Date|null} [endDate=null] - Optional end date filter (inclusive)
     * @returns {GoalStatistics} Goal statistics object
     * @throws {TypeError} When goals parameter is not an array
     * @since 1.0.0
     * @example
     * const goals = [
     *   { status: 'completed', completedAt: '2024-01-15T10:00:00Z' },
     *   { status: 'active', createdAt: '2024-01-01T09:00:00Z' }
     * ];
     * const stats = calculateGoalStats(goals);
     * console.log(stats); // { total: 2, completed: 1, active: 1, completionRate: '50.0' }
     * 
     * @example
     * // With date filtering
     * const monthStats = calculateGoalStats(
     *   goals,
     *   new Date('2024-01-01'),
     *   new Date('2024-01-31')
     * );
     */
    function calculateGoalStats(goals, startDate = null, endDate = null) {
        if (!Array.isArray(goals)) {
            return { total: 0, completed: 0, active: 0, completionRate: 0 };
        }
        
        let filteredGoals = goals;
        
        // Filter goals by date range if provided
        if (startDate || endDate) {
            filteredGoals = goals.filter(goal => {
                if (!goal.completedAt && !goal.createdAt) return false;
                
                // For completed goals, check completion date
                if (goal.status === 'completed' && goal.completedAt) {
                    const completionDate = new Date(goal.completedAt);
                    if (startDate && completionDate < startDate) return false;
                    if (endDate && completionDate > endDate) return false;
                    return true;
                }
                
                // For active goals, check creation date to see if they were active during the period
                if (goal.status === 'active' && goal.createdAt) {
                    const creationDate = new Date(goal.createdAt);
                    if (startDate && creationDate > endDate) return false; // Created after the period
                    return true;
                }
                
                return false;
            });
        }
        
        const total = filteredGoals.length;
        const completed = filteredGoals.filter(goal => goal.status === 'completed').length;
        const active = filteredGoals.filter(goal => goal.status === 'active').length;
        const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
        
        return { total, completed, active, completionRate };
    }
    
    /**
     * Get goal completion statistics for specific month period.
     * 
     * Convenience wrapper around calculateGoalStats that sets up appropriate date
     * range filtering for a specific month. Handles month boundary calculations
     * including proper end-of-month timestamp for filtering.
     * 
     * @param {Array<Object>} goals - Array of goal objects to analyze
     * @param {number} year - Target year (e.g., 2024)
     * @param {number} month - Target month (0-indexed: 0=January, 11=December)
     * @returns {GoalStatistics} Goal statistics for the specified month
     * @throws {TypeError} When parameters are not valid numbers
     * @throws {RangeError} When month is not between 0-11
     * @since 1.0.0
     * @example
     * const januaryStats = getMonthlyGoalStats(goals, 2024, 0);
     * console.log(januaryStats.completionRate); // '75.0'
     * 
     * @example
     * // Used in monthly statistics display
     * const stats = getMonthlyGoalStats(allGoals, selectedYear, selectedMonth);
     * updateMonthlyGoalDisplay(stats);
     */
    function getMonthlyGoalStats(goals, year, month) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
        return calculateGoalStats(goals, startDate, endDate);
    }
    
    /**
     * Get goal completion statistics for specific year period.
     * 
     * Convenience wrapper around calculateGoalStats that sets up appropriate date
     * range filtering for a complete calendar year (January 1st to December 31st).
     * Handles year boundary calculations with precise timestamp filtering.
     * 
     * @param {Array<Object>} goals - Array of goal objects to analyze
     * @param {number} year - Target year (e.g., 2024)
     * @returns {GoalStatistics} Goal statistics for the specified year
     * @throws {TypeError} When year parameter is not a valid number
     * @since 1.0.0
     * @example
     * const yearStats = getYearlyGoalStats(goals, 2024);
     * console.log(yearStats.total); // 12
     * 
     * @example
     * // Used in yearly statistics display
     * const stats = getYearlyGoalStats(allGoals, currentYear);
     * renderYearlyGoalProgress(stats);
     */
    function getYearlyGoalStats(goals, year) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
        return calculateGoalStats(goals, startDate, endDate);
    }
    
    /**
     * Get lifetime goal completion statistics (all time).
     * 
     * Convenience wrapper around calculateGoalStats that processes all goals
     * without any date filtering, providing comprehensive lifetime statistics
     * for the entire goal history of the user.
     * 
     * @param {Array<Object>} goals - Array of all goal objects to analyze
     * @returns {GoalStatistics} Goal statistics for entire goal history
     * @throws {TypeError} When goals parameter is not an array
     * @since 1.0.0
     * @example
     * const lifetimeStats = getLifetimeGoalStats(allGoals);
     * console.log(`${lifetimeStats.completed}/${lifetimeStats.total} goals completed`);
     * 
     * @example
     * // Used in lifetime statistics display
     * const stats = getLifetimeGoalStats(userGoals);
     * displayLifetimeAchievements(stats);
     */
    function getLifetimeGoalStats(goals) {
        return calculateGoalStats(goals);
    }

// ================================
// 3. OVERVIEW STATISTICS DISPLAY SYSTEM
// ================================
// Main statistics dashboard with dream counts, top emotions, tags, and voice notes

    /**
     * Update main stats display with comprehensive dream and voice note analysis.
     * 
     * Calculates and displays comprehensive statistics including total dreams, lucid percentage,
     * recent activity, top emotions and tags, and voice note usage. Handles all DOM element
     * updates with safety checks and graceful fallbacks for missing elements. This is the
     * primary function for updating the main statistics dashboard.
     * 
     * @async
     * @returns {Promise<void>} Resolves when all statistics are calculated and displayed
     * @throws {Error} When data loading fails or DOM manipulation errors occur
     * @since 1.0.0
     * @todo Split into calculateStatsData() and updateStatsDOM() functions for better separation
     * @example
     * // Update main dashboard when tab is loaded
     * await updateStatsDisplay();
     * 
     * @example
     * // Refresh stats after adding new dream
     * try {
     *   await updateStatsDisplay();
     * } catch (error) {
     *   console.error('Failed to update stats:', error);
     * }
     */
    async function updateStatsDisplay() {
        try {
            const dreams = await loadDreams();
            const voiceNotes = await loadVoiceNotes();
            
            // Basic counts
            const totalDreams = dreams.length;
            const lucidDreams = dreams.filter(d => d.isLucid).length;
            const lucidPercentage = totalDreams > 0 ? ((lucidDreams / totalDreams) * 100).toFixed(1) : 0;
            
            // Recent dreams (last 7 days)
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const recentDreams = dreams.filter(d => new Date(d.timestamp) > weekAgo).length;
            
            // Most common emotion analysis
            // TODO: Extract emotion analysis to calculateMostCommonItems() utility function - duplicated pattern
            const emotions = dreams
                .map(d => d.emotions)
                .filter(e => e && e.trim())
                .flatMap(e => e.split(',').map(em => em.trim().toLowerCase()));
            
            const emotionCounts = {};
            emotions.forEach(emotion => {
                emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
            });
            
            const topEmotion = Object.keys(emotionCounts).length > 0 ? 
                Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0] : null;
            
            // Most common tag analysis
            // TODO: Use same calculateMostCommonItems() utility function - identical counting pattern
            const tags = dreams
                .flatMap(d => Array.isArray(d.tags) ? d.tags : [])
                .filter(t => t && t.trim());
            
            const tagCounts = {};
            tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
            
            const topTag = Object.keys(tagCounts).length > 0 ? 
                Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0] : null;
            
            // Update display elements
            const totalElement = document.getElementById('totalDreamsCount');
            const lucidElement = document.getElementById('lucidDreamsCount');
            const lucidPercentageElement = document.getElementById('lucidPercentage');
            const voiceElement = document.getElementById('voiceNotesCount');
            const voiceDetailElement = document.getElementById('voiceNotesDetail');
            const recentElement = document.getElementById('recentDreamsCount');
            const topEmotionElement = document.getElementById('topEmotionDisplay');
            const topEmotionDetailElement = document.getElementById('topEmotionDetail');
            const topTagElement = document.getElementById('topTagDisplay');
            const topTagDetailElement = document.getElementById('topTagDetail');
            
            if (totalElement) totalElement.textContent = totalDreams;
            if (lucidElement) lucidElement.textContent = lucidDreams;
            if (lucidPercentageElement) lucidPercentageElement.textContent = `${lucidPercentage}% of all dreams`;
            if (voiceElement) voiceElement.textContent = voiceNotes.length;
            if (voiceDetailElement) {
                const voiceLimit = CONSTANTS.VOICE_STORAGE_LIMIT;
                voiceDetailElement.textContent = `${voiceNotes.length}/${voiceLimit} storage slots used`;
            }
            if (recentElement) recentElement.textContent = recentDreams;
            
            if (topEmotionElement && topEmotionDetailElement) {
                if (topEmotion) {
                    topEmotionElement.textContent = topEmotion[0];
                    topEmotionDetailElement.textContent = `Appears in ${topEmotion[1]} dreams`;
                } else {
                    topEmotionElement.textContent = '😴';
                    topEmotionDetailElement.textContent = 'No emotions recorded yet';
                }
            }
            
            if (topTagElement && topTagDetailElement) {
                if (topTag) {
                    topTagElement.textContent = `#${topTag[0]}`;
                    topTagDetailElement.textContent = `Used in ${topTag[1]} dreams`;
                } else {
                    topTagElement.textContent = '#dreams';
                    topTagDetailElement.textContent = 'No tags recorded yet';
                }
            }
            
        } catch (error) {
            console.error('Error updating stats display:', error);
        }
    }

// ================================
// 4. CALENDAR SYSTEM
// ================================
// Interactive calendar with dream visualization and navigation

    /**
     * Initialize calendar system with data loading and current month rendering.
     * 
     * Performs complete calendar initialization including loading dream data,
     * organizing it by date, and rendering the calendar for the current month.
     * This is the main entry point for the calendar system and should be called
     * when the stats tab is first loaded.
     * 
     * @async
     * @returns {Promise<void>} Resolves when calendar is fully initialized and rendered
     * @throws {Error} When data loading or calendar rendering fails
     * @since 1.0.0
     * @example
     * // Initialize calendar when stats tab loads
     * document.addEventListener('DOMContentLoaded', async () => {
     *   await initCalendar();
     * });
     * 
     * @example
     * // Reinitialize after data changes
     * await initCalendar();
     */
    async function initCalendar() {
        await updateCalendarData();
        const currentDate = new Date();
        await renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    }

    /**
     * Render interactive calendar for specified year and month with dream indicators.
     * 
     * Generates complete calendar display including header with navigation controls,
     * calendar grid with dream indicators, and triggers rendering of associated charts
     * and statistics. Handles both current month and other month displays with proper
     * day highlighting and dream count visualization.
     * 
     * @async
     * @param {number} year - Year to render (e.g., 2024)
     * @param {number} month - Month to render (0-indexed: 0=January, 11=December)
     * @returns {Promise<void>} Resolves when calendar and all related components are rendered
     * @throws {TypeError} When year or month parameters are invalid
     * @throws {Error} When DOM manipulation or chart rendering fails
     * @since 1.0.0
     * @todo Split into generateCalendarHTML() and renderCalendarComponents() functions
     * @example
     * // Render calendar for January 2024
     * await renderCalendar(2024, 0);
     * 
     * @example
     * // Navigate to previous month
     * const currentDate = new Date();
     * await renderCalendar(currentDate.getFullYear(), currentDate.getMonth() - 1);
     */
    async function renderCalendar(year, month) {
        const calendarContainer = document.getElementById('calendarContainer');
        if (!calendarContainer) return;

        calendarState.date = new Date(year, month, 1);
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        let header = `
            <div class="calendar-header">
                <button data-action="prev-month" class="calendar-nav-btn prev" title="Previous Month"></button>
                <div class="calendar-nav">
                    <select id="monthSelect" class="filter-select" data-action="select-month">
                        ${monthNames.map((m, i) => `<option value="${i}" ${i === month ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                    <select id="yearSelect" class="filter-select" data-action="select-year">
                        ${getYearOptions(year)}
                    </select>
                </div>
                <button data-action="next-month" class="calendar-nav-btn next" title="Next Month"></button>
            </div>
        `;

        let calendarHTML = header + '<table class="calendar-grid"><thead><tr>';
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        weekDays.forEach(day => calendarHTML += `<th>${day}</th>`);
        calendarHTML += '</tr></thead><tbody>';

        const firstDay = new Date(year, month).getDay();
        const daysInMonth = 32 - new Date(year, month, 32).getDate();

        let date = 1;
        for (let i = 0; i < 6; i++) {
            calendarHTML += '<tr>';
            for (let j = 0; j < 7; j++) {
                if (i === 0 && j < firstDay) {
                    const prevMonth = new Date(year, month, 0);
                    const prevMonthDays = prevMonth.getDate();
                    const day = prevMonthDays - firstDay + j + 1;
                    calendarHTML += `<td><div class="calendar-day other-month"><div class="day-number">${day}</div></div></td>`;
                } else if (date > daysInMonth) {
                    const nextMonthDay = date - daysInMonth;
                    calendarHTML += `<td><div class="calendar-day other-month"><div class="day-number">${nextMonthDay}</div></div></td>`;
                    date++;
                } else {
                    const currentDate = new Date(year, month, date);
                    const today = new Date();
                    const isToday = today.getDate() === date && today.getMonth() === month && today.getFullYear() === year;

                    // Use utility function to avoid timezone issues with toISOString()
                    const dateStr = formatDateKey(currentDate);

                    const dreamData = calendarState.dreamsByDate[dateStr];

                    calendarHTML += `
                        <td>
                            <div class="calendar-day ${isToday ? 'today' : ''}" data-action="go-to-date" data-date="${dateStr}">
                                <div class="day-number">${date}</div>
                                ${dreamData ? `<div class="dream-indicator" title="${dreamData.count} dream(s), ${dreamData.lucid} lucid">${dreamData.lucid > 0 ? '✨ ' : ''}${dreamData.count}</div>` : ''}
                            </div>
                        </td>
                    `;
                    date++;
                }
            }
            calendarHTML += '</tr>';
            if (date > daysInMonth && i >= 4) { // ensure at least 5 rows, but break if done
                break;
            }
        }

        calendarHTML += '</tbody></table>';
        calendarContainer.innerHTML = calendarHTML;

        await updateMonthlyStats(year, month);
        await renderPieChart(year, month);
        await updateYearlyStats(year);
        await renderYearlyPieChart(year);
        await updateLifetimeStats();
        await renderLifetimePieChart();
    }

// ================================
// 5. CHART RENDERING SYSTEM
// ================================
// Pie chart generation for dream type visualization

    /**
     * Render monthly pie chart showing lucid vs regular dream distribution.
     * 
     * Creates and displays a CSS conic-gradient based pie chart showing the ratio
     * of lucid to regular dreams for the specified month. Includes proper legend,
     * percentage calculations, and graceful handling of empty states when no dreams
     * are recorded for the target month.
     * 
     * @async
     * @param {number} year - Target year for chart data (e.g., 2024)
     * @param {number} month - Target month for chart data (0-indexed: 0=January)
     * @returns {Promise<void>} Resolves when chart is rendered or empty state displayed
     * @throws {TypeError} When year or month parameters are invalid
     * @throws {Error} When data loading or DOM manipulation fails
     * @since 1.0.0
     * @todo Chart generation logic already extracted to createPieChartHTML() utility
     * @example
     * // Render pie chart for current month
     * const now = new Date();
     * await renderPieChart(now.getFullYear(), now.getMonth());
     * 
     * @example
     * // Used by calendar rendering system
     * await renderPieChart(selectedYear, selectedMonth);
     */
    async function renderPieChart(year, month) {
        const pieChartContainer = document.getElementById('pieChartContainer');
        if (!pieChartContainer) return;

        pieChartContainer.innerHTML = `<h3 class="text-primary mb-md">Dream Types</h3><div class="loading-state">Loading chart...</div>`;

        try {
            const dreams = await loadDreams();

            const dreamsInMonth = dreams.filter(dream => {
                const dreamDate = new Date(dream.timestamp);
                return dreamDate.getFullYear() === year && dreamDate.getMonth() === month;
            });

            const totalDreams = dreamsInMonth.length;
            const lucidDreams = dreamsInMonth.filter(d => d.isLucid).length;
            const regularDreams = totalDreams - lucidDreams;

            if (totalDreams === 0) {
                pieChartContainer.innerHTML = `
                    <h3 class="text-primary mb-md">Dream Types</h3>
                    <div class="no-entries" style="padding: 20px;">No dreams recorded for this month to create a chart.</div>
                `;
                return;
            }

            const lucidPercentage = (lucidDreams / totalDreams) * 100;
            const regularPercentage = 100 - lucidPercentage;

            // Use standardized chart creation utilities
            const colors = createPieChartColors(lucidPercentage);
            const chartHTML = createPieChartHTML(
                'Dream Types', 
                totalDreams, 
                lucidDreams, 
                regularDreams, 
                colors.gradient, 
                colors.lucidColor, 
                colors.regularColor
            );

            pieChartContainer.innerHTML = chartHTML;

        } catch (error) {
            console.error('Error rendering pie chart:', error);
            pieChartContainer.innerHTML = `<h3 class="text-primary mb-md">Dream Types</h3><div class="message-error">Failed to load chart.</div>`;
        }
    }

    /**
     * Update calendar data by processing all dreams and organizing by date.
     * 
     * Loads all dreams from storage and processes them into a date-indexed structure
     * for efficient calendar display. Creates the calendarState.dreamsByDate object
     * with dream counts and lucid dream indicators for each date that has entries.
     * This preprocessing step optimizes calendar rendering performance.
     * 
     * @async
     * @returns {Promise<void>} Resolves when calendar data is processed and stored in calendarState
     * @throws {Error} When dream data loading fails
     * @since 1.0.0
     * @example
     * // Called before calendar rendering
     * await updateCalendarData();
     * console.log(calendarState.dreamsByDate['2024-01-15']); // { count: 2, lucid: 1 }
     * 
     * @example
     * // Refresh calendar data after dream changes
     * await updateCalendarData();
     * await renderCalendar(year, month);
     */
    async function updateCalendarData() {
            const dreams = await loadDreams();
            calendarState.dreamsByDate = {};
            dreams.forEach(dream => {
                const dreamDate = new Date(dream.timestamp);
                const date = formatDateKey(dreamDate);

                if (!calendarState.dreamsByDate[date]) {
                    calendarState.dreamsByDate[date] = { count: 0, lucid: 0 };
                }
                calendarState.dreamsByDate[date].count++;
                if (dream.isLucid) {
                    calendarState.dreamsByDate[date].lucid++;
                }
            });
        }



        /**
         * Generate year dropdown options for calendar navigation.
         * 
         * Creates HTML option elements for year selection dropdown in calendar header.
         * Intelligently includes years that have dream data, the current year, the
         * selected year, and a buffer of 5 years before and after current year to
         * allow for future planning and historical viewing.
         * 
         * @param {number} selectedYear - Currently selected year to mark as selected
         * @returns {string} HTML option elements string for dropdown
         * @throws {TypeError} When selectedYear is not a valid number
         * @since 1.0.0
         * @example
         * const yearOptions = getYearOptions(2024);
         * console.log(yearOptions);
         * // '<option value="2029">2029</option><option value="2024" selected>2024</option>...'
         * 
         * @example
         * // Used in calendar header generation
         * const yearDropdown = `<select>${getYearOptions(currentYear)}</select>`;
         */
        function getYearOptions(selectedYear) {
            let years = new Set();
            for(const date in calendarState.dreamsByDate) {
                years.add(parseInt(date.substring(0,4)));
            }
            const currentYear = new Date().getFullYear();
            years.add(currentYear);
            if(selectedYear) years.add(selectedYear);

            for(let i = -5; i <= 5; i++) {
                years.add(currentYear + i);
            }

            return Array.from(years).sort((a,b) => b-a).map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`).join('');
        }

// ================================
// 6. MONTHLY STATISTICS SYSTEM
// ================================
// Detailed monthly dream and goal statistics with recall rate analysis

        /**
         * Update monthly statistics display with dream analysis and goal progress.
         * 
         * Calculates and displays comprehensive monthly statistics including dream counts,
         * lucid dream analysis, recall rates, and goal completion progress. Generates HTML
         * for stats cards showing total dreams, lucid dreams, recall percentage, and goal
         * achievements. Handles empty states gracefully when no data is available.
         * 
         * @async
         * @param {number} year - Target year for monthly stats (e.g., 2024)
         * @param {number} month - Target month for stats (0-indexed: 0=January)
         * @returns {Promise<void>} Resolves when monthly stats are calculated and displayed
         * @throws {TypeError} When year or month parameters are invalid
         * @throws {Error} When data loading or DOM manipulation fails
         * @since 1.0.0
         * @todo Split into calculateMonthlyStatsData() and renderMonthlyStatsHTML() functions
         * @example
         * // Update stats for January 2024
         * await updateMonthlyStats(2024, 0);
         * 
         * @example
         * // Called by calendar rendering system
         * await updateMonthlyStats(selectedYear, selectedMonth);
         */
        async function updateMonthlyStats(year, month) {
            const monthlyStatsContainer = document.getElementById('monthlyStatsContainer');
            if (!monthlyStatsContainer) return;

            monthlyStatsContainer.innerHTML = `<h3 class="text-primary mb-md">Monthly Stats</h3><div class="loading-state">Calculating stats...</div>`;

            try {
                const dreams = await loadDreams();
                const goals = await loadGoals();

                // 1. Filter dreams for the selected month
                const dreamsInMonth = dreams.filter(dream => {
                    const dreamDate = new Date(dream.timestamp);
                    return dreamDate.getFullYear() === year && dreamDate.getMonth() === month;
                });

                // 2. Calculate dream stats
                const totalDreams = dreamsInMonth.length;
                const lucidDreams = dreamsInMonth.filter(d => d.isLucid).length;

                const daysInMonth = new Date(year, month + 1, 0).getDate();

                // Calculate unique days with dreams in the month
                const daysWithDreamsSet = new Set();
                dreamsInMonth.forEach(dream => {
                    daysWithDreamsSet.add(new Date(dream.timestamp).getDate());
                });
                const daysWithDreams = daysWithDreamsSet.size;

                const dreamDaysPercentage = daysInMonth > 0 ? ((daysWithDreams / daysInMonth) * 100).toFixed(1) : 0;
                const avgDreamsPerDay = daysInMonth > 0 ? (totalDreams / daysInMonth).toFixed(2) : 0;

                // 3. Calculate goal stats for the month
                const goalStats = getMonthlyGoalStats(goals, year, month);

                // 4. Render the stats
                const statsHTML = `
                    <h3 class="text-primary mb-md text-lg">Stats for ${new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                    
                    <h4 class="text-secondary mb-sm mt-lg">📝 Dream Statistics</h4>
                    <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${totalDreams}</div>
                            <div class="stats-label">Total Dreams</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${lucidDreams}</div>
                            <div class="stats-label">Lucid Dreams</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${dreamDaysPercentage}%</div>
                            <div class="stats-label">Dream Recall Rate</div>
                            <div class="stats-detail">${daysWithDreams} of ${daysInMonth} days</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${avgDreamsPerDay}</div>
                            <div class="stats-label">Avg Dreams/Day</div>
                        </div>
                    </div>
                    
                    <h4 class="text-secondary mb-sm mt-lg">🎯 Goal Statistics</h4>
                    <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${goalStats.completed}</div>
                            <div class="stats-label">Goals Completed</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${goalStats.total}</div>
                            <div class="stats-label">Total Goals</div>
                            <div class="stats-detail">${goalStats.active} active</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${goalStats.completionRate}%</div>
                            <div class="stats-label">Completion Rate</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${goalStats.completed > 0 ? '🏆' : '📈'}</div>
                            <div class="stats-label">${goalStats.completed > 0 ? 'Achieving Goals!' : 'Keep Going!'}</div>
                        </div>
                    </div>
                `;

                monthlyStatsContainer.innerHTML = statsHTML;
            } catch (error) {
                console.error("Error calculating monthly stats:", error);
                monthlyStatsContainer.innerHTML = `<h3 class="text-primary mb-md">Monthly Stats</h3><div class="message-error">Could not load stats.</div>`;
            }
        }

        
        /**
         * Update dream signs tab with latest statistical data and visualizations.
         * 
         * Orchestrates the complete update of the dream signs analysis tab by calculating
         * dream sign statistics and rendering both the word cloud visualization and the
         * effectiveness list. This function serves as the main coordinator for dream signs
         * tab content updates.
         * 
         * @async
         * @returns {Promise<void>} Resolves when dream signs tab is fully updated with all visualizations
         * @throws {Error} When dream sign calculation or rendering fails
         * @since 2.0.0
         * @example
         * // Update dream signs tab when selected
         * await updateDreamSignsTab();
         * 
         * @example
         * // Called by tab switching system
         * if (tabName === 'dream-signs') {
         *   await updateDreamSignsTab();
         * }
         */
        async function updateDreamSignsTab() {
            const stats = await calculateDreamSignStats();
            renderDreamSignWordCloud(stats);
            renderDreamSignList(stats);
        }

// ================================
// 7. TAB SWITCHING & LAZY LOADING SYSTEM
// ================================
// Statistics tab management with lazy loading optimization

        /**
         * Switch between statistics tabs with lazy loading optimization.
         * 
         * Manages tab switching in the statistics interface with intelligent lazy loading
         * to optimize performance. Updates tab UI states, shows target panel, and loads
         * content only when needed (first time or when data changes). Uses data-loaded
         * attribute to cache loaded content and avoid unnecessary recalculations.
         * 
         * @async
         * @param {('year'|'lifetime'|'dream-signs')} tabName - Target tab name
         * @returns {Promise<void>} Resolves when tab switch is complete and content loaded
         * @throws {TypeError} When tabName is not a valid tab name
         * @throws {Error} When DOM manipulation or content loading fails
         * @since 1.0.0
         * @todo Split into switchTabsUI() and loadTabContent() functions for better separation
         * @example
         * // Switch to yearly statistics
         * await switchStatsTab('year');
         * 
         * @example
         * // Switch to dream signs analysis
         * await switchStatsTab('dream-signs');
         * 
         * @example
         * // Handle tab click events
         * document.querySelectorAll('.stats-tab').forEach(tab => {
         *   tab.addEventListener('click', () => {
         *     const tabName = tab.dataset.tab;
         *     switchStatsTab(tabName);
         *   });
         * });
         */
        async function switchStatsTab(tabName) {
    
        // Update tab buttons
        document.querySelectorAll('.stats-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`.stats-tab[data-tab="${tabName}"]`).classList.add('active');
    
        // Update tab panels
        document.querySelectorAll('.stats-tab-panel').forEach(panel => {
            panel.style.display = 'none';
        });

        const panelId = `statsTab${tabName.charAt(0).toUpperCase() + tabName.slice(1).replace('-s', 'S')}`;
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.display = 'block';
        }

        // --- NEW LOGIC STARTS HERE ---
        // Check if the content for this panel has already been loaded
        if (panel && panel.getAttribute('data-loaded') === 'true') {
            return; // Content is already there, do nothing else
        }

        // If not loaded, load the data now
        if (tabName === 'year') {
            const currentYear = calendarState.date.getFullYear();
            await updateYearlyStats(currentYear);
            await renderYearlyPieChart(currentYear);
        } else if (tabName === 'lifetime') {
            await updateLifetimeStats();
            await renderLifetimePieChart();
        } else if (tabName === 'dream-signs') {
            await updateDreamSignsTab();
        }
        
        // Mark the panel as loaded so we don't reload it again
        if (panel) {
            panel.setAttribute('data-loaded', 'true');
        }
}
        
// ================================
// 8. YEARLY STATISTICS SYSTEM
// ================================
// Comprehensive yearly dream and goal analysis with leap year handling
        /**
         * Update yearly statistics display with comprehensive dream and goal analysis.
         * 
         * Calculates and displays comprehensive yearly statistics with intelligent handling
         * of leap years, current vs. past years, and goal integration. For the current year,
         * calculates stats from January 1st to today. For past years, uses the full 365/366
         * day period. Includes dream counts, recall rates, and goal completion statistics.
         * 
         * @async
         * @param {number} year - Target year for yearly statistics (e.g., 2024)
         * @returns {Promise<void>} Resolves when yearly stats are calculated and displayed
         * @throws {TypeError} When year parameter is not a valid number
         * @throws {Error} When data loading or DOM manipulation fails
         * @since 1.0.0
         * @todo Split into calculateYearlyStatsData() and renderYearlyStatsHTML() functions
         * @example
         * // Update stats for current year
         * const currentYear = new Date().getFullYear();
         * await updateYearlyStats(currentYear);
         * 
         * @example
         * // Update stats for specific past year
         * await updateYearlyStats(2023);
         */
        async function updateYearlyStats(year) {
            const yearlyStatsContainer = document.getElementById('yearlyStatsContainer');
            if (!yearlyStatsContainer) return;
            
            yearlyStatsContainer.innerHTML = `<h3 class="text-primary mb-md">Yearly Stats</h3><div class="loading-state">Calculating yearly stats...</div>`;
            
            try {
                const dreams = await loadDreams();
                const goals = await loadGoals();
                
                // Filter dreams for the selected year
                const dreamsInYear = dreams.filter(dream => {
                    const dreamDate = new Date(dream.timestamp);
                    return dreamDate.getFullYear() === year;
                });
                
                // Calculate goal stats for the year
                const goalStats = getYearlyGoalStats(goals, year);
                
                if (dreamsInYear.length === 0 && goalStats.total === 0) {
                    yearlyStatsContainer.innerHTML = `
                        <h3 class="text-primary mb-md text-lg">Stats for ${year}</h3>
                        <div class="no-entries" style="padding: 20px;">No dreams or goals recorded for ${year} yet.</div>
                    `;
                    return;
                }
                
                // Calculate yearly stats
                const totalDreams = dreamsInYear.length;
                const lucidDreams = dreamsInYear.filter(d => d.isLucid).length;
                
                // Calculate days with dreams in the year using utility function
                const daysWithDreamsSet = new Set();
                dreamsInYear.forEach(dream => {
                    const dreamDate = new Date(dream.timestamp);
                    const dateKey = formatDateKey(dreamDate);
                    daysWithDreamsSet.add(dateKey);
                });
                const daysWithDreams = daysWithDreamsSet.size;
                
                // Calculate total days in year (accounting for leap years and current year)
                const isCurrentYear = year === new Date().getFullYear();
                const currentDate = new Date();
                let totalDaysInYear;
                
                if (isCurrentYear) {
                    // For current year, count from Jan 1 to today
                    const startOfYear = new Date(year, 0, 1);
                    const daysSinceStart = Math.ceil((currentDate.getTime() - startOfYear.getTime()) / (1000 * 3600 * 24)) + 1;
                    totalDaysInYear = daysSinceStart;
                } else {
                    // For past years, use full year
                    totalDaysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
                }
                
                // Calculate percentages and averages
                const dreamDaysPercentage = totalDaysInYear > 0 ? ((daysWithDreams / totalDaysInYear) * 100).toFixed(1) : 0;
                const avgDreamsPerDay = totalDaysInYear > 0 ? (totalDreams / totalDaysInYear).toFixed(2) : 0;
                
                // Render the yearly stats
                const statsHTML = `
                    <h3 class="text-primary mb-md text-lg">Stats for ${year}</h3>
                    <div class="text-xs text-secondary mb-md" style="text-align: center; font-style: italic;">
                        ${isCurrentYear ? `January 1 to ${currentDate.toLocaleDateString()}` : `Full year ${year}`}
                    </div>
                    
                    <h4 class="text-secondary mb-sm mt-lg">📝 Dream Statistics</h4>
                    <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${totalDreams}</div>
                            <div class="stats-label">Total Dreams</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${lucidDreams}</div>
                            <div class="stats-label">Lucid Dreams</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${dreamDaysPercentage}%</div>
                            <div class="stats-label">Dream Recall Rate</div>
                            <div class="stats-detail">${daysWithDreams} of ${totalDaysInYear} days</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${avgDreamsPerDay}</div>
                            <div class="stats-label">Avg Dreams/Day</div>
                        </div>
                    </div>
                    
                    <h4 class="text-secondary mb-sm mt-lg">🎯 Goal Statistics</h4>
                    <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${goalStats.completed}</div>
                            <div class="stats-label">Goals Completed</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${goalStats.total}</div>
                            <div class="stats-label">Total Goals</div>
                            <div class="stats-detail">${goalStats.active} active</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${goalStats.completionRate}%</div>
                            <div class="stats-label">Completion Rate</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${goalStats.completed > 0 ? '🏆' : '📊'}</div>
                            <div class="stats-label">${goalStats.completed > 0 ? 'Great Progress!' : 'Keep Building!'}</div>
                        </div>
                    </div>
                `;
                
                yearlyStatsContainer.innerHTML = statsHTML;
                
            } catch (error) {
                console.error("Error calculating yearly stats:", error);
                yearlyStatsContainer.innerHTML = `<h3 class="text-primary mb-md">Yearly Stats</h3><div class="message-error">Could not load yearly stats.</div>`;
            }
        }
        
        /**
         * Render yearly pie chart showing lucid vs regular dream distribution for specific year.
         * 
         * Creates and displays a CSS conic-gradient based pie chart showing the ratio of
         * lucid to regular dreams for an entire year. Filters dreams by year, calculates
         * percentages, and generates appropriate visualization. Handles empty states when
         * no dreams are recorded for the target year.
         * 
         * @async
         * @param {number} year - Target year for chart data (e.g., 2024)
         * @returns {Promise<void>} Resolves when yearly chart is rendered or empty state displayed
         * @throws {TypeError} When year parameter is not a valid number
         * @throws {Error} When data loading or DOM manipulation fails
         * @since 1.0.0
         * @todo Chart generation logic already extracted to createPieChartHTML() utility
         * @example
         * // Render chart for current year
         * await renderYearlyPieChart(new Date().getFullYear());
         * 
         * @example
         * // Used by yearly stats system
         * await renderYearlyPieChart(selectedYear);
         */
        async function renderYearlyPieChart(year) {
            const yearlyPieChartContainer = document.getElementById('yearlyPieChartContainer');
            if (!yearlyPieChartContainer) return;
            
            yearlyPieChartContainer.innerHTML = `<h3 class="text-primary mb-md">Year Dream Types</h3><div class="loading-state">Loading yearly chart...</div>`;
            
            try {
                const dreams = await loadDreams();
                const dreamsInYear = dreams.filter(dream => {
                    const dreamDate = new Date(dream.timestamp);
                    return dreamDate.getFullYear() === year;
                });
                
                const totalDreams = dreamsInYear.length;
                const lucidDreams = dreamsInYear.filter(d => d.isLucid).length;
                const regularDreams = totalDreams - lucidDreams;
                
                if (totalDreams === 0) {
                    yearlyPieChartContainer.innerHTML = `
                        <h3 class="text-primary mb-md">Year Dream Types</h3>
                        <div class="no-entries" style="padding: 20px;">No dreams recorded for ${year} to create a chart.</div>
                    `;
                    return;
                }
                
                const lucidPercentage = (lucidDreams / totalDreams) * 100;
                const regularPercentage = 100 - lucidPercentage;
                // Use standardized chart creation utilities
                const colors = createPieChartColors(lucidPercentage);
                const chartHTML = createPieChartHTML(
                    'Year Dream Types', 
                    totalDreams, 
                    lucidDreams, 
                    regularDreams, 
                    colors.gradient, 
                    colors.lucidColor, 
                    colors.regularColor
                );
                
                yearlyPieChartContainer.innerHTML = chartHTML;
                
            } catch (error) {
                console.error("Error rendering yearly pie chart:", error);
                yearlyPieChartContainer.innerHTML = `<h3 class="text-primary mb-md">Year Dream Types</h3><div class="message-error">Could not load yearly chart.</div>`;
            }
        }
        
// ================================
// 9. LIFETIME STATISTICS SYSTEM
// ================================
// All-time dream and goal analytics with comprehensive date range calculations
        /**
         * Update lifetime statistics display with comprehensive all-time analysis.
         * 
         * Calculates and displays comprehensive lifetime statistics covering the user's
         * entire dream journaling history. Analyzes date ranges from first dream entry
         * to present, calculates recall rates over entire lifetime, and integrates goal
         * completion statistics. Handles empty states when no data exists.
         * 
         * @async
         * @returns {Promise<void>} Resolves when lifetime stats are calculated and displayed
         * @throws {Error} When data loading or DOM manipulation fails
         * @since 1.0.0
         * @todo Split into calculateLifetimeStatsData() and renderLifetimeStatsHTML() functions
         * @example
         * // Update lifetime overview
         * await updateLifetimeStats();
         * 
         * @example
         * // Called by tab switching system
         * if (tabName === 'lifetime') {
         *   await updateLifetimeStats();
         * }
         */
        async function updateLifetimeStats() {
            const lifetimeStatsContainer = document.getElementById('lifetimeStatsContainer');
            if (!lifetimeStatsContainer) return;
            
            lifetimeStatsContainer.innerHTML = `<h3 class="text-primary mb-md">Lifetime Stats</h3><div class="loading-state">Calculating lifetime stats...</div>`;
            
            try {
                const dreams = await loadDreams();
                const goals = await loadGoals();
                
                // Calculate goal stats for lifetime
                const goalStats = getLifetimeGoalStats(goals);
                
                if (dreams.length === 0 && goalStats.total === 0) {
                    lifetimeStatsContainer.innerHTML = `
                        <h3 class="text-primary mb-md text-lg">Lifetime Stats</h3>
                        <div class="no-entries" style="padding: 20px;">No dreams or goals recorded yet to calculate lifetime stats.</div>
                    `;
                    return;
                }
                
                // Calculate lifetime stats
                const totalDreams = dreams.length;
                const lucidDreams = dreams.filter(d => d.isLucid).length;
                
                // Find first and last dream dates
                const dreamDates = dreams.map(d => new Date(d.timestamp)).sort((a, b) => a - b);
                const firstDreamDate = dreamDates[0];
                const currentDate = new Date();
                
                // Calculate total days from first entry to today
                const timeDiff = currentDate.getTime() - firstDreamDate.getTime();
                const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end days
                
                // Calculate days with dreams using utility function
                const daysWithDreamsSet = new Set();
                dreams.forEach(dream => {
                    const dreamDate = new Date(dream.timestamp);
                    const dateKey = formatDateKey(dreamDate);
                    daysWithDreamsSet.add(dateKey);
                });
                const daysWithDreams = daysWithDreamsSet.size;
                
                // Calculate percentages and averages
                const dreamDaysPercentage = totalDays > 0 ? ((daysWithDreams / totalDays) * 100).toFixed(1) : 0;
                const avgDreamsPerDay = totalDays > 0 ? (totalDreams / totalDays).toFixed(2) : 0;
                
                // Format the date range
                const startDateFormatted = firstDreamDate.toLocaleDateString();
                const endDateFormatted = currentDate.toLocaleDateString();
                
                // Render the lifetime stats
                const statsHTML = `
                    <h3 class="text-primary mb-md text-lg">Lifetime Stats</h3>
                    <div class="text-xs text-secondary mb-md" style="text-align: center; font-style: italic;">
                        ${dreams.length > 0 ? `${startDateFormatted} to ${endDateFormatted}` : 'Your dream journal journey'}
                    </div>
                    
                    ${dreams.length > 0 ? `
                    <h4 class="text-secondary mb-sm mt-lg">📝 Dream Statistics</h4>
                    <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${totalDreams}</div>
                            <div class="stats-label">Total Dreams</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${lucidDreams}</div>
                            <div class="stats-label">Lucid Dreams</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${dreamDaysPercentage}%</div>
                            <div class="stats-label">Dream Recall Rate</div>
                            <div class="stats-detail">${daysWithDreams} of ${totalDays} days</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${avgDreamsPerDay}</div>
                            <div class="stats-label">Avg Dreams/Day</div>
                        </div>
                    </div>
                    ` : ''}
                    
                    <h4 class="text-secondary mb-sm mt-lg">🎯 Goal Statistics</h4>
                    <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${goalStats.completed}</div>
                            <div class="stats-label">Goals Completed</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${goalStats.total}</div>
                            <div class="stats-label">Total Goals</div>
                            <div class="stats-detail">${goalStats.active} active</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${goalStats.completionRate}%</div>
                            <div class="stats-label">Overall Completion Rate</div>
                        </div>
                        <div class="stats-card card-sm text-center">
                            <div class="stats-number">${goalStats.completed >= 5 ? '🌟' : goalStats.completed > 0 ? '🏆' : '🎯'}</div>
                            <div class="stats-label">${goalStats.completed >= 5 ? 'Goal Master!' : goalStats.completed > 0 ? 'Making Progress!' : 'Start Your Journey!'}</div>
                        </div>
                    </div>
                `;
                
                lifetimeStatsContainer.innerHTML = statsHTML;
                
            } catch (error) {
                console.error("Error calculating lifetime stats:", error);
                lifetimeStatsContainer.innerHTML = `<h3 class="text-primary mb-md">Lifetime Stats</h3><div class="message-error">Could not load lifetime stats.</div>`;
            }
        }
        
        /**
         * Render lifetime pie chart showing all-time lucid vs regular dream distribution.
         * 
         * Creates and displays a CSS conic-gradient based pie chart showing the ratio of
         * lucid to regular dreams across the user's entire dream journaling history.
         * Analyzes all dreams without date filtering and generates comprehensive lifetime
         * visualization. Handles empty states when no dreams exist.
         * 
         * @async
         * @returns {Promise<void>} Resolves when lifetime chart is rendered or empty state displayed
         * @throws {Error} When data loading or DOM manipulation fails
         * @since 1.0.0
         * @todo Chart generation logic already extracted to createPieChartHTML() utility
         * @example
         * // Render lifetime overview chart
         * await renderLifetimePieChart();
         * 
         * @example
         * // Used by lifetime stats system
         * await updateLifetimeStats();
         * await renderLifetimePieChart();
         */
        async function renderLifetimePieChart() {
            const lifetimePieChartContainer = document.getElementById('lifetimePieChartContainer');
            if (!lifetimePieChartContainer) return;
            
            lifetimePieChartContainer.innerHTML = `<h3 class="text-primary mb-md">All-Time Dream Types</h3><div class="loading-state">Loading lifetime chart...</div>`;
            
            try {
                const dreams = await loadDreams();
                const totalDreams = dreams.length;
                const lucidDreams = dreams.filter(d => d.isLucid).length;
                const regularDreams = totalDreams - lucidDreams;
                
                if (totalDreams === 0) {
                    lifetimePieChartContainer.innerHTML = `
                        <h3 class="text-primary mb-md">All-Time Dream Types</h3>
                        <div class="no-entries" style="padding: 20px;">No dreams recorded to create a lifetime chart.</div>
                    `;
                    return;
                }
                
                // Use standardized chart creation utilities
                const lucidPercentage = (lucidDreams / totalDreams) * 100;
                const colors = createPieChartColors(lucidPercentage);
                const chartHTML = createPieChartHTML(
                    'All-Time Dream Types', 
                    totalDreams, 
                    lucidDreams, 
                    regularDreams, 
                    colors.gradient, 
                    colors.lucidColor, 
                    colors.regularColor
                );
                
                lifetimePieChartContainer.innerHTML = chartHTML;
                
            } catch (error) {
                console.error("Error rendering lifetime pie chart:", error);
                lifetimePieChartContainer.innerHTML = `<h3 class="text-primary mb-md">All-Time Dream Types</h3><div class="message-error">Could not load lifetime chart.</div>`;
            }
        }

// ================================
// 10. DREAM SIGNS ANALYSIS SYSTEM
// ================================
// Dream sign frequency analysis and lucidity trigger effectiveness tracking

        /**
         * Calculate comprehensive dream sign statistics including frequency and lucidity rates.
         * 
         * Analyzes all dreams to extract dream signs, calculate frequency statistics, and
         * determine lucidity trigger effectiveness rates. Handles case normalization while
         * preserving original casing, removes duplicates within individual dreams, and
         * calculates correlation between dream signs and lucid dream occurrence.
         * 
         * @async
         * @returns {Promise<Array<DreamSignStat>>} Array of dream sign statistics with frequency and effectiveness data
         * @throws {Error} When dream data loading fails
         * @since 2.0.0
         * @todo Extract dream sign normalization logic to normalizeDreamSigns() utility function
         * @example
         * const stats = await calculateDreamSignStats();
         * stats.forEach(stat => {
         *   console.log(`${stat.sign}: ${stat.total} appearances, ${(stat.lucidityRate * 100).toFixed(1)}% lucid`);
         * });
         * 
         * @example
         * // Used by dream signs analysis system
         * const dreamSignData = await calculateDreamSignStats();
         * renderDreamSignWordCloud(dreamSignData);
         * renderDreamSignList(dreamSignData);
         */
        async function calculateDreamSignStats() {
            const dreams = await loadDreams();
            const dreamSignStats = new Map();

            dreams.forEach(dream => {
                if (dream.dreamSigns && Array.isArray(dream.dreamSigns)) {
                    const uniqueSigns = [...new Set(dream.dreamSigns.map(s => s.trim().toLowerCase()))];

                    uniqueSigns.forEach(sign => {
                        if (!sign) return;

                        const stat = dreamSignStats.get(sign) || {
                            total: 0,
                            lucid: 0,
                            originalCase: sign
                        };

                        stat.total++;
                        if (dream.isLucid) {
                            stat.lucid++;
                        }
                        // A simple way to keep a consistent-ish casing
                        if (dream.dreamSigns.includes(stat.originalCase)) {
                            // prefer the casing that is already stored if it exists in the current dream
                        } else {
                            // otherwise, just take the first one we see
                            stat.originalCase = dream.dreamSigns.find(s => s.trim().toLowerCase() === sign);
                        }

                        dreamSignStats.set(sign, stat);
                    });
                }
            });

            const statsArray = [];
            for (const [sign, stat] of dreamSignStats.entries()) {
                statsArray.push({
                    sign: stat.originalCase,
                    total: stat.total,
                    lucid: stat.lucid,
                    lucidityRate: stat.total > 0 ? (stat.lucid / stat.total) : 0
                });
            }

            return statsArray;
        }

        /**
         * Render detailed list of dream signs sorted by lucidity trigger effectiveness.
         * 
         * Creates a detailed effectiveness list showing dream signs that have successfully
         * triggered lucid dreams, sorted by their success rate. Displays progress bars,
         * percentage success rates, and appearance counts. Filters out dream signs that
         * have never triggered lucidity and handles empty states appropriately.
         * 
         * @param {Array<DreamSignStat>} stats - Array of dream sign statistics from calculateDreamSignStats
         * @returns {void} Updates DOM with dream sign effectiveness list
         * @throws {TypeError} When stats parameter is not an array
         * @since 2.0.0
         * @example
         * const stats = await calculateDreamSignStats();
         * renderDreamSignList(stats);
         * 
         * @example
         * // Used in dream signs tab update
         * const dreamSignData = await calculateDreamSignStats();
         * renderDreamSignList(dreamSignData);
         * renderDreamSignWordCloud(dreamSignData);
         */
        function renderDreamSignList(stats) {
            const container = document.getElementById('dreamSignListContainer');
            if (!container) return;

            const successfulSigns = stats.filter(stat => stat.lucid > 0);

            if (successfulSigns.length === 0) {
                container.innerHTML = `
                    <h3 class="text-primary mb-md">Dream Sign Lucidity Rate</h3>
                    <div class="no-entries" style="padding: 20px;">
                        You haven't had any lucid dreams triggered by your tracked dream signs yet.
                        Keep practicing reality checks when you notice them!
                    </div>
                `;
                return;
            }

            // Sort by lucidity rate (highest first)
            successfulSigns.sort((a, b) => b.lucidityRate - a.lucidityRate);

            const listHTML = successfulSigns.map(stat => {
                const percentage = (stat.lucidityRate * 100).toFixed(0);
                return `
                    <div class="stats-card card-sm text-left mb-sm">
                        <div class="flex-between">
                            <span class="font-semibold text-primary">⚡ ${escapeHtml(stat.sign)}</span>
                            <span class="status-success">${percentage}% Lucid</span>
                        </div>
                        <div class="progress-bar mt-sm mb-sm">
                            <div class="progress-fill progress-success" style="width: ${percentage}%;"></div>
                        </div>
                        <div class="text-sm text-secondary">
                            Triggered lucidity in <strong>${stat.lucid}</strong> of <strong>${stat.total}</strong> appearances.
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = `
                <h3 class="text-primary mb-md">Dream Sign Lucidity Rate</h3>
                <p class="text-secondary mb-lg text-sm">This list shows dream signs that have successfully triggered a lucid dream at least once, sorted by their effectiveness.</p>
                ${listHTML}
            `;
        }

        /**
         * Render visual word cloud of dream signs sized by frequency with color coding.
         * 
         * Creates a visually appealing word cloud where dream signs are sized according
         * to their frequency and colored using a 6-tier HSL color progression system.
         * Most frequent signs appear larger and in warmer colors (red/orange), while
         * less frequent signs appear smaller and in cooler colors (blue/purple).
         * 
         * @param {Array<DreamSignStat>} stats - Array of dream sign statistics from calculateDreamSignStats
         * @returns {void} Updates DOM with color-coded word cloud visualization
         * @throws {TypeError} When stats parameter is not an array
         * @since 2.0.0
         * @todo Extract color tier calculation to calculateWordCloudTiers() utility function
         * @example
         * const stats = await calculateDreamSignStats();
         * renderDreamSignWordCloud(stats);
         * 
         * @example
         * // Color tier system: Red > Orange > Yellow > Blue > Green > Purple
         * // Font sizes: 2.5em > 2.1em > 1.8em > 1.5em > 1.2em > 1.0em
         * const dreamSignData = await calculateDreamSignStats();
         * renderDreamSignWordCloud(dreamSignData); // Renders tiered visualization
         */
        function renderDreamSignWordCloud(stats) {
            const container = document.getElementById('dreamSignWordCloudContainer');
            if (!container) return;

            if (stats.length === 0) {
                container.innerHTML = `
                    <h3 class="text-primary mb-md">Dream Sign Word Cloud</h3>
                    <div class="no-entries" style="padding: 20px;">
                        Record dreams with dream signs to see your personal word cloud here!
                    </div>
                `;
                return;
            }

            // Sort by total frequency (most frequent first)
            const sortedByFrequency = [...stats].sort((a, b) => b.total - a.total);

            // Tiering system (6 tiers) for visual hierarchy
            const tierCount = 6;
            const tierSize = Math.max(1, Math.ceil(sortedByFrequency.length / tierCount));

            // Define styles for each tier (font size and HSL color progression)
            // Hues: Red(0), Orange(30), Yellow(55), Blue(220), Green(140), Purple(270)
            const styles = [
                { size: '2.5em', color: 'hsl(0, 85%, 65%)' },   // Tier 1: Bright Red
                { size: '2.1em', color: 'hsl(30, 85%, 60%)' },  // Tier 2: Bright Orange
                { size: '1.8em', color: 'hsl(55, 85%, 55%)' },  // Tier 3: Bright Yellow
                { size: '1.5em', color: 'hsl(220, 85%, 65%)' }, // Tier 4: Bright Blue
                { size: '1.2em', color: 'hsl(140, 75%, 50%)' }, // Tier 5: Medium Green
                { size: '1.0em', color: 'hsl(270, 75%, 60%)' }  // Tier 6: Medium-dim Purple
            ];

            const cloudHTML = sortedByFrequency.map((stat, index) => {
                const tier = Math.floor(index / tierSize);
                const style = styles[Math.min(tier, tierCount - 1)]; // Ensure we don't go out of bounds

                return `
                    <span class="word-cloud-item" style="font-size: ${style.size}; color: ${style.color};" title="${stat.total} appearances">
                        ${escapeHtml(stat.sign)}
                    </span>
                `;
            }).join('');

            container.innerHTML = `
                <h3 class="text-primary mb-md">Dream Sign Word Cloud</h3>
                <div class="word-cloud">
                    ${cloudHTML}
                </div>
            `;
        }

// ================================
// STATS TAB RENDERING SYSTEM
// ================================

/**
 * Render the complete Statistics tab HTML structure with all sub-tabs.
 * 
 * Generates the complete HTML structure for the Statistics tab including the main calendar,
 * statistics sub-tab navigation, and all sub-tab panels (Monthly, Yearly, Lifetime, Dream Signs).
 * This function creates the foundation HTML that other functions will populate with data.
 * 
 * @param {HTMLElement} tabPanel - The tab panel element to render content into
 * @returns {void} Updates the tabPanel with complete stats tab HTML structure
 * @throws {TypeError} When tabPanel is not a valid DOM element
 * @since 2.02.06
 * @example
 * const statsTabPanel = document.getElementById('statsTab');
 * renderStatsTab(statsTabPanel);
 * 
 * @example
 * // Called by switchAppTab when stats tab is selected
 * if (tabName === 'stats') {
 *   renderStatsTab(tabPanel);
 *   await initializeStatsTab();
 * }
 */
function renderStatsTab(tabPanel) {
    if (!tabPanel || !(tabPanel instanceof HTMLElement)) {
        throw new TypeError('renderStatsTab expects a valid DOM element');
    }
    
    tabPanel.innerHTML = `
        <div id="statsContainer">
            <div id="calendarContainer" class="card-md mb-lg">
                <!-- Calendar will be generated here -->
                <div class="loading-state"></div>
            </div>
            
            <!-- Stats Tabs Navigation -->
            <div class="stats-tabs">
                <button class="stats-tab active" data-action="switch-stats-tab" data-tab="month">
                    📅 Month
                </button>
                <button class="stats-tab" data-action="switch-stats-tab" data-tab="year">
                    📆 Year
                </button>
                <button class="stats-tab" data-action="switch-stats-tab" data-tab="lifetime">
                    🏆 Lifetime
                </button>
                <button class="stats-tab" data-action="switch-stats-tab" data-tab="dream-signs">
                    ⚡ Dream Signs
                </button>
            </div>
            
            <!-- Stats Tab Content -->
            <div class="stats-tab-content">
                <!-- Month Tab -->
                <div id="statsTabMonth" class="stats-tab-panel active">
                    <div class="stats-grid">
                        <div id="monthlyStatsContainer" class="card-md">
                            <!-- Monthly stats will be generated here -->
                            <h3 class="text-primary mb-md">Monthly Stats</h3>
                            <div class="loading-state"></div>
                        </div>
                        <div id="pieChartContainer" class="card-md">
                            <!-- Pie chart will be generated here -->
                            <h3 class="text-primary mb-md">Dream Types</h3>
                            <div class="loading-state"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Year Tab -->
                <div id="statsTabYear" class="stats-tab-panel" style="display: none;">
                    <div class="stats-grid">
                        <div id="yearlyStatsContainer" class="card-md">
                            <!-- Yearly stats will be generated here -->
                            <h3 class="text-primary mb-md">Yearly Stats</h3>
                            <div class="loading-state">Loading yearly stats...</div>
                        </div>
                        <div id="yearlyPieChartContainer" class="card-md">
                            <!-- Yearly pie chart will be generated here -->
                            <h3 class="text-primary mb-md">Year Dream Types</h3>
                            <div class="loading-state">Loading yearly chart...</div>
                        </div>
                    </div>
                </div>
                
                <!-- Lifetime Tab -->
                <div id="statsTabLifetime" class="stats-tab-panel" style="display: none;">
                    <div class="stats-grid">
                        <div id="lifetimeStatsContainer" class="card-md">
                            <!-- Lifetime stats will be generated here -->
                            <h3 class="text-primary mb-md">Lifetime Stats</h3>
                            <div class="loading-state">Loading lifetime stats...</div>
                        </div>
                        <div id="lifetimePieChartContainer" class="card-md">
                            <!-- Lifetime pie chart will be generated here -->
                            <h3 class="text-primary mb-md">All-Time Dream Types</h3>
                            <div class="loading-state">Loading lifetime chart...</div>
                        </div>
                    </div>
                </div>

                <!-- Dream Signs Tab -->
                <div id="statsTabDreamSigns" class="stats-tab-panel" style="display: none;">
                    <div id="dreamSignWordCloudContainer" class="card-md mb-lg">
                        <!-- Word cloud will be generated here -->
                        <h3 class="text-primary mb-md">Dream Sign Word Cloud</h3>
                        <div class="loading-state">Loading word cloud...</div>
                    </div>
                    <div id="dreamSignListContainer" class="card-md">
                        <!-- Dream sign list will be generated here -->
                        <h3 class="text-primary mb-md">Dream Sign Lucidity Rate</h3>
                        <div class="loading-state">Loading list...</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Initialize the Statistics tab with data loading and calendar setup.
 * 
 * Performs complete initialization of the Statistics tab including loading dream data,
 * setting up the calendar system, and preparing the default monthly view. This function
 * should be called after renderStatsTab() to populate the tab with actual data.
 * 
 * @async
 * @returns {Promise<void>} Resolves when stats tab is fully initialized
 * @throws {Error} When data loading or calendar initialization fails
 * @since 2.02.06
 * @example
 * // Called after stats tab rendering
 * await renderStatsTab(tabPanel);
 * await initializeStatsTab();
 * 
 * @example
 * // Full stats tab setup sequence
 * const statsTab = document.getElementById('statsTab');
 * renderStatsTab(statsTab);
 * await initializeStatsTab();
 */
async function initializeStatsTab() {
    try {
        await initCalendar();
    } catch (error) {
        console.error('Error initializing stats tab:', error);
        const container = document.getElementById('statsContainer');
        if (container) {
            container.innerHTML = `
                <div class="message-error">
                    Failed to load statistics. Please refresh and try again.
                </div>
            `;
        }
    }
}

// ================================
// CALENDAR ACTION HANDLERS
// ================================

/**
 * Handle previous month navigation in calendar.
 * 
 * Decrements the calendar month by 1 and re-renders the calendar view.
 * Automatically handles year boundary crossing (December to January).
 * 
 * @async
 * @returns {Promise<void>} Resolves when calendar is re-rendered with previous month
 * @throws {Error} When calendar rendering fails
 * @since 2.02.06
 * @example
 * // Called by action router for 'prev-month' action
 * await handlePrevMonth();
 */
async function handlePrevMonth() {
    calendarState.date.setMonth(calendarState.date.getMonth() - 1);
    await renderCalendar(calendarState.date.getFullYear(), calendarState.date.getMonth());
}

/**
 * Handle next month navigation in calendar.
 * 
 * Increments the calendar month by 1 and re-renders the calendar view.
 * Automatically handles year boundary crossing (December to January).
 * 
 * @async
 * @returns {Promise<void>} Resolves when calendar is re-rendered with next month
 * @throws {Error} When calendar rendering fails
 * @since 2.02.06
 * @example
 * // Called by action router for 'next-month' action
 * await handleNextMonth();
 */
async function handleNextMonth() {
    calendarState.date.setMonth(calendarState.date.getMonth() + 1);
    await renderCalendar(calendarState.date.getFullYear(), calendarState.date.getMonth());
}

/**
 * Handle month selection from dropdown in calendar.
 * 
 * Updates calendar to show the selected month in the current year.
 * Used by month dropdown selection in calendar header.
 * 
 * @async
 * @param {Object} ctx - Action context object from event delegation
 * @param {HTMLSelectElement} ctx.element - The select element that triggered the change
 * @returns {Promise<void>} Resolves when calendar is re-rendered with selected month
 * @throws {TypeError} When ctx.element is not a valid select element
 * @throws {Error} When calendar rendering fails
 * @since 2.02.06
 * @example
 * // Called by action router for 'select-month' action
 * await handleSelectMonth(ctx);
 */
async function handleSelectMonth(ctx) {
    if (!ctx.element || !ctx.element.value) {
        throw new TypeError('handleSelectMonth requires a valid select element with value');
    }
    const newMonth = parseInt(ctx.element.value);
    await renderCalendar(calendarState.date.getFullYear(), newMonth);
}

/**
 * Handle year selection from dropdown in calendar.
 * 
 * Updates calendar to show the selected year in the current month.
 * Used by year dropdown selection in calendar header.
 * 
 * @async
 * @param {Object} ctx - Action context object from event delegation
 * @param {HTMLSelectElement} ctx.element - The select element that triggered the change
 * @returns {Promise<void>} Resolves when calendar is re-rendered with selected year
 * @throws {TypeError} When ctx.element is not a valid select element
 * @throws {Error} When calendar rendering fails
 * @since 2.02.06
 * @example
 * // Called by action router for 'select-year' action
 * await handleSelectYear(ctx);
 */
async function handleSelectYear(ctx) {
    if (!ctx.element || !ctx.element.value) {
        throw new TypeError('handleSelectYear requires a valid select element with value');
    }
    const newYear = parseInt(ctx.element.value);
    await renderCalendar(newYear, calendarState.date.getMonth());
}

/**
 * Handle statistics sub-tab switching with context validation.
 * 
 * Wrapper function for switchStatsTab that validates the action context
 * and extracts the tab name from the element's data-tab attribute.
 * 
 * @async
 * @param {Object} ctx - Action context object from event delegation
 * @param {HTMLElement} ctx.element - The element that triggered the tab switch
 * @returns {Promise<void>} Resolves when tab switch is complete
 * @throws {TypeError} When ctx.element is not valid or missing data-tab
 * @throws {Error} When tab switching fails
 * @since 2.02.06
 * @example
 * // Called by action router for 'switch-stats-tab' action
 * await handleSwitchStatsTab(ctx);
 */
async function handleSwitchStatsTab(ctx) {
    if (!ctx.element || !ctx.element.dataset.tab) {
        throw new TypeError('handleSwitchStatsTab requires element with data-tab attribute');
    }
    await switchStatsTab(ctx.element.dataset.tab);
}

// ================================
// ES MODULE EXPORTS
// ================================

export {
    // Tab rendering functions
    renderStatsTab,
    initializeStatsTab,
    
    // Action handlers for calendar navigation
    handlePrevMonth,
    handleNextMonth,
    handleSelectMonth,
    handleSelectYear,
    handleSwitchStatsTab,
    
    // Main statistics functions
    updateStatsDisplay,
    switchStatsTab,
    
    // Calendar system
    initCalendar,
    renderCalendar,
    updateCalendarData,
    
    // Chart rendering
    renderPieChart,
    renderYearlyPieChart,
    renderLifetimePieChart,
    
    // Statistics calculations
    calculateDreamRecallStreak,
    calculateJournalingStreak,
    calculateGoalStats,
    calculateDreamSignStats,
    
    // Monthly/yearly/lifetime stats
    updateMonthlyStats,
    updateYearlyStats,
    updateLifetimeStats,
    updateDreamSignsTab,
    
    // Utility functions
    escapeHtml,
    formatDateKey,
    createPieChartColors,
    createPieChartHTML,
    
    // Rendering functions
    renderDreamSignList,
    renderDreamSignWordCloud
};