/**
 * @fileoverview Centralized error messaging system for Dream Journal application.
 *
 * This module provides a comprehensive error messaging system that intelligently
 * routes error messages to appropriate locations based on user context, provides
 * actionable guidance, and ensures errors are never displayed silently or in
 * inappropriate locations.
 *
 * Key Features:
 * - Context-aware error routing (shows errors where user can see them)
 * - User-friendly error templates with actionable guidance
 * - Error message queuing and deduplication
 * - Persistent error history and debugging support
 * - Integration with existing createInlineMessage system
 * - ARIA-compliant error announcements for accessibility
 *
 * @module ErrorMessenger
 * @version 2.04.01
 * @author Dream Journal Development Team
 * @since 2.04.01
 * @requires dom-helpers
 * @requires state
 * @example
 * // Show context-aware error
 * ErrorMessenger.showError('AUTH_PIN_INVALID', { attemptsRemaining: 2 });
 *
 * @example
 * // Show success with guidance
 * ErrorMessenger.showSuccess('DREAM_SAVED', { dreamTitle: 'Flying Dream' });
 */

// ================================
// ES MODULE IMPORTS
// ================================

import { createInlineMessage, switchAppTab, announceLiveMessage } from './dom-helpers.js';
import { getActiveAppTab, getAppLocked } from './state.js';

// ================================
// ERROR MESSAGE TEMPLATES
// ================================

/**
 * Comprehensive error message templates with user-friendly explanations and actionable guidance.
 * Each template includes title, message, guidance, and severity level.
 */
const ERROR_TEMPLATES = {
    // Authentication & Security Errors
    AUTH_PIN_INVALID: {
        title: 'Invalid PIN',
        message: (data) => `Incorrect PIN entered. ${data?.attemptsRemaining ? `${data.attemptsRemaining} attempts remaining.` : ''}`,
        guidance: 'Double-check your PIN and try again. Use the "Forgot PIN?" option if you need help.',
        severity: 'error',
        category: 'authentication'
    },

    AUTH_PIN_LOCKED: {
        title: 'Too Many Failed Attempts',
        message: 'PIN access has been temporarily locked for security.',
        guidance: 'Wait a few minutes before trying again, or use the recovery options available.',
        severity: 'error',
        category: 'authentication'
    },

    AUTH_PASSWORD_WEAK: {
        title: 'Password Too Weak',
        message: (data) => `Password must be at least ${data?.minLength || 4} characters long.`,
        guidance: 'Choose a stronger password with a mix of letters, numbers, and symbols for better security.',
        severity: 'error',
        category: 'authentication'
    },

    AUTH_PASSWORD_MISMATCH: {
        title: 'Passwords Don\'t Match',
        message: 'The password and confirmation password do not match.',
        guidance: 'Please re-type both passwords carefully to ensure they match exactly.',
        severity: 'error',
        category: 'authentication'
    },

    // Voice Recording Errors
    VOICE_PERMISSION_DENIED: {
        title: 'Microphone Access Required',
        message: 'Voice recording requires microphone permission.',
        guidance: 'Click the microphone icon in your browser\'s address bar and allow access. Then try recording again.',
        severity: 'error',
        category: 'voice'
    },

    VOICE_NOT_SUPPORTED: {
        title: 'Voice Recording Unavailable',
        message: (data) => `Voice recording is not supported in ${data?.browser || 'this browser'}.`,
        guidance: 'Try using Chrome, Edge, or Firefox for full voice recording support.',
        severity: 'warning',
        category: 'voice'
    },

    VOICE_STORAGE_FULL: {
        title: 'Voice Storage Full',
        message: (data) => `Cannot record: Storage full (${data?.current}/${data?.limit}). Delete recordings to free space.`,
        guidance: 'Go to the Voice Notes tab and delete some older recordings to make room for new ones.',
        severity: 'error',
        category: 'voice'
    },

    VOICE_TRANSCRIPTION_MOBILE: {
        title: 'Mobile Transcription Limited',
        message: 'Voice transcription may be unreliable on mobile devices.',
        guidance: 'Recording will still work normally. For better transcription, try using a desktop browser.',
        severity: 'warning',
        category: 'voice'
    },

    // Storage & Data Errors
    STORAGE_QUOTA_EXCEEDED: {
        title: 'Storage Space Full',
        message: 'Your browser\'s storage space is full.',
        guidance: 'Delete some old dreams, voice notes, or clear your browser data to free up space.',
        severity: 'error',
        category: 'storage'
    },

    STORAGE_INDEXEDDB_FALLBACK: {
        title: 'Storage System Changed',
        message: 'Using backup storage method due to database issues.',
        guidance: 'Your data is safe, but performance may be slower. Try refreshing the page if issues persist.',
        severity: 'warning',
        category: 'storage'
    },

    STORAGE_DATA_CORRUPT: {
        title: 'Data Recovery Required',
        message: (data) => `Some ${data?.dataType || 'data'} was corrupted and has been skipped.`,
        guidance: 'Most of your data is intact. Consider exporting your data as a backup.',
        severity: 'warning',
        category: 'storage'
    },

    STORAGE_SAVE_FAILED: {
        title: 'Data Save Failed',
        message: (data) => `Failed to save ${data?.dataType || 'data'}: ${data?.error || 'Storage error'}`,
        guidance: 'Check your device storage space and internet connection, then try again.',
        severity: 'error',
        category: 'storage'
    },

    STORAGE_AUTO_SAVE_FAILED: {
        title: 'Auto-Save Failed',
        message: 'Your recent changes could not be saved automatically.',
        guidance: 'Try saving manually, check your storage space, or refresh the page and try again.',
        severity: 'warning',
        category: 'storage'
    },

    STORAGE_RECOVERY_AVAILABLE: {
        title: 'Data Recovery Available',
        message: (data) => `Found unsaved ${data?.dataType || 'data'} from ${data?.timeAgo || 'recently'}.`,
        guidance: 'Would you like to restore this data? You can also export it as a backup before proceeding.',
        severity: 'info',
        category: 'storage'
    },

    STORAGE_BACKUP_CREATED: {
        title: 'Backup Created',
        message: (data) => `Emergency backup saved: ${data?.backupName || 'backup.json'}`,
        guidance: 'Your data has been backed up before attempting recovery. Keep this file safe.',
        severity: 'success',
        category: 'storage'
    },

    STORAGE_MIGRATION_SUCCESS: {
        title: 'Data Migration Complete',
        message: (data) => `Successfully migrated ${data?.count || 0} items to improved storage.`,
        guidance: 'Your data is now stored more efficiently. Performance should be improved.',
        severity: 'success',
        category: 'storage'
    },

    // Dream Entry Errors
    DREAM_VALIDATION_EMPTY: {
        title: 'Dream Content Required',
        message: 'Please enter a dream description before saving.',
        guidance: 'Add some details about your dream in the description field, then try saving again.',
        severity: 'error',
        category: 'dream'
    },

    DREAM_SAVE_FAILED: {
        title: 'Dream Save Failed',
        message: (data) => `Failed to save dream: ${data?.error || 'Unknown error'}`,
        guidance: 'Check your internet connection and storage space, then try saving again.',
        severity: 'error',
        category: 'dream'
    },

    DREAM_ENCRYPTION_FAILED: {
        title: 'Dream Encryption Failed',
        message: 'Failed to encrypt dream data for secure storage.',
        guidance: 'Your dream was not saved. Check that encryption is properly set up and try again.',
        severity: 'error',
        category: 'dream'
    },

    // Import/Export Errors
    EXPORT_NO_DATA: {
        title: 'No Data to Export',
        message: (data) => `No ${data?.dataType || 'data'} available for export.`,
        guidance: 'Add some dreams or goals first, then try exporting again.',
        severity: 'warning',
        category: 'export'
    },

    IMPORT_FILE_INVALID: {
        title: 'Invalid File Format',
        message: (data) => `The selected file is not a valid ${data?.expectedType || 'export'} file.`,
        guidance: 'Select a file that was previously exported from Dream Journal, with the correct file extension.',
        severity: 'error',
        category: 'import'
    },

    IMPORT_DECRYPTION_FAILED: {
        title: 'Decryption Failed',
        message: 'Unable to decrypt the file with the provided password.',
        guidance: 'Check that you\'re using the correct password that was used during export.',
        severity: 'error',
        category: 'import'
    },

    IMPORT_FILE_TOO_LARGE: {
        title: 'File Size Too Large',
        message: (data) => `Selected file is ${data?.size || 'very large'} and may take time to process.`,
        guidance: 'Large files are supported but may process slowly. Please be patient during import.',
        severity: 'warning',
        category: 'import'
    },

    IMPORT_PROCESSING: {
        title: 'Processing Import',
        message: (data) => `Processing ${data?.fileName || 'file'}... This may take a moment.`,
        guidance: 'Please don\'t close the page while import is in progress.',
        severity: 'info',
        category: 'import'
    },

    EXPORT_PROCESSING: {
        title: 'Creating Export',
        message: (data) => `Creating ${data?.exportType || 'export'} file... Please wait.`,
        guidance: 'Large exports may take several seconds to complete.',
        severity: 'info',
        category: 'export'
    },

    // Search & Filter Errors
    SEARCH_NO_RESULTS: {
        title: 'No Results Found',
        message: (data) => `No dreams found matching "${data?.searchTerm}".`,
        guidance: 'Try different search terms, check your spelling, or clear filters to see all dreams.',
        severity: 'info',
        category: 'search'
    },

    SEARCH_NO_DATA: {
        title: 'No Dreams in Journal',
        message: 'Your dream journal is empty.',
        guidance: 'Start by recording your first dream using the "Record Your Dream" section above.',
        severity: 'info',
        category: 'search'
    },

    SEARCH_FILTER_INVALID: {
        title: 'Invalid Filter Settings',
        message: (data) => `Invalid ${data?.filterType} filter: ${data?.error}`,
        guidance: 'Check your date ranges and filter settings, then try searching again.',
        severity: 'error',
        category: 'search'
    },

    SEARCH_PROCESSING: {
        title: 'Searching Dreams...',
        message: (data) => `Searching through ${data?.totalDreams || 'your'} dreams...`,
        guidance: 'Large searches may take a moment to complete.',
        severity: 'info',
        category: 'search'
    },

    SEARCH_RESULTS_SUMMARY: {
        title: 'Search Complete',
        message: (data) => `Found ${data?.resultsCount || 0} dreams matching your criteria.`,
        guidance: (data) => data?.hasFilters ? 'Clear filters to see all dreams, or refine your search.' : 'Try different search terms to find more dreams.',
        severity: 'success',
        category: 'search'
    },

    // Goal Management Errors
    GOAL_UPDATE_FAILED: {
        title: 'Goal Update Failed',
        message: 'Failed to update goal progress.',
        guidance: 'Check your internet connection and try updating the goal again.',
        severity: 'error',
        category: 'goals'
    },

    GOAL_PROGRESS_UPDATED: {
        title: 'Progress Updated!',
        message: (data) => `Goal progress: ${data?.current || 0}/${data?.target || 0} (${data?.percentage || 0}%)`,
        guidance: (data) => data?.isComplete ? 'Congratulations on reaching your goal! Set a new challenge to keep improving.' : 'Keep going! You\'re making great progress toward your goal.',
        severity: 'success',
        category: 'goals'
    },

    GOAL_COMPLETED: {
        title: 'Goal Achievement! 🎉',
        message: (data) => `Congratulations! You completed "${data?.goalTitle || 'your goal'}"!`,
        guidance: 'This is a significant achievement in your lucid dreaming journey. Consider setting a new goal to continue your progress.',
        severity: 'success',
        category: 'goals'
    },


    GOAL_DELETED: {
        title: 'Goal Removed',
        message: (data) => `Goal "${data?.goalTitle}" has been deleted.`,
        guidance: 'This action cannot be undone. Consider setting a new goal to maintain your lucid dreaming progress.',
        severity: 'info',
        category: 'goals'
    },

    // PWA & Service Worker Errors
    PWA_INSTALL_FAILED: {
        title: 'App Installation Failed',
        message: (data) => `Cannot install app: ${data?.reason || 'Unknown error'}`,
        guidance: 'Make sure you\'re using a supported browser and have sufficient storage space.',
        severity: 'error',
        category: 'pwa'
    },

    PWA_INSTALL_SUCCESS: {
        title: 'App Installed Successfully!',
        message: 'Dream Journal is now installed on your device.',
        guidance: 'You can now access the app from your home screen or app menu, even when offline.',
        severity: 'success',
        category: 'pwa'
    },

    PWA_NOT_AVAILABLE: {
        title: 'App Installation Not Available',
        message: (data) => `Installation is not available in ${data?.browser || 'this browser'}.`,
        guidance: 'Try using Chrome, Edge, or Firefox for app installation support.',
        severity: 'warning',
        category: 'pwa'
    },

    PWA_OFFLINE_MODE: {
        title: 'Offline Mode Active',
        message: 'You\'re currently offline. Limited features are available.',
        guidance: 'You can still read, edit, and create dreams. New data will sync when you reconnect.',
        severity: 'info',
        category: 'pwa'
    },

    PWA_ONLINE_MODE: {
        title: 'Back Online',
        message: 'Internet connection restored. All features are now available.',
        guidance: 'Any offline changes have been saved and are ready to sync.',
        severity: 'success',
        category: 'pwa'
    },

    PWA_UPDATE_AVAILABLE: {
        title: 'App Update Available',
        message: 'A new version of Dream Journal is ready to install.',
        guidance: 'Refresh the page to get the latest features and improvements.',
        severity: 'info',
        category: 'pwa'
    },

    PWA_UPDATE_INSTALLED: {
        title: 'App Updated!',
        message: 'Dream Journal has been updated to the latest version.',
        guidance: 'Enjoy the new features and improvements!',
        severity: 'success',
        category: 'pwa'
    },

    PWA_OFFLINE_LIMITED: {
        title: 'Limited Offline Features',
        message: 'Some features are unavailable while offline.',
        guidance: 'Connect to the internet to access all features, or continue with limited functionality.',
        severity: 'info',
        category: 'pwa'
    },

    // Success Messages
    DREAM_SAVED: {
        title: 'Dream Saved Successfully!',
        message: (data) => `"${data?.dreamTitle}" has been saved to your journal.`,
        guidance: 'You can view, edit, or search for this dream anytime in your journal.',
        severity: 'success',
        category: 'dream'
    },

    DREAM_DELETED: {
        title: 'Dream Deleted',
        message: 'Dream has been successfully removed from your journal.',
        guidance: 'This action cannot be undone. Use export backups to protect your data.',
        severity: 'info',
        category: 'dream'
    },

    DREAM_EDIT_CANCEL_CONFIRM: {
        title: 'Discard Changes?',
        message: 'You have unsaved changes to this dream.',
        guidance: 'Click "Save Changes" to keep your edits, or "Discard" to lose them permanently.',
        severity: 'warning',
        category: 'dream'
    },

    DREAM_EDIT_CANCELLED: {
        title: 'Edit Cancelled',
        message: 'Dream editing cancelled. No changes were saved.',
        guidance: 'Your dream remains unchanged. You can edit it again anytime.',
        severity: 'info',
        category: 'dream'
    },

    DREAM_FILTER_VALIDATION_ERROR: {
        title: 'Filter Settings Invalid',
        message: (data) => data?.summary || 'One or more filter settings need correction.',
        guidance: (data) => {
            if (!data?.errors?.length) return 'Please check your filter settings and try again.';
            const firstError = data.errors[0];
            return `${firstError.message}: ${firstError.suggestion}`;
        },
        severity: 'error',
        category: 'dream'
    },

    DREAM_FILTER_WARNING: {
        title: 'Filter Settings Warning',
        message: (data) => data?.summary || 'Filter settings may not produce expected results.',
        guidance: (data) => {
            if (!data?.warnings?.length) return 'Consider adjusting your filter settings.';
            const firstWarning = data.warnings[0];
            return `${firstWarning.message}: ${firstWarning.suggestion}`;
        },
        severity: 'warning',
        category: 'dream'
    },

    AUTH_PIN_SETUP: {
        title: 'PIN Protection Enabled',
        message: 'Your journal is now protected with a PIN.',
        guidance: 'Remember your PIN - you\'ll need it to access your journal. You can change it anytime in Settings.',
        severity: 'success',
        category: 'authentication'
    },

    VOICE_RECORDING_SAVED: {
        title: 'Voice Note Saved!',
        message: (data) => `Recording saved successfully (${data?.duration || 'Unknown duration'}).`,
        guidance: 'You can listen to this recording anytime in the Voice Notes tab.',
        severity: 'success',
        category: 'voice'
    },

    IMPORT_SUCCESS: {
        title: 'Import Completed!',
        message: (data) => `Successfully imported ${data?.count || 0} items.`,
        guidance: 'Your imported data is now available in your journal. You may want to export a new backup.',
        severity: 'success',
        category: 'import'
    },

    AUTH_PIN_RESET: {
        title: 'PIN Reset Timer Expired',
        message: 'Your PIN has been automatically removed for security.',
        guidance: 'You can set a new PIN anytime in Settings if you want to re-enable PIN protection.',
        severity: 'info',
        category: 'authentication'
    },

    // Connectivity & Network Status
    CONNECTIVITY_OFFLINE: {
        title: 'App is Offline',
        message: (data) => `Currently working offline. Available: ${data?.featuresAvailable || 'Basic features'}. Limited: ${data?.featuresUnavailable || 'Network features'}.`,
        guidance: 'All your work will be saved locally and synced when connection is restored.',
        severity: 'warning',
        category: 'connectivity'
    },

    CONNECTIVITY_RESTORED: {
        title: 'Connection Restored',
        message: 'Your internet connection has been restored.',
        guidance: data => data?.suggestion || 'All features are now available and any pending changes will be synced.',
        severity: 'success',
        category: 'connectivity'
    },

    CONNECTIVITY_LOST: {
        title: 'Connection Lost',
        message: (data) => `Now working offline. Available: ${data?.featuresAvailable || 'Basic features'}. Limited: ${data?.featuresUnavailable || 'Network features'}.`,
        guidance: data => data?.suggestion || 'Your work will be saved locally and synced when connection returns.',
        severity: 'warning',
        category: 'connectivity'
    },

    // Service Worker Updates
    SW_UPDATE_AVAILABLE: {
        title: 'App Update Available',
        message: (data) => `A new version is ready with ${data?.benefits || 'improvements'}.`,
        guidance: data => data?.action || 'Tap "Update" to apply the latest version.',
        severity: 'info',
        category: 'pwa'
    },

    SW_UPDATE_PROGRESS: {
        title: 'Updating App',
        message: (data) => data?.status || 'Preparing update...',
        guidance: 'Please wait while the app updates to the latest version.',
        severity: 'info',
        category: 'pwa'
    },

    SW_UPDATE_INITIATED: {
        title: 'Update Started',
        message: (data) => data?.message || 'App update has been initiated.',
        guidance: 'The app will refresh automatically to complete the update.',
        severity: 'success',
        category: 'pwa'
    },

    SW_UPDATE_COMPLETE: {
        title: 'Update Complete',
        message: (data) => data?.message || 'App has been successfully updated.',
        guidance: 'You now have the latest features and improvements.',
        severity: 'success',
        category: 'pwa'
    },

    SW_UPDATE_FAILED: {
        title: 'Update Failed',
        message: (data) => `Update failed: ${data?.reason || 'Unknown error'}`,
        guidance: data => data?.suggestion || 'Try refreshing the page manually or check your internet connection.',
        severity: 'error',
        category: 'pwa'
    },

    // Error Prevention and Proactive Notifications
    STORAGE_SPACE_WARNING: {
        title: 'Storage Space Warning',
        message: (data) => `Storage ${data?.percentUsed || '??'}% full (${data?.usedMB || '??'}MB of ${data?.totalMB || '??'}MB used).`,
        guidance: data => data?.nextSteps || 'Consider exporting old dreams or deleting unused voice notes.',
        severity: 'warning',
        category: 'storage'
    },

    STORAGE_SPACE_CRITICAL: {
        title: 'Storage Space Critical',
        message: (data) => `Storage ${data?.percentUsed || '??'}% full! Running low on space.`,
        guidance: 'Immediate action required: Export dreams, delete voice notes, or clear browser data.',
        severity: 'error',
        category: 'storage'
    },

    LARGE_DREAM_WARNING: {
        title: 'Large Dream Entry',
        message: (data) => `This dream is ${data?.size || 'very large'} and may affect performance.`,
        guidance: 'Consider breaking long dreams into multiple entries or removing excessive details.',
        severity: 'warning',
        category: 'performance'
    },

    PASSWORD_WEAK_WARNING: {
        title: 'Weak PIN Security',
        message: (data) => `Your PIN has ${data?.issue || 'security concerns'}.`,
        guidance: data => data?.suggestion || 'Use a more complex PIN with varied digits for better security.',
        severity: 'warning',
        category: 'security'
    },

    UNSAVED_CHANGES_WARNING: {
        title: 'Unsaved Changes',
        message: (data) => `You have unsaved changes in ${data?.location || 'this form'}.`,
        guidance: 'Save your work before switching tabs or closing the app.',
        severity: 'warning',
        category: 'data'
    },

    NETWORK_SLOW_WARNING: {
        title: 'Slow Connection',
        message: 'Your internet connection appears slow or unstable.',
        guidance: 'Some features may be delayed. Consider switching to offline mode if issues persist.',
        severity: 'warning',
        category: 'connectivity'
    },

    BROWSER_COMPATIBILITY_WARNING: {
        title: 'Limited Browser Support',
        message: (data) => `${data?.feature || 'Some features'} not available in ${data?.browser || 'this browser'}.`,
        guidance: data => data?.suggestion || 'Use Chrome or Edge for full functionality including voice recording.',
        severity: 'warning',
        category: 'compatibility'
    },

    BACKUP_REMINDER: {
        title: 'Backup Reminder',
        message: (data) => `${data?.daysSinceBackup || '??'} days since last backup.`,
        guidance: 'Regular backups protect your dreams. Export your data from Settings.',
        severity: 'info',
        category: 'backup'
    },

    AUTO_SAVE_FAILED: {
        title: 'Auto-Save Failed',
        message: 'Changes could not be saved automatically.',
        guidance: 'Click Save manually or check your storage space and permissions.',
        severity: 'warning',
        category: 'storage'
    },

    FORM_VALIDATION_PREVIEW: {
        title: 'Potential Issues Detected',
        message: (data) => `${data?.issueCount || 1} potential issues found before saving.`,
        guidance: 'Review highlighted fields to ensure your dream entry is complete.',
        severity: 'info',
        category: 'validation'
    },

    // Comprehensive Error Documentation and Help System
    HELP_GENERAL_ERROR: {
        title: 'Need Help?',
        message: 'Having trouble with the Dream Journal app? Here are some general troubleshooting steps.',
        guidance: 'Try refreshing the page, checking your browser version, or clearing your browser cache.',
        severity: 'info',
        category: 'help'
    },

    HELP_PIN_ISSUES: {
        title: 'PIN Troubleshooting',
        message: 'Having issues with PIN authentication? Here are common solutions.',
        guidance: 'Ensure you\'re entering exactly the same PIN you set up. PINs are case-sensitive and must be 4-6 digits.',
        severity: 'info',
        category: 'help'
    },

    HELP_VOICE_ISSUES: {
        title: 'Voice Recording Help',
        message: 'Voice recording not working? Let us help you troubleshoot.',
        guidance: 'Check microphone permissions, use Chrome or Edge browser, and ensure you\'re on a secure (HTTPS) connection.',
        severity: 'info',
        category: 'help'
    },

    HELP_STORAGE_ISSUES: {
        title: 'Storage Troubleshooting',
        message: 'Having problems saving or loading your dreams? Here\'s what to check.',
        guidance: 'Check available storage space, try exporting your data as backup, and clear old browser data if needed.',
        severity: 'info',
        category: 'help'
    },

    HELP_IMPORT_EXPORT: {
        title: 'Import/Export Guide',
        message: 'Need help with backing up or restoring your dreams?',
        guidance: 'Use Settings > Export Data for backups. Import supports .json and .enc files. Always test imports with small data first.',
        severity: 'info',
        category: 'help'
    },

    HELP_BROWSER_COMPATIBILITY: {
        title: 'Browser Compatibility Guide',
        message: 'Some features may not work in all browsers. Here\'s what we recommend.',
        guidance: 'For best experience: Chrome/Edge (full features), Firefox/Safari (basic features). Update your browser for security.',
        severity: 'info',
        category: 'help'
    },

    HELP_PERFORMANCE_TIPS: {
        title: 'Performance Optimization Tips',
        message: 'Is the app running slowly? Here are ways to improve performance.',
        guidance: 'Close unused browser tabs, clear old data, use smaller dream entries, and restart your browser periodically.',
        severity: 'info',
        category: 'help'
    },

    HELP_DATA_RECOVERY: {
        title: 'Data Recovery Options',
        message: 'Lost your dreams or having data issues? Here are recovery options.',
        guidance: 'Check your recent exports, look for emergency backups in Settings, or contact support with specific error details.',
        severity: 'info',
        category: 'help'
    }
};

