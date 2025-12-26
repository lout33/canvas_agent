// Initialize Canvas
const canvas = document.getElementById('canvas');
const canvasArea = document.getElementById('canvasArea');
const canvasStatsElement = document.getElementById('canvasStats');
const canvasImageIdsList = document.getElementById('canvasImageIdsList');
const canvasVideoIdsList = document.getElementById('canvasVideoIdsList');
const canvasAudioIdsList = document.getElementById('canvasAudioIdsList');
const canvasNoteIdsList = document.getElementById('canvasNoteIdsList');
const projectTitleInput = document.getElementById('projectTitleInput');
const canvasCountElements = {
    images: document.getElementById('canvasImageCount'),
    videos: document.getElementById('canvasVideoCount'),
    audios: document.getElementById('canvasAudioCount'),
    notes: document.getElementById('canvasNoteCount')
};
const canvasAccordionElements = {
    images: document.getElementById('canvasImagesAccordion'),
    videos: document.getElementById('canvasVideosAccordion'),
    audios: document.getElementById('canvasAudiosAccordion'),
    notes: document.getElementById('canvasNotesAccordion')
};

// Project Title Management
const PROJECT_ADJECTIVES = [
    'cosmic', 'digital', 'neon', 'retro', 'mystic', 'bright', 'dark', 'wild',
    'gentle', 'bold', 'swift', 'calm', 'brave', 'cool', 'warm', 'fresh',
    'lunar', 'solar', 'stellar', 'urban', 'ocean', 'forest', 'desert', 'mountain',
    'electric', 'organic', 'abstract', 'minimal', 'vivid', 'pastel', 'vibrant', 'muted'
];

const PROJECT_NOUNS = [
    'falcon', 'tiger', 'dragon', 'phoenix', 'wolf', 'bear', 'eagle', 'lion',
    'sunset', 'sunrise', 'horizon', 'nebula', 'galaxy', 'comet', 'aurora', 'eclipse',
    'wave', 'river', 'ocean', 'summit', 'valley', 'canyon', 'forest', 'meadow',
    'dream', 'vision', 'journey', 'venture', 'project', 'canvas', 'palette', 'studio'
];

function generateRandomProjectName() {
    const adjective = PROJECT_ADJECTIVES[Math.floor(Math.random() * PROJECT_ADJECTIVES.length)];
    const noun = PROJECT_NOUNS[Math.floor(Math.random() * PROJECT_NOUNS.length)];
    return `${adjective}-${noun}`;
}

function sanitizeProjectTitle(title) {
    if (!title || typeof title !== 'string') {
        return generateRandomProjectName();
    }
    // Remove special characters and replace spaces with hyphens
    const sanitized = title.trim()
        .replace(/[^a-zA-Z0-9\s-_]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .substring(0, 50);

    return sanitized || generateRandomProjectName();
}

function updateProjectTitle(newTitle) {
    const sanitized = sanitizeProjectTitle(newTitle);
    canvasState.projectTitle = sanitized;
    if (projectTitleInput && projectTitleInput.value !== sanitized) {
        projectTitleInput.value = sanitized;
    }
    debouncedSave({ immediate: false, scope: 'full' });
}

function updateProjectTitleDisplay() {
    if (projectTitleInput) {
        // Generate random name if not set
        if (!canvasState.projectTitle) {
            canvasState.projectTitle = generateRandomProjectName();
            debouncedSave({ immediate: false, scope: 'full' });
        }
        projectTitleInput.value = canvasState.projectTitle;
    }
}

function initializeProjectTitleInput() {
    if (!projectTitleInput) return;

    // Set initial value from canvas state
    updateProjectTitleDisplay();

    // Handle input changes with debouncing
    let titleUpdateTimeout;
    projectTitleInput.addEventListener('input', (e) => {
        clearTimeout(titleUpdateTimeout);
        titleUpdateTimeout = setTimeout(() => {
            updateProjectTitle(e.target.value);
        }, 500);
    });

    // Sanitize on blur
    projectTitleInput.addEventListener('blur', (e) => {
        clearTimeout(titleUpdateTimeout);
        const sanitized = sanitizeProjectTitle(e.target.value);
        projectTitleInput.value = sanitized;
        canvasState.projectTitle = sanitized;
        debouncedSave({ immediate: true, scope: 'full' });
    });
}
const importJsonInput = document.getElementById('importJsonInput');
if (importJsonInput) {
    importJsonInput.addEventListener('change', handleImportJsonSelection);
}

const scheduleFrame = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
    ? (callback) => window.requestAnimationFrame(callback)
    : (callback) => setTimeout(callback, 16);

const canvasCounts = {
    images: 0,
    videos: 0,
    audios: 0,
    notes: 0
};

let lastHudText = canvasStatsElement ? canvasStatsElement.textContent : '';
let transformFrameHandle = null;
let pendingTransformState = null;
let hudFrameHandle = null;
let inventoryFrameHandle = null;

const listMarkupCache = new WeakMap();

function getViewportCenterWorld() {
    const rect = canvasArea.getBoundingClientRect();
    const centerX = rect.left + (rect.width / 2);
    const centerY = rect.top + (rect.height / 2);
    return clientToWorld(centerX, centerY);
}

function getCenteredTopLeft(width, height) {
    const worldCenter = getViewportCenterWorld();
    return {
        x: worldCenter.x - (width / 2),
        y: worldCenter.y - (height / 2)
    };
}

/**
 * Find the rightmost edge of all canvas items (images, videos, notes)
 * Also checks active placeholders and generation anchors
 * Returns the x position where the next item should start
 */
function getRightmostCanvasItemEdge() {
    let rightmostEdge = 50; // Default starting position
    let topY = 50; // Default top position
    
    // Check all images in canvas state
    if (canvasState.images.length > 0) {
        canvasState.images.forEach(img => {
            const rightEdge = img.x + (img.width || 0);
            if (rightEdge > rightmostEdge) {
                rightmostEdge = rightEdge;
                topY = img.y || 50;
            }
        });
    }
    
    // Check all videos in canvas state
    if (canvasState.videos.length > 0) {
        canvasState.videos.forEach(vid => {
            const rightEdge = vid.x + (vid.width || 0);
            if (rightEdge > rightmostEdge) {
                rightmostEdge = rightEdge;
                topY = vid.y || 50;
            }
        });
    }
    
    // Check all notes in canvas state
    if (canvasState.notes.length > 0) {
        canvasState.notes.forEach(note => {
            // Use note.width if available, otherwise fallback to default note width (280)
            const noteWidth = note.width || 280;
            const rightEdge = note.x + noteWidth;
            if (rightEdge > rightmostEdge) {
                rightmostEdge = rightEdge;
                topY = note.y || 50;
            }
        });
    }
    
    // Check active placeholders in DOM (for images/videos being generated)
    const placeholders = canvas.querySelectorAll('.canvas-placeholder');
    if (placeholders.length > 0) {
        placeholders.forEach(placeholderEl => {
            const left = parseFloat(placeholderEl.style.left) || 0;
            const width = parseFloat(placeholderEl.style.width) || 0;
            const top = parseFloat(placeholderEl.style.top) || 50;
            const rightEdge = left + width;
            if (rightEdge > rightmostEdge) {
                rightmostEdge = rightEdge;
                topY = top;
            }
        });
    }
    
    // Check active generation anchors (as fallback/backup)
    if (typeof generationAnchors !== 'undefined' && generationAnchors.size > 0) {
        generationAnchors.forEach((anchor, requestId) => {
            if (anchor && typeof anchor.lastRightEdge === 'number') {
                if (anchor.lastRightEdge > rightmostEdge) {
                    rightmostEdge = anchor.lastRightEdge;
                    topY = anchor.y || 50;
                }
            }
        });
    }
    
    return { rightmostEdge, topY };
}

/**
 * Calculate the bounding box of all canvas items
 */
function calculateCanvasBounds() {
    if (canvasState.images.length === 0 && canvasState.videos.length === 0 && canvasState.notes.length === 0) {
        return { minX: 50, maxX: 50, minY: 50, maxY: 50, width: 0, height: 0 };
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    [...canvasState.images, ...canvasState.videos, ...canvasState.notes].forEach(item => {
        const right = item.x + (item.width || 0);
        const bottom = item.y + (item.height || 0);
        minX = Math.min(minX, item.x);
        maxX = Math.max(maxX, right);
        minY = Math.min(minY, item.y);
        maxY = Math.max(maxY, bottom);
    });

    return { 
        minX: isFinite(minX) ? minX : 50, 
        maxX: isFinite(maxX) ? maxX : 50, 
        minY: isFinite(minY) ? minY : 50, 
        maxY: isFinite(maxY) ? maxY : 50,
        width: isFinite(maxX) && isFinite(minX) ? maxX - minX : 0, 
        height: isFinite(maxY) && isFinite(minY) ? maxY - minY : 0 
    };
}

/**
 * Generate a compact JSON representation of the live canvas state for the AI agent
 * This serves as the source of truth for canvas context
 */
function getAgentCanvasState() {
    const bounds = calculateCanvasBounds();
    const { rightmostEdge } = getRightmostCanvasItemEdge();

    // Get spatial analysis for intelligent placement
    const spatialAnalysis = getSpatialAnalysis();

    return {
        timestamp: Date.now(),
        viewport: {
            zoom: canvasState.zoom,
            offsetX: canvasState.offsetX,
            offsetY: canvasState.offsetY
        },
        spatial: spatialAnalysis,
        inventory: {
            images: canvasState.images.map(img => ({
                id: img.id,
                reference: `@i${img.id}`,
                x: img.x,
                y: img.y,
                width: img.width,
                height: img.height,
                aspectRatio: img.aspectRatio,
                resolution: img.resolution,
                prompt: (img.prompt || 'No prompt').substring(0, 200),
                hasReferences: (img.referenceIds || []).length > 0,
                referenceIds: img.referenceIds || []
            })),
            videos: canvasState.videos.map(vid => ({
                id: vid.id,
                reference: `@v${vid.id}`,
                x: vid.x,
                y: vid.y,
                width: vid.width,
                height: vid.height,
                aspectRatio: vid.aspectRatio,
                duration: vid.duration,
                sourceType: vid.sourceType,
                prompt: (vid.prompt || 'No prompt').substring(0, 200)
            })),
            audios: canvasState.audios.map(audio => ({
                id: audio.id,
                reference: `@a${audio.id}`,
                x: audio.x,
                y: audio.y,
                width: audio.width,
                height: audio.height,
                duration: audio.duration,
                mimeType: audio.mimeType,
                text: (audio.text || 'No text').substring(0, 200)
            })),
            notes: canvasState.notes.map(note => ({
                id: note.id,
                reference: `@t${note.id}`,
                x: note.x,
                y: note.y,
                width: note.width,
                height: note.height,
                textPreview: (typeof note.text === 'string' ? note.text.trim() : '').substring(0, 150) || '(empty)'
            }))
        },
        layout: {
            rightmostEdge: rightmostEdge,
            totalItems: canvasState.images.length + canvasState.videos.length + canvasState.audios.length + canvasState.notes.length,
            bounds: bounds
        }
    };
}

const PASTE_PLACEMENT_STEP = 32;
const INTERNAL_CLIPBOARD_MIME = 'application/x-canvas-agent-items';

function getItemWorldDimensions(item) {
    if (!item) {
        return { width: 0, height: 0 };
    }

    let width = Number.isFinite(item.width) ? item.width : null;
    let height = Number.isFinite(item.height) ? item.height : null;

    if (item.type === 'image') {
        if (width === null || height === null) {
            const size = getCanvasSizeFromAspectRatio(item.aspectRatio || '1:1');
            width = width === null ? size[0] : width;
            height = height === null ? size[1] : height;
        }
    } else if (item.type === 'video') {
        const ratioSizes = VIDEO_CANVAS_SIZES[item.aspectRatio] || getCanvasSizeFromAspectRatio(item.aspectRatio || '16:9');
        if (width === null) {
            width = Array.isArray(ratioSizes) ? ratioSizes[0] : null;
        }
        if (height === null) {
            height = Array.isArray(ratioSizes) ? ratioSizes[1] : null;
        }
    } else if (item.type === 'note') {
        if (width === null) {
            width = DEFAULT_NOTE_WIDTH;
        }
        if (height === null) {
            height = DEFAULT_NOTE_HEIGHT;
        }
    }

    width = Number.isFinite(width) ? width : DEFAULT_NOTE_WIDTH;
    height = Number.isFinite(height) ? height : DEFAULT_NOTE_HEIGHT;

    return { width, height };
}

function buildClipboardPayloadFromSelection(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const snapshots = items.map((item) => {
        const { width, height } = getItemWorldDimensions(item);
        const x = Number.isFinite(item.x) ? item.x : 0;
        const y = Number.isFinite(item.y) ? item.y : 0;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);

        return { item, width, height, x, y };
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        return null;
    }

    const originX = minX;
    const originY = minY;

    const serialized = snapshots.map(({ item, width, height, x, y }) => {
        const base = {
            type: item.type || 'image',
            offsetX: x - originX,
            offsetY: y - originY,
            width,
            height
        };

        if (item.type === 'video') {
            const durationValue = item.duration;
            const normalizedDuration = durationValue === null
                ? null
                : (Number.isFinite(durationValue) ? durationValue : undefined);

            const payload = {
                ...base,
                prompt: item.prompt || '',
                aspectRatio: item.aspectRatio || '16:9',
                mimeType: item.mimeType || 'video/mp4',
                sourceType: item.sourceType || (item.data ? 'data' : 'url'),
                sourceUrl: item.sourceUrl || null,
                externalId: item.externalId || null,
                embedUrl: item.embedUrl || null,
                poster: item.poster || null,
                data: item.data || null
            };

            if (typeof normalizedDuration !== 'undefined') {
                payload.duration = normalizedDuration;
            }

            return payload;
        }

        if (item.type === 'note') {
            return {
                ...base,
                text: item.text || ''
            };
        }

        return {
            ...base,
            prompt: item.prompt || '',
            aspectRatio: item.aspectRatio || '1:1',
            resolution: item.resolution || '',
            mimeType: item.mimeType || 'image/png',
            data: item.data || '',
            referenceIds: Array.isArray(item.referenceIds) ? [...item.referenceIds] : []
        };
    });

    return {
        version: 1,
        bounds: {
            width: maxX - minX,
            height: maxY - minY
        },
        items: serialized
    };
}

function getPrimaryClipboardImage(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return null;
    }

    for (let index = items.length - 1; index >= 0; index -= 1) {
        const candidate = items[index];
        if (!candidate || candidate.type !== 'image') {
            continue;
        }

        if (typeof candidate.data === 'string' && candidate.data.length > 0) {
            return candidate;
        }
    }

    return null;
}

function base64ToBlob(base64, mimeType = 'application/octet-stream') {
    if (typeof base64 !== 'string' || base64.length === 0) {
        return null;
    }

    try {
        const sanitized = base64.replace(/\s/g, '');
        const binaryString = atob(sanitized);
        const length = binaryString.length;
        const bytes = new Uint8Array(length);

        for (let i = 0; i < length; i += 1) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return new Blob([bytes], { type: mimeType });
    } catch (error) {
        console.warn('Failed to convert base64 to Blob:', error);
        return null;
    }
}

async function writeImageToSystemClipboard(imageObj) {
    if (!imageObj || typeof imageObj.data !== 'string' || imageObj.data.length === 0) {
        return false;
    }

    const clipboardApi = typeof navigator !== 'undefined' ? navigator.clipboard : null;
    if (!clipboardApi || typeof clipboardApi.write !== 'function') {
        return false;
    }

    const ClipboardItemCtor = typeof ClipboardItem === 'function'
        ? ClipboardItem
        : (typeof window !== 'undefined' && typeof window.ClipboardItem === 'function'
            ? window.ClipboardItem
            : null);

    if (!ClipboardItemCtor) {
        return false;
    }

    const mimeType = (typeof imageObj.mimeType === 'string' && imageObj.mimeType.length > 0)
        ? imageObj.mimeType
        : 'image/png';

    const blob = base64ToBlob(imageObj.data, mimeType);
    if (!blob) {
        return false;
    }

    try {
        const clipboardItem = new ClipboardItemCtor({ [mimeType]: blob });
        await clipboardApi.write([clipboardItem]);
        return true;
    } catch (error) {
        console.warn('Failed to write image to system clipboard:', error);
        return false;
    }
}

function pasteInternalClipboardPayload(payload, nextPlacement) {
    if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
        return false;
    }

    const pointer = getPointerWorldOrCenter();
    const generator = typeof nextPlacement === 'function' ? nextPlacement : null;
    const boundsWidth = Number.isFinite(payload.bounds?.width) ? payload.bounds.width : null;
    const boundsHeight = Number.isFinite(payload.bounds?.height) ? payload.bounds.height : null;

    let computedWidth = 0;
    let computedHeight = 0;

    payload.items.forEach((item) => {
        const width = Number.isFinite(item.width) ? item.width : 0;
        const height = Number.isFinite(item.height) ? item.height : 0;
        computedWidth = Math.max(computedWidth, item.offsetX + width);
        computedHeight = Math.max(computedHeight, item.offsetY + height);
    });

    const totalWidth = boundsWidth && boundsWidth > 0 ? boundsWidth : computedWidth;
    const totalHeight = boundsHeight && boundsHeight > 0 ? boundsHeight : computedHeight;

    let basePlacement = generator ? generator() : null;
    if (!basePlacement) {
        basePlacement = { x: pointer.x, y: pointer.y, align: 'center' };
    }

    let baseX;
    let baseY;
    if (basePlacement.align === 'center') {
        baseX = basePlacement.x - (totalWidth / 2);
        baseY = basePlacement.y - (totalHeight / 2);
    } else {
        baseX = basePlacement.x;
        baseY = basePlacement.y;
    }

    const createdItems = [];

    payload.items.forEach((item) => {
        const offsetX = Number.isFinite(item.offsetX) ? item.offsetX : 0;
        const offsetY = Number.isFinite(item.offsetY) ? item.offsetY : 0;
        const width = Number.isFinite(item.width) ? item.width : undefined;
        const height = Number.isFinite(item.height) ? item.height : undefined;
        const targetPosition = { x: baseX + offsetX, y: baseY + offsetY };

        let created = null;

        if (item.type === 'video') {
            const options = {
                position: targetPosition,
                width,
                height,
                sourceType: item.sourceType || (item.data ? 'data' : 'url'),
                sourceUrl: item.sourceUrl || null,
                externalId: item.externalId || null,
                embedUrl: item.embedUrl || null,
                poster: item.poster || null
            };

            const durationValue = item.duration;
            const duration = durationValue === null
                ? null
                : (Number.isFinite(durationValue) ? durationValue : undefined);

            created = addVideoToCanvas(
                item.data || null,
                item.mimeType || 'video/mp4',
                item.prompt || 'Copied video',
                item.aspectRatio || '16:9',
                duration,
                options
            );
        } else if (item.type === 'note') {
            created = addNoteToCanvas(
                item.text || '',
                targetPosition,
                {
                    width,
                    height
                }
            );
        } else {
            created = addImageToCanvas(
                item.data || '',
                item.mimeType || 'image/png',
                item.prompt || 'Copied image',
                item.aspectRatio || '1:1',
                item.resolution || '',
                Array.isArray(item.referenceIds) ? item.referenceIds : [],
                targetPosition
            );
        }

        if (created) {
            createdItems.push(created);
        }
    });

    if (createdItems.length === 0) {
        return false;
    }

    clearSelection({ skipUpdate: true });
    createdItems.forEach((item, index) => {
        const options = { additive: index !== 0, toggle: false, skipUpdate: true };
        if (item.type === 'video') {
            selectVideo(item, options);
        } else if (item.type === 'note') {
            selectNote(item, options);
        } else {
            selectImage(item, options);
        }
    });

    updateCanvasIdsList({ refreshCounts: true });
    updateDeleteButtonState();
    addChatMessage(`📋 Pasted ${createdItems.length} item${createdItems.length === 1 ? '' : 's'} on the canvas.`, 'system');

    return true;
}

