/**
 * @fileoverview Form validation and accessibility enhancement module for Dream Journal.
 * Provides comprehensive form validation with proper ARIA integration, error handling,
 * and accessibility features for all forms throughout the application.
 *
 * This module handles:
 * - Dynamic error message display with aria-live regions
 * - Form field validation with aria-invalid state management
 * - Submit feedback with comprehensive accessibility announcements
 * - Integration with existing form structures and styling
 *
 * @author Claude Code Assistant
 * @since 2.04.01
 * @requires constants.js - Application constants for validation rules and messages
 * @requires dom-helpers.js - DOM utilities for creating inline messages
 */

// ================================
// FORM VALIDATION CONFIGURATION
// ================================

/**
 * Validation configuration for different form fields across the application.
 *
 * @typedef {Object} ValidationRule
 * @property {boolean} required - Whether the field is required
 * @property {number} [minLength] - Minimum character length
 * @property {number} [maxLength] - Maximum character length
 * @property {number} [min] - Minimum numeric value
 * @property {number} [max] - Maximum numeric value
 * @property {RegExp} [pattern] - Regular expression pattern for validation
 * @property {Function} [customValidator] - Custom validation function
 * @property {string} [errorMessage] - Custom error message template
 * @since 2.04.01
 */

/**
 * Form field validation rules by form type and field name.
 *
 * @const {Object.<string, Object.<string, ValidationRule>>}
 * @since 2.04.01
 */
const VALIDATION_RULES = {
    // Dream journal form validation rules
    dream: {
        dreamDate: {
            required: true,
            errorMessage: 'Dream date and time is required for tracking patterns.'
        },
        dreamContent: {
            required: true,
            minLength: 1,
            errorMessage: 'Please describe your dream with at least 1 characters.'
        },
        dreamTitle: {
            required: false,
            maxLength: 100,
            errorMessage: 'Dream title must be 100 characters or less.'
        },
        dreamEmotions: {
            required: false,
            maxLength: 500,
            errorMessage: 'Emotions list is too long. Please keep under 500 characters.'
        },
        dreamTags: {
            required: false,
            maxLength: 500,
            errorMessage: 'Tags list is too long. Please keep under 500 characters.'
        },
        dreamSigns: {
            required: false,
            maxLength: 500,
            errorMessage: 'Dream signs list is too long. Please keep under 500 characters.'
        }
    },

    // Goal form validation rules
    goal: {
        goalTitle: {
            required: true,
            minLength: 1,
            maxLength: 100,
            errorMessage: 'Goal title must be between 1 and 100 characters.'
        },
        goalDescription: {
            required: false,
            maxLength: 500,
            errorMessage: 'Goal description must be 500 characters or less.'
        },
        goalType: {
            required: true,
            errorMessage: 'Please select a goal type.'
        },
        goalPeriod: {
            required: true,
            errorMessage: 'Please select a time period for your goal.'
        },
        goalTarget: {
            required: true,
            min: 1,
            max: 1000000,
            errorMessage: 'Target number must be between 1 and 1000000.'
        },
        goalIcon: {
            required: false,
            maxLength: 10,
            errorMessage: 'Icon must be 10 characters or less (usually one emoji).'
        }
    },

    // Security form validation rules
    security: {
        pinInput: {
            required: true,
            minLength: 4,
            maxLength: 6,
            pattern: /^\d+$/,
            errorMessage: 'PIN must be 4-6 digits only.'
        },
        passwordInput: {
            required: true,
            minLength: 8,
            maxLength: 128,
            errorMessage: 'Password must be between 8 and 128 characters.'
        },
        confirmPassword: {
            required: true,
            customValidator: (value, formData) => {
                return value === formData.password;
            },
            errorMessage: 'Passwords do not match.'
        }
    }
};

// ================================
// CORE VALIDATION FUNCTIONS
// ================================

/**
 * Validates a single form field based on its validation rules.
 *
 * This function performs comprehensive validation of form fields including
 * required checks, length validation, pattern matching, and custom validation.
 * It integrates with ARIA accessibility features and provides detailed error messages.
 *
 * @function validateField
 * @param {string} formType - The type of form (e.g., 'dream', 'goal', 'security')
 * @param {string} fieldName - The name of the field to validate
 * @param {string|number} value - The current value of the field
 * @param {Object} [formData={}] - Complete form data for cross-field validation
 * @returns {ValidationResult} Object containing validation status and error message
 * @since 2.04.01
 *
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether the field passes validation
 * @property {string} [errorMessage] - Error message if validation fails
 * @property {string} [warningMessage] - Warning message for non-critical issues
 *
 * @example
 * // Validate a required dream content field
 * const result = validateField('dream', 'dreamContent', userInput);
 * if (!result.isValid) {
 *     showFieldError('dreamContent', result.errorMessage);
 * }
 */
