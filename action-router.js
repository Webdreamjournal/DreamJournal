/**
 * @fileoverview Action routing and centralized event delegation system for Dream Journal.
 * 
 * This module provides a unified event handling architecture using data-action attributes
 * to route user interactions to appropriate handler functions. It implements a centralized
 * action dispatcher pattern that eliminates the need for scattered event listeners
 * throughout the application.
 * 
 * The system consists of three main components:
 * 1. Action context extraction - Traverses DOM to find action elements and extract data
 * 2. Action mapping - Comprehensive registry of all application actions and handlers
 * 3. Unified event delegation - Single click and change handlers for the entire app
 * 
 * @module ActionRouter
 * @version 2.04.00
 * @author Dream Journal Development Team
 * @since 2.0.0
 * @requires constants
 * @requires state
 * @requires storage
 * @requires dom-helpers
 * @requires security
 * @requires dream-crud
 * @requires voice-notes
 * @requires goals
 * @requires stats
 * @requires import-export
 * @example
 * // HTML elements with data-action attributes are automatically handled
 * <button data-action="save-dream">Save Dream</button>
 * <select data-action="switch-theme">...</select>
 * 
 * // Event delegation is set up in main.js
 * document.addEventListener('click', handleUnifiedClick);
 * document.addEventListener('change', handleUnifiedChange);
 */

// ================================
// ES MODULE IMPORTS
// ================================

// Foundation modules
import { CONSTANTS } from './constants.js';
import { calendarState, getAllGoals, setActiveGoalsPage, setCompletedGoalsPage, getActiveGoalsPage, getCompletedGoalsPage } from './state.js';

// Core utilities
import { switchAppTab, switchTheme, switchVoiceTab, toggleDreamForm, toggleSettingsSection, handleTipNavigation, setDateFilter, showExportFormatInfo, closeExportFormatInfo, showEmotionsHelp, showTagsHelp, showDreamSignsHelp, showSmartSearchHelp, closeInfoTooltip } from './dom-helpers.js';

// Autocomplete functions (now in settingstab module)
import {
    addCustomAutocompleteItem,
    deleteAutocompleteItem,
    toggleEncryption,
    changeEncryptionPassword
} from './settingstab.js';

// Security module
import {
    toggleLock, showPinSetup, setupPin, showPinOverlay, hidePinOverlay,
    verifyPin, verifyEncryptionPassword, showRemovePin, showForgotPin,
    confirmRemovePin, executePinRemoval, completePinRemoval, startTitleRecovery,
    verifyDreamTitles, startTimerRecovery, confirmStartTimer, confirmCancelTimer,
    restoreWarningBanner, completeRecovery, completePinSetup, showSetNewPinScreen,
    setupNewPin, confirmNewPin, verifyLockScreenPin, showLockScreenForgotPin,
    startLockScreenTitleRecovery, startLockScreenTimerRecovery, returnToLockScreen,
    verifyLockScreenDreamTitles, confirmLockScreenTimer, cancelResetTimer,
    showChangeEncryptionPasswordDialog, confirmChangeEncryptionPassword, cancelPasswordDialog,
    showForgotEncryptionPassword, wipeAllData, confirmDataWipe
} from './security.js';

// Dream CRUD operations
import {
    saveDream, editDream, deleteDream, confirmDelete,
    saveDreamEdit, cancelDreamEdit, goToPage, debouncedFilter, clearSearchFilters
} from './dream-crud.js';

// Voice notes system
import {
    toggleRecording, playVoiceNote, pauseVoiceNote,
    transcribeVoiceNote, downloadVoiceNote, deleteVoiceNote,
    confirmDeleteVoiceNote, cancelDeleteVoiceNote, seekAudio,
    createDreamFromTranscription, toggleTranscriptionDisplay
} from './voice-notes.js';

// Goals system - import business logic functions
import {
    showCreateGoalDialog, createTemplateGoal, editGoal, completeGoal,
    reactivateGoal, deleteGoal, confirmDeleteGoal, saveGoal, cancelGoalDialog,
    displayGoals
} from './goalstab.js';

// Statistics system - import business logic functions
import { switchStatsTab, renderCalendar } from './statstab.js';

// Import/Export system
import {
    exportEntries, exportAllData, exportRange, confirmExportPassword,
    cancelExportPassword, confirmImportPassword, cancelImportPassword
} from './import-export.js';

// PWA installation
import { installPWA } from './pwa.js';

// Cloud sync functions
import {
    startDropboxAuth,
    disconnectDropbox,
    syncToCloud,
    syncFromCloud
} from './cloud-sync.js';

// Settings tab functions for advanced configuration
import {
    getCurrentDropboxClientId,
    setCustomDropboxClientId
} from './settingstab.js';

// Storage functions needed for goal handlers
import { saveGoals } from './storage.js';

// ================================
// ACTION ROUTER & EVENT DELEGATION MODULE
// ================================
// Centralized event handling system using data-action attributes for unified
// click and change event management across the entire Dream Journal application

// ================================
// ACTION CONTEXT EXTRACTION SYSTEM
// ================================

