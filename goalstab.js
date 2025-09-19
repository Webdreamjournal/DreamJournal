/**
 * @fileoverview Goals Management Module for Dream Journal Application
 * 
 * This module provides complete goal lifecycle management including creation, editing, deletion,
 * progress tracking, pagination, and template-based goal creation system. It supports various
 * goal types (lucid dreams, streaks, dream signs, custom) with automatic progress calculation
 * and pagination for both active and completed goals.
 * 
 * @module Goals
 * @version 2.04.00
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

import { CONSTANTS, GOAL_TEMPLATES, GOALS_ACTIVE_COLLAPSE_KEY, GOALS_TEMPLATES_COLLAPSE_KEY, GOALS_COMPLETED_COLLAPSE_KEY } from './constants.js';
import {
    getAllGoals,
    setAllGoals,
    getActiveGoalsPage,
    getCompletedGoalsPage,
    setActiveGoalsPage,
    setCompletedGoalsPage,
    goalDeleteTimeouts,
    withMutex,
    getIsGoalsActiveCollapsed,
    setIsGoalsActiveCollapsed,
    getIsGoalsTemplatesCollapsed,
    setIsGoalsTemplatesCollapsed,
    getIsGoalsCompletedCollapsed,
    setIsGoalsCompletedCollapsed
} from './state.js';
import { loadGoals, saveGoals, generateUniqueId, loadDreams } from './storage.js';
import { announceLiveMessage, createInlineMessage, escapeHtml, createPaginationHTML, getGoalTypeLabel, createGoalElement } from './dom-helpers.js';
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
// GOALS VALIDATION AND DATA PROCESSING
// ================================

/**
 * Validates the integrity of goals data and ensures it's in a consistent state.
 *
 * This function performs defensive checks on the goals data structure to ensure
 * it's a valid array and handles recovery scenarios when data corruption occurs.
 * It provides logging and automatic recovery mechanisms for data integrity issues.
 *
 * @async
 * @function validateGoalsDataIntegrity
 * @returns {Promise<Array<Goal>>} Validated and corrected goals array
 * @throws {Error} When data recovery fails completely
 * @since 2.02.49
 *
 * @example
 * // Validate goals data before processing
 * const validGoals = await validateGoalsDataIntegrity();
 * console.log('Valid goals count:', validGoals.length);
 */
async function validateGoalsDataIntegrity() {
    let currentGoals = getAllGoals();

    if (!Array.isArray(currentGoals)) {
        console.warn('Goals data is not an array, attempting recovery from storage');
        try {
            currentGoals = await loadGoals();
            setAllGoals(currentGoals);
            console.log('Successfully recovered goals from storage:', currentGoals.length, 'goals');
        } catch (error) {
            console.error('Failed to recover goals from storage:', error);
            currentGoals = [];
            setAllGoals(currentGoals);
        }
    }

    return currentGoals;
}

/**
 * Parses and normalizes dream signs data from various input formats.
 *
 * This function handles dream signs stored as either comma-separated strings or
 * arrays, normalizing them to a consistent format. It performs trimming,
 * case normalization, and deduplication to ensure data consistency.
 *
 * @function parseAndNormalizeDreamSigns
 * @param {Array<Object>} dreams - Array of dream objects to process
 * @returns {Set<string>} Set of unique, normalized dream signs
 * @since 2.02.49
 *
 * @example
 * // Parse dream signs from dream entries
 * const dreams = [
 *   { dreamSigns: "flying, water, family" },
 *   { dreamSigns: ["SCHOOL", "Friends"] }
 * ];
 * const signs = parseAndNormalizeDreamSigns(dreams);
 * console.log([...signs]); // ['flying', 'water', 'family', 'school', 'friends']
 */
