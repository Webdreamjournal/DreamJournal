/**
 * @fileoverview Dream CRUD Operations Module - Complete dream management system.
 * 
 * This module provides comprehensive dream management functionality including creation,
 * editing, deletion, display, filtering, sorting, pagination, and search capabilities.
 * It handles both IndexedDB fast path operations and fallback storage methods for
 * optimal performance and reliability.
 * 
 * @module DreamCRUD
 * @version 2.04.00
 * @since 1.0.0
 * @requires constants
 * @requires state
 * @requires storage
 * @requires dom-helpers
 * @requires security
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { CONSTANTS } from './constants.js';
import { 
    dreams, 
    getCurrentPage,
    setCurrentPage,
    withMutex, 
    endlessScrollState,
    getScrollDebounceTimer,
    setScrollDebounceTimer,
    getSearchDebounceTimer,
    setSearchDebounceTimer,
    getFilterDebounceTimer,
    setFilterDebounceTimer,
    deleteTimeouts
} from './state.js';
import { 
    loadDreams, 
    saveDreams, 
    addDreamToIndexedDB, 
    updateDreamInIndexedDB, 
    deleteDreamFromIndexedDB, 
    learnAutocompleteItems,
    generateUniqueId,
    isIndexedDBAvailable
} from './storage.js';
import { announceLiveMessage, createInlineMessage, showSearchLoading, hideSearchLoading, escapeHtml, escapeAttr, createActionButton, initializeAutocomplete, formatDisplayDate, formatDateTimeDisplay } from './dom-helpers.js';
import { ErrorMessenger } from './error-messenger.js';

/**
 * Filter values extracted from UI controls for dream processing.
 * 
 * @typedef {Object} FilterValues
 * @property {string} searchTerm - Lowercase search term for text matching
 * @property {string} filterType - Filter type: 'all', 'lucid', or 'non-lucid'
 * @property {string} sortType - Sort order: 'newest', 'oldest', 'lucid-first', or 'longest'
 * @property {string} limitValue - Display limit: numeric string, 'endless', or 'all'
 * @property {string} startDate - Start date for date range filter (ISO format)
 * @property {string} endDate - End date for date range filter (ISO format)
 */

/**
 * Pagination calculation result containing paginated dreams and metadata.
 * 
 * @typedef {Object} PaginationResult
 * @property {Object[]} paginatedDreams - Array of dream objects for current page/view
 * @property {number} totalPages - Total number of pages available
 * @property {number} totalDreams - Total number of dreams in filtered set
 * @property {number} itemsPerPage - Number of items displayed per page
 */

// ================================
// DREAM CRUD OPERATIONS MODULE
// ================================
// Complete dream management system including creation, editing, deletion,
// display, filtering, sorting, pagination, and search functionality

// ================================
// ENCRYPTION HELPER FUNCTIONS
// ================================

/**
 * Determines if dream data should be encrypted based on current encryption settings.
 *
 * This helper function checks the global encryption state to determine whether
 * new dreams should be saved in encrypted format. It verifies both that encryption
 * is enabled and that a valid encryption password is available in the current session.
 *
 * **Decision Logic:**
 * 1. Returns false if encryption is disabled globally
 * 2. Returns false if encryption is enabled but no password is available
 * 3. Returns true only if both encryption is enabled AND password is available
 *
 * @async
 * @function
 * @returns {Promise<boolean>} True if dreams should be encrypted, false otherwise
 * @since 2.03.01
 * @example
 * // Check if dream should be encrypted before saving
 * if (await shouldEncryptDream()) {
 *   const encrypted = await encryptItemForStorage(dreamData, password);
 *   await saveItemToStore('dreams', encrypted);
 * } else {
 *   await saveItemToStore('dreams', dreamData);
 * }
 *
 * @example
 * // Use in save operations to conditionally encrypt
 * const encrypt = await shouldEncryptDream();
 * console.log(`Dreams will be ${encrypt ? 'encrypted' : 'unencrypted'}`);
 */
async function shouldEncryptDream() {
    try {
        // Import encryption state dynamically to avoid circular dependencies
        const { getEncryptionEnabled, getEncryptionPassword } = await import('./state.js');

        // Check if encryption is enabled globally
        if (!getEncryptionEnabled()) {
            return false;
        }

        // Check if encryption password is available in session
        const password = getEncryptionPassword();
        if (!password) {
            return false;
        }

        return true;
    } catch (error) {
        // If there's any error importing or checking encryption state, default to false
        console.error('Error checking encryption settings for dreams:', error);
        return false;
    }
}

// ================================
// 1. CORE DREAM CRUD OPERATIONS
// ================================

/**
 * Saves a new dream entry to storage with comprehensive validation and error handling.
 * 
 * This function collects dream data from the form UI, validates the content,
 * processes tags and dream signs for autocomplete learning, and saves the dream
 * using either IndexedDB fast path or fallback storage methods. It also handles
 * form clearing, pagination reset, and UI feedback.
 * 
 * @async
 * @function saveDream
 * @returns {Promise<void>} Resolves when dream is saved and UI is updated
 * @throws {Error} When form elements are not found or storage operations fail
 * @since 1.0.0
 * @example
 * // Called when user clicks save button on dream form
 * await saveDream();
 * 
 * @example
 * // Form validation will show error if content is empty
 * // and prevent saving until user enters content
 */
       async function saveDream() {
        const titleElement = document.getElementById('dreamTitle');
        const contentElement = document.getElementById('dreamContent');
        const dreamDateElement = document.getElementById('dreamDate');
        const isLucidElement = document.getElementById('isLucid');
        const emotionsElement = document.getElementById('dreamEmotions');
        const tagsElement = document.getElementById('dreamTags');
        const dreamSignsElement = document.getElementById('dreamSigns');
        
        if (!contentElement?.value.trim()) {
            contentElement.style.borderColor = 'var(--error-color)';
            await ErrorMessenger.showError('DREAM_VALIDATION_EMPTY', {}, {
                forceContext: 'journal',
                duration: 5000
            });

            const errorMsg = document.createElement('div');
            errorMsg.className = 'message-error text-sm mt-sm';
            errorMsg.textContent = 'See error message above for requirements.';
            contentElement.parentElement.appendChild(errorMsg);
            
            setTimeout(() => {
                contentElement.style.borderColor = 'var(--border-color)';
                errorMsg.remove();
            }, 3000);
            return;
        }

        const tags = parseTagsFromInput(tagsElement.value);
        const dreamSigns = parseTagsFromInput(dreamSignsElement.value);
        const emotions = parseTagsFromInput(emotionsElement.value);

        await learnAutocompleteItems(tags, 'tags');
        await learnAutocompleteItems(dreamSigns, 'dreamSigns');
        await learnAutocompleteItems(emotions, 'emotions');

        const dreamDate = dreamDateElement.value ? new Date(dreamDateElement.value) : new Date();
        const dreamTitle = titleElement.value.trim() || 'Untitled Dream';
        const dreamTimestamp = dreamDate.toISOString();
        
        const newDream = {
            id: generateUniqueId({
                title: dreamTitle,
                timestamp: dreamTimestamp,
                type: 'dream'
            }),
            title: dreamTitle,
            content: contentElement.value.trim(),
            emotions: emotionsElement.value.trim(),
            tags: tags,
            dreamSigns: dreamSigns,
            timestamp: dreamTimestamp,
            isLucid: isLucidElement.checked,
            dateString: formatDateTimeDisplay(dreamDate)
        };
        
        // Handle encryption if enabled
        if (await shouldEncryptDream()) {
            try {
                // Import encryption functions and get password
                const { getEncryptionPassword } = await import('./state.js');
                const { encryptItemForStorage, saveItemToStore } = await import('./storage.js');

                const password = getEncryptionPassword();
                if (!password) {
                    throw new Error('Encryption enabled but password not available in session');
                }

                // Encrypt the dream for storage
                const encryptedDream = await encryptItemForStorage(newDream, password);

                // Save encrypted dream to storage
                await saveItemToStore('dreams', encryptedDream);

                // Update memory state with unencrypted data
                dreams.unshift(newDream);

            } catch (error) {
                console.error('Error encrypting and saving dream:', error);
                await ErrorMessenger.showError('DREAM_ENCRYPTION_FAILED', {
                    error: error.message || 'Encryption system error'
                }, {
                    forceContext: 'journal',
                    duration: 8000
                });
                return;
            }
        } else {
            // No encryption - use existing save logic

            // Try fast path first
            let saveSuccess = false;
            if (isIndexedDBAvailable()) {
                saveSuccess = await addDreamToIndexedDB(newDream);
            }

            // Fallback if the fast method fails
            if (!saveSuccess) {
                const currentDreams = await loadDreams();
                currentDreams.unshift(newDream);
                await saveDreams(currentDreams);
            }

            // Update memory state with unencrypted data
            dreams.unshift(newDream);
        }
        
        // Clear form fields and reset pagination using helper functions
        clearDreamForm(titleElement, contentElement, dreamDateElement, isLucidElement, emotionsElement, tagsElement, dreamSignsElement);
        resetPaginationToFirst();
        
        await ErrorMessenger.showSuccess('DREAM_SAVED', {
            dreamTitle: title || 'Untitled Dream'
        }, {
            forceContext: 'journal',
            duration: 3000
        });
        
        await displayDreams();
        await initializeAutocomplete();
    }

// ================================
// 2. DREAM DISPLAY SYSTEM
// ================================