/**
 * Represents the context extracted from a DOM action element.
 * Contains all data attributes needed for action execution.
 * 
 * @typedef {Object} ActionContext
 * @property {string} action - The action to perform (from data-action attribute)
 * @property {Element} element - The DOM element containing the data-action attribute
 * @property {string} [dreamId] - Dream ID for dream-related actions (from data-dream-id)
 * @property {string} [voiceNoteId] - Voice note ID for audio actions (from data-voice-note-id)
 * @property {string} [goalId] - Goal ID for goal management actions (from data-goal-id)
 * @property {string} [page] - Page number for pagination actions (from data-page)
 * @property {string} [type] - Type parameter for various actions (from data-type)
 * @property {Element} originalTarget - The original clicked/changed element
 * @property {Event} [event] - Original event object (for actions that need it)
 * @since 2.0.0
 */

/**
 * Extracts action context from DOM element with data-action attribute traversal.
 * 
 * Searches up the DOM tree to find elements with data-action attributes and 
 * extracts all relevant data attributes for action handling. This enables flexible
 * HTML structures where child elements can trigger actions on their parents.
 * 
 * The traversal is limited by CONSTANTS.DOM_TRAVERSAL_LEVELS to prevent infinite
 * loops and maintain performance. All data attributes are extracted to provide
 * comprehensive context for action handlers.
 * 
 * @param {Element} target - The clicked or changed DOM element to start traversal from
 * @returns {ActionContext|null} Complete action context object with all data attributes, or null if no action found
 * @throws {TypeError} When target is not a valid DOM element
 * @since 2.0.0
 * @example
 * // Button with direct action
 * <button data-action="save-dream" data-dream-id="123">Save</button>
 * 
 * // Child element triggering parent action
 * <div data-action="edit-dream" data-dream-id="456">
 *   <span>Click me</span> <!-- clicking this will find parent action -->
 * </div>
 * 
 * // Usage in event handler
 * function handleClick(event) {
 *   const context = extractActionContext(event.target);
 *   if (context) {
 *     console.log(context.action); // "save-dream"
 *     console.log(context.dreamId); // "123"
 *   }
 * }
 * 
 * @example
 * // Returns null when no action found
 * const context = extractActionContext(document.body);
 * console.log(context); // null
 */
function extractActionContext(target) {
        let actionElement = target;
        let action = actionElement.dataset.action;
        
        // Traverse up DOM tree to find element with data-action attribute
        // Maximum traversal depth configured in CONSTANTS.DOM_TRAVERSAL_LEVELS
        if (!action) {
            for (let i = 0; i < CONSTANTS.DOM_TRAVERSAL_LEVELS && actionElement.parentElement; i++) {
                actionElement = actionElement.parentElement;
                action = actionElement.dataset.action;
                if (action) {
                    break;
                }
            }
        }
        
        if (!action) {
            return null;
        }
        
        // Extract comprehensive context from data attributes for action handlers
        return {
            action,                    // The action to perform (required)
            element: actionElement,    // The element with data-action attribute
            dreamId: actionElement.dataset.dreamId,           // Dream ID for dream-related actions
            voiceNoteId: actionElement.dataset.voiceNoteId,   // Voice note ID for audio actions
            goalId: actionElement.dataset.goalId,             // Goal ID for goal management actions
            page: actionElement.dataset.page,                 // Page number for pagination actions
            type: actionElement.dataset.type,                 // Type parameter for various actions
            originalTarget: target     // Original clicked element for event details
        };
    }

// ================================
// KEYBOARD NAVIGATION FOR TABS
// ================================

/**
 * Handle keyboard navigation for tab list
 * Implements arrow key navigation as per ARIA APG
 * 
 * @param {KeyboardEvent} event - The keyboard event to handle
 * @returns {void}
 * @since 2.02.53
 */
function handleTabListKeydown(event) {
    const target = event.target;
    
    // Only handle if we're on a tab in the tablist
    if (!target.matches('[role="tab"]') || !target.closest('[role="tablist"]')) {
        return;
    }
    
    const tablist = target.closest('[role="tablist"]');
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]:not([style*="display: none"])'));
    const currentIndex = tabs.indexOf(target);
    
    let newIndex = currentIndex;
    
    switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
            event.preventDefault();
            newIndex = (currentIndex + 1) % tabs.length;
            break;
            
        case 'ArrowLeft':
        case 'ArrowUp':
            event.preventDefault();
            newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            break;
            
        case 'Home':
            event.preventDefault();
            newIndex = 0;
            break;
            
        case 'End':
            event.preventDefault();
            newIndex = tabs.length - 1;
            break;
            
        default:
            return; // Don't handle other keys
    }
    
    if (newIndex !== currentIndex) {
        const newTab = tabs[newIndex];
        newTab.focus();
        newTab.click(); // Trigger the tab switch
    }
}

// ================================
// COMPREHENSIVE ACTION MAPPING SYSTEM
// ================================

/**
 * Action handler function type for ACTION_MAP values.
 * Handles specific user actions with optional context parameter.
 * 
 * @callback ActionHandler
 * @param {ActionContext} [context] - Action context object containing relevant data
 * @returns {void|Promise<void>} May be synchronous or asynchronous
 * @throws {Error} When action execution fails
 * @since 2.0.0
 */

/**
 * Complete mapping of all application actions to their respective handler functions.
 * 
 * This comprehensive registry maps data-action attribute values to their corresponding
 * handler functions. Actions are organized by functional areas for maintainability
 * and easy reference. Each handler receives an ActionContext object containing
 * all relevant data extracted from the DOM element.
 * 
 * The mapping supports both synchronous and asynchronous handlers, with automatic
 * Promise handling in the action router. Handlers can access context data like
 * dream IDs, voice note IDs, page numbers, and other parameters through the context object.
 * 
 * @constant {Object<string, ActionHandler>}
 * @since 2.0.0
 * @example
 * // Adding a new action handler
 * ACTION_MAP['my-action'] = (ctx) => {
 *   console.log('Handling action:', ctx.action);
 *   if (ctx.dreamId) {
 *     handleDreamAction(ctx.dreamId);
 *   }
 * };
 * 
 * // Async handler example
 * ACTION_MAP['async-action'] = async (ctx) => {
 *   const result = await someAsyncOperation();
 *   updateUI(result);
 * };
 */
