/**
 * @fileoverview Advice Tab Module - Dedicated handler for lucid dreaming tips and advice interface
 * 
 * This module manages all advice tab functionality including:
 * - Advice tab UI generation and layout
 * - Daily tips display system with navigation
 * - Tip-of-the-day calculation based on user's dream history
 * - Static lucid dreaming techniques and general advice sections
 * - Tips JSON loading and state management
 * - Navigation between tips with bounds checking
 * 
 * The advice tab provides users with educational content about lucid dreaming,
 * including daily tips, proven techniques, and general guidance. It features
 * a deterministic tip-of-the-day system that cycles through available tips
 * based on the user's dream journal history.
 * 
 * **Module Dependencies:**
 * - constants.js: Daily tips JSON loading functionality (loadDailyTips)
 * - state.js: Tip index and tips array state management (currentTipIndex, dailyTips)
 * - dom-helpers.js: HTML escaping utilities (escapeHtml) and tab switching
 * - storage.js: Dream data loading for tip calculation (loadDreams)
 * 
 * **Key Features:**
 * - Deterministic tip-of-the-day calculation based on first dream entry date
 * - Safe tip navigation with modulo arithmetic bounds checking
 * - Static educational content display (techniques, general advice)
 * - Responsive tip display interface with counter
 * - Error handling for tip loading and dream data access failures
 * 
 * **Integration Points:**
 * - Uses data-action attributes for event routing via action-router.js
 * - References DOM elements by ID for tip display and navigation
 * - Coordinates with main app initialization sequence
 * 
 * @module advicetab
 * @version 2.02.46
 * @since 2.02.44
 * @author Dream Journal Application
 */

// ================================
// ES MODULE IMPORTS
// ================================
import { loadDailyTips } from './constants.js';
import { setDailyTips, getDailyTips, getCurrentTipIndex, setCurrentTipIndex } from './state.js';
import { escapeHtml, displayTip, handleTipNavigation } from './dom-helpers.js';
import { loadDreams } from './storage.js';

// ================================
// MODULE INITIALIZATION CHECK
// ================================
console.log('Loading Advice Tab Module v2.02.46');

// ================================
// ADVICE TAB UI GENERATION
// ================================

/**
 * Renders the complete advice tab interface with tips and educational content.
 * 
 * This function generates the entire advice tab HTML structure including:
 * - Daily tip display section with navigation controls
 * - Lucid dreaming techniques section (MILD, WBTB, Reality Checks)
 * - General advice section (Sleep optimization, Dream journaling, etc.)
 * - Disclaimer section with medical advice warning
 * 
 * The function creates a comprehensive educational interface that combines
 * dynamic tip content with static educational materials to provide users
 * with both daily inspiration and foundational knowledge about lucid dreaming.
 * 
 * **HTML Structure Generated:**
 * ```html
 * <div class="settings-section">...</div>  <!-- Daily Tip -->
 * <div class="settings-section">...</div>  <!-- Techniques -->
 * <div class="settings-section">...</div>  <!-- General Advice -->
 * <div class="settings-section">...</div>  <!-- Disclaimer -->
 * ```
 * 
 * **Integration Points:**
 * - Uses data-action attributes (prev-tip, next-tip) for event routing
 * - References specific DOM element IDs (tipText, tipCounter, prevTip, nextTip)
 * - Coordinates with tip display system via displayTip function
 * 
 * @param {HTMLElement} tabPanel - The target container element for the advice interface
 * @returns {void}
 * 
 * @example
 * const adviceContainer = document.getElementById('adviceTab');
 * renderAdviceTab(adviceContainer);
 * // Advice interface is now populated with all sections
 * 
 * @since 2.02.44
 */