function parseAndNormalizeDreamSigns(dreams) {
    const dreamSigns = new Set();

    dreams.forEach(dream => {
        if (dream.dreamSigns && typeof dream.dreamSigns === 'string') {
            // Handle comma-separated string format
            const signs = dream.dreamSigns.split(',').map(s => s.trim().toLowerCase());
            signs.forEach(sign => {
                if (sign) dreamSigns.add(sign);
            });
        } else if (Array.isArray(dream.dreamSigns)) {
            // Handle array format
            dream.dreamSigns.forEach(sign => {
                if (sign && typeof sign === 'string') {
                    dreamSigns.add(sign.trim().toLowerCase());
                }
            });
        }
    });

    return dreamSigns;
}

/**
 * Validates goal form data with comprehensive field checking and error reporting.
 *
 * This function performs complete validation of goal form fields including
 * required field checks, data type validation, and business rule enforcement.
 * It provides detailed error reporting for user feedback.
 *
 * @function validateGoalForm
 * @returns {Object} Validation result object with isValid flag and formData/errors
 * @since 2.02.49
 *
 * @example
 * // Validate form before saving
 * const validation = validateGoalForm();
 * if (validation.isValid) {
 *   console.log('Form data:', validation.formData);
 * } else {
 *   console.error('Validation errors:', validation.errors);
 * }
 *
 * @example
 * // Handle validation in save operation
 * const { isValid, formData, errors } = validateGoalForm();
 * if (!isValid) {
 *   showGoalMessage('form-error', errors[0]);
 *   return;
 * }
 */
function validateGoalForm() {
    const titleElement = document.getElementById('goalTitle');
    const descriptionElement = document.getElementById('goalDescription');
    const typeElement = document.getElementById('goalType');
    const periodElement = document.getElementById('goalPeriod');
    const targetElement = document.getElementById('goalTarget');
    const iconElement = document.getElementById('goalIcon');

    // Check for missing form elements
    if (!titleElement || !descriptionElement || !typeElement || !periodElement || !targetElement || !iconElement) {
        return {
            isValid: false,
            errors: ['Goal form not properly initialized'],
            formData: null
        };
    }

    // Extract and validate form values
    const title = titleElement.value.trim();
    const description = descriptionElement.value.trim();
    const type = typeElement.value;
    const period = periodElement.value;
    const target = parseInt(targetElement.value);
    const icon = iconElement.value.trim() || '🎯';

    const errors = [];

    // Required field validation
    if (!title) {
        errors.push('Goal title is required');
    }

    if (!target || isNaN(target) || target < 1) {
        errors.push('Target must be a positive number');
    }

    // Data type validation
    if (target && target > 1000) {
        errors.push('Target should be reasonable (maximum 1000)');
    }

    if (icon && icon.length > 2) {
        errors.push('Icon should be maximum 2 characters');
    }

    // Return validation result
    if (errors.length > 0) {
        return {
            isValid: false,
            errors: errors,
            formData: null
        };
    }

    return {
        isValid: true,
        errors: [],
        formData: {
            title,
            description,
            type,
            period,
            target,
            icon
        }
    };
}

// ================================
// ENCRYPTION HELPER FUNCTIONS
// ================================

/**
 * Determines if goals should be encrypted based on current encryption settings.
 *
 * This helper function checks if encryption is enabled globally and if an encryption
 * password is available in the current session. It provides a centralized way to
 * determine whether goal data should be encrypted before storage operations.
 * Uses dynamic imports to avoid circular dependencies.
 *
 * @async
 * @function shouldEncryptGoal
 * @returns {Promise<boolean>} True if goals should be encrypted, false otherwise
 * @since 2.03.01
 *
 * @example
 * // Check if goal should be encrypted before saving
 * if (await shouldEncryptGoal()) {
 *   const encrypted = await encryptItemForStorage(goalData, password);
 *   await saveItemToStore('goals', encrypted);
 * } else {
 *   await saveGoals(goalData);
 * }
 *
 * @example
 * // Use in conditional logic
 * const encryptionNeeded = await shouldEncryptGoal();
 * console.log('Goal encryption required:', encryptionNeeded);
 */
async function shouldEncryptGoal() {
    try {
        const { getEncryptionEnabled, getEncryptionPassword } = await import('./state.js');
        return getEncryptionEnabled() && getEncryptionPassword();
    } catch (error) {
        console.error('Error checking encryption status:', error);
        return false;
    }
}

