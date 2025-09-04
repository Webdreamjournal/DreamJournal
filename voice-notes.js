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
            console.log(`saveRecording: recordingStartTime=${recordingStartTime}, calculated duration=${duration}s`);

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
                console.log(`Using pre-loaded audio for ${voiceNoteId}, current time: ${formatDuration(audio.currentTime)}`);
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
                        console.log(`Audio duration loaded via metadata: ${audio.duration}s for ${voiceNoteId}`);
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
                        console.log(`Audio duration loaded via canplaythrough: ${audio.duration}s for ${voiceNoteId}`);
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
                        console.log(`Audio duration loaded via loadeddata: ${audio.duration}s for ${voiceNoteId}`);
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
                            console.log(`Audio duration loaded after play: ${audio.duration}s for ${voiceNoteId}`);
                        } else if (totalTimeEl && voiceNote.duration) {
                            // Final fallback: use stored duration
                            actualDuration = voiceNote.duration;
                            totalTimeEl.textContent = formatDuration(voiceNote.duration);
                            console.log(`Using stored duration as fallback: ${voiceNote.duration}s for ${voiceNoteId}`);
                        }
                    }, 100);
                }
            };

            // Set up time update listener
            audio.ontimeupdate = () => {
                if (isFirefox) {
                    console.log(`Firefox ontimeupdate: ${audio.currentTime.toFixed(2)}s / ${audio.duration}s`);
                }

                // Detect real duration during playback (Firefox often provides it after starting)
                if (!durationDetected) {
                    if (isFinite(audio.duration) && audio.duration > 0) {
                        // Firefox provided finite duration - use it!
                        actualDuration = audio.duration;
                        durationDetected = true;
                        const totalTimeEl = document.getElementById(`time-total-${voiceNoteId}`);
                        if (totalTimeEl) {
                            totalTimeEl.textContent = formatDuration(audio.duration);
                            console.log(`Firefox: Real duration detected during playback: ${audio.duration}s for ${voiceNoteId}`);
                        }

                        // Also update the header duration display
                        const headerDurationEl = document.getElementById(`header-duration-${voiceNoteId}`);
                        if (headerDurationEl) {
                            headerDurationEl.textContent = formatDuration(audio.duration);
                            console.log(`Firefox: Updated header duration to ${formatDuration(audio.duration)} for ${voiceNoteId}`);
                        }
                    } else if (audio.seekable && audio.seekable.length > 0) {
                        // Try to get duration from seekable range
                        const seekableDuration = audio.seekable.end(0);
                        if (isFinite(seekableDuration) && seekableDuration > 0) {
                            actualDuration = seekableDuration;
                            durationDetected = true;
                            const totalTimeEl = document.getElementById(`time-total-${voiceNoteId}`);
                            if (totalTimeEl) {
                                totalTimeEl.textContent = formatDuration(seekableDuration);
                                console.log(`Firefox: Duration from seekable range: ${seekableDuration}s for ${voiceNoteId}`);
                            }
                            // Also update the header duration display
                            const headerDurationEl = document.getElementById(`header-duration-${voiceNoteId}`);
                            if (headerDurationEl) {
                                headerDurationEl.textContent = formatDuration(seekableDuration);
                                console.log(`Firefox: Updated header duration from seekable range to ${formatDuration(seekableDuration)} for ${voiceNoteId}`);
                            }
                        }
                    }
                }

                // Update progress with best available duration
                let effectiveDuration = actualDuration || voiceNote.duration || 0; // Use detected, then stored, then 0

                updateAudioProgress(voiceNoteId, audio.currentTime, effectiveDuration);
            };

            audio.onended = () => {
                try {
                    URL.revokeObjectURL(audioURL);
                } catch (e) {
                    console.warn('Failed to revoke audio URL:', e);
                }
                currentPlayingAudio = null;

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
                currentPlayingAudio = null;

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
            currentPlayingAudio = audio;

            // Preload the audio to ensure metadata is available
            audio.preload = 'metadata';
            audio.load(); // Force load metadata

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
            if (!seconds || isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '0:00';
            const safeSeconds = Math.max(0, Math.floor(seconds));
            const mins = Math.floor(safeSeconds / 60);
            const secs = safeSeconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }

        // Get actual audio duration from blob - UPDATED VERSION FOR REAL DURATION DETECTION
        async function getAudioDuration(audioBlob) {
            console.log('🔧 USING NEW DURATION DETECTION FUNCTION - v2.01.4');
            return new Promise((resolve) => {
                if (!audioBlob || !(audioBlob instanceof Blob)) {
                    console.log('getAudioDuration: Invalid audioBlob');
                    resolve(0);
                    return;
                }

                console.log(`getAudioDuration: Starting for blob type: ${audioBlob.type}, size: ${audioBlob.size}`);
                const audio = new Audio();
                const url = URL.createObjectURL(audioBlob);
                let resolved = false;

                // Try multiple events to get duration
                const attemptDurationDetection = () => {
                    console.log(`getAudioDuration: Checking - duration: ${audio.duration}, seekable: ${audio.seekable.length}`);
                    if (!resolved) {
                        if (isFinite(audio.duration) && audio.duration > 0) {
                            console.log(`getAudioDuration: Valid duration detected: ${audio.duration}s`);
                            resolved = true;
                            URL.revokeObjectURL(url);
                            resolve(audio.duration);
                        } else if (audio.seekable && audio.seekable.length > 0) {
                            try {
                                const seekableDuration = audio.seekable.end(0);
                                console.log(`getAudioDuration: Raw seekable duration: ${seekableDuration}, finite: ${isFinite(seekableDuration)}`);
                                if (isFinite(seekableDuration) && seekableDuration > 0) {
                                    console.log(`getAudioDuration: ✅ Duration from seekable range: ${seekableDuration}s`);
                                    resolved = true;
                                    URL.revokeObjectURL(url);
                                    resolve(seekableDuration);
                                } else {
                                    console.log(`getAudioDuration: ❌ Seekable duration invalid: ${seekableDuration}`);
                                }
                            } catch (e) {
                                console.log(`getAudioDuration: ❌ Error getting seekable duration: ${e.message}`);
                            }
                        }
                    }
                };

                audio.oncanplay = attemptDurationDetection;
                audio.oncanplaythrough = attemptDurationDetection;
                audio.onloadeddata = attemptDurationDetection;

                // Timeout fallback after 1 second
                setTimeout(() => {
                    if (!resolved) {
                        console.log(`getAudioDuration: Timeout - resolving with 0 to allow fallback to stored duration`);
                        resolved = true;
                        URL.revokeObjectURL(url);
                        resolve(0); // Resolve with 0 to allow fallback to stored duration
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
                        console.log('getAudioDuration: Trying brief play to detect duration');
                        audio.currentTime = 0;
                        audio.play().then(() => {
                            setTimeout(() => {
                                audio.pause();
                                attemptDurationDetection();
                            }, 100);
                        }).catch(() => {
                            console.log('getAudioDuration: Brief play failed, continuing with other methods');
                        });
                    }
                }, 500);
            });
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
        const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
        const PROGRESS_UPDATE_THROTTLE = isFirefox ? 0 : 50; // ms - disable throttling for Firefox

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
                        { value: `<span id="header-duration-${escapeAttr(note.id)}">${formatDuration(note.duration || 0)}</span>`, isHTML: true },
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
                        console.log(`Getting duration for note ${note.id}, stored duration: ${note.duration}, blob type: ${note.audioBlob?.type}, blob size: ${note.audioBlob?.size}`);
                        const actualDuration = await getAudioDuration(note.audioBlob);
                        console.log(`Detected duration for note ${note.id}: ${actualDuration}s`);

                        // Use detected duration or fall back to stored duration
                        const effectiveDuration = actualDuration > 0 ? actualDuration : note.duration;

                        if (effectiveDuration > 0) {
                            // Update the header duration display
                            const headerDurationEl = document.getElementById(`header-duration-${note.id}`);
                            if (headerDurationEl) {
                                headerDurationEl.textContent = formatDuration(effectiveDuration);
                                console.log(`Updated header duration for ${note.id} to ${formatDuration(effectiveDuration)} (source: ${actualDuration > 0 ? 'detected' : 'stored'})`);
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

            // Progress container stays visible
        }

        // Update audio progress bar and time displays
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

                if (isFirefox) {
                    // Firefox: Use transform instead of width for better rendering
                    console.log(`Firefox progress update: ${(progressRatio * 100).toFixed(1)}%`);
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

        // Update progress with smooth transition for manual seeking
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

                if (isFirefox) {
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

        // Store audio elements for seeking when paused
        let audioElements = {};

        // Seek to specific position in audio
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
                                // Use fallback duration for WebM Infinity
                                const effectiveDuration = audio.duration === Infinity ? voiceNote.duration || 0 : audio.duration;
                                const seekTime = seekPercentage * effectiveDuration;
                                audio.currentTime = seekTime;

                                // Update progress bar to show seek position with smooth transition
                                updateAudioProgressWithTransition(voiceNoteId, seekTime, effectiveDuration);

                                console.log(`Seeked to ${formatDuration(seekTime)} (paused) in voice note ${voiceNoteId}`);
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
