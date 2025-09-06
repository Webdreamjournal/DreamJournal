/**
 * @fileoverview Goals Management Module for Dream Journal Application
 * 
 * This module provides complete goal lifecycle management including creation, editing, deletion,
 * progress tracking, pagination, and template-based goal creation system. It supports various
 * goal types (lucid dreams, streaks, dream signs, custom) with automatic progress calculation
 * and pagination for both active and completed goals.
 * 
 * @module Goals
 * @version 2.02.05
 * @author Dream Journal Team
 * @since 1.0.0
 * @requires constants
 * @requires state
 * @requires storage
 * @requires dom-helpers
 * 
 * @example
 * // Initialize the goals system
 * await initGoals();
 * 
 * // Create a new goal
 * createTemplateGoal('lucid_beginner');
 * 
 * // Calculate goal progress
 * const progress = await calculateGoalProgress(goal);
 */

// ================================
// TYPE DEFINITIONS
// ================================

/**
 * Represents a complete goal object in the system.
 * 
 * @typedef {Object} Goal
 * @property {string} id - Unique goal identifier (UUID)
 * @property {string} title - Goal title/name
 * @property {string} description - Detailed goal description
 * @property {GoalType} type - Goal type determining how progress is calculated
 * @property {GoalPeriod} period - Time period for goal completion
 * @property {number} target - Target number to achieve
 * @property {string} icon - Goal icon (emoji, max 2 characters)
 * @property {GoalStatus} status - Current goal status
 * @property {string} createdAt - ISO timestamp of goal creation
 * @property {string} [updatedAt] - ISO timestamp of last update
 * @property {string} [completedAt] - ISO timestamp when goal was completed
 * @property {string} [reactivatedAt] - ISO timestamp when goal was reactivated
 * @property {number} [currentProgress] - Manual progress counter for custom goals
 * @property {string} [lastUpdated] - ISO timestamp of last progress update
 * @since 1.0.0
 */

/**
 * Goal types with different progress calculation methods.
 * 
 * @typedef {('lucid_count'|'recall_streak'|'journal_streak'|'dream_signs_count'|'custom')} GoalType
 * @description
 * - lucid_count: Count of lucid dreams
 * - recall_streak: Consecutive days with dream recall
 * - journal_streak: Consecutive days with journal entries
 * - dream_signs_count: Unique dream signs identified
 * - custom: Manual progress tracking
 */

/**
 * Goal time periods for progress calculation.
 * 
 * @typedef {('monthly'|'streak'|'total')} GoalPeriod
 * @description
 * - monthly: Progress resets each month
 * - streak: Consecutive days counting
 * - total: All-time cumulative total
 */

/**
 * Goal status values.
 * 
 * @typedef {('active'|'completed')} GoalStatus
 */

/**
 * Goal progress calculation result.
 * 
 * @typedef {Object} GoalProgress
 * @property {number} current - Current progress value
 * @property {string} message - Human-readable progress description
 * @since 1.0.0
 */

/**
 * Goal template configuration for pre-defined goals.
 * 
 * @typedef {Object} GoalTemplate
 * @property {string} title - Template goal title
 * @property {string} description - Template goal description
 * @property {GoalType} type - Template goal type
 * @property {GoalPeriod} period - Template goal period
 * @property {number} target - Template goal target
 * @property {string} icon - Template goal icon
 * @since 1.0.0
 */

// ================================
// GOALS MANAGEMENT MODULE
// ================================
// Complete goal lifecycle management including creation, editing, deletion,
// progress tracking, pagination, and template-based goal creation system
//
// TODO: Create standardized showGoalMessage() function to consolidate 12+ createInlineMessage calls
// TODO: Extract common pagination calculation patterns to shared utility functions

// ================================
// 1. GOALS SYSTEM INITIALIZATION
// ================================

/**
 * Initializes the goals system by loading goals from storage and displaying them.
 * 
 * This function loads all goals from IndexedDB storage and displays them in the UI
 * if the goals tab container is present. It serves as the main entry point for
 * the goals system initialization.
 * 
 * @async
 * @function initGoals
 * @returns {Promise<void>} Promise that resolves when initialization is complete
 * @throws {Error} When goal loading or display fails
 * @since 1.0.0
 * @example
 * // Initialize goals system on app startup
 * await initGoals();
 * 
 * @example
 * // Re-initialize after data changes
 * await initGoals();
 */
