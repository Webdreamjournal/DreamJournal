    // ===================================================================================
    // SECTION 4: DATABASE & STORAGE
    // ===================================================================================

    // Database Constants and Setup
    const DB_NAME = 'DreamJournal';
    const DB_VERSION = CONSTANTS.DB_VERSION; // Increment for voice notes support
    const STORE_NAME = 'dreams';
    const VOICE_STORE_NAME = 'voiceNotes';
    let db = null;
    let storageType = 'memory'; // Track which storage is being used

    // Show warning when storage isn't persistent
    function showStorageWarning() {
        const warning = document.createElement('div');
        warning.id = 'storageWarning';
        warning.className = 'message-warning mb-lg mx-lg';
        warning.innerHTML = `
            ⚠️ <strong>Storage Warning:</strong> Your dreams are stored temporarily in memory only. 
            <br>They will be lost when you close this tab. Please export your dreams regularly!
            <br><small>To enable permanent storage, access this page through a web server.</small>
        `;
        
        const container = document.querySelector('.container');
        container.insertBefore(warning, container.children[2]);
    }

    // TAG & DREAM SIGN MANAGEMENT FUNCTIONS

    // Generic function to load a single item from a given store by ID
    async function loadItemFromStore(storeName, id) {
        if (!isIndexedDBAvailable()) return null;

        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(storeName)) {
                    console.warn(`Store '${storeName}' not found in database.`);
                    resolve(null);
                    return;
                }

                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(id);

                request.onsuccess = () => {
                    resolve(request.result || null);
                };

                request.onerror = () => {
                    console.error(`Error loading item with id '${id}' from store '${storeName}':`, request.error);
                    resolve(null);
                };
            } catch (error) {
                console.error(`Error creating transaction for store '${storeName}':`, error);
                resolve(null);
            }
        });
    }

    // Generic function to load all items from a given store
    async function loadFromStore(storeName) {
        if (!isIndexedDBAvailable()) return [];
        
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(storeName)) {
                    console.warn(`Store '${storeName}' not found in database.`);
                    resolve([]);
                    return;
                }

                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();

                request.onsuccess = () => {
                    const items = request.result || [];
                    resolve(items);
                };

                request.onerror = () => {
                    console.error(`Error loading from store '${storeName}':`, request.error);
                    resolve([]);
                };
            } catch (error) {
                console.error(`Error creating transaction for store '${storeName}':`, error);
                resolve([]);
            }
        });
    }

    // Generic function to save/update a single item in a store
    async function saveItemToStore(storeName, item) {
        if (!isIndexedDBAvailable()) return false;

        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(storeName)) {
                    console.warn(`Store '${storeName}' not found in database.`);
                    resolve(false);
                    return;
                }

                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(item);

                request.onsuccess = () => {
                    resolve(true);
                };

                request.onerror = () => {
                    console.error(`Error saving to store '${storeName}':`, request.error);
                    resolve(false);
                };
            } catch (error) {
                console.error(`Error creating transaction for store '${storeName}':`, error);
                resolve(false);
            }
        });
    }

    // Generic function to overwrite a store with new data
    async function saveToStore(storeName, data) {
        if (!isIndexedDBAvailable()) return false;

        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(storeName)) {
                    console.warn(`Store '${storeName}' not found in database.`);
                    resolve(false);
                    return;
                }

                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);

                // Clear existing data
                const clearRequest = store.clear();
                clearRequest.onsuccess = () => {
                    // Add new data
                    let completed = 0;
                    const total = data.length;

                    if (total === 0) {
                        resolve(true);
                        return;
                    }

                    data.forEach(item => {
                        const addRequest = store.add(item);
                        addRequest.onsuccess = () => {
                            completed++;
                            if (completed === total) {
                                resolve(true);
                            }
                        };
                        addRequest.onerror = () => {
                            console.error(`Error adding item to store '${storeName}':`, addRequest.error);
                            resolve(false);
                        };
                    });
                };

                clearRequest.onerror = () => {
                    console.error(`Error clearing store '${storeName}':`, clearRequest.error);
                    resolve(false);
                };
            } catch (error) {
                console.error(`Error creating transaction for store '${storeName}':`, error);
                resolve(false);
            }
        });
    }

    async function initDB() {
        if (!isIndexedDBAvailable()) {
            console.warn('IndexedDB not available, using memory storage');
            storageType = 'memory';
            return;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('IndexedDB failed to open:', request.error);
                storageType = 'memory';
                resolve();
            };

            request.onsuccess = () => {
                db = request.result;
                storageType = 'indexeddb';
                console.log('IndexedDB initialized successfully');
                
                // Handle unexpected database closure
                db.onclose = () => {
                    console.warn('IndexedDB connection closed unexpectedly');
                };
                
                resolve();
            };

            request.onupgradeneeded = (event) => {
                db = event.target.result;
                console.log('Upgrading IndexedDB schema to version', db.version);

                // Create dreams store if it doesn't exist
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const dreamStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    dreamStore.createIndex('timestamp', 'timestamp', { unique: false });
                    dreamStore.createIndex('isLucid', 'isLucid', { unique: false });
                    console.log('Created dreams object store');
                }

                // Create voice notes store if it doesn't exist
                if (!db.objectStoreNames.contains(VOICE_STORE_NAME)) {
                    const voiceStore = db.createObjectStore(VOICE_STORE_NAME, { keyPath: 'id' });
                    voiceStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('Created voice notes object store');
                }

                // Create goals store if it doesn't exist
                if (!db.objectStoreNames.contains('goals')) {
                    const goalStore = db.createObjectStore('goals', { keyPath: 'id' });
                    goalStore.createIndex('timestamp', 'timestamp', { unique: false });
                    goalStore.createIndex('completed', 'completed', { unique: false });
                    console.log('Created goals object store');
                }

                // Create autocomplete store for unified tag/dream sign storage
                if (!db.objectStoreNames.contains('autocomplete')) {
                    const autocompleteStore = db.createObjectStore('autocomplete', { keyPath: 'id' });
                    console.log('Created autocomplete object store');
                }

                // Legacy migration from older versions
                if (event.oldVersion < 3) {
                    // Migrate from localStorage if needed
                    setTimeout(async () => {
                        await migrateFromLocalStorage();
                    }, 100);
                }
            };
        });
    }

    function generateUniqueId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    function isLocalStorageAvailable() {
        try {
            const test = 'test';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    function isIndexedDBAvailable() {
        return 'indexedDB' in window && window.indexedDB !== undefined;
    }
    
    function isIndexedDBReady() {
        return isIndexedDBAvailable() && db !== null;
    }

    // Main dream loading function - IndexedDB only with memory fallback
    async function loadDreams() {
        // Try IndexedDB first
        if (isIndexedDBReady()) {
            const dreams = await loadFromIndexedDB();
            if (dreams !== null) {
                return dreams;
            }
        }
        
        // Fallback to memory only if IndexedDB fails
        console.log('IndexedDB unavailable, using memory storage fallback');
        return memoryStorage;
    }

    // Main dream saving function - IndexedDB only with memory fallback
    async function saveDreams(dreams) {
        return withMutex('saveDreams', async () => {
            // Try IndexedDB first
            if (isIndexedDBAvailable()) {
                const saved = await saveToIndexedDB(dreams);
                if (saved) {
                    console.log('Dreams saved to IndexedDB');
                    return;
                }
            }
            
            // Fallback to memory only if IndexedDB fails
            memoryStorage = [...dreams];
            console.log('IndexedDB unavailable, dreams saved to memory fallback');
            
            if (storageType !== 'memory') {
                showStorageWarning();
            }
        });
    }

    
    async function saveAllVoiceNotesToIndexedDB(voiceNotes) {
        if (!isIndexedDBAvailable()) return false;

        return new Promise((resolve) => {
            try {
                const transaction = db.transaction([VOICE_STORE_NAME], 'readwrite');
                const store = transaction.objectStore(VOICE_STORE_NAME);

                const clearRequest = store.clear();
                clearRequest.onsuccess = () => {
                    let completed = 0;
                    const total = voiceNotes.length;
                    if (total === 0) {
                        resolve(true);
                        return;
                    }
                    voiceNotes.forEach(note => {
                        const addRequest = store.add(note);
                        addRequest.onsuccess = () => {
                            completed++;
                            if (completed === total) {
                                resolve(true);
                            }
                        };
                        addRequest.onerror = (e) => {
                            console.error('Error adding voice note during save all:', e.target.error);
                        };
                    });
                };
                clearRequest.onerror = (e) => {
                    console.error('Error clearing voice notes store:', e.target.error);
                    resolve(false);
                };
            } catch (error) {
                console.error('Error in saveAllVoiceNotesToIndexedDB transaction:', error);
                resolve(false);
            }
        });
    }

    
    async function saveVoiceNotes(notes) {
        return withMutex('saveVoiceNote', async () => {
            if (isIndexedDBAvailable()) {
                const saved = await saveAllVoiceNotesToIndexedDB(notes);
                if (saved) {
                    console.log('All voice notes saved to IndexedDB');
                }
            }
        });
    }

    // Goals loading and saving
    async function loadGoals() {
        if (isIndexedDBAvailable()) {
            const goals = await loadGoalsFromIndexedDB();
            if (goals !== null) return goals;
        }
        
        if (isLocalStorageAvailable()) {
            try {
                const stored = localStorage.getItem('dreamJournalGoals');
                return stored ? JSON.parse(stored) : [];
            } catch (error) {
                console.error('Error loading goals from localStorage:', error);
            }
        }
        
        return [];
    }

    async function saveGoals(goals) {
        return withMutex('saveGoals', async () => {
            if (isIndexedDBAvailable()) {
                const saved = await saveGoalsToIndexedDB(goals);
                if (saved) return;
            }
            
            if (isLocalStorageAvailable()) {
                try {
                    localStorage.setItem('dreamJournalGoals', JSON.stringify(goals));
                } catch (error) {
                    console.error('Error saving goals to localStorage:', error);
                }
            }
        });
    }

    // IndexedDB-specific functions
    
    // Load from IndexedDB
    async function loadFromIndexedDB() {
        if (!isIndexedDBAvailable()) return null;
        
        return new Promise((resolve) => {
            try {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.getAll();
                
                request.onsuccess = () => {
                    const dreams = request.result || [];
                    resolve(dreams);
                };
                
                request.onerror = () => {
                    console.error('Error loading from IndexedDB:', request.error);
                    resolve(null);
                };
            } catch (error) {
                console.error('IndexedDB load error:', error);
                resolve(null);
            }
        });
    }

    // Save to IndexedDB
    async function saveToIndexedDB(dreams) {
        if (!isIndexedDBAvailable()) return false;
        
        return new Promise((resolve) => {
            try {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                // Clear existing data
                const clearRequest = store.clear();
                clearRequest.onsuccess = () => {
                    // Add all dreams
                    let completed = 0;
                    const total = dreams.length;
                    
                    if (total === 0) {
                        resolve(true);
                        return;
                    }
                    
                    dreams.forEach(dream => {
                        const addRequest = store.add(dream);
                        addRequest.onsuccess = () => {
                            completed++;
                            if (completed === total) {
                                resolve(true);
                            }
                        };
                        addRequest.onerror = () => {
                            console.error('Error adding dream:', addRequest.error);
                            resolve(false);
                        };
                    });
                };
                
                clearRequest.onerror = () => {
                    console.error('Error clearing dreams store:', clearRequest.error);
                    resolve(false);
                };
            } catch (error) {
                console.error('Error saving to IndexedDB:', error);
                resolve(false);
            }
        });
    }

    async function loadGoalsFromIndexedDB() {
        if (!isIndexedDBAvailable()) return null;
        
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains('goals')) {
                    resolve([]);
                    return;
                }
                
                const transaction = db.transaction(['goals'], 'readonly');
                const store = transaction.objectStore('goals');
                const request = store.getAll();
                
                request.onsuccess = () => {
                    const goals = request.result || [];
                    resolve(goals);
                };
                
                request.onerror = () => {
                    console.error('Error loading goals from IndexedDB:', request.error);
                    resolve(null);
                };
            } catch (error) {
                console.error('Error loading goals:', error);
                resolve(null);
            }
        });
    }

    async function saveGoalsToIndexedDB(goals) {
        if (!isIndexedDBAvailable()) return false;
        
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains('goals')) {
                    console.error('Goals store not found');
                    resolve(false);
                    return;
                }
                
                const transaction = db.transaction(['goals'], 'readwrite');
                const store = transaction.objectStore('goals');
                
                // Clear existing goals
                const clearRequest = store.clear();
                clearRequest.onsuccess = () => {
                    // Add all goals
                    let completed = 0;
                    const total = goals.length;
                    
                    if (total === 0) {
                        resolve(true);
                        return;
                    }
                    
                    goals.forEach(goal => {
                        const addRequest = store.add(goal);
                        addRequest.onsuccess = () => {
                            completed++;
                            if (completed === total) {
                                resolve(true);
                            }
                        };
                        addRequest.onerror = () => {
                            console.error('Error adding goal:', addRequest.error);
                            resolve(false);
                        };
                    });
                };
                
                clearRequest.onerror = () => {
                    console.error('Error clearing goals store:', clearRequest.error);
                    resolve(false);
                };
            } catch (error) {
                console.error('Error in saveGoalsToIndexedDB:', error);
                resolve(false);
            }
        });
    }

    // Voice Notes Storage Functions
    
    // Load voice notes
    async function loadVoiceNotes() {
        // Voice notes require IndexedDB due to Blob storage - localStorage cannot deserialize Blobs properly
        if (!isIndexedDBReady()) {
            console.warn('Voice notes require IndexedDB support. No voice notes available without IndexedDB.');
            return [];
        }
        
        const notes = await loadVoiceNotesFromIndexedDB();
        return notes || [];
    }

    // Save voice note
    async function saveVoiceNote(voiceNote) {
        return withMutex('saveVoiceNote', async () => {
            // Voice notes require IndexedDB due to Blob storage - localStorage fallback cannot handle Blobs
            if (!isIndexedDBReady()) {
                throw new Error('Voice notes require IndexedDB support. localStorage cannot store audio Blobs.');
            }
            
            const saved = await saveVoiceNoteToIndexedDB(voiceNote);
            if (!saved) {
                throw new Error('Failed to save voice note to IndexedDB');
            }
        });
    }

    async function loadVoiceNotesFromIndexedDB() {
        if (!isIndexedDBAvailable()) return null;
        
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(VOICE_STORE_NAME)) {
                    resolve([]);
                    return;
                }
                
                const transaction = db.transaction([VOICE_STORE_NAME], 'readonly');
                const store = transaction.objectStore(VOICE_STORE_NAME);
                const request = store.getAll();
                
                request.onsuccess = () => {
                    const voiceNotes = request.result || [];
                    // Sort by timestamp (newest first)
                    voiceNotes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    resolve(voiceNotes);
                };
                
                request.onerror = () => {
                    console.error('Error loading voice notes from IndexedDB:', request.error);
                    resolve([]);
                };
            } catch (error) {
                console.error('Error loading voice notes:', error);
                resolve([]);
            }
        });
    }

    async function saveVoiceNoteToIndexedDB(voiceNote) {
        if (!isIndexedDBAvailable()) return false;
        
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(VOICE_STORE_NAME)) {
                    console.error('Voice notes store not found');
                    resolve(false);
                    return;
                }
                
                const transaction = db.transaction([VOICE_STORE_NAME], 'readwrite');
                const store = transaction.objectStore(VOICE_STORE_NAME);
                const request = store.put(voiceNote);
                
                request.onsuccess = () => {
                    resolve(true);
                };
                
                request.onerror = () => {
                    console.error('Error saving voice note to IndexedDB:', request.error);
                    resolve(false);
                };
            } catch (error) {
                console.error('Error saving voice note:', error);
                resolve(false);
            }
        });
    }

    function deleteVoiceNote(voiceNoteId) {
        return withMutex('deleteOperations', async () => {
            if (isIndexedDBAvailable()) {
                const deleted = await deleteVoiceNoteFromIndexedDB(voiceNoteId);
                if (deleted) return true;
            }
            
            if (isLocalStorageAvailable()) {
                try {
                    const existingNotes = await loadVoiceNotes();
                    const updatedNotes = existingNotes.filter(note => note.id !== voiceNoteId);
                    localStorage.setItem('dreamJournalVoiceNotes', JSON.stringify(updatedNotes));
                    return true;
                } catch (error) {
                    console.error('Error deleting voice note from localStorage:', error);
                }
            }
            
            return false;
        });
    }

    async function deleteVoiceNoteFromIndexedDB(voiceNoteId) {
    if (!isIndexedDBAvailable()) return false;
    
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(VOICE_STORE_NAME)) {
                    resolve(false);
                    return;
                }
                
                const transaction = db.transaction([VOICE_STORE_NAME], 'readwrite');
                
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = () => resolve(false);
                transaction.onabort = () => resolve(false);

                const store = transaction.objectStore(VOICE_STORE_NAME);
                store.delete(voiceNoteId);
                
            } catch (error) {
                console.error('Error deleting voice note:', error);
                resolve(false);
            }
        });
    }

    // Migration function
    async function migrateFromLocalStorage() {
        if (!isLocalStorageAvailable()) return;
        
        try {
            // Migrate dreams
            const dreamData = localStorage.getItem('dreamJournal');
            if (dreamData) {
                const dreams = JSON.parse(dreamData);
                if (dreams.length > 0) {
                    await saveToIndexedDB(dreams);
                    console.log('Migrated dreams from localStorage to IndexedDB');
                }
            }
            
            // Migrate goals
            const goalData = localStorage.getItem('dreamJournalGoals');
            if (goalData) {
                const goals = JSON.parse(goalData);
                if (goals.length > 0) {
                    await saveGoalsToIndexedDB(goals);
                    console.log('Migrated goals from localStorage to IndexedDB');
                }
            }
            
            // Migrate voice notes
            const voiceData = localStorage.getItem('dreamJournalVoiceNotes');
            if (voiceData) {
                const voiceNotes = JSON.parse(voiceData);
                for (const note of voiceNotes) {
                    await saveVoiceNoteToIndexedDB(note);
                }
                console.log('Migrated voice notes from localStorage to IndexedDB');
            }
            
            // Clear localStorage data after successful migration to prevent re-migration
            if (dreamData) {
                localStorage.removeItem('dreamJournal');
                console.log('Cleared localStorage dreams after migration');
            }
            if (goalData) {
                localStorage.removeItem('dreamJournalGoals');
                console.log('Cleared localStorage goals after migration');
            }
            if (voiceData) {
                localStorage.removeItem('dreamJournalVoiceNotes');
                console.log('Cleared localStorage voice notes after migration');
            }
        } catch (error) {
            console.error('Error during migration:', error);
        }
    }

    // Get count of dreams in IndexedDB
    async function getIndexedDBCount() {
        if (!isIndexedDBAvailable()) return 0;
        
        return new Promise((resolve) => {
            try {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.count();
                
                request.onsuccess = () => {
                    resolve(request.result || 0);
                };
                
                request.onerror = () => {
                    console.error('Error counting dreams:', request.error);
                    resolve(0);
                };
            } catch (error) {
                console.error('Error creating count dreams transaction:', error);
                resolve(0);
            }
        });
    }

    // Get combined list of suggestions for autocomplete
    async function getAutocompleteSuggestions(type) {
        const storeId = type === 'tags' ? 'tags' : 'dreamSigns';

        // For new users or migrated users, use the new unified 'autocomplete' store
        if (isIndexedDBAvailable() && db.objectStoreNames.contains('autocomplete')) {
            const autocompleteData = await loadItemFromStore('autocomplete', storeId);
            if (autocompleteData && autocompleteData.items) {
                // Sort alphabetically for consistent display
                return autocompleteData.items.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            }
        }

        // Fallback for new users - return the predefined lists from constants.js
        console.warn(`No saved autocomplete data found for ${type}. Using default list.`);
        const isTags = type === 'tags';
        
        // Access the constants that should be available globally
        if (typeof commonTags !== 'undefined' && typeof commonDreamSigns !== 'undefined') {
            const defaultList = isTags ? commonTags : commonDreamSigns;
            return defaultList.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        }
        
        // If constants aren't loaded yet, return empty array
        return [];
    }

    async function addCustomAutocompleteItem(type) {
        const inputId = type === 'tags' ? 'newTagInput' : 'newDreamSignInput';
        const input = document.getElementById(inputId);
        if (!input) return;

        const newItem = input.value.trim().toLowerCase();
        if (!newItem) {
            createInlineMessage('warning', 'Please enter a value', { 
                container: input.parentElement,
                position: 'top'
            });
            return;
        }

        const storeId = type === 'tags' ? 'tags' : 'dreamSigns';
        
        // Get existing suggestions
        const existingSuggestions = await getAutocompleteSuggestions(type);
        
        // Check if item already exists (case insensitive)
        if (existingSuggestions.some(item => item.toLowerCase() === newItem)) {
            createInlineMessage('warning', 'This item already exists', {
                container: input.parentElement,
                position: 'top'
            });
            return;
        }

        // Add the new item
        const updatedSuggestions = [...existingSuggestions, newItem];
        
        // Save to autocomplete store
        const success = await saveItemToStore('autocomplete', {
            id: storeId,
            items: updatedSuggestions
        });

        if (success) {
            input.value = '';
            createInlineMessage('success', `Added "${newItem}" successfully`, {
                container: input.parentElement,
                position: 'top'
            });
            
            // Re-render the management list
            renderAutocompleteManagementList(type);
        } else {
            createInlineMessage('error', 'Failed to add item', {
                container: input.parentElement,
                position: 'top'
            });
        }
    }

    async function deleteAutocompleteItem(type, itemValue) {
        const storeId = type === 'tags' ? 'tags' : 'dreamSigns';
        
        // Get existing suggestions
        const existingSuggestions = await getAutocompleteSuggestions(type);
        
        // Remove the item (case insensitive)
        const updatedSuggestions = existingSuggestions.filter(
            item => item.toLowerCase() !== itemValue.toLowerCase()
        );
        
        // Save updated list
        const success = await saveItemToStore('autocomplete', {
            id: storeId,
            items: updatedSuggestions
        });

        if (success) {
            createInlineMessage('success', `Deleted "${itemValue}" successfully`);
            
            // Re-render the management list
            renderAutocompleteManagementList(type);
        } else {
            createInlineMessage('error', 'Failed to delete item');
        }
    }

    async function learnAutocompleteItems(inputArray, type) {
        if (!inputArray || inputArray.length === 0) return;

        const storeId = type === 'tags' ? 'tags' : 'dreamSigns';
        
        // Get existing suggestions
        const existingSuggestions = await getAutocompleteSuggestions(type);
        
        // Find new items (case insensitive comparison)
        const newItems = inputArray.filter(item => 
            !existingSuggestions.some(existing => 
                existing.toLowerCase() === item.toLowerCase()
            )
        );

        if (newItems.length === 0) return;

        // Add new items to existing suggestions
        const updatedSuggestions = [...existingSuggestions, ...newItems];
        
        // Save updated list
        await saveItemToStore('autocomplete', {
            id: storeId,
            items: updatedSuggestions
        });

        console.log(`Learned ${newItems.length} new ${type}: ${newItems.join(', ')}`);
    }