const ACTION_MAP = {
        // ================================
        // DATA IMPORT/EXPORT OPERATIONS
        // ================================
        'export-dreams': () => exportEntries(),                              // Export dreams to text file with optional encryption
        'import-dreams': () => document.getElementById('importFile').click(), // Trigger dreams import file dialog
        'export-all-data': () => exportAllData(),                           // Export complete application data to JSON
        'import-all-data': () => document.getElementById('importAllDataFile').click(), // Trigger complete data import file dialog
        'export-range': () => exportRange(),                               // Export currently displayed dreams with optional AI formatting
        'show-export-info': () => showExportFormatInfo(),                   // Show export format information tooltip
        'close-export-info': () => closeExportFormatInfo(),                 // Close export format information tooltip
        'show-emotions-help': () => showEmotionsHelp(),                     // Show emotions field help tooltip
        'close-emotions-help': () => closeInfoTooltip('emotions-help-tooltip'), // Close emotions help tooltip
        'show-tags-help': () => showTagsHelp(),                             // Show tags field help tooltip
        'close-tags-help': () => closeInfoTooltip('tags-help-tooltip'),     // Close tags help tooltip
        'show-dream-signs-help': () => showDreamSignsHelp(),                // Show dream signs field help tooltip
        'close-dream-signs-help': () => closeInfoTooltip('dream-signs-help-tooltip'), // Close dream signs help tooltip
        'show-smart-search-help': () => showSmartSearchHelp(),              // Show smart search syntax help tooltip
        'close-smart-search-help': () => closeInfoTooltip('smart-search-help-tooltip'), // Close smart search help tooltip
        'clear-search-filters': () => clearSearchFilters(),                 // Clear all search and filter criteria to defaults

        // ================================
        // APPLICATION INTERFACE MANAGEMENT
        // ================================
        'toggle-lock': () => toggleLock(),                                   // Toggle app lock state, handles PIN setup if needed
        'setup-pin': () => showPinSetup(),                                  // Show PIN setup interface
        'process-pin-setup': () => setupPin(),                              // Process PIN setup form submission
        'install-pwa': () => installPWA(),                                  // Install Progressive Web App
        'switch-voice-tab': (ctx) => switchVoiceTab(ctx.element.dataset.tab), // Switch between voice recording tabs
        'switch-app-tab': (ctx) => switchAppTab(ctx.element.dataset.tab),   // Switch main application tabs
        'switch-theme': (ctx) => switchTheme(ctx.element.value),            // Switch application theme (light/dark)
        'show-pin-overlay': () => showPinOverlay(),                         // Show PIN entry overlay
        'cancel-timer': () => cancelResetTimer(),                           // Cancel active PIN reset timer
        
        // ================================
        // DREAM ENTRY MANAGEMENT
        // ================================
        'save-dream': () => saveDream(),                                     // Save new dream entry from form
        'toggle-dream-form': (ctx) => {
            // Determine if triggered by keyboard (for focus management)
            const isKeyboardEvent = ctx.event && (ctx.event.type === 'keydown');
            toggleDreamForm(isKeyboardEvent);
        },                      // Collapse/expand dream entry form
        'toggle-settings-appearance': () => toggleSettingsSection('appearance'), // Toggle appearance settings section visibility
        'toggle-settings-security': () => toggleSettingsSection('security'),     // Toggle security settings section visibility
        'toggle-settings-data': () => toggleSettingsSection('data'),             // Toggle data management settings section visibility
        'toggle-settings-autocomplete': () => toggleSettingsSection('autocomplete'), // Toggle autocomplete management settings section visibility
        'create-from-transcription': (ctx) => createDreamFromTranscription(ctx.voiceNoteId), // Create dream from voice transcription
        
        // ================================
        // VOICE RECORDING SYSTEM
        // ================================
        'toggle-recording': () => toggleRecording(),                         // Start/stop voice recording
        
        // ================================
        // GOAL MANAGEMENT SYSTEM
        // ================================
        'create-goal': () => showCreateGoalDialog(),                         // Show new goal creation dialog
        'create-template-goal': (ctx) => createTemplateGoal(ctx.element.dataset.template), // Create goal from predefined template
        'edit-goal': (ctx) => editGoal(ctx.goalId),                         // Edit existing goal
        'complete-goal': (ctx) => completeGoal(ctx.goalId),                 // Mark goal as completed
        'reactivate-goal': (ctx) => reactivateGoal(ctx.goalId),             // Reactivate completed goal
        'delete-goal': (ctx) => deleteGoal(ctx.goalId),                     // Delete goal with confirmation
        'confirm-delete-goal': (ctx) => confirmDeleteGoal(ctx.goalId),      // Confirm goal deletion
        'save-goal': () => saveGoal(),                                       // Save goal form data
        'cancel-goal-dialog': () => cancelGoalDialog(),                     // Cancel goal dialog and cleanup
        'increase-goal-progress': (ctx) => increaseGoalProgress(ctx.goalId), // Increment custom goal progress
        'decrease-goal-progress': (ctx) => decreaseGoalProgress(ctx.goalId), // Decrement custom goal progress
        'active-goals-page': (ctx) => changeActiveGoalsPage(parseInt(ctx.page)),     // Navigate active goals pagination
        'completed-goals-page': (ctx) => changeCompletedGoalsPage(parseInt(ctx.page)), // Navigate completed goals pagination
        
        // ================================
        // PASSWORD DIALOG SYSTEM
        // ================================
        'confirm-export-password': () => confirmExportPassword(),            // Confirm export password for encryption
        'cancel-export-password': () => cancelExportPassword(),              // Cancel export password dialog
        'confirm-import-password': () => confirmImportPassword(),            // Confirm import password for decryption
        'cancel-import-password': () => cancelImportPassword(),              // Cancel import password dialog
        
        // ================================
        // VOICE NOTES MANAGEMENT
        // ================================
        'play-voice': (ctx) => playVoiceNote(ctx.voiceNoteId),               // Play voice note with progress tracking
        'pause-voice': (ctx) => pauseVoiceNote(ctx.voiceNoteId),             // Pause voice note playback
        'transcribe-voice': (ctx) => transcribeVoiceNote(ctx.voiceNoteId),   // Process voice note transcription
        'download-voice': (ctx) => downloadVoiceNote(ctx.voiceNoteId),       // Download voice note as audio file
        'delete-voice': (ctx) => deleteVoiceNote(ctx.voiceNoteId),           // Delete voice note with confirmation
        'confirm-delete-voice': (ctx) => confirmDeleteVoiceNote(ctx.voiceNoteId), // Confirm voice note deletion
        'cancel-delete-voice': (ctx) => cancelDeleteVoiceNote(ctx.voiceNoteId),   // Cancel voice note deletion
        'seek-audio': (ctx) => seekAudio(ctx.voiceNoteId, ctx.event),        // Seek to position in audio playback
        'toggle-transcription': (ctx) => toggleTranscriptionDisplay(ctx.voiceNoteId), // Toggle transcription text display (show more/less)
        
        // ================================
        // DREAM ENTRIES CRUD OPERATIONS
        // ================================
        'edit-dream': (ctx) => editDream(ctx.dreamId),                       // Edit dream entry inline
        'delete-dream': (ctx) => deleteDream(ctx.dreamId),                   // Delete dream with confirmation timeout
        'confirm-delete': (ctx) => confirmDelete(ctx.dreamId),               // Confirm dream deletion
        'save-edit': (ctx) => saveDreamEdit(ctx.dreamId),                    // Save dream edit changes
        'cancel-edit': (ctx) => cancelDreamEdit(ctx.dreamId),                // Cancel dream edit and restore view
        
        // ================================
        // PAGINATION & NAVIGATION
        // ================================
        'go-to-page': (ctx) => goToPage(parseInt(ctx.page)),                 // Navigate to specific pagination page

        
        // ================================
        // CALENDAR NAVIGATION SYSTEM
        // ================================
        'prev-month': handlePrevMonth,                                       // Navigate to previous calendar month
        'next-month': handleNextMonth,                                       // Navigate to next calendar month  
        'select-month': handleSelectMonth,                                   // Select specific calendar month
        'select-year': handleSelectYear,                                     // Select specific calendar year
        'go-to-date': (ctx) => {                                             // Navigate to specific date in journal
            // Clear search and lucidity filters for focused date viewing
            const searchBox = document.getElementById('searchBox');
            const filterSelect = document.getElementById('filterSelect');

            if (searchBox) {
                searchBox.value = '';
            }
            if (filterSelect) {
                filterSelect.value = 'all';
            }

            // Use utility function for date filter setup, then trigger filtering if successful
            if (setDateFilter(ctx.element.dataset.date)) {
                debouncedFilter();
            }
        },
        
        // ================================
        // PIN SECURITY & AUTHENTICATION SYSTEM
        // ================================
        'verify-pin': () => verifyPin(),                                     // Verify PIN entry for authentication
        'verify-encryption-password': () => verifyEncryptionPassword(),     // Verify encryption password for authentication
        'switch-to-pin-entry': () => showPinOverlay(),                      // Switch from password to PIN authentication
        'hide-pin-overlay': () => hidePinOverlay(),                         // Hide PIN entry overlay
        // 'confirm-password': () => confirmPassword(),                        // Confirm password entry - FUNCTION REMOVED, using showPasswordDialog instead
        // 'cancel-password': () => cancelPassword(),                          // Cancel password entry - FUNCTION REMOVED, using showPasswordDialog instead
        'show-pin-setup': () => showPinSetup(),                             // Show PIN setup interface
        'show-remove-pin': () => showRemovePin(),                           // Show PIN removal interface
        'show-forgot-pin': () => showForgotPin(),                           // Show PIN recovery options
        'confirm-remove-pin': () => confirmRemovePin(),                     // Confirm PIN removal
        'execute-pin-removal': () => executePinRemoval(),                   // Execute PIN removal process
        'complete-pin-removal': () => completePinRemoval(),                 // Complete PIN removal cleanup
        'start-title-recovery': () => startTitleRecovery(),                 // Start dream title recovery process
        'verify-dream-titles': () => verifyDreamTitles(),                   // Verify dream titles for recovery
        'start-timer-recovery': () => startTimerRecovery(),                 // Start 72-hour timer recovery
        'confirm-start-timer': () => confirmStartTimer(),                   // Confirm timer recovery start
        'confirm-cancel-timer': () => confirmCancelTimer(),                 // Confirm timer cancellation
        'restore-warning-banner': () => restoreWarningBanner(),             // Restore timer warning banner
        'complete-recovery': () => completeRecovery(),                      // Complete recovery process
        'complete-pin-setup': () => completePinSetup(),                     // Complete PIN setup process
        'show-set-new-pin-screen': () => showSetNewPinScreen(),             // Show new PIN entry screen
        'setup-new-pin': () => setupNewPin(),                               // Setup new PIN
        'confirm-new-pin': () => confirmNewPin(),                           // Confirm new PIN entry

        // ================================
        // ENCRYPTION SETTINGS MANAGEMENT
        // ================================
        'toggle-encryption': () => toggleEncryption(),                      // Enable/disable data encryption
        'change-encryption-password': () => changeEncryptionPassword(),     // Change encryption password (Settings tab)

        // ================================
        // CLOUD SYNC MANAGEMENT
        // ================================
        'link-dropbox-account': async () => await startDropboxAuth(),       // Start Dropbox OAuth authentication flow
        'unlink-dropbox-account': async () => await disconnectDropbox(),    // Disconnect from Dropbox and clear tokens
        'sync-to-cloud': async () => await syncToCloud(),                   // Upload current data to cloud storage
        'sync-from-cloud': async () => await syncFromCloud(),               // Download and import data from cloud storage
        'toggle-settings-cloud-sync': () => toggleSettingsSection('cloud-sync'), // Toggle cloud sync settings section
        'edit-dropbox-app-key': () => handleEditDropboxAppKey(),            // Edit Dropbox app key (advanced users)
        'confirm-dropbox-app-key': () => handleConfirmDropboxAppKey(),      // Confirm Dropbox app key changes
        'enable-app-key-editing': () => enableAppKeyEditing(),              // Enable app key editing after confirmation
        'close-app-key-dialog': () => closeAppKeyDialog(),                  // Close app key explanation dialog

        // ================================
        // ENHANCED PASSWORD SCREENS (Phase 5.2)
        // ================================
        'show-change-encryption-password-dialog': () => showChangeEncryptionPasswordDialog(), // Show enhanced password change dialog
        'confirm-change-encryption-password': () => confirmChangeEncryptionPassword(),        // Process password change from dialog
        'cancel-password-dialog': () => cancelPasswordDialog(),                               // Cancel password dialog operation

        // ================================
        // LOCK SCREEN INTERFACE SYSTEM
        // ================================
        'verify-lock-screen-pin': () => verifyLockScreenPin(),               // Verify PIN on lock screen
        'show-lock-screen-forgot-pin': () => showLockScreenForgotPin(),     // Show forgot PIN on lock screen
        'start-lock-screen-title-recovery': () => startLockScreenTitleRecovery(), // Start title recovery on lock screen
        'start-lock-screen-timer-recovery': () => startLockScreenTimerRecovery(), // Start timer recovery on lock screen
        'return-to-lock-screen': () => returnToLockScreen(),                // Return to main lock screen
        'verify-lock-screen-dream-titles': () => verifyLockScreenDreamTitles(), // Verify dream titles on lock screen
        'confirm-lock-screen-timer': () => confirmLockScreenTimer(),        // Confirm timer on lock screen
        'show-forgot-encryption-password': () => showForgotEncryptionPassword(), // Show forgot encryption password options
        'wipe-all-data': () => wipeAllData(),                               // Emergency data wipe for forgotten passwords
        'confirm-data-wipe': () => confirmDataWipe(),                       // Confirm and execute complete data wipe
        
        // ================================
        // AUTOCOMPLETE MANAGEMENT SYSTEM
        // ================================
        'add-custom-tag': () => addCustomAutocompleteItem('tags'),          // Add custom tag to autocomplete
        'add-custom-dream-sign': () => addCustomAutocompleteItem('dreamSigns'), // Add custom dream sign to autocomplete
        'add-custom-emotion': () => addCustomAutocompleteItem('emotions'),  // Add custom emotion to autocomplete
        'delete-autocomplete-item': (ctx) => deleteAutocompleteItem(ctx.element.dataset.itemType, ctx.element.dataset.itemId), // Delete autocomplete item
        // 'restore-default-item': (ctx) => restoreDefaultItem(ctx.element.dataset.itemType, ctx.element.dataset.itemId), // Restore default autocomplete item - FUNCTION MISSING

        // ================================
        // STATISTICS & ANALYTICS INTERFACE
        // ================================
        'switch-stats-tab': handleSwitchStatsTab,                            // Switch statistics tab view

        // ================================
        // ADVICE & TIPS INTERFACE
        // ================================
        'prev-tip': async () => await handleTipNavigation('prev'),             // Navigate to previous tip
        'next-tip': async () => await handleTipNavigation('next')            // Navigate to next tip
    };