async function initGoals() {
    allGoals = await loadGoals();
    if (document.getElementById('goalsTab')) {
        await displayGoals();
    }
}

// ================================
// 2. GOALS DISPLAY SYSTEM
// ================================

/**
 * Displays goals with pagination, filtering active and completed goals.
 * 
 * This function handles the complete rendering of goals in the UI, including
 * pagination, filtering by status, sorting, and displaying appropriate messages
 * when no goals exist. It manages separate pagination for active and completed goals.
 * 
 * @async
 * @function displayGoals
 * @returns {Promise<void>} Promise that resolves when display is complete
 * @throws {Error} When goal progress calculation or rendering fails
 * @since 1.0.0
 * @example
 * // Refresh goals display after changes
 * await displayGoals();
 */
async function displayGoals() {
    const activeContainer = document.getElementById('activeGoalsContainer');
    const completedContainer = document.getElementById('completedGoalsContainer');
    const noGoalsMessage = document.getElementById('noGoalsMessage');
    const noCompletedMessage = document.getElementById('noCompletedGoalsMessage');
    const activePagination = document.getElementById('activeGoalsPagination');
    const completedPagination = document.getElementById('completedGoalsPagination');
    
    if (!activeContainer || !completedContainer) {
        console.warn('Goals containers not found - goals tab may not be initialized yet');
        return;
    }
    
    const activeGoals = allGoals.filter(goal => goal.status === 'active');
    const completedGoals = allGoals.filter(goal => goal.status === 'completed')
        .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt)); // Sort newest first
    
    // Reset pagination if current page would be empty
    const activeTotalPages = Math.ceil(activeGoals.length / CONSTANTS.GOALS_PER_PAGE);
    const completedTotalPages = Math.ceil(completedGoals.length / CONSTANTS.GOALS_PER_PAGE);
    
    if (activeGoalsPage > activeTotalPages && activeTotalPages > 0) {
        activeGoalsPage = activeTotalPages;
    }
    if (completedGoalsPage > completedTotalPages && completedTotalPages > 0) {
        completedGoalsPage = completedTotalPages;
    }
    
    // Show/hide no goals messages
    noGoalsMessage.style.display = activeGoals.length === 0 ? 'block' : 'none';
    noCompletedMessage.style.display = completedGoals.length === 0 ? 'block' : 'none';
    
    // Calculate pagination for active goals
    const activeStartIndex = (activeGoalsPage - 1) * CONSTANTS.GOALS_PER_PAGE;
    const activeEndIndex = activeStartIndex + CONSTANTS.GOALS_PER_PAGE;
    const activePage = activeGoals.slice(activeStartIndex, activeEndIndex);
    
    // Render active goals
    activeContainer.innerHTML = '';
    for (const goal of activePage) {
        const progress = await calculateGoalProgress(goal);
        activeContainer.appendChild(createGoalElement(goal, progress));
    }
    
    // Render active goals pagination
    if (activeTotalPages > 1) {
        activePagination.style.display = 'block';
        activePagination.innerHTML = createPaginationHTML(activeGoalsPage, activeTotalPages, 'active-goals-page');
    } else {
        activePagination.style.display = 'none';
    }
    
    // Calculate pagination for completed goals
    const completedStartIndex = (completedGoalsPage - 1) * CONSTANTS.GOALS_PER_PAGE;
    const completedEndIndex = completedStartIndex + CONSTANTS.GOALS_PER_PAGE;
    const completedPage = completedGoals.slice(completedStartIndex, completedEndIndex);
    
    // Render completed goals
    completedContainer.innerHTML = '';
    for (const goal of completedPage) {
        const progress = await calculateGoalProgress(goal);
        completedContainer.appendChild(createGoalElement(goal, progress, true));
    }
    
    // Render completed goals pagination
    if (completedTotalPages > 1) {
        completedPagination.style.display = 'block';
        completedPagination.innerHTML = createPaginationHTML(completedGoalsPage, completedTotalPages, 'completed-goals-page');
    } else {
        completedPagination.style.display = 'none';
    }
}

// ================================
// 3. PAGINATION MANAGEMENT SYSTEM
// ================================

