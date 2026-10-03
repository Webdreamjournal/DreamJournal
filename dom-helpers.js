/**
 * @fileoverview DOM manipulation and UI component utilities for the Dream Journal application.
 * 
 * This module provides comprehensive DOM manipulation utilities, UI component creation functions,
 * and consistent styling helpers. All functions are designed to work with the application's
 * HSL-based theme system and centralized event handling via data-action attributes.
 * 
 * This file only re-exports the UI modules, so existing imports of './dom-helpers.js'
 * (including dynamic import() calls) keep working: ui-basics.js, preferences.js,
 * format-helpers.js, info-tooltips.js, collapsible-sections.js, autocomplete-ui.js,
 * tips-and-goals-ui.js, pin-screen.js and tab-navigation.js.
 * 
 * @module DOMHelpers
 * @version 2.05.06
 * @author Dream Journal Development Team
 * @since 1.0.0
 * @requires constants
 * @requires state
 * @example
 * import * as DOMHelpers from './dom-helpers.js';
 * 
 * const button = DOMHelpers.createActionButton('save-dream', '123', 'Save Dream');
 * DOMHelpers.createInlineMessage('success', 'Dream saved successfully!');
 */

// ===================================================================================
// ES MODULE IMPORTS
// ===================================================================================

import {
    createActionButton,
    announceLiveMessage,
    createInlineMessage,
    createMetaDisplay,
    escapeHtml,
    escapeAttr,
    createPaginationHTML
} from './ui-basics.js';
import {
    getCurrentTheme,
    storeTheme,
    applyTheme,
    switchTheme,
    getCurrentPaginationPreference,
    storePaginationPreference
} from './preferences.js';
import {
    formatDateKey,
    formatDisplayDate,
    formatDateTimeDisplay,
    createPieChartColors,
    createPieChartHTML
} from './format-helpers.js';
import {
    showInfoTooltip,
    showExportFormatInfo,
    closeInfoTooltip,
    closeExportFormatInfo,
    showEmotionsHelp,
    showTagsHelp,
    showDreamSignsHelp,
    showSmartSearchHelp
} from './info-tooltips.js';
import {
    toggleDreamForm,
    toggleSettingsSection,
    toggleGoalsSection,
    toggleAdviceSection,
    toggleJournalSection
} from './collapsible-sections.js';
import {
    showSearchLoading,
    hideSearchLoading,
    initializeAutocomplete,
    setupLazySecureAutocomplete,
    renderAutocompleteManagementList,
    setupTagAutocomplete
} from './autocomplete-ui.js';
import { displayTip, handleTipNavigation, getGoalTypeLabel, createGoalElement } from './tips-and-goals-ui.js';
import { renderPinScreen } from './pin-screen.js';
import {
    switchAppTab,
    hideAllTabButtons,
    showAllTabButtons,
    syncSettingsDisplay,
    updateBrowserCompatibilityDisplay,
    switchVoiceTab,
    setDateFilter
} from './tab-navigation.js';

// ===================================================================================
// MODULE EXPORTS
// ===================================================================================

// Export all functions for ES module compatibility
export {
    // Button & Action Element Creation
    createActionButton,
    
    // Message & Notification System
    announceLiveMessage,
    createInlineMessage,
    
    // Display & Layout Helpers
    createMetaDisplay,
    createPaginationHTML,
    
    // Utility Functions
    escapeHtml,
    escapeAttr,
    
    // Theme Management
    getCurrentTheme,
    storeTheme,
    applyTheme,
    switchTheme,

    // Pagination Preference Management
    getCurrentPaginationPreference,
    storePaginationPreference,
    
    // Tab Management
    switchAppTab,
    switchVoiceTab,
    hideAllTabButtons,
    showAllTabButtons,
    
    // UI State Management
    syncSettingsDisplay,
    updateBrowserCompatibilityDisplay,
    toggleDreamForm,
    toggleSettingsSection,
    toggleGoalsSection,
    toggleAdviceSection,
    toggleJournalSection,

    // Search & Loading States
    showSearchLoading,
    hideSearchLoading,
    
    // Autocomplete System
    initializeAutocomplete,
    setupLazySecureAutocomplete,
    setupTagAutocomplete,
    renderAutocompleteManagementList,
    
    
    // Tips System
    displayTip,
    handleTipNavigation,
    
    // Date and Chart Utilities
    setDateFilter,
    formatDateKey,
    formatDisplayDate,
    formatDateTimeDisplay,
    createPieChartColors,
    createPieChartHTML,
    
    // Goals UI Utilities
    getGoalTypeLabel,
    createGoalElement,
    
    // Security UI
    renderPinScreen,

    // Tooltip System (Reusable)
    showInfoTooltip,
    closeInfoTooltip,

    // Export Info System (Specific)
    showExportFormatInfo,
    closeExportFormatInfo,

    // Dream Form Help System
    showEmotionsHelp,
    showTagsHelp,
    showDreamSignsHelp,
    showSmartSearchHelp
};

// Functions are now properly exported as ES modules for clean dependency management