/**
 * Main entry point for displaying dreams with mutex protection to prevent race conditions.
 * 
 * This function serves as a thread-safe wrapper around the internal display implementation,
 * ensuring that only one display operation can run at a time to prevent UI corruption
 * and data inconsistencies during concurrent operations.
 * 
 * @async
 * @function displayDreams
 * @returns {Promise<void>} Resolves when dreams are displayed and UI is updated
 * @throws {Error} When mutex operations fail or display rendering encounters errors
 * @since 1.0.0
 * @example
 * // Refresh dream display after adding new dream
 * await displayDreams();
 * 
 * @example
 * // Safe to call multiple times - mutex prevents concurrent execution
 * displayDreams(); // First call
 * displayDreams(); // Queued until first completes
 */
    async function displayDreams() {
        return withMutex('displayDreams', displayDreamsInternal);
    }
    
    /**
     * Internal implementation of dream display with comprehensive filtering and pagination.
     * 
     * This function handles the complete dream display pipeline including loading dreams,
     * applying search filters, sorting results, calculating pagination, rendering HTML,
     * and updating pagination controls. It's protected by mutex to prevent concurrent
     * execution issues and includes performance optimizations for large datasets.
     * 
     * @async
     * @function displayDreamsInternal
     * @private
     * @returns {Promise<void>} Resolves when display pipeline is complete
     * @throws {Error} When dream loading, filtering, or rendering fails
     * @since 1.0.0
     * @example
     * // Called internally by displayDreams() with mutex protection
     * await withMutex('displayDreams', displayDreamsInternal);
     */
    async function displayDreamsInternal() {
        try {
            // Security note: PIN protection handled by lock screen tab system
            // This function assumes user has valid access to the journal tab
            
            // Get filter values
            const { searchTerm, filterType, sortType, limitValue, startDate, endDate } = getFilterValues();
            const dreams = await loadDreams();
            const container = document.getElementById('entriesContainer');
            
            if (!container) return;
            
            // Show loading for large datasets
            if (Array.isArray(dreams) && dreams.length > CONSTANTS.LARGE_DATASET_THRESHOLD) {
                showLoadingMessage(container, dreams.length);
                await new Promise(resolve => setTimeout(resolve, 0)); // Give UI a chance to update
            }
            
            // Show search processing for large datasets
            if (dreams.length > 100) {
                await ErrorMessenger.showInfo('SEARCH_PROCESSING', {
                    totalDreams: dreams.length
                }, {
                    forceContext: 'journal',
                    duration: 1000
                });
            }

            // Filter and sort dreams
            let filteredDreams = filterDreams(dreams, searchTerm, filterType, startDate, endDate);
            filteredDreams = sortDreams(filteredDreams, sortType);
            
            // Handle no results
            if (filteredDreams.length === 0) {
                await showNoResultsMessage(container, filterType, searchTerm);
                clearPagination();

                // Announce no results for screen readers
                const { searchTerm: currentSearchTerm, filterType: currentFilterType } = getFilterValues();
                if (currentSearchTerm || currentFilterType !== 'all') {
                    const filterText = currentFilterType !== 'all' ? ` ${currentFilterType}` : '';
                    announceLiveMessage('search', `No${filterText} dreams found matching your search.`);
                } else {
                    announceLiveMessage('search', 'No dreams recorded yet.');
                }
                return;
            }
            
            // Calculate pagination
            const { paginatedDreams, totalPages, totalDreams } = calculatePagination(filteredDreams, limitValue);
            
            // Render dreams
            container.innerHTML = paginatedDreams.map(renderDreamHTML).filter(html => html).join('');

            // Show search results summary
            if (searchTerm || filterType !== 'all') {
                const hasFilters = searchTerm || filterType !== 'all';
                await ErrorMessenger.showSuccess('SEARCH_RESULTS_SUMMARY', {
                    resultsCount: totalDreams,
                    hasFilters
                }, {
                    forceContext: 'journal',
                    duration: 3000
                });

                // Announce search results for screen readers
                const filterText = filterType !== 'all' ? ` ${filterType}` : '';
                announceLiveMessage('search', `Found ${totalDreams}${filterText} dreams matching your search.`);
            } else {
                announceLiveMessage('search', `Displaying ${totalDreams} dreams.`);
            }

            // Render pagination
            renderPaginationHTML(limitValue, totalPages, totalDreams, paginatedDreams);
            
        } finally {
            hideSearchLoading();
        }
    }

// ================================
// 3. DREAM FILTERING & SORTING SYSTEM
// ================================
    
    /**
     * Applies search terms and filter criteria to filter the dream collection.
     * 
     * This function performs comprehensive filtering including text search across
     * multiple dream fields (title, content, emotions, tags, dream signs), lucidity
     * filtering, and date range filtering. It handles invalid data gracefully and
     * provides detailed error logging for debugging.
     * 
     * @function filterDreams
     * @param {Object[]} dreams - Array of dream objects to filter
     * @param {string} searchTerm - Lowercase search term to match against dream fields
     * @param {string} filterType - Filter type: 'all', 'lucid', or 'non-lucid'
     * @param {string} startDate - Start date for date range filter (ISO format)
     * @param {string} endDate - End date for date range filter (ISO format)
     * @returns {Object[]} Filtered array of dream objects matching all criteria
     * @since 1.0.0
     * @example
     * const filtered = filterDreams(dreams, 'flying', 'lucid', '2024-01-01', '2024-12-31');
     * 
     * @example
     * // Search all dreams for 'nightmare' keyword
     * const nightmares = filterDreams(dreams, 'nightmare', 'all', '', '');
     */
    function filterDreams(dreams, searchTerm, filterType, startDate, endDate) {
        if (!Array.isArray(dreams)) return [];

        const start = startDate ? new Date(startDate) : null;
        if(start) start.setHours(0,0,0,0); // Start of the day
        const end = endDate ? new Date(endDate) : null;
        if(end) end.setHours(23,59,59,999); // End of the day
        
        return dreams.filter(dream => {
            if (!dream || typeof dream !== 'object' || !dream.timestamp) return false;
            
            try {
                const title = (dream.title || '').toString().toLowerCase();
                const content = (dream.content || '').toString().toLowerCase();
                const emotions = (dream.emotions || '').toString().toLowerCase();
                const tags = Array.isArray(dream.tags) ? dream.tags.join(' ').toLowerCase() : '';
                const dreamSigns = Array.isArray(dream.dreamSigns) ? dream.dreamSigns.join(' ').toLowerCase() : '';
                
                const matchesSearch = !searchTerm || 
                    title.includes(searchTerm) ||
                    content.includes(searchTerm) ||
                    emotions.includes(searchTerm) ||
                    tags.includes(searchTerm) ||
                    dreamSigns.includes(searchTerm);
                
                const matchesFilter = filterType === 'all' || 
                    (filterType === 'lucid' && Boolean(dream.isLucid)) ||
                    (filterType === 'non-lucid' && !Boolean(dream.isLucid));

                const dreamDate = new Date(dream.timestamp);
                if(isNaN(dreamDate.getTime())) return false; // Invalid dream date

                let matchesDate = true;
                if (start && end) {
                    matchesDate = dreamDate >= start && dreamDate <= end;
                } else if (start) {
                    matchesDate = dreamDate >= start;
                } else if (end) {
                    matchesDate = dreamDate <= end;
                }
                
                return matchesSearch && matchesFilter && matchesDate;
            } catch (error) {
                console.error('Error filtering dream:', error, dream);
                return false;
            }
        });
    }
    
    /**
     * Applies the selected sort order to the filtered dream collection.
     * 
     * This function supports multiple sorting strategies including chronological
     * (newest/oldest), lucidity-based (lucid dreams first), and content-based
     * (longest content first) sorting. It handles invalid timestamps gracefully
     * and maintains sort stability for equal elements.
     * 
     * @function sortDreams
     * @param {Object[]} dreams - Array of dream objects to sort
     * @param {string} sortType - Sort type: 'newest', 'oldest', 'lucid-first', or 'longest'
     * @returns {Object[]} New sorted array of dream objects (original array unchanged)
     * @since 1.0.0
     * @example
     * const sorted = sortDreams(dreams, 'lucid-first');
     * 
     * @example
     * // Sort by content length for detailed analysis
     * const byLength = sortDreams(dreams, 'longest');
     */
    function sortDreams(dreams, sortType) {
        if (!Array.isArray(dreams) || dreams.length === 0) return dreams;
        
        try {
            return [...dreams].sort((a, b) => {
                if (!a || !b) return 0;
                
                try {
                    switch (sortType) {
                        case 'oldest':
                            const dateA = new Date(a.timestamp || 0);
                            const dateB = new Date(b.timestamp || 0);
                            if (isNaN(dateA.getTime())) return 1;
                            if (isNaN(dateB.getTime())) return -1;
                            return dateA - dateB;
                        
                        case 'lucid-first':
                            const aLucid = Boolean(a.isLucid);
                            const bLucid = Boolean(b.isLucid);
                            if (aLucid && !bLucid) return -1;
                            if (!aLucid && bLucid) return 1;
                            const dateA2 = new Date(a.timestamp || 0);
                            const dateB2 = new Date(b.timestamp || 0);
                            if (isNaN(dateA2.getTime())) return 1;
                            if (isNaN(dateB2.getTime())) return -1;
                            return dateB2 - dateA2;
                        
                        case 'longest':
                            const contentA = (a.content || '').toString();
                            const contentB = (b.content || '').toString();
                            return contentB.length - contentA.length;
                        
                        case 'newest':
                        default:
                            const dateA3 = new Date(a.timestamp || 0);
                            const dateB3 = new Date(b.timestamp || 0);
                            if (isNaN(dateA3.getTime())) return 1;
                            if (isNaN(dateB3.getTime())) return -1;
                            return dateB3 - dateA3;
                    }
                } catch (innerError) {
                    console.error('Error in sort comparison:', innerError);
                    return 0;
                }
            });
        } catch (error) {
            console.error('Sorting error:', error);
            return dreams; // Return unsorted if sorting fails
        }
    }

