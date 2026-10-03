/**
 * @fileoverview Collapse and expand state for the dream form and the Settings, Goals, Advice and Journal
 *   sections, saved to localStorage.
 *
 * @module CollapsibleSections
 */

// ================================
// ES MODULE IMPORTS
// ================================

import {
    DREAM_FORM_COLLAPSE_KEY,
    SETTINGS_APPEARANCE_COLLAPSE_KEY,
    SETTINGS_SECURITY_COLLAPSE_KEY,
    SETTINGS_DATA_COLLAPSE_KEY,
    SETTINGS_AUTOCOMPLETE_COLLAPSE_KEY,
    SETTINGS_CLOUD_SYNC_COLLAPSE_KEY,
    GOALS_ACTIVE_COLLAPSE_KEY,
    GOALS_TEMPLATES_COLLAPSE_KEY,
    GOALS_COMPLETED_COLLAPSE_KEY,
    ADVICE_DAILY_TIP_COLLAPSE_KEY,
    ADVICE_TECHNIQUES_COLLAPSE_KEY,
    ADVICE_GENERAL_COLLAPSE_KEY,
    JOURNAL_CONTROLS_COLLAPSE_KEY
} from './constants.js';
import {
    getIsDreamFormCollapsed,
    setIsDreamFormCollapsed,
    getIsSettingsAppearanceCollapsed,
    setIsSettingsAppearanceCollapsed,
    getIsSettingsSecurityCollapsed,
    setIsSettingsSecurityCollapsed,
    getIsSettingsDataCollapsed,
    setIsSettingsDataCollapsed,
    getIsSettingsAutocompleteCollapsed,
    setIsSettingsAutocompleteCollapsed,
    getIsSettingsCloudSyncCollapsed,
    setIsSettingsCloudSyncCollapsed,
    getIsGoalsActiveCollapsed,
    setIsGoalsActiveCollapsed,
    getIsGoalsTemplatesCollapsed,
    setIsGoalsTemplatesCollapsed,
    getIsGoalsCompletedCollapsed,
    setIsGoalsCompletedCollapsed,
    getIsAdviceDailyTipCollapsed,
    setIsAdviceDailyTipCollapsed,
    getIsAdviceTechniquesCollapsed,
    setIsAdviceTechniquesCollapsed,
    getIsAdviceGeneralCollapsed,
    setIsAdviceGeneralCollapsed,
    getIsJournalControlsCollapsed,
    setIsJournalControlsCollapsed
} from './state.js';

// ===================================================================================
// FORM STATE MANAGEMENT
// ===================================================================================

/**
 * Toggles dream form between expanded and collapsed states with optional focus management.
 * 
 * Provides a collapsible dream entry form interface that can be expanded for full
 * functionality or collapsed to save screen space. User preference is persisted
 * to localStorage for consistency across sessions. Includes accessibility-focused
 * option to move focus to first form field when expanding via keyboard.
 * 
 * @param {boolean} [shouldMoveFocus=false] - Whether to move focus to first form field when expanding (for keyboard accessibility)
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Toggle form state (expand if collapsed, collapse if expanded)
 * toggleDreamForm();
 * 
 * @example
 * // Toggle with focus management (typically for keyboard activation)
 * toggleDreamForm(true); // Focuses date field when expanding
 * 
 * @example
 * // State persists across browser sessions
 * toggleDreamForm(); // Collapses form
 * // Page reload - form remains collapsed
 */