function isClientWithinCanvas(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
        return false;
    }

    const rect = canvasArea.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function trackCanvasPointer(event) {
    if (!event || !isClientWithinCanvas(event.clientX, event.clientY)) {
        return;
    }

    const rect = canvasArea.getBoundingClientRect();
    const screenPosition = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
    const worldPosition = clientToWorld(event.clientX, event.clientY);
    setLastPointerPosition(worldPosition, screenPosition);
}

function getPointerWorldOrCenter() {
    const pointer = typeof getLastPointerWorld === 'function' ? getLastPointerWorld() : null;
    if (pointer && Number.isFinite(pointer.x) && Number.isFinite(pointer.y)) {
        return pointer;
    }
    return getViewportCenterWorld();
}

function createPastePlacementGenerator() {
    const base = getPointerWorldOrCenter();
    let index = 0;

    return () => {
        const offset = index * PASTE_PLACEMENT_STEP;
        index += 1;
        return {
            x: base.x + offset,
            y: base.y + offset,
            align: 'center'
        };
    };
}

function coercePlacementOption(positionOption) {
    if (!positionOption) {
        return null;
    }

    const value = typeof positionOption === 'function'
        ? positionOption()
        : positionOption;

    if (!value || typeof value !== 'object') {
        return null;
    }

    if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
        return null;
    }

    return {
        x: value.x,
        y: value.y,
        align: value.align === 'center' ? 'center' : undefined
    };
}

// Helper: Check if a position is within viewport
function isPositionInViewport(x, y, width, height) {
    const viewport = getViewportInfo();
    const margin = SMART_PLACEMENT_CONFIG.MIN_VIEWPORT_MARGIN;

    return (
        x >= viewport.x - margin &&
        y >= viewport.y - margin &&
        x + width <= viewport.x + viewport.width + margin &&
        y + height <= viewport.y + viewport.height + margin
    );
}

// Helper: Find suitable empty space for placement
function findSuitableEmptySpace(width, height) {
    const emptySpaces = findEmptySpaces();
    const minSize = SMART_PLACEMENT_CONFIG.EMPTY_SPACE_MIN_SIZE;

    // Find first empty space that can fit the item
    for (const space of emptySpaces) {
        if (space.width >= width && space.height >= height &&
            Math.min(space.width, space.height) >= minSize) {
            return {
                x: space.x,
                y: space.y
            };
        }
    }

    return null;
}

// Helper: Check if current generation has reference (is a variation)
function hasReferences(referenceIds) {
    return Array.isArray(referenceIds) && referenceIds.length > 0;
}

// Helper: Get the parent item from references
function getParentItemFromReferences(referenceIds) {
    if (!hasReferences(referenceIds)) {
        return null;
    }

    // Get the first reference as parent
    const parentId = referenceIds[0];

    // Search in all asset types
    const parentImage = canvasState.images.find(img => img.id === parentId);
    if (parentImage) return parentImage;

    const parentVideo = canvasState.videos?.find(vid => vid.id === parentId);
    if (parentVideo) return parentVideo;

    const parentNote = canvasState.notes?.find(note => note.id === parentId);
    if (parentNote) return parentNote;

    return null;
}

function acquireGenerationPlacement(width, height, requestId = null, referenceIds = []) {
    if (typeof width !== 'number' || typeof height !== 'number') {
        throw new Error('Width and height are required for generation placement calculations.');
    }

    const config = SMART_PLACEMENT_CONFIG;

    // ========================================================================
    // PRIORITY 1: Reference-Aware Placement (for variations)
    // ========================================================================
    if (hasReferences(referenceIds)) {
        const parent = getParentItemFromReferences(referenceIds);
        if (parent) {
            const parentWidth = parent.width || 300;

            // If this is part of a batch (has requestId), use grid layout for multiple variations
            if (requestId) {
                const MAX_VARIATIONS_PER_ROW = 3;
                let anchor = generationAnchors.get(requestId);

                if (!anchor) {
                    // First variation - place to the right of parent
                    const firstPosition = {
                        x: parent.x + parentWidth + config.SAME_BATCH_SPACING,
                        y: parent.y + config.VARIATION_VERTICAL_OFFSET
                    };

                    anchor = {
                        nextIndex: 1,
                        itemsInCurrentRow: 1,
                        currentRowIndex: 0,
                        rowStartX: firstPosition.x,
                        rowStartY: firstPosition.y,
                        lastRightEdge: firstPosition.x + width,
                        maxItemHeightInRow: height
                    };
                    generationAnchors.set(requestId, anchor);

                    return { position: firstPosition, index: 0 };
                }

                // Subsequent variations - arrange in grid
                const itemsInRow = anchor.itemsInCurrentRow;
                const shouldWrapToNewRow = itemsInRow >= MAX_VARIATIONS_PER_ROW;

                let position;

                if (shouldWrapToNewRow) {
                    // Wrap to new row
                    const newRowY = anchor.rowStartY + anchor.maxItemHeightInRow + config.ROW_VERTICAL_SPACING;

                    position = {
                        x: anchor.rowStartX,
                        y: newRowY
                    };

                    // Update anchor for new row
                    anchor.currentRowIndex += 1;
                    anchor.itemsInCurrentRow = 1;
                    anchor.rowStartY = newRowY;
                    anchor.lastRightEdge = position.x + width;
                    anchor.maxItemHeightInRow = height;
                } else {
                    // Continue in current row
                    position = {
                        x: anchor.lastRightEdge + config.SAME_BATCH_SPACING,
                        y: anchor.rowStartY
                    };

                    // Update anchor
                    anchor.itemsInCurrentRow += 1;
                    anchor.lastRightEdge = position.x + width;
                    anchor.maxItemHeightInRow = Math.max(anchor.maxItemHeightInRow, height);
                }

                const index = anchor.nextIndex;
                anchor.nextIndex += 1;
                generationAnchors.set(requestId, anchor);

                return { position, index };
            }

            // No requestId - single variation (legacy behavior)
            return {
                position: {
                    x: parent.x + parentWidth + config.SAME_BATCH_SPACING,
                    y: parent.y + config.VARIATION_VERTICAL_OFFSET
                },
                index: null
            };
        }
    }

    // ========================================================================
    // PRIORITY 2: Selection-Based Placement
    // ========================================================================
    if (selectedImages.size > 0) {
        // Find the rightmost selected item
        let rightmostItem = null;
        let rightmostEdge = -Infinity;

        selectedImages.forEach(item => {
            const itemWidth = item.width || 0;
            const itemRightEdge = item.x + itemWidth;
            if (itemRightEdge > rightmostEdge) {
                rightmostEdge = itemRightEdge;
                rightmostItem = item;
            }
        });

        if (rightmostItem) {
            return {
                position: {
                    x: rightmostEdge + config.SAME_BATCH_SPACING,
                    y: rightmostItem.y
                },
                index: null
            };
        }
    }

    // ========================================================================
    // PRIORITY 3: Batch Placement with Grid Wrapping
    // ========================================================================
    if (requestId === null || typeof requestId === 'undefined') {
        // No batch context - try empty space, then extend canvas
        const emptySpace = findSuitableEmptySpace(width, height);
        if (emptySpace) {
            return {
                position: emptySpace,
                index: null
            };
        }

        // Fallback: extend to the right
        const { rightmostEdge, topY } = getRightmostCanvasItemEdge();
        return {
            position: {
                x: rightmostEdge + config.DIFFERENT_BATCH_SPACING,
                y: topY
            },
            index: null
        };
    }

    // ========================================================================
    // PRIORITY 4: Smart Batch Layout (with grid wrapping)
    // ========================================================================
    let anchor = generationAnchors.get(requestId);

    if (!anchor) {
        // First item in this batch
        let origin;
        const viewport = getViewportInfo();

        // Try to find a good starting position
        const emptySpace = findSuitableEmptySpace(width, height);

        if (emptySpace && isPositionInViewport(emptySpace.x, emptySpace.y, width, height)) {
            // Use empty space if it's in viewport
            origin = emptySpace;
        } else {
            // Start near viewport or after existing content
            const { rightmostEdge, topY } = getRightmostCanvasItemEdge();

            // Prefer viewport-visible position
            if (viewport && rightmostEdge < viewport.x) {
                // Canvas is to the left of viewport - start in viewport
                origin = {
                    x: viewport.x + config.MIN_VIEWPORT_MARGIN,
                    y: viewport.y + config.MIN_VIEWPORT_MARGIN
                };
            } else {
                // Normal flow - continue from rightmost edge
                const originX = rightmostEdge > 50 ? rightmostEdge + config.DIFFERENT_BATCH_SPACING : 50;
                origin = {
                    x: originX,
                    y: topY
                };
            }
        }

        // Initialize anchor with grid tracking
        anchor = {
            nextIndex: 1,
            itemsInCurrentRow: 1,
            currentRowIndex: 0,
            rowStartX: origin.x,
            rowStartY: origin.y,
            lastRightEdge: origin.x + width,
            maxItemHeightInRow: height
        };
        generationAnchors.set(requestId, anchor);

        return { position: origin, index: 0 };
    }

    // ========================================================================
    // Subsequent items: Check for grid wrapping
    // ========================================================================
    const itemsInRow = anchor.itemsInCurrentRow;
    const shouldWrapToNewRow = itemsInRow >= config.MAX_ITEMS_PER_ROW;

    let position;

    if (shouldWrapToNewRow) {
        // Wrap to new row
        const newRowIndex = anchor.currentRowIndex + 1;
        const newRowY = anchor.rowStartY + anchor.maxItemHeightInRow + config.ROW_VERTICAL_SPACING;

        position = {
            x: anchor.rowStartX,
            y: newRowY
        };

        // Update anchor for new row
        anchor.currentRowIndex = newRowIndex;
        anchor.itemsInCurrentRow = 1;
        anchor.rowStartY = newRowY;
        anchor.lastRightEdge = position.x + width;
        anchor.maxItemHeightInRow = height;
    } else {
        // Continue in current row
        position = {
            x: anchor.lastRightEdge + config.SAME_BATCH_SPACING,
            y: anchor.rowStartY
        };

        // Update anchor
        anchor.itemsInCurrentRow += 1;
        anchor.lastRightEdge = position.x + width;
        anchor.maxItemHeightInRow = Math.max(anchor.maxItemHeightInRow, height);
    }

    const index = anchor.nextIndex;
    anchor.nextIndex += 1;
    generationAnchors.set(requestId, anchor);

    return { position, index };
}

function updateGenerationAnchorAfterDrag(requestId, index, width, position) {
    if (requestId === null || typeof requestId === 'undefined') {
        return;
    }

    const anchor = generationAnchors.get(requestId);
    if (!anchor) {
        return;
    }

    const isLastPlaced = typeof index === 'number' && index === anchor.nextIndex - 1;
    const isOnlyItem = anchor.nextIndex === 1 && (typeof index === 'number' ? index === 0 : true);

    if (isLastPlaced || isOnlyItem) {
        anchor.lastRightEdge = position.x + width;
        anchor.y = position.y;
        generationAnchors.set(requestId, anchor);
    }
}

// ============================================================================
// STORY MODE PLACEMENT HELPERS
// ============================================================================

const STORY_ROW_HEIGHT = 450; // vertical spacing between rows (50px more space)
const STORY_ITEM_SPACING = 20; // horizontal spacing between items
const STORY_ROW_START_Y = 100; // first row Y position
const STORY_DEFAULT_ITEM_WIDTH = 300; // default width for placement calculation

function getStoryRowPlacement(rowIndex, itemIndex, itemWidth = STORY_DEFAULT_ITEM_WIDTH) {
    const y = STORY_ROW_START_Y + (rowIndex * STORY_ROW_HEIGHT);
    const x = 150 + (itemIndex * (itemWidth + STORY_ITEM_SPACING)); // Only 10px to the left (160-10)
    return { x, y };
}

function placeStoryItemInRow(rowIndex, itemsInRow, itemWidth = STORY_DEFAULT_ITEM_WIDTH) {
    // Calculate placement for next item in specified row
    const { x, y } = getStoryRowPlacement(rowIndex, itemsInRow, itemWidth);
    return { x, y };
}

function createStoryRowLabel(rowIndex, label) {
    // Create text label for row (e.g., "STORY", "ASSETS", "SCENES")
    const { y } = getStoryRowPlacement(rowIndex, 0, 0);
    const labelX = 0; // Position labels only 10px to the left (10-10)
    const labelY = y + 15; // Center with the row items

    // Special styling for the main story label
    const isStoryLabel = rowIndex === 0 && label.includes('STORY');

    const position = { x: labelX, y: labelY };
    const note = addNoteToCanvas(label, position, { width: 120, height: 50 });

    // Style the label note to be more prominent and visually appealing
    const element = document.querySelector(`[data-note-id="${note.id}"]`);
    if (element) {
        element.style.opacity = '0.8';
        element.style.fontSize = isStoryLabel ? '20px' : '18px';
        element.style.fontWeight = 'bold';

        if (isStoryLabel) {
            // Special styling for the main story label (dark mode)
            element.style.color = '#ef4444'; // Red color for main story
            element.style.backgroundColor = '#1f2937'; // Dark background
            element.style.border = '2px solid #dc2626'; // Dark red border
        } else {
            // Regular styling for other row labels (dark mode)
            element.style.color = '#60a5fa'; // Light blue color for story labels
            element.style.backgroundColor = '#1f2937'; // Dark background
            element.style.border = '2px solid #2563eb'; // Blue border
        }

        element.style.borderRadius = '8px'; // Rounded corners
        element.style.pointerEvents = 'none'; // Make it non-interactive
        element.style.textAlign = 'center';
        element.style.lineHeight = '1.3';
        element.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'; // Subtle shadow
    }

    return note;
}


// ============================================================================
// SMART PLACEMENT SYSTEM - Simple & Automatic
// ============================================================================

// Placement configuration
const SMART_PLACEMENT_CONFIG = {
    MAX_ITEMS_PER_ROW: 5,           // Auto-wrap to new row after this many items
    SAME_BATCH_SPACING: 20,         // Tight spacing for items in same generation
    DIFFERENT_BATCH_SPACING: 80,    // Wide spacing between different batches
    ROW_VERTICAL_SPACING: 60,       // Vertical spacing between rows
    VARIATION_VERTICAL_OFFSET: 40,  // Vertical offset for child variations
    MIN_VIEWPORT_MARGIN: 100,       // Minimum margin from viewport edge
    EMPTY_SPACE_MIN_SIZE: 200       // Minimum empty space size to consider
};

// ============================================================================
// INTELLIGENT PLACEMENT SYSTEM
// ============================================================================

function getViewportInfo() {
    // Get current viewport information
    const rect = canvasArea.getBoundingClientRect();
    const topLeft = clientToWorld(rect.left, rect.top);
    const bottomRight = clientToWorld(rect.right, rect.bottom);

    return {
        x: topLeft.x,
        y: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
        centerX: (topLeft.x + bottomRight.x) / 2,
        centerY: (topLeft.y + bottomRight.y) / 2,
        zoom: canvasState.zoom,
        screenRect: rect
    };
}

function getVisibleNodes() {
    // Get all nodes currently visible in viewport
    const viewport = getViewportInfo();
    const visibleNodes = {
        images: [],
        notes: [],
        videos: [],
        audios: []
    };

    // Check images
    (canvasState.images || []).forEach(img => {
        const nodeRight = img.x + (img.width || 300);
        const nodeBottom = img.y + (img.height || 400);

        if (img.x < viewport.x + viewport.width &&
            nodeRight > viewport.x &&
            img.y < viewport.y + viewport.height &&
            nodeBottom > viewport.y) {
            visibleNodes.images.push({
                id: img.id,
                type: 'image',
                x: img.x,
                y: img.y,
                width: img.width || 300,
                height: img.height || 400,
                distanceFromCenter: Math.sqrt(
                    Math.pow((img.x + (img.width || 300) / 2) - viewport.centerX, 2) +
                    Math.pow((img.y + (img.height || 400) / 2) - viewport.centerY, 2)
                )
            });
        }
    });

    // Check notes
    (canvasState.notes || []).forEach(note => {
        const nodeRight = note.x + (note.width || 200);
        const nodeBottom = note.y + (note.height || 100);

        if (note.x < viewport.x + viewport.width &&
            nodeRight > viewport.x &&
            note.y < viewport.y + viewport.height &&
            nodeBottom > viewport.y) {
            visibleNodes.notes.push({
                id: note.id,
                type: 'note',
                x: note.x,
                y: note.y,
                width: note.width || 200,
                height: note.height || 100,
                distanceFromCenter: Math.sqrt(
                    Math.pow((note.x + (note.width || 200) / 2) - viewport.centerX, 2) +
                    Math.pow((note.y + (note.height || 100) / 2) - viewport.centerY, 2)
                )
            });
        }
    });

    // Similar checks for videos and audios...

    return visibleNodes;
}