/**
 * Navigates to a specific page in active goals with boundary validation.
 * 
 * This function changes the current active goals page and refreshes the display.
 * It includes validation to prevent navigation to invalid pages (less than 1 or
 * greater than total pages).
 * 
 * @function changeActiveGoalsPage
 * @param {number} page - Target page number (1-based)
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Navigate to page 2 of active goals
 * changeActiveGoalsPage(2);
 * 
 * @example
 * // Invalid page numbers are ignored
 * changeActiveGoalsPage(0); // No effect
 * changeActiveGoalsPage(999); // No effect if only 3 pages exist
 */
function changeActiveGoalsPage(page) {
    if (page < 1) return;
    const activeGoals = allGoals.filter(goal => goal.status === 'active');
    const totalPages = Math.ceil(activeGoals.length / CONSTANTS.GOALS_PER_PAGE);
    if (page > totalPages) return;
    
    activeGoalsPage = page;
    displayGoals();
}

/**
 * Navigates to a specific page in completed goals with boundary validation.
 * 
 * This function changes the current completed goals page and refreshes the display.
 * It includes validation to prevent navigation to invalid pages (less than 1 or
 * greater than total pages).
 * 
 * @function changeCompletedGoalsPage
 * @param {number} page - Target page number (1-based)
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Navigate to page 1 of completed goals
 * changeCompletedGoalsPage(1);
 */
function changeCompletedGoalsPage(page) {
    if (page < 1) return;
    const completedGoals = allGoals.filter(goal => goal.status === 'completed');
    const totalPages = Math.ceil(completedGoals.length / CONSTANTS.GOALS_PER_PAGE);
    if (page > totalPages) return;
    
    completedGoalsPage = page;
    displayGoals();
}

// ================================
// 4. GOAL DISPLAY HELPER FUNCTIONS
// ================================

/**
 * Gets human-readable label for goal type for display purposes.
 * 
 * This function maps goal type enum values to user-friendly display labels
 * that are shown in the progress section of goal cards.
 * 
 * @function getGoalTypeLabel
 * @param {GoalType} type - Goal type to get label for
 * @returns {string} Human-readable label for the goal type
 * @since 1.0.0
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
 * TODO: Split into buildGoalData() and renderGoalHTML() functions
 * 
 * @function createGoalElement
 * @param {Goal} goal - Goal object to create element for
 * @param {GoalProgress} progress - Calculated progress data
 * @param {boolean} [isCompleted=false] - Whether goal is in completed state
 * @returns {HTMLElement} Complete DOM element for goal display
 * @since 1.0.0
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
            <div class="progress-bar">
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

// ================================
// 5. PROGRESS CALCULATION SYSTEM
// ================================

/**
 * Calculates current progress for a goal based on its type and dream data analysis.
 * 
 * This function analyzes stored dreams and calculates progress according to the goal type.
 * It supports lucid dream counting, streak calculations, dream signs collection,
 * and manual progress tracking for custom goals.
 * 
 * @async
 * @function calculateGoalProgress
 * @param {Goal} goal - Goal object to calculate progress for
 * @returns {Promise<GoalProgress>} Progress calculation result with current value and message
 * @throws {Error} When dream data loading fails
 * @since 1.0.0
 * @example
 * const goal = { type: 'lucid_count', period: 'monthly', target: 5 };
 * const progress = await calculateGoalProgress(goal);
 * console.log(progress.current); // 3
 * console.log(progress.message); // "3 lucid dreams this month"
 * 
 * @example
 * // Calculate streak goal progress
 * const streakGoal = { type: 'recall_streak', target: 7 };
 * const streakProgress = await calculateGoalProgress(streakGoal);
 */
