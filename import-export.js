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
 * @version 2.04.00
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
// ES MODULE IMPORTS
// ================================

import { CONSTANTS } from './constants.js';
import { getAppLocked, getUnlocked } from './state.js';
import { 
    loadDreams, 
    loadGoals, 
    saveDreams, 
    saveGoals,
    storageType,
    generateUniqueId,
    getAutocompleteSuggestions,
    saveItemToStore
} from './storage.js';
import { announceLiveMessage, createInlineMessage, escapeHtml, getCurrentTheme, formatDateTimeDisplay, formatDisplayDate, parseImportDate } from './dom-helpers.js';
import { 
    encryptData, 
    decryptData,
    isPinSetup 
} from './security.js';
import { 
    displayDreams, 
    filterDreams,
    getFilterValues,
    parseTagsFromInput
} from './dream-crud.js';
import { displayGoals } from './goalstab.js';

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
    if (getAppLocked() || (isPinSetup() && !getUnlocked())) {
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
                container: document.getElementById('settingsTab') || document.querySelector('.main-content'),
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
                
                // Include the original ID for robust import/export
                const safeId = dream && dream.id ? dream.id : generateUniqueId();
                
                let exportEntry = `Title: ${safeTitle}\n` +
                       `ID: ${safeId}\n` +
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
                container: document.getElementById('settingsTab') || document.querySelector('.main-content'),
                position: 'top',
                duration: 3000
            });
            
        } catch (error) {
            console.error('Export error:', error);
            
            createInlineMessage('error', 'Error creating export: ' + error.message, {
                container: document.getElementById('settingsTab') || document.querySelector('.main-content'),
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

/**
 * Validates dream data structure and required fields.
 * 
 * Ensures imported dream entries have all required fields and valid data
 * before adding them to the dreams array.
 * 
 * @param {Object} dream - Dream entry to validate
 * @returns {boolean} True if dream data is valid
 * @since 2.02.22
 * @example
 * if (validateDreamData(newDream)) {
 *   // Dream is valid, proceed with import
 * }
 */
function validateDreamData(dream) {
    return dream && 
           typeof dream.id === 'string' && 
           typeof dream.title === 'string' && 
           typeof dream.content === 'string' && 
           dream.title.trim().length > 0 && 
           dream.content.trim().length > 0 &&
           typeof dream.timestamp === 'string' &&
           !isNaN(new Date(dream.timestamp).getTime());
}

/**
 * Checks if a dream entry is a duplicate of existing dreams.
 * 
 * Uses ID-based detection when available, falling back to content-based
 * detection for legacy imports. Dreams with different IDs are never
 * considered duplicates, even if content is identical.
 * 
 * @param {Array} existingDreams - Array of current dreams
 * @param {Object} newDream - Dream entry to check for duplicates
 * @returns {boolean} True if dream is a duplicate
 * @since 2.02.25
 * @example
 * // Dreams with different IDs are always imported
 * const dream1 = { id: 'abc123', title: 'Test', content: 'Same content' };
 * const dream2 = { id: 'def456', title: 'Test', content: 'Same content' };
 * isDreamDuplicate([dream1], dream2); // false - different IDs
 * 
 * @example
 * // Dreams with same ID must have matching content
 * const existing = { id: 'abc123', title: 'Test', content: 'Content' };
 * const duplicate = { id: 'abc123', title: 'Test', content: 'Content' };
 * isDreamDuplicate([existing], duplicate); // true - same ID and content
 */
/**
 * Detects ID collision scenarios where same ID exists but with different content.
 * 
 * @param {Array} existingDreams - Array of current dreams
 * @param {Object} newDream - Dream entry to check
 * @returns {Object|null} Collision info if detected, null if no collision
 * @since 2.02.24
 */
function detectIdCollision(existingDreams, newDream) {
    if (!newDream.id) return null;
    
    const existingWithSameId = existingDreams.find(existing => 
        existing.id === newDream.id
    );
    
    if (existingWithSameId) {
        // Check if content is different (indicating a collision)
        const contentMatches = existingWithSameId.title === newDream.title &&
                              existingWithSameId.content === newDream.content &&
                              existingWithSameId.timestamp === newDream.timestamp;
        
        if (!contentMatches) {
            return {
                existingDream: existingWithSameId,
                collision: true
            };
        }
    }
    
    return null;
}

function isDreamDuplicate(existingDreams, newDream) {
    return existingDreams.some(existing => {
        // Primary check: If both have IDs, only ID match matters
        // Different IDs = Different dreams, regardless of content similarity
        if (existing.id && newDream.id) {
            if (existing.id === newDream.id) {
                // Same ID - verify content matches (protects against ID collision)
                return existing.title === newDream.title &&
                       existing.content === newDream.content &&
                       existing.timestamp === newDream.timestamp;
            } else {
                // Different IDs = Different dreams, always import
                return false;
            }
        }
        
        // Secondary check: For legacy imports without IDs, use content-based detection
        // This only applies when one or both dreams lack ID fields
        if (!existing.id || !newDream.id) {
            return existing.title === newDream.title &&
                   existing.content === newDream.content &&
                   existing.timestamp === newDream.timestamp;
        }
        
        return false;
    });
}

async function importEntries(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const encryptionEnabled = document.getElementById('encryptionEnabled').checked;
            const isEncryptedFile = file.name.endsWith('.enc');
            
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
                    
                    // Extract ID if present (new export format includes ID for robust import)
                    let dreamId = null;
                    let nextLineIndex = 1;
                    
                    if (lines[1] && lines[1].startsWith('ID: ')) {
                        dreamId = lines[1].replace('ID: ', '').trim();
                        nextLineIndex = 2;
                    }
                    
                    // Check if this is new format (timestamp) or old format (date string)
                    let timestamp = null;
                    let typeLineIndex = nextLineIndex + 1;
                    
                    if (lines[nextLineIndex] && lines[nextLineIndex].startsWith('Timestamp: ')) {
                        // New format - extract timestamp directly
                        timestamp = lines[nextLineIndex].replace('Timestamp: ', '').trim();
                        typeLineIndex = nextLineIndex + 1;
                    } else if (lines[nextLineIndex] && lines[nextLineIndex].startsWith('Date: ')) {
                        // Old format - try to parse the display date
                        const dateStr = lines[nextLineIndex].replace('Date: ', '').trim();
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
                    const dateString = formatDateTimeDisplay(timestamp);
                    
                    const newDream = {
                        id: dreamId || generateUniqueId(), // Use original ID if available, otherwise generate new one
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
                        // Check for ID collisions first
                        const idCollision = detectIdCollision(dreams, newDream);
                        if (idCollision) {
                            // ID collision detected - generate new ID to preserve both dreams
                            console.warn('ID collision detected during import:', {
                                originalId: newDream.id,
                                existingTitle: idCollision.existingDream.title,
                                newTitle: newDream.title
                            });
                            newDream.id = generateUniqueId(); // Generate new ID to avoid collision
                        }
                        
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
                const container = document.getElementById('settingsTab') || document.querySelector('.main-content');
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
                container: document.getElementById('settingsTab') || document.querySelector('.main-content'),
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
 * Creates comprehensive backup including dreams, goals, and application settings.
 * Voice notes are excluded as audio data cannot be reliably exported/imported.
 * Generates detailed export metadata with statistics and timestamps for
 * complete data restoration capabilities.
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
 * //     goals: [...],
 * //     settings: { theme, storageType },
 * //     metadata: { totalDreams, totalGoals, lucidDreams, note }
 * //   }
 * // }
 */
async function exportAllData() {
        if (!validateAppAccess('Please unlock your journal first to export all data.')) {
            return;
        }
        
        try {
            // Collect restorable data (voice notes excluded - audio cannot be exported/imported)
            const [dreams, goals, userTags, userDreamSigns] = await Promise.all([
                loadDreams(),
                loadGoals(),
                getAutocompleteSuggestions('tags'),
                getAutocompleteSuggestions('dreamSigns')
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
                    goals: goals || [],
                    settings: settings,
                    autocomplete: {
                        tags: userTags || [],
                        dreamSigns: userDreamSigns || []
                    },
                    metadata: {
                        totalDreams: (dreams || []).length,
                        totalGoals: (goals || []).length,
                        lucidDreams: (dreams || []).filter(d => d.isLucid).length,
                        totalTags: (userTags || []).length,
                        totalDreamSigns: (userDreamSigns || []).length,
                        note: "Voice notes are not included in exports - audio data cannot be reliably backed up/restored. Use individual voice note downloads for important recordings."
                    }
                }
            };
            
            if (exportData.data.dreams.length === 0 && exportData.data.goals.length === 0) {
                createInlineMessage('error', 'No data to export yet. Create some dreams or goals first!', {
                    container: document.getElementById('settingsTab') || document.querySelector('.main-content'),
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
            const autocompleteCount = stats.totalTags + stats.totalDreamSigns;
            const successMessage = encryptionEnabled ? 
                `Encrypted complete export created! (${stats.totalDreams} dreams, ${stats.totalGoals} goals, ${autocompleteCount} autocomplete items)` : 
                `Complete export created! (${stats.totalDreams} dreams, ${stats.totalGoals} goals, ${autocompleteCount} autocomplete items)`;
                
            createInlineMessage('success', successMessage, {
                container: document.getElementById('settingsTab') || document.querySelector('.main-content'),
                position: 'top',
                duration: 4000
            });
            
        } catch (error) {
            console.error('Complete export error:', error);
            createInlineMessage('error', 'Error creating complete export: ' + error.message, {
                container: document.getElementById('settingsTab') || document.querySelector('.main-content'),
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
                
                // Process dreams with robust duplicate detection and ID collision handling
                const newDreams = [];
                
                importDreams.forEach(importDream => {
                    // Ensure imported dream has required fields
                    if (!importDream.timestamp) importDream.timestamp = new Date().toISOString();
                    if (!importDream.title) importDream.title = 'Untitled Dream';
                    if (!importDream.content) importDream.content = '';
                    
                    // Generate ID with content salting if missing
                    if (!importDream.id) {
                        importDream.id = generateUniqueId({
                            title: importDream.title,
                            timestamp: importDream.timestamp,
                            type: 'dream'
                        });
                    }
                    
                    // Check for ID collisions first
                    const idCollision = detectIdCollision(currentDreams, importDream);
                    if (idCollision) {
                        console.warn('ID collision detected during complete data import:', {
                            originalId: importDream.id,
                            existingTitle: idCollision.existingDream.title,
                            newTitle: importDream.title
                        });
                        importDream.id = generateUniqueId({
                            title: importDream.title,
                            timestamp: importDream.timestamp,
                            type: 'dream'
                        });
                    }
                    
                    // Use robust duplicate detection
                    if (isDreamDuplicate(currentDreams, importDream)) {
                        stats.skippedDreams++;
                    } else {
                        // Generate dateString if missing
                        if (!importDream.dateString) {
                            importDream.dateString = formatDateTimeDisplay(importDream.timestamp);
                        }
                        
                        newDreams.push(importDream);
                        currentDreams.push(importDream); // Add to current array for subsequent collision detection
                        stats.importedDreams++;
                    }
                });
                
                // Add new dreams (currentDreams was modified in the loop, so we need original + newDreams)
                if (newDreams.length > 0) {
                    const originalDreams = await loadDreams(); // Get fresh copy
                    const mergedDreams = [...originalDreams, ...newDreams];
                    await saveDreams(mergedDreams);
                }
            }
            
            // Import goals with duplicate checking
            if (importData.data.goals && Array.isArray(importData.data.goals)) {
                const currentGoals = await loadGoals();
                const importGoals = importData.data.goals;
                
                // Process goals with robust duplicate detection and ID collision handling
                const newGoals = [];
                
                importGoals.forEach(importGoal => {
                    // Ensure imported goal has required fields
                    if (!importGoal.title) importGoal.title = 'Untitled Goal';
                    if (!importGoal.description) importGoal.description = '';
                    if (!importGoal.createdAt) importGoal.createdAt = new Date().toISOString();
                    
                    // Generate ID with content salting if missing
                    if (!importGoal.id) {
                        importGoal.id = generateUniqueId({
                            title: importGoal.title,
                            timestamp: importGoal.createdAt,
                            type: 'goal'
                        });
                    }
                    
                    // Check for ID collisions (adapted for goals)
                    const existingWithSameId = currentGoals.find(existing => existing.id === importGoal.id);
                    if (existingWithSameId) {
                        const contentMatches = existingWithSameId.title === importGoal.title &&
                                              existingWithSameId.description === importGoal.description;
                        if (!contentMatches) {
                            console.warn('Goal ID collision detected during complete data import:', {
                                originalId: importGoal.id,
                                existingTitle: existingWithSameId.title,
                                newTitle: importGoal.title
                            });
                            importGoal.id = generateUniqueId({
                                title: importGoal.title,
                                timestamp: importGoal.createdAt,
                                type: 'goal'
                            });
                        }
                    }
                    
                    // Check for duplicates (ID-based for goals with IDs, content-based for legacy)
                    const isDuplicate = currentGoals.some(existing => {
                        if (existing.id && importGoal.id) {
                            // Both have IDs - only match if same ID AND content
                            if (existing.id === importGoal.id) {
                                return existing.title === importGoal.title &&
                                       existing.description === importGoal.description;
                            }
                            return false; // Different IDs = different goals
                        }
                        // Legacy content-based duplicate detection
                        return existing.title === importGoal.title &&
                               existing.description === importGoal.description;
                    });
                    
                    if (isDuplicate) {
                        stats.skippedGoals++;
                    } else {
                        newGoals.push(importGoal);
                        currentGoals.push(importGoal); // Add for subsequent collision detection
                        stats.importedGoals++;
                    }
                });
                
                // Add new goals (get fresh copy to avoid double-adding)
                if (newGoals.length > 0) {
                    const originalGoals = await loadGoals(); // Get fresh copy
                    const mergedGoals = [...originalGoals, ...newGoals];
                    await saveGoals(mergedGoals);
                }
            }
            
            // Import autocomplete data with merge handling
            if (importData.data.autocomplete) {
                let importedAutocomplete = 0;
                
                // Import tags
                if (importData.data.autocomplete.tags && Array.isArray(importData.data.autocomplete.tags)) {
                    const currentTags = await getAutocompleteSuggestions('tags');
                    const importTags = importData.data.autocomplete.tags;
                    
                    // Merge tags, avoiding duplicates (case-insensitive)
                    const existingTagsLower = currentTags.map(tag => tag.toLowerCase());
                    const newTags = importTags.filter(tag => 
                        tag && !existingTagsLower.includes(tag.toLowerCase())
                    );
                    
                    if (newTags.length > 0) {
                        const mergedTags = [...currentTags, ...newTags].sort((a, b) => 
                            a.toLowerCase().localeCompare(b.toLowerCase())
                        );
                        const { saveAutocompleteSuggestions } = await import('./storage.js');
                        await saveAutocompleteSuggestions('tags', mergedTags);
                        importedAutocomplete += newTags.length;
                    }
                }
                
                // Import dream signs
                if (importData.data.autocomplete.dreamSigns && Array.isArray(importData.data.autocomplete.dreamSigns)) {
                    const currentDreamSigns = await getAutocompleteSuggestions('dreamSigns');
                    const importDreamSigns = importData.data.autocomplete.dreamSigns;
                    
                    // Merge dream signs, avoiding duplicates (case-insensitive)
                    const existingDreamSignsLower = currentDreamSigns.map(sign => sign.toLowerCase());
                    const newDreamSigns = importDreamSigns.filter(sign => 
                        sign && !existingDreamSignsLower.includes(sign.toLowerCase())
                    );
                    
                    if (newDreamSigns.length > 0) {
                        const mergedDreamSigns = [...currentDreamSigns, ...newDreamSigns].sort((a, b) => 
                            a.toLowerCase().localeCompare(b.toLowerCase())
                        );
                        const { saveAutocompleteSuggestions } = await import('./storage.js');
                        await saveAutocompleteSuggestions('dreamSigns', mergedDreamSigns);
                        importedAutocomplete += newDreamSigns.length;
                    }
                }
                
                stats.importedAutocomplete = importedAutocomplete;
            }
            
            // Import settings (theme preference only - storage type changes require manual selection)
            if (importData.data.settings) {
                let importedSettings = 0;
                
                // Import theme preference if it's different from current
                if (importData.data.settings.theme) {
                    const currentTheme = getCurrentTheme();
                    if (importData.data.settings.theme !== currentTheme) {
                        localStorage.setItem('dreamJournalTheme', importData.data.settings.theme);
                        // Apply theme immediately
                        document.body.className = `theme-${importData.data.settings.theme}`;
                        importedSettings++;
                    }
                }
                
                stats.importedSettings = importedSettings;
            }
            
            // Refresh all displays
            await Promise.all([
                displayDreams(),
                displayGoals()
            ]);
            
            // Show success message with import statistics
            const totalImported = stats.importedDreams + stats.importedGoals;
            const totalSkipped = stats.skippedDreams + stats.skippedGoals;
            const autocompleteImported = stats.importedAutocomplete || 0;
            const settingsImported = stats.importedSettings || 0;
            
            let message = '';
            const extraItems = [];
            if (autocompleteImported > 0) extraItems.push(`${autocompleteImported} autocomplete items`);
            if (settingsImported > 0) extraItems.push(`theme setting`);
            const extraText = extraItems.length > 0 ? `, ${extraItems.join(', ')}` : '';
            
            if (totalImported > 0 && totalSkipped > 0) {
                message = `Complete import finished! Added ${stats.importedDreams} dreams, ${stats.importedGoals} goals${extraText}, skipped ${totalSkipped} duplicates.`;
            } else if (totalImported > 0 || autocompleteImported > 0 || settingsImported > 0) {
                message = `Successfully imported ${stats.importedDreams} dreams, ${stats.importedGoals} goals${extraText}!`;
            } else if (totalSkipped > 0) {
                message = `Import complete! All ${totalSkipped} items were already in your journal.`;
            } else {
                message = 'No new data found in the import file.';
            }
            
            createInlineMessage('success', message, {
                container: document.getElementById('settingsTab') || document.querySelector('.main-content'),
                position: 'top',
                duration: 5000
            });
            
        } catch (error) {
            console.error('Complete import error:', error);
            createInlineMessage('error', 'Complete import error: ' + error.message, {
                container: document.getElementById('settingsTab') || document.querySelector('.main-content'),
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
                container: document.getElementById('settingsTab') || document.querySelector('.main-content'),
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
                const date = formatDisplayDate(dream.timestamp);
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
                container: document.getElementById('settingsTab') || document.querySelector('.main-content'),
                position: 'top',
                duration: 4000
            });
            
        } catch (error) {
            console.error('AI analysis export error:', error);
            createInlineMessage('error', 'Error creating AI analysis: ' + error.message, {
                container: document.getElementById('settingsTab') || document.querySelector('.main-content'),
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

// ================================
// ES MODULE EXPORTS
// ================================

export {
    // Core import/export functions
    exportEntries,
    importEntries,
    exportAllData,
    importAllData,
    exportForAIAnalysis,
    
    // Utility functions
    validateAppAccess,
    createDownload,
    readFileWithEncryption,
    
    // Password dialog functions
    showPasswordDialog,
    showExportPasswordDialog,
    confirmExportPassword,
    cancelExportPassword,
    showImportPasswordDialog,
    confirmImportPassword,
    cancelImportPassword
};