function findEmptySpaces(targetArea = null) {
    // Find empty spaces in canvas, optionally focused on target area
    const viewport = targetArea || getViewportInfo();
    const emptySpaces = [];

    // Get all existing nodes with their boundaries
    const allNodes = [
        ...(canvasState.images || []).map(img => ({
            x: img.x,
            y: img.y,
            width: img.width || 300,
            height: img.height || 400,
            type: 'image'
        })),
        ...(canvasState.notes || []).map(note => ({
            x: note.x,
            y: note.y,
            width: note.width || 200,
            height: note.height || 100,
            type: 'note'
        }))
    ];

    // Define search area (viewport or expanded viewport)
    const searchArea = {
        x: viewport.x - 100,
        y: viewport.y - 100,
        width: viewport.width + 200,
        height: viewport.height + 200
    };

    // Grid-based empty space detection
    const gridSize = 100;
    const gridWidth = Math.ceil(searchArea.width / gridSize);
    const gridHeight = Math.ceil(searchArea.height / gridSize);

    for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
            const cellX = searchArea.x + (col * gridSize);
            const cellY = searchArea.y + (row * gridSize);

            // Check if this grid cell overlaps with any existing node
            const hasOverlap = allNodes.some(node =>
                cellX < node.x + node.width &&
                cellX + gridSize > node.x &&
                cellY < node.y + node.height &&
                cellY + gridSize > node.y
            );

            if (!hasOverlap) {
                // Found empty space - calculate actual available area
                const emptySpace = {
                    x: cellX,
                    y: cellY,
                    width: gridSize,
                    height: gridSize,
                    distanceFromViewportCenter: Math.sqrt(
                        Math.pow((cellX + gridSize/2) - viewport.centerX, 2) +
                        Math.pow((cellY + gridSize/2) - viewport.centerY, 2)
                    )
                };

                // Try to expand the empty space by checking adjacent cells
                let expandedWidth = gridSize;
                let expandedHeight = gridSize;

                // Try to expand horizontally
                for (let expandCol = col + 1; expandCol < gridWidth; expandCol++) {
                    const expandX = searchArea.x + (expandCol * gridSize);
                    const canExpand = !allNodes.some(node =>
                        expandX < node.x + node.width &&
                        expandX + gridSize > node.x &&
                        cellY < node.y + node.height &&
                        cellY + gridSize > node.y
                    );

                    if (canExpand) {
                        expandedWidth += gridSize;
                    } else {
                        break;
                    }
                }

                // Try to expand vertically
                for (let expandRow = row + 1; expandRow < gridHeight; expandRow++) {
                    const expandY = searchArea.y + (expandRow * gridSize);
                    const canExpand = !allNodes.some(node =>
                        cellX < node.x + node.width &&
                        cellX + expandedWidth > node.x &&
                        expandY < node.y + node.height &&
                        expandY + gridSize > node.y
                    );

                    if (canExpand) {
                        expandedHeight += gridSize;
                    } else {
                        break;
                    }
                }

                emptySpace.width = expandedWidth;
                emptySpace.height = expandedHeight;

                emptySpaces.push(emptySpace);
            }
        }
    }

    // Sort empty spaces by distance from viewport center
    emptySpaces.sort((a, b) => a.distanceFromViewportCenter - b.distanceFromViewportCenter);

    return emptySpaces;
}

function getSpatialAnalysis() {
    // Comprehensive spatial analysis for intelligent placement
    const viewport = getViewportInfo();
    const visibleNodes = getVisibleNodes();
    const emptySpaces = findEmptySpaces();

    return {
        viewport,
        visibleNodes,
        emptySpaces,
        canvasBounds: {
            minX: Math.min(...(canvasState.images || []).map(img => img.x), ... (canvasState.notes || []).map(note => note.x)),
            maxX: Math.max(...(canvasState.images || []).map(img => img.x + (img.width || 300)), ... (canvasState.notes || []).map(note => note.x + (note.width || 200))),
            minY: Math.min(...(canvasState.images || []).map(img => img.y), ... (canvasState.notes || []).map(note => note.y)),
            maxY: Math.max(...(canvasState.images || []).map(img => img.y + (img.height || 400)), ... (canvasState.notes || []).map(note => note.y + (note.height || 100)))
        },
        density: {
            totalNodes: (canvasState.images?.length || 0) + (canvasState.notes?.length || 0),
            nodesInViewport: visibleNodes.images.length + visibleNodes.notes.length,
            emptySpacesInViewport: emptySpaces.length
        }
    };
}

// Scene separator function removed for cleaner layout

// ============================================================================

function makePlaceholderDraggable(element, state, options = {}) {
    const header = element.querySelector('.media-header');
    if (!header) {
        return;
    }

    header.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const pointer = clientToWorld(event.clientX, event.clientY);
        const offsetX = pointer.x - state.x;
        const offsetY = pointer.y - state.y;

        const handleMove = (moveEvent) => {
            moveEvent.preventDefault();
            const movePointer = clientToWorld(moveEvent.clientX, moveEvent.clientY);
            const newX = movePointer.x - offsetX;
            const newY = movePointer.y - offsetY;

            state.x = newX;
            state.y = newY;
            element.style.left = `${newX}px`;
            element.style.top = `${newY}px`;
        };

        const handleUp = () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);

            updateGenerationAnchorAfterDrag(
                options.requestId,
                options.index,
                options.width,
                { x: state.x, y: state.y }
            );
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    });
}

function ensurePlaceholderRemoveButton(placeholderEl, removeFn, labelText) {
    const controls = placeholderEl.querySelector('.media-header-controls');
    if (!controls) {
        return;
    }

    if (controls.querySelector('.placeholder-remove-btn')) {
        return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'media-header-btn image-control placeholder-remove-btn';
    button.title = labelText;
    button.setAttribute('aria-label', labelText);
    button.textContent = '🗑️';
    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        removeFn();
    });

    controls.appendChild(button);
}

// Aspect ratio helpers
const CANVAS_ASPECT_SIZES = {
    '1:1': [300, 300],
    '2:3': [250, 375],
    '3:2': [375, 250],
    '3:4': [259, 356],
    '4:3': [356, 259],
    '4:5': [269, 346],
    '5:4': [346, 269],
    '9:16': [231, 403],
    '16:9': [403, 231],
    '21:9': [461, 201]
};

const ASPECT_RATIO_VALUES = {
    '1:1': 1,
    '2:3': 2 / 3,
    '3:2': 3 / 2,
    '3:4': 3 / 4,
    '4:3': 4 / 3,
    '4:5': 4 / 5,
    '5:4': 5 / 4,
    '9:16': 9 / 16,
    '16:9': 16 / 9,
    '21:9': 21 / 9
};

const DEFAULT_NOTE_WIDTH = 280;
const DEFAULT_NOTE_HEIGHT = 180;
const NOTE_MIN_WIDTH = 180;
const NOTE_MIN_HEIGHT = 120;

function formatImageRef(id) {
    return `${IMAGE_REFERENCE_PREFIX}${id}`;
}

function formatVideoRef(id) {
    return `${VIDEO_REFERENCE_PREFIX}${id}`;
}

function formatNoteRef(id) {
    return `${NOTE_REFERENCE_PREFIX}${id}`;
}

function extractPrefixedIds(text, regex) {
    if (typeof text !== 'string' || text.length === 0) {
        return [];
    }

    const result = new Set();
    const pattern = new RegExp(regex.source, regex.flags);
    for (const match of text.matchAll(pattern)) {
        const captured = match[1];
        const id = parseInt(captured, 10);
        if (Number.isFinite(id)) {
            result.add(id);
        }
    }
    return Array.from(result);
}

function extractImageReferencesWithModifiers(text) {
    if (typeof text !== 'string' || text.length === 0) {
        return [];
    }

    const SUPPORTED_MODIFIERS = ['base', 'style'];
    const result = [];
    const seen = new Set();
    const pattern = new RegExp(IMAGE_REFERENCE_REGEX.source, IMAGE_REFERENCE_REGEX.flags);

    for (const match of text.matchAll(pattern)) {
        const id = parseInt(match[1], 10);
        const rawModifier = match[2]; // Captures the optional :modifier part
        const modifier = rawModifier ? rawModifier.toLowerCase() : null;

        if (Number.isFinite(id)) {
            // Validate modifier
            if (modifier && !SUPPORTED_MODIFIERS.includes(modifier)) {
                console.warn(`[Canvas] Unsupported modifier ':${modifier}' on @i${id}. Supported modifiers: ${SUPPORTED_MODIFIERS.join(', ')}`);
            }

            const key = `${id}:${modifier || ''}`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push({
                    id,
                    modifier: modifier && SUPPORTED_MODIFIERS.includes(modifier) ? modifier : null
                });
            }
        }
    }

    return result;
}

function getReferenceLabelForItem(item) {
    if (!item || typeof item.id !== 'number') {
        return null;
    }

    switch (item.type) {
        case 'video':
            return formatVideoRef(item.id);
        case 'note':
            return formatNoteRef(item.id);
        case 'image':
        default:
            return formatImageRef(item.id);
    }
}

function attachCanvasImageEvents(element, imageObj) {
    element.addEventListener('mousedown', (e) => {
        // Allow control buttons to work
        if (e.target.closest('.image-control')) {
            e.stopPropagation();
            return;
        }
        
        // Prefer dragging from header, but allow image area as fallback
        const header = e.target.closest('.media-header');
        const imgTag = e.target.tagName === 'IMG';
        
        // If clicking on the actual image and not the header, allow selection/drag
        if (!header && !imgTag) {
            return;
        }
        
        e.stopPropagation();
        const isSelected = selectImage(imageObj, {
            additive: e.shiftKey,
            toggle: true
        });

        const activeSelection = getSelectedImages();
        if (!isSelected || activeSelection.length === 0) {
            draggedSelection = null;
            dragMoved = false;
            return;
        }

        const pointer = clientToWorld(e.clientX, e.clientY);
        draggedSelection = {
            items: activeSelection.map(img => ({
                image: img,
                offsetX: pointer.x - img.x,
                offsetY: pointer.y - img.y
            }))
        };
        dragMoved = false;
    });

    element.addEventListener('mouseenter', (e) => showImageTooltip(e, imageObj));
    element.addEventListener('mouseleave', hideImageTooltip);
}

function isTypingTarget(element = document.activeElement) {
    return element && (
        element.tagName === 'INPUT' ||
        element.tagName === 'TEXTAREA' ||
        element.isContentEditable
    );
}

const WHEEL_LINE_HEIGHT = 16;

function normalizeWheelDelta(delta, deltaMode, axis = 'y') {
    if (!Number.isFinite(delta)) {
        return 0;
    }

    switch (deltaMode) {
        case 1: // WheelEvent.DOM_DELTA_LINE
            return delta * WHEEL_LINE_HEIGHT;
        case 2: { // WheelEvent.DOM_DELTA_PAGE
            const reference = axis === 'x' ? canvasArea.clientWidth : canvasArea.clientHeight;
            return delta * (reference || 1);
        }
        default:
            return delta;
    }
}

function isPinchGesture(event) {
    return event.ctrlKey || event.metaKey || Math.abs(event.deltaZ) > 0;
}

// Canvas Pan & Zoom
canvasArea.addEventListener('wheel', (e) => {
    const pinch = isPinchGesture(e);
    const isNoteContent = e.target.closest('.note-content');

    if (isNoteContent && !pinch) {
        // If scrolling on a note-content element, only prevent default if it's horizontal scroll
        // This allows vertical scrolling within the note
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            e.preventDefault();
        }
        // If it's vertical scroll, let the default behavior (scrolling the note) happen
        return;
    }

    e.preventDefault();

    if (pinch) {
        const rect = canvasArea.getBoundingClientRect();
        const pivot = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        const deltaY = normalizeWheelDelta(e.deltaY, e.deltaMode);
        const zoomIntensity = (e.ctrlKey || e.metaKey) ? 0.0035 : 0.002;
        const zoomFactor = Math.exp(-deltaY * zoomIntensity);
        const targetZoom = canvasState.zoom * zoomFactor;

        const changed = setZoomLevel(targetZoom, { pivot, commit: false });
        if (changed) {
            scheduleViewportCommit();
        }
        return;
    }

    const deltaX = normalizeWheelDelta(e.deltaX, e.deltaMode, 'x');
    const deltaY = normalizeWheelDelta(e.deltaY, e.deltaMode, 'y');

    if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) {
        return;
    }

    canvasState.offsetX -= deltaX;
    canvasState.offsetY -= deltaY;

    updateCanvas();
    scheduleViewportCommit();
});

let isPanning = false;
let panStartX, panStartY;

canvasArea.addEventListener('mousedown', (e) => {
    trackCanvasPointer(e);
    if (e.target !== canvasArea && e.target !== canvas) {
        return;
    }

    // Middle/right click or pan mode always pans
    const wantsPan = isSpaceKeyDown || isPanMode || e.button !== 0;

    if (wantsPan) {
        isPanning = true;
        panStartX = e.clientX - canvasState.offsetX;
        panStartY = e.clientY - canvasState.offsetY;
        canvasArea.classList.add('panning');
        panMoved = false;
        return;
    }

    // Start marquee selection when clicking blank canvas
    isSelecting = true;
    selectionAdditive = e.shiftKey;
    selectionInitialSet = new Set(selectedImages);

    if (!selectionAdditive) {
        clearSelection({ skipUpdate: true });
    }

    const rect = canvasArea.getBoundingClientRect();
    selectionStartScreen = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };

    selectionMarquee = document.createElement('div');
    selectionMarquee.className = 'selection-marquee';
    canvasArea.appendChild(selectionMarquee);
    canvasArea.classList.add('selecting');
    updateSelectionMarquee(selectionStartScreen, selectionStartScreen);
});

canvasArea.addEventListener('mousemove', trackCanvasPointer);
canvasArea.addEventListener('mouseenter', trackCanvasPointer);
canvasArea.addEventListener('pointermove', trackCanvasPointer);
canvasArea.addEventListener('pointerdown', trackCanvasPointer);

document.addEventListener('mousemove', (e) => {
    trackCanvasPointer(e);
    if (isPanning) {
        canvasState.offsetX = e.clientX - panStartX;
        canvasState.offsetY = e.clientY - panStartY;
        updateCanvas();
        panMoved = true;
    }

    if (isSelecting) {
        const rect = canvasArea.getBoundingClientRect();
        const currentScreen = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        updateSelectionMarquee(selectionStartScreen, currentScreen);

        const selectionBounds = {
            minX: Math.min(selectionStartScreen.x, currentScreen.x),
            maxX: Math.max(selectionStartScreen.x, currentScreen.x),
            minY: Math.min(selectionStartScreen.y, currentScreen.y),
            maxY: Math.max(selectionStartScreen.y, currentScreen.y)
        };

        const baseSet = selectionAdditive ? new Set(selectionInitialSet) : new Set();
        addItemsWithinSelectionBounds(baseSet, selectionBounds);

        applySelectionSet(baseSet, { skipUpdate: true });
        updateCanvasIdsList({ refreshCounts: false });
        updateDeleteButtonState();
    }
});

function scheduleCanvasRender() {
    pendingTransformState = {
        offsetX: canvasState.offsetX,
        offsetY: canvasState.offsetY,
        zoom: canvasState.zoom
    };

    if (transformFrameHandle !== null) {
        return;
    }

    transformFrameHandle = scheduleFrame(() => {
        transformFrameHandle = null;
        if (!pendingTransformState) {
            return;
        }

        const { offsetX, offsetY, zoom } = pendingTransformState;
        pendingTransformState = null;
        canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
    });
}

function scheduleCanvasHudUpdate(options = {}) {
    const { refreshCounts = false } = options;

    if (refreshCounts) {
        canvasCounts.images = canvasState.images.length;
        canvasCounts.videos = canvasState.videos.length;
        canvasCounts.notes = canvasState.notes.length;
    }

    if (hudFrameHandle !== null) {
        return;
    }

    hudFrameHandle = scheduleFrame(() => {
        hudFrameHandle = null;
        if (!canvasStatsElement) {
            return;
        }

        const parts = [];
        if (canvasCounts.images > 0) parts.push(`Images: ${canvasCounts.images}`);
        if (canvasCounts.videos > 0) parts.push(`Videos: ${canvasCounts.videos}`);
        if (canvasCounts.notes > 0) parts.push(`Notes: ${canvasCounts.notes}`);
        const itemsText = parts.length > 0 ? parts.join(' | ') : 'Empty canvas';
        const nextText = `${itemsText} | Zoom: ${Math.round(canvasState.zoom * 100)}% | Position: (${Math.round(canvasState.offsetX)}, ${Math.round(canvasState.offsetY)})`;

        if (nextText !== lastHudText) {
            canvasStatsElement.textContent = nextText;
            lastHudText = nextText;
        }
    });
}

function updateCanvas() {
    scheduleCanvasRender();
    scheduleCanvasHudUpdate();
}

function queueCanvasInventoryUpdate() {
    if (inventoryFrameHandle !== null) {
        return;
    }

    inventoryFrameHandle = scheduleFrame(() => {
        inventoryFrameHandle = null;
        renderCanvasInventory({ refreshCounts: true });
    });
}

function updateCanvasStats() {
    scheduleCanvasHudUpdate({ refreshCounts: true });
    queueCanvasInventoryUpdate();
}

function updateCanvasCountsDisplay(nextCounts) {
    ['images', 'videos', 'audios', 'notes'].forEach((key) => {
        const count = nextCounts[key];
        const countElement = canvasCountElements[key];
        if (countElement) {
            const nextText = String(count);
            if (countElement.textContent !== nextText) {
                countElement.textContent = nextText;
            }
            countElement.classList.toggle('is-empty', count === 0);
        }

        const accordion = canvasAccordionElements[key];
        if (accordion) {
            const isEmpty = count === 0;
            accordion.classList.toggle('is-empty', isEmpty);
            if (isEmpty && accordion.open) {
                accordion.open = false;
            }
        }
    });
}

function renderCanvasInventory(options = {}) {
    const { refreshCounts = false } = options;

    if (refreshCounts) {
        const nextCounts = {
            images: canvasState.images.length,
            videos: canvasState.videos.length,
            audios: canvasState.audios.length,
            notes: canvasState.notes.length
        };
        updateCanvasCountsDisplay(nextCounts);
        canvasCounts.images = nextCounts.images;
        canvasCounts.videos = nextCounts.videos;
        canvasCounts.audios = nextCounts.audios;
        canvasCounts.notes = nextCounts.notes;
    }

    renderIdBadgeList({
        element: canvasImageIdsList,
        items: canvasState.images,
        formatRef: formatImageRef,
        clickHandler: 'selectImageById',
        emptyText: 'No images yet'
    });

    renderIdBadgeList({
        element: canvasVideoIdsList,
        items: canvasState.videos,
        formatRef: formatVideoRef,
        clickHandler: 'selectVideoById',
        emptyText: 'No videos yet'
    });

    renderIdBadgeList({
        element: canvasAudioIdsList,
        items: canvasState.audios,
        formatRef: formatAudioRef,
        clickHandler: 'selectAudioById',
        emptyText: 'No audio yet'
    });

    renderIdBadgeList({
        element: canvasNoteIdsList,
        items: canvasState.notes,
        formatRef: formatNoteRef,
        clickHandler: 'selectNoteById',
        emptyText: 'No notes yet'
    });
}

function updateCanvasIdsList(options = {}) {
    const { refreshCounts = false } = options;

    if (refreshCounts) {
        scheduleCanvasHudUpdate({ refreshCounts: true });
    }

    renderCanvasInventory({ refreshCounts });
}

function renderIdBadgeList({ element, items, formatRef, clickHandler, emptyText }) {
    if (!element) {
        return;
    }

    let markup = '';

    if (!Array.isArray(items) || items.length === 0) {
        markup = `<span class="canvas-ids-empty">${emptyText}</span>`;
    } else {
        const sortedItems = [...items].sort((a, b) => a.id - b.id);
        markup = sortedItems
            .map(item => {
                const label = formatRef(item.id);
                const isSelected = selectedImages.has(item);
                return `<span class="canvas-id-badge ${isSelected ? 'selected' : ''}" onclick="${clickHandler}(event, ${item.id})" title="Click to select">${label}</span>`;
            })
            .join('');
    }

    const previousMarkup = listMarkupCache.get(element);
    if (previousMarkup === markup) {
        return;
    }

    element.innerHTML = markup;
    listMarkupCache.set(element, markup);
}

