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
 * Format date as YYYY-MM-DD string for consistent date key generation
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string for use as object keys
 * @features Consistent zero-padding, handles timezone issues
 * @integration Used by multiple stats functions for date grouping
 */
function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Create standardized pie chart colors and gradient for dream type visualization
 * @param {number} lucidPercentage - Percentage of lucid dreams (0-100)
 * @returns {Object} Object with lucidColor, regularColor, and gradient properties
 * @features Consistent color scheme using CSS variables
 * @integration Used by all pie chart rendering functions
 */
function createPieChartColors(lucidPercentage) {
    const lucidColor = 'var(--success-color)';
    const regularColor = 'var(--info-color)';
    const gradient = `conic-gradient(${lucidColor} 0% ${lucidPercentage.toFixed(2)}%, ${regularColor} ${lucidPercentage.toFixed(2)}% 100%)`;
    return { lucidColor, regularColor, gradient };
}

/**
 * Generate standardized pie chart HTML with legend
 * @param {string} title - Chart title
 * @param {number} totalDreams - Total number of dreams
 * @param {number} lucidDreams - Number of lucid dreams
 * @param {number} regularDreams - Number of regular dreams
 * @param {string} gradient - CSS gradient string for chart background
 * @param {string} lucidColor - Color for lucid dreams legend
 * @param {string} regularColor - Color for regular dreams legend
 * @returns {string} Complete HTML string for pie chart with legend
 * @features Consistent chart structure, legend formatting, percentage display
 * @integration Used by monthly, yearly, and lifetime pie chart functions
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
     * Calculate consecutive days of dream recall streak starting from today backwards
     * Used by goals system for tracking recall consistency
     * @param {Array} dreams - Array of dream objects with timestamp property
     * @returns {number} Number of consecutive days with dream entries
     * @features Handles timezone issues, works backwards from today, max 365 days check
     * @integration Called by goals.js for recall streak goal progress calculation
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
     * Calculate consecutive days of journaling activity (same as dream recall)
     * Currently uses same logic as dream recall streak
     * @param {Array} dreams - Array of dream objects with timestamp property
     * @returns {number} Number of consecutive days with journaling activity
     * @features Currently aliases to calculateDreamRecallStreak
     * @integration Called by goals.js for journal streak goal progress calculation
     * @todo Consider separate logic if journaling != dream entry in future
     */
    function calculateJournalingStreak(dreams) {
        return calculateDreamRecallStreak(dreams); // Same logic for now
    }

// ================================
// 2. GOAL STATISTICS CALCULATION SYSTEM
// ================================
// Goal completion rate analysis and filtering by time periods

    /**
     * Calculate goal completion statistics for specified time period with filtering
     * @param {Array} goals - Array of goal objects
     * @param {Date|null} startDate - Optional start date filter
     * @param {Date|null} endDate - Optional end date filter
     * @returns {Object} Goal statistics with total, completed, active counts and completion rate
     * @features Date range filtering, completion rate calculation, active/completed categorization
     * @integration Used by monthly, yearly, and lifetime stats functions
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
     * Get goal completion statistics for specific month period
     * @param {Array} goals - Array of goal objects
     * @param {number} year - Target year
     * @param {number} month - Target month (0-indexed)
     * @returns {Object} Goal statistics for the specified month
     * @features Month-based date range filtering
     * @integration Used by monthly stats display functions
     */
    function getMonthlyGoalStats(goals, year, month) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
        return calculateGoalStats(goals, startDate, endDate);
    }
    
    /**
     * Get goal completion statistics for specific year period
     * @param {Array} goals - Array of goal objects
     * @param {number} year - Target year
     * @returns {Object} Goal statistics for the specified year
     * @features Year-based date range filtering
     * @integration Used by yearly stats display functions
     */
    function getYearlyGoalStats(goals, year) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
        return calculateGoalStats(goals, startDate, endDate);
    }
    
    /**
     * Get lifetime goal completion statistics (all time)
     * @param {Array} goals - Array of goal objects
     * @returns {Object} Goal statistics for entire goal history
     * @features No date filtering, includes all goals ever created
     * @integration Used by lifetime stats display functions
     */
    function getLifetimeGoalStats(goals) {
        return calculateGoalStats(goals);
    }