// ================================
// 4. DREAM EDITING OPERATIONS
// ================================

    /**
     * Displays an inline edit form for an existing dream entry.
     * 
     * This function converts a dream's display view into an editable form with
     * all fields pre-populated with current values. It handles datetime formatting,
     * XSS prevention, and provides a complete editing interface with save/cancel
     * actions. The form is inserted directly into the dream's container element.
     * 
     * @async
     * @function editDream
     * @param {string|number} dreamId - Unique identifier of the dream to edit
     * @returns {Promise<void>} Resolves when edit form is displayed and focused
     * @throws {Error} When dream is not found or DOM manipulation fails
     * @since 1.0.0
     * @example
     * // Edit dream with ID '123'
     * await editDream('123');
     * 
     * @example
     * // Called from action button click
     * await editDream(dreamId);
     */
    async function editDream(dreamId) {
        try {
            const dreams = await loadDreams();
            // Handle both string and numeric IDs for backward compatibility
            const dream = dreams.find(d => d.id === dreamId || d.id === dreamId.toString() || d.id === Number(dreamId));
            if (!dream) {
                console.error('Dream not found for ID:', dreamId);
                return;
            }
            
            const entryElement = document.getElementById(`entry-${dreamId}`);
            if (!entryElement) {
                console.error('Required DOM elements not found for dream:', dreamId);
                return;
            }
            
            // Convert ISO timestamp to datetime-local input format using helper
            const datetimeLocalValue = formatDatetimeLocal(dream.timestamp);
            
            // Add a new class for the edit mode and clear existing content
            entryElement.classList.add('entry-form', 'dream-entry-edit-mode');
            entryElement.innerHTML = ''; // Clear the element
            
            const safeDreamId = escapeAttr(dreamId.toString());
            const safeTitle = escapeAttr(dream.title || '');
            const safeEmotions = escapeAttr(dream.emotions || '');
            const safeTags = Array.isArray(dream.tags) ? escapeAttr(dream.tags.join(', ')) : '';
            const safeDreamSigns = Array.isArray(dream.dreamSigns) ? escapeAttr(dream.dreamSigns.join(', ')) : '';
            const safeContent = escapeAttr(dream.content || '');

            entryElement.innerHTML = `
                <div class="form-group">
                    <label for="edit-title-${safeDreamId}">Dream Title</label>
                    <input type="text" class="form-control" id="edit-title-${safeDreamId}" value="${safeTitle}">
                </div>
                <div class="form-group">
                    <label for="edit-date-${safeDreamId}">Dream Date & Time</label>
                    <input type="datetime-local" class="form-control" value="${datetimeLocalValue}" id="edit-date-${safeDreamId}">
                </div>
                <div class="form-group">
                    <label for="edit-emotions-${safeDreamId}">Emotions Experienced</label>
                    <input type="text" class="form-control" id="edit-emotions-${safeDreamId}" placeholder="e.g., happy, anxious, excited, confused" value="${safeEmotions}">
                </div>
                <div class="form-group">
                    <label for="edit-tags-${safeDreamId}">Tags & Themes</label>
                    <input type="text" class="form-control" id="edit-tags-${safeDreamId}" placeholder="e.g., family, flying, school, animals" value="${safeTags}">
                </div>
                <div class="form-group">
                    <label for="edit-dreamsigns-${safeDreamId}">⚡ Dream Signs</label>
                    <input type="text" class="form-control" id="edit-dreamsigns-${safeDreamId}" placeholder="e.g., flying, text-changing, deceased-alive" value="${safeDreamSigns}">
                </div>
                <div class="lucid-checkbox">
                    <input type="checkbox" id="edit-lucid-${safeDreamId}" ${dream.isLucid ? 'checked' : ''}>
                    <label for="edit-lucid-${safeDreamId}">This was a lucid dream ✨</label>
                </div>
                <div class="form-group">
                    <label for="edit-content-${safeDreamId}">Dream Description</label>
                    <textarea class="form-control" id="edit-content-${safeDreamId}">${safeContent}</textarea>
                </div>
                <div class="edit-actions" style="margin-top: 15px; display: flex; gap: 10px;">
                    <button data-action="save-edit" data-dream-id="${safeDreamId}" class="btn btn-primary btn-small">Save Changes</button>
                    <button data-action="cancel-edit" data-dream-id="${safeDreamId}" class="btn btn-secondary btn-small">Cancel</button>
                </div>
            `;
            
            // Focus on the title input after DOM is updated
            setTimeout(() => {
                const titleInputElement = document.getElementById(`edit-title-${safeDreamId}`);
                if (titleInputElement) {
                    titleInputElement.focus();
                }
            }, CONSTANTS.FOCUS_DELAY_MS);
            
        } catch (error) {
            console.error('Error editing dream:', error);
            
            createInlineMessage('error', 'Error editing dream. Please try again.', {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 3000
            });
        }
    }

    /**
     * Processes and saves changes from the dream edit form.
     * 
     * This function validates the edited dream content, processes tags and dream signs
     * for autocomplete learning, updates the dream object with new values including
     * a last modified timestamp, and saves using either IndexedDB fast path or
     * fallback storage. It then refreshes the display and autocomplete data.
     * 
     * @async
     * @function saveDreamEdit
     * @param {string|number} dreamId - Unique identifier of the dream being edited
     * @returns {Promise<void>} Resolves when dream is saved and display is refreshed
     * @throws {Error} When validation fails or storage operations encounter errors
     * @since 1.0.0
     * @example
     * // Save edited dream with ID '123'
     * await saveDreamEdit('123');
     * 
     * @example
     * // Called when user clicks 'Save Changes' button
     * await saveDreamEdit(dreamId);
     */
    async function saveDreamEdit(dreamId) {
        const newContentElement = document.getElementById(`edit-content-${dreamId}`);
        if (!newContentElement?.value.trim()) {
            newContentElement.style.borderColor = 'var(--error-color)';
            return;
        }

        const newTags = parseTagsFromInput(document.getElementById(`edit-tags-${dreamId}`).value);
        const newDreamSigns = parseTagsFromInput(document.getElementById(`edit-dreamsigns-${dreamId}`).value);
        const newEmotions = parseTagsFromInput(document.getElementById(`edit-emotions-${dreamId}`).value);

        await learnAutocompleteItems(newTags, 'tags');
        await learnAutocompleteItems(newDreamSigns, 'dreamSigns');
        await learnAutocompleteItems(newEmotions, 'emotions');

        const newDateValue = document.getElementById(`edit-date-${dreamId}`).value;
        const newDate = newDateValue ? new Date(newDateValue) : new Date();

        // Create updated dream object
        const updatedDream = {
            id: dreamId,
            title: document.getElementById(`edit-title-${dreamId}`).value.trim() || 'Untitled Dream',
            content: newContentElement.value.trim(),
            emotions: document.getElementById(`edit-emotions-${dreamId}`).value.trim(),
            tags: newTags,
            dreamSigns: newDreamSigns,
            isLucid: document.getElementById(`edit-lucid-${dreamId}`).checked,
            timestamp: newDate.toISOString(),
            dateString: formatDateTimeDisplay(newDate),
            lastModified: new Date().toISOString()
        };

        // Handle encryption if enabled
        if (await shouldEncryptDream()) {
            try {
                // Import encryption functions and get password
                const { getEncryptionPassword } = await import('./state.js');
                const { encryptItemForStorage, saveItemToStore } = await import('./storage.js');

                const password = getEncryptionPassword();
                if (!password) {
                    throw new Error('Encryption enabled but password not available in session');
                }

                // Encrypt the updated dream for storage
                const encryptedDream = await encryptItemForStorage(updatedDream, password);

                // Save encrypted dream to storage
                await saveItemToStore('dreams', encryptedDream);

                // Update memory state with unencrypted data
                const dreamIndex = dreams.findIndex(d => d.id.toString() === dreamId.toString());
                if (dreamIndex !== -1) {
                    dreams[dreamIndex] = updatedDream;
                }

            } catch (error) {
                console.error('Error encrypting and saving dream edit:', error);
                await ErrorMessenger.showError('DREAM_ENCRYPTION_FAILED', {
                    error: error.message || 'Encryption system error during edit'
                }, {
                    forceContext: 'journal',
                    duration: 8000
                });
                return;
            }
        } else {
            // No encryption - use existing save logic

            // Try fast path first
            let updateSuccess = false;
            if (isIndexedDBAvailable()) {
                updateSuccess = await updateDreamInIndexedDB(updatedDream);
            }

            // Fallback if the fast method fails
            if (!updateSuccess) {
                const currentDreams = await loadDreams();
                const dreamIndex = currentDreams.findIndex(d => d.id.toString() === dreamId.toString());
                if (dreamIndex !== -1) {
                    currentDreams[dreamIndex] = updatedDream;
                    await saveDreams(currentDreams);
                }
            }

            // Update memory state with unencrypted data
            const dreamIndex = dreams.findIndex(d => d.id.toString() === dreamId.toString());
            if (dreamIndex !== -1) {
                dreams[dreamIndex] = updatedDream;
            }
        }
        await displayDreams();
        await initializeAutocomplete();
    }

    /**
     * Cancels the dream edit operation and returns to display view.
     * 
     * This function discards any unsaved changes made in the edit form and
     * refreshes the dream list to restore the original display. It's called
     * when the user clicks the cancel button or wants to abort editing.
     * 
     * @async
     * @function cancelDreamEdit
     * @param {string|number} dreamId - Unique identifier of the dream being edited
     * @returns {Promise<void>} Resolves when display is restored
     * @since 1.0.0
     * @example
     * // Cancel editing dream with ID '123'
     * await cancelDreamEdit('123');
     * 
     * @example
     * // Called when user clicks 'Cancel' button
     * await cancelDreamEdit(dreamId);
     */
    async function cancelDreamEdit(dreamId) {
        try {
            // Check if there are unsaved changes
            const titleInput = document.getElementById(`edit-title-${dreamId}`);
            const contentInput = document.getElementById(`edit-content-${dreamId}`);

            if (titleInput && contentInput) {
                // Get current form values
                const currentTitle = titleInput.value.trim();
                const currentContent = contentInput.value.trim();

                // Get original dream data
                const dreams = await loadDreams();
                const originalDream = dreams.find(d => d.id.toString() === dreamId.toString());

                if (originalDream) {
                    const originalTitle = (originalDream.title || '').trim();
                    const originalContent = (originalDream.content || '').trim();

                    // Check if changes were made
                    const hasChanges = (currentTitle !== originalTitle) || (currentContent !== originalContent);

                    if (hasChanges) {
                        // Show confirmation for unsaved changes
                        await ErrorMessenger.showWarning('DREAM_EDIT_CANCEL_CONFIRM', {}, {
                            duration: 6000
                        });

                        // For now, we'll still cancel (in future could add modal confirmation)
                        // But we've at least warned the user
                        setTimeout(async () => {
                            await ErrorMessenger.showInfo('DREAM_EDIT_CANCELLED', {}, {
                                duration: 4000
                            });
                        }, 1000);
                    } else {
                        // No changes made, just show simple cancellation
                        await ErrorMessenger.showInfo('DREAM_EDIT_CANCELLED', {}, {
                            duration: 3000
                        });
                    }
                }
            }

            // Refresh display to cancel edit
            await displayDreams();

        } catch (error) {
            console.error('Error in cancelDreamEdit:', error);
            // Fallback: just refresh display
            await displayDreams();
        }
    }

// ================================
// 5. DREAM DELETION SYSTEM
// ================================

    /**
     * Initiates the dream deletion process with confirmation UI.
     * 
     * This function begins the two-step deletion process by replacing the delete
     * button with a confirmation button and adding visual styling to indicate
     * pending deletion. It includes an auto-cancel safety timeout to prevent
     * accidental deletions and manages deletion state for the specific dream.
     * 
     * @function deleteDream
     * @param {string|number} dreamId - Unique identifier of the dream to delete
     * @returns {void}
     * @since 1.0.0
     * @example
     * // Initiate deletion for dream with ID '123'
     * deleteDream('123');
     * 
     * @example
     * // Called when user clicks initial 'Delete' button
     * deleteDream(dreamId);
     */
    function deleteDream(dreamId) {
        // Clear any existing timeout for this dream
        if (deleteTimeouts[dreamId]) {
            clearTimeout(deleteTimeouts[dreamId]);
            delete deleteTimeouts[dreamId];
        }
        
        const entryElement = document.getElementById(`entry-${dreamId}`);
        if (!entryElement) return; // Safety check
        
        const actionsElement = entryElement.querySelector('.entry-actions');
        if (!actionsElement) return; // Safety check
        
        // Add pending delete styling
        entryElement.classList.add('delete-pending');
        
        // Replace delete button with confirm button
        const deleteBtn = actionsElement.querySelector(`button[data-dream-id="${dreamId}"][data-action="delete-dream"]`);
        if (deleteBtn) {
            deleteBtn.outerHTML = `<button data-action="confirm-delete" data-dream-id="${dreamId}" class="btn btn-confirm-delete btn-small">Confirm Delete</button>`;
        }
        
        // Set timeout to revert after specified time
        deleteTimeouts[dreamId] = setTimeout(() => {
            cancelDelete(dreamId);
        }, CONSTANTS.MESSAGE_DURATION_EXTENDED);
    }

    /**
     * Executes the confirmed dream deletion from storage with mutex protection.
     * 
     * This function performs the actual deletion operation after user confirmation,
     * using either IndexedDB fast path or fallback storage methods. It's protected
     * by mutex to prevent concurrent deletion operations that could cause data
     * corruption. After deletion, it resets pagination and refreshes the display.
     * 
     * @async
     * @function confirmDelete
     * @param {string|number} dreamId - Unique identifier of the dream to delete
     * @returns {Promise<void>} Resolves when dream is deleted and display is updated
     * @throws {Error} When deletion fails or storage operations encounter errors
     * @since 1.0.0
     * @example
     * // Execute confirmed deletion for dream with ID '123'
     * await confirmDelete('123');
     * 
     * @example
     * // Called when user clicks 'Confirm Delete' button
     * await confirmDelete(dreamId);
     */
    async function confirmDelete(dreamId) {
        return withMutex('deleteOperations', async () => {
            try {
                if (deleteTimeouts[dreamId]) {
                    clearTimeout(deleteTimeouts[dreamId]);
                    delete deleteTimeouts[dreamId];
                }

                // Try fast path first
                let deleteSuccess = false;
                if (isIndexedDBAvailable()) {
                    deleteSuccess = await deleteDreamFromIndexedDB(dreamId);
                }
                
                // Fallback if the fast method fails
                if (!deleteSuccess) {
                    const dreams = await loadDreams();
                    const updatedDreams = dreams.filter(d => d.id.toString() !== dreamId.toString());
                    await saveDreams(updatedDreams);
                }

                setCurrentPage(1);
                await displayDreams();

                // Show success message
                await ErrorMessenger.showInfo('DREAM_DELETED', {}, {
                    duration: 4000
                });

            } catch (error) {
                console.error(`Error in confirmDelete for dreamId ${dreamId}:`, error);
                await ErrorMessenger.showError('STORAGE_SAVE_FAILED', {
                    dataType: 'dream deletion',
                    error: error.message || 'Deletion failed'
                }, {
                    duration: 8000
                });
            }
        });
    }

    /**
     * Cancels the delete operation and restores the original delete button.
     * 
     * This function aborts the deletion process by removing pending deletion
     * styling, clearing the auto-cancel timeout, and replacing the confirmation
     * button with the original delete button. It's called either by user action
     * or automatically by the safety timeout.
     * 
     * @function cancelDelete
     * @param {string|number} dreamId - Unique identifier of the dream deletion to cancel
     * @returns {void}
     * @since 1.0.0
     * @example
     * // Cancel deletion for dream with ID '123'
     * cancelDelete('123');
     * 
     * @example
     * // Automatically called by timeout after extended delay
     * setTimeout(() => cancelDelete(dreamId), CONSTANTS.MESSAGE_DURATION_EXTENDED);
     */
    function cancelDelete(dreamId) {
        // Clear the timeout
        if (deleteTimeouts[dreamId]) {
            clearTimeout(deleteTimeouts[dreamId]);
            delete deleteTimeouts[dreamId];
        }
        
        const entryElement = document.getElementById(`entry-${dreamId}`);
        if (entryElement) {
            const actionsElement = entryElement.querySelector('.entry-actions');
            
            // Remove pending delete styling
            entryElement.classList.remove('delete-pending');
            
            // Replace confirm button with original delete button
            const confirmBtn = actionsElement.querySelector(`button[data-dream-id="${dreamId}"][data-action="confirm-delete"]`);
            if (confirmBtn) {
                confirmBtn.outerHTML = `<button data-action="delete-dream" data-dream-id="${dreamId}" class="btn btn-delete btn-small">Delete</button>`;
            }
        }
    }

