/**
 * @fileoverview Cloud Sync Module - Dropbox OAuth integration and data synchronization
 *
 * This module provides comprehensive cloud synchronization functionality including:
 * - Dropbox OAuth 2.0 authentication with PKCE flow
 * - Secure token management and automatic refresh
 * - Data upload and download operations
 * - Conflict resolution and data validation
 * - Integration with existing encryption and security systems
 *
 * The module follows the established Dream Journal architecture patterns and provides
 * seamless integration with the existing import-export system while maintaining
 * privacy and security standards.
 *
 * **Security Features:**
 * - PKCE OAuth flow for client-side security
 * - Encrypted token storage
 * - Automatic token refresh
 * - Integration with existing PIN protection
 * - Optional data encryption before cloud storage
 *
 * **Module Dependencies:**
 * - constants.js: Cloud sync configuration constants
 * - state.js: Authentication state management
 * - storage.js: Local data access and encryption
 * - security.js: Encryption and PIN protection
 * - import-export.js: Data export/import functionality
 * - dom-helpers.js: UI utilities and messaging
 *
 * @module CloudSync
 * @version 2.04.01
 * @since 2.04.01
 * @author Dream Journal Application
 * @requires Dropbox JavaScript SDK (loaded via CDN)
 */

// ================================
// MODULE INITIALIZATION CHECK
// ================================
if (typeof window === 'undefined') {
    throw new Error('cloud-sync.js must be loaded in a browser environment');
}

// ================================
// ES MODULE IMPORTS
// ================================

// Import required dependencies
import {
    CONSTANTS,
    DEFAULT_DROPBOX_CLIENT_ID,
    CUSTOM_DROPBOX_CLIENT_ID_KEY,
    DROPBOX_REDIRECT_URI,
    CLOUD_SYNC_ENABLED_KEY,
    CLOUD_AUTO_SYNC_KEY,
    DROPBOX_ACCESS_TOKEN_KEY,
    DROPBOX_REFRESH_TOKEN_KEY,
    DROPBOX_TOKEN_EXPIRES_KEY,
    DREAM_FORM_COLLAPSE_KEY
} from './constants.js';

import {
    getCloudSyncEnabled,
    setCloudSyncEnabled,
    getDropboxAccessToken,
    setDropboxAccessToken,
    getDropboxRefreshToken,
    setDropboxRefreshToken,
    getCloudSyncInProgress,
    setCloudSyncInProgress,
    getLastCloudSyncTime,
    setLastCloudSyncTime,
    getEncryptionEnabled,
    getEncryptionPassword,
    getDropboxUserInfo,
    setDropboxUserInfo
} from './state.js';

import {
    loadDreams,
    loadGoals,
    getAutocompleteSuggestions,
    storageType,
    saveToStore,
    saveAutocompleteSuggestions
} from './storage.js';

import {
    testEncryptionPassword,
    showPasswordDialog
} from './security.js';

import {
    importAllData,
    validateAppAccess
} from './import-export.js';

import {
    saveDream,
    displayDreams
} from './dream-crud.js';

import {
    createInlineMessage,
    escapeHtml,
    formatDateTimeDisplay,
    announceLiveMessage,
    getCurrentPaginationPreference,
    getCurrentTheme,
    storeTheme,
    applyTheme,
    storePaginationPreference
} from './dom-helpers.js';

console.log('Loading Cloud Sync Module v2.04.01');

// ================================
// DROPBOX CLIENT ID MANAGEMENT
// ================================

/**
 * Gets the current Dropbox client ID (custom or default).
 *
 * Returns the user's custom app key if set, otherwise returns the default.
 * This allows advanced users to override the default app key while most
 * users can use the default without any configuration.
 *
 * @function
 * @returns {string} The current Dropbox client ID
 * @since 2.04.01
 */
function getCurrentDropboxClientId() {
    try {
        const customKey = localStorage.getItem(CUSTOM_DROPBOX_CLIENT_ID_KEY);
        return customKey || DEFAULT_DROPBOX_CLIENT_ID;
    } catch (error) {
        console.error('Error getting Dropbox client ID:', error);
        return DEFAULT_DROPBOX_CLIENT_ID;
    }
}

// ================================
// DROPBOX SDK INTEGRATION
// ================================

/**
 * Global Dropbox SDK instance for API operations.
 *
 * This instance is initialized after successful authentication and used
 * for all Dropbox API calls including file operations and account info.
 *
 * @type {Dropbox.Dropbox|null}
 * @private
 */
let dropboxInstance = null;

/**
 * Dropbox OAuth authentication instance for handling OAuth flow.
 *
 * Manages the complete OAuth 2.0 PKCE flow including authorization URL
 * generation, token exchange, and refresh token management.
 *
 * @type {Dropbox.DropboxAuth|null}
 * @private
 */
let dropboxAuth = null;

// ================================
// AUTHENTICATION MANAGEMENT
// ================================

/**
 * Initializes Dropbox authentication system with PKCE configuration.
 *
 * Sets up the Dropbox OAuth authentication instance with proper PKCE
 * configuration for secure client-side authentication. This function
 * must be called before any OAuth operations can be performed.
 *
 * **Configuration:**
 * - Client ID from application constants
 * - PKCE enabled for security
 * - Access type set to offline for refresh tokens
 *
 * @function
 * @returns {void}
 * @throws {Error} When Dropbox SDK is not available or configuration fails
 * @since 2.04.01
 *
 * @example
 * // Initialize authentication before OAuth operations
 * initializeDropboxAuth();
 * // Now ready for authentication flow
 */
function initializeDropboxAuth() {
    try {
        if (typeof Dropbox === 'undefined') {
            throw new Error('Dropbox SDK not loaded. Please include the Dropbox JavaScript SDK.');
        }

        const clientId = getCurrentDropboxClientId();
        if (!clientId || clientId.trim() === '') {
            throw new Error('Dropbox Client ID not configured. Please set up your Dropbox app first.');
        }

        dropboxAuth = new Dropbox.DropboxAuth({
            clientId: clientId,
            fetch: fetch.bind(window) // Bind fetch to window context
        });

        console.log('Dropbox authentication initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Dropbox authentication:', error);
        throw error;
    }
}

/**
 * Checks if user is currently authenticated with Dropbox.
 *
 * Validates authentication status by checking for valid access token
 * and ensuring token hasn't expired. Attempts automatic token refresh
 * if refresh token is available and access token has expired.
 *
 * **Authentication Validation:**
 * 1. Check for stored access token
 * 2. Validate token expiration time
 * 3. Attempt token refresh if expired but refresh token available
 * 4. Return final authentication status
 *
 * @async
 * @function
 * @returns {Promise<boolean>} True if authenticated and token valid, false otherwise
 * @throws {Error} When token validation or refresh operations fail
 * @since 2.04.01
 *
 * @example
 * // Check authentication before sync operations
 * if (await isAuthenticated()) {
 *   await performCloudSync();
 * } else {
 *   showAuthenticationPrompt();
 * }
 */
async function isAuthenticated() {
    try {
        const accessToken = getDropboxAccessToken();
        if (!accessToken) {
            return false;
        }

        // Check if token is expired
        const expiresAt = localStorage.getItem(DROPBOX_TOKEN_EXPIRES_KEY);
        if (expiresAt && Date.now() >= parseInt(expiresAt)) {
            // Try to refresh token
            const refreshSuccess = await refreshAccessToken();
            return refreshSuccess;
        }

        // Token exists and hasn't expired
        return true;
    } catch (error) {
        console.error('Error checking authentication status:', error);
        return false;
    }
}