// ================================
// GOAL CRUD OPERATIONS
// ================================

/**
 * Creates a new goal with the provided form data and saves it to storage with encryption support.
 *
 * This enhanced function handles the complete goal creation process including ID generation,
 * data initialization, encryption handling, storage persistence, UI updates, and user feedback.
 * It supports both encrypted and unencrypted storage based on encryption settings and includes
 * special handling for custom goal types and comprehensive error handling.
 *
 * **Encryption Support:**
 * - Automatically encrypts goal data if encryption is enabled and password is available
 * - Falls back to unencrypted storage if encryption is not enabled
 * - Updates memory state with unencrypted data for immediate UI operations
 * - Handles encryption errors gracefully with user feedback
 *
 * @async
 * @function createNewGoal
 * @param {Object} formData - Validated form data containing goal properties
 * @param {string} formData.title - Goal title
 * @param {string} formData.description - Goal description
 * @param {string} formData.type - Goal type (lucid_count, recall_streak, etc.)
 * @param {string} formData.period - Time period (monthly, streak, total)
 * @param {number} formData.target - Target number to achieve
 * @param {string} formData.icon - Goal icon (emoji)
 * @returns {Promise<void>} Promise that resolves when goal creation is complete
 * @throws {Error} When goal creation, encryption, or storage fails
 * @since 2.03.01
 *
 * @example
 * // Create a new goal with validated form data
 * const formData = { title: 'Lucid Dreams', type: 'lucid_count', target: 5, ... };
 * await createNewGoal(formData);
 *
 * @example
 * // Create encrypted goal (automatically handled if encryption is enabled)
 * const formData = { title: 'Private Goal', type: 'custom', target: 10, ... };
 * await createNewGoal(formData); // Will be encrypted if encryption is enabled
 */
async function createNewGoal(formData) {
    const { title, description, type, period, target, icon } = formData;

    const createdAt = new Date().toISOString();
    const goalData = {
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
        // Initialize currentProgress field for custom goals
        currentProgress: type === 'custom' ? 0 : undefined
    };

    try {
        // Handle encryption if enabled
        if (await shouldEncryptGoal()) {
            const { getEncryptionPassword } = await import('./state.js');
            const { saveItemToStore, encryptItemForStorage } = await import('./storage.js');
            const password = getEncryptionPassword();

            if (!password) {
                throw new Error('Encryption enabled but password not available in session');
            }

            // Encrypt for storage
            const encryptedData = await encryptItemForStorage(goalData, password);
            await saveItemToStore('goals', encryptedData);
            console.log('Goal encrypted and saved to storage');

            // Update memory state with unencrypted data (for immediate UI operations)
            const currentGoals = getAllGoals();
            currentGoals.push(goalData);
            setAllGoals(currentGoals);
            console.log('Goal added to memory state, total goals:', currentGoals.length);
        } else {
            // Save unencrypted using existing mechanism
            const currentGoals = getAllGoals();
            currentGoals.push(goalData);
            setAllGoals(currentGoals);
            await saveGoals(currentGoals);
            console.log('Goal saved to storage (unencrypted)');
        }

        await displayGoals();
        console.log('Goals display updated');

        cancelGoalDialog();
        showGoalMessage('success', 'Goal created successfully!');
    } catch (error) {
        console.error('Error creating goal:', error);

        // Provide specific error message for encryption issues
        if (error.message.includes('password') || error.message.includes('encrypt')) {
            showGoalMessage('error', 'Failed to encrypt goal. Please check your encryption settings.');
        } else {
            showGoalMessage('error', 'Failed to create goal. Please try again.');
        }

        throw error; // Re-throw for caller handling
    }
}