// ===================================================================================
// INDIVIDUAL DREAM CRUD OPERATIONS
// ===================================================================================
// Individual dream operations for proper CRUD functionality
// Complement the bulk operations with single-item precision

// Add single dream to IndexedDB with validation
// Returns true on success, false on error or validation failure
async function addDreamToIndexedDB(dream) {
        if (!isIndexedDBAvailable() || !validateDreamData(dream)) return false;
        
        return new Promise((resolve) => {
            try {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                
                transaction.oncomplete = () => {
                    resolve(true); // Success when transaction completes
                };
                transaction.onerror = () => resolve(false);
                transaction.onabort = () => resolve(false);

                const store = transaction.objectStore(STORE_NAME);
                store.add(dream);

            } catch (error) {
                console.error('Error creating add dream transaction:', error);
                resolve(false);
            }
        });
    }
// Update existing dream in IndexedDB with validation
// Returns true on success, false on error or validation failure
async function updateDreamInIndexedDB(dream) {
    if (!isIndexedDBAvailable() || !validateDreamData(dream)) return false;

        return new Promise((resolve) => {
            try {
                const transaction = db.transaction([STORE_NAME], 'readwrite');

                transaction.oncomplete = () => {
                    resolve(true);
                };
                transaction.onerror = () => resolve(false);
                transaction.onabort = () => resolve(false);

                const store = transaction.objectStore(STORE_NAME);
                store.put(dream);

            } catch (error) {
                console.error('Error creating update dream transaction:', error);
                resolve(false);
            }
        });
    }
