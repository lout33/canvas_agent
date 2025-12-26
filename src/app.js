let lastTemplateTrigger = null;
let lastTemplatePreviewTrigger = null;

function getTemplateFormElements() {
    return {
        modal: document.getElementById('templateModal'),
        openButton: document.getElementById('openTemplateModalBtn'),
        closeButton: document.getElementById('closeTemplateModalBtn'),
        backdrop: document.getElementById('templateModalBackdrop'),
        commandInput: document.getElementById('templateCommandInput'),
        promptInput: document.getElementById('templatePromptInput'),
        form: document.getElementById('templateForm'),
        message: document.getElementById('templateFormMessage'),
        list: document.getElementById('templateList')
    };
}

function getTemplatePreviewElements() {
    return {
        modal: document.getElementById('templatePreviewModal'),
        backdrop: document.getElementById('templatePreviewBackdrop'),
        closeButton: document.getElementById('closeTemplatePreviewBtn'),
        command: document.getElementById('templatePreviewCommand'),
        prompt: document.getElementById('templatePreviewPrompt')
    };
}

function showTemplateFormMessage(message, options = {}) {
    const { message: messageElement } = getTemplateFormElements();
    if (!messageElement) return;

    const { tone = 'info' } = options;
    messageElement.textContent = message || '';
    messageElement.classList.toggle('error', tone === 'error');
}

function renderTemplateList() {
    const { list } = getTemplateFormElements();
    if (!list) return;

    list.innerHTML = '';
    const templates = listTemplates();

    if (templates.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'template-list-empty';
        emptyState.textContent = 'No templates yet. Save one to reuse detailed prompts.';
        list.appendChild(emptyState);
        return;
    }

    templates.forEach((template) => {
        const item = document.createElement('div');
        item.className = 'template-list-item';
        item.dataset.command = template.command;

        const header = document.createElement('div');
        header.className = 'template-list-header';

        const title = document.createElement('div');
        title.className = 'template-command';
        title.textContent = template.command;

        // Add badge for built-in templates
        if (template.isBuiltIn) {
            const badge = document.createElement('span');
            badge.className = 'template-builtin-badge';
            badge.textContent = 'Built-in';
            badge.title = 'This is a default template';
            title.appendChild(badge);
        }

        const actions = document.createElement('div');
        actions.className = 'template-list-actions';

        const viewButton = document.createElement('button');
        viewButton.type = 'button';
        viewButton.className = 'template-list-button template-view-button';
        viewButton.innerHTML = '👁️';
        viewButton.title = 'View full prompt';
        viewButton.setAttribute('aria-label', `View ${template.command} prompt`);
        viewButton.addEventListener('click', () => {
            openTemplatePreview(template, viewButton);
        });

        actions.appendChild(viewButton);

        // Only show delete button for user templates (not built-ins)
        if (!template.isBuiltIn) {
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'template-list-button template-delete-button';
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => {
                handleTemplateDelete(template.command);
            });
            actions.appendChild(deleteButton);
        }
        header.appendChild(title);
        header.appendChild(actions);

        item.appendChild(header);
        list.appendChild(item);
    });
}

function openTemplateModal() {
    const { modal, commandInput } = getTemplateFormElements();
    if (!modal) return;

    hideAutocomplete(); // Close autocomplete when modal opens
    renderTemplateList();
    showTemplateFormMessage('');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    lastTemplateTrigger = document.activeElement;

    if (commandInput) {
        commandInput.focus();
    }
}

function closeTemplateModal() {
    closeTemplatePreview();
    const { modal } = getTemplateFormElements();
    if (!modal || modal.classList.contains('hidden')) return;

    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');

    if (lastTemplateTrigger && typeof lastTemplateTrigger.focus === 'function') {
        lastTemplateTrigger.focus();
    }
    lastTemplateTrigger = null;
}

function openTemplatePreview(template, trigger) {
    const { modal, command, prompt, closeButton } = getTemplatePreviewElements();
    if (!modal || !command || !prompt) return;

    hideAutocomplete(); // Close autocomplete when modal opens

    command.textContent = template.command;
    prompt.textContent = template.prompt;

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');

    lastTemplatePreviewTrigger = trigger || document.activeElement;

    if (closeButton) {
        closeButton.focus();
    }
}