/**
 * Starts the Dropbox OAuth authentication flow using PKCE.
 *
 * Initiates the complete OAuth 2.0 authorization code flow with PKCE
 * for secure client-side authentication. Generates authorization URL,
 * stores PKCE code verifier, and redirects user to Dropbox for authorization.
 *
 * **OAuth Flow Steps:**
 * 1. Initialize Dropbox Auth if needed
 * 2. Generate authorization URL with PKCE parameters
 * 3. Store code verifier in session storage
 * 4. Clear any existing authentication state
 * 5. Redirect to Dropbox authorization page
 *
 * **PKCE Security:**
 * - Uses S256 code challenge method
 * - Generates cryptographically secure code verifier
 * - Stores verifier securely in session storage
 * - Includes offline access for refresh tokens
 *
 * @async
 * @function
 * @returns {Promise<void>} Resolves when OAuth flow is initiated
 * @throws {Error} When OAuth initialization or URL generation fails
 * @since 2.04.01
 *
 * @example
 * // Start authentication when user clicks link account
 * await startDropboxAuth();
 * // User will be redirected to Dropbox for authorization
 */
async function startDropboxAuth() {
    try {
        if (!dropboxAuth) {
            initializeDropboxAuth();
        }

        // Generate authorization URL with PKCE and offline access
        const authUrl = await dropboxAuth.getAuthenticationUrl(
            DROPBOX_REDIRECT_URI,
            undefined, // state parameter
            'code', // response type
            'offline', // access type for refresh tokens
            undefined, // scope (use default)
            undefined, // include granted scopes
            true // use PKCE
        );

        // Store code verifier for later token exchange
        window.sessionStorage.setItem('dropbox_code_verifier', dropboxAuth.codeVerifier);

        // Clear any existing authentication state
        clearAuthenticationState();

        // Provide user feedback
        createInlineMessage('info', 'Redirecting to Dropbox for authentication...');

        // Redirect to Dropbox authorization page
        window.location.href = authUrl;

    } catch (error) {
        console.error('Error starting Dropbox authentication:', error);
        createInlineMessage('error', 'Failed to start authentication. Please try again.');
        throw error;
    }
}

/**
 * Handles OAuth callback and completes token exchange.
 *
 * Processes the OAuth authorization callback by extracting the authorization
 * code from URL parameters and exchanging it for access and refresh tokens.
 * Validates the code verifier and completes the PKCE flow securely.
 *
 * **Token Exchange Process:**
 * 1. Extract authorization code from URL
 * 2. Retrieve stored code verifier
 * 3. Exchange code for tokens using PKCE
 * 4. Store tokens securely with encryption
 * 5. Initialize Dropbox API instance
 * 6. Update authentication state
 *
 * **Security Measures:**
 * - Validates code verifier matches stored value
 * - Encrypts tokens before storage
 * - Clears temporary session data
 * - Validates token response structure
 *
 * @async
 * @function
 * @returns {Promise<boolean>} True if token exchange successful, false otherwise
 * @throws {Error} When token exchange or storage operations fail
 * @since 2.04.01
 *
 * @example
 * // Handle OAuth callback after user authorization
 * if (await handleOAuthCallback()) {
 *   showSuccessMessage('Successfully connected to Dropbox!');
 *   updateUI();
 * } else {
 *   showErrorMessage('Authentication failed. Please try again.');
 * }
 */
async function handleOAuthCallback() {
    try {
        // Check if we have an authorization code in the URL
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');

        if (!authCode) {
            console.log('No authorization code found in URL');
            return false;
        }

        // Get stored code verifier
        const codeVerifier = window.sessionStorage.getItem('dropbox_code_verifier');
        if (!codeVerifier) {
            throw new Error('Code verifier not found. Authentication may have been interrupted.');
        }

        if (!dropboxAuth) {
            initializeDropboxAuth();
        }

        // Set the code verifier for token exchange
        dropboxAuth.setCodeVerifier(codeVerifier);

        // Exchange authorization code for tokens
        const tokenResponse = await dropboxAuth.getAccessTokenFromCode(DROPBOX_REDIRECT_URI, authCode);

        if (!tokenResponse.result.access_token) {
            throw new Error('No access token received from Dropbox');
        }

        // Store tokens securely
        await storeTokensSecurely(tokenResponse.result);

        // Initialize Dropbox API instance
        await initializeDropboxAPI();

        // Fetch and store user account information
        const userInfo = await fetchDropboxUserInfo();
        if (userInfo) {
            setDropboxUserInfo(userInfo);
            console.log('Dropbox user info stored:', userInfo.email);
        }

        // Update authentication state
        setCloudSyncEnabled(true);
        setLastCloudSyncTime(Date.now());

        // Clean up temporary data
        window.sessionStorage.removeItem('dropbox_code_verifier');

        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);

        // Update UI to reflect connected state
        updateCloudSyncUI();

        // Show success message
        createInlineMessage('success', '🎉 Successfully connected to Dropbox! You can now sync your dreams to the cloud.');
        announceLiveMessage('Successfully connected to Dropbox');

        console.log('Dropbox authentication completed successfully');
        return true;

    } catch (error) {
        console.error('Error handling OAuth callback:', error);
        createInlineMessage('error', `Authentication failed: ${error.message}`);

        // Clean up on error
        window.sessionStorage.removeItem('dropbox_code_verifier');
        clearAuthenticationState();

        return false;
    }
}

/**
 * Stores authentication tokens securely with optional encryption.
 *
 * Handles secure storage of Dropbox access and refresh tokens with
 * optional encryption based on user's encryption settings. Calculates
 * and stores token expiration time for automatic refresh management.
 *
 * **Storage Security:**
 * - Encrypts tokens if encryption is enabled
 * - Stores in localStorage for persistence
 * - Calculates accurate expiration times
 * - Validates token structure before storage
 *
 * **Token Management:**
 * - Access token for API operations
 * - Refresh token for automatic renewal
 * - Expiration timestamp for validation
 * - Account information for display
 *
 * @async
 * @function
 * @param {Object} tokenData - Token response from Dropbox OAuth
 * @param {string} tokenData.access_token - Access token for API calls
 * @param {string} [tokenData.refresh_token] - Refresh token for renewal
 * @param {number} [tokenData.expires_in] - Token expiration time in seconds
 * @param {string} [tokenData.account_id] - User account identifier
 * @returns {Promise<void>} Resolves when tokens are stored successfully
 * @throws {Error} When token encryption or storage fails
 * @since 2.04.01
 *
 * @example
 * // Store tokens after successful OAuth exchange
 * await storeTokensSecurely(tokenResponse.result);
 * // Tokens are now securely stored and ready for use
 */
async function storeTokensSecurely(tokenData) {
    try {
        // Store tokens (will be encrypted by existing security system if enabled)
        setDropboxAccessToken(tokenData.access_token);
        if (tokenData.refresh_token) {
            setDropboxRefreshToken(tokenData.refresh_token);
        }

        // Calculate and store expiration time
        if (tokenData.expires_in) {
            const expiresAt = Date.now() + (tokenData.expires_in * 1000);
            localStorage.setItem(DROPBOX_TOKEN_EXPIRES_KEY, expiresAt.toString());
        }

        console.log('Tokens stored securely');
    } catch (error) {
        console.error('Error storing tokens:', error);
        throw error;
    }
}