async function calculateGoalProgress(goal) {
    const dreams = await loadDreams();
    const now = new Date();
    
    let current = 0;
    let message = '';
    
    switch (goal.type) {
        case 'lucid_count':
            if (goal.period === 'monthly') {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const lucidDreams = dreams.filter(dream => 
                    dream.isLucid && new Date(dream.timestamp) >= startOfMonth
                );
                current = lucidDreams.length;
                message = `${current} lucid dreams this month`;
            }
            break;
            
        case 'recall_streak':
            current = calculateDreamRecallStreak(dreams);
            message = current === 1 ? '1 day streak' : `${current} days streak`;
            break;
            
        case 'journal_streak':
            current = calculateJournalingStreak(dreams);
            message = current === 1 ? '1 day streak' : `${current} days streak`;
            break;
            
        case 'dream_signs_count':
            const dreamSigns = new Set();
            dreams.forEach(dream => {
                // TODO: Extract dream signs processing logic to parseAndNormalizeDreamSigns() utility function
                if (dream.dreamSigns && typeof dream.dreamSigns === 'string') {
                    const signs = dream.dreamSigns.split(',').map(s => s.trim().toLowerCase());
                    signs.forEach(sign => {
                        if (sign) dreamSigns.add(sign);
                    });
                } else if (Array.isArray(dream.dreamSigns)) {
                    // Handle case where dreamSigns might be stored as an array
                    dream.dreamSigns.forEach(sign => {
                        if (sign && typeof sign === 'string') {
                            dreamSigns.add(sign.trim().toLowerCase());
                        }
                    });
                }
            });
            current = dreamSigns.size;
            message = `${current} unique dream signs identified`;
            break;
            
        case 'custom':
            current = goal.currentProgress || 0;
            message = `${current} completed`;
            break;
    }
    
    return { current, message };
}

// ================================
// 6. GOAL CREATION & TEMPLATE SYSTEM
// ================================

/**
 * Displays modal dialog for creating new goals with optional template pre-population.
 * 
 * This function creates and displays a modal dialog with form fields for goal creation.
 * When a template is provided, the form is pre-populated with template values.
 * The dialog includes validation and focuses the title field for immediate input.
 * 
 * TODO: Split into buildGoalFormHTML() and showGoalDialog() functions
 * 
 * @function showCreateGoalDialog
 * @param {string|null} [template=null] - Template key to pre-populate form, or null for blank form
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Show blank goal creation dialog
 * showCreateGoalDialog();
 * 
 * @example
 * // Show dialog with template pre-filled
 * showCreateGoalDialog('lucid_beginner');
 */
