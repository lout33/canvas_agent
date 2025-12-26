// Session Management for Multi-Canvas Support
let currentSessionId = null;

// Generate a random session ID
function generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Get session ID from URL parameters
function getSessionIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('session');
}

// Set session ID in URL without page reload
function setSessionIdInUrl(sessionId) {
    const url = new URL(window.location);
    if (sessionId) {
        url.searchParams.set('session', sessionId);
    } else {
        url.searchParams.delete('session');
    }
    window.history.replaceState({}, '', url);
}

// Create a new session
function createNewSession() {
    const newSessionId = generateSessionId();
    setSessionIdInUrl(newSessionId);
    currentSessionId = newSessionId;
    return newSessionId;
}

// Switch to a different session
function switchToSession(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
        console.error('Invalid session ID provided:', sessionId);
        return false;
    }

    // Save current session before switching
    if (currentSessionId) {
        debouncedSave({ immediate: true, scope: 'full' });
    }

    // Clear current canvas
    clearCanvas();

    // Update session ID
    currentSessionId = sessionId;
    setSessionIdInUrl(sessionId);

    // Load new session data
    loadSessionData(sessionId).then(() => {
        addChatMessage(`🔄 Switched to session: ${sessionId}`, 'system');
    }).catch(error => {
        console.error('Failed to load session:', error);
        addChatMessage(`❌ Failed to load session: ${sessionId}`, 'system');
    });

    return true;
}

// Clear the current canvas
function clearCanvas() {
    canvas.innerHTML = '';
    canvasState.images = [];
    canvasState.videos = [];
    canvasState.audios = [];
    canvasState.notes = [];
    clearSelection({ skipUpdate: true });
    conversationHistory = [];
    imageCounter = 0;
    videoCounter = 0;
    audioCounter = 0;
    noteCounter = 0;
    lastGeneratedPosition = { x: 50, y: 50 };

    // Clear chat messages but keep system messages
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        const systemMessages = Array.from(chatMessages.children).filter(msg =>
            msg.classList.contains('system')
        );
        chatMessages.innerHTML = '';
        systemMessages.forEach(msg => chatMessages.appendChild(msg));
    }

    updateCanvas();
    updateCanvasStats();
}

// Load session data
async function loadSessionData(sessionId) {
    if (!supportsIndexedDB) {
        addChatMessage('⚠️ Sessions require IndexedDB support. Please use a modern browser.', 'system');
        return false;
    }

    try {
        const db = await dbPromise;
        const sessionKey = `canvas_${sessionId}`;

        // Load canvas metadata
        const persistedState = await new Promise((resolve, reject) => {
            const tx = db.transaction([DB_META_STORE], 'readonly');
            const store = tx.objectStore(DB_META_STORE);
            const request = store.get(sessionKey);

            request.onsuccess = (event) => {
                resolve(event.target.result ? event.target.result.value : null);
            };
            request.onerror = () => reject(request.error);
        });

        if (persistedState && (persistedState.images?.length > 0 || persistedState.videos?.length > 0 || persistedState.audios?.length > 0 || persistedState.notes?.length > 0)) {
            // Load actual data
            const imageRecords = await fetchSessionImageRecords(sessionId, persistedState.images || []);
            const videoRecords = await fetchSessionVideoRecords(sessionId, persistedState.videos || []);
            const audioRecords = await fetchSessionAudioRecords(sessionId, persistedState.audios || []);
            const noteRecords = await fetchSessionNoteRecords(sessionId, persistedState.notes || []);

            const restored = hydrateCanvasFromRecords(imageRecords, videoRecords, audioRecords, noteRecords, persistedState);

            if (restored > 0) {
                const imageCount = imageRecords.length;
                const videoCount = videoRecords.length;
                const audioCount = audioRecords.length;
                const noteCount = noteRecords.length;

                let message = `💾 Session "${sessionId}" loaded: `;
                const parts = [];
                if (imageCount > 0) parts.push(`${imageCount} image${imageCount > 1 ? 's' : ''}`);
                if (videoCount > 0) parts.push(`${videoCount} video${videoCount > 1 ? 's' : ''}`);
                if (audioCount > 0) parts.push(`${audioCount} audio${audioCount > 1 ? 's' : ''}`);
                if (noteCount > 0) parts.push(`${noteCount} note${noteCount > 1 ? 's' : ''}`);
                message += parts.join(', ') || 'empty canvas';

                addChatMessage(message, 'system');
                if (typeof updateProjectTitleDisplay === 'function') {
                    updateProjectTitleDisplay();
                }
                return true;
            }
        }

        // If no data found, start with empty canvas
        addChatMessage(`🆕 Session "${sessionId}" created - empty canvas`, 'system');
        await seedReferenceImagesIfNeeded();
        if (typeof updateProjectTitleDisplay === 'function') {
            updateProjectTitleDisplay();
        }
        return true;

    } catch (error) {
        console.error('Failed to load session data:', error);
        return false;
    }
}