// ================================
// 6. DREAM DISPLAY HELPER FUNCTIONS
// ================================
    
    /**
     * Validates filter parameters and provides helpful error corrections.
     *
     * This function performs comprehensive validation of all filter inputs including
     * date ranges, search terms, and selection values. It detects common user errors
     * and provides specific correction suggestions to help users fix their queries.
     *
     * **Validation Features:**
     * - Date range validation with logical order checking
     * - Future date detection and warnings
     * - Search term length and character validation
     * - Invalid date format detection with format examples
     * - Impossible date range detection (end before start)
     * - Empty search with restrictive filters detection
     *
     * **Error Correction:**
     * - Suggests swapping start/end dates when reversed
     * - Provides valid date format examples
     * - Recommends search refinements for no results
     * - Offers alternative filter combinations
     * - Suggests date range adjustments for better results
     *
     * @async
     * @function validateFilterInputs
     * @param {Object} filterValues - Filter values from getFilterValues()
     * @returns {Promise<Object>} Validation result with errors and suggestions
     * @returns {boolean} returns.isValid - Whether all inputs are valid
     * @returns {Object[]} returns.errors - Array of validation errors with corrections
     * @returns {Object[]} returns.warnings - Array of warnings with suggestions
     * @returns {Object} returns.corrections - Suggested corrections for each invalid field
     * @since 2.04.01
     * @example
     * const filterValues = getFilterValues();
     * const validation = await validateFilterInputs(filterValues);
     * if (!validation.isValid) {
     *   // Show validation errors to user
     *   await ErrorMessenger.showError('FILTER_VALIDATION_ERROR', validation);
     * }
     */
    async function validateFilterInputs(filterValues) {
        const errors = [];
        const warnings = [];
        const corrections = {};

        try {
            const { searchTerm, filterType, sortType, startDate, endDate } = filterValues;

            // Validate date inputs
            let startDateObj = null;
            let endDateObj = null;

            if (startDate) {
                startDateObj = new Date(startDate);
                if (isNaN(startDateObj.getTime())) {
                    errors.push({
                        field: 'startDate',
                        message: 'Invalid start date format',
                        suggestion: 'Use YYYY-MM-DD format (e.g., 2024-01-15)'
                    });
                    corrections.startDate = new Date().toISOString().split('T')[0];
                } else if (startDateObj > new Date()) {
                    warnings.push({
                        field: 'startDate',
                        message: 'Start date is in the future',
                        suggestion: 'Dreams are typically recorded for past dates. Consider using today\'s date or earlier.'
                    });
                }
            }

            if (endDate) {
                endDateObj = new Date(endDate);
                if (isNaN(endDateObj.getTime())) {
                    errors.push({
                        field: 'endDate',
                        message: 'Invalid end date format',
                        suggestion: 'Use YYYY-MM-DD format (e.g., 2024-12-31)'
                    });
                    corrections.endDate = new Date().toISOString().split('T')[0];
                } else if (endDateObj > new Date()) {
                    warnings.push({
                        field: 'endDate',
                        message: 'End date is in the future',
                        suggestion: 'Consider using today\'s date as the end date to include all current dreams.'
                    });
                }
            }

            // Validate date range logic
            if (startDateObj && endDateObj && !isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
                if (startDateObj > endDateObj) {
                    errors.push({
                        field: 'dateRange',
                        message: 'Start date is after end date',
                        suggestion: 'Swap the dates or adjust the range to be logically consistent.'
                    });
                    corrections.startDate = endDate;
                    corrections.endDate = startDate;
                }

                // Check for extremely narrow date ranges
                const daysDiff = Math.abs(endDateObj - startDateObj) / (1000 * 60 * 60 * 24);
                if (daysDiff === 0 && searchTerm.length > 0) {
                    warnings.push({
                        field: 'dateRange',
                        message: 'Very narrow date range with search term',
                        suggestion: 'Consider expanding the date range if no dreams are found.'
                    });
                }
            }

            // Validate search term
            if (searchTerm) {
                if (searchTerm.length > 100) {
                    warnings.push({
                        field: 'searchTerm',
                        message: 'Very long search term',
                        suggestion: 'Consider using shorter, more specific keywords for better results.'
                    });
                }

                if (searchTerm.includes('  ')) {
                    warnings.push({
                        field: 'searchTerm',
                        message: 'Multiple spaces in search term',
                        suggestion: 'Remove extra spaces for cleaner search results.'
                    });
                    corrections.searchTerm = searchTerm.replace(/\s+/g, ' ').trim();
                }

                // Check for potentially problematic search patterns
                if (/^[^a-zA-Z0-9\s]+$/.test(searchTerm)) {
                    warnings.push({
                        field: 'searchTerm',
                        message: 'Search contains only special characters',
                        suggestion: 'Include letters or numbers in your search for better matching.'
                    });
                }
            }

            // Validate filter combinations
            const dreamCount = await getFilteredDreamsCount();
            if (dreamCount === 0 && (searchTerm || filterType !== 'all' || startDate || endDate)) {
                warnings.push({
                    field: 'combination',
                    message: 'No dreams found with current filters',
                    suggestion: 'Try removing some filters, expanding the date range, or using different search terms.'
                });
            }

            // Check for valid enum values
            const validFilterTypes = ['all', 'lucid', 'non-lucid'];
            if (!validFilterTypes.includes(filterType)) {
                errors.push({
                    field: 'filterType',
                    message: 'Invalid filter type',
                    suggestion: 'Choose from: All Dreams, Lucid Dreams, or Non-Lucid Dreams'
                });
                corrections.filterType = 'all';
            }

            const validSortTypes = ['newest', 'oldest', 'lucid-first', 'longest'];
            if (!validSortTypes.includes(sortType)) {
                errors.push({
                    field: 'sortType',
                    message: 'Invalid sort option',
                    suggestion: 'Choose from: Newest First, Oldest First, Lucid First, or Longest First'
                });
                corrections.sortType = 'newest';
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                corrections,
                summary: errors.length === 0
                    ? 'Filter settings are valid'
                    : `${errors.length} error${errors.length > 1 ? 's' : ''} found in filter settings`
            };

        } catch (error) {
            console.error('Filter validation error:', error);
            return {
                isValid: false,
                errors: [{
                    field: 'system',
                    message: 'Filter validation system error',
                    suggestion: 'Please try refreshing the page or contact support if the problem persists.'
                }],
                warnings: [],
                corrections: {},
                summary: 'Unable to validate filter settings due to system error'
            };
        }
    }

    /**
     * Extracts current search and filter settings from UI controls.
     *
     * This function reads values from all filter-related DOM elements including
     * search box, filter dropdowns, sort selection, pagination limits, and date
     * range inputs. It provides default values for missing elements and formats
     * the search term to lowercase for case-insensitive searching.
     *
     * @function getFilterValues
     * @returns {FilterValues} Object containing all current filter parameters
     * @since 1.0.0
     * @example
     * const filters = getFilterValues();
     * console.log(filters.searchTerm); // 'flying'
     * console.log(filters.filterType); // 'lucid'
     *
     * @example
     * // Use extracted values for filtering
     * const { searchTerm, filterType, sortType } = getFilterValues();
     * const filtered = filterDreams(dreams, searchTerm, filterType);
     */
    function getFilterValues() {
        const searchBox = document.getElementById('searchBox');
        const filterSelect = document.getElementById('filterSelect');
        const sortSelect = document.getElementById('sortSelect');
        const limitSelect = document.getElementById('limitSelect');
        const startDateInput = document.getElementById('startDateFilter');
        const endDateInput = document.getElementById('endDateFilter');
        
        return {
            searchTerm: (searchBox ? searchBox.value : '').toLowerCase(),
            filterType: filterSelect ? filterSelect.value : 'all',
            sortType: sortSelect ? sortSelect.value : 'newest',
            limitValue: limitSelect ? limitSelect.value : '10',
            startDate: startDateInput ? startDateInput.value : '',
            endDate: endDateInput ? endDateInput.value : ''
        };
    }
    
    /**
     * Displays a loading indicator for large datasets to provide user feedback.
     * 
     * This function shows a loading message with dream count when processing
     * large numbers of dreams. It helps users understand that the application
     * is working and provides an estimate of the processing scope.
     * 
     * @function showLoadingMessage
     * @param {HTMLElement} container - DOM container element to display loading message in
     * @param {number} dreamCount - Number of dreams being processed
     * @returns {void}
     * @since 1.0.0
     * @example
     * const container = document.getElementById('entriesContainer');
     * showLoadingMessage(container, 1500);
     * 
     * @example
     * // Show loading for datasets exceeding threshold
     * if (dreams.length > CONSTANTS.LARGE_DATASET_THRESHOLD) {
     *   showLoadingMessage(container, dreams.length);
     * }
     */
    function showLoadingMessage(container, dreamCount) {
        container.innerHTML = `
            <div class="loading-state large">
                <div>🌙</div>
                <div>Loading ${dreamCount} dreams...</div>
            </div>
        `;
    }
    
    /**
     * Generates a contextual no-results message based on current filter state.
     * 
     * This function creates user-friendly messages that explain why no dreams
     * are displayed and provides helpful guidance based on the active filters.
     * Different messages are shown for search results, lucid/non-lucid filters,
     * and empty journals to guide user actions appropriately.
     * 
     * @function showNoResultsMessage
     * @param {HTMLElement} container - DOM container element to display message in
     * @param {string} filterType - Current filter type: 'all', 'lucid', or 'non-lucid'
     * @param {string} searchTerm - Current search term (empty string if no search)
     * @returns {void}
     * @since 1.0.0
     * @example
     * showNoResultsMessage(container, 'lucid', '');
     * // Shows: "No lucid dreams recorded yet. Mark dreams as lucid when you achieve lucidity!"
     * 
     * @example
     * showNoResultsMessage(container, 'all', 'flying');
     * // Shows: "No dreams found matching your search."
     */
    async function showNoResultsMessage(container, filterType, searchTerm) {
        const filterText = filterType === 'all' ? '' :
            filterType === 'lucid' ? ' lucid' : ' non-lucid';

        let message;
        if (searchTerm) {
            // Show search results message using ErrorMessenger
            await ErrorMessenger.showInfo('SEARCH_NO_RESULTS', {
                searchTerm: searchTerm
            }, {
                forceContext: 'journal',
                duration: 5000
            });
            message = `No${filterText} dreams found matching your search.`;
        } else if (filterType === 'lucid') {
            message = 'No lucid dreams recorded yet. Mark dreams as lucid when you achieve lucidity!';
        } else if (filterType === 'non-lucid') {
            message = 'No non-lucid dreams found.';
        } else {
            // Show empty journal message using ErrorMessenger
            await ErrorMessenger.showInfo('SEARCH_NO_DATA', {}, {
                forceContext: 'journal',
                duration: 6000
            });
            message = 'No dreams recorded yet. Start by adding your first dream above!';
        }

        container.innerHTML = `<div class="no-entries">${message}</div>`;
    }
    
    /**
     * Removes pagination controls from display when not needed.
     * 
     * This function clears the pagination container HTML when no results are
     * found or when pagination is not applicable (e.g., showing all dreams).
     * It ensures a clean UI state without unnecessary navigation controls.
     * 
     * @function clearPagination
     * @returns {void}
     * @since 1.0.0
     * @example
     * // Clear pagination when no dreams found
     * if (filteredDreams.length === 0) {
     *   clearPagination();
     * }
     * 
     * @example
     * // Clear pagination when switching to "show all" mode
     * clearPagination();
     */
    function clearPagination() {
        const paginationContainer = document.getElementById('paginationContainer');
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }
    }

