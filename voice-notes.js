/**
 * @fileoverview Voice recording system with audio capture, playback and storage
 * management for the Dream Journal application.
 * 
 * This module provides voice recording capabilities including:
 * - Audio recording with MediaRecorder API
 * - Audio playback with seeking and progress tracking
 * - Voice note storage and management
 * - Cross-browser compatibility handling
 * 
 * @module VoiceNotes
 * @version 2.05.06
 * @author Dream Journal Development Team
 * @since 1.0.0
 * @requires constants
 * @requires state
 * @requires storage
 * @requires dom-helpers
 * @example
 * // Initialize voice recording
 * await startRecording();
 * 
 * // Toggle recording state
 * await toggleRecording();
 * 
 * // Play a voice note
 * await playVoiceNote('voice_123_abc');
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { debugLog } from './logger.js';
import { CONSTANTS } from './constants.js';
import { 
    getMediaRecorder,
    setMediaRecorder,
    getAudioChunks,
    setAudioChunks,
    getRecordingStartTime,
    setRecordingStartTime,
    getRecordingTimer,
    setRecordingTimer,
    voiceDeleteTimeouts,
    withMutex,
    currentPlayingAudio,
    setCurrentPlayingAudio,
    getCurrentPlayingAudio
} from './state.js';
import { 
    loadVoiceNotes, 
    saveVoiceNote, 
    saveVoiceNotes,
    isIndexedDBAvailable,
    deleteVoiceNoteFromIndexedDB,
    generateUniqueId,
    isDatabaseClosedForUpgrade
} from './storage.js';
import { RECORDING_NOT_SAVED_MESSAGE } from './storage-banner.js';
import { escapeHtml, escapeAttr, switchVoiceTab, createMetaDisplay, formatDateTimeDisplay, formatDisplayDate } from './dom-helpers.js';

/**
 * Represents a complete voice note with metadata and audio data.
 * 
 * @typedef {Object} VoiceNote
 * @property {string} id - Unique identifier for the voice note
 * @property {Blob} audioBlob - Audio data as a Blob object
 * @property {string} timestamp - ISO timestamp when recording was created
 * @property {number} duration - Duration in seconds (may be estimated)
 * @property {string} title - Human-readable title with date and time
 * @property {string} dateString - Formatted date string for display
 * @property {number} size - Audio file size in bytes
 * @since 1.0.0
 */

/**
 * Browser capability information for voice features.
 * 
 * @typedef {Object} VoiceCapabilities
 * @property {boolean} canRecord - Whether audio recording is supported
 * @property {boolean} hasGetUserMedia - Whether getUserMedia API is available
 * @property {boolean} hasMediaRecorder - Whether MediaRecorder API is available
 * @property {BrowserInfo} browser - Browser-specific information
 * @since 1.0.0
 */

/**
 * Browser detection information for handling browser-specific behaviors.
 * 
 * @typedef {Object} BrowserInfo
 * @property {boolean} isFirefox - Whether browser is Firefox
 * @property {boolean} isFirefoxMobile - Whether browser is Firefox on mobile
 * @property {boolean} isSafari - Whether browser is Safari
 * @property {boolean} isSafariMobile - Whether browser is Safari on mobile
 * @property {boolean} isChrome - Whether browser is Chrome
 * @property {boolean} isEdge - Whether browser is Edge
 * @since 1.0.0
 */

/**
 * Audio element caching information for seeking operations.
 * 
 * @typedef {Object} CachedAudioElement
 * @property {HTMLAudioElement} audio - HTML audio element
 * @property {string} url - Object URL for the audio blob
 * @since 1.0.0
 */

// ================================
// VOICE NOTES MODULE
// ================================
// Voice recording system with audio capture, playback and storage management

// ================================
// 1. VOICE RECORDING OPERATIONS
// ================================
    
/**
 * Initializes and starts audio recording.
 * 
 * This function handles microphone permissions and storage limits.
 * It determines the best audio format and sets up MediaRecorder.
 * 
 * @async
 * @function startRecording
 * @returns {Promise<void>} Resolves when recording starts or fails
 * @throws {NotAllowedError} When microphone access is denied
 * @throws {NotFoundError} When no microphone is found
 * @throws {NotSupportedError} When audio recording is not supported
 * @since 1.0.0
 * @example
 * try {
 *   await startRecording();
 *   console.log('Recording started successfully');
 * } catch (error) {
 *   console.error('Failed to start recording:', error);
 * }
 */
    async function startRecording() {
        try {
            if (!isVoiceRecordingSupported()) {
                updateVoiceStatus('Voice recording not supported in this browser', 'error');
                return;
            }
            
            // Check storage limit
            const voiceNotes = await loadVoiceNotes();
            if (voiceNotes.length >= CONSTANTS.VOICE_STORAGE_LIMIT) {
                updateVoiceStatus(`Cannot record: Storage full (${CONSTANTS.VOICE_STORAGE_LIMIT}/${CONSTANTS.VOICE_STORAGE_LIMIT}). Delete a recording first.`, 'error');
                return;
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Determine the best MIME type
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
                           MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' :
                           MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' :
                           'audio/webm'; // fallback
            
            setMediaRecorder(new MediaRecorder(stream, { mimeType }));
            
            setAudioChunks([]);
            setRecordingStartTime(Date.now());
            
            getMediaRecorder().ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    getAudioChunks().push(event.data);
                }
            };
            
            getMediaRecorder().onstop = async () => {
                try {
                    if (getAudioChunks().length > 0) {
                        const audioBlob = new Blob(getAudioChunks(), { type: mimeType });
                        if (audioBlob.size > 0) {
                            await saveRecording(audioBlob);
                        } else {
                            updateVoiceStatus('Recording failed: No audio data captured', 'error');
                        }
                    } else {
                        updateVoiceStatus('Recording failed: No audio data', 'error');
                    }
                } catch (saveError) {
                    console.error('Error processing recording:', saveError);
                    updateVoiceStatus('Failed to save recording', 'error');
                }
                
                // Stop all tracks to release microphone
                if (stream) {
                    stream.getTracks().forEach(track => {
                        try {
                            track.stop();
                        } catch (e) {
                            console.error('Error stopping track:', e);
                        }
                    });
                }
            };
            
            getMediaRecorder().onerror = (event) => {
                console.error('MediaRecorder error:', event);
                updateVoiceStatus('Recording error occurred', 'error');
                stopRecording();
            };
            
            getMediaRecorder().start();
            
            // Update UI to recording state
            const recordBtn = document.getElementById('recordBtn');
            const recordIcon = document.getElementById('recordIcon');
            const recordText = document.getElementById('recordText');
            const timerElement = document.getElementById('recordingTimer');
            
            if (recordBtn) recordBtn.className = 'record-btn recording';
            if (recordIcon) recordIcon.textContent = '⏹️';
            if (recordText) recordText.textContent = 'Stop Recording';
            if (timerElement) timerElement.style.display = 'block';
            
            updateVoiceStatus('Recording...', 'info');
            
            // Start timer
            setRecordingTimer(setInterval(updateRecordingTimer, 100));
            
        } catch (error) {
            console.error('Error starting recording:', error);
            
            // Handle specific permission errors
            if (error.name === 'NotAllowedError') {
                updateVoiceStatus('Microphone access denied. Please allow microphone access and try again.', 'error');
            } else if (error.name === 'NotFoundError') {
                updateVoiceStatus('No microphone found. Please check your audio devices.', 'error');
            } else if (error.name === 'NotSupportedError') {
                updateVoiceStatus('Audio recording not supported in this browser.', 'error');
            } else {
                updateVoiceStatus('Failed to start recording. Check microphone permissions.', 'error');
            }
            
            // Ensure UI is reset on error
            await updateRecordButtonState();
        }
    }

