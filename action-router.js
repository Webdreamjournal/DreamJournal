// ================================
// ACTION ROUTER & EVENT DELEGATION MODULE
// ================================
// Centralized event handling system using data-action attributes for unified
// click and change event management across the entire Dream Journal application

// ================================
// ACTION CONTEXT EXTRACTION SYSTEM
// ================================

/**
 * Extract action context from DOM element with data-action attribute traversal
 * Searches up the DOM tree to find elements with data-action attributes and 
 * extracts all relevant data attributes for action handling
 * @param {Element} target - The clicked/changed DOM element
 * @returns {Object|null} Action context object or null if no action found
 * 
 * TODO: Consider splitting into findActionElement() and extractContextData() functions
 * for better separation of DOM traversal and data extraction logic
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
// COMPREHENSIVE ACTION MAPPING SYSTEM
// ================================

/**
 * Complete mapping of all application actions to their respective handler functions
 * Organized by functional areas for maintainability and easy reference
 * Each action corresponds to a data-action attribute value in the HTML
 */
const ACTION_MAP = {
        // ================================
        // DATA IMPORT/EXPORT OPERATIONS
        // ================================
        'export-dreams': () => exportEntries(),                              // Export dreams to text file with optional encryption
        'import-dreams': () => document.getElementById('importFile').click(), // Trigger dreams import file dialog
        'export-all-data': () => exportAllData(),                           // Export complete application data to JSON
        'import-all-data': () => document.getElementById('importAllDataFile').click(), // Trigger complete data import file dialog
        'export-ai': () => exportForAIAnalysis(),                           // Export dreams formatted for AI analysis
        
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
        'toggle-dream-form': () => toggleDreamForm(),                       // Collapse/expand dream entry form
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
        'prev-month': () => {                                                // Navigate to previous calendar month
            calendarState.date.setMonth(calendarState.date.getMonth() - 1);
            renderCalendar(calendarState.date.getFullYear(), calendarState.date.getMonth());
        },
        'next-month': () => {                                                // Navigate to next calendar month
            calendarState.date.setMonth(calendarState.date.getMonth() + 1);
            renderCalendar(calendarState.date.getFullYear(), calendarState.date.getMonth());
        },
        'select-month': (ctx) => {                                           // Select specific calendar month
            const newMonth = parseInt(ctx.element.value);
            renderCalendar(calendarState.date.getFullYear(), newMonth);
        },
        'select-year': (ctx) => {                                            // Select specific calendar year
            const newYear = parseInt(ctx.element.value);
            renderCalendar(newYear, calendarState.date.getMonth());
        },
        'go-to-date': (ctx) => {                                             // Navigate to specific date in journal
            // TODO: Extract date filter logic to setDateFilter() utility function
            // This combines date validation, DOM manipulation, and app navigation
            const date = ctx.element.dataset.date;
            if(date) {
                const startDateInput = document.getElementById('startDateFilter');
                const endDateInput = document.getElementById('endDateFilter');
                if(startDateInput && endDateInput) {
                    startDateInput.value = date;
                    endDateInput.value = date;
                    switchAppTab('journal');
                    debouncedFilter();
                }
            }
        },
        
        // ================================
        // PIN SECURITY & AUTHENTICATION SYSTEM
        // ================================
        'verify-pin': () => verifyPin(),                                     // Verify PIN entry for authentication
        'hide-pin-overlay': () => hidePinOverlay(),                         // Hide PIN entry overlay
        'confirm-password': () => confirmPassword(),                        // Confirm password entry
        'cancel-password': () => cancelPassword(),                          // Cancel password entry
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
        // LOCK SCREEN INTERFACE SYSTEM
        // ================================
        'verify-lock-screen-pin': () => verifyLockScreenPin(),               // Verify PIN on lock screen
        'show-lock-screen-forgot-pin': () => showLockScreenForgotPin(),     // Show forgot PIN on lock screen
        'start-lock-screen-title-recovery': () => startLockScreenTitleRecovery(), // Start title recovery on lock screen
        'start-lock-screen-timer-recovery': () => startLockScreenTimerRecovery(), // Start timer recovery on lock screen
        'return-to-lock-screen': () => returnToLockScreen(),                // Return to main lock screen
        'verify-lock-screen-dream-titles': () => verifyLockScreenDreamTitles(), // Verify dream titles on lock screen
        'confirm-lock-screen-timer': () => confirmLockScreenTimer(),        // Confirm timer on lock screen
        
        // ================================
        // AUTOCOMPLETE MANAGEMENT SYSTEM
        // ================================
        'add-custom-tag': () => addCustomAutocompleteItem('tags'),          // Add custom tag to autocomplete
        'add-custom-dream-sign': () => addCustomAutocompleteItem('dreamSigns'), // Add custom dream sign to autocomplete
        'delete-autocomplete-item': (ctx) => deleteAutocompleteItem(ctx.element.dataset.itemType, ctx.element.dataset.itemId), // Delete autocomplete item
        'restore-default-item': (ctx) => restoreDefaultItem(ctx.element.dataset.itemType, ctx.element.dataset.itemId), // Restore default autocomplete item

        // ================================
        // STATISTICS & ANALYTICS INTERFACE
        // ================================
        'switch-stats-tab': (ctx) => switchStatsTab(ctx.element.dataset.tab), // Switch statistics tab view

        // ================================
        // ADVICE & TIPS INTERFACE
        // ================================
        'prev-tip': () => handleTipNavigation('prev'),                      // Navigate to previous tip
        'next-tip': () => handleTipNavigation('next')                       // Navigate to next tip
    };

// ================================
// CENTRAL ACTION DISPATCHER SYSTEM
// ================================

/**
 * Route action context to appropriate handler function with comprehensive error handling
 * Handles both synchronous and asynchronous action handlers with proper error catching
 * @param {Object} context - Action context object from extractActionContext
 * @param {Event|null} event - Optional event object for actions that need it
 * 
 * TODO: Consider splitting into validateAction() and executeAction() functions
 * for better separation of validation logic and execution handling
 */
function routeAction(context, event = null) {
        const handler = ACTION_MAP[context.action];
        if (handler) {
            try {
                // Special handling: some actions require the original event object
                if (context.action === 'seek-audio') {
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
 * Unified click event handler for all interactive elements with data-action attributes
 * Prevents handling select elements (which should use change events only)
 * Routes valid actions through the central dispatcher
 * @param {Event} event - Click event object
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
 * Unified change event handler for form elements with data-action attributes
 * Handles dropdown selections, checkbox changes, and other form interactions
 * Routes valid actions through the central dispatcher
 * @param {Event} event - Change event object
 */
function handleUnifiedChange(event) {
        const context = extractActionContext(event.target);
        if (context) {
            routeAction(context, event);
        }
    }