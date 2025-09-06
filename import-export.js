/**
 * @fileoverview Import-export and data management module for Dream Journal.
 * 
 * This module provides comprehensive data import/export functionality including:
 * - Dreams-only text export with encryption support
 * - Complete data backup/restore with JSON format
 * - AI analysis export with formatted prompts
 * - Unified password dialog system for encryption/decryption
 * - File validation and duplicate detection
 * 
 * All export functions support optional encryption using Web Crypto API.
 * Import functions handle both encrypted and plain text formats with
 * automatic format detection and user validation.
 * 
 * @module ImportExport
 * @version 2.02.05
 * @author Dream Journal Development Team
 * @since 1.0.0
 * @requires constants
 * @requires state
 * @requires storage
 * @requires dom-helpers
 * @requires security
 * @requires dream-crud
 * @requires goals
 * @requires action-router
 */

// ================================
// IMPORT-EXPORT & DATA MANAGEMENT MODULE
// ================================
// Complete data import/export functionality including dreams-only export,
// complete data backup/restore, AI analysis export, and encryption support

// ================================
// UTILITY FUNCTIONS
// ================================

/**
 * Validates app access and redirects to lock screen if needed.
 * 
 * Shared security check across all export functions to ensure user
 * has proper access before allowing data export operations.
 * 
 * @param {string} errorMessage - Error message to display on lock screen
 * @returns {boolean} True if app is accessible, false if locked
 * @since 2.0.0
 * @example
 * if (!validateAppAccess('Please unlock to export dreams')) {
 *   return; // Export cancelled
 * }
 */
function validateAppAccess(errorMessage) {
    if (isAppLocked || (isPinSetup() && !isUnlocked)) {
        switchAppTab('lock');
        setTimeout(() => {
            showLockScreenMessage('error', errorMessage);
        }, 500);
        return false;
    }
    return true;
}

/**
 * Creates and triggers file download with automatic cleanup.
 * 
 * Standardized download logic for all export functions that handles
 * blob creation, download link generation, and memory cleanup.
 * 
 * @param {string|Uint8Array} data - Data to download (text or binary)
 * @param {string} fileName - Name for the downloaded file
 * @param {string} [mimeType='text/plain'] - MIME type for the file
 * @throws {Error} When export file is empty or download fails
 * @since 2.0.0
 * @example
 * createDownload(jsonData, 'backup.json', 'application/json');
 * 
 * @example
 * // For encrypted data
 * createDownload(encryptedBuffer, 'data.enc', 'application/octet-stream');
 */
function createDownload(data, fileName, mimeType = 'text/plain') {
    const blob = new Blob([data], { type: mimeType });
    
    if (blob.size === 0) {
        throw new Error('Export file is empty - no data to export');
    }
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    
    try {
        a.click();
        
        setTimeout(() => {
            if (document.body.contains(a)) {
                document.body.removeChild(a);
            }
            URL.revokeObjectURL(url);
        }, CONSTANTS.DOWNLOAD_CLEANUP_DELAY_MS);
    } catch (clickError) {
        if (document.body.contains(a)) {
            document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
        throw new Error('Failed to initiate download');
    }
}

/**
 * Reads file with encryption detection and decryption support.
 * 
 * Unified file reading logic for import functions that automatically
 * detects encrypted files (.enc extension), prompts for passwords,
 * and handles both text and binary file formats.
 * 
 * @async
 * @param {File} file - File object from input element
 * @param {boolean} encryptionEnabled - Whether encryption checkbox is checked
 * @returns {Promise<string|null>} Decrypted file content or null if cancelled
 * @throws {Error} When file reading, decryption, or format detection fails
 * @since 2.0.0
 * @example
 * const content = await readFileWithEncryption(file, true);
 * if (content) {
 *   // Process decrypted content
 * }
 */
async function readFileWithEncryption(file, encryptionEnabled) {
    const isEncryptedFile = file.name.endsWith('.enc');
    
    const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        
        if (encryptionEnabled || isEncryptedFile) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    });
    
    if (encryptionEnabled || isEncryptedFile) {
        if (typeof fileData === 'string') {
            throw new Error('Selected file appears to be unencrypted. Uncheck encryption or select an encrypted (.enc) file.');
        }
        
        const password = await showPasswordDialog({
            type: 'import',
            title: '🔓 Enter Import Password',
            description: 'Enter the password used to encrypt this export file.',
            requireConfirm: false,
            primaryButtonText: 'Decrypt & Import'
        });
        
        if (!password) {
            return null; // User cancelled
        }
        
        try {
            return await decryptData(new Uint8Array(fileData), password);
        } catch (decryptError) {
            throw new Error('Failed to decrypt file. Please check your password and try again.');
        }
    } else {
        if (typeof fileData !== 'string') {
            throw new Error('Selected file appears to be encrypted. Check encryption option or select a text file.');
        }
        return fileData;
    }
}

// ================================
// 1. DREAMS EXPORT SYSTEM
// ================================