function selectImageById(event, id) {
    if (typeof id === 'undefined') {
        id = event;
        event = undefined;
    }

    const imageObj = canvasState.images.find(img => img.id === id);
    if (!imageObj) return;

    selectImage(imageObj, {
        additive: !!(event && event.shiftKey),
        toggle: true
    });
}

function selectVideoById(event, id) {
    if (typeof id === 'undefined') {
        id = event;
        event = undefined;
    }

    const videoObj = canvasState.videos.find(video => video.id === id);
    if (!videoObj) return;

    selectVideo(videoObj, {
        additive: !!(event && event.shiftKey),
        toggle: true
    });
}

function selectNoteById(event, id) {
    if (typeof id === 'undefined') {
        id = event;
        event = undefined;
    }

    const noteObj = canvasState.notes.find(note => note.id === id);
    if (!noteObj) return;

    selectNote(noteObj, {
        additive: !!(event && event.shiftKey),
        toggle: true
    });
}

function selectAudioById(event, id) {
    if (typeof id === 'undefined') {
        id = event;
        event = undefined;
    }

    const audioObj = canvasState.audios.find(audio => audio.id === id);
    if (!audioObj) return;

    selectAudio(audioObj, {
        additive: !!(event && event.shiftKey),
        toggle: true
    });
}

/**
 * Add a placeholder for image generation
 * @param {number} requestId - Request tracking ID
 * @param {string} prompt - Generation prompt
 * @param {string} aspectRatio - Aspect ratio
 * @param {Array} referenceIds - Array of referenced image IDs
 * @returns {Object} Placeholder object with element and update functions
 */
function addImagePlaceholder(requestId, prompt, aspectRatio = '9:16', referenceIds = []) {
    const placeholderEl = document.createElement('div');
    placeholderEl.className = 'canvas-placeholder';
    placeholderEl.dataset.requestId = requestId;

    const [width, height] = getCanvasSizeFromAspectRatio(aspectRatio);

    const placement = acquireGenerationPlacement(width, height, requestId, referenceIds);
    const { position, index } = placement;

    if (typeof index === 'number') {
        placeholderEl.dataset.generationIndex = index;
    }

    placeholderEl.style.left = `${position.x}px`;
    placeholderEl.style.top = `${position.y}px`;
    placeholderEl.style.width = `${width}px`;
    placeholderEl.style.height = `${height}px`;

    const headerLabel = requestId
        ? `${requestLabel(requestId)}${typeof index === 'number' ? ` · Image ${index + 1}` : ''}`
        : 'Generating Image';

    placeholderEl.innerHTML = `
        <div class="media-header placeholder-header">
            <div class="media-header-drag-handle">⠿</div>
            <div class="media-header-id">${headerLabel}</div>
            <div class="media-header-controls"></div>
        </div>
        <div class="placeholder-body">
            <div class="placeholder-spinner"></div>
            <div class="placeholder-text">Generating Image...</div>
            <div class="placeholder-progress"></div>
            <div class="placeholder-prompt">${prompt}</div>
        </div>
    `;

    canvas.appendChild(placeholderEl);

    const state = { x: position.x, y: position.y };
    makePlaceholderDraggable(placeholderEl, state, {
        requestId,
        index,
        width
    });

    lastGeneratedPosition = { x: position.x, y: position.y };

    const removePlaceholder = () => {
        if (placeholderEl.parentNode) {
            placeholderEl.parentNode.removeChild(placeholderEl);
        }
    };

    return {
        element: placeholderEl,
        get x() {
            return state.x;
        },
        get y() {
            return state.y;
        },
        updateProgress: (progress) => {
            const progressEl = placeholderEl.querySelector('.placeholder-progress');
            if (progressEl) {
                progressEl.textContent = `${progress}%`;
            }
        },
        showError: (errorMsg) => {
            placeholderEl.classList.add('error');
            const body = placeholderEl.querySelector('.placeholder-body');
            if (body) {
                body.innerHTML = `
                    <div class="placeholder-error-icon">⚠️</div>
                    <div class="placeholder-error-text">Generation Failed</div>
                    <div class="placeholder-prompt">${errorMsg}</div>
                `;
            }
            ensurePlaceholderRemoveButton(
                placeholderEl,
                removePlaceholder,
                'Remove failed image placeholder'
            );
        },
        remove: () => {
            removePlaceholder();
        }
    };
}

/**
 * Add a placeholder for video generation
 * @param {number} requestId - Request tracking ID
 * @param {string} prompt - Generation prompt
 * @param {Object} config - Video configuration
 * @returns {Object} Placeholder object with element and update functions
 */
function addVideoPlaceholder(requestId, prompt, config = {}) {
    const placeholderEl = document.createElement('div');
    placeholderEl.className = 'canvas-placeholder';
    placeholderEl.dataset.requestId = requestId;
    placeholderEl.dataset.type = 'video';

    const aspectRatio = config.aspectRatio || '9:16';
    const [width, height] = VIDEO_CANVAS_SIZES[aspectRatio] || [270, 480];
    const referenceIds = config.referenceIds || [];

    const placement = acquireGenerationPlacement(width, height, requestId, referenceIds);
    const { position, index } = placement;

    if (typeof index === 'number') {
        placeholderEl.dataset.generationIndex = index;
    }

    placeholderEl.style.left = `${position.x}px`;
    placeholderEl.style.top = `${position.y}px`;
    placeholderEl.style.width = `${width}px`;
    placeholderEl.style.height = `${height}px`;

    const headerLabel = requestId
        ? `${requestLabel(requestId)}${typeof index === 'number' ? ` · Video ${index + 1}` : ''}`
        : 'Generating Video';

    placeholderEl.innerHTML = `
        <div class="media-header placeholder-header">
            <div class="media-header-drag-handle">⠿</div>
            <div class="media-header-id">${headerLabel}</div>
            <div class="media-header-controls"></div>
        </div>
        <div class="placeholder-body">
            <div class="placeholder-spinner"></div>
            <div class="placeholder-text">Generating Video...</div>
            <div class="placeholder-progress">Queued...</div>
            <div class="placeholder-prompt">${prompt}</div>
        </div>
    `;

    canvas.appendChild(placeholderEl);

    const state = { x: position.x, y: position.y };
    makePlaceholderDraggable(placeholderEl, state, {
        requestId,
        index,
        width
    });

    lastGeneratedPosition = { x: position.x, y: position.y };

    const removePlaceholder = () => {
        if (placeholderEl.parentNode) {
            placeholderEl.parentNode.removeChild(placeholderEl);
        }
    };

    return {
        element: placeholderEl,
        get x() {
            return state.x;
        },
        get y() {
            return state.y;
        },
        updateProgress: (progress, status = 'processing') => {
            const progressEl = placeholderEl.querySelector('.placeholder-progress');
            const textEl = placeholderEl.querySelector('.placeholder-text');
            if (progressEl) {
                if (typeof progress === 'number') {
                    progressEl.textContent = status ? `${status} · ${progress}%` : `${progress}%`;
                } else if (status) {
                    progressEl.textContent = status;
                }
            }
            if (textEl && status === 'finalizing') {
                textEl.textContent = 'Finalizing Video...';
            }
        },
        showError: (errorMsg) => {
            placeholderEl.classList.add('error');
            const body = placeholderEl.querySelector('.placeholder-body');
            if (body) {
                body.innerHTML = `
                    <div class="placeholder-error-icon">⚠️</div>
                    <div class="placeholder-error-text">Video Generation Failed</div>
                    <div class="placeholder-prompt">${errorMsg}</div>
                `;
            }
            ensurePlaceholderRemoveButton(
                placeholderEl,
                removePlaceholder,
                'Remove failed video placeholder'
            );
        },
        remove: () => {
            removePlaceholder();
        }
    };
}

function addImageToCanvas(imageData, mimeType, prompt = 'No prompt', aspectRatio = '9:16', resolution = '768x1344', referenceIds = [], position = null, model = null) {
    const img = document.createElement('div');
    img.className = 'canvas-image with-header';
    const [width, height] = getCanvasSizeFromAspectRatio(aspectRatio);

    const SPACING_X = 40;
    const SPACING_Y = 40;
    const MAX_ROW_WIDTH = 1600;

    let nextX, nextY;

    // Use provided position if available (from placeholder)
    if (position && position.x !== undefined && position.y !== undefined) {
        if (position.align === 'center') {
            nextX = position.x - (width / 2);
            nextY = position.y - (height / 2);
        } else {
            nextX = position.x;
            nextY = position.y;
        }
    } else {
        // Calculate next position using layout logic
        nextX = lastGeneratedPosition.x;
        nextY = lastGeneratedPosition.y;
        if (canvasState.images.length === 0) {
            nextX = 50;
            nextY = 50;
        } else {
            nextX = lastGeneratedPosition.x + width + SPACING_X;
            nextY = lastGeneratedPosition.y;

            if (nextX > MAX_ROW_WIDTH) {
                nextX = 50;
                nextY = lastGeneratedPosition.y + height + SPACING_Y;
            }
        }
    }

    img.style.left = `${nextX}px`;
    img.style.top = `${nextY}px`;
    
    // Set width/height based on aspect ratio
    img.style.width = `${width}px`;
    img.style.height = `${height}px`;

    const currentId = imageCounter++;
    const imageLabel = formatImageRef(currentId);
    img.innerHTML = `
        <div class="media-header">
            <div class="media-header-drag-handle">⠿</div>
            <div class="media-header-id">${imageLabel}</div>
            <div class="media-header-controls">
                <button class="media-header-btn image-control" title="Regenerate image" aria-label="Regenerate image ${imageLabel}" onclick="regenerateImage(event, ${currentId})">♻️</button>
                <button class="media-header-btn image-control" title="Copy prompt" aria-label="Copy prompt ${imageLabel}" onclick="copyImagePrompt(event, ${currentId})">💬</button>
                <button class="media-header-btn image-control" title="Copy image" aria-label="Copy image ${imageLabel}" onclick="copyImage(event, ${currentId})">📋</button>
                <button class="media-header-btn image-control" title="Download image" aria-label="Download image ${imageLabel}" onclick="downloadImage(event, ${currentId})">⬇️</button>
            </div>
        </div>
        <img src="data:${mimeType};base64,${imageData}" alt="Image ${imageLabel}">
    `;

    const imageObj = {
        id: currentId,
        type: 'image',
        element: img,
        x: Number(img.style.left.replace('px', '')),
        y: Number(img.style.top.replace('px', '')),
        width,
        height,
        data: imageData,
        mimeType: mimeType,
        prompt: prompt,
        aspectRatio: aspectRatio,
        resolution: resolution,
        referenceIds: referenceIds || [],
        model: model
    };

    canvasState.images.push(imageObj);
    canvas.appendChild(img);

    lastGeneratedPosition = {
        x: imageObj.x,
        y: imageObj.y
    };

    attachCanvasImageEvents(img, imageObj);

    updateCanvasStats();
    commitHistorySnapshot();
    debouncedSave({ immediate: true });
    return imageObj;
}

function downloadImage(event, id) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const imageObj = canvasState.images.find(img => img.id === id);
    if (!imageObj) return;

    const extension = getFileExtension(imageObj.mimeType);
    const link = document.createElement('a');
    link.href = `data:${imageObj.mimeType};base64,${imageObj.data}`;
    link.download = `canvas-agent-image-${id}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function copyImage(event, id) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const imageObj = canvasState.images.find(img => img.id === id);
    if (!imageObj) return;

    try {
        // Check if clipboard API is available
        if (!navigator.clipboard || !navigator.clipboard.write) {
            addChatMessage('⚠️ Clipboard API not supported in this browser', 'system');
            return;
        }

        // Convert base64 to blob
        const base64Data = imageObj.data;
        const mimeType = imageObj.mimeType;

        // Decode base64 to binary
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        // Convert to PNG if needed (Clipboard API only supports PNG)
        let pngBlob;
        if (mimeType !== 'image/png') {
            // Load image into Image element
            const img = new Image();
            const url = URL.createObjectURL(blob);
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            });

            // Draw to canvas and convert to PNG
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            // Convert canvas to PNG blob
            pngBlob = await new Promise((resolve, reject) => {
                canvas.toBlob(resolve, 'image/png');
            });

            URL.revokeObjectURL(url);
        } else {
            pngBlob = blob;
        }

        // Create clipboard item with PNG
        const clipboardItem = new ClipboardItem({
            'image/png': pngBlob
        });

        // Copy to clipboard
        await navigator.clipboard.write([clipboardItem]);

        const imageLabel = formatImageRef(id);
        addChatMessage(`✓ Image ${imageLabel} copied to clipboard`, 'system');
    } catch (error) {
        console.error('Failed to copy image:', error);
        addChatMessage(`⚠️ Failed to copy image: ${error.message}`, 'system');
    }
}

async function copyImagePrompt(event, id) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const imageObj = canvasState.images.find(img => img.id === id);
    if (!imageObj) {
        addChatMessage('⚠️ Image not found', 'system');
        return;
    }

    try {
        // Check if clipboard API is available
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            addChatMessage('⚠️ Clipboard API not supported in this browser', 'system');
            return;
        }

        const prompt = imageObj.prompt || '';
        if (!prompt) {
            addChatMessage('⚠️ No prompt available for this image', 'system');
            return;
        }

        // Copy prompt text to clipboard
        await navigator.clipboard.writeText(prompt);

        const imageLabel = formatImageRef(id);
        addChatMessage(`✓ Prompt for ${imageLabel} copied to clipboard`, 'system');
    } catch (error) {
        console.error('Failed to copy prompt:', error);
        addChatMessage(`⚠️ Failed to copy prompt: ${error.message}`, 'system');
    }
}

async function regenerateImage(event, id) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const apiKey = document.getElementById('apiKey').value.trim();

    const imageObj = canvasState.images.find(img => img.id === id);
    if (!imageObj) {
        addChatMessage(`⚠️ Image ${formatImageRef(id)} not found on canvas.`, 'system');
        return;
    }

    const requestId = ++requestSequence;
    startRequestStatus(requestId, `Queued — regenerating ${formatImageRef(id)}`);

    const aspectRatio = imageObj.aspectRatio || '1:1';
    const referenceIds = Array.isArray(imageObj.referenceIds) ? [...imageObj.referenceIds] : [];

    addRequestLog(
        requestId,
        '♻️',
        `Regenerating image ${formatImageRef(id)}${referenceIds.length ? ` (references: ${referenceIds.map(ref => formatImageRef(ref)).join(', ')})` : ''}.`
    );

    try {
        updateRequestStatus(requestId, 'running', 'Preparing request...');

        const sourceImages = [];
        const effectiveReferenceIds = [];
        const missingReferenceIds = [];

        referenceIds.forEach(refId => {
            const refImage = canvasState.images.find(img => img.id === refId);
            if (refImage) {
                effectiveReferenceIds.push(refId);
                sourceImages.push({
                    data: refImage.data,
                    mimeType: refImage.mimeType
                });
            } else {
                missingReferenceIds.push(refId);
            }
        });

        if (missingReferenceIds.length > 0) {
            addRequestLog(
                requestId,
                '⚠️',
                `Missing reference image(s): ${missingReferenceIds.map(ref => formatImageRef(ref)).join(', ')}. Continuing without them.`
            );
        }

        if (effectiveReferenceIds.length > 0) {
            addRequestLog(
                requestId,
                '🖇️',
                `Using references: ${effectiveReferenceIds.map(ref => formatImageRef(ref)).join(', ')}`
            );
        }

        if (imageObj.prompt) {
            addRequestLog(
                requestId,
                '📝',
                `Prompt: "${imageObj.prompt}"`
            );
        }

        updateRequestStatus(requestId, 'running', 'Calling Gemini image API');

        const generatedImage = await generateSingleImage(
            apiKey,
            requestId,
            imageObj.prompt || 'Regenerated image',
            1,
            1,
            sourceImages.length > 0 && effectiveReferenceIds.length > 0 ? sourceImages : null,
            aspectRatio,
            effectiveReferenceIds
        );

        if (generatedImage) {
            addRequestLog(
                requestId,
                '✅',
                `Regenerated image added as ${formatImageRef(generatedImage.id)}.`
            );
            updateRequestStatus(requestId, 'success', 'Regeneration complete');
        } else {
            addRequestLog(requestId, '❌', 'Regeneration failed.');
            updateRequestStatus(requestId, 'error', 'Regeneration failed');
        }
    } catch (error) {
        console.error('Error regenerating image:', error);
        updateRequestStatus(requestId, 'error', error.message || 'Regeneration failed');
        showError(error.message || 'Failed to regenerate image.');
        addChatMessage(
            `❌ ${requestLabel(requestId)} — ${error.message || 'Failed to regenerate image.'}`,
            'assistant',
            { requestId }
        );
    } finally {
        completeRequestStatus(requestId);
    }
}

function getFileExtension(mimeType = '', fallback = 'png') {
    if (typeof mimeType !== 'string' || mimeType.length === 0) {
        return fallback;
    }

    const parts = mimeType.split('/');
    if (parts.length !== 2) {
        return fallback;
    }

    const subtype = parts[1].split(';')[0].trim().toLowerCase();
    if (!subtype) {
        return fallback;
    }

    if (subtype === 'jpeg') {
        return 'jpg';
    }

    return subtype;
}

function getCanvasSizeFromAspectRatio(aspectRatio) {
    return CANVAS_ASPECT_SIZES[aspectRatio] || [300, 300];
}

function getClosestAspectRatioLabel(width, height) {
    if (!width || !height) return '1:1';
    const ratio = width / height;
    let closest = '1:1';
    let smallestDiff = Infinity;

    Object.entries(ASPECT_RATIO_VALUES).forEach(([label, value]) => {
        const diff = Math.abs(ratio - value);
        if (diff < smallestDiff) {
            smallestDiff = diff;
            closest = label;
        }
    });

    return closest;
}

function expandTimestampInput(value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }
        // Split on commas or whitespace while keeping timecode patterns intact
        return trimmed.split(/[\s,]+/).filter(Boolean);
    }
    if (value === undefined || value === null) {
        return [];
    }
    return [value];
}

function parseFlexibleTimeToSeconds(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
        return null;
    }

    if (/^\d+(?:\.\d+)?s$/.test(trimmed)) {
        return parseFloat(trimmed.replace('s', ''));
    }

    const hmsMatch = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/);
    if (hmsMatch && (hmsMatch[1] || hmsMatch[2] || hmsMatch[3])) {
        const hours = parseInt(hmsMatch[1] || '0', 10);
        const minutes = parseInt(hmsMatch[2] || '0', 10);
        const seconds = parseFloat(hmsMatch[3] || '0');
        return (hours * 3600) + (minutes * 60) + seconds;
    }

    if (trimmed.includes(':')) {
        const segments = trimmed.split(':');
        if (segments.every(seg => seg !== '' && !Number.isNaN(Number(seg)))) {
            let multiplier = 1;
            let total = 0;
            for (let i = segments.length - 1; i >= 0; i--) {
                total += parseFloat(segments[i]) * multiplier;
                multiplier *= 60;
            }
            return total;
        }
    }

    const numeric = parseFloat(trimmed.replace(/[^0-9.]+/g, ''));
    return Number.isNaN(numeric) ? null : numeric;
}

function collectTimestampsFromSources(sources = []) {
    const collected = [];
    sources.forEach((source) => {
        expandTimestampInput(source).forEach((item) => {
            const seconds = parseFlexibleTimeToSeconds(item);
            if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0) {
                collected.push(seconds);
            }
        });
    });

    const unique = Array.from(new Set(collected.map((value) => Math.round(value * 1000))));
    return unique
        .map((value) => value / 1000)
        .sort((a, b) => a - b);
}

function formatSecondsForDisplay(seconds) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
        return '0s';
    }

    const clamped = Math.max(0, seconds);
    const hasFraction = Math.abs(clamped - Math.round(clamped)) > 0.05;
    const integerPart = Math.floor(clamped);
    const fractionalPart = clamped - integerPart;
    const hours = Math.floor(integerPart / 3600);
    const minutes = Math.floor((integerPart % 3600) / 60);
    const secondsPart = integerPart % 60;

    const secondsString = hasFraction
        ? (secondsPart + Math.round(fractionalPart * 10) / 10).toFixed(1)
        : String(secondsPart).padStart(minutes > 0 || hours > 0 ? 2 : 1, '0');

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${secondsString}s`;
    }

    if (minutes > 0) {
        return `${minutes}:${String(secondsString).padStart(2, '0')}s`;
    }

    return `${secondsString}s`;
}