// ================================
// 7. PAGINATION & ENDLESS SCROLL SYSTEM
// ================================

    /**
     * Calculates pagination parameters for different display modes.
     *
     * This pure function performs pagination calculations without side effects,
     * handling different display modes (traditional pagination, endless scroll,
     * show all) and returning the appropriate parameters. It focuses solely on
     * calculation logic without UI state management.
     *
     * @function calculatePaginationParams
     * @param {Object[]} filteredDreams - Array of filtered dream objects to paginate
     * @param {string} limitValue - Display limit: numeric string, 'endless', or 'all'
     * @returns {{mode: string, itemsPerPage: number, totalPages: number, totalDreams: number, startIndex?: number, endIndex?: number, safeLoaded?: number}} Pagination calculation parameters
     * @since 2.02.73
     * @example
     * const params = calculatePaginationParams(dreams, '10');
     * console.log(params.totalPages); // 5
     * console.log(params.itemsPerPage); // 10
     *
     * @example
     * // Endless scroll mode calculations
     * const endlessParams = calculatePaginationParams(dreams, 'endless');
     * console.log(endlessParams.mode); // 'endless'
     */
    function calculatePaginationParams(filteredDreams, limitValue) {
        if (!Array.isArray(filteredDreams)) {
            return { mode: 'traditional', itemsPerPage: 1, totalPages: 1, totalDreams: 0 };
        }

        const totalDreams = Math.max(0, filteredDreams.length);

        if (limitValue === 'endless') {
            const safeLoaded = Math.min(
                endlessScrollState.loaded || CONSTANTS.ENDLESS_SCROLL_INCREMENT,
                totalDreams
            );
            return {
                mode: 'endless',
                itemsPerPage: safeLoaded,
                totalPages: 1,
                totalDreams,
                safeLoaded
            };
        } else if (limitValue === 'all') {
            return {
                mode: 'all',
                itemsPerPage: Math.max(1, totalDreams),
                totalPages: 1,
                totalDreams
            };
        } else {
            const itemsPerPage = Math.max(1, Math.min(parseInt(limitValue) || 10, 1000));
            const totalPages = Math.max(1, Math.ceil(totalDreams / itemsPerPage));
            const validCurrentPage = Math.max(1, Math.min(getCurrentPage(), totalPages));
            const startIndex = Math.max(0, (validCurrentPage - 1) * itemsPerPage);
            const endIndex = Math.min(startIndex + itemsPerPage, totalDreams);

            return {
                mode: 'traditional',
                itemsPerPage,
                totalPages,
                totalDreams,
                startIndex,
                endIndex,
                validCurrentPage
            };
        }
    }

    /**
     * Configures UI state and manages endless scroll setup based on pagination mode.
     *
     * This function handles all UI state management and side effects related to
     * pagination modes including endless scroll state configuration, event listener
     * management, and current page updates. It's separated from calculation logic
     * to follow Single Responsibility Principle.
     *
     * @function configurePaginationMode
     * @param {string} mode - Pagination mode: 'endless', 'all', or 'traditional'
     * @param {Object} params - Parameters from calculatePaginationParams()
     * @returns {void}
     * @since 2.02.73
     * @example
     * const params = calculatePaginationParams(dreams, 'endless');
     * configurePaginationMode(params.mode, params);
     *
     * @example
     * // Configure traditional pagination mode
     * configurePaginationMode('traditional', { validCurrentPage: 3 });
     */
    function configurePaginationMode(mode, params) {
        try {
            switch (mode) {
                case 'endless':
                    endlessScrollState.enabled = true;
                    if (!endlessScrollState.loading) {
                        endlessScrollState.loaded = Math.max(
                            CONSTANTS.ENDLESS_SCROLL_INCREMENT,
                            endlessScrollState.loaded || CONSTANTS.ENDLESS_SCROLL_INCREMENT
                        );
                        setupEndlessScroll();
                    }
                    break;

                case 'all':
                    endlessScrollState.enabled = false;
                    removeEndlessScroll();
                    setCurrentPage(1);
                    break;

                case 'traditional':
                    endlessScrollState.enabled = false;
                    removeEndlessScroll();
                    if (params.validCurrentPage) {
                        setCurrentPage(params.validCurrentPage);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error configuring pagination mode:', error);
        }
    }

    /**
     * Calculates pagination parameters and configures endless scroll mode if enabled.
     *
     * This function orchestrates pagination by combining calculation logic with UI
     * state management. It delegates to specialized helper functions following the
     * Single Responsibility Principle while maintaining the same external interface.
     *
     * @function calculatePagination
     * @param {Object[]} filteredDreams - Array of filtered dream objects to paginate
     * @param {string} limitValue - Display limit: numeric string, 'endless', or 'all'
     * @returns {PaginationResult} Object containing pagination parameters and dream subset
     * @since 1.0.0
     * @example
     * const result = calculatePagination(dreams, '10');
     * console.log(result.totalPages); // 5
     * console.log(result.paginatedDreams.length); // 10
     *
     * @example
     * // Endless scroll mode
     * const endless = calculatePagination(dreams, 'endless');
     * console.log(endless.totalPages); // 1 (endless mode)
     */
    function calculatePagination(filteredDreams, limitValue) {
        if (!Array.isArray(filteredDreams)) {
            return { paginatedDreams: [], totalPages: 1, totalDreams: 0, itemsPerPage: 1 };
        }

        try {
            // Calculate pagination parameters
            const params = calculatePaginationParams(filteredDreams, limitValue);

            // Configure UI state based on mode
            configurePaginationMode(params.mode, params);

            // Extract the appropriate subset of dreams
            let paginatedDreams;
            switch (params.mode) {
                case 'endless':
                    paginatedDreams = filteredDreams.slice(0, params.safeLoaded);
                    break;
                case 'all':
                    paginatedDreams = filteredDreams;
                    break;
                case 'traditional':
                    paginatedDreams = filteredDreams.slice(params.startIndex, params.endIndex);
                    break;
                default:
                    paginatedDreams = filteredDreams.slice(0, 10);
            }

            return {
                paginatedDreams,
                totalPages: params.totalPages,
                totalDreams: params.totalDreams,
                itemsPerPage: params.itemsPerPage
            };
        } catch (error) {
            console.error('Error calculating pagination:', error);
            return {
                paginatedDreams: filteredDreams.slice(0, 10),
                totalPages: 1,
                totalDreams: filteredDreams.length,
                itemsPerPage: 10
            };
        }
    }
    
    /**
     * Prepares and sanitizes dream data for safe display rendering.
     *
     * This function handles all data processing logic including validation,
     * sanitization, default value assignment, and data structure preparation.
     * It separates data concerns from presentation logic following the
     * Single Responsibility Principle.
     *
     * @function buildDreamDataForDisplay
     * @param {Object} dream - Raw dream object from storage
     * @returns {{valid: boolean, safeTitle: string, safeContent: string, safeDateString: string, safeEmotions: string, isLucid: boolean, tags: string[], dreamSigns: string[], safeDreamId: string} | null} Processed dream display data or null if invalid
     * @since 2.02.73
     * @example
     * const displayData = buildDreamDataForDisplay(dream);
     * if (displayData && displayData.valid) {
     *   const html = generateDreamHTML(displayData);
     * }
     *
     * @example
     * // Handles invalid dreams gracefully
     * const invalidData = buildDreamDataForDisplay(null);
     * console.log(invalidData); // null
     */
    function buildDreamDataForDisplay(dream) {
        // Validate input
        if (!dream || typeof dream !== 'object' || !dream.id) {
            return null;
        }

        try {
            // Process and sanitize core fields
            const safeTitle = escapeHtml((dream.title || 'Untitled Dream').toString());
            const safeContent = escapeHtml((dream.content || '').toString());
            const safeDateString = escapeHtml((dream.dateString || 'Unknown Date').toString());
            const safeEmotions = escapeHtml((dream.emotions || '').toString());
            const isLucid = Boolean(dream.isLucid);
            const safeDreamId = escapeAttr(dream.id.toString());

            // Process arrays with validation
            const tags = Array.isArray(dream.tags) ? dream.tags : [];
            const dreamSigns = Array.isArray(dream.dreamSigns) ? dream.dreamSigns : [];

            return {
                valid: true,
                safeTitle,
                safeContent,
                safeDateString,
                safeEmotions,
                isLucid,
                tags,
                dreamSigns,
                safeDreamId
            };
        } catch (error) {
            console.error('Error building dream display data:', error);
            return null;
        }
    }

    /**
     * Generates HTML structure from processed dream display data.
     *
     * This function focuses solely on HTML template generation without data
     * processing concerns. It takes pre-sanitized data and constructs the
     * complete dream entry HTML structure with proper semantic markup and
     * accessibility features.
     *
     * @function generateDreamHTML
     * @param {Object} displayData - Processed dream data from buildDreamDataForDisplay()
     * @param {string} displayData.safeTitle - Sanitized dream title
     * @param {string} displayData.safeContent - Sanitized dream content
     * @param {string} displayData.safeDateString - Sanitized date string
     * @param {string} displayData.safeEmotions - Sanitized emotions text
     * @param {boolean} displayData.isLucid - Lucid dream flag
     * @param {string[]} displayData.tags - Array of tags
     * @param {string[]} displayData.dreamSigns - Array of dream signs
     * @param {string} displayData.safeDreamId - Sanitized dream ID
     * @returns {string} Complete HTML string for dream entry
     * @since 2.02.73
     * @example
     * const displayData = buildDreamDataForDisplay(dream);
     * const html = generateDreamHTML(displayData);
     *
     * @example
     * // Generate HTML for lucid dream entry
     * const html = generateDreamHTML({
     *   safeTitle: 'Flying Dream',
     *   isLucid: true,
     *   tags: ['flying', 'city'],
     *   ...otherData
     * });
     */
    function generateDreamHTML(displayData) {
        const {
            safeTitle,
            safeContent,
            safeDateString,
            safeEmotions,
            isLucid,
            tags,
            dreamSigns,
            safeDreamId
        } = displayData;

        // Build emotions section
        const emotionsDisplay = safeEmotions ?
            `<div class="entry-emotions">
                <span>Emotions:</span> ${safeEmotions}
            </div>` : '';

        // Build tags and dream signs section
        let tagsDisplay = '';
        if (tags.length > 0 || dreamSigns.length > 0) {
            tagsDisplay = '<div class="entry-tags">';

            if (tags.length > 0) {
                tagsDisplay += `<div class="tag-section">
                    <span class="tag-label">Tags:</span>
                    ${formatTagsForDisplay(tags)}
                </div>`;
            }

            if (dreamSigns.length > 0) {
                tagsDisplay += `<div class="tag-section">
                    <span class="tag-label">Dream Signs:</span>
                    ${formatDreamSignsForDisplay(dreamSigns)}
                </div>`;
            }

            tagsDisplay += '</div>';
        }

        // Build action buttons section
        const actionButtons = `<div class="entry-actions">
            ${createActionButton('edit-dream', safeDreamId, 'Edit', 'btn btn-edit btn-small')}
            ${createActionButton('delete-dream', safeDreamId, 'Delete', 'btn btn-delete btn-small')}
        </div>`;

        // Generate complete HTML structure
        return `
            <div class="entry ${isLucid ? 'lucid' : ''}"
                 id="entry-${safeDreamId}"
                 role="article"
                 aria-roledescription="dream entry">
                <div class="entry-header">
                    <div class="entry-title" id="title-${safeDreamId}">${safeTitle}</div>
                    <div class="entry-meta">
                        <div class="entry-date">${safeDateString}</div>
                        ${actionButtons}
                    </div>
                </div>
                ${emotionsDisplay}
                ${tagsDisplay}
                <div class="entry-content" id="content-${safeDreamId}">${safeContent}</div>
            </div>
        `;
    }

    /**
     * Generates secure HTML representation of a single dream entry.
     *
     * This function orchestrates dream rendering by combining data processing
     * with HTML generation. It delegates to specialized helper functions following
     * the Single Responsibility Principle while maintaining the same external interface.
     *
     * @function renderDreamHTML
     * @param {Object} dream - Dream object to render
     * @param {string|number} dream.id - Unique dream identifier
     * @param {string} [dream.title] - Dream title
     * @param {string} [dream.content] - Dream content/description
     * @param {string} [dream.dateString] - Formatted date string for display
     * @param {string} [dream.emotions] - Emotions experienced in dream
     * @param {string[]} [dream.tags] - Array of dream tags
     * @param {string[]} [dream.dreamSigns] - Array of dream signs
     * @param {boolean} [dream.isLucid] - Whether dream was lucid
     * @returns {string} Complete HTML string for dream entry, empty string if invalid
     * @since 1.0.0
     * @example
     * const htmlString = renderDreamHTML({
     *   id: '123',
     *   title: 'Flying Dream',
     *   content: 'I was flying over the city...',
     *   isLucid: true,
     *   tags: ['flying', 'city']
     * });
     *
     * @example
     * // Handles invalid dreams gracefully
     * const empty = renderDreamHTML(null); // Returns ''
     */
    function renderDreamHTML(dream) {
        try {
            // Build processed display data
            const displayData = buildDreamDataForDisplay(dream);

            // Return empty string for invalid dreams
            if (!displayData || !displayData.valid) {
                return '';
            }

            // Generate HTML from processed data
            return generateDreamHTML(displayData);
        } catch (error) {
            console.error('Error rendering dream HTML:', error);
            return `<div class="entry error">Error displaying dream</div>`;
        }
    }
    
    /**
     * Generates pagination status and controls based on current display mode.
     * 
     * This function creates appropriate pagination UI for different display modes:
     * endless scroll status with load progress, traditional pagination with
     * page controls, or no pagination for "show all" mode. It dynamically
     * updates the pagination container with relevant information and controls.
     * 
     * @function renderPaginationHTML
     * @param {string} limitValue - Display limit: numeric string, 'endless', or 'all'
     * @param {number} totalPages - Total number of pages in traditional pagination
     * @param {number} totalDreams - Total number of dreams in filtered set
     * @param {Object[]} paginatedDreams - Array of dreams currently displayed
     * @returns {void}
     * @since 1.0.0
     * @example
     * renderPaginationHTML('10', 5, 47, currentPageDreams);
     * // Renders: "Showing 1-10 of 47 dreams" with page controls
     * 
     * @example
     * renderPaginationHTML('endless', 1, 100, loadedDreams);
     * // Renders: "Showing 25 of 100 dreams\nScroll down to load 5 more..."
     */
    function renderPaginationHTML(limitValue, totalPages, totalDreams, paginatedDreams) {
        const paginationContainer = document.getElementById('paginationContainer');
        if (!paginationContainer) return;
        
        if (endlessScrollState.enabled) {
            const remainingDreams = totalDreams - endlessScrollState.loaded;
            if (remainingDreams > 0) {
                paginationContainer.innerHTML = `
                    <div class="pagination-info">
                        Showing ${endlessScrollState.loaded} of ${totalDreams} dreams
                        <br><span style="font-size: 14px;">Scroll down to load ${Math.min(5, remainingDreams)} more...</span>
                    </div>
                `;
            } else {
                paginationContainer.innerHTML = `
                    <div class="pagination-info">
                        All ${totalDreams} dreams loaded
                    </div>
                `;
            }
        } else if (limitValue !== 'all' && totalPages > 1) {
            paginationContainer.innerHTML = renderPagination(getCurrentPage(), totalPages, totalDreams, paginatedDreams.length);
        } else {
            paginationContainer.innerHTML = '';
        }
    }

// ================================
// 8. UI UTILITY FUNCTIONS
// ================================

    /**
     * Extracts the items per page value from the UI limit selection dropdown.
     *
     * This utility function centralizes the logic for reading and parsing the
     * items per page setting from the UI. It provides proper defaults, validation,
     * and safety bounds to prevent invalid pagination configurations. This eliminates
     * code duplication across pagination-related functions.
     *
     * @function getItemsPerPageFromUI
     * @returns {number} Number of items per page (1-1000), defaults to 10
     * @since 2.02.73
     * @example
     * const itemsPerPage = getItemsPerPageFromUI();
     * console.log(itemsPerPage); // 10 (default) or user selection
     *
     * @example
     * // Used in pagination calculations
     * const totalPages = Math.ceil(totalItems / getItemsPerPageFromUI());
     */
    function getItemsPerPageFromUI() {
        const limitSelect = document.getElementById('limitSelect');
        const limitValue = limitSelect ? limitSelect.value : '10';
        return Math.max(1, Math.min(parseInt(limitValue) || 10, 1000));
    }

    /**
     * Formats a timestamp or Date object to datetime-local input format.
     *
     * This utility function converts ISO timestamps or Date objects to the
     * 'YYYY-MM-DDTHH:MM' format required by HTML datetime-local input elements.
     * It includes comprehensive error handling and fallback to current time for
     * invalid dates, ensuring reliable datetime formatting across the application.
     *
     * @function formatDatetimeLocal
     * @param {string|Date|number} [dateInput] - ISO timestamp, Date object, or timestamp number
     * @returns {string} Formatted datetime string in 'YYYY-MM-DDTHH:MM' format
     * @since 2.02.73
     * @example
     * const formatted = formatDatetimeLocal('2024-01-15T14:30:00.000Z');
     * console.log(formatted); // '2024-01-15T14:30'
     *
     * @example
     * // Handles invalid input with current time fallback
     * const fallback = formatDatetimeLocal('invalid-date');
     * console.log(fallback); // Current time in datetime-local format
     *
     * @example
     * // Works with Date objects
     * const dateFormatted = formatDatetimeLocal(new Date());
     * console.log(dateFormatted); // Current time formatted
     */
    function formatDatetimeLocal(dateInput) {
        let dateToFormat;

        try {
            if (!dateInput) {
                // No input provided, use current time
                dateToFormat = new Date();
            } else if (dateInput instanceof Date) {
                // Date object provided
                dateToFormat = isNaN(dateInput.getTime()) ? new Date() : dateInput;
            } else {
                // String or number timestamp provided
                const parsedDate = new Date(dateInput);
                dateToFormat = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
            }
        } catch (error) {
            // Any parsing error, fallback to current time
            console.warn('Error parsing date input, using current time:', error);
            dateToFormat = new Date();
        }

        try {
            // Format to datetime-local format: YYYY-MM-DDTHH:MM
            const year = dateToFormat.getFullYear();
            const month = (dateToFormat.getMonth() + 1).toString().padStart(2, '0');
            const day = dateToFormat.getDate().toString().padStart(2, '0');
            const hours = dateToFormat.getHours().toString().padStart(2, '0');
            const minutes = dateToFormat.getMinutes().toString().padStart(2, '0');

            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (error) {
            // Final fallback - return current time formatted
            console.error('Error formatting datetime-local, using current time fallback:', error);
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');

            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }
    }

    /**
     * Clears all form fields in the dream entry form after successful save.
     *
     * This utility function resets the dream entry form to its initial state,
     * clearing all input fields and resetting checkboxes. It also sets the
     * date field to current time to prepare for the next entry. This function
     * handles form cleanup concerns separately from pagination logic.
     *
     * @function clearDreamForm
     * @param {HTMLElement} titleElement - Dream title input element
     * @param {HTMLElement} contentElement - Dream content textarea element
     * @param {HTMLElement} dreamDateElement - Dream date datetime-local input element
     * @param {HTMLElement} isLucidElement - Lucid dream checkbox element
     * @param {HTMLElement} emotionsElement - Emotions input element
     * @param {HTMLElement} tagsElement - Tags input element
     * @param {HTMLElement} dreamSignsElement - Dream signs input element
     * @returns {void}
     * @since 2.02.73
     * @example
     * // Clear form after successful dream save
     * clearDreamForm(titleEl, contentEl, dateEl, lucidEl, emotionsEl, tagsEl, signsEl);
     *
     * @example
     * // Called from saveDream() after successful storage
     * clearDreamForm(...formElements);
     */
    function clearDreamForm(titleElement, contentElement, dreamDateElement, isLucidElement, emotionsElement, tagsElement, dreamSignsElement) {
        try {
            // Clear all text input fields
            if (titleElement) titleElement.value = '';
            if (contentElement) contentElement.value = '';
            if (emotionsElement) emotionsElement.value = '';
            if (tagsElement) tagsElement.value = '';
            if (dreamSignsElement) dreamSignsElement.value = '';

            // Reset checkbox
            if (isLucidElement) isLucidElement.checked = false;

            // Reset date field to current timestamp for next entry
            if (dreamDateElement) {
                dreamDateElement.value = formatDatetimeLocal(); // Use helper for current time
            }
        } catch (error) {
            console.warn('Error clearing dream form fields:', error);
        }
    }

    /**
     * Resets pagination to the first page to display newly added content.
     *
     * This utility function handles pagination state reset that should occur
     * after adding new content. It ensures users see their newly added dreams
     * at the top of the list by resetting to page 1. This function isolates
     * pagination concerns from form management.
     *
     * @function resetPaginationToFirst
     * @returns {void}
     * @since 2.02.73
     * @example
     * // Reset pagination after adding new dream
     * resetPaginationToFirst();
     *
     * @example
     * // Called from saveDream() after successful storage
     * resetPaginationToFirst();
     */
    function resetPaginationToFirst() {
        try {
            setCurrentPage(1);
        } catch (error) {
            console.warn('Error resetting pagination to first page:', error);
        }
    }

// ================================
// 9. ENDLESS SCROLL IMPLEMENTATION
// ================================

    /**
     * Initializes endless scroll event listener with debouncing protection.
     * 
     * This function sets up the scroll event listener for endless scroll mode,
     * ensuring no duplicate listeners exist by removing any existing ones first.
     * The scroll handling includes debouncing to prevent excessive event firing.
     * 
     * @function setupEndlessScroll
     * @returns {void}
     * @since 1.0.0
     * @example
     * // Enable endless scroll when user selects endless mode
     * setupEndlessScroll();
     * 
     * @example
     * // Called automatically when pagination mode switches to endless
     * if (limitValue === 'endless') {
     *   setupEndlessScroll();
     * }
     */
    function setupEndlessScroll() {
        // Remove existing scroll listener to prevent duplicates
        removeEndlessScroll();
        
        // Add scroll listener with debouncing
        window.addEventListener('scroll', handleEndlessScroll);
    }

    /**
     * Cleans up endless scroll event listener when switching display modes.
     * 
     * This function removes the scroll event listener to prevent memory leaks
     * and unwanted scroll handling when not in endless scroll mode. It's called
     * when switching to traditional pagination or "show all" modes.
     * 
     * @function removeEndlessScroll
     * @returns {void}
     * @since 1.0.0
     * @example
     * // Disable endless scroll when switching to paginated mode
     * removeEndlessScroll();
     * 
     * @example
     * // Called automatically when pagination mode changes
     * if (limitValue !== 'endless') {
     *   removeEndlessScroll();
     * }
     */
    function removeEndlessScroll() {
        window.removeEventListener('scroll', handleEndlessScroll);
    }

    /**
     * Handles endless scroll events with debouncing and threshold detection.
     * 
     * This function processes scroll events to determine when to load more dreams
     * in endless scroll mode. It includes throttling to prevent excessive API calls,
     * threshold detection for triggering loads, and mutex protection for loading
     * operations. The function calculates scroll position and triggers incremental
     * dream loading when the user approaches the bottom of the page.
     * 
     * @function handleEndlessScroll
     * @private
     * @returns {void}
     * @since 1.0.0
     * @example
     * // Automatically called when user scrolls near bottom
     * // Loads CONSTANTS.ENDLESS_SCROLL_INCREMENT more dreams
     * window.addEventListener('scroll', handleEndlessScroll);
     */
    function handleEndlessScroll() {
        if (getScrollDebounceTimer()) {
            clearTimeout(getScrollDebounceTimer());
        }
        
        setScrollDebounceTimer(setTimeout(async () => {
            if (!endlessScrollState.enabled || endlessScrollState.loading) return;
            
            // Throttle scroll events
            const now = Date.now();
            if (now - endlessScrollState.lastScrollTime < CONSTANTS.DEBOUNCE_SCROLL_MS) return;
            endlessScrollState.lastScrollTime = now;
            
            // Check if user scrolled near bottom
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            
            if (scrollTop + windowHeight >= documentHeight - CONSTANTS.ENDLESS_SCROLL_THRESHOLD_PX) {
                endlessScrollState.loading = true;
                
                try {
                    // Load more dreams
                    const totalDreams = await getFilteredDreamsCount();
                    if (endlessScrollState.loaded < totalDreams) {
                        endlessScrollState.loaded += CONSTANTS.ENDLESS_SCROLL_INCREMENT;
                        await withMutex('displayDreams', () => displayDreamsInternal());
                    }
                } finally {
                    endlessScrollState.loading = false;
                }
            }
        }, CONSTANTS.DEBOUNCE_SCROLL_MS));
    }

// ================================
// 9. TRADITIONAL PAGINATION SYSTEM
// ================================

    /**
     * Generates traditional pagination controls with page numbers and navigation.
     * 
     * This function creates a complete pagination interface including Previous/Next
     * buttons, numbered page buttons with intelligent ellipsis for large page counts,
     * and status information showing current range of displayed items. It handles
     * the full pagination UI generation for traditional paginated display modes.
     * 
     * @function renderPagination
     * @param {number} page - Current page number (1-indexed)
     * @param {number} totalPages - Total number of pages available
     * @param {number} totalItems - Total number of items across all pages
     * @param {number} currentItems - Number of items displayed on current page
     * @returns {string} Complete HTML string for pagination controls
     * @since 1.0.0
     * @example
     * const paginationHTML = renderPagination(3, 10, 95, 10);
     * // Returns: Previous/Next buttons, page numbers 1...2,3,4...10, "Showing 21-30 of 95 dreams"
     * 
     * @example
     * // For small page counts, shows all pages
     * const simple = renderPagination(2, 5, 42, 10);
     * // Returns: Previous, 1,2,3,4,5, Next
     */
    function renderPagination(page, totalPages, totalItems, currentItems) {
        const itemsPerPage = getItemsPerPageFromUI();
        
        const startItem = (page - 1) * itemsPerPage + 1;
        const endItem = startItem + currentItems - 1;
        
        let paginationHTML = `
            <div class="pagination">
                <button class="pagination-btn" data-action="go-to-page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>
                    ← Previous
                </button>
                
                <div class="page-numbers">
        `;
        
        // Generate page numbers with ellipsis
        const pageNumbers = generatePageNumbers(page, totalPages);
        pageNumbers.forEach(item => {
            if (item === '...') {
                paginationHTML += `<span class="page-ellipsis">...</span>`;
            } else {
                const isActive = item === page ? 'active' : '';
                paginationHTML += `<button class="page-btn ${isActive}" data-action="go-to-page" data-page="${item}">${item}</button>`;
            }
        });
        
        paginationHTML += `
                </div>
                
                <button class="pagination-btn" data-action="go-to-page" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>
                    Next →
                </button>
            </div>
            
            <div class="pagination-info" style="text-align: center; margin-top: 10px;">
                Showing ${startItem}-${endItem} of ${totalItems} dreams
            </div>
        `;
        
        return paginationHTML;
    }

    /**
     * Creates intelligent page number sequence with ellipsis for large page counts.
     * 
     * This function generates an optimal page number display that shows the current
     * page context while keeping navigation manageable. It uses ellipsis to condense
     * large page ranges and always shows first page, last page, and pages around
     * the current selection for intuitive navigation.
     * 
     * @function generatePageNumbers
     * @param {number} currentPage - Current active page number (1-indexed)
     * @param {number} totalPages - Total number of pages available
     * @returns {(number|string)[]} Array of page numbers and ellipsis strings
     * @since 1.0.0
     * @example
     * const pages = generatePageNumbers(5, 20);
     * // Returns: [1, '...', 4, 5, 6, '...', 20]
     * 
     * @example
     * // For small page counts, returns all pages
     * const allPages = generatePageNumbers(3, 7);
     * // Returns: [1, 2, 3, 4, 5, 6, 7]
     */
    function generatePageNumbers(currentPage, totalPages) {
        const pages = [];
        
        // Validate inputs
        if (!currentPage || !totalPages || currentPage < 1 || totalPages < 1) {
            return [1];
        }
        
        if (totalPages <= CONSTANTS.PAGINATION_MAX_VISIBLE_PAGES) {
            // Show all pages if 7 or fewer
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);
            
            if (currentPage > CONSTANTS.PAGINATION_CURRENT_PAGE_PROXIMITY) {
                pages.push('...');
            }
            
            // Show pages around current page
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            
            for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) {
                    pages.push(i);
                }
            }
            
            if (currentPage < totalPages - CONSTANTS.PAGINATION_ELLIPSIS_THRESHOLD) {
                pages.push('...');
            }
            
            // Always show last page
            if (!pages.includes(totalPages)) {
                pages.push(totalPages);
            }
        }
        
        return pages;
    }

    /**
     * Navigates to a specific page with validation and boundary checking.
     * 
     * This function handles page navigation in traditional pagination mode with
     * comprehensive validation including page number bounds checking, pagination
     * mode verification, and error handling. It calculates total pages dynamically
     * and updates the current page state before triggering a display refresh.
     * 
     * @async
     * @function goToPage
     * @param {string|number} page - Target page number to navigate to
     * @returns {Promise<void>} Resolves when navigation is complete and display updated
     * @throws {Error} When page calculation or display update fails
     * @since 1.0.0
     * @example
     * // Navigate to page 3
     * await goToPage(3);
     * 
     * @example
     * // Called from pagination button click
     * await goToPage(nextPage);
     */
    async function goToPage(page) {
        const limitSelect = document.getElementById('limitSelect');
        const limitValue = limitSelect ? limitSelect.value : '10';
        
        if (limitValue === 'all' || limitValue === 'endless') return; // No pagination when showing all or endless
        
        try {
            const totalDreamsCount = await getFilteredDreamsCount();
            const itemsPerPage = getItemsPerPageFromUI();
            const totalPages = Math.max(1, Math.ceil(totalDreamsCount / itemsPerPage));
            
            // Validate page number
            const pageNum = parseInt(page);
            if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) return;
            
            setCurrentPage(pageNum);
            await displayDreams();
        } catch (error) {
            console.error('Error navigating to page:', error);
            // Don't update page on error to prevent broken state
        }
    }

    /**
     * Calculates the total number of dreams matching current filter criteria.
     * 
     * This function applies the same filtering logic as the main display function
     * but only returns the count of matching dreams. It's used for pagination
     * calculations, display information, and determining whether to show pagination
     * controls. The function handles errors gracefully and returns 0 on failure.
     * 
     * @async
     * @function getFilteredDreamsCount
     * @returns {Promise<number>} Total count of dreams matching current filters
     * @since 1.0.0
     * @example
     * const count = await getFilteredDreamsCount();
     * console.log(`Found ${count} dreams matching filters`);
     * 
     * @example
     * // Use for pagination calculation
     * const totalPages = Math.ceil(await getFilteredDreamsCount() / itemsPerPage);
     */
    async function getFilteredDreamsCount() {
        try {
            const { searchTerm, filterType, startDate, endDate } = getFilterValues();
            const dreams = await loadDreams();
            if (!Array.isArray(dreams)) return 0;

            const filtered = filterDreams(dreams, searchTerm, filterType, startDate, endDate);
            return filtered.length;
        } catch (error) {
            console.error('Error counting filtered dreams:', error);
            return 0;
        }
    }

    /**
     * Resets pagination to first page when search or filter criteria change.
     * 
     * This function resets the pagination state to page 1 and also resets endless
     * scroll state to initial load amount when filters change. It ensures users
     * see results from the beginning when applying new search or filter criteria
     * and then refreshes the display with updated results.
     * 
     * @async
     * @function resetToPageOne
     * @returns {Promise<void>} Resolves when pagination is reset and display updated
     * @since 1.0.0
     * @example
     * // Reset when user enters new search term
     * await resetToPageOne();
     * 
     * @example
     * // Called by debounced search/filter functions
     * searchDebounceTimer = setTimeout(async () => {
     *   await resetToPageOne();
     * }, delay);
     */
    async function resetToPageOne() {
        setCurrentPage(1);
        
        // Reset endless scroll when filters change
        if (endlessScrollState.enabled) {
            endlessScrollState.loaded = 5;
            endlessScrollState.loading = false;
        }
        
        await displayDreams();
    }

