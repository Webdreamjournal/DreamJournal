// ================================
// DREAM CRUD OPERATIONS MODULE
// ================================
// Complete dream management system including creation, editing, deletion,
// display, filtering, sorting, pagination, and search functionality

// ================================
// 1. CORE DREAM CRUD OPERATIONS
// ================================

// Save a new dream entry to storage with validation and error handling
// Handles both IndexedDB fast path and fallback storage methods
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
            const errorMsg = document.createElement('div');
            errorMsg.className = 'message-error text-sm mt-sm';
            errorMsg.textContent = 'Please enter a dream description before saving.';
            contentElement.parentElement.appendChild(errorMsg);
            
            setTimeout(() => {
                contentElement.style.borderColor = 'var(--border-color)';
                errorMsg.remove();
            }, 3000);
            return;
        }

        const tags = parseTagsFromInput(tagsElement.value);
        const dreamSigns = parseTagsFromInput(dreamSignsElement.value);

        await learnAutocompleteItems(tags, 'tags');
        await learnAutocompleteItems(dreamSigns, 'dreamSigns');

        const dreamDate = dreamDateElement.value ? new Date(dreamDateElement.value) : new Date();
        
        const newDream = {
            id: generateUniqueId(),
            title: titleElement.value.trim() || 'Untitled Dream',
            content: contentElement.value.trim(),
            emotions: emotionsElement.value.trim(),
            tags: tags,
            dreamSigns: dreamSigns,
            timestamp: dreamDate.toISOString(),
            isLucid: isLucidElement.checked,
            dateString: dreamDate.toLocaleDateString('en-AU', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })
        };
        
        // Try fast path first
        let saveSuccess = false;
        if (isIndexedDBAvailable()) {
            saveSuccess = await addDreamToIndexedDB(newDream);
        }
        
        // Fallback if the fast method fails
        if (!saveSuccess) {
            const dreams = await loadDreams();
            dreams.unshift(newDream);
            await saveDreams(dreams);
        }
        
        // TODO: Split into clearDreamForm() and resetCurrentPage() functions
        // Clear all form fields after successful save
        titleElement.value = '';
        contentElement.value = '';
        isLucidElement.checked = false;
        emotionsElement.value = '';
        tagsElement.value = '';
        dreamSignsElement.value = '';
        
        // Reset date field to current timestamp for next entry
        const now = new Date();
        const localDatetimeString = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}T${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        dreamDateElement.value = localDatetimeString;
        
        // Reset pagination to show newly added dream at top
        currentPage = 1;
        
        createInlineMessage('success', 'Dream saved successfully!', {
            container: document.querySelector('.entry-form'),
            position: 'bottom'
        });
        
        await displayDreams();
        await initializeAutocomplete();
    }

// ================================
// 2. DREAM DISPLAY SYSTEM
// ================================

// Main entry point for displaying dreams with mutex protection
// Prevents race conditions during concurrent display operations
    async function displayDreams() {
        return withMutex('displayDreams', displayDreamsInternal);
    }
    
    // Internal implementation of dream display with full filtering and pagination
    // Protected by mutex to prevent concurrent execution issues
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
            
            // Filter and sort dreams
            let filteredDreams = filterDreams(dreams, searchTerm, filterType, startDate, endDate);
            filteredDreams = sortDreams(filteredDreams, sortType);
            
            // Handle no results
            if (filteredDreams.length === 0) {
                showNoResultsMessage(container, filterType, searchTerm);
                clearPagination();
                return;
            }
            
            // Calculate pagination
            const { paginatedDreams, totalPages, totalDreams } = calculatePagination(filteredDreams, limitValue);
            
            // Render dreams
            container.innerHTML = paginatedDreams.map(renderDreamHTML).filter(html => html).join('');
            
            // Render pagination
            renderPaginationHTML(limitValue, totalPages, totalDreams, paginatedDreams);
            
        } finally {
            hideSearchLoading();
        }
    }

