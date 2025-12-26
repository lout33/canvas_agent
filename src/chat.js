const MAX_PARALLEL_IMAGES = 50;
const MAX_PARALLEL_VIDEOS = 5;

function createChatReferenceElement(type, id, label) {
    const span = document.createElement('span');
    span.className = 'chat-reference';
    span.dataset.type = type;
    span.dataset.id = id;
    span.textContent = label;
    span.tabIndex = 0;

    const selectImageFn = () => {
        const numericId = parseInt(id, 10);
        const image = canvasState.images.find(img => img.id === numericId);
        if (image) {
            focusOnCanvasItem(image);
            selectImage(image, { additive: false, toggle: false });
        }
    };

    const selectVideoFn = () => {
        const numericId = parseInt(id, 10);
        const video = canvasState.videos.find(vid => vid.id === numericId);
        if (video) {
            focusOnCanvasItem(video);
            selectImage(video, { additive: false, toggle: false });
        }
    };

    const selectNoteFn = () => {
        const numericId = parseInt(id, 10);
        const note = canvasState.notes.find(note => note.id === numericId);
        if (note) {
            focusOnCanvasItem(note);
            selectImage(note, { additive: false, toggle: false });
        }
    };

    let selectFn = null;
    let title = '';

    switch (type) {
        case 'i':
            selectFn = selectImageFn;
            title = `Select image ${formatImageRef(id)}`;
            break;
        case 'v':
            selectFn = selectVideoFn;
            title = `Select video ${formatVideoRef(id)}`;
            break;
        case 't':
            selectFn = selectNoteFn;
            title = `Select note ${formatNoteRef(id)}`;
            break;
        default:
            break;
    }

    span.title = title;

    if (typeof selectFn === 'function') {
        const activate = (event) => {
            event.preventDefault();
            const idNumber = parseInt(id, 10);
            if (!Number.isFinite(idNumber)) {
                return;
            }

            try {
                selectFn(idNumber);
            } catch (error) {
                console.warn('Failed to activate chat reference:', error);
            }
        };

        span.addEventListener('click', activate);
        span.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                activate(event);
            }
        });
    }

    return span;
}

function appendLineWithReferences(fragment, line) {
    if (!(fragment instanceof DocumentFragment)) {
        return;
    }

    const text = typeof line === 'string' ? line : '';
    const pattern = new RegExp(CHAT_REFERENCE_REGEX.source, CHAT_REFERENCE_REGEX.flags);
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        const [fullMatch, prefix, identifier] = match;
        const startIndex = match.index;

        if (startIndex > lastIndex) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, startIndex)));
        }

        fragment.appendChild(createChatReferenceElement(prefix, identifier, fullMatch));
        lastIndex = startIndex + fullMatch.length;
    }

    if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    if (text.length === 0 && lastIndex === 0) {
        fragment.appendChild(document.createTextNode(''));
    }
}

function renderChatMessageContent(container, message) {
    if (!container) {
        return;
    }

    if (typeof message !== 'string') {
        container.textContent = message == null ? '' : String(message);
        return;
    }

    const fragment = document.createDocumentFragment();
    const lines = message.split('\n');
    lines.forEach((line, index) => {
        appendLineWithReferences(fragment, line);
        if (index < lines.length - 1) {
            fragment.appendChild(document.createElement('br'));
        }
    });

    container.textContent = '';
    container.appendChild(fragment);
}

function enhanceExistingChatMessages() {
    const existingMessages = document.querySelectorAll('#chatMessages .chat-message');
    existingMessages.forEach(messageEl => {
        renderChatMessageContent(messageEl, messageEl.textContent || '');
    });
}

function invokeGemini(options) {
    const helper = window.CanvasAgentGemini;
    if (!helper || typeof helper.callEndpoint !== 'function') {
        throw new Error('Gemini helper unavailable');
    }
    return helper.callEndpoint(options);
}

const agentRuntime = window.CanvasAgent || {};
const supportedAgentModels = Array.isArray(agentRuntime.SUPPORTED_AGENT_MODELS) && agentRuntime.SUPPORTED_AGENT_MODELS.length > 0
    ? [...agentRuntime.SUPPORTED_AGENT_MODELS]
    : ['gemini-2.5-flash', 'gemini-2.5-pro'];
const defaultAgentModel = typeof agentRuntime.DEFAULT_AGENT_MODEL === 'string' && supportedAgentModels.includes(agentRuntime.DEFAULT_AGENT_MODEL)
    ? agentRuntime.DEFAULT_AGENT_MODEL
    : supportedAgentModels[0];

function resolveAgentModel(model) {
    if (typeof model !== 'string') {
        return defaultAgentModel;
    }
    const trimmed = model.trim();
    if (trimmed.length === 0) {
        return defaultAgentModel;
    }
    return supportedAgentModels.includes(trimmed) ? trimmed : defaultAgentModel;
}

const readAgentModel = typeof agentRuntime.getAgentModel === 'function'
    ? () => resolveAgentModel(agentRuntime.getAgentModel())
    : () => defaultAgentModel;

const writeAgentModel = typeof agentRuntime.setAgentModel === 'function'
    ? (model) => resolveAgentModel(agentRuntime.setAgentModel(model))
    : (model) => resolveAgentModel(model);

function getActiveAgentModel() {
    return resolveAgentModel(readAgentModel());
}

function setActiveAgentModel(model) {
    return writeAgentModel(model);
}

// Image Model Configuration
const supportedImageModels = Array.isArray(agentRuntime.SUPPORTED_IMAGE_MODELS) && agentRuntime.SUPPORTED_IMAGE_MODELS.length > 0
    ? [...agentRuntime.SUPPORTED_IMAGE_MODELS]
    : ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];
const defaultImageModel = typeof agentRuntime.DEFAULT_IMAGE_MODEL === 'string' && supportedImageModels.includes(agentRuntime.DEFAULT_IMAGE_MODEL)
    ? agentRuntime.DEFAULT_IMAGE_MODEL
    : supportedImageModels[0];

function resolveImageModel(model) {
    if (typeof model !== 'string') {
        return defaultImageModel;
    }
    const trimmed = model.trim();
    if (trimmed.length === 0) {
        return defaultImageModel;
    }
    return supportedImageModels.includes(trimmed) ? trimmed : defaultImageModel;
}

const readImageModel = typeof agentRuntime.getImageModel === 'function'
    ? () => resolveImageModel(agentRuntime.getImageModel())
    : () => defaultImageModel;

const writeImageModel = typeof agentRuntime.setImageModel === 'function'
    ? (model) => resolveImageModel(agentRuntime.setImageModel(model))
    : (model) => resolveImageModel(model);

function getActiveImageModel() {
    return resolveImageModel(readImageModel());
}

function setActiveImageModel(model) {
    return writeImageModel(model);
}

function normalizePositiveInteger(value, fallback = 1) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    const floored = Math.floor(value);
    return floored >= 1 ? floored : fallback;
}

function applyParallelGenerationLimits({ commandJson, referencedImages = [], requestId }) {
    if (!commandJson || typeof commandJson !== 'object') {
        return null;
    }

    const addLimitLog = (message) => {
        if (typeof requestId === 'number') {
            addRequestLog(requestId, '⚠️', message);
        }
    };

    const buildLimitResponse = (type, requested, extraLogDetail = '') => {
        const message = type === 'image'
            ? `I can only generate up to ${MAX_PARALLEL_IMAGES} images at once. You asked for ${requested}. Please reduce your request.`
            : `I can only generate up to ${MAX_PARALLEL_VIDEOS} videos at once. You asked for ${requested}. Please reduce your request.`;

        const logDetail = extraLogDetail ? `${message} ${extraLogDetail}` : message;
        addLimitLog(logDetail);

        return {
            commandJson: {
                action: 'chat',
                response: message
            },
            aiResponse: message
        };
    };

    const actionType = commandJson.action;

    if (actionType === 'generate_images' || actionType === 'edit_images') {
        const normalizedCount = normalizePositiveInteger(commandJson.count, 1);
        commandJson.count = normalizedCount;

        if (normalizedCount > MAX_PARALLEL_IMAGES) {
            return buildLimitResponse('image', normalizedCount);
        }

        return null;
    }

    if (actionType === 'generate_video') {
        const normalizedCount = normalizePositiveInteger(commandJson.count, 1);
        commandJson.count = normalizedCount;

        if (normalizedCount > 3) { // Gemini 2.0 Flash video limit
            return buildLimitResponse('video', normalizedCount);
        }

        return null;
    }

    return null;
}

function addChatMessage(message, type, options = {}) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    if (typeof options.requestId === 'number') {
        messageDiv.dataset.requestId = String(options.requestId);
    }

    renderChatMessageContent(messageDiv, message);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (type === 'user' || type === 'assistant') {
        saveChatHistory();
    }

    return messageDiv;
}

function requestLabel(requestId) {
    return `Request #${requestId}`;
}

function requestStatusEmoji(status) {
    switch (status) {
        case 'queued':
        case 'pending':
            return '🟡';
        case 'running':
            return '🔄';
        case 'success':
            return '✅';
        case 'error':
            return '❌';
        default:
            return '🟡';
    }
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyTemplatesToMessage(rawMessage) {
    if (typeof rawMessage !== 'string' || rawMessage.trim().length === 0) {
        return {
            effectiveMessage: rawMessage,
            usedTemplates: [],
            missingCommands: []
        };
    }

    const matches = [];
    const regex = new RegExp(TEMPLATE_COMMAND_REGEX.source, 'gi');
    let match;

    while ((match = regex.exec(rawMessage)) !== null) {
        const prefix = match[1] || '';
        const commandBody = match[3];
        if (!commandBody) {
            continue;
        }

        const originalCommand = `/${commandBody}`;
        matches.push({
            prefix,
            fullMatch: match[0],
            originalCommand,
            normalizedCommand: normalizeTemplateCommand(originalCommand)
        });
    }

    if (matches.length === 0) {
        return {
            effectiveMessage: rawMessage,
            usedTemplates: [],
            missingCommands: []
        };
    }

    const usedTemplates = [];
    const missingCommands = [];
    const usedNormalized = new Set();

    matches.forEach(({ normalizedCommand, originalCommand }) => {
        if (!normalizedCommand) {
            missingCommands.push(originalCommand);
            return;
        }

        if (usedNormalized.has(normalizedCommand)) {
            return;
        }

        const template = getTemplateByNormalizedCommand(normalizedCommand);
        if (template) {
            usedTemplates.push(template);
            usedNormalized.add(normalizedCommand);
        } else {
            missingCommands.push(originalCommand);
        }
    });

    let effectiveMessage = rawMessage;
    const removableTemplates = new Set(usedTemplates.map(template => template.normalizedCommand));

    matches.forEach(({ fullMatch, prefix, normalizedCommand }) => {
        if (!removableTemplates.has(normalizedCommand)) {
            return;
        }

        const escaped = escapeRegExp(fullMatch);
        const replacement = prefix || '';
        effectiveMessage = effectiveMessage.replace(new RegExp(escaped, 'g'), replacement);
    });

    effectiveMessage = effectiveMessage.trim();

    if (usedTemplates.length > 0) {
        const appended = usedTemplates.map(template => template.prompt).join('\n\n');
        effectiveMessage = effectiveMessage ? `${effectiveMessage}\n\n${appended}` : appended;
    }

    const uniqueMissingCommands = [];
    const seenMissing = new Set();
    missingCommands.forEach((command) => {
        const normalized = normalizeTemplateCommand(command);
        if (!normalized || seenMissing.has(normalized)) {
            return;
        }
        seenMissing.add(normalized);
        uniqueMissingCommands.push(sanitizeTemplateCommand(command));
    });

    return {
        effectiveMessage,
        usedTemplates,
        missingCommands: uniqueMissingCommands
    };
}

function startRequestStatus(requestId, message) {
    const statusElement = addChatMessage(
        `${requestStatusEmoji('queued')} ${requestLabel(requestId)} — ${message}`,
        'system',
        { requestId }
    );
    activeRequests.set(requestId, { status: 'queued', element: statusElement });
    return statusElement;
}

function updateRequestStatus(requestId, status, message) {
    const entry = activeRequests.get(requestId);
    if (!entry) return;
    entry.status = status;
    if (entry.element) {
        const statusMessage = `${requestStatusEmoji(status)} ${requestLabel(requestId)} — ${message}`;
        renderChatMessageContent(entry.element, statusMessage);
    }
}

function completeRequestStatus(requestId) {
    activeRequests.delete(requestId);
    generationAnchors.delete(requestId);
}

function addRequestLog(requestId, emoji, message) {
    addChatMessage(`${emoji} ${requestLabel(requestId)} — ${message}`, 'system', { requestId });
}

function clearChat() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    chatMessages.innerHTML = `
        <div class="chat-message assistant">
            👋 Chat cleared! Ready for new commands.
        </div>
    `;
    enhanceExistingChatMessages();
    conversationHistory = [];
    saveChatHistory();
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = '❌ ' + message;
    errorMessage.classList.add('show');
    setTimeout(() => errorMessage.classList.remove('show'), 5000);
}