/**
 * Stops active audio recording and cleanup resources.
 * 
 * This function handles UI state reset and proper
 * release of microphone resources. It ensures all timers are cleared and the
 * interface is returned to the ready state.
 * 
 * @function stopRecording
 * @returns {void}
 * @since 1.0.0
 * @example
 * stopRecording();
 * // UI will be reset to ready state
 */
    function stopRecording() {
        if (getMediaRecorder() && getMediaRecorder().state === 'recording') {
            getMediaRecorder().stop();
        }
        
        // Clear timer
        if (getRecordingTimer()) {
            clearInterval(getRecordingTimer());
            setRecordingTimer(null);
        }
        
        // Reset UI elements
        const recordBtn = document.getElementById('recordBtn');
        const recordIcon = document.getElementById('recordIcon');
        const recordText = document.getElementById('recordText');
        const timerElement = document.getElementById('recordingTimer');
        
        // Reset button to ready state
        if (recordBtn) recordBtn.className = 'record-btn ready';
        if (recordIcon) recordIcon.textContent = '🎤';
        if (recordText) recordText.textContent = 'Start Recording';
        
        // Hide and reset timer
        if (timerElement) {
            timerElement.style.display = 'none';
            timerElement.textContent = '0:00';
        }
        
        // Don't reset recordingStartTime here - it's needed in saveRecording()
        // recordingStartTime will be reset in saveRecording() after duration calculation
    }

/**
 * Toggles between recording and stopped states based on current recorder state.
 * 
 * This is the main control function for voice recording, automatically determining
 * whether to start or stop recording based on the current MediaRecorder state.
 * 
 * @async
 * @function toggleRecording
 * @returns {Promise<void>} Resolves when toggle operation completes
 * @since 1.0.0
 * @example
 * // Toggle recording state
 * await toggleRecording();
 * 
 * // Can be called repeatedly to start/stop recording
 * button.onclick = () => toggleRecording();
 */
    async function toggleRecording() {
        debugLog('Toggle recording called'); // Debug log
        if (getMediaRecorder() && getMediaRecorder().state === 'recording') {
            stopRecording();
        } else {
            await startRecording();
        }
    }