function clampTimestampToDuration(time, duration) {
    if (typeof time !== 'number' || !Number.isFinite(time)) {
        return 0;
    }

    const safeTime = Math.max(0, time);
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
        return safeTime;
    }

    const epsilon = duration > 1 ? 0.05 : Math.min(0.05, duration * 0.25);
    const upperBound = Math.max(duration - epsilon, 0);
    return Math.min(safeTime, upperBound);
}

function resolveVideoSourceForExtraction(videoObj) {
    if (!videoObj) {
        return null;
    }

    if (videoObj.sourceType === 'youtube') {
        return null;
    }

    if (videoObj.data) {
        const mime = videoObj.mimeType || 'video/mp4';
        return `data:${mime};base64,${videoObj.data}`;
    }

    if (videoObj.sourceUrl) {
        return videoObj.sourceUrl;
    }

    return null;
}

function waitForVideoMetadata(videoElement, src) {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            videoElement.removeEventListener('loadedmetadata', handleLoaded);
            videoElement.removeEventListener('error', handleError);
        };

        const handleLoaded = () => {
            cleanup();
            resolve({
                duration: typeof videoElement.duration === 'number' && Number.isFinite(videoElement.duration)
                    ? videoElement.duration
                    : null,
                width: videoElement.videoWidth,
                height: videoElement.videoHeight
            });
        };

        const handleError = () => {
            cleanup();
            reject(new Error('Unable to load video for frame extraction.'));
        };

        videoElement.addEventListener('loadedmetadata', handleLoaded, { once: true });
        videoElement.addEventListener('error', handleError, { once: true });

        videoElement.src = src;
        videoElement.load();
    });
}

function waitForVideoFrame(videoElement) {
    if (videoElement.readyState >= 2) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const cleanup = () => {
            videoElement.removeEventListener('loadeddata', handleLoadedData);
            videoElement.removeEventListener('error', handleError);
        };

        const handleLoadedData = () => {
            cleanup();
            resolve();
        };

        const handleError = () => {
            cleanup();
            reject(new Error('Unable to load video frame.'));
        };

        videoElement.addEventListener('loadeddata', handleLoadedData, { once: true });
        videoElement.addEventListener('error', handleError, { once: true });
    });
}

async function seekVideoElement(videoElement, time) {
    const target = Math.max(0, time);
    await new Promise((resolve, reject) => {
        const cleanup = () => {
            videoElement.removeEventListener('seeked', handleSeeked);
            videoElement.removeEventListener('error', handleError);
        };

        const handleSeeked = () => {
            cleanup();
            resolve();
        };

        const handleError = () => {
            cleanup();
            reject(new Error('Unable to seek to requested timestamp.'));
        };

        videoElement.addEventListener('seeked', handleSeeked, { once: true });
        videoElement.addEventListener('error', handleError, { once: true });
        videoElement.currentTime = target;
    });

    await waitForVideoFrame(videoElement);
}

async function captureFramesFromVideo(videoObj, timestamps = []) {
    if (!videoObj) {
        throw new Error('Video not provided for frame extraction.');
    }

    const source = resolveVideoSourceForExtraction(videoObj);
    if (!source) {
        throw new Error('Video source is unavailable for frame extraction.');
    }

    const orderedTimestamps = Array.isArray(timestamps) ? timestamps.slice().sort((a, b) => a - b) : [];
    if (orderedTimestamps.length === 0) {
        return { frames: [], duration: null, videoWidth: null, videoHeight: null };
    }

    const videoElement = document.createElement('video');
    videoElement.crossOrigin = 'anonymous';
    videoElement.preload = 'auto';
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.style.position = 'fixed';
    videoElement.style.left = '-9999px';
    videoElement.style.top = '-9999px';

    document.body.appendChild(videoElement);

    try {
        const metadata = await waitForVideoMetadata(videoElement, source);
        const duration = metadata.duration;
        const captureWidth = metadata.width || videoObj.width || 512;
        const captureHeight = metadata.height || videoObj.height || 512;

        if (!captureWidth || !captureHeight) {
            throw new Error('Unable to determine video dimensions for frame extraction.');
        }

        const canvasEl = document.createElement('canvas');
        canvasEl.width = captureWidth;
        canvasEl.height = captureHeight;
        const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            throw new Error('Canvas context unavailable for frame extraction.');
        }

        const frames = [];
        const seenKeys = new Set();

        for (const requested of orderedTimestamps) {
            const effective = clampTimestampToDuration(requested, duration);
            const key = Math.round(effective * 1000);
            if (seenKeys.has(key)) {
                continue;
            }
            seenKeys.add(key);

            await seekVideoElement(videoElement, effective);

            try {
                ctx.drawImage(videoElement, 0, 0, canvasEl.width, canvasEl.height);
            } catch (drawError) {
                throw new Error('Unable to draw video frame. The video might be protected by CORS restrictions.');
            }

            let dataUrl;
            try {
                dataUrl = canvasEl.toDataURL('image/png');
            } catch (encodingError) {
                throw new Error('Unable to capture frame. Try using a locally uploaded video.');
            }

            const base64 = dataUrl.split(',')[1];
            frames.push({
                data: base64,
                width: canvasEl.width,
                height: canvasEl.height,
                timestamp: effective,
                requested: requested
            });
        }

        return {
            frames,
            duration,
            videoWidth: captureWidth,
            videoHeight: captureHeight
        };
    } finally {
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load();
        videoElement.remove();
    }
}

const YOUTUBE_HOSTNAMES = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'www.youtu.be'
]);

function extractYoutubeId(url) {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        if (!YOUTUBE_HOSTNAMES.has(hostname) && !hostname.endsWith('.youtube.com')) {
            return null;
        }

        if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
            return parsed.pathname.slice(1) || null;
        }

        if (parsed.pathname.startsWith('/watch')) {
            return parsed.searchParams.get('v');
        }

        if (parsed.pathname.startsWith('/shorts/')) {
            const parts = parsed.pathname.split('/');
            return parts[2] || null;
        }

        if (parsed.pathname.startsWith('/embed/')) {
            const parts = parsed.pathname.split('/');
            return parts[2] || null;
        }

        return parsed.searchParams.get('v');
    } catch (error) {
        return null;
    }
}

function isYoutubeUrl(url) {
    return !!extractYoutubeId(url);
}

function buildYoutubeEmbedUrl(videoId) {
    return `https://www.youtube.com/embed/${videoId}?rel=0`;
}

function isMp4Url(url) {
    return /\.mp4(\?.*)?$/i.test(url);
}

function isLikelyVideoUrl(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return true;
    return /\.(mp4|mov|webm|mkv|avi|m4v)(\?.*)?$/i.test(lower);
}

function isUnsupportedVideoUrl(url) {
    return isLikelyVideoUrl(url) && !isYoutubeUrl(url) && !isMp4Url(url);
}

function extractVideoUrlsFromText(text) {
    if (typeof text !== 'string' || text.trim().length === 0) {
        return [];
    }

    const urlPattern = /https?:\/\/[^\s)]+/gi;
    const rawMatches = text.match(urlPattern) || [];

    const sanitize = (url) => url.replace(/[),.;!?]+$/, '');
    const supportedExtensions = /\.(mp4|webm|mov|avi|mpe?g|3gpp|wmv)(\?.*)?$/i;

    const filtered = rawMatches
        .map(sanitize)
        .filter((url) => {
            if (isYoutubeUrl(url) || isMp4Url(url)) {
                return true;
            }
            return supportedExtensions.test(url);
        });

    const unique = [];
    filtered.forEach((url) => {
        if (!unique.includes(url)) {
            unique.push(url);
        }
    });

    return unique;
}

function formatUrlForChat(url) {
    if (!url) return '';
    const trimmed = url.trim();
    return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
}

function normalizeVideoDimensions(width, height) {
    if (!width || !height) return null;
    const maxWidth = 480;
    const maxHeight = 480;
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    return {
        width: Math.round(width * scale),
        height: Math.round(height * scale)
    };
}

function toDurationSeconds(rawDuration) {
    if (typeof rawDuration !== 'number' || !Number.isFinite(rawDuration) || rawDuration <= 0) {
        return null;
    }
    return Math.round(rawDuration * 10) / 10;
}

function probeVideoMetadata(src) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';

        const cleanup = () => {
            video.removeAttribute('src');
            video.load();
        };

        const handleLoaded = () => {
            resolve({
                width: video.videoWidth,
                height: video.videoHeight,
                duration: toDurationSeconds(video.duration)
            });
            cleanup();
        };

        const handleError = () => {
            resolve(null);
            cleanup();
        };

        video.addEventListener('loadedmetadata', handleLoaded, { once: true });
        video.addEventListener('error', handleError, { once: true });

        video.src = src;
    });
}

function probeVideoMetadataWithTimeout(src, timeoutMs = 2000) {
    return Promise.race([
        probeVideoMetadata(src),
        new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))
    ]);
}

function findVideoUrlInDocument(doc) {
    if (!doc) return null;

    const iframe = doc.querySelector('iframe[src]');
    if (iframe) {
        const src = iframe.getAttribute('src');
        if (src && (isYoutubeUrl(src) || isMp4Url(src))) {
            return src;
        }
    }

    const videoWithSrc = doc.querySelector('video[src]');
    if (videoWithSrc) {
        const src = videoWithSrc.getAttribute('src');
        if (src && (isYoutubeUrl(src) || isMp4Url(src))) {
            return src;
        }
    }

    const sourceInsideVideo = doc.querySelector('video source[src]');
    if (sourceInsideVideo) {
        const src = sourceInsideVideo.getAttribute('src');
        if (src && (isYoutubeUrl(src) || isMp4Url(src))) {
            return src;
        }
    }

    const anchor = Array.from(doc.querySelectorAll('a[href]')).find((el) => {
        const href = el.getAttribute('href');
        return href && (isYoutubeUrl(href) || isMp4Url(href));
    });
    if (anchor) {
        return anchor.getAttribute('href');
    }

    return null;
}

async function addLinkedVideoToCanvas(url, options = {}) {
    const cleanedUrl = url.trim();
    if (!cleanedUrl) return null;

    if (!options.silent) {
        addChatMessage(`📡 Importing video from ${formatUrlForChat(cleanedUrl)}...`, 'system');
    }

    let metadata = null;
    try {
        metadata = await probeVideoMetadataWithTimeout(cleanedUrl, 2500);
    } catch (error) {
        console.warn('Metadata probe failed for video URL:', cleanedUrl, error);
    }

    const aspectRatio = metadata && metadata.width && metadata.height
        ? getClosestAspectRatioLabel(metadata.width, metadata.height)
        : '16:9';
    const displaySize = metadata ? normalizeVideoDimensions(metadata.width, metadata.height) : null;
    const duration = metadata ? metadata.duration : null;
    const placement = coercePlacementOption(options.position);

    const videoObj = addVideoToCanvas(
        null,
        'video/mp4',
        options.prompt || 'Linked video',
        aspectRatio,
        duration,
        {
            sourceType: 'url',
            sourceUrl: cleanedUrl,
            width: displaySize ? displaySize.width : undefined,
            height: displaySize ? displaySize.height : undefined,
            position: placement
        }
    );

    if (!options.silent) {
        addChatMessage(`🎞️ Linked video added as ${formatVideoRef(videoObj.id)}`, 'system');
    }

    return videoObj;
}

function handleVideoUrlPaste(url, options = {}) {
    if (!url) return false;
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
        return false;
    }

    const youtubeId = extractYoutubeId(trimmed);
    if (youtubeId) {
        const embedUrl = buildYoutubeEmbedUrl(youtubeId);
        const shareUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
        const originalCandidate = options.originalUrl || trimmed;
        const originalUrl = originalCandidate && /\/embed\//.test(originalCandidate)
            ? shareUrl
            : originalCandidate;
        const placement = coercePlacementOption(options.position);

        const videoObj = addVideoToCanvas(
            null,
            'video/youtube',
            options.prompt || 'YouTube video',
            '16:9',
            null,
            {
                sourceType: 'youtube',
                sourceUrl: originalUrl,
                externalId: youtubeId,
                embedUrl,
                position: placement
            }
        );

        if (!options.silent) {
            addChatMessage(`🎬 YouTube video pasted as ${formatVideoRef(videoObj.id)}`, 'system');
        }
        return true;
    }

    if (isMp4Url(trimmed) || options.forceVideo) {
        addLinkedVideoToCanvas(trimmed, options);
        return true;
    }

    return false;
}

function handlePastedVideoFile(file, options = {}) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUrl = e.target.result;
        if (typeof dataUrl !== 'string') {
            console.warn('Unexpected video data URL type');
            return;
        }

        const metadata = await probeVideoMetadata(dataUrl);
        const base64Data = dataUrl.split(',')[1];
        const aspectRatio = metadata && metadata.width && metadata.height
            ? getClosestAspectRatioLabel(metadata.width, metadata.height)
            : '16:9';
        const displaySize = metadata ? normalizeVideoDimensions(metadata.width, metadata.height) : null;
        const duration = metadata ? metadata.duration : null;
        const placement = coercePlacementOption(options.position);

        const videoObj = addVideoToCanvas(
            base64Data,
            file.type || 'video/mp4',
            options.prompt || 'Pasted video',
            aspectRatio,
            duration,
            {
                sourceType: 'data',
                width: displaySize ? displaySize.width : undefined,
                height: displaySize ? displaySize.height : undefined,
                position: placement
            }
        );

        addChatMessage(`📼 Pasted video added as ${formatVideoRef(videoObj.id)}`, 'system');
    };
    reader.onerror = () => {
        console.error('Failed to read pasted video:', reader.error);
        addChatMessage('❌ Failed to read pasted video file.', 'system');
    };
    reader.readAsDataURL(file);
}

function serializeCanvasState() {
    const sortedImages = canvasState.images
        .slice()
        .sort((a, b) => a.id - b.id)
        .map(img => ({
            id: img.id,
            x: img.x,
            y: img.y,
            data: img.data,
            mimeType: img.mimeType,
            prompt: img.prompt,
            aspectRatio: img.aspectRatio,
            resolution: img.resolution,
            referenceIds: img.referenceIds || []
        }));

    const sortedVideos = canvasState.videos
        .slice()
        .sort((a, b) => a.id - b.id)
        .map(vid => ({
            id: vid.id,
            x: vid.x,
            y: vid.y,
            width: vid.width,
            height: vid.height,
            data: vid.data || null,
            mimeType: vid.mimeType,
            prompt: vid.prompt,
            aspectRatio: vid.aspectRatio,
            duration: vid.duration ?? null,
            sourceType: vid.sourceType || (vid.data ? 'data' : 'url'),
            sourceUrl: vid.sourceUrl || null,
            externalId: vid.externalId || null,
            embedUrl: vid.embedUrl || null,
            poster: vid.poster || null
        }));

    const sortedNotes = canvasState.notes
        .slice()
        .sort((a, b) => a.id - b.id)
        .map(note => ({
            id: note.id,
            x: note.x,
            y: note.y,
            width: note.width,
            height: note.height,
            text: note.text
        }));

    return {
        images: sortedImages,
        videos: sortedVideos,
        notes: sortedNotes,
        zoom: canvasState.zoom,
        offsetX: canvasState.offsetX,
        offsetY: canvasState.offsetY,
        imageCounter: imageCounter,
        videoCounter: videoCounter,
        noteCounter: noteCounter
    };
}

function clientToWorld(clientX, clientY) {
    const rect = canvasArea.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    return {
        x: (localX - canvasState.offsetX) / canvasState.zoom,
        y: (localY - canvasState.offsetY) / canvasState.zoom
    };
}

function statesEqual(a, b) {
    if (!a || !b) return false;
    if (a.images.length !== b.images.length) return false;
    if ((a.videos?.length || 0) !== (b.videos?.length || 0)) return false;
    if ((a.notes?.length || 0) !== (b.notes?.length || 0)) return false;
    if (a.zoom !== b.zoom || a.offsetX !== b.offsetX || a.offsetY !== b.offsetY || 
        a.imageCounter !== b.imageCounter || a.videoCounter !== b.videoCounter || a.noteCounter !== b.noteCounter) {
        return false;
    }

    for (let i = 0; i < a.images.length; i++) {
        const imgA = a.images[i];
        const imgB = b.images[i];
        if (
            imgA.id !== imgB.id ||
            imgA.x !== imgB.x ||
            imgA.y !== imgB.y ||
            imgA.data !== imgB.data ||
            imgA.mimeType !== imgB.mimeType ||
            imgA.prompt !== imgB.prompt ||
            imgA.aspectRatio !== imgB.aspectRatio ||
            imgA.resolution !== imgB.resolution ||
            JSON.stringify(imgA.referenceIds || []) !== JSON.stringify(imgB.referenceIds || [])
        ) {
            return false;
        }
    }

    // Compare videos
    const videosA = a.videos || [];
    const videosB = b.videos || [];
    for (let i = 0; i < videosA.length; i++) {
        const vidA = videosA[i];
        const vidB = videosB[i];
        if (
            vidA.id !== vidB.id ||
            vidA.x !== vidB.x ||
            vidA.y !== vidB.y ||
            vidA.width !== vidB.width ||
            vidA.height !== vidB.height ||
            vidA.data !== vidB.data ||
            vidA.mimeType !== vidB.mimeType ||
            vidA.prompt !== vidB.prompt ||
            vidA.aspectRatio !== vidB.aspectRatio ||
            vidA.duration !== vidB.duration ||
            (vidA.sourceType || null) !== (vidB.sourceType || null) ||
            (vidA.sourceUrl || null) !== (vidB.sourceUrl || null) ||
            (vidA.externalId || null) !== (vidB.externalId || null) ||
            (vidA.embedUrl || null) !== (vidB.embedUrl || null) ||
            (vidA.poster || null) !== (vidB.poster || null)
        ) {
            return false;
        }
    }

    // Compare notes
    const notesA = a.notes || [];
    const notesB = b.notes || [];
    for (let i = 0; i < notesA.length; i++) {
        const noteA = notesA[i];
        const noteB = notesB[i];
        if (
            noteA.id !== noteB.id ||
            noteA.x !== noteB.x ||
            noteA.y !== noteB.y ||
            noteA.text !== noteB.text ||
            noteA.width !== noteB.width ||
            noteA.height !== noteB.height
        ) {
            return false;
        }
    }

    return true;
}