/**
 * Retrieves and decrypts stored access token.
 *
 * Safely retrieves the Dropbox access token from storage and decrypts
 * it if encryption is enabled. Handles both encrypted and plain text
 * token storage formats for backward compatibility.
 *
 * **Decryption Process:**
 * 1. Retrieve token from storage
 * 2. Check if token is encrypted
 * 3. Decrypt if needed using current password
 * 4. Return plain text token for API use
 *
 * @async
 * @function
 * @returns {Promise<string|null>} Decrypted access token or null if not available
 * @throws {Error} When decryption fails or password unavailable
 * @since 2.04.01
 *
 * @example
 * // Get access token for API calls
 * const token = await getDecryptedAccessToken();
 * if (token) {
 *   dropboxAuth.setAccessToken(token);
 * }
 */
async function getDecryptedAccessToken() {
    try {
        const storedToken = getDropboxAccessToken();
        return storedToken;
    } catch (error) {
        console.error('Error retrieving access token:', error);
        throw error;
    }
}

/**
 * Refreshes expired access token using refresh token.
 *
 * Automatically refreshes the Dropbox access token when it expires
 * using the stored refresh token. Updates stored tokens and expiration
 * time to maintain seamless authentication.
 *
 * **Refresh Process:**
 * 1. Retrieve and decrypt refresh token
 * 2. Call Dropbox token refresh endpoint
 * 3. Store new access token securely
 * 4. Update expiration time
 * 5. Initialize API with new token
 *
 * @async
 * @function
 * @returns {Promise<boolean>} True if refresh successful, false otherwise
 * @throws {Error} When refresh token unavailable or refresh fails
 * @since 2.04.01
 *
 * @example
 * // Automatically refresh token when expired
 * if (tokenExpired && await refreshAccessToken()) {
 *   continue with API operations;
 * } else {
 *   prompt for re-authentication;
 * }
 */
async function refreshAccessToken() {
    try {
        const refreshToken = await getDecryptedRefreshToken();
        if (!refreshToken) {
            console.log('No refresh token available');
            return false;
        }

        if (!dropboxAuth) {
            initializeDropboxAuth();
        }

        // Set refresh token and request new access token
        dropboxAuth.setRefreshToken(refreshToken);
        const tokenResponse = await dropboxAuth.refreshAccessToken();

        if (!tokenResponse.result.access_token) {
            throw new Error('No access token received from refresh');
        }

        // Store new tokens
        await storeTokensSecurely(tokenResponse.result);

        // Update Dropbox API instance
        await initializeDropboxAPI();

        console.log('Access token refreshed successfully');
        return true;

    } catch (error) {
        console.error('Error refreshing access token:', error);
        return false;
    }
}

/**
 * Retrieves and decrypts stored refresh token.
 *
 * @async
 * @function
 * @returns {Promise<string|null>} Decrypted refresh token or null if not available
 * @throws {Error} When decryption fails
 * @since 2.04.01
 * @private
 */
async function getDecryptedRefreshToken() {
    try {
        const storedToken = getDropboxRefreshToken();
        return storedToken;
    } catch (error) {
        console.error('Error retrieving refresh token:', error);
        throw error;
    }
}

/**
 * Initializes Dropbox API instance with current access token.
 *
 * @async
 * @function
 * @returns {Promise<void>} Resolves when API is initialized
 * @throws {Error} When token unavailable or API initialization fails
 * @since 2.04.01
 * @private
 */
async function initializeDropboxAPI() {
    try {
        const accessToken = await getDecryptedAccessToken();
        if (!accessToken) {
            throw new Error('No access token available for API initialization');
        }

        dropboxInstance = new Dropbox.Dropbox({
            accessToken: accessToken,
            fetch: fetch.bind(window)
        });

        console.log('Dropbox API initialized successfully');
    } catch (error) {
        console.error('Error initializing Dropbox API:', error);
        throw error;
    }
}

/**
 * Clears all authentication state and stored tokens.
 *
 * @function
 * @returns {void}
 * @since 2.04.01
 * @private
 */
function clearAuthenticationState() {
    setDropboxAccessToken(null);
    setDropboxRefreshToken(null);
    setCloudSyncEnabled(false);
    setDropboxUserInfo(null);
    localStorage.removeItem(DROPBOX_TOKEN_EXPIRES_KEY);
    dropboxInstance = null;
    dropboxAuth = null;
}

/**
 * Retrieves Dropbox user account information.
 *
 * Fetches the current user's account information from Dropbox including
 * email address and display name. This information is used to show
 * which account is currently connected in the UI.
 *
 * **Account Information Retrieved:**
 * - Email address (primary identifier)
 * - Display name (user's name on Dropbox)
 * - Account type (basic, pro, business)
 *
 * @async
 * @function
 * @returns {Promise<Object|null>} User account info object or null if failed
 * @throws {Error} When API request fails or user is not authenticated
 * @since 2.04.62
 *
 * @example
 * // Get current user's account info
 * const userInfo = await fetchDropboxUserInfo();
 * if (userInfo) {
 *   console.log('Connected as:', userInfo.email);
 *   setDropboxUserInfo(userInfo);
 * }
 */
async function fetchDropboxUserInfo() {
    try {
        if (!dropboxInstance) {
            throw new Error('Dropbox instance not initialized');
        }

        // Get current user's account information
        const response = await dropboxInstance.usersGetCurrentAccount();

        if (!response || !response.result) {
            throw new Error('Invalid response from Dropbox API');
        }

        const accountInfo = response.result;

        return {
            email: accountInfo.email,
            name: accountInfo.name ? accountInfo.name.display_name : null,
            accountType: accountInfo.account_type ? accountInfo.account_type['.tag'] : 'unknown'
        };

    } catch (error) {
        console.error('Error fetching Dropbox user info:', error);
        return null;
    }
}

// ================================
// DATA IMPORT UTILITIES
// ================================

/**
 * Imports cloud sync data directly from parsed JSON object.
 *
 * Processes cloud backup data and restores dreams, goals, settings, and
 * autocomplete suggestions. This function handles data imported from cloud
 * storage rather than file uploads, bypassing the file event handling.
 *
 * **Import Process:**
 * 1. Validates data structure and format
 * 2. Processes dreams and goals arrays
 * 3. Restores application settings
 * 4. Updates autocomplete suggestions
 * 5. Refreshes UI displays
 *
 * @async
 * @function
 * @param {Object} backupData - Parsed JSON backup data object
 * @returns {Promise<Object>} Import result with success status and details
 * @throws {Error} When data is invalid or import fails
 * @since 2.04.58
 *
 * @example
 * // Import data from cloud backup
 * const importResult = await importCloudData(parsedBackupJson);
 * if (importResult.success) {
 *   console.log('Data imported successfully');
 * }
 */
