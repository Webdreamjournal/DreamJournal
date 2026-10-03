/**
 * @fileoverview Search loading indicators and the tag, emotion and dream sign autocomplete: setup, lazy
 *   loading and the Settings management list.
 *
 * @module AutocompleteUi
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { commonTags, commonDreamSigns, commonEmotions, CONSTANTS } from './constants.js';
import { asyncMutex } from './state.js';
import { getAutocompleteSuggestions } from './storage.js';
import { escapeHtml, escapeAttr } from './ui-basics.js';

// ===================================================================================
// LOADING STATE MANAGEMENT
// ===================================================================================

/**
 * Displays loading indicator during search/filter operations.
 * 
 * Shows a search-specific loading indicator in the entries container, with protection
 * against duplicate indicators. Only displays if the display mutex is not locked,
 * preventing conflicts with other display operations.
 * 
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Show loading before search operation
 * showSearchLoading();
 * performSearchOperation().then(() => {
 *   hideSearchLoading();
 * });
 * 
 * @example
 * // Automatic duplicate prevention
 * showSearchLoading();
 * showSearchLoading(); // Second call has no effect
 */
function showSearchLoading() {
        const container = document.getElementById('entriesContainer');
        if (container && !asyncMutex.displayDreams.locked) {
            const existingLoader = container.querySelector('.loading-state');
            if (!existingLoader) {
                const loader = document.createElement('div');
                loader.className = 'loading-state';
                loader.innerHTML = '🔍 Searching dreams...';
                container.appendChild(loader);
            }
        }
    }

/**
 * Hides search/filter loading indicator.
 * 
 * Removes any active loading indicators from the entries container, typically
 * called after search or filter operations complete.
 * 
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Hide loading after search completes
 * performSearch().finally(() => {
 *   hideSearchLoading();
 * });
 */
function hideSearchLoading() {
        const container = document.getElementById('entriesContainer');
        if (container) {
            const loader = container.querySelector('.loading-state');
            if (loader) {
                loader.remove();
            }
        }
    }

    

// ===================================================================================
// AUTOCOMPLETE MANAGEMENT INTERFACE
// ===================================================================================

/**
 * Initialize autocomplete system with tag and dream sign suggestions.
 * 
 * This function sets up the autocomplete functionality for dream tags and dream signs
 * input fields. It loads previously used suggestions from IndexedDB storage to provide
 * personalized autocomplete options based on the user's history. If storage access fails,
 * it falls back to predefined common tags and dream signs from the constants module.
 * 
 * The autocomplete system helps users quickly enter consistent tags and dream signs,
 * improving data quality and user experience during dream entry creation.
 * 
 * @async
 * @function
 * @returns {Promise<void>} Promise that resolves when autocomplete is initialized
 * @throws {Error} When storage access fails (handled gracefully with fallback)
 * @since 1.5.0
 * @example
 * await initializeAutocomplete();
 * // Tag and dream sign inputs now have autocomplete functionality
 * 
 * @see {@link getAutocompleteSuggestions} For suggestion retrieval
 * @see {@link setupTagAutocomplete} For autocomplete UI setup
 */
async function initializeAutocomplete() {
    try {
        // Check if encryption is enabled
        const { getEncryptionEnabled } = await import('./state.js');

        if (getEncryptionEnabled()) {
            // For encrypted data, set up lazy loading autocomplete
            // Data will only be decrypted when user actually focuses on input fields
            setupLazySecureAutocomplete('dreamTags', 'tags');
            setupLazySecureAutocomplete('dreamSigns', 'dreamSigns');
            setupLazySecureAutocomplete('dreamEmotions', 'emotions');
        } else {
            // For unencrypted data, use normal initialization
            const [tags, signs, emotions] = await Promise.all([
                getAutocompleteSuggestions('tags'),
                getAutocompleteSuggestions('dreamSigns'),
                getAutocompleteSuggestions('emotions')
            ]);
            setupTagAutocomplete('dreamTags', tags);
            setupTagAutocomplete('dreamSigns', signs);
            setupTagAutocomplete('dreamEmotions', emotions);
        }
    } catch (error) {
        console.error("Failed to initialize autocomplete:", error);
        setupTagAutocomplete('dreamTags', commonTags);
        setupTagAutocomplete('dreamSigns', commonDreamSigns);
        setupTagAutocomplete('dreamEmotions', commonEmotions);
    }
}