/**
 * Exports dreams to text file with optional encryption.
 * 
 * Creates a formatted text export of all user dreams with comprehensive
 * metadata including title, timestamp, type (lucid/regular), emotions,
 * tags, and dream signs. Supports optional encryption with user-defined
 * passwords and provides detailed user feedback.
 * 
 * @async
 * @throws {Error} When app is locked, no dreams exist, or export fails
 * @since 1.0.0
 * @example
 * // Called via action delegation system
 * await exportEntries();
 * 
 * @example
 * // Exports dreams in format:
 * // Title: My Dream
 * // Timestamp: 2023-12-01T10:30:00.000Z
 * // Type: Lucid Dream ✨
 * // Emotions: excited, curious
 * // Tags: flying, adventure
 * // Dream Signs: hands looked strange
 * // Content: I realized I was dreaming when...
 * // ==================================================
 */
async function exportEntries() {
        if (!validateAppAccess('Please unlock your journal first to export your dreams.')) {
            return;
        }
        
        const dreams = await loadDreams();
        
        if (dreams.length === 0) {
            createInlineMessage('error', 'No dreams to export yet. Add some dreams first!', {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 3000
            });
            return;
        }
        
        try {
            const exportText = dreams.map(dream => {
                // Safety checks for dream properties
                const safeTitle = dream && dream.title ? dream.title : 'Untitled Dream';
                const safeTimestamp = dream && dream.timestamp ? dream.timestamp : new Date().toISOString();
                const safeContent = dream && dream.content ? dream.content : 'No content';
                const safeIsLucid = dream && dream.isLucid ? 'Lucid Dream ✨' : 'Regular Dream';
                const safeEmotions = dream && dream.emotions ? dream.emotions : '';
                const safeTags = Array.isArray(dream.tags) && dream.tags.length > 0 ? dream.tags.join(', ') : '';
                const safeDreamSigns = Array.isArray(dream.dreamSigns) && dream.dreamSigns.length > 0 ? dream.dreamSigns.join(', ') : '';
                
                let exportEntry = `Title: ${safeTitle}\n` +
                       `Timestamp: ${safeTimestamp}\n` +
                       `Type: ${safeIsLucid}\n`;
                
                // Add emotions if they exist
                if (safeEmotions) {
                    exportEntry += `Emotions: ${safeEmotions}\n`;
                }
                
                // Add tags if they exist
                if (safeTags) {
                    exportEntry += `Tags: ${safeTags}\n`;
                }
                
                // Add dream signs if they exist
                if (safeDreamSigns) {
                    exportEntry += `Dream Signs: ${safeDreamSigns}\n`;
                }
                
                exportEntry += `Content: ${safeContent}\n` +
                             `${'='.repeat(50)}\n`;
                
                return exportEntry;
            }).join('\n');
            
            if (!exportText || exportText.trim().length === 0) {
                throw new Error('No valid dream data found to export');
            }
            
            // Check if encryption is enabled
            const encryptionEnabled = document.getElementById('encryptionEnabled').checked;
            let finalData = exportText;
            let fileName = `dream-journal-${new Date().toISOString().split('T')[0]}.txt`;
            let mimeType = 'text/plain';
            
            if (encryptionEnabled) {
                // Show password dialog
                const password = await showPasswordDialog({
                    type: 'export',
                    title: '🔐 Set Export Password',
                    description: 'Choose a password to encrypt your dream export. This password is not stored - remember it for importing!',
                    requireConfirm: true,
                    primaryButtonText: 'Encrypt & Export'
                });
                
                if (!password) {
                    // User cancelled
                    return;
                }
                
                // Encrypt the data
                const encryptedData = await encryptData(exportText, password);
                finalData = encryptedData;
                fileName = `dream-journal-${new Date().toISOString().split('T')[0]}.enc`;
                mimeType = 'application/octet-stream';
            }
            
            createDownload(finalData, fileName, mimeType);
            
            // Show success message
            const successMessage = encryptionEnabled ? 
                'Encrypted dream export created successfully!' : 
                'Dream export created successfully!';
                
            createInlineMessage('success', successMessage, {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 3000
            });
            
        } catch (error) {
            console.error('Export error:', error);
            
            createInlineMessage('error', 'Error creating export: ' + error.message, {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 5000
            });
        }
    }

// ================================
// 2. DREAMS IMPORT SYSTEM
// ================================

/**
 * Imports dreams from text file with optional decryption and format detection.
 * 
 * Handles both legacy and new export formats with comprehensive parsing.
 * Supports automatic duplicate detection, data validation, and statistics
 * reporting. Processes entries separated by equals delimiters and extracts
 * all available metadata including emotions, tags, and dream signs.
 * 
 * @async
 * @param {Event} event - File input change event containing selected file
 * @throws {Error} When file reading, parsing, decryption, or saving fails
 * @since 1.0.0
 * @todo Split into readImportFile() and parseDreamEntries() functions for better modularity
 * @example
 * // Called via file input change event
 * document.getElementById('importFile').addEventListener('change', importEntries);
 * 
 * @example
 * // Handles multiple formats:
 * // New format: Title: Dream\nTimestamp: ISO\nType: Lucid\nContent: Text
 * // Legacy format: Title: Dream\nDate: Display Date\nContent: Text
 * // Mixed format: Both timestamp and date fields
 */