// Delete single dream from IndexedDB by ID
// Returns true on success, false on error
async function deleteDreamFromIndexedDB(dreamId) {
        if (!isIndexedDBAvailable()) return false;
        
        return new Promise((resolve) => {
            try {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = () => resolve(false);
                transaction.onabort = () => resolve(false);

                const store = transaction.objectStore(STORE_NAME);
                store.delete(dreamId);

            } catch (error) {
                console.error('Error creating delete dream transaction:', error);
                resolve(false);
            }
        });
    }

// ===================================================================================
// DATA VALIDATION OPERATIONS
// ===================================================================================

// Comprehensive dream data validation with detailed error reporting
// Ensures data integrity before database operations
function validateDreamData(dream) {
        if (!dream) {
            console.error('Dream validation failed: dream is null or undefined');
            return false;
        }
        
        // Check for required fields presence
        if (!dream.id) {
            console.error('Dream validation failed: missing id');
            return false;
        }
        
        if (!dream.timestamp) {
            console.error('Dream validation failed: missing timestamp');
            return false;
        }
        
        // Validate data types for type safety
        if (typeof dream.id !== 'string') {
            console.error('Dream validation failed: id must be string');
            return false;
        }
        
        if (typeof dream.title !== 'string') {
            console.error('Dream validation failed: title must be string');
            return false;
        }
        
        if (typeof dream.content !== 'string') {
            console.error('Dream validation failed: content must be string');
            return false;
        }
        
        if (typeof dream.isLucid !== 'boolean') {
            console.error('Dream validation failed: isLucid must be boolean');
            return false;
        }
        
        // Validate array fields for proper structure
        if (!Array.isArray(dream.tags)) {
            console.error('Dream validation failed: tags must be array');
            return false;
        }
        
        if (!Array.isArray(dream.dreamSigns)) {
            console.error('Dream validation failed: dreamSigns must be array');
            return false;
        }
        
        return true;
    }