function toggleDreamForm(shouldMoveFocus = false) {
        const fullForm = document.getElementById('dreamFormFull');
        const collapsedForm = document.getElementById('dreamFormCollapsed');
        
        if (!fullForm || !collapsedForm) return; // Safety check

        // Get the toggle buttons/headers
        const expandedHeader = fullForm.querySelector('[data-action="toggle-dream-form"]');
        const collapsedHeader = collapsedForm.querySelector('[data-action="toggle-dream-form"]');

        if (getIsDreamFormCollapsed()) {
            // Expand: show full form, hide collapsed
            fullForm.style.display = 'block';
            collapsedForm.style.display = 'none';
            setIsDreamFormCollapsed(false);
            
            // Update ARIA states for expanded form
            if (expandedHeader) {
                expandedHeader.setAttribute('aria-expanded', 'true');
                expandedHeader.setAttribute('aria-label', 'Record Your Dream form - currently expanded. Press Enter or Space to collapse');
            }
            if (collapsedHeader) {
                collapsedHeader.setAttribute('aria-expanded', 'true');
            }
            
            // Move focus to first form field if expansion was triggered by keyboard
            if (shouldMoveFocus) {
                // Use setTimeout to ensure the form is fully displayed before focusing
                setTimeout(() => {
                    const dateField = document.getElementById('dreamDate');
                    if (dateField) {
                        dateField.focus();
                    }
                }, 50);
            }
            
            try { localStorage.setItem(DREAM_FORM_COLLAPSE_KEY, 'false'); } catch (e) {}
        } else {
            // Collapse: hide full form, show collapsed
            fullForm.style.display = 'none';
            collapsedForm.style.display = 'block';
            setIsDreamFormCollapsed(true);
            
            // Update ARIA states for collapsed form
            if (collapsedHeader) {
                collapsedHeader.setAttribute('aria-expanded', 'false');
                collapsedHeader.setAttribute('aria-label', 'Record Your Dream form - currently collapsed. Press Enter or Space to expand');
            }
            if (expandedHeader) {
                expandedHeader.setAttribute('aria-expanded', 'false');
            }
            
            try { localStorage.setItem(DREAM_FORM_COLLAPSE_KEY, 'true'); } catch (e) {}
        }
    }

/**
 * Toggles the visibility of a specific settings section between expanded and collapsed states.
 *
 * This function provides collapsible functionality for settings page sections,
 * allowing users to show/hide section content to organize their interface.
 * State is persisted across browser sessions using localStorage for each section independently.
 *
 * **Supported Sections:**
 * - 'appearance': Appearance settings (theme, display preferences)
 * - 'security': Security settings (PIN, encryption, data protection)
 * - 'data': Data Management settings (export/import, backup/restore)
 * - 'autocomplete': Autocomplete Management settings (tags, dream signs, emotions)
 *
 * **Functionality:**
 * - Toggles section content visibility (show/hide)
 * - Updates ARIA attributes for accessibility
 * - Persists collapse state to localStorage
 * - Updates global application state
 * - Provides visual feedback with expand/collapse indicators
 *
 * **Accessibility Features:**
 * - Proper ARIA expanded/collapsed states
 * - Keyboard navigation support
 * - Screen reader announcements
 * - Focus management
 *
 * @async
 * @function
 * @param {('appearance'|'security'|'data'|'autocomplete')} sectionName - Name of the settings section to toggle
 * @returns {Promise<void>} Resolves when toggle operation completes
 * @throws {Error} When sectionName is invalid or required DOM elements are missing
 * @since 2.04.01
 *
 * @example
 * // Toggle the security settings section
 * await toggleSettingsSection('security');
 *
 * @example
 * // Toggle appearance section (typically called via data-action)
 * <h3 class="collapsible-heading">
 *   <button type="button" class="collapse-toggle" data-action="toggle-settings-appearance">
 *     🎨 Appearance <span class="collapse-indicator">🔽</span>
 *   </button>
 * </h3>
 */
