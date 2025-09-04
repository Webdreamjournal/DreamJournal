    // ===================================================================================
    // SECTION 7: INITIALIZATION
    // ===================================================================================

    // Advice tab initialization
    function initializeAdviceTab() {
        // Calculate tip of the day using a fixed epoch
        const epoch = new Date('1900-01-01T00:00:00Z');
        const now = new Date();
        const diffTime = now - epoch;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (dailyTips && dailyTips.length > 0) {
            const tipOfTheDayIndex = diffDays % dailyTips.length;
            displayTip(tipOfTheDayIndex);
        }
    }

    // Theme initialization
    function initializeTheme() {
        const savedTheme = getCurrentTheme();
        applyTheme(savedTheme);
    }

    // Event system initialization
    function setupEventDelegation() {
        // Unified click handler for all containers and document
        document.addEventListener('click', handleUnifiedClick);
        
        // Unified change handler for select elements and other form controls
        document.addEventListener('change', handleUnifiedChange);
        
        // File input change event (not a click action)
        const importFileInput = document.getElementById('importFile');
        if (importFileInput) {
            importFileInput.addEventListener('change', importEntries);
        }
        
        const importAllDataFileInput = document.getElementById('importAllDataFile');
        if (importAllDataFileInput) {
            importAllDataFileInput.addEventListener('change', importAllData);
        }
    }

    // Autocomplete system initialization
    async function initializeAutocomplete() {
        try {
            const [tags, signs] = await Promise.all([
                getAutocompleteSuggestions('tags'),
                getAutocompleteSuggestions('dreamSigns')
            ]);
            setupTagAutocomplete('dreamTags', tags);
            setupTagAutocomplete('dreamSigns', signs);
        } catch (error) {
            console.error("Failed to initialize autocomplete:", error);
            // Fallback to defaults on error
            setupTagAutocomplete('dreamTags', commonTags);
            setupTagAutocomplete('dreamSigns', commonDreamSigns);
        }
    }

    // Browser compatibility check
    function checkBrowserCompatibility() {
        if (!CSS.supports('color', 'hsl(var(--test))')) {
            // Show upgrade notice for very old browsers
            const body = document.body;
            const notice = document.createElement('div');
            notice.className = 'message-error';
            notice.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 9999;
            `;
            notice.innerHTML = '⚠️ Your browser is outdated and may not display themes correctly. Please update to a modern browser.';
            body.insertBefore(notice, body.firstChild);
        }
    }

    // Main application initialization
    document.addEventListener('DOMContentLoaded', async function() {
        // =============================================================
        // PART 1: IMMEDIATE ACTIONS (Fast setup to prevent content flashing)
        // =============================================================
        
        // Perform fast, synchronous checks first
        checkBrowserCompatibility();
        initializeTheme();
        
        // Immediately check PIN and timer status to decide the initial view
        const resetTime = getResetTime();
        let timerExpiredAndRemovedPin = false;
        if (resetTime && (resetTime - Date.now() <= 0)) {
            removeResetTime();
            removePinHash();
            isUnlocked = true;
            isAppLocked = false;
            failedPinAttempts = 0;
            timerExpiredAndRemovedPin = true;
        }
        const pinIsSetUp = isPinSetup();

        // Prepare the correct initial screen (lock or journal)
        if (pinIsSetUp && !timerExpiredAndRemovedPin) {
            // PIN EXISTS: Start locked.
            isUnlocked = false;
            isAppLocked = true;
            preLockActiveTab = 'journal';
            // This will create and display the lock screen content.
            switchAppTab('lock'); 
            hideAllTabButtons();
        } else {
            // NO PIN: Start unlocked on the journal tab.
            isUnlocked = true;
            isAppLocked = false;
            switchAppTab('journal');
            showAllTabButtons();
        }

        // Now that the correct content is ready to be displayed, make the container visible.
        document.querySelector('.container').style.visibility = 'visible';
        
        // =================================================================
        // PART 2: SLOWER SETUP TASKS (The rest of your code now runs)
        // =================================================================

        // Setup event delegation system
        setupEventDelegation();
        
        // Initialize Database (slower)
        await initDB();
        
        // Initialize Goals (slower)
        await initGoals();
        
        // CRITICAL FIX: Ensure tab container exists before any tab switching
        let tabContainer = document.querySelector('.tab-content-container');
        if (!tabContainer) {
            console.log('Creating tab container on initialization');
            const containerDiv = document.querySelector('.container');
            const appTabs = document.querySelector('.app-tabs');
            if (containerDiv && appTabs) {
                tabContainer = document.createElement('div');
                tabContainer.className = 'tab-content-container';
                tabContainer.style.cssText = `
                    background: var(--bg-primary);
                    min-height: 400px;
                    overflow-x: hidden;
                `;
                appTabs.parentNode.insertBefore(tabContainer, appTabs.nextSibling);
                console.log('Tab container created successfully');
            } else {
                console.error('Could not find container or app-tabs elements');
            }
        }
        
        // Perform migration only if IndexedDB is empty (first-time setup)
        if (isIndexedDBAvailable() && isLocalStorageAvailable()) {
            const existingDreamCount = await getIndexedDBCount();
            if (existingDreamCount === 0) {
                await migrateFromLocalStorage();
            }
        }
        
        // Set current date/time as default for new dreams
        const dreamDateInput = document.getElementById('dreamDate');
        if (dreamDateInput) {
            const now = new Date();
            
            // Get local date components and pad with leading zeros if needed
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');

            // Assemble the string in the correct format for datetime-local
            const localDatetimeString = `${year}-${month}-${day}T${hours}:${minutes}`;
            
            dreamDateInput.value = localDatetimeString;
        }
        
        // Update timer warning if active
        updateTimerWarning();
        const timerWarningInterval = setInterval(updateTimerWarning, 60000);
        
        // Setup security controls
        updateSecurityControls();
        
        // Cleanup timers on page unload to prevent memory leaks
        window.addEventListener('beforeunload', function() {
            try {
                Object.keys(deleteTimeouts).forEach(dreamId => clearTimeout(deleteTimeouts[dreamId]));
                Object.keys(voiceDeleteTimeouts).forEach(voiceNoteId => clearTimeout(voiceDeleteTimeouts[voiceNoteId]));
                if (timerWarningInterval) clearInterval(timerWarningInterval);
                if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
                if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
                if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
                if (recordingTimer) clearInterval(recordingTimer);
                if (currentPlayingAudio) currentPlayingAudio.pause();
                if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
                removeEndlessScroll();
            } catch (error) {
                console.log('Cleanup error during page unload:', error);
            }
        });
        
        // Setup event listeners for non-click interactions
        const searchBox = document.getElementById('searchBox');
        const filterSelect = document.getElementById('filterSelect');
        const sortSelect = document.getElementById('sortSelect');
        const limitSelect = document.getElementById('limitSelect');
        const dreamContent = document.getElementById('dreamContent');
        const pinInput = document.getElementById('pinInput');
        
        if (searchBox) searchBox.addEventListener('input', () => debouncedSearch(CONSTANTS.DEBOUNCE_SEARCH_MS));
        if (filterSelect) filterSelect.addEventListener('change', () => debouncedFilter(CONSTANTS.DEBOUNCE_FILTER_MS));
        if (sortSelect) sortSelect.addEventListener('change', () => debouncedFilter(CONSTANTS.DEBOUNCE_FILTER_MS));
        if (limitSelect) limitSelect.addEventListener('change', () => debouncedFilter(CONSTANTS.DEBOUNCE_FILTER_MS));

        const startDateInput = document.getElementById('startDateFilter');
        const endDateInput = document.getElementById('endDateFilter');
        if (startDateInput) startDateInput.addEventListener('change', () => debouncedFilter(CONSTANTS.DEBOUNCE_FILTER_MS));
        if (endDateInput) endDateInput.addEventListener('change', () => debouncedFilter(CONSTANTS.DEBOUNCE_FILTER_MS));
        
        initializeAutocomplete();
        
        if (dreamContent) dreamContent.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') saveDream(); });
        if (pinInput) pinInput.addEventListener('keypress', e => { if (e.key === 'Enter') document.getElementById('pinMainBtn')?.click(); });
        
        document.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                const lockScreenPinInput = document.getElementById('lockScreenPinInput');
                if (lockScreenPinInput && document.activeElement === lockScreenPinInput) {
                    verifyLockScreenPin();
                }
            }
        });
        
        // Display initial data
        try {
            await displayDreams();
            await updateRecordButtonState();
            await displayVoiceNotes();
            updateSecurityControls();
            
            setTimeout(() => updateRecordButtonState(), 100);

            if (timerExpiredAndRemovedPin) {
                // Show a message if the timer just expired on this page load
                const container = document.querySelector('.main-content');
                if (container) {
                    createInlineMessage('info', 'PIN reset timer has expired. Your PIN has been removed. You can set a new one if desired.', {
                        container: container, position: 'top', duration: 8000
                    });
                }
            }
        } catch (error) {
            console.error('Error displaying dreams on page load:', error);
            const container = document.getElementById('entriesContainer');
            if (container) {
                container.innerHTML = `<div class="no-entries"><h3>⚠️ Error Loading Dreams</h3><p>There was a problem loading your dreams. Please refresh the page.</p><button onclick="location.reload()" class="btn btn-primary" style="margin-top: 15px;">🔄 Refresh Page</button></div>`;
            }
        }
        
        // Check voice recording support
        const voiceCapabilities = getVoiceCapabilities();
        // ... (Your voice capabilities check code remains here) ...
        // ...
        
        // Restore dream form collapse state
        try {
            if (localStorage.getItem(DREAM_FORM_COLLAPSE_KEY) === 'true') {
                isDreamFormCollapsed = false; // will be toggled to true below
                toggleDreamForm();
            }
        } catch (e) {}
    });