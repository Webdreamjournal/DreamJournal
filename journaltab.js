/**
 * @fileoverview Journal Tab Module - HTML Rendering and Initialization
 * 
 * This module provides the Journal tab rendering function to generate the complete
 * HTML structure including dream entry forms, voice recording interface, search
 * and filter controls, and dreams display container.
 * 
 * The Journal tab contains the core application interface for dream entry, recording,
 * and management. By consolidating the HTML generation into this module, the Journal
 * tab content becomes easy to find and modify, following the same pattern as other tabs.
 * 
 * @author Dream Journal Development Team
 * @since 2.02.06
 * @version 2.04.00
 */

// Import state management function and constants for form state synchronization
import { setIsDreamFormCollapsed, getIsJournalControlsCollapsed, setIsJournalControlsCollapsed } from './state.js';
import { DREAM_FORM_COLLAPSE_KEY, JOURNAL_CONTROLS_COLLAPSE_KEY } from './constants.js';
import { getCurrentPaginationPreference } from './dom-helpers.js';

/**
 * Generates the pagination limit dropdown options with the correct selection.
 *
 * This helper function creates the HTML for pagination limit dropdown options,
 * applying the 'selected' attribute to the user's saved preference. This ensures
 * the dropdown reflects the user's previously selected pagination setting.
 *
 * @function
 * @returns {string} HTML string with option elements for pagination limits
 * @since 2.04.01
 * @example
 * const dropdownOptions = generatePaginationDropdownOptions();
 * // Returns HTML with correct option selected based on user preference
 */
function generatePaginationDropdownOptions() {
    const currentPreference = getCurrentPaginationPreference();
    const options = [
        { value: '5', label: 'Show 5' },
        { value: '10', label: 'Show 10' },
        { value: '20', label: 'Show 20' },
        { value: '50', label: 'Show 50' },
        { value: 'endless', label: 'Endless' },
        { value: 'all', label: 'Show All' }
    ];

    return options.map(option => {
        const selected = option.value === currentPreference ? ' selected' : '';
        return `<option value="${option.value}"${selected}>${option.label}</option>`;
    }).join('');
}

/**
 * Render the complete Journal tab HTML structure.
 * 
 * This function generates the entire Journal tab interface including the dream
 * entry form (both expanded and collapsed states), voice recording controls,
 * search and filter interface, and dreams display container.
 * 
 * The Journal tab is the most complex tab in the application, containing:
 * - Collapsible dream entry form with all input fields
 * - Voice recording system with transcription capabilities  
 * - Comprehensive search and filter controls
 * - Dreams list container with pagination support
 * 
 * @param {HTMLElement} tabPanel - The tab panel DOM element to render content into
 * @throws {Error} When tabPanel is invalid or missing
 * @returns {void}
 * @since 2.02.06
 * 
 * @example
 * // Render Journal tab content
 * const tabPanel = document.getElementById('journalTab');
 * renderJournalTab(tabPanel);
 * 
 * @example
 * // Called from dom-helpers.js during tab creation
 * if (tabId === 'journalTab') {
 *     renderJournalTab(tabPanel);
 * }
 */