// Initialize session on app load
function initializeSession() {
    const urlSessionId = getSessionIdFromUrl();
    console.log('Initializing session - URL session ID:', urlSessionId);

    if (urlSessionId) {
        currentSessionId = urlSessionId;
        console.log('Using existing session from URL:', currentSessionId);
        addChatMessage(`🔄 Loading session: ${urlSessionId}`, 'system');
    } else {
        currentSessionId = generateSessionId();
        console.log('Generated new session ID:', currentSessionId);
        setSessionIdInUrl(currentSessionId);
        addChatMessage(`🆕 Created new session: ${currentSessionId}`, 'system');
    }

    console.log('Session initialized with ID:', currentSessionId);
    return currentSessionId;
}

// Get current session ID
function getCurrentSessionId() {
    return currentSessionId;
}

// Check if we're in a specific session
function isInSession() {
    return currentSessionId !== null;
}

// Session UI Functions
function createNewSessionBtn() {
    if (confirm('Create a new session? Your current work will be saved automatically.')) {
        createNewSession();
        // Reload the page with new session
        window.location.reload();
    }
}

function showSessionInfo() {
    const modal = document.getElementById('sessionModal');
    const sessionIdInput = document.getElementById('currentSessionId');
    const sessionUrlInput = document.getElementById('sessionUrl');

    if (!modal || !sessionIdInput || !sessionUrlInput) return;

    hideAutocomplete(); // Close autocomplete when modal opens
    const sessionId = getCurrentSessionId();
    sessionIdInput.value = sessionId || 'default';
    sessionUrlInput.value = window.location.href;

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
}

function closeSessionModal() {
    const modal = document.getElementById('sessionModal');
    if (!modal) return;

    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
}

function copySessionId() {
    const sessionIdInput = document.getElementById('currentSessionId');
    if (!sessionIdInput) return;

    sessionIdInput.select();
    document.execCommand('copy');

    // Show feedback
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => {
        btn.textContent = originalText;
    }, 2000);
}

function copySessionUrl() {
    const sessionUrlInput = document.getElementById('sessionUrl');
    if (!sessionUrlInput) return;

    sessionUrlInput.select();
    document.execCommand('copy');

    // Show feedback
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => {
        btn.textContent = originalText;
    }, 2000);
}

function createNewSessionFromModal() {
    closeSessionModal();
    createNewSessionBtn();
}

function switchToSessionFromModal() {
    const sessionId = prompt('Enter session ID to switch to:');
    if (sessionId && sessionId.trim()) {
        closeSessionModal();
        switchToSession(sessionId.trim());
    }
}

// Initialize session modal event listeners
function initializeSessionModal() {
    const closeBtn = document.getElementById('closeSessionModalBtn');
    const backdrop = document.getElementById('sessionModalBackdrop');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeSessionModal);
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeSessionModal);
    }

    // Close on Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeSessionModal();
        }
    });
}

// Export for use in other modules
window.SessionManager = {
    createNewSession,
    switchToSession,
    getCurrentSessionId,
    isInSession,
    initializeSession,
    showSessionInfo,
    closeSessionModal,
    initializeSessionModal
};

// Make UI functions globally available
window.createNewSessionBtn = createNewSessionBtn;
window.showSessionInfo = showSessionInfo;
window.closeSessionModal = closeSessionModal;
window.copySessionId = copySessionId;
window.copySessionUrl = copySessionUrl;
window.createNewSessionFromModal = createNewSessionFromModal;
window.switchToSessionFromModal = switchToSessionFromModal;