// ================================
// 3. DREAM FILTERING & SORTING SYSTEM
// ================================
    
    // Apply search term and filter criteria to dream collection
    // Handles text search across multiple fields and date range filtering
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
    
    // Apply selected sort order to filtered dream collection
    // Supports newest/oldest, lucid-first, and longest content sorting
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

    // Display inline edit form for existing dream entry
    // Converts dream display into editable form with pre-populated values
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
            
            // TODO: Extract formatDatetimeLocal() helper function for reuse
            // Convert ISO timestamp to datetime-local input format
            let datetimeLocalValue = '';
            try {
                const dreamDateTime = new Date(dream.timestamp);
                let dateToFormat;
                if (!isNaN(dreamDateTime.getTime())) {
                    dateToFormat = dreamDateTime;
                } else {
                    dateToFormat = new Date(); // Fallback to current time
                }
                const year = dateToFormat.getFullYear();
                const month = (dateToFormat.getMonth() + 1).toString().padStart(2, '0');
                const day = dateToFormat.getDate().toString().padStart(2, '0');
                const hours = dateToFormat.getHours().toString().padStart(2, '0');
                const minutes = dateToFormat.getMinutes().toString().padStart(2, '0');
                datetimeLocalValue = `${year}-${month}-${day}T${hours}:${minutes}`;
            } catch (error) {
                // Fallback for invalid timestamps - use current time
                const now = new Date();
                const year = now.getFullYear();
                const month = (now.getMonth() + 1).toString().padStart(2, '0');
                const day = now.getDate().toString().padStart(2, '0');
                const hours = now.getHours().toString().padStart(2, '0');
                const minutes = now.getMinutes().toString().padStart(2, '0');
                datetimeLocalValue = `${year}-${month}-${day}T${hours}:${minutes}`;
            }
            
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

    // Process and save changes from dream edit form
    // Updates existing dream with new values and refreshes display
    async function saveDreamEdit(dreamId) {
        const newContentElement = document.getElementById(`edit-content-${dreamId}`);
        if (!newContentElement?.value.trim()) {
            newContentElement.style.borderColor = 'var(--error-color)';
            return;
        }

        const newTags = parseTagsFromInput(document.getElementById(`edit-tags-${dreamId}`).value);
        const newDreamSigns = parseTagsFromInput(document.getElementById(`edit-dreamsigns-${dreamId}`).value);

        await learnAutocompleteItems(newTags, 'tags');
        await learnAutocompleteItems(newDreamSigns, 'dreamSigns');

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
            dateString: newDate.toLocaleDateString('en-AU', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }),
            lastModified: new Date().toISOString()
        };

        // Try fast path first
        let updateSuccess = false;
        if (isIndexedDBAvailable()) {
            updateSuccess = await updateDreamInIndexedDB(updatedDream);
        }
        
        // Fallback if the fast method fails
        if (!updateSuccess) {
            const dreams = await loadDreams();
            const dreamIndex = dreams.findIndex(d => d.id.toString() === dreamId.toString());
            if (dreamIndex !== -1) {
                dreams[dreamIndex] = updatedDream;
                await saveDreams(dreams);
            }
        }
        await displayDreams();
        await initializeAutocomplete();
    }

    // Cancel dream edit operation and return to display view
    // Discards any unsaved changes and refreshes the dream list
    async function cancelDreamEdit(dreamId) {
        await displayDreams();
    }

// ================================
// 5. DREAM DELETION SYSTEM
// ================================

    // Initiate dream deletion with confirmation UI
    // Shows confirm button and sets auto-cancel timeout for safety
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

    // Execute confirmed dream deletion from storage
    // Protected by mutex to prevent concurrent deletion operations
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

                currentPage = 1;
                await displayDreams();

            } catch (error) {
                console.error(`Error in confirmDelete for dreamId ${dreamId}:`, error);
                createInlineMessage('error', 'Error deleting dream. Please refresh and try again.', {
                    container: document.querySelector('.main-content'),
                    position: 'top',
                    duration: 5000
                });
            }
        });
    }

    // Cancel delete operation and restore original delete button
    // Removes pending deletion state and clears timeout
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
    
    // Extract current search and filter settings from UI controls
    // Returns object with all filter parameters for dream processing
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
    
    // Display loading indicator for large datasets
    // Provides user feedback during dream processing
    function showLoadingMessage(container, dreamCount) {
        container.innerHTML = `
            <div class="loading-state large">
                <div>🌙</div>
                <div>Loading ${dreamCount} dreams...</div>
            </div>
        `;
    }
    
    // Generate contextual no-results message based on current filters
    // Provides helpful guidance for different filter states
    function showNoResultsMessage(container, filterType, searchTerm) {
        const filterText = filterType === 'all' ? '' : 
            filterType === 'lucid' ? ' lucid' : ' non-lucid';
        
        let message;
        if (searchTerm) {
            message = `No${filterText} dreams found matching your search.`;
        } else if (filterType === 'lucid') {
            message = 'No lucid dreams recorded yet. Mark dreams as lucid when you achieve lucidity!';
        } else if (filterType === 'non-lucid') {
            message = 'No non-lucid dreams found.';
        } else {
            message = 'No dreams recorded yet. Start by adding your first dream above!';
        }
        
        container.innerHTML = `<div class="no-entries">${message}</div>`;
    }
    
    // Remove pagination controls from display
    // Used when no results are found or pagination is not needed
    function clearPagination() {
        const paginationContainer = document.getElementById('paginationContainer');
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }
    }