// ================================
// CENTRAL ACTION DISPATCHER SYSTEM
// ================================

/**
 * Routes action context to appropriate handler function with comprehensive error handling.
 * 
 * This central dispatcher function takes an action context and routes it to the
 * corresponding handler in ACTION_MAP. It provides robust error handling for both
 * synchronous and asynchronous operations, ensuring that errors don't crash the
 * entire application.
 * 
 * The function handles special cases like the 'seek-audio' action which requires
 * the original event object. It also properly catches and logs errors from both
 * sync and async handlers, providing detailed error information for debugging.
 * 
 * @param {ActionContext} context - Action context object from extractActionContext containing action and data
 * @param {Event|null} [event=null] - Optional event object for actions that need direct event access
 * @returns {void} No return value, but may trigger async operations
 * @throws {Error} Only throws if ACTION_MAP handler throws synchronously (errors are logged, not thrown)
 * @since 2.0.0
 * @example
 * // Basic action routing
 * const context = extractActionContext(clickedElement);
 * if (context) {
 *   routeAction(context);
 * }
 * 
 * @example
 * // Action routing with event object
 * function handleClick(event) {
 *   const context = extractActionContext(event.target);
 *   if (context) {
 *     routeAction(context, event); // Some actions need the event
 *   }
 * }
 * 
 * @example
 * // Error handling is automatic
 * ACTION_MAP['failing-action'] = () => {
 *   throw new Error('This will be caught and logged');
 * };
 * routeAction({ action: 'failing-action' }); // Error logged, app continues
 */
