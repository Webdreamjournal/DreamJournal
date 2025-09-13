/**
 * @fileoverview Goals Management Module for Dream Journal Application
 * 
 * This module provides complete goal lifecycle management including creation, editing, deletion,
 * progress tracking, pagination, and template-based goal creation system. It supports various
 * goal types (lucid dreams, streaks, dream signs, custom) with automatic progress calculation
 * and pagination for both active and completed goals.
 * 
 * @module Goals
 * @version 2.02.48
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
// ES MODULE IMPORTS
// ================================

import { CONSTANTS, GOAL_TEMPLATES } from './constants.js';
import { getAllGoals, setAllGoals, getActiveGoalsPage, getCompletedGoalsPage, setActiveGoalsPage, setCompletedGoalsPage, goalDeleteTimeouts, withMutex } from './state.js';
import { loadGoals, saveGoals, generateUniqueId, loadDreams } from './storage.js';
import { createInlineMessage, escapeHtml, createPaginationHTML, getGoalTypeLabel, createGoalElement } from './dom-helpers.js';
import { calculateDreamRecallStreak, calculateJournalingStreak } from './statstab.js';

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
// GOALS MESSAGING SYSTEM
// ================================

/**
 * Displays standardized goal-related messages with consistent styling and timing.
 *
 * This function provides a centralized way to display all goal-related user feedback
 * messages with consistent styling, positioning, and timing. It supports different
 * message types including success, error, celebration, and form validation messages.
 *
 * @function showGoalMessage
 * @param {string} type - Message type determining style and behavior
 * @param {string} message - The message text to display to the user
 * @param {Object} [options={}] - Additional options for message customization
 * @param {string} [options.goalTitle] - Goal title for personalized messages
 * @param {number} [options.duration] - Override default duration for this message
 * @returns {void}
 * @since 2.02.49
 *
 * @example
 * // Show success message
 * showGoalMessage('success', 'Goal created successfully!');
 *
 * @example
 * // Show celebration message with goal title
 * showGoalMessage('celebration', 'Goal completed!', { goalTitle: 'Daily Meditation' });
 *
 * @example
 * // Show error message with custom duration
 * showGoalMessage('error', 'Failed to save goal', { duration: 5000 });
 */
function showGoalMessage(type, message, options = {}) {
    const { goalTitle, duration } = options;

    let finalMessage = message;
    let messageType = 'success'; // Default to success for createInlineMessage
    let messageDuration = CONSTANTS.MESSAGE_DURATION_SHORT;

    switch (type) {
        case 'success':
            messageType = 'success';
            messageDuration = CONSTANTS.MESSAGE_DURATION_SHORT;
            break;

        case 'error':
        case 'form-error':
            messageType = 'error';
            messageDuration = CONSTANTS.MESSAGE_DURATION_SHORT;
            break;

        case 'celebration':
            messageType = 'success';
            messageDuration = CONSTANTS.MESSAGE_DURATION_MEDIUM;
            if (goalTitle) {
                finalMessage = `🎉 Congratulations! Goal "${goalTitle}" completed!`;
            } else {
                finalMessage = `🎉 ${message}`;
            }
            break;

        case 'reactivated':
            messageType = 'success';
            messageDuration = CONSTANTS.MESSAGE_DURATION_SHORT;
            if (goalTitle) {
                finalMessage = `🔄 Goal "${goalTitle}" reactivated!`;
            } else {
                finalMessage = `🔄 ${message}`;
            }
            break;

        case 'auto-complete':
            messageType = 'success';
            messageDuration = 3000; // Special duration for auto-completion
            if (goalTitle) {
                finalMessage = `🎉 Goal "${goalTitle}" completed! Great job!`;
            } else {
                finalMessage = `🎉 ${message}`;
            }
            break;

        default:
            messageType = 'success';
            messageDuration = CONSTANTS.MESSAGE_DURATION_SHORT;
    }

    // Use custom duration if provided
    if (duration) {
        messageDuration = duration;
    }

    createInlineMessage(messageType, finalMessage, {
        container: document.body,
        position: 'top',
        duration: messageDuration
    });
}