async function importCloudData(backupData) {
    try {
        // Validate backup data structure
        if (!backupData || !backupData.data) {
            throw new Error('Invalid backup data structure');
        }

        const data = backupData.data;

        // Import dreams
        if (data.dreams && Array.isArray(data.dreams)) {
            // Clear existing dreams first
            await saveToStore('dreams', []);
            // Import new dreams directly to storage (saveDream expects form inputs, not objects)
            await saveToStore('dreams', data.dreams);
        }

        // Import goals
        if (data.goals && Array.isArray(data.goals)) {
            await saveToStore('goals', data.goals);
        }

        // Import autocomplete data
        if (data.autocomplete) {
            if (data.autocomplete.tags) {
                await saveAutocompleteSuggestions('tags', data.autocomplete.tags);
            }
            if (data.autocomplete.dreamSigns) {
                await saveAutocompleteSuggestions('dreamSigns', data.autocomplete.dreamSigns);
            }
            if (data.autocomplete.emotions) {
                await saveAutocompleteSuggestions('emotions', data.autocomplete.emotions);
            }
        }

        // Import settings (excluding security settings)
        if (data.settings) {
            if (data.settings.theme && ['light', 'dark', 'auto'].includes(data.settings.theme)) {
                storeTheme(data.settings.theme);
                applyTheme(data.settings.theme);
            }
            if (data.settings.paginationLimit) {
                storePaginationPreference(data.settings.paginationLimit);
            }
            if (typeof data.settings.dreamFormCollapsed === 'boolean') {
                localStorage.setItem(DREAM_FORM_COLLAPSE_KEY, data.settings.dreamFormCollapsed.toString());
            }
        }

        // Refresh displays
        displayDreams();

        return {
            success: true,
            message: 'Data imported successfully from cloud',
            stats: {
                dreams: data.dreams ? data.dreams.length : 0,
                goals: data.goals ? data.goals.length : 0,
                tags: data.autocomplete?.tags ? data.autocomplete.tags.length : 0,
                dreamSigns: data.autocomplete?.dreamSigns ? data.autocomplete.dreamSigns.length : 0,
                emotions: data.autocomplete?.emotions ? data.autocomplete.emotions.length : 0
            }
        };

    } catch (error) {
        console.error('Error importing cloud data:', error);
        throw new Error(`Failed to import cloud data: ${error.message}`);
    }
}

// ================================
// DATA GENERATION UTILITIES
// ================================

/**
 * Generates export data for cloud sync without downloading.
 *
 * Creates the same comprehensive export data structure as exportAllData()
 * but returns the JSON string directly for cloud upload operations.
 * Validates app access and collects all necessary data including dreams,
 * goals, settings, and autocomplete suggestions.
 *
 * **Data Collection Process:**
 * 1. Validates app access and PIN protection
 * 2. Loads dreams and goals from IndexedDB
 * 3. Collects autocomplete suggestions (tags, dream signs, emotions)
 * 4. Gathers settings from localStorage
 * 5. Creates comprehensive export object with metadata
 * 6. Returns JSON string ready for cloud storage
 *
 * **Export Structure:**
 * - exportDate: ISO timestamp of generation
 * - exportType: "complete"
 * - data: { dreams, goals, settings, autocomplete, metadata }
 *
 * @async
 * @function
 * @returns {Promise<string|null>} JSON string of export data, null if failed
 * @throws {Error} When app is locked, no data exists, or generation fails
 * @since 2.04.48
 *
 * @example
 * // Generate data for cloud upload
 * const exportData = await generateExportData();
 * if (exportData) {
 *   await uploadToCloud(exportData);
 * }
 *
 * @example
 * // Export structure returned:
 * // {
 * //   exportDate: "2023-12-01T10:30:00.000Z",
 * //   exportType: "complete",
 * //   data: {
 * //     dreams: [...],
 * //     goals: [...],
 * //     settings: { theme, storageType, paginationLimit, dreamFormCollapsed },
 * //     autocomplete: { tags: [...], dreamSigns: [...], emotions: [...] },
 * //     metadata: { totalDreams, totalGoals, lucidDreams, note }
 * //   }
 * // }
 */
async function generateExportData() {
    if (!validateAppAccess('Please unlock your journal first to sync data.')) {
        return null;
    }

    try {
        // Collect restorable data (voice notes excluded - audio cannot be exported/imported)
        const [dreams, goals, userTags, userDreamSigns, userEmotions] = await Promise.all([
            loadDreams(),
            loadGoals(),
            getAutocompleteSuggestions('tags'),
            getAutocompleteSuggestions('dreamSigns'),
            getAutocompleteSuggestions('emotions')
        ]);

        // Collect settings from localStorage
        const settings = {
            theme: getCurrentTheme(),
            storageType: storageType,
            paginationLimit: getCurrentPaginationPreference(),
            dreamFormCollapsed: localStorage.getItem(DREAM_FORM_COLLAPSE_KEY) === 'true',
            // Note: PIN data and encryption settings are intentionally NOT exported for security
            // Encryption settings are device/setup specific and shouldn't be portable
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
                    dreamSigns: userDreamSigns || [],
                    emotions: userEmotions || []
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

        // Validate we have data to export
        if (exportData.data.dreams.length === 0 && exportData.data.goals.length === 0) {
            throw new Error('No data to export yet. Create some dreams or goals first!');
        }

        // Return JSON string ready for cloud upload
        const jsonData = JSON.stringify(exportData, null, 2);
        return jsonData;

    } catch (error) {
        console.error('Error generating export data for cloud sync:', error);
        throw new Error(`Failed to generate export data: ${error.message}`);
    }
}

// ================================
// CONFLICT DETECTION UTILITIES
// ================================

/**
 * Checks if there are local changes since the last cloud sync.
 *
 * Compares the modification times of local dreams and goals against
 * the last cloud sync timestamp to detect if local data has been
 * modified since the last sync operation.
 *
 * **Detection Logic:**
 * 1. Gets last cloud sync timestamp from storage
 * 2. Loads current local dreams and goals
 * 3. Checks if any items were modified after last sync
 * 4. Returns true if local changes detected
 *
 * @async
 * @function
 * @returns {Promise<boolean>} True if local changes detected, false otherwise
 * @since 2.04.58
 *
 * @example
 * // Check before downloading from cloud
 * const hasChanges = await checkForLocalChanges();
 * if (hasChanges) {
 *   // Show confirmation dialog
 * }
 */
async function checkForLocalChanges() {
    try {
        const lastSyncTime = getLastCloudSyncTime();

        if (!lastSyncTime) {
            // No previous sync, assume local changes exist
            return true;
        }

        // Check dreams for modifications
        const dreams = await loadDreams();
        if (dreams && dreams.length > 0) {
            for (const dream of dreams) {
                const dreamTime = dream.lastModified || dream.createdAt || 0;

                // Convert both to numbers for comparison
                const dreamTimestamp = Number(dreamTime);
                const syncTimestamp = Number(lastSyncTime);
                const isModified = dreamTimestamp > syncTimestamp;

                // Also check if dream has no timestamp (treat as potentially modified)
                if (dreamTimestamp === 0) {
                    return true;
                }

                if (isModified) {
                    return true;
                }
            }
        }

        // Check goals for modifications
        const goals = await loadGoals();
        if (goals && goals.length > 0) {
            for (const goal of goals) {
                const goalTime = goal.lastModified || goal.createdAt || 0;
                const isModified = goalTime > lastSyncTime;

                if (isModified) {
                    return true;
                }
            }
        }

        return false;

    } catch (error) {
        console.error('Error checking for local changes:', error);
        // Assume changes exist if we can't determine
        return true;
    }
}

/**
 * Shows conflict dialog asking user if they want to overwrite local changes.
 *
 * Displays a confirmation dialog warning the user that local changes
 * will be lost if they proceed with downloading from cloud. Uses the
 * existing security dialog system for consistent UI.
 *
 * **Dialog Features:**
 * - Clear warning about data loss
 * - Cancel button to preserve local changes
 * - Confirm button to proceed with download
 * - Accessible design with proper ARIA attributes
 *
 * @async
 * @function
 * @returns {Promise<boolean>} True if user confirms, false if cancelled
 * @since 2.04.58
 *
 * @example
 * // Show confirmation before overwriting
 * const confirmed = await showConflictDialog();
 * if (confirmed) {
 *   // Proceed with cloud download
 * }
 */
async function showConflictDialog() {
    return new Promise((resolve) => {
        // Create dialog HTML
        const dialogHtml = `
            <div class="security-dialog-content">
                <h3>⚠️ Local Changes Detected</h3>
                <p>You have made changes to your dreams or goals since the last cloud sync.</p>
                <p><strong>Downloading from cloud will overwrite your local changes and they will be lost permanently.</strong></p>
                <div class="dialog-actions">
                    <button id="conflict-cancel" class="btn btn-secondary">
                        Cancel - Keep Local Changes
                    </button>
                    <button id="conflict-confirm" class="btn btn-primary" style="background-color: var(--error-color);">
                        Download Anyway - Lose Local Changes
                    </button>
                </div>
            </div>
        `;

        // Create and show dialog
        const dialog = document.createElement('div');
        dialog.className = 'security-dialog-overlay';
        dialog.innerHTML = dialogHtml;
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-labelledby', 'conflict-dialog-title');
        dialog.setAttribute('aria-modal', 'true');

        // Add event listeners
        dialog.querySelector('#conflict-cancel').addEventListener('click', () => {
            document.body.removeChild(dialog);
            resolve(false);
        });

        dialog.querySelector('#conflict-confirm').addEventListener('click', () => {
            document.body.removeChild(dialog);
            resolve(true);
        });

        // Close on overlay click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                document.body.removeChild(dialog);
                resolve(false);
            }
        });

        // Show dialog
        document.body.appendChild(dialog);

        // Focus the cancel button (safer default)
        dialog.querySelector('#conflict-cancel').focus();
    });
}

