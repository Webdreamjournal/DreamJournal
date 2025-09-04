// ================================
// SECURITY.JS - CRYPTOGRAPHY & PIN MANAGEMENT
// ================================
// Handles encryption, decryption, PIN hashing, authentication, and recovery systems
// Uses WebCrypto API for secure operations with PBKDF2 key derivation

// ================================
// 1. CRYPTOGRAPHIC UTILITIES
// ================================
    
    // Generate cryptographically secure random salt
    function generateSalt() {
        return crypto.getRandomValues(new Uint8Array(16));
    }
    
    // Generate cryptographically secure random IV
    function generateIV() {
        return crypto.getRandomValues(new Uint8Array(12));
    }
    
    // Derive encryption key from password using PBKDF2
    async function deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );
        
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }
    
    // Encrypt data with password
    async function encryptData(data, password) {
        try {
            const encoder = new TextEncoder();
            const salt = generateSalt();
            const iv = generateIV();
            const key = await deriveKey(password, salt);
            
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encoder.encode(data)
            );
            
            // Combine salt, iv, and encrypted data
            const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
            result.set(salt, 0);
            result.set(iv, salt.length);
            result.set(new Uint8Array(encrypted), salt.length + iv.length);
            
            return result;
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }
    
    // Decrypt data with password
    async function decryptData(encryptedData, password) {
        try {
            const salt = encryptedData.slice(0, 16);
            const iv = encryptedData.slice(16, 28);
            const encrypted = encryptedData.slice(28);
            
            const key = await deriveKey(password, salt);
            
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encrypted
            );
            
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt data - incorrect password or corrupted file');
        }
    }
    
// ================================
// 2. PASSWORD DIALOG SYSTEM
// ================================

// Show password dialog for export/import operations with configurable options
// Supports both password entry and confirmation modes
function showPasswordDialog(config) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'overlay';
            overlay.style.display = 'flex';
            
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h2>${config.title}</h2>
                    <p class="mb-md">${config.description}</p>
                    
                    <div class="form-group">
                        <input type="password" 
                               id="passwordInput" 
                               placeholder="Enter password"
                               class="form-control mb-sm"
                               style="width: 100%">
                    </div>
                    
                    ${config.requireConfirm ? `
                    <div class="form-group">
                        <input type="password" 
                               id="confirmPasswordInput" 
                               placeholder="Confirm password"
                               class="form-control mb-md"
                               style="width: 100%">
                    </div>
                    ` : '<div class="mb-md"></div>'}
                    
                    <div class="button-group">
                        <button class="btn btn-primary" id="confirmPasswordBtn">${config.primaryButtonText}</button>
                        <button class="btn btn-secondary" id="cancelPasswordBtn">Cancel</button>
                    </div>
                </div>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            const passwordInput = document.getElementById('passwordInput');
            const confirmInput = document.getElementById('confirmPasswordInput');
            const confirmBtn = document.getElementById('confirmPasswordBtn');
            const cancelBtn = document.getElementById('cancelPasswordBtn');
            
            passwordInput.focus();
            
            function cleanup() {
                document.body.removeChild(overlay);
            }
            
            function handleConfirm() {
                const password = passwordInput.value;
                const confirmPassword = confirmInput ? confirmInput.value : password;
                
                if (!password) {
                    passwordInput.focus();
                    return;
                }
                
                if (config.requireConfirm && password !== confirmPassword) {
                    // Create inline error message instead of alert
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'text-error text-sm mb-sm';
                    errorDiv.textContent = 'Passwords do not match';
                    confirmInput.parentNode.insertBefore(errorDiv, confirmInput.nextSibling);
                    confirmInput.focus();
                    setTimeout(() => errorDiv.remove(), 3000);
                    return;
                }
                
                cleanup();
                resolve(password);
            }
            
            function handleCancel() {
                cleanup();
                resolve(null);
            }
            
            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            
            passwordInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    if (config.requireConfirm && !confirmInput.value) {
                        confirmInput.focus();
                    } else {
                        handleConfirm();
                    }
                }
            });
            
            if (confirmInput) {
                confirmInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        handleConfirm();
                    }
                });
            }
        });
    }
    
// ================================
// 3. PIN HASHING & VERIFICATION SYSTEM
// ================================

// Simple hash function for PIN (DEPRECATED - kept for legacy migration)
// Used to verify old PIN hashes before upgrading to secure format
function hashPinLegacy(pin) {
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
        const char = pin.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
}

// Secure PIN hashing using PBKDF2 with salt and configurable iterations
// Returns both hash and salt in hex format for secure storage
async function hashPinSecure(pin, salt = null) {
    try {
        if (!salt) salt = generateSalt();
        
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(pin),
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );
        
        // Derive bits instead of key to avoid extractability issues
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: CONSTANTS.CRYPTO_PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            CONSTANTS.CRYPTO_KEY_LENGTH
        );
        
        // Convert to hex strings for storage
        const hashArray = Array.from(new Uint8Array(derivedBits));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        const saltArray = Array.from(salt);
        const saltHex = saltArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return {
            hash: hashHex,
            salt: saltHex
        };
    } catch (error) {
        console.error('Secure PIN hashing error:', error);
        throw new Error('Failed to hash PIN securely');
    }
}

// Detect PIN storage format for backwards compatibility
// Legacy format: simple hash string | Secure format: JSON with hash and salt
function isLegacyPinFormat(storedData) {
    if (typeof storedData === 'string') {
        try {
            const parsed = JSON.parse(storedData);
            return !(parsed && parsed.hash && parsed.salt);
        } catch (e) {
            return true; // Not JSON, so it's legacy
        }
    }
    return true;
}
    
// ================================
// 4. PIN STORAGE & MANAGEMENT
// ================================