/**
 * Shows the "recording could not be saved" message with a button that downloads the audio.
 *
 * @param {Object} voiceNote - The unsaved voice note (uses audioBlob and timestamp)
 * @returns {void}
 */
    function showUnsavedRecording(voiceNote) {
        updateVoiceStatus('Recording not saved: reload the page after downloading it', 'error');
        const container = document.getElementById('voiceTabRecord');
        if (!container) return;

        const message = document.createElement('div');
        message.className = 'message-error mt-md';
        message.setAttribute('role', 'alert');
        message.append(RECORDING_NOT_SAVED_MESSAGE, document.createElement('br'));

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-primary btn-small mt-sm';
        button.textContent = 'Download recording';
        button.addEventListener('click', () => {
            const url = URL.createObjectURL(voiceNote.audioBlob);
            const link = document.createElement('a');
            link.href = url;
            const date = new Date(voiceNote.timestamp);
            const dateStr = date.toISOString().split('T')[0];
            const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
            const extension = voiceNote.audioBlob.type.includes('webm') ? 'webm' : 'mp4';
            link.download = `dream-voice-note-${dateStr}-${timeStr}.${extension}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
        message.append(button);
        container.appendChild(message);
    }

/**
 * Processes and saves completed audio recording with metadata.
 * 
 * This function handles duration calculation, storage persistence, user feedback,
 * and automatic duration detection. It creates a complete voice note object with
 * all necessary metadata and saves it to IndexedDB.
 * 
 * @async
 * @function saveRecording
 * @param {Blob} audioBlob - The recorded audio data as a Blob
 * @returns {Promise<void>} Resolves when recording is saved successfully
 * @throws {Error} When audioBlob is invalid or empty
 * @throws {Error} When saving to storage fails
 * @since 1.0.0
 * @example
 * // Save a recording blob
 * const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
 * await saveRecording(audioBlob);
 */
    async function saveRecording(audioBlob) {
        try {
            if (!audioBlob || audioBlob.size === 0) {
                throw new Error('Invalid audio data');
            }
            
            const now = new Date();
            const duration = getRecordingStartTime() ? (Date.now() - getRecordingStartTime()) / 1000 : 0;
            debugLog(`saveRecording: recordingStartTime=${getRecordingStartTime()}, calculated duration=${duration}s`);
            
            // Reset recordingStartTime now that we've calculated the duration
            setRecordingStartTime(null);
            
            const voiceNote = {
                id: generateUniqueId({
                    title: `Voice Note ${formatDisplayDate(now, { month: 'numeric', day: 'numeric' })} ${now.toLocaleTimeString()}`,
                    timestamp: now.toISOString(),
                    type: 'voice'
                }),
                audioBlob: audioBlob,
                timestamp: now.toISOString(),
                duration: Math.round(Math.max(0, duration)),
                title: `Voice Note ${formatDisplayDate(now, { month: 'numeric', day: 'numeric' })} ${now.toLocaleTimeString()}`,
                dateString: formatDateTimeDisplay(now, {
                    month: 'short'
                }),
                size: audioBlob.size
            };
            
            // After another tab upgraded the database the note would only reach memory: offer the audio as a file instead
            if (isDatabaseClosedForUpgrade()) {
                showUnsavedRecording(voiceNote);
                return;
            }

            try {
                await saveVoiceNote(voiceNote);
                await updateRecordButtonState();
                await displayVoiceNotes();

                // NEW: Update stored duration with real value from blob
                const realDuration = await getAudioDuration(audioBlob, voiceNote.duration);
                if (realDuration && Math.abs(realDuration - voiceNote.duration) > 1) {
                    // Update the stored note with the real duration
                    voiceNote.duration = Math.round(realDuration);
                    await saveVoiceNote(voiceNote); // Overwrite with updated duration
                    await displayVoiceNotes(); // Refresh UI with correct duration
                }

                
                // Switch to stored notes tab to show the new recording
                switchVoiceTab('stored');
            } catch (saveError) {
                console.error('Error saving voice note:', saveError);
                updateVoiceStatus('Failed to save voice note: ' + saveError.message, 'error');
                return;
            }
            
            updateVoiceStatus(`Recording saved! Duration: ${formatDuration(duration)}`, 'success');
            
        } catch (error) {
            console.error('Error saving recording:', error);
            updateVoiceStatus('Failed to save recording', 'error');
        }
    }

// ================================
// 2. AUDIO PLAYBACK SYSTEM
// ================================

/**
 * Plays stored voice note with progress tracking and duration detection.
 * 
 * This function handles multiple audio formats and browser-specific audio metadata
 * issues. It provides comprehensive duration detection using multiple fallback methods,
 * manages audio state, and updates the UI with progress information.
 * 
 * @async
 * @function playVoiceNote
 * @param {string} voiceNoteId - Unique identifier of the voice note to play
 * @returns {Promise<void>} Resolves when playback starts or fails
 * @throws {Error} When voice note is not found
 * @throws {Error} When audio data is invalid
 * @since 1.0.0
 * @example
 * // Play a specific voice note
 * await playVoiceNote('voice_123456_abc');
 * 
 * // Play with error handling
 * try {
 *   await playVoiceNote(noteId);
 * } catch (error) {
 *   console.error('Playback failed:', error);
 * }
 */
    async function playVoiceNote(voiceNoteId) {
        try {
            const voiceNotes = await loadVoiceNotes();
            const voiceNote = voiceNotes.find(n => n.id === voiceNoteId);
            
            if (!voiceNote) {
                updateVoiceStatus('Voice note not found', 'error');
                return;
            }
            
            const playBtn = document.getElementById(`play-btn-${voiceNoteId}`);
            const progressContainer = document.getElementById(`progress-container-${voiceNoteId}`);
            
            // Stop any currently playing audio
            if (currentPlayingAudio) {
                currentPlayingAudio.pause();
                setCurrentPlayingAudio(null);
                
                // Reset all play buttons (progress bars stay visible)
                document.querySelectorAll('.voice-btn.pause').forEach(btn => {
                    btn.className = 'voice-btn play';
                    btn.innerHTML = '▶️ Play';
                    btn.dataset.action = 'play-voice';
                });
                // Progress containers now stay visible
            }
            
            // Validate audioBlob before creating URL
            if (!voiceNote.audioBlob || !(voiceNote.audioBlob instanceof Blob)) {
                console.error('Invalid audioBlob for voice note:', voiceNote.id, 'Type:', typeof voiceNote.audioBlob);
                updateVoiceStatus('Cannot play voice note: Invalid audio data. This may be due to browser storage limitations.', 'error');
                return;
            }
            
            // Use pre-loaded audio element if it exists (from seeking), otherwise create new one
            let audio, audioURL;
            if (audioElements[voiceNoteId]) {
                // Use existing audio element that may have been seeked
                audio = audioElements[voiceNoteId].audio;
                audioURL = audioElements[voiceNoteId].url;
                debugLog(`Using pre-loaded audio for ${voiceNoteId}, current time: ${formatDuration(audio.currentTime)}`);
            } else {
                // Create new audio element
                audio = new Audio();
                audioURL = URL.createObjectURL(voiceNote.audioBlob);
                audio.src = audioURL;
            }
            
            // Update button to pause state and show progress bar
            if (playBtn) {
                playBtn.className = 'voice-btn pause';
                playBtn.innerHTML = '⏸️ Pause';
                playBtn.dataset.action = 'pause-voice';
            }
            
            // Progress container is now always visible
            
            // Enhanced duration detection with multiple fallback mechanisms
            let durationDetected = false;
            let actualDuration = 0;
            
            // Method 1: Try to get duration on loadedmetadata
            audio.onloadedmetadata = () => {
                const totalTimeEl = document.getElementById(`time-total-${voiceNoteId}`);
                if (totalTimeEl) {
                    if (isFinite(audio.duration) && audio.duration > 0) {
                        actualDuration = audio.duration;
                        durationDetected = true;
                        totalTimeEl.textContent = formatDuration(audio.duration);
                        debugLog(`Audio duration loaded via metadata: ${audio.duration}s for ${voiceNoteId}`);
                    }
                }
            };
            
            // Method 2: Try on canplaythrough event (more reliable for some formats)
            audio.oncanplaythrough = () => {
                if (!durationDetected) {
                    const totalTimeEl = document.getElementById(`time-total-${voiceNoteId}`);
                    if (totalTimeEl && isFinite(audio.duration) && audio.duration > 0) {
                        actualDuration = audio.duration;
                        durationDetected = true;
                        totalTimeEl.textContent = formatDuration(audio.duration);
                        debugLog(`Audio duration loaded via canplaythrough: ${audio.duration}s for ${voiceNoteId}`);
                    }
                }
            };
            
            // Method 3: Try on loadeddata event
            audio.onloadeddata = () => {
                if (!durationDetected) {
                    const totalTimeEl = document.getElementById(`time-total-${voiceNoteId}`);
                    if (totalTimeEl && isFinite(audio.duration) && audio.duration > 0) {
                        actualDuration = audio.duration;
                        durationDetected = true;
                        totalTimeEl.textContent = formatDuration(audio.duration);
                        debugLog(`Audio duration loaded via loadeddata: ${audio.duration}s for ${voiceNoteId}`);
                    }
                }
            };
            
            // Method 4: Force duration check after play starts
            audio.onplaying = () => {
                if (!durationDetected) {
                    setTimeout(() => {
                        const totalTimeEl = document.getElementById(`time-total-${voiceNoteId}`);
                        if (totalTimeEl && isFinite(audio.duration) && audio.duration > 0) {
                            actualDuration = audio.duration;
                            durationDetected = true;
                            totalTimeEl.textContent = formatDuration(audio.duration);
                            debugLog(`Audio duration loaded after play: ${audio.duration}s for ${voiceNoteId}`);
                        } else if (totalTimeEl && voiceNote.duration) {
                            // Final fallback: use stored duration
                            actualDuration = voiceNote.duration;
                            totalTimeEl.textContent = formatDuration(voiceNote.duration);
                            debugLog(`Using stored duration as fallback: ${voiceNote.duration}s for ${voiceNoteId}`);
                        }
                    }, 100);
                }
            };
            
            // Set up time update listener
            audio.ontimeupdate = () => {
                const browserInfo = getVoiceCapabilities().browser;
                if (browserInfo.isFirefox) {
                    debugLog(`Firefox ontimeupdate: ${audio.currentTime.toFixed(2)}s / ${audio.duration}s`);
                }
                
                // Detect real duration during playback (Firefox often provides it after starting)
                let needsHeaderUpdate = false;
                if (!durationDetected) {
                    if (isFinite(audio.duration) && audio.duration > 0) {
                        // Firefox provided finite duration - use it!
                        actualDuration = audio.duration;
                        durationDetected = true;
                        needsHeaderUpdate = true;
                        const totalTimeEl = document.getElementById(`time-total-${voiceNoteId}`);
                        if (totalTimeEl) {
                            totalTimeEl.textContent = formatDuration(audio.duration);
                            debugLog(`Firefox: Real duration detected during playback: ${audio.duration}s for ${voiceNoteId}`);
                        }
                    } else if (audio.seekable && audio.seekable.length > 0) {
                        // Try to get duration from seekable range
                        const seekableDuration = audio.seekable.end(0);
                        if (isFinite(seekableDuration) && seekableDuration > 0) {
                            actualDuration = seekableDuration;
                            durationDetected = true;
                            needsHeaderUpdate = true;
                            const totalTimeEl = document.getElementById(`time-total-${voiceNoteId}`);
                            if (totalTimeEl) {
                                totalTimeEl.textContent = formatDuration(seekableDuration);
                                debugLog(`Firefox: Duration from seekable range: ${seekableDuration}s for ${voiceNoteId}`);
                            }
                        }
                    }
                }
                
                // Update header duration display when new duration is detected OR always for Firefox fallback
                if (needsHeaderUpdate || (browserInfo.isFirefox && actualDuration > 0)) {
                    const headerDurationEl = document.getElementById(`header-duration-${voiceNoteId}`);
                    if (headerDurationEl) {
                        const displayDuration = actualDuration || voiceNote.duration || 5;
                        headerDurationEl.textContent = formatDuration(displayDuration);
                        debugLog(`Firefox: Updated header duration to ${formatDuration(displayDuration)} for ${voiceNoteId}`);
                    }
                }
                
                // Update progress with best available duration
                let effectiveDuration = actualDuration || voiceNote.duration || 5; // Use detected duration, stored duration, or 5s fallback
                
                updateAudioProgress(voiceNoteId, audio.currentTime, effectiveDuration);
            };
            
            audio.onended = () => {
                try {
                    URL.revokeObjectURL(audioURL);
                } catch (e) {
                    console.warn('Failed to revoke audio URL:', e);
                }
                setCurrentPlayingAudio(null);
                
                // Clean up cached audio element
                if (audioElements[voiceNoteId]) {
                    delete audioElements[voiceNoteId];
                }
                
                // Reset button to play state
                if (playBtn) {
                    playBtn.className = 'voice-btn play';
                    playBtn.innerHTML = '▶️ Play';
                    playBtn.dataset.action = 'play-voice';
                }
                
                // Progress container stays visible
                
                // Reset progress bar
                const progressFill = document.getElementById(`progress-fill-${voiceNoteId}`);
                if (progressFill) {
                    progressFill.style.width = '0%';
                }
                
                // Reset time displays
                const currentTimeEl = document.getElementById(`time-current-${voiceNoteId}`);
                if (currentTimeEl) {
                    currentTimeEl.textContent = '0:00';
                }
            };
            
            audio.onerror = () => {
                try {
                    URL.revokeObjectURL(audioURL);
                } catch (e) {
                    console.warn('Failed to revoke audio URL on error:', e);
                }
                setCurrentPlayingAudio(null);
                
                // Clean up cached audio element
                if (audioElements[voiceNoteId]) {
                    delete audioElements[voiceNoteId];
                }
                
                updateVoiceStatus('Error playing voice note', 'error');
                
                // Reset button state
                if (playBtn) {
                    playBtn.className = 'voice-btn play';
                    playBtn.innerHTML = '▶️ Play';
                    playBtn.dataset.action = 'play-voice';
                }
                
                // Progress container stays visible
            };
            
            // Start playing
            setCurrentPlayingAudio(audio);
            
            // Preload the audio to ensure metadata is available
            audio.preload = 'metadata';
            audio.load(); // Force load metadata
            
            await audio.play();
            
        } catch (error) {
            console.error('Error playing voice note:', error);
            updateVoiceStatus('Failed to play voice note', 'error');
        }
    }

// ================================
// 3. BROWSER CAPABILITIES & COMPATIBILITY
// ================================
        
/**
 * Browser capability detection for voice recording.
 * 
 * Returns compatibility information for different browsers and platforms,
 * including support for the MediaRecorder API and browser-specific
 * features and limitations.
 * 
 * @function getVoiceCapabilities
 * @returns {VoiceCapabilities} Object containing capability information and browser detection
 * @since 1.0.0
 * @example
 * const capabilities = getVoiceCapabilities();
 * if (capabilities.canRecord) {
 *   console.log('Voice recording available');
 * }
 * 
 * @example
 * // Check browser-specific features
 * const caps = getVoiceCapabilities();
 * if (caps.browser.isFirefox) {
 *   console.log('Firefox-specific handling needed');
 * }
 */
function getVoiceCapabilities() {
            const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
            const hasMediaRecorder = !!(window.MediaRecorder);
            
            // Detect browser type and mobile platforms
            const userAgent = navigator.userAgent.toLowerCase();
            const isFirefox = userAgent.includes('firefox');
            const isFirefoxMobile = isFirefox && userAgent.includes('mobile');
            const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
            const isSafariMobile = isSafari && userAgent.includes('mobile');
            const isChrome = userAgent.includes('chrome') && !userAgent.includes('edg');
            const isEdge = userAgent.includes('edg');
            
            return {
                canRecord: hasGetUserMedia && hasMediaRecorder,
                hasGetUserMedia,
                hasMediaRecorder,
                browser: {
                    isFirefox,
                    isFirefoxMobile,
                    isSafari,
                    isSafariMobile,
                    isChrome,
                    isEdge
                }
            };
        }
        
/**
 * Checks if current browser supports MediaRecorder API for audio recording.
 * 
 * @function isVoiceRecordingSupported
 * @returns {boolean} True if voice recording is supported
 * @since 1.0.0
 * @example
 * if (isVoiceRecordingSupported()) {
 *   showRecordingButton();
 * } else {
 *   showUnsupportedMessage();
 * }
 */
function isVoiceRecordingSupported() {
            return getVoiceCapabilities().canRecord;
        }
        
// ================================
// 5. UTILITY FUNCTIONS
// ================================

/**
 * Formats seconds into MM:SS display format with validation.
 * 
 * This function safely converts numeric seconds into a human-readable time format,
 * handling edge cases like NaN, negative values, and Infinity.
 * 
 * @function formatDuration
 * @param {number} seconds - Duration in seconds to format
 * @returns {string} Formatted time string in MM:SS format
 * @since 1.0.0
 * @example
 * formatDuration(125); // Returns '2:05'
 * formatDuration(45);  // Returns '0:45'
 * formatDuration(0);   // Returns '0:00'
 * formatDuration(NaN); // Returns '0:00'
 */
function formatDuration(seconds) {
            if (!seconds || isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '0:00';
            const safeSeconds = Math.max(0, Math.floor(seconds));
            const mins = Math.floor(safeSeconds / 60);
            const secs = safeSeconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        
/**
 * Gets accurate audio duration from blob using multiple detection methods.
 * 
 * This function handles browser-specific metadata loading issues and provides
 * fallback durations when audio metadata is unavailable. It uses multiple
 * detection strategies including metadata events, seekable ranges, and brief playback.
 * 
 * @async
 * @function getAudioDuration
 * @param {Blob} audioBlob - Audio blob to analyze
 * @param {number|null} [storedDuration=null] - Fallback duration from storage
 * @returns {Promise<number>} Duration in seconds, or fallback value
 * @since 1.0.0
 * @todo Extract audio metadata detection logic into separate utility function
 * @example
 * const duration = await getAudioDuration(audioBlob, 30);
 * console.log(`Audio duration: ${duration} seconds`);
 * 
 * @example
 * // Without fallback duration
 * const duration = await getAudioDuration(audioBlob);
 */
async function getAudioDuration(audioBlob, storedDuration = null) {
            return new Promise((resolve) => {
                if (!audioBlob || !(audioBlob instanceof Blob)) {
                    debugLog('getAudioDuration: Invalid audioBlob');
                    resolve(0);
                    return;
                }
                
                debugLog(`getAudioDuration: Starting for blob type: ${audioBlob.type}, size: ${audioBlob.size}`);
                const audio = new Audio();
                const url = URL.createObjectURL(audioBlob);
                let resolved = false;
                
                // Try multiple events to get duration
                const attemptDurationDetection = () => {
                    debugLog(`getAudioDuration: Checking - duration: ${audio.duration}, seekable: ${audio.seekable.length}`);
                    if (!resolved) {
                        if (isFinite(audio.duration) && audio.duration > 0) {
                            debugLog(`getAudioDuration: Valid duration detected: ${audio.duration}s`);
                            resolved = true;
                            URL.revokeObjectURL(url);
                            resolve(audio.duration);
                        } else if (audio.seekable && audio.seekable.length > 0) {
                            try {
                                const seekableDuration = audio.seekable.end(0);
                                debugLog(`getAudioDuration: Raw seekable duration: ${seekableDuration}, finite: ${isFinite(seekableDuration)}`);
                                if (isFinite(seekableDuration) && seekableDuration > 0) {
                                    debugLog(`getAudioDuration: ✅ Duration from seekable range: ${seekableDuration}s`);
                                    resolved = true;
                                    URL.revokeObjectURL(url);
                                    resolve(seekableDuration);
                                } else {
                                    debugLog(`getAudioDuration: ❌ Seekable duration invalid: ${seekableDuration}`);
                                }
                            } catch (e) {
                                debugLog(`getAudioDuration: ❌ Error getting seekable duration: ${e.message}`);
                            }
                        }
                    }
                };
                
                audio.oncanplay = attemptDurationDetection;
                audio.oncanplaythrough = attemptDurationDetection;
                audio.onloadeddata = attemptDurationDetection;
                
                // Timeout fallback after 3 seconds
                setTimeout(() => {
                    if (!resolved) {
                        const fallbackDuration = storedDuration || 5999;
                        debugLog(`getAudioDuration: Timeout - using ${fallbackDuration}s fallback (stored: ${storedDuration || 'none'})`);
                        resolved = true;
                        URL.revokeObjectURL(url);
                        resolve(fallbackDuration); // Use stored duration or 5s default for problematic WebM files
                    }
                }, 1000);
                
                audio.onerror = () => {
                    if (!resolved) {
                        console.error('getAudioDuration: Audio load error');
                        resolved = true;
                        URL.revokeObjectURL(url);
                        resolve(0);
                    }
                };
                
                // Load the audio and try playing briefly to force metadata
                audio.preload = 'metadata';
                audio.src = url;
                audio.load();
                
                // Try playing very briefly to force duration detection
                setTimeout(() => {
                    if (!resolved) {
                        debugLog('getAudioDuration: Trying brief play to detect duration');
                        audio.currentTime = 0;
                        audio.play().then(() => {
                            setTimeout(() => {
                                audio.pause();
                                attemptDurationDetection();
                            }, 100);
                        }).catch(() => {
                            debugLog('getAudioDuration: Brief play failed, continuing with other methods');
                        });
                    }
                }, 500);
            });
        }
        
/**
 * Updates live recording timer display during active recording.
 * 
 * This function calculates elapsed recording time and updates the timer display.
 * It includes safety checks to prevent lingering timers when recording stops.
 * 
 * @function updateRecordingTimer
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Called automatically by setInterval during recording
 * recordingTimer = setInterval(updateRecordingTimer, 100);
 */
function updateRecordingTimer() {
            if (!getRecordingStartTime() || !getRecordingTimer()) {
                // Safety check: if recording should be stopped, clear any lingering timer
                if (getRecordingTimer()) {
                    clearInterval(getRecordingTimer());
                    setRecordingTimer(null);
                }
                return;
            }
            
            const elapsed = (Date.now() - getRecordingStartTime()) / 1000;
            const timerElement = document.getElementById('recordingTimer');
            if (timerElement) {
                timerElement.textContent = formatDuration(elapsed);
            }
        }
        
/**
 * Updates voice system status message with type-based styling.
 * 
 * This function displays status messages to users with appropriate styling
 * based on the message type (info, warning, error, success).
 * 
 * @function updateVoiceStatus
 * @param {string} message - Status message to display
 * @param {'info'|'warning'|'error'|'success'} [type='info'] - Message type for styling
 * @returns {void}
 * @since 1.0.0
 * @example
 * updateVoiceStatus('Recording started', 'info');
 * updateVoiceStatus('Storage full', 'error');
 * updateVoiceStatus('Recording saved successfully', 'success');
 */
function updateVoiceStatus(message, type = 'info') {
            const statusElement = document.getElementById('voiceStatus');
            if (statusElement) {
                statusElement.textContent = message;
                statusElement.className = `voice-status ${type}`;
            }
        }
        
/**
 * Updates recording button state based on storage capacity and browser capabilities.
 * 
 * This function handles storage limits, capability detection, and UI state synchronization.
 * It checks available storage slots and updates the button appearance and status messages
 * accordingly.
 * 
 * @async
 * @function updateRecordButtonState
 * @returns {Promise<void>} Resolves when button state is updated
 * @since 1.0.0
 * @todo Split into calculateRecordingCapacity() and updateRecordButtonUI() functions
 * @example
 * // Update button after saving a recording
 * await saveVoiceNote(note);
 * await updateRecordButtonState();
 * 
 * @example
 * // Check storage capacity on app initialization
 * await updateRecordButtonState();
 */
async function updateRecordButtonState() {
            const recordBtn = document.getElementById('recordBtn');
            const recordIcon = document.getElementById('recordIcon');
            const recordText = document.getElementById('recordText');
            
            if (!recordBtn || !recordIcon || !recordText) return;
            
            try {
                const voiceNotes = await loadVoiceNotes();
                const voiceCount = voiceNotes.length;
                
                // Check if currently recording
                const isCurrentlyRecording = getMediaRecorder() && getMediaRecorder().state === 'recording';
                
                if (isCurrentlyRecording) {
                    // Don't change button state if recording is in progress
                    return;
                }
                
                if (voiceCount >= CONSTANTS.VOICE_STORAGE_LIMIT) {
                    recordBtn.className = 'record-btn disabled';
                    recordBtn.disabled = true;
                    recordIcon.textContent = '🚫';
                    recordText.textContent = 'Storage Full';
                    updateVoiceStatus(`Storage full (${voiceCount}/${CONSTANTS.VOICE_STORAGE_LIMIT}). Delete a recording to record new ones.`, 'error');
                } else {
                    recordBtn.className = 'record-btn ready';
                    recordBtn.disabled = false;
                    recordIcon.textContent = '🎤';
                    recordText.textContent = 'Start Recording';
                    
                    if (voiceCount >= 3) {
                        updateVoiceStatus(`Voice Notes (${voiceCount}/${CONSTANTS.VOICE_STORAGE_LIMIT}) - ${CONSTANTS.VOICE_STORAGE_LIMIT - voiceCount} slot${CONSTANTS.VOICE_STORAGE_LIMIT - voiceCount === 1 ? '' : 's'} remaining`, 'warning');
                    } else {
                        updateVoiceStatus(`Voice Notes (${voiceCount}/${CONSTANTS.VOICE_STORAGE_LIMIT}) - Recording supported`, 'info');
                    }
                }
            } catch (error) {
                console.error('Error updating record button state:', error);
                updateVoiceStatus('Error checking voice note storage', 'error');
            }
        }
        

// ================================
// 6. VOICE NOTES DISPLAY SYSTEM
// ================================

// Throttle progress updates to prevent excessive DOM manipulation
let lastProgressUpdate = 0;
// Use centralized browser detection from getVoiceCapabilities
const PROGRESS_UPDATE_THROTTLE = getVoiceCapabilities().browser.isFirefox ? 0 : 50; // ms - disable throttling for Firefox

/**
 * Displays all stored voice notes with playback controls and metadata.
 * 
 * This function handles empty states, storage warnings, and asynchronous duration
 * detection. It renders the complete voice notes interface including play controls,
 * progress bars, and action buttons.
 * 
 * @async
 * @function displayVoiceNotes
 * @returns {Promise<void>} Resolves when voice notes are displayed
 * @since 1.0.0
 * @todo Split into buildVoiceNotesHTML() and renderVoiceNotesContainer() functions
 * @example
 * // Refresh the voice notes display
 * await displayVoiceNotes();
 * 
 * @example
 * // Display after adding a new note
 * await saveVoiceNote(newNote);
 * await displayVoiceNotes();
 */
async function displayVoiceNotes() {
            const container = document.getElementById('voiceNotesContainer');
            if (!container) return;
            
            try {
                const voiceNotes = await loadVoiceNotes();
                
                if (voiceNotes.length === 0) {
                    container.innerHTML = `
                        <div class="no-voice-notes">
                            No voice notes recorded yet.<br>
                            Use the recording button above to capture quick voice memos of your dreams.
                        </div>
                    `;
                    return;
                }
                
                // Show warning if at capacity
                let warningHTML = '';
                if (voiceNotes.length >= CONSTANTS.VOICE_STORAGE_LIMIT) {
                    warningHTML = `
                        <div class="voice-full-warning">
                            ⚠️ Storage full (${CONSTANTS.VOICE_STORAGE_LIMIT}/${CONSTANTS.VOICE_STORAGE_LIMIT} voice notes). Delete recordings to free space for new ones.
                        </div>
                    `;
                }
                
                const notesHTML = voiceNotes.map(note => {
                    const sizeKB = Math.round(note.size / CONSTANTS.BYTES_PER_KB);
                    const sizeMB = (note.size / CONSTANTS.BYTES_PER_MB).toFixed(1);
                    const sizeDisplay = note.size < CONSTANTS.BYTES_PER_MB ? `${sizeKB} KB` : `${sizeMB} MB`;

                    // Format date for accessibility
                    const formattedDate = note.dateString;

                    // Create meta information
                    const metaItems = [
                        { value: escapeHtml(note.dateString) },
                        { value: `<span id="header-duration-${escapeAttr(note.id)}">${formatDuration(note.duration || 0)}</span>`, isHTML: true },
                        { value: sizeDisplay }
                    ];
                    
                    // Create control buttons using utility classes
                    const controlButtons = [
                        `<button data-action="play-voice" data-voice-note-id="${escapeAttr(note.id)}" id="play-btn-${escapeAttr(note.id)}" class="voice-btn-base voice-btn-play">▶️ Play</button>`,
                        `<button data-action="download-voice" data-voice-note-id="${escapeAttr(note.id)}" class="voice-btn-base voice-btn-download">⬇️ Download</button>`,
                        `<button data-action="delete-voice" data-voice-note-id="${escapeAttr(note.id)}" class="voice-btn-base voice-btn-delete">🗑️ Delete</button>`
                    ].join('');
                    
                    return `
                        <div class="voice-note-container" 
                             id="voice-note-${escapeAttr(note.id)}"
                             role="region" 
                             aria-roledescription="voice recording"
                             aria-label="Voice note from ${escapeAttr(formattedDate)}">
                            <div class="voice-note-info">
                                <div class="voice-note-title">${escapeHtml(note.title)}</div>
                                <div class="voice-note-meta">${createMetaDisplay(metaItems)}</div>
                            </div>
                            <div class="voice-note-controls">
                                ${controlButtons}
                                <div class="voice-progress-container" id="progress-container-${escapeAttr(note.id)}" style="display: flex;">
                                    <div class="voice-time-display" id="time-current-${escapeAttr(note.id)}">0:00</div>
                                    <div class="voice-progress-bar" data-action="seek-audio" data-voice-note-id="${escapeAttr(note.id)}" id="progress-bar-${escapeAttr(note.id)}">
                                        <div class="voice-progress-fill" id="progress-fill-${escapeAttr(note.id)}"></div>
                                    </div>
                                    <div class="voice-time-display" id="time-total-${escapeAttr(note.id)}">${formatDuration(note.duration || 0)}</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                container.innerHTML = warningHTML + notesHTML;
                
                // Update durations asynchronously with actual audio durations
                voiceNotes.forEach(async (note) => {
                    try {
                        debugLog(`Getting duration for note ${note.id}, stored duration: ${note.duration}, blob type: ${note.audioBlob?.type}, blob size: ${note.audioBlob?.size}`);
                        const actualDuration = await getAudioDuration(note.audioBlob, note.duration);
                        debugLog(`Detected duration for note ${note.id}: ${actualDuration}s`);
                        
                        // Use detected duration or fall back to stored duration
                        const effectiveDuration = actualDuration > 0 ? actualDuration : note.duration;
                        
                        if (effectiveDuration > 0) {
                            // Update the header duration display
                            const headerDurationEl = document.getElementById(`header-duration-${note.id}`);
                            if (headerDurationEl) {
                                headerDurationEl.textContent = formatDuration(effectiveDuration);
                                debugLog(`Updated header duration for ${note.id} to ${formatDuration(effectiveDuration)} (source: ${actualDuration > 0 ? 'detected' : 'stored'})`);
                            } else {
                                console.warn(`Could not find header duration element for ${note.id}`);
                            }
                            
                            // Update the total time display in progress bar
                            const totalTimeEl = document.getElementById(`time-total-${note.id}`);
                            if (totalTimeEl) {
                                totalTimeEl.textContent = formatDuration(effectiveDuration);
                            }
                        } else {
                            console.warn(`No duration available for note ${note.id} (detected: ${actualDuration}, stored: ${note.duration})`);
                        }
                    } catch (error) {
                        console.error('Error getting audio duration for note:', note.id, error);
                    }
                });
                
            } catch (error) {
                console.error('Error displaying voice notes:', error);
                container.innerHTML = `
                    <div class="no-voice-notes">
                        Error loading voice notes. Please try refreshing the page.
                    </div>
                `;
            }
        }
        
        
/**
 * Pauses currently playing voice note and updates UI controls.
 * 
 * This function stops audio playback and updates the play button state while
 * preserving the progress bar and current position for potential resumption.
 * 
 * @function pauseVoiceNote
 * @param {string} voiceNoteId - ID of the voice note to pause
 * @returns {void}
 * @since 1.0.0
 * @example
 * pauseVoiceNote('voice_123456_abc');
 */
function pauseVoiceNote(voiceNoteId) {
            if (currentPlayingAudio) {
                try {
                    currentPlayingAudio.pause();
                    // Don't revoke URL here since user might want to resume
                } catch (e) {
                    console.warn('Error pausing audio:', e);
                }
                setCurrentPlayingAudio(null);
            }
            
            const playBtn = document.getElementById(`play-btn-${voiceNoteId}`);
            const progressContainer = document.getElementById(`progress-container-${voiceNoteId}`);
            
            if (playBtn) {
                playBtn.className = 'voice-btn play';
                playBtn.innerHTML = '▶️ Play';
                playBtn.dataset.action = 'play-voice';
            }
            
            // Progress container stays visible
        }
        
/**
 * Updates audio progress bar and time displays with throttling for performance.
 * 
 * This function handles real-time progress updates during audio playback,
 * with browser-specific optimizations and throttling to prevent excessive
 * DOM manipulation.
 * 
 * @function updateAudioProgress
 * @param {string} voiceNoteId - ID of the voice note being played
 * @param {number} currentTime - Current playback position in seconds
 * @param {number} duration - Total audio duration in seconds
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Called automatically during audio playback
 * audio.ontimeupdate = () => {
 *   updateAudioProgress(noteId, audio.currentTime, audio.duration);
 * };
 */
function updateAudioProgress(voiceNoteId, currentTime, duration) {
            if (!voiceNoteId || isNaN(currentTime) || isNaN(duration) || duration <= 0 || !isFinite(duration)) {
                return;
            }
            
            // Throttle updates to prevent excessive DOM manipulation
            const now = Date.now();
            if (now - lastProgressUpdate < PROGRESS_UPDATE_THROTTLE) return;
            lastProgressUpdate = now;
            
            const progressFill = document.getElementById(`progress-fill-${voiceNoteId}`);
            const currentTimeEl = document.getElementById(`time-current-${voiceNoteId}`);
            
            if (progressFill) {
                // Extra safety check to prevent division by zero and invalid values
                const safeCurrentTime = Math.max(0, Math.min(currentTime, duration));
                const progressRatio = Math.max(0, Math.min(1, safeCurrentTime / duration));
                
                const browserInfo = getVoiceCapabilities().browser;
                if (browserInfo.isFirefox) {
                    // Firefox: Use transform instead of width for better rendering
                    debugLog(`Firefox progress update: ${(progressRatio * 100).toFixed(1)}%`);
                    progressFill.style.transition = 'none';
                    progressFill.style.width = '100%';
                    progressFill.style.transform = `scaleX(${progressRatio})`;
                    progressFill.style.transformOrigin = 'left';
                } else {
                    // Chrome: Use width (original method)
                    progressFill.style.transition = 'none';
                    progressFill.style.width = `${progressRatio * 100}%`;
                    progressFill.style.transform = 'none';
                }
                
                // Force a reflow
                progressFill.offsetHeight;
            }
            
            if (currentTimeEl) {
                const formattedTime = formatDuration(Math.max(0, currentTime));
                currentTimeEl.textContent = formattedTime;
            }
        }
        
/**
 * Updates progress bar with smooth CSS transitions for manual seeking operations.
 * 
 * This function provides smooth visual feedback when users manually seek to
 * different positions in the audio, with browser-specific transition handling.
 * 
 * @function updateAudioProgressWithTransition
 * @param {string} voiceNoteId - ID of the voice note being seeked
 * @param {number} currentTime - Target playback position in seconds
 * @param {number} duration - Total audio duration in seconds
 * @returns {void}
 * @since 1.0.0
 * @example
 * // Used when user clicks on progress bar
 * const seekTime = clickPercentage * duration;
 * updateAudioProgressWithTransition(noteId, seekTime, duration);
 */
function updateAudioProgressWithTransition(voiceNoteId, currentTime, duration) {
            if (!voiceNoteId || isNaN(currentTime) || isNaN(duration) || duration <= 0 || !isFinite(duration)) {
                return;
            }
            
            const progressFill = document.getElementById(`progress-fill-${voiceNoteId}`);
            const currentTimeEl = document.getElementById(`time-current-${voiceNoteId}`);
            
            if (progressFill) {
                // Extra safety check to prevent division by zero and invalid values
                const safeCurrentTime = Math.max(0, Math.min(currentTime, duration));
                const progressRatio = Math.max(0, Math.min(1, safeCurrentTime / duration));
                
                const browserInfo = getVoiceCapabilities().browser;
                if (browserInfo.isFirefox) {
                    // Firefox: Use transform with transition for smooth seeking
                    progressFill.style.width = '100%';
                    progressFill.style.transition = 'transform 0.1s linear';
                    progressFill.style.transform = `scaleX(${progressRatio})`;
                    progressFill.style.transformOrigin = 'left';
                } else {
                    // Chrome: Use width with transition (original method)
                    progressFill.style.transition = 'width 0.1s linear';
                    progressFill.style.width = `${progressRatio * 100}%`;
                    progressFill.style.transform = 'none';
                }
            }
            
            if (currentTimeEl) {
                const formattedTime = formatDuration(Math.max(0, currentTime));
                currentTimeEl.textContent = formattedTime;
            }
        }
        
// ================================
// 7. AUDIO SEEKING SYSTEM
// ================================

// Store audio elements for seeking when paused
let audioElements = {};

/**
 * Seeks to specific position in audio based on progress bar click.
 * 
 * This function handles both playing and paused states with proper audio element
 * caching. It calculates the seek position from mouse click coordinates and
 * updates the audio playback position accordingly.
 * 
 * @async
 * @function seekAudio
 * @param {string} voiceNoteId - ID of the voice note to seek
 * @param {MouseEvent} event - Click event from progress bar
 * @returns {Promise<void>} Resolves when seek operation completes
 * @since 1.0.0
 * @todo Extract seekPercentageCalculation() and audioElementManagement() functions
 * @example
 * // Handle progress bar click
 * progressBar.onclick = (event) => {
 *   seekAudio(voiceNoteId, event);
 * };
 */
async function seekAudio(voiceNoteId, event) {
            if (!event) return;
            
            const progressBar = document.getElementById(`progress-bar-${voiceNoteId}`);
            if (!progressBar) return;
            
            const rect = progressBar.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const progressBarWidth = rect.width;
            
            if (progressBarWidth <= 0) return; // Prevent division by zero
            
            const clickPercentage = clickX / progressBarWidth;
            
            // Ensure percentage is between 0 and 1
            const seekPercentage = Math.max(0, Math.min(1, clickPercentage));
            
            // If audio is currently playing, seek it directly
            if (currentPlayingAudio && !isNaN(currentPlayingAudio.duration) && currentPlayingAudio.duration > 0) {
                const seekTime = seekPercentage * currentPlayingAudio.duration;
                currentPlayingAudio.currentTime = seekTime;
                
                // Update progress immediately for responsive feedback with smooth transition
                updateAudioProgressWithTransition(voiceNoteId, seekTime, currentPlayingAudio.duration);
            } else {
                // If not playing, load audio but keep it paused at the seek position
                try {
                    const voiceNotes = await loadVoiceNotes();
                    const voiceNote = voiceNotes.find(n => n.id === voiceNoteId);
                    
                    if (voiceNote) {
                        // Create or get existing audio element for this note
                        if (!audioElements[voiceNoteId]) {
                            const audio = new Audio();
                            const audioURL = URL.createObjectURL(voiceNote.audioBlob);
                            audio.src = audioURL;
                            audio.preload = 'metadata';
                            audioElements[voiceNoteId] = { audio, url: audioURL };
                            
                            // Clean up on audio end
                            audio.onended = () => {
                                if (audioElements[voiceNoteId]) {
                                    URL.revokeObjectURL(audioElements[voiceNoteId].url);
                                    delete audioElements[voiceNoteId];
                                }
                            };
                        }
                        
                        const { audio } = audioElements[voiceNoteId];
                        
                        // Wait for metadata to load, then seek
                        const seekWhenReady = () => {
                            if (audio.duration && (isFinite(audio.duration) || audio.duration === Infinity)) {
                                // Use fallback duration for WebM Infinity - try stored duration first
                                const effectiveDuration = audio.duration === Infinity ? (voiceNote.duration || 5) : audio.duration;
                                const seekTime = seekPercentage * effectiveDuration;
                                audio.currentTime = seekTime;
                                
                                // Update progress bar to show seek position with smooth transition
                                updateAudioProgressWithTransition(voiceNoteId, seekTime, effectiveDuration);
                                
                                debugLog(`Seeked to ${formatDuration(seekTime)} (paused) in voice note ${voiceNoteId}`);
                            }
                        };
                        
                        if (audio.readyState >= 1) {
                            // Metadata already loaded
                            seekWhenReady();
                        } else {
                            // Wait for metadata
                            audio.onloadedmetadata = seekWhenReady;
                            audio.load();
                        }
                    }
                } catch (error) {
                    console.error('Error seeking in paused audio:', error);
                }
            }
        }
        
// ================================
// 8. FILE MANAGEMENT OPERATIONS
// ================================

/**
 * Downloads voice note as audio file with timestamp-based filename.
 * 
 * This function creates a downloadable audio file from the stored voice note,
 * generating an appropriate filename based on the recording timestamp and
 * audio format.
 * 
 * @async
 * @function downloadVoiceNote
 * @param {string} voiceNoteId - ID of the voice note to download
 * @returns {Promise<void>} Resolves when download is initiated
 * @throws {Error} When voice note is not found or audio data is invalid
 * @since 1.0.0
 * @example
 * await downloadVoiceNote('voice_123456_abc');
 * // Downloads file like: dream-voice-note-2024-01-15-10-30-25.webm
 */
async function downloadVoiceNote(voiceNoteId) {
            try {
                const voiceNotes = await loadVoiceNotes();
                const voiceNote = voiceNotes.find(n => n.id === voiceNoteId);
                
                if (!voiceNote) {
                    updateVoiceStatus('Voice note not found', 'error');
                    return;
                }
                
                // Validate audioBlob before creating download URL
                if (!voiceNote.audioBlob || !(voiceNote.audioBlob instanceof Blob)) {
                    console.error('Invalid audioBlob for download:', voiceNote.id, 'Type:', typeof voiceNote.audioBlob);
                    updateVoiceStatus('Cannot download voice note: Invalid audio data. This may be due to browser storage limitations.', 'error');
                    return;
                }
                
                const url = URL.createObjectURL(voiceNote.audioBlob);
                const a = document.createElement('a');
                a.href = url;
                
                // Generate filename with date
                const date = new Date(voiceNote.timestamp);
                const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
                const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
                const extension = voiceNote.audioBlob.type.includes('webm') ? 'webm' : 'mp4';
                
                a.download = `dream-voice-note-${dateStr}-${timeStr}.${extension}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                updateVoiceStatus('Voice note downloaded', 'info');
                
            } catch (error) {
                console.error('Error downloading voice note:', error);
                updateVoiceStatus('Failed to download voice note', 'error');
            }
        }
        
/**
 * Shows delete confirmation UI with timeout for safety.
 * 
 * This function initiates the deletion process by showing a confirmation button
 * that times out automatically for safety. The user must confirm within the
 * timeout period to complete deletion.
 * 
 * @function deleteVoiceNote
 * @param {string} voiceNoteId - ID of the voice note to delete
 * @returns {void}
 * @since 1.0.0
 * @example
 * deleteVoiceNote('voice_123456_abc');
 * // Shows "Confirm Delete" button with timeout
 */
function deleteVoiceNote(voiceNoteId) {
            // Clear any existing timeout for this voice note
            if (voiceDeleteTimeouts[voiceNoteId]) {
                clearTimeout(voiceDeleteTimeouts[voiceNoteId]);
                delete voiceDeleteTimeouts[voiceNoteId];
            }
            
            const voiceNoteElement = document.getElementById(`voice-note-${voiceNoteId}`);
            if (!voiceNoteElement) return; // Safety check
            
            // Add pending delete styling
            voiceNoteElement.classList.add('delete-pending');
            
            // Find and replace delete button with confirm button
            const deleteBtn = voiceNoteElement.querySelector(`button[data-voice-note-id="${CSS.escape(voiceNoteId)}"][data-action="delete-voice"]`);
            if (deleteBtn) {
                deleteBtn.outerHTML = `<button data-action="confirm-delete-voice" data-voice-note-id="${escapeAttr(voiceNoteId)}" class="voice-btn-base voice-btn-delete" style="animation: pulse 0.5s ease-in-out;">Confirm Delete</button>`;
            }
            
            // Set timeout to revert after specified time
            voiceDeleteTimeouts[voiceNoteId] = setTimeout(() => {
                cancelDeleteVoiceNote(voiceNoteId);
            }, CONSTANTS.MESSAGE_DURATION_EXTENDED);
        }

/**
 * Executes confirmed voice note deletion with mutex protection for data consistency.
 * 
 * This function performs the actual deletion operation with proper data consistency
 * protection using a mutex. It handles both IndexedDB and fallback storage methods.
 * 
 * @async
 * @function confirmDeleteVoiceNote
 * @param {string} voiceNoteId - ID of the voice note to delete
 * @returns {Promise<void>} Resolves when deletion is complete
 * @throws {Error} When deletion fails
 * @since 1.0.0
 * @example
 * await confirmDeleteVoiceNote('voice_123456_abc');
 * // Voice note is permanently deleted
 */
async function confirmDeleteVoiceNote(voiceNoteId) {
        return withMutex('voiceOperations', async () => {
            try {
                // Clear the timeout
                if (voiceDeleteTimeouts[voiceNoteId]) {
                    clearTimeout(voiceDeleteTimeouts[voiceNoteId]);
                    delete voiceDeleteTimeouts[voiceNoteId];
                }
                
                // Stop playing if this note is currently playing
                if (currentPlayingAudio) {
                    currentPlayingAudio.pause();
                    setCurrentPlayingAudio(null);
                }
                
                // Try to delete from IndexedDB first
                let deleted = false;
                if (isIndexedDBAvailable()) {
                    deleted = await deleteVoiceNoteFromIndexedDB(voiceNoteId);
                }
                
                // If IndexedDB deletion failed or unavailable, delete from memory/fallback
                if (!deleted) {
                    const allNotes = await loadVoiceNotes();
                    const updatedNotes = allNotes.filter(note => note.id !== voiceNoteId);
                    await saveVoiceNotes(updatedNotes); // Use the load/save fallback
                    deleted = true; // Mark as deleted since fallback was used
                }
                
                if (deleted) {
                    await updateRecordButtonState();
                    await displayVoiceNotes();
                    updateVoiceStatus('Voice note deleted', 'info');
                } else {
                    updateVoiceStatus('Voice note not found', 'error');
                }
                
            } catch (error) {
                console.error('Error deleting voice note:', error);
                updateVoiceStatus('Failed to delete voice note', 'error');
            }
        });
    }

/**
 * Cancels voice note deletion and restores original UI state.
 * 
 * This function cancels the deletion process and returns the UI to its normal
 * state, removing confirmation buttons and timeout handlers.
 * 
 * @function cancelDeleteVoiceNote
 * @param {string} voiceNoteId - ID of the voice note to cancel deletion for
 * @returns {void}
 * @since 1.0.0
 * @example
 * cancelDeleteVoiceNote('voice_123456_abc');
 * // Deletion is cancelled, UI returns to normal
 */
function cancelDeleteVoiceNote(voiceNoteId) {
            // Clear the timeout
            if (voiceDeleteTimeouts[voiceNoteId]) {
                clearTimeout(voiceDeleteTimeouts[voiceNoteId]);
                delete voiceDeleteTimeouts[voiceNoteId];
            }
            
            const voiceNoteElement = document.getElementById(`voice-note-${voiceNoteId}`);
            if (voiceNoteElement) {
                // Remove pending delete styling
                voiceNoteElement.classList.remove('delete-pending');
                
                // Replace confirm button with original delete button
                const confirmBtn = voiceNoteElement.querySelector(`button[data-voice-note-id="${CSS.escape(voiceNoteId)}"][data-action="confirm-delete-voice"]`);
                if (confirmBtn) {
                    confirmBtn.outerHTML = `<button data-action="delete-voice" data-voice-note-id="${escapeAttr(voiceNoteId)}" class="voice-btn-base voice-btn-delete">🗑️ Delete</button>`;
                }
            }
        }

// ================================
// ES MODULE EXPORTS
// ================================

export {
    // Core recording functions
    toggleRecording,
    
    // Voice playback functions
    playVoiceNote,
    pauseVoiceNote,
    
    // Voice note management
    displayVoiceNotes,
    downloadVoiceNote,
    deleteVoiceNote,
    confirmDeleteVoiceNote,
    cancelDeleteVoiceNote,
    
    // Audio utilities
    updateAudioProgress,
    seekAudio,
    
    // Voice capabilities
    getVoiceCapabilities,
    isVoiceRecordingSupported,
    
    // UI update functions
    updateRecordButtonState,
    updateVoiceStatus,
    
    // Utility functions
    formatDuration,
    getAudioDuration
};