// ================================
// 10. TAG MANAGEMENT SYSTEM
// ================================

    /**
     * Parses comma-separated tag input into a clean validated array.
     * 
     * This function processes raw tag input by splitting on commas, trimming
     * whitespace, removing duplicates (case-insensitive), enforcing length limits,
     * and restricting the total number of tags. It preserves the first-seen
     * casing of duplicate tags and handles invalid input gracefully.
     * 
     * @function parseTagsFromInput
     * @param {string} input - Comma-separated string of tags from user input
     * @returns {string[]} Clean array of validated, deduplicated tags
     * @since 1.0.0
     * @example
     * const tags = parseTagsFromInput('Flying, school, Flying, family');
     * // Returns: ['Flying', 'school', 'family']
     * 
     * @example
     * const empty = parseTagsFromInput('   ,  , ');
     * // Returns: [] (empty array for invalid input)
     */
    function parseTagsFromInput(input) {
        if (!input || typeof input !== 'string') return [];
        
        try {
            const tags = input.split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0 && tag.length <= CONSTANTS.MAX_TAG_LENGTH);
            
            // Remove duplicates, case-insensitively, preserving first-seen casing
            const seen = new Set();
            return tags.filter(tag => {
                const lower = tag.toLowerCase();
                if (seen.has(lower)) {
                    return false;
                } else {
                    seen.add(lower);
                    return true;
                }
            }).slice(0, CONSTANTS.MAX_TAGS_PER_DREAM);
        } catch (error) {
            console.error('Error parsing tags:', error);
            return [];
        }
    }

    /**
     * Formats an array of tags as HTML spans for display with XSS protection.
     * 
     * This function converts a tags array into HTML span elements with proper
     * escaping to prevent XSS attacks. Each tag is wrapped in a styled span
     * element with the 'tag' CSS class for consistent visual presentation.
     * 
     * @function formatTagsForDisplay
     * @param {string[]} tags - Array of tag strings to format
     * @returns {string} HTML string of formatted tag spans, empty if no valid tags
     * @since 1.0.0
     * @example
     * const html = formatTagsForDisplay(['flying', 'lucid', 'adventure']);
     * // Returns: '<span class="tag">flying</span><span class="tag">lucid</span><span class="tag">adventure</span>'
     * 
     * @example
     * const empty = formatTagsForDisplay([]);
     * // Returns: ''
     */
    function formatTagsForDisplay(tags) {
        if (!Array.isArray(tags) || tags.length === 0) return '';
        return tags.map(tag => 
            `<span class="tag">${escapeHtml(tag)}</span>`
        ).join('');
    }

    /**
     * Formats an array of dream signs as HTML spans with distinct styling.
     * 
     * This function converts a dream signs array into HTML span elements with
     * XSS protection and distinct styling from regular tags. Dream signs use
     * the 'dream-sign' CSS class to provide visual differentiation from normal
     * tags, helping users distinguish between themes and lucidity indicators.
     * 
     * @function formatDreamSignsForDisplay
     * @param {string[]} dreamSigns - Array of dream sign strings to format
     * @returns {string} HTML string of formatted dream sign spans, empty if no valid signs
     * @since 1.0.0
     * @example
     * const html = formatDreamSignsForDisplay(['flying', 'text-changing', 'deceased-alive']);
     * // Returns: '<span class="dream-sign">flying</span><span class="dream-sign">text-changing</span><span class="dream-sign">deceased-alive</span>'
     * 
     * @example
     * const empty = formatDreamSignsForDisplay(null);
     * // Returns: ''
     */
    function formatDreamSignsForDisplay(dreamSigns) {
        if (!Array.isArray(dreamSigns) || dreamSigns.length === 0) return '';
        return dreamSigns.map(sign => 
            `<span class="dream-sign">${escapeHtml(sign)}</span>`
        ).join('');
    }