async function toggleSettingsSection(sectionName) {
    try {
        // Validate section name
        const validSections = ['appearance', 'security', 'data', 'autocomplete', 'cloud-sync'];
        if (!validSections.includes(sectionName)) {
            throw new Error(`Invalid section name: ${sectionName}. Must be one of: ${validSections.join(', ')}`);
        }

        // Get the appropriate state functions and storage key
        const sectionConfig = {
            'appearance': {
                getter: getIsSettingsAppearanceCollapsed,
                setter: setIsSettingsAppearanceCollapsed,
                storageKey: SETTINGS_APPEARANCE_COLLAPSE_KEY,
                displayName: 'Appearance',
                emoji: '🎨'
            },
            'security': {
                getter: getIsSettingsSecurityCollapsed,
                setter: setIsSettingsSecurityCollapsed,
                storageKey: SETTINGS_SECURITY_COLLAPSE_KEY,
                displayName: 'Security',
                emoji: '🔐'
            },
            'data': {
                getter: getIsSettingsDataCollapsed,
                setter: setIsSettingsDataCollapsed,
                storageKey: SETTINGS_DATA_COLLAPSE_KEY,
                displayName: 'Data Management',
                emoji: '💾'
            },
            'autocomplete': {
                getter: getIsSettingsAutocompleteCollapsed,
                setter: setIsSettingsAutocompleteCollapsed,
                storageKey: SETTINGS_AUTOCOMPLETE_COLLAPSE_KEY,
                displayName: 'Autocomplete Management',
                emoji: '🏷️'
            },
            'cloud-sync': {
                getter: getIsSettingsCloudSyncCollapsed,
                setter: setIsSettingsCloudSyncCollapsed,
                storageKey: SETTINGS_CLOUD_SYNC_COLLAPSE_KEY,
                displayName: 'Cloud Sync',
                emoji: '☁️'
            }
        };

        const config = sectionConfig[sectionName];

        // Get the settings section element
        const sectionElement = document.querySelector(`[data-settings-section="${sectionName}"]`);
        if (!sectionElement) {
            throw new Error(`Settings section element not found for: ${sectionName}`);
        }

        // Get the toggle header and content area
        const toggleHeader = sectionElement.querySelector(`[data-action="toggle-settings-${sectionName}"]`);
        const contentArea = sectionElement.querySelector('.settings-section-content');
        const collapseIndicator = toggleHeader?.querySelector('.collapse-indicator');

        if (!toggleHeader || !contentArea) {
            throw new Error(`Required toggle elements not found for section: ${sectionName}`);
        }

        const isCurrentlyCollapsed = config.getter();

        if (isCurrentlyCollapsed) {
            // Expand: show content
            contentArea.style.display = 'block';
            config.setter(false);

            // Update ARIA states for expanded section
            toggleHeader.setAttribute('aria-expanded', 'true');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently expanded. Press Enter or Space to collapse`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to collapse');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to collapse)';
            }

            // Save expanded state
            try { localStorage.setItem(config.storageKey, 'false'); } catch (e) {}
        } else {
            // Collapse: hide content
            contentArea.style.display = 'none';
            config.setter(true);

            // Update ARIA states for collapsed section
            toggleHeader.setAttribute('aria-expanded', 'false');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently collapsed. Press Enter or Space to expand`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to expand');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to expand)';
            }

            // Save collapsed state
            try { localStorage.setItem(config.storageKey, 'true'); } catch (e) {}
        }

    } catch (error) {
        console.error(`Error toggling settings section "${sectionName}":`, error);
        throw error;
    }
}

/**
 * Toggles the collapse/expand state of a goals section with state persistence.
 *
 * This function handles the UI interactions for collapsing and expanding goals sections
 * including visual state updates, ARIA attribute management, localStorage persistence,
 * and focus management. It follows the same pattern as settings sections but works
 * specifically with goals sections.
 *
 * **Supported Sections:**
 * - 'active': Active Goals section
 * - 'templates': Quick Goal Templates section
 * - 'completed': Completed Goals section
 *
 * **State Management:**
 * - Updates visual indicators (arrows and hint text)
 * - Saves state to localStorage for persistence across sessions
 * - Updates ARIA attributes for screen readers
 * - Synchronizes with global application state
 *
 * **Error Handling:**
 * - Validates section names before processing
 * - Handles DOM element availability gracefully
 * - Provides fallback for localStorage access issues
 *
 * @async
 * @function toggleGoalsSection
 * @param {string} sectionName - Name of the goals section to toggle ('active', 'templates', 'completed')
 * @returns {Promise<void>} Promise that resolves when toggle operation completes
 * @throws {Error} When invalid section name is provided or required DOM elements are missing
 * @since 2.04.01
 *
 * @example
 * // Toggle the active goals section
 * await toggleGoalsSection('active');
 *
 * @example
 * // Toggle the templates section
 * await toggleGoalsSection('templates');
 */