function routeAction(context, event = null) {
        const handler = ACTION_MAP[context.action];
        if (handler) {
            try {
                // Special handling: some actions require the original event object
                if (context.action === 'seek-audio' || context.action === 'toggle-dream-form') {
                    context.event = event;
                }
                
                // Execute handler and handle both synchronous and asynchronous results
                const result = handler(context);
                if (result && typeof result.catch === 'function') {
                    // Handle Promise-based async functions with error catching
                    result.catch(error => {
                        console.error(`Error executing async action '${context.action}':`, error);
                    });
                }
            } catch (error) {
                console.error(`Error executing synchronous action '${context.action}':`, error);
            }
        } else {
            console.error(`No handler found for action: ${context.action}`);
        }
    }

// ================================
// UNIFIED EVENT HANDLING SYSTEM
// ================================

/**
 * Unified click event handler for all interactive elements with data-action attributes.
 * 
 * This function serves as the single click event listener for the entire application,
 * implementing event delegation to handle all data-action clicks. It extracts the
 * action context from the clicked element and routes it to the appropriate handler.
 * 
 * The function specifically excludes SELECT elements from click handling, as these
 * should only respond to change events to avoid conflicts with dropdown behavior.
 * This prevents double-handling of select interactions.
 * 
 * @param {Event} event - The click event object from the browser
 * @returns {void} No return value, but may trigger action execution
 * @since 2.0.0
 * @example
 * // Set up in main.js during initialization
 * document.addEventListener('click', handleUnifiedClick);
 * 
 * @example
 * // HTML structure that triggers this handler
 * <button data-action="save-dream" data-dream-id="123">
 *   <i class="icon"></i> Save Dream <!-- clicking icon also works -->
 * </button>
 * 
 * @example
 * // SELECT elements are ignored (use change events instead)
 * <select data-action="switch-theme">
 *   <option value="light">Light</option>
 *   <option value="dark">Dark</option>
 * </select>
 */