function closeTemplatePreview() {
    const { modal, prompt } = getTemplatePreviewElements();
    if (!modal || modal.classList.contains('hidden')) {
        return;
    }

    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');

    if (prompt) {
        prompt.textContent = '';
    }

    if (lastTemplatePreviewTrigger && typeof lastTemplatePreviewTrigger.focus === 'function') {
        lastTemplatePreviewTrigger.focus();
    }
    lastTemplatePreviewTrigger = null;
}

function handleTemplateFormSubmit(event) {
    event.preventDefault();
    const { commandInput, promptInput } = getTemplateFormElements();
    if (!commandInput || !promptInput) return;

    const rawCommand = commandInput.value.trim();
    const rawPrompt = promptInput.value.trim();

    if (!rawPrompt) {
        showTemplateFormMessage('Template prompt is required.', { tone: 'error' });
        return;
    }

    const commandPattern = /^\/?[a-zA-Z0-9_-]{2,}$/;
    if (!commandPattern.test(rawCommand)) {
        showTemplateFormMessage('Use commands like /template_example. Letters, numbers, hyphens, and underscores are allowed.', { tone: 'error' });
        return;
    }

    const sanitizedCommand = sanitizeTemplateCommand(rawCommand);

    // Check if overriding a built-in template
    const existing = getTemplateByCommand(sanitizedCommand);
    if (existing && existing.isBuiltIn) {
        const override = confirm(
            `${sanitizedCommand} is a built-in template. Do you want to override it with your custom version?`
        );
        if (!override) {
            return;
        }
    }

    try {
        const { updated } = upsertTemplate({
            command: sanitizedCommand,
            prompt: rawPrompt
        });
        saveTemplatesToStorage()
            .then(() => {
                renderTemplateList();
                showTemplateFormMessage(updated ? `Updated ${sanitizedCommand}` : `Saved ${sanitizedCommand}`);
                promptInput.value = '';
                commandInput.value = sanitizedCommand;
                promptInput.focus();
            })
            .catch((error) => {
                console.error('Failed to persist templates:', error);
                showTemplateFormMessage('Failed to save template. Check console for details.', { tone: 'error' });
            });
    } catch (error) {
        console.error('Failed to save template:', error);
        showTemplateFormMessage('Template command and prompt are required.', { tone: 'error' });
    }
}

function handleTemplateDelete(command) {
    const template = getTemplateByCommand(command);

    // Prevent deletion of built-in templates
    if (template && template.isBuiltIn) {
        showTemplateFormMessage('Built-in templates cannot be deleted. You can override them by creating a template with the same command.', { tone: 'error' });
        return;
    }

    if (!removeTemplate(command)) {
        showTemplateFormMessage(`Could not find ${command} to delete.`, { tone: 'error' });
        return;
    }

    saveTemplatesToStorage()
        .then(() => {
            renderTemplateList();
            showTemplateFormMessage(`Deleted ${command}`);
        })
        .catch((error) => {
            console.error('Failed to delete template:', error);
            showTemplateFormMessage('Failed to delete template. Check console for details.', { tone: 'error' });
        });
}

function handleTemplateModalsKeydown(event) {
    if (event.key !== 'Escape') {
        return;
    }

    const { modal: templateModal } = getTemplateFormElements();
    const { modal: previewModal } = getTemplatePreviewElements();

    const previewOpen = previewModal && !previewModal.classList.contains('hidden');
    if (previewOpen) {
        event.preventDefault();
        closeTemplatePreview();
        return;
    }

    const templateModalOpen = templateModal && !templateModal.classList.contains('hidden');
    if (templateModalOpen) {
        event.preventDefault();
        closeTemplateModal();
    }
}

function initializeTemplateModal() {
    const { openButton, closeButton, backdrop, form } = getTemplateFormElements();

    if (openButton) {
        openButton.addEventListener('click', openTemplateModal);
    }

    if (closeButton) {
        closeButton.addEventListener('click', closeTemplateModal);
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeTemplateModal);
    }

    if (form) {
        form.addEventListener('submit', handleTemplateFormSubmit);
    }

    document.addEventListener('keydown', handleTemplateModalsKeydown);
}

function initializeTemplatePreviewModal() {
    const { modal, backdrop, closeButton } = getTemplatePreviewElements();

    if (closeButton) {
        closeButton.addEventListener('click', closeTemplatePreview);
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeTemplatePreview);
    }

    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeTemplatePreview();
            }
        });
    }
}

const REFERENCE_IMAGE_SEED_KEY = 'canvas_agent_reference_seeded';