async function importEntries(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const encryptionEnabled = document.getElementById('encryptionEnabled').checked;
            
            const text = await readFileWithEncryption(file, encryptionEnabled);
            if (!text) {
                event.target.value = '';
                return; // User cancelled
            }
            
            // Process the decrypted/plain text
            const dreams = await loadDreams();
            
            // Simple parsing - this could be enhanced based on export format
            const entriesRaw = text.split('='.repeat(50));
            let importedCount = 0;
            let skippedCount = 0;
            
            entriesRaw.forEach((entry, index) => {
                try {
                    const lines = entry.trim().split('\n').filter(line => line.trim()); // Remove empty lines
                    if (lines.length < 3) return; // Not enough data
                    
                    const title = lines[0].replace('Title: ', '').trim();
                    if (!title) return; // Skip entries without titles
                    
                    // Check if this is new format (timestamp) or old format (date string)
                    let timestamp = null;
                    let typeLineIndex = 2;
                    
                    if (lines[1] && lines[1].startsWith('Timestamp: ')) {
                        // New format - extract timestamp directly
                        timestamp = lines[1].replace('Timestamp: ', '').trim();
                        typeLineIndex = 2;
                    } else if (lines[1] && lines[1].startsWith('Date: ')) {
                        // Old format - try to parse the display date
                        const dateStr = lines[1].replace('Date: ', '').trim();
                        try {
                            const parsed = new Date(dateStr);
                            if (!isNaN(parsed.getTime())) {
                                timestamp = parsed.toISOString();
                            }
                        } catch (e) {
                            // Continue with fallback
                        }
                        
                        // Check if there's also a timestamp line (mixed format)
                        if (lines[2] && lines[2].startsWith('Timestamp: ')) {
                            timestamp = lines[2].replace('Timestamp: ', '').trim();
                            typeLineIndex = 3;
                        }
                    }
                    
                    // Fallback to current time if no valid timestamp
                    if (!timestamp) {
                        timestamp = new Date().toISOString();
                    }
                    
                    // Validate timestamp
                    const testDate = new Date(timestamp);
                    if (isNaN(testDate.getTime())) {
                        timestamp = new Date().toISOString();
                    }
                    
                    // Check for lucid status, emotions, tags, and dream signs
                    let isLucid = false;
                    let emotions = '';
                    let tags = [];
                    let dreamSigns = [];
                    let contentStartIndex = typeLineIndex;
                    
                    // Look for Type line
                    if (lines[typeLineIndex] && lines[typeLineIndex].includes('Type:')) {
                        isLucid = lines[typeLineIndex].includes('Lucid Dream') || lines[typeLineIndex].includes('✨');
                        contentStartIndex = typeLineIndex + 1;
                    }
                    
                    // Look for Emotions line
                    if (lines[contentStartIndex] && lines[contentStartIndex].startsWith('Emotions:')) {
                        emotions = lines[contentStartIndex].replace('Emotions:', '').trim();
                        contentStartIndex = contentStartIndex + 1;
                    }
                    
                    // Look for Tags line
                    if (lines[contentStartIndex] && lines[contentStartIndex].startsWith('Tags:')) {
                        const tagsText = lines[contentStartIndex].replace('Tags:', '').trim();
                        tags = parseTagsFromInput(tagsText);
                        contentStartIndex = contentStartIndex + 1;
                    }
                    
                    // Look for Dream Signs line
                    if (lines[contentStartIndex] && lines[contentStartIndex].startsWith('Dream Signs:')) {
                        const dreamSignsText = lines[contentStartIndex].replace('Dream Signs:', '').trim();
                        dreamSigns = parseTagsFromInput(dreamSignsText);
                        contentStartIndex = contentStartIndex + 1;
                    }
                    
                    const content = lines.slice(contentStartIndex)
                        .join('\n')
                        .replace(/^Content:\s*/, '') // Remove "Content:" prefix
                        .trim();
                    
                    if (!title || !content) return; // Skip entries without required data
                    
                    // Generate display date from timestamp
                    const timestampDate = new Date(timestamp);
                    const dateString = timestampDate.toLocaleDateString('en-AU', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    const newDream = {
                        id: generateUniqueId(),
                        title: title,
                        content: content,
                        emotions: emotions, // Include emotions in imported dreams
                        tags: tags, // Include tags in imported dreams
                        dreamSigns: dreamSigns, // Include dream signs in imported dreams
                        isLucid: Boolean(isLucid),
                        timestamp: timestamp,
                        dateString: dateString
                    };
                    
                    // Validate the dream data before proceeding
                    if (validateDreamData(newDream)) {
                        // Check for duplicates before adding
                        if (isDreamDuplicate(dreams, newDream)) {
                            skippedCount++;
                        } else {
                            dreams.unshift(newDream);
                            importedCount++;
                        }
                    }
                } catch (entryError) {
                    // Skip invalid entries silently
                }
            });
            
            try {
                await saveDreams(dreams);
                await displayDreams();
                
                // Show success message with import stats
                const container = document.querySelector('.main-content');
                if (container) {
                    const msg = document.createElement('div');
                    msg.className = importedCount > 0 ? 'message-success' : 'message-error';
                    
                    let messageText = '';
                    const fileType = encryptionEnabled || isEncryptedFile ? 'encrypted' : 'standard';
                    
                    if (importedCount > 0 && skippedCount > 0) {
                        messageText = `${fileType === 'encrypted' ? 'Encrypted import' : 'Import'} complete! Added ${importedCount} new dreams, skipped ${skippedCount} duplicates.`;
                    } else if (importedCount > 0) {
                        messageText = `Successfully imported ${importedCount} dreams from ${fileType} file!`;
                    } else if (skippedCount > 0) {
                        messageText = `Import complete! All ${skippedCount} dreams were already in your journal.`;
                    } else {
                        messageText = 'No valid dreams found in the file.';
                    }
                    
                    msg.textContent = messageText;
                    container.insertBefore(msg, container.firstChild);
                    
                    setTimeout(() => {
                        try {
                            if (msg && msg.parentNode) {
                                msg.remove();
                            }
                        } catch (e) {
                            // Ignore cleanup errors
                        }
                    }, 5000);
                }
            } catch (error) {
                throw new Error('Failed to save imported dreams: ' + error.message);
            }
        } catch (error) {
            console.error('Import error:', error);
            
            createInlineMessage('error', 'Import error: ' + error.message, {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 5000
            });
        } finally {
            // Clear the file input
            event.target.value = '';
        }
    }