function validateField(formType, fieldName, value, formData = {}) {
    const rules = VALIDATION_RULES[formType]?.[fieldName];
    if (!rules) {
        return { isValid: true }; // No rules defined, assume valid
    }

    // Convert value to string for consistent processing
    const stringValue = String(value || '').trim();

    // Required field validation
    if (rules.required && !stringValue) {
        return {
            isValid: false,
            errorMessage: rules.errorMessage || `${fieldName} is required.`
        };
    }

    // Skip further validation if field is empty and not required
    if (!rules.required && !stringValue) {
        return { isValid: true };
    }

    // Length validation
    if (rules.minLength && stringValue.length < rules.minLength) {
        return {
            isValid: false,
            errorMessage: rules.errorMessage || `Must be at least ${rules.minLength} characters.`
        };
    }

    if (rules.maxLength && stringValue.length > rules.maxLength) {
        return {
            isValid: false,
            errorMessage: rules.errorMessage || `Must be ${rules.maxLength} characters or less.`
        };
    }

    // Numeric validation
    if (typeof value === 'number' || !isNaN(Number(stringValue))) {
        const numValue = Number(stringValue);

        if (rules.min !== undefined && numValue < rules.min) {
            return {
                isValid: false,
                errorMessage: rules.errorMessage || `Must be at least ${rules.min}.`
            };
        }

        if (rules.max !== undefined && numValue > rules.max) {
            return {
                isValid: false,
                errorMessage: rules.errorMessage || `Must be ${rules.max} or less.`
            };
        }
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(stringValue)) {
        return {
            isValid: false,
            errorMessage: rules.errorMessage || 'Invalid format.'
        };
    }

    // Custom validation
    if (rules.customValidator && !rules.customValidator(value, formData)) {
        return {
            isValid: false,
            errorMessage: rules.errorMessage || 'Validation failed.'
        };
    }

    return { isValid: true };
}

/**
 * Displays or hides error messages for a form field with proper ARIA integration.
 *
 * This function manages the visual and accessibility aspects of form validation errors.
 * It updates aria-invalid attributes, displays error messages in dedicated containers,
 * and ensures screen reader announcements through aria-live regions.
 *
 * @function showFieldError
 * @param {string} fieldId - The ID of the form field
 * @param {string} [errorMessage] - Error message to display (empty string or null clears error)
 * @param {boolean} [announceImmediately=false] - Whether to announce the error immediately
 * @returns {void}
 * @since 2.04.01
 *
 * @example
 * // Show an error message for a form field
 * showFieldError('dreamContent', 'This field is required');
 *
 * @example
 * // Clear an error message
 * showFieldError('dreamContent', null);
 */
function showFieldError(fieldId, errorMessage = null, announceImmediately = false) {
    const field = document.getElementById(fieldId);
    const errorContainer = document.getElementById(`${fieldId}-error`);

    if (!field) {
        console.warn(`Form field with ID '${fieldId}' not found`);
        return;
    }

    if (errorMessage) {
        // Show error state
        field.setAttribute('aria-invalid', 'true');

        if (errorContainer) {
            errorContainer.textContent = errorMessage;
            errorContainer.style.display = 'block';

            // Immediate announcement for critical errors
            if (announceImmediately) {
                errorContainer.setAttribute('aria-live', 'assertive');
                // Reset to polite after announcement
                setTimeout(() => {
                    errorContainer.setAttribute('aria-live', 'polite');
                }, 100);
            }
        }

        // Add error styling class if available
        field.classList.add('field-error');
    } else {
        // Clear error state
        field.setAttribute('aria-invalid', 'false');

        if (errorContainer) {
            errorContainer.textContent = '';
            errorContainer.style.display = 'none';
        }

        // Remove error styling class
        field.classList.remove('field-error');
    }
}

/**
 * Validates an entire form and displays all error messages.
 *
 * This function performs comprehensive form validation by checking all fields
 * against their defined rules. It coordinates error display, focus management,
 * and provides summary feedback for complex forms.
 *
 * @function validateForm
 * @param {string} formType - The type of form to validate
 * @param {Object} formData - Object containing all form field values
 * @returns {FormValidationResult} Comprehensive validation results
 * @since 2.04.01
 *
 * @typedef {Object} FormValidationResult
 * @property {boolean} isValid - Whether the entire form is valid
 * @property {Array<string>} errors - Array of all error messages
 * @property {string} [firstErrorField] - ID of the first field with an error
 * @property {number} errorCount - Total number of validation errors
 *
 * @example
 * // Validate a dream form before submission
 * const formData = {
 *     dreamDate: dreamDateInput.value,
 *     dreamContent: dreamContentInput.value,
 *     dreamTitle: dreamTitleInput.value
 * };
 * const result = validateForm('dream', formData);
 * if (!result.isValid) {
 *     focusFirstError(result.firstErrorField);
 *     showFormSubmissionFeedback('error', `Please fix ${result.errorCount} validation errors`);
 * }
 */