async function toggleGoalsSection(sectionName) {
    try {
        // Validate section name
        const validSections = ['active', 'templates', 'completed'];
        if (!validSections.includes(sectionName)) {
            throw new Error(`Invalid goals section name: ${sectionName}. Must be one of: ${validSections.join(', ')}`);
        }

        // Get the appropriate state functions and storage key
        const sectionConfig = {
            'active': {
                getter: getIsGoalsActiveCollapsed,
                setter: setIsGoalsActiveCollapsed,
                storageKey: GOALS_ACTIVE_COLLAPSE_KEY,
                displayName: 'Active Goals',
                emoji: '🎯'
            },
            'templates': {
                getter: getIsGoalsTemplatesCollapsed,
                setter: setIsGoalsTemplatesCollapsed,
                storageKey: GOALS_TEMPLATES_COLLAPSE_KEY,
                displayName: 'Quick Goal Templates',
                emoji: '📈'
            },
            'completed': {
                getter: getIsGoalsCompletedCollapsed,
                setter: setIsGoalsCompletedCollapsed,
                storageKey: GOALS_COMPLETED_COLLAPSE_KEY,
                displayName: 'Completed Goals',
                emoji: '🏆'
            }
        };

        const config = sectionConfig[sectionName];
        if (!config) {
            throw new Error(`Goals section configuration not found for: ${sectionName}`);
        }

        // Get DOM elements
        const sectionElement = document.querySelector(`[data-goals-section="${sectionName}"]`);
        if (!sectionElement) {
            throw new Error(`Goals section element not found: [data-goals-section="${sectionName}"]`);
        }

        const toggleHeader = sectionElement.querySelector(`[data-action="toggle-goals-${sectionName}"]`);
        const contentArea = sectionElement.querySelector('.settings-section-content');

        if (!toggleHeader || !contentArea) {
            throw new Error(`Required elements not found in goals section: ${sectionName}`);
        }

        // Get current state and toggle
        const isCurrentlyCollapsed = config.getter();
        const collapseIndicator = toggleHeader.querySelector('.collapse-indicator');

        if (isCurrentlyCollapsed) {
            // Expand: show content
            contentArea.style.display = 'block';
            config.setter(false);

            // Update ARIA states for expanded section
            toggleHeader.setAttribute('aria-expanded', 'true');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently expanded. Press Enter or Space to collapse`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to collapse');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to collapse)';
            }

            // Save expanded state
            try { localStorage.setItem(config.storageKey, 'false'); } catch (e) {}
        } else {
            // Collapse: hide content
            contentArea.style.display = 'none';
            config.setter(true);

            // Update ARIA states for collapsed section
            toggleHeader.setAttribute('aria-expanded', 'false');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently collapsed. Press Enter or Space to expand`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to expand');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to expand)';
            }

            // Save collapsed state
            try { localStorage.setItem(config.storageKey, 'true'); } catch (e) {}
        }

    } catch (error) {
        console.error(`Error toggling goals section "${sectionName}":`, error);
        throw error;
    }
}

