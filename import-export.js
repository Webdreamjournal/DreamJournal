    // --- 5.5 Import, Export & Data Management ---
    
    // Export dreams to text file (with optional encryption)
    async function exportEntries() {
        // Check if app is locked
        if (isAppLocked || (isPinSetup() && !isUnlocked)) {
            switchAppTab('lock');
            setTimeout(() => {
                showLockScreenMessage('error', 'Please unlock your journal first to export your dreams.');
            }, 500);
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
            
            // Create and download file
            const blob = new Blob([finalData], { type: mimeType });
            
            if (blob.size === 0) {
                throw new Error('Export file is empty - no data to export');
            }
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';
            
            document.body.appendChild(a);
            
            // Mobile browsers need direct click without setTimeout
            try {
                a.click();
                
                // Clean up after a longer delay to ensure download starts
                setTimeout(() => {
                    if (document.body.contains(a)) {
                        document.body.removeChild(a);
                    }
                    URL.revokeObjectURL(url);
                }, CONSTANTS.DOWNLOAD_CLEANUP_DELAY_MS); // longer delay instead of 100ms
                
            } catch (clickError) {
                console.error('Click error:', clickError);
                // Clean up on error
                if (document.body.contains(a)) {
                    document.body.removeChild(a);
                }
                URL.revokeObjectURL(url);
                throw new Error('Failed to initiate download');
            }
            
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

    // Import dreams from text file (with optional decryption)
    async function importEntries(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            // Check if encryption is enabled
            const encryptionEnabled = document.getElementById('encryptionEnabled').checked;
            const isEncryptedFile = file.name.endsWith('.enc');
            
            // Read file as appropriate type
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
                    title: '🔓 Enter Import Password',
                    description: 'Enter the password used to encrypt this dream export file.',
                    requireConfirm: false,
                    primaryButtonText: 'Decrypt & Import'
                });
                
                if (!password) {
                    // User cancelled
                    event.target.value = ''; // Clear file input
                    return;
                }
                
                try {
                    // Decrypt the data
                    text = await decryptData(new Uint8Array(fileData), password);
                } catch (decryptError) {
                    throw new Error('Failed to decrypt file. Please check your password and try again.');
                }
            } else {
                // Handle unencrypted files
                if (typeof fileData !== 'string') {
                    throw new Error('Selected file appears to be encrypted. Check encryption option or select a text (.txt) file.');
                }
                text = fileData;
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

    // Export ALL application data to JSON file (with optional password protection)
    async function exportAllData() {
        // Check if app is locked
        if (isAppLocked || (isPinSetup() && !isUnlocked)) {
            switchAppTab('lock');
            setTimeout(() => {
                showLockScreenMessage('error', 'Please unlock your journal first to export all data.');
            }, 500);
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
                version: "v2.01.6", // Fixed header duration display update for WebM files
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

    // Import ALL application data from JSON file (with merge/overwrite options)
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

    // Export dreams formatted for AI analysis
    async function exportForAIAnalysis() {
        // Check if app is locked
        if (isAppLocked || (isPinSetup() && !isUnlocked)) {
            switchAppTab('lock');
            setTimeout(() => {
                showLockScreenMessage('error', 'Please unlock your journal first to export for analysis.');
            }, 500);
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

    // === COMPREHENSIVE DATA MANAGEMENT FUNCTIONS ===
    
    // - exportAllData()
    
    // - importAllData()

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
            
            let jsonText = '';
            
            // Handle encrypted files
            if (encryptionEnabled || isEncryptedFile) {
                if (typeof fileData === 'string') {
                    throw new Error('Selected file appears to be unencrypted. Uncheck encryption or select an encrypted (.enc) file.');
                }
                
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
                    jsonText = await decryptData(new Uint8Array(fileData), password);
                } catch (decryptError) {
                    throw new Error('Failed to decrypt file. Please check your password and try again.');
                }
            } else {
                if (typeof fileData !== 'string') {
                    throw new Error('Selected file appears to be encrypted. Check encryption option or select a JSON (.json) file.');
                }
                jsonText = fileData;
            }
            
            // Parse JSON data
            let importData;
            try {
                importData = JSON.parse(jsonText);
            } catch (parseError) {
                throw new Error('Invalid JSON file format. Please select a valid Dream Journal export file.');
            }
            
            // Validate export format
            if (!importData.data || !importData.exportType) {
                throw new Error('Invalid export file format. This does not appear to be a complete Dream Journal export.');
            }
            
            // Show import options dialog
            const importMode = await showImportOptionsDialog(importData);
            if (!importMode) {
                event.target.value = '';
                return; // User cancelled
            }
            
            // Process import based on selected mode
            await processCompleteImport(importData, importMode);
            
            // Show success message
            const stats = importData.data.metadata || {};
            const successMessage = `Complete import ${importMode === 'merge' ? 'merged' : 'completed'}! ` +
                `(${stats.totalDreams || 0} dreams, ${stats.totalGoals || 0} goals)`;
                
            createInlineMessage('success', successMessage, {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 4000
            });
            
        } catch (error) {
            console.error('Complete import error:', error);
            createInlineMessage('error', 'Complete import failed: ' + error.message, {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 5000
            });
        } finally {
            event.target.value = '';
        }
    }
    
    // Show import options dialog (merge vs overwrite)
    async function showImportOptionsDialog(importData) {
        return new Promise((resolve) => {
            // Create import options overlay
            const overlay = document.createElement('div');
            overlay.className = 'password-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            const stats = importData.data.metadata || {};
            const currentDreamsData = JSON.parse(localStorage.getItem('dreamJournalEntries') || '[]');
            const currentDreams = currentDreamsData.length;
            const currentLucidDreams = currentDreamsData.filter(d => d.isLucid).length;
            const currentGoals = JSON.parse(localStorage.getItem('dreamJournalGoals') || '[]').length;
            
            overlay.innerHTML = `
                <div class="password-dialog" style="max-width: 600px; width: 90%; background: var(--bg-elevated); border: 2px solid var(--border-color); border-radius: var(--border-radius-lg); padding: 30px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);">
                    <h3 style="margin-bottom: 20px; color: var(--text-primary); font-size: 20px; font-weight: 600;">📥 Import Options</h3>
                    
                    <div style="background: var(--bg-subtle); border: 1px solid var(--border-light); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <h4 style="margin-bottom: 10px; color: var(--text-primary); font-size: 16px; font-weight: 600;">Import Data Preview:</h4>
                        <div style="color: var(--text-secondary); font-size: 14px; line-height: 1.5;">
                            • Dreams: ${stats.totalDreams || 0} (${stats.lucidDreams || 0} lucid)<br>
                            • Goals: ${stats.totalGoals || 0}<br>
                            • Voice Notes: ${stats.totalVoiceNotes || 0} (metadata only)<br>
                            • Export Date: ${importData.exportDate ? new Date(importData.exportDate).toLocaleDateString() : 'Unknown'}
                        </div>
                    </div>
                    
                    <div style="background: var(--bg-light); border: 1px solid var(--border-light); border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin-bottom: 10px; color: var(--text-primary); font-size: 16px; font-weight: 600;">Current Data:</h4>
                        <div style="color: var(--text-secondary); font-size: 14px; line-height: 1.5;">
                            • Dreams: ${currentDreams} (${currentLucidDreams} lucid)<br>
                            • Goals: ${currentGoals}
                        </div>
                    </div>
                    
                    <p style="margin-bottom: 20px; color: var(--text-primary); line-height: 1.5; font-weight: 500;">
                        Choose how to handle this import:
                    </p>
                    
                    <div class="import-options" style="margin-bottom: 25px;">
                        <div style="background: var(--bg-secondary); border: 2px solid var(--primary-color); border-radius: 8px; padding: 15px; margin-bottom: 10px; cursor: pointer; transition: border-color 0.2s;" onclick="this.querySelector('input').checked = true; document.querySelectorAll('.import-option-card').forEach(c => c.style.borderColor = 'var(--border-color)'); this.style.borderColor = 'var(--primary-color)';" class="import-option-card">
                            <label style="cursor: pointer; display: flex; align-items: flex-start; gap: 12px;">
                                <input type="radio" name="importMode" value="merge" checked style="margin-top: 3px; accent-color: var(--primary-color);">
                                <div>
                                    <strong style="color: var(--primary-color); font-size: 15px;">🔀 Smart Merge (Recommended)</strong>
                                    <div style="color: var(--text-secondary); font-size: 13px; margin-top: 6px; line-height: 1.4;">
                                        Add new items and update existing ones. Keeps all your current data safe.
                                    </div>
                                </div>
                            </label>
                        </div>
                        
                        <div style="background: var(--bg-secondary); border: 2px solid var(--border-color); border-radius: 8px; padding: 15px; cursor: pointer; transition: border-color 0.2s;" onclick="this.querySelector('input').checked = true; document.querySelectorAll('.import-option-card').forEach(c => c.style.borderColor = 'var(--border-color)'); this.style.borderColor = 'var(--error-color)';" class="import-option-card">
                            <label style="cursor: pointer; display: flex; align-items: flex-start; gap: 12px;">
                                <input type="radio" name="importMode" value="overwrite" style="margin-top: 3px; accent-color: var(--error-color);">
                                <div>
                                    <strong style="color: var(--error-color); font-size: 15px;">⚠️ Complete Overwrite</strong>
                                    <div style="color: var(--text-secondary); font-size: 13px; margin-top: 6px; line-height: 1.4;">
                                        Replace ALL current data with imported data. Cannot be undone!
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                    
                    <div class="password-buttons" style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button onclick="window.completeImportResolve(document.querySelector('input[name=importMode]:checked').value)" 
                                class="btn btn-primary" style="font-weight: 600;">Continue Import</button>
                        <button onclick="window.completeImportResolve(null)" 
                                class="btn btn-secondary">Cancel</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            // Set up global resolver function
            window.completeImportResolve = (mode) => {
                document.body.removeChild(overlay);
                delete window.completeImportResolve;
                resolve(mode);
            };
            
            // Handle radio button visual feedback
            overlay.querySelectorAll('.import-option-card').forEach(card => {
                card.addEventListener('click', () => {
                    // Reset all borders
                    overlay.querySelectorAll('.import-option-card').forEach(c => {
                        c.style.borderColor = 'var(--border-color)';
                    });
                    // Highlight selected
                    const input = card.querySelector('input');
                    if (input) {
                        input.checked = true;
                        if (input.value === 'overwrite') {
                            card.style.borderColor = 'var(--error-color)';
                        } else {
                            card.style.borderColor = 'var(--primary-color)';
                        }
                    }
                });
            });
            
            // Set initial selection highlight - merge is already highlighted by default in HTML
        });
    }
    
    // Process complete data import based on selected mode
    async function processCompleteImport(importData, mode) {
        const { dreams: importDreams = [], goals: importGoals = [], settings: importSettings = {} } = importData.data;
        
        if (mode === 'overwrite') {
            // Complete replacement - clear everything first
            await saveDreams(importDreams);
            await saveGoals(importGoals);
            
            // Apply settings (theme only for now)
            if (importSettings.theme) {
                switchTheme(importSettings.theme);
            }
            
        } else if (mode === 'merge') {
            // Smart merge - combine with existing data
            
            // Merge dreams (avoid duplicates by ID and content)
            const currentDreams = await loadDreams();
            const existingIds = new Set(currentDreams.map(d => d.id));
            const existingContentHashes = new Set(currentDreams.map(d => `${d.title}_${d.content}_${d.timestamp}`));
            
            const newDreams = importDreams.filter(dream => {
                const contentHash = `${dream.title}_${dream.content}_${dream.timestamp}`;
                return !existingIds.has(dream.id) && !existingContentHashes.has(contentHash);
            });
            
            // Add new dreams
            if (newDreams.length > 0) {
                const mergedDreams = [...currentDreams, ...newDreams];
                await saveDreams(mergedDreams);
            }
            
            // Merge goals (avoid duplicates by title and description)
            const currentGoals = await loadGoals();
            const existingGoalKeys = new Set(currentGoals.map(g => `${g.title}_${g.description}`));
            
            const newGoals = importGoals.filter(goal => {
                const goalKey = `${goal.title}_${goal.description}`;
                return !existingGoalKeys.has(goalKey);
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
    }

    // - exportForAIAnalysis()

    async function exportForAIAnalysis() {
        // Check if app is locked
        if (isAppLocked || (isPinSetup() && !isUnlocked)) {
            switchAppTab('lock');
            setTimeout(() => {
                showLockScreenMessage('error', 'Please unlock your journal first to export for analysis.');
            }, 500);
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
            createInlineMessage('success', 'AI analysis prompt exported! Copy the text and paste it into your preferred AI for dream analysis.', {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 5000
            });
            
        } catch (error) {
            console.error('Export for AI analysis error:', error);
            
            createInlineMessage('error', 'Error creating AI analysis export: ' + error.message, {
                container: document.querySelector('.main-content'),
                position: 'top',
                duration: 5000
            });
        }
    }

     // Password Dialog Functions for Export/Import (defined early to avoid reference errors)
        
        // NEW UNIFIED PASSWORD DIALOG
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

        // Show password input dialog for export (Updated for Event Delegation)
        function showExportPasswordDialog() {
            return showPasswordDialog({
                type: 'export',
                title: 'Set Export Password',
                description: 'Choose a password to encrypt your dream export. This password is not stored - remember it for importing!',
                requireConfirm: true,
                primaryButtonText: 'Encrypt & Export'
            });
        }
        
        // Confirm export password
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
            
            // Remove overlay and resolve with password
            const overlay = document.getElementById('passwordDialogOverlay');
            if (overlay) overlay.remove();
            
            if (window.exportPasswordResolve) {
                window.exportPasswordResolve(password);
                delete window.exportPasswordResolve;
            }
        }
        
        // Cancel export password
        function cancelExportPassword() {
            const overlay = document.getElementById('passwordDialogOverlay');
            if (overlay) overlay.remove();
            
            if (window.exportPasswordResolve) {
                window.exportPasswordResolve(null);
                delete window.exportPasswordResolve;
            }
        }
        
        // Show password input dialog for import (Updated for Event Delegation)
        function showImportPasswordDialog() {
            return showPasswordDialog({
                type: 'import',
                title: 'Enter Import Password',
                description: 'Enter the password used to encrypt this dream export file.',
                requireConfirm: false,
                primaryButtonText: 'Decrypt & Import'
            });
        }
        
        // Confirm import password
        function confirmImportPassword() {
            const password = document.getElementById('importPassword').value;
            const errorDiv = document.getElementById('importPasswordError');
            
            if (!password) {
                errorDiv.textContent = 'Please enter the password';
                errorDiv.style.display = 'block';
                return;
            }
            
            // Remove overlay and resolve with password
            const overlay = document.getElementById('passwordDialogOverlay');
            if (overlay) overlay.remove();
            
            if (window.importPasswordResolve) {
                window.importPasswordResolve(password);
                delete window.importPasswordResolve;
            }
        }
        
        // Cancel import password
        function cancelImportPassword() {
            const overlay = document.getElementById('passwordDialogOverlay');
            if (overlay) overlay.remove();
            
            if (window.importPasswordResolve) {
                window.importPasswordResolve(null);
                delete window.importPasswordResolve;
            }
        }