// Chat Functions
function sendMessage() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const chatInput = document.getElementById('chatInput');
    const userMessage = chatInput.value.trim();
    const sendBtn = document.getElementById('sendBtn');
    const errorMessage = document.getElementById('errorMessage');

    errorMessage.classList.remove('show');

    if (!userMessage) {
        showError('Please enter a message');
        return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = directModeEnabled ? 'Generating...' : 'Queuing...';

    try {
        addChatMessage(userMessage, 'user');
        chatInput.value = '';
        autoResizeTextarea(chatInput); // Reset textarea size after clearing

        // Handle direct image generation mode
        if (directModeEnabled) {
            const templateApplication = applyTemplatesToMessage(userMessage);
            const effectiveMessage = templateApplication.effectiveMessage;
            handleDirectImageGeneration(effectiveMessage, apiKey);
            return;
        }

        // Normal agent-based processing
        const templateApplication = applyTemplatesToMessage(userMessage);
        const effectiveMessage = templateApplication.effectiveMessage;

        const userEntry = {
            role: 'user',
            parts: [{ text: effectiveMessage }]
        };
        const conversationSnapshot = [...conversationHistory, userEntry];
        conversationHistory.push(userEntry);

        const requestId = ++requestSequence;
        startRequestStatus(requestId, 'Queued');

        processUserRequest({
            requestId,
            apiKey,
            userMessage,
            templateApplication,
            conversationSnapshot
        });
    } finally {
        sendBtn.disabled = false;
        updateSendButtonText();
    }
}

async function processUserRequest({ requestId, apiKey, userMessage, templateApplication = {}, conversationSnapshot }) {
    updateRequestStatus(requestId, 'running', 'Interpreting command...');

    try {
        // Check for story mode approval
        if (canvasState.storyMode.active && canvasState.storyMode.stage === 'awaiting_approval') {
            if (detectApprovalMessage(userMessage)) {
                // User approved Stage 1, trigger Stage 2
                addRequestLog(requestId, '✅', 'Story approved! Generating remaining scenes...');
                // Continue with normal agent call with story context
            }
        }

        // Extract image references with modifiers (e.g., @i224:style)
        const imageReferencesWithModifiers = extractImageReferencesWithModifiers(userMessage);
        const legacyImageIds = extractPrefixedIds(userMessage, LEGACY_IMAGE_REFERENCE_REGEX);

        // Combine all unique image IDs
        const allImageIds = Array.from(new Set([
            ...imageReferencesWithModifiers.map(ref => ref.id),
            ...legacyImageIds
        ]));

        let referencedImages = [];

        // First, get explicitly referenced images
        if (allImageIds.length > 0) {
            const explicitReferencedImages = canvasState.images.filter(img => allImageIds.includes(img.id));

            if (explicitReferencedImages.length === 0) {
                addRequestLog(
                    requestId,
                    '⚠️',
                    `No images found with IDs: ${allImageIds.map(id => formatImageRef(id)).join(', ')}`
                );
                updateRequestStatus(requestId, 'error', 'Referenced images not found');
                return;
            }

            // Enforce "first :base only" rule
            let firstBaseFound = false;
            const ignoredBaseIds = [];

            // Attach modifier information to each image
            referencedImages = explicitReferencedImages.map(img => {
                const refWithModifier = imageReferencesWithModifiers.find(ref => ref.id === img.id);
                let modifier = refWithModifier?.modifier || null;

                // Enforce first :base only rule
                if (modifier === 'base') {
                    if (firstBaseFound) {
                        // This is a subsequent :base, ignore it
                        ignoredBaseIds.push(img.id);
                        modifier = null;
                    } else {
                        firstBaseFound = true;
                    }
                }

                return {
                    ...img,
                    referenceModifier: modifier
                };
            });

            // Create log message indicating modifiers
            const imageRefs = referencedImages.map(img => {
                const baseRef = formatImageRef(img.id);
                return img.referenceModifier ? `${baseRef}:${img.referenceModifier}` : baseRef;
            }).join(', ');

            let logMessage = `Found ${explicitReferencedImages.length} explicitly referenced image${explicitReferencedImages.length > 1 ? 's' : ''}: ${imageRefs}`;

            // Add warning about ignored :base modifiers
            if (ignoredBaseIds.length > 0) {
                logMessage += ` (Note: :base on ${ignoredBaseIds.map(id => formatImageRef(id)).join(', ')} ignored - only first :base counts)`;
            }

            addRequestLog(
                requestId,
                '🔍',
                logMessage
            );
        }

        const videoIdsInMessage = extractPrefixedIds(userMessage, VIDEO_REFERENCE_REGEX);
        let referencedVideos = [];

        // First, get explicitly referenced videos
        if (videoIdsInMessage.length > 0) {
            const explicitReferencedVideos = canvasState.videos.filter(video => videoIdsInMessage.includes(video.id));

            const missingVideos = videoIdsInMessage.filter(id => !explicitReferencedVideos.some(video => video.id === id));
            if (missingVideos.length > 0) {
                addRequestLog(
                    requestId,
                    '⚠️',
                    `No videos found with IDs: ${missingVideos.map(id => formatVideoRef(id)).join(', ')}`
                );
            }

            if (explicitReferencedVideos.length > 0) {
                addRequestLog(
                    requestId,
                    '🎞️',
                    `Found ${explicitReferencedVideos.length} explicitly referenced video${explicitReferencedVideos.length > 1 ? 's' : ''}: ${explicitReferencedVideos.map(video => formatVideoRef(video.id)).join(', ')}`
                );
            }
            referencedVideos = explicitReferencedVideos;
        }

        const noteIdsInMessage = extractPrefixedIds(userMessage, NOTE_REFERENCE_REGEX);
        let referencedNotes = [];

        // First, get explicitly referenced notes
        if (noteIdsInMessage.length > 0) {
            const explicitReferencedNotes = canvasState.notes.filter(note => noteIdsInMessage.includes(note.id));

            const missingNotes = noteIdsInMessage.filter(id => !explicitReferencedNotes.some(note => note.id === id));
            if (missingNotes.length > 0) {
                addRequestLog(
                    requestId,
                    '⚠️',
                    `No notes found with IDs: ${missingNotes.map(id => formatNoteRef(id)).join(', ')}`
                );
            }

            if (explicitReferencedNotes.length > 0) {
                addRequestLog(
                    requestId,
                    '📝',
                    `Found ${explicitReferencedNotes.length} explicitly referenced note${explicitReferencedNotes.length > 1 ? 's' : ''}: ${explicitReferencedNotes.map(note => formatNoteRef(note.id)).join(', ')}`
                );
            }
            referencedNotes = explicitReferencedNotes;
        }

        const videoUrlsInMessage = extractVideoUrlsFromText(userMessage);
        if (videoUrlsInMessage.length > 0) {
            addRequestLog(
                requestId,
                '🔗',
                `Detected ${videoUrlsInMessage.length} video URL${videoUrlsInMessage.length > 1 ? 's' : ''}: ${videoUrlsInMessage.join(', ')}`
            );
        }

        if (Array.isArray(templateApplication.usedTemplates) && templateApplication.usedTemplates.length > 0) {
            const applied = templateApplication.usedTemplates.map(template => template.command).join(', ');
            addRequestLog(requestId, '🧩', `Applied templates: ${applied}`);
        }

        if (Array.isArray(templateApplication.missingCommands) && templateApplication.missingCommands.length > 0) {
            addRequestLog(requestId, '⚠️', `Missing templates: ${templateApplication.missingCommands.join(', ')}`);
        }

        updateRequestStatus(requestId, 'running', `Parsing command with ${getActiveAgentModel()}`);

        // Get live canvas state for agent context
        let canvasStateJson = null;
        if (typeof getAgentCanvasState === 'function') {
            canvasStateJson = getAgentCanvasState();
        } else {
            console.warn('[Chat] getAgentCanvasState function not available');
        }

        let { commands, aiResponse } = await interpretUserCommand(
            {
                apiKey,
                conversationSnapshot,
                referencedImages,
                referencedVideos,
                referencedNotes,
                videoUrls: videoUrlsInMessage,
                hasImageReferences: allImageIds.length > 0,
                hasVideoReferences: referencedVideos.length > 0,
                hasNoteReferences: referencedNotes.length > 0,
                canvasStateJson
            }
        );

        // Record model's natural response in history once
        conversationHistory.push({
            role: 'model',
            parts: [{ text: aiResponse }]
        });
        saveChatHistory();

        // Process each command returned by the model
        for (const command of commands) {
            // Apply limits to each command (could be improved to apply globally)
            const limitOverride = applyParallelGenerationLimits({
                commandJson: command,
                referencedImages,
                requestId
            });

            const commandToExecute = limitOverride ? limitOverride.commandJson : command;

            // Add model's friendly message to chat
            if (commandToExecute.response) {
                addChatMessage(commandToExecute.response, 'assistant');
            }

            if (commandToExecute.action === 'chat') {
                updateRequestStatus(requestId, 'success', 'Chat response delivered');
                continue;
            }

            // Execute the specific tool/action
            await executeCommand({
                command: commandToExecute,
                requestId,
                apiKey,
                referencedImages,
                referencedVideos,
                videoUrlsInMessage
            });
        }
    } catch (error) {
        console.error('Error in processUserRequest:', error);
        updateRequestStatus(requestId, 'error', error.message || 'Request failed');
        addRequestLog(requestId, '❌', `Error: ${error.message}`);
    }
}

/**
 * Executes a single command/tool call.
 * Logic moved from main processUserRequest for multi-command support.
 */
