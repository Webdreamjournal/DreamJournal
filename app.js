// ===================================================================================
// DREAM JOURNAL - MASTER APPLICATION ENTRY POINT
// ===================================================================================
// This file serves as the main entry point that validates all modules are loaded
// correctly and helps debug any function availability issues.

console.log('Dream Journal - Master application entry point loading...');

// ===================================================================================
// VALIDATE ALL CRITICAL FUNCTIONS ARE AVAILABLE
// ===================================================================================

// Function to check if a function exists and log status
function checkFunction(name, fn) {
    if (typeof fn === 'function') {
        console.log(`✓ ${name} - available`);
        return true;
    } else {
        console.error(`✗ ${name} - NOT AVAILABLE (type: ${typeof fn})`);
        return false;
    }
}

// Wait for DOM content loaded to validate functions
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== DREAM JOURNAL FUNCTION AVAILABILITY CHECK ===');
    
    let allFunctionsAvailable = true;
    
    // Voice recording functions
    console.log('--- Voice Recording Functions ---');
    allFunctionsAvailable &= checkFunction('toggleRecording', window.toggleRecording);
    allFunctionsAvailable &= checkFunction('startRecording', window.startRecording);
    allFunctionsAvailable &= checkFunction('stopRecording', window.stopRecording);
    
    // Voice playback functions  
    console.log('--- Voice Playback Functions ---');
    allFunctionsAvailable &= checkFunction('playVoiceNote', window.playVoiceNote);
    allFunctionsAvailable &= checkFunction('pauseVoiceNote', window.pauseVoiceNote);
    allFunctionsAvailable &= checkFunction('seekAudio', window.seekAudio);
    
    // Voice management functions
    console.log('--- Voice Management Functions ---');
    allFunctionsAvailable &= checkFunction('transcribeVoiceNote', window.transcribeVoiceNote);
    allFunctionsAvailable &= checkFunction('createDreamFromTranscription', window.createDreamFromTranscription);
    allFunctionsAvailable &= checkFunction('downloadVoiceNote', window.downloadVoiceNote);
    allFunctionsAvailable &= checkFunction('deleteVoiceNote', window.deleteVoiceNote);
    allFunctionsAvailable &= checkFunction('confirmDeleteVoiceNote', window.confirmDeleteVoiceNote);
    allFunctionsAvailable &= checkFunction('cancelDeleteVoiceNote', window.cancelDeleteVoiceNote);
    allFunctionsAvailable &= checkFunction('displayVoiceNotes', window.displayVoiceNotes);
    
    // DOM helper functions
    console.log('--- DOM Helper Functions ---');
    allFunctionsAvailable &= checkFunction('switchVoiceTab', window.switchVoiceTab);
    allFunctionsAvailable &= checkFunction('createInlineMessage', window.createInlineMessage);
    allFunctionsAvailable &= checkFunction('escapeHtml', window.escapeHtml);
    allFunctionsAvailable &= checkFunction('switchAppTab', window.switchAppTab);
    
    // Action routing
    console.log('--- Action Routing ---');
    allFunctionsAvailable &= checkFunction('routeAction', window.routeAction);
    allFunctionsAvailable &= checkFunction('handleUnifiedClick', window.handleUnifiedClick);
    
    if (allFunctionsAvailable) {
        console.log('✓ ALL FUNCTIONS AVAILABLE - Voice notes should work correctly');
    } else {
        console.error('✗ SOME FUNCTIONS MISSING - Voice notes may not work');
        console.log('This indicates that some modules may not have loaded correctly or functions are not in global scope.');
    }
    
    console.log('=== END FUNCTION CHECK ===');
    
    // Additional diagnostics for event handling
    console.log('=== EVENT HANDLING DIAGNOSTICS ===');
    
    // Check if voice notes container exists
    const voiceContainer = document.getElementById('voiceNotesContainer');
    console.log('Voice notes container:', voiceContainer ? 'Found' : 'NOT FOUND');
    
    // Check if stored notes tab exists and is clickable
    const storedTab = document.querySelector('[data-action="switch-voice-tab"][data-tab="stored"]');
    console.log('Stored notes tab button:', storedTab ? 'Found' : 'NOT FOUND');
    
    // Test switching to stored tab to see if displayVoiceNotes gets called
    if (storedTab) {
        console.log('Testing voice tab switch...');
        try {
            switchVoiceTab('stored');
            console.log('✓ switchVoiceTab("stored") executed successfully');
        } catch (error) {
            console.error('✗ switchVoiceTab("stored") failed:', error);
        }
    }
    
    // Test if displayVoiceNotes can be called directly
    console.log('Testing displayVoiceNotes directly...');
    try {
        displayVoiceNotes();
        console.log('✓ displayVoiceNotes() called successfully');
    } catch (error) {
        console.error('✗ displayVoiceNotes() failed:', error);
    }
    
    // Check ACTION_MAP for voice actions
    if (typeof ACTION_MAP !== 'undefined') {
        console.log('--- ACTION_MAP Voice Actions ---');
        const voiceActions = [
            'play-voice', 'pause-voice', 'transcribe-voice', 
            'download-voice', 'delete-voice', 'confirm-delete-voice', 'cancel-delete-voice'
        ];
        voiceActions.forEach(action => {
            const handler = ACTION_MAP[action];
            console.log(`${action}:`, handler ? 'Mapped' : 'NOT MAPPED');
        });
    } else {
        console.error('✗ ACTION_MAP not available');
    }
    
    console.log('=== END EVENT HANDLING DIAGNOSTICS ===');
    
    // Additional IndexedDB diagnostics
    console.log('=== INDEXEDDB DIAGNOSTICS ===');
    console.log('IndexedDB browser support:', 'indexedDB' in window);
    console.log('IndexedDB object:', !!window.indexedDB);
    
    if (typeof isIndexedDBAvailable === 'function') {
        console.log('isIndexedDBAvailable():', isIndexedDBAvailable());
    }
    if (typeof isIndexedDBReady === 'function') {
        console.log('isIndexedDBReady():', isIndexedDBReady());
    }
    if (typeof db !== 'undefined') {
        console.log('db object:', !!db);
    }
    
    console.log('=== END INDEXEDDB DIAGNOSTICS ===');
});

console.log('Dream Journal - Master application entry point loaded');