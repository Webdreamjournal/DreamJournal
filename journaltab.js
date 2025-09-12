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
 * @version 2.02.06
 */

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
                <h3 data-action="toggle-dream-form" style="cursor: pointer; user-select: none;">
                    🌙 Record Your Dream 
                    <span class="text-xs text-secondary font-normal">(Click to collapse)</span>
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
                    <label for="dreamEmotions">Emotions Experienced (optional)</label>
                    <input type="text" id="dreamEmotions" class="form-control" placeholder="e.g., happy, anxious, excited, confused (separate with commas)">
                    <small class="small-helper">
                        Common emotions: happy, sad, anxious, excited, confused, peaceful, scared, angry, joyful, curious
                    </small>
                </div>
                
                <!-- Tags Field - Thematic categorization with autocomplete support -->
                <div class="form-group">
                    <label for="dreamTags">Tags & Themes (optional)</label>
                    <div class="tag-input-group">
                        <input type="text" id="dreamTags" class="form-control" placeholder="e.g., family, flying, school, animals (separate with commas)">
                    </div>
                    <small class="small-helper">
                        Tag your dream with themes, people, places, objects, or activities for easy searching
                    </small>
                </div>
                
                <!-- Dream Signs Field - Lucidity trigger tracking with autocomplete -->
                <div class="form-group">
                    <label for="dreamSigns">⚡ Dream Signs (Lucidity Triggers) (optional)</label>
                    <div class="tag-input-group">
                        <input type="text" id="dreamSigns" class="form-control" placeholder="e.g., flying, text-changing, deceased-alive (separate with commas)">
                    </div>
                    <small class="small-helper-warning">
                        Elements that could trigger lucidity - track these to improve dream awareness!
                    </small>
                </div>
                
                <!-- Save Button - Submits dream form via data-action event delegation -->
                <button data-action="save-dream" class="btn btn-primary">Save Dream</button>
            </div>
            
            <!-- ================================ -->
            <!-- DREAM ENTRY FORM (COLLAPSED)    -->
            <!-- ================================ -->
            <div class="entry-form" id="dreamFormCollapsed" style="display: none;">
                <!-- Collapsed form header with expand functionality -->
                <h3 data-action="toggle-dream-form" style="cursor: pointer; user-select: none;">
                    📝 Record Your Dream 
                    <span class="text-xs text-secondary font-normal">(Click to expand)</span>
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
                    
                    <!-- Recording Tab Panel - Live voice recording interface -->
                    <div id="voiceTabRecord" class="voice-tab-panel active">
                        <div class="voice-controls">
                            <!-- Recording Control Button - Toggles between start/stop -->
                            <button id="recordBtn" data-action="toggle-recording" class="record-btn ready">
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
                <h3>Your Dreams</h3>
                
                <!-- Dreams Management Controls -->
                <div class="dreams-controls">
                    <!-- Security Lock Button - PIN setup and app locking -->
                    <button data-action="toggle-lock" id="lockBtn" class="btn btn-lock" title="Set up a PIN to secure your dreams, then lock the journal">🔒 Setup & Lock</button>
                    
                    <!-- AI Analysis Export Button - Exports dreams formatted for AI analysis -->
                    <button data-action="export-ai" class="btn btn-success" title="Export a prompt for analysis by an AI model">🤖 Export for AI Analysis</button>
                </div>
            </div>
            
            <!-- ================================ -->
            <!-- SEARCH & FILTER CONTROLS         -->
            <!-- ================================ -->
            <div class="controls">
                
                <!-- Primary Search and Filter Controls -->
                <div class="search-filter-group">
                    <!-- Search Box - Full-text search across all dream fields -->
                    <input type="text" id="searchBox" class="search-box" placeholder="Search dreams by title, content, emotions, tags, or dream signs...">
                    
                    <!-- Lucidity Filter Dropdown - Filter by dream lucidity status -->
                    <select id="filterSelect" class="filter-select">
                        <option value="all">All Dreams</option>
                        <option value="lucid">Lucid Dreams</option>
                        <option value="non-lucid">Non-Lucid Dreams</option>
                    </select>
                    
                    <!-- Sort Order Dropdown - Controls dream display order -->
                    <select id="sortSelect" class="filter-select">
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="lucid-first">Lucid First</option>
                        <option value="longest">Longest First</option>
                    </select>
                    
                    <!-- Display Limit Dropdown - Controls pagination and endless scroll -->
                    <select id="limitSelect" class="filter-select">
                        <option value="5">Show 5</option>
                        <option value="10">Show 10</option>
                        <option value="20">Show 20</option>
                        <option value="50">Show 50</option>
                        <option value="endless" selected>Endless</option>
                        <option value="all">Show All</option>
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
                
                <!-- Visual Break Between Filter Controls and Dream List -->
                <div class="control-row-break"></div>
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