function renderJournalTab(tabPanel) {
    if (!tabPanel || !tabPanel.appendChild) {
        throw new Error('renderJournalTab requires a valid DOM element');
    }
    
    tabPanel.innerHTML = `
        <div class="main-content">
            
            <!-- ================================ -->
            <!-- DREAM ENTRY FORM (EXPANDED)     -->
            <!-- ================================ -->
            <div class="entry-form" id="dreamFormFull">
                <!-- Collapsible form header with toggle functionality -->
                <h3 id="journal-main-heading"
                    tabindex="0"
                    data-action="toggle-dream-form"
                    role="button"
                    aria-expanded="true"
                    aria-label="Record Your Dream form - currently expanded. Press Enter or Space to collapse"
                    style="cursor: pointer; user-select: none;">
                    📝 Record Your Dream
                    <span class="collapse-indicator" title="Click to collapse"></span>
                    <span class="collapse-hint text-xxs text-secondary font-normal">(Click to collapse)</span>
                </h3>
                
                <!-- Dream Date & Time Input - Pre-populated with current datetime by main.js -->
                <div class="form-group">
                    <label for="dreamDate">Dream Date & Time</label>
                    <input type="datetime-local" id="dreamDate" class="form-control">
                </div>
                
                <!-- Lucidity Status Checkbox - Marks dream as lucid for statistics -->
                <div class="lucid-checkbox">
                    <input type="checkbox" id="isLucid">
                    <label for="isLucid">This was a lucid dream ✨</label>
                </div>
                
                <!-- Dream Title Field - Optional custom title (used for PIN recovery) -->
                <div class="form-group">
                    <label for="dreamTitle">Dream Title (optional)</label>
                    <input type="text" id="dreamTitle" class="form-control" placeholder="Give your dream a memorable title...">
                </div>
                
                <!-- Dream Description Field - Main content (required field) -->
                <div class="form-group">
                    <label for="dreamContent">Dream Description</label>
                    <textarea id="dreamContent" class="form-control" placeholder="Describe your dream in as much detail as you can remember..." required></textarea>
                </div>
                
                <!-- Emotions Field - Comma-separated emotional states with autocomplete -->
                <div class="form-group">
                    <div class="form-label-with-info">
                        <label for="dreamEmotions">Emotions Experienced (optional)</label>
                        <button class="info-icon"
                                data-action="show-emotions-help"
                                type="button"
                                title="Click for common emotions examples"
                                aria-label="Show emotions help">
                            ℹ️
                        </button>
                    </div>
                    <input type="text"
                           id="dreamEmotions"
                           class="form-control"
                           placeholder="e.g., happy, anxious, excited, confused (separate with commas)">
                </div>
                
                <!-- Tags Field - Thematic categorization with autocomplete support -->
                <div class="form-group">
                    <div class="form-label-with-info">
                        <label for="dreamTags">Tags & Themes (optional)</label>
                        <button class="info-icon"
                                data-action="show-tags-help"
                                type="button"
                                title="Click for tagging guidance"
                                aria-label="Show tags help">
                            ℹ️
                        </button>
                    </div>
                    <div class="tag-input-group">
                        <input type="text"
                               id="dreamTags"
                               class="form-control"
                               placeholder="e.g., family, flying, school, animals (separate with commas)">
                    </div>
                </div>
                
                <!-- Dream Signs Field - Lucidity trigger tracking with autocomplete -->
                <div class="form-group">
                    <div class="form-label-with-info">
                        <label for="dreamSigns">⚡ Dream Signs (Lucidity Triggers) (optional)</label>
                        <button class="info-icon"
                                data-action="show-dream-signs-help"
                                type="button"
                                title="Click for dream signs explanation"
                                aria-label="Show dream signs help">
                            ℹ️
                        </button>
                    </div>
                    <div class="tag-input-group">
                        <input type="text"
                               id="dreamSigns"
                               class="form-control"
                               placeholder="e.g., flying, text-changing, deceased-alive (separate with commas)">
                    </div>
                </div>
                
                <!-- Save Button - Submits dream form via data-action event delegation -->
                <button data-action="save-dream" class="btn btn-primary" aria-keyshortcuts="Control+Enter">Save Dream</button>
            </div>
            
            <!-- ================================ -->
            <!-- DREAM ENTRY FORM (COLLAPSED)    -->
            <!-- ================================ -->
            <div class="entry-form" id="dreamFormCollapsed">
                <!-- Collapsed form header with expand functionality -->
                <h3 data-action="toggle-dream-form"
                    role="button"
                    tabindex="0"
                    aria-expanded="false"
                    aria-label="Record Your Dream form - currently collapsed. Press Enter or Space to expand"
                    style="cursor: pointer; user-select: none;">
                    📝 Record Your Dream
                    <span class="collapse-indicator" title="Click to expand"></span>
                    <span class="collapse-hint text-xxs text-secondary font-normal">(Click to expand)</span>
                </h3>
            </div>
            
            <!-- ================================ -->
            <!-- VOICE RECORDING SYSTEM           -->
            <!-- ================================ -->
            <div class="voice-tabs-container">
                <!-- Voice Tab Navigation -->
                <div class="voice-tabs">
                    <!-- Recording Tab - Live voice recording with transcription -->
                    <button class="voice-tab active" data-action="switch-voice-tab" data-tab="record">
                        🎤 Record
                    </button>
                    
                    <!-- Stored Notes Tab - Previously recorded voice notes -->
                    <button class="voice-tab" data-action="switch-voice-tab" data-tab="stored">
                        🎵 Stored Notes
                    </button>
                </div>
                
                <!-- Voice Tab Content Panels -->
                <div class="voice-tab-content">
                    <!-- ARIA: Live region for voice recording status announcements -->
                    <div id="voice-status-announcer" class="visually-hidden" aria-live="assertive"></div>
                    
                    <!-- Recording Tab Panel - Live voice recording interface -->
                    <div id="voiceTabRecord" class="voice-tab-panel active">
                        <div class="voice-controls">
                            <!-- Recording Control Button - Toggles between start/stop -->
                            <button id="recordBtn" 
                                    data-action="toggle-recording" 
                                    class="record-btn ready"
                                    aria-describedby="voice-status-announcer">
                                <span id="recordIcon">🎤</span>
                                <span id="recordText">Start Recording</span>
                            </button>
                            
                            <!-- Recording Timer Display - Shows during active recording -->
                            <div id="recordingTimer" class="recording-timer" style="display: none;">0:00</div>
                            
                            <!-- Voice Status Messages - Browser compatibility and recording status -->
                            <div id="voiceStatus" class="voice-status info">Checking browser capabilities for voice features...</div>
                        </div>
                    </div>
                    
                    <!-- Stored Notes Tab Panel - Previously recorded voice notes list -->
                    <div id="voiceTabStored" class="voice-tab-panel" style="display: none;">
                        <!-- Container for dynamically loaded voice notes -->
                        <div id="voiceNotesContainer"></div>
                    </div>
                </div>
            </div>
            
            <!-- ================================ -->
            <!-- DREAMS SECTION HEADER            -->
            <!-- ================================ -->
            <div class="dreams-section-header">
                <h3>📚 Your Dreams</h3>
            </div>

            <!-- ================================ -->
            <!-- SEARCH & FILTER CONTROLS         -->
            <!-- ================================ -->
            <div class="settings-section" data-journal-section="controls">
                <h3 data-action="toggle-journal-controls"
                    role="button"
                    tabindex="0"
                    aria-expanded="true"
                    aria-label="Search & Filter Controls section - currently expanded. Press Enter or Space to collapse"
                    style="cursor: pointer; user-select: none;">
                    🔍 Search & Filter Controls
                    <span class="collapse-indicator" title="Click to collapse"></span>
                    <span class="collapse-hint text-xxs text-secondary font-normal">(Click to collapse)</span>
                </h3>
                <div class="settings-section-content">
                    <div class="controls" role="search" aria-label="Search and filter dreams">

                <!-- Search and Filter Controls Group -->
                <div class="search-filter-section">
                    <div class="section-header-with-action">
                        <h4 class="section-header">🔍 Search & Filter
                            <button class="info-icon search-info-btn"
                                    data-action="show-smart-search-help"
                                    type="button"
                                    title="Click for smart search syntax help"
                                    aria-label="Show smart search help">
                                ℹ️
                            </button></h4>
                        <button data-action="clear-search-filters" class="btn btn-secondary btn-small" title="Clear all search and filter criteria">🗑️ Clear</button>
                    </div>
                    <div class="search-filter-group">
                        <!-- Smart Search Box with Info Button -->
                        <div class="search-input-group">
                            <input type="text"
                                   id="searchBox"
                                   class="search-box"
                                   placeholder="Smart search: title:flying tag:lucid or just search text..."
                                   aria-label="Smart search with field-specific queries or general text search"
                                   role="searchbox">

                        </div>

                        <!-- Lucidity Filter Dropdown - Filter by dream lucidity status -->
                        <select id="filterSelect" class="filter-select">
                            <option value="all">All Dreams</option>
                            <option value="lucid">Lucid Dreams</option>
                            <option value="non-lucid">Non-Lucid Dreams</option>
                        </select>
                    </div>

                    <!-- Date Range Filter Controls -->
                    <div class="date-filter-group" style="display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 8px; align-items: center;">
                        <!-- Start Date Filter -->
                        <label for="startDateFilter" class="form-label-inline text-primary" style="font-size: 13px;">From:</label>
                        <input type="date" id="startDateFilter" class="filter-select" style="padding: 8px; font-size: 14px;">

                        <!-- End Date Filter -->
                        <label for="endDateFilter" class="form-label-inline text-primary" style="font-size: 13px;">To:</label>
                        <input type="date" id="endDateFilter" class="filter-select" style="padding: 8px; font-size: 14px;">
                    </div>
                </div>

                <!-- Display and Sorting Controls Group -->
                <div class="display-sort-section">
                    <h4 class="section-header">📊 Display & Sort</h4>
                    <div class="display-sort-group">
                        <!-- Sort Order Dropdown - Controls dream display order -->
                        <select id="sortSelect" class="filter-select">
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="lucid-first">Lucid First</option>
                            <option value="longest">Longest First</option>
                        </select>

                        <!-- Display Limit Dropdown - Controls pagination and endless scroll -->
                        <select id="limitSelect" class="filter-select">
                            ${generatePaginationDropdownOptions()}
                        </select>
                    </div>
                </div>

                <!-- Dreams Management Controls -->
                <div class="dreams-controls">
                    <!-- Export Range Controls - Export currently displayed dreams with optional AI formatting -->
                    <div class="export-range-container">
                        <button data-action="export-range"
                                class="btn btn-success"
                                title="Export currently displayed dreams as text file">
                            Export Range
                        </button>
                        <div class="export-format-option">
                            <input type="checkbox"
                                   id="exportFormatAI"
                                   class="export-format-checkbox">
                            <label for="exportFormatAI" class="export-format-label">
                                Preformatted for AI Analysis
                            </label>
                            <button class="info-icon"
                                    data-action="show-export-info"
                                    type="button"
                                    title="Click for more information about export formats"
                                    aria-label="Show export format information">
                                ℹ️
                            </button>
                        </div>
                    </div>
                </div>

                        <!-- Visual Break Between Controls and Dream List -->
                        <div class="control-row-break"></div>
                    </div>
                </div>
            </div>
            
            <!-- ================================ -->
            <!-- DREAMS DISPLAY SECTION           -->
            <!-- ================================ -->
            <div class="entries-section">
                <!-- Dreams List Container - Dynamically populated by dream-crud.js -->
                <div id="entriesContainer"></div>
                
                <!-- Pagination Controls Container - Shows page navigation when needed -->
                <div id="paginationContainer"></div>
            </div>
        </div>
    `;
    
    // CRITICAL: Apply saved states immediately after rendering
    // This prevents timing race condition where user sees both forms hidden
    applyDreamFormStateAfterRender();
    applyJournalControlsStateAfterRender();
}