// ================================
// GOALS MANAGEMENT MODULE
// ================================
// Complete goal lifecycle management including creation, editing, deletion,
// progress tracking, pagination, and template-based goal creation system
//
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
    setAllGoals(await loadGoals());
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
    
    const currentGoals = getAllGoals();
    const activeGoals = currentGoals.filter(goal => goal.status === 'active');
    const completedGoals = currentGoals.filter(goal => goal.status === 'completed')
        .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt)); // Sort newest first
    
    // Reset pagination if current page would be empty
    const activeTotalPages = Math.ceil(activeGoals.length / CONSTANTS.GOALS_PER_PAGE);
    const completedTotalPages = Math.ceil(completedGoals.length / CONSTANTS.GOALS_PER_PAGE);
    
    const currentActiveGoalsPage = getActiveGoalsPage();
    const currentCompletedGoalsPage = getCompletedGoalsPage();
    
    if (currentActiveGoalsPage > activeTotalPages && activeTotalPages > 0) {
        setActiveGoalsPage(activeTotalPages);
    }
    if (currentCompletedGoalsPage > completedTotalPages && completedTotalPages > 0) {
        setCompletedGoalsPage(completedTotalPages);
    }
    
    // Show/hide no goals messages
    noGoalsMessage.style.display = activeGoals.length === 0 ? 'block' : 'none';
    noCompletedMessage.style.display = completedGoals.length === 0 ? 'block' : 'none';
    
    // Calculate pagination for active goals
    const activeStartIndex = (getActiveGoalsPage() - 1) * CONSTANTS.GOALS_PER_PAGE;
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
        activePagination.innerHTML = createPaginationHTML(getActiveGoalsPage(), activeTotalPages, 'active-goals-page');
    } else {
        activePagination.style.display = 'none';
    }
    
    // Calculate pagination for completed goals
    const completedStartIndex = (getCompletedGoalsPage() - 1) * CONSTANTS.GOALS_PER_PAGE;
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
        completedPagination.innerHTML = createPaginationHTML(getCompletedGoalsPage(), completedTotalPages, 'completed-goals-page');
    } else {
        completedPagination.style.display = 'none';
    }
}

// Note: Pagination handlers (changeActiveGoalsPage, changeCompletedGoalsPage) are now in action-router.js

// ================================
// 4. GOAL DISPLAY HELPER FUNCTIONS
// ================================

// Note: getGoalTypeLabel is now imported from dom-helpers.js

// Note: createGoalElement is now imported from dom-helpers.js

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
// 6. GOAL FORM AND DIALOG SYSTEM
// ================================

/**
 * Builds the HTML content for the goal creation/editing form.
 *
 * This function generates the complete HTML structure for the goal form including
 * all form fields, labels, validation attributes, and action buttons. It supports
 * template-based pre-population and proper accessibility markup.
 *
 * @function buildGoalFormHTML
 * @param {Object|null} [templateData=null] - Template data to pre-populate form fields
 * @param {boolean} [isEdit=false] - Whether this form is for editing (affects title and button text)
 * @returns {string} Complete HTML string for the goal form
 * @since 2.02.49
 *
 * @example
 * // Build blank form HTML
 * const formHTML = buildGoalFormHTML();
 *
 * @example
 * // Build form with template data
 * const templateData = GOAL_TEMPLATES['lucid_beginner'];
 * const formHTML = buildGoalFormHTML(templateData);
 *
 * @example
 * // Build form for editing
 * const formHTML = buildGoalFormHTML(null, true);
 */