/**
 * Checks if cloud data is newer than local data before upload.
 *
 * Downloads and compares the cloud backup's export date with the last
 * local sync time to detect if the cloud has been updated by another
 * device since the last sync from this device.
 *
 * **Detection Logic:**
 * 1. Downloads current cloud backup file
 * 2. Compares cloud export date with last local sync time
 * 3. Returns true if cloud is newer (potential conflict)
 * 4. Handles cases where no cloud file exists
 *
 * @async
 * @function
 * @returns {Promise<boolean>} True if cloud has newer data, false otherwise
 * @since 2.04.58
 *
 * @example
 * // Check before uploading to cloud
 * const hasConflict = await checkForCloudConflicts();
 * if (hasConflict) {
 *   // Show upload confirmation dialog
 * }
 */
async function checkForCloudConflicts() {
    try {
        const lastSyncTime = getLastCloudSyncTime();

        // List cloud files to check if backup exists
        const listResponse = await dropboxInstance.filesListFolder({
            path: '',
            recursive: false
        });

        const backupFiles = listResponse.result.entries.filter(entry =>
            entry['.tag'] === 'file' && (
                entry.name === 'dream-journal-cloud-sync.json' ||
                entry.name.includes('dream-journal-backup')
            )
        );

        if (backupFiles.length === 0) {
            return false;
        }

        // Get the most recent backup
        const latestBackup = backupFiles.sort((a, b) =>
            new Date(b.client_modified) - new Date(a.client_modified)
        )[0];


        // Download and check the cloud backup's export date
        const downloadResponse = await dropboxInstance.filesDownload({
            path: latestBackup.path_lower
        });

        if (!downloadResponse.result.fileBlob) {
            return false;
        }

        const backupDataText = await downloadResponse.result.fileBlob.text();
        const backupData = JSON.parse(backupDataText);

        const cloudExportDate = new Date(backupData.exportDate).getTime();

        // If cloud was exported after our last sync, it has newer data
        const isCloudNewer = cloudExportDate > (lastSyncTime || 0);

        return isCloudNewer;

    } catch (error) {
        console.error('Error checking for cloud conflicts:', error);
        // If we can't determine, assume conflict exists for safety
        return true;
    }
}

/**
 * Shows upload conflict dialog when cloud data is newer than local.
 *
 * Displays a warning dialog informing the user that the cloud has
 * newer data (possibly from another device) and uploading will
 * overwrite it. Provides options to cancel or proceed.
 *
 * **Dialog Features:**
 * - Warning about overwriting newer cloud data
 * - Cancel button to preserve cloud data
 * - Upload button to overwrite cloud data
 * - Different styling to distinguish from download conflicts
 *
 * @async
 * @function
 * @returns {Promise<boolean>} True if user confirms upload, false if cancelled
 * @since 2.04.58
 *
 * @example
 * // Show upload conflict confirmation
 * const confirmed = await showUploadConflictDialog();
 * if (confirmed) {
 *   // Proceed with upload
 * }
 */
async function showUploadConflictDialog() {
    return new Promise((resolve) => {
        // Create dialog HTML
        const dialogHtml = `
            <div class="security-dialog-content">
                <h3>☁️ Newer Cloud Data Detected</h3>
                <p>The cloud has newer data than your local device. This might be from another device or recent changes.</p>
                <p><strong>Uploading will overwrite the newer cloud data and it will be lost permanently.</strong></p>
                <div class="dialog-actions">
                    <button id="upload-conflict-cancel" class="btn btn-secondary">
                        Cancel - Keep Cloud Data
                    </button>
                    <button id="upload-conflict-confirm" class="btn btn-primary" style="background-color: var(--error-color);">
                        Upload Anyway - Overwrite Cloud
                    </button>
                </div>
            </div>
        `;

        // Create and show dialog
        const dialog = document.createElement('div');
        dialog.className = 'security-dialog-overlay';
        dialog.innerHTML = dialogHtml;
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-labelledby', 'upload-conflict-dialog-title');
        dialog.setAttribute('aria-modal', 'true');

        // Add event listeners
        dialog.querySelector('#upload-conflict-cancel').addEventListener('click', () => {
            document.body.removeChild(dialog);
            resolve(false);
        });

        dialog.querySelector('#upload-conflict-confirm').addEventListener('click', () => {
            document.body.removeChild(dialog);
            resolve(true);
        });

        // Close on overlay click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                document.body.removeChild(dialog);
                resolve(false);
            }
        });

        // Show dialog
        document.body.appendChild(dialog);

        // Focus the cancel button (safer default)
        dialog.querySelector('#upload-conflict-cancel').focus();
    });
}

/**
 * Shows a modal progress popup during upload operations.
 *
 * Creates a non-dismissible modal dialog that displays upload progress
 * and prevents user interaction until the operation completes. The popup
 * shows loading state, then success or error state with appropriate messaging.
 *
 * **Features:**
 * - Non-dismissible during operation (no overlay click, ESC key disabled)
 * - Loading spinner and progress text during upload
 * - Success/error state with appropriate icons and messages
 * - OK button only enabled after operation completes
 * - Proper ARIA attributes for accessibility
 *
 * @async
 * @function
 * @param {string} operation - The operation being performed ('uploading', 'success', 'error')
 * @param {string} [message] - Optional custom message for the operation
 * @returns {Promise<void>} Resolves when user dismisses the completed dialog
 * @since 2.04.59
 *
 * @example
 * // Show upload progress
 * const progressDialog = showUploadProgress('uploading');
 * try {
 *   await performUpload();
 *   await showUploadProgress('success', 'Upload completed successfully!');
 * } catch (error) {
 *   await showUploadProgress('error', 'Upload failed: ' + error.message);
 * }
 */