// ================================
// 3. COMPLETE DATA EXPORT SYSTEM
// ================================

/**
 * Exports complete application data to JSON file with optional encryption.
 * 
 * Creates comprehensive backup including dreams, goals, voice notes metadata,
 * and application settings. Generates detailed export metadata with statistics
 * and timestamps. Voice note audio data is not exported due to size limitations,
 * only metadata is preserved.
 * 
 * @async
 * @throws {Error} When app is locked, no data exists, or export fails
 * @since 2.0.0
 * @todo Split into collectApplicationData() and exportToFile() functions for better separation of concerns
 * @example
 * await exportAllData();
 * 
 * @example
 * // Export structure:
 * // {
 * //   exportDate: "2023-12-01T10:30:00.000Z",
 * //   exportType: "complete",
 * //   data: {
 * //     dreams: [...],
 * //     voiceNotes: [{ id, timestamp, duration, transcription, hasAudio }],
 * //     goals: [...],
 * //     settings: { theme, storageType },
 * //     metadata: { totalDreams, totalGoals, lucidDreams }
 * //   }
 * // }
 */
async function exportAllData() {
        if (!validateAppAccess('Please unlock your journal first to export all data.')) {
            return;
        }
        
        try {
            // Collect all data from all sources
            const [dreams, voiceNotes, goals] = await Promise.all([
                loadDreams(),
                loadVoiceNotes(), 
                loadGoals()
            ]);
            
            // Collect settings from localStorage
            const settings = {
                theme: getCurrentTheme(),
                storageType: storageType,
                // Note: PIN data is intentionally NOT exported for security
            };
            
            // Create comprehensive export object
            const exportData = {
                exportDate: new Date().toISOString(),
                exportType: "complete",
                data: {
                    dreams: dreams || [],
                    voiceNotes: (voiceNotes || []).map(note => ({
                        // Convert voice notes to exportable format (without blob data)
                        id: note.id,
                        timestamp: note.timestamp,
                        duration: note.duration,
                        transcription: note.transcription || '',
                        // Note: Audio blob data is not exported due to size and format limitations
                        hasAudio: !!note.audioBlob
                    })),
                    goals: goals || [],
                    settings: settings,
                    metadata: {
                        totalDreams: (dreams || []).length,
                        totalVoiceNotes: (voiceNotes || []).length,
                        totalGoals: (goals || []).length,
                        lucidDreams: (dreams || []).filter(d => d.isLucid).length,
                    }
                }
            };
            
            if (exportData.data.dreams.length === 0 && exportData.data.goals.length === 0) {
                createInlineMessage('error', 'No data to export yet. Create some dreams or goals first!', {
                    container: document.querySelector('.main-content'),
                    position: 'top',
                    duration: 3000
                });
                return;
            }
            
            const jsonData = JSON.stringify(exportData, null, 2);
            
            // Check if encryption is enabled
            const encryptionEnabled = document.getElementById('fullDataEncryption').checked;
            let finalData = jsonData;
            let fileName = `dream-journal-complete-${new Date().toISOString().split('T')[0]}.json`;
            let mimeType = 'application/json';
            
            if (encryptionEnabled) {
                // Show password dialog
                const password = await showPasswordDialog({
                    type: 'export',
                    title: '🔐 Set Complete Export Password',
                    description: 'Choose a password to encrypt your complete data export. This includes all dreams, goals, and settings. Remember this password for importing!',
                    requireConfirm: true,
                    primaryButtonText: 'Encrypt & Export'
                });
                
                if (!password) {
                    return; // User cancelled
                }
                
                // Encrypt the data
                const encryptedData = await encryptData(jsonData, password);
                finalData = encryptedData;
                fileName = `dream-journal-complete-${new Date().toISOString().split('T')[0]}.enc`;
                mimeType = 'application/octet-stream';
            }
            
            // Create and download file
            const blob = new Blob([finalData], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';
            
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                if (document.body.contains(a)) {
                    document.body.removeChild(a);
                }
                URL.revokeObjectURL(url);
            }, CONSTANTS.DOWNLOAD_CLEANUP_DELAY_MS);
            
            // Show success message with export stats
            const stats = exportData.data.metadata;
            const successMessage = encryptionEnabled ? 
                `Encrypted complete export created! (${stats.totalDreams} dreams, ${stats.totalGoals} goals)` : 
                `Complete export created! (${stats.totalDreams} dreams, ${stats.totalGoals} goals)`;
                
            createInlineMessage('success', successMessage, {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 4000
            });
            
        } catch (error) {
            console.error('Complete export error:', error);
            createInlineMessage('error', 'Error creating complete export: ' + error.message, {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 5000
            });
        }
    }