async function executeCommand({ command, requestId, apiKey, referencedImages, referencedVideos, videoUrlsInMessage }) {
    const commandJson = command; // Keep name for compatibility with existing blocks
    
    // Handle note creation
    if (commandJson.action === 'create_note') {
        try {
            const noteCount = commandJson.count || 1;
            const notes = commandJson.notes || [];

            updateRequestStatus(requestId, 'running', `Creating ${noteCount} note${noteCount > 1 ? 's' : ''}...`);
            addRequestLog(requestId, '📝', `Creating ${noteCount} note${noteCount > 1 ? 's' : ''} on canvas...`);

            // Start from center of viewport for first note
            const centerPos = getViewportCenter();
            const noteSpacing = DEFAULT_NOTE_WIDTH + GENERATION_SPACING;

            for (let i = 0; i < noteCount; i++) {
                const providedText = notes[i]?.text;
                const noteText = typeof providedText === 'string' ? providedText : '';

                const position = noteCount > 1 ? {
                    x: centerPos.x + (i * noteSpacing),
                    y: centerPos.y
                } : centerPos;

                const createdNote = addNoteToCanvas(noteText, position);
                addRequestLog(requestId, '✅', `Note ${i + 1}/${noteCount} created (${formatNoteRef(createdNote.id)})`);
            }

            updateRequestStatus(requestId, 'success', 'Notes created');
            addRequestLog(requestId, '✅', 'All notes added to canvas');
        } catch (error) {
            addRequestLog(requestId, '❌', `Note creation failed: ${error.message}`);
            updateRequestStatus(requestId, 'error', error.message);
        }
        return;
    }

    // Handle video generation
    if (commandJson.action === 'generate_video') {
        try {
            const videoCount = commandJson.count || 1;
            const prompts = commandJson.prompts || [];
            const config = commandJson.config || {};

            updateRequestStatus(requestId, 'running', `Generating ${videoCount} video${videoCount > 1 ? 's' : ''}...`);
            addRequestLog(requestId, '🎬', `Generating ${videoCount} video${videoCount > 1 ? 's' : ''}...`);

            // Generate videos sequentially
            for (let i = 0; i < videoCount; i++) {
                const promptForVideo = prompts[i] || commandJson.prompt || '';
                
                updateRequestStatus(requestId, 'running', `Video ${i + 1}/${videoCount} queued`);
                addRequestLog(requestId, '🎥', `Video ${i + 1}/${videoCount} prompt: "${promptForVideo}" — generating...`);

                await generateVideo(requestId, promptForVideo, config, i + 1, videoCount);
            }
        } catch (error) {
            addRequestLog(requestId, '❌', `Video generation failed: ${error.message}`);
            updateRequestStatus(requestId, 'error', error.message);
        }
        return;
    }

    // Handle audio generation
    if (commandJson.action === 'generate_audio') {
        try {
            const audioCount = commandJson.count || 1;
            const texts = commandJson.texts || [];
            const config = commandJson.config || {};

            updateRequestStatus(requestId, 'running', `Generating ${audioCount} audio clip${audioCount > 1 ? 's' : ''}...`);
            addRequestLog(requestId, '❌', 'Audio generation is not available in this version. Only image and video generation are supported.');
            updateRequestStatus(requestId, 'error', 'Audio generation not supported');

            for (let i = 0; i < audioCount; i++) {
                const text = texts[i] || '';

                if (!text) {
                    addRequestLog(requestId, '⚠️', `Audio ${i + 1}/${audioCount}: No text provided, skipping`);
                    continue;
                }

                updateRequestStatus(requestId, 'running', `Generating audio ${i + 1}/${audioCount}...`);
                addRequestLog(requestId, '🎙️', `Audio ${i + 1}/${audioCount}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

                // Call Fish Audio API via server
                const response = await fetch(`${SERVER_URL}/api/audio/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text,
                        config: {
                            voiceId: config.voiceId,
                            speed: config.speed,
                            format: config.format || 'mp3'
                        }
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `Server returned ${response.status}`);
                }

                const result = await response.json();

                // Add audio to canvas
                const audioObj = addAudioToCanvas(
                    result.audioData,
                    result.mimeType,
                    text,
                    null,
                    {
                        voiceId: config.voiceId,
                        config: result.config
                    }
                );

                addRequestLog(requestId, '✅', `Audio ${i + 1}/${audioCount} created (${formatAudioRef(audioObj.id)})`);
            }

            updateRequestStatus(requestId, 'success', 'Audio generated');
            addRequestLog(requestId, '✅', 'All audio clips added to canvas');
        } catch (error) {
            console.error('[Chat] Audio generation failed:', error);
            addRequestLog(requestId, '❌', `Audio generation failed: ${error.message}`);
            updateRequestStatus(requestId, 'error', error.message);
        }
        return;
    }

    // Handle unified story generation
    if (commandJson.action === 'story_unified_generation') {
        try {
            await handleUnifiedStoryGeneration(commandJson, apiKey, requestId);
        } catch (error) {
            console.error('[Chat] Unified story generation failed:', error);
            addRequestLog(requestId, '❌', `Story generation failed: ${error.message}`);
            updateRequestStatus(requestId, 'error', error.message);
        }
        return;
    }

    if (commandJson.action === 'describe_video') {
        try {
            const targets = Array.isArray(commandJson.videos) ? commandJson.videos : [];
            if (targets.length === 0) {
                throw new Error('No videos specified for analysis');
            }

            const defaultFocus = commandJson.analysisFocus || commandJson.prompt || 'Summarise the key visuals, actions, tone, and audio cues.';

            updateRequestStatus(
                requestId,
                'running',
                `Analysing ${targets.length} video${targets.length > 1 ? 's' : ''}...`
            );
            addRequestLog(
                requestId,
                '🎞️',
                `Analysing ${targets.length} video${targets.length > 1 ? 's' : ''} requested by the user...`
            );

            const summaries = [];
            let failures = 0;

            for (let i = 0; i < targets.length; i++) {
                const descriptor = targets[i] || {};
                let prepared;
                try {
                    prepared = await prepareVideoAnalysisInput({
                        apiKey,
                        descriptor,
                        referencedVideos,
                        fallbackUrls: videoUrlsInMessage,
                        index: i + 1,
                        requestId
                    });
                } catch (error) {
                    failures++;
                    addRequestLog(
                        requestId,
                        '❌',
                        `Video ${i + 1}: ${error.message}`
                    );
                    continue;
                }

                const focus = descriptor.analysisFocus || defaultFocus;
                const label = prepared.label;

                updateRequestStatus(
                    requestId,
                    'running',
                    `Analysing ${label} (${i + 1}/${targets.length})...`
                );
                addRequestLog(
                    requestId,
                    '🔍',
                    `Analysing ${label} (${i + 1}/${targets.length})...`
                );

                if (prepared.notes.length > 0) {
                    prepared.notes.forEach(note => {
                        addRequestLog(requestId, 'ℹ️', `${label}: ${note}`);
                    });
                }

                try {
                    const summary = await runVideoAnalysis({
                        apiKey,
                        part: prepared.part,
                        label,
                        analysisFocus: focus
                    });
                    const formatted = formatVideoSummaryForChat(label, summary);
                    summaries.push(formatted);
                    addRequestLog(requestId, '✅', `Analysis ready for ${label}`);
                } catch (error) {
                    failures++;
                    addRequestLog(
                        requestId,
                        '❌',
                        `Failed to analyse ${label}: ${error.message}`
                    );
                }
            }

            if (summaries.length > 0) {
                const combinedSummary = summaries.join('\n\n');
                conversationHistory.push({
                    role: 'model',
                    parts: [{ text: combinedSummary }]
                });
                addChatMessage(combinedSummary, 'assistant');
            }

            if (summaries.length === 0) {
                updateRequestStatus(
                    requestId,
                    'error',
                    failures > 0 ? 'Video analysis failed' : 'No analysis generated'
                );
            } else if (failures > 0) {
                updateRequestStatus(
                    requestId,
                    'success',
                    'Video analysis completed with some issues'
                );
            } else {
                updateRequestStatus(
                    requestId,
                    'success',
                    'Video analysis complete'
                );
            }
        } catch (error) {
            addRequestLog(requestId, '❌', `Video analysis failed: ${error.message}`);
            updateRequestStatus(requestId, 'error', error.message);
        }
        return;
    }

    if (commandJson.action === 'extract_video_frames') {
        try {
            const descriptor = commandJson.video || (Array.isArray(commandJson.videos) ? commandJson.videos[0] : null);
            let targetVideo = null;

            const candidateRefs = [
                commandJson.videoId,
                commandJson.referenceId,
                descriptor?.referenceId,
                descriptor?.canvasId,
                descriptor?.videoId,
                descriptor?.id
            ];

            for (const ref of candidateRefs) {
                const parsed = parseVideoReferenceId(ref);
                if (Number.isFinite(parsed)) {
                    const found = canvasState.videos.find(video => video.id === parsed);
                    if (found) {
                        targetVideo = found;
                        break;
                    }
                }
            }

            if (!targetVideo && Array.isArray(referencedVideos) && referencedVideos.length === 1) {
                targetVideo = referencedVideos[0];
            }

            if (!targetVideo && descriptor && descriptor.type === 'url' && descriptor.url) {
                targetVideo = {
                    type: 'video',
                    id: null,
                    mimeType: descriptor.mimeType || 'video/mp4',
                    sourceType: 'url',
                    sourceUrl: descriptor.url
                };
            }

            if (!targetVideo) {
                throw new Error('No video found for frame extraction. Reference a canvas video with @v labels or provide a direct video URL.');
            }

            if (targetVideo.sourceType === 'youtube') {
                throw new Error('Frame extraction is only supported for uploaded or direct video files, not YouTube embeds.');
            }

            const timestampSources = [
                commandJson.timestamps,
                commandJson.times,
                commandJson.seconds,
                commandJson.timecodes,
                descriptor?.timestamps,
                descriptor?.times,
                descriptor?.seconds,
                descriptor?.timecodes
            ];

            const timestamps = collectTimestampsFromSources(timestampSources);
            if (timestamps.length === 0) {
                throw new Error('No timestamps provided for frame extraction. Specify one or more timestamps like 1s, 5s, or 00:00:05.');
            }

            const sourceLabel = typeof targetVideo.id === 'number' && targetVideo.id >= 0
                ? formatVideoRef(targetVideo.id)
                : 'linked video';
            const formattedTimes = timestamps.map(formatSecondsForDisplay).join(', ');

            updateRequestStatus(
                requestId,
                'running',
                `Extracting ${timestamps.length} frame${timestamps.length > 1 ? 's' : ''}...`
            );
            addRequestLog(
                requestId,
                '🎞️',
                `Extracting frame${timestamps.length > 1 ? 's' : ''} from ${sourceLabel} at ${formattedTimes}.`
            );

            const captureResult = await captureFramesFromVideo(targetVideo, timestamps);
            const frames = captureResult.frames || [];

            if (frames.length === 0) {
                throw new Error('No frames could be captured from the selected video.');
            }

            const createdImages = [];
            const videoDuration = typeof captureResult.duration === 'number' ? captureResult.duration : targetVideo.duration;

            frames.forEach((frame, index) => {
                const timeLabel = formatSecondsForDisplay(frame.timestamp);
                const aspectRatio = getClosestAspectRatioLabel(frame.width, frame.height);
                const [canvasWidth, canvasHeight] = getCanvasSizeFromAspectRatio(aspectRatio);
                const placement = acquireGenerationPlacement(canvasWidth, canvasHeight, requestId);
                const resolutionLabel = frame.width && frame.height ? `${frame.width}x${frame.height}` : 'frame';
                const promptLabel = `Frame from ${sourceLabel} at ${timeLabel}`;

                const imageObj = addImageToCanvas(
                    frame.data,
                    'image/png',
                    promptLabel,
                    aspectRatio,
                    resolutionLabel,
                    [],
                    placement.position
                );

                createdImages.push(imageObj);

                addRequestLog(
                    requestId,
                    '🖼️',
                    `Frame ${index + 1}/${frames.length} captured at ${timeLabel} → ${formatImageRef(imageObj.id)}.`
                );

                if (typeof frame.requested === 'number' && Math.abs(frame.requested - frame.timestamp) > 0.01) {
                    const requestedLabel = formatSecondsForDisplay(frame.requested);
                    addRequestLog(
                        requestId,
                        '⚠️',
                        `Requested ${requestedLabel} adjusted to ${timeLabel}${typeof videoDuration === 'number' ? ` (video length ${formatSecondsForDisplay(videoDuration)})` : ''}.`
                    );
                }
            });

            const imageSummary = createdImages.map(img => formatImageRef(img.id)).join(', ');
            addRequestLog(
                requestId,
                '✅',
                `Extracted ${createdImages.length} frame${createdImages.length > 1 ? 's' : ''}: ${imageSummary}.`
            );
            updateRequestStatus(requestId, 'success', 'Frames extracted successfully');
        } catch (error) {
            addRequestLog(requestId, '❌', `Frame extraction failed: ${error.message}`);
            updateRequestStatus(requestId, 'error', error.message);
        }
        return;
    }

    if (commandJson.action === 'extract_from_url') {
        try {
            const urls = Array.isArray(commandJson.urls) ? commandJson.urls : (commandJson.url ? [commandJson.url] : []);
            if (urls.length === 0) {
                throw new Error('No URLs provided for extraction');
            }

            updateRequestStatus(requestId, 'running', `Extracting data from ${urls.length} URL${urls.length > 1 ? 's' : ''}...`);
            addRequestLog(requestId, '🕸️', `Starting Firecrawl extraction for: ${urls.join(', ')}`);

            // Use the Firecrawl extraction tool from tools.js
            const extractionResult = await performFirecrawlExtraction({
                apiKey: localStorage.getItem('FIRECRAWL_API_KEY'),
                urls,
                prompt: commandJson.prompt || 'Extract all key information',
                enableWebSearch: !!commandJson.enableWebSearch
            });

            if (extractionResult.success) {
                addRequestLog(requestId, '✅', 'Data extraction complete');
                
                // Add the result as a note to the canvas
                const resultText = `Extraction Result (${urls[0]}):\n\n${JSON.stringify(extractionResult.data, null, 2)}`;
                const centerPos = getViewportCenter();
                addNoteToCanvas(resultText, centerPos);
                
                updateRequestStatus(requestId, 'success', 'Extraction complete');
            } else {
                throw new Error(extractionResult.error || 'Extraction failed');
            }
        } catch (error) {
            addRequestLog(requestId, '❌', `Extraction failed: ${error.message}`);
            updateRequestStatus(requestId, 'error', error.message);
        }
        return;
    }

    // Handle video generation from image
    if (commandJson.action === 'generate_video_from_image') {
        try {
            // Support multiple images: if user references multiple @i labels, generate a video for each
            const imageIds = commandJson.imageIds || (commandJson.imageId ? [commandJson.imageId] : []);
            
            if (imageIds.length === 0) {
                addRequestLog(requestId, '❌', `No image IDs provided for video generation`);
                updateRequestStatus(requestId, 'error', `No image IDs provided`);
                return;
            }
            
            // Find all referenced images
            const sourceImages = imageIds.map(id => {
                const img = canvasState.images.find(img => img.id === id);
                if (!img) {
                    addRequestLog(requestId, '⚠️', `Image ${formatImageRef(id)} not found on canvas`);
                }
                return img;
            }).filter(Boolean);
            
            if (sourceImages.length === 0) {
                addRequestLog(requestId, '❌', `None of the referenced images were found on canvas`);
                updateRequestStatus(requestId, 'error', `Referenced images not found`);
                return;
            }

            // Calculate total videos: count per image * number of images
            const countPerImage = commandJson.count || 1;
            const totalVideos = sourceImages.length * countPerImage;
            
            // Ensure we have enough prompts
            if (!Array.isArray(commandJson.prompts) || commandJson.prompts.length !== totalVideos) {
                // Generate default prompts for each video
                commandJson.prompts = Array.from({ length: totalVideos }, (_, i) => {
                    const imageIndex = Math.floor(i / countPerImage);
                    const variationIndex = i % countPerImage;
                    return commandJson.prompt || `Video variation ${variationIndex + 1} from image`;
                });
            }

            const actionSummary = sourceImages.length > 1
                ? `Creating ${countPerImage} video${countPerImage > 1 ? 's' : ''} from each of ${sourceImages.length} images (${totalVideos} total)`
                : `Creating ${countPerImage} video${countPerImage > 1 ? 's' : ''} from ${formatImageRef(sourceImages[0].id)}`;
            
            updateRequestStatus(requestId, 'running', `${actionSummary}...`);
            addRequestLog(requestId, '🎬', `${actionSummary}...`);

            // Generate videos sequentially for each image
            let videoIndex = 0;
            for (const sourceImage of sourceImages) {
                for (let i = 0; i < countPerImage; i++) {
                    const promptForVideo = commandJson.prompts[videoIndex] || commandJson.prompt || '';
                    const currentNum = videoIndex + 1;
                    
                    const sourceLabel = formatImageRef(sourceImage.id);
                    updateRequestStatus(requestId, 'running', `Video ${currentNum}/${totalVideos} from ${sourceLabel} queued`);
                    addRequestLog(
                        requestId,
                        '🎥',
                        `Video ${currentNum}/${totalVideos} from ${sourceLabel}: "${promptForVideo || '(motion from image)'}" — queuing...`
                    );

                    await generateVideoFromImage(requestId, sourceImage, promptForVideo, commandJson.config || {}, currentNum, totalVideos);
                    videoIndex++;
                }
            }
            // Note: generateVideoFromImage handles its own status updates via polling
        } catch (error) {
            addRequestLog(requestId, '❌', `Image-to-video generation failed: ${error.message}`);
            updateRequestStatus(requestId, 'error', error.message);
        }
        return;
    }

    if (commandJson.action === 'generate_video_from_first_last_frames') {
        try {
            const firstId = typeof commandJson.firstImageId === 'number' ? commandJson.firstImageId : null;
            const lastId = typeof commandJson.lastImageId === 'number' ? commandJson.lastImageId : null;

            if (!firstId || !lastId) {
                addRequestLog(requestId, '❌', 'First and last frame image IDs are required');
                updateRequestStatus(requestId, 'error', 'First/last frame references missing');
                return;
            }

            const firstImage = canvasState.images.find(img => img.id === firstId);
            const lastImage = canvasState.images.find(img => img.id === lastId);

            if (!firstImage || !lastImage) {
                addRequestLog(requestId, '❌', 'Could not locate first or last frame image on the canvas');
                updateRequestStatus(requestId, 'error', 'First/last frame image not found');
                return;
            }

            const videoCount = commandJson.count || 1;
            if (!Array.isArray(commandJson.prompts) || commandJson.prompts.length !== videoCount) {
                commandJson.prompts = Array.from({ length: videoCount }, () => commandJson.prompt || '');
            }

            const actionSummary = videoCount > 1
                ? `Creating ${videoCount} videos transitioning from ${formatImageRef(firstImage.id)} to ${formatImageRef(lastImage.id)}`
                : `Creating video transitioning from ${formatImageRef(firstImage.id)} to ${formatImageRef(lastImage.id)}`;

            updateRequestStatus(requestId, 'running', `${actionSummary}...`);
            addRequestLog(requestId, '🎬', `${actionSummary}...`);

            for (let i = 0; i < videoCount; i++) {
                const promptForVideo = commandJson.prompts[i] || commandJson.prompt || '';
                addRequestLog(
                    requestId,
                    '🎥',
                    `Video ${i + 1}/${videoCount}: "${promptForVideo || '(interpolate between frames)'}"`
                );

                await generateVideoFromFirstLastFrames(
                    requestId,
                    firstImage,
                    lastImage,
                    promptForVideo,
                    commandJson.config || {},
                    i + 1,
                    videoCount
                );
            }

        } catch (error) {
            addRequestLog(requestId, '❌', `First/last frame video generation failed: ${error.message}`);
            updateRequestStatus(requestId, 'error', error.message);
        }
        return;
    }

    if (commandJson.useUploadedImages) {
        addRequestLog(requestId, '⚠️', 'Paste images onto the canvas first, then reference them with @i.');
        updateRequestStatus(requestId, 'error', 'Waiting for pasted images');
        return;
    }

    if (commandJson.useReferencedImages && referencedImages.length === 0) {
        addRequestLog(requestId, '⚠️', 'No referenced images found on canvas!');
        updateRequestStatus(requestId, 'error', 'Referenced images unavailable');
        return;
    }

    const actionVerb = (commandJson.action === 'edit_images' || commandJson.action === 'edit_image') ? 'Editing' : 'Generating';
    const actionSummary = `${actionVerb} ${commandJson.count} image${commandJson.count > 1 ? 's' : ''}`;
    updateRequestStatus(requestId, 'running', `${actionSummary}...`);
    addRequestLog(requestId, '🎨', `${actionSummary}...`);

    if (commandJson.storyMode) {
        addRequestLog(requestId, '📖', 'Story mode enabled — each new frame builds on the previous ones.');
    }

    const VALID_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
    let aspectRatio = commandJson.aspectRatio || '9:16';

    if (!VALID_ASPECT_RATIOS.includes(aspectRatio)) {
        addRequestLog(
            requestId,
            '⚠️',
            `Invalid aspect ratio "${aspectRatio}". Using default 9:16. Valid ratios: ${VALID_ASPECT_RATIOS.join(', ')}`
        );
        aspectRatio = '9:16';
    }

    // Handle image size (resolution) - only for gemini-3-pro-image-preview
    const VALID_IMAGE_SIZES = ['1K', '2K', '4K'];
    let imageSize = null;
    if (commandJson.imageSize && typeof commandJson.imageSize === 'string') {
        const normalizedSize = commandJson.imageSize.toUpperCase();
        if (VALID_IMAGE_SIZES.includes(normalizedSize)) {
            imageSize = normalizedSize;
        } else {
            addRequestLog(
                requestId,
                '⚠️',
                `Invalid image size "${commandJson.imageSize}". Valid sizes: ${VALID_IMAGE_SIZES.join(', ')}. Omitting imageSize.`
            );
        }
    }

    let hadFailures = false;

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const PARALLEL_IMAGE_STAGGER_MS = 100;

    if (commandJson.useReferencedImages) {
        let useAspectRatio = commandJson.aspectRatio || referencedImages[0]?.aspectRatio || '9:16';
        if (!VALID_ASPECT_RATIOS.includes(useAspectRatio)) {
            useAspectRatio = '9:16';
        }

        const baseSources = referencedImages.map(img => ({
            data: img.data,
            mimeType: img.mimeType
        }));
        const baseReferenceIds = referencedImages.map(img => img.id);
        const storyModeActive = commandJson.storyMode;

        let storySources = storyModeActive ? baseSources.slice() : baseSources;
        let storyReferenceIds = storyModeActive ? baseReferenceIds.slice() : baseReferenceIds;

        if (storyModeActive) {
            for (let i = 0; i < commandJson.count; i++) {
                const promptForImage = commandJson.prompts[i] || commandJson.prompt;
                const referencesForThisFrame = storyReferenceIds.slice();
                const sourcesForThisFrame = storySources.map(src => ({ ...src }));

                const referenceLabel = referencesForThisFrame.length > 0
                    ? `referencing ${referencesForThisFrame.map(id => formatImageRef(id)).join(', ')}`
                    : 'no references';

                updateRequestStatus(requestId, 'running', `Image ${i + 1}/${commandJson.count} in progress`);
                addRequestLog(
                    requestId,
                    '🖼️',
                    `Image ${i + 1}/${commandJson.count} prompt: "${promptForImage}" — ${referenceLabel} — generating...`
                );

                const placeholder = addImagePlaceholder(requestId, promptForImage, useAspectRatio, referencesForThisFrame);

                const generatedImage = await generateSingleImage(
                    apiKey,
                    requestId,
                    promptForImage,
                    i + 1,
                    commandJson.count,
                    sourcesForThisFrame,
                    useAspectRatio,
                    referencesForThisFrame,
                    placeholder,
                    null,
                    imageSize
                );

                if (generatedImage) {
                    updateRequestStatus(requestId, 'running', `Image ${i + 1}/${commandJson.count} completed`);
                } else {
                    hadFailures = true;
                    updateRequestStatus(requestId, 'running', `Image ${i + 1}/${commandJson.count} failed`);
                }

                if (generatedImage) {
                    storySources.push({ data: generatedImage.data, mimeType: generatedImage.mimeType });
                    storyReferenceIds.push(generatedImage.id);
                }
            }
        } else {
            const generationTasks = [];

            for (let i = 0; i < commandJson.count; i++) {
                const promptForImage = commandJson.prompts[i] || commandJson.prompt;
                const referencesForThisFrame = baseReferenceIds;
                const sourcesForThisFrame = baseSources;

                const referenceLabel = referencesForThisFrame.length > 0
                    ? `referencing ${referencesForThisFrame.map(id => formatImageRef(id)).join(', ')}`
                    : 'no references';

                updateRequestStatus(requestId, 'running', `Image ${i + 1}/${commandJson.count} in progress`);
                addRequestLog(
                    requestId,
                    '🖼️',
                    `Image ${i + 1}/${commandJson.count} prompt: "${promptForImage}" — ${referenceLabel} — generating...`
                );

                const placeholder = addImagePlaceholder(requestId, promptForImage, useAspectRatio, referencesForThisFrame);

                generationTasks.push((async (imageIndex, placeholderEl, promptText) => {
                    await delay(PARALLEL_IMAGE_STAGGER_MS * imageIndex);
                    const generatedImage = await generateSingleImage(
                        apiKey,
                        requestId,
                        promptText,
                        imageIndex + 1,
                        commandJson.count,
                        sourcesForThisFrame,
                        useAspectRatio,
                        referencesForThisFrame,
                        placeholderEl,
                        null,
                        imageSize
                    );

                    if (generatedImage) {
                        updateRequestStatus(requestId, 'running', `Image ${imageIndex + 1}/${commandJson.count} completed`);
                    } else {
                        hadFailures = true;
                        updateRequestStatus(requestId, 'running', `Image ${imageIndex + 1}/${commandJson.count} failed`);
                    }
                })(i, placeholder, promptForImage));
            }

            await Promise.all(generationTasks);
        }
    } else {
        const storyModeActive = commandJson.storyMode && (commandJson.action === 'generate_images' || commandJson.action === 'generate_image');
        let storySources = [];
        let storyReferenceIds = [];

        if (storyModeActive && referencedImages.length > 0) {
            storySources = referencedImages.map(img => ({ data: img.data, mimeType: img.mimeType }));
            storyReferenceIds = referencedImages.map(img => img.id);
        }

        if (storyModeActive) {
            for (let i = 0; i < commandJson.count; i++) {
                const promptForImage = commandJson.prompts[i] || commandJson.prompt;
                const referencesForThisFrame = storyReferenceIds.slice();
                const sourcesForThisFrame = storySources.length > 0 ? storySources : null;

                const referenceLabel = referencesForThisFrame.length > 0
                    ? `referencing ${referencesForThisFrame.map(id => formatImageRef(id)).join(', ')}`
                    : 'no references';

                updateRequestStatus(requestId, 'running', `Image ${i + 1}/${commandJson.count} in progress`);
                addRequestLog(
                    requestId,
                    '🖼️',
                    `Image ${i + 1}/${commandJson.count} prompt: "${promptForImage}" — ${referenceLabel} — generating...`
                );

                const placeholder = addImagePlaceholder(requestId, promptForImage, aspectRatio);

                const generatedImage = await generateSingleImage(
                    apiKey,
                    requestId,
                    promptForImage,
                    i + 1,
                    commandJson.count,
                    sourcesForThisFrame,
                    aspectRatio,
                    referencesForThisFrame,
                    placeholder,
                    null,
                    imageSize
                );

                if (generatedImage) {
                    updateRequestStatus(requestId, 'running', `Image ${i + 1}/${commandJson.count} completed`);
                } else {
                    hadFailures = true;
                    updateRequestStatus(requestId, 'running', `Image ${i + 1}/${commandJson.count} failed`);
                }

                if (generatedImage) {
                    storySources.push({ data: generatedImage.data, mimeType: generatedImage.mimeType });
                    storyReferenceIds.push(generatedImage.id);
                }
            }
        } else {
            const generationTasks = [];

            for (let i = 0; i < commandJson.count; i++) {
                const promptForImage = commandJson.prompts[i] || commandJson.prompt;
                const referencesForThisFrame = [];
                const sourcesForThisFrame = null;

                const referenceLabel = 'no references';

                updateRequestStatus(requestId, 'running', `Image ${i + 1}/${commandJson.count} in progress`);
                addRequestLog(
                    requestId,
                    '🖼️',
                    `Image ${i + 1}/${commandJson.count} prompt: "${promptForImage}" — ${referenceLabel} — generating...`
                );

                const placeholder = addImagePlaceholder(requestId, promptForImage, aspectRatio);

                generationTasks.push((async (imageIndex, placeholderEl, promptText) => {
                    await delay(PARALLEL_IMAGE_STAGGER_MS * imageIndex);
                    const generatedImage = await generateSingleImage(
                        apiKey,
                        requestId,
                        promptText,
                        imageIndex + 1,
                        commandJson.count,
                        sourcesForThisFrame,
                        aspectRatio,
                        referencesForThisFrame,
                        placeholderEl,
                        null,
                        imageSize
                    );

                    if (generatedImage) {
                        updateRequestStatus(requestId, 'running', `Image ${imageIndex + 1}/${commandJson.count} completed`);
                    } else {
                        hadFailures = true;
                        updateRequestStatus(requestId, 'running', `Image ${imageIndex + 1}/${commandJson.count} failed`);
                    }
                })(i, placeholder, promptForImage));
            }

            await Promise.all(generationTasks);
        }
    }

    if (hadFailures) {
        addRequestLog(requestId, '⚠️', 'Completed with errors. Check messages above.');
        updateRequestStatus(requestId, 'error', 'Completed with errors');
    } else {
        addRequestLog(requestId, '✅', 'Images added to canvas.');
        updateRequestStatus(requestId, 'success', 'Completed successfully');
    }
}