/**
 * Updates an existing goal with new form data and saves changes to storage with encryption support.
 *
 * This enhanced function handles the complete goal update process including data merging,
 * encryption handling, special handling for goal type conversion, storage persistence,
 * UI updates, and user feedback. It preserves existing goal metadata while updating
 * editable fields and handles both encrypted and unencrypted storage scenarios.
 *
 * **Encryption Support:**
 * - Automatically encrypts updated goal data if encryption is enabled and password is available
 * - Falls back to unencrypted storage if encryption is not enabled
 * - Updates memory state with unencrypted data for immediate UI operations
 * - Handles encryption errors gracefully with user feedback
 *
 * @async
 * @function updateExistingGoal
 * @param {string} goalId - Unique identifier of the goal to update
 * @param {Object} formData - Validated form data containing updated goal properties
 * @param {string} formData.title - Updated goal title
 * @param {string} formData.description - Updated goal description
 * @param {string} formData.type - Updated goal type
 * @param {string} formData.period - Updated time period
 * @param {number} formData.target - Updated target number
 * @param {string} formData.icon - Updated goal icon
 * @returns {Promise<void>} Promise that resolves when goal update is complete
 * @throws {Error} When goal update, encryption, or storage fails
 * @since 2.03.01
 *
 * @example
 * // Update an existing goal with new data
 * const formData = { title: 'Updated Goal', target: 10, ... };
 * await updateExistingGoal('goal-123', formData);
 *
 * @example
 * // Update encrypted goal (automatically handled if encryption is enabled)
 * const formData = { title: 'Updated Private Goal', target: 15, ... };
 * await updateExistingGoal('goal-456', formData); // Will be encrypted if encryption is enabled
 */
async function updateExistingGoal(goalId, formData) {
    const { title, description, type, period, target, icon } = formData;

    const currentGoals = getAllGoals();
    const goalIndex = currentGoals.findIndex(g => g.id === goalId);
    if (goalIndex === -1) {
        throw new Error(`Goal with ID ${goalId} not found`);
    }

    try {
        // Update existing goal with new data
        const updatedGoalData = {
            ...currentGoals[goalIndex],
            title,
            description,
            type,
            period,
            target,
            icon,
            updatedAt: new Date().toISOString(),
            // Initialize currentProgress for goals being converted to custom type
            currentProgress: type === 'custom' && currentGoals[goalIndex].currentProgress === undefined
                ? 0 : currentGoals[goalIndex].currentProgress
        };

        // Handle encryption if enabled
        if (await shouldEncryptGoal()) {
            const { getEncryptionPassword } = await import('./state.js');
            const { saveItemToStore, encryptItemForStorage } = await import('./storage.js');
            const password = getEncryptionPassword();

            if (!password) {
                throw new Error('Encryption enabled but password not available in session');
            }

            // Encrypt for storage
            const encryptedData = await encryptItemForStorage(updatedGoalData, password);
            await saveItemToStore('goals', encryptedData);
            console.log('Goal encrypted and updated in storage');
        } else {
            // Save unencrypted using existing mechanism
            currentGoals[goalIndex] = updatedGoalData;
            setAllGoals(currentGoals);
            await saveGoals(currentGoals);
            console.log('Goal updated in storage (unencrypted)');
        }

        // Update memory state with unencrypted data (for immediate UI operations)
        currentGoals[goalIndex] = updatedGoalData;
        setAllGoals(currentGoals);

        await displayGoals();
        cancelGoalDialog();
        showGoalMessage('success', 'Goal updated successfully!');

        // Clean up editing state
        delete window.editingGoalId;
    } catch (error) {
        console.error('Error updating goal:', error);

        // Provide specific error message for encryption issues
        if (error.message.includes('password') || error.message.includes('encrypt')) {
            showGoalMessage('error', 'Failed to encrypt goal update. Please check your encryption settings.');
        } else {
            showGoalMessage('error', 'Failed to update goal. Please try again.');
        }

        throw error; // Re-throw for caller handling
    }
}

// ================================
// GOALS UI HELPER FUNCTIONS
// ================================

/**
 * Calculates the total number of pages needed for a given item count.
 *
 * This utility function standardizes pagination calculations across the goals system
 * by providing a consistent way to compute page counts based on item quantities
 * and the configured items-per-page setting.
 *
 * @function calculateTotalPages
 * @param {number} itemCount - The total number of items to paginate
 * @returns {number} The total number of pages needed (minimum 1)
 * @since 2.02.49
 *
 * @example
 * // Calculate pages for 25 goals with 10 per page
 * const totalPages = calculateTotalPages(25); // Returns 3
 *
 * @example
 * // Handle edge cases
 * const emptyPages = calculateTotalPages(0); // Returns 1
 * const oneItemPages = calculateTotalPages(1); // Returns 1
 */