function handleUnifiedClick(event) {
        // Skip click handling for select elements - they should only use change events
        if (event.target.tagName === 'SELECT') {
            return;
        }
        
        const context = extractActionContext(event.target);
        if (context) {
            routeAction(context, event);
        }
    }

/**
 * Unified change event handler for form elements with data-action attributes.
 * 
 * This function handles change events for form controls like select dropdowns,
 * checkboxes, radio buttons, and input fields that have data-action attributes.
 * It extracts the action context from the changed element and routes it to
 * the appropriate handler function.
 * 
 * Unlike the click handler, this function doesn't exclude any element types
 * since all form elements can legitimately trigger change events. This is
 * particularly important for SELECT elements which should only use change
 * events, not click events.
 * 
 * @param {Event} event - The change event object from the browser
 * @returns {void} No return value, but may trigger action execution
 * @since 2.0.0
 * @example
 * // Set up in main.js during initialization
 * document.addEventListener('change', handleUnifiedChange);
 * 
 * @example
 * // HTML elements that trigger this handler
 * <select data-action="switch-theme">
 *   <option value="light">Light Theme</option>
 *   <option value="dark">Dark Theme</option>
 * </select>
 * 
 * <input type="checkbox" data-action="toggle-option" data-option="notifications">
 * 
 * <input type="range" data-action="adjust-volume" data-voice-note-id="456">
 * 
 * @example
 * // Context extraction works the same as click events
 * // Change on select will extract action and element.value
 * function handleThemeChange(context) {
 *   const newTheme = context.element.value; // "light" or "dark"
 *   switchTheme(newTheme);
 * }
 */
function handleUnifiedChange(event) {
        const context = extractActionContext(event.target);
        if (context) {
            routeAction(context, event);
        }
    }

// ================================
// CALENDAR NAVIGATION HANDLERS
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
 * @since 2.02.46
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
 * @since 2.02.46
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
 * @since 2.02.46
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
 * @since 2.02.46
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
 * @since 2.02.46
 */
async function handleSwitchStatsTab(ctx) {
    if (!ctx.element || !ctx.element.dataset.tab) {
        throw new TypeError('handleSwitchStatsTab requires element with data-tab attribute');
    }
    await switchStatsTab(ctx.element.dataset.tab);
}

// ================================
// GOALS PAGINATION HANDLERS
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
 * @since 2.02.47
 * @example
 * // Navigate to page 2 of active goals
 * changeActiveGoalsPage(2);
 */