async function generateSingleImage(apiKey, requestId, prompt, index, total, sourceImages = null, aspectRatio = '9:16', referenceIds = [], placeholder = null, customPosition = null, imageSize = null) {
    try {
        // Ensure a valid text prompt is always provided to the API
        let safePrompt = typeof prompt === 'string' && prompt.trim().length > 0
            ? prompt
            : (sourceImages ? 'Create a refined variation based on the provided reference image(s), preserving core composition and style.'
                           : 'Generate an image following best practices.');

        const imageConfig = {
            aspectRatio: aspectRatio
        };

        // Add imageSize if provided (only for gemini-3-pro-image-preview)
        if (imageSize && typeof imageSize === 'string' && ['1K', '2K', '4K'].includes(imageSize)) {
            imageConfig.imageSize = imageSize;
        }

        const requestBody = {
            contents: [{
                parts: []
            }],
            generationConfig: {
                imageConfig: imageConfig
            }
        };

        // Handle multiple source images (array) or single source (backward compatibility)
        if (sourceImages) {
            const sources = Array.isArray(sourceImages) ? sourceImages : [sourceImages];
            sources.forEach(source => {
                requestBody.contents[0].parts.push({
                    inlineData: {
                        mimeType: source.mimeType,
                        data: source.data
                    }
                });
            });
        }

        requestBody.contents[0].parts.push({ text: safePrompt });

        const imageModel = getImageModel();
        const data = await invokeGemini({
            apiKey,
            model: imageModel,
            body: requestBody,
            type: 'image'
        });

        if (!data || typeof data !== 'object') {
            throw new Error(`Invalid response from Gemini for image ${index}/${total}`);
        }
        const imageData = data.candidates?.[0]?.content?.parts?.find(
            part => part.inlineData?.mimeType?.startsWith('image/')
        )?.inlineData?.data;

        if (!imageData) {
            throw new Error(`No image data received for image ${index}/${total}`);
        }

        const mimeType = data.candidates[0].content.parts.find(
            part => part.inlineData?.mimeType?.startsWith('image/')
        ).inlineData.mimeType;

        // Get resolution from aspect ratio
        const resolutions = {
            '1:1': '1024x1024',
            '2:3': '832x1248',
            '3:2': '1248x832',
            '3:4': '864x1184',
            '4:3': '1184x864',
            '4:5': '896x1152',
            '5:4': '1152x896',
            '9:16': '768x1344',
            '16:9': '1344x768',
            '21:9': '1536x672'
        };
        const resolution = resolutions[aspectRatio] || '1024x1024';

        // Add image at custom position, or placeholder position, or default
        const position = customPosition || (placeholder ? { x: placeholder.x, y: placeholder.y } : null);
        const addedImage = addImageToCanvas(
            imageData,
            mimeType,
            safePrompt,
            aspectRatio,
            resolution,
            referenceIds,
            position,
            imageModel
        );
        
        // Remove placeholder after successful generation
        if (placeholder) {
            placeholder.remove();
        }
        
        addRequestLog(requestId, '✅', `Image ${index}/${total} ready!`);

        return addedImage;

    } catch (error) {
        console.error(`Error generating image ${index}:`, error);
        addRequestLog(requestId, '⚠️', `Failed image ${index}/${total}: ${error.message}`);
        
        // Show error in placeholder
        if (placeholder) {
            placeholder.showError(error.message);
        }
        
        return null;
    }
}

