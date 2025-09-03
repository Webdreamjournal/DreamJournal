    // --- 5.3 Goal Management ---
    // --- All functions related to goals (init, display, save, calculate) --- //

    // Goal system initialization
    async function initGoals() {
        allGoals = await loadGoals();
        if (document.getElementById('goalsTab')) {
            await displayGoals();
        }
    }
    
    // Display goals in the goals tab
    async function displayGoals() {
        const activeContainer = document.getElementById('activeGoalsContainer');
        const completedContainer = document.getElementById('completedGoalsContainer');
        const noGoalsMessage = document.getElementById('noGoalsMessage');
        const noCompletedMessage = document.getElementById('noCompletedGoalsMessage');
        const activePagination = document.getElementById('activeGoalsPagination');
        const completedPagination = document.getElementById('completedGoalsPagination');
        
        if (!activeContainer || !completedContainer) {
            console.warn('Goals containers not found - goals tab may not be initialized yet');
            return;
        }
        
        const activeGoals = allGoals.filter(goal => goal.status === 'active');
        const completedGoals = allGoals.filter(goal => goal.status === 'completed')
            .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt)); // Sort newest first
        
        // Reset pagination if current page would be empty
        const activeTotalPages = Math.ceil(activeGoals.length / GOALS_PER_PAGE);
        const completedTotalPages = Math.ceil(completedGoals.length / GOALS_PER_PAGE);
        
        if (activeGoalsPage > activeTotalPages && activeTotalPages > 0) {
            activeGoalsPage = activeTotalPages;
        }
        if (completedGoalsPage > completedTotalPages && completedTotalPages > 0) {
            completedGoalsPage = completedTotalPages;
        }
        
        // Show/hide no goals messages
        noGoalsMessage.style.display = activeGoals.length === 0 ? 'block' : 'none';
        noCompletedMessage.style.display = completedGoals.length === 0 ? 'block' : 'none';
        
        // Calculate pagination for active goals
        const activeStartIndex = (activeGoalsPage - 1) * GOALS_PER_PAGE;
        const activeEndIndex = activeStartIndex + GOALS_PER_PAGE;
        const activePage = activeGoals.slice(activeStartIndex, activeEndIndex);
        
        // Render active goals
        activeContainer.innerHTML = '';
        for (const goal of activePage) {
            const progress = await calculateGoalProgress(goal);
            activeContainer.appendChild(createGoalElement(goal, progress));
        }
        
        // Render active goals pagination
        if (activeTotalPages > 1) {
            activePagination.style.display = 'block';
            activePagination.innerHTML = createPaginationHTML(activeGoalsPage, activeTotalPages, 'active-goals-page');
        } else {
            activePagination.style.display = 'none';
        }
        
        // Calculate pagination for completed goals
        const completedStartIndex = (completedGoalsPage - 1) * GOALS_PER_PAGE;
        const completedEndIndex = completedStartIndex + GOALS_PER_PAGE;
        const completedPage = completedGoals.slice(completedStartIndex, completedEndIndex);
        
        // Render completed goals
        completedContainer.innerHTML = '';
        for (const goal of completedPage) {
            const progress = await calculateGoalProgress(goal);
            completedContainer.appendChild(createGoalElement(goal, progress, true));
        }
        
        // Render completed goals pagination
        if (completedTotalPages > 1) {
            completedPagination.style.display = 'block';
            completedPagination.innerHTML = createPaginationHTML(completedGoalsPage, completedTotalPages, 'completed-goals-page');
        } else {
            completedPagination.style.display = 'none';
        }
    }

    // Change active goals page
    function changeActiveGoalsPage(page) {
        if (page < 1) return;
        const activeGoals = allGoals.filter(goal => goal.status === 'active');
        const totalPages = Math.ceil(activeGoals.length / GOALS_PER_PAGE);
        if (page > totalPages) return;
        
        activeGoalsPage = page;
        displayGoals();
    }
    
    // Change completed goals page
    function changeCompletedGoalsPage(page) {
        if (page < 1) return;
        const completedGoals = allGoals.filter(goal => goal.status === 'completed');
        const totalPages = Math.ceil(completedGoals.length / GOALS_PER_PAGE);
        if (page > totalPages) return;
        
        completedGoalsPage = page;
        displayGoals();
    }
    
    // Get clean label for goal type
    function getGoalTypeLabel(type) {
        const labels = {
            'lucid_count': 'lucid dreams',
            'recall_streak': 'day streak',
            'journal_streak': 'day streak',
            'dream_signs_count': 'dream signs',
            'custom': ''
        };
        return labels[type] || '';
    }
    
    // Create goal HTML element
    function createGoalElement(goal, progress, isCompleted = false) {
        const goalDiv = document.createElement('div');
        goalDiv.className = `card-md goal-card mb-md ${isCompleted ? 'completed' : ''}`;
        
        const progressPercent = Math.min((progress.current / goal.target) * 100, 100);
        const statusClass = progressPercent === 100 ? 'success' : progressPercent >= 50 ? 'warning' : 'primary';
        
        goalDiv.innerHTML = `
            <div class="flex-between mb-md">
                <h4>${escapeHtml(goal.icon)} ${escapeHtml(goal.title)}</h4>
                <div class="goal-actions">
                    ${!isCompleted ? `
                        <button data-action="edit-goal" data-goal-id="${goal.id}" class="btn btn-outline btn-small">Edit</button>
                        <button data-action="complete-goal" data-goal-id="${goal.id}" class="btn btn-success btn-small">Complete</button>
                    ` : `
                        <button data-action="reactivate-goal" data-goal-id="${goal.id}" class="btn btn-warning btn-small">Reactivate</button>
                    `}
                    <button data-action="delete-goal" data-goal-id="${goal.id}" class="btn btn-error btn-small">Delete</button>
                </div>
            </div>
            <p class="text-secondary mb-md">${escapeHtml(goal.description)}</p>
            <div class="goal-progress-section">
                <div class="flex-between mb-sm">
                    <span class="font-semibold">Progress:</span>
                    <span class="status-${statusClass}">${progress.current} / ${goal.target} ${getGoalTypeLabel(goal.type)}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill progress-${statusClass}" style="width: ${progressPercent}%;"></div>
                </div>
                ${progress.message ? `<p class="text-secondary text-sm mt-sm">${progress.message}</p>` : ''}
                ${goal.type === 'custom' && !isCompleted ? `
                    <div class="custom-goal-controls mt-md">
                        <div class="flex-center gap-md">
                            <button data-action="decrease-goal-progress" data-goal-id="${goal.id}" class="btn btn-outline btn-small" ${progress.current <= 0 ? 'disabled' : ''}>➖</button>
                            <span class="font-semibold">Manual Tracking</span>
                            <button data-action="increase-goal-progress" data-goal-id="${goal.id}" class="btn btn-outline btn-small">➕</button>
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="flex-between text-sm text-secondary">
                <div>
                    <span>Created: ${new Date(goal.createdAt).toLocaleDateString()}</span>
                    ${isCompleted && goal.completedAt ? `<br><span>Completed: ${new Date(goal.completedAt).toLocaleDateString()}</span>` : ''}
                </div>
                <span>${goal.period === 'monthly' ? 'Monthly Goal' : goal.period === 'streak' ? 'Streak Goal' : 'Total Goal'}</span>
            </div>
        `;
        
        return goalDiv;
    }
    
    // Calculate goal progress based on dream data
    async function calculateGoalProgress(goal) {
        const dreams = await loadDreams();
        const now = new Date();
        
        let current = 0;
        let message = '';
        
        switch (goal.type) {
            case 'lucid_count':
                if (goal.period === 'monthly') {
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    const lucidDreams = dreams.filter(dream => 
                        dream.isLucid && new Date(dream.timestamp) >= startOfMonth
                    );
                    current = lucidDreams.length;
                    message = `${current} lucid dreams this month`;
                }
                break;
                
            case 'recall_streak':
                current = calculateDreamRecallStreak(dreams);
                message = current === 1 ? '1 day streak' : `${current} days streak`;
                break;
                
            case 'journal_streak':
                current = calculateJournalingStreak(dreams);
                message = current === 1 ? '1 day streak' : `${current} days streak`;
                break;
                
            case 'dream_signs_count':
                const dreamSigns = new Set();
                dreams.forEach(dream => {
                    if (dream.dreamSigns && typeof dream.dreamSigns === 'string') {
                        const signs = dream.dreamSigns.split(',').map(s => s.trim().toLowerCase());
                        signs.forEach(sign => {
                            if (sign) dreamSigns.add(sign);
                        });
                    } else if (Array.isArray(dream.dreamSigns)) {
                        // Handle case where dreamSigns might be stored as an array
                        dream.dreamSigns.forEach(sign => {
                            if (sign && typeof sign === 'string') {
                                dreamSigns.add(sign.trim().toLowerCase());
                            }
                        });
                    }
                });
                current = dreamSigns.size;
                message = `${current} unique dream signs identified`;
                break;
                
            case 'custom':
                current = goal.currentProgress || 0;
                message = `${current} completed`;
                break;
        }
        
        return { current, message };
    }

    // Show create goal dialog
    function showCreateGoalDialog(template = null) {
        console.log('showCreateGoalDialog called with template:', template);
        
        const dialog = document.createElement('div');
        dialog.className = 'pin-overlay';
        dialog.style.display = 'flex';
        
        const templateData = template ? GOAL_TEMPLATES[template] : null;
        
        dialog.innerHTML = `
            <div class="pin-container">
                <h3>${template ? 'Create Goal from Template' : 'Create New Goal'}</h3>
                <div class="form-group">
                    <label for="goalTitle">Goal Title</label>
                    <input type="text" id="goalTitle" class="form-control" value="${templateData?.title || ''}" required>
                </div>
                <div class="form-group">
                    <label for="goalDescription">Description</label>
                    <textarea id="goalDescription" class="form-control" rows="3">${templateData?.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="goalType">Goal Type</label>
                    <select id="goalType" class="form-control">
                        <option value="lucid_count" ${templateData?.type === 'lucid_count' ? 'selected' : ''}>Lucid Dreams Count</option>
                        <option value="recall_streak" ${templateData?.type === 'recall_streak' ? 'selected' : ''}>Dream Recall Streak</option>
                        <option value="journal_streak" ${templateData?.type === 'journal_streak' ? 'selected' : ''}>Journal Writing Streak</option>
                        <option value="dream_signs_count" ${templateData?.type === 'dream_signs_count' ? 'selected' : ''}>Dream Signs Collection</option>
                        <option value="custom" ${templateData?.type === 'custom' ? 'selected' : ''}>Custom (Manual Tracking)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="goalPeriod">Time Period</label>
                    <select id="goalPeriod" class="form-control">
                        <option value="monthly" ${templateData?.period === 'monthly' ? 'selected' : ''}>Monthly</option>
                        <option value="streak" ${templateData?.period === 'streak' ? 'selected' : ''}>Consecutive Days</option>
                        <option value="total" ${templateData?.period === 'total' ? 'selected' : ''}>All Time Total</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="goalTarget">Target Number</label>
                    <input type="number" id="goalTarget" class="form-control" value="${templateData?.target || 1}" min="1" required>
                </div>
                <div class="form-group">
                    <label for="goalIcon">Icon (optional)</label>
                    <input type="text" id="goalIcon" class="form-control" value="${templateData?.icon || '🎯'}" maxlength="2">
                </div>
                <div class="pin-buttons">
                    <button data-action="save-goal" class="btn btn-primary">Create Goal</button>
                    <button data-action="cancel-goal-dialog" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        document.getElementById('goalTitle').focus();
    }
    
    // Create goal from template
    function createTemplateGoal(templateKey) {
        if (GOAL_TEMPLATES[templateKey]) {
            showCreateGoalDialog(templateKey);
        }
    }
    
    // Save goal
    async function saveGoal() {
        console.log('saveGoal function called');
        
        // Defensive check - ensure allGoals is still an array
        if (!Array.isArray(allGoals)) {
            console.warn('allGoals is not an array, reloading from storage');
            try {
                allGoals = await loadGoals();
                console.log('Reloaded goals from storage:', allGoals.length, 'goals');
            } catch (error) {
                console.error('Failed to reload goals:', error);
                allGoals = [];
            }
        }
        
        const titleElement = document.getElementById('goalTitle');
        const descriptionElement = document.getElementById('goalDescription');
        const typeElement = document.getElementById('goalType');
        const periodElement = document.getElementById('goalPeriod');
        const targetElement = document.getElementById('goalTarget');
        const iconElement = document.getElementById('goalIcon');
        
        if (!titleElement || !descriptionElement || !typeElement || !periodElement || !targetElement || !iconElement) {
            console.error('Goal form elements not found');
            createInlineMessage('error', 'Goal form not properly initialized', {
                container: document.body,
                position: 'top',
                duration: CONSTANTS.MESSAGE_DURATION_SHORT
            });
            return;
        }
        
        const title = titleElement.value.trim();
        const description = descriptionElement.value.trim();
        const type = typeElement.value;
        const period = periodElement.value;
        const target = parseInt(targetElement.value);
        const icon = iconElement.value.trim() || '🎯';
        
        console.log('Goal form values:', { title, description, type, period, target, icon });
        
        if (!title || !target || target < 1) {
            createInlineMessage('error', 'Please fill in all required fields with valid values', {
                container: document.body,
                position: 'top',
                duration: CONSTANTS.MESSAGE_DURATION_SHORT
            });
            return;
        }
        
        if (window.editingGoalId) {
            // Edit existing goal
            const goalIndex = allGoals.findIndex(g => g.id === window.editingGoalId);
            if (goalIndex !== -1) {
                allGoals[goalIndex] = {
                    ...allGoals[goalIndex],
                    title,
                    description,
                    type,
                    period,
                    target,
                    icon,
                    updatedAt: new Date().toISOString(),
                    // Initialize currentProgress for goals being converted to custom
                    currentProgress: type === 'custom' && allGoals[goalIndex].currentProgress === undefined ? 0 : allGoals[goalIndex].currentProgress
                };
                await saveGoals(allGoals);
                await displayGoals();
                cancelGoalDialog();
                createInlineMessage('success', 'Goal updated successfully!', {
                    container: document.body,
                    position: 'top',
                    duration: CONSTANTS.MESSAGE_DURATION_SHORT
                });
                delete window.editingGoalId;
            }
        } else {
            // Create new goal
            const goal = {
                id: generateUniqueId(),
                title,
                description,
                type,
                period,
                target,
                icon,
                status: 'active',
                createdAt: new Date().toISOString(),
                // Add currentProgress field for custom goals
                currentProgress: type === 'custom' ? 0 : undefined
            };
            
            try {
                allGoals.push(goal);
                console.log('Goal added to array, total goals:', allGoals.length);
                
                await saveGoals(allGoals);
                console.log('Goals saved to storage');
                
                await displayGoals();
                console.log('Goals display updated');
                
                cancelGoalDialog();
                createInlineMessage('success', 'Goal created successfully!', {
                    container: document.body,
                    position: 'top',
                    duration: CONSTANTS.MESSAGE_DURATION_SHORT
                });
            } catch (error) {
                console.error('Error creating goal:', error);
                createInlineMessage('error', 'Failed to create goal. Please try again.', {
                    container: document.body,
                    position: 'top',
                    duration: CONSTANTS.MESSAGE_DURATION_SHORT
                });
            }
        }
    }
    
    // Edit goal
    function editGoal(goalId) {
        const goal = allGoals.find(g => g.id === goalId);
        if (!goal) return;
        
        window.editingGoalId = goalId; // Store ID for save function
        showCreateGoalDialog();
        
        // Fill current values
        setTimeout(() => {
            document.getElementById('goalTitle').value = goal.title;
            document.getElementById('goalDescription').value = goal.description;
            document.getElementById('goalType').value = goal.type;
            document.getElementById('goalPeriod').value = goal.period;
            document.getElementById('goalTarget').value = goal.target;
            document.getElementById('goalIcon').value = goal.icon;
            
            // Update dialog title and button text
            const dialog = document.querySelector('.pin-overlay:not(#pinOverlay)');
            const dialogTitle = dialog.querySelector('h3');
            const saveButton = dialog.querySelector('[data-action="save-goal"]');
            if (dialogTitle) dialogTitle.textContent = 'Edit Goal';
            if (saveButton) saveButton.textContent = 'Update Goal';
        }, 10);
    }
    
    // Complete goal
    async function completeGoal(goalId) {
        const goal = allGoals.find(g => g.id === goalId);
        if (!goal) return;
        
        goal.status = 'completed';
        goal.completedAt = new Date().toISOString();
        
        await saveGoals(allGoals);
        await displayGoals();
        createInlineMessage('success', `🎉 Congratulations! Goal "${goal.title}" completed!`, {
            container: document.body,
            position: 'top',
            duration: CONSTANTS.MESSAGE_DURATION_MEDIUM
        });
    }
    
    // Reactivate goal (move back to active from completed)
    async function reactivateGoal(goalId) {
        const goal = allGoals.find(g => g.id === goalId);
        if (!goal || goal.status !== 'completed') return;
        
        goal.status = 'active';
        goal.reactivatedAt = new Date().toISOString();
        // Remove completedAt timestamp
        delete goal.completedAt;
        
        try {
            await saveGoals(allGoals);
            
            // Check if we need to adjust pagination after reactivation
            const remainingCompleted = allGoals.filter(g => g.status === 'completed');
            const completedTotalPages = Math.ceil(remainingCompleted.length / GOALS_PER_PAGE);
            if (completedGoalsPage > completedTotalPages && completedTotalPages > 0) {
                completedGoalsPage = completedTotalPages;
            }
            
            await displayGoals();
            createInlineMessage('success', `🔄 Goal "${goal.title}" reactivated!`, {
                container: document.body,
                position: 'top',
                duration: CONSTANTS.MESSAGE_DURATION_SHORT
            });
        } catch (error) {
            console.error('Error reactivating goal:', error);
            createInlineMessage('error', 'Failed to reactivate goal. Please try again.', {
                container: document.body,
                position: 'top',
                duration: CONSTANTS.MESSAGE_DURATION_SHORT
            });
        }
    }
    
    // Delete goal
    function deleteGoal(goalId) {
        const goal = allGoals.find(g => g.id === goalId);
        if (!goal) return;
        
        showDeleteGoalConfirmation(goal);
    }
    
    // Show delete confirmation
    function showDeleteGoalConfirmation(goal) {
        const dialog = document.createElement('div');
        dialog.className = 'pin-overlay';
        dialog.style.display = 'flex';
        
        dialog.innerHTML = `
            <div class="pin-container">
                <h3>Delete Goal</h3>
                <p>Are you sure you want to delete the goal "${goal.title}"? This action cannot be undone.</p>
                <div class="pin-buttons">
                    <button data-action="confirm-delete-goal" data-goal-id="${goal.id}" class="btn btn-error">Delete</button>
                    <button data-action="cancel-goal-dialog" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
    }
    
    // Confirm delete goal
    async function confirmDeleteGoal(goalId) {
        allGoals = allGoals.filter(g => g.id !== goalId);
        await saveGoals(allGoals);
        await displayGoals();
        cancelGoalDialog();
        createInlineMessage('success', 'Goal deleted successfully', {
            container: document.body,
            position: 'top',
            duration: CONSTANTS.MESSAGE_DURATION_SHORT
        });
    }
    
    // Cancel goal dialog
    function cancelGoalDialog() {
        const dialog = document.querySelector('.pin-overlay:not(#pinOverlay)');
        if (dialog) {
            document.body.removeChild(dialog);
        }
        // Clean up editing state
        if (window.editingGoalId) {
            delete window.editingGoalId;
        }
    }
    
    // Increase goal progress (for custom goals)
    async function increaseGoalProgress(goalId) {
        const goal = allGoals.find(g => g.id === goalId);
        if (!goal || goal.type !== 'custom') return;
        
        // Increase progress, but don't exceed target
        const newProgress = Math.min((goal.currentProgress || 0) + 1, goal.target);
        goal.currentProgress = newProgress;
        goal.lastUpdated = new Date().toISOString();
        
        try {
            await saveGoals(allGoals);
            await displayGoals();
            
            // Auto-complete the goal if target reached
            if (newProgress >= goal.target && goal.status !== 'completed') {
                setTimeout(() => {
                    createInlineMessage('success', `🎉 Goal "${goal.title}" completed! Great job!`, {
                        container: document.body,
                        position: 'top',
                        duration: 3000
                    });
                }, 100);
            }
        } catch (error) {
            console.error('Error updating goal progress:', error);
            createInlineMessage('error', 'Failed to update goal progress', {
                container: document.body,
                position: 'top',
                duration: CONSTANTS.MESSAGE_DURATION_SHORT
            });
        }
    }
    
    // Decrease goal progress (for custom goals)
    async function decreaseGoalProgress(goalId) {
        const goal = allGoals.find(g => g.id === goalId);
        if (!goal || goal.type !== 'custom') return;
        
        // Decrease progress, but don't go below 0
        const newProgress = Math.max((goal.currentProgress || 0) - 1, 0);
        goal.currentProgress = newProgress;
        goal.lastUpdated = new Date().toISOString();
        
        try {
            await saveGoals(allGoals);
            await displayGoals();
        } catch (error) {
            console.error('Error updating goal progress:', error);
            createInlineMessage('error', 'Failed to update goal progress', {
                container: document.body,
                position: 'top',
                duration: CONSTANTS.MESSAGE_DURATION_SHORT
            });
        }
    }