// ================================
// ERROR MESSENGER CLASS
// ================================

/**
 * Centralized error messaging system with context-aware routing and user guidance.
 */
class ErrorMessenger {

    /**
     * Queue of pending error messages to prevent overwhelming the user.
     * @private
     */
    static messageQueue = [];

    /**
     * Currently displayed messages to prevent duplicates.
     * @private
     */
    static activeMessages = new Set();

    /**
     * Error history for debugging and user reference.
     * @private
     */
    static errorHistory = [];

    /**
     * Shows an error message with context-aware routing and user guidance.
     *
     * @param {string} errorKey - Key matching ERROR_TEMPLATES
     * @param {Object} [data] - Dynamic data for template interpolation
     * @param {Object} [options] - Additional display options
     * @param {string} [options.forceContext] - Force display in specific tab context
     * @param {boolean} [options.persistent] - Keep message visible until manually dismissed
     * @param {number} [options.duration] - Custom duration in milliseconds
     * @returns {Promise<void>}
     * @example
     * ErrorMessenger.showError('AUTH_PIN_INVALID', { attemptsRemaining: 2 });
     */
    static async showError(errorKey, data = {}, options = {}) {
        return this.showMessage(errorKey, data, { ...options, severity: 'error' });
    }

    /**
     * Shows a warning message with context-aware routing and user guidance.
     *
     * @param {string} warningKey - Key matching ERROR_TEMPLATES
     * @param {Object} [data] - Dynamic data for template interpolation
     * @param {Object} [options] - Additional display options
     * @returns {Promise<void>}
     * @example
     * ErrorMessenger.showWarning('VOICE_TRANSCRIPTION_MOBILE');
     */
    static async showWarning(warningKey, data = {}, options = {}) {
        return this.showMessage(warningKey, data, { ...options, severity: 'warning' });
    }

    /**
     * Shows an info message with context-aware routing and user guidance.
     *
     * @param {string} infoKey - Key matching ERROR_TEMPLATES
     * @param {Object} [data] - Dynamic data for template interpolation
     * @param {Object} [options] - Additional display options
     * @returns {Promise<void>}
     * @example
     * ErrorMessenger.showInfo('SEARCH_NO_RESULTS', { searchTerm: 'flying' });
     */
    static async showInfo(infoKey, data = {}, options = {}) {
        return this.showMessage(infoKey, data, { ...options, severity: 'info' });
    }

    /**
     * Shows a success message with context-aware routing and user guidance.
     *
     * @param {string} successKey - Key matching ERROR_TEMPLATES
     * @param {Object} [data] - Dynamic data for template interpolation
     * @param {Object} [options] - Additional display options
     * @returns {Promise<void>}
     * @example
     * ErrorMessenger.showSuccess('DREAM_SAVED', { dreamTitle: 'Flying Dream' });
     */
    static async showSuccess(successKey, data = {}, options = {}) {
        return this.showMessage(successKey, data, { ...options, severity: 'success' });
    }