function commitHistorySnapshot() {
    if (isApplyingHistory) return;

    const snapshot = serializeCanvasState();

    if (historyStack.length === 0) {
        historyStack.push(snapshot);
        updateHistoryButtons();
        return;
    }

    const lastSnapshot = historyStack[historyStack.length - 1];
    if (statesEqual(lastSnapshot, snapshot)) return;

    historyStack.push(snapshot);
    if (historyStack.length > HISTORY_LIMIT) {
        historyStack.shift();
    }

    futureStack = [];
    updateHistoryButtons();
}

function applyHistorySnapshot(snapshot) {
    if (!snapshot) return;
    isApplyingHistory = true;
    hydrateCanvasFromRecords(snapshot.images || [], snapshot.videos || [], [], snapshot.notes || [], snapshot);
    isApplyingHistory = false;
    debouncedSave({ immediate: true });
    updateHistoryButtons();
    updateDeleteButtonState();
}

function undoAction() {
    if (historyStack.length <= 1) return;
    const current = historyStack.pop();
    futureStack.push(current);
    const previous = historyStack[historyStack.length - 1];
    applyHistorySnapshot(previous);
}

function redoAction() {
    if (futureStack.length === 0) return;
    const next = futureStack.pop();
    historyStack.push(next);
    if (historyStack.length > HISTORY_LIMIT) {
        historyStack.shift();
    }
    applyHistorySnapshot(next);
}

function updateHistoryButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    if (undoBtn) {
        undoBtn.disabled = historyStack.length <= 1;
    }
    if (redoBtn) {
        redoBtn.disabled = futureStack.length === 0;
    }
}

function updateDeleteButtonState() {
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.disabled = selectedImages.size === 0;
    }
}

function initializeHistoryTracking() {
    historyStack = [serializeCanvasState()];
    futureStack = [];
    updateHistoryButtons();
    updateDeleteButtonState();
}

function scheduleViewportCommit() {
    clearTimeout(viewportCommitTimeout);
    viewportCommitTimeout = setTimeout(() => {
        viewportCommitTimeout = null;
        commitHistorySnapshot();
        debouncedSave({ scope: 'viewport' });
    }, 200);
}

let tooltip = null;

function showImageTooltip(e, imageObj) {
    hideImageTooltip();
    
    tooltip = document.createElement('div');
    tooltip.className = 'image-tooltip show';
    
    let referenceInfo = '';
    if (imageObj.referenceIds && imageObj.referenceIds.length > 0) {
        const refLabels = imageObj.referenceIds.map(id => formatImageRef(id)).join(', ');
        referenceInfo = `<div class="tooltip-references">Based on: ${refLabels}</div>`;
    }
    
    let modelInfo = '';
    if (imageObj.model) {
        modelInfo = `Model: ${imageObj.model}<br>`;
    }

    tooltip.innerHTML = `
        <div class="tooltip-title">Image ${formatImageRef(imageObj.id)}</div>
        <div class="tooltip-prompt">"${imageObj.prompt}"</div>
        ${referenceInfo}
        <div class="tooltip-meta">
            ${modelInfo}Resolution: ${imageObj.resolution}<br>
            Aspect Ratio: ${imageObj.aspectRatio}<br>
            Format: ${imageObj.mimeType}
        </div>
    `;
    
    document.body.appendChild(tooltip);
    
    const rect = imageObj.element.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${rect.right + 10}px`;
    tooltip.style.top = `${rect.top}px`;
    
    // Adjust if tooltip goes off screen
    const tooltipRect = tooltip.getBoundingClientRect();
    if (tooltipRect.right > window.innerWidth) {
        tooltip.style.left = `${rect.left - tooltipRect.width - 10}px`;
    }
    if (tooltipRect.bottom > window.innerHeight) {
        tooltip.style.top = `${window.innerHeight - tooltipRect.height - 10}px`;
    }
}

function hideImageTooltip() {
    if (tooltip) {
        tooltip.remove();
        tooltip = null;
    }
}

function updateSelectionMarquee(start, current) {
    if (!selectionMarquee) return;

    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);
    const width = Math.abs(start.x - current.x);
    const height = Math.abs(start.y - current.y);

    selectionMarquee.style.left = `${left}px`;
    selectionMarquee.style.top = `${top}px`;
    selectionMarquee.style.width = `${width}px`;
    selectionMarquee.style.height = `${height}px`;

    // Hide marquee when it's essentially a click
    selectionMarquee.style.display = width < 2 && height < 2 ? 'none' : 'block';
}

function getItemScreenBounds(item) {
    if (!item || !Number.isFinite(item.x) || !Number.isFinite(item.y)) {
        return null;
    }

    let width = Number.isFinite(item.width) ? item.width : null;
    let height = Number.isFinite(item.height) ? item.height : null;

    if (item.type === 'image') {
        if (width === null || height === null) {
            const size = getCanvasSizeFromAspectRatio(item.aspectRatio || '1:1');
            width = width === null ? size[0] : width;
            height = height === null ? size[1] : height;
        }
    } else if (item.type === 'video') {
        const size = VIDEO_CANVAS_SIZES[item.aspectRatio] || [480, 270];
        width = width === null ? size[0] : width;
        height = height === null ? size[1] : height;
    } else if (item.type === 'note') {
        width = width === null ? DEFAULT_NOTE_WIDTH : width;
        height = height === null ? DEFAULT_NOTE_HEIGHT : height;
    }

    if (!Number.isFinite(width) || !Number.isFinite(height)) {
        return null;
    }

    const left = (item.x * canvasState.zoom) + canvasState.offsetX;
    const top = (item.y * canvasState.zoom) + canvasState.offsetY;

    return {
        minX: left,
        minY: top,
        maxX: left + (width * canvasState.zoom),
        maxY: top + (height * canvasState.zoom)
    };
}

function boundsIntersect(a, b) {
    if (!a || !b) {
        return false;
    }
    return !(b.maxX < a.minX || b.minX > a.maxX || b.maxY < a.minY || b.minY > a.maxY);
}

function addItemsWithinSelectionBounds(targetSet, selectionBounds) {
    const tryAdd = (item) => {
        const itemBounds = getItemScreenBounds(item);
        if (itemBounds && boundsIntersect(selectionBounds, itemBounds)) {
            targetSet.add(item);
        }
    };

    canvasState.images.forEach(tryAdd);
    canvasState.videos.forEach(tryAdd);
    canvasState.notes.forEach(tryAdd);
}

function applySelectionSet(nextSet, options = {}) {
    const { skipUpdate = false } = options;
    const previous = selectedImages;

    previous.forEach(img => {
        if (!nextSet.has(img)) {
            img.element.classList.remove('selected');
        }
    });

    nextSet.forEach(img => {
        if (!previous.has(img)) {
            img.element.classList.add('selected');
        }
    });

    selectedImages = nextSet;

    if (!skipUpdate) {
        updateCanvasIdsList({ refreshCounts: false });
        updateDeleteButtonState();
    }
}

function getSelectedImages() {
    return Array.from(selectedImages);
}

function togglePanMode(force) {
    if (typeof force === 'boolean') {
        isPanMode = force;
    } else {
        isPanMode = !isPanMode;
    }

    const panButton = document.getElementById('panModeBtn');
    if (panButton) {
        panButton.classList.toggle('active', isPanMode);
    }

    canvasArea.classList.toggle('pan-mode', isPanMode);

    if (isPanMode && !panModeHintShown) {
        addChatMessage('✋ Pan mode enabled. Drag anywhere on the background to move the canvas, press H or click Pan Mode again to return to selection.', 'system');
        panModeHintShown = true;
    }
}

function clearSelection(options = {}) {
    if (selectedImages.size === 0) return;

    selectedImages.forEach(img => img.element.classList.remove('selected'));
    selectedImages.clear();

    if (!options.skipUpdate) {
        updateCanvasIdsList({ refreshCounts: false });
        updateDeleteButtonState();
    }
}

function selectImage(imageObj, options = {}) {
    const { additive = false, toggle = true, skipUpdate = false } = options;
    let changed = false;

    if (additive) {
        if (selectedImages.has(imageObj)) {
            if (toggle) {
                selectedImages.delete(imageObj);
                imageObj.element.classList.remove('selected');
                changed = true;
            }
        } else {
            selectedImages.add(imageObj);
            imageObj.element.classList.add('selected');
            changed = true;
        }
    } else {
        if (selectedImages.size === 0 || !selectedImages.has(imageObj)) {
            clearSelection({ skipUpdate: true });
            selectedImages.add(imageObj);
            imageObj.element.classList.add('selected');
            changed = true;
        }
    }

    if (!skipUpdate && (changed || !additive)) {
        updateCanvasIdsList({ refreshCounts: false });
        updateDeleteButtonState();

        // Auto-insert reference into chat input when selecting items
        if (changed && selectedImages.has(imageObj)) {
            insertReferenceToChat(imageObj);
        }
    }

    return selectedImages.has(imageObj);
}

function insertReferenceToChat(item) {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;

    const reference = getReferenceLabelForItem(item);
    if (!reference) return;
    const currentValue = chatInput.value;

    const referenceRegex = new RegExp(`(^|\\s)${reference}(?=\\s|$)`);
    if (referenceRegex.test(currentValue)) {
        return; // Don't add duplicate references
    }

    // Add space before if there's existing content
    const prefix = currentValue && !currentValue.endsWith(' ') ? ' ' : '';
    chatInput.value = currentValue + prefix + reference + ' ';
    
    // Focus the chat input and move cursor to end
    chatInput.focus();
    chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
}

document.addEventListener('mousemove', (e) => {
    if (draggedSelection) {
        const pointer = clientToWorld(e.clientX, e.clientY);
        draggedSelection.items.forEach(item => {
            const newX = pointer.x - item.offsetX;
            const newY = pointer.y - item.offsetY;
            item.image.x = newX;
            item.image.y = newY;
            item.image.element.style.left = `${newX}px`;
            item.image.element.style.top = `${newY}px`;
        });
        dragMoved = true;
    }
});

document.addEventListener('mouseup', () => {
    if (isSelecting) {
        isSelecting = false;
        selectionInitialSet = null;
        selectionStartScreen = null;
        if (selectionMarquee) {
            selectionMarquee.remove();
            selectionMarquee = null;
        }
        canvasArea.classList.remove('selecting');
        updateCanvasIdsList({ refreshCounts: false });
        updateDeleteButtonState();
    }

    if (draggedSelection) {
        if (dragMoved) {
            commitHistorySnapshot();
            debouncedSave();
        }
        draggedSelection = null;
        dragMoved = false;
    }
    if (isPanning) {
        if (panMoved) {
            commitHistorySnapshot();
            debouncedSave({ scope: 'viewport' });
        }
        isPanning = false;
        panMoved = false;
        canvasArea.classList.remove('panning');
    }
});

function resetCanvas() {
    canvasState.zoom = 1;
    canvasState.offsetX = 0;
    canvasState.offsetY = 0;
    updateCanvas();
    commitHistorySnapshot();
    debouncedSave({ immediate: true });
}

function setZoomLevel(targetZoom, options = {}) {
    const commit = options.commit !== false;
    const pivot = options.pivot || {
        x: canvasArea.clientWidth / 2,
        y: canvasArea.clientHeight / 2
    };

    const clamped = Math.max(0.1, Math.min(5, targetZoom));
    if (Math.abs(clamped - canvasState.zoom) < 0.0001) {
        return false;
    }

    const worldX = (pivot.x - canvasState.offsetX) / canvasState.zoom;
    const worldY = (pivot.y - canvasState.offsetY) / canvasState.zoom;

    canvasState.zoom = clamped;
    canvasState.offsetX = pivot.x - worldX * clamped;
    canvasState.offsetY = pivot.y - worldY * clamped;

    updateCanvas();

    if (commit) {
        if (viewportCommitTimeout) {
            clearTimeout(viewportCommitTimeout);
            viewportCommitTimeout = null;
        }
        commitHistorySnapshot();
        debouncedSave({ scope: 'viewport' });
    }

    return true;
}

function zoomIn(options = {}) {
    const pivot = options.pivot || {
        x: canvasArea.clientWidth / 2,
        y: canvasArea.clientHeight / 2
    };
    setZoomLevel(canvasState.zoom * 1.1, { pivot });
}

function zoomOut(options = {}) {
    const pivot = options.pivot || {
        x: canvasArea.clientWidth / 2,
        y: canvasArea.clientHeight / 2
    };
    setZoomLevel(canvasState.zoom / 1.1, { pivot });
}

/**
 * Get the center of the current viewport in world coordinates
 */
function getViewportCenter() {
    return getCenteredTopLeft(DEFAULT_NOTE_WIDTH, DEFAULT_NOTE_HEIGHT);
}

/**
 * Create a text note from button click
 */
function createTextNoteButton() {
    const centerPos = getViewportCenter();
    const note = addNoteToCanvas('', centerPos);
    addChatMessage(`📝 Text note created (${formatNoteRef(note.id)}). Start typing to add your notes.`, 'system');
    
    // Auto-select the new note for immediate interaction
    selectNote(note, { additive: false, toggle: false });
    const noteEditor = note.element.querySelector('.note-content');
    focusNoteEditor(noteEditor);
}

function clearCanvas() {
    canvasState.images.forEach(img => img.element.remove());
    canvasState.videos.forEach(vid => vid.element.remove());
    canvasState.audios.forEach(audio => audio.element.remove());
    canvasState.notes.forEach(note => note.element.remove());
    canvasState.images = [];
    canvasState.videos = [];
    canvasState.audios = [];
    canvasState.notes = [];
    clearSelection({ skipUpdate: true });
    imageCounter = 0;
    videoCounter = 0;
    audioCounter = 0;
    noteCounter = 0;
    updateCanvasStats();
    updateDeleteButtonState();
    commitHistorySnapshot();
    debouncedSave({ immediate: true });
}

function exportCanvas() {
    const nodes = [
        ...canvasState.images.map(img => ({
            id: img.id,
            type: 'image',
            x: img.x,
            y: img.y,
            width: img.width,
            height: img.height,
            url: `data:${img.mimeType};base64,${img.data}`,
            prompt: img.prompt,
            aspectRatio: img.aspectRatio,
            resolution: img.resolution
        })),
        ...canvasState.videos.map(vid => ({
            id: vid.id,
            type: 'video',
            x: vid.x,
            y: vid.y,
            width: vid.width,
            height: vid.height,
            url: vid.sourceType === 'data' && vid.data
                ? `data:${vid.mimeType};base64,${vid.data}`
                : (vid.sourceType === 'youtube'
                    ? (vid.embedUrl || (vid.externalId ? buildYoutubeEmbedUrl(vid.externalId) : vid.sourceUrl))
                    : vid.sourceUrl),
            prompt: vid.prompt,
            aspectRatio: vid.aspectRatio,
            duration: vid.duration,
            sourceType: vid.sourceType || (vid.data ? 'data' : 'url'),
            mimeType: vid.mimeType,
            sourceUrl: vid.sourceUrl || null,
            externalId: vid.externalId || null,
            embedUrl: vid.embedUrl || null
        })),
        ...canvasState.audios.map(audio => ({
            id: audio.id,
            type: 'audio',
            x: audio.x,
            y: audio.y,
            width: audio.width,
            height: audio.height,
            url: audio.data ? `data:${audio.mimeType};base64,${audio.data}` : null,
            text: audio.text,
            duration: audio.duration,
            voiceId: audio.voiceId,
            config: audio.config,
            mimeType: audio.mimeType
        })),
        ...canvasState.notes.map(note => ({
            id: note.id,
            type: 'note',
            x: note.x,
            y: note.y,
            width: note.width,
            height: note.height,
            text: note.text
        }))
    ];

    const data = {
        projectTitle: canvasState.projectTitle,
        nodes,
        viewport: {
            zoom: canvasState.zoom,
            offsetX: canvasState.offsetX,
            offsetY: canvasState.offsetY
        },
        chatHistory: getChatHistorySnapshot()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const projectTitle = canvasState.projectTitle || generateRandomProjectName();
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    a.download = `${projectTitle}-canvas-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const totalItems = canvasState.images.length + canvasState.videos.length + canvasState.audios.length + canvasState.notes.length;
    addChatMessage(`📥 Canvas exported with ${totalItems} item${totalItems !== 1 ? 's' : ''} as JSON!`, 'system');
}

function openImportJsonDialog() {
    if (!importJsonInput) {
        addChatMessage('⚠️ Import is unavailable in this environment.', 'system');
        return;
    }

    importJsonInput.value = '';
    importJsonInput.click();
}

function handleImportJsonSelection(event) {
    const input = event?.target || null;
    if (!input || !input.files || input.files.length === 0) {
        return;
    }

    const [file] = input.files;
    importCanvasFromJsonFile(file);
    input.value = '';
}

function importCanvasFromJsonFile(file) {
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const text = event?.target?.result;
            if (typeof text !== 'string') {
                throw new Error('Unable to read file contents as text.');
            }

            const payload = JSON.parse(text);
            const { images, videos, audios, notes, viewport, chatHistory, warnings } = normalizeImportedCanvasPayload(payload);

            // Restore project title if available
            if (payload.projectTitle) {
                canvasState.projectTitle = payload.projectTitle;
                const titleEl = document.getElementById('projectTitleInput');
                if (titleEl) titleEl.value = payload.projectTitle;
            }

            if (images.length === 0 && videos.length === 0 && audios.length === 0 && notes.length === 0) {
                addChatMessage('⚠️ No canvas items found in that JSON file.', 'system');
                return;
            }

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
            if (chatHistory && typeof applyChatHistorySnapshot === 'function') {
                applyChatHistorySnapshot(chatHistory);
                if (typeof saveChatHistory === 'function') {
                    saveChatHistory();
                }
            }

            initializeHistoryTracking();
            debouncedSave({ immediate: true });

            const summaryParts = [];
            if (images.length > 0) summaryParts.push(`${images.length} image${images.length === 1 ? '' : 's'}`);
            if (videos.length > 0) summaryParts.push(`${videos.length} video${videos.length === 1 ? '' : 's'}`);
            if (audios.length > 0) summaryParts.push(`${audios.length} audio${audios.length === 1 ? '' : 's'}`);
            if (notes.length > 0) summaryParts.push(`${notes.length} note${notes.length === 1 ? '' : 's'}`);
            const summary = summaryParts.join(', ');

            addChatMessage(`📂 Imported ${summary} from JSON.`, 'system');

            if (warnings.length > 0) {
                const preview = warnings.slice(0, 3).join(' ');
                const remainder = warnings.length - 3;
                const suffix = remainder > 0 ? ` (${remainder} more issue${remainder === 1 ? '' : 's'} logged to console.)` : '';
                addChatMessage(`⚠️ ${preview}${suffix}`, 'system');
            }
        } catch (error) {
            console.error('Failed to import canvas JSON:', error);
            addChatMessage('❌ Failed to import canvas JSON. Please verify the file format and try again.', 'system');
        }
    };
    reader.onerror = () => {
        console.error('Failed to read canvas JSON file:', reader.error);
        addChatMessage('❌ Could not read that JSON file. Please try again.', 'system');
    };
    reader.readAsText(file);
}