/**
 * Sets up secure lazy-loading autocomplete for encrypted data.
 *
 * This function implements a security-conscious approach to autocomplete for encrypted data.
 * Instead of loading and decrypting all autocomplete data at startup, it only decrypts
 * data when the user actually focuses on the input field, and clears it from memory
 * after a timeout to minimize exposure of sensitive data.
 *
 * **Security Features:**
 * - Data is only decrypted when needed (on focus)
 * - Decrypted data is cleared from memory after use
 * - Reduces exposure window for sensitive autocomplete data
 * - Falls back to common defaults if decryption fails
 *
 * @async
 * @function
 * @param {string} elementId - ID of the input element to attach autocomplete to
 * @param {('tags'|'dreamSigns')} dataType - Type of autocomplete data to load
 * @returns {void}
 * @since 2.03.04
 * @example
 * setupLazySecureAutocomplete('dreamTags', 'tags');
 * // Autocomplete data will only be decrypted when user focuses on the input
 */
async function setupLazySecureAutocomplete(elementId, dataType) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let decryptedData = null;
    let timeoutId = null;

    // Function to clear sensitive data from memory
    const clearSensitiveData = () => {
        if (decryptedData) {
            // Overwrite array contents for security
            decryptedData.fill('');
            decryptedData = null;
        }
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    // Set up focus event to decrypt data on demand
    element.addEventListener('focus', async () => {
        try {
            // Clear any existing timeout
            if (timeoutId) clearTimeout(timeoutId);

            // Decrypt data if not already available
            if (!decryptedData) {
                const { getAutocompleteSuggestions } = await import('./storage.js');
                decryptedData = await getAutocompleteSuggestions(dataType);
            }

            // Set up autocomplete with decrypted data
            setupTagAutocomplete(elementId, decryptedData);

            // Set timeout to clear data after 5 minutes of inactivity
            timeoutId = setTimeout(clearSensitiveData, 5 * 60 * 1000);

        } catch (error) {
            console.error(`Failed to load secure autocomplete for ${dataType}:`, error);
            // Fall back to default data
            const { commonTags, commonDreamSigns } = await import('./constants.js');
            const fallbackData = dataType === 'tags' ? commonTags : commonDreamSigns;
            setupTagAutocomplete(elementId, fallbackData);
        }
    });

    // Clear data when user leaves the field
    element.addEventListener('blur', () => {
        // Set a shorter timeout when user leaves the field
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(clearSensitiveData, 30 * 1000); // 30 seconds
    });

    // Clear data when page is about to unload
    window.addEventListener('beforeunload', clearSensitiveData);
}

/**
 * Renders autocomplete management list for tags or dream signs.
 *
 * Creates an interactive list of autocomplete suggestions with delete functionality.
 * Handles loading states, empty states, and error conditions gracefully. All items
 * are treated uniformly with delete capabilities.
 * 
 * @async
 * @param {('tags'|'dreamSigns'|'emotions')} type - Type of autocomplete items to render
 * @returns {Promise<void>}
 * @throws {TypeError} When type is not 'tags', 'dreamSigns', or 'emotions'
 * @throws {Error} When autocomplete suggestions cannot be loaded
 * @since 1.0.0
 * @example
 * // Render tags management interface
 * await renderAutocompleteManagementList('tags');
 *
 * @example
 * // Render dream signs management interface
 * await renderAutocompleteManagementList('dreamSigns');
 *
 * @example
 * // Render emotions management interface
 * await renderAutocompleteManagementList('emotions');
 * 
 * @example
 * // Error handling
 * try {
 *   await renderAutocompleteManagementList('tags');
 * } catch (error) {
 *   console.error('Failed to render management list:', error);
 * }
 */