function showCreateGoalDialog(template = null) {
    console.log('showCreateGoalDialog called with template:', template);
    
    const dialog = document.createElement('div');
    dialog.className = 'pin-overlay';
    dialog.style.display = 'flex';
    
    const templateData = template ? GOAL_TEMPLATES[template] : null;
    
    dialog.innerHTML = `
        <div class="pin-container">
            <h3>${template ? 'Create Goal from Template' : 'Create New Goal'}</h3>
            <div class="form-group">
                <label for="goalTitle">Goal Title</label>
                <input type="text" id="goalTitle" class="form-control" value="${templateData?.title || ''}" required>
            </div>
            <div class="form-group">
                <label for="goalDescription">Description</label>
                <textarea id="goalDescription" class="form-control" rows="3">${templateData?.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label for="goalType">Goal Type</label>
                <select id="goalType" class="form-control">
                    <option value="lucid_count" ${templateData?.type === 'lucid_count' ? 'selected' : ''}>Lucid Dreams Count</option>
                    <option value="recall_streak" ${templateData?.type === 'recall_streak' ? 'selected' : ''}>Dream Recall Streak</option>
                    <option value="journal_streak" ${templateData?.type === 'journal_streak' ? 'selected' : ''}>Journal Writing Streak</option>
                    <option value="dream_signs_count" ${templateData?.type === 'dream_signs_count' ? 'selected' : ''}>Dream Signs Collection</option>
                    <option value="custom" ${templateData?.type === 'custom' ? 'selected' : ''}>Custom (Manual Tracking)</option>
                </select>
            </div>
            <div class="form-group">
                <label for="goalPeriod">Time Period</label>
                <select id="goalPeriod" class="form-control">
                    <option value="monthly" ${templateData?.period === 'monthly' ? 'selected' : ''}>Monthly</option>
                    <option value="streak" ${templateData?.period === 'streak' ? 'selected' : ''}>Consecutive Days</option>
                    <option value="total" ${templateData?.period === 'total' ? 'selected' : ''}>All Time Total</option>
                </select>
            </div>
            <div class="form-group">
                <label for="goalTarget">Target Number</label>
                <input type="number" id="goalTarget" class="form-control" value="${templateData?.target || 1}" min="1" required>
            </div>
            <div class="form-group">
                <label for="goalIcon">Icon (optional)</label>
                <input type="text" id="goalIcon" class="form-control" value="${templateData?.icon || '🎯'}" maxlength="2">
            </div>
            <div class="pin-buttons">
                <button data-action="save-goal" class="btn btn-primary">Create Goal</button>
                <button data-action="cancel-goal-dialog" class="btn btn-secondary">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    document.getElementById('goalTitle').focus();
}

/**
 * Creates a goal from a predefined template with pre-filled values.
 * 
 * This function validates that the specified template exists and then opens
 * the goal creation dialog with the template's values pre-populated.
 * 
 * @function createTemplateGoal
 * @param {string} templateKey - Key of the template to use from GOAL_TEMPLATES
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Create goal from lucid dreaming beginner template
 * createTemplateGoal('lucid_beginner');
 * 
 * @example
 * // Create goal from recall streak template
 * createTemplateGoal('recall_streak');
 */
function createTemplateGoal(templateKey) {
    if (GOAL_TEMPLATES[templateKey]) {
        showCreateGoalDialog(templateKey);
    }
}

// ================================
// 7. GOAL CRUD OPERATIONS
// ================================

/**
 * Saves a new goal or updates an existing goal with validation and error handling.
 * 
 * This function handles both goal creation and editing by checking for the presence
 * of a global editingGoalId variable. It validates form data, performs data integrity
 * checks, and provides user feedback through inline messages. The function also
 * handles special initialization for custom goal types.
 * 
 * TODO: Split into validateGoalForm(), createNewGoal(), and updateExistingGoal() functions
 * 
 * @async
 * @function saveGoal
 * @returns {Promise<void>} Promise that resolves when save operation completes
 * @throws {Error} When goal saving fails or form validation errors occur
 * @since 1.0.0
 * @example
 * // Called automatically when save button is clicked
 * await saveGoal();
 */
async function saveGoal() {
    console.log('saveGoal function called');
    
    // TODO: Extract data integrity checking to validateGoalsDataIntegrity() utility function
    // Defensive check - ensure allGoals is still an array
    if (!Array.isArray(allGoals)) {
        console.warn('allGoals is not an array, reloading from storage');
        try {
            allGoals = await loadGoals();
            console.log('Reloaded goals from storage:', allGoals.length, 'goals');
        } catch (error) {
            console.error('Failed to reload goals:', error);
            allGoals = [];
        }
    }
    
    const titleElement = document.getElementById('goalTitle');
    const descriptionElement = document.getElementById('goalDescription');
    const typeElement = document.getElementById('goalType');
    const periodElement = document.getElementById('goalPeriod');
    const targetElement = document.getElementById('goalTarget');
    const iconElement = document.getElementById('goalIcon');
    
    if (!titleElement || !descriptionElement || !typeElement || !periodElement || !targetElement || !iconElement) {
        console.error('Goal form elements not found');
        createInlineMessage('error', 'Goal form not properly initialized', {
            container: document.body,
            position: 'top',
            duration: CONSTANTS.MESSAGE_DURATION_SHORT
        });
        return;
    }
    
    const title = titleElement.value.trim();
    const description = descriptionElement.value.trim();
    const type = typeElement.value;
    const period = periodElement.value;
    const target = parseInt(targetElement.value);
    const icon = iconElement.value.trim() || '🎯';
    
    console.log('Goal form values:', { title, description, type, period, target, icon });
    
    if (!title || !target || target < 1) {
        createInlineMessage('error', 'Please fill in all required fields with valid values', {
            container: document.body,
            position: 'top',
            duration: CONSTANTS.MESSAGE_DURATION_SHORT
        });
        return;
    }
    
    if (window.editingGoalId) {
        // Edit existing goal
        const goalIndex = allGoals.findIndex(g => g.id === window.editingGoalId);
        if (goalIndex !== -1) {
            allGoals[goalIndex] = {
                ...allGoals[goalIndex],
                title,
                description,
                type,
                period,
                target,
                icon,
                updatedAt: new Date().toISOString(),
                // Initialize currentProgress for goals being converted to custom
                currentProgress: type === 'custom' && allGoals[goalIndex].currentProgress === undefined ? 0 : allGoals[goalIndex].currentProgress
            };
            await saveGoals(allGoals);
            await displayGoals();
            cancelGoalDialog();
            // TODO: Replace with standardized showGoalMessage('success', 'Goal updated successfully!')
            createInlineMessage('success', 'Goal updated successfully!', {
                container: document.body,
                position: 'top',
                duration: CONSTANTS.MESSAGE_DURATION_SHORT
            });
            delete window.editingGoalId;
        }
    } else {
        // Create new goal
        const goal = {
            id: generateUniqueId(),
            title,
            description,
            type,
            period,
            target,
            icon,
            status: 'active',
            createdAt: new Date().toISOString(),
            // Add currentProgress field for custom goals
            currentProgress: type === 'custom' ? 0 : undefined
        };
        
        try {
            allGoals.push(goal);
            console.log('Goal added to array, total goals:', allGoals.length);
            
            await saveGoals(allGoals);
            console.log('Goals saved to storage');
            
            await displayGoals();
            console.log('Goals display updated');
            
            cancelGoalDialog();
            // TODO: Replace with standardized showGoalMessage('success', 'Goal created successfully!')
            createInlineMessage('success', 'Goal created successfully!', {
                container: document.body,
                position: 'top',
                duration: CONSTANTS.MESSAGE_DURATION_SHORT
            });
        } catch (error) {
            console.error('Error creating goal:', error);
            createInlineMessage('error', 'Failed to create goal. Please try again.', {
                container: document.body,
                position: 'top',
                duration: CONSTANTS.MESSAGE_DURATION_SHORT
            });
        }
    }
}

/**
 * Loads existing goal data into the edit form with dialog configuration.
 * 
 * This function finds the specified goal, opens the creation dialog, and populates
 * all form fields with the goal's current values. It also updates the dialog's
 * title and button text to reflect the editing context. Uses a timeout to ensure
 * DOM elements are ready before population.
 * 
 * TODO: Extract form population to populateGoalEditForm() function
 * 
 * @function editGoal
 * @param {string} goalId - Unique identifier of the goal to edit
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Edit a goal (typically called from UI button click)
 * editGoal('goal-123');
 */
function editGoal(goalId) {
    const goal = allGoals.find(g => g.id === goalId);
    if (!goal) return;
    
    window.editingGoalId = goalId; // Store ID for save function
    showCreateGoalDialog();
    
    // TODO: Extract form population to populateGoalEditForm() function
    // Fill current values
    setTimeout(() => {
        document.getElementById('goalTitle').value = goal.title;
        document.getElementById('goalDescription').value = goal.description;
        document.getElementById('goalType').value = goal.type;
        document.getElementById('goalPeriod').value = goal.period;
        document.getElementById('goalTarget').value = goal.target;
        document.getElementById('goalIcon').value = goal.icon;
        
        // Update dialog title and button text
        const dialog = document.querySelector('.pin-overlay:not(#pinOverlay)');
        const dialogTitle = dialog.querySelector('h3');
        const saveButton = dialog.querySelector('[data-action="save-goal"]');
        if (dialogTitle) dialogTitle.textContent = 'Edit Goal';
        if (saveButton) saveButton.textContent = 'Update Goal';
    }, 10);
}

/**
 * Marks a goal as completed with timestamp and displays celebration message.
 * 
 * This function updates the goal's status to 'completed', adds a completion timestamp,
 * saves the changes to storage, refreshes the display, and shows a celebratory
 * message to the user.
 * 
 * @async
 * @function completeGoal
 * @param {string} goalId - Unique identifier of the goal to complete
 * @returns {Promise<void>} Promise that resolves when completion is processed
 * @throws {Error} When goal saving fails
 * @since 1.0.0
 * @example
 * // Mark goal as completed (typically called from UI button)
 * await completeGoal('goal-123');
 */
async function completeGoal(goalId) {
    const goal = allGoals.find(g => g.id === goalId);
    if (!goal) return;
    
    goal.status = 'completed';
    goal.completedAt = new Date().toISOString();
    
    await saveGoals(allGoals);
    await displayGoals();
    // TODO: Replace with standardized showGoalMessage('celebration', goal.title)
    createInlineMessage('success', `🎉 Congratulations! Goal "${goal.title}" completed!`, {
        container: document.body,
        position: 'top',
        duration: CONSTANTS.MESSAGE_DURATION_MEDIUM
    });
}

/**
 * Reactivates a completed goal back to active status with pagination adjustment.
 * 
 * This function changes a completed goal back to active status, adds a reactivation
 * timestamp, removes the completion timestamp, and adjusts pagination if necessary.
 * It includes error handling and user feedback.
 * 
 * @async
 * @function reactivateGoal
 * @param {string} goalId - Unique identifier of the goal to reactivate
 * @returns {Promise<void>} Promise that resolves when reactivation is complete
 * @throws {Error} When goal saving fails or goal is not in completed status
 * @since 1.0.0
 * @example
 * // Reactivate a completed goal
 * await reactivateGoal('goal-123');
 */
async function reactivateGoal(goalId) {
    const goal = allGoals.find(g => g.id === goalId);
    if (!goal || goal.status !== 'completed') return;
    
    goal.status = 'active';
    goal.reactivatedAt = new Date().toISOString();
    // Remove completedAt timestamp
    delete goal.completedAt;
    
    try {
        await saveGoals(allGoals);
        
        // TODO: Extract pagination adjustment logic to adjustPaginationAfterStatusChange() function
        // Check if we need to adjust pagination after reactivation
        const remainingCompleted = allGoals.filter(g => g.status === 'completed');
        const completedTotalPages = Math.ceil(remainingCompleted.length / CONSTANTS.GOALS_PER_PAGE);
        if (completedGoalsPage > completedTotalPages && completedTotalPages > 0) {
            completedGoalsPage = completedTotalPages;
        }
        
        await displayGoals();
        // TODO: Replace with standardized showGoalMessage('reactivated', goal.title)
        createInlineMessage('success', `🔄 Goal "${goal.title}" reactivated!`, {
            container: document.body,
            position: 'top',
            duration: CONSTANTS.MESSAGE_DURATION_SHORT
        });
    } catch (error) {
        console.error('Error reactivating goal:', error);
        createInlineMessage('error', 'Failed to reactivate goal. Please try again.', {
            container: document.body,
            position: 'top',
            duration: CONSTANTS.MESSAGE_DURATION_SHORT
        });
    }
}

/**
 * Initiates goal deletion process with confirmation dialog.
 * 
 * This function finds the specified goal and displays a confirmation dialog
 * to ensure the user really wants to delete the goal. It serves as the entry
 * point for the deletion workflow.
 * 
 * @function deleteGoal
 * @param {string} goalId - Unique identifier of the goal to delete
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Initiate goal deletion (typically called from UI button)
 * deleteGoal('goal-123');
 */
function deleteGoal(goalId) {
    const goal = allGoals.find(g => g.id === goalId);
    if (!goal) return;
    
    showDeleteGoalConfirmation(goal);
}

/**
 * Displays confirmation dialog for goal deletion with safety measures.
 * 
 * This function creates and displays a modal confirmation dialog that shows
 * the goal title and warns the user that deletion cannot be undone. It provides
 * both confirm and cancel options.
 * 
 * @function showDeleteGoalConfirmation
 * @param {Goal} goal - Goal object to be deleted
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Show deletion confirmation for a specific goal
 * const goal = { id: '123', title: 'My Goal' };
 * showDeleteGoalConfirmation(goal);
 */
function showDeleteGoalConfirmation(goal) {
    const dialog = document.createElement('div');
    dialog.className = 'pin-overlay';
    dialog.style.display = 'flex';
    
    dialog.innerHTML = `
        <div class="pin-container">
            <h3>Delete Goal</h3>
            <p>Are you sure you want to delete the goal "${goal.title}"? This action cannot be undone.</p>
            <div class="pin-buttons">
                <button data-action="confirm-delete-goal" data-goal-id="${goal.id}" class="btn btn-error">Delete</button>
                <button data-action="cancel-goal-dialog" class="btn btn-secondary">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
}

