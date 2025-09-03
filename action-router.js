    // ===================================================================================
    // SECTION 6: EVENT HANDLERS & ACTION ROUTING
    // ===================================================================================

    // Extract action context from clicked element
    function extractActionContext(target) {
        let actionElement = target;
        let action = actionElement.dataset.action;
        
        // Find element with data-action (traverse up to 3 levels)
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
        
        // Extract all possible data attributes
        return {
            action,
            element: actionElement,
            dreamId: actionElement.dataset.dreamId,
            voiceNoteId: actionElement.dataset.voiceNoteId,
            goalId: actionElement.dataset.goalId,
            page: actionElement.dataset.page,
            type: actionElement.dataset.type,
            originalTarget: target
        };
    }
    
    // Comprehensive action map - maps all current actions to their handlers
    const ACTION_MAP = {
        // Main container actions
        'export-dreams': () => exportEntries(),
        'import-dreams': () => document.getElementById('importFile').click(),
        'export-all-data': () => exportAllData(),
        'import-all-data': () => document.getElementById('importAllDataFile').click(),
        'export-ai': () => exportForAIAnalysis(),
        'toggle-lock': () => toggleLock(), // Always visible, handles PIN setup if needed
        'setup-pin': () => showPinSetup(),
        'process-pin-setup': () => setupPin(),
        'save-dream': () => saveDream(),
        'toggle-recording': () => toggleRecording(),
        'toggle-dream-form': () => toggleDreamForm(),
        'switch-voice-tab': (ctx) => switchVoiceTab(ctx.element.dataset.tab),
        'switch-app-tab': (ctx) => switchAppTab(ctx.element.dataset.tab),
        'switch-theme': (ctx) => switchTheme(ctx.element.value),
        'show-pin-overlay': () => showPinOverlay(),
        'create-from-transcription': (ctx) => createDreamFromTranscription(ctx.voiceNoteId),
        'cancel-timer': () => cancelResetTimer(),
        
        // Goal management actions
        'create-goal': () => showCreateGoalDialog(),
        'create-template-goal': (ctx) => createTemplateGoal(ctx.element.dataset.template),
        'edit-goal': (ctx) => editGoal(ctx.goalId),
        'complete-goal': (ctx) => completeGoal(ctx.goalId),
        'reactivate-goal': (ctx) => reactivateGoal(ctx.goalId),
        'delete-goal': (ctx) => deleteGoal(ctx.goalId),
        'confirm-delete-goal': (ctx) => confirmDeleteGoal(ctx.goalId),
        'save-goal': () => saveGoal(),
        'cancel-goal-dialog': () => cancelGoalDialog(),
        'increase-goal-progress': (ctx) => increaseGoalProgress(ctx.goalId),
        'decrease-goal-progress': (ctx) => decreaseGoalProgress(ctx.goalId),
        'active-goals-page': (ctx) => changeActiveGoalsPage(parseInt(ctx.page)),
        'completed-goals-page': (ctx) => changeCompletedGoalsPage(parseInt(ctx.page)),
        
        // Password dialog actions (CRITICAL BUG FIX #1)
        'confirm-export-password': () => confirmExportPassword(),
        'cancel-export-password': () => cancelExportPassword(),
        'confirm-import-password': () => confirmImportPassword(),
        'cancel-import-password': () => cancelImportPassword(),
        
        // Voice container actions
        'play-voice': (ctx) => playVoiceNote(ctx.voiceNoteId),
        'pause-voice': (ctx) => pauseVoiceNote(ctx.voiceNoteId),
        'transcribe-voice': (ctx) => transcribeVoiceNote(ctx.voiceNoteId),
        'download-voice': (ctx) => downloadVoiceNote(ctx.voiceNoteId),
        'delete-voice': (ctx) => deleteVoiceNote(ctx.voiceNoteId),
        'confirm-delete-voice': (ctx) => confirmDeleteVoiceNote(ctx.voiceNoteId),
        'seek-audio': (ctx) => seekAudio(ctx.voiceNoteId, ctx.event),
        
        // Entries container actions
        'edit-dream': (ctx) => editDream(ctx.dreamId),
        'delete-dream': (ctx) => deleteDream(ctx.dreamId),
        'confirm-delete': (ctx) => confirmDelete(ctx.dreamId),
        'save-edit': (ctx) => saveDreamEdit(ctx.dreamId),
        'cancel-edit': (ctx) => cancelDreamEdit(ctx.dreamId),
        
        // Pagination actions
        'go-to-page': (ctx) => goToPage(parseInt(ctx.page)),

        // Calendar actions
        'prev-month': () => {
            calendarState.date.setMonth(calendarState.date.getMonth() - 1);
            renderCalendar(calendarState.date.getFullYear(), calendarState.date.getMonth());
        },
        'next-month': () => {
            calendarState.date.setMonth(calendarState.date.getMonth() + 1);
            renderCalendar(calendarState.date.getFullYear(), calendarState.date.getMonth());
        },
        'select-month': (ctx) => {
            const newMonth = parseInt(ctx.element.value);
            renderCalendar(calendarState.date.getFullYear(), newMonth);
        },
        'select-year': (ctx) => {
            const newYear = parseInt(ctx.element.value);
            renderCalendar(newYear, calendarState.date.getMonth());
        },
        'go-to-date': (ctx) => {
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
        
        // Document-level actions (PIN overlay, password dialogs, etc.)
        'verify-pin': () => verifyPin(),
        'hide-pin-overlay': () => hidePinOverlay(),
        'confirm-password': () => confirmPassword(),
        'cancel-password': () => cancelPassword(),
        'show-pin-setup': () => showPinSetup(),
        'show-remove-pin': () => showRemovePin(),
        'show-forgot-pin': () => showForgotPin(),
        'confirm-remove-pin': () => confirmRemovePin(),
        'execute-pin-removal': () => executePinRemoval(),
        'complete-pin-removal': () => completePinRemoval(),
        'start-title-recovery': () => startTitleRecovery(),
        'verify-dream-titles': () => verifyDreamTitles(),
        'start-timer-recovery': () => startTimerRecovery(),
        'confirm-start-timer': () => confirmStartTimer(),
        'confirm-cancel-timer': () => confirmCancelTimer(),
        'restore-warning-banner': () => restoreWarningBanner(),
        'complete-recovery': () => completeRecovery(),
        'complete-pin-setup': () => completePinSetup(),
        'show-set-new-pin-screen': () => showSetNewPinScreen(),
        'setup-new-pin': () => setupNewPin(),
        'confirm-new-pin': () => confirmNewPin(),
        
        // Lock screen actions
        'verify-lock-screen-pin': () => verifyLockScreenPin(),
        'show-lock-screen-forgot-pin': () => showLockScreenForgotPin(),
        'start-lock-screen-title-recovery': () => startLockScreenTitleRecovery(),
        'start-lock-screen-timer-recovery': () => startLockScreenTimerRecovery(),
        'return-to-lock-screen': () => returnToLockScreen(),
        'verify-lock-screen-dream-titles': () => verifyLockScreenDreamTitles(),
        'confirm-lock-screen-timer': () => confirmLockScreenTimer(),
        
        // Autocomplete management actions
        'add-custom-tag': () => addCustomAutocompleteItem('tags'),
        'add-custom-dream-sign': () => addCustomAutocompleteItem('dreamSigns'),
        'delete-autocomplete-item': (ctx) => deleteAutocompleteItem(ctx.element.dataset.itemType, ctx.element.dataset.itemId),
        'restore-default-item': (ctx) => restoreDefaultItem(ctx.element.dataset.itemType, ctx.element.dataset.itemId),

        // Stats tab actions
        'switch-stats-tab': (ctx) => switchStatsTab(ctx.element.dataset.tab),

        // Advice tab actions
        'prev-tip': () => handleTipNavigation('prev'),
        'next-tip': () => handleTipNavigation('next')
    };
    
    // Central action dispatcher
    function routeAction(context, event = null) {
        const handler = ACTION_MAP[context.action];
        if (handler) {
            try {
                // Special case: seek-audio needs the event object
                if (context.action === 'seek-audio') {
                    context.event = event;
                }
                
                // Handle both sync and async functions
                const result = handler(context);
                if (result && typeof result.catch === 'function') {
                    // This is a Promise, handle errors
                    result.catch(error => {
                        console.error(`Error executing async action '${context.action}':`, error);
                    });
                }
            } catch (error) {
                console.error(`Error executing action '${context.action}':`, error);
            }
        } else {
            console.error(`No handler found for action: ${context.action}`);
        }
    }
    
    // Unified click handler for all containers
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
    
    // Handle change events for form elements with data-action
    function handleUnifiedChange(event) {
        const context = extractActionContext(event.target);
        if (context) {
            routeAction(context, event);
        }
    }