// ============================================================================
// Direct Image Mode
let directModeEnabled = false;
const DIRECT_MODE_STORAGE_KEY = 'direct_image_mode';

function initDirectMode() {
    const directModeToggle = document.getElementById('directModeToggle');
    const sendBtn = document.getElementById('sendBtn');
    
    if (!directModeToggle || !sendBtn) return;
    
    // Load saved state
    directModeEnabled = localStorage.getItem(DIRECT_MODE_STORAGE_KEY) === 'true';
    directModeToggle.checked = directModeEnabled;
    updateSendButtonText();
    
    // Handle toggle changes
    directModeToggle.addEventListener('change', () => {
        directModeEnabled = directModeToggle.checked;
        localStorage.setItem(DIRECT_MODE_STORAGE_KEY, directModeEnabled.toString());
        updateSendButtonText();
    });
}

function updateSendButtonText() {
    const sendBtn = document.getElementById('sendBtn');
    const chatInput = document.getElementById('chatInput');
    
    if (sendBtn) {
        sendBtn.textContent = directModeEnabled ? 'Generate Image' : 'Send Message';
    }
    
    if (chatInput) {
        chatInput.classList.toggle('direct-mode-active', directModeEnabled);
        chatInput.placeholder = directModeEnabled 
            ? 'Enter your image prompt... (Direct to image model)'
            : 'Type your command... (e.g., \'generate 3 sunset images\')';
    }
}

async function handleDirectImageGeneration(userMessage, apiKey) {
    const requestId = ++requestSequence;
    startRequestStatus(requestId, 'Queued');
    
    try {
        updateRequestStatus(requestId, 'running', 'Generating image directly...');
        addRequestLog(requestId, '🎨', 'Direct image generation mode');
        
        const placeholder = addImagePlaceholder(requestId, userMessage, '9:16');
        
        const generatedImage = await generateSingleImage(
            apiKey,
            requestId,
            userMessage,
            1,
            1,
            null,
            '9:16',
            [],
            placeholder
        );
        
        if (generatedImage) {
            updateRequestStatus(requestId, 'complete', 'Image generated successfully');
            addRequestLog(requestId, '✅', 'Direct image generation complete');
        }
    } catch (error) {
        console.error('Direct image generation failed:', error);
        updateRequestStatus(requestId, 'error', error.message || 'Direct image generation failed');
        addRequestLog(requestId, '❌', `Direct generation failed: ${error.message}`);
    }
}

// ============================================================================
// Auto-resize textarea functionality
function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

// ============================================================================
// Keyboard shortcuts
const chatInput = document.getElementById('chatInput');
chatInput.addEventListener('keydown', (e) => {
    // Don't interfere with autocomplete navigation
    if (isAutocompleteOpen() && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
        return; // Let autocomplete handle it
    }

    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize on input
chatInput.addEventListener('input', () => {
    autoResizeTextarea(chatInput);
});

// API Key persistence
const apiKeyInput = document.getElementById('apiKey');
const apiKeyFeedback = document.getElementById('apiKeyFeedback');
const toggleApiKeyBtn = document.getElementById('toggleApiKey');
const API_KEY_STORAGE_KEY = 'gemini_api_key';
let lastPersistedApiKey = '';

if (apiKeyInput) {
    const storedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    lastPersistedApiKey = storedApiKey || '';

    if (storedApiKey) {
        apiKeyInput.value = storedApiKey;
        setApiKeyFeedback('🔐 Loaded API key from this browser.', 'info');
    } else {
        setApiKeyFeedback('🚀 Up to 10 free image & agent requests without an API key.', 'info');
    }

    apiKeyInput.addEventListener('blur', () => {
        const trimmed = apiKeyInput.value.trim();
        if (trimmed) {
            localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
            if (trimmed !== lastPersistedApiKey) {
                setApiKeyFeedback('💾 Saved API key locally in this browser.', 'success');
                lastPersistedApiKey = trimmed;
            }
        }
    });

    apiKeyInput.addEventListener('input', () => {
        if (!apiKeyInput.value.trim()) {
            localStorage.removeItem(API_KEY_STORAGE_KEY);
            lastPersistedApiKey = '';
            setApiKeyFeedback('🚀 Up to 10 free image & agent requests without an API key.', 'info');
        }
    });
} else {
    console.warn('Gemini API key input not found; persistence helpers disabled.');
}

// API Key visibility toggle
if (toggleApiKeyBtn && apiKeyInput) {
    toggleApiKeyBtn.addEventListener('click', () => {
        const isPassword = apiKeyInput.type === 'password';
        apiKeyInput.type = isPassword ? 'text' : 'password';
        toggleApiKeyBtn.textContent = isPassword ? '🙈' : '👁️';
        toggleApiKeyBtn.setAttribute('aria-label', isPassword ? 'Hide API key' : 'Show API key');
    });
}


function getShortModelName(model) {
    const nameMap = {
        'gemini-2.5-flash': 'Gemini 2.5 Flash',
        'gemini-2.5-pro': 'Gemini 2.5 Pro',
        'gemini-3-pro-preview': 'Gemini 3 Pro',
        'gemini-3-flash-preview': 'Gemini 3 Flash',
        'gemini-2.5-flash-image': 'Gemini 2.5 Flash',
        'gemini-3-pro-image-preview': 'Gemini 3 Pro'
    };
    return nameMap[model] || model;
}

function renderAgentModelOptions(selectEl) {
    if (!selectEl) {
        return;
    }

    selectEl.innerHTML = '';
    supportedAgentModels.forEach((model) => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = getShortModelName(model);
        selectEl.appendChild(option);
    });
}

function renderImageModelOptions(selectEl) {
    if (!selectEl) {
        return;
    }

    selectEl.innerHTML = '';
    supportedImageModels.forEach((model) => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = getShortModelName(model);
        selectEl.appendChild(option);
    });
}

const MODEL_STORAGE_KEY = 'gemini_agent_model';
const agentModelSelect = document.getElementById('agentModel');

if (agentModelSelect) {
    renderAgentModelOptions(agentModelSelect);

    const storedModel = resolveAgentModel(localStorage.getItem(MODEL_STORAGE_KEY));
    const appliedModel = setActiveAgentModel(storedModel);

    agentModelSelect.value = appliedModel;
    if (storedModel !== appliedModel) {
        localStorage.setItem(MODEL_STORAGE_KEY, appliedModel);
    }

    agentModelSelect.addEventListener('change', (event) => {
        const selectedModel = resolveAgentModel(event.target.value);
        const updatedModel = setActiveAgentModel(selectedModel);
        event.target.value = updatedModel;
        localStorage.setItem(MODEL_STORAGE_KEY, updatedModel);

        // Sync with chat interface dropdown
        const chatAgentSelect = document.getElementById('chatAgentModel');
        if (chatAgentSelect) {
            chatAgentSelect.value = updatedModel;
        }
    });
} else {
    setActiveAgentModel(defaultAgentModel);
}

const IMAGE_MODEL_STORAGE_KEY = 'gemini_image_model';
const imageModelSelect = document.getElementById('imageModel');

if (imageModelSelect) {
    renderImageModelOptions(imageModelSelect);

    const storedImageModel = resolveImageModel(localStorage.getItem(IMAGE_MODEL_STORAGE_KEY));
    const appliedImageModel = setActiveImageModel(storedImageModel);

    imageModelSelect.value = appliedImageModel;
    if (storedImageModel !== appliedImageModel) {
        localStorage.setItem(IMAGE_MODEL_STORAGE_KEY, appliedImageModel);
    }

    imageModelSelect.addEventListener('change', (event) => {
        const selectedImageModel = resolveImageModel(event.target.value);
        const updatedImageModel = setActiveImageModel(selectedImageModel);
        event.target.value = updatedImageModel;
        localStorage.setItem(IMAGE_MODEL_STORAGE_KEY, updatedImageModel);

        // Sync with chat interface dropdown
        const chatImageSelect = document.getElementById('chatImageModel');
        if (chatImageSelect) {
            chatImageSelect.value = updatedImageModel;
        }
    });
} else {
    setActiveImageModel(defaultImageModel);
}

// Initialize chat interface model selectors
const chatAgentSelect = document.getElementById('chatAgentModel');
const chatImageSelect = document.getElementById('chatImageModel');

if (chatAgentSelect) {
    // Populate Text Agent model dropdown
    renderAgentModelOptions(chatAgentSelect);
    const storedAgentModel = localStorage.getItem(MODEL_STORAGE_KEY);
    const initialAgentModel = resolveAgentModel(storedAgentModel);
    chatAgentSelect.value = initialAgentModel;
    setActiveAgentModel(initialAgentModel);

    // Handle Text Agent model changes
    chatAgentSelect.addEventListener('change', (event) => {
        const selected = event.target.value;
        const validated = setActiveAgentModel(selected);
        chatAgentSelect.value = validated;
        localStorage.setItem(MODEL_STORAGE_KEY, validated);

        // Sync with settings modal dropdown if it exists
        const settingsAgentSelect = document.getElementById('agentModel');
        if (settingsAgentSelect) {
            settingsAgentSelect.value = validated;
        }
    });
}

