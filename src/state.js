// Canvas State
let canvasState = {
    projectTitle: null,  // NEW: Project title for better export names (will be randomly generated)
    images: [],
    videos: [],  // NEW: Video support
    audios: [],  // NEW: Audio support
    notes: [],   // NEW: Text notes for ideation
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    storyMode: {
        active: false,
        stage: null, // 'ideation' | 'awaiting_approval' | 'production' | 'complete'
        storyId: null, // unique identifier for current story
        concept: null, // concept metadata
        scene1Assets: null, // asset references for scene1
        allAssets: {}, // accumulated assets by type
        sceneCount: 0,
        completedScenes: [],
        currentRow: 0, // for organized placement
        assetsByName: {} // map of asset name -> {type, imageId}
    }
};

let lastPointerWorld = null;
let lastPointerScreen = null;

let selectedImages = new Set();
let draggedSelection = null;
let isSelecting = false;
let selectionStartScreen = null;
let selectionMarquee = null;
let selectionAdditive = false;
let selectionInitialSet = null;
let isSpaceKeyDown = false;
let isPanMode = false;
let panModeHintShown = false;

// Chat State
let conversationHistory = [];
let imageCounter = 0;
let videoCounter = 0;  // NEW: Video counter
let audioCounter = 0;  // NEW: Audio counter
let noteCounter = 0;   // NEW: Note counter
let lastGeneratedPosition = { x: 50, y: 50 };
const GENERATION_SPACING = 40;
const generationAnchors = new Map();

function setLastPointerPosition(worldPosition, screenPosition = null) {
    if (worldPosition && Number.isFinite(worldPosition.x) && Number.isFinite(worldPosition.y)) {
        lastPointerWorld = { x: worldPosition.x, y: worldPosition.y };
    }

    if (screenPosition && Number.isFinite(screenPosition.x) && Number.isFinite(screenPosition.y)) {
        lastPointerScreen = { x: screenPosition.x, y: screenPosition.y };
    }
}

function getLastPointerWorld() {
    return lastPointerWorld ? { ...lastPointerWorld } : null;
}

function getLastPointerScreen() {
    return lastPointerScreen ? { ...lastPointerScreen } : null;
}

const IMAGE_REFERENCE_PREFIX = '@i';
const VIDEO_REFERENCE_PREFIX = '@v';
const AUDIO_REFERENCE_PREFIX = '@a';
const NOTE_REFERENCE_PREFIX = '@t';
const IMAGE_REFERENCE_REGEX = /@i(\d+)(?::(\w+))?/gi;
const LEGACY_IMAGE_REFERENCE_REGEX = /@(?!(?:i|v|a|t))(\d+)/gi;
const VIDEO_REFERENCE_REGEX = /@v(\d+)/gi;
const AUDIO_REFERENCE_REGEX = /@a(\d+)/gi;
const NOTE_REFERENCE_REGEX = /@t(\d+)/gi;
const CHAT_REFERENCE_REGEX = /@(i|v|a|t)(\d+)(?::(\w+))?/gi;
const TEMPLATE_COMMAND_REGEX = /(^|[\s])(["'])?\/([a-zA-Z0-9_-]+)\2/g;

let templateLibrary = [];

function normalizeTemplateCommand(command) {
    if (typeof command !== 'string') {
        return '';
    }

    const trimmed = command.trim();
    if (trimmed.length === 0) {
        return '';
    }

    const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return withSlash.toLowerCase();
}

function sanitizeTemplateCommand(command) {
    if (typeof command !== 'string') {
        return '';
    }

    const trimmed = command.trim();
    if (!trimmed) {
        return '';
    }

    const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return withSlash.replace(/\s+/g, '');
}

function decorateTemplate(template) {
    if (!template || typeof template !== 'object') {
        return null;
    }

    const command = sanitizeTemplateCommand(template.command);
    const prompt = typeof template.prompt === 'string' ? template.prompt.trim() : '';
    if (!command || !prompt) {
        return null;
    }

    const normalizedCommand = normalizeTemplateCommand(command);
    const createdAt = typeof template.createdAt === 'number' ? template.createdAt : Date.now();

    return {
        command,
        prompt,
        createdAt,
        normalizedCommand
    };
}

function setTemplateLibrary(templates = []) {
    const deduped = new Map();

    templates.forEach((template) => {
        const decorated = decorateTemplate(template);
        if (!decorated) {
            return;
        }

        const existing = deduped.get(decorated.normalizedCommand);
        if (!existing || (existing && decorated.createdAt < existing.createdAt)) {
            deduped.set(decorated.normalizedCommand, decorated);
        }
    });

    templateLibrary = Array.from(deduped.values()).sort((a, b) => a.command.localeCompare(b.command));
}

function listTemplates() {
    return templateLibrary.map(({ normalizedCommand, ...rest }) => ({
        ...rest,
        normalizedCommand
    }));
}

function getTemplateSnapshot() {
    return templateLibrary.map(({ command, prompt, createdAt }) => ({ command, prompt, createdAt }));
}

function getTemplateByNormalizedCommand(normalizedCommand) {
    if (!normalizedCommand) {
        return null;
    }

    return templateLibrary.find(template => template.normalizedCommand === normalizedCommand) || null;
}

function getTemplateByCommand(command) {
    return getTemplateByNormalizedCommand(normalizeTemplateCommand(command));
}

function upsertTemplate({ command, prompt }) {
    const decorated = decorateTemplate({ command, prompt });
    if (!decorated) {
        throw new Error('Template command and prompt are required');
    }

    const existingIndex = templateLibrary.findIndex(template => template.normalizedCommand === decorated.normalizedCommand);
    const now = Date.now();

    if (existingIndex >= 0) {
        const existing = templateLibrary[existingIndex];
        const updatedTemplate = {
            ...existing,
            command: decorated.command,
            prompt: decorated.prompt,
            normalizedCommand: decorated.normalizedCommand,
            createdAt: existing.createdAt,
            updatedAt: now
        };
        templateLibrary[existingIndex] = updatedTemplate;
        templateLibrary.sort((a, b) => a.command.localeCompare(b.command));
        return { template: { ...updatedTemplate }, updated: true };
    }

    const newTemplate = {
        ...decorated,
        createdAt: decorated.createdAt || now,
        updatedAt: now
    };
    templateLibrary.push(newTemplate);
    templateLibrary.sort((a, b) => a.command.localeCompare(b.command));
    return { template: { ...newTemplate }, updated: false };
}

function removeTemplate(command) {
    const normalized = normalizeTemplateCommand(command);
    if (!normalized) {
        return false;
    }

    const index = templateLibrary.findIndex(template => template.normalizedCommand === normalized);
    if (index === -1) {
        return false;
    }

    templateLibrary.splice(index, 1);
    return true;
}

// Request State
let requestSequence = 0;
const activeRequests = new Map();

// API Configuration
if (!window.CanvasAgent) {
    throw new Error('CanvasAgent module failed to load.');
}
const {
    interpretUserCommand,
    getAgentModel,
    setAgentModel,
    SUPPORTED_AGENT_MODELS,
    DEFAULT_AGENT_MODEL,
    getImageModel,
    setImageModel,
    SUPPORTED_IMAGE_MODELS,
    DEFAULT_IMAGE_MODEL
} = window.CanvasAgent;  // AI model configuration helpers


// History State
const HISTORY_LIMIT = 50;
let historyStack = [];
let futureStack = [];
let isApplyingHistory = false;
let dragMoved = false;
let panMoved = false;
let viewportCommitTimeout = null;