// Check if dream is likely duplicate based on content and timing
// Prevents accidental duplicate entries from user error or system issues
function isDreamDuplicate(existingDreams, newDream) {
    const timeDiffThreshold = 5 * 60 * 1000; // 5-minute time window
    const contentSimilarityThreshold = 0.8; // Currently unused but reserved for future fuzzy matching
    
    return existingDreams.some(existing => {
        const timeDiff = Math.abs(new Date(existing.timestamp) - new Date(newDream.timestamp));
        const contentSimilarity = existing.content.toLowerCase() === newDream.content.toLowerCase();
        
        // Consider duplicate if within time threshold and identical content
        return timeDiff < timeDiffThreshold && contentSimilarity;
    });
}

// ===================================================================================
// STORAGE WARNING FUNCTIONS
// ===================================================================================

// Display warning when voice notes can't be persistently stored
// Informs users about temporary storage limitations for voice data
function showVoiceStorageWarning() {
        const container = document.querySelector('.voice-notes-section');
        if (!container) return;
        
        createInlineMessage('warning', 
            '⚠️ Voice Storage Notice: Voice recordings are stored temporarily in memory only. They will be lost when you close this tab. Download important recordings!', 
            {
                container: container,
                position: 'top',
                duration: 10000,
                className: 'voice-storage-warning'
            }
        );
    }