async function renderAutocompleteManagementList(type) {
        const containerId = type === 'tags' ? 'tagsManagementList' : type === 'dreamSigns' ? 'dreamSignsManagementList' : 'emotionsManagementList';
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<div class="loading-state">Loading...</div>';

        try {
            // Get the unified list of suggestions. This now correctly reads from the new store.
            const suggestions = await getAutocompleteSuggestions(type);

            if (suggestions.length === 0) {
                container.innerHTML = `<div class="no-entries" style="padding: 15px;">No custom items added yet.</div>`;
                return;
            }

            // All items are now treated the same. No more 'default' vs 'user' distinction.
            const listHtml = suggestions.map(item => {
                return `
                    <div class="autocomplete-list-item">
                        <span class="item-value">${escapeHtml(item)}</span>
                        <div class="flex-center gap-sm">
                            <button data-action="delete-autocomplete-item" data-item-type="${type}" data-item-id="${escapeAttr(item)}" class="btn btn-delete btn-small">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = listHtml;
        } catch (error) {
            console.error(`Error rendering ${type} list:`, error);

            // Provide user-friendly error messages based on error type
            let errorMessage = `Failed to load ${type} list.`;
            if (error.message.includes('Encryption password required')) {
                errorMessage = `Failed to load ${type} list. Encryption password required.`;
            } else if (error.message.includes('password')) {
                errorMessage = `Failed to load ${type} list. Check encryption status.`;
            }

            container.innerHTML = `<div class="message-error">${errorMessage}</div>`;
        }
    }

/**
 * Sets up autocomplete functionality for tag input fields.
 * 
 * Creates a dropdown interface with suggestions that filters based on user input.
 * Supports comma-separated tag entry and prevents duplicate tag suggestions.
 * Includes click-outside handling and keyboard navigation support.
 * 
 * @param {string} inputId - ID of the input element to enhance with autocomplete
 * @param {string[]} suggestions - Array of available tag suggestions
 * @returns {void}
 * @throws {TypeError} When inputId is not a string or suggestions is not an array
 * @since 1.0.0
 * @example
 * // Setup autocomplete for dream tags
 * const tagSuggestions = ['lucid', 'nightmare', 'flying', 'recurring'];
 * setupTagAutocomplete('dreamTagsInput', tagSuggestions);
 * 
 * @example
 * // Autocomplete behavior
 * // User types "lu" -> shows "lucid" in dropdown
 * // User clicks "lucid" -> input becomes "lucid, "
 * // User types "fl" -> shows "flying" (filters out already selected)
 */
function setupTagAutocomplete(inputId, suggestions) {
        const input = document.getElementById(inputId);
        if (!input || !Array.isArray(suggestions)) return;

        // Remove existing listener to prevent duplicates
        if (input.autocompleteListener) {
            input.removeEventListener('input', input.autocompleteListener);
        }
        if (input.autocompleteDropdown) {
            input.autocompleteDropdown.remove();
        }

        // Create autocomplete dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'tag-autocomplete-dropdown';
        input.autocompleteDropdown = dropdown;

        // Position container relatively
        if (input.parentElement) {
            input.parentElement.style.position = 'relative';
            input.parentElement.appendChild(dropdown);
        }

        const listener = function() {
            const value = this.value.toLowerCase();
            const lastComma = value.lastIndexOf(',');
            const currentTag = lastComma >= 0 ? value.substring(lastComma + 1).trim() : value.trim();

            if (currentTag.length < CONSTANTS.AUTOCOMPLETE_MIN_CHARS) {
                dropdown.style.display = 'none';
                return;
            }

            const matches = suggestions.filter(suggestion => 
                suggestion.toLowerCase().includes(currentTag) &&
                !value.toLowerCase().includes(suggestion.toLowerCase())
            ).slice(0, CONSTANTS.AUTOCOMPLETE_MAX_RESULTS);

            if (matches.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            dropdown.innerHTML = matches.map(match => 
                `<div class="autocomplete-item" data-tag="${escapeAttr(match)}">
                    ${escapeHtml(match)}
                </div>`
            ).join('');

            dropdown.style.display = 'block';

            // Add click handlers
            dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', function() {
                    const tag = this.dataset.tag;
                    if (tag) {
                        const currentValue = input.value;
                        const lastComma = currentValue.lastIndexOf(',');
                        
                        if (lastComma >= 0) {
                            input.value = currentValue.substring(0, lastComma + 1) + ' ' + tag + ', ';
                        } else {
                            input.value = tag + ', ';
                        }
                        
                        dropdown.style.display = 'none';
                        input.focus();
                    }
                });
            });
        };
        
        input.autocompleteListener = listener;
        input.addEventListener('input', listener);

        // Hide dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (dropdown && !input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }

// ================================
// ES MODULE EXPORTS
// ================================

export {
    showSearchLoading,
    hideSearchLoading,
    initializeAutocomplete,
    setupLazySecureAutocomplete,
    renderAutocompleteManagementList,
    setupTagAutocomplete
};