function buildGoalFormHTML(templateData = null, isEdit = false) {
    const formTitle = isEdit ? 'Edit Goal' :
                     templateData ? 'Create Goal from Template' : 'Create New Goal';
    const buttonText = isEdit ? 'Update Goal' : 'Create Goal';

    return `
        <div class="pin-container">
            <h3>${formTitle}</h3>
            <div class="form-group">
                <label for="goalTitle">Goal Title</label>
                <input type="text" id="goalTitle" class="form-control"
                       value="${templateData?.title || ''}"
                       required
                       aria-describedby="goalTitleHelp">
            </div>
            <div class="form-group">
                <label for="goalDescription">Description</label>
                <textarea id="goalDescription" class="form-control" rows="3"
                          aria-describedby="goalDescriptionHelp">${templateData?.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label for="goalType">Goal Type</label>
                <select id="goalType" class="form-control" aria-describedby="goalTypeHelp">
                    <option value="lucid_count" ${templateData?.type === 'lucid_count' ? 'selected' : ''}>Lucid Dreams Count</option>
                    <option value="recall_streak" ${templateData?.type === 'recall_streak' ? 'selected' : ''}>Dream Recall Streak</option>
                    <option value="journal_streak" ${templateData?.type === 'journal_streak' ? 'selected' : ''}>Journal Writing Streak</option>
                    <option value="dream_signs_count" ${templateData?.type === 'dream_signs_count' ? 'selected' : ''}>Dream Signs Collection</option>
                    <option value="custom" ${templateData?.type === 'custom' ? 'selected' : ''}>Custom (Manual Tracking)</option>
                </select>
            </div>
            <div class="form-group">
                <label for="goalPeriod">Time Period</label>
                <select id="goalPeriod" class="form-control" aria-describedby="goalPeriodHelp">
                    <option value="monthly" ${templateData?.period === 'monthly' ? 'selected' : ''}>Monthly</option>
                    <option value="streak" ${templateData?.period === 'streak' ? 'selected' : ''}>Consecutive Days</option>
                    <option value="total" ${templateData?.period === 'total' ? 'selected' : ''}>All Time Total</option>
                </select>
            </div>
            <div class="form-group">
                <label for="goalTarget">Target Number</label>
                <input type="number" id="goalTarget" class="form-control"
                       value="${templateData?.target || 1}"
                       min="1"
                       required
                       aria-describedby="goalTargetHelp">
            </div>
            <div class="form-group">
                <label for="goalIcon">Icon (optional)</label>
                <input type="text" id="goalIcon" class="form-control"
                       value="${templateData?.icon || '🎯'}"
                       maxlength="2"
                       aria-describedby="goalIconHelp">
            </div>
            <div class="pin-buttons">
                <button data-action="save-goal" class="btn btn-primary">${buttonText}</button>
                <button data-action="cancel-goal-dialog" class="btn btn-secondary">Cancel</button>
            </div>
        </div>
    `;
}

/**
 * Creates and displays a goal dialog with the specified content.
 *
 * This function creates the modal dialog container, sets up proper styling,
 * injects the provided HTML content, and displays the dialog. It handles
 * the DOM manipulation and focus management for the dialog.
 *
 * @function showGoalDialog
 * @param {string} htmlContent - The HTML content to display in the dialog
 * @param {boolean} [focusTitle=true] - Whether to focus the title field after showing
 * @returns {void}
 * @since 2.02.49
 *
 * @example
 * // Show dialog with custom HTML content
 * const formHTML = buildGoalFormHTML();
 * showGoalDialog(formHTML);
 *
 * @example
 * // Show dialog without auto-focusing title
 * showGoalDialog(formHTML, false);
 */
function showGoalDialog(htmlContent, focusTitle = true) {
    const dialog = document.createElement('div');
    dialog.className = 'pin-overlay';
    dialog.style.display = 'flex';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'goalDialogTitle');

    dialog.innerHTML = htmlContent;

    document.body.appendChild(dialog);

    if (focusTitle) {
        const titleField = document.getElementById('goalTitle');
        if (titleField) {
            titleField.focus();
        }
    }
}

/**
 * Populates the goal form with existing goal data for editing.
 *
 * This function fills all form fields with the provided goal's current values
 * and updates the dialog's title and button text to reflect the editing context.
 * It handles proper field population and UI state updates.
 *
 * @function populateGoalEditForm
 * @param {Goal} goal - The goal object containing data to populate the form
 * @returns {void}
 * @since 2.02.49
 *
 * @example
 * // Populate form for editing
 * const goal = { title: 'My Goal', description: 'Goal desc', type: 'custom', ... };
 * populateGoalEditForm(goal);
 */