function validateForm(formType, formData) {
    const rules = VALIDATION_RULES[formType];
    if (!rules) {
        console.warn(`No validation rules defined for form type: ${formType}`);
        return { isValid: true, errors: [], errorCount: 0 };
    }

    const errors = [];
    let firstErrorField = null;

    // Validate each field
    for (const [fieldName, value] of Object.entries(formData)) {
        const result = validateField(formType, fieldName, value, formData);

        if (!result.isValid) {
            errors.push(result.errorMessage);

            // Track first error for focus management
            if (!firstErrorField) {
                firstErrorField = fieldName;
            }

            // Display error for this field
            showFieldError(fieldName, result.errorMessage, false);
        } else {
            // Clear any existing error for valid fields
            showFieldError(fieldName, null);
        }
    }

    return {
        isValid: errors.length === 0,
        errors: errors,
        firstErrorField: firstErrorField,
        errorCount: errors.length
    };
}

// ================================
// FORM SUBMISSION FEEDBACK
// ================================

/**
 * Displays form submission feedback with comprehensive accessibility features.
 *
 * This function creates and manages form submission feedback messages that are
 * properly announced to screen readers and provide clear visual feedback to users.
 * It integrates with the existing message system while adding form-specific features.
 *
 * @function showFormSubmissionFeedback
 * @param {'success'|'error'|'info'|'warning'} type - Type of feedback message
 * @param {string} message - The feedback message to display
 * @param {Object} [options={}] - Additional options for feedback display
 * @param {string} [options.containerId] - ID of container to show feedback in
 * @param {number} [options.duration] - How long to display the message (ms)
 * @param {boolean} [options.persistent] - Whether message should persist until manually closed
 * @param {boolean} [options.announceImmediately] - Whether to use assertive aria-live
 * @returns {void}
 * @since 2.04.01
 *
 * @example
 * // Show success feedback after dream submission
 * showFormSubmissionFeedback('success', 'Dream saved successfully!', {
 *     containerId: 'journal-feedback',
 *     duration: 3000
 * });
 *
 * @example
 * // Show error feedback with persistent display
 * showFormSubmissionFeedback('error', 'Please fix the validation errors above', {
 *     persistent: true,
 *     announceImmediately: true
 * });
 */
function showFormSubmissionFeedback(type, message, options = {}) {
    const {
        containerId = 'form-feedback-container',
        duration = 4000,
        persistent = false,
        announceImmediately = false
    } = options;

    // Find or create feedback container
    let container = document.getElementById(containerId);
    if (!container) {
        // Create default feedback container
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'form-feedback-container';
        container.setAttribute('role', 'status');
        container.setAttribute('aria-live', announceImmediately ? 'assertive' : 'polite');
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '1000';
        container.style.maxWidth = '400px';
        document.body.appendChild(container);
    }

    // Create feedback message element
    const feedbackElement = document.createElement('div');
    feedbackElement.className = `form-feedback ${type}`;
    feedbackElement.textContent = message;

    // Add close button for persistent messages
    if (persistent) {
        const closeButton = document.createElement('button');
        closeButton.className = 'feedback-close-btn';
        closeButton.textContent = '×';
        closeButton.setAttribute('aria-label', 'Close message');
        closeButton.style.float = 'right';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.fontSize = '18px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.marginLeft = '10px';

        closeButton.addEventListener('click', () => {
            feedbackElement.remove();
        });

        feedbackElement.appendChild(closeButton);
    }

    // Add to container
    container.appendChild(feedbackElement);

    // Auto-remove after duration if not persistent
    if (!persistent && duration > 0) {
        setTimeout(() => {
            if (feedbackElement.parentNode) {
                feedbackElement.remove();
            }
        }, duration);
    }

    // Use existing createInlineMessage system as fallback
    if (typeof createInlineMessage === 'function') {
        createInlineMessage(message, type, duration);
    }
}