if (chatImageSelect) {
    // Populate Image Generation model dropdown
    renderImageModelOptions(chatImageSelect);
    const storedImageModel = localStorage.getItem(IMAGE_MODEL_STORAGE_KEY);
    const initialImageModel = resolveImageModel(storedImageModel);
    chatImageSelect.value = initialImageModel;
    setActiveImageModel(initialImageModel);

    // Handle Image Generation model changes
    chatImageSelect.addEventListener('change', (event) => {
        const selected = event.target.value;
        const validated = setActiveImageModel(selected);
        chatImageSelect.value = validated;
        localStorage.setItem(IMAGE_MODEL_STORAGE_KEY, validated);

        // Sync with settings modal dropdown if it exists
        const settingsImageSelect = document.getElementById('imageModel');
        if (settingsImageSelect) {
            settingsImageSelect.value = validated;
        }
    });
}


const copyCurlBtn = document.getElementById('copyCurlBtn');
const clearStoredKeyBtn = document.getElementById('clearStoredKeyBtn');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsBackdrop = document.getElementById('settingsBackdrop');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
let settingsLastFocus = null;
let settingsOpen = false;

function buildApiKeyCheckCommand(model) {
    const resolvedModel = resolveAgentModel(model);
    return [
        'curl -X POST',
        '-H "Content-Type: application/json"',
        '-H "Authorization: Bearer <your-key>"',
        `"https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent"`,
        "-d '{\"contents\":[{\"parts\":[{\"text\":\"say hello\"}]}]}'"
    ].join(' \\\n');
}

if (copyCurlBtn) {
    copyCurlBtn.addEventListener('click', async () => {
        const model = getActiveAgentModel();
        const command = buildApiKeyCheckCommand(model);
        const success = await copyTextToClipboard(command);
        if (success) {
            setApiKeyFeedback(`✅ Copied the verification command for ${model}.`, 'success');
        } else {
            setApiKeyFeedback('⚠️ Unable to access clipboard. Copy the command from the help panel instead.', 'error');
        }
    });
}

if (clearStoredKeyBtn) {
    clearStoredKeyBtn.addEventListener('click', () => {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
        lastPersistedApiKey = '';
        if (apiKeyInput) {
            apiKeyInput.value = '';
            apiKeyInput.focus();
        }
        setApiKeyFeedback('🔒 Removed the saved API key. Free trial: 20 agent + 5 image requests per day.', 'success');
        updateFreeUsageUI();
    });
}

if (openSettingsBtn && settingsModal) {
    openSettingsBtn.addEventListener('click', openSettingsDialog);
}

if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', closeSettingsDialog);
}

if (settingsBackdrop) {
    settingsBackdrop.addEventListener('click', closeSettingsDialog);
}

function openSettingsDialog() {
    if (!settingsModal || settingsOpen) return;
    hideAutocomplete(); // Close autocomplete when modal opens
    settingsLastFocus = document.activeElement;
    settingsOpen = true;
    settingsModal.classList.remove('hidden');
    settingsModal.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', handleSettingsKeydown);

    const focusable = getSettingsFocusableElements();
    if (focusable.length > 0) {
        focusable[0].focus();
    } else {
        settingsModal.focus();
    }
}

function closeSettingsDialog() {
    if (!settingsModal || !settingsOpen) return;
    settingsOpen = false;
    settingsModal.classList.add('hidden');
    settingsModal.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', handleSettingsKeydown);

    if (settingsLastFocus && typeof settingsLastFocus.focus === 'function') {
        settingsLastFocus.focus();
    }
}

function handleSettingsKeydown(event) {
    if (!settingsOpen) return;

    if (event.key === 'Escape') {
        event.preventDefault();
        closeSettingsDialog();
        return;
    }

    if (event.key === 'Tab') {
        const focusable = getSettingsFocusableElements();
        if (focusable.length === 0) {
            event.preventDefault();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey) {
            if (active === first || !settingsModal.contains(active)) {
                event.preventDefault();
                last.focus();
            }
        } else if (active === last) {
            event.preventDefault();
            first.focus();
        }
    }
}

function getSettingsFocusableElements() {
    if (!settingsModal) return [];
    const selectors = [
        'button',
        '[href]',
        'input',
        'select',
        'textarea',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    return Array.from(settingsModal.querySelectorAll(selectors)).filter((el) => !el.hasAttribute('disabled'));
}

function setApiKeyFeedback(message, tone = 'info') {
    if (!apiKeyFeedback) return;
    apiKeyFeedback.textContent = message || '';

    if (!message) {
        delete apiKeyFeedback.dataset.tone;
        return;
    }

    if (tone) {
        apiKeyFeedback.dataset.tone = tone;
    } else {
        delete apiKeyFeedback.dataset.tone;
    }
}

async function copyTextToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.warn('Clipboard API copy failed, falling back to execCommand', error);
        }
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);

    const selection = document.getSelection();
    const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    textArea.select();
    let succeeded = false;
    try {
        succeeded = document.execCommand('copy');
    } catch (error) {
        console.warn('document.execCommand copy failed', error);
        succeeded = false;
    }

    textArea.remove();

    if (previousRange && selection) {
        selection.removeAllRanges();
        selection.addRange(previousRange);
    }

    return succeeded;
}


// Onboarding Modal
const onboardingModal = document.getElementById('onboardingModal');
const onboardingBackdrop = document.getElementById('onboardingBackdrop');
const openOnboardingBtn = document.getElementById('openOnboardingBtn');
const closeOnboardingBtn = document.getElementById('closeOnboardingBtn');
let onboardingLastFocus = null;
let onboardingOpen = false;

if (openOnboardingBtn && onboardingModal) {
    openOnboardingBtn.addEventListener('click', openOnboardingGuide);
}

if (closeOnboardingBtn) {
    closeOnboardingBtn.addEventListener('click', closeOnboardingGuide);
}

if (onboardingBackdrop) {
    onboardingBackdrop.addEventListener('click', closeOnboardingGuide);
}

function openOnboardingGuide() {
    if (!onboardingModal || onboardingOpen) return;
    hideAutocomplete(); // Close autocomplete when modal opens
    onboardingLastFocus = document.activeElement;
    onboardingOpen = true;
    onboardingModal.classList.remove('hidden');
    onboardingModal.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', handleOnboardingKeydown);

    const focusable = getOnboardingFocusableElements();
    if (focusable.length > 0) {
        focusable[0].focus();
    } else {
        onboardingModal.focus();
    }
}

function closeOnboardingGuide() {
    if (!onboardingModal || !onboardingOpen) return;
    onboardingOpen = false;
    onboardingModal.classList.add('hidden');
    onboardingModal.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', handleOnboardingKeydown);

    if (onboardingLastFocus && typeof onboardingLastFocus.focus === 'function') {
        onboardingLastFocus.focus();
    }
}

function handleOnboardingKeydown(event) {
    if (!onboardingOpen) return;

    if (event.key === 'Escape') {
        event.preventDefault();
        closeOnboardingGuide();
        return;
    }

    if (event.key === 'Tab') {
        const focusable = getOnboardingFocusableElements();
        if (focusable.length === 0) {
            event.preventDefault();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey) {
            if (active === first || !onboardingModal.contains(active)) {
                event.preventDefault();
                last.focus();
            }
        } else if (active === last) {
            event.preventDefault();
            first.focus();
        }
    }
}