// ================================
// 4. COMPLETE DATA IMPORT SYSTEM
// ================================

/**
 * Imports complete application data from JSON file with smart merge options.
 * 
 * Supports encrypted imports, automatic duplicate detection, and intelligent
 * merging of dreams and goals. Validates import data structure and provides
 * detailed import statistics. Does not import PIN data for security reasons.
 * 
 * @async
 * @param {Event} event - File input change event containing selected JSON file
 * @throws {Error} When file reading, parsing, decryption, validation, or saving fails
 * @since 2.0.0
 * @example
 * // Called via file input change event
 * document.getElementById('fullImportFile').addEventListener('change', importAllData);
 * 
 * @example
 * // Import statistics reported:
 * // "Added 5 dreams and 3 goals, skipped 2 duplicates"
 * // "All 8 items were already in your journal"
 * // "Successfully imported 10 dreams and 5 goals!"
 */
async function importAllData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            // Check if encryption is enabled
            const encryptionEnabled = document.getElementById('fullDataEncryption').checked;
            const isEncryptedFile = file.name.endsWith('.enc');
            
            // Read file
            const fileData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                
                if (encryptionEnabled || isEncryptedFile) {
                    reader.readAsArrayBuffer(file);
                } else {
                    reader.readAsText(file);
                }
            });
            
            let text = '';
            
            // Handle encrypted files
            if (encryptionEnabled || isEncryptedFile) {
                if (typeof fileData === 'string') {
                    throw new Error('Selected file appears to be unencrypted. Uncheck encryption or select an encrypted (.enc) file.');
                }
                
                // Show password dialog
                const password = await showPasswordDialog({
                    type: 'import',
                    title: '🔓 Enter Complete Import Password',
                    description: 'Enter the password used to encrypt this complete data export file.',
                    requireConfirm: false,
                    primaryButtonText: 'Decrypt & Import'
                });
                
                if (!password) {
                    event.target.value = '';
                    return;
                }
                
                try {
                    text = await decryptData(new Uint8Array(fileData), password);
                } catch (decryptError) {
                    throw new Error('Failed to decrypt file. Please check your password and try again.');
                }
            } else {
                if (typeof fileData !== 'string') {
                    throw new Error('Selected file appears to be encrypted. Check encryption option or select a JSON (.json) file.');
                }
                text = fileData;
            }
            
            // Parse JSON data
            const importData = JSON.parse(text);
            
            // Validate import data structure
            if (!importData.data || (!importData.data.dreams && !importData.data.goals)) {
                throw new Error('Invalid import file format. No dreams or goals data found.');
            }
            
            const stats = { importedDreams: 0, importedGoals: 0, skippedDreams: 0, skippedGoals: 0 };
            
            // Import dreams with duplicate checking
            if (importData.data.dreams && Array.isArray(importData.data.dreams)) {
                const currentDreams = await loadDreams();
                const importDreams = importData.data.dreams;
                
                // Filter out duplicates based on title and content similarity
                const newDreams = importDreams.filter(importDream => {
                    const isDuplicate = currentDreams.some(existingDream => {
                        return existingDream.title === importDream.title &&
                               existingDream.content === importDream.content;
                    });
                    
                    if (isDuplicate) {
                        stats.skippedDreams++;
                        return false;
                    } else {
                        stats.importedDreams++;
                        // Ensure imported dream has required fields
                        if (!importDream.id) importDream.id = generateUniqueId();
                        if (!importDream.timestamp) importDream.timestamp = new Date().toISOString();
                        if (!importDream.dateString) {
                            const date = new Date(importDream.timestamp);
                            importDream.dateString = date.toLocaleDateString('en-AU', {
                                year: 'numeric',
                                month: 'long', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        }
                        return true;
                    }
                });
                
                // Add new dreams
                if (newDreams.length > 0) {
                    const mergedDreams = [...currentDreams, ...newDreams];
                    await saveDreams(mergedDreams);
                }
            }
            
            // Import goals with duplicate checking
            if (importData.data.goals && Array.isArray(importData.data.goals)) {
                const currentGoals = await loadGoals();
                const importGoals = importData.data.goals;
                
                // Filter out duplicates based on title and description
                const newGoals = importGoals.filter(importGoal => {
                    const isDuplicate = currentGoals.some(existingGoal => {
                        return existingGoal.title === importGoal.title &&
                               existingGoal.description === importGoal.description;
                    });
                    
                    if (isDuplicate) {
                        stats.skippedGoals++;
                        return false;
                    } else {
                        stats.importedGoals++;
                        // Ensure imported goal has required fields
                        if (!importGoal.id) importGoal.id = generateUniqueId();
                        if (!importGoal.createdAt) importGoal.createdAt = new Date().toISOString();
                        return true;
                    }
                });
                
                // Add new goals
                if (newGoals.length > 0) {
                    const mergedGoals = [...currentGoals, ...newGoals];
                    await saveGoals(mergedGoals);
                }
            }
            
            // Refresh all displays
            await Promise.all([
                displayDreams(),
                displayGoals()
            ]);
            
            // Show success message with import statistics
            const totalImported = stats.importedDreams + stats.importedGoals;
            const totalSkipped = stats.skippedDreams + stats.skippedGoals;
            
            let message = '';
            if (totalImported > 0 && totalSkipped > 0) {
                message = `Complete import finished! Added ${stats.importedDreams} dreams and ${stats.importedGoals} goals, skipped ${totalSkipped} duplicates.`;
            } else if (totalImported > 0) {
                message = `Successfully imported ${stats.importedDreams} dreams and ${stats.importedGoals} goals!`;
            } else if (totalSkipped > 0) {
                message = `Import complete! All ${totalSkipped} items were already in your journal.`;
            } else {
                message = 'No new data found in the import file.';
            }
            
            createInlineMessage('success', message, {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 5000
            });
            
        } catch (error) {
            console.error('Complete import error:', error);
            createInlineMessage('error', 'Complete import error: ' + error.message, {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 5000
            });
        } finally {
            event.target.value = '';
        }
    }