function getNextIdValue(records) {
    if (!Array.isArray(records) || records.length === 0) {
        return 0;
    }

    const highest = records.reduce((max, record) => {
        const id = Number(record.id);
        return Number.isFinite(id) ? Math.max(max, id) : max;
    }, -1);

    return highest + 1;
}

function normalizeImportedCanvasPayload(rawPayload) {
    if (!rawPayload || typeof rawPayload !== 'object') {
        throw new Error('Invalid Canvas Agent export format.');
    }

    const warnings = [];
    const nodes = extractCanvasNodes(rawPayload);

    const idTrackers = {
        image: { next: 0, used: new Set() },
        video: { next: 0, used: new Set() },
        audio: { next: 0, used: new Set() },
        note: { next: 0, used: new Set() }
    };

    const images = [];
    const videos = [];
    const audios = [];
    const notes = [];

    nodes.forEach((node, index) => {
        if (!node || typeof node !== 'object') {
            const message = `Skipped node ${index + 1}: not a valid object.`;
            warnings.push(message);
            console.warn(message, node);
            return;
        }

        const type = typeof node.type === 'string' ? node.type.toLowerCase() : 'image';

        if (type === 'image') {
            const dataInfo = parseDataUrlForImport(resolveNodeUrl(node));
            if (!dataInfo) {
                const message = `Skipped image ${index + 1}: missing embedded data.`;
                warnings.push(message);
                console.warn(message, node);
                return;
            }

            const id = allocateImportId('image', node.id, idTrackers);
            const x = Number(node.x);
            const y = Number(node.y);

            images.push({
                id,
                x: Number.isFinite(x) ? x : 0,
                y: Number.isFinite(y) ? y : 0,
                data: dataInfo.data,
                mimeType: dataInfo.mimeType || 'image/png',
                prompt: coerceString(node.prompt, 'Imported image'),
                aspectRatio: coerceString(node.aspectRatio, '1:1'),
                resolution: typeof node.resolution === 'string' ? node.resolution : '',
                referenceIds: Array.isArray(node.referenceIds) ? node.referenceIds : []
            });
            return;
        }

        if (type === 'video') {
            const id = allocateImportId('video', node.id, idTrackers);
            const x = Number(node.x);
            const y = Number(node.y);
            const width = Number(node.width);
            const height = Number(node.height);
            const durationValue = node.duration === null ? null : Number(node.duration);
            const resolvedUrl = resolveNodeUrl(node);
            const dataInfo = parseDataUrlForImport(resolvedUrl);

            const mimeType = dataInfo?.mimeType || (typeof node.mimeType === 'string' ? node.mimeType : 'video/mp4');
            const data = dataInfo ? dataInfo.data : null;

            let sourceType = typeof node.sourceType === 'string' ? node.sourceType : null;
            let sourceUrl = typeof node.sourceUrl === 'string' ? node.sourceUrl : null;
            let externalId = typeof node.externalId === 'string' ? node.externalId : null;
            let embedUrl = typeof node.embedUrl === 'string' ? node.embedUrl : null;

            if (!sourceType) {
                if (data) {
                    sourceType = 'data';
                } else if (resolvedUrl && isYoutubeUrl(resolvedUrl)) {
                    sourceType = 'youtube';
                    sourceUrl = sourceUrl || resolvedUrl;
                    externalId = externalId || extractYoutubeId(resolvedUrl) || null;
                } else if (resolvedUrl) {
                    sourceType = 'url';
                    sourceUrl = sourceUrl || resolvedUrl;
                } else if (sourceUrl) {
                    sourceType = isYoutubeUrl(sourceUrl) ? 'youtube' : 'url';
                } else {
                    sourceType = 'data';
                }
            }

            if (!sourceUrl && resolvedUrl && !data) {
                sourceUrl = resolvedUrl;
            }

            if (sourceType === 'youtube') {
                if (!externalId && sourceUrl) {
                    externalId = extractYoutubeId(sourceUrl) || null;
                }
                if (!embedUrl && externalId) {
                    embedUrl = buildYoutubeEmbedUrl(externalId);
                }
            }

            videos.push({
                id,
                x: Number.isFinite(x) ? x : 0,
                y: Number.isFinite(y) ? y : 0,
                width: Number.isFinite(width) ? width : undefined,
                height: Number.isFinite(height) ? height : undefined,
                data,
                mimeType,
                prompt: coerceString(node.prompt, 'Imported video'),
                aspectRatio: coerceString(node.aspectRatio, '16:9'),
                duration: Number.isFinite(durationValue) ? durationValue : (durationValue === null ? null : undefined),
                sourceType,
                sourceUrl: sourceUrl || null,
                externalId: externalId || null,
                embedUrl: embedUrl || null,
                poster: typeof node.poster === 'string' ? node.poster : null
            });
            return;
        }

        if (type === 'audio') {
            const id = allocateImportId('audio', node.id, idTrackers);
            const x = Number(node.x);
            const y = Number(node.y);
            const width = Number(node.width);
            const height = Number(node.height);
            const durationValue = node.duration === null ? null : Number(node.duration);
            const resolvedUrl = resolveNodeUrl(node);
            const dataInfo = parseDataUrlForImport(resolvedUrl);

            const mimeType = dataInfo?.mimeType || (typeof node.mimeType === 'string' ? node.mimeType : 'audio/mp3');
            const data = dataInfo ? dataInfo.data : null;

            audios.push({
                id,
                x: Number.isFinite(x) ? x : 0,
                y: Number.isFinite(y) ? y : 0,
                width: Number.isFinite(width) ? width : undefined,
                height: Number.isFinite(height) ? height : undefined,
                data,
                mimeType,
                text: coerceString(node.text, 'Imported audio'),
                duration: Number.isFinite(durationValue) ? durationValue : (durationValue === null ? null : undefined),
                voiceId: typeof node.voiceId === 'string' ? node.voiceId : null,
                config: typeof node.config === 'object' && node.config !== null ? node.config : {}
            });
            return;
        }

        if (type === 'note') {
            const id = allocateImportId('note', node.id, idTrackers);
            const x = Number(node.x);
            const y = Number(node.y);
            const width = Number(node.width);
            const height = Number(node.height);

            notes.push({
                id,
                x: Number.isFinite(x) ? x : 0,
                y: Number.isFinite(y) ? y : 0,
                width: Number.isFinite(width) ? width : undefined,
                height: Number.isFinite(height) ? height : undefined,
                text: typeof node.text === 'string' ? node.text : ''
            });
            return;
        }

        const message = `Skipped node ${index + 1}: unsupported type "${node.type}".`;
        warnings.push(message);
        console.warn(message, node);
    });

    const viewport = extractViewportState(rawPayload);
    const chatHistory = rawPayload.chatHistory || null;

    return { images, videos, audios, notes, viewport, chatHistory, warnings };
}

function extractCanvasNodes(rawPayload) {
    if (Array.isArray(rawPayload.nodes)) {
        return rawPayload.nodes;
    }

    const nodes = [];

    if (Array.isArray(rawPayload.images)) {
        rawPayload.images.forEach((image) => {
            nodes.push({
                ...image,
                type: 'image',
                url: typeof image.url === 'string'
                    ? image.url
                    : (image.data ? `data:${image.mimeType || 'image/png'};base64,${image.data}` : null)
            });
        });
    }

    if (Array.isArray(rawPayload.videos)) {
        rawPayload.videos.forEach((video) => {
            nodes.push({
                ...video,
                type: 'video',
                url: typeof video.url === 'string'
                    ? video.url
                    : (video.data ? `data:${video.mimeType || 'video/mp4'};base64,${video.data}` : null)
            });
        });
    }

    if (Array.isArray(rawPayload.notes)) {
        rawPayload.notes.forEach((note) => {
            nodes.push({
                ...note,
                type: 'note'
            });
        });
    }

    return nodes;
}

function extractViewportState(rawPayload) {
    const viewportSource = (typeof rawPayload.viewport === 'object' && rawPayload.viewport !== null)
        ? rawPayload.viewport
        : rawPayload;

    const zoom = Number(viewportSource.zoom);
    const offsetX = Number(viewportSource.offsetX);
    const offsetY = Number(viewportSource.offsetY);

    return {
        zoom: Number.isFinite(zoom) ? zoom : 1,
        offsetX: Number.isFinite(offsetX) ? offsetX : 0,
        offsetY: Number.isFinite(offsetY) ? offsetY : 0
    };
}

function allocateImportId(type, rawId, trackers) {
    const tracker = trackers[type];
    if (!tracker) {
        return 0;
    }

    const parsed = Number(rawId);
    if (Number.isInteger(parsed) && parsed >= 0 && !tracker.used.has(parsed)) {
        tracker.used.add(parsed);
        tracker.next = Math.max(tracker.next, parsed + 1);
        return parsed;
    }

    while (tracker.used.has(tracker.next)) {
        tracker.next += 1;
    }

    const assigned = tracker.next;
    tracker.used.add(assigned);
    tracker.next += 1;
    return assigned;
}

function parseDataUrlForImport(candidate) {
    if (typeof candidate !== 'string') {
        return null;
    }

    const trimmed = candidate.trim();
    if (!trimmed.startsWith('data:')) {
        return null;
    }

    const prefixMatch = /^data:([^;]+);base64,/i.exec(trimmed);
    if (!prefixMatch) {
        return null;
    }

    const mimeType = prefixMatch[1];
    const data = trimmed.substring(prefixMatch[0].length);

    if (!data) {
        return null;
    }

    return { mimeType, data };
}

function resolveNodeUrl(node) {
    if (!node || typeof node !== 'object') {
        return null;
    }

    if (typeof node.url === 'string') {
        return node.url;
    }

    if (typeof node.sourceUrl === 'string') {
        return node.sourceUrl;
    }

    if (typeof node.embedUrl === 'string') {
        return node.embedUrl;
    }

    return null;
}

function coerceString(value, fallback) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }
    return fallback;
}

const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_VERSION = 20;
const INVALID_ZIP_PATH_CHARACTERS = /[<>:"\\|?*\u0000-\u001F]/g;

const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            if (c & 1) {
                c = 0xEDB88320 ^ (c >>> 1);
            } else {
                c = c >>> 1;
            }
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32Uint8Array(bytes) {
    let crc = -1;
    for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xFF];
    }
    return (crc ^ -1) >>> 0;
}

function concatUint8Arrays(chunks) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Uint8Array(totalLength);
    let offset = 0;
    chunks.forEach(chunk => {
        output.set(chunk, offset);
        offset += chunk.length;
    });
    return output;
}

function normalizeZipPath(path) {
    const normalized = String(path || '').replace(/\\/g, '/');
    const segments = normalized
        .split('/')
        .filter(segment => segment && segment !== '.' && segment !== '..')
        .map(segment => segment.replace(INVALID_ZIP_PATH_CHARACTERS, '_'));
    return segments.join('/') || 'file';
}

function toDosDateTime(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date();
    let year = date.getFullYear();
    if (year < 1980) year = 1980;
    if (year > 2107) year = 2107;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = Math.floor(date.getSeconds() / 2);

    const dosDate = ((year - 1980) << 9) | (month << 5) | day;
    const dosTime = (hours << 11) | (minutes << 5) | seconds;
    return { dosDate, dosTime };
}

function convertContentToUint8Array(content, encoder) {
    if (content instanceof Uint8Array) {
        return content;
    }
    if (content instanceof ArrayBuffer) {
        return new Uint8Array(content);
    }
    if (ArrayBuffer.isView(content)) {
        return new Uint8Array(content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength));
    }
    if (Array.isArray(content)) {
        return new Uint8Array(content);
    }
    if (typeof content === 'string') {
        return encoder.encode(content);
    }
    if (content === null || content === undefined) {
        return new Uint8Array(0);
    }
    return encoder.encode(String(content));
}

function decodeBase64ToUint8Array(base64) {
    if (typeof base64 === 'string' && typeof base64ToUint8Array === 'function') {
        try {
            return base64ToUint8Array(base64);
        } catch (error) {
            console.warn('Falling back to internal base64 decoder:', error);
        }
    }

    if (typeof base64 !== 'string') {
        return new Uint8Array(0);
    }

    const sanitized = base64.replace(/\s/g, '');
    try {
        const binary = atob(sanitized);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    } catch (error) {
        console.error('Failed to decode base64 payload:', error);
        return new Uint8Array(0);
    }
}

function formatTimestampForFilename(date) {
    const iso = (date instanceof Date ? date : new Date()).toISOString();
    return iso.replace(/[:.]/g, '-');
}

function createZipBlob(files) {
    const encoder = new TextEncoder();
    const preparedEntries = files.map(file => {
        const name = normalizeZipPath(file.name);
        const contentBytes = convertContentToUint8Array(file.content, encoder);
        const { dosDate, dosTime } = toDosDateTime(file.lastModified);
        const fileNameBytes = encoder.encode(name);
        const crc = crc32Uint8Array(contentBytes);
        return {
            name,
            fileNameBytes,
            contentBytes,
            crc,
            dosDate,
            dosTime
        };
    });

    let localOffset = 0;
    const localChunks = [];
    const centralChunks = [];

    preparedEntries.forEach(entry => {
        const entryOffset = localOffset;

        const localHeaderBuffer = new ArrayBuffer(30);
        const localHeaderView = new DataView(localHeaderBuffer);
        localHeaderView.setUint32(0, ZIP_LOCAL_FILE_HEADER_SIGNATURE, true);
        localHeaderView.setUint16(4, ZIP_VERSION, true);
        localHeaderView.setUint16(6, 0, true);
        localHeaderView.setUint16(8, 0, true);
        localHeaderView.setUint16(10, entry.dosTime, true);
        localHeaderView.setUint16(12, entry.dosDate, true);
        localHeaderView.setUint32(14, entry.crc, true);
        localHeaderView.setUint32(18, entry.contentBytes.length, true);
        localHeaderView.setUint32(22, entry.contentBytes.length, true);
        localHeaderView.setUint16(26, entry.fileNameBytes.length, true);
        localHeaderView.setUint16(28, 0, true);

        const localHeaderArray = new Uint8Array(localHeaderBuffer);
        localChunks.push(localHeaderArray, entry.fileNameBytes, entry.contentBytes);

        const entrySize = localHeaderArray.length + entry.fileNameBytes.length + entry.contentBytes.length;
        localOffset += entrySize;

        const centralHeaderBuffer = new ArrayBuffer(46);
        const centralHeaderView = new DataView(centralHeaderBuffer);
        centralHeaderView.setUint32(0, ZIP_CENTRAL_DIRECTORY_HEADER_SIGNATURE, true);
        centralHeaderView.setUint16(4, ZIP_VERSION, true);
        centralHeaderView.setUint16(6, ZIP_VERSION, true);
        centralHeaderView.setUint16(8, 0, true);
        centralHeaderView.setUint16(10, 0, true);
        centralHeaderView.setUint16(12, entry.dosTime, true);
        centralHeaderView.setUint16(14, entry.dosDate, true);
        centralHeaderView.setUint32(16, entry.crc, true);
        centralHeaderView.setUint32(20, entry.contentBytes.length, true);
        centralHeaderView.setUint32(24, entry.contentBytes.length, true);
        centralHeaderView.setUint16(28, entry.fileNameBytes.length, true);
        centralHeaderView.setUint16(30, 0, true);
        centralHeaderView.setUint16(32, 0, true);
        centralHeaderView.setUint16(34, 0, true);
        centralHeaderView.setUint16(36, 0, true);
        centralHeaderView.setUint32(38, 0, true);
        centralHeaderView.setUint32(42, entryOffset, true);

        const centralHeaderArray = new Uint8Array(centralHeaderBuffer);
        centralChunks.push(centralHeaderArray, entry.fileNameBytes);
    });

    const centralDirectoryOffset = localOffset;
    const centralDirectorySize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);

    const eocdBuffer = new ArrayBuffer(22);
    const eocdView = new DataView(eocdBuffer);
    eocdView.setUint32(0, ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, preparedEntries.length, true);
    eocdView.setUint16(10, preparedEntries.length, true);
    eocdView.setUint32(12, centralDirectorySize, true);
    eocdView.setUint32(16, centralDirectoryOffset, true);
    eocdView.setUint16(20, 0, true);

    const eocdArray = new Uint8Array(eocdBuffer);

    const zipContent = concatUint8Arrays([
        ...localChunks,
        ...centralChunks,
        eocdArray
    ]);

    return new Blob([zipContent], { type: 'application/zip' });
}