function getOnboardingFocusableElements() {
    if (!onboardingModal) return [];
    const selectors = [
        'button',
        '[href]',
        'input',
        'select',
        'textarea',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    return Array.from(onboardingModal.querySelectorAll(selectors)).filter(el => !el.hasAttribute('disabled'));
}

// ============================================================================
// STORY MODE HELPER FUNCTIONS
// ============================================================================

function detectApprovalMessage(message) {
    if (typeof message !== 'string') return false;
    const text = message.toLowerCase().trim();
    return text === 'approved' || text === 'approve' || text === 'looks good' || text === 'continue';
}

function buildAssetPrompt(type, description, style) {
    // Build detailed prompts for character/item/background generation
    const templates = {
        character: `Full body portrait of ${description}. Clear, well-lit, neutral background. ${style} style.`,
        item: `Isolated product shot of ${description}. Clean neutral background, studio lighting. ${style} style.`,
        background: `Detailed environment: ${description}. No characters or people. ${style} style.`
    };
    return templates[type] || `${description}. ${style} style.`;
}

function buildSceneCompositionPrompt(description, basePrompt, style) {
    return `${basePrompt} SEAMLESSLY integrate all reference images into a cohesive scene. ${style} style. ${description}`;
}

function buildDirectScenePrompt(description, compositionPrompt, style) {
    // Create a direct text-to-image prompt without relying on reference images
    // This should describe the complete scene based on context
    return `Complete ${style} style scene: ${description}. ${compositionPrompt}. Create a full, detailed scene with all elements visible and properly composed. No need for reference images - create everything from scratch based on this description.`;
}

function getAssetIdsForScene(scene) {
    // Get all asset image IDs referenced by this scene
    const assetIds = [];
    const assetRefs = scene.assetReferences || {};
    
    // Look up asset IDs from storyMode.assetsByName
    const assetsByName = canvasState.storyMode.assetsByName || {};
    
    ['characters', 'items', 'backgrounds'].forEach(type => {
        const names = assetRefs[type] || [];
        names.forEach(name => {
            const asset = assetsByName[name];
            if (asset && asset.imageId) {
                assetIds.push(asset.imageId);
            }
        });
    });
    
    return assetIds;
}

// ============================================================================
// STORY MODE HANDLERS
// ============================================================================

async function handleStoryStage1(commandJson, apiKey, requestId) {
    // Extract story concept
    const { concept, brainstorm, flow, scene1 } = commandJson;
    
    // Initialize story state
    canvasState.storyMode.active = true;
    canvasState.storyMode.stage = 'ideation';
    canvasState.storyMode.storyId = `story_${Date.now()}`;
    canvasState.storyMode.concept = concept;
    canvasState.storyMode.sceneCount = concept.sceneCount;
    canvasState.storyMode.allAssets = { characters: [], items: [], backgrounds: [] };
    canvasState.storyMode.assetsByName = {};
    canvasState.storyMode.completedScenes = [];
    
    // Add AI response to chat
    addChatMessage(commandJson.response, 'assistant');

    // Add concept note to chat for AI context
    const chatConceptText = `📖 Story Concept:\n${brainstorm}\n\n📋 Flow:\n${flow.join('\n')}`;
    addChatMessage(chatConceptText, 'system');

    updateRequestStatus(requestId, 'running', 'Creating story concept...');

  // Create story title and concept note
  createStoryRowLabelDynamic(0, '📖 STORY');
    const canvasConceptText = `📖 ${concept.title || 'Story Concept'}\n\n🎯 Genre: ${concept.genre || 'Not specified'}\n🎨 Style: ${concept.style || 'Not specified'}\n📝 Scene Count: ${concept.sceneCount}\n\n💡 Concept:\n${brainstorm}\n\n📋 Story Flow:\n${flow.map((item, index) => `${index + 1}. ${item}`).join('\n')}`;

    // Add concept as a text note on canvas
    const conceptPosition = { x: 150, y: 100 }; // Position only 10px to the left (160-10)
    const conceptNote = addNoteToCanvas(canvasConceptText, conceptPosition, { width: 600, height: 350 });

    // Style the concept note to make it stand out with dark mode styling and larger text
    const conceptElement = document.querySelector(`[data-note-id="${conceptNote.id}"]`);
    if (conceptElement) {
        conceptElement.style.fontSize = '18px';
        conceptElement.style.lineHeight = '1.6';
        conceptElement.style.whiteSpace = 'pre-wrap';
        conceptElement.style.backgroundColor = '#1f2937'; // Dark gray background for story concept
        conceptElement.style.border = '2px solid #f59e0b'; // Orange border
        conceptElement.style.borderRadius = '12px';
        conceptElement.style.padding = '20px';
        conceptElement.style.fontFamily = 'monospace';
        conceptElement.style.color = '#f3f4f6'; // Light text color
        conceptElement.style.fontWeight = '500'; // Medium font weight for better readability
    }

    // Create row labels for assets and scenes
    createStoryRowLabelDynamic(1, '🎨 ASSETS');
    createStoryRowLabelDynamic(2, '🎬 SCENES');
    
    // Track placement in row 1 (assets)
    const assetIds = { characters: [], items: [], backgrounds: [] };
    const aspectRatio = concept.aspectRatio || '9:16';
    
    try {
        // Generate scene1 characters
        for (const char of scene1.assets.characters || []) {
            updateRequestStatus(requestId, 'running', `Generating character: ${char.name}...`);
            addRequestLog(requestId, '👤', `Generating character: ${char.name}`);
            
            const prompt = buildAssetPrompt('character', char.description, concept.style);
            const placement = placeStoryItemDynamic(1, row1Count++);
            
            // Create placeholder and reposition it
            const placeholder = addImagePlaceholder(requestId, prompt, aspectRatio);
            if (placeholder && placeholder.element) {
                placeholder.element.style.left = `${placement.x}px`;
                placeholder.element.style.top = `${placement.y}px`;
            }
            
            const generatedImage = await generateSingleImage(
                apiKey,
                requestId,
                prompt,
                1,
                1,
                null,
                aspectRatio,
                [],
                placeholder,
                placement  // Pass custom position
            );
            
            if (generatedImage) {
                assetIds.characters.push(generatedImage.id);
                canvasState.storyMode.allAssets.characters.push({ name: char.name, description: char.description, imageId: generatedImage.id });
                canvasState.storyMode.assetsByName[char.name] = { type: 'character', imageId: generatedImage.id };
            }
        }
        
        // Generate scene1 items
        for (const item of scene1.assets.items || []) {
            updateRequestStatus(requestId, 'running', `Generating item: ${item.name}...`);
            addRequestLog(requestId, '📦', `Generating item: ${item.name}`);
            
            const prompt = buildAssetPrompt('item', item.description, concept.style);
            const placement = placeStoryItemDynamic(1, row1Count++);
            
            const placeholder = addImagePlaceholder(requestId, prompt, aspectRatio);
            if (placeholder && placeholder.element) {
                placeholder.element.style.left = `${placement.x}px`;
                placeholder.element.style.top = `${placement.y}px`;
            }
            
            const generatedImage = await generateSingleImage(
                apiKey,
                requestId,
                prompt,
                1,
                1,
                null,
                aspectRatio,
                [],
                placeholder,
                placement  // Pass custom position
            );
            
            if (generatedImage) {
                assetIds.items.push(generatedImage.id);
                canvasState.storyMode.allAssets.items.push({ name: item.name, description: item.description, imageId: generatedImage.id });
                canvasState.storyMode.assetsByName[item.name] = { type: 'item', imageId: generatedImage.id };
            }
        }
        
        // Generate scene1 backgrounds
        for (const bg of scene1.assets.backgrounds || []) {
            updateRequestStatus(requestId, 'running', `Generating background: ${bg.name}...`);
            addRequestLog(requestId, '🏞️', `Generating background: ${bg.name}`);
            
            const prompt = buildAssetPrompt('background', bg.description, concept.style);
            const placement = placeStoryItemDynamic(1, row1Count++);
            
            const placeholder = addImagePlaceholder(requestId, prompt, aspectRatio);
            if (placeholder && placeholder.element) {
                placeholder.element.style.left = `${placement.x}px`;
                placeholder.element.style.top = `${placement.y}px`;
            }
            
            const generatedImage = await generateSingleImage(
                apiKey,
                requestId,
                prompt,
                1,
                1,
                null,
                aspectRatio,
                [],
                placeholder,
                placement  // Pass custom position
            );
            
            if (generatedImage) {
                assetIds.backgrounds.push(generatedImage.id);
                canvasState.storyMode.allAssets.backgrounds.push({ name: bg.name, description: bg.description, imageId: generatedImage.id });
                canvasState.storyMode.assetsByName[bg.name] = { type: 'background', imageId: generatedImage.id };
            }
        }
        
        // Generate scene1 composition - TWO VARIATIONS
        updateRequestStatus(requestId, 'running', 'Creating Scene 1 variations...');
        addRequestLog(requestId, '🎬', 'Creating Scene 1 - Composed variation...');

        const allAssetIds = [...assetIds.characters, ...assetIds.items, ...assetIds.backgrounds];

        // VARIATION 1: Composed image using assets (original method)
        const scene1PromptComposed = buildSceneCompositionPrompt(
            scene1.description,
            scene1.compositionPrompt,
            concept.style
        );

        // Prepare source images for scene composition
        const sourceImages = allAssetIds.length > 0 ? allAssetIds.map(id => {
            const img = canvasState.images.find(i => i.id === id);
            return img ? { data: img.data, mimeType: img.mimeType } : null;
        }).filter(Boolean) : null;

        const placementComposed = placeStoryItemInRow(2, 0);

        const placeholderComposed = addImagePlaceholder(requestId, `Scene 1 (Composed): ${scene1PromptComposed}`, aspectRatio);
        if (placeholderComposed && placeholderComposed.element) {
            placeholderComposed.element.style.left = `${placementComposed.x}px`;
            placeholderComposed.element.style.top = `${placementComposed.y}px`;
        }

        const scene1ImageComposed = await generateSingleImage(
            apiKey,
            requestId,
            scene1PromptComposed,
            1,
            1,
            sourceImages,
            aspectRatio,
            allAssetIds,
            placeholderComposed,
            placementComposed  // Pass custom position
        );

        // VARIATION 2: Direct text-to-image prompt
        addRequestLog(requestId, '🎬', 'Creating Scene 1 - Direct prompt variation...');
        const scene1PromptDirect = buildDirectScenePrompt(
            scene1.description,
            scene1.compositionPrompt,
            concept.style
        );

        const placementDirect = placeStoryItemInRow(2, 1);

        const placeholderDirect = addImagePlaceholder(requestId, `Scene 1 (Direct): ${scene1PromptDirect}`, aspectRatio);
        if (placeholderDirect && placeholderDirect.element) {
            placeholderDirect.element.style.left = `${placementDirect.x}px`;
            placeholderDirect.element.style.top = `${placementDirect.y}px`;
        }

        const scene1ImageDirect = await generateSingleImage(
            apiKey,
            requestId,
            scene1PromptDirect,
            1,
            1,
            null,  // No source images for direct prompt
            aspectRatio,
            [],    // No referenced images for direct prompt
            placeholderDirect,
            placementDirect  // Pass custom position
        );

        // Store scene1 assets and both variations
        canvasState.storyMode.scene1Assets = assetIds;
        canvasState.storyMode.scene1Variations = {
            composed: scene1ImageComposed,
            direct: scene1ImageDirect
        };
        canvasState.storyMode.completedScenes = [1];
        
        // Update stage
        canvasState.storyMode.stage = 'awaiting_approval';
        
        // Prompt user for approval
        updateRequestStatus(requestId, 'success', 'Story concept ready! Review both Scene 1 variations on canvas.');
        addChatMessage(
            '✅ Scene 1 complete with **2 variations**!\n\n' +
            '🎨 **Variation 1 (Composed)**: Uses the individual character/item/background assets\n' +
            '🖼️ **Variation 2 (Direct)**: Generated from a complete scene description\n\n' +
            'Choose your preferred variation or type "approved" to continue with both and generate the remaining scenes.',
            'system'
        );
        
    } catch (error) {
        addRequestLog(requestId, '❌', `Story stage 1 failed: ${error.message}`);
        updateRequestStatus(requestId, 'error', error.message);
        throw error;
    }
}

async function handleStoryStage2(commandJson, apiKey, requestId) {
    // Verify story mode active and awaiting approval
    if (!canvasState.storyMode.active || canvasState.storyMode.stage !== 'awaiting_approval') {
        throw new Error('No story awaiting approval');
    }
    
    // Update stage
    canvasState.storyMode.stage = 'production';

    updateRequestStatus(requestId, 'running', 'Generating remaining scenes...');
    addChatMessage(commandJson.response, 'assistant');

    // Get concept from story mode state
    const { concept } = canvasState.storyMode;
    const startingScene = canvasState.storyMode.completedScenes.length + 1;
    let row1Count = Object.keys(canvasState.storyMode.assetsByName).length; // Continue from where we left off
    const aspectRatio = concept.aspectRatio || '9:16';
    
    try {
        // First, generate any new assets needed
        const newAssets = commandJson.remainingAssets || { characters: [], items: [], backgrounds: [] };
        
        // Generate new characters
        for (const char of newAssets.characters || []) {
            if (char.isNew) {
                updateRequestStatus(requestId, 'running', `Generating new character: ${char.name}...`);
                addRequestLog(requestId, '👤', `Generating new character: ${char.name}`);
                
            const prompt = buildAssetPrompt('character', char.description, concept.style);
            const placement = placeStoryItemDynamic(1, row1Count++);
            
            const placeholder = addImagePlaceholder(requestId, prompt, aspectRatio);
            if (placeholder && placeholder.element) {
                placeholder.element.style.left = `${placement.x}px`;
                placeholder.element.style.top = `${placement.y}px`;
            }
            
            const generatedImage = await generateSingleImage(
                apiKey,
                requestId,
                prompt,
                1,
                1,
                null,
                aspectRatio,
                [],
                placeholder,
                placement  // Pass custom position
            );
                
                if (generatedImage) {
                    canvasState.storyMode.allAssets.characters.push({ name: char.name, description: char.description, imageId: generatedImage.id });
                    canvasState.storyMode.assetsByName[char.name] = { type: 'character', imageId: generatedImage.id };
                }
            }
        }
        
        // Generate new items
        for (const item of newAssets.items || []) {
            if (item.isNew) {
                updateRequestStatus(requestId, 'running', `Generating new item: ${item.name}...`);
                addRequestLog(requestId, '📦', `Generating new item: ${item.name}`);
                
                const prompt = buildAssetPrompt('item', item.description, concept.style);
                const placement = placeStoryItemDynamic(1, row1Count++);
                
                const placeholder = addImagePlaceholder(requestId, prompt, aspectRatio);
                if (placeholder && placeholder.element) {
                    placeholder.element.style.left = `${placement.x}px`;
                    placeholder.element.style.top = `${placement.y}px`;
                }
                
                const generatedImage = await generateSingleImage(
                    apiKey,
                    requestId,
                    prompt,
                    1,
                    1,
                    null,
                    aspectRatio,
                    [],
                    placeholder,
                    placement  // Pass custom position
                );
                
                if (generatedImage) {
                    canvasState.storyMode.allAssets.items.push({ name: item.name, description: item.description, imageId: generatedImage.id });
                    canvasState.storyMode.assetsByName[item.name] = { type: 'item', imageId: generatedImage.id };
                }
            }
        }
        
        // Generate new backgrounds
        for (const bg of newAssets.backgrounds || []) {
            if (bg.isNew) {
                updateRequestStatus(requestId, 'running', `Generating new background: ${bg.name}...`);
                addRequestLog(requestId, '🏞️', `Generating new background: ${bg.name}`);
                
                const prompt = buildAssetPrompt('background', bg.description, concept.style);
                const placement = placeStoryItemDynamic(1, row1Count++);
                
                const placeholder = addImagePlaceholder(requestId, prompt, aspectRatio);
                if (placeholder && placeholder.element) {
                    placeholder.element.style.left = `${placement.x}px`;
                    placeholder.element.style.top = `${placement.y}px`;
                }
                
                const generatedImage = await generateSingleImage(
                    apiKey,
                    requestId,
                    prompt,
                    1,
                    1,
                    null,
                    aspectRatio,
                    [],
                    placeholder,
                    placement  // Pass custom position
                );
                
                if (generatedImage) {
                    canvasState.storyMode.allAssets.backgrounds.push({ name: bg.name, description: bg.description, imageId: generatedImage.id });
                    canvasState.storyMode.assetsByName[bg.name] = { type: 'background', imageId: generatedImage.id };
                }
            }
        }
        
        // Now generate each remaining scene
        for (let i = 0; i < commandJson.scenes.length; i++) {
            const scene = commandJson.scenes[i];
            const sceneNum = startingScene + i;
            
            updateRequestStatus(requestId, 'running', `Generating scene ${sceneNum}/${concept.sceneCount}...`);
            addRequestLog(requestId, '🎬', `Generating scene ${sceneNum}...`);
            
            // Get asset IDs for this scene
            const sceneAssetIds = getAssetIdsForScene(scene);
            
            // Prepare source images
            const sourceImages = sceneAssetIds.length > 0 ? sceneAssetIds.map(id => {
                const img = canvasState.images.find(i => i.id === id);
                return img ? { data: img.data, mimeType: img.mimeType } : null;
            }).filter(Boolean) : null;
            
            // Scene separator removed for cleaner layout

            // Compose scene
            const placement = placeStoryItemInRow(2, sceneNum - 1);

            const placeholder = addImagePlaceholder(requestId, scene.compositionPrompt, aspectRatio);
            if (placeholder && placeholder.element) {
                placeholder.element.style.left = `${placement.x}px`;
                placeholder.element.style.top = `${placement.y}px`;
            }
            
            const sceneImage = await generateSingleImage(
                apiKey,
                requestId,
                scene.compositionPrompt,
                1,
                1,
                sourceImages,
                aspectRatio,
                sceneAssetIds,
                placeholder,
                placement  // Pass custom position
            );
            
            if (sceneImage) {
                canvasState.storyMode.completedScenes.push(sceneNum);
            }
        }
        
        // Complete story
        canvasState.storyMode.stage = 'complete';

        updateRequestStatus(requestId, 'success', `Story complete! ${concept.sceneCount} scenes generated.`);
        addChatMessage(`🎉 Story complete! Generated ${concept.sceneCount} scenes with ${Object.keys(canvasState.storyMode.assetsByName).length} assets.`, 'system');
        
        // Reset for next story after a delay
        setTimeout(() => {
            canvasState.storyMode.active = false;
            canvasState.storyMode.stage = null;
        }, 2000);
        
    } catch (error) {
        addRequestLog(requestId, '❌', `Story stage 2 failed: ${error.message}`);
        updateRequestStatus(requestId, 'error', error.message);
        throw error;
    }
}

async function handleUnifiedStoryGeneration(commandJson, apiKey, requestId) {
    // Extract story concept and all scenes
    const { concept, brainstorm, flow, assets, scenes } = commandJson;

    
    // Initialize story state
    canvasState.storyMode.active = true;
    canvasState.storyMode.stage = 'unified_generation';
    canvasState.storyMode.storyId = `story_${Date.now()}`;
    canvasState.storyMode.concept = concept;
    canvasState.storyMode.sceneCount = concept.sceneCount;
    canvasState.storyMode.allAssets = { characters: [], items: [], backgrounds: [] };
    canvasState.storyMode.assetsByName = {};
    canvasState.storyMode.completedScenes = [];
    canvasState.storyMode.sceneVariations = {};

    // Add AI response to chat
    addChatMessage(commandJson.response, 'assistant');
    // Add concept note to chat for AI context
    const chatConceptText = `📖 Story Concept:\n${brainstorm}\n\n📋 Flow:\n${flow.join('\n')}`;
    addChatMessage(chatConceptText, 'system');

    updateRequestStatus(requestId, 'running', 'Creating complete story with variations...');

    // Add story concept note (model will decide position and content organization)
    const canvasConceptText = `📖 ${concept.title || 'Story Concept'}\n\n🎯 Genre: ${concept.genre || 'Not specified'}\n🎨 Style: ${concept.style || 'Not specified'}\n📝 Scene Count: ${concept.sceneCount}\n\n💡 Concept:\n${brainstorm}\n\n📋 Story Flow:\n${flow.map((item, index) => `${index + 1}. ${item}`).join('\n')}`;

    // Add concept as a text note on canvas (model will decide position)
    const conceptNote = addNoteToCanvas(canvasConceptText, null, { width: 600, height: 350 });

    // Style the concept note
    const conceptElement = document.querySelector(`[data-note-id="${conceptNote.id}"]`);
    if (conceptElement) {
        conceptElement.style.fontSize = '18px';
        conceptElement.style.lineHeight = '1.6';
        conceptElement.style.whiteSpace = 'pre-wrap';
        conceptElement.style.backgroundColor = '#1f2937';
        conceptElement.style.border = '2px solid #f59e0b';
        conceptElement.style.borderRadius = '12px';
        conceptElement.style.padding = '20px';
        conceptElement.style.fontFamily = 'monospace';
        conceptElement.style.color = '#f3f4f6';
        conceptElement.style.fontWeight = '500';
    }

    const assetIds = { characters: [], items: [], backgrounds: [] };
    const aspectRatio = concept.aspectRatio || '9:16';

    try {
        // Generate all assets first
        updateRequestStatus(requestId, 'running', 'Generating story assets...');

        // Generate characters
        for (const char of assets.characters || []) {
            updateRequestStatus(requestId, 'running', `Generating character: ${char.name}...`);
            addRequestLog(requestId, '👤', `Generating character: ${char.name}`);

            const prompt = buildAssetPrompt('character', char.description, concept.style);
            const placeholder = addImagePlaceholder(requestId, prompt, aspectRatio);

            const generatedImage = await generateSingleImage(
                apiKey,
                requestId,
                prompt,
                1,
                1,
                null,
                aspectRatio,
                [],
                placeholder,
                null  // Let model decide position
            );

            if (generatedImage) {
                assetIds.characters.push(generatedImage.id);
                canvasState.storyMode.allAssets.characters.push({ name: char.name, description: char.description, imageId: generatedImage.id });
                canvasState.storyMode.assetsByName[char.name] = { type: 'character', imageId: generatedImage.id };
            }
        }

        // Generate items
        for (const item of assets.items || []) {
            updateRequestStatus(requestId, 'running', `Generating item: ${item.name}...`);
            addRequestLog(requestId, '📦', `Generating item: ${item.name}`);

            const prompt = buildAssetPrompt('item', item.description, concept.style);
            const placeholder = addImagePlaceholder(requestId, prompt, aspectRatio);

            const generatedImage = await generateSingleImage(
                apiKey,
                requestId,
                prompt,
                1,
                1,
                null,
                aspectRatio,
                [],
                placeholder,
                null  // Let model decide position
            );

            if (generatedImage) {
                assetIds.items.push(generatedImage.id);
                canvasState.storyMode.allAssets.items.push({ name: item.name, description: item.description, imageId: generatedImage.id });
                canvasState.storyMode.assetsByName[item.name] = { type: 'item', imageId: generatedImage.id };
            }
        }

        // Generate backgrounds
        for (const bg of assets.backgrounds || []) {
            updateRequestStatus(requestId, 'running', `Generating background: ${bg.name}...`);
            addRequestLog(requestId, '🏞️', `Generating background: ${bg.name}`);

            const prompt = buildAssetPrompt('background', bg.description, concept.style);
            const placeholder = addImagePlaceholder(requestId, prompt, aspectRatio);

            const generatedImage = await generateSingleImage(
                apiKey,
                requestId,
                prompt,
                1,
                1,
                null,
                aspectRatio,
                [],
                placeholder,
                null  // Let model decide position
            );

            if (generatedImage) {
                assetIds.backgrounds.push(generatedImage.id);
                canvasState.storyMode.allAssets.backgrounds.push({ name: bg.name, description: bg.description, imageId: generatedImage.id });
                canvasState.storyMode.assetsByName[bg.name] = { type: 'background', imageId: generatedImage.id };
            }
        }

        // Store all assets
        canvasState.storyMode.scene1Assets = assetIds;

        // Generate all scenes with two variations each
        for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
            const scene = scenes[sceneIndex];
            const sceneNum = scene.id;

            updateRequestStatus(requestId, 'running', `Generating scene ${sceneNum}/${concept.sceneCount} variations...`);
            addRequestLog(requestId, '🎬', `Creating Scene ${sceneNum} variations...`);

            // Get asset IDs for this scene
            const sceneAssetIds = getAssetIdsForScene(scene);

            // VARIATION 1: Composed using assets
            const scenePromptComposed = buildSceneCompositionPrompt(
                scene.description,
                scene.compositionPrompt,
                concept.style
            );

            const sourceImages = sceneAssetIds.length > 0 ? sceneAssetIds.map(id => {
                const img = canvasState.images.find(i => i.id === id);
                return img ? { data: img.data, mimeType: img.mimeType } : null;
            }).filter(Boolean) : null;

            const placeholderComposed = addImagePlaceholder(requestId, `Scene ${sceneNum} (Composed): ${scenePromptComposed}`, aspectRatio);

            const sceneImageComposed = await generateSingleImage(
                apiKey,
                requestId,
                scenePromptComposed,
                1,
                1,
                sourceImages,
                aspectRatio,
                sceneAssetIds,
                placeholderComposed,
                null  // Let model decide position
            );

            // VARIATION 2: Direct text-to-image
            addRequestLog(requestId, '🎬', `Creating Scene ${sceneNum} - Direct variation...`);
            const scenePromptDirect = buildDirectScenePrompt(
                scene.description,
                scene.compositionPrompt,
                concept.style
            );

            const placeholderDirect = addImagePlaceholder(requestId, `Scene ${sceneNum} (Direct): ${scenePromptDirect}`, aspectRatio);

            const sceneImageDirect = await generateSingleImage(
                apiKey,
                requestId,
                scenePromptDirect,
                1,
                1,
                null,
                aspectRatio,
                [],
                placeholderDirect,
                null  // Let model decide position
            );

            // Store both variations
            if (sceneImageComposed || sceneImageDirect) {
                canvasState.storyMode.sceneVariations[sceneNum] = {
                    composed: sceneImageComposed,
                    direct: sceneImageDirect
                };
                canvasState.storyMode.completedScenes.push(sceneNum);
            }
        }

        // Complete story
        canvasState.storyMode.stage = 'complete';
        updateRequestStatus(requestId, 'success', `Story complete! Generated ${scenes.length} scenes with 2 variations each (${scenes.length * 2} total images).`);
        addChatMessage(
            `🎉 **Story complete!** Generated ${scenes.length} scenes with **2 variations per scene**:\n\n` +
            `🎨 **Composed Variations**: Use individual assets\n` +
            `🖼️ **Direct Variations**: Created from text descriptions\n\n` +
            `Total: ${scenes.length * 2} scene images + ${Object.keys(canvasState.storyMode.assetsByName).length} assets generated!`,
            'system'
        );

        // Reset for next story after a delay
        setTimeout(() => {
            canvasState.storyMode.active = false;
            canvasState.storyMode.stage = null;
        }, 3000);

    } catch (error) {
        addRequestLog(requestId, '❌', `Unified story generation failed: ${error.message}`);
        updateRequestStatus(requestId, 'error', error.message);
        throw error;
    }
}

