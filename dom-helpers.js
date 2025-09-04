    // ===================================================================================
    // SECTION 3: DOM & UI HELPERS
    // ===================================================================================

    // DOM Helper Functions (defined early to be available everywhere)

    // Create action button with consistent data attributes
    function createActionButton(action, id, text, className = 'btn', extraAttrs = {}) {
        const attrs = Object.entries(extraAttrs)
            .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
            .join(' ');
        
        const idAttr = id ? `data-${action.includes('dream') ? 'dream' : 'voice-note'}-id="${escapeAttr(id)}"` : '';
        
        return `<button data-action="${action}" ${idAttr} class="${className}" ${attrs}>${text}</button>`;
    }

    // Create inline message with consistent styling
    function createInlineMessage(type, text, options = {}) {
        const {
            container = null,
            position = 'top', // 'top' or 'bottom'
            autoHide = true,
            duration = type === 'success' ? 3000 : 5000,
            className = ''
        } = options;
        
        const msg = document.createElement('div');
        msg.className = `message-base message-${type} ${className}`.trim();
        msg.textContent = text;
        
        if (container) {
            if (position === 'top') {
                container.insertBefore(msg, container.firstChild);
            } else {
                container.appendChild(msg);
            }
            
            if (autoHide) {
                setTimeout(() => {
                    if (msg && msg.parentNode) {
                        msg.remove();
                    }
                }, duration);
            }
        }
        
        return msg;
    }

    // Create meta information display
    function createMetaDisplay(items) {
        return items
            .filter(item => item && item.value)
            .map(item => {
                if (item.label) {
                    return `<span class="meta-item">${escapeHtml(item.label)}: ${escapeHtml(item.value)}</span>`;
                } else {
                    return `<span class="meta-item">${escapeHtml(item.value)}</span>`;
                }
            })
            .join(' • ');
    }

    // HTML escape function to prevent XSS
    function escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    // HTML escape for attributes (quotes and special chars)
    function escapeAttr(text) {
        if (text == null) return '';
        return String(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Create pagination HTML
    function createPaginationHTML(currentPage, totalPages, actionPrefix) {
        if (totalPages <= 1) return '';
        
        let paginationHTML = '<div class="pagination">';
        
        // Previous button
        if (currentPage > 1) {
            paginationHTML += `<button data-action="${actionPrefix}" data-page="${currentPage - 1}" class="btn btn-outline btn-small">‹ Previous</button>`;
        }
        
        // Page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // Adjust start page if we're near the end
        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // First page and ellipsis
        if (startPage > 1) {
            paginationHTML += `<button data-action="${actionPrefix}" data-page="1" class="btn btn-outline btn-small">1</button>`;
            if (startPage > 2) {
                paginationHTML += '<span class="pagination-ellipsis">...</span>';
            }
        }
        
        // Page number buttons
        for (let i = startPage; i <= endPage; i++) {
            const isCurrentPage = i === currentPage;
            const buttonClass = isCurrentPage ? 'btn btn-primary btn-small' : 'btn btn-outline btn-small';
            paginationHTML += `<button data-action="${actionPrefix}" data-page="${i}" class="${buttonClass}" ${isCurrentPage ? 'disabled' : ''}>${i}</button>`;
        }
        
        // Last page and ellipsis
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += '<span class="pagination-ellipsis">...</span>';
            }
            paginationHTML += `<button data-action="${actionPrefix}" data-page="${totalPages}" class="btn btn-outline btn-small">${totalPages}</button>`;
        }
        
        // Next button
        if (currentPage < totalPages) {
            paginationHTML += `<button data-action="${actionPrefix}" data-page="${currentPage + 1}" class="btn btn-outline btn-small">Next ›</button>`;
        }
        
        paginationHTML += '</div>';
        return paginationHTML;
    }

    // ADVICE TAB FUNCTIONS
    function displayTip(index) {
        const tipTextElement = document.getElementById('tipText');
        const tipCounterElement = document.getElementById('tipCounter');

        if (tipTextElement && tipCounterElement && dailyTips && dailyTips.length > 0) {
            // Ensure index is within bounds and handle negative numbers
            const safeIndex = ((index % dailyTips.length) + dailyTips.length) % dailyTips.length;

            const tip = dailyTips[safeIndex];
            tipTextElement.innerHTML = `<h4 class="text-primary mb-md">${escapeHtml(tip.category)}</h4><p class="line-height-loose">${escapeHtml(tip.text)}</p>`;
            tipCounterElement.textContent = `${safeIndex + 1} / ${dailyTips.length}`;
            currentTipIndex = safeIndex;
        }
    }

    function handleTipNavigation(direction) {
        let newIndex = currentTipIndex;
        if (direction === 'next') {
            newIndex++;
        } else {
            newIndex--;
        }
        displayTip(newIndex);
    }

    // THEME MANAGEMENT SYSTEM

    // Get current theme from storage or default to dark
    function getCurrentTheme() {
        if (isLocalStorageAvailable()) {
            return localStorage.getItem('dreamJournalTheme') || 'dark';
        }
        return 'dark';
    }

    // Store theme preference
    function storeTheme(theme) {
        if (isLocalStorageAvailable()) {
            try {
                localStorage.setItem('dreamJournalTheme', theme);
            } catch (error) {
                console.warn('Failed to store theme preference:', error);
            }
        }
    }

    // Apply theme to document
    function applyTheme(theme) {
        if (!theme || !['light', 'dark'].includes(theme)) {
            theme = 'dark';
        }
        
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update theme select if it exists
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.value = theme;
        }
        
        storeTheme(theme);
    }

    // Switch theme
    function switchTheme(newTheme) {
        if (!newTheme || !['light', 'dark'].includes(newTheme)) {
            return;
        }
        
        applyTheme(newTheme);
        
        // Update any visible theme selects
        const themeSelects = document.querySelectorAll('#themeSelect');
        themeSelects.forEach(select => {
            if (select.value !== newTheme) {
                select.value = newTheme;
            }
        });
        
        // Show feedback specifically in the Appearance settings section
        const appearanceSection = document.querySelector('.settings-section h3');
        let targetContainer = null;
        
        if (appearanceSection && appearanceSection.textContent.includes('Appearance')) {
            targetContainer = appearanceSection.parentElement;
        }
        
        // Fallback to active tab if appearance section not found
        if (!targetContainer) {
            targetContainer = document.querySelector('.tab-panel.active');
        }
        
        if (targetContainer) {
            // Remove any existing theme messages first
            const existingMsg = targetContainer.querySelector('.theme-feedback-message');
            if (existingMsg) {
                existingMsg.remove();
            }
            
            // Create the message element directly for precise placement
            const msgDiv = document.createElement('div');
            msgDiv.className = 'theme-feedback-message';
            msgDiv.style.cssText = `
                background: var(--notification-success-bg);
                color: var(--success-color);
                padding: 10px 15px;
                border-radius: var(--border-radius);
                margin: 10px 0;
                font-weight: var(--font-weight-semibold);
                text-align: center;
                font-size: 14px;
            `;
            msgDiv.textContent = `Switched to ${newTheme} theme!`;
            
            // Find the appearance section and insert after it
            if (appearanceSection && appearanceSection.textContent.includes('Appearance')) {
                const appearanceDiv = appearanceSection.parentElement;
                appearanceDiv.insertBefore(msgDiv, appearanceDiv.children[1]);
            } else {
                // Fallback to inserting at the top
                targetContainer.insertBefore(msgDiv, targetContainer.firstChild);
            }
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                if (msgDiv && msgDiv.parentNode) {
                    msgDiv.remove();
                }
            }, 3000);
        }
    }

    // Switch main app tabs
    function switchAppTab(tabName) {
        if (!tabName || !['journal', 'goals', 'stats', 'advice', 'settings', 'lock'].includes(tabName)) return;
        
        // Handle lock screen transitions
        if (tabName === 'lock') {
            // Switching TO lock screen
            if (!isAppLocked) {
                preLockActiveTab = activeAppTab; // Remember current tab
                isAppLocked = true;
                hideAllTabButtons();
            }
        } else {
            // Switching FROM lock screen to another tab
            if (isAppLocked) {
                isAppLocked = false;
                showAllTabButtons();
            }
        }
        
        // Update the lock tab button visibility based on app state
        const lockTabButton = document.querySelector('.app-tab[data-tab="lock"]');
        if (lockTabButton) {
            if (tabName === 'lock') {
                // Show lock tab button when on lock screen
                lockTabButton.style.display = 'block';
            } else {
                // Hide lock tab button when not on lock screen (users should use lock button instead)
                lockTabButton.style.display = 'none';
            }
        }
        
        // CRITICAL FIX: Ensure tab container exists with robust fallback
        let tabContainer = document.querySelector('.tab-content-container');
        if (!tabContainer) {
            console.warn('Tab container not found during switchAppTab, attempting to create it');
            
            const containerDiv = document.querySelector('.container');
            const appTabs = document.querySelector('.app-tabs');
            
            if (containerDiv && appTabs) {
                tabContainer = document.createElement('div');
                tabContainer.className = 'tab-content-container';
                tabContainer.style.cssText = `
                    background: var(--bg-primary);
                    min-height: 400px;
                    overflow-x: hidden;
                `;
                
                appTabs.parentNode.insertBefore(tabContainer, appTabs.nextSibling);
                console.log('Tab container created during switchAppTab');
            } else {
                console.error('Cannot create tab container - missing DOM elements');
                return;
            }
        }
        
        // Ensure all tab panels exist
        const requiredTabs = ['journalTab', 'goalsTab', 'statsTab', 'adviceTab', 'settingsTab', 'lockTab'];
        requiredTabs.forEach(tabId => {
            if (!document.getElementById(tabId)) {
                const tabPanel = document.createElement('div');
                tabPanel.id = tabId;
                tabPanel.className = 'tab-panel';
                
                if (tabId === 'goalsTab') {
                    tabPanel.innerHTML = `
                        <div class="settings-section">
                            <div class="flex-between mb-lg">
                                <h3>🎯 Your Dream Goals</h3>
                                <button data-action="create-goal" class="btn btn-primary btn-small">➕ New Goal</button>
                            </div>
                            <div id="activeGoalsContainer">
                                <!-- Active goals will be populated here -->
                            </div>
                            <div id="activeGoalsPagination" class="pagination-container" style="display: none;">
                                <!-- Active goals pagination will be populated here -->
                            </div>
                            <div id="noGoalsMessage" class="card-md text-center" style="display: none;">
                                <div class="icon-lg mb-md">🎯</div>
                                <h4 class="mb-sm">No Active Goals</h4>
                                <p class="text-secondary mb-md">Create your first goal to start tracking your lucid dreaming progress!</p>
                                <button data-action="create-goal" class="btn btn-primary">Create Your First Goal</button>
                            </div>
                        </div>
                        
                        <div class="settings-section">
                            <h3>📈 Quick Goal Templates</h3>
                            <div class="grid-auto">
                                <div class="stats-card hover-card" data-action="create-template-goal" data-template="lucid-monthly">
                                    <div class="icon-lg">✨</div>
                                    <div class="stats-label">Monthly Lucid Goals</div>
                                    <div class="stats-detail">Track lucid dreams per month</div>
                                    <button class="btn btn-outline btn-small mt-sm">Use Template</button>
                                </div>
                                <div class="stats-card hover-card" data-action="create-template-goal" data-template="recall-streak">
                                    <div class="icon-lg">🧠</div>
                                    <div class="stats-label">Dream Recall Streak</div>
                                    <div class="stats-detail">Remember dreams daily</div>
                                    <button class="btn btn-outline btn-small mt-sm">Use Template</button>
                                </div>
                                <div class="stats-card hover-card" data-action="create-template-goal" data-template="journal-habit">
                                    <div class="icon-lg">📝</div>
                                    <div class="stats-label">Journaling Habit</div>
                                    <div class="stats-detail">Write consistently</div>
                                    <button class="btn btn-outline btn-small mt-sm">Use Template</button>
                                </div>
                                <div class="stats-card hover-card" data-action="create-template-goal" data-template="dream-signs">
                                    <div class="icon-lg">🔍</div>
                                    <div class="stats-label">Dream Signs Tracking</div>
                                    <div class="stats-detail">Identify recurring patterns</div>
                                    <button class="btn btn-outline btn-small mt-sm">Use Template</button>
                                </div>
                                <div class="stats-card hover-card" data-action="create-template-goal" data-template="custom">
                                    <div class="icon-lg">⭐</div>
                                    <div class="stats-label">Custom Goal</div>
                                    <div class="stats-detail">Manual progress tracking</div>
                                    <button class="btn btn-outline btn-small mt-sm">Use Template</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="settings-section">
                            <h3>🏆 Completed Goals</h3>
                            <div id="completedGoalsContainer">
                                <!-- Completed goals will be populated here -->
                            </div>
                            <div id="completedGoalsPagination" class="pagination-container" style="display: none;">
                                <!-- Completed goals pagination will be populated here -->
                            </div>
                            <div id="noCompletedGoalsMessage" class="text-center text-secondary p-lg" style="display: none;">
                                <div class="icon-lg mb-sm">🏆</div>
                                <p>Your completed goals will appear here</p>
                            </div>
                        </div>
                    `;
                } else if (tabId === 'statsTab') {
                    tabPanel.innerHTML = `
                        <div id="statsContainer">
                            <div id="calendarContainer" class="card-md mb-lg">
                                <!-- Calendar will be generated here -->
                                <div class="loading-state"></div>
                            </div>
                            
                            <!-- Stats Tabs Navigation -->
                            <div class="stats-tabs">
                                <button class="stats-tab active" data-action="switch-stats-tab" data-tab="month">
                                    📅 Month
                                </button>
                                <button class="stats-tab" data-action="switch-stats-tab" data-tab="year">
                                    📆 Year
                                </button>
                                <button class="stats-tab" data-action="switch-stats-tab" data-tab="lifetime">
                                    🏆 Lifetime
                                </button>
                                <button class="stats-tab" data-action="switch-stats-tab" data-tab="dream-signs">
                                    ⚡ Dream Signs
                                </button>
                            </div>
                            
                            <!-- Stats Tab Content -->
                            <div class="stats-tab-content">
                                <!-- Month Tab -->
                                <div id="statsTabMonth" class="stats-tab-panel active">
                                    <div class="stats-grid">
                                        <div id="monthlyStatsContainer" class="card-md">
                                            <!-- Monthly stats will be generated here -->
                                            <h3 class="text-primary mb-md">Monthly Stats</h3>
                                            <div class="loading-state"></div>
                                        </div>
                                        <div id="pieChartContainer" class="card-md">
                                            <!-- Pie chart will be generated here -->
                                            <h3 class="text-primary mb-md">Dream Types</h3>
                                            <div class="loading-state"></div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Year Tab -->
                                <div id="statsTabYear" class="stats-tab-panel" style="display: none;">
                                    <div class="stats-grid">
                                        <div id="yearlyStatsContainer" class="card-md">
                                            <!-- Yearly stats will be generated here -->
                                            <h3 class="text-primary mb-md">Yearly Stats</h3>
                                            <div class="loading-state">Loading yearly stats...</div>
                                        </div>
                                        <div id="yearlyPieChartContainer" class="card-md">
                                            <!-- Yearly pie chart will be generated here -->
                                            <h3 class="text-primary mb-md">Year Dream Types</h3>
                                            <div class="loading-state">Loading yearly chart...</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Lifetime Tab -->
                                <div id="statsTabLifetime" class="stats-tab-panel" style="display: none;">
                                    <div class="stats-grid">
                                        <div id="lifetimeStatsContainer" class="card-md">
                                            <!-- Lifetime stats will be generated here -->
                                            <h3 class="text-primary mb-md">Lifetime Stats</h3>
                                            <div class="loading-state">Loading lifetime stats...</div>
                                        </div>
                                        <div id="lifetimePieChartContainer" class="card-md">
                                            <!-- Lifetime pie chart will be generated here -->
                                            <h3 class="text-primary mb-md">All-Time Dream Types</h3>
                                            <div class="loading-state">Loading lifetime chart...</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Dream Signs Tab -->
                                <div id="statsTabDreamSigns" class="stats-tab-panel" style="display: none;">
                                    <div id="dreamSignWordCloudContainer" class="card-md mb-lg">
                                        <!-- Word cloud will be generated here -->
                                        <h3 class="text-primary mb-md">Dream Sign Word Cloud</h3>
                                        <div class="loading-state">Loading word cloud...</div>
                                    </div>
                                    <div id="dreamSignListContainer" class="card-md">
                                        <!-- Dream sign list will be generated here -->
                                        <h3 class="text-primary mb-md">Dream Sign Lucidity Rate</h3>
                                        <div class="loading-state">Loading list...</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                } else if (tabId === 'adviceTab') {
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
                } else if (tabId === 'settingsTab') {
                    // Get current theme to set correct option as selected
                    const currentTheme = getCurrentTheme();
                    const lightSelected = currentTheme === 'light' ? 'selected' : '';
                    const darkSelected = currentTheme === 'dark' ? 'selected' : '';
                    
                    tabPanel.innerHTML = `
                        <div class="settings-section">
                            <h3>🎨 Appearance</h3>
                            <div class="settings-row">
                                <div>
                                    <div class="settings-label">Theme</div>
                                    <div class="settings-description">Choose your preferred color theme</div>
                                </div>
                                <div class="settings-controls">
                                    <select id="themeSelect" class="filter-select" style="min-width: 120px;">
                                        <option value="light" ${lightSelected}>🌞 Light</option>
                                        <option value="dark" ${darkSelected}>🌙 Dark</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="settings-section">
                            <h3>🔐 Security</h3>
                            <div class="settings-row">
                                <div>
                                    <div class="settings-label">PIN Protection</div>
                                    <div class="settings-description">Secure your dreams with a PIN code</div>
                                </div>
                                <div class="settings-controls">
                                    <button data-action="setup-pin" id="setupPinBtnSettings" class="btn btn-secondary">⚙️ Setup PIN</button>
                                </div>
                            </div>
                        </div>
                        <div class="settings-section">
                            <h3>💾 Data Management</h3>
                            
                            <!-- Dreams Only Export/Import -->
                            <div class="settings-row">
                                <div>
                                    <div class="settings-label">Dreams Export/Import</div>
                                    <div class="settings-description">Export or import your dreams as text files</div>
                                </div>
                                <div class="settings-controls export-import-controls">
                                    <button data-action="export-dreams" class="btn btn-secondary">Export Dreams</button>
                                    <button data-action="import-dreams" class="btn btn-secondary">Import Dreams</button>
                                    <div class="encryption-option flex-center gap-sm">
                                        <input type="checkbox" id="encryptionEnabled" class="form-checkbox">
                                        <label for="encryptionEnabled" class="form-label-inline text-primary">🔐 Password Protected</label>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Complete Data Export/Import -->
                            <div class="settings-row">
                                <div>
                                    <div class="settings-label">Complete Data Export/Import</div>
                                    <div class="settings-description">Export or import ALL data (dreams, goals, settings) as JSON files</div>
                                </div>
                                <div class="settings-controls export-import-controls">
                                    <button data-action="export-all-data" class="btn btn-primary">Export All Data</button>
                                    <button data-action="import-all-data" class="btn btn-primary">Import All Data</button>
                                    <div class="encryption-option flex-center gap-sm">
                                        <input type="checkbox" id="fullDataEncryption" class="form-checkbox">
                                        <label for="fullDataEncryption" class="form-label-inline text-primary">🔐 Password Protected</label>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- AI Analysis Export -->
                            <div class="settings-row">
                                <div>
                                    <div class="settings-label">AI Analysis Export</div>
                                    <div class="settings-description">Export a prompt for analysis by an AI model</div>
                                </div>
                                <div class="settings-controls">
                                    <button data-action="export-ai" class="btn btn-success">Export for AI Analysis</button>
                                </div>
                            </div>
                        </div>
                        <div class="settings-section">
                            <h3>🏷️ Autocomplete Management</h3>
                            <p class="settings-description" style="margin-bottom: 20px;">Manage the suggestions that appear when you type tags and dream signs. Add your own items, or delete any you don't use.</p>
                            
                            <div class="settings-row">
                                <div>
                                    <div class="settings-label">Tags & Themes</div>
                                    <div class="settings-description">Add a new custom tag or theme.</div>
                                </div>
                                <div style="flex: 1; min-width: 300px;">
                                    <div id="tagsManagementList" class="autocomplete-management-list">
                                        <div class="loading-state">Loading tags...</div>
                                    </div>
                                    <div class="form-group mt-sm" style="display: flex; justify-content: flex-end;">
                                        <div class="flex-center gap-sm" style="width: 100%; max-width: 300px;">
                                            <input type="text" id="newTagInput" class="form-control" placeholder="e.g., recurring-nightmare">
                                            <button data-action="add-custom-tag" class="btn btn-primary btn-small">Add</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="settings-row">
                                <div>
                                    <div class="settings-label">⚡ Dream Signs</div>
                                    <div class="settings-description">Add a new custom dream sign.</div>
                                </div>
                                <div style="flex: 1; min-width: 300px;">
                                    <div id="dreamSignsManagementList" class="autocomplete-management-list">
                                        <div class="loading-state">Loading dream signs...</div>
                                    </div>
                                    <div class="form-group mt-sm" style="display: flex; justify-content: flex-end;">
                                        <div class="flex-center gap-sm" style="width: 100%; max-width: 300px;">
                                            <input type="text" id="newDreamSignInput" class="form-control" placeholder="e.g., extra-fingers">
                                            <button data-action="add-custom-dream-sign" class="btn btn-primary btn-small">Add</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                } else if (tabId === 'lockTab') {
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
                    
                    tabPanel.innerHTML = `
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
                }
                
                tabContainer.appendChild(tabPanel);
            }
        });
        
        // Update tab panels
        const tabs = document.querySelectorAll('.tab-panel');
        
        tabs.forEach(tab => {
            const expectedId = tabName + 'Tab';
            if (tab.id === expectedId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Update tab buttons
        const tabButtons = document.querySelectorAll('.app-tab');
        tabButtons.forEach(button => {
            const buttonTab = button.dataset.tab;
            if (buttonTab === tabName) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        // Show/hide footer based on active tab
        const footer = document.querySelector('footer');
        if (footer) {
            if (tabName === 'journal' && !isAppLocked) {
                footer.style.display = 'block';
            } else {
                footer.style.display = 'none';
            }
        }
        
        activeAppTab = tabName;
        
        // Auto-focus PIN input on lock screen
        if (tabName === 'lock') {
            setTimeout(() => {
                const lockScreenPinInput = document.getElementById('lockScreenPinInput');
                if (lockScreenPinInput) {
                    lockScreenPinInput.focus();
                }
            }, CONSTANTS.FOCUS_DELAY_MS);
        }
        
        // Update security controls when switching to journal tab (for consistency)
        if (tabName === 'journal') {
            updateSecurityControls();
        }
        
        // Initialize calendar if stats tab is selected
        if (tabName === 'stats') {
            initCalendar();
        }
        
        // Display goals if goals tab is selected
        if (tabName === 'goals') {
            // Refresh goals from storage when switching to goals tab
            // This ensures we always have the latest data
            initGoals().catch(error => {
                console.error('Error refreshing goals:', error);
                displayGoals(); // Fallback to just displaying current goals
            });
        }

        // ALWAYS update settings when switching to settings tab (whether new or existing)
        if (tabName === 'settings') {
            setTimeout(() => {
                updateSecurityControls();
                
                // Always update theme select - this fixes the tab switching issue
                const themeSelect = document.getElementById('themeSelect');
                if (themeSelect) {
                    const currentTheme = getCurrentTheme();
                    
                    // Update the select value
                    themeSelect.value = currentTheme;
                    
                    // Also update the selected attribute in the DOM
                    themeSelect.querySelectorAll('option').forEach(option => {
                        if (option.value === currentTheme) {
                            option.selected = true;
                            option.setAttribute('selected', 'selected');
                        } else {
                            option.selected = false;
                            option.removeAttribute('selected');
                        }
                    });
                    
                    // Add event listener if not already added
                    if (!themeSelect.hasAttribute('data-listener-added')) {
                        themeSelect.addEventListener('change', function() {
                            switchTheme(this.value);
                        });
                        themeSelect.setAttribute('data-listener-added', 'true');
                    }
                }

                // Render autocomplete management lists
                renderAutocompleteManagementList('tags');
                renderAutocompleteManagementList('dreamSigns');
            }, CONSTANTS.FOCUS_DELAY_MS);
        }

        // Initialize advice tab when switched to
        if (tabName === 'advice') {
            initializeAdviceTab();
        }
    }

    // Hide all tab buttons (when locked)
        function hideAllTabButtons() {
            const tabButtons = document.querySelectorAll('.app-tab');
            tabButtons.forEach(button => {
                if (button.dataset.tab !== 'lock') {
                    button.style.display = 'none';
                }
            });
            console.log('Hid all tab buttons except lock tab');
        }
        
        // Show all tab buttons (when unlocked)
        function showAllTabButtons() {
            const tabButtons = document.querySelectorAll('.app-tab');
            tabButtons.forEach(button => {
                if (button.dataset.tab !== 'lock') {
                    button.style.display = 'block';
                }
            });
            console.log('Showed all tab buttons');
        }

    // Settings display synchronization
    function syncSettingsDisplay() {
        // Sync PIN buttons
        const setupBtnSettings = document.getElementById('setupPinBtnSettings');
        const lockBtnSettings = document.getElementById('lockBtnSettings');
        
        if (setupBtnSettings && lockBtnSettings) {
            if (isPinSetup()) {
                if (isUnlocked) {
                    lockBtnSettings.style.display = 'inline-block';
                    lockBtnSettings.textContent = '🔒 Lock';
                    setupBtnSettings.textContent = '⚙️ Change/Remove PIN';
                } else {
                    lockBtnSettings.style.display = 'none';
                    setupBtnSettings.textContent = '⚙️ Change/Remove PIN';
                }
            } else {
                lockBtnSettings.style.display = 'none';
                setupBtnSettings.textContent = '⚙️ Setup PIN';
            }
        }
        
        // Sync encryption checkbox
        const encryptionOriginal = document.getElementById('encryptionEnabled');
        const encryptionSettings = document.getElementById('encryptionEnabledSettings');
        
        if (encryptionOriginal && encryptionSettings) {
            encryptionSettings.checked = encryptionOriginal.checked;
            
            // Add sync event listeners
            encryptionSettings.addEventListener('change', function() {
                encryptionOriginal.checked = this.checked;
            });
            
            encryptionOriginal.addEventListener('change', function() {
                encryptionSettings.checked = this.checked;
            });
        }
        
        // Sync theme select - enhanced
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            const currentTheme = getCurrentTheme();
            themeSelect.value = currentTheme;
            
            // Double-check the value was set correctly
            if (themeSelect.value !== currentTheme) {
                console.log('Theme select sync issue, forcing update');
                setTimeout(() => {
                    const themeSelectDelayed = document.getElementById('themeSelect');
                    if (themeSelectDelayed) {
                        themeSelectDelayed.value = currentTheme;
                    }
                }, 50);
            }
        }
        
        // Update storage info
        const storageTypeElement = document.getElementById('storageTypeDisplay');
        const storageStatusElement = document.getElementById('storageStatusDisplay');
        
        if (storageTypeElement && storageStatusElement) {
            switch (storageType) {
                case 'indexeddb':
                    storageTypeElement.textContent = 'Data stored in IndexedDB (recommended)';
                    storageStatusElement.textContent = '💾 IndexedDB';
                    storageStatusElement.style.color = 'var(--success-color)';
                    break;
                case 'localstorage':
                    storageTypeElement.textContent = 'Data stored in localStorage';
                    storageStatusElement.textContent = '📱 LocalStorage';
                    storageStatusElement.style.color = 'var(--info-color)';
                    break;
                case 'memory':
                    storageTypeElement.textContent = 'Data stored temporarily in memory only';
                    storageStatusElement.textContent = '⚠️ Memory Only';
                    storageStatusElement.style.color = 'var(--warning-color)';
                    break;
                default:
                    storageTypeElement.textContent = 'Storage type unknown';
                    storageStatusElement.textContent = '❓ Unknown';
                    storageStatusElement.style.color = 'var(--text-secondary)';
            }
        }
        
        // Update browser compatibility info
        updateBrowserCompatibilityDisplay();
    }

    // Browser compatibility display in settings
    function updateBrowserCompatibilityDisplay() {
        const voiceCapabilities = getVoiceCapabilities();
        
        // Voice Recording Status
        const voiceRecordingCompatibility = document.getElementById('voiceRecordingCompatibility');
        const voiceRecordingStatus = document.getElementById('voiceRecordingStatus');
        
        if (voiceRecordingCompatibility && voiceRecordingStatus) {
            if (voiceCapabilities.canRecord) {
                voiceRecordingCompatibility.textContent = 'Your browser supports voice recording';
                voiceRecordingStatus.textContent = '✅ Supported';
                voiceRecordingStatus.style.color = 'var(--success-color)';
            } else {
                if (voiceCapabilities.browser.isSafariMobile) {
                    voiceRecordingCompatibility.textContent = 'Safari iOS has limited MediaRecorder support';
                } else {
                    voiceRecordingCompatibility.textContent = 'Voice recording not supported in this browser';
                }
                voiceRecordingStatus.textContent = '❌ Not Supported';
                voiceRecordingStatus.style.color = 'var(--error-color)';
            }
        }
        
        // Transcription Status
        const transcriptionCompatibility = document.getElementById('transcriptionCompatibility');
        const transcriptionStatus = document.getElementById('transcriptionStatus');
        
        if (transcriptionCompatibility && transcriptionStatus) {
            if (voiceCapabilities.canTranscribe) {
                transcriptionCompatibility.textContent = 'Your browser supports speech transcription';
                transcriptionStatus.textContent = '✅ Supported';
                transcriptionStatus.style.color = 'var(--success-color)';
            } else {
                if (voiceCapabilities.browser.isFirefox) {
                    transcriptionCompatibility.textContent = 'Firefox does not support Speech Recognition API';
                } else if (voiceCapabilities.browser.isSafari) {
                    transcriptionCompatibility.textContent = 'Safari does not support Speech Recognition API';
                } else {
                    transcriptionCompatibility.textContent = 'Speech Recognition API not available in this browser';
                }
                transcriptionStatus.textContent = '❌ Not Supported';
                transcriptionStatus.style.color = 'var(--error-color)';
            }
        }
    }

    // Voice notes tab switching
    function switchVoiceTab(tabName) {
        if (!tabName || (tabName !== 'record' && tabName !== 'stored')) return;
        
        // Update tab buttons
        const tabs = document.querySelectorAll('.voice-tab');
        tabs.forEach(tab => {
            const tabId = tab.dataset.tab;
            if (tabId === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Update tab panels
        const recordPanel = document.getElementById('voiceTabRecord');
        const storedPanel = document.getElementById('voiceTabStored');
        
        if (recordPanel && storedPanel) {
            if (tabName === 'record') {
                recordPanel.classList.add('active');
                recordPanel.style.display = 'block';
                storedPanel.classList.remove('active');
                storedPanel.style.display = 'none';
            } else {
                recordPanel.classList.remove('active');
                recordPanel.style.display = 'none';
                storedPanel.classList.add('active');
                storedPanel.style.display = 'block';
                
                // Load and display voice notes when switching to stored tab
                displayVoiceNotes();
            }
            
            activeVoiceTab = tabName;
        }
    }

    // Dream form collapse/expand toggle
    function toggleDreamForm() {
        const fullForm = document.getElementById('dreamFormFull');
        const collapsedForm = document.getElementById('dreamFormCollapsed');
        
        if (!fullForm || !collapsedForm) return; // Safety check

        if (isDreamFormCollapsed) {
            // Expand: show full form, hide collapsed
            fullForm.style.display = 'block';
            collapsedForm.style.display = 'none';
            isDreamFormCollapsed = false;
            try { localStorage.setItem(DREAM_FORM_COLLAPSE_KEY, 'false'); } catch (e) {}
        } else {
            // Collapse: hide full form, show collapsed
            fullForm.style.display = 'none';
            collapsedForm.style.display = 'block';
            isDreamFormCollapsed = true;
            try { localStorage.setItem(DREAM_FORM_COLLAPSE_KEY, 'true'); } catch (e) {}
        }
    }

    // Show loading indicator for search/filter operations
    function showSearchLoading() {
        const container = document.getElementById('entriesContainer');
        if (container && !asyncMutex.displayDreams.locked) {
            const existingLoader = container.querySelector('.loading-state');
            if (!existingLoader) {
                const loader = document.createElement('div');
                loader.className = 'loading-state';
                loader.innerHTML = '🔍 Searching dreams...';
                container.appendChild(loader);
            }
        }
    }

    // Hide loading indicator
    function hideSearchLoading() {
        const container = document.getElementById('entriesContainer');
        if (container) {
            const loader = container.querySelector('.loading-state');
            if (loader) {
                loader.remove();
            }
        }
    }

    

    async function renderAutocompleteManagementList(type) {
        const containerId = type === 'tags' ? 'tagsManagementList' : 'dreamSignsManagementList';
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<div class="loading-state">Loading...</div>';

        try {
            // Get the unified list of suggestions. This now correctly reads from the new store.
            const suggestions = await getAutocompleteSuggestions(type);

            if (suggestions.length === 0) {
                container.innerHTML = `<div class="no-entries" style="padding: 15px;">No custom items added yet.</div>`;
                return;
            }

            // All items are now treated the same. No more 'default' vs 'user' distinction.
            const listHtml = suggestions.map(item => {
                return `
                    <div class="autocomplete-list-item">
                        <span class="item-value">${escapeHtml(item)}</span>
                        <div class="flex-center gap-sm">
                            <button data-action="delete-autocomplete-item" data-item-type="${type}" data-item-id="${escapeAttr(item)}" class="btn btn-delete btn-small">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = listHtml;
        } catch (error) {
            console.error(`Error rendering ${type} list:`, error);
            container.innerHTML = `<div class="message-error">Failed to load ${type} list.</div>`;
        }
    }

    // Setup tag autocomplete for form inputs
    function setupTagAutocomplete(inputId, suggestions) {
        const input = document.getElementById(inputId);
        if (!input || !Array.isArray(suggestions)) return;

        // Remove existing listener to prevent duplicates
        if (input.autocompleteListener) {
            input.removeEventListener('input', input.autocompleteListener);
        }
        if (input.autocompleteDropdown) {
            input.autocompleteDropdown.remove();
        }

        // Create autocomplete dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'tag-autocomplete-dropdown';
        input.autocompleteDropdown = dropdown;

        // Position container relatively
        if (input.parentElement) {
            input.parentElement.style.position = 'relative';
            input.parentElement.appendChild(dropdown);
        }

        const listener = function() {
            const value = this.value.toLowerCase();
            const lastComma = value.lastIndexOf(',');
            const currentTag = lastComma >= 0 ? value.substring(lastComma + 1).trim() : value.trim();

            if (currentTag.length < CONSTANTS.AUTOCOMPLETE_MIN_CHARS) {
                dropdown.style.display = 'none';
                return;
            }

            const matches = suggestions.filter(suggestion => 
                suggestion.toLowerCase().includes(currentTag) &&
                !value.toLowerCase().includes(suggestion.toLowerCase())
            ).slice(0, CONSTANTS.AUTOCOMPLETE_MAX_RESULTS);

            if (matches.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            dropdown.innerHTML = matches.map(match => 
                `<div class="autocomplete-item" data-tag="${escapeAttr(match)}">
                    ${escapeHtml(match)}
                </div>`
            ).join('');

            dropdown.style.display = 'block';

            // Add click handlers
            dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', function() {
                    const tag = this.dataset.tag;
                    if (tag) {
                        const currentValue = input.value;
                        const lastComma = currentValue.lastIndexOf(',');
                        
                        if (lastComma >= 0) {
                            input.value = currentValue.substring(0, lastComma + 1) + ' ' + tag + ', ';
                        } else {
                            input.value = tag + ', ';
                        }
                        
                        dropdown.style.display = 'none';
                        input.focus();
                    }
                });
            });
        };
        
        input.autocompleteListener = listener;
        input.addEventListener('input', listener);

        // Hide dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (dropdown && !input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }


    // PIN SECURITY & ACCESS CONTROL SYSTEM
    
    // NEW UNIFIED PIN SCREEN RENDERER
    function renderPinScreen(targetElement, config) {
        if (!targetElement || !config) return;

        let inputsHTML = '';
        if (config.inputs) {
            inputsHTML = config.inputs.map(input => {
                const valueAttr = input.value ? `value="${escapeAttr(input.value)}"` : '';
                const inputClass = input.class || 'form-control';
                return `<input
                    type="${input.type}"
                    id="${input.id}"
                    class="${inputClass}"
                    placeholder="${escapeAttr(input.placeholder)}"
                    ${input.maxLength ? `maxlength="${input.maxLength}"` : ''}
                    ${valueAttr}
                    style="margin-bottom: 10px;"
                >`;
            }).join('');
        }

        let buttonsHTML = '';
        if (config.buttons) {
            buttonsHTML = config.buttons.map(button => `
                <button
                    data-action="${button.action}"
                    class="btn ${button.class}"
                    ${button.id ? `id="${button.id}"` : ''}
                >
                    ${escapeHtml(button.text)}
                </button>
            `).join('');
        }

        let linksHTML = '';
        if (config.links) {
            linksHTML = config.links.map(link => `
                <span
                    data-action="${link.action}"
                    class="pin-setup-link"
                    ${link.id ? `id="${link.id}"` : ''}
                    style="${link.style || ''}"
                >
                    ${escapeHtml(link.text)}
                </span>
            `).join('');
        }

        const iconHTML = config.icon ? `<div class="text-4xl mb-lg">${config.icon}</div>` : '';
        const messageHTML = config.message ? `<p id="pinMessage" class="text-secondary mb-lg line-height-relaxed">${config.message}</p>` : '';
        const feedbackHTML = config.feedbackContainer ? `<div id="pinFeedback" class="notification-message"></div><div id="pinSuccess" class="notification-message"></div><div id="pinInfo" class="notification-message"></div>` : '';

        targetElement.innerHTML = `
            ${iconHTML}
            <h2 id="pinTitle" class="text-primary mb-md text-xl">${escapeHtml(config.title)}</h2>
            ${messageHTML}
            <div id="pinInputsContainer">${inputsHTML}</div>
            <div class="pin-buttons">
                ${buttonsHTML}
            </div>
            <div id="pinLinksContainer" style="margin-top: 15px;">${linksHTML}</div>
            ${feedbackHTML}
        `;

        // Auto-focus the first input if it exists
        if (config.inputs && config.inputs.length > 0) {
            setTimeout(() => {
                const firstInput = document.getElementById(config.inputs[0].id);
                if (firstInput) {
                    firstInput.focus();
                }
            }, CONSTANTS.FOCUS_DELAY_MS);
        }
    }