// ================================
// 3. OVERVIEW STATISTICS DISPLAY SYSTEM
// ================================
// Main statistics dashboard with dream counts, top emotions, tags, and voice notes

    /**
     * Update main stats display with comprehensive dream and voice note analysis
     * Calculates and displays total dreams, lucid percentage, recent activity, top emotions/tags
     * @returns {Promise<void>} Resolves when all statistics are calculated and displayed
     * @features Dream counting, emotion analysis, tag analysis, voice note tracking, recent activity
     * @integration Main stats tab display, handles DOM element updates with safety checks
     * @todo Split into calculateStatsData() and updateStatsDOM() functions
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
     * Initialize calendar system with data loading and current month rendering
     * @returns {Promise<void>} Resolves when calendar is fully initialized and rendered
     * @features Calendar data loading, current date detection, initial render
     * @integration Called when stats tab is first loaded
     */
    async function initCalendar() {
        await updateCalendarData();
        const currentDate = new Date();
        await renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    }

    /**
     * Render interactive calendar for specified year and month with dream indicators
     * @param {number} year - Year to render
     * @param {number} month - Month to render (0-indexed)
     * @returns {Promise<void>} Resolves when calendar and related charts are rendered
     * @features Full calendar grid generation, dream indicators, navigation controls, chart rendering
     * @integration Central calendar rendering function, calls multiple chart and stats functions
     * @todo Split into generateCalendarHTML() and renderCalendarComponents() functions
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
     * Render monthly pie chart showing lucid vs regular dream distribution
     * @param {number} year - Target year for chart data
     * @param {number} month - Target month for chart data (0-indexed)
     * @returns {Promise<void>} Resolves when chart is rendered
     * @features CSS conic-gradient charts, percentage calculations, legend generation
     * @integration Monthly stats display, handles empty state gracefully
     * @todo Extract chart generation logic to createPieChartHTML() utility function
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
     * Update calendar data by processing all dreams and organizing by date
     * Creates dreamsByDate object with counts and lucid indicators for calendar display
     * @returns {Promise<void>} Resolves when calendar data is processed and stored
     * @features Date string formatting, dream counting by date, lucid dream tracking
     * @integration Called before calendar rendering to prepare display data
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
         * Generate year dropdown options for calendar navigation
         * @param {number} selectedYear - Currently selected year to mark as selected
         * @returns {string} HTML option elements for year selection dropdown
         * @features Includes years from dream data, current year, selected year, and 5 years buffer
         * @integration Used by calendar header generation for year navigation
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
         * Update monthly statistics display with dream analysis and goal progress
         * @param {number} year - Target year for monthly stats
         * @param {number} month - Target month for stats (0-indexed)
         * @returns {Promise<void>} Resolves when monthly stats are calculated and displayed
         * @features Dream filtering, recall rate calculation, goal statistics, HTML generation
         * @integration Called by calendar rendering for monthly stats display
         * @todo Split into calculateMonthlyStatsData() and renderMonthlyStatsHTML() functions
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
         * Update dream signs tab with latest statistical data and visualizations
         * @returns {Promise<void>} Resolves when dream signs tab is fully updated
         * @features Calculates dream sign stats, renders word cloud and effectiveness list
         * @integration Called by tab switching system for dream signs tab
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
         * Switch between statistics tabs with lazy loading optimization
         * @param {string} tabName - Target tab name ('year', 'lifetime', 'dream-signs')
         * @returns {Promise<void>} Resolves when tab switch is complete and content loaded
         * @features Tab UI updates, lazy loading, content caching with data-loaded attribute
         * @integration Central tab switching for stats interface
         * @todo Split into switchTabsUI() and loadTabContent() functions
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
         * Update yearly statistics display with comprehensive dream and goal analysis
         * @param {number} year - Target year for yearly statistics
         * @returns {Promise<void>} Resolves when yearly stats are calculated and displayed
         * @features Year filtering, leap year handling, current year vs past year logic, goal integration
         * @integration Called by tab switching and calendar year selection
         * @todo Split into calculateYearlyStatsData() and renderYearlyStatsHTML() functions
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
         * Render yearly pie chart showing lucid vs regular dream distribution for specific year
         * @param {number} year - Target year for chart data
         * @returns {Promise<void>} Resolves when yearly chart is rendered
         * @features Year-based dream filtering, CSS conic-gradient charts, empty state handling
         * @integration Called by yearly stats updates and tab switching
         * @todo Extract chart generation logic to createPieChartHTML() utility function
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
         * Update lifetime statistics display with comprehensive all-time analysis
         * @returns {Promise<void>} Resolves when lifetime stats are calculated and displayed
         * @features Complete dream history analysis, date range calculations, goal integration
         * @integration Called by tab switching for lifetime overview
         * @todo Split into calculateLifetimeStatsData() and renderLifetimeStatsHTML() functions
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
         * Render lifetime pie chart showing all-time lucid vs regular dream distribution
         * @returns {Promise<void>} Resolves when lifetime chart is rendered
         * @features All dreams analysis, CSS conic-gradient charts, lifetime empty state handling
         * @integration Called by lifetime stats updates and tab switching
         * @todo Extract chart generation logic to createPieChartHTML() utility function
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
         * Calculate comprehensive dream sign statistics including frequency and lucidity rates
         * @returns {Promise<Array>} Array of dream sign statistics with frequency and effectiveness data
         * @features Dream sign extraction, lucidity correlation, duplicate handling, case preservation
         * @integration Used by dream signs tab for word cloud and effectiveness list
         * @todo Extract dream sign normalization logic to normalizeDreamSigns() utility function
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
         * Render detailed list of dream signs sorted by lucidity trigger effectiveness
         * @param {Array} stats - Array of dream sign statistics from calculateDreamSignStats
         * @returns {void} Updates DOM with dream sign effectiveness list
         * @features Lucidity rate filtering, effectiveness sorting, progress bars, HTML generation
         * @integration Called by updateDreamSignsTab for detailed analysis display
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
         * Render visual word cloud of dream signs sized by frequency with color coding
         * @param {Array} stats - Array of dream sign statistics from calculateDreamSignStats
         * @returns {void} Updates DOM with color-coded word cloud visualization
         * @features Frequency-based sizing, 6-tier color system, HSL color progression, empty state handling
         * @integration Called by updateDreamSignsTab for visual dream sign display
         * @todo Extract color tier calculation to calculateWordCloudTiers() utility function
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