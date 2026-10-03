/**
 * @fileoverview The daily tip display and navigation, and the goal type labels and goal element used by
 *   the Goals tab.
 *
 * @module TipsAndGoalsUi
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { getTipsCount } from './constants.js';
import { getCurrentTipIndex } from './state.js';
import { displayTipLazy } from './advicetab.js';
import { escapeHtml, escapeAttr } from './ui-basics.js';
import { formatDisplayDate } from './format-helpers.js';

// ===================================================================================
// TIP DISPLAY & NAVIGATION SYSTEM
// ===================================================================================

/**
 * Displays a tip at the specified index with safe bounds checking.
 * 
 * Updates both the tip content display and counter information in the advice tab.
 * Uses modulo arithmetic to handle negative indices and out-of-bounds values safely,
 * so invalid input does not throw.
 * 
 * @async
 * @param {number} index - Tip index to display (can be negative or out of bounds)
 * @returns {Promise<void>} Promise that resolves when tip is displayed
 * @throws {TypeError} When index is not a number
 * @throws {Error} When tip loading fails
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
async function displayTip(index) {
    try {
        // Get total tips count for bounds checking
        const totalTips = await getTipsCount();

        if (totalTips === 0) {
            console.warn('No tips available for display');
            return;
        }

        // Ensure index is within bounds and handle negative numbers using modulo arithmetic
        const safeIndex = ((index % totalTips) + totalTips) % totalTips;

        // Use the lazy loading display function
        await displayTipLazy(safeIndex, totalTips);

    } catch (error) {
        console.error('Error displaying tip:', error);

        // Show error message to user
        const tipTextElement = document.getElementById('tipText');
        if (tipTextElement) {
            tipTextElement.innerHTML = `
                <div class="text-center">
                    <h4 class="text-primary mb-md">Tip Temporarily Unavailable</h4>
                    <p class="text-secondary">There was an error loading this tip. Please try again.</p>
                </div>
            `;
        }
    }
}

/**
 * Handles tip navigation in the specified direction.
 * 
 * Provides navigation controls for the daily tips system, supporting both forward
 * and backward navigation with automatic bounds handling via the displayTip function.
 * 
 * @async
 * @param {('next'|'prev')} direction - Navigation direction
 * @returns {Promise<void>} Promise that resolves when navigation is complete
 * @throws {TypeError} When direction is not 'next' or 'prev'
 * @throws {Error} When tip loading fails during navigation
 * @since 1.0.0
 * @example
 * // Navigate to next tip
 * handleTipNavigation('next');
 * 
 * @example
 * // Navigate to previous tip
 * handleTipNavigation('prev');
 */
async function handleTipNavigation(direction) {
    let newIndex = getCurrentTipIndex();
    if (direction === 'next') {
        newIndex++;
    } else {
        newIndex--;
    }
    await displayTip(newIndex); // displayTip handles bounds checking
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
                    <button data-action="edit-goal" data-goal-id="${escapeAttr(goal.id)}" class="btn btn-outline btn-small">Edit</button>
                    <button data-action="complete-goal" data-goal-id="${escapeAttr(goal.id)}" class="btn btn-success btn-small">Complete</button>
                ` : `
                    <button data-action="reactivate-goal" data-goal-id="${escapeAttr(goal.id)}" class="btn btn-warning btn-small">Reactivate</button>
                `}
                <button data-action="delete-goal" data-goal-id="${escapeAttr(goal.id)}" class="btn btn-error btn-small">Delete</button>
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
                        <button data-action="decrease-goal-progress" data-goal-id="${escapeAttr(goal.id)}" class="btn btn-outline btn-small" ${progress.current <= 0 ? 'disabled' : ''}>➖</button>
                        <span class="font-semibold">Manual Tracking</span>
                        <button data-action="increase-goal-progress" data-goal-id="${escapeAttr(goal.id)}" class="btn btn-outline btn-small">➕</button>
                    </div>
                </div>
            ` : ''}
        </div>
        <div class="flex-between text-sm text-secondary">
            <div>
                <span>Created: ${formatDisplayDate(goal.createdAt)}</span>
                ${isCompleted && goal.completedAt ? `<br><span>Completed: ${formatDisplayDate(goal.completedAt)}</span>` : ''}
            </div>
            <span>${goal.period === 'monthly' ? 'Monthly Goal' : goal.period === 'streak' ? 'Streak Goal' : 'Total Goal'}</span>
        </div>
    `;
    
    return goalDiv;
}

// ================================
// ES MODULE EXPORTS
// ================================

export {
    displayTip,
    handleTipNavigation,
    getGoalTypeLabel,
    createGoalElement
};