    /**
     * Core message display logic with intelligent context routing.
     *
     * @private
     * @param {string} messageKey - Template key
     * @param {Object} data - Template data
     * @param {Object} options - Display options
     * @returns {Promise<void>}
     */
    static async showMessage(messageKey, data = {}, options = {}) {
        const template = ERROR_TEMPLATES[messageKey];
        if (!template) {
            console.error(`Unknown error template: ${messageKey}`);
            return this.showFallbackError('Unknown error occurred', options);
        }

        // Build message content
        const messageText = typeof template.message === 'function'
            ? template.message(data)
            : template.message;

        const severity = options.severity || template.severity;

        // Get current context for analytics
        const currentContext = this.getCurrentContext();

        // Log to error history
        this.addToHistory({
            key: messageKey,
            template,
            data,
            severity,
            timestamp: new Date().toISOString(),
            context: currentContext
        });

        // Determine optimal display location
        const displayContext = this.getOptimalDisplayContext(template.category, options.forceContext);

        // Analyze error patterns for learning (if analytics initialized)
        let patternAnalysis = null;
        if (this.errorAnalytics && this.errorAnalytics.patterns) {
            patternAnalysis = this.analyzeErrorPatterns(messageKey, currentContext);
        }

        // Generate enhanced contextual guidance
        const guidance = await this.generateContextualGuidance(messageKey, data, template, displayContext);

        // Add personalized suggestions from analytics
        if (patternAnalysis && this.errorAnalytics.patterns) {
            const personalizedSuggestions = this.generatePersonalizedSuggestions(messageKey, data, currentContext);
            if (personalizedSuggestions.length > 0) {
                guidance.smartSuggestions.push(...personalizedSuggestions);
                guidance.isPersonalized = true;
            }
        }

        // Build enhanced message with smart guidance
        let fullMessage = messageText;

        // Add base guidance
        if (guidance.guidanceText) {
            fullMessage += `\n\n💡 ${guidance.guidanceText}`;
        }

        // Add smart suggestions if available
        if (guidance.smartSuggestions.length > 0) {
            fullMessage += `\n\n🔧 Suggestions:`;
            guidance.smartSuggestions.forEach((suggestion, index) => {
                fullMessage += `\n• ${suggestion}`;
            });
        }

        // Add quick actions notice if available
        if (guidance.quickActions.length > 0) {
            fullMessage += `\n\n⚡ ${guidance.quickActions.length} quick action${guidance.quickActions.length > 1 ? 's' : ''} available`;
        }

        // Add help notice for complex issues
        if (guidance.showHelp) {
            fullMessage += `\n\n❓ This seems to be a recurring issue. Consider checking the help resources or refreshing the page.`;
        }

        // Enhanced options with guidance data
        const enhancedOptions = {
            ...options,
            guidance,
            isPersonalized: guidance.isPersonalized
        };

        // Show message with context-aware routing
        await this.displayMessage(fullMessage, severity, displayContext, enhancedOptions);

        // Announce for accessibility
        this.announceForAccessibility(template.title, messageText, severity);

        // Execute quick actions if requested
        if (options.executeQuickAction && guidance.quickActions.length > 0) {
            const action = guidance.quickActions[0];
            if (action && typeof action.action === 'function') {
                setTimeout(() => action.action(), 1000); // Delay to let message show first
            }
        }
    }

    /**
     * Analyzes current UI state for modal detection and optimal positioning.
     *
     * This function performs comprehensive analysis of the current UI state including
     * modal detection, overlay visibility, z-index calculations, and container accessibility.
     * It provides intelligent recommendations for error message positioning.
     *
     * **Analysis Features:**
     * - Active modal and overlay detection (PIN overlays, goal dialogs, etc.)
     * - Z-index hierarchy analysis for proper layering
     * - Container visibility and accessibility assessment
     * - Fallback container identification for edge cases
     * - Screen reader and keyboard navigation considerations
     *
     * @private
     * @function analyzeUIState
     * @returns {Object} Comprehensive UI state analysis
     * @returns {boolean} returns.hasActiveModal - Whether any modal is currently active
     * @returns {Element|null} returns.activeModal - The currently active modal element
     * @returns {string} returns.modalType - Type of active modal ('pin', 'goal', 'other', 'none')
     * @returns {Element} returns.fallbackContainer - Safe fallback container for messages
     * @returns {number} returns.recommendedZIndex - Recommended z-index for message display
     * @returns {Object} returns.positioning - Advanced positioning recommendations
     * @returns {boolean} returns.positioning.preferModal - Whether to position within modal
     * @returns {boolean} returns.positioning.useOverlay - Whether to use overlay positioning
     * @returns {string} returns.positioning.strategy - Positioning strategy ('modal', 'tab', 'global', 'overlay')
     * @since 2.04.35
     * @example
     * const uiState = this.analyzeUIState();
     * if (uiState.hasActiveModal) {
     *   // Position error within or above modal
     * }
     */
    static analyzeUIState() {
        // Detect active modals and overlays
        const pinOverlay = document.querySelector('#pinOverlay');
        const goalDialog = document.querySelector('.pin-overlay:not(#pinOverlay)');
        const anyVisibleOverlay = document.querySelector('.pin-overlay[style*="display: flex"], .pin-overlay[style*="display: block"]');

        let activeModal = null;
        let modalType = 'none';
        let hasActiveModal = false;

        // Check for PIN overlay (highest priority)
        if (pinOverlay && pinOverlay.style.display !== 'none') {
            activeModal = pinOverlay;
            modalType = 'pin';
            hasActiveModal = true;
        }
        // Check for goal dialog
        else if (goalDialog && goalDialog.style.display !== 'none') {
            activeModal = goalDialog;
            modalType = 'goal';
            hasActiveModal = true;
        }
        // Check for any other visible overlay
        else if (anyVisibleOverlay) {
            activeModal = anyVisibleOverlay;
            modalType = 'other';
            hasActiveModal = true;
        }

        // Determine optimal container hierarchy
        let fallbackContainer = document.querySelector('.container');
        if (!fallbackContainer) {
            fallbackContainer = document.body;
        }

        // Calculate recommended z-index
        let recommendedZIndex = 1000; // Base level
        if (hasActiveModal) {
            // Get modal's z-index and position above it
            const modalZIndex = parseInt(window.getComputedStyle(activeModal).zIndex) || 1000;
            recommendedZIndex = modalZIndex + 100;
        }

        // Determine positioning strategy
        let positioningStrategy = 'tab'; // Default
        let preferModal = false;
        let useOverlay = false;

        if (hasActiveModal) {
            if (modalType === 'pin') {
                // For PIN overlay, prefer positioning within the modal
                positioningStrategy = 'modal';
                preferModal = true;
            } else if (modalType === 'goal') {
                // For goal dialogs, position within modal for goal-related errors
                positioningStrategy = 'modal';
                preferModal = true;
            } else {
                // For other modals, use overlay positioning above modal
                positioningStrategy = 'overlay';
                useOverlay = true;
            }
        }

        return {
            hasActiveModal,
            activeModal,
            modalType,
            fallbackContainer,
            recommendedZIndex,
            positioning: {
                preferModal,
                useOverlay,
                strategy: positioningStrategy
            }
        };
    }

    /**
     * Determines the optimal location to display an error based on user context.
     *
     * Enhanced with modal awareness, overlay detection, and intelligent positioning
     * to ensure errors are always visible to users regardless of UI state.
     *
     * **Enhanced Features:**
     * - Modal and overlay detection with automatic repositioning
     * - Z-index aware positioning for complex UI states
     * - Fallback positioning when primary containers are not accessible
     * - Smart container selection based on UI visibility and accessibility
     * - Special handling for authentication flows and locked states
     *
     * @private
     * @param {string} category - Error category (authentication, voice, dream, etc.)
     * @param {string} [forceContext] - Force specific context
     * @returns {Object} Display context information with enhanced positioning data
     * @returns {string} returns.tab - Target tab for message display
     * @returns {Element|null} returns.container - Primary container element
     * @returns {Element|null} returns.fallbackContainer - Alternative container if primary fails
     * @returns {boolean} returns.isModal - Whether display context is within a modal
     * @returns {number} returns.zIndex - Recommended z-index for proper layering
     * @returns {Object} returns.positioning - Advanced positioning hints
     * @since 2.04.35
     */
    static getOptimalDisplayContext(category, forceContext) {
        // Enhanced context detection with modal awareness
        const uiState = this.analyzeUIState();

        if (forceContext) {
            return {
                tab: forceContext,
                container: null,
                fallbackContainer: uiState.fallbackContainer,
                isModal: uiState.hasActiveModal,
                zIndex: uiState.recommendedZIndex,
                positioning: uiState.positioning
            };
        }

        const currentTab = getActiveAppTab();
        const isLocked = getAppLocked();

        // Build enhanced context object
        const buildContext = (tab, container, overrides = {}) => ({
            tab,
            container: uiState.positioning.preferModal && uiState.activeModal ?
                uiState.activeModal.querySelector('.pin-container, .goal-dialog-content') || container : container,
            fallbackContainer: uiState.fallbackContainer,
            isModal: uiState.hasActiveModal,
            zIndex: uiState.recommendedZIndex,
            positioning: { ...uiState.positioning, ...overrides }
        });

        // Authentication errors should go IN the PIN dialog, near the input
        if (category === 'authentication') {
            if (isLocked) {
                const pinContainer = document.querySelector('.pin-container');
                return buildContext('lock', pinContainer, { preferModal: true });
            }
            return buildContext(currentTab, this.getTabMainContainer(currentTab));
        }

        // Voice errors should go IN the voice recording card/section
        if (category === 'voice') {
            const voiceSection = document.querySelector('.voice-recording-section, .voice-notes-container, .voice-card');
            if (voiceSection) {
                return buildContext(currentTab, voiceSection);
            }
            // Fallback to journal tab if voice section not found
            return buildContext('journal', this.getTabMainContainer('journal'));
        }

        // Dream errors should go IN the dream form, near the relevant field
        if (category === 'dream' || category === 'validation') {
            const dreamForm = document.querySelector('.dream-form, .entry-form, .add-dream-form');
            if (dreamForm) {
                return buildContext('journal', dreamForm);
            }
            // Fallback to journal tab
            return buildContext('journal', this.getTabMainContainer('journal'));
        }

        // Import/export errors should go IN the import/export section
        if (category === 'import' || category === 'export' || category === 'storage') {
            const importSection = document.querySelector('.import-export-section, .backup-section, .data-section');
            if (importSection) {
                return buildContext('settings', importSection);
            }
            // Fallback to settings tab
            return buildContext('settings', this.getTabMainContainer('settings'));
        }

        // Goals errors should go IN the goal form/card where the action happened
        if (category === 'goals') {
            if (uiState.modalType === 'goal') {
                // Goal errors in goal modal should display within the modal
                const goalContent = uiState.activeModal.querySelector('.goal-dialog-content, .pin-container') || uiState.activeModal;
                return buildContext('goals', goalContent, { preferModal: true, strategy: 'modal' });
            }
            // Look for specific goal forms or containers first
            const goalForm = document.querySelector('.goal-form, .add-goal-form');
            if (goalForm) {
                return buildContext('goals', goalForm);
            }
            // Fallback to goals tab
            return buildContext('goals', this.getTabMainContainer('goals'));
        }

        // PWA errors should prefer settings tab but can display on current tab
        if (category === 'pwa') {
            if (currentTab === 'settings') {
                const settingsTab = document.getElementById('settingsTab');
                return buildContext(currentTab, settingsTab || this.getTabMainContainer(currentTab));
            }
            return buildContext(currentTab, this.getTabMainContainer(currentTab));
        }

        // Connectivity errors should display on current tab (global status)
        if (category === 'connectivity') {
            return buildContext(currentTab, this.getTabMainContainer(currentTab), { strategy: 'global' });
        }

        // Default to current tab with fallback handling
        return buildContext(currentTab, this.getTabMainContainer(currentTab) || uiState.fallbackContainer);
    }

    /**
     * Gets the main container for a specific tab.
     *
     * @private
     * @param {string} tabName - Tab identifier
     * @returns {Element|null} Container element
     */
    static getTabMainContainer(tabName) {
        const tabContainers = {
            'journal': document.getElementById('journalTab'),
            'goals': document.getElementById('goalsTab'),
            'stats': document.getElementById('statsTab'),
            'advice': document.getElementById('adviceTab'),
            'settings': document.getElementById('settingsTab'),
            'lock': document.querySelector('.pin-container')
        };

        return tabContainers[tabName] || document.querySelector('.main-content');
    }