// ================================
// 11. SEARCH & FILTER PERFORMANCE OPTIMIZATION
// ================================

    /**
     * Provides debounced search functionality to prevent excessive filtering during typing.
     * 
     * This function implements search input debouncing to avoid performance issues
     * when users type quickly. It shows a loading state immediately for responsive
     * feedback, then delays the actual search operation until typing stops. This
     * prevents excessive API calls and UI updates during rapid input changes.
     * 
     * @function debouncedSearch
     * @param {number} [delay=CONSTANTS.DEBOUNCE_SEARCH_MS] - Delay in milliseconds before executing search
     * @returns {void}
     * @since 1.0.0
     * @example
     * // Called on search input keyup events
     * searchInput.addEventListener('keyup', () => debouncedSearch());
     * 
     * @example
     * // Custom delay for slower connections
     * debouncedSearch(1000); // 1 second delay
     */
    function debouncedSearch(delay = CONSTANTS.DEBOUNCE_SEARCH_MS) {
        if (getSearchDebounceTimer()) {
            clearTimeout(getSearchDebounceTimer());
        }
        
        // Show loading state immediately for responsive feedback
        showSearchLoading();
        
        setSearchDebounceTimer(setTimeout(async () => {
            await resetToPageOne();
            hideSearchLoading();
        }, delay));
    }

    /**
     * Provides debounced filter functionality for dropdown selection changes.
     * 
     * This function implements filter selection debouncing to prevent excessive
     * processing when users rapidly change filter options. Similar to search
     * debouncing but optimized for dropdown interactions, it shows loading state
     * and delays filter application until selections stabilize.
     * 
     * @function debouncedFilter
     * @param {number} [delay=CONSTANTS.DEBOUNCE_FILTER_MS] - Delay in milliseconds before applying filter
     * @returns {void}
     * @since 1.0.0
     * @example
     * // Called on filter dropdown change events
     * filterSelect.addEventListener('change', () => debouncedFilter());
     * 
     * @example
     * // Immediate filter for simple selections
     * debouncedFilter(100); // Short delay for responsive feel
     */
    function debouncedFilter(delay = CONSTANTS.DEBOUNCE_FILTER_MS) {
        if (getFilterDebounceTimer()) {
            clearTimeout(getFilterDebounceTimer());
        }

        showSearchLoading();

        setFilterDebounceTimer(setTimeout(async () => {
            try {
                // Validate filter inputs before applying
                const filterValues = getFilterValues();
                const validation = await validateFilterInputs(filterValues);

                // Show validation errors or warnings if any
                if (!validation.isValid) {
                    const { ErrorMessenger } = await import('./error-messenger.js');
                    await ErrorMessenger.showError('DREAM_FILTER_VALIDATION_ERROR', validation, {
                        duration: 8000
                    });
                } else if (validation.warnings && validation.warnings.length > 0) {
                    const { ErrorMessenger } = await import('./error-messenger.js');
                    await ErrorMessenger.showWarning('DREAM_FILTER_WARNING', validation, {
                        duration: 6000
                    });
                }

                // Apply filters even if there are warnings (but not errors)
                if (validation.isValid) {
                    await resetToPageOne();
                }
            } catch (error) {
                console.error('Filter validation error:', error);
                // Continue with filtering even if validation fails
                await resetToPageOne();
            } finally {
                hideSearchLoading();
            }
        }, delay));
    }