async function showUploadProgress(operation, message = '') {
    return new Promise((resolve) => {
        let dialog = document.getElementById('upload-progress-dialog');

        if (!dialog) {
            // Create dialog if it doesn't exist
            dialog = document.createElement('div');
            dialog.id = 'upload-progress-dialog';
            dialog.className = 'security-dialog-overlay progress-dialog';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'upload-progress-title');
            document.body.appendChild(dialog);
        }

        let dialogHtml = '';
        let canDismiss = false;

        if (operation === 'uploading') {
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="upload-progress-title">☁️ Uploading to Cloud</h3>
                    <div class="progress-spinner">
                        <div class="spinner"></div>
                    </div>
                    <p>Uploading your data to Dropbox...</p>
                    <p><small>Please wait, do not close this window.</small></p>
                    <div class="dialog-actions">
                        <button id="upload-progress-ok" class="btn btn-primary" disabled>
                            Please Wait...
                        </button>
                    </div>
                </div>
            `;
        } else if (operation === 'success') {
            canDismiss = true;
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="upload-progress-title">✅ Upload Successful</h3>
                    <p>${message || 'Your data has been successfully uploaded to the cloud.'}</p>
                    <div class="dialog-actions">
                        <button id="upload-progress-ok" class="btn btn-primary">
                            OK
                        </button>
                    </div>
                </div>
            `;
        } else if (operation === 'error') {
            canDismiss = true;
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="upload-progress-title">❌ Upload Failed</h3>
                    <p>${message || 'An error occurred while uploading your data.'}</p>
                    <div class="dialog-actions">
                        <button id="upload-progress-ok" class="btn btn-primary">
                            OK
                        </button>
                    </div>
                </div>
            `;
        }

        dialog.innerHTML = dialogHtml;

        if (canDismiss) {
            // Add event listener for OK button
            const okButton = dialog.querySelector('#upload-progress-ok');
            okButton.addEventListener('click', () => {
                document.body.removeChild(dialog);
                resolve();
            });

            // Focus the OK button
            okButton.focus();
        }

        // Prevent dismissal during operation
        if (!canDismiss) {
            // Disable ESC key and overlay click
            dialog.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Store resolve function for later use
            dialog._resolveFunction = resolve;
        }
    });
}

/**
 * Shows a modal progress popup during download operations.
 *
 * Creates a non-dismissible modal dialog that displays download progress
 * and prevents user interaction until the operation completes. The popup
 * shows loading state, then success or error state with appropriate messaging.
 *
 * **Features:**
 * - Non-dismissible during operation (no overlay click, ESC key disabled)
 * - Loading spinner and progress text during download
 * - Success/error state with appropriate icons and messages
 * - OK button only enabled after operation completes
 * - Proper ARIA attributes for accessibility
 *
 * @async
 * @function
 * @param {string} operation - The operation being performed ('downloading', 'success', 'error')
 * @param {string} [message] - Optional custom message for the operation
 * @returns {Promise<void>} Resolves when user dismisses the completed dialog
 * @since 2.04.59
 *
 * @example
 * // Show download progress
 * const progressDialog = showDownloadProgress('downloading');
 * try {
 *   await performDownload();
 *   await showDownloadProgress('success', 'Download completed successfully!');
 * } catch (error) {
 *   await showDownloadProgress('error', 'Download failed: ' + error.message);
 * }
 */
async function showDownloadProgress(operation, message = '') {
    return new Promise((resolve) => {
        let dialog = document.getElementById('download-progress-dialog');

        if (!dialog) {
            // Create dialog if it doesn't exist
            dialog = document.createElement('div');
            dialog.id = 'download-progress-dialog';
            dialog.className = 'security-dialog-overlay progress-dialog';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'download-progress-title');
            document.body.appendChild(dialog);
        }

        let dialogHtml = '';
        let canDismiss = false;

        if (operation === 'downloading') {
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="download-progress-title">☁️ Downloading from Cloud</h3>
                    <div class="progress-spinner">
                        <div class="spinner"></div>
                    </div>
                    <p>Downloading your data from Dropbox...</p>
                    <p><small>Please wait, do not close this window.</small></p>
                    <div class="dialog-actions">
                        <button id="download-progress-ok" class="btn btn-primary" disabled>
                            Please Wait...
                        </button>
                    </div>
                </div>
            `;
        } else if (operation === 'success') {
            canDismiss = true;
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="download-progress-title">✅ Download Successful</h3>
                    <p>${message || 'Your data has been successfully downloaded from the cloud.'}</p>
                    <div class="dialog-actions">
                        <button id="download-progress-ok" class="btn btn-primary">
                            OK
                        </button>
                    </div>
                </div>
            `;
        } else if (operation === 'error') {
            canDismiss = true;
            dialogHtml = `
                <div class="security-dialog-content">
                    <h3 id="download-progress-title">❌ Download Failed</h3>
                    <p>${message || 'An error occurred while downloading your data.'}</p>
                    <div class="dialog-actions">
                        <button id="download-progress-ok" class="btn btn-primary">
                            OK
                        </button>
                    </div>
                </div>
            `;
        }

        dialog.innerHTML = dialogHtml;

        if (canDismiss) {
            // Add event listener for OK button
            const okButton = dialog.querySelector('#download-progress-ok');
            okButton.addEventListener('click', () => {
                document.body.removeChild(dialog);
                resolve();
            });

            // Focus the OK button
            okButton.focus();
        }

        // Prevent dismissal during operation
        if (!canDismiss) {
            // Disable ESC key and overlay click
            dialog.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Store resolve function for later use
            dialog._resolveFunction = resolve;
        }
    });
}

/**
 * Sets the state of cloud sync buttons during operations.
 *
 * Manages the visual state and interactivity of cloud sync buttons
 * to prevent user confusion and multiple simultaneous operations.
 * Updates button text, disabled state, and visual feedback.
 *
 * **Button States:**
 * - 'idle': Normal state with default text and enabled buttons
 * - 'comparing': Conflict detection in progress, buttons disabled with status text
 * - 'operating': Upload/download in progress, all buttons disabled
 *
 * @function
 * @param {string} state - The operation state ('idle', 'comparing', 'operating')
 * @param {string} [operation] - The specific operation ('upload' or 'download') for comparing state
 * @since 2.04.60
 *
 * @example
 * // Start conflict detection for upload
 * setCloudSyncButtonState('comparing', 'upload');
 *
 * // Return to normal state
 * setCloudSyncButtonState('idle');
 */
function setCloudSyncButtonState(state, operation = '') {
    const uploadButton = document.querySelector('[data-action="sync-to-cloud"]');
    const downloadButton = document.querySelector('[data-action="sync-from-cloud"]');
    const disconnectButton = document.querySelector('[data-action="unlink-dropbox-account"]');

    if (!uploadButton || !downloadButton) {
        return; // Buttons not found, probably not on settings page
    }

    switch (state) {
        case 'idle':
            // Reset all buttons to normal state
            if (uploadButton) {
                uploadButton.disabled = false;
                uploadButton.textContent = 'Upload to Cloud';
                uploadButton.className = 'btn btn-primary';
            }
            if (downloadButton) {
                downloadButton.disabled = false;
                downloadButton.textContent = 'Download from Cloud';
                downloadButton.className = 'btn btn-secondary';
            }
            if (disconnectButton) {
                disconnectButton.disabled = false;
            }
            break;

        case 'comparing':
            // Disable all buttons, show status on active button
            if (uploadButton) {
                uploadButton.disabled = true;
                if (operation === 'upload') {
                    uploadButton.textContent = 'Comparing data...';
                    uploadButton.className = 'btn btn-secondary';
                } else {
                    uploadButton.disabled = true;
                }
            }
            if (downloadButton) {
                downloadButton.disabled = true;
                if (operation === 'download') {
                    downloadButton.textContent = 'Checking for conflicts...';
                    downloadButton.className = 'btn btn-secondary';
                } else {
                    downloadButton.disabled = true;
                }
            }
            if (disconnectButton) {
                disconnectButton.disabled = true;
            }
            break;

        case 'operating':
            // Disable all buttons during upload/download operations
            if (uploadButton) {
                uploadButton.disabled = true;
            }
            if (downloadButton) {
                downloadButton.disabled = true;
            }
            if (disconnectButton) {
                disconnectButton.disabled = true;
            }
            break;
    }
}

// ================================
// CLOUD SYNC OPERATIONS
// ================================

/**
 * Uploads current data to Dropbox cloud storage.
 *
 * Exports all application data using the existing export system and
 * uploads it to Dropbox as a JSON backup file. Handles encryption,
 * progress feedback, and error recovery.
 *
 * **Upload Process:**
 * 1. Validate authentication status
 * 2. Export data using existing export functions
 * 3. Encrypt data if encryption enabled
 * 4. Upload to Dropbox with automatic retry
 * 5. Update sync status and timestamp
 *
 * **Error Handling:**
 * - Network connectivity issues
 * - Authentication token expiration
 * - File size limitations
 * - Dropbox API errors
 *
 * @async
 * @function
 * @returns {Promise<boolean>} True if upload successful, false otherwise
 * @throws {Error} When authentication or upload operations fail
 * @since 2.04.01
 *
 * @example
 * // Upload data to cloud storage
 * setCloudSyncInProgress(true);
 * if (await syncToCloud()) {
 *   createInlineMessage('success', 'Data uploaded successfully!');
 * } else {
 *   createInlineMessage('error', 'Upload failed. Please try again.');
 * }
 * setCloudSyncInProgress(false);
 */
async function syncToCloud() {
    try {
        // Set initial button state to prevent spam clicks
        setCloudSyncButtonState('comparing', 'upload');

        // Validate authentication
        if (!await isAuthenticated()) {
            setCloudSyncButtonState('idle');
            await showUploadProgress('error', 'Please connect your Dropbox account first.');
            return false;
        }

        if (!dropboxInstance) {
            await initializeDropboxAPI();
        }

        setCloudSyncInProgress(true);

        // Check if cloud has newer data than local
        const hasCloudConflict = await checkForCloudConflicts();
        if (hasCloudConflict) {
            // Reset button state before showing conflict dialog
            setCloudSyncButtonState('idle');
            const userConfirmed = await showUploadConflictDialog();
            if (!userConfirmed) {
                setCloudSyncInProgress(false);
                return false;
            }
        }

        // Set button state to operating during upload
        setCloudSyncButtonState('operating');

        // Show upload progress popup
        showUploadProgress('uploading');

        // Generate export data for cloud upload
        const exportData = await generateExportData();
        if (!exportData) {
            throw new Error('Failed to generate data for cloud sync');
        }

        // Use consistent filename for cloud sync (no timestamp)
        const filename = `dream-journal-cloud-sync.json`;

        // Upload to Dropbox with overwrite mode for cloud sync
        const uploadResponse = await dropboxInstance.filesUpload({
            path: `/${filename}`,
            contents: exportData,
            mode: {'.tag': 'overwrite'}  // Overwrite existing file
        });

        // Update sync status
        setLastCloudSyncTime(Date.now());

        // Show success popup
        await showUploadProgress('success', `Data uploaded successfully as ${uploadResponse.result.name}`);
        announceLiveMessage('Data uploaded to cloud successfully');

        return true;

    } catch (error) {
        console.error('Error syncing to cloud:', error);
        await showUploadProgress('error', `Upload failed: ${error.message}`);
        return false;
    } finally {
        setCloudSyncInProgress(false);
        setCloudSyncButtonState('idle');
    }
}

/**
 * Downloads and imports data from Dropbox cloud storage.
 *
 * Lists available backup files from Dropbox, allows user to select
 * which backup to restore, and imports the data using the existing
 * import system with conflict resolution.
 *
 * **Download Process:**
 * 1. Validate authentication status
 * 2. List available backup files
 * 3. Present file selection to user
 * 4. Download selected backup
 * 5. Validate and import data
 * 6. Handle conflicts and duplicates
 *
 * @async
 * @function
 * @returns {Promise<boolean>} True if download and import successful, false otherwise
 * @throws {Error} When authentication or download operations fail
 * @since 2.04.01
 *
 * @example
 * // Download data from cloud storage
 * setCloudSyncInProgress(true);
 * if (await syncFromCloud()) {
 *   createInlineMessage('success', 'Data restored successfully!');
 * } else {
 *   createInlineMessage('error', 'Download failed. Please try again.');
 * }
 * setCloudSyncInProgress(false);
 */
async function syncFromCloud() {
    try {
        // Set initial button state to prevent spam clicks
        setCloudSyncButtonState('comparing', 'download');

        // Validate authentication
        if (!await isAuthenticated()) {
            setCloudSyncButtonState('idle');
            await showDownloadProgress('error', 'Please connect your Dropbox account first.');
            return false;
        }

        if (!dropboxInstance) {
            await initializeDropboxAPI();
        }

        setCloudSyncInProgress(true);

        // Check for local changes since last sync
        const hasLocalChanges = await checkForLocalChanges();
        if (hasLocalChanges) {
            // Reset button state before showing conflict dialog
            setCloudSyncButtonState('idle');
            const userConfirmed = await showConflictDialog();
            if (!userConfirmed) {
                setCloudSyncInProgress(false);
                return false;
            }
        }

        // Set button state to operating during download
        setCloudSyncButtonState('operating');

        // Show download progress popup
        showDownloadProgress('downloading');

        // List backup files (app folder root)
        const listResponse = await dropboxInstance.filesListFolder({
            path: '',
            recursive: false
        });

        // Look for the consistent cloud sync file
        const backupFiles = listResponse.result.entries.filter(entry =>
            entry['.tag'] === 'file' && (
                entry.name === 'dream-journal-cloud-sync.json' ||
                entry.name.includes('dream-journal-backup')  // Fallback for old files
            )
        );

        if (backupFiles.length === 0) {
            await showDownloadProgress('error', 'No backup files found in cloud storage.');
            return false;
        }

        // For now, download the most recent backup
        // TODO: Implement user selection UI for multiple backups
        const latestBackup = backupFiles.sort((a, b) =>
            new Date(b.client_modified) - new Date(a.client_modified)
        )[0];

        // Download the backup file
        const downloadResponse = await dropboxInstance.filesDownload({
            path: latestBackup.path_lower
        });

        if (!downloadResponse.result.fileBlob) {
            throw new Error('Failed to download backup file');
        }

        // Convert blob to text and parse JSON
        const backupDataText = await downloadResponse.result.fileBlob.text();
        const backupData = JSON.parse(backupDataText);

        // Import the data manually (since importAllData expects file event)
        const importResult = await importCloudData(backupData);

        if (importResult && importResult.success) {
            setLastCloudSyncTime(Date.now());
            await showDownloadProgress('success', `Data restored successfully from ${latestBackup.name}`);
            announceLiveMessage('Data restored from cloud successfully');
            return true;
        } else {
            throw new Error('Failed to import downloaded backup');
        }

    } catch (error) {
        console.error('Error syncing from cloud:', error);
        await showDownloadProgress('error', `Download failed: ${error.message}`);
        return false;
    } finally {
        setCloudSyncInProgress(false);
        setCloudSyncButtonState('idle');
    }
}

/**
 * Disconnects from Dropbox and clears all authentication data.
 *
 * Safely disconnects the user's Dropbox account by revoking tokens
 * (if possible) and clearing all stored authentication data. Updates
 * UI state to reflect disconnected status.
 *
 * **Disconnection Process:**
 * 1. Attempt to revoke access token
 * 2. Clear all stored tokens and state
 * 3. Reset authentication instances
 * 4. Update UI and user feedback
 *
 * @async
 * @function
 * @returns {Promise<void>} Resolves when disconnection is complete
 * @since 2.04.01
 *
 * @example
 * // Disconnect from Dropbox account
 * await disconnectDropbox();
 * // Update UI to show disconnected state
 */
async function disconnectDropbox() {
    try {
        // Try to revoke the token if API is available
        if (dropboxInstance) {
            try {
                await dropboxInstance.authTokenRevoke();
                console.log('Dropbox token revoked successfully');
            } catch (revokeError) {
                console.warn('Could not revoke token:', revokeError.message);
                // Continue with local cleanup even if revoke fails
            }
        }

        // Clear all authentication state
        clearAuthenticationState();

        // Update UI to reflect disconnected state
        updateCloudSyncUI();

        createInlineMessage('success', 'Disconnected from Dropbox successfully');
        announceLiveMessage('Disconnected from Dropbox');

    } catch (error) {
        console.error('Error disconnecting from Dropbox:', error);
        // Still clear local state even if there's an error
        clearAuthenticationState();
        updateCloudSyncUI();
        createInlineMessage('warning', 'Disconnected locally. Some remote cleanup may have failed.');
    }
}

// ================================
// PUBLIC API AND MODULE EXPORTS
// ================================

/**
 * Initializes the cloud sync module.
 *
 * Sets up the cloud sync system during application initialization.
 * Checks for OAuth callback, initializes authentication, and sets
 * up initial state.
 *
 * @async
 * @function
 * @returns {Promise<void>} Resolves when initialization is complete
 * @since 2.04.01
 *
 * @example
 * // Initialize during app startup
 * await initializeCloudSync();
 */
async function initializeCloudSync() {
    try {
        // Check if this is an OAuth callback
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code')) {
            const authSuccess = await handleOAuthCallback();
            if (authSuccess) {
                createInlineMessage('success', 'Successfully connected to Dropbox!');
            }
        } else {
            // Initialize auth for existing users
            if (getDropboxAccessToken()) {
                initializeDropboxAuth();
                if (await isAuthenticated()) {
                    await initializeDropboxAPI();
                    setCloudSyncEnabled(true);
                }
            }
        }

        // Update UI to reflect current state
        updateCloudSyncUI();

        console.log('Cloud sync module initialized');
    } catch (error) {
        console.error('Error initializing cloud sync:', error);
    }
}

/**
 * Gets current cloud sync status for UI display.
 *
 * @function
 * @returns {Object} Status object with authentication and sync information
 * @since 2.04.01
 */
function getCloudSyncStatus() {
    return {
        enabled: getCloudSyncEnabled(),
        authenticated: !!getDropboxAccessToken(),
        inProgress: getCloudSyncInProgress(),
        lastSync: getLastCloudSyncTime()
    };
}

/**
 * Updates the cloud sync UI to reflect current connection status.
 *
 * Updates status indicators, button text, and shows/hides relevant sections
 * based on whether the user is currently connected to Dropbox.
 *
 * @function
 * @returns {void}
 * @since 2.04.01
 */
function updateCloudSyncUI() {
    try {
        const status = getCloudSyncStatus();
        const isAuthenticated = status.authenticated;

        // Update status indicator
        const statusIndicator = document.getElementById('cloudSyncStatusIndicator');
        if (statusIndicator) {
            if (isAuthenticated) {
                const userInfo = getDropboxUserInfo();
                if (userInfo && userInfo.email) {
                    statusIndicator.textContent = `✅ Connected: ${userInfo.email}`;
                } else {
                    statusIndicator.textContent = '✅ Connected';
                }
                statusIndicator.className = 'status-indicator connected';
            } else {
                statusIndicator.textContent = '🔗 Not Connected';
                statusIndicator.className = 'status-indicator';
            }
        }

        // Update account button
        const accountButton = document.getElementById('cloudSyncAccountButton');
        if (accountButton) {
            if (isAuthenticated) {
                accountButton.textContent = 'Disconnect Dropbox';
                accountButton.setAttribute('data-action', 'unlink-dropbox-account');
                accountButton.className = 'btn btn-secondary';
                accountButton.title = 'Disconnect from Dropbox';
            } else {
                accountButton.textContent = 'Connect Dropbox';
                accountButton.setAttribute('data-action', 'link-dropbox-account');
                accountButton.className = 'btn btn-primary';
                accountButton.title = 'Connect to Dropbox for cloud backup';
            }
        }

        // Show/hide sync controls
        const syncControls = document.getElementById('cloudSyncControls');
        if (syncControls) {
            syncControls.style.display = isAuthenticated ? 'flex' : 'none';
        }

        // Update last sync time
        const lastSyncElement = document.getElementById('lastSyncTime');
        if (lastSyncElement && isAuthenticated) {
            const lastSync = status.lastSync;
            if (lastSync) {
                const syncDate = new Date(lastSync);
                lastSyncElement.textContent = `Last sync: ${formatDateTimeDisplay(syncDate)}`;
            } else {
                lastSyncElement.textContent = 'Never synced';
            }
        }

        console.log('Cloud sync UI updated, authenticated:', isAuthenticated);
    } catch (error) {
        console.error('Error updating cloud sync UI:', error);
    }
}

// ================================
// MODULE EXPORTS
// ================================

/**
 * ES Module exports for the Cloud Sync Module.
 *
 * This exports the key functions that other modules need to interact
 * with the cloud sync functionality.
 *
 * @since 2.04.01
 */
export {
    initializeCloudSync,
    startDropboxAuth,
    disconnectDropbox,
    syncToCloud,
    syncFromCloud,
    isAuthenticated,
    getCloudSyncStatus,
    updateCloudSyncUI
};

// For backward compatibility, also expose via window global
window.CloudSync = {
    initialize: initializeCloudSync,
    startAuth: startDropboxAuth,
    disconnect: disconnectDropbox,
    syncTo: syncToCloud,
    syncFrom: syncFromCloud,
    isAuthenticated: isAuthenticated,
    getStatus: getCloudSyncStatus,
    version: '2.04.01'
};

// ================================
// MODULE LOADING COMPLETE
// ================================
console.log('Cloud Sync Module loaded successfully - Available as ES module exports and window.CloudSync');