// Workflow Templates - each can be loaded from the Workflows modal
// Note: Paths are relative to root (Vite serves public folder contents from root)
const WORKFLOW_TEMPLATES = [
    {
        id: 'reference-example',
        title: '📖 Reference Example',
        description: 'Basic image iteration: start with a concept, ask AI to refine it',
        thumbnail: '/workflows/workflow0/preview.png',
        jsonPath: '/workflows/workflow0/workflow.json'
    },
    {
        id: 'style-workflow',
        title: '🎨 Style Workflow',
        description: 'Transform step by step: Original → Sketch → Styled',
        thumbnail: '/workflows/workflow1/preview.png',
        jsonPath: '/workflows/workflow1/workflow.json'
    },
    {
        id: 'cinematic-study',
        title: '🎥 Cinematic Study',
        description: 'Explore a single moment from multiple angles using a cinematic contact sheet.',
        thumbnail: '/workflows/workflow2/preview.png',
        jsonPath: '/workflows/workflow2/workflow.json'
    },
    {
        id: 'warm-wave-workflow',
        title: '🌊 Warm Wave',
        description: 'Creative workflow with warm, flowing visual elements and dynamic compositions.',
        thumbnail: '/workflows/workflow3/image.png',
        jsonPath: '/workflows/workflow3/warm-wave-canvas-2025-12-26.json'
    },
    {
        id: 'vibrant-sunset-workflow',
        title: '🌅 Vibrant Sunset',
        description: 'Explore vibrant color palettes and sunset-inspired visual storytelling.',
        thumbnail: '/workflows/workflow4/image.png',
        jsonPath: '/workflows/workflow4/vibrant-sunset-canvas-2025-12-26.json'
    },
    {
        id: 'pastel-ocean-workflow',
        title: '🌊 Pastel Ocean',
        description: 'Soft, dreamy ocean-themed workflow with pastel color schemes and fluid designs.',
        thumbnail: '/workflows/workflow5/image.png',
        jsonPath: '/workflows/workflow5/pastel-ocean-canvas-2025-12-26.json'
    },
    {
        id: 'desert-sunrise-workflow',
        title: '🏜️ Desert Sunrise',
        description: 'Warm desert landscapes with golden sunrise lighting and natural earth tones.',
        thumbnail: '/workflows/workflow6/image.png',
        jsonPath: '/workflows/workflow6/desert-sunrise-canvas-2025-12-26.json'
    },
    {
        id: 'desert-sunrise-extended',
        title: '🌄 Desert Sunrise Extended',
        description: 'Extended desert sunrise workflow with advanced lighting and atmospheric effects.',
        thumbnail: '/workflows/workflow7/image.png',
        jsonPath: '/workflows/workflow7/desert-sunrise-canvas-2025-12-26 (1).json'
    },
    {
        id: 'digital-wave-workflow',
        title: '💫 Digital Wave',
        description: 'Modern digital art workflow with wave patterns and futuristic aesthetics.',
        thumbnail: '/workflows/workflow8/image.png',
        jsonPath: '/workflows/workflow8/digital-wave-canvas-2025-12-26.json'
    },
    {
        id: 'desert-sunrise-pro',
        title: '🏜️ Desert Sunrise Pro',
        description: 'Professional desert sunrise workflow with advanced composition and color grading.',
        thumbnail: '/workflows/workflow9/image.png',
        jsonPath: '/workflows/workflow9/desert-sunrise-canvas-2025-12-26 (2).json'
    }
];

// Default workflow to show on empty canvas
const DEFAULT_WORKFLOW = WORKFLOW_TEMPLATES.find(w => w.id === 'cinematic-study') || WORKFLOW_TEMPLATES[0];

function canvasCurrentlyEmpty() {
    if (typeof canvasState !== 'object' || canvasState === null) {
        return false;
    }

    const noImages = !Array.isArray(canvasState.images) || canvasState.images.length === 0;
    const noVideos = !Array.isArray(canvasState.videos) || canvasState.videos.length === 0;
    const noNotes = !Array.isArray(canvasState.notes) || canvasState.notes.length === 0;
    return noImages && noVideos && noNotes;
}

function hasSeededReferenceImages() {
    try {
        return localStorage.getItem(REFERENCE_IMAGE_SEED_KEY) === 'true';
    } catch (error) {
        console.warn('Unable to read reference image seed flag from storage:', error);
        return false;
    }
}

function markReferenceImagesSeeded() {
    try {
        localStorage.setItem(REFERENCE_IMAGE_SEED_KEY, 'true');
    } catch (error) {
        console.warn('Unable to persist reference image seed flag:', error);
    }
}