/**
 * Toggles the collapse/expand state of an advice section with state persistence.
 *
 * This function handles the UI interactions for collapsing and expanding advice sections
 * including visual state updates, ARIA attribute management, localStorage persistence,
 * and focus management. It follows the same pattern as settings and goals sections but works
 * specifically with advice sections.
 *
 * **Supported Sections:**
 * - 'daily-tip': Daily Lucid Dreaming Tip section
 * - 'techniques': Lucid Dreaming Techniques section
 * - 'general': General Advice section
 *
 * **State Management:**
 * - Updates visual indicators (arrows and hint text)
 * - Saves state to localStorage for persistence across sessions
 * - Updates ARIA attributes for screen readers
 * - Synchronizes with global application state
 *
 * **Error Handling:**
 * - Validates section names before processing
 * - Handles DOM element availability gracefully
 * - Provides fallback for localStorage access issues
 *
 * @async
 * @function toggleAdviceSection
 * @param {string} sectionName - Name of the advice section to toggle ('daily-tip', 'techniques', 'general')
 * @returns {Promise<void>} Promise that resolves when toggle operation completes
 * @throws {Error} When invalid section name is provided or required DOM elements are missing
 * @since 2.04.01
 *
 * @example
 * // Toggle the daily tip section
 * await toggleAdviceSection('daily-tip');
 *
 * @example
 * // Toggle the techniques section
 * await toggleAdviceSection('techniques');
 */
async function toggleAdviceSection(sectionName) {
    try {
        // Validate section name
        const validSections = ['daily-tip', 'techniques', 'general'];
        if (!validSections.includes(sectionName)) {
            throw new Error(`Invalid advice section name: ${sectionName}. Must be one of: ${validSections.join(', ')}`);
        }

        // Get the appropriate state functions and storage key
        const sectionConfig = {
            'daily-tip': {
                getter: getIsAdviceDailyTipCollapsed,
                setter: setIsAdviceDailyTipCollapsed,
                storageKey: ADVICE_DAILY_TIP_COLLAPSE_KEY,
                displayName: 'Daily Lucid Dreaming Tip',
                emoji: '💡'
            },
            'techniques': {
                getter: getIsAdviceTechniquesCollapsed,
                setter: setIsAdviceTechniquesCollapsed,
                storageKey: ADVICE_TECHNIQUES_COLLAPSE_KEY,
                displayName: 'Lucid Dreaming Techniques',
                emoji: '📚'
            },
            'general': {
                getter: getIsAdviceGeneralCollapsed,
                setter: setIsAdviceGeneralCollapsed,
                storageKey: ADVICE_GENERAL_COLLAPSE_KEY,
                displayName: 'General Advice',
                emoji: '💡'
            }
        };

        const config = sectionConfig[sectionName];
        if (!config) {
            throw new Error(`Advice section configuration not found for: ${sectionName}`);
        }

        // Get DOM elements
        const sectionElement = document.querySelector(`[data-advice-section="${sectionName}"]`);
        if (!sectionElement) {
            throw new Error(`Advice section element not found: [data-advice-section="${sectionName}"]`);
        }

        const toggleHeader = sectionElement.querySelector(`[data-action="toggle-advice-${sectionName}"]`);
        const contentArea = sectionElement.querySelector('.settings-section-content');

        if (!toggleHeader || !contentArea) {
            throw new Error(`Required elements not found in advice section: ${sectionName}`);
        }

        // Get current state and toggle
        const isCurrentlyCollapsed = config.getter();
        const collapseIndicator = toggleHeader.querySelector('.collapse-indicator');

        if (isCurrentlyCollapsed) {
            // Expand: show content
            contentArea.style.display = 'block';
            config.setter(false);

            // Update ARIA states for expanded section
            toggleHeader.setAttribute('aria-expanded', 'true');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently expanded. Press Enter or Space to collapse`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to collapse');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to collapse)';
            }

            // Save expanded state
            try { localStorage.setItem(config.storageKey, 'false'); } catch (e) {}
        } else {
            // Collapse: hide content
            contentArea.style.display = 'none';
            config.setter(true);

            // Update ARIA states for collapsed section
            toggleHeader.setAttribute('aria-expanded', 'false');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently collapsed. Press Enter or Space to expand`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to expand');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to expand)';
            }

            // Save collapsed state
            try { localStorage.setItem(config.storageKey, 'true'); } catch (e) {}
        }

    } catch (error) {
        console.error(`Error toggling advice section "${sectionName}":`, error);
        throw error;
    }
}