// ================================
// 5. AI ANALYSIS EXPORT SYSTEM
// ================================

/**
 * Exports dreams formatted for AI analysis with comprehensive prompt generation.
 * 
 * Applies current display filters and sorting, optimizes dream selection for
 * analysis (limits to most recent dreams for large datasets), and creates
 * a detailed analysis prompt with lucidity statistics, dream metadata, and
 * specific analysis instructions for AI systems.
 * 
 * @async
 * @throws {Error} When app is locked, no dreams match filters, or export fails
 * @since 2.0.0
 * @todo Split into filterAndSortDreams() and generateAnalysisPrompt() functions for better modularity
 * @example
 * await exportForAIAnalysis();
 * 
 * @example
 * // Generated prompt includes:
 * // - Dream entries with [LUCID DREAM] or [REGULAR DREAM] tags
 * // - Emotions, tags, and dream signs metadata
 * // - Lucidity statistics and patterns
 * // - Specific analysis instructions for AI systems
 * // - Performance optimization for large datasets
 */
async function exportForAIAnalysis() {
        if (!validateAppAccess('Please unlock your journal first to export for analysis.')) {
            return;
        }
        
        const { searchTerm, filterType, sortType, startDate, endDate } = getFilterValues();
        const allDreams = await loadDreams();
        
        // Apply same filtering as display
        let dreams = filterDreams(allDreams, searchTerm, filterType, startDate, endDate);
        
        // Apply same sorting as display for consistency
        dreams.sort((a, b) => {
            switch (sortType) {
                case 'oldest':
                    return new Date(a.timestamp) - new Date(b.timestamp);
                
                case 'lucid-first':
                    if (a.isLucid && !b.isLucid) return -1;
                    if (!a.isLucid && b.isLucid) return 1;
                    return new Date(b.timestamp) - new Date(a.timestamp);
                
                case 'longest':
                    return b.content.length - a.content.length;
                
                case 'newest':
                default:
                    return new Date(b.timestamp) - new Date(a.timestamp);
            }
        });
        
        if (dreams.length === 0) {
            const filterText = filterType === 'all' ? '' : 
                filterType === 'lucid' ? ' lucid' : ' non-lucid';
            
            const noResultsMessage = `No${filterText} dreams to export for analysis${searchTerm ? ' matching your search' : ''}. ${filterType === 'lucid' ? 'Try recording some lucid dreams first!' : 'Record some dreams first!'}`;
            
            createInlineMessage('error', noResultsMessage, {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 5000
            });
            return;
        }
        
        try {
            // Performance optimization: Limit analysis to most recent dreams based on size
            const maxDreams = dreams.length > CONSTANTS.AI_ANALYSIS_THRESHOLD ? CONSTANTS.AI_ANALYSIS_RECENT_LIMIT : CONSTANTS.AI_ANALYSIS_TOTAL_LIMIT;
            const recentDreams = dreams.slice(0, maxDreams);
            
            // Format dreams for AI analysis
            const dreamTexts = recentDreams.map(dream => {
                const lucidStatus = dream.isLucid ? '[LUCID DREAM]' : '[REGULAR DREAM]';
                const date = new Date(dream.timestamp).toLocaleDateString();
                const emotions = dream.emotions ? ` [EMOTIONS: ${dream.emotions}]` : '';
                const tags = Array.isArray(dream.tags) && dream.tags.length > 0 ? ` [TAGS: ${dream.tags.join(', ')}]` : '';
                const dreamSigns = Array.isArray(dream.dreamSigns) && dream.dreamSigns.length > 0 ? ` [DREAM SIGNS: ${dream.dreamSigns.join(', ')}]` : '';
                return `${lucidStatus}${emotions}${tags}${dreamSigns} ${date} - ${dream.title}: ${dream.content}`;
            }).join('\n\n');
            
            const totalDreams = dreams.length;
            const lucidCount = dreams.filter(d => d.isLucid).length;
            const lucidPercentage = totalDreams > 0 ? ((lucidCount / totalDreams) * 100).toFixed(1) : 0;
            
            // Create the full AI analysis prompt
            const aiAnalysisPrompt = `Analyze these dream journal entries for patterns, themes, and insights. The user has ${totalDreams} total dreams with ${lucidCount} lucid dreams (${lucidPercentage}% lucid rate). Each entry includes emotions, general tags/themes, and dream signs (specific lucidity triggers) when available.

${dreamTexts}

Please provide a comprehensive analysis including:

1. **Dream Patterns & Themes**: What recurring elements, settings, characters, or situations appear across dreams? How do the user's tags reveal their most common dream themes?

2. **Dream Signs Analysis**: What specific dream signs appear most frequently? Which dream signs correlate with lucid dreams vs regular dreams? What are the user's strongest personal lucidity triggers?

3. **Emotional Patterns**: What emotional themes emerge across dreams? How do emotions correlate with dream content, lucidity, or timing? Are there emotional triggers or patterns?

4. **Tag-Based Insights**: What do the user's tags reveal about their dream world? Are there tag patterns that correlate with lucidity, emotions, or specific time periods?

5. **Lucid Dream Analysis**: What triggers or signs indicate increased lucidity? How do tagged elements, emotions, and dream signs work together to create lucid experiences?

6. **Symbolic Interpretation**: What symbols or metaphors appear frequently and what might they represent? How do emotions and tags connect to symbolic content?

7. **Practical Recommendations**: Specific techniques to improve dream recall, increase lucidity recognition, or work with recurring themes. How can the user leverage their personal dream signs for better lucidity?

8. **Sleep & Dream Quality**: Any observations about dream complexity, vividness, timing patterns, and emotional intensity based on the available data?

Make the analysis personal, insightful, and actionable. Focus on helping the user understand their unique dream patterns, recurring dream signs, emotional landscapes, and how to enhance their lucid dreaming practice using their personal data.

${recentDreams.length < totalDreams ? `\n(Note: Analysis based on ${recentDreams.length} most recent dreams of ${totalDreams} total)` : ''}`;
            
            // Create and download the analysis prompt file
            const blob = new Blob([aiAnalysisPrompt], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dream-analysis-prompt-${new Date().toISOString().split('T')[0]}.txt`;
            a.style.display = 'none';
            
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            setTimeout(() => {
                if (document.body.contains(a)) {
                    document.body.removeChild(a);
                }
                URL.revokeObjectURL(url);
            }, 3000);
            
            // Show success message
            const analysisMessage = `AI analysis prompt created! (${recentDreams.length} dreams, ${lucidPercentage}% lucid rate)`;
            
            createInlineMessage('success', analysisMessage, {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 4000
            });
            
        } catch (error) {
            console.error('AI analysis export error:', error);
            createInlineMessage('error', 'Error creating AI analysis: ' + error.message, {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 5000
            });
        }
    }

// ================================
// 6. PASSWORD DIALOG SYSTEM
// ================================

/**
 * Creates unified password dialog for import/export encryption operations.
 * 
 * Supports both export mode (with password confirmation) and import mode
 * (single password entry). Integrates with the action delegation system
 * for event handling and provides consistent user experience across all
 * encryption/decryption operations.
 * 
 * @param {Object} config - Dialog configuration object
 * @param {string} config.type - Dialog type ('export' or 'import')
 * @param {string} config.title - Dialog title text
 * @param {string} config.description - Dialog description text
 * @param {boolean} config.requireConfirm - Whether to show password confirmation field
 * @param {string} config.primaryButtonText - Text for primary action button
 * @param {string} [config.icon='🔐'] - Icon to display in dialog header
 * @returns {Promise<string|null>} Entered password or null if cancelled
 * @since 2.0.0
 * @example
 * const password = await showPasswordDialog({
 *   type: 'export',
 *   title: 'Set Export Password',
 *   description: 'Choose a password to encrypt your export.',
 *   requireConfirm: true,
 *   primaryButtonText: 'Encrypt & Export'
 * });
 * 
 * @example
 * const password = await showPasswordDialog({
 *   type: 'import',
 *   title: 'Enter Import Password', 
 *   description: 'Enter the decryption password.',
 *   requireConfirm: false,
 *   primaryButtonText: 'Decrypt & Import'
 * });
 */
function showPasswordDialog(config) {
    return new Promise((resolve) => {
        const existingOverlay = document.getElementById('passwordDialogOverlay');
        if(existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = 'passwordDialogOverlay';
        overlay.className = 'pin-overlay';
        overlay.style.display = 'flex';

        const confirmInputHTML = config.requireConfirm ? `
            <input type="password" id="${config.type}PasswordConfirm" class="pin-input" placeholder="Confirm password" maxlength="50" style="margin-top: 10px;">
        ` : '';

        overlay.innerHTML = `
            <div class="pin-container">
                <h2>${config.icon || '🔐'} ${escapeHtml(config.title)}</h2>
                <p>${escapeHtml(config.description)}</p>
                <input type="password" id="${config.type}Password" class="pin-input" placeholder="Enter password" maxlength="50">
                ${confirmInputHTML}
                <div class="pin-buttons">
                    <button data-action="confirm-${config.type}-password" class="btn btn-primary">${escapeHtml(config.primaryButtonText)}</button>
                    <button data-action="cancel-${config.type}-password" class="btn btn-secondary">Cancel</button>
                </div>
                <div id="${config.type}PasswordError" class="notification-message error"></div>
            </div>
        `;
        
        document.body.appendChild(overlay);

        window[`${config.type}PasswordResolve`] = resolve;

        setTimeout(() => {
            document.getElementById(`${config.type}Password`).focus();
        }, 100);

        overlay.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const action = `confirm-${config.type}-password`;
                const handler = ACTION_MAP[action];
                if(handler) handler();
            }
        });
    });
}

/**
 * Shows password input dialog for export operations.
 * 
 * Pre-configured wrapper for showPasswordDialog() with export-specific
 * settings including password confirmation requirement and appropriate
 * messaging for encryption operations.
 * 
 * @returns {Promise<string|null>} Export password or null if cancelled
 * @since 2.0.0
 * @deprecated Use showPasswordDialog() directly with export config
 * @example
 * const password = await showExportPasswordDialog();
 * if (password) {
 *   // Proceed with encrypted export
 * }
 */
function showExportPasswordDialog() {
    return showPasswordDialog({
        type: 'export',
        title: 'Set Export Password',
        description: 'Choose a password to encrypt your dream export. This password is not stored - remember it for importing!',
        requireConfirm: true,
        primaryButtonText: 'Encrypt & Export'
    });
}

/**
 * Confirms export password with validation and confirmation matching.
 * 
 * Validates password meets minimum length requirements and confirms
 * that password and confirmation fields match before resolving the
 * password dialog promise. Displays inline errors for validation failures.
 * 
 * @throws {Error} Implicitly through promise rejection for validation failures
 * @since 2.0.0
 * @example
 * // Called via action delegation system
 * // data-action="confirm-export-password"
 * confirmExportPassword();
 */
function confirmExportPassword() {
    const password = document.getElementById('exportPassword').value;
    const confirm = document.getElementById('exportPasswordConfirm').value;
    const errorDiv = document.getElementById('exportPasswordError');
    
    if (!password || password.length < 4) {
        errorDiv.textContent = 'Password must be at least 4 characters long';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (password !== confirm) {
        errorDiv.textContent = 'Passwords do not match';
        errorDiv.style.display = 'block';
        return;
    }
    
    const overlay = document.getElementById('passwordDialogOverlay');
    if (overlay) overlay.remove();
    
    if (window.exportPasswordResolve) {
        window.exportPasswordResolve(password);
        delete window.exportPasswordResolve;
    }
}

/**
 * Cancels export password dialog and resolves with null.
 * 
 * Cleans up password dialog overlay and resolves the dialog promise
 * with null to indicate user cancellation. Handles cleanup of DOM
 * elements and promise resolver functions.
 * 
 * @since 2.0.0
 * @example
 * // Called via action delegation system
 * // data-action="cancel-export-password"
 * cancelExportPassword();
 */
function cancelExportPassword() {
    const overlay = document.getElementById('passwordDialogOverlay');
    if (overlay) overlay.remove();
    
    if (window.exportPasswordResolve) {
        window.exportPasswordResolve(null);
        delete window.exportPasswordResolve;
    }
}

/**
 * Shows password input dialog for import operations.
 * 
 * Pre-configured wrapper for showPasswordDialog() with import-specific
 * settings including single password entry (no confirmation) and
 * appropriate messaging for decryption operations.
 * 
 * @returns {Promise<string|null>} Import password or null if cancelled
 * @since 2.0.0
 * @deprecated Use showPasswordDialog() directly with import config
 * @example
 * const password = await showImportPasswordDialog();
 * if (password) {
 *   // Proceed with decryption
 * }
 */
function showImportPasswordDialog() {
    return showPasswordDialog({
        type: 'import',
        title: 'Enter Import Password',
        description: 'Enter the password used to encrypt this dream export file.',
        requireConfirm: false,
        primaryButtonText: 'Decrypt & Import'
    });
}

/**
 * Confirms import password with basic validation.
 * 
 * Validates that a password has been entered before resolving the
 * password dialog promise. Displays inline error for empty passwords.
 * Less strict validation than export confirmation since import passwords
 * are validated against the encrypted data itself.
 * 
 * @throws {Error} Implicitly through promise rejection for validation failures
 * @since 2.0.0
 * @example
 * // Called via action delegation system
 * // data-action="confirm-import-password"
 * confirmImportPassword();
 */
function confirmImportPassword() {
    const password = document.getElementById('importPassword').value;
    const errorDiv = document.getElementById('importPasswordError');
    
    if (!password) {
        errorDiv.textContent = 'Please enter the password';
        errorDiv.style.display = 'block';
        return;
    }
    
    const overlay = document.getElementById('passwordDialogOverlay');
    if (overlay) overlay.remove();
    
    if (window.importPasswordResolve) {
        window.importPasswordResolve(password);
        delete window.importPasswordResolve;
    }
}

/**
 * Cancels import password dialog and resolves with null.
 * 
 * Cleans up password dialog overlay and resolves the dialog promise
 * with null to indicate user cancellation. Handles cleanup of DOM
 * elements and promise resolver functions.
 * 
 * @since 2.0.0
 * @example
 * // Called via action delegation system
 * // data-action="cancel-import-password"
 * cancelImportPassword();
 */
function cancelImportPassword() {
    const overlay = document.getElementById('passwordDialogOverlay');
    if (overlay) overlay.remove();
    
    if (window.importPasswordResolve) {
        window.importPasswordResolve(null);
        delete window.importPasswordResolve;
    }
}