async function loadWorkflow(workflow) {
    if (!workflow) return false;

    // Load JSON if path exists
    if (workflow.jsonPath) {
        try {
            const response = await fetch(workflow.jsonPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const payload = await response.json();

            // Restore project title if available
            if (payload.projectTitle) {
                canvasState.projectTitle = payload.projectTitle;
                const titleEl = document.getElementById('projectTitleInput');
                if (titleEl) titleEl.value = payload.projectTitle;
            }

            const { images, videos, audios, notes, viewport, chatHistory } = normalizeImportedCanvasPayload(payload);

            const persistedState = {
                imageCounter: getNextIdValue(images),
                videoCounter: getNextIdValue(videos),
                audioCounter: getNextIdValue(audios),
                noteCounter: getNextIdValue(notes),
                zoom: viewport.zoom,
                offsetX: viewport.offsetX,
                offsetY: viewport.offsetY
            };

            hydrateCanvasFromRecords(images, videos, audios, notes, persistedState);

            // Restore chat history if available
            const effectiveChatHistory = chatHistory || payload.chatHistory;
            if (effectiveChatHistory && typeof applyChatHistorySnapshot === 'function') {
                applyChatHistorySnapshot(effectiveChatHistory);
                if (typeof saveChatHistory === 'function') {
                    saveChatHistory();
                }
            }

            // Pre-fill chat input if template has a preference, else use payload's last user msg
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                if (workflow.chatPrompt) {
                    chatInput.value = workflow.chatPrompt;
                } else if (effectiveChatHistory && effectiveChatHistory.chatMessages) {
                    const lastUserMsg = [...effectiveChatHistory.chatMessages].reverse().find(m => m.type === 'user');
                    if (lastUserMsg) chatInput.value = lastUserMsg.text;
                }
                chatInput.focus();
            }
        } catch (error) {
            console.error('Failed to load workflow JSON:', error);
            addChatMessage(`❌ Failed to load workflow "${workflow.title}".`, 'system');
            return false;
        }
    }

    addChatMessage(`🔄 Loaded "${workflow.title}" workflow.`, 'system');
    initializeHistoryTracking();
    return true;
}

async function seedReferenceImagesIfNeeded() {
    if (!canvasCurrentlyEmpty()) {
        return;
    }

    if (hasSeededReferenceImages()) {
        return;
    }

    const success = await loadWorkflow(DEFAULT_WORKFLOW);

    if (success) {
        markReferenceImagesSeeded();
        addChatMessage('🖼️ Welcome! Check out the example workflows on the canvas. Feel free to edit or delete them.', 'system');
    }
}

async function bootstrapApplicationState() {
    try {
        // Initialize session first
        console.log('=== BOOTSTRAP START ===');
        const sessionId = initializeSession();
        console.log('Session initialized in bootstrap:', sessionId);

        initializeSessionModal();

        console.log('Starting restoration process...');
        const [canvasRestored] = await Promise.all([
            restoreCanvasState(),
            restoreChatHistory(),
            restoreTemplates()
        ]);

        console.log('Restoration completed. Canvas restored:', canvasRestored);

        if (!canvasRestored) {
            // Check if this is a workflow link (new tab from workflow modal)
            const loadedWorkflow = await loadWorkflowFromUrlParam();
            if (!loadedWorkflow) {
                console.log('No canvas data restored, seeding reference images...');
                await seedReferenceImagesIfNeeded();
            }
        }
    } catch (error) {
        console.error('Failed to restore application state:', error);
        if (canvasCurrentlyEmpty()) {
            try {
                const loadedWorkflow = await loadWorkflowFromUrlParam();
                if (!loadedWorkflow) {
                    await seedReferenceImagesIfNeeded();
                }
            } catch (seedError) {
                console.error('Failed to seed reference images after restore error:', seedError);
            }
        }
    } finally {
        console.log('=== BOOTSTRAP COMPLETE ===');
        renderTemplateList();
        initializeHistoryTracking();
        initializeProjectTitleInput();
        const currentSessionId = getCurrentSessionId();
        console.log('Final session ID in bootstrap:', currentSessionId);
        if (currentSessionId) {
            addChatMessage(`🖱️ Working in session: ${currentSessionId}. Drag on canvas background to box-select. Hold Space or press H for Pan Mode.`, 'system');
        } else {
            addChatMessage('🖱️ Tip: Drag on the canvas background to box-select multiple images. Hold Space or press H (Pan Mode) to drag the canvas.', 'system');
        }
    }
}