function renderAdviceTab(tabPanel) {
    tabPanel.innerHTML = `
        <div class="settings-section">
            <h3>💡 Daily Lucid Dreaming Tip</h3>
            <div id="dailyTipContainer" class="card-elevated card-lg text-center">
                <p id="tipText" class="text-lg line-height-loose mb-lg" style="height: 180px; overflow-y: auto;">Loading tip...</p>
                <div class="tip-navigation flex-between">
                    <button id="prevTip" data-action="prev-tip" class="calendar-nav-btn prev" title="Previous Tip"></button>
                    <span id="tipCounter" class="font-semibold text-secondary">Tip 1 / 375</span>
                    <button id="nextTip" data-action="next-tip" class="calendar-nav-btn next" title="Next Tip"></button>
                </div>
            </div>
        </div>

        <div class="settings-section">
            <h3 class="mb-lg">📚 Lucid Dreaming Techniques</h3>
            <div class="grid-auto">
                <div class="stats-card hover-card">
                    <h4 class="text-primary mb-sm">🔄 MILD Technique</h4>
                    <p class="text-secondary text-sm line-height-relaxed">Mnemonic Induction: As you fall asleep, repeat "Next time I'm dreaming, I'll remember I'm dreaming" while visualizing becoming lucid.</p>
                </div>
                <div class="stats-card hover-card">
                    <h4 class="text-primary mb-sm">⏰ WBTB Method</h4>
                    <p class="text-secondary text-sm line-height-relaxed">Wake-Back-to-Bed: Wake up 4-6 hours after sleep, stay awake for 20-30 minutes thinking about lucid dreaming, then return to sleep.</p>
                </div>
                <div class="stats-card hover-card">
                    <h4 class="text-primary mb-sm">✋ Reality Checks</h4>
                    <p class="text-secondary text-sm line-height-relaxed">Daily Habit: Check your hands, read text twice, or look at digital clocks. In dreams, these often appear distorted.</p>
                </div>
            </div>
        </div>

        <div class="settings-section">
            <h3 class="mb-lg">💡 General Advice</h3>
            <div class="grid-auto">
                <div class="stats-card hover-card">
                    <h4 class="text-primary mb-sm">🧘 Sleep Optimization</h4>
                    <p class="text-secondary text-sm line-height-relaxed">Maintain consistent sleep and wake times to improve REM sleep quality and dream recall. Avoid screens 1 hour before bed. Blue light can disrupt melatonin production and dream intensity.</p>
                </div>
                <div class="stats-card hover-card">
                    <h4 class="text-primary mb-sm">📝 Dream Journaling</h4>
                    <p class="text-secondary text-sm line-height-relaxed">Keep a dream journal by your bed. Write down your dreams as soon as you wake up. This improves dream recall and helps you identify recurring dream signs.</p>
                </div>
                <div class="stats-card hover-card">
                    <h4 class="text-primary mb-sm">🥗 Supplements & Nutrition</h4>
                    <p class="text-secondary text-sm line-height-relaxed">Certain supplements like Vitamin B6 can enhance dream vividness. A balanced diet supports overall brain health, which is crucial for dreaming.</p>
                </div>
                <div class="stats-card hover-card">
                    <h4 class="text-primary mb-sm">🤔 Troubleshooting</h4>
                    <p class="text-secondary text-sm line-height-relaxed">If you're struggling, focus on improving dream recall first. Don't get discouraged by dry spells; consistency is key.</p>
                </div>
            </div>
        </div>

        <div class="settings-section">
            <p class="text-secondary text-sm text-center line-height-relaxed">
                <strong>Disclaimer:</strong> This application is for entertainment and personal journaling purposes only. It is not intended to provide medical, psychological, or therapeutic advice. If you have concerns about your sleep, dreams, or mental health, please consult a qualified healthcare professional.
            </p>
        </div>
    `;
}

// Note: displayTip and handleTipNavigation are now imported from dom-helpers.js

// ================================
// ADVICE TAB INITIALIZATION SYSTEM
// ================================