function calculateTotalPages(itemCount) {
    if (itemCount <= 0) return 1;
    return Math.ceil(itemCount / CONSTANTS.GOALS_PER_PAGE);
}

/**
 * Calculates pagination information for both active and completed goals.
 *
 * This function provides comprehensive pagination data including total pages
 * for both goal status types, helping to maintain consistent pagination
 * behavior across the goals system.
 *
 * @function calculateGoalsPaginationInfo
 * @param {Array<Goal>} goals - Array of all goals to analyze
 * @returns {Object} Pagination information object
 * @returns {Object} return.active - Active goals pagination info
 * @returns {number} return.active.totalPages - Total pages for active goals
 * @returns {number} return.active.count - Number of active goals
 * @returns {Object} return.completed - Completed goals pagination info
 * @returns {number} return.completed.totalPages - Total pages for completed goals
 * @returns {number} return.completed.count - Number of completed goals
 * @since 2.02.49
 *
 * @example
 * // Get pagination info for current goals
 * const paginationInfo = calculateGoalsPaginationInfo(getAllGoals());
 * console.log('Active pages:', paginationInfo.active.totalPages);
 * console.log('Completed pages:', paginationInfo.completed.totalPages);
 */
function calculateGoalsPaginationInfo(goals) {
    const activeGoals = goals.filter(goal => goal.status === 'active');
    const completedGoals = goals.filter(goal => goal.status === 'completed');

    return {
        active: {
            totalPages: calculateTotalPages(activeGoals.length),
            count: activeGoals.length
        },
        completed: {
            totalPages: calculateTotalPages(completedGoals.length),
            count: completedGoals.length
        }
    };
}

/**
 * Validates and adjusts a page number to ensure it's within valid bounds.
 *
 * This utility function ensures page numbers stay within valid ranges,
 * automatically adjusting invalid page numbers to the nearest valid value.
 * Used to prevent pagination errors when items are added or removed.
 *
 * @function validatePageNumber
 * @param {number} currentPage - The page number to validate
 * @param {number} totalPages - The total number of available pages
 * @returns {number} A valid page number within bounds
 * @since 2.02.49
 *
 * @example
 * // Validate page numbers
 * const validPage = validatePageNumber(5, 3); // Returns 3 (adjusted down)
 * const minPage = validatePageNumber(0, 5); // Returns 1 (adjusted up)
 * const okPage = validatePageNumber(2, 5); // Returns 2 (no change)
 */
function validatePageNumber(currentPage, totalPages) {
    if (currentPage < 1) return 1;
    if (currentPage > totalPages && totalPages > 0) return totalPages;
    return currentPage;
}

/**
 * Adjusts pagination after goal status changes to prevent empty pages.
 *
 * This function handles the complex logic of adjusting pagination when goals
 * change status (e.g., completed to active, or vice versa). It ensures that
 * users don't end up on empty pages after status changes and maintains
 * a smooth user experience.
 *
 * @async
 * @function adjustPaginationAfterStatusChange
 * @param {Array<Goal>} goals - Current array of all goals
 * @param {'active'|'completed'|'both'} changedStatus - Which status category was affected
 * @returns {Promise<void>} Promise that resolves when pagination is adjusted
 * @since 2.02.49
 *
 * @example
 * // Adjust pagination after completing a goal
 * await adjustPaginationAfterStatusChange(getAllGoals(), 'completed');
 *
 * @example
 * // Adjust pagination after reactivating a goal
 * await adjustPaginationAfterStatusChange(getAllGoals(), 'active');
 */