/**
 * Apply saved dream form state immediately after HTML rendering.
 * 
 * This function restores the user's saved form collapse preference immediately
 * after the HTML is created, preventing the timing race condition where both
 * forms are hidden by CSS until the main state restoration runs later.
 * 
 * @private
 * @returns {void}
 * @since 2.02.58
 */
function applyDreamFormStateAfterRender() {
    try {
        const fullForm = document.getElementById('dreamFormFull');
        const collapsedForm = document.getElementById('dreamFormCollapsed');
        
        // Safety check - ensure both form elements exist
        if (!fullForm || !collapsedForm) {
            return;
        }
        
        // Get saved state from localStorage using the global constant
        const savedState = localStorage.getItem(DREAM_FORM_COLLAPSE_KEY);
        
        if (savedState === 'true') {
            // User previously collapsed the form - show collapsed version
            fullForm.style.display = 'none';
            collapsedForm.style.display = 'block';
            
            // Update ARIA states for collapsed form
            const collapsedHeader = collapsedForm.querySelector('[data-action="toggle-dream-form"]');
            const expandedHeader = fullForm.querySelector('[data-action="toggle-dream-form"]');
            if (collapsedHeader) {
                collapsedHeader.setAttribute('aria-expanded', 'false');
            }
            if (expandedHeader) {
                expandedHeader.setAttribute('aria-expanded', 'false');
            }
            
            // Update global state to match
            setIsDreamFormCollapsed(true);
        } else {
            // Default expanded state OR no saved preference - show full form
            fullForm.style.display = 'block';
            collapsedForm.style.display = 'none';
            
            // Update ARIA states for expanded form
            const expandedHeader = fullForm.querySelector('[data-action="toggle-dream-form"]');
            const collapsedHeader = collapsedForm.querySelector('[data-action="toggle-dream-form"]');
            if (expandedHeader) {
                expandedHeader.setAttribute('aria-expanded', 'true');
            }
            if (collapsedHeader) {
                collapsedHeader.setAttribute('aria-expanded', 'true');
            }
            
            // Update global state to match
            setIsDreamFormCollapsed(false);
        }
    } catch (e) {
        // Fallback to expanded state if localStorage access fails
        try {
            const fullForm = document.getElementById('dreamFormFull');
            const collapsedForm = document.getElementById('dreamFormCollapsed');
            if (fullForm && collapsedForm) {
                fullForm.style.display = 'block';
                collapsedForm.style.display = 'none';
                
                // Update ARIA states for fallback expanded form
                const expandedHeader = fullForm.querySelector('[data-action="toggle-dream-form"]');
                const collapsedHeader = collapsedForm.querySelector('[data-action="toggle-dream-form"]');
                if (expandedHeader) {
                    expandedHeader.setAttribute('aria-expanded', 'true');
                }
                if (collapsedHeader) {
                    collapsedHeader.setAttribute('aria-expanded', 'true');
                }
            }
        } catch (fallbackError) {
            // Silent fallback failure
        }
        // Update global state for fallback
        setIsDreamFormCollapsed(false);
    }
}