// ================================
// 7. PAGINATION & ENDLESS SCROLL SYSTEM
// ================================

    // TODO: Split into calculatePaginationParams() and configurePaginationMode() functions
    // This function handles both calculation logic and UI state management
    // Calculate pagination parameters and configure endless scroll if enabled
    // Handles different display modes: paginated, endless scroll, and show all
    function calculatePagination(filteredDreams, limitValue) {
        if (!Array.isArray(filteredDreams)) {
            return { paginatedDreams: [], totalPages: 1, totalDreams: 0, itemsPerPage: 1 };
        }
        
        const totalDreams = Math.max(0, filteredDreams.length);
        let itemsPerPage, totalPages, paginatedDreams;
        
        try {
            if (limitValue === 'endless') {
                endlessScrollState.enabled = true;
                if (!endlessScrollState.loading) {
                    endlessScrollState.loaded = Math.max(CONSTANTS.ENDLESS_SCROLL_INCREMENT, endlessScrollState.loaded || CONSTANTS.ENDLESS_SCROLL_INCREMENT);
                    setupEndlessScroll();
                }
                const safeLoaded = Math.min(endlessScrollState.loaded, totalDreams);
                paginatedDreams = filteredDreams.slice(0, safeLoaded);
                totalPages = 1;
                itemsPerPage = safeLoaded;
            } else if (limitValue === 'all') {
                endlessScrollState.enabled = false;
                removeEndlessScroll();
                itemsPerPage = Math.max(1, totalDreams);
                totalPages = 1;
                currentPage = 1;
                paginatedDreams = filteredDreams;
            } else {
                endlessScrollState.enabled = false;
                removeEndlessScroll();
                itemsPerPage = Math.max(1, Math.min(parseInt(limitValue) || 10, 1000)); // Cap at 1000 for safety
                totalPages = Math.max(1, Math.ceil(totalDreams / itemsPerPage));
                
                // Validate and fix current page with safety bounds
                currentPage = Math.max(1, Math.min(currentPage, totalPages));
                
                const startIndex = Math.max(0, (currentPage - 1) * itemsPerPage);
                const endIndex = Math.min(startIndex + itemsPerPage, totalDreams);
                paginatedDreams = filteredDreams.slice(startIndex, endIndex);
            }
            
            return { paginatedDreams, totalPages, totalDreams, itemsPerPage };
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
    
    // TODO: Split into buildDreamDataForDisplay() and generateDreamHTML() functions
    // Currently combines data processing and HTML template generation
    // Generate secure HTML representation of a single dream entry
    // Handles XSS prevention and proper formatting of all dream fields
    function renderDreamHTML(dream) {
        if (!dream || typeof dream !== 'object' || !dream.id) return '';
        
        try {
            const safeTitle = escapeHtml((dream.title || 'Untitled Dream').toString());
            const safeContent = escapeHtml((dream.content || '').toString());
            const safeDateString = escapeHtml((dream.dateString || 'Unknown Date').toString());
            const safeEmotions = escapeHtml((dream.emotions || '').toString());
            const isLucid = Boolean(dream.isLucid);
            
            // Format emotions for display
            const emotionsDisplay = safeEmotions ? 
                `<div class="entry-emotions">
                    <span>Emotions:</span> ${safeEmotions}
                </div>` : '';
            
            // Format tags and dream signs for display
            const tags = Array.isArray(dream.tags) ? dream.tags : [];
            const dreamSigns = Array.isArray(dream.dreamSigns) ? dream.dreamSigns : [];
            
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
            
            const safeDreamId = escapeAttr(dream.id.toString());
            
            // Create action buttons using helper
            const actionButtons = `<div class="entry-actions">
                ${createActionButton('edit-dream', safeDreamId, 'Edit', 'btn btn-edit btn-small')}
                ${createActionButton('delete-dream', safeDreamId, 'Delete', 'btn btn-delete btn-small')}
            </div>`;
            
            return `
                <div class="entry ${isLucid ? 'lucid' : ''}" id="entry-${safeDreamId}">
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
        } catch (error) {
            console.error('Error rendering dream HTML:', error);
            return `<div class="entry error">Error displaying dream</div>`;
        }
    }
    
    // Generate pagination status and controls based on current display mode
    // Handles endless scroll status, traditional pagination, or no pagination
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
            paginationContainer.innerHTML = renderPagination(currentPage, totalPages, totalDreams, paginatedDreams.length);
        } else {
            paginationContainer.innerHTML = '';
        }
    }

// ================================
// 8. ENDLESS SCROLL IMPLEMENTATION
// ================================

    // Initialize endless scroll event listener with debouncing
    // Removes existing listeners to prevent duplicates
    function setupEndlessScroll() {
        // Remove existing scroll listener to prevent duplicates
        removeEndlessScroll();
        
        // Add scroll listener with debouncing
        window.addEventListener('scroll', handleEndlessScroll);
    }

    // Clean up endless scroll event listener
    // Called when switching away from endless scroll mode
    function removeEndlessScroll() {
        window.removeEventListener('scroll', handleEndlessScroll);
    }

    function handleEndlessScroll() {
        if (scrollDebounceTimer) {
            clearTimeout(scrollDebounceTimer);
        }
        
        scrollDebounceTimer = setTimeout(async () => {
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
        }, CONSTANTS.DEBOUNCE_SCROLL_MS);
    }

// ================================
// 9. TRADITIONAL PAGINATION SYSTEM
// ================================

    // Generate traditional pagination controls with page numbers and navigation
    // Creates Previous/Next buttons and numbered page buttons with ellipsis
    function renderPagination(page, totalPages, totalItems, currentItems) {
        // TODO: Extract getItemsPerPageFromUI() helper function - duplicated pattern
        const limitSelect = document.getElementById('limitSelect');
        const limitValue = limitSelect ? limitSelect.value : '10';
        const itemsPerPage = Math.max(1, parseInt(limitValue) || 10);
        
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

    // Create intelligent page number sequence with ellipsis for large page counts
    // Shows current page context while keeping navigation manageable
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

    // Navigate to specific page with validation and boundary checking
    // Only works in traditional pagination mode (not endless scroll or show all)
    async function goToPage(page) {
        // TODO: Extract getItemsPerPageFromUI() helper function - duplicated pattern
        const limitSelect = document.getElementById('limitSelect');
        const limitValue = limitSelect ? limitSelect.value : '10';
        
        if (limitValue === 'all' || limitValue === 'endless') return; // No pagination when showing all or endless
        
        try {
            const totalDreamsCount = await getFilteredDreamsCount();
            const itemsPerPage = Math.max(1, parseInt(limitValue) || 10);
            const totalPages = Math.max(1, Math.ceil(totalDreamsCount / itemsPerPage));
            
            // Validate page number
            const pageNum = parseInt(page);
            if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) return;
            
            currentPage = pageNum;
            await displayDreams();
        } catch (error) {
            console.error('Error navigating to page:', error);
            // Don't update page on error to prevent broken state
        }
    }

    // Calculate total number of dreams matching current filter criteria
    // Used for pagination calculations and display information
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

    // Reset pagination to first page when search/filter criteria change
    // Also resets endless scroll state to initial load amount
    async function resetToPageOne() {
        currentPage = 1;
        
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

    // Parse comma-separated tag input into clean array with validation
    // Removes duplicates, limits length, and enforces maximum tag count
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

    // Format tags array as HTML spans for display
    // Applies XSS protection and proper styling
    function formatTagsForDisplay(tags) {
        if (!Array.isArray(tags) || tags.length === 0) return '';
        return tags.map(tag => 
            `<span class="tag">${escapeHtml(tag)}</span>`
        ).join('');
    }

    // Format dream signs array as HTML spans for display
    // Uses distinct styling from regular tags
    function formatDreamSignsForDisplay(dreamSigns) {
        if (!Array.isArray(dreamSigns) || dreamSigns.length === 0) return '';
        return dreamSigns.map(sign => 
            `<span class="dream-sign">${escapeHtml(sign)}</span>`
        ).join('');
    }

// ================================
// 11. SEARCH & FILTER PERFORMANCE OPTIMIZATION
// ================================

    // Debounced search function to prevent excessive filtering during typing
    // Shows loading state immediately for responsive user feedback
    function debouncedSearch(delay = CONSTANTS.DEBOUNCE_SEARCH_MS) {
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }
        
        // Show loading state immediately for responsive feedback
        showSearchLoading();
        
        searchDebounceTimer = setTimeout(async () => {
            await resetToPageOne();
            hideSearchLoading();
        }, delay);
    }

    // Debounced filter function to prevent excessive processing during selection changes
    // Similar to search debouncing but for dropdown filter changes
    function debouncedFilter(delay = CONSTANTS.DEBOUNCE_FILTER_MS) {
        if (filterDebounceTimer) {
            clearTimeout(filterDebounceTimer);
        }
        
        showSearchLoading();
        
        filterDebounceTimer = setTimeout(async () => {
            await resetToPageOne();
            hideSearchLoading();
        }, delay);
    }