function changeActiveGoalsPage(page) {
    if (page < 1) return;
    const activeGoals = getAllGoals().filter(goal => goal.status === 'active');
    const totalPages = Math.ceil(activeGoals.length / CONSTANTS.GOALS_PER_PAGE);
    if (page > totalPages) return;
    
    setActiveGoalsPage(page);
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
 * @since 2.02.47
 * @example
 * // Navigate to page 1 of completed goals
 * changeCompletedGoalsPage(1);
 */
function changeCompletedGoalsPage(page) {
    if (page < 1) return;
    const completedGoals = getAllGoals().filter(goal => goal.status === 'completed');
    const totalPages = Math.ceil(completedGoals.length / CONSTANTS.GOALS_PER_PAGE);
    if (page > totalPages) return;
    
    setCompletedGoalsPage(page);
    displayGoals();
}

// ================================
// CUSTOM GOALS PROGRESS HANDLERS
// ================================

/**
 * Increases progress counter for custom goals with target boundary checking.
 * 
 * This function increments the manual progress counter for custom-type goals.
 * It ensures the progress doesn't exceed the target value and automatically
 * displays a completion celebration when the target is reached.
 * 
 * @async
 * @function increaseGoalProgress
 * @param {string} goalId - Unique identifier of the custom goal to update
 * @returns {Promise<void>} Promise that resolves when progress update is complete
 * @throws {Error} When goal saving fails or goal is not of custom type
 * @since 2.02.47
 * @example
 * // Increase progress for a custom goal
 * await increaseGoalProgress('custom-goal-123');
 */
async function increaseGoalProgress(goalId) {
    const goal = getAllGoals().find(g => g.id === goalId);
    if (!goal || goal.type !== 'custom') return;
    
    // Increase progress, but don't exceed target
    const newProgress = Math.min((goal.currentProgress || 0) + 1, goal.target);
    goal.currentProgress = newProgress;
    goal.lastUpdated = new Date().toISOString();
    
    try {
        await saveGoals(getAllGoals());
        await displayGoals();
        
        // Auto-complete the goal if target reached
        if (newProgress >= goal.target && goal.status !== 'completed') {
            const { createInlineMessage } = await import('./dom-helpers.js');
            setTimeout(() => {
                createInlineMessage('success', `Goal "${goal.title}" completed! Great job!`, {
                    container: document.body,
                    position: 'top',
                    duration: 3000
                });
            }, 100);
        }
    } catch (error) {
        console.error('Error updating goal progress:', error);
        const { createInlineMessage } = await import('./dom-helpers.js');
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
 * @since 2.02.47
 * @example
 * // Decrease progress for a custom goal
 * await decreaseGoalProgress('custom-goal-123');
 */
async function decreaseGoalProgress(goalId) {
    const goal = getAllGoals().find(g => g.id === goalId);
    if (!goal || goal.type !== 'custom') return;
    
    // Decrease progress, but don't go below 0
    const newProgress = Math.max((goal.currentProgress || 0) - 1, 0);
    goal.currentProgress = newProgress;
    goal.lastUpdated = new Date().toISOString();
    
    try {
        await saveGoals(getAllGoals());
        await displayGoals();
    } catch (error) {
        console.error('Error updating goal progress:', error);
        const { createInlineMessage } = await import('./dom-helpers.js');
        createInlineMessage('error', 'Failed to update goal progress', {
            container: document.body,
            position: 'top',
            duration: CONSTANTS.MESSAGE_DURATION_SHORT
        });
    }
}

// ================================
// KEYBOARD ACCESSIBILITY HANDLING
// ================================

/**
 * Handle keyboard events for data-action elements.
 * 
 * Provides keyboard accessibility for all interactive elements with data-action attributes.
 * Responds to Enter and Space key presses on elements with role="button" or other interactive roles.
 * 
 * @param {KeyboardEvent} event - The keyboard event object from the browser
 * @returns {void} No return value, but may trigger action execution
 * @since 2.02.63
 * @example
 * // Set up in main.js during initialization
 * document.addEventListener('keydown', handleUnifiedKeydown);
 * 
 * @example
 * // HTML structure that triggers this handler
 * <h3 data-action="toggle-dream-form" role="button" tabindex="0">
 *   Record Your Dream (Press Enter to expand)
 * </h3>
 */
function handleUnifiedKeydown(event) {
    // Only handle Enter (13) and Space (32) keys
    if (event.key !== 'Enter' && event.key !== ' ') {
        return;
    }
    
    // Get the target element with data-action
    const context = extractActionContext(event.target);
    if (!context) {
        return;
    }
    
    // Only trigger on elements with button role or interactive elements
    const target = event.target;
    const hasButtonRole = target.getAttribute('role') === 'button';
    const isButton = target.tagName === 'BUTTON';
    const isInteractive = hasButtonRole || isButton;
    
    if (isInteractive) {
        // Prevent default behavior (e.g., scrolling for Space key)
        event.preventDefault();
        
        // Execute the action
        routeAction(context, event);
    }
}

// ================================
// CLOUD SYNC CONFIGURATION HANDLERS
// ================================

/**
 * Handles the edit action for Dropbox app key configuration.
 *
 * Shows a confirmation dialog explaining what the app key is for,
 * then enables editing mode if the user confirms.
 *
 * @function
 * @returns {void}
 * @since 2.04.01
 */
function handleEditDropboxAppKey() {
    showAppKeyExplanationDialog();
}

/**
 * Shows explanation dialog for Dropbox app key editing.
 *
 * Displays a popup explaining what the app key is and why someone
 * might want to change it, with options to proceed or cancel.
 *
 * @function
 * @returns {void}
 * @since 2.04.01
 * @private
 */
function showAppKeyExplanationDialog() {
    // Create explanation dialog
    const overlay = document.createElement('div');
    overlay.id = 'appKeyExplanationOverlay';
    overlay.className = 'pin-overlay';
    overlay.style.display = 'block';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'appKeyDialogTitle');

    overlay.innerHTML = `
        <div class="pin-container">
            <h2 id="appKeyDialogTitle">🔑 Dropbox App Key Configuration</h2>
            <div style="text-align: left; margin: 20px 0;">
                <p style="margin-bottom: 15px;">
                    The <strong>Dropbox App Key</strong> identifies this application to Dropbox's servers
                    when you connect your account. Most users should <strong>never change this</strong>.
                </p>

                <p style="margin-bottom: 15px;">
                    <strong>You might want to use your own app key if:</strong>
                </p>
                <ul style="margin-left: 20px; margin-bottom: 15px;">
                    <li>You're self-hosting on a different domain</li>
                    <li>You're experiencing rate limiting issues</li>
                    <li>You want complete control over your Dropbox app</li>
                    <li>You're a developer customizing the application</li>
                </ul>

                <p style="margin-bottom: 15px;">
                    <strong style="color: var(--warning-color);">⚠️ Warning:</strong>
                    An invalid app key will prevent cloud sync from working entirely.
                </p>

                <p style="font-size: 12px; opacity: 0.8;">
                    To create your own app key, visit
                    <a href="https://www.dropbox.com/developers/apps" target="_blank" style="color: var(--primary-color);">
                        Dropbox Developers
                    </a> and create a new app.
                </p>
            </div>

            <div class="pin-buttons">
                <button data-action="enable-app-key-editing" class="btn btn-primary">
                    I Understand - Let Me Edit
                </button>
                <button data-action="close-app-key-dialog" class="btn btn-secondary">
                    Cancel
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Add event listeners
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeAppKeyDialog();
        }
    });
}

/**
 * Enables app key editing mode after user confirmation.
 *
 * Makes the input field editable, shows warning message,
 * and changes the edit button to a confirm button.
 *
 * @function
 * @returns {void}
 * @since 2.04.01
 */
function enableAppKeyEditing() {
    const appKeyInput = document.getElementById('dropboxAppKeyInput');
    const editBtn = document.getElementById('editDropboxAppKeyBtn');
    const warning = document.getElementById('appKeyWarning');

    if (appKeyInput) {
        appKeyInput.readOnly = false;
        appKeyInput.focus();
        appKeyInput.select();
    }

    if (editBtn) {
        editBtn.textContent = 'Confirm';
        editBtn.className = 'btn btn-primary btn-small';
        editBtn.setAttribute('data-action', 'confirm-dropbox-app-key');
    }

    if (warning) {
        warning.style.display = 'block';
    }

    closeAppKeyDialog();
}

/**
 * Handles the confirm action for Dropbox app key changes.
 *
 * Validates and saves the new app key, then resets to read-only mode.
 *
 * @function
 * @returns {void}
 * @since 2.04.01
 */
function handleConfirmDropboxAppKey() {
    const appKeyInput = document.getElementById('dropboxAppKeyInput');

    if (appKeyInput) {
        const newKey = appKeyInput.value.trim();

        if (newKey === '') {
            alert('App key cannot be empty. Please enter a valid Dropbox app key.');
            return;
        }

        // Save the new key
        setCustomDropboxClientId(newKey);

        // Reset to read-only mode
        resetAppKeyEditing();

        // Show success message
        const container = document.querySelector('#advancedCloudConfig');
        const successMsg = document.createElement('div');
        successMsg.className = 'message-success border-l-success';
        successMsg.style.marginTop = '10px';
        successMsg.innerHTML = '<strong>✅ Success:</strong> App key updated successfully.';

        container.appendChild(successMsg);

        // Remove success message after 3 seconds
        setTimeout(() => {
            if (successMsg.parentNode) {
                successMsg.parentNode.removeChild(successMsg);
            }
        }, 3000);
    }
}

/**
 * Closes the app key explanation dialog.
 *
 * @function
 * @returns {void}
 * @since 2.04.01
 */
function closeAppKeyDialog() {
    const overlay = document.getElementById('appKeyExplanationOverlay');
    if (overlay) {
        overlay.remove();
    }
}

/**
 * Resets the app key editing state (shared with settingstab.js).
 *
 * @function
 * @returns {void}
 * @since 2.04.01
 * @private
 */
function resetAppKeyEditing() {
    const appKeyInput = document.getElementById('dropboxAppKeyInput');
    const editBtn = document.getElementById('editDropboxAppKeyBtn');
    const warning = document.getElementById('appKeyWarning');

    if (appKeyInput) {
        appKeyInput.readOnly = true;
        appKeyInput.value = getCurrentDropboxClientId();
    }

    if (editBtn) {
        editBtn.textContent = 'Edit';
        editBtn.className = 'btn btn-secondary btn-small';
        editBtn.setAttribute('data-action', 'edit-dropbox-app-key');
    }

    if (warning) {
        warning.style.display = 'none';
    }
}

// ================================
// ES MODULE EXPORTS
// ================================

export {
    // Core action routing functions
    extractActionContext,
    routeAction,
    handleUnifiedClick,
    handleUnifiedChange,
    
    // Keyboard navigation
    handleTabListKeydown,
    handleUnifiedKeydown,
    
    // Action mapping registry
    ACTION_MAP
};