// Workflow Modal Functions
function initializeWorkflowModal() {
    const openBtn = document.getElementById('openWorkflowModalBtn');
    const closeBtn = document.getElementById('closeWorkflowModalBtn');
    const backdrop = document.getElementById('workflowModalBackdrop');
    const modal = document.getElementById('workflowModal');

    if (openBtn) {
        openBtn.addEventListener('click', openWorkflowModal);
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', closeWorkflowModal);
    }
    if (backdrop) {
        backdrop.addEventListener('click', closeWorkflowModal);
    }
    if (modal) {
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeWorkflowModal();
            }
        });
    }
}

function openWorkflowModal() {
    const modal = document.getElementById('workflowModal');
    if (!modal) return;

    renderWorkflowList();
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    modal.focus();
}

function closeWorkflowModal() {
    const modal = document.getElementById('workflowModal');
    if (!modal) return;

    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
}

function renderWorkflowList() {
    const container = document.getElementById('workflowList');
    if (!container) return;

    container.innerHTML = '';

    for (const workflow of WORKFLOW_TEMPLATES) {
        const card = document.createElement('div');
        card.className = 'workflow-card';

        const thumbnailHtml = workflow.thumbnail
            ? `<img class="workflow-card-thumbnail" src="${workflow.thumbnail}" alt="${workflow.title} preview" loading="lazy">`
            : '';

        card.innerHTML = `
            ${thumbnailHtml}
            <div class="workflow-card-header">
                <h3 class="workflow-card-title">${workflow.title}</h3>
            </div>
            <p class="workflow-card-description">${workflow.description}</p>
            <button type="button" class="workflow-card-btn" data-workflow-id="${workflow.id}">Try This</button>
        `;

        const btn = card.querySelector('.workflow-card-btn');
        btn.addEventListener('click', () => loadWorkflowTemplate(workflow.id));

        container.appendChild(card);
    }
}

function loadWorkflowTemplate(workflowId) {
    const workflow = WORKFLOW_TEMPLATES.find(w => w.id === workflowId);
    if (!workflow) {
        console.error('Workflow not found:', workflowId);
        return;
    }

    closeWorkflowModal();

    // Open new browser tab with workflow parameter
    // This creates a fresh session with only this workflow
    const newSessionId = generateSessionId();
    const url = new URL(window.location.href);
    url.searchParams.set('session', newSessionId);
    url.searchParams.set('workflow', workflowId);
    window.open(url.toString(), '_blank');
}

// Load workflow from URL parameter (called during bootstrap)
async function loadWorkflowFromUrlParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const workflowId = urlParams.get('workflow');

    if (!workflowId) return false;

    const workflow = WORKFLOW_TEMPLATES.find(w => w.id === workflowId);
    if (!workflow) {
        console.warn('Workflow not found:', workflowId);
        return false;
    }

    // Remove workflow param from URL (one-time load)
    const url = new URL(window.location.href);
    url.searchParams.delete('workflow');
    window.history.replaceState({}, '', url.toString());

    return await loadWorkflow(workflow);
}

// Simplified Onboarding
const ONBOARDING_SEEN_KEY = 'canvas_agent_onboarding_seen';

function hasSeenOnboarding() {
    try {
        return localStorage.getItem(ONBOARDING_SEEN_KEY) === 'true';
    } catch (error) {
        return false;
    }
}

function markOnboardingSeen() {
    try {
        localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
    } catch (error) {
        console.warn('Unable to save onboarding state:', error);
    }
}

