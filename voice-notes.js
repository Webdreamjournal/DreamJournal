    // --- 5.2 Voice Notes System ---
    // --- All functions related to voice recording, playback, and storage --- //

    // === RECORDING OPERATIONS ===
    
    // Start voice recording
    // MOVED FROM: Main functions area - Voice recording control
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
            
            mediaRecorder = new MediaRecorder(stream, { mimeType });
            
            audioChunks = [];
            recordingStartTime = Date.now();
            recognitionResults = '';
            
            // Setup speech recognition if supported
            if (isSpeechRecognitionSupported()) {
                speechRecognition = setupSpeechRecognition();
                if (speechRecognition) {
                    try {
                        isTranscribing = true;
                        speechRecognition.start();
                    } catch (speechError) {
                        console.error('Failed to start speech recognition:', speechError);
                        isTranscribing = false;
                    }
                }
            }
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = async () => {
                try {
                    if (audioChunks.length > 0) {
                        const audioBlob = new Blob(audioChunks, { type: mimeType });
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
            
            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event);
                updateVoiceStatus('Recording error occurred', 'error');
                stopRecording();
            };
            
            mediaRecorder.start();
            
            // Update UI to recording state
            const recordBtn = document.getElementById('recordBtn');
            const recordIcon = document.getElementById('recordIcon');
            const recordText = document.getElementById('recordText');
            const timerElement = document.getElementById('recordingTimer');
            
            if (recordBtn) recordBtn.className = 'record-btn recording';
            if (recordIcon) recordIcon.textContent = '⏹️';
            if (recordText) recordText.textContent = 'Stop Recording';
            if (timerElement) timerElement.style.display = 'block';
            
            if (isSpeechRecognitionSupported()) {
                updateVoiceStatus('Recording with transcription... Speak clearly for best results', 'info');
            } else {
                updateVoiceStatus('Recording... (transcription not available in this browser)', 'info');
            }
            
            // Start timer
            recordingTimer = setInterval(updateRecordingTimer, 100);
            
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

    // Stop voice recording
    // MOVED FROM: Main functions area - Voice recording control
    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        
        // Stop speech recognition
        if (speechRecognition && isTranscribing) {
            speechRecognition.stop();
            isTranscribing = false;
        }
        
        // Clear timer
        if (recordingTimer) {
            clearInterval(recordingTimer);
            recordingTimer = null;
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
        
        recordingStartTime = null;
    }

    // Toggle recording state
    // MOVED FROM: Main functions area - Voice recording toggle
    async function toggleRecording() {
        console.log('Toggle recording called'); // Debug log
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopRecording();
        } else {
            await startRecording();
        }
    }

    // Save completed recording
    async function saveRecording(audioBlob) {
        try {
            if (!audioBlob || audioBlob.size === 0) {
                throw new Error('Invalid audio data');
            }
            
            const now = new Date();
            const duration = recordingStartTime ? (Date.now() - recordingStartTime) / 1000 : 0;
            
            const voiceNote = {
                id: `voice_${now.getTime()}_${Math.random().toString(36).slice(2, 11)}`,
                audioBlob: audioBlob,
                timestamp: now.toISOString(),
                duration: Math.round(Math.max(0, duration)),
                title: `Voice Note ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
                dateString: now.toLocaleDateString('en-AU', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                size: audioBlob.size,
                transcription: (recognitionResults && recognitionResults.trim()) || null // Store transcribed text
            };
            
            try {
                await saveVoiceNote(voiceNote);
                await updateRecordButtonState();
                await displayVoiceNotes();
                
                // Switch to stored notes tab to show the new recording
                switchVoiceTab('stored');
            } catch (saveError) {
                console.error('Error saving voice note:', saveError);
                updateVoiceStatus('Failed to save voice note: ' + saveError.message, 'error');
                return;
            }
            
            // Show different success messages based on transcription
            if (recognitionResults && recognitionResults.trim()) {
                updateVoiceStatus(`Recording saved with transcription! Duration: ${formatDuration(duration)}`, 'info');
                
                // Show option to create dream entry
                const container = document.querySelector('.voice-recording-section');
                if (container) {
                    const successMsg = document.createElement('div');
                    successMsg.className = 'message-success mt-md';
                    successMsg.innerHTML = `
                        Voice note saved with transcription! (${formatDuration(duration)})<br>
                        <button data-action="create-from-transcription" data-voice-note-id="${voiceNote.id}" class="btn btn-primary btn-small mt-sm">
                            📝 Create Dream Entry
                        </button>
                    `;
                    container.appendChild(successMsg);
                    
                    setTimeout(() => {
                        if (successMsg.parentNode) {
                            successMsg.remove();
                        }
                    }, CONSTANTS.MESSAGE_DURATION_EXTENDED);
                }
            } else {
                updateVoiceStatus(`Recording saved! Duration: ${formatDuration(duration)}`, 'success');
            }
            
        } catch (error) {
            console.error('Error saving recording:', error);
            updateVoiceStatus('Failed to save recording', 'error');
        }
    }

    // === PLAYBACK & MANAGEMENT ===
    
    // Play voice note (Updated for Event Delegation)
    // MOVED FROM: Main functions area - Voice playback control
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
                currentPlayingAudio = null;
                
                // Reset all play buttons and hide progress bars
                document.querySelectorAll('.voice-btn.pause').forEach(btn => {
                    btn.className = 'voice-btn play';
                    btn.innerHTML = '▶️ Play';
                    btn.dataset.action = 'play-voice';
                });
                document.querySelectorAll('[id^="progress-container-"]').forEach(container => {
                    container.style.display = 'none';
                });
            }
            
            // Validate audioBlob before creating URL
            if (!voiceNote.audioBlob || !(voiceNote.audioBlob instanceof Blob)) {
                console.error('Invalid audioBlob for voice note:', voiceNote.id, 'Type:', typeof voiceNote.audioBlob);
                updateVoiceStatus('Cannot play voice note: Invalid audio data. This may be due to browser storage limitations.', 'error');
                return;
            }
            
            // Create audio element
            const audio = new Audio();
            const audioURL = URL.createObjectURL(voiceNote.audioBlob);
            audio.src = audioURL;
            
            // Update button to pause state and show progress bar
            if (playBtn) {
                playBtn.className = 'voice-btn pause';
                playBtn.innerHTML = '⏸️ Pause';
                playBtn.dataset.action = 'pause-voice';
            }
            
            if (progressContainer) {
                progressContainer.style.display = 'flex';
            }
            
            // Set up audio event listeners for progress tracking
            audio.ontimeupdate = () => {
                updateAudioProgress(voiceNoteId, audio.currentTime, audio.duration);
            };
            
            audio.onloadedmetadata = () => {
                // Update total time display when metadata loads
                const totalTimeEl = document.getElementById(`time-total-${voiceNoteId}`);
                if (totalTimeEl) {
                    totalTimeEl.textContent = formatDuration(audio.duration);
                }
            };
            
            audio.onended = () => {
                try {
                    URL.revokeObjectURL(audioURL);
                } catch (e) {
                    console.warn('Failed to revoke audio URL:', e);
                }
                currentPlayingAudio = null;
                
                // Reset button to play state and hide progress bar
                if (playBtn) {
                    playBtn.className = 'voice-btn play';
                    playBtn.innerHTML = '▶️ Play';
                    playBtn.dataset.action = 'play-voice';
                }
                
                if (progressContainer) {
                    progressContainer.style.display = 'none';
                }
                
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
                currentPlayingAudio = null;
                updateVoiceStatus('Error playing voice note', 'error');
                
                // Reset button state
                if (playBtn) {
                    playBtn.className = 'voice-btn play';
                    playBtn.innerHTML = '▶️ Play';
                    playBtn.dataset.action = 'play-voice';
                }
                
                if (progressContainer) {
                    progressContainer.style.display = 'none';
                }
            };
            
            // Start playing
            currentPlayingAudio = audio;
            await audio.play();
            
        } catch (error) {
            console.error('Error playing voice note:', error);
            updateVoiceStatus('Failed to play voice note', 'error');
        }
    }

      // VOICE RECORDING INTERFACE & CONTROLS
        
        // Voice Recording Functions
        
        // Enhanced browser detection for voice features
        function getVoiceCapabilities() {
            const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
            const hasMediaRecorder = !!(window.MediaRecorder);
            const hasSpeechRecognition = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
            
            // Detect browser type
            const userAgent = navigator.userAgent.toLowerCase();
            const isFirefox = userAgent.includes('firefox');
            const isFirefoxMobile = isFirefox && userAgent.includes('mobile');
            const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
            const isSafariMobile = isSafari && userAgent.includes('mobile');
            const isChrome = userAgent.includes('chrome') && !userAgent.includes('edg');
            const isEdge = userAgent.includes('edg');
            
            return {
                canRecord: hasGetUserMedia && hasMediaRecorder,
                canTranscribe: hasSpeechRecognition,
                hasGetUserMedia,
                hasMediaRecorder,
                hasSpeechRecognition,
                browser: {
                    isFirefox,
                    isFirefoxMobile,
                    isSafari,
                    isSafariMobile,
                    isChrome,
                    isEdge
                },
                getStatusMessage() {
                    if (this.canRecord && this.canTranscribe) {
                        return { type: 'success', message: 'Full voice recording and transcription support' };
                    } else if (this.canRecord && !this.canTranscribe) {
                        if (isFirefox) {
                            return { type: 'warning', message: 'Voice recording supported, Firefox does not support transcription' };
                        } else if (isSafari) {
                            return { type: 'warning', message: 'Voice recording supported, Safari does not support transcription' };
                        } else {
                            return { type: 'warning', message: 'Voice recording supported, transcription not available' };
                        }
                    } else if (!this.canRecord) {
                        if (isSafariMobile) {
                            return { type: 'error', message: 'Safari iOS has limited voice recording support. Try Chrome or Edge mobile.' };
                        } else {
                            return { type: 'error', message: 'Voice recording not supported in this browser. Try Chrome, Edge, or Firefox.' };
                        }
                    }
                }
            };
        }
        
        // Check if browser supports voice recording
        function isVoiceRecordingSupported() {
            return getVoiceCapabilities().canRecord;
        }
        
        // Check if speech recognition is supported
        function isSpeechRecognitionSupported() {
            return getVoiceCapabilities().canTranscribe;
        }
        
        // Setup speech recognition
        function setupSpeechRecognition() {
            if (!isSpeechRecognitionSupported()) return null;
            
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            
            let finalTranscript = '';
            
            recognition.onresult = (event) => {
                let interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                recognitionResults = finalTranscript + interimTranscript;
                updateVoiceStatus(`Recording... "${recognitionResults.slice(-CONSTANTS.TEXT_TRUNCATE_LENGTH)}${recognitionResults.length > CONSTANTS.TEXT_TRUNCATE_LENGTH ? '...' : ''}"`, 'info');
            };
            
            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                // Don't show error for network issues - transcription is optional
                if (event.error !== 'network') {
                    updateVoiceStatus('Recording... (transcription unavailable)', 'info');
                }
            };
            
            recognition.onend = () => {
                isTranscribing = false;
            };
            
            return recognition;
        }
        
        // Format recording duration
        function formatDuration(seconds) {
            if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
            const safeSeconds = Math.max(0, Math.floor(seconds));
            const mins = Math.floor(safeSeconds / 60);
            const secs = safeSeconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        
        // Update recording timer
        function updateRecordingTimer() {
            if (!recordingStartTime || !recordingTimer) {
                // Safety check: if recording should be stopped, clear any lingering timer
                if (recordingTimer) {
                    clearInterval(recordingTimer);
                    recordingTimer = null;
                }
                return;
            }
            
            const elapsed = (Date.now() - recordingStartTime) / 1000;
            const timerElement = document.getElementById('recordingTimer');
            if (timerElement) {
                timerElement.textContent = formatDuration(elapsed);
            }
        }
        
        // Update voice status message
        function updateVoiceStatus(message, type = 'info') {
            const statusElement = document.getElementById('voiceStatus');
            if (statusElement) {
                statusElement.textContent = message;
                statusElement.className = `voice-status ${type}`;
            }
        }
        
        // Update record button state
        async function updateRecordButtonState() {
            const recordBtn = document.getElementById('recordBtn');
            const recordIcon = document.getElementById('recordIcon');
            const recordText = document.getElementById('recordText');
            
            if (!recordBtn || !recordIcon || !recordText) return;
            
            try {
                const voiceNotes = await loadVoiceNotes();
                const voiceCount = voiceNotes.length;
                
                // Check if currently recording
                const isCurrentlyRecording = mediaRecorder && mediaRecorder.state === 'recording';
                
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
                        const voiceCapabilities = getVoiceCapabilities();
                        if (voiceCapabilities.canTranscribe) {
                            updateVoiceStatus(`Voice Notes (${voiceCount}/${CONSTANTS.VOICE_STORAGE_LIMIT}) - Recording and transcription supported`, 'info');
                        } else {
                            updateVoiceStatus(`Voice Notes (${voiceCount}/${CONSTANTS.VOICE_STORAGE_LIMIT}) - Recording supported (no transcription)`, 'warning');
                        }
                    }
                }
            } catch (error) {
                console.error('Error updating record button state:', error);
                updateVoiceStatus('Error checking voice note storage', 'error');
            }
        }
        

        // VOICE NOTES DISPLAY & PLAYBACK CONTROLS
        
        // Voice Notes Display and Controls
        
        // Throttle progress updates to prevent excessive DOM manipulation
        let lastProgressUpdate = 0;
        const PROGRESS_UPDATE_THROTTLE = 100; // ms
        
        // Display voice notes (Updated for Event Delegation)
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
                    
                    // Check if transcription is available
                    const hasTranscription = note.transcription && note.transcription.trim();
                    const transcriptionIndicator = hasTranscription ? ' • 📝 Transcribed' : '';
                    
                    // Create meta information
                    const metaItems = [
                        { value: escapeHtml(note.dateString) },
                        { value: formatDuration(note.duration) },
                        { value: sizeDisplay }
                    ];
                    
                    if (transcriptionIndicator) {
                        metaItems.push({ value: transcriptionIndicator });
                    }
                    
                    // Create control buttons using utility classes
                    const controlButtons = [
                        `<button data-action="play-voice" data-voice-note-id="${escapeAttr(note.id)}" id="play-btn-${escapeAttr(note.id)}" class="voice-btn-base voice-btn-play">▶️ Play</button>`,
                        `<button data-action="transcribe-voice" data-voice-note-id="${escapeAttr(note.id)}" class="voice-btn-base voice-btn-transcribe" title="${hasTranscription ? 'Create a dream entry from this transcription' : 'Transcribe the audio and create a dream entry'}">${hasTranscription ? '📝 Use as Dream' : '📝 Transcribe & Create Dream'}</button>`,
                        `<button data-action="download-voice" data-voice-note-id="${escapeAttr(note.id)}" class="voice-btn-base voice-btn-download">⬇️ Download</button>`,
                        `<button data-action="delete-voice" data-voice-note-id="${escapeAttr(note.id)}" class="voice-btn-base voice-btn-delete">🗑️ Delete</button>`
                    ].join('');
                    
                    return `
                        <div class="voice-note-container" id="voice-note-${escapeAttr(note.id)}">
                            <div class="voice-note-info">
                                <div class="voice-note-title">${escapeHtml(note.title)}</div>
                                <div class="voice-note-meta">${createMetaDisplay(metaItems)}</div>
                            </div>
                            <div class="voice-note-controls">
                                ${controlButtons}
                                <div class="voice-progress-container" id="progress-container-${escapeAttr(note.id)}" style="display: none;">
                                    <div class="voice-time-display" id="time-current-${escapeAttr(note.id)}">0:00</div>
                                    <div class="voice-progress-bar" data-action="seek-audio" data-voice-note-id="${escapeAttr(note.id)}" id="progress-bar-${escapeAttr(note.id)}">
                                        <div class="voice-progress-fill" id="progress-fill-${escapeAttr(note.id)}"></div>
                                    </div>
                                    <div class="voice-time-display" id="time-total-${escapeAttr(note.id)}">${formatDuration(note.duration)}</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                container.innerHTML = warningHTML + notesHTML;
                
            } catch (error) {
                console.error('Error displaying voice notes:', error);
                container.innerHTML = `
                    <div class="no-voice-notes">
                        Error loading voice notes. Please try refreshing the page.
                    </div>
                `;
            }
        }
        
        
        // Pause voice note (Updated for Event Delegation)
        function pauseVoiceNote(voiceNoteId) {
            if (currentPlayingAudio) {
                try {
                    currentPlayingAudio.pause();
                    // Don't revoke URL here since user might want to resume
                } catch (e) {
                    console.warn('Error pausing audio:', e);
                }
                currentPlayingAudio = null;
            }
            
            const playBtn = document.getElementById(`play-btn-${voiceNoteId}`);
            const progressContainer = document.getElementById(`progress-container-${voiceNoteId}`);
            
            if (playBtn) {
                playBtn.className = 'voice-btn play';
                playBtn.innerHTML = '▶️ Play';
                playBtn.dataset.action = 'play-voice';
            }
            
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
        }
        
        // Update audio progress bar and time displays
        function updateAudioProgress(voiceNoteId, currentTime, duration) {
            if (!voiceNoteId || isNaN(currentTime) || isNaN(duration) || duration <= 0) return;
            
            // Throttle updates to prevent excessive DOM manipulation
            const now = Date.now();
            if (now - lastProgressUpdate < PROGRESS_UPDATE_THROTTLE) return;
            lastProgressUpdate = now;
            
            const progressFill = document.getElementById(`progress-fill-${voiceNoteId}`);
            const currentTimeEl = document.getElementById(`time-current-${voiceNoteId}`);
            
            if (progressFill) {
                // Extra safety check to prevent division by zero and invalid values
                const safeCurrentTime = Math.max(0, Math.min(currentTime, duration));
                const progress = Math.max(0, Math.min(100, (safeCurrentTime / duration) * 100));
                progressFill.style.width = `${progress}%`;
            }
            
            if (currentTimeEl) {
                currentTimeEl.textContent = formatDuration(Math.max(0, currentTime));
            }
        }
        
        // Seek to specific position in audio
        function seekAudio(voiceNoteId, event) {
            if (!currentPlayingAudio || !event) return;
            
            const progressBar = document.getElementById(`progress-bar-${voiceNoteId}`);
            if (!progressBar) return;
            
            const rect = progressBar.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const progressBarWidth = rect.width;
            
            if (progressBarWidth <= 0) return; // Prevent division by zero
            
            const clickPercentage = clickX / progressBarWidth;
            
            // Ensure percentage is between 0 and 1
            const seekPercentage = Math.max(0, Math.min(1, clickPercentage));
            
            if (!isNaN(currentPlayingAudio.duration) && currentPlayingAudio.duration > 0) {
                const seekTime = seekPercentage * currentPlayingAudio.duration;
                currentPlayingAudio.currentTime = seekTime;
                
                // Update progress immediately for responsive feedback
                updateAudioProgress(voiceNoteId, seekTime, currentPlayingAudio.duration);
            }
        }
        
        // Download voice note
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
        
        // Show delete confirmation for voice note
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
            const deleteBtn = voiceNoteElement.querySelector(`button[data-voice-note-id="${voiceNoteId}"][data-action="delete-voice"]`);
            if (deleteBtn) {
                deleteBtn.outerHTML = `<button data-action="confirm-delete-voice" data-voice-note-id="${voiceNoteId}" class="voice-btn-base voice-btn-delete" style="animation: pulse 0.5s ease-in-out;">Confirm Delete</button>`;
            }
            
            // Set timeout to revert after specified time
            voiceDeleteTimeouts[voiceNoteId] = setTimeout(() => {
                cancelDeleteVoiceNote(voiceNoteId);
            }, CONSTANTS.MESSAGE_DURATION_EXTENDED);
        }

        // Actually delete the voice note after confirmation (with mutex protection)
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
                        currentPlayingAudio = null;
                    }
                    
                    // Try to delete from IndexedDB first
                    let deleted = false;
                    if (isIndexedDBAvailable()) {
                        deleted = await deleteVoiceNoteFromIndexedDB(voiceNoteId);
                    }
                    
                    // If IndexedDB deletion failed or unavailable, delete from memory
                    if (!deleted) {
                        const index = memoryVoiceNotes.findIndex(n => n.id === voiceNoteId);
                        if (index !== -1) {
                            memoryVoiceNotes.splice(index, 1);
                            deleted = true;
                        }
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

        // Cancel voice note delete and revert to normal state
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
                const confirmBtn = voiceNoteElement.querySelector(`button[data-voice-note-id="${voiceNoteId}"][data-action="confirm-delete-voice"]`);
                if (confirmBtn) {
                    confirmBtn.outerHTML = `<button data-action="delete-voice" data-voice-note-id="${voiceNoteId}" class="voice-btn-base voice-btn-delete">🗑️ Delete</button>`;
                }
            }
        }

    // VOICE RECORDING & TRANSCRIPTION SYSTEM
    
    // Create dream entry from transcribed voice note
    // Create dream entry from transcribed voice note
    // Transcribe voice note (create dream entry if transcription exists)
    async function transcribeVoiceNote(voiceNoteId) {
        try {
            const voiceNotes = await loadVoiceNotes();
            const voiceNote = voiceNotes.find(n => n.id === voiceNoteId);
            
            if (!voiceNote) {
                updateVoiceStatus('Voice note not found', 'error');
                return;
            }
            
            if (voiceNote.transcription && voiceNote.transcription.trim()) {
                // Transcription already exists, create dream entry
                await createDreamFromTranscription(voiceNoteId);
            } else {
                // No transcription available
                updateVoiceStatus('No transcription available. Transcription happens during recording when supported.', 'error');
                
                // Show helpful message
                const container = document.querySelector('.main-content');
                if (container) {
                    const msg = document.createElement('div');
                    msg.className = 'message-warning';
                    msg.innerHTML = `
                        <strong>Transcription Tip:</strong> For automatic transcription, speak clearly during recording. 
                        <br>Transcription works best with clear speech in quiet environments.
                    `;
                    container.insertBefore(msg, container.firstChild);
                    
                    setTimeout(() => {
                        if (msg.parentNode) {
                            msg.remove();
                        }
                    }, 7000);
                }
            }
            
        } catch (error) {
            console.error('Error transcribing voice note:', error);
            updateVoiceStatus('Failed to process transcription', 'error');
        }
    }
    async function createDreamFromTranscription(voiceNoteId) {
        try {
            const voiceNotes = await loadVoiceNotes();
            const voiceNote = voiceNotes.find(n => n.id === voiceNoteId);
            
            if (!voiceNote || !voiceNote.transcription) {
                updateVoiceStatus('No transcription available for this voice note', 'error');
                return;
            }
            
            // Set the current date/time as the dream date
            const now = new Date();
            const dreamDateInput = document.getElementById('dreamDate');
            if (dreamDateInput) {
                dreamDateInput.value = now.toISOString().slice(0, 16);
            }
            
            // Clear other form fields
            const titleInput = document.getElementById('dreamTitle');
            const emotionsInput = document.getElementById('dreamEmotions');
            const tagsInput = document.getElementById('dreamTags');
            const dreamSignsInput = document.getElementById('dreamSigns');
            const lucidCheckbox = document.getElementById('isLucid');
            const contentInput = document.getElementById('dreamContent');
            
            if (titleInput) titleInput.value = '';
            if (emotionsInput) emotionsInput.value = '';
            if (tagsInput) tagsInput.value = '';
            if (dreamSignsInput) dreamSignsInput.value = '';
            if (lucidCheckbox) lucidCheckbox.checked = false;
            
            // Populate with transcribed text
            if (contentInput) {
                contentInput.value = voiceNote.transcription;
                contentInput.focus();
                contentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            // Show success message
            const container = document.querySelector('.main-content');
            if (container) {
                createInlineMessage('info', 'Dream entry created from transcription! Review and edit as needed, then save.', {
                    container: container,
                    position: 'top',
                    duration: 5000
                });
            }
            
        } catch (error) {
            console.error('Error creating dream from transcription:', error);
            updateVoiceStatus('Failed to create dream entry', 'error');
        }
    }