// Check if PIN protection is currently enabled
// Works with both IndexedDB and localStorage fallback systems
function isPinSetup() {
        if (storageType === 'indexeddb') {
            return pinStorage.hash !== null;
        } else {
            return localStorage.getItem('dreamJournalPin') !== null;
        }
    }
    
    // Store PIN hash securely
    async function storePinHash(pin) {
        try {
            const hashedData = await hashPinSecure(pin);
            const hashToStore = JSON.stringify(hashedData);
            
            if (storageType === 'indexeddb') {
                pinStorage.hash = hashToStore;
                // Store in IndexedDB
                const transaction = db.transaction(['settings'], 'readwrite');
                const store = transaction.objectStore('settings');
                await store.put({ key: 'pinHash', value: hashToStore });
                await store.put({ key: 'pinVersion', value: '2.0' });
            } else {
                localStorage.setItem('dreamJournalPin', hashToStore);
                localStorage.setItem('dreamJournalPinVersion', '2.0');
            }
            return true;
        } catch (error) {
            console.error('PIN hash storage error:', error);
            return false;
        }
    }
    
    // Get stored PIN data
    function getStoredPinData() {
        if (storageType === 'indexeddb') {
            return pinStorage.hash;
        } else {
            return localStorage.getItem('dreamJournalPin');
        }
    }
    
    // Verify entered PIN against stored hash
    async function verifyPinHash(enteredPin, storedData) {
        if (!storedData || !enteredPin) return false;
        
        try {
            // Check for legacy format first
            if (isLegacyPinFormat(storedData)) {
                const legacyHash = hashPinLegacy(enteredPin);
                return legacyHash === storedData;
            }
            
            // Handle secure format
            const stored = JSON.parse(storedData);
            if (!stored.hash || !stored.salt) return false;
            
            // Convert hex salt back to Uint8Array
            const saltArray = [];
            for (let i = 0; i < stored.salt.length; i += 2) {
                saltArray.push(parseInt(stored.salt.substr(i, 2), 16));
            }
            const salt = new Uint8Array(saltArray);
            
            // Hash the entered PIN with the stored salt
            const hashedEntered = await hashPinSecure(enteredPin, salt);
            return hashedEntered.hash === stored.hash;
            
        } catch (error) {
            console.error('PIN verification error:', error);
            return false;
        }
    }
    
    // Remove PIN hash
    function removePinHash() {
        if (storageType === 'indexeddb') {
            pinStorage.hash = null;
            const transaction = db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            store.delete('pinHash');
            store.delete('pinVersion');
        } else {
            localStorage.removeItem('dreamJournalPin');
            localStorage.removeItem('dreamJournalPinVersion');
        }
    }
    
    // Store reset time for forgot PIN feature
    function storeResetTime(time) {
        if (storageType === 'indexeddb') {
            pinStorage.resetTime = time;
            const transaction = db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            store.put({ key: 'pinResetTime', value: time });
        } else {
            localStorage.setItem('pinResetTime', time.toString());
        }
    }
    
    // Get reset time
    function getResetTime() {
        if (storageType === 'indexeddb') {
            return pinStorage.resetTime;
        } else {
            const time = localStorage.getItem('pinResetTime');
            return time ? parseInt(time) : null;
        }
    }
    
    // Remove reset time
    function removeResetTime() {
        if (storageType === 'indexeddb') {
            pinStorage.resetTime = null;
            const transaction = db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            store.delete('pinResetTime');
        } else {
            localStorage.removeItem('pinResetTime');
        }
    }
    
    // Update security controls UI
    function updateSecurityControls() {
        const setupBtn = document.getElementById('setupPinBtn');
        const removePinBtn = document.getElementById('removePinBtn');
        const changePinBtn = document.getElementById('changePinBtn');
        const securityStatus = document.getElementById('securityStatus');
        
        if (!setupBtn || !removePinBtn || !changePinBtn || !securityStatus) return;
        
        if (isPinSetup()) {
            setupBtn.style.display = 'none';
            removePinBtn.style.display = 'inline-block';
            changePinBtn.style.display = 'inline-block';
            securityStatus.innerHTML = '<span class="status-success">✅ PIN Protection Enabled</span>';
        } else {
            setupBtn.style.display = 'inline-block';
            removePinBtn.style.display = 'none';
            changePinBtn.style.display = 'none';
            securityStatus.innerHTML = '<span class="status-warning">⚠️ No PIN Protection</span>';
        }
    }

    // Show Forgot PIN options
    async function showForgotPin() {
        const resetTime = getResetTime();
        if (resetTime) {
            const remainingTime = resetTime - Date.now();
            if (remainingTime > 0) {
                showTimerRecovery(remainingTime);
                return;
            } else {
                // Timer expired, allow reset
                removeResetTime();
                removePinHash();
                isUnlocked = true;
                failedPinAttempts = 0;
                hidePinOverlay();
                updateSecurityControls();
                displayDreams();
                
                setTimeout(() => {
                    const container = document.querySelector('.main-content');
                    createInlineMessage('info', 'PIN reset timer has expired. Your PIN has been removed. You can set a new one if desired.', {
                        container: container,
                        position: 'top',
                        duration: 8000
                    });
                }, 100);
                return;
            }
        }

        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'PIN Recovery',
            icon: '🔑',
            message: '<strong>Choose a recovery method:</strong><br><br>' +
                        '<strong>Option 1:</strong> Enter 3 of your dream titles exactly as written<br>' +
                        '<em style="font-size: 0.9em; color: var(--text-secondary);">(Note: "Untitled Dream" entries are not valid)</em><br><br>' +
                        '<strong>Option 2:</strong> Wait 72 hours for automatic reset<br>' +
                        '<em style="font-size: 0.9em; color: var(--text-secondary);">(Your dreams will remain safe)</em>',
            buttons: [
                { text: 'Verify Dream Titles', action: 'start-title-recovery', class: 'btn-primary' },
                { text: 'Start 72hr Timer', action: 'start-timer-recovery', class: 'btn-secondary', id: 'timerBtn' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }

    // Start dream title recovery (Updated for Event Delegation)
    async function startTitleRecovery() {
        const dreams = await loadDreams();
        const validDreams = dreams.filter(d => d.title !== 'Untitled Dream');
        const pinContainer = document.querySelector('#pinOverlay .pin-container');

        if (validDreams.length < 3) {
            renderPinScreen(pinContainer, {
                title: 'PIN Recovery',
                icon: '🔑',
                message: '<span style="color: var(--error-color);">You need at least 3 dreams with custom titles to use this recovery method.</span><br><br>Please use the 72-hour timer option instead.',
                buttons: [
                    { text: 'Start 72hr Timer', action: 'start-timer-recovery', class: 'btn-secondary', id: 'timerBtn' },
                    { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
                ],
                feedbackContainer: false
            });
            return;
        }

        renderPinScreen(pinContainer, {
            title: 'Verify Your Dreams',
            icon: '🔑',
            message: 'Enter exactly 3 of your dream titles:<br><em class="text-sm text-secondary">Must match exactly, including capitalisation</em>',
            inputs: [
                { id: 'recovery1', type: 'text', placeholder: 'Dream title 1', class: 'form-control' },
                { id: 'recovery2', type: 'text', placeholder: 'Dream title 2', class: 'form-control' },
                { id: 'recovery3', type: 'text', placeholder: 'Dream title 3', class: 'form-control' }
            ],
            buttons: [
                { text: 'Verify Titles', action: 'verify-dream-titles', class: 'btn-primary' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }

    // Verify dream titles for recovery - UPDATED for secure hashing
    async function verifyDreamTitles() {
        const title1 = document.getElementById('recovery1').value.trim();
        const title2 = document.getElementById('recovery2').value.trim();
        const title3 = document.getElementById('recovery3').value.trim();
        const feedback = document.getElementById('pinFeedback');
        
        if (!title1 || !title2 || !title3) {
            feedback.innerHTML = '<span style="color: var(--error-color);">Please enter all 3 dream titles</span>';
            return;
        }
        
        const dreams = await loadDreams();
        const validDreams = dreams.filter(d => d.title !== 'Untitled Dream');
        const dreamTitles = validDreams.map(d => d.title);
        
        const titles = [title1, title2, title3];
        const uniqueTitles = [...new Set(titles)];
        
        if (uniqueTitles.length !== 3) {
            feedback.innerHTML = '<span style="color: var(--error-color);">Please enter 3 DIFFERENT dream titles. Each title must be unique.</span>';
            return;
        }
        
        const allValid = titles.every(t => dreamTitles.includes(t));
        
        if (allValid) {
            removePinHash();
            removeResetTime();
            
            const pinContainer = document.querySelector('#pinOverlay .pin-container');
            renderPinScreen(pinContainer, {
                title: 'Recovery Successful',
                icon: '✅',
                message: '<span style="color: var(--success-color);">Your PIN has been removed. You can now set a new secure PIN.</span><br><br>Click below to continue.',
                buttons: [
                    { text: 'Continue', action: 'complete-recovery', class: 'btn-primary' }
                ]
            });
            
            isUnlocked = true;
            failedPinAttempts = 0;
            updateTimerWarning();
        } else {
            feedback.innerHTML = '<span style="color: var(--error-color);">One or more titles did not match. Please try again with exact titles from your dreams.</span>';
        }
    }

    // Start timer recovery
    function startTimerRecovery() {
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'Confirm Timer Reset',
            icon: '⏳',
            message: '<span style="color: var(--error-color); font-weight: 600;">⚠️ Warning</span><br><br>' +
                        'This will start a 72-hour countdown. After 72 hours, your PIN will be automatically removed.<br><br>' +
                        '<span style="color: var(--text-secondary);">Your dreams will remain safe and will not be deleted.</span><br><br>' +
                        'Do you want to continue?',
            buttons: [
                { text: 'Yes, Start Timer', action: 'confirm-start-timer', class: 'btn-primary' },
                { text: 'No, Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ]
        });
    }

    // Confirm and actually start the timer
    function confirmStartTimer() {
        const resetTime = Date.now() + (CONSTANTS.PIN_RESET_HOURS * 60 * 60 * 1000); // hours from now
        storeResetTime(resetTime);
        showTimerRecovery(CONSTANTS.PIN_RESET_HOURS * 60 * 60 * 1000);
        updateTimerWarning(); // Show warning banner
    }

// ================================
// 7. PIN RECOVERY & RESET SYSTEM
// ================================

// TODO: Split into calculateRemainingTime() and updateTimerDisplay() functions
// Update timer warning banner display and calculate remaining time
function updateTimerWarning() {
    const warningBanner = document.getElementById('timerWarning');
    const warningTime = document.getElementById('timerWarningTime');
    
    if (!warningBanner || !warningTime) return;
    
    const resetTime = getResetTime();
    if (resetTime) {
        const remainingMs = resetTime - Date.now();
        if (remainingMs > 0) {
            const hours = Math.ceil(remainingMs / (1000 * 60 * 60));
            const days = Math.ceil(hours / 24);
            
            let timeDisplay = '';
            if (days > 1) {
                timeDisplay = `${days} days remaining`;
            } else if (hours > 1) {
                timeDisplay = `${hours} hours remaining`;
            } else {
                timeDisplay = 'Less than 1 hour remaining';
            }
            
            warningTime.textContent = `(${timeDisplay})`;
            warningBanner.classList.add('active');
        } else {
            warningBanner.classList.remove('active');
        }
    } else {
        warningBanner.classList.remove('active');
    }
}

// Show PIN verification screen for timer cancellation
// Renders PIN entry interface for reset timer cancellation
function cancelResetTimer() {
        const pinOverlay = document.getElementById('pinOverlay');
        const pinContainer = pinOverlay.querySelector('.pin-container');
        
        renderPinScreen(pinContainer, {
            title: 'Cancel PIN Reset',
            icon: '⚠️',
            message: 'To cancel the pending PIN reset, please enter your current PIN.',
            inputs: [
                { id: 'pinInput', type: 'password', placeholder: 'Enter current PIN', class: 'pin-input', maxLength: 6 }
            ],
            buttons: [
                { text: 'Confirm Cancellation', action: 'confirm-cancel-timer', class: 'btn-primary' },
                { text: 'Back', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
        
        pinOverlay.style.display = 'flex';
    }

    // Actually cancel the timer - NOW requires PIN verification
    async function confirmCancelTimer() {
        const enteredPin = document.getElementById('pinInput').value;
        if (!enteredPin) {
            showMessage('error', 'Please enter your PIN.');
            return;
        }

        const storedData = getStoredPinData();
        const isValid = await verifyPinHash(enteredPin, storedData);

        if (isValid) {
            removeResetTime();
            updateTimerWarning();
            hidePinOverlay();

            // Show a success message in the main content area
            const container = document.querySelector('.main-content');
            if (container) {
                createInlineMessage('success', 'PIN reset timer has been successfully cancelled.', {
                    container: document.querySelector('.container'),
                    position: 'top',
                    duration: 5000
                });
            }
        } else {
            showMessage('error', 'Incorrect PIN. The reset timer remains active.');
        }
    }

    // Show timer recovery status
    function showTimerRecovery(remainingMs) {
        const hours = Math.ceil(remainingMs / (1000 * 60 * 60));
        const days = Math.ceil(hours / 24);
        
        let timeDisplay = '';
        if (days > 1) {
            timeDisplay = `${days} days`;
        } else if (hours > 1) {
            timeDisplay = `${hours} hours`;
        } else {
            timeDisplay = 'Less than 1 hour';
        }

        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'Recovery Timer Active',
            icon: '⏳',
            message: `PIN reset timer is active.<br><br><strong>Time remaining: ${timeDisplay}</strong><br><br><em style="font-size: 0.9em; color: var(--text-secondary);">Check back later, or try the dream title recovery method instead.</em>`,
            buttons: [
                { text: 'Try Title Recovery', action: 'start-title-recovery', class: 'btn-primary' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ]
        });
    }

    // Complete recovery process
    async function completeRecovery() {
        resetPinOverlay();
        hidePinOverlay();
        
        isUnlocked = true;
        isAppLocked = false;
        
        console.log('PIN overlay recovery complete - showing all tabs');
        
        showAllTabButtons();
        
        updateSecurityControls();
        updateTimerWarning();
        await displayDreams();
        
        const container = document.querySelector('.main-content');
        if (container) {
            createInlineMessage('success', 'Recovery complete! You can now set a new PIN from the security controls if desired.', {
                container: container,
                position: 'top',
                duration: 5000
            });
        }
    }

// ================================
// 5. PIN VERIFICATION & AUTHENTICATION
// ================================

// Verify entered PIN against stored hash with format compatibility
// Handles both legacy (simple hash) and secure (PBKDF2) formats
async function verifyPinHash(enteredPin, storedData) {
    if (!storedData || !enteredPin) return false;
    
    try {
        // Check for legacy format first
        if (isLegacyPinFormat(storedData)) {
            const legacyHash = hashPinLegacy(enteredPin);
            return legacyHash === storedData;
        }
        
        // Handle secure format
        const stored = JSON.parse(storedData);
        if (!stored.hash || !stored.salt) return false;
        
        // Convert hex salt back to Uint8Array
        const saltArray = [];
        for (let i = 0; i < stored.salt.length; i += 2) {
            saltArray.push(parseInt(stored.salt.substr(i, 2), 16));
        }
        const salt = new Uint8Array(saltArray);
        
        // Hash the entered PIN with the stored salt
        const hashedEntered = await hashPinSecure(enteredPin, salt);
        return hashedEntered.hash === stored.hash;
        
    } catch (error) {
        console.error('PIN verification error:', error);
        return false;
    }
}

// ================================
// 6. FALLBACK STORAGE SYSTEM
// ================================

// PIN storage with fallback system for when IndexedDB unavailable
let pinStorage = {
    hash: null,
    resetTime: null
};

// Check if PIN is set up using fallback storage system
// Prioritizes localStorage but falls back to memory storage
function isPinSetup() {
    if (isLocalStorageAvailable()) {
        return localStorage.getItem('dreamJournalPinHash') !== null;
    }
    return pinStorage.hash !== null;
}

// Store PIN hash securely using PBKDF2 with fallback storage system
// Uses secure hashing format with salt and returns success status
async function storePinHash(pin) {
        if (!pin) {
            return false;
        }
        
        try {
            // Use secure hashing
            const { hash, salt } = await hashPinSecure(pin);
            const secureData = JSON.stringify({ hash, salt, version: 'secure' });
            
            // Try localStorage first
            if (isLocalStorageAvailable()) {
                try {
                    localStorage.setItem('dreamJournalPinHash', secureData);
                    return true;
                } catch (error) {
                    console.error('Error storing secure PIN hash:', error);
                    // Fall through to memory storage
                }
            }
            
            // Fallback to memory storage
            pinStorage.hash = secureData;
            return true;
        } catch (error) {
            console.error('Error storing secure PIN hash:', error);
            return false;
        }
    }

// Get stored PIN hash data from fallback storage system
// Returns stored PIN data for verification or null if not found
function getStoredPinData() {
        // Try localStorage first
        if (isLocalStorageAvailable()) {
            const data = localStorage.getItem('dreamJournalPinHash');
            if (data) return data;
        }
        
        // Fallback to memory storage
        return pinStorage.hash;
    }

    // Verify PIN against stored hash - UPDATED to handle both legacy and secure formats
    async function verifyPinHash(enteredPin, storedData) {
        if (!storedData) return false;
        
        try {
            if (isLegacyPinFormat(storedData)) {
                // Legacy format - use simple hash comparison
                const legacyHash = hashPinLegacy(enteredPin);
                return legacyHash === storedData;
            } else {
                // Secure format - parse and verify
                const { hash: storedHash, salt: storedSaltHex } = JSON.parse(storedData);
                
                // Convert salt from hex back to Uint8Array
                const saltArray = new Uint8Array(storedSaltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
                
                // Hash the entered PIN with the stored salt
                const { hash: enteredHash } = await hashPinSecure(enteredPin, saltArray);
                
                return enteredHash === storedHash;
            }
        } catch (error) {
            console.error('Error verifying PIN:', error);
            return false;
        }
    }

    // Remove PIN hash (with fallback storage) - works with both legacy and secure formats
    function removePinHash() {
        // Remove from localStorage if available
        if (isLocalStorageAvailable()) {
            localStorage.removeItem('dreamJournalPinHash');
        }
        
        // Remove from memory storage
        pinStorage.hash = null;
    }

    // Store reset time (with fallback storage)
    function storeResetTime(time) {
        // Try localStorage first
        if (isLocalStorageAvailable()) {
            try {
                localStorage.setItem('dreamJournalPinResetTime', time.toString());
                return true;
            } catch (error) {
                console.error('storeResetTime: Failed to save to localStorage:', error);
            }
        }
        
        // Fallback to memory storage
        pinStorage.resetTime = time;
        return true;
    }

    // Get reset time (with fallback storage)
    function getResetTime() {
        // Try localStorage first
        if (isLocalStorageAvailable()) {
            const time = localStorage.getItem('dreamJournalPinResetTime');
            if (time) return parseInt(time);
        }
        
        // Fallback to memory storage
        return pinStorage.resetTime;
    }

    // Remove reset time (with fallback storage)
    function removeResetTime() {
        // Remove from localStorage if available
        if (isLocalStorageAvailable()) {
            localStorage.removeItem('dreamJournalPinResetTime');
        }
        
        // Remove from memory storage
        pinStorage.resetTime = null;
    }

// ================================
// 8. UI CONTROLS & STATE MANAGEMENT 
// ================================

// TODO: Split into updateButtonStates(), updateButtonText(), and validateAppState() functions
// Update security controls visibility and state across all UI locations
// Note: Lock button is ALWAYS visible for better UX - logic handled in toggleLock()
function updateSecurityControls() {
        const lockBtn = document.getElementById('lockBtn');
        const lockBtnSettings = document.getElementById('lockBtnSettings');
        const setupBtnSettings = document.getElementById('setupPinBtnSettings');
        
        // Always show the lock button - much simpler UX!
        if (lockBtn) {
            lockBtn.style.display = 'inline-block';
            if (isPinSetup()) {
                if (isUnlocked && !isAppLocked) {
                    lockBtn.textContent = '🔒 Lock Journal';
                    lockBtn.title = 'Lock your journal with your PIN to keep dreams private';
                } else {
                    lockBtn.textContent = '🔓 Unlock Journal'; // This case shouldn't happen much since we use lock screen
                    lockBtn.title = 'Unlock your journal by entering your PIN';
                }
            } else {
                lockBtn.textContent = '🔒 Setup & Lock';
                lockBtn.title = 'Set up a PIN to secure your dreams, then lock the journal';
            }
        }
        
        // Always show settings lock button too
        if (lockBtnSettings) {
            lockBtnSettings.style.display = 'inline-block';
            if (isPinSetup()) {
                if (isUnlocked && !isAppLocked) {
                    lockBtnSettings.textContent = '🔒 Lock Journal';
                    lockBtnSettings.title = 'Lock your journal with your PIN to keep dreams private';
                } else {
                    lockBtnSettings.textContent = '🔓 Unlock Journal';
                    lockBtnSettings.title = 'Unlock your journal by entering your PIN';
                }
            } else {
                lockBtnSettings.textContent = '🔒 Setup & Lock';
                lockBtnSettings.title = 'Set up a PIN to secure your dreams, then lock the journal';
            }
        }
        
        // Update setup button text (only exists in settings)
        if (setupBtnSettings) {
            setupBtnSettings.textContent = isPinSetup() ? '⚙️ Change/Remove PIN' : '⚙️ Setup PIN';
        }
        
        // Ensure correct app state
        if (!isPinSetup()) {
            isUnlocked = true;
            isAppLocked = false;
        }
    }

    // Show Remove PIN option
    function showRemovePin() {
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'Remove PIN Protection',
            icon: '⚠️',
            message: 'Enter your current PIN to remove protection. Your dreams will no longer be secured.',
            inputs: [
                { id: 'pinInput', type: 'password', placeholder: 'Enter current PIN', class: 'pin-input', maxLength: 6 }
            ],
            buttons: [
                { text: 'Remove PIN', action: 'confirm-remove-pin', class: 'btn-primary' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
        document.getElementById('pinOverlay').style.display = 'flex';
    }

    // Execute PIN removal after verification
    async function executePinRemoval() {
        try {
            // Remove the PIN
            removePinHash();

            const pinContainer = document.querySelector('#pinOverlay .pin-container');
            renderPinScreen(pinContainer, {
                title: 'PIN Removed',
                icon: '✅',
                message: 'PIN protection has been removed. Your dreams are no longer secured.',
                buttons: [
                    { text: 'Close', action: 'complete-pin-removal', class: 'btn-primary' }
                ]
            });

            isUnlocked = true;
        } catch (error) {
            console.error('Error removing PIN:', error);
            showMessage('error', 'Error removing PIN. Please try again.');
        }
    }

    // Confirm PIN removal - UPDATED for secure hashing
    async function confirmRemovePin() {
        const enteredPin = document.getElementById('pinInput').value;
        
        if (!enteredPin) {
            showMessage('error', 'Please enter your current PIN');
            return;
        }
        
        try {
            const storedData = getStoredPinData();
            const isValid = await verifyPinHash(enteredPin, storedData);
            
            if (!isValid) {
                const message = document.getElementById('pinMessage');
                message.textContent = 'Incorrect PIN. Please try again.';
                message.style.color = 'var(--error-color)';
                document.getElementById('pinInput').value = '';
                return;
            }
            
            await executePinRemoval();
            
        } catch (error) {
            console.error('Error removing PIN:', error);
            showMessage('error', 'Error removing PIN. Please try again.');
        }
    }

    // Complete PIN removal and close overlay
    async function completePinRemoval() {
        resetPinOverlay();
        hidePinOverlay();
        
        // Reset failed attempts since PIN removal was successful
        failedPinAttempts = 0;
        
        // PIN removed - unlock the app
        isUnlocked = true;
        isAppLocked = false;
        
        console.log('PIN removal complete - ensuring tabs are visible');
        
        // Ensure all tabs are visible (PIN is removed, no need to hide)
        showAllTabButtons();
        
        updateSecurityControls();
        await displayDreams();
    }

    // Show inline message
    function showMessage(type, message, elementId = null) {
        // Clear all messages first
        document.getElementById('pinFeedback').style.display = 'none';
        document.getElementById('pinSuccess').style.display = 'none';
        document.getElementById('pinInfo').style.display = 'none';
        
        let element;
        if (elementId) {
            element = document.getElementById(elementId);
        } else {
            switch(type) {
                case 'error': element = document.getElementById('pinFeedback'); break;
                case 'success': element = document.getElementById('pinSuccess'); break;
                case 'info': element = document.getElementById('pinInfo'); break;
            }
        }
        
        if (element) {
            element.textContent = message;
            element.className = `notification-message ${type}`;
            element.style.display = 'block';
            
            // Auto-hide success messages after duration
            if (type === 'success') {
                setTimeout(() => {
                    element.style.display = 'none';
                }, CONSTANTS.MESSAGE_DURATION_MEDIUM);
            }
        }
    }

// ================================
// 9. LOCK SCREEN INTERFACE SYSTEM
// ================================

// Verify PIN entered on lock screen tab
// Handles PIN verification and unlocking transition from lock screen
async function verifyLockScreenPin() {
        const pinInput = document.getElementById('lockScreenPinInput');
        if (!pinInput) return;
        
        const enteredPin = pinInput.value;
        if (!enteredPin) {
            showLockScreenMessage('error', 'Please enter a PIN');
            return;
        }
        
        try {
            const storedData = getStoredPinData();
            const isValid = await verifyPinHash(enteredPin, storedData);
            
            if (isValid) {
                showLockScreenMessage('success', 'PIN verified! Unlocking journal...');
                
                failedPinAttempts = 0;
                isUnlocked = true;
                isAppLocked = false;
                
                console.log('Lock screen unlock successful - showing all tabs');
                
                pinInput.value = '';
                
                setTimeout(() => {
                    showAllTabButtons();
                    const targetTab = (preLockActiveTab === 'lock') ? 'journal' : preLockActiveTab;
                    switchAppTab(targetTab);
                    updateSecurityControls();
                }, 200);
                
            } else {
                failedPinAttempts++;
                pinInput.value = '';
                if (failedPinAttempts >= CONSTANTS.FAILED_PIN_ATTEMPT_LIMIT) {
                    showLockScreenMessage('error', 'Incorrect PIN. Use "Forgot PIN?" if needed.');
                } else {
                    showLockScreenMessage('error', 'Incorrect PIN. Please try again.');
                }
            }
        } catch (error) {
            console.error('Lock screen PIN verification error:', error);
            showLockScreenMessage('error', 'PIN verification failed. Please try again.');
            pinInput.value = '';
        }
    }
    
    // Show forgot PIN options on lock screen
    async function showLockScreenForgotPin() {
        const resetTime = getResetTime();
        if (resetTime) {
            const remainingTime = resetTime - Date.now();
            if (remainingTime > 0) {
                const hours = Math.ceil(remainingTime / (1000 * 60 * 60));
                const days = Math.ceil(hours / 24);
                let timeDisplay = days > 1 ? `${days} days` : hours > 1 ? `${hours} hours` : 'Less than 1 hour';
                showLockScreenMessage('info', `Recovery timer active. Time remaining: ${timeDisplay}. Press "Forgot PIN?" again when timer expires to unlock.`);
            } else {
                removeResetTime();
                removePinHash();
                isUnlocked = true;
                isAppLocked = false;
                switchAppTab(preLockActiveTab);
                updateSecurityControls();
            }
            return;
        }
        
        const dreams = await loadDreams();
        const validDreams = dreams.filter(d => d.title !== 'Untitled Dream');
        const lockCard = document.querySelector('#lockTab > div > div');

        if (lockCard) {
            renderPinScreen(lockCard, {
                title: 'PIN Recovery',
                icon: '🔑',
                message: `
                    <strong>Choose a recovery method to regain access:</strong>
                    <div class="card-sm mb-md text-left mt-lg">
                        <h4 class="text-primary mb-sm">📝 Dream Title Verification</h4>
                        <p class="text-secondary text-sm mb-sm">Enter 3 of your dream titles exactly as written (case-sensitive)</p>
                        <button data-action="start-lock-screen-title-recovery" class="btn btn-primary btn-small" ${validDreams.length < 3 ? 'disabled' : ''}>Verify Dream Titles</button>
                        ${validDreams.length < 3 ? `<p class="text-xs text-warning mt-sm">You need at least 3 dreams with custom titles to use this method. You have ${validDreams.length}.</p>` : ''}
                    </div>
                    <div class="card-sm mb-lg text-left">
                        <h4 class="text-warning mb-sm">⏰ 72-Hour Timer Reset</h4>
                        <p class="text-secondary text-sm mb-sm">Start a timer that will automatically remove your PIN after 72 hours</p>
                        <button data-action="start-lock-screen-timer-recovery" class="btn btn-primary btn-small">Start Timer Reset</button>
                    </div>
                `,
                buttons: [
                    { text: '← Back to PIN Entry', action: 'return-to-lock-screen', class: 'btn-secondary' }
                ],
                feedbackContainer: true
            });
        } else {
            showLockScreenMessage('error', 'Error accessing recovery options');
        }
    }
    
    // Show message on lock screen
    function showLockScreenMessage(type, message) {
        const feedbackDiv = document.getElementById('lockScreenFeedback') || document.getElementById('pinFeedback');
        if (!feedbackDiv) return;
        
        feedbackDiv.textContent = message;
        feedbackDiv.style.display = 'block';
        feedbackDiv.className = `notification-message ${type}`;
        
        if (type === 'success') {
            setTimeout(() => { if (feedbackDiv) feedbackDiv.style.display = 'none'; }, CONSTANTS.MESSAGE_DURATION_MEDIUM);
        }
    }
    
    // Return to main lock screen
    function returnToLockScreen() {
        const lockTab = document.getElementById('lockTab');
        if (!lockTab) {
            // Fallback in case tab doesn't exist, though it should
            switchAppTab('lock');
            return;
        }

        // Check if there's an active timer to show instructional text
        const resetTime = getResetTime();
        let timerInstructions = '';

        if (resetTime) {
            const remainingTime = resetTime - Date.now();
            if (remainingTime > 0) {
                const hours = Math.ceil(remainingTime / (1000 * 60 * 60));
                const days = Math.ceil(hours / 24);

                let timeDisplay = '';
                if (days > 1) {
                    timeDisplay = `${days} days`;
                } else if (hours > 1) {
                    timeDisplay = `${hours} hours`;
                } else {
                    timeDisplay = 'Less than 1 hour';
                }

                timerInstructions = `
                    <div class="message-base message-info mb-md text-sm">
                        ⏰ Recovery timer active (${timeDisplay} remaining)<br>
                        <span class="text-sm font-normal">Press "Forgot PIN?" again when timer expires to unlock</span>
                    </div>
                `;
            }
        }

        lockTab.innerHTML = `
            <div class="flex-center" style="min-height: 400px;">
                <div class="card-elevated card-lg text-center max-w-sm w-full shadow-lg">
                    <div class="text-4xl mb-lg">🔒</div>
                    <h2 class="text-primary mb-md text-xl">Journal Locked</h2>
                    <p class="text-secondary mb-lg line-height-relaxed">
                        Your dream journal is protected with a PIN. Enter your PIN to access your dreams and all app features.
                    </p>
                    ${timerInstructions}
                    <input type="password" id="lockScreenPinInput" placeholder="Enter PIN" maxlength="6" class="input-pin w-full mb-lg">
                    <div class="flex-center gap-sm flex-wrap">
                        <button data-action="verify-lock-screen-pin" class="btn btn-primary">🔓 Unlock Journal</button>
                        <button data-action="show-lock-screen-forgot-pin" class="btn btn-secondary">Forgot PIN?</button>
                    </div>
                    <div id="lockScreenFeedback" class="mt-md p-sm feedback-container"></div>
                </div>
            </div>
        `;

        // Ensure the tab is active and focus is set
        switchAppTab('lock');
    }
    
    // Start dream title recovery on lock screen
    async function startLockScreenTitleRecovery() {
        const lockCard = document.querySelector('#lockTab > div > div');
        renderPinScreen(lockCard, {
            title: 'Verify Dream Titles',
            icon: '📝',
            message: 'Enter exactly 3 of your dream titles as they appear in your journal.<br><em class="text-sm">Must match exactly, including capitalization</em>',
            inputs: [
                { id: 'recovery1', type: 'text', placeholder: 'Dream title 1', class: 'form-control' },
                { id: 'recovery2', type: 'text', placeholder: 'Dream title 2', class: 'form-control' },
                { id: 'recovery3', type: 'text', placeholder: 'Dream title 3', class: 'form-control' }
            ],
            buttons: [
                { text: 'Verify Titles', action: 'verify-lock-screen-dream-titles', class: 'btn-primary' },
                { text: '← Back', action: 'show-lock-screen-forgot-pin', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }
    
    // Verify dream titles on lock screen
    async function verifyLockScreenDreamTitles() {
        const title1 = document.getElementById('recovery1')?.value.trim();
        const title2 = document.getElementById('recovery2')?.value.trim();
        const title3 = document.getElementById('recovery3')?.value.trim();
        
        if (!title1 || !title2 || !title3) {
            showLockScreenMessage('error', 'Please enter all 3 dream titles');
            return;
        }
        
        const dreams = await loadDreams();
        const dreamTitles = dreams.filter(d => d.title !== 'Untitled Dream').map(d => d.title);
        
        const titles = [title1, title2, title3];
        const uniqueTitles = [...new Set(titles)];
        
        if (uniqueTitles.length !== 3) {
            showLockScreenMessage('error', 'Please enter 3 DIFFERENT dream titles. Each title must be unique.');
            return;
        }
        
        if (titles.every(t => dreamTitles.includes(t))) {
            removePinHash();
            removeResetTime();
            showLockScreenMessage('success', 'Recovery successful! Your PIN has been removed. Unlocking journal...');
            isUnlocked = true;
            isAppLocked = false;
            failedPinAttempts = 0;
            updateTimerWarning();
            
            setTimeout(() => {
                showAllTabButtons();
                const targetTab = (preLockActiveTab === 'lock') ? 'journal' : preLockActiveTab;
                switchAppTab(targetTab);
                updateSecurityControls();
            }, 2000);
        } else {
            showLockScreenMessage('error', 'One or more titles did not match. Please try again.');
            document.getElementById('recovery1').value = '';
            document.getElementById('recovery2').value = '';
            document.getElementById('recovery3').value = '';
            document.getElementById('recovery1').focus();
        }
    }
    
    // Start timer recovery on lock screen
    function startLockScreenTimerRecovery() {
        const lockCard = document.querySelector('#lockTab > div > div');
        renderPinScreen(lockCard, {
            title: '72-Hour Timer Reset',
            icon: '⏰',
            message: `
                <div class="message-base message-warning mb-lg text-left">
                    <h4 class="mb-sm">⚠️ Important Warning</h4>
                    <p class="mb-sm line-height-relaxed">This will start a 72-hour countdown. After the timer expires, your PIN will be automatically removed.</p>
                    <p class="font-semibold" style="margin: 0;">Your dreams will remain safe and will not be deleted.</p>
                </div>
                <p class="text-secondary mb-lg line-height-relaxed">Do you want to start the 72-hour recovery timer?</p>`,
            buttons: [
                { text: 'Start Timer', action: 'confirm-lock-screen-timer', class: 'btn-primary' },
                { text: '← Cancel', action: 'show-lock-screen-forgot-pin', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }
    
    // Confirm timer recovery on lock screen
    function confirmLockScreenTimer() {
        const resetTime = Date.now() + (CONSTANTS.PIN_RESET_HOURS * 60 * 60 * 1000);
        storeResetTime(resetTime);
        updateTimerWarning();
        showLockScreenMessage('success', '72-hour recovery timer started! You can check back later or use dream title recovery.');
        setTimeout(returnToLockScreen, 3000);
    }

// ================================
// 10. PIN OVERLAY MANAGEMENT
// ================================

// Show PIN overlay for authentication or setup
// Resets to default state and handles focus management
function showPinOverlay() {
        if (isUnlocked && isPinSetup()) return;
        
        failedPinAttempts = 0;
        resetPinOverlay(); // Reset to default state
        document.getElementById('pinOverlay').style.display = 'flex';
        setTimeout(() => {
            const pinInput = document.getElementById('pinInput');
            if (pinInput) pinInput.focus();
        }, CONSTANTS.FOCUS_DELAY_MS);
    }

    // Hide PIN overlay
    function hidePinOverlay() {
        document.getElementById('pinOverlay').style.display = 'none';
        resetPinOverlay();
    }

    // Show PIN setup
    function showPinSetup() {
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        const isChangingPin = isPinSetup();

        renderPinScreen(pinContainer, {
            title: isChangingPin ? 'Change/Remove PIN' : 'Setup PIN',
            icon: '⚙️',
            message: isChangingPin ? 'Enter your current PIN to change it.' : 'Create a 4-6 digit PIN to protect your dreams.',
            inputs: [
                { id: 'pinInput', type: 'password', placeholder: isChangingPin ? 'Current PIN' : 'New PIN (4-6 digits)', class: 'pin-input', maxLength: 6 }
            ],
            buttons: [
                { text: isChangingPin ? 'Verify Current PIN' : 'Continue', action: 'process-pin-setup', class: 'btn-primary' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
        document.getElementById('pinOverlay').style.display = 'flex';
    }

// ================================
// 11. PIN SETUP & CHANGE WORKFLOW
// ================================

// Process PIN setup/change request with validation
// Handles both new PIN creation and PIN changes
async function setupPin() {
        const enteredPin = document.getElementById('pinInput').value;
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        
        if (!enteredPin || enteredPin.length < CONSTANTS.PIN_MIN_LENGTH || enteredPin.length > CONSTANTS.PIN_MAX_LENGTH || !/^\d+$/.test(enteredPin)) {
            showMessage('error', `PIN must be ${CONSTANTS.PIN_MIN_LENGTH}-${CONSTANTS.PIN_MAX_LENGTH} digits.`);
            document.getElementById('pinInput').value = '';
            return;
        }
        
        if (isPinSetup()) {
            const storedData = getStoredPinData();
            const isValid = await verifyPinHash(enteredPin, storedData);
            if (!isValid) {
                showMessage('error', 'Current PIN is incorrect. Please try again.');
                document.getElementById('pinInput').value = '';
                return;
            }
            renderPinScreen(pinContainer, {
                title: 'Change or Remove PIN',
                icon: '⚙️',
                message: 'Your current PIN is correct. What would you like to do?',
                buttons: [
                    { text: 'Set New PIN', action: 'show-set-new-pin-screen', class: 'btn-primary' },
                    { text: 'Remove PIN', action: 'execute-pin-removal', class: 'btn-delete' },
                    { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
                ],
                feedbackContainer: false
            });
        } else {
            window.tempNewPin = enteredPin;
            renderPinScreen(pinContainer, {
                title: 'Confirm PIN',
                icon: '⚙️',
                message: 'Enter the same PIN again to confirm.',
                inputs: [ { id: 'pinInput', type: 'password', placeholder: 'Confirm PIN', class: 'pin-input', maxLength: 6 } ],
                buttons: [
                    { text: 'Setup PIN', action: 'confirm-new-pin', class: 'btn-primary' },
                    { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
                ],
                feedbackContainer: true
            });
        }
    }

    // Step 2 of change PIN: Enter new PIN
    function showSetNewPinScreen() {
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'Enter New PIN',
            icon: '⚙️',
            message: 'Enter your new 4-6 digit PIN.',
            inputs: [ { id: 'pinInput', type: 'password', placeholder: 'New PIN (4-6 digits)', class: 'pin-input', maxLength: 6 } ],
            buttons: [
                { text: 'Continue', action: 'setup-new-pin', class: 'btn-primary' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }

    function setupNewPin() {
        const enteredPin = document.getElementById('pinInput').value;
        if (!enteredPin || enteredPin.length < CONSTANTS.PIN_MIN_LENGTH || enteredPin.length > CONSTANTS.PIN_MAX_LENGTH || !/^\d+$/.test(enteredPin)) {
            showMessage('error', `PIN must be ${CONSTANTS.PIN_MIN_LENGTH}-${CONSTANTS.PIN_MAX_LENGTH} digits.`);
            document.getElementById('pinInput').value = '';
            return;
        }
        
        window.tempNewPin = enteredPin;
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        renderPinScreen(pinContainer, {
            title: 'Confirm New PIN',
            icon: '⚙️',
            message: 'Enter the same PIN again to confirm.',
            inputs: [ { id: 'pinInput', type: 'password', placeholder: 'Confirm new PIN', class: 'pin-input', maxLength: 6 } ],
            buttons: [
                { text: 'Change PIN', action: 'confirm-new-pin', class: 'btn-primary' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary' }
            ],
            feedbackContainer: true
        });
    }

    // Final step: Confirm the new PIN - UPDATED for secure hashing
    async function confirmNewPin() {
        const enteredPin = document.getElementById('pinInput').value;
        if (enteredPin !== window.tempNewPin) {
            showMessage('error', 'PINs do not match. Please start over.');
            setTimeout(() => {
                resetPinOverlay();
                showPinSetup();
            }, 2000);
            return;
        }
        
        try {
            const success = await storePinHash(window.tempNewPin);
            if (success) {
                const pinContainer = document.querySelector('#pinOverlay .pin-container');
                renderPinScreen(pinContainer, {
                    title: 'PIN Setup Complete',
                    icon: '✅',
                    message: `Secure PIN has been set successfully! Your dreams are now protected${isLocalStorageAvailable() ? ' with advanced encryption' : ' using memory storage (PIN will reset on refresh)'}.`,
                    buttons: [
                        { text: 'Close', action: 'complete-pin-setup', class: 'btn-primary' }
                    ]
                });
                delete window.tempNewPin;
                isUnlocked = true;
            } else {
                showMessage('error', 'Error: Failed to save secure PIN. Please try again.');
            }
        } catch (error) {
            console.error('Error setting up secure PIN:', error);
            showMessage('error', 'Error: Failed to setup secure PIN. Please try again.');
        }
    }

    // Complete PIN setup and close overlay
    async function completePinSetup() {
        resetPinOverlay();
        hidePinOverlay();
        failedPinAttempts = 0;
        isUnlocked = true;
        isAppLocked = false;
        console.log('PIN setup complete - ensuring tabs are visible');
        showAllTabButtons();
        updateSecurityControls();
        await displayDreams();
    }

    // Reset PIN overlay to default state
    function resetPinOverlay() {
        const pinContainer = document.querySelector('#pinOverlay .pin-container');
        if (!pinContainer) return;
        
        failedPinAttempts = 0;
        
        renderPinScreen(pinContainer, {
            title: 'Enter PIN',
            icon: '🔒',
            message: 'Your dreams are protected. Enter your PIN to access them.',
            inputs: [ { id: 'pinInput', type: 'password', placeholder: 'Enter PIN', class: 'pin-input', maxLength: 6 } ],
            buttons: [
                { text: 'Unlock', action: 'verify-pin', class: 'btn-primary', id: 'pinMainBtn' },
                { text: 'Cancel', action: 'hide-pin-overlay', class: 'btn-secondary', id: 'cancelPinBtn' }
            ],
            links: [
                { text: 'Setup new PIN', action: 'show-pin-setup', id: 'pinSetupLink', style: isPinSetup() ? 'display:none' : '' },
                { text: 'Remove PIN protection', action: 'show-remove-pin', id: 'removePinLink', style: !isPinSetup() || !isUnlocked ? 'display:none' : '' },
                { text: 'Forgot PIN?', action: 'show-forgot-pin', id: 'forgotPinLink', style: 'display:none' }
            ],
            feedbackContainer: true
        });
    }

    // Toggle lock state
    async function toggleLock() {
        if (!isPinSetup()) {
            const container = document.querySelector('.main-content');
            if (container) {
                createInlineMessage('info', 'First, set up a PIN to protect your dreams, then you can lock your journal.', {
                    container: container,
                    position: 'top',
                    duration: 4000
                });
            }
            showPinSetup();
            return;
        }
        
        if (isUnlocked && !isAppLocked) {
            isUnlocked = false;
            isAppLocked = true;
            preLockActiveTab = activeAppTab;
            console.log('Locking app - hiding other tabs');
            hideAllTabButtons();
            switchAppTab('lock');
            updateSecurityControls();
        } else {
            showPinOverlay();
        }
    }

    