// ============================================================================
// FREE USAGE TRACKING
// ============================================================================

const FREE_USAGE_STORAGE_KEY = 'canvas_agent_free_usage';
const FREE_AGENT_LIMIT = 20;
const FREE_IMAGE_LIMIT = 5;

function getFreeUsage() {
    try {
        const stored = localStorage.getItem(FREE_USAGE_STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            // Check if expired (24h window)
            if (data.expiresAt && Date.now() < data.expiresAt) {
                return data;
            }
        }
    } catch (e) {
        console.warn('Failed to read free usage from storage:', e);
    }
    return { agentCount: 0, imageCount: 0, expiresAt: null };
}

function saveFreeUsage(usage) {
    try {
        localStorage.setItem(FREE_USAGE_STORAGE_KEY, JSON.stringify(usage));
    } catch (e) {
        console.warn('Failed to save free usage to storage:', e);
    }
}

function updateFreeUsageFromResponse(type, remaining, limit) {
    const usage = getFreeUsage();
    const used = limit - remaining;

    if (type === 'image') {
        usage.imageCount = used;
    } else {
        usage.agentCount = used;
    }

    // Set expiry to 24h from now if not set
    if (!usage.expiresAt) {
        usage.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    }

    saveFreeUsage(usage);
    updateFreeUsageUI();
}

function incrementFreeUsage(type) {
    const usage = getFreeUsage();

    if (type === 'image') {
        usage.imageCount = Math.min((usage.imageCount || 0) + 1, FREE_IMAGE_LIMIT);
    } else {
        usage.agentCount = Math.min((usage.agentCount || 0) + 1, FREE_AGENT_LIMIT);
    }

    // Set expiry to 24h from now if not set
    if (!usage.expiresAt) {
        usage.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    }

    saveFreeUsage(usage);
    updateFreeUsageUI();
}

function updateFreeUsageUI() {
    const usage = getFreeUsage();
    const apiKeyEl = document.getElementById('apiKey');
    const hasApiKey = apiKeyEl && apiKeyEl.value.trim().length > 0;

    // Hide usage display if user has API key
    const usageDisplay = document.getElementById('freeUsageDisplay');
    if (usageDisplay) {
        if (hasApiKey) {
            usageDisplay.classList.add('hidden');
            return;
        }
        usageDisplay.classList.remove('hidden');
    }

    // Update agent bar
    const agentBar = document.getElementById('agentUsageBar');
    const agentCount = document.getElementById('agentUsageCount');
    if (agentBar && agentCount) {
        const agentUsed = usage.agentCount || 0;
        const agentPercent = (agentUsed / FREE_AGENT_LIMIT) * 100;
        agentBar.style.width = `${agentPercent}%`;
        agentCount.textContent = `${agentUsed}/${FREE_AGENT_LIMIT}`;

        // Color coding
        agentBar.classList.remove('warning', 'danger');
        if (agentPercent >= 100) {
            agentBar.classList.add('danger');
        } else if (agentPercent >= 75) {
            agentBar.classList.add('warning');
        }
    }

    // Update image bar
    const imageBar = document.getElementById('imageUsageBar');
    const imageCount = document.getElementById('imageUsageCount');
    if (imageBar && imageCount) {
        const imageUsed = usage.imageCount || 0;
        const imagePercent = (imageUsed / FREE_IMAGE_LIMIT) * 100;
        imageBar.style.width = `${imagePercent}%`;
        imageCount.textContent = `${imageUsed}/${FREE_IMAGE_LIMIT}`;

        // Color coding
        imageBar.classList.remove('warning', 'danger');
        if (imagePercent >= 100) {
            imageBar.classList.add('danger');
        } else if (imagePercent >= 80) {
            imageBar.classList.add('warning');
        }
    }
}

// Initialize usage UI on load
document.addEventListener('DOMContentLoaded', () => {
    updateFreeUsageUI();
    initDirectMode();
});

// Also update when API key changes
if (apiKeyInput) {
    apiKeyInput.addEventListener('input', () => {
        setTimeout(updateFreeUsageUI, 100);
    });
}

// Export for use by agent.js
window.CanvasAgentUsage = {
    increment: incrementFreeUsage,
    updateFromResponse: updateFreeUsageFromResponse,
    updateUI: updateFreeUsageUI,
    get: getFreeUsage
};