function populateGoalEditForm(goal) {
    // Fill form fields with current goal values
    const titleField = document.getElementById('goalTitle');
    const descriptionField = document.getElementById('goalDescription');
    const typeField = document.getElementById('goalType');
    const periodField = document.getElementById('goalPeriod');
    const targetField = document.getElementById('goalTarget');
    const iconField = document.getElementById('goalIcon');

    if (titleField) titleField.value = goal.title;
    if (descriptionField) descriptionField.value = goal.description;
    if (typeField) typeField.value = goal.type;
    if (periodField) periodField.value = goal.period;
    if (targetField) targetField.value = goal.target;
    if (iconField) iconField.value = goal.icon;

    // Update dialog title and button text for editing context
    const dialog = document.querySelector('.pin-overlay:not(#pinOverlay)');
    if (dialog) {
        const dialogTitle = dialog.querySelector('h3');
        const saveButton = dialog.querySelector('[data-action="save-goal"]');
        if (dialogTitle) dialogTitle.textContent = 'Edit Goal';
        if (saveButton) saveButton.textContent = 'Update Goal';
    }
}

// ================================
// 7. GOAL CREATION & TEMPLATE SYSTEM
// ================================

/**
 * Displays modal dialog for creating new goals with optional template pre-population.
 *
 * This function creates and displays a modal dialog with form fields for goal creation.
 * When a template is provided, the form is pre-populated with template values.
 * The dialog includes validation and focuses the title field for immediate input.
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

    const templateData = template ? GOAL_TEMPLATES[template] : null;
    const formHTML = buildGoalFormHTML(templateData, false);
    showGoalDialog(formHTML, true);
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
    // Defensive check - ensure goals are loaded
    let currentGoals = getAllGoals();
    if (!Array.isArray(currentGoals)) {
        console.warn('Goals array is not valid, reloading from storage');
        try {
            currentGoals = await loadGoals();
            setAllGoals(currentGoals);
            console.log('Reloaded goals from storage:', currentGoals.length, 'goals');
        } catch (error) {
            console.error('Failed to reload goals:', error);
            setAllGoals([]);
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
        showGoalMessage('form-error', 'Goal form not properly initialized');
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
        showGoalMessage('form-error', 'Please fill in all required fields with valid values');
        return;
    }
    
    if (window.editingGoalId) {
        // Edit existing goal
        const goalIndex = currentGoals.findIndex(g => g.id === window.editingGoalId);
        if (goalIndex !== -1) {
            currentGoals[goalIndex] = {
                ...currentGoals[goalIndex],
                title,
                description,
                type,
                period,
                target,
                icon,
                updatedAt: new Date().toISOString(),
                // Initialize currentProgress for goals being converted to custom
                currentProgress: type === 'custom' && currentGoals[goalIndex].currentProgress === undefined ? 0 : currentGoals[goalIndex].currentProgress
            };
            setAllGoals(currentGoals);
            await saveGoals(currentGoals);
            await displayGoals();
            cancelGoalDialog();
            showGoalMessage('success', 'Goal updated successfully!');
            delete window.editingGoalId;
        }
    } else {
        // Create new goal
        const createdAt = new Date().toISOString();
        const goal = {
            id: generateUniqueId({
                title: title,
                timestamp: createdAt,
                type: 'goal'
            }),
            title,
            description,
            type,
            period,
            target,
            icon,
            status: 'active',
            createdAt: createdAt,
            // Add currentProgress field for custom goals
            currentProgress: type === 'custom' ? 0 : undefined
        };
        
        try {
            currentGoals.push(goal);
            console.log('Goal added to array, total goals:', currentGoals.length);
            setAllGoals(currentGoals);
            
            await saveGoals(currentGoals);
            console.log('Goals saved to storage');
            
            await displayGoals();
            console.log('Goals display updated');
            
            cancelGoalDialog();
            showGoalMessage('success', 'Goal created successfully!');
        } catch (error) {
            console.error('Error creating goal:', error);
            showGoalMessage('error', 'Failed to create goal. Please try again.');
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
 * @function editGoal
 * @param {string} goalId - Unique identifier of the goal to edit
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Edit a goal (typically called from UI button click)
 * editGoal('goal-123');
 */