async function adjustPaginationAfterStatusChange(goals, changedStatus) {
    const paginationInfo = calculateGoalsPaginationInfo(goals);

    if (changedStatus === 'completed' || changedStatus === 'both') {
        // Adjust completed goals pagination
        const currentCompletedPage = getCompletedGoalsPage();
        const validCompletedPage = validatePageNumber(currentCompletedPage, paginationInfo.completed.totalPages);
        if (validCompletedPage !== currentCompletedPage) {
            setCompletedGoalsPage(validCompletedPage);
        }
    }

    if (changedStatus === 'active' || changedStatus === 'both') {
        // Adjust active goals pagination
        const currentActivePage = getActiveGoalsPage();
        const validActivePage = validatePageNumber(currentActivePage, paginationInfo.active.totalPages);
        if (validActivePage !== currentActivePage) {
            setActiveGoalsPage(validActivePage);
        }
    }
}

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
    await adjustPaginationAfterStatusChange(currentGoals, 'both');
    const paginationInfo = calculateGoalsPaginationInfo(currentGoals);
    
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
    if (paginationInfo.active.totalPages > 1) {
        activePagination.style.display = 'block';
        activePagination.innerHTML = createPaginationHTML(getActiveGoalsPage(), paginationInfo.active.totalPages, 'active-goals-page');
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
    if (paginationInfo.completed.totalPages > 1) {
        completedPagination.style.display = 'block';
        completedPagination.innerHTML = createPaginationHTML(getCompletedGoalsPage(), paginationInfo.completed.totalPages, 'completed-goals-page');
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
 * and manual progress tracking for custom goals. For monthly goals, progress is calculated
 * based on the specific month the goal was created in, not the current month, ensuring
 * completed goals retain their accuracy even after month transitions.
 *
 * **Monthly Goal Behavior:**
 * - Monthly goals are tied to the month they were created in (from goal.createdAt)
 * - Progress counts dreams within that specific month only
 * - Completed monthly goals remain accurate even in subsequent months
 * - Progress message shows the specific month name and year for clarity
 *
 * @async
 * @function calculateGoalProgress
 * @param {Goal} goal - Goal object to calculate progress for
 * @param {string} goal.type - Goal type (lucid_count, recall_streak, journal_streak, dream_signs_count, custom)
 * @param {string} goal.period - Time period (monthly, streak, total)
 * @param {string} goal.createdAt - ISO timestamp of when goal was created (used for monthly calculations)
 * @param {number} [goal.currentProgress] - Manual progress for custom goals
 * @returns {Promise<GoalProgress>} Progress calculation result with current value and message
 * @throws {Error} When dream data loading fails
 * @since 1.0.0
 * @updated 2.04.43 - Fixed monthly goals to use creation month instead of current month
 *
 * @example
 * // Monthly goal created in January 2024
 * const goal = {
 *   type: 'lucid_count',
 *   period: 'monthly',
 *   target: 5,
 *   createdAt: '2024-01-15T10:00:00Z'
 * };
 * const progress = await calculateGoalProgress(goal);
 * console.log(progress.current); // 3
 * console.log(progress.message); // "3 lucid dreams in January 2024"
 *
 * @example
 * // Streak goal progress
 * const streakGoal = { type: 'recall_streak', target: 7 };
 * const streakProgress = await calculateGoalProgress(streakGoal);
 * console.log(streakProgress.message); // "5 days streak"
 *
 * @example
 * // Custom goal with manual progress
 * const customGoal = { type: 'custom', currentProgress: 8, target: 10 };
 * const customProgress = await calculateGoalProgress(customGoal);
 * console.log(customProgress.message); // "8 completed"
 */
async function calculateGoalProgress(goal) {
    const dreams = await loadDreams();
    const now = new Date();
    
    let current = 0;
    let message = '';
    
    switch (goal.type) {
        case 'lucid_count':
            if (goal.period === 'monthly') {
                // Use the month the goal was created in, not the current month
                const goalCreatedDate = new Date(goal.createdAt);
                const startOfGoalMonth = new Date(goalCreatedDate.getFullYear(), goalCreatedDate.getMonth(), 1);
                const endOfGoalMonth = new Date(goalCreatedDate.getFullYear(), goalCreatedDate.getMonth() + 1, 1);

                const lucidDreams = dreams.filter(dream => {
                    const dreamDate = new Date(dream.timestamp);
                    return dream.isLucid && dreamDate >= startOfGoalMonth && dreamDate < endOfGoalMonth;
                });

                current = lucidDreams.length;
                const monthName = goalCreatedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                message = `${current} lucid dreams in ${monthName}`;
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
            const dreamSigns = parseAndNormalizeDreamSigns(dreams);
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
 * Handles saving both new and existing goals with comprehensive validation and error handling.
 *
 * This function serves as the main entry point for goal persistence operations. It performs
 * data integrity checks, validates form input, and delegates to appropriate creation or
 * update operations. The function manages UI state transitions and user feedback through
 * the specialized CRUD operation functions.
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

    try {
        // Validate goals data integrity
        const currentGoals = await validateGoalsDataIntegrity();
        setAllGoals(currentGoals);

        // Validate form data
        const validation = validateGoalForm();
        if (!validation.isValid) {
            console.error('Goal form validation failed:', validation.errors);
            showGoalMessage('form-error', validation.errors[0]);
            return;
        }

        console.log('Goal form values:', validation.formData);

        // Delegate to appropriate CRUD operation
        if (window.editingGoalId) {
            await updateExistingGoal(window.editingGoalId, validation.formData);
        } else {
            await createNewGoal(validation.formData);
        }
    } catch (error) {
        console.error('Error in saveGoal operation:', error);
        // Error messages are handled by the individual CRUD functions
        // No additional error handling needed here
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
        
        // Adjust pagination after reactivation
        await adjustPaginationAfterStatusChange(getAllGoals(), 'completed');
        
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
        <h3 id="goals-main-heading" tabindex="-1">🎯 Your Dream Goals</h3><br>
        <div class="settings-section" data-goals-section="active">
            <h3 data-action="toggle-goals-active"
                role="button"
                tabindex="0"
                aria-expanded="true"
                aria-label="Active Goals section - currently expanded. Press Enter or Space to collapse"
                style="cursor: pointer; user-select: none;">
                🎯 Active Goals
                <span class="collapse-indicator" title="Click to collapse"></span>
                <span class="collapse-hint text-xxs text-secondary font-normal">(Click to collapse)</span>
            </h3>
            <div class="settings-section-content">
                <div class="flex-between mb-lg">
                    <div></div>
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
                    <p class="text-secondary mb-md">Create a new goal to start tracking your lucid dreaming progress!</p>
                </div>
            </div>
        </div>

        <div class="settings-section" data-goals-section="templates">
            <h3 data-action="toggle-goals-templates"
                role="button"
                tabindex="0"
                aria-expanded="true"
                aria-label="Quick Goal Templates section - currently expanded. Press Enter or Space to collapse"
                style="cursor: pointer; user-select: none;">
                📈 Quick Goal Templates
                <span class="collapse-indicator" title="Click to collapse"></span>
                <span class="collapse-hint text-xxs text-secondary font-normal">(Click to collapse)</span>
            </h3>
            <div class="settings-section-content">
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
        </div>

        <div class="settings-section" data-goals-section="completed">
            <h3 data-action="toggle-goals-completed"
                role="button"
                tabindex="0"
                aria-expanded="true"
                aria-label="Completed Goals section - currently expanded. Press Enter or Space to collapse"
                style="cursor: pointer; user-select: none;">
                🏆 Completed Goals
                <span class="collapse-indicator" title="Click to collapse"></span>
                <span class="collapse-hint text-xxs text-secondary font-normal">(Click to collapse)</span>
            </h3>
            <div class="settings-section-content">
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

        // Restore saved goals section collapse states
        restoreGoalsSectionStates();

        displayGoals();
    } catch (error) {
        console.error('Error initializing Goals tab:', error);
        // Fallback to just displaying current goals
        displayGoals();
    }
}

/**
 * Restores saved goals section collapse states from localStorage.
 *
 * This function applies saved collapse states to each goals section immediately
 * after the HTML is rendered, preventing visual flicker and maintaining user
 * preferences across browser sessions. Each section is handled independently.
 *
 * **Restoration Process:**
 * 1. Check localStorage for each section's saved state
 * 2. Apply visual state (show/hide content areas)
 * 3. Update ARIA attributes for accessibility
 * 4. Update visual indicators (arrows and hint text)
 * 5. Synchronize global application state
 *
 * **Section Mapping:**
 * - 'active': Active Goals section
 * - 'templates': Quick Goal Templates section
 * - 'completed': Completed Goals section
 *
 * **Error Handling:**
 * - Gracefully handles localStorage access failures
 * - Falls back to expanded state for any missing elements
 * - Continues processing other sections if one fails
 *
 * @function
 * @returns {void}
 * @since 2.04.01
 *
 * @example
 * // Called during goals tab initialization
 * renderGoalsTab(tabPanel);
 * restoreGoalsSectionStates();
 * // All sections now reflect saved user preferences
 */
function restoreGoalsSectionStates() {
    const sections = [
        {
            name: 'active',
            storageKey: GOALS_ACTIVE_COLLAPSE_KEY,
            getter: getIsGoalsActiveCollapsed,
            setter: setIsGoalsActiveCollapsed,
            displayName: 'Active Goals'
        },
        {
            name: 'templates',
            storageKey: GOALS_TEMPLATES_COLLAPSE_KEY,
            getter: getIsGoalsTemplatesCollapsed,
            setter: setIsGoalsTemplatesCollapsed,
            displayName: 'Quick Goal Templates'
        },
        {
            name: 'completed',
            storageKey: GOALS_COMPLETED_COLLAPSE_KEY,
            getter: getIsGoalsCompletedCollapsed,
            setter: setIsGoalsCompletedCollapsed,
            displayName: 'Completed Goals'
        }
    ];

    sections.forEach(section => {
        try {
            // Get DOM elements for this section
            const sectionElement = document.querySelector(`[data-goals-section="${section.name}"]`);
            if (!sectionElement) {
                console.warn(`Goals section element not found: ${section.name}`);
                return;
            }

            const toggleHeader = sectionElement.querySelector(`[data-action="toggle-goals-${section.name}"]`);
            const contentArea = sectionElement.querySelector('.settings-section-content');
            const collapseIndicator = toggleHeader?.querySelector('.collapse-indicator');
            const hintText = toggleHeader?.querySelector('.collapse-hint');

            if (!toggleHeader || !contentArea) {
                console.warn(`Required elements not found for goals section: ${section.name}`);
                return;
            }

            // Get saved state from localStorage
            let savedState;
            try {
                savedState = localStorage.getItem(section.storageKey);
            } catch (e) {
                console.warn(`Failed to read localStorage for goals ${section.name}:`, e);
                savedState = null;
            }

            if (savedState === 'true') {
                // Apply collapsed state
                contentArea.style.display = 'none';
                section.setter(true);

                // Update ARIA attributes
                toggleHeader.setAttribute('aria-expanded', 'false');
                toggleHeader.setAttribute('aria-label', `${section.displayName} section - currently collapsed. Press Enter or Space to expand`);

                // Update visual indicators
                if (collapseIndicator) {
                    collapseIndicator.textContent = '';
                    collapseIndicator.setAttribute('title', 'Click to expand');
                }
                if (hintText) {
                    hintText.textContent = '(Click to expand)';
                }
            } else {
                // Apply expanded state (default or explicitly saved as 'false')
                contentArea.style.display = 'block';
                section.setter(false);

                // Update ARIA attributes
                toggleHeader.setAttribute('aria-expanded', 'true');
                toggleHeader.setAttribute('aria-label', `${section.displayName} section - currently expanded. Press Enter or Space to collapse`);

                // Update visual indicators
                if (collapseIndicator) {
                    collapseIndicator.textContent = '';
                    collapseIndicator.setAttribute('title', 'Click to collapse');
                }
                if (hintText) {
                    hintText.textContent = '(Click to collapse)';
                }
            }

        } catch (error) {
            console.error(`Error restoring state for goals ${section.name} section:`, error);
            // Continue with other sections
        }
    });
}