/**
 * Toggles the collapse/expand state of a journal section with state persistence.
 *
 * This function handles the UI interactions for collapsing and expanding journal sections
 * including visual state updates, ARIA attribute management, localStorage persistence,
 * and focus management. It follows the same pattern as other section toggles but works
 * specifically with journal sections.
 *
 * **Supported Sections:**
 * - 'controls': Search & Filter Controls section
 *
 * **State Management:**
 * - Updates visual indicators (arrows and hint text)
 * - Saves state to localStorage for persistence across sessions
 * - Updates ARIA attributes for screen readers
 * - Synchronizes with global application state
 *
 * **Error Handling:**
 * - Validates section names before processing
 * - Handles DOM element availability gracefully
 * - Provides fallback for localStorage access issues
 *
 * @async
 * @function toggleJournalSection
 * @param {string} sectionName - Name of the journal section to toggle ('controls')
 * @returns {Promise<void>} Promise that resolves when toggle operation completes
 * @throws {Error} When invalid section name is provided or required DOM elements are missing
 * @since 2.04.01
 *
 * @example
 * // Toggle the controls section
 * await toggleJournalSection('controls');
 */
async function toggleJournalSection(sectionName) {
    try {
        // Validate section name
        const validSections = ['controls'];
        if (!validSections.includes(sectionName)) {
            throw new Error(`Invalid journal section name: ${sectionName}. Must be one of: ${validSections.join(', ')}`);
        }

        // Get the appropriate state functions and storage key
        const sectionConfig = {
            'controls': {
                getter: getIsJournalControlsCollapsed,
                setter: setIsJournalControlsCollapsed,
                storageKey: JOURNAL_CONTROLS_COLLAPSE_KEY,
                displayName: 'Search & Filter Controls',
                emoji: '🔍'
            }
        };

        const config = sectionConfig[sectionName];
        if (!config) {
            throw new Error(`Journal section configuration not found for: ${sectionName}`);
        }

        // Get DOM elements
        const sectionElement = document.querySelector(`[data-journal-section="${sectionName}"]`);
        if (!sectionElement) {
            throw new Error(`Journal section element not found: [data-journal-section="${sectionName}"]`);
        }

        const toggleHeader = sectionElement.querySelector(`[data-action="toggle-journal-${sectionName}"]`);
        const contentArea = sectionElement.querySelector('.settings-section-content');

        if (!toggleHeader || !contentArea) {
            throw new Error(`Required elements not found in journal section: ${sectionName}`);
        }

        // Get current state and toggle
        const isCurrentlyCollapsed = config.getter();
        const collapseIndicator = toggleHeader.querySelector('.collapse-indicator');

        if (isCurrentlyCollapsed) {
            // Expand: show content
            contentArea.style.display = 'block';
            config.setter(false);

            // Update ARIA states for expanded section
            toggleHeader.setAttribute('aria-expanded', 'true');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently expanded. Press Enter or Space to collapse`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to collapse');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to collapse)';
            }

            // Save expanded state
            try { localStorage.setItem(config.storageKey, 'false'); } catch (e) {}
        } else {
            // Collapse: hide content
            contentArea.style.display = 'none';
            config.setter(true);

            // Update ARIA states for collapsed section
            toggleHeader.setAttribute('aria-expanded', 'false');
            toggleHeader.setAttribute('aria-label', `${config.displayName} section - currently collapsed. Press Enter or Space to expand`);

            // Update visual indicator
            if (collapseIndicator) {
                collapseIndicator.textContent = '';
                collapseIndicator.setAttribute('title', 'Click to expand');
            }

            // Update hint text
            const hintText = toggleHeader.querySelector('.collapse-hint');
            if (hintText) {
                hintText.textContent = '(Click to expand)';
            }

            // Save collapsed state
            try { localStorage.setItem(config.storageKey, 'true'); } catch (e) {}
        }

    } catch (error) {
        console.error(`Error toggling journal section "${sectionName}":`, error);
        throw error;
    }
}

// ================================
// ES MODULE EXPORTS
// ================================

export {
    toggleDreamForm,
    toggleSettingsSection,
    toggleGoalsSection,
    toggleAdviceSection,
    toggleJournalSection
};