// ===================================================================================
// USER-DEFINED TAGS & DREAM SIGNS OPERATIONS
// ===================================================================================
// Legacy functions for older tag/dream sign management system
// These functions handle user-defined suggestions separately from defaults

// Load user-defined tags from dedicated store
// Returns array of tag strings, empty array if none found
async function loadUserTags() {
        const tags = await loadFromStore('userTags');
        return tags.map(t => t.value);
    }

// Load user-defined dream signs from dedicated store
// Returns array of dream sign strings, empty array if none found
async function loadUserDreamSigns() {
        const signs = await loadFromStore('userDreamSigns');
        return signs.map(s => s.value);
    }

// Load list of default items that user has deleted
// Used to filter out unwanted defaults from suggestion lists
async function loadDeletedDefaults() {
        const deleted = await loadFromStore('deletedDefaults');
        return deleted.map(d => d.id);
    }

// Save complete list of user-defined tags to dedicated store
// Replaces existing user tags with new list
async function saveUserTags(tags) {
        const dataToStore = tags.map(tag => ({ id: tag.toLowerCase(), value: tag }));
        return await saveToStore('userTags', dataToStore);
    }

// Save complete list of user-defined dream signs to dedicated store
// Replaces existing user dream signs with new list
async function saveUserDreamSigns(signs) {
        const dataToStore = signs.map(sign => ({ id: sign.toLowerCase(), value: sign }));
        return await saveToStore('userDreamSigns', dataToStore);
    }

// Save list of default items that user has chosen to delete
// Used to hide unwanted defaults from autocomplete suggestions
async function saveDeletedDefaults(deletedItems) {
        const dataToStore = deletedItems.map(item => ({ id: item.toLowerCase() }));
        return await saveToStore('deletedDefaults', dataToStore);
    }