/**
 * Executes confirmed goal deletion from storage with cleanup.
 * 
 * This function performs the actual deletion by filtering the goal out of the
 * allGoals array, saving the updated array to storage, refreshing the display,
 * closing the dialog, and showing a success message.
 * 
 * @async
 * @function confirmDeleteGoal
 * @param {string} goalId - Unique identifier of the goal to delete
 * @returns {Promise<void>} Promise that resolves when deletion is complete
 * @throws {Error} When goal saving fails
 * @since 1.0.0
 * @example
 * // Execute confirmed deletion (called from confirmation dialog)
 * await confirmDeleteGoal('goal-123');
 */
async function confirmDeleteGoal(goalId) {
    allGoals = allGoals.filter(g => g.id !== goalId);
    await saveGoals(allGoals);
    await displayGoals();
    cancelGoalDialog();
    // TODO: Replace with standardized showGoalMessage('success', 'Goal deleted successfully')
    createInlineMessage('success', 'Goal deleted successfully', {
        container: document.body,
        position: 'top',
        duration: CONSTANTS.MESSAGE_DURATION_SHORT
    });
}

/**
 * Cancels goal dialog and cleans up any editing state.
 * 
 * This function closes any open goal-related dialog (except the PIN overlay)
 * and removes the global editingGoalId variable if it exists. It serves as
 * the cleanup function for dialog operations.
 * 
 * @function cancelGoalDialog
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Cancel any open goal dialog
 * cancelGoalDialog();
 */