/**
 * Sets up real-time validation for form fields with debounced input handling.
 *
 * This function attaches event listeners to form fields to provide immediate
 * validation feedback as users type or interact with forms. It includes proper
 * debouncing to avoid excessive validation calls and maintains good performance.
 *
 * @function setupRealtimeValidation
 * @param {string} formType - The type of form to set up validation for
 * @param {Array<string>} fieldIds - Array of field IDs to monitor
 * @param {Object} [options={}] - Configuration options
 * @param {number} [options.debounceDelay=500] - Delay in ms before validating
 * @param {boolean} [options.validateOnBlur=true] - Whether to validate on field blur
 * @param {boolean} [options.clearOnFocus=false] - Whether to clear errors on field focus
 * @returns {void}
 * @since 2.04.01
 *
 * @example
 * // Set up real-time validation for dream form
 * setupRealtimeValidation('dream', ['dreamContent', 'dreamTitle'], {
 *     debounceDelay: 300,
 *     validateOnBlur: true
 * });
 */
function setupRealtimeValidation(formType, fieldIds, options = {}) {
    const {
        debounceDelay = 500,
        validateOnBlur = true,
        clearOnFocus = false
    } = options;

    const debounceTimers = new Map();

    fieldIds.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field) {
            console.warn(`Field ${fieldId} not found for real-time validation setup`);
            return;
        }

        // Input event with debouncing
        field.addEventListener('input', (event) => {
            // Clear existing timer
            if (debounceTimers.has(fieldId)) {
                clearTimeout(debounceTimers.get(fieldId));
            }

            // Set new timer
            const timer = setTimeout(() => {
                const result = validateField(formType, fieldId, event.target.value);
                if (!result.isValid) {
                    showFieldError(fieldId, result.errorMessage, false);
                } else {
                    showFieldError(fieldId, null);
                }
                debounceTimers.delete(fieldId);
            }, debounceDelay);

            debounceTimers.set(fieldId, timer);
        });

        // Blur event validation
        if (validateOnBlur) {
            field.addEventListener('blur', (event) => {
                // Cancel debounced input validation
                if (debounceTimers.has(fieldId)) {
                    clearTimeout(debounceTimers.get(fieldId));
                    debounceTimers.delete(fieldId);
                }

                // Immediate validation on blur
                const result = validateField(formType, fieldId, event.target.value);
                if (!result.isValid) {
                    showFieldError(fieldId, result.errorMessage, false);
                } else {
                    showFieldError(fieldId, null);
                }
            });
        }

        // Focus event - optionally clear errors
        if (clearOnFocus) {
            field.addEventListener('focus', () => {
                showFieldError(fieldId, null);
            });
        }
    });
}

// ================================
// FOCUS MANAGEMENT
// ================================

/**
 * Moves focus to the first field with a validation error.
 *
 * This function provides proper focus management after form validation,
 * ensuring users with screen readers or keyboard navigation are directed
 * to the first field that needs attention.
 *
 * @function focusFirstError
 * @param {string} fieldId - ID of the field to focus
 * @returns {void}
 * @since 2.04.01
 *
 * @example
 * // Focus the first error field after form validation
 * const validationResult = validateForm('dream', formData);
 * if (!validationResult.isValid) {
 *     focusFirstError(validationResult.firstErrorField);
 * }
 */
function focusFirstError(fieldId) {
    if (!fieldId) return;

    const field = document.getElementById(fieldId);
    if (field) {
        field.focus();

        // Scroll field into view if needed
        field.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
}

// ================================
// INITIALIZATION AND INTEGRATION
// ================================

/**
 * Initializes form validation for all forms in the application.
 *
 * This function sets up validation systems for all major forms throughout
 * the Dream Journal application. It should be called during application
 * initialization to ensure all forms have proper accessibility and validation.
 *
 * @function initializeFormValidation
 * @returns {void}
 * @since 2.04.01
 *
 * @example
 * // Initialize form validation during app startup
 * document.addEventListener('DOMContentLoaded', () => {
 *     initializeFormValidation();
 * });
 */
function initializeFormValidation() {
    // Set up validation for dream journal form
    if (document.getElementById('dreamContent')) {
        setupRealtimeValidation('dream', [
            'dreamContent', 'dreamTitle', 'dreamEmotions',
            'dreamTags', 'dreamSigns', 'dreamDate'
        ], {
            debounceDelay: 300,
            validateOnBlur: true
        });
    }

    // Set up validation for goal forms (will be present when goal dialogs are shown)
    // Note: Goal form fields are dynamically created, so we'll validate on submission

    // Set up validation for security forms
    const pinInput = document.getElementById('pinInput');
    if (pinInput) {
        setupRealtimeValidation('security', ['pinInput'], {
            debounceDelay: 200,
            validateOnBlur: true
        });
    }

    console.log('Form validation system initialized');
}

// ================================
// EXPORTS
// ================================

// Export functions for use by other modules
window.FormValidation = {
    validateField,
    validateForm,
    showFieldError,
    showFormSubmissionFeedback,
    setupRealtimeValidation,
    focusFirstError,
    initializeFormValidation
};

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFormValidation);
} else {
    initializeFormValidation();
}