    /**
     * Displays the message using appropriate method and location.
     *
     * @private
     * @param {string} message - Message text to display
     * @param {string} severity - Message severity (error, warning, info, success)
     * @param {Object} context - Display context information
     * @param {Object} options - Display options
     * @returns {Promise<void>}
     */
    /**
     * Displays error message with enhanced positioning and modal awareness.
     *
     * Enhanced version that handles modal-aware positioning, z-index management,
     * fallback container selection, and accessibility improvements for complex UI states.
     *
     * **Enhanced Features:**
     * - Modal-aware positioning with proper z-index layering
     * - Smart container fallback when primary containers are inaccessible
     * - Tab switching optimization to avoid unnecessary switches when in modals
     * - Enhanced accessibility announcements for modal contexts
     * - Overlay positioning for critical errors that need maximum visibility
     *
     * @private
     * @param {string} message - Message text to display
     * @param {string} severity - Message severity level
     * @param {Object} context - Enhanced context information from getOptimalDisplayContext
     * @param {Object} [options] - Additional display options
     * @returns {Promise<void>}
     * @since 2.04.35
     */
    static async displayMessage(message, severity, context, options = {}) {
        // Enhanced tab switching logic with modal awareness
        const shouldSwitchTab = context.tab &&
                               context.tab !== getActiveAppTab() &&
                               !context.isModal &&
                               !context.positioning.preferModal;

        if (shouldSwitchTab) {
            switchAppTab(context.tab);
            // Wait for tab switch to complete
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Smart container selection with fallback hierarchy
        let targetContainer = context.container;

        // Validate container accessibility and visibility
        if (!targetContainer || !this.isContainerAccessible(targetContainer)) {
            targetContainer = context.fallbackContainer;
            console.warn('ErrorMessenger: Primary container inaccessible, using fallback');
        }

        // Final safety net
        if (!targetContainer) {
            targetContainer = document.body;
            console.warn('ErrorMessenger: All containers inaccessible, using document.body');
        }

        const duration = options.duration || this.getDefaultDuration(severity);

        // Enhanced createInlineMessage call with modal-aware options
        const messageOptions = {
            container: targetContainer,
            position: context.positioning.strategy === 'overlay' ? 'center' : 'top',
            duration: options.persistent ? 0 : duration,
            zIndex: context.zIndex,
            className: context.isModal ? 'modal-aware-message' : undefined
        };

        // Add overlay styling for critical errors in modal contexts
        if (context.isModal && (severity === 'error' || context.positioning.useOverlay)) {
            messageOptions.overlay = true;
            messageOptions.zIndex = context.zIndex + 50; // Ensure visibility above modal
        }

        createInlineMessage(severity, message, messageOptions);

        // Enhanced accessibility announcement for modal contexts
        if (context.isModal) {
            this.announceModalAwareMessage(message, severity, context.modalType);
        }
    }

    /**
     * Checks if a container element is accessible and suitable for message display.
     *
     * @private
     * @param {Element} container - Container element to check
     * @returns {boolean} Whether container is accessible for message display
     * @since 2.04.35
     */
    static isContainerAccessible(container) {
        if (!container || !container.isConnected) {
            return false;
        }

        // Check if container is visible
        const style = window.getComputedStyle(container);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }

        // Check if container has reasonable dimensions
        const rect = container.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
            return false;
        }