function openOnboardingModal() {
    const modal = document.getElementById('onboardingModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeOnboardingModal() {
    const modal = document.getElementById('onboardingModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function initializeOnboarding() {
    const closeBtn = document.getElementById('closeOnboardingBtn');
    const backdrop = document.getElementById('onboardingBackdrop');
    const dismissBtn = document.getElementById('onboardingDismiss');
    const openSettingsBtn = document.getElementById('onboardingOpenSettings');
    const workflowsBtn = document.getElementById('onboardingWorkflows');
    const openBtn = document.getElementById('openOnboardingBtn');
    const fullGuideToggle = document.getElementById('fullGuideToggle');
    const fullGuideContent = document.getElementById('fullGuideContent');

    // Open handler (guide button in header)
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            openOnboardingModal();
        });
    }

    // Full Guide toggle button
    if (fullGuideToggle && fullGuideContent) {
        fullGuideToggle.addEventListener('click', () => {
            const isOpen = !fullGuideContent.classList.contains('hidden');
            if (isOpen) {
                fullGuideContent.classList.add('hidden');
                fullGuideToggle.classList.remove('is-open');
                fullGuideToggle.querySelector('span:first-child').textContent = '📖 Show Full Guide';
            } else {
                fullGuideContent.classList.remove('hidden');
                fullGuideToggle.classList.add('is-open');
                fullGuideToggle.querySelector('span:first-child').textContent = '📖 Hide Full Guide';
            }
        });
    }

    // Close handlers
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeOnboardingModal();
            markOnboardingSeen();
        });
    }
    if (backdrop) {
        backdrop.addEventListener('click', () => {
            closeOnboardingModal();
            markOnboardingSeen();
        });
    }
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            closeOnboardingModal();
            markOnboardingSeen();
        });
    }

    // Open Settings button
    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', () => {
            closeOnboardingModal();
            markOnboardingSeen();
            // Open settings modal
            const settingsModal = document.getElementById('settingsModal');
            if (settingsModal) {
                settingsModal.classList.remove('hidden');
                settingsModal.setAttribute('aria-hidden', 'false');
            }
        });
    }

    // Workflows button
    if (workflowsBtn) {
        workflowsBtn.addEventListener('click', () => {
            closeOnboardingModal();
            markOnboardingSeen();
            openWorkflowModal();
        });
    }

    // Templates button
    const templatesBtn = document.getElementById('onboardingTemplates');
    if (templatesBtn) {
        templatesBtn.addEventListener('click', () => {
            closeOnboardingModal();
            markOnboardingSeen();
            openTemplateModal();
        });
    }

    // Escape key to close
    document.getElementById('onboardingModal')?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeOnboardingModal();
            markOnboardingSeen();
        }
    });

    // Render workflow cards in onboarding
    renderOnboardingWorkflows();
}

function renderOnboardingWorkflows() {
    const container = document.getElementById('onboardingWorkflowCards');
    if (!container) return;

    container.innerHTML = '';
    WORKFLOW_TEMPLATES.forEach(workflow => {
        const card = document.createElement('div');
        card.className = 'onboarding-workflow-card';
        card.innerHTML = `
            ${workflow.thumbnail ? `<img src="${workflow.thumbnail}" alt="${workflow.title}">` : ''}
            <div class="onboarding-workflow-info">
                <strong>${workflow.title}</strong>
                <p>${workflow.description}</p>
            </div>
            <button class="onboarding-workflow-btn" data-workflow-id="${workflow.id}">Try It</button>
        `;
        card.querySelector('.onboarding-workflow-btn').addEventListener('click', () => {
            loadWorkflowTemplate(workflow.id);
            closeOnboardingModal();
            markOnboardingSeen();
        });
        container.appendChild(card);
    });
}

function showOnboardingIfNeeded() {
    if (!hasSeenOnboarding()) {
        // Small delay to let the page settle
        setTimeout(() => {
            openOnboardingModal();
        }, 500);
    }
}

// Initialize
initializeTemplateModal();
initializeTemplatePreviewModal();
initializeWorkflowModal();
initializeOnboarding();
enhanceExistingChatMessages();
updateCanvasStats();
bootstrapApplicationState().then(() => {
    showOnboardingIfNeeded();
});
initializeAutocomplete();
document.addEventListener('copy', handleCanvasCopy);
document.addEventListener('paste', handleCanvasPaste);
document.addEventListener('keydown', handleKeyboardShortcuts);
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !isTypingTarget()) {
        if (!isSpaceKeyDown) {
            isSpaceKeyDown = true;
        }
        event.preventDefault();
    }
});

document.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
        isSpaceKeyDown = false;
    }
});

// Mobile Tools Menu
function openMobileTools() {
    const modal = document.getElementById('mobileToolsModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeMobileTools() {
    const modal = document.getElementById('mobileToolsModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function initializeMobileToolsModal() {
    const toggle = document.getElementById('mobileMenuToggle');
    const closeBtn = document.getElementById('closeMobileToolsBtn');
    const backdrop = document.getElementById('mobileToolsBackdrop');

    if (toggle) {
        toggle.addEventListener('click', openMobileTools);
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', closeMobileTools);
    }
    if (backdrop) {
        backdrop.addEventListener('click', closeMobileTools);
    }

    // Close on escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const modal = document.getElementById('mobileToolsModal');
            if (modal && !modal.classList.contains('hidden')) {
                closeMobileTools();
            }
        }
    });
}

initializeMobileToolsModal();