function exportAllAssets() {
    const imageCount = canvasState.images.length;
    const videoCount = canvasState.videos.length;
    const noteCount = canvasState.notes.length;

    if (imageCount === 0 && videoCount === 0 && noteCount === 0) {
        addChatMessage('⚠️ Nothing to export yet — add images, videos, or notes first.', 'system');
        return;
    }

    const files = [];
    const manifest = {
        exportedAt: new Date().toISOString(),
        viewport: {
            zoom: canvasState.zoom,
            offsetX: canvasState.offsetX,
            offsetY: canvasState.offsetY
        },
        images: [],
        videos: [],
        notes: [],
        warnings: []
    };

    let exportedImages = 0;
    let exportedVideoFiles = 0;
    let exportedVideoReferences = 0;
    let exportedVideoPlaceholders = 0;
    let exportedNotes = 0;

    canvasState.images.forEach(image => {
        if (!image || !image.data) {
            const label = image && typeof image.id === 'number'
                ? formatImageRef(image.id)
                : 'image';
            manifest.warnings.push(`Image ${label} is missing data and was skipped.`);
            return;
        }

        const extension = getFileExtension(image.mimeType || 'image/png', 'png');
        const filename = `images/canvas-agent-image-${image.id}.${extension}`;
        files.push({
            name: filename,
            content: decodeBase64ToUint8Array(image.data)
        });

        manifest.images.push({
            id: image.id,
            filename,
            prompt: image.prompt || '',
            aspectRatio: image.aspectRatio || null,
            resolution: image.resolution || null,
            mimeType: image.mimeType || null,
            position: { x: image.x, y: image.y },
            dimensions: { width: image.width, height: image.height }
        });

        exportedImages += 1;
    });

    canvasState.videos.forEach(video => {
        if (!video) {
            return;
        }

        const baseName = `canvas-agent-video-${video.id}`;
        const manifestEntry = {
            id: video.id,
            prompt: video.prompt || '',
            aspectRatio: video.aspectRatio || null,
            duration: video.duration || null,
            mimeType: video.mimeType || null,
            sourceType: video.sourceType || (video.data ? 'data' : 'url'),
            sourceUrl: video.sourceUrl || null,
            externalId: video.externalId || null,
            embedUrl: video.embedUrl || null,
            poster: video.poster || null,
            position: { x: video.x, y: video.y },
            dimensions: { width: video.width, height: video.height }
        };

        if (video.data) {
            const extension = getFileExtension(video.mimeType || 'video/mp4', 'mp4');
            const filename = `videos/${baseName}.${extension}`;
            files.push({
                name: filename,
                content: decodeBase64ToUint8Array(video.data)
            });
            manifestEntry.filename = filename;
            exportedVideoFiles += 1;
        } else if (video.sourceType === 'youtube') {
            const link = video.sourceUrl || (video.externalId ? `https://youtu.be/${video.externalId}` : video.embedUrl || '');
            const filename = `videos/${baseName}-youtube.txt`;
            const lines = [
                `Video ${formatVideoRef(video.id)} is a YouTube link.`,
                link ? `URL: ${link}` : null,
                video.prompt ? `Prompt: ${video.prompt}` : null,
                video.aspectRatio ? `Aspect ratio: ${video.aspectRatio}` : null,
                typeof video.duration === 'number' ? `Duration: ${video.duration}s` : null
            ].filter(Boolean).join('\n');
            files.push({ name: filename, content: lines });
            manifestEntry.filename = filename;
            manifestEntry.note = 'YouTube reference only';
            manifest.warnings.push(`Video ${formatVideoRef(video.id)} is a YouTube embed and was saved as a link file.`);
            exportedVideoReferences += 1;
        } else if (video.sourceUrl) {
            const filename = `videos/${baseName}-source.txt`;
            const lines = [
                `Video ${formatVideoRef(video.id)} references an external URL.`,
                `URL: ${video.sourceUrl}`,
                video.prompt ? `Prompt: ${video.prompt}` : null,
                video.aspectRatio ? `Aspect ratio: ${video.aspectRatio}` : null,
                typeof video.duration === 'number' ? `Duration: ${video.duration}s` : null
            ].filter(Boolean).join('\n');
            files.push({ name: filename, content: lines });
            manifestEntry.filename = filename;
            manifestEntry.note = 'External URL reference';
            manifest.warnings.push(`Video ${formatVideoRef(video.id)} is hosted externally and was exported as a reference file.`);
            exportedVideoReferences += 1;
        } else {
            const filename = `videos/${baseName}-unavailable.txt`;
            const lines = [
                `Video ${formatVideoRef(video.id)} could not be exported because downloadable data was unavailable.`,
                video.prompt ? `Prompt: ${video.prompt}` : null
            ].filter(Boolean).join('\n');
            files.push({ name: filename, content: lines });
            manifestEntry.filename = filename;
            manifestEntry.note = 'No downloadable source available';
            manifest.warnings.push(`Video ${formatVideoRef(video.id)} lacked downloadable data and was exported as a placeholder.`);
            exportedVideoPlaceholders += 1;
        }

        manifest.videos.push(manifestEntry);
    });

    canvasState.notes.forEach(note => {
        if (!note) {
            return;
        }

        const filename = `notes/canvas-agent-note-${note.id}.txt`;
        const rawText = typeof note.text === 'string' ? note.text : '';
        const normalized = rawText.replace(/\r\n/g, '\n');
        const content = normalized.length > 0 ? `${normalized}\n` : '';

        files.push({ name: filename, content });

        manifest.notes.push({
            id: note.id,
            filename,
            textPreview: rawText.slice(0, 200),
            position: { x: note.x, y: note.y },
            dimensions: { width: note.width, height: note.height }
        });

        exportedNotes += 1;
    });

    manifest.totals = {
        images: exportedImages,
        videos: videoCount,
        downloadableVideos: exportedVideoFiles,
        videoReferenceFiles: exportedVideoReferences,
        videoPlaceholders: exportedVideoPlaceholders,
        notes: exportedNotes
    };

    files.push({
        name: 'manifest.json',
        content: JSON.stringify(manifest, null, 2)
    });

    const zipBlob = createZipBlob(files);
    const downloadUrl = URL.createObjectURL(zipBlob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    const projectTitle = canvasState.projectTitle || generateRandomProjectName();
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    anchor.download = `${projectTitle}-assets-${timestamp}.zip`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);

    const summaryParts = [
        `${exportedImages} image${exportedImages === 1 ? '' : 's'}`,
        `${videoCount} video${videoCount === 1 ? '' : 's'}`,
        `${exportedNotes} note${exportedNotes === 1 ? '' : 's'}`
    ];
    let message = `📦 Exported ${summaryParts.join(', ')} to a ZIP archive.`;

    if (exportedVideoReferences > 0) {
        message += ` ${exportedVideoReferences} video${exportedVideoReferences === 1 ? '' : 's'} were saved as reference files.`;
    }
    if (exportedVideoPlaceholders > 0) {
        message += ` ${exportedVideoPlaceholders} video${exportedVideoPlaceholders === 1 ? '' : 's'} lacked downloadable data.`;
    }

    addChatMessage(message, 'system');

    if (manifest.warnings.length > 0) {
        addChatMessage(`⚠️ ${manifest.warnings.join(' ')}`, 'system');
    }
}

function handleSingleImagePaste(file, placement) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        const base64Data = dataUrl.split(',')[1];

        const imgProbe = new Image();
        imgProbe.onload = () => {
            const aspectRatioLabel = getClosestAspectRatioLabel(imgProbe.width, imgProbe.height);
            const resolution = `${imgProbe.width}x${imgProbe.height}`;
            const added = addImageToCanvas(
                base64Data,
                file.type || 'image/png',
                'Pasted image',
                aspectRatioLabel,
                resolution,
                [],
                placement
            );
            addChatMessage(`📋 Pasted image added as ${formatImageRef(added.id)}`, 'system');
        };
        imgProbe.onerror = () => {
            const added = addImageToCanvas(
                base64Data,
                file.type || 'image/png',
                'Pasted image',
                undefined,
                undefined,
                [],
                placement
            );
            addChatMessage(`📋 Pasted image added as ${formatImageRef(added.id)}`, 'system');
        };
        imgProbe.src = dataUrl;
    };
    reader.onerror = () => {
        console.error('Failed to read pasted image:', reader.error);
    };
    reader.readAsDataURL(file);
}

async function handleMultipleImagePaste(fileImageItems, nextPlacement) {
    const base = getPointerWorldOrCenter();
    const imageInfos = [];

    // First, load all images to get their dimensions
    const loadPromises = fileImageItems.map(item => {
        return new Promise((resolve) => {
            const file = item.getAsFile();
            if (!file) {
                resolve(null);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                const base64Data = dataUrl.split(',')[1];

                const imgProbe = new Image();
                imgProbe.onload = () => {
                    resolve({
                        file,
                        dataUrl,
                        base64Data,
                        width: imgProbe.width,
                        height: imgProbe.height,
                        aspectRatio: imgProbe.width / imgProbe.height
                    });
                };
                imgProbe.onerror = () => {
                    resolve({
                        file,
                        dataUrl,
                        base64Data,
                        width: 512,
                        height: 512,
                        aspectRatio: 1
                    });
                };
                imgProbe.src = dataUrl;
            };
            reader.onerror = () => {
                resolve(null);
            };
            reader.readAsDataURL(file);
        });
    });

    const loadedImages = (await Promise.all(loadPromises)).filter(img => img !== null);

    if (loadedImages.length === 0) return;

    // Sort images by height (tallest first) then by width (widest first)
    loadedImages.sort((a, b) => {
        if (b.height !== a.height) {
            return b.height - a.height;
        }
        return b.width - a.width;
    });

    // Arrange images left to right with proper spacing
    let currentX = base.x - 200; // Start a bit to the left of cursor
    const yPosition = base.y;
    const verticalSpacing = 20;

    loadedImages.forEach((imageInfo, index) => {
        // Calculate scale to fit on screen reasonably (max 300px height)
        const maxHeight = 300;
        const scale = imageInfo.height > maxHeight ? maxHeight / imageInfo.height : 1;
        const scaledWidth = imageInfo.width * scale;
        const scaledHeight = imageInfo.height * scale;

        const placement = {
            x: currentX,
            y: yPosition,
            align: 'center'
        };

        const aspectRatioLabel = getClosestAspectRatioLabel(imageInfo.width, imageInfo.height);
        const resolution = `${imageInfo.width}x${imageInfo.height}`;

        const added = addImageToCanvas(
            imageInfo.base64Data,
            imageInfo.file.type || 'image/png',
            'Pasted image',
            aspectRatioLabel,
            resolution,
            [],
            placement
        );

        addChatMessage(`📋 Pasted image ${index + 1}/${loadedImages.length} added as ${formatImageRef(added.id)}`, 'system');

        // Position next image to the right with spacing
        currentX += scaledWidth + 60; // 60px spacing between images
    });
}

function handleCanvasPaste(event) {
    if (isTypingTarget()) return;

    const clipboardData = event.clipboardData || null;
    const nextPlacement = createPastePlacementGenerator();

    if (clipboardData && clipboardData.types && clipboardData.types.includes(INTERNAL_CLIPBOARD_MIME)) {
        const payloadText = clipboardData.getData(INTERNAL_CLIPBOARD_MIME);
        if (payloadText) {
            try {
                const payload = JSON.parse(payloadText);
                if (pasteInternalClipboardPayload(payload, nextPlacement)) {
                    event.preventDefault();
                    return;
                }
            } catch (error) {
                console.warn('Failed to parse internal clipboard payload:', error);
            }
        }
    }

    const clipboardItems = clipboardData?.items;
    if (!clipboardItems) return;

    const itemsArray = Array.from(clipboardItems);
    let handled = false;

    // First, handle video files (e.g., mp4 screenshots)
    const videoFileItems = itemsArray.filter(item => item.kind === 'file' && item.type.startsWith('video/'));
    if (videoFileItems.length > 0) {
        event.preventDefault();
        handled = true;

        videoFileItems.forEach(item => {
            const file = item.getAsFile();
            if (file) {
                const placement = nextPlacement();
                handlePastedVideoFile(file, { position: placement });
            }
        });
        return;
    }

    // Next, check if the clipboard contains a YouTube or MP4 URL in plain text
    const plainText = event.clipboardData?.getData('text/plain') || '';
    const urlMatch = plainText.match(/https?:\/\/\S+/i);
    if (urlMatch) {
        const candidateUrl = urlMatch[0];
        if (handleVideoUrlPaste(candidateUrl, {
            prompt: 'Pasted video link',
            position: () => nextPlacement()
        })) {
            event.preventDefault();
            return;
        }
        if (isUnsupportedVideoUrl(candidateUrl)) {
            event.preventDefault();
            addChatMessage('⚠️ Unable to import that video. Paste a YouTube link or direct .mp4 file.', 'system');
            return;
        }
    }

    // First, try to handle file-based images (screenshots, local files)
    const fileImageItems = itemsArray.filter(item => item.kind === 'file' && item.type.startsWith('image/'));

    if (fileImageItems.length > 0) {
        event.preventDefault();
        handled = true;

        // If multiple images, organize them based on dimensions
        if (fileImageItems.length > 1) {
            handleMultipleImagePaste(fileImageItems, nextPlacement);
        } else {
            // Single image - use existing logic
            const item = fileImageItems[0];
            const file = item.getAsFile();
            if (file) {
                const placement = nextPlacement();
                handleSingleImagePaste(file, placement);
            }
        }
        return;
    }

    // Second, try to extract image URLs from HTML (images copied from websites)
    const htmlItem = itemsArray.find(item => item.type === 'text/html');
    if (htmlItem) {
        event.preventDefault();
        handled = true;

        htmlItem.getAsString((html) => {
            // Extract image URLs from HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const videoUrl = findVideoUrlInDocument(doc);
            if (videoUrl) {
                if (handleVideoUrlPaste(videoUrl, {
                    prompt: 'Pasted video link',
                    originalUrl: videoUrl,
                    position: () => nextPlacement()
                })) {
                    return;
                }
                if (isUnsupportedVideoUrl(videoUrl)) {
                    addChatMessage('⚠️ Unable to import that video. Paste a YouTube link or direct .mp4 file.', 'system');
                    return;
                }
            }

            const images = doc.querySelectorAll('img');

            if (images.length > 0) {
                images.forEach(img => {
                    const imgSrc = img.src;
                    if (imgSrc) {
                        const placement = nextPlacement();
                        fetchAndAddImageFromUrl(imgSrc, { position: placement });
                    }
                });
            } else {
                // No images found in HTML, try plain text URL
                tryPlainTextUrl(clipboardItems, nextPlacement);
            }
        });
        return;
    }

    // Third, try plain text URL (direct image link)
    if (!handled) {
        tryPlainTextUrl(itemsArray, nextPlacement);
    }
}

function tryPlainTextUrl(clipboardItems, nextPlacement = null) {
    const textItem = Array.from(clipboardItems).find(item => item.type === 'text/plain');
    if (textItem) {
        textItem.getAsString((text) => {
            const urlMatch = text.match(/https?:\/\/\S+/i);
            const url = urlMatch ? urlMatch[0] : text.trim();
            if (handleVideoUrlPaste(url, {
                prompt: 'Pasted video link',
                position: nextPlacement ? () => nextPlacement() : null
            })) {
                return;
            }
            if (isUnsupportedVideoUrl(url)) {
                addChatMessage('⚠️ Unable to import that video. Paste a YouTube link or direct .mp4 file.', 'system');
                return;
            }
            // Check if it's a valid URL
            if (url.match(/^https?:\/\/.+/i)) {
                const placement = nextPlacement ? nextPlacement() : null;
                // Check if it has an image extension
                if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i)) {
                    fetchAndAddImageFromUrl(url, { position: placement });
                } else {
                    // Try to fetch it anyway - it might be an image without extension
                    fetchAndAddImageFromUrl(url, { silent: true, position: placement });
                }
            }
        });
    }
}

async function handleCanvasCopy(event) {
    if (isTypingTarget()) return;

    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    if (selection && !selection.isCollapsed) {
        const selectedText = selection.toString();
        if (typeof selectedText === 'string' && selectedText.trim().length > 0) {
            return;
        }
    }

    const clipboardData = event.clipboardData || null;
    const selected = getSelectedImages();
    if (!selected || selected.length === 0) {
        return;
    }

    const payload = clipboardData ? buildClipboardPayloadFromSelection(selected) : null;
    const primaryImage = getPrimaryClipboardImage(selected);
    const clipboardApi = typeof navigator !== 'undefined' ? navigator.clipboard : null;
    const hasClipboardWrite = clipboardApi && typeof clipboardApi.write === 'function';
    const hasClipboardItemCtor = typeof ClipboardItem === 'function'
        || (typeof window !== 'undefined' && typeof window.ClipboardItem === 'function');
    const canWriteClipboardImage = Boolean(primaryImage && hasClipboardWrite && hasClipboardItemCtor);

    if (!payload && !canWriteClipboardImage) {
        return;
    }

    event.preventDefault();

    if (clipboardData && payload) {
        try {
            const serialized = JSON.stringify(payload);
            clipboardData.setData(INTERNAL_CLIPBOARD_MIME, serialized);

            const references = selected
                .map(getReferenceLabelForItem)
                .filter(ref => typeof ref === 'string' && ref.length > 0);
            const plainText = references.length > 0
                ? `Canvas Agent: ${references.join(', ')}`
                : 'Canvas Agent canvas items';
            clipboardData.setData('text/plain', plainText);
        } catch (error) {
            console.error('Failed to copy canvas items:', error);
        }
    }

    if (canWriteClipboardImage) {
        await writeImageToSystemClipboard(primaryImage);
    }
}

async function fetchAndAddImageFromUrl(url, options = {}) {
    const silent = Boolean(options.silent);
    const placement = coercePlacementOption(options.position);
    try {
        if (!silent) {
            addChatMessage(`📥 Downloading image from: ${url.substring(0, 50)}...`, 'system');
        }
        
        // Fetch the image
        const response = await fetch(url);
        if (!response.ok) {
            if (silent) return; // Silently fail for uncertain URLs
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        // Check if it's an image
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
            if (silent) return; // Not an image, silently ignore
            throw new Error('URL does not point to an image');
        }

        const blob = await response.blob();
        
        // Convert blob to base64
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const base64Data = dataUrl.split(',')[1];
            const mimeType = blob.type || 'image/png';

            // Probe image dimensions
            const imgProbe = new Image();
            imgProbe.onload = () => {
                const aspectRatioLabel = getClosestAspectRatioLabel(imgProbe.width, imgProbe.height);
                const resolution = `${imgProbe.width}x${imgProbe.height}`;
                const added = addImageToCanvas(
                    base64Data,
                    mimeType,
                    'Pasted from web',
                    aspectRatioLabel,
                    resolution,
                    [],
                    placement
                );
                addChatMessage(`✅ Web image added as ${formatImageRef(added.id)}`, 'system');
            };
            imgProbe.onerror = () => {
                const added = addImageToCanvas(
                    base64Data,
                    mimeType,
                    'Pasted from web',
                    undefined,
                    undefined,
                    [],
                    placement
                );
                addChatMessage(`✅ Web image added as ${formatImageRef(added.id)}`, 'system');
            };
            imgProbe.src = dataUrl;
        };
        reader.onerror = () => {
            addChatMessage('❌ Failed to process downloaded image', 'system');
        };
        reader.readAsDataURL(blob);
    } catch (error) {
        console.error('Error fetching image from URL:', error);
        addChatMessage(`❌ Failed to download image: ${error.message}`, 'system');
    }
}

function deleteSelectedImages() {
    const selected = getSelectedImages();
    if (selected.length === 0) {
        addChatMessage('⚠️ Select an item to delete first.', 'system');
        return;
    }

    // Separate images, videos, and notes
    const imagesToRemove = selected.filter(item => item.type !== 'video' && item.type !== 'note');
    const videosToRemove = selected.filter(item => item.type === 'video');
    const notesToRemove = selected.filter(item => item.type === 'note');

    const imageIdsToRemove = new Set(imagesToRemove.map(img => img.id));
    const videoIdsToRemove = new Set(videosToRemove.map(vid => vid.id));
    const noteIdsToRemove = new Set(notesToRemove.map(note => note.id));

    // Remove DOM elements
    selected.forEach(item => item.element.remove());

    // Remove from state
    canvasState.images = canvasState.images.filter(img => !imageIdsToRemove.has(img.id));
    canvasState.videos = canvasState.videos.filter(vid => !videoIdsToRemove.has(vid.id));
    canvasState.notes = canvasState.notes.filter(note => !noteIdsToRemove.has(note.id));

    clearSelection({ skipUpdate: true });
    updateCanvasStats();
    updateDeleteButtonState();
    commitHistorySnapshot();
    debouncedSave({ immediate: true });
}

function handleKeyboardShortcuts(event) {
    if (isTypingTarget()) return;

    const modifier = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (modifier && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
            redoAction();
        } else {
            undoAction();
        }
        return;
    }

    if (modifier && key === 'y') {
        event.preventDefault();
        redoAction();
        return;
    }

    if (!modifier && (key === 'delete' || key === 'backspace')) {
        event.preventDefault();
        deleteSelectedImages();
        return;
    }

    if (!modifier && key === 'h') {
        event.preventDefault();
        togglePanMode();
        return;
    }

    if (modifier && (key === '=' || key === '+')) {
        event.preventDefault();
        zoomIn();
        return;
    }

    if (modifier && (key === '-' || key === '_')) {
        event.preventDefault();
        zoomOut();
    }
}