function cancelGoalDialog() {
    const dialog = document.querySelector('.pin-overlay:not(#pinOverlay)');
    if (dialog) {
        document.body.removeChild(dialog);
    }
    // Clean up editing state
    if (window.editingGoalId) {
        delete window.editingGoalId;
    }
}

// ================================
// 8. CUSTOM GOAL PROGRESS TRACKING
// ================================

/**
 * Increases progress counter for custom goals with target boundary checking.
 * 
 * This function increments the manual progress counter for custom-type goals.
 * It ensures the progress doesn't exceed the target value and automatically
 * displays a completion celebration when the target is reached. The function
 * includes error handling and user feedback.
 * 
 * @async
 * @function increaseGoalProgress
 * @param {string} goalId - Unique identifier of the custom goal to update
 * @returns {Promise<void>} Promise that resolves when progress update is complete
 * @throws {Error} When goal saving fails or goal is not of custom type
 * @since 1.0.0
 * @example
 * // Increase progress for a custom goal
 * await increaseGoalProgress('custom-goal-123');
 */
async function increaseGoalProgress(goalId) {
    const goal = allGoals.find(g => g.id === goalId);
    if (!goal || goal.type !== 'custom') return;
    
    // Increase progress, but don't exceed target
    const newProgress = Math.min((goal.currentProgress || 0) + 1, goal.target);
    goal.currentProgress = newProgress;
    goal.lastUpdated = new Date().toISOString();
    
    try {
        await saveGoals(allGoals);
        await displayGoals();
        
        // Auto-complete the goal if target reached
        if (newProgress >= goal.target && goal.status !== 'completed') {
            setTimeout(() => {
                createInlineMessage('success', `🎉 Goal "${goal.title}" completed! Great job!`, {
                    container: document.body,
                    position: 'top',
                    duration: 3000
                });
            }, 100);
        }
    } catch (error) {
        console.error('Error updating goal progress:', error);
        createInlineMessage('error', 'Failed to update goal progress', {
            container: document.body,
            position: 'top',
            duration: CONSTANTS.MESSAGE_DURATION_SHORT
        });
    }
}