/**
 * Initialize advice tab with deterministic tip of the day calculation.
 * 
 * This function loads daily tips from the JSON configuration and calculates which tip
 * to display based on the number of days since the user's first dream entry. This ensures
 * that users see a consistent "tip of the day" that advances daily but remains deterministic.
 * If no dreams exist, defaults to displaying tip 1 (index 0).
 * 
 * The calculation uses the earliest dream entry date as an epoch, then calculates the
 * number of days between that epoch and today, using modulo arithmetic to cycle through
 * the available tips.
 * 
 * @async
 * @function
 * @returns {Promise<void>} Promise that resolves when advice tab is initialized
 * @throws {Error} When daily tips JSON cannot be loaded
 * @since 2.0.0
 * @example
 * await initializeAdviceTab();
 * // Advice tab now displays deterministic tip based on user's dream history
 */
async function initializeAdviceTab() {
    // Load tips from JSON file and store globally
    setDailyTips(await loadDailyTips());
    if (!getDailyTips() || getDailyTips().length === 0) {
        return;
    }

    // Try to get the first dream entry date as epoch
    let epoch;
    let tipOfTheDayIndex = 0; // Default to tip 1 (index 0)
    
    try {
        const dreams = await loadDreams();
        if (dreams && dreams.length > 0) {
            // Find the earliest dream date
            const dreamDates = dreams
                .map(dream => new Date(dream.timestamp))
                .filter(date => !isNaN(date.getTime())) // Filter out invalid dates
                .sort((a, b) => a - b);
            
            if (dreamDates.length > 0) {
                epoch = dreamDates[0];
                const now = new Date();
                const diffTime = now - epoch;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                tipOfTheDayIndex = diffDays % getDailyTips().length;
            }
        }
    } catch (error) {
        console.warn('Error loading dreams for tip calculation, using default tip 1:', error);
    }
    
    displayTip(tipOfTheDayIndex);
}

// ================================
// ADVICE TAB UNIFIED INITIALIZATION
// ================================

/**
 * Initializes the advice tab when it becomes active.
 * 
 * This function coordinates the complete initialization of all advice tab components
 * including tip loading, tip-of-the-day calculation, and UI setup. Called whenever 
 * the advice tab is switched to or needs to be refreshed.
 * 
 * **Initialization Sequence:**
 * 1. Load daily tips from JSON file
 * 2. Calculate tip-of-the-day based on dream history
 * 3. Display the calculated tip
 * 4. Handle any errors gracefully
 * 
 * This is the main entry point for advice tab functionality and should be called
 * from the main application when users navigate to the advice tab.
 * 
 * @async
 * @returns {Promise<void>} Promise that resolves when advice tab is fully initialized
 * 
 * @example
 * // Called when switching to advice tab
 * await initializeAdviceTabComplete();
 * // Advice tab is now fully functional with tip-of-the-day displayed
 * 
 * @since 2.02.44
 */
async function initializeAdviceTabComplete() {
    try {
        await initializeAdviceTab();
        console.log('Advice tab initialized successfully');
    } catch (error) {
        console.error('Error initializing advice tab:', error);
        // Show user-friendly error message
        const tipTextElement = document.getElementById('tipText');
        if (tipTextElement) {
            tipTextElement.innerHTML = `
                <div class="text-center">
                    <h4 class="text-primary mb-md">Tips Temporarily Unavailable</h4>
                    <p class="text-secondary">There was an error loading the daily tips. Please refresh the page and try again.</p>
                    <p class="text-sm">Error details: ${escapeHtml(error.message)}</p>
                </div>
            `;
        }
        // Update counter to show error state
        const tipCounterElement = document.getElementById('tipCounter');
        if (tipCounterElement) {
            tipCounterElement.textContent = 'Error loading tips';
        }
    }
}

// ================================
// ES MODULE EXPORTS
// ================================

/**
 * Public API exports for the Advice Tab Module.
 * 
 * These functions are exported using ES module syntax to maintain clean module
 * boundaries and allow proper dependency management in the ES module system.
 * 
 * @since 2.02.44
 */

export { 
    renderAdviceTab, 
    initializeAdviceTabComplete as initializeAdviceTab
};

// ================================
// MODULE LOADING COMPLETE
// ================================
console.log('Advice Tab Module loaded successfully - functions available via ES module imports');