        return true;
    }

    /**
     * Provides enhanced accessibility announcements for modal contexts.
     *
     * @private
     * @param {string} message - Message to announce
     * @param {string} severity - Message severity
     * @param {string} modalType - Type of active modal
     * @since 2.04.35
     */
    static announceModalAwareMessage(message, severity, modalType) {
        const modalContext = modalType === 'pin' ? 'in security dialog' :
                           modalType === 'goal' ? 'in goal dialog' : 'in dialog';

        const announcement = severity === 'error' || severity === 'warning'
            ? `Alert ${modalContext}: ${message}`
            : `Notification ${modalContext}: ${message}`;

        announceLiveMessage(announcement);
    }

    /**
     * Provides intelligent contextual guidance based on user behavior and error patterns.
     *
     * This function analyzes user context, error history, and current application state
     * to provide smart, adaptive suggestions that help users resolve issues more effectively.
     *
     * **Guidance Features:**
     * - Behavioral pattern analysis for personalized suggestions
     * - Error frequency tracking to identify recurring issues
     * - Context-aware recommendations based on current user workflow
     * - Progressive assistance that escalates with repeated failures
     * - Integration with user preferences and experience level
     *
     * @async
     * @function generateContextualGuidance
     * @param {string} errorKey - Error template key
     * @param {Object} data - Error template data
     * @param {Object} template - Error message template
     * @param {Object} context - Display context information
     * @returns {Promise<Object>} Enhanced guidance with smart suggestions
     * @returns {string} returns.guidanceText - Base guidance message
     * @returns {string[]} returns.smartSuggestions - Context-aware suggestions
     * @returns {Object[]} returns.quickActions - Actionable remediation steps
     * @returns {string} returns.helpLevel - Assistance level ('basic', 'intermediate', 'advanced')
     * @returns {boolean} returns.showHelp - Whether to show additional help resources
     * @since 2.04.35
     * @example
     * const guidance = await this.generateContextualGuidance('VOICE_PERMISSION_DENIED', data, template, context);
     * // Returns enhanced guidance with browser-specific microphone setup instructions
     */
    static async generateContextualGuidance(errorKey, data, template, context) {
        try {
            // Get current context for pattern analysis
            const currentContext = this.getCurrentContext();

            // Analyze error patterns and user behavior
            const patterns = this.analyzeErrorPatterns(errorKey, currentContext);
            const userContext = this.getUserContext();
            const environmentContext = this.getEnvironmentContext();

            // Base guidance from template
            let guidanceText = typeof template.guidance === 'function'
                ? template.guidance(data)
                : template.guidance || 'Please try again or contact support if the problem persists.';

            // Generate smart suggestions based on context
            const smartSuggestions = await this.generateSmartSuggestions(
                errorKey, data, patterns, userContext, environmentContext
            );

            // Create actionable quick actions
            const quickActions = this.generateQuickActions(errorKey, data, context);

            // Determine help level based on user experience and error frequency
            const helpLevel = patterns.frequency > 2 ? 'advanced' :
                             patterns.frequency > 0 ? 'intermediate' : 'basic';

            // Show additional help for recurring issues
            const showHelp = patterns.frequency > 1 || patterns.recentFailures > 2;

            return {
                guidanceText,
                smartSuggestions,
                quickActions,
                helpLevel,
                showHelp,
                isPersonalized: smartSuggestions.length > 0 || quickActions.length > 0
            };

        } catch (error) {
            console.error('Error generating contextual guidance:', error);

            // Fallback to basic guidance
            return {
                guidanceText: typeof template.guidance === 'function'
                    ? template.guidance(data)
                    : template.guidance || 'Please try again or contact support if the problem persists.',
                smartSuggestions: [],
                quickActions: [],
                helpLevel: 'basic',
                showHelp: false,
                isPersonalized: false
            };
        }
    }

    /**
     * Analyzes user error patterns to provide insights for contextual guidance.
     *
     * @private
     * @param {string} errorKey - Error template key to analyze
     * @returns {Object} Error pattern analysis
     * @since 2.04.35
     */
    static analyzeErrorPatterns(errorKey) {
        // Count occurrences of this error type
        const errorOccurrences = this.errorHistory.filter(entry => entry.key === errorKey);
        const frequency = errorOccurrences.length;

        // Count recent failures (last 10 minutes)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentFailures = errorOccurrences.filter(
            entry => new Date(entry.timestamp) > tenMinutesAgo
        ).length;

        // Identify common error sequences
        const recentErrors = this.errorHistory.slice(-5).map(entry => entry.key);
        const hasErrorSequence = recentErrors.filter(key => key === errorKey).length > 1;

        return {
            frequency,
            recentFailures,
            hasErrorSequence,
            lastOccurrence: errorOccurrences.length > 0 ?
                errorOccurrences[errorOccurrences.length - 1].timestamp : null
        };
    }

    /**
     * Gets current user context for personalized guidance.
     *
     * @private
     * @returns {Object} User context information
     * @since 2.04.35
     */
    static getUserContext() {
        return {
            currentTab: getActiveAppTab(),
            isLocked: getAppLocked(),
            hasModalOpen: document.querySelector('.pin-overlay[style*="display: flex"]') !== null,
            browserType: this.detectBrowserType(),
            isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            hasIndexedDB: 'indexedDB' in window,
            hasLocalStorage: 'localStorage' in window
        };
    }

    /**
     * Gets environment context for technical guidance.
     *
     * @private
     * @returns {Object} Environment context information
     * @since 2.04.35
     */
    static getEnvironmentContext() {
        return {
            isOnline: navigator.onLine,
            hasServiceWorker: 'serviceWorker' in navigator,
            hasNotifications: 'Notification' in window,
            hasMediaDevices: 'mediaDevices' in navigator,
            hasWebCrypto: 'crypto' in window && 'subtle' in window.crypto,
            storageQuota: this.getStorageEstimate()
        };
    }

    /**
     * Detects browser type for browser-specific guidance.
     *
     * @private
     * @returns {string} Browser type identifier
     * @since 2.04.35
     */
    static detectBrowserType() {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Chrome')) return 'chrome';
        if (userAgent.includes('Firefox')) return 'firefox';
        if (userAgent.includes('Safari')) return 'safari';
        if (userAgent.includes('Edge')) return 'edge';
        return 'unknown';
    }

    /**
     * Gets storage quota estimate for storage-related guidance.
     *
     * @private
     * @returns {Promise<Object|null>} Storage estimate or null if unavailable
     * @since 2.04.35
     */
    static async getStorageEstimate() {
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                return await navigator.storage.estimate();
            }
        } catch (error) {
            console.log('Storage estimate unavailable:', error);
        }
        return null;
    }

    /**
     * Generates smart, context-aware suggestions based on error type and user environment.
     *
     * @private
     * @param {string} errorKey - Error template key
     * @param {Object} data - Error template data
     * @param {Object} patterns - Error pattern analysis
     * @param {Object} userContext - User context information
     * @param {Object} environmentContext - Environment context information
     * @returns {Promise<string[]>} Array of smart suggestions
     * @since 2.04.35
     */
    static async generateSmartSuggestions(errorKey, data, patterns, userContext, environmentContext) {
        const suggestions = [];

        // Voice-related error suggestions
        if (errorKey.startsWith('VOICE_')) {
            if (userContext.browserType === 'chrome' || userContext.browserType === 'edge') {
                suggestions.push('Try clicking the microphone icon in your browser address bar to allow permission');
            } else if (userContext.browserType === 'firefox') {
                suggestions.push('Check the shield icon in your address bar for microphone permissions');
            } else if (userContext.browserType === 'safari') {
                suggestions.push('Voice features work best in Chrome or Edge browsers');
            }

            if (userContext.isMobile) {
                suggestions.push('On mobile devices, try using the browser in landscape mode for better voice recording');
            }

            if (patterns.frequency > 1) {
                suggestions.push('Consider using the manual dream entry form if voice recording continues to have issues');
            }
        }

        // Authentication error suggestions
        if (errorKey.startsWith('AUTH_')) {
            if (patterns.frequency > 2) {
                suggestions.push('Consider resetting your PIN if you continue to have authentication issues');
            }

            if (errorKey === 'AUTH_PIN_INVALID' && patterns.recentFailures > 1) {
                suggestions.push('Wait a moment between PIN attempts to avoid lockout');
                suggestions.push('Make sure Caps Lock is off when entering your PIN');
            }
        }

        // Storage-related error suggestions
        if (errorKey.includes('STORAGE') || errorKey.includes('SAVE')) {
            if (!environmentContext.hasIndexedDB) {
                suggestions.push('Your browser does not support advanced storage. Consider updating your browser');
            }

            if (!environmentContext.isOnline) {
                suggestions.push('Some storage operations require an internet connection. Check your connectivity');
            }

            if (environmentContext.storageQuota) {
                const usage = (environmentContext.storageQuota.usage / environmentContext.storageQuota.quota) * 100;
                if (usage > 80) {
                    suggestions.push('Your device storage is nearly full. Consider freeing up space or exporting data');
                }
            }
        }

        // Dream entry suggestions
        if (errorKey.startsWith('DREAM_')) {
            if (userContext.currentTab !== 'journal') {
                suggestions.push('Switch to the Journal tab to work with dream entries');
            }

            if (patterns.frequency > 1 && errorKey === 'DREAM_VALIDATION_EMPTY') {
                suggestions.push('Try using the voice recording feature to quickly capture dream details');
                suggestions.push('Start with just a few keywords - you can always add more details later');
            }
        }

        // Goal-related suggestions
        if (errorKey.startsWith('GOAL_')) {
            if (userContext.hasModalOpen) {
                suggestions.push('Close any open dialogs before creating or editing goals');
            }

            if (patterns.frequency > 0) {
                suggestions.push('Try refreshing the page if goal operations continue to fail');
            }
        }

        // PWA and connectivity suggestions
        if (errorKey.startsWith('SW_') || errorKey.startsWith('CONNECTIVITY_')) {
            if (!environmentContext.hasServiceWorker) {
                suggestions.push('Your browser does not support offline features. Consider using Chrome or Edge');
            }

            if (!environmentContext.isOnline && errorKey.includes('UPDATE')) {
                suggestions.push('App updates require an internet connection. Connect to Wi-Fi and try again');
            }
        }

        // Progressive suggestions based on error frequency
        if (patterns.frequency > 3) {
            suggestions.push('This error has occurred multiple times. Consider refreshing the page or restarting your browser');
        }

        if (patterns.recentFailures > 2) {
            suggestions.push('Multiple recent failures detected. Try waiting a few moments before attempting again');
        }

        return suggestions;
    }

    /**
     * Generates actionable quick actions for error resolution.
     *
     * @private
     * @param {string} errorKey - Error template key
     * @param {Object} data - Error template data
     * @param {Object} context - Display context information
     * @returns {Object[]} Array of quick action objects
     * @since 2.04.35
     */
    static generateQuickActions(errorKey, data, context) {
        const actions = [];

        // Voice recording quick actions
        if (errorKey === 'VOICE_PERMISSION_DENIED') {
            actions.push({
                label: 'Open Microphone Settings',
                description: 'Check browser microphone permissions',
                action: () => {
                    // Focus on browser permission area
                    const message = 'Look for the microphone icon in your browser address bar and click it to allow permissions.';
                    this.showMessage('VOICE_PERMISSION_HELP', { instruction: message }, { severity: 'info' });
                }
            });
        }

        // Authentication quick actions
        if (errorKey === 'AUTH_PIN_INVALID') {
            actions.push({
                label: 'Reset PIN',
                description: 'Set up a new PIN if you\'ve forgotten yours',
                action: () => {
                    // Navigate to settings for PIN reset
                    switchAppTab('settings');
                    const resetSection = document.querySelector('[data-action="reset-pin"]');
                    if (resetSection) {
                        resetSection.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        }

        // Storage quick actions
        if (errorKey.includes('STORAGE')) {
            actions.push({
                label: 'Export Data',
                description: 'Backup your data to free up space',
                action: () => {
                    switchAppTab('settings');
                    const exportSection = document.querySelector('[data-action="export-all"]');
                    if (exportSection) {
                        exportSection.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        }

        // Filter validation quick actions
        if (errorKey === 'DREAM_FILTER_VALIDATION_ERROR' && data.corrections) {
            Object.entries(data.corrections).forEach(([field, correction]) => {
                actions.push({
                    label: `Fix ${field}`,
                    description: `Apply suggested correction: ${correction}`,
                    action: () => {
                        const fieldElement = document.getElementById(field) ||
                                           document.querySelector(`[name="${field}"]`);
                        if (fieldElement) {
                            fieldElement.value = correction;
                            fieldElement.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                });
            });
        }

        // Goal-related quick actions
        if (errorKey.startsWith('GOAL_') && context.isModal) {
            actions.push({
                label: 'Close Dialog',
                description: 'Close the current dialog and try again',
                action: () => {
                    const cancelButton = document.querySelector('[data-action="cancel-goal-dialog"]');
                    if (cancelButton) {
                        cancelButton.click();
                    }
                }
            });
        }

        return actions;
    }

    /**
     * Implements progressive error recovery workflows with escalating assistance.
     *
     * This system provides intelligent, escalating support that adapts to user behavior
     * and error patterns. It progresses from basic guidance to advanced recovery options
     * based on failure frequency and user response patterns.
     *
     * **Recovery Stages:**
     * 1. **Basic**: Simple guidance and suggestions (first occurrence)
     * 2. **Intermediate**: Enhanced guidance with quick actions (2-3 occurrences)
     * 3. **Advanced**: Comprehensive recovery with system diagnostics (4+ occurrences)
     * 4. **Critical**: Emergency recovery with data preservation (persistent failures)
     *
     * **Features:**
     * - Automatic escalation based on error frequency and timing
     * - User preference learning and adaptation
     * - Recovery state persistence across sessions
     * - Emergency data backup triggers for critical failures
     * - Proactive system health monitoring
     *
     * @async
     * @function initiateProgressiveRecovery
     * @param {string} errorKey - Error template key
     * @param {Object} data - Error template data
     * @param {Object} patterns - Error pattern analysis
     * @param {Object} context - Display context information
     * @returns {Promise<Object>} Recovery workflow result
     * @returns {string} returns.stage - Recovery stage ('basic', 'intermediate', 'advanced', 'critical')
     * @returns {Object[]} returns.recoveryActions - Available recovery actions
     * @returns {boolean} returns.emergencyMode - Whether emergency protocols are activated
     * @returns {string} returns.nextSteps - Recommended next steps for user
     * @returns {Object} returns.diagnostics - System diagnostic information
     * @since 2.04.35
     * @example
     * const recovery = await this.initiateProgressiveRecovery('AUTH_PIN_INVALID', data, patterns, context);
     * if (recovery.emergencyMode) {
     *   // Trigger emergency data backup
     * }
     */
    static async initiateProgressiveRecovery(errorKey, data, patterns, context) {
        try {
            // Determine recovery stage based on error patterns
            const stage = this.determineRecoveryStage(patterns, errorKey);

            // Get system diagnostics for advanced stages
            const diagnostics = stage === 'advanced' || stage === 'critical'
                ? await this.performSystemDiagnostics()
                : null;

            // Generate stage-appropriate recovery actions
            const recoveryActions = await this.generateRecoveryActions(errorKey, data, stage, diagnostics);

            // Check for emergency conditions
            const emergencyMode = stage === 'critical' || this.detectEmergencyConditions(patterns, errorKey);

            // Generate next steps guidance
            const nextSteps = this.generateRecoveryNextSteps(stage, errorKey, emergencyMode);

            // Trigger emergency protocols if needed
            if (emergencyMode) {
                await this.activateEmergencyProtocols(errorKey, data, diagnostics);
            }

            // Update recovery tracking
            this.updateRecoveryHistory(errorKey, stage, emergencyMode);

            return {
                stage,
                recoveryActions,
                emergencyMode,
                nextSteps,
                diagnostics,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Progressive recovery system error:', error);

            // Fallback to basic recovery
            return {
                stage: 'basic',
                recoveryActions: [{
                    label: 'Refresh Page',
                    description: 'Reload the application to reset state',
                    action: () => window.location.reload()
                }],
                emergencyMode: false,
                nextSteps: 'Try refreshing the page. If problems persist, contact support.',
                diagnostics: null,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Determines the appropriate recovery stage based on error patterns.
     *
     * @private
     * @param {Object} patterns - Error pattern analysis
     * @param {string} errorKey - Error template key
     * @returns {string} Recovery stage identifier
     * @since 2.04.35
     */
    static determineRecoveryStage(patterns, errorKey) {
        // Critical errors that immediately need advanced recovery
        const criticalErrors = ['STORAGE_QUOTA_EXCEEDED', 'DATA_CORRUPTION_DETECTED', 'AUTH_SYSTEM_FAILURE'];
        if (criticalErrors.includes(errorKey)) {
            return 'critical';
        }

        // Determine stage based on frequency and timing
        if (patterns.frequency === 0) {
            return 'basic';
        } else if (patterns.frequency <= 2) {
            return 'intermediate';
        } else if (patterns.frequency <= 5) {
            return 'advanced';
        } else {
            return 'critical';
        }
    }

    /**
     * Performs comprehensive system diagnostics for advanced recovery stages.
     *
     * @private
     * @returns {Promise<Object>} System diagnostic information
     * @since 2.04.35
     */
    static async performSystemDiagnostics() {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            browser: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine
            },
            storage: {
                localStorage: this.testLocalStorage(),
                indexedDB: await this.testIndexedDB(),
                quota: await this.getStorageEstimate()
            },
            features: {
                serviceWorker: 'serviceWorker' in navigator,
                notifications: 'Notification' in window,
                mediaDevices: 'mediaDevices' in navigator,
                webCrypto: 'crypto' in window && 'subtle' in window.crypto
            },
            performance: {
                memory: performance.memory ? {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                } : null,
                timing: performance.timing ? {
                    loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
                } : null
            },
            errors: {
                recentCount: this.errorHistory.length,
                lastHour: this.errorHistory.filter(
                    entry => new Date(entry.timestamp) > new Date(Date.now() - 3600000)
                ).length
            }
        };

        return diagnostics;
    }

    /**
     * Tests localStorage functionality.
     *
     * @private
     * @returns {Object} localStorage test results
     * @since 2.04.35
     */
    static testLocalStorage() {
        try {
            const testKey = 'errorMessenger_test';
            localStorage.setItem(testKey, 'test');
            const result = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);
            return { available: true, working: result === 'test' };
        } catch (error) {
            return { available: false, error: error.message };
        }
    }

    /**
     * Tests IndexedDB functionality.
     *
     * @private
     * @returns {Promise<Object>} IndexedDB test results
     * @since 2.04.35
     */
    static async testIndexedDB() {
        try {
            if (!('indexedDB' in window)) {
                return { available: false, error: 'IndexedDB not supported' };
            }

            // Simple availability test
            const request = indexedDB.open('errorMessenger_test', 1);

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    request.result.close();
                    indexedDB.deleteDatabase('errorMessenger_test');
                    resolve({ available: true, working: true });
                };
                request.onerror = () => {
                    resolve({ available: true, working: false, error: request.error?.message });
                };
                request.onblocked = () => {
                    resolve({ available: true, working: false, error: 'Database blocked' });
                };
            });

        } catch (error) {
            return { available: false, error: error.message };
        }
    }

    /**
     * Generates recovery actions appropriate for the current stage.
     *
     * @private
     * @param {string} errorKey - Error template key
     * @param {Object} data - Error template data
     * @param {string} stage - Recovery stage
     * @param {Object} diagnostics - System diagnostics
     * @returns {Promise<Object[]>} Array of recovery actions
     * @since 2.04.35
     */
    static async generateRecoveryActions(errorKey, data, stage, diagnostics) {
        const actions = [];

        // Basic stage actions
        if (stage === 'basic') {
            actions.push({
                label: 'Try Again',
                description: 'Attempt the operation again',
                action: () => window.location.reload()
            });
        }

        // Intermediate stage actions
        if (stage === 'intermediate' || stage === 'advanced' || stage === 'critical') {
            actions.push({
                label: 'Clear Cache & Retry',
                description: 'Clear browser cache and reload',
                action: async () => {
                    if ('caches' in window) {
                        const cacheNames = await caches.keys();
                        await Promise.all(cacheNames.map(name => caches.delete(name)));
                    }
                    window.location.reload();
                }
            });

            actions.push({
                label: 'Export Data',
                description: 'Backup your data before troubleshooting',
                action: () => {
                    switchAppTab('settings');
                    setTimeout(() => {
                        const exportButton = document.querySelector('[data-action="export-all"]');
                        if (exportButton) {
                            exportButton.click();
                        }
                    }, 500);
                }
            });
        }

        // Advanced stage actions
        if (stage === 'advanced' || stage === 'critical') {
            actions.push({
                label: 'Reset Application Data',
                description: 'Clear all app data and start fresh (export first!)',
                action: () => {
                    if (confirm('This will clear all application data. Make sure you have exported your data first. Continue?')) {
                        localStorage.clear();
                        if ('indexedDB' in window) {
                            // Note: This is a simplified reset - would need proper implementation
                            console.log('IndexedDB reset would be implemented here');
                        }
                        window.location.reload();
                    }
                }
            });

            if (diagnostics?.storage?.quota) {
                actions.push({
                    label: 'Check Storage Space',
                    description: 'View detailed storage usage information',
                    action: async () => {
                        const quota = diagnostics.storage.quota;
                        const usagePercent = ((quota.usage / quota.quota) * 100).toFixed(1);
                        const message = `Storage Usage: ${usagePercent}% (${this.formatBytes(quota.usage)} of ${this.formatBytes(quota.quota)})`;
                        await this.showInfo('STORAGE_DIAGNOSTIC_INFO', { message });
                    }
                });
            }
        }

        // Critical stage actions
        if (stage === 'critical') {
            actions.push({
                label: 'Emergency Recovery',
                description: 'Activate emergency recovery protocols',
                action: async () => {
                    await this.activateEmergencyProtocols(errorKey, data, diagnostics);
                }
            });

            actions.push({
                label: 'Contact Support',
                description: 'Get help with persistent issues',
                action: () => {
                    const supportInfo = this.generateSupportInformation(errorKey, diagnostics);
                    navigator.clipboard?.writeText(supportInfo).then(() => {
                        this.showInfo('SUPPORT_INFO_COPIED', {
                            message: 'Support information copied to clipboard'
                        });
                    });
                }
            });
        }

        return actions;
    }

    /**
     * Formats bytes into human-readable format.
     *
     * @private
     * @param {number} bytes - Number of bytes
     * @returns {string} Formatted string
     * @since 2.04.35
     */
    static formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Detects emergency conditions that require immediate intervention.
     *
     * @private
     * @param {Object} patterns - Error pattern analysis
     * @param {string} errorKey - Error template key
     * @returns {boolean} Whether emergency conditions are detected
     * @since 2.04.35
     */
    static detectEmergencyConditions(patterns, errorKey) {
        // More than 10 errors in last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentErrorCount = this.errorHistory.filter(
            entry => new Date(entry.timestamp) > fiveMinutesAgo
        ).length;

        if (recentErrorCount > 10) {
            return true;
        }

        // Critical error types
        const emergencyErrors = [
            'STORAGE_QUOTA_EXCEEDED',
            'DATA_CORRUPTION_DETECTED',
            'AUTH_SYSTEM_FAILURE',
            'CRITICAL_SAVE_FAILURE'
        ];

        if (emergencyErrors.includes(errorKey)) {
            return true;
        }

        // Rapid succession of same error (5+ in 2 minutes)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        const rapidErrors = this.errorHistory.filter(
            entry => entry.key === errorKey && new Date(entry.timestamp) > twoMinutesAgo
        ).length;

        return rapidErrors >= 5;
    }

    /**
     * Generates next steps guidance based on recovery stage.
     *
     * @private
     * @param {string} stage - Recovery stage
     * @param {string} errorKey - Error template key
     * @param {boolean} emergencyMode - Whether emergency mode is active
     * @returns {string} Next steps guidance
     * @since 2.04.35
     */
    static generateRecoveryNextSteps(stage, errorKey, emergencyMode) {
        if (emergencyMode) {
            return 'Emergency protocols activated. Your data is being protected. Follow the emergency recovery steps immediately.';
        }

        switch (stage) {
            case 'basic':
                return 'Try the suggested action. If the problem persists, it will be escalated automatically.';

            case 'intermediate':
                return 'Multiple solutions are available. Try the quick actions or export your data as a precaution.';

            case 'advanced':
                return 'This appears to be a complex issue. System diagnostics have been performed. Try the advanced recovery options or contact support.';

            case 'critical':
                return 'Critical issue detected. Immediate action recommended. Export your data immediately and consider the emergency recovery options.';

            default:
                return 'Follow the provided guidance. If issues continue, more advanced recovery options will become available.';
        }
    }

    /**
     * Activates emergency protocols for critical system failures.
     *
     * @private
     * @param {string} errorKey - Error template key
     * @param {Object} data - Error template data
     * @param {Object} diagnostics - System diagnostics
     * @returns {Promise<void>}
     * @since 2.04.35
     */
    static async activateEmergencyProtocols(errorKey, data, diagnostics) {
        try {
            console.warn('EMERGENCY: Activating emergency recovery protocols');

            // Create emergency data export
            const emergencyExport = await this.createEmergencyDataExport();

            // Show emergency notification
            await this.showError('EMERGENCY_PROTOCOLS_ACTIVATED', {
                errorKey,
                exportStatus: emergencyExport.success ? 'completed' : 'failed',
                nextSteps: 'Critical system issue detected. Emergency data backup created. Contact support immediately.'
            }, {
                duration: 0, // Persistent
                persistent: true
            });

            // Store emergency state
            this.storeEmergencyState(errorKey, data, diagnostics);

        } catch (error) {
            console.error('Emergency protocol activation failed:', error);
        }
    }

    /**
     * Creates emergency data export for data preservation.
     *
     * @private
     * @returns {Promise<Object>} Export result
     * @since 2.04.35
     */
    static async createEmergencyDataExport() {
        try {
            // This would integrate with the existing export system
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `emergency-backup-${timestamp}`;

            // Simplified emergency export - would need integration with actual export system
            const emergencyData = {
                timestamp,
                errorHistory: this.errorHistory,
                localStorage: this.getLocalStorageData(),
                // Add other critical data as needed
            };

            // Store in localStorage as backup
            localStorage.setItem('emergency_backup', JSON.stringify(emergencyData));

            return { success: true, filename };

        } catch (error) {
            console.error('Emergency data export failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Gets localStorage data for emergency backup.
     *
     * @private
     * @returns {Object} localStorage data
     * @since 2.04.35
     */
    static getLocalStorageData() {
        const data = {};
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) {
                    data[key] = localStorage.getItem(key);
                }
            }
        } catch (error) {
            console.error('Error getting localStorage data:', error);
        }
        return data;
    }

    /**
     * Stores emergency state for recovery tracking.
     *
     * @private
     * @param {string} errorKey - Error template key
     * @param {Object} data - Error template data
     * @param {Object} diagnostics - System diagnostics
     * @since 2.04.35
     */
    static storeEmergencyState(errorKey, data, diagnostics) {
        try {
            const emergencyState = {
                timestamp: new Date().toISOString(),
                errorKey,
                data,
                diagnostics,
                sessionId: this.generateSessionId()
            };

            localStorage.setItem('emergency_state', JSON.stringify(emergencyState));
        } catch (error) {
            console.error('Failed to store emergency state:', error);
        }
    }

    /**
     * Generates support information for critical issues.
     *
     * @private
     * @param {string} errorKey - Error template key
     * @param {Object} diagnostics - System diagnostics
     * @returns {string} Support information text
     * @since 2.04.35
     */
    static generateSupportInformation(errorKey, diagnostics) {
        const info = [
            '=== DREAM JOURNAL SUPPORT INFORMATION ===',
            `Timestamp: ${new Date().toISOString()}`,
            `Error: ${errorKey}`,
            `Session ID: ${this.generateSessionId()}`,
            '',
            '--- Browser Information ---',
            `User Agent: ${navigator.userAgent}`,
            `Language: ${navigator.language}`,
            `Online: ${navigator.onLine}`,
            '',
            '--- Error History (Last 10) ---'
        ];

        const recentErrors = this.errorHistory.slice(-10);
        recentErrors.forEach(error => {
            info.push(`${error.timestamp}: ${error.key}`);
        });

        if (diagnostics) {
            info.push('', '--- System Diagnostics ---');
            info.push(`Storage: ${JSON.stringify(diagnostics.storage, null, 2)}`);
            info.push(`Features: ${JSON.stringify(diagnostics.features, null, 2)}`);
        }

        return info.join('\n');
    }

    /**
     * Generates a unique session identifier.
     *
     * @private
     * @returns {string} Session ID
     * @since 2.04.35
     */
    static generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Updates recovery history for tracking purposes.
     *
     * @private
     * @param {string} errorKey - Error template key
     * @param {string} stage - Recovery stage
     * @param {boolean} emergencyMode - Whether emergency mode was activated
     * @since 2.04.35
     */
    static updateRecoveryHistory(errorKey, stage, emergencyMode) {
        try {
            const recoveryHistory = JSON.parse(localStorage.getItem('recovery_history') || '[]');

            recoveryHistory.push({
                timestamp: new Date().toISOString(),
                errorKey,
                stage,
                emergencyMode
            });

            // Keep only last 100 recovery events
            const trimmedHistory = recoveryHistory.slice(-100);

            localStorage.setItem('recovery_history', JSON.stringify(trimmedHistory));
        } catch (error) {
            console.error('Failed to update recovery history:', error);
        }
    }

    /**
     * Gets default duration based on message severity.
     *
     * @private
     * @param {string} severity - Message severity
     * @returns {number} Duration in milliseconds
     */
    static getDefaultDuration(severity) {
        const durations = {
            'error': 8000,    // Longer for errors that need attention
            'warning': 6000,  // Medium for warnings
            'info': 4000,     // Shorter for informational
            'success': 3000   // Brief for success confirmations
        };
        return durations[severity] || 5000;
    }

    /**
     * Announces message for screen readers and accessibility.
     *
     * @private
     * @param {string} title - Message title
     * @param {string} message - Message content
     * @param {string} severity - Message severity
     */
    static announceForAccessibility(title, message, severity) {
        const announcement = severity === 'error' || severity === 'warning'
            ? `Alert: ${title}. ${message}`
            : `${title}. ${message}`;

        announceLiveMessage(severity === 'error' ? 'error' : 'status', announcement);
    }

    /**
     * Gets current application context for debugging and routing.
     *
     * @private
     * @returns {Object} Current context information
     */
    static getCurrentContext() {
        return {
            activeTab: getActiveAppTab(),
            isLocked: getAppLocked(),
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent.substring(0, 100) // Truncated for privacy
        };
    }

    /**
     * Adds entry to error history for debugging and user reference.
     *
     * @private
     * @param {Object} entry - History entry
     */
    static addToHistory(entry) {
        this.errorHistory.push(entry);

        // Keep only last 100 entries to prevent memory issues
        if (this.errorHistory.length > 100) {
            this.errorHistory.shift();
        }
    }

    /**
     * Shows a fallback error when template system fails.
     *
     * @private
     * @param {string} message - Fallback message
     * @param {Object} options - Display options
     * @returns {Promise<void>}
     */
    static async showFallbackError(message, options = {}) {
        const container = this.getTabMainContainer(getActiveAppTab());
        createInlineMessage('error', message, {
            container,
            position: 'top',
            duration: 5000
        });
    }

    /**
     * Gets error history for debugging purposes.
     *
     * @returns {Array} Array of error history entries
     * @example
     * const history = ErrorMessenger.getErrorHistory();
     * console.log(`Total errors: ${history.length}`);
     */
    static getErrorHistory() {
        return [...this.errorHistory]; // Return copy to prevent external mutation
    }

    /**
     * Clears error history.
     *
     * @example
     * ErrorMessenger.clearHistory();
     */
    static clearHistory() {
        this.errorHistory = [];
    }

    // ================================
    // PROACTIVE MONITORING SYSTEM
    // ================================

    /**
     * Initializes proactive monitoring systems to detect and prevent issues before they become errors.
     *
     * This system continuously monitors application health, user behavior patterns, and system
     * resources to identify potential problems early. It provides proactive notifications and
     * guidance to prevent issues from escalating into user-facing errors.
     *
     * **Monitoring Areas:**
     * - Storage space and quota utilization
     * - Form validation and data integrity
     * - Network connectivity and performance
     * - Browser compatibility and feature support
     * - Backup frequency and data protection
     * - Security patterns and authentication health
     * - Application performance and responsiveness
     *
     * @static
     * @async
     * @function initializeProactiveMonitoring
     * @returns {Promise<void>}
     * @since 2.04.35
     * @example
     * // Initialize during app startup
     * await ErrorMessenger.initializeProactiveMonitoring();
     */
    static async initializeProactiveMonitoring() {
        try {
            console.log('ErrorMessenger: Initializing proactive monitoring systems');

            // Set up storage monitoring
            this.setupStorageMonitoring();

            // Set up form monitoring
            this.setupFormMonitoring();

            // Set up network monitoring
            this.setupNetworkMonitoring();

            // Set up browser compatibility checks
            this.setupCompatibilityChecks();

            // Set up backup reminders
            this.setupBackupReminders();

            // Set up auto-save monitoring
            this.setupAutoSaveMonitoring();

            console.log('ErrorMessenger: Proactive monitoring systems initialized');

        } catch (error) {
            console.error('Failed to initialize proactive monitoring:', error);
        }
    }

    /**
     * Sets up storage space monitoring to prevent storage-related failures.
     *
     * Monitors IndexedDB quota, localStorage usage, and provides early warnings
     * when storage space becomes limited. Helps users take action before storage
     * failures occur.
     *
     * @private
     * @static
     * @function setupStorageMonitoring
     * @returns {void}
     * @since 2.04.35
     */
    static setupStorageMonitoring() {
        // Check storage periodically
        setInterval(async () => {
            try {
                const usage = await this.checkStorageUsage();

                if (usage.percentUsed > 90) {
                    await this.showError('STORAGE_SPACE_CRITICAL', {
                        percentUsed: Math.round(usage.percentUsed),
                        usedMB: Math.round(usage.usedMB),
                        totalMB: Math.round(usage.totalMB)
                    });
                } else if (usage.percentUsed > 75) {
                    await this.showWarning('STORAGE_SPACE_WARNING', {
                        percentUsed: Math.round(usage.percentUsed),
                        usedMB: Math.round(usage.usedMB),
                        totalMB: Math.round(usage.totalMB),
                        nextSteps: 'Consider exporting old dreams or deleting unused voice notes to free up space.'
                    });
                }
            } catch (error) {
                console.error('Storage monitoring error:', error);
            }
        }, 60000); // Check every minute
    }

    /**
     * Checks current storage usage statistics.
     *
     * @private
     * @static
     * @async
     * @function checkStorageUsage
     * @returns {Promise<Object>} Storage usage information
     * @returns {number} returns.percentUsed - Percentage of storage used
     * @returns {number} returns.usedMB - Used storage in megabytes
     * @returns {number} returns.totalMB - Total available storage in megabytes
     * @since 2.04.35
     */
    static async checkStorageUsage() {
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                const used = estimate.usage || 0;
                const quota = estimate.quota || 0;

                return {
                    percentUsed: quota > 0 ? (used / quota) * 100 : 0,
                    usedMB: used / (1024 * 1024),
                    totalMB: quota / (1024 * 1024)
                };
            }
        } catch (error) {
            console.warn('Storage estimation not available:', error);
        }

        // Fallback estimation based on localStorage
        try {
            const localStorageUsage = JSON.stringify(localStorage).length;
            const estimatedQuota = 10 * 1024 * 1024; // 10MB estimate

            return {
                percentUsed: (localStorageUsage / estimatedQuota) * 100,
                usedMB: localStorageUsage / (1024 * 1024),
                totalMB: estimatedQuota / (1024 * 1024)
            };
        } catch (error) {
            return { percentUsed: 0, usedMB: 0, totalMB: 0 };
        }
    }

    /**
     * Sets up form monitoring to detect potential validation issues before submission.
     *
     * Monitors form fields for common issues, large content, and provides proactive
     * guidance to improve data quality and prevent validation failures.
     *
     * @private
     * @static
     * @function setupFormMonitoring
     * @returns {void}
     * @since 2.04.35
     */
    static setupFormMonitoring() {
        // Monitor dream content length
        const dreamTextarea = document.getElementById('dreamText');
        if (dreamTextarea) {
            dreamTextarea.addEventListener('input', this.debounce((event) => {
                const content = event.target.value;
                const size = new Blob([content]).size;

                // Warn for very large dreams (>100KB)
                if (size > 100 * 1024) {
                    this.showWarning('LARGE_DREAM_WARNING', {
                        size: `${Math.round(size / 1024)}KB`
                    });
                }
            }, 2000));
        }

        // Monitor unsaved changes
        this.setupUnsavedChangesMonitoring();
    }

    /**
     * Sets up monitoring for unsaved changes to prevent data loss.
     *
     * @private
     * @static
     * @function setupUnsavedChangesMonitoring
     * @returns {void}
     * @since 2.04.35
     */
    static setupUnsavedChangesMonitoring() {
        let hasUnsavedChanges = false;

        // Monitor form changes
        document.addEventListener('input', (event) => {
            if (event.target.matches('input[type="text"], textarea, select')) {
                hasUnsavedChanges = true;
            }
        });

        // Monitor tab switches
        document.addEventListener('click', async (event) => {
            if (event.target.matches('.app-tab') && hasUnsavedChanges) {
                await this.showWarning('UNSAVED_CHANGES_WARNING', {
                    location: 'current form'
                });
            }
        });

        // Reset on save
        document.addEventListener('click', (event) => {
            if (event.target.matches('[data-action*="save"], .btn-primary')) {
                hasUnsavedChanges = false;
            }
        });
    }

    /**
     * Sets up network monitoring to detect connectivity issues and performance problems.
     *
     * @private
     * @static
     * @function setupNetworkMonitoring
     * @returns {void}
     * @since 2.04.35
     */
    static setupNetworkMonitoring() {
        // Monitor connection speed
        if ('connection' in navigator) {
            const connection = navigator.connection;

            if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                this.showWarning('NETWORK_SLOW_WARNING');
            }

            connection.addEventListener('change', () => {
                if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                    this.showWarning('NETWORK_SLOW_WARNING');
                }
            });
        }

        // Monitor online/offline status
        window.addEventListener('online', () => {
            this.showSuccess('CONNECTIVITY_RESTORED');
        });

        window.addEventListener('offline', () => {
            this.showWarning('CONNECTIVITY_LOST', {
                featuresAvailable: 'Recording dreams, voice notes, and viewing existing content',
                featuresUnavailable: 'App updates and external content'
            });
        });
    }

    /**
     * Sets up browser compatibility checks and feature detection.
     *
     * @private
     * @static
     * @function setupCompatibilityChecks
     * @returns {void}
     * @since 2.04.35
     */
    static setupCompatibilityChecks() {
        // Check for voice recording support
        if (!('MediaRecorder' in window) || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            const browserName = this.getBrowserName();
            this.showWarning('BROWSER_COMPATIBILITY_WARNING', {
                feature: 'Voice recording',
                browser: browserName,
                suggestion: 'Use Chrome or Edge for voice recording functionality.'
            });
        }

        // Check for storage support
        if (!('indexedDB' in window)) {
            this.showWarning('BROWSER_COMPATIBILITY_WARNING', {
                feature: 'Advanced storage',
                browser: this.getBrowserName(),
                suggestion: 'Some features may be limited. Consider updating your browser.'
            });
        }
    }

    /**
     * Gets the current browser name for compatibility messages.
     *
     * @private
     * @static
     * @function getBrowserName
     * @returns {string} Browser name
     * @since 2.04.35
     */
    static getBrowserName() {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari')) return 'Safari';
        if (userAgent.includes('Edge')) return 'Edge';
        return 'Unknown';
    }

    /**
     * Sets up backup reminder system to encourage regular data exports.
     *
     * @private
     * @static
     * @function setupBackupReminders
     * @returns {void}
     * @since 2.04.35
     */
    static setupBackupReminders() {
        // Check backup frequency on app start
        const lastBackup = localStorage.getItem('lastBackupDate');
        if (lastBackup) {
            const daysSinceBackup = Math.floor((Date.now() - new Date(lastBackup)) / (1000 * 60 * 60 * 24));

            if (daysSinceBackup > 30) {
                this.showInfo('BACKUP_REMINDER', {
                    daysSinceBackup
                });
            }
        } else {
            // No backup record, show reminder after some app usage
            setTimeout(() => {
                this.showInfo('BACKUP_REMINDER', {
                    daysSinceBackup: 'many'
                });
            }, 300000); // Show after 5 minutes of use
        }
    }

    /**
     * Sets up auto-save monitoring to detect save failures.
     *
     * @private
     * @static
     * @function setupAutoSaveMonitoring
     * @returns {void}
     * @since 2.04.35
     */
    static setupAutoSaveMonitoring() {
        // Monitor for save button clicks that might fail
        document.addEventListener('click', async (event) => {
            if (event.target.matches('[data-action*="save"]')) {
                // Set a timeout to check if save succeeded
                setTimeout(async () => {
                    // This is a simplified check - in practice would integrate with actual save status
                    const lastError = this.errorHistory[this.errorHistory.length - 1];
                    if (lastError && lastError.timestamp > Date.now() - 5000) {
                        await this.showWarning('AUTO_SAVE_FAILED');
                    }
                }, 2000);
            }
        });
    }

    /**
     * Debounce utility function to limit the rate of function calls.
     *
     * @private
     * @static
     * @function debounce
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     * @since 2.04.35
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ================================
    // ADVANCED ERROR ANALYTICS & LEARNING
    // ================================

    /**
     * Error analytics data storage for learning patterns and improving suggestions.
     * @private
     * @static
     */
    static errorAnalytics = {
        patterns: new Map(),           // Error pattern analysis
        userBehaviors: new Map(),      // User behavior tracking
        suggestionEffectiveness: new Map(), // Track which suggestions help
        sessionData: {
            startTime: Date.now(),
            errorCount: 0,
            recoverySuccessRate: 0
        }
    };

    /**
     * Initializes advanced error analytics and learning systems.
     *
     * This system learns from user behavior patterns, error frequency, and suggestion
     * effectiveness to provide increasingly personalized and effective error recovery
     * guidance. It builds a knowledge base of user preferences and successful recovery
     * strategies over time.
     *
     * **Learning Capabilities:**
     * - Error pattern recognition and prediction
     * - User behavior analysis and adaptation
     * - Suggestion effectiveness tracking and optimization
     * - Personalized recovery workflow recommendations
     * - Performance impact assessment and optimization
     * - Cross-session learning persistence
     *
     * @static
     * @async
     * @function initializeErrorAnalytics
     * @returns {Promise<void>}
     * @since 2.04.35
     * @example
     * // Initialize during app startup after proactive monitoring
     * await ErrorMessenger.initializeErrorAnalytics();
     */
    static async initializeErrorAnalytics() {
        try {
            console.log('ErrorMessenger: Initializing error analytics and learning systems');

            // Load persistent analytics data
            await this.loadAnalyticsData();

            // Set up real-time learning
            this.setupBehaviorTracking();
            this.setupPatternAnalysis();
            this.setupSuggestionTracking();

            // Start session monitoring
            this.startSessionAnalytics();

            console.log('ErrorMessenger: Error analytics and learning systems initialized');

        } catch (error) {
            console.error('Failed to initialize error analytics:', error);
        }
    }

    /**
     * Loads persistent analytics data from storage.
     *
     * @private
     * @static
     * @async
     * @function loadAnalyticsData
     * @returns {Promise<void>}
     * @since 2.04.35
     */
    static async loadAnalyticsData() {
        try {
            const storedData = localStorage.getItem('errorAnalyticsData');
            if (storedData) {
                const data = JSON.parse(storedData);

                // Convert stored data back to Maps
                if (data.patterns) {
                    this.errorAnalytics.patterns = new Map(data.patterns);
                }
                if (data.userBehaviors) {
                    this.errorAnalytics.userBehaviors = new Map(data.userBehaviors);
                }
                if (data.suggestionEffectiveness) {
                    this.errorAnalytics.suggestionEffectiveness = new Map(data.suggestionEffectiveness);
                }

                console.log('ErrorMessenger: Loaded analytics data from previous sessions');
            }
        } catch (error) {
            console.warn('Error loading analytics data:', error);
        }
    }

    /**
     * Saves analytics data to persistent storage.
     *
     * @private
     * @static
     * @async
     * @function saveAnalyticsData
     * @returns {Promise<void>}
     * @since 2.04.35
     */
    static async saveAnalyticsData() {
        try {
            const data = {
                patterns: Array.from(this.errorAnalytics.patterns.entries()),
                userBehaviors: Array.from(this.errorAnalytics.userBehaviors.entries()),
                suggestionEffectiveness: Array.from(this.errorAnalytics.suggestionEffectiveness.entries()),
                lastSaved: Date.now()
            };

            localStorage.setItem('errorAnalyticsData', JSON.stringify(data));
        } catch (error) {
            console.warn('Error saving analytics data:', error);
        }
    }

    /**
     * Sets up real-time user behavior tracking.
     *
     * @private
     * @static
     * @function setupBehaviorTracking
     * @returns {void}
     * @since 2.04.35
     */
    static setupBehaviorTracking() {
        // Track tab switching patterns
        document.addEventListener('click', (event) => {
            if (event.target.matches('.app-tab')) {
                this.recordBehavior('tab_switch', {
                    from: getActiveAppTab(),
                    to: event.target.dataset.tab,
                    timestamp: Date.now()
                });
            }
        });

        // Track error dismissal patterns
        document.addEventListener('click', (event) => {
            if (event.target.matches('.notification-message .close-btn')) {
                this.recordBehavior('error_dismissed', {
                    timing: Date.now() - (this.lastErrorTime || Date.now()),
                    timestamp: Date.now()
                });
            }
        });

        // Track recovery action patterns
        document.addEventListener('click', (event) => {
            if (event.target.matches('[data-action]')) {
                this.recordBehavior('recovery_action', {
                    action: event.target.dataset.action,
                    context: this.getCurrentContext(),
                    timestamp: Date.now()
                });
            }
        });
    }

    /**
     * Records user behavior for analytics learning.
     *
     * @private
     * @static
     * @function recordBehavior
     * @param {string} type - Type of behavior
     * @param {Object} data - Behavior data
     * @since 2.04.35
     */
    static recordBehavior(type, data) {
        const key = `${type}_${new Date().toDateString()}`;
        const existing = this.errorAnalytics.userBehaviors.get(key) || [];
        existing.push(data);
        this.errorAnalytics.userBehaviors.set(key, existing);

        // Periodic data cleanup and saving
        if (existing.length % 10 === 0) {
            this.saveAnalyticsData();
        }
    }

    /**
     * Sets up error pattern analysis for predictive suggestions.
     *
     * @private
     * @static
     * @function setupPatternAnalysis
     * @returns {void}
     * @since 2.04.35
     */
    static setupPatternAnalysis() {
        // This method will be called when errors occur to analyze patterns
        // Implementation integrated into showMessage method
    }

    /**
     * Analyzes error patterns to identify trends and predictive insights.
     *
     * @private
     * @static
     * @function analyzeErrorPatterns
     * @param {string} errorKey - Current error key
     * @param {Object} context - Current error context
     * @returns {Object} Pattern analysis results
     * @since 2.04.35
     */
    static analyzeErrorPatterns(errorKey, context) {
        // Safely handle undefined context
        const safeContext = context || { tab: 'unknown', modal: null, timestamp: Date.now() };
        const patternKey = `${errorKey}_${safeContext.tab || 'unknown'}`;

        const pattern = this.errorAnalytics.patterns.get(patternKey) || {
            count: 0,
            contexts: [],
            timePatterns: [],
            userActions: []
        };

        pattern.count++;
        pattern.contexts.push(safeContext);
        pattern.timePatterns.push({
            timestamp: Date.now(),
            dayOfWeek: new Date().getDay(),
            hourOfDay: new Date().getHours()
        });

        this.errorAnalytics.patterns.set(patternKey, pattern);

        return {
            isRecurring: pattern.count > 3,
            frequency: pattern.count,
            commonContext: this.findCommonContext(pattern.contexts),
            timePattern: this.analyzeTimePattern(pattern.timePatterns),
            suggestedPreventive: this.suggestPreventiveMeasures(patternKey, pattern)
        };
    }

    /**
     * Finds common context patterns in error occurrences.
     *
     * @private
     * @static
     * @function findCommonContext
     * @param {Object[]} contexts - Array of error contexts
     * @returns {Object} Common context analysis
     * @since 2.04.35
     */
    static findCommonContext(contexts) {
        const contextCounts = {};
        contexts.forEach(ctx => {
            const key = `${ctx.tab}_${ctx.modal || 'none'}`;
            contextCounts[key] = (contextCounts[key] || 0) + 1;
        });

        const mostCommon = Object.entries(contextCounts)
            .sort((a, b) => b[1] - a[1])[0];

        return mostCommon ? {
            pattern: mostCommon[0],
            frequency: mostCommon[1]
        } : null;
    }

    /**
     * Analyzes temporal patterns in error occurrences.
     *
     * @private
     * @static
     * @function analyzeTimePattern
     * @param {Object[]} timePatterns - Array of time data
     * @returns {Object} Time pattern analysis
     * @since 2.04.35
     */
    static analyzeTimePattern(timePatterns) {
        if (timePatterns.length < 3) return null;

        const dayFrequency = {};
        const hourFrequency = {};

        timePatterns.forEach(tp => {
            dayFrequency[tp.dayOfWeek] = (dayFrequency[tp.dayOfWeek] || 0) + 1;
            hourFrequency[tp.hourOfDay] = (hourFrequency[tp.hourOfDay] || 0) + 1;
        });

        return {
            commonDay: Object.entries(dayFrequency).sort((a, b) => b[1] - a[1])[0],
            commonHour: Object.entries(hourFrequency).sort((a, b) => b[1] - a[1])[0]
        };
    }

    /**
     * Suggests preventive measures based on error patterns.
     *
     * @private
     * @static
     * @function suggestPreventiveMeasures
     * @param {string} patternKey - Pattern identifier
     * @param {Object} pattern - Pattern data
     * @returns {string[]} Array of preventive suggestions
     * @since 2.04.35
     */
    static suggestPreventiveMeasures(patternKey, pattern) {
        const suggestions = [];

        if (pattern.count > 5) {
            if (patternKey.includes('AUTH_PIN')) {
                suggestions.push('Consider reviewing your PIN entry habits or PIN complexity');
            } else if (patternKey.includes('STORAGE')) {
                suggestions.push('Set up regular data exports to prevent storage issues');
            } else if (patternKey.includes('VOICE')) {
                suggestions.push('Check microphone permissions and browser compatibility');
            }
        }

        return suggestions;
    }

    /**
     * Sets up suggestion effectiveness tracking.
     *
     * @private
     * @static
     * @function setupSuggestionTracking
     * @returns {void}
     * @since 2.04.35
     */
    static setupSuggestionTracking() {
        // Track when users follow suggestions
        document.addEventListener('click', (event) => {
            const target = event.target;

            // Track suggestion button clicks
            if (target.matches('.error-suggestion-action')) {
                this.recordSuggestionUsage(target.dataset.suggestion, 'clicked');
            }

            // Track if actions following suggestions are successful
            if (target.matches('[data-action]')) {
                this.trackActionSuccess(target.dataset.action);
            }
        });
    }

    /**
     * Records suggestion usage for effectiveness analysis.
     *
     * @private
     * @static
     * @function recordSuggestionUsage
     * @param {string} suggestion - Suggestion identifier
     * @param {string} action - Action taken ('clicked', 'ignored', 'successful')
     * @since 2.04.35
     */
    static recordSuggestionUsage(suggestion, action) {
        const key = `suggestion_${suggestion}`;
        const data = this.errorAnalytics.suggestionEffectiveness.get(key) || {
            total: 0,
            clicked: 0,
            successful: 0,
            ignored: 0
        };

        data.total++;
        data[action] = (data[action] || 0) + 1;

        this.errorAnalytics.suggestionEffectiveness.set(key, data);
    }

    /**
     * Tracks action success following suggestions.
     *
     * @private
     * @static
     * @function trackActionSuccess
     * @param {string} action - Action that was performed
     * @since 2.04.35
     */
    static trackActionSuccess(action) {
        // This would be enhanced with actual success detection
        // For now, we assume actions are successful if no errors follow within 10 seconds
        setTimeout(() => {
            const recentErrors = this.errorHistory.filter(
                error => error.timestamp > Date.now() - 10000
            );

            if (recentErrors.length === 0) {
                this.recordSuggestionUsage('recent', 'successful');
            }
        }, 10000);
    }

    /**
     * Starts session-based analytics tracking.
     *
     * @private
     * @static
     * @function startSessionAnalytics
     * @returns {void}
     * @since 2.04.35
     */
    static startSessionAnalytics() {
        this.errorAnalytics.sessionData.startTime = Date.now();

        // Track session metrics periodically
        setInterval(() => {
            this.updateSessionMetrics();
        }, 60000); // Update every minute

        // Save analytics on page unload
        window.addEventListener('beforeunload', () => {
            this.saveAnalyticsData();
        });
    }

    /**
     * Updates session analytics metrics.
     *
     * @private
     * @static
     * @function updateSessionMetrics
     * @returns {void}
     * @since 2.04.35
     */
    static updateSessionMetrics() {
        const session = this.errorAnalytics.sessionData;
        session.errorCount = this.errorHistory.length;

        // Calculate recovery success rate
        const recoveryAttempts = this.errorHistory.filter(
            error => error.category === 'recovery'
        ).length;

        session.recoverySuccessRate = recoveryAttempts > 0
            ? (recoveryAttempts / session.errorCount) * 100
            : 100;
    }

    /**
     * Detects currently active modal dialogs for context awareness.
     *
     * @private
     * @static
     * @function detectActiveModal
     * @returns {string|null} Active modal type or null if none
     * @since 2.04.35
     */
    static detectActiveModal() {
        const pinOverlay = document.querySelector('#pinOverlay');
        if (pinOverlay && pinOverlay.style.display !== 'none') {
            return 'pin';
        }

        const goalDialog = document.querySelector('.pin-overlay:not(#pinOverlay)');
        if (goalDialog && goalDialog.style.display !== 'none') {
            return 'goal';
        }

        const anyVisibleOverlay = document.querySelector('.pin-overlay[style*="display: flex"], .pin-overlay[style*="display: block"]');
        if (anyVisibleOverlay) {
            return 'overlay';
        }

        return null;
    }

    /**
     * Gets current user context for analytics.
     *
     * @private
     * @static
     * @function getCurrentContext
     * @returns {Object} Current context information
     * @since 2.04.35
     */
    static getCurrentContext() {
        return {
            tab: getActiveAppTab(),
            modal: this.detectActiveModal(),
            timestamp: Date.now(),
            sessionDuration: this.errorAnalytics?.sessionData?.startTime
                ? Date.now() - this.errorAnalytics.sessionData.startTime
                : 0
        };
    }

    /**
     * Generates personalized suggestions based on learned patterns.
     *
     * @static
     * @function generatePersonalizedSuggestions
     * @param {string} errorKey - Error template key
     * @param {Object} data - Error data
     * @param {Object} context - Current context
     * @returns {string[]} Array of personalized suggestions
     * @since 2.04.35
     */
    static generatePersonalizedSuggestions(errorKey, data, context) {
        const patterns = this.analyzeErrorPatterns(errorKey, context);
        const suggestions = [];

        // Add pattern-based suggestions
        if (patterns.isRecurring) {
            suggestions.push(`This seems to happen often. ${patterns.suggestedPreventive.join(', ')}`);
        }

        // Add time-based suggestions
        if (patterns.timePattern && patterns.timePattern.commonHour) {
            const hour = patterns.timePattern.commonHour[0];
            if (hour < 6 || hour > 22) {
                suggestions.push('Tip: Complex tasks work better during regular hours when you\'re more alert.');
            }
        }

        // Add effectiveness-based suggestions
        const effectiveSuggestions = this.getMostEffectiveSuggestions(errorKey);
        suggestions.push(...effectiveSuggestions);

        return suggestions.slice(0, 3); // Limit to top 3 suggestions
    }

    /**
     * Gets most effective suggestions based on analytics.
     *
     * @private
     * @static
     * @function getMostEffectiveSuggestions
     * @param {string} errorKey - Error template key
     * @returns {string[]} Array of effective suggestions
     * @since 2.04.35
     */
    static getMostEffectiveSuggestions(errorKey) {
        const suggestions = [];

        // Analyze suggestion effectiveness data
        for (const [key, data] of this.errorAnalytics.suggestionEffectiveness) {
            if (key.includes(errorKey) && data.total > 0) {
                const effectivenessRate = (data.successful / data.total) * 100;
                if (effectivenessRate > 60) {
                    suggestions.push(`Previous users found success with: ${key.replace('suggestion_', '')}`);
                }
            }
        }

        return suggestions;
    }

    // ================================
    // COMPREHENSIVE ERROR DOCUMENTATION & HELP SYSTEM
    // ================================

    /**
     * Shows contextual help based on current user situation and error patterns.
     *
     * This intelligent help system analyzes the user's current context, recent errors,
     * and behavioral patterns to provide targeted, relevant assistance. It adapts
     * help content based on user expertise level and provides escalating support options.
     *
     * **Help Features:**
     * - Contextual help based on current tab and user activity
     * - Error-specific troubleshooting guides
     * - Progressive assistance (basic → intermediate → advanced)
     * - Quick action buttons for common solutions
     * - Integration with error analytics for personalized help
     * - Multi-level support escalation system
     *
     * @static
     * @async
     * @function showContextualHelp
     * @param {string} [context] - Specific context or error type to show help for
     * @param {Object} [options] - Help display options
     * @param {boolean} [options.autoDetect=true] - Whether to auto-detect help needed
     * @param {string} [options.level='basic'] - Help complexity level ('basic', 'intermediate', 'advanced')
     * @returns {Promise<void>}
     * @since 2.04.35
     * @example
     * // Show general contextual help
     * await ErrorMessenger.showContextualHelp();
     *
     * // Show specific help for PIN issues
     * await ErrorMessenger.showContextualHelp('pin', { level: 'intermediate' });
     */
    static async showContextualHelp(context = null, options = {}) {
        const {
            autoDetect = true,
            level = 'basic'
        } = options;

        let helpContext = context;

        // Auto-detect help context if not specified
        if (!helpContext && autoDetect) {
            helpContext = this.detectHelpContext();
        }

        // Generate help content based on context
        const helpContent = this.generateHelpContent(helpContext, level);

        // Show help with appropriate template
        await this.showInfo(helpContent.templateKey, helpContent.data, {
            duration: 0, // Persistent help
            persistent: true
        });

        // Record help usage for analytics
        if (this.errorAnalytics) {
            this.recordBehavior('help_requested', {
                context: helpContext,
                level,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Detects what type of help the user might need based on current context and recent errors.
     *
     * @private
     * @static
     * @function detectHelpContext
     * @returns {string} Detected help context
     * @since 2.04.35
     */
    static detectHelpContext() {
        // Check recent errors for common issues
        const recentErrors = this.errorHistory.slice(-5);

        // Analyze error patterns
        const errorTypes = recentErrors.map(error => error.key);

        if (errorTypes.some(type => type.includes('PIN') || type.includes('AUTH'))) {
            return 'pin';
        }

        if (errorTypes.some(type => type.includes('VOICE') || type.includes('RECORD'))) {
            return 'voice';
        }

        if (errorTypes.some(type => type.includes('STORAGE') || type.includes('SAVE'))) {
            return 'storage';
        }

        if (errorTypes.some(type => type.includes('IMPORT') || type.includes('EXPORT'))) {
            return 'import_export';
        }

        // Check current tab for contextual help
        const currentTab = getActiveAppTab();

        switch (currentTab) {
            case 'settings':
                return 'import_export';
            case 'journal':
                return 'general';
            default:
                return 'general';
        }
    }

    /**
     * Generates comprehensive help content based on context and user level.
     *
     * @private
     * @static
     * @function generateHelpContent
     * @param {string} context - Help context
     * @param {string} level - User expertise level
     * @returns {Object} Help content with template key and data
     * @since 2.04.35
     */
    static generateHelpContent(context, level) {
        const helpMap = {
            'pin': 'HELP_PIN_ISSUES',
            'voice': 'HELP_VOICE_ISSUES',
            'storage': 'HELP_STORAGE_ISSUES',
            'import_export': 'HELP_IMPORT_EXPORT',
            'browser': 'HELP_BROWSER_COMPATIBILITY',
            'performance': 'HELP_PERFORMANCE_TIPS',
            'recovery': 'HELP_DATA_RECOVERY',
            'general': 'HELP_GENERAL_ERROR'
        };

        const templateKey = helpMap[context] || 'HELP_GENERAL_ERROR';

        // Enhance help content based on user level and analytics
        const data = this.enhanceHelpWithAnalytics(context, level);

        return {
            templateKey,
            data
        };
    }

    /**
     * Enhances help content with personalized analytics insights.
     *
     * @private
     * @static
     * @function enhanceHelpWithAnalytics
     * @param {string} context - Help context
     * @param {string} level - User expertise level
     * @returns {Object} Enhanced help data
     * @since 2.04.35
     */
    static enhanceHelpWithAnalytics(context, level) {
        const data = {};

        if (!this.errorAnalytics) {
            return data;
        }

        // Add personalized insights based on user's error patterns
        const userPatterns = this.getUserErrorPatterns(context);

        if (userPatterns.commonIssues.length > 0) {
            data.personalizedTips = userPatterns.commonIssues.map(issue =>
                `You've encountered ${issue.type} ${issue.count} times - ${this.getSpecificAdvice(issue.type)}`
            );
        }

        // Add time-based recommendations
        if (userPatterns.timePattern) {
            data.timingAdvice = this.getTimingAdvice(userPatterns.timePattern);
        }

        // Add level-appropriate complexity
        data.complexity = level;

        return data;
    }

    /**
     * Gets user's error patterns for specific context.
     *
     * @private
     * @static
     * @function getUserErrorPatterns
     * @param {string} context - Error context to analyze
     * @returns {Object} User error patterns
     * @since 2.04.35
     */
    static getUserErrorPatterns(context) {
        const patterns = {
            commonIssues: [],
            timePattern: null
        };

        if (!this.errorAnalytics || !this.errorAnalytics.patterns) {
            return patterns;
        }

        // Analyze patterns related to the context
        for (const [key, pattern] of this.errorAnalytics.patterns) {
            if (key.toLowerCase().includes(context)) {
                patterns.commonIssues.push({
                    type: key.split('_')[0],
                    count: pattern.count,
                    context: pattern.contexts[0]
                });
            }
        }

        // Sort by frequency
        patterns.commonIssues.sort((a, b) => b.count - a.count);

        return patterns;
    }

    /**
     * Gets specific advice for recurring error types.
     *
     * @private
     * @static
     * @function getSpecificAdvice
     * @param {string} errorType - Type of recurring error
     * @returns {string} Specific advice
     * @since 2.04.35
     */
    static getSpecificAdvice(errorType) {
        const advice = {
            'AUTH': 'try using a different PIN pattern or check if Caps Lock is on',
            'VOICE': 'check your browser permissions and try using Chrome or Edge',
            'STORAGE': 'consider exporting old dreams and clearing browser cache',
            'IMPORT': 'verify your file format and try smaller files first',
            'EXPORT': 'ensure you have enough storage space and try a different location'
        };

        return advice[errorType] || 'review the troubleshooting guide above';
    }

    /**
     * Gets timing-based advice for user patterns.
     *
     * @private
     * @static
     * @function getTimingAdvice
     * @param {Object} timePattern - User's time-based error patterns
     * @returns {string} Timing advice
     * @since 2.04.35
     */
    static getTimingAdvice(timePattern) {
        if (timePattern.commonHour && (timePattern.commonHour[0] < 6 || timePattern.commonHour[0] > 22)) {
            return 'You tend to have issues during late/early hours. Complex tasks might work better during regular daytime hours.';
        }

        if (timePattern.commonDay && timePattern.commonDay[0] == 0) { // Sunday
            return 'Issues seem to occur on weekends. This might be due to different usage patterns or network conditions.';
        }

        return null;
    }

    /**
     * Creates a comprehensive help center with searchable content and guided tutorials.
     *
     * @static
     * @async
     * @function showHelpCenter
     * @returns {Promise<void>}
     * @since 2.04.35
     * @example
     * // Show full help center
     * await ErrorMessenger.showHelpCenter();
     */
    static async showHelpCenter() {
        // This would create a comprehensive help interface
        // For now, show general help with links to specific sections
        await this.showInfo('HELP_GENERAL_ERROR', {
            sections: [
                'PIN & Security Issues',
                'Voice Recording Problems',
                'Data Storage & Backup',
                'Import/Export Guide',
                'Browser Compatibility',
                'Performance Optimization',
                'Data Recovery Options'
            ]
        }, {
            duration: 0,
            persistent: true
        });
    }

    /**
     * Shows quick help tooltip for specific UI elements.
     *
     * @static
     * @function showQuickHelp
     * @param {string} element - UI element identifier
     * @param {HTMLElement} target - Target element for positioning
     * @returns {void}
     * @since 2.04.35
     * @example
     * // Show quick help for voice recording button
     * ErrorMessenger.showQuickHelp('voice_recording', buttonElement);
     */
    static showQuickHelp(element, target) {
        const quickHelpContent = {
            'voice_recording': 'Click to start/stop voice recording. Requires microphone permission and Chrome/Edge browser.',
            'pin_setup': 'Create a 4-6 digit PIN to protect your dreams. You\'ll need this PIN each time you open the app.',
            'export_data': 'Download a backup of all your dreams and settings. Recommended monthly for data safety.',
            'search_dreams': 'Search through your dream titles, content, tags, and emotions. Use quotes for exact phrases.',
            'dream_categories': 'Organize dreams by type: normal, lucid, nightmare, or custom categories you create.'
        };

        const content = quickHelpContent[element] || 'No help available for this element.';

        // Show as a temporary tooltip-style message
        createInlineMessage('info', content, {
            container: target.parentElement,
            position: 'below',
            duration: 5000
        });
    }

    /**
     * Records help usage and effectiveness for improving help content.
     *
     * @static
     * @function trackHelpEffectiveness
     * @param {string} helpType - Type of help shown
     * @param {string} outcome - User outcome ('resolved', 'still_needed', 'escalated')
     * @returns {void}
     * @since 2.04.35
     */
    static trackHelpEffectiveness(helpType, outcome) {
        if (!this.errorAnalytics) return;

        this.recordBehavior('help_outcome', {
            helpType,
            outcome,
            timestamp: Date.now()
        });
    }
}

// ================================
// ES MODULE EXPORTS
// ================================

export { ErrorMessenger, ERROR_TEMPLATES };