function editGoal(goalId) {
    const goal = getAllGoals().find(g => g.id === goalId);
    if (!goal) return;

    window.editingGoalId = goalId; // Store ID for save function
    showCreateGoalDialog();

    // Use timeout to ensure DOM elements are ready before population
    setTimeout(() => {
        populateGoalEditForm(goal);
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
    const goal = getAllGoals().find(g => g.id === goalId);
    if (!goal) return;
    
    goal.status = 'completed';
    goal.completedAt = new Date().toISOString();
    
    await saveGoals(getAllGoals());
    await displayGoals();
    showGoalMessage('celebration', 'Goal completed!', { goalTitle: goal.title });
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
    const goal = getAllGoals().find(g => g.id === goalId);
    if (!goal || goal.status !== 'completed') return;
    
    goal.status = 'active';
    goal.reactivatedAt = new Date().toISOString();
    // Remove completedAt timestamp
    delete goal.completedAt;
    
    try {
        await saveGoals(getAllGoals());
        
        // TODO: Extract pagination adjustment logic to adjustPaginationAfterStatusChange() function
        // Check if we need to adjust pagination after reactivation
        const remainingCompleted = getAllGoals().filter(g => g.status === 'completed');
        const completedTotalPages = Math.ceil(remainingCompleted.length / CONSTANTS.GOALS_PER_PAGE);
        if (getCompletedGoalsPage() > completedTotalPages && completedTotalPages > 0) {
            setCompletedGoalsPage(completedTotalPages);
        }
        
        await displayGoals();
        showGoalMessage('reactivated', 'Goal reactivated!', { goalTitle: goal.title });
    } catch (error) {
        console.error('Error reactivating goal:', error);
        showGoalMessage('error', 'Failed to reactivate goal. Please try again.');
    }
}

/**
 * Initiates goal deletion process with timeout confirmation UI.
 * 
 * This function displays a delete confirmation button with a timeout that
 * automatically reverts if not confirmed. This matches the dream delete behavior
 * for consistency. The goal entry is visually marked as pending deletion.
 * 
 * @function deleteGoal
 * @param {string} goalId - Unique identifier of the goal to delete
 * @returns {void}
 * @since 2.02.06
 * @example
 * // Initiate goal deletion with timeout confirmation (called from UI button)
 * deleteGoal('goal-123');
 */
function deleteGoal(goalId) {
    // Clear any existing timeout for this goal
    if (goalDeleteTimeouts[goalId]) {
        clearTimeout(goalDeleteTimeouts[goalId]);
        delete goalDeleteTimeouts[goalId];
    }
    
    const goalElement = document.getElementById(`goal-${goalId}`);
    if (!goalElement) return;
    
    const actionsElement = goalElement.querySelector('.goal-actions');
    if (!actionsElement) return;
    
    // Add visual feedback for pending delete
    goalElement.classList.add('delete-pending');
    
    // Replace delete button with confirm button
    const deleteBtn = actionsElement.querySelector(`button[data-goal-id="${goalId}"][data-action="delete-goal"]`);
    if (deleteBtn) {
        deleteBtn.outerHTML = `<button data-action="confirm-delete-goal" data-goal-id="${goalId}" class="btn btn-confirm-delete btn-small">Confirm Delete</button>`;
    }
    
    // Set timeout to revert after specified time
    goalDeleteTimeouts[goalId] = setTimeout(() => {
        cancelGoalDelete(goalId);
    }, CONSTANTS.MESSAGE_DURATION_EXTENDED);
}

/**
 * Cancels goal deletion and reverts UI back to normal state.
 * 
 * This function is called when the delete timeout expires or when
 * the user cancels the deletion. It removes visual feedback and
 * restores the original delete button.
 * 
 * @function cancelGoalDelete
 * @param {string} goalId - Unique identifier of the goal to cancel deletion for
 * @returns {void}
 * @since 2.02.06
 * @example
 * // Cancel goal deletion (typically called by timeout)
 * cancelGoalDelete('goal-123');
 */
function cancelGoalDelete(goalId) {
    // Clear the timeout
    if (goalDeleteTimeouts[goalId]) {
        clearTimeout(goalDeleteTimeouts[goalId]);
        delete goalDeleteTimeouts[goalId];
    }
    
    const goalElement = document.getElementById(`goal-${goalId}`);
    if (goalElement) {
        // Remove visual feedback
        goalElement.classList.remove('delete-pending');
        
        const actionsElement = goalElement.querySelector('.goal-actions');
        if (actionsElement) {
            // Replace confirm button with original delete button
            const confirmBtn = actionsElement.querySelector(`button[data-goal-id="${goalId}"][data-action="confirm-delete-goal"]`);
            if (confirmBtn) {
                confirmBtn.outerHTML = `<button data-action="delete-goal" data-goal-id="${goalId}" class="btn btn-error btn-small">Delete</button>`;
            }
        }
    }
}

/**
 * Executes confirmed goal deletion from storage with cleanup and error handling.
 * 
 * This function performs the actual deletion by filtering the goal out of the
 * goals array, saving the updated array to storage, clearing timeouts, 
 * refreshing the display, and showing a success message. Uses mutex protection
 * for safe concurrent operations.
 * 
 * @async
 * @function confirmDeleteGoal
 * @param {string} goalId - Unique identifier of the goal to delete
 * @returns {Promise<void>} Promise that resolves when deletion is complete
 * @throws {Error} When goal saving fails
 * @since 2.02.06
 * @example
 * // Execute confirmed deletion (called from confirm delete button)
 * await confirmDeleteGoal('goal-123');
 */
async function confirmDeleteGoal(goalId) {
    return withMutex('deleteOperations', async () => {
        try {
            // Clear timeout
            if (goalDeleteTimeouts[goalId]) {
                clearTimeout(goalDeleteTimeouts[goalId]);
                delete goalDeleteTimeouts[goalId];
            }

            // Remove goal from array
            const filteredGoals = getAllGoals().filter(g => g.id !== goalId);
            setAllGoals(filteredGoals);
            await saveGoals(getAllGoals());
            
            // Refresh display
            await displayGoals();
            
            // Show success message
            showGoalMessage('success', 'Goal deleted successfully');
        } catch (error) {
            console.error('Error deleting goal:', error);
            
            // Restore UI on error
            cancelGoalDelete(goalId);
            
            showGoalMessage('error', 'Failed to delete goal. Please try again.');
        }
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

// Note: Custom goal progress handlers (increaseGoalProgress, decreaseGoalProgress) are now in action-router.js

// ================================
// ES MODULE EXPORTS
// ================================

export {
    // Core goal functions
    initGoals,
    displayGoals,
    calculateGoalProgress,
    
    // Goal lifecycle functions
    showCreateGoalDialog,
    createTemplateGoal,
    saveGoal,
    editGoal,
    completeGoal,
    reactivateGoal,
    deleteGoal,
    confirmDeleteGoal,
    
    // UI functions
    cancelGoalDelete,
    cancelGoalDialog,
    
    // Tab rendering functions
    renderGoalsTab,
    initializeGoalsTab
};

/**
 * Renders the complete Goals tab HTML structure.
 * 
 * This function generates and injects the full Goals tab interface including:
 * - Active goals container with pagination support
 * - Quick goal templates grid (5 predefined templates)
 * - Completed goals container with pagination support
 * - Empty state messages for when no goals exist
 * 
 * @param {HTMLElement} tabPanel - The tab panel element to render content into
 * @throws {Error} If tabPanel is not a valid DOM element
 * @since 2.02.06
 * 
 * @example
 * const goalsTabPanel = document.getElementById('goalsTab');
 * renderGoalsTab(goalsTabPanel);
 */
function renderGoalsTab(tabPanel) {
    if (!tabPanel || !tabPanel.appendChild) {
        throw new Error('renderGoalsTab requires a valid DOM element');
    }
    
    tabPanel.innerHTML = `
        <div class="settings-section">
            <div class="flex-between mb-lg">
                <h3 id="goals-main-heading" tabindex="-1">🎯 Your Dream Goals</h3>
                <button data-action="create-goal" class="btn btn-primary btn-small">➕ New Goal</button>
            </div>
            <div id="activeGoalsContainer">
                <!-- Active goals will be populated here -->
            </div>
            <div id="activeGoalsPagination" class="pagination-container" style="display: none;">
                <!-- Active goals pagination will be populated here -->
            </div>
            <div id="noGoalsMessage" class="card-md text-center" style="display: none;">
                <div class="icon-lg mb-md">🎯</div>
                <h4 class="mb-sm">No Active Goals</h4>
                <p class="text-secondary mb-md">Create your first goal to start tracking your lucid dreaming progress!</p>
                <button data-action="create-goal" class="btn btn-primary">Create Your First Goal</button>
            </div>
        </div>
        
        <div class="settings-section">
            <h3>📈 Quick Goal Templates</h3>
            <div class="grid-auto">
                <div class="stats-card hover-card" data-action="create-template-goal" data-template="lucid-monthly">
                    <div class="icon-lg">✨</div>
                    <div class="stats-label">Monthly Lucid Goals</div>
                    <div class="stats-detail">Track lucid dreams per month</div>
                    <button class="btn btn-outline btn-small mt-sm">Use Template</button>
                </div>
                <div class="stats-card hover-card" data-action="create-template-goal" data-template="recall-streak">
                    <div class="icon-lg">🧠</div>
                    <div class="stats-label">Dream Recall Streak</div>
                    <div class="stats-detail">Remember dreams daily</div>
                    <button class="btn btn-outline btn-small mt-sm">Use Template</button>
                </div>
                <div class="stats-card hover-card" data-action="create-template-goal" data-template="journal-habit">
                    <div class="icon-lg">📝</div>
                    <div class="stats-label">Journaling Habit</div>
                    <div class="stats-detail">Write consistently</div>
                    <button class="btn btn-outline btn-small mt-sm">Use Template</button>
                </div>
                <div class="stats-card hover-card" data-action="create-template-goal" data-template="dream-signs">
                    <div class="icon-lg">🔍</div>
                    <div class="stats-label">Dream Signs Tracking</div>
                    <div class="stats-detail">Identify recurring patterns</div>
                    <button class="btn btn-outline btn-small mt-sm">Use Template</button>
                </div>
                <div class="stats-card hover-card" data-action="create-template-goal" data-template="custom">
                    <div class="icon-lg">⭐</div>
                    <div class="stats-label">Custom Goal</div>
                    <div class="stats-detail">Manual progress tracking</div>
                    <button class="btn btn-outline btn-small mt-sm">Use Template</button>
                </div>
            </div>
        </div>
        
        <div class="settings-section">
            <h3>🏆 Completed Goals</h3>
            <div id="completedGoalsContainer">
                <!-- Completed goals will be populated here -->
            </div>
            <div id="completedGoalsPagination" class="pagination-container" style="display: none;">
                <!-- Completed goals pagination will be populated here -->
            </div>
            <div id="noCompletedGoalsMessage" class="text-center text-secondary p-lg" style="display: none;">
                <div class="icon-lg mb-sm">🏆</div>
                <p>Your completed goals will appear here</p>
            </div>
        </div>
    `;
}

/**
 * Initializes the Goals tab with fresh data and displays current goals.
 * 
 * This function serves as the complete initialization routine for the Goals tab,
 * handling data refresh and UI population. It's called when the user switches
 * to the Goals tab to ensure the most up-to-date information is displayed.
 * 
 * @async
 * @throws {Error} If goal initialization or display fails
 * @since 2.02.06
 * 
 * @example
 * // Initialize goals tab when user switches to it
 * await initializeGoalsTab();
 */
async function initializeGoalsTab() {
    try {
        await initGoals();
        displayGoals();
    } catch (error) {
        console.error('Error initializing Goals tab:', error);
        // Fallback to just displaying current goals
        displayGoals();
    }
}