/**
 * Clears all search and filter criteria to their default values.
 *
 * Resets all search and filter controls in the dreams interface to their default
 * empty/default state, including search box, lucidity filter, and date range filters.
 * After clearing, automatically triggers a filter refresh to show all dreams.
 *
 * @function clearSearchFilters
 * @returns {void}
 * @since 2.04.15
 * @example
 * // Clear all filters and show all dreams
 * clearSearchFilters();
 * // Result: Search box empty, filter set to "All Dreams", dates cleared
 */
function clearSearchFilters() {
    try {
        // Clear search box
        const searchBox = document.getElementById('searchBox');
        if (searchBox) {
            searchBox.value = '';
        }

        // Reset lucidity filter to "All Dreams"
        const filterSelect = document.getElementById('filterSelect');
        if (filterSelect) {
            filterSelect.value = 'all';
        }

        // Clear date range filters
        const startDateInput = document.getElementById('startDateFilter');
        if (startDateInput) {
            startDateInput.value = '';
        }

        const endDateInput = document.getElementById('endDateFilter');
        if (endDateInput) {
            endDateInput.value = '';
        }

        // Trigger filter refresh to show all dreams
        debouncedFilter(50); // Short delay for responsive feel

        // Provide user feedback
        const { createInlineMessage } = import('./dom-helpers.js');
        createInlineMessage.then(fn => {
            fn('success', 'Search and filters cleared', {
                container: document.querySelector('.search-filter-section'),
                position: 'bottom',
                duration: 2000
            });
        });

    } catch (error) {
        console.error('Error clearing search filters:', error);
    }
}

// ================================
// ES MODULE EXPORTS
// ================================

export {
    // Encryption helper functions
    shouldEncryptDream,

    // Core CRUD operations
    saveDream,
    editDream,
    saveDreamEdit,
    cancelDreamEdit,
    deleteDream,
    confirmDelete,
    cancelDelete,
    
    // Display and rendering functions
    displayDreams,
    buildDreamDataForDisplay,
    generateDreamHTML,
    renderDreamHTML,
    
    // Filtering and sorting
    filterDreams,
    sortDreams,
    getFilterValues,
    validateFilterInputs,
    getFilteredDreamsCount,
    
    // Pagination functions
    calculatePaginationParams,
    configurePaginationMode,
    calculatePagination,
    renderPaginationHTML,
    renderPagination,
    goToPage,
    resetToPageOne,
    
    // Endless scroll functions
    setupEndlessScroll,
    removeEndlessScroll,
    handleEndlessScroll,
    
    // Utility functions
    getItemsPerPageFromUI,
    formatDatetimeLocal,
    clearDreamForm,
    resetPaginationToFirst,
    parseTagsFromInput,
    formatTagsForDisplay,
    formatDreamSignsForDisplay,
    
    // Debounced functions
    debouncedSearch,
    debouncedFilter,

    // UI helper functions
    showLoadingMessage,
    showNoResultsMessage,
    clearPagination,
    clearSearchFilters
};