/**
 * Decreases progress counter for custom goals with zero boundary checking.
 * 
 * This function decrements the manual progress counter for custom-type goals.
 * It ensures the progress doesn't go below zero and provides error handling
 * with user feedback. Updates the goal's lastUpdated timestamp.
 * 
 * @async
 * @function decreaseGoalProgress
 * @param {string} goalId - Unique identifier of the custom goal to update
 * @returns {Promise<void>} Promise that resolves when progress update is complete
 * @throws {Error} When goal saving fails or goal is not of custom type
 * @since 1.0.0
 * @example
 * // Decrease progress for a custom goal
 * await decreaseGoalProgress('custom-goal-123');
 */
async function decreaseGoalProgress(goalId) {
    const goal = allGoals.find(g => g.id === goalId);
    if (!goal || goal.type !== 'custom') return;
    
    // Decrease progress, but don't go below 0
    const newProgress = Math.max((goal.currentProgress || 0) - 1, 0);
    goal.currentProgress = newProgress;
    goal.lastUpdated = new Date().toISOString();
    
    try {
        await saveGoals(allGoals);
        await displayGoals();
    } catch (error) {
        console.error('Error updating goal progress:', error);
        createInlineMessage('error', 'Failed to update goal progress', {
            container: document.body,
            position: 'top',
            duration: CONSTANTS.MESSAGE_DURATION_SHORT
        });
    }
}