/**
 * Apply saved journal controls state immediately after HTML rendering.
 *
 * This function restores the user's saved controls collapse preference immediately
 * after the HTML is created, preventing visual flicker and maintaining user
 * preferences across browser sessions.
 *
 * @private
 * @returns {void}
 * @since 2.04.01
 */
function applyJournalControlsStateAfterRender() {
    try {
        // Get DOM elements for the controls section
        const sectionElement = document.querySelector('[data-journal-section="controls"]');
        if (!sectionElement) {
            console.warn('Journal controls section element not found');
            return;
        }

        const toggleHeader = sectionElement.querySelector('[data-action="toggle-journal-controls"]');
        const contentArea = sectionElement.querySelector('.settings-section-content');
        const collapseIndicator = toggleHeader?.querySelector('.collapse-indicator');
        const hintText = toggleHeader?.querySelector('.collapse-hint');

        if (!toggleHeader || !contentArea) {
            console.warn('Required elements not found for journal controls section');
            return;
        }

        // Get saved state from localStorage
        let savedState;
        try {
            savedState = localStorage.getItem(JOURNAL_CONTROLS_COLLAPSE_KEY);
        } catch (e) {
            console.warn('Failed to read localStorage for journal controls:', e);
            savedState = null;
        }

        if (savedState === 'true') {
            // Apply collapsed state
            contentArea.style.display = 'none';
            setIsJournalControlsCollapsed(true);

            // Update ARIA attributes
            toggleHeader.setAttribute('aria-expanded', 'false');
            toggleHeader.setAttribute('aria-label', 'Search & Filter Controls section - currently collapsed. Press Enter or Space to expand');

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
            setIsJournalControlsCollapsed(false);

            // Update ARIA attributes
            toggleHeader.setAttribute('aria-expanded', 'true');
            toggleHeader.setAttribute('aria-label', 'Search & Filter Controls section - currently expanded. Press Enter or Space to collapse');

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
        console.error('Error restoring journal controls state:', error);
        // Fallback to expanded state
        const sectionElement = document.querySelector('[data-journal-section="controls"]');
        if (sectionElement) {
            const contentArea = sectionElement.querySelector('.settings-section-content');
            if (contentArea) {
                contentArea.style.display = 'block';
            }
        }
        setIsJournalControlsCollapsed(false);
    }
}

/**
 * Initialize Journal tab functionality after HTML is rendered.
 * 
 * This function performs any Journal-specific initialization that needs to happen
 * after the HTML structure has been created. Currently this is minimal since most
 * initialization happens in main.js during app startup.
 * 
 * Future Journal-specific initialization can be added here, such as:
 * - Setting up Journal tab specific event listeners
 * - Initializing Journal tab specific state
 * - Performing Journal tab specific DOM modifications
 * 
 * @returns {Promise<void>}
 * @since 2.02.06
 * 
 * @example
 * // Initialize Journal tab after rendering
 * renderJournalTab(tabPanel);
 * await initializeJournalTab();
 */
async function initializeJournalTab() {
    try {
        console.log('Journal tab initialization completed successfully');
        // Future Journal-specific initialization can be added here
    } catch (error) {
        console.error('Error during Journal tab initialization:', error);
        // Don't throw - allow app to continue with partial functionality
    }
}

// Export Journal tab functions
export {
    renderJournalTab,
    initializeJournalTab
};