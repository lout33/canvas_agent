

/**
 * Display extraction results in chat
 * @param {number} requestId - Request tracking ID
 * @param {Object} data - Extracted data
 * @param {Array} urls - Source URLs
 * @param {string} prompt - Extraction prompt
 */
async function displayExtractionResults(requestId, data, urls, prompt) {
    // Add a formatted result message
    addRequestLog(requestId, '📊', 'Extraction Results:');

    // Format the extracted data
    const formattedData = JSON.stringify(data, null, 2);
    
    // Create a special message with the results
    const chatMessages = document.getElementById('chatMessages');
    const resultDiv = document.createElement('div');
    resultDiv.className = 'chat-message system extraction-result';
    resultDiv.dataset.requestId = String(requestId);
    
    // Create a collapsible/copyable result display
    resultDiv.innerHTML = `
        <div class="extraction-result-header">
            <strong>📊 Extracted Data</strong>
            <button class="copy-extract-btn" onclick="copyExtractionResult(this)" title="Copy JSON">📋 Copy</button>
        </div>
        <div class="extraction-result-meta">
            <strong>Source${urls.length > 1 ? 's' : ''}:</strong> ${urls.map(url => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`).join(', ')}
        </div>
        <div class="extraction-result-meta">
            <strong>Prompt:</strong> ${prompt}
        </div>
        <pre class="extraction-result-data">${formattedData}</pre>
    `;
    
    chatMessages.appendChild(resultDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Log summary
    const dataKeys = Object.keys(data);
    addRequestLog(requestId, 'ℹ️', `Extracted ${dataKeys.length} field${dataKeys.length !== 1 ? 's' : ''}: ${dataKeys.join(', ')}`);

    await maybeProjectExtractionToCanvas(requestId, data, urls, prompt);
}

async function maybeProjectExtractionToCanvas(requestId, data, urls, prompt) {
    try {
        const imageRefs = collectImageReferences(data);
        const textContent = buildNoteTextFromExtraction(data, urls, prompt);

        if (imageRefs.length > 0) {
            const uniqueRefs = Array.from(new Map(imageRefs.map(ref => [ref.value, ref])).values());
            const MAX_IMAGES = 3;

            for (const ref of uniqueRefs.slice(0, MAX_IMAGES)) {
                const asset = await convertImageReferenceToCanvasAsset(ref.value);
                if (!asset) {
                    addRequestLog(requestId, '⚠️', `Could not load extracted image${ref.label ? ` (${ref.label})` : ''}.`);
                    continue;
                }

                const aspectRatio = asset.width && asset.height
                    ? getClosestAspectRatioLabel(asset.width, asset.height)
                    : '1:1';
                const [canvasWidth, canvasHeight] = getCanvasSizeFromAspectRatio(aspectRatio);
                const placement = acquireGenerationPlacement(canvasWidth, canvasHeight, requestId);
                const resolution = asset.width && asset.height ? `${asset.width}x${asset.height}` : 'image';
                const sourceLabel = buildExtractionSourceLabel(urls);
                const promptLabel = ref.label
                    ? `${sourceLabel} — ${ref.label}`
                    : sourceLabel;

                const imageObj = addImageToCanvas(
                    asset.base64Data,
                    asset.mimeType,
                    promptLabel,
                    aspectRatio,
                    resolution,
                    [],
                    placement.position
                );
                addRequestLog(
                    requestId,
                    '🖼️',
                    `Extraction image added as ${formatImageRef(imageObj.id)}${ref.label ? ` (${ref.label})` : ''}.`
                );
            }
        }

        if (typeof textContent === 'string' && textContent.trim().length > 0) {
            const MAX_NOTE_LENGTH = 2000;
            const noteBody = truncateText(textContent.trim(), MAX_NOTE_LENGTH);
            const placement = acquireGenerationPlacement(DEFAULT_NOTE_WIDTH, DEFAULT_NOTE_HEIGHT, requestId);
            const note = addNoteToCanvas(noteBody, placement.position);
            addRequestLog(requestId, '📝', `Extraction text captured in ${formatNoteRef(note.id)}.`);
        }
    } catch (error) {
        console.error('Unable to project extraction results onto canvas:', error);
        addRequestLog(requestId, '⚠️', `Could not render extraction on canvas: ${error.message}`);
    }
}

function buildExtractionSourceLabel(urls = []) {
    if (!Array.isArray(urls) || urls.length === 0) {
        return 'Firecrawl extraction';
    }

    try {
        const hostnames = urls
            .map((url) => {
                try {
                    return new URL(url).hostname;
                } catch (err) {
                    return null;
                }
            })
            .filter(Boolean);

        if (hostnames.length === 0) {
            return 'Firecrawl extraction';
        }

        const uniqueHosts = Array.from(new Set(hostnames));
        if (uniqueHosts.length === 1) {
            return `Firecrawl extraction from ${uniqueHosts[0]}`;
        }
        return `Firecrawl extraction from ${uniqueHosts.slice(0, 3).join(', ')}`;
    } catch (error) {
        console.error('Failed to build extraction source label:', error);
        return 'Firecrawl extraction';
    }
}

function collectImageReferences(node, path = [], results = []) {
    if (node === null || node === undefined) {
        return results;
    }

    if (typeof node === 'string') {
        if (looksLikeImageReference(node)) {
            results.push({ value: normalizePotentialUrl(node), label: path.length ? formatPathLabel(path) : null });
        }
        return results;
    }

    if (Array.isArray(node)) {
        node.forEach((value, index) => {
            collectImageReferences(value, path.concat(index), results);
        });
        return results;
    }

    if (typeof node === 'object') {
        Object.entries(node).forEach(([key, value]) => {
            const nextPath = path.concat(key);

            if (typeof value === 'string' && looksLikeImageReference(value)) {
                results.push({ value: normalizePotentialUrl(value), label: formatPathLabel(nextPath) });
                return;
            }

            if (value && typeof value === 'object') {
                const urlCandidateKey = Object.keys(value).find(candidateKey => {
                    const normalized = candidateKey.toLowerCase();
                    return normalized === 'url' || normalized.endsWith('url');
                });

                if (urlCandidateKey) {
                    const candidateValue = value[urlCandidateKey];
                    if (typeof candidateValue === 'string' && looksLikeImageReference(candidateValue)) {
                        results.push({ value: normalizePotentialUrl(candidateValue), label: formatPathLabel(nextPath) });
                    }
                }
            }

            collectImageReferences(value, nextPath, results);
        });
    }

    return results;
}

function looksLikeImageReference(value) {
    if (typeof value !== 'string') {
        return false;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return false;
    }

    if (trimmed.startsWith('data:image/')) {
        return true;
    }

    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')) {
        return /(\.png|\.jpe?g|\.gif|\.webp|\.bmp|\.svg|\.ico)(?:[?#].*)?$/i.test(trimmed.split('?')[0]);
    }

    return false;
}

function normalizePotentialUrl(value) {
    const trimmed = (value || '').trim();
    if (trimmed.startsWith('//')) {
        return `https:${trimmed}`;
    }
    return trimmed;
}

async function convertImageReferenceToCanvasAsset(reference) {
    if (!reference) {
        return null;
    }

    if (reference.startsWith('data:image/')) {
        return convertDataUrlToAsset(reference);
    }

    try {
        const response = await fetch(reference);
        if (!response.ok) {
            return null;
        }

        const blob = await response.blob();
        const dataUrl = await blobToDataUrl(blob);
        return convertDataUrlToAsset(dataUrl);
    } catch (error) {
        console.error('Failed to fetch extraction image:', error);
        return null;
    }
}

async function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('Unable to read blob as data URL'));
            }
        };
        reader.onerror = () => {
            reject(reader.error || new Error('Failed to read blob'));
        };
        reader.readAsDataURL(blob);
    });
}

async function convertDataUrlToAsset(dataUrl) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
        return null;
    }

    const [header, base64Payload] = dataUrl.split(',', 2);
    if (!header || !base64Payload) {
        return null;
    }

    const mimeMatch = header.match(/^data:(image\/[^;]+)(?:;base64)?/i);
    const mimeType = mimeMatch ? mimeMatch[1].toLowerCase() : 'image/png';

    const { width, height } = await probeImageDimensions(dataUrl);

    return {
        base64Data: base64Payload,
        mimeType,
        width,
        height
    };
}

async function probeImageDimensions(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            resolve({ width: null, height: null });
        };
        img.src = dataUrl;
    });
}

function buildNoteTextFromExtraction(data, urls = [], prompt = '') {
    if (data === null || data === undefined) {
        return '';
    }

    if (typeof data === 'string') {
        return data;
    }

    const sections = [];
    const title = findFirstStringByKeyIncludes(data, ['title', 'name', 'headline']);
    if (title) {
        sections.push(`Title: ${title}`);
    }

    const subtitle = findFirstStringByKeyIncludes(data, ['subtitle', 'tagline']);
    if (subtitle && subtitle !== title) {
        sections.push(`Subtitle: ${subtitle}`);
    }

    const description = findFirstStringByKeyIncludes(data, ['description', 'summary', 'overview', 'caption', 'text', 'body', 'details']);
    if (description) {
        sections.push(`Description: ${description}`);
    }

    const price = findFirstStringByKeyIncludes(data, ['price', 'cost']);
    if (price) {
        sections.push(`Price: ${price}`);
    }

    const callToAction = findFirstStringByKeyIncludes(data, ['cta', 'call_to_action']);
    if (callToAction) {
        sections.push(`CTA: ${callToAction}`);
    }

    const author = findFirstStringByKeyIncludes(data, ['author', 'byline']);
    if (author) {
        sections.push(`Author: ${author}`);
    }

    extractArraySummaries(data).forEach(summary => {
        if (summary) {
            sections.push(summary);
        }
    });

    if (sections.length === 0) {
        let fallbackText = '';
        try {
            fallbackText = JSON.stringify(data, null, 2);
        } catch (error) {
            console.error('Failed to stringify extraction data for note:', error);
        }

        const extras = [];
        if (prompt) {
            extras.push(`Prompt: ${prompt}`);
        }
        if (Array.isArray(urls) && urls.length > 0) {
            extras.push(`Sources: ${urls.join(', ')}`);
        }

        return [fallbackText, ...extras].filter(Boolean).join('\n\n');
    }

    if (prompt) {
        sections.push(`Prompt: ${prompt}`);
    }

    if (Array.isArray(urls) && urls.length > 0) {
        sections.push(`Sources: ${urls.join(', ')}`);
    }

    return sections.join('\n\n');
}

function findFirstStringByKeyIncludes(node, keys) {
    if (!node || typeof node !== 'object') {
        return null;
    }

    const lowerKeys = keys.map(key => key.toLowerCase());

    const stack = [node];
    const visited = new WeakSet();

    while (stack.length > 0) {
        const current = stack.pop();

        if (!current || typeof current !== 'object') {
            continue;
        }

        if (visited.has(current)) {
            continue;
        }
        visited.add(current);

        if (Array.isArray(current)) {
            for (let i = current.length - 1; i >= 0; i--) {
                stack.push(current[i]);
            }
            continue;
        }

        for (const [key, value] of Object.entries(current)) {
            if (typeof value === 'string') {
                const normalizedKey = key.toLowerCase();
                if (lowerKeys.some(target => normalizedKey.includes(target))) {
                    const trimmed = value.trim();
                    if (trimmed) {
                        return trimmed;
                    }
                }
            } else if (value && typeof value === 'object') {
                stack.push(value);
            }
        }
    }

    return null;
}

function extractArraySummaries(node) {
    const summaries = [];

    if (Array.isArray(node)) {
        const summary = summariseArray('Items', node);
        if (summary) {
            summaries.push(summary);
        }
    }

    if (node && typeof node === 'object' && !Array.isArray(node)) {
        Object.entries(node).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                const label = formatLabel(key);
                const summary = summariseArray(label, value);
                if (summary) {
                    summaries.push(summary);
                }
            } else if (value && typeof value === 'object') {
                summaries.push(...extractArraySummaries(value));
            }
        });
    }

    return summaries;
}

function summariseArray(label, array) {
    if (!Array.isArray(array) || array.length === 0) {
        return '';
    }

    const lines = [];
    const MAX_ITEMS = 5;
    array.slice(0, MAX_ITEMS).forEach((item, index) => {
        const prefix = array.length > 1 ? `${index + 1}. ` : '- ';

        if (typeof item === 'string') {
            const text = item.trim();
            if (text) {
                lines.push(`${prefix}${truncateText(text, 200)}`);
            }
            return;
        }

        if (item && typeof item === 'object') {
            const itemTitle = findFirstStringByKeyIncludes(item, ['title', 'name', 'headline']);
            const itemDescription = findFirstStringByKeyIncludes(item, ['description', 'summary', 'details', 'text', 'body']);
            const itemPrice = findFirstStringByKeyIncludes(item, ['price', 'cost']);

            const parts = [];
            if (itemTitle) {
                parts.push(itemTitle);
            }
            if (itemDescription) {
                parts.push(itemDescription);
            }
            if (itemPrice) {
                parts.push(itemPrice);
            }

            if (parts.length === 0) {
                try {
                    parts.push(JSON.stringify(item));
                } catch (error) {
                    console.error('Failed to stringify array item:', error);
                }
            }

            if (parts.length > 0) {
                lines.push(`${prefix}${truncateText(parts.join(' — '), 200)}`);
            }
            return;
        }
    });

    if (lines.length === 0) {
        return '';
    }

    return `${label}:\n${lines.join('\n')}`;
}

function formatLabel(key) {
    return key
        .split(/[_\-\s]+/)
        .filter(Boolean)
        .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
}

function formatPathLabel(path = []) {
    if (!Array.isArray(path) || path.length === 0) {
        return null;
    }

    return path
        .map(segment => {
            if (typeof segment === 'number') {
                return `#${segment + 1}`;
            }
            return formatLabel(segment);
        })
        .join(' › ');
}

function truncateText(text, maxLength) {
    if (typeof text !== 'string') {
        return '';
    }

    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength - 1)}…`;
}

/**
 * Copy extraction result to clipboard
 * @param {HTMLElement} button - Copy button element
 */
async function copyExtractionResult(button) {
    const resultDiv = button.closest('.extraction-result');
    const preElement = resultDiv.querySelector('.extraction-result-data');
    const jsonText = preElement.textContent;
    
    try {
        await navigator.clipboard.writeText(jsonText);
        button.textContent = '✅ Copied!';
        setTimeout(() => {
            button.textContent = '📋 Copy';
        }, 2000);
    } catch (error) {
        console.error('Failed to copy:', error);
        button.textContent = '❌ Failed';
        setTimeout(() => {
            button.textContent = '📋 Copy';
        }, 2000);
    }
}

// ============================================================================
// VIDEO ANALYSIS FUNCTIONS
// ============================================================================

const VIDEO_ANALYSIS_MODEL = 'gemini-2.5-flash';
const GEMINI_FILE_POLL_INTERVAL_MS = 5000;
const GEMINI_FILE_POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function estimateBase64SizeBytes(base64) {
    if (typeof base64 !== 'string') return 0;
    const sanitized = base64.replace(/\s/g, '');
    const padding = (sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0);
    return Math.floor(sanitized.length * 3 / 4) - padding;
}

function base64ToUint8Array(base64) {
    const sanitized = base64.replace(/\s/g, '');
    const binaryString = atob(sanitized);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function formatFileSize(bytes) {
    if (!Number.isFinite(bytes)) {
        return '?';
    }
    if (bytes === 0) {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    const precision = value >= 10 || exponent === 0 ? 0 : 1;
    return `${value.toFixed(precision)} ${units[exponent]}`;
}

function timestampToSeconds(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value !== 'string') return null;

    const trimmed = value.trim().toLowerCase();
    if (trimmed.length === 0) return null;

    if (/^\d+:\d+:\d+$/.test(trimmed)) {
        const [hours, minutes, seconds] = trimmed.split(':').map(num => parseInt(num, 10));
        return hours * 3600 + minutes * 60 + seconds;
    }

    if (/^\d+:\d+$/.test(trimmed)) {
        const [minutes, seconds] = trimmed.split(':').map(num => parseInt(num, 10));
        return minutes * 60 + seconds;
    }

    if (/^\d+(?:\.\d+)?s$/.test(trimmed)) {
        return parseFloat(trimmed.replace('s', ''));
    }

    if (/^\d+(?:\.\d+)?m$/.test(trimmed)) {
        return parseFloat(trimmed.replace('m', '')) * 60;
    }

    if (/^\d+(?:\.\d+)?h$/.test(trimmed)) {
        return parseFloat(trimmed.replace('h', '')) * 3600;
    }

    const compositeMatch = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/);
    if (compositeMatch) {
        const hours = compositeMatch[1] ? parseInt(compositeMatch[1], 10) : 0;
        const minutes = compositeMatch[2] ? parseInt(compositeMatch[2], 10) : 0;
        const seconds = compositeMatch[3] ? parseFloat(compositeMatch[3]) : 0;
        if (hours || minutes || seconds) {
            return hours * 3600 + minutes * 60 + seconds;
        }
    }

    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
        return parseFloat(trimmed);
    }

    return null;
}

function normalizeVideoOffset(offset) {
    const seconds = timestampToSeconds(offset);
    if (seconds === null) return null;
    const clamped = Math.max(0, seconds);
    return `${clamped}s`;
}

function formatSecondsToTimestamp(totalSeconds) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const pad = (num) => String(num).padStart(2, '0');
    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
    }
    return `${pad(minutes)}:${pad(secs)}`;
}

function normaliseTimestampForDisplay(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return formatSecondsToTimestamp(value);
    }
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    if (trimmed.length === 0) return null;

    if (/^\d+:\d+:\d+$/.test(trimmed)) {
        const [hours, minutes, seconds] = trimmed.split(':');
        return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
    }

    if (/^\d+:\d+$/.test(trimmed)) {
        const [minutes, seconds] = trimmed.split(':');
        return `${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
    }

    if (/^\d+(?:\.\d+)?s$/i.test(trimmed)) {
        return formatSecondsToTimestamp(parseFloat(trimmed));
    }

    if (/^\d+(?:\.\d+)?m$/i.test(trimmed)) {
        return formatSecondsToTimestamp(parseFloat(trimmed) * 60);
    }

    if (/^\d+(?:\.\d+)?h$/i.test(trimmed)) {
        return formatSecondsToTimestamp(parseFloat(trimmed) * 3600);
    }

    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
        return formatSecondsToTimestamp(parseFloat(trimmed));
    }

    return trimmed;
}

function buildVideoMetadataFromDescriptor(descriptor = {}) {
    const metadata = {};
    const startOffset = normalizeVideoOffset(
        descriptor.startOffset ?? descriptor.start ?? descriptor.beginOffset ?? descriptor.from ?? null
    );
    const endOffset = normalizeVideoOffset(
        descriptor.endOffset ?? descriptor.end ?? descriptor.stopOffset ?? descriptor.to ?? null
    );

    if (startOffset) {
        metadata.startOffset = startOffset;
    }
    if (endOffset) {
        metadata.endOffset = endOffset;
    }

    const fpsValue = descriptor.fps ?? descriptor.frameRate ?? descriptor.framerate;
    if (fpsValue !== undefined && fpsValue !== null && fpsValue !== '') {
        const fpsNumber = Number(fpsValue);
        if (Number.isFinite(fpsNumber) && fpsNumber > 0) {
            metadata.fps = Math.min(fpsNumber, 30);
        }
    }

    return Object.keys(metadata).length > 0 ? metadata : null;
}

function buildVideoAnalysisPrompt(label, focus) {
    const trimmedFocus = typeof focus === 'string' ? focus.trim() : '';

    if (trimmedFocus.length > 0) {
        return trimmedFocus;
    }

    const safeLabel = label || 'the video';
    return `Analyze "${safeLabel}" and share the key observations and takeaways.`;
}

async function uploadVideoBytesToGemini(apiKey, bytes, mimeType, displayName, options = {}) {
    const { requestId = null, label = displayName || 'Video' } = options;

    const { body, sizeBytes } = normalizeUploadPayload(bytes, mimeType);

    const startResponse = await fetch(
        'https://generativelanguage.googleapis.com/upload/v1beta/files',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Upload-Protocol': 'resumable',
                'X-Goog-Upload-Command': 'start',
                'X-Goog-Upload-Header-Content-Length': String(sizeBytes),
                'X-Goog-Upload-Header-Content-Type': mimeType,
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
                file: {
                    displayName: displayName
                }
            })
        }
    );

    if (!startResponse.ok) {
        const message = await startResponse.text().catch(() => startResponse.statusText || 'Failed to start Gemini file upload');
        throw new Error(message || 'Failed to start Gemini file upload');
    }

    const uploadUrl = startResponse.headers.get('X-Goog-Upload-URL') || startResponse.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
        throw new Error('Upload URL missing from Gemini response');
    }

    const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': mimeType,
            'Content-Length': String(sizeBytes),
            'X-Goog-Upload-Protocol': 'resumable',
            'X-Goog-Upload-Command': 'upload, finalize',
            'X-Goog-Upload-Offset': '0',
            'x-goog-api-key': apiKey
        },
        body
    });

    if (!uploadResponse.ok) {
        const message = await uploadResponse.text().catch(() => uploadResponse.statusText || 'Gemini file upload failed');
        throw new Error(message || 'Gemini file upload failed');
    }

    const uploadJson = await uploadResponse.json().catch(() => null);
    const fileUri = uploadJson?.file?.uri || uploadJson?.file?.name;
    if (!fileUri) {
        throw new Error('Gemini upload succeeded but file URI is missing');
    }

    await waitForGeminiFileProcessing({
        apiKey,
        fileUri,
        requestId,
        label
    });

    return fileUri;
}

async function waitForGeminiFileProcessing({ apiKey, fileUri, requestId = null, label = 'Video' }) {
    const fileName = typeof fileUri === 'string' && fileUri.includes('/') ? fileUri.split('/').pop() : fileUri;
    if (!fileName) {
        throw new Error('Unable to determine Gemini file identifier.');
    }

    const deadline = Date.now() + GEMINI_FILE_POLL_TIMEOUT_MS;
    let lastLoggedState = null;

    while (Date.now() < deadline) {
        const statusResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/files/${fileName}`,
            {
                method: 'GET',
                headers: {
                    'x-goog-api-key': apiKey
                }
            }
        );

        if (!statusResponse.ok) {
            if (statusResponse.status >= 500) {
                await delay(GEMINI_FILE_POLL_INTERVAL_MS);
                continue;
            }

            const message = await statusResponse.text().catch(() => statusResponse.statusText || 'Failed to check Gemini file status');
            throw new Error(message || 'Failed to check Gemini file status');
        }

        const payload = await statusResponse.json().catch(() => null);
        const state = payload?.state;

        if (state === 'ACTIVE') {
            if (requestId) {
                addRequestLog(requestId, '✅', `${label} processed by Gemini.`);
            }
            return payload;
        }

        if (state === 'FAILED') {
            throw new Error(`${label} processing failed on Gemini.`);
        }

        if (requestId && state && state !== lastLoggedState) {
            addRequestLog(requestId, '⏳', `${label} status: ${state.toLowerCase()}. Waiting for completion...`);
            lastLoggedState = state;
        }

        await delay(GEMINI_FILE_POLL_INTERVAL_MS);
    }

    throw new Error(`${label} processing timed out on Gemini.`);
}

function normalizeUploadPayload(bytes, mimeType) {
    if (bytes instanceof Blob) {
        return { body: bytes, sizeBytes: bytes.size };
    }

    if (bytes instanceof ArrayBuffer) {
        return { body: bytes, sizeBytes: bytes.byteLength };
    }

    if (ArrayBuffer.isView(bytes)) {
        const view = bytes;
        return {
            body: view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength),
            sizeBytes: view.byteLength
        };
    }

    if (typeof bytes === 'string') {
        const array = base64ToUint8Array(bytes);
        return normalizeUploadPayload(array, mimeType);
    }

    throw new Error('Unsupported upload payload type for Gemini Files API.');
}

function parseVideoReferenceId(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    const match = trimmed.match(/@?v?(\d+)/i);
    if (!match) return null;
    const id = parseInt(match[1], 10);
    return Number.isFinite(id) ? id : null;
}

function formatVideoSummaryForChat(label, summary) {
    const lines = [];
    const heading = label ? `🎥 ${label} — Breakdown` : '🎥 Video Breakdown';
    lines.push(heading);

    if (typeof summary === 'string') {
        const trimmed = summary.trim();
        if (trimmed.length > 0) {
            lines.push(trimmed);
        }
        return lines.join('\n');
    }

    if (summary.synopsis) {
        lines.push(`Synopsis: ${summary.synopsis}`);
    }

    if (Array.isArray(summary.highlights) && summary.highlights.length > 0) {
        lines.push('Highlights:');
        summary.highlights.forEach((item) => {
            if (!item) return;
            if (typeof item === 'string') {
                lines.push(`- ${item}`);
                return;
            }
            const timestamp = normaliseTimestampForDisplay(item.timestamp || item.time || item.at);
            const detail = item.detail || item.description || item.summary || '';
            if (timestamp && detail) {
                lines.push(`- [${timestamp}] ${detail}`);
            } else if (detail) {
                lines.push(`- ${detail}`);
            }
        });
    }

    const visuals = summary.visuals || summary.visualNotes || summary.visualsNotes;
    if (Array.isArray(visuals) && visuals.length > 0) {
        lines.push('Visual Notes:');
        visuals.forEach((item) => {
            if (item) {
                lines.push(`- ${item}`);
            }
        });
    }

    const audio = summary.audio || summary.audioNotes || summary.sound;
    if (Array.isArray(audio) && audio.length > 0) {
        lines.push('Audio Notes:');
        audio.forEach((item) => {
            if (item) {
                lines.push(`- ${item}`);
            }
        });
    }

    const extras = summary.extras || summary.notes || summary.observations || summary.takeaways;
    if (Array.isArray(extras) && extras.length > 0) {
        lines.push('Extras:');
        extras.forEach((item) => {
            if (item) {
                lines.push(`- ${item}`);
            }
        });
    }

    return lines.join('\n');
}

async function prepareVideoAnalysisInput({
    apiKey,
    descriptor = {},
    referencedVideos = [],
    fallbackUrls = [],
    index = 1,
    requestId
}) {
    const effectiveApiKey = typeof apiKey === 'string' ? apiKey.trim() : '';
    if (!effectiveApiKey) {
        throw new Error('Add your Gemini API key to analyse videos.');
    }

    const notes = [];

    let canvasVideo = null;
    const candidateRefs = [
        descriptor.referenceId,
        descriptor.canvasId,
        descriptor.videoId,
        descriptor.id
    ];

    for (const ref of candidateRefs) {
        const parsedId = parseVideoReferenceId(ref);
        if (Number.isFinite(parsedId)) {
            const found = canvasState.videos.find(video => video.id === parsedId);
            if (found) {
                canvasVideo = found;
                break;
            }
        }
    }

    if (!canvasVideo && Array.isArray(referencedVideos) && referencedVideos.length === 1 && !descriptor.url) {
        canvasVideo = referencedVideos[0];
        notes.push('Using sole referenced canvas video.');
    }

    let resolvedUrl = descriptor.url || descriptor.videoUrl || descriptor.link || null;
    let inferredType = descriptor.type || null;

    if (!resolvedUrl && !canvasVideo && fallbackUrls.length === 1) {
        resolvedUrl = fallbackUrls[0];
        notes.push('Using detected video URL from message.');
    }

    if (canvasVideo) {
        inferredType = canvasVideo.sourceType || (canvasVideo.data ? 'data' : 'url');
    } else if (!inferredType && resolvedUrl) {
        inferredType = isYoutubeUrl(resolvedUrl) ? 'youtube' : 'url';
    }

    if (inferredType === 'youtube' && !resolvedUrl) {
        if (canvasVideo?.externalId) {
            resolvedUrl = `https://www.youtube.com/watch?v=${canvasVideo.externalId}`;
        } else if (canvasVideo?.embedUrl) {
            resolvedUrl = canvasVideo.embedUrl;
        }
    }

    if (!canvasVideo && !resolvedUrl) {
        throw new Error('No video source provided for analysis.');
    }

    const metadata = buildVideoMetadataFromDescriptor(descriptor);
    const labelFallback = `Video ${index}`;
    let label = descriptor.label || null;

    if (canvasVideo) {
        label = label || formatVideoRef(canvasVideo.id);
    } else if (!label && resolvedUrl) {
        label = isYoutubeUrl(resolvedUrl)
            ? `YouTube (${formatUrlForChat(resolvedUrl)})`
            : `Video URL (${formatUrlForChat(resolvedUrl)})`;
    }

    if (!label) {
        label = labelFallback;
    }

    let part = null;

    if (canvasVideo) {
        const canvasSourceType = canvasVideo.sourceType || (canvasVideo.data ? 'data' : 'url');

        if (canvasSourceType === 'youtube') {
            const youtubeUrl = canvasVideo.sourceUrl || resolvedUrl;
            if (!youtubeUrl) {
                throw new Error(`Canvas video ${label} is missing a source URL.`);
            }
            part = {
                fileData: {
                    fileUri: youtubeUrl,
                    mimeType: 'video/*'
                }
            };
        } else if (canvasSourceType === 'url') {
            const url = canvasVideo.sourceUrl || resolvedUrl;
            if (!url) {
                throw new Error(`Canvas video ${label} is missing its source URL.`);
            }
            part = {
                fileData: {
                    fileUri: url,
                    mimeType: canvasVideo.mimeType || 'video/*'
                }
            };
        } else {
            const base64Data = canvasVideo.data;
            if (!base64Data) {
                throw new Error(`Canvas video ${label} has no stored data.`);
            }

            const mimeType = canvasVideo.mimeType || 'video/mp4';
            const existingFileUri = canvasVideo.geminiFileUri || canvasVideo.fileUri || null;

            if (existingFileUri) {
                part = {
                    fileData: {
                        fileUri: existingFileUri,
                        mimeType
                    }
                };
                notes.push('Reusing Gemini Files API upload.');
                if (requestId) {
                    addRequestLog(
                        requestId,
                        '♻️',
                        `${label}: Reusing cached Gemini file upload.`
                    );
                }
            } else {
                const estimatedBytes = estimateBase64SizeBytes(base64Data);
                const bytes = base64ToUint8Array(base64Data);
                const uploadLabel = label || `Video ${canvasVideo.id}`;

                if (requestId) {
                    addRequestLog(
                        requestId,
                        '⬆️',
                        `Uploading ${uploadLabel} (${formatFileSize(estimatedBytes)}) via Gemini Files API...`
                    );
                }

                const fileUri = await uploadVideoBytesToGemini(
                    effectiveApiKey,
                    bytes,
                    mimeType,
                    `canvas-video-${canvasVideo.id}`,
                    {
                        requestId,
                        label: uploadLabel
                    }
                );

                canvasVideo.geminiFileUri = fileUri;

                part = {
                    fileData: {
                        fileUri,
                        mimeType
                    }
                };
                notes.push('Uploaded via Gemini Files API.');
            }
        }
    } else {
        if (!resolvedUrl) {
            throw new Error('Video URL is required for analysis.');
        }
        part = {
            fileData: {
                fileUri: resolvedUrl,
                mimeType: isYoutubeUrl(resolvedUrl) ? 'video/*' : (descriptor.mimeType || 'video/*')
            }
        };
    }

    if (metadata) {
        part.videoMetadata = metadata;
    }

    return {
        label,
        part,
        metadata,
        notes,
        sourceType: canvasVideo ? (canvasVideo.sourceType || (canvasVideo.data ? 'data' : 'url')) : inferredType,
        canvasVideo
    };
}

async function runVideoAnalysis({
    apiKey,
    part,
    label,
    analysisFocus
}) {
    const effectiveApiKey = typeof apiKey === 'string' ? apiKey.trim() : '';
    if (!effectiveApiKey) {
        throw new Error('Add your Gemini API key to analyse videos.');
    }

    const promptText = buildVideoAnalysisPrompt(label, analysisFocus);
    const videoPart = {};
    if (part.fileData) {
        videoPart.fileData = { ...part.fileData };
    }
    if (part.inlineData) {
        videoPart.inlineData = { ...part.inlineData };
    }
    if (part.videoMetadata) {
        videoPart.videoMetadata = { ...part.videoMetadata };
    }

    const textParts = [];
    if (label) {
        textParts.push({ text: `Video label: ${label}` });
    }
    if (promptText) {
        textParts.push({ text: promptText });
    }

    const requestBody = {
        contents: [{
            role: 'user',
            parts: [
                videoPart,
                ...textParts
            ]
        }]
    };

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${VIDEO_ANALYSIS_MODEL}:generateContent?key=${effectiveApiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const message = errorData?.error?.message || errorData?.error?.status || 'Gemini video analysis failed';
        throw new Error(message);
    }

    const data = await response.json();
    const textPart = data.candidates?.[0]?.content?.parts?.find(part => typeof part.text === 'string');
    if (!textPart || !textPart.text) {
        throw new Error('Gemini returned no analysis content');
    }

    return textPart.text.trim();
}

// ============================================================================
// VIDEO GENERATION FUNCTIONS
// ============================================================================

/**
 * Video aspect ratio canvas sizes (similar to images but for video players)
 */
const VIDEO_CANVAS_SIZES = {
    '16:9': [480, 270],  // Widescreen
    '9:16': [270, 480],
    '1:1': [320, 320],
    '4:3': [420, 315],
    '3:4': [315, 420],
    '3:2': [450, 300],
    '2:3': [300, 450],
    '21:9': [520, 223],
    '5:4': [420, 336],
    '4:5': [336, 420]
};

/**
 * Add video to canvas
 * @param {string} videoData - Base64 encoded video data
 * @param {string} mimeType - Video MIME type (video/mp4)
 * @param {string} prompt - Generation prompt
 * @param {string} aspectRatio - Video aspect ratio
 * @param {number} duration - Video duration in seconds
 * @returns {Object} Video object
 */
function addVideoToCanvas(videoData, mimeType, prompt = 'No prompt', aspectRatio = '9:16', duration = 8, options = {}) {
    const videoEl = document.createElement('div');
    videoEl.className = 'canvas-video';
    const [defaultWidth, defaultHeight] = VIDEO_CANVAS_SIZES[aspectRatio] ||
        getCanvasSizeFromAspectRatio(aspectRatio) ||
        [480, 270];
    const width = options.width || defaultWidth;
    const height = options.height || defaultHeight;

    const SPACING_X = 40;
    const SPACING_Y = 40;
    const MAX_ROW_WIDTH = 1600;

    let nextX;
    let nextY;

    if (options.position && typeof options.position.x === 'number' && typeof options.position.y === 'number') {
        if (options.position.align === 'center') {
            nextX = options.position.x - (width / 2);
            nextY = options.position.y - (height / 2);
        } else {
            nextX = options.position.x;
            nextY = options.position.y;
        }
    } else {
        nextX = lastGeneratedPosition.x;
        nextY = lastGeneratedPosition.y;

        if (canvasState.images.length === 0 && canvasState.videos.length === 0) {
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

    videoEl.style.left = `${nextX}px`;
    videoEl.style.top = `${nextY}px`;
    videoEl.style.width = `${width}px`;
    videoEl.style.height = `${height}px`;
    const currentId = videoCounter++;

    const resolvedDuration = (typeof duration === 'number' && Number.isFinite(duration))
        ? duration
        : (duration === null ? null : 8);
    const sourceType = options.sourceType || (videoData ? 'data' : 'url');
    const sourceUrl = options.sourceUrl || null;
    const externalId = options.externalId || null;
    const embedUrl = options.embedUrl || (sourceType === 'youtube' && externalId ? buildYoutubeEmbedUrl(externalId) : null);
    const poster = options.poster || null;

    const videoObj = {
        id: currentId,
        type: 'video',
        element: videoEl,
        x: Number(videoEl.style.left.replace('px', '')),
        y: Number(videoEl.style.top.replace('px', '')),
        width,
        height,
        data: videoData || null,
        mimeType: mimeType || (sourceType === 'youtube' ? 'video/youtube' : 'video/mp4'),
        prompt: prompt,
        aspectRatio: aspectRatio,
        duration: resolvedDuration,
        sourceType,
        sourceUrl,
        externalId,
        embedUrl,
        poster
    };

    renderCanvasVideoContent(videoEl, videoObj);

    canvasState.videos.push(videoObj);
    canvas.appendChild(videoEl);

    lastGeneratedPosition = {
        x: videoObj.x,
        y: videoObj.y
    };

    attachCanvasVideoEvents(videoEl, videoObj);

    updateCanvasStats();
    commitHistorySnapshot();
    debouncedSave({ immediate: true });
    return videoObj;
}

function renderCanvasVideoContent(container, videoObj) {
    const isYoutube = videoObj.sourceType === 'youtube';
    const embedSrc = videoObj.embedUrl || (videoObj.externalId ? buildYoutubeEmbedUrl(videoObj.externalId) : null);
    const videoSource = videoObj.sourceType === 'url'
        ? videoObj.sourceUrl
        : (videoObj.data ? `data:${videoObj.mimeType};base64,${videoObj.data}` : null);
    const posterAttr = videoObj.poster ? ` poster="${videoObj.poster}"` : '';
    const buttonTitle = isYoutube ? 'Open video in new tab' : 'Download video';
    const buttonIcon = isYoutube ? '🔗' : '⬇️';

    let mediaMarkup = '';
    const videoLabel = formatVideoRef(videoObj.id);

    if (isYoutube && embedSrc) {
        mediaMarkup = `
            <iframe src="${embedSrc}" title="YouTube video ${videoLabel}" frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen></iframe>
        `;
    } else if (videoSource) {
        mediaMarkup = `
            <video controls loop${posterAttr}>
                <source src="${videoSource}" type="${videoObj.mimeType || 'video/mp4'}">
                Your browser does not support video playback.
            </video>
        `;
    } else {
        mediaMarkup = `
            <div class="video-error">
                Unable to load video source.
            </div>
        `;
    }

    container.innerHTML = `
        <div class="media-header">
            <div class="media-header-drag-handle">⠿</div>
            <div class="media-header-id">${videoLabel}</div>
            <div class="media-header-controls">
                <button class="media-header-btn image-control" title="Copy prompt" aria-label="Copy prompt ${videoLabel}" onclick="copyVideoPrompt(event, ${videoObj.id})">💬</button>
                <button class="media-header-btn image-control" title="${buttonTitle}" aria-label="${buttonTitle} ${videoLabel}" onclick="downloadVideo(event, ${videoObj.id})">${buttonIcon}</button>
            </div>
        </div>
        ${mediaMarkup}
    `;
}

// ============================================================================
// AUDIO GENERATION FUNCTIONS
// ============================================================================

/**
 * Audio canvas sizes (compact audio player)
 */
const AUDIO_CANVAS_SIZES = {
    default: [350, 100]  // Compact audio player
};

/**
 * Add audio to canvas
 * @param {string} audioData - Base64 encoded audio data
 * @param {string} mimeType - Audio MIME type (audio/mp3, audio/wav, etc.)
 * @param {string} text - Text that was converted to speech
 * @param {number} duration - Audio duration in seconds (optional)
 * @returns {Object} Audio object
 */
function addAudioToCanvas(audioData, mimeType, text = 'No text', duration = null, options = {}) {
    const audioEl = document.createElement('div');
    audioEl.className = 'canvas-audio';
    const [defaultWidth, defaultHeight] = AUDIO_CANVAS_SIZES.default;
    const width = options.width || defaultWidth;
    const height = options.height || defaultHeight;

    const SPACING_X = 40;
    const SPACING_Y = 40;
    const MAX_ROW_WIDTH = 1600;

    let nextX;
    let nextY;

    if (options.position && typeof options.position.x === 'number' && typeof options.position.y === 'number') {
        if (options.position.align === 'center') {
            nextX = options.position.x - (width / 2);
            nextY = options.position.y - (height / 2);
        } else {
            nextX = options.position.x;
            nextY = options.position.y;
        }
    } else {
        nextX = lastGeneratedPosition.x;
        nextY = lastGeneratedPosition.y;

        if (canvasState.images.length === 0 && canvasState.videos.length === 0 && canvasState.audios.length === 0) {
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

    audioEl.style.left = `${nextX}px`;
    audioEl.style.top = `${nextY}px`;
    audioEl.style.width = `${width}px`;
    audioEl.style.height = `${height}px`;
    const currentId = audioCounter++;

    const resolvedDuration = (typeof duration === 'number' && Number.isFinite(duration))
        ? duration
        : null;

    const audioObj = {
        id: currentId,
        type: 'audio',
        element: audioEl,
        x: Number(audioEl.style.left.replace('px', '')),
        y: Number(audioEl.style.top.replace('px', '')),
        width,
        height,
        data: audioData || null,
        mimeType: mimeType || 'audio/mp3',
        text: text,
        duration: resolvedDuration,
        voiceId: options.voiceId || null,
        config: options.config || {}
    };

    renderCanvasAudioContent(audioEl, audioObj);

    canvasState.audios.push(audioObj);
    canvas.appendChild(audioEl);

    lastGeneratedPosition = {
        x: audioObj.x,
        y: audioObj.y
    };

    attachCanvasAudioEvents(audioEl, audioObj);

    updateCanvasStats();
    commitHistorySnapshot();
    debouncedSave({ immediate: true });
    return audioObj;
}

function renderCanvasAudioContent(container, audioObj) {
    const audioSource = audioObj.data ? `data:${audioObj.mimeType};base64,${audioObj.data}` : null;
    const audioLabel = formatAudioRef(audioObj.id);
    const truncatedText = audioObj.text.length > 40
        ? audioObj.text.substring(0, 40) + '...'
        : audioObj.text;

    let mediaMarkup = '';

    if (audioSource) {
        mediaMarkup = `
            <div class="audio-player-wrapper">
                <audio class="audio-player" preload="metadata">
                    <source src="${audioSource}" type="${audioObj.mimeType || 'audio/mp3'}">
                    Your browser does not support audio playback.
                </audio>
                <div class="audio-controls">
                    <button class="audio-play-btn" title="Play/Pause">▶️</button>
                    <div class="audio-info">
                        <div class="audio-text" title="${audioObj.text}">${truncatedText}</div>
                        <div class="audio-progress-container">
                            <input type="range" class="audio-seekbar" min="0" max="100" value="0" step="0.1">
                        </div>
                        <div class="audio-time">
                            <span class="audio-current-time">0:00</span> /
                            <span class="audio-duration">0:00</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        mediaMarkup = `
            <div class="audio-error">
                Unable to load audio source.
            </div>
        `;
    }

    container.innerHTML = `
        <div class="media-header">
            <div class="media-header-drag-handle">⠿</div>
            <div class="media-header-id">${audioLabel}</div>
            <div class="media-header-controls">
                <button class="media-header-btn audio-control" title="Download audio" aria-label="Download audio ${audioLabel}" onclick="downloadAudio(event, ${audioObj.id})">⬇️</button>
            </div>
        </div>
        ${mediaMarkup}
    `;
}

function attachCanvasAudioEvents(audioEl, audioObj) {
    const audioPlayer = audioEl.querySelector('.audio-player');
    const playBtn = audioEl.querySelector('.audio-play-btn');
    const seekbar = audioEl.querySelector('.audio-seekbar');
    const currentTimeSpan = audioEl.querySelector('.audio-current-time');
    const durationSpan = audioEl.querySelector('.audio-duration');

    if (!audioPlayer || !playBtn) return;

    let isSeeking = false;

    // Update duration when metadata loads
    audioPlayer.addEventListener('loadedmetadata', () => {
        const duration = audioPlayer.duration;
        if (duration && Number.isFinite(duration)) {
            durationSpan.textContent = formatAudioTime(duration);
            if (seekbar) {
                seekbar.max = duration;
            }
            if (!audioObj.duration) {
                audioObj.duration = duration;
            }
        }
    });

    // Update current time and seekbar during playback
    audioPlayer.addEventListener('timeupdate', () => {
        if (!isSeeking) {
            currentTimeSpan.textContent = formatAudioTime(audioPlayer.currentTime);
            if (seekbar) {
                seekbar.value = audioPlayer.currentTime;
            }
        }
    });

    // Handle seekbar interaction
    if (seekbar) {
        // When user starts interacting with seekbar
        seekbar.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isSeeking = true;
        });

        // Update time display while dragging
        seekbar.addEventListener('input', (e) => {
            e.stopPropagation();
            const seekTime = parseFloat(seekbar.value);
            currentTimeSpan.textContent = formatAudioTime(seekTime);
        });

        // Seek to new position when user releases or clicks
        seekbar.addEventListener('change', (e) => {
            e.stopPropagation();
            const seekTime = parseFloat(seekbar.value);
            audioPlayer.currentTime = seekTime;
            isSeeking = false;
        });

        // Handle mouseup outside the seekbar
        seekbar.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            isSeeking = false;
        });
    }

    // Play/pause button
    playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (audioPlayer.paused) {
            audioPlayer.play();
            playBtn.textContent = '⏸️';
            playBtn.title = 'Pause';
        } else {
            audioPlayer.pause();
            playBtn.textContent = '▶️';
            playBtn.title = 'Play';
        }
    });

    // Reset button when audio ends
    audioPlayer.addEventListener('ended', () => {
        playBtn.textContent = '▶️';
        playBtn.title = 'Play';
    });

    // Handle drag events (similar to video drag handling)
    audioEl.addEventListener('mousedown', (e) => {
        // Allow audio controls to work
        if (
            e.target.closest('.audio-control') ||
            e.target.closest('.audio-play-btn') ||
            e.target.closest('.audio-seekbar') ||
            e.target.tagName === 'AUDIO'
        ) {
            e.stopPropagation();
            return;
        }

        // Only allow dragging from the header
        const header = e.target.closest('.media-header');
        if (!header) {
            return;
        }

        e.stopPropagation();
        const isSelected = selectAudio(audioObj, {
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
            items: activeSelection.map(item => ({
                image: item,  // Keep this name for compatibility
                offsetX: pointer.x - item.x,
                offsetY: pointer.y - item.y
            }))
        };
        dragMoved = false;
    });
}

function formatAudioTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatAudioRef(id) {
    return `@a${id}`;
}

function downloadAudio(event, audioId) {
    event.stopPropagation();
    const audio = canvasState.audios.find(a => a.id === audioId);
    if (!audio || !audio.data) {
        console.warn('Audio not found or has no data:', audioId);
        return;
    }

    try {
        const audioBlob = base64ToBlob(audio.data, audio.mimeType);
        const url = URL.createObjectURL(audioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audio-${audioId}.${audio.mimeType.split('/')[1] || 'mp3'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading audio:', error);
        addChatMessage(`Error downloading audio: ${error.message}`, 'error');
    }
}

/**
 * Add a text note to canvas
 * @param {string} text - Initial note text
 * @param {Object} position - Optional position {x, y}
 * @returns {Object} Note object
 */
function addNoteToCanvas(text = 'Double-click to edit...', position = null, options = {}) {
    const noteEl = document.createElement('div');
    noteEl.className = 'canvas-note';

    const placeholderText = typeof text === 'string' ? text : '';
    const noteBody = placeholderText === 'Double-click to edit...' ? '' : placeholderText;

    const requestedWidth = Number.isFinite(options.width) ? options.width : null;
    const requestedHeight = Number.isFinite(options.height) ? options.height : null;
    const width = Math.max(NOTE_MIN_WIDTH, requestedWidth || DEFAULT_NOTE_WIDTH);
    const height = Math.max(NOTE_MIN_HEIGHT, requestedHeight || DEFAULT_NOTE_HEIGHT);
    
    const SPACING_X = 40;
    const SPACING_Y = 40;
    const MAX_ROW_WIDTH = 1600;

    let nextX, nextY;

    // Use provided position if available
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

        if (canvasState.images.length === 0 && canvasState.videos.length === 0 && canvasState.notes.length === 0) {
            nextX = 50;
            nextY = 50;
        } else {
            nextX = lastGeneratedPosition.x + width + SPACING_X;
            nextY = lastGeneratedPosition.y;

            if (nextX > MAX_ROW_WIDTH) {
                nextX = 50;
                nextY = lastGeneratedPosition.y + DEFAULT_NOTE_HEIGHT + SPACING_Y;
            }
        }
    }

    noteEl.style.left = `${nextX}px`;
    noteEl.style.top = `${nextY}px`;
    noteEl.style.width = `${width}px`;
    noteEl.style.height = `${height}px`;
    noteEl.style.minWidth = `${NOTE_MIN_WIDTH}px`;
    noteEl.style.minHeight = `${NOTE_MIN_HEIGHT}px`;

    const currentId = noteCounter++;
    const noteLabel = formatNoteRef(currentId);
    noteEl.innerHTML = `
        <div class="media-header note-header">
            <div class="media-header-drag-handle">⠿</div>
            <div class="media-header-id">📝 ${noteLabel}</div>
            <div class="media-header-controls">
                <button class="media-header-btn image-control" title="Generate image from note" aria-label="Generate image from note ${noteLabel}" onclick="generateImageFromNote(event, ${currentId})">🎨</button>
                <button class="media-header-btn image-control" title="Delete note" aria-label="Delete note ${noteLabel}" onclick="deleteNote(event, ${currentId})">🗑️</button>
            </div>
        </div>
        <div class="note-content" contenteditable="true" data-note-id="${currentId}"></div>
        <div class="note-resize-handle" data-note-id="${currentId}" aria-hidden="true"></div>
    `;

    const contentEl = noteEl.querySelector('.note-content');
    if (contentEl) {
        contentEl.textContent = noteBody;
    }

    const noteObj = {
        id: currentId,
        type: 'note',
        element: noteEl,
        x: nextX,
        y: nextY,
        width,
        height,
        text: noteBody
    };

    canvasState.notes.push(noteObj);
    canvas.appendChild(noteEl);

    // Only update lastGeneratedPosition if we used automatic positioning
    // (position was not explicitly provided)
    if (!position || (position.x === undefined && position.y === undefined)) {
        lastGeneratedPosition = {
            x: noteObj.x,
            y: noteObj.y
        };
    }

    attachCanvasNoteEvents(noteEl, noteObj);

    updateCanvasStats();
    commitHistorySnapshot();
    debouncedSave({ immediate: true });
    return noteObj;
}

/**
 * Attach event handlers to note elements
 */
function attachCanvasNoteEvents(element, noteObj) {
    element.addEventListener('mousedown', (e) => {
        // Allow delete button to work
        if (e.target.closest('.image-control')) {
            e.stopPropagation();
            return;
        }
        
        // Allow editing the note content
        if (e.target.classList.contains('note-content')) {
            e.stopPropagation();
            return;
        }
        
        if (e.target.classList.contains('note-resize-handle')) {
            e.stopPropagation();
            return;
        }
        
        // Only allow dragging from the header
        const header = e.target.closest('.media-header');
        if (!header) {
            return;
        }
        
        e.stopPropagation();
        const isSelected = selectNote(noteObj, {
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
            items: activeSelection.map(item => ({
                image: item,  // Keep this name for compatibility
                offsetX: pointer.x - item.x,
                offsetY: pointer.y - item.y
            }))
        };
        dragMoved = false;
    });

    element.addEventListener('dblclick', (e) => {
        if (e.target.classList.contains('note-content')) {
            return;
        }

        const noteContentElement = element.querySelector('.note-content');
        if (!noteContentElement) return;

        e.preventDefault();
        e.stopPropagation();
        selectNote(noteObj, { additive: e.shiftKey, toggle: false });
        focusNoteEditor(noteContentElement);
    });

    // Save note content on blur
    const noteContent = element.querySelector('.note-content');
    if (noteContent) {
        noteContent.addEventListener('mousedown', (event) => {
            event.stopPropagation();
            selectNote(noteObj, { additive: false, toggle: false });
        });

        noteContent.addEventListener('blur', () => {
            noteObj.text = noteContent.textContent;
            debouncedSave({ immediate: true });
        });
        
        noteContent.addEventListener('input', () => {
            noteObj.text = noteContent.textContent;
        });

        noteContent.addEventListener('focus', () => {
            selectNote(noteObj, { additive: false, toggle: false });
        });
    }

    const resizeHandle = element.querySelector('.note-resize-handle');
    if (resizeHandle) {
        const startResize = (event) => {
            event.preventDefault();
            event.stopPropagation();

            selectNote(noteObj, { additive: event.shiftKey, toggle: false });

            const startX = event.clientX;
            const startY = event.clientY;
            const startWidth = noteObj.width;
            const startHeight = noteObj.height;
            let resized = false;

            element.classList.add('resizing');

            const onMove = (moveEvent) => {
                const deltaX = (moveEvent.clientX - startX) / canvasState.zoom;
                const deltaY = (moveEvent.clientY - startY) / canvasState.zoom;

                const nextWidth = Math.max(NOTE_MIN_WIDTH, Math.round(startWidth + deltaX));
                const nextHeight = Math.max(NOTE_MIN_HEIGHT, Math.round(startHeight + deltaY));

                if (nextWidth !== noteObj.width || nextHeight !== noteObj.height) {
                    resized = true;
                    noteObj.width = nextWidth;
                    noteObj.height = nextHeight;

                    element.style.width = `${nextWidth}px`;
                    element.style.height = `${nextHeight}px`;
                }
            };

            const onEnd = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onEnd);
                element.classList.remove('resizing');

                if (resized) {
                    commitHistorySnapshot();
                    debouncedSave({ immediate: true });
                }
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);
        };

        resizeHandle.addEventListener('mousedown', startResize);
    }
}

function focusNoteEditor(noteContentElement) {
    if (!noteContentElement) return;
    try {
        noteContentElement.focus({ preventScroll: true });
    } catch (error) {
        noteContentElement.focus();
    }

    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(noteContentElement);
    range.collapse(false);

    selection.removeAllRanges();
    selection.addRange(range);
}

/**
 * Select note (similar to image/video selection)
 */
function selectNote(noteObj, options = {}) {
    return selectImage(noteObj, options);
}

/**
 * Delete a specific note
 */
function deleteNote(event, id) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const noteObj = canvasState.notes.find(note => note.id === id);
    if (!noteObj) return;

    noteObj.element.remove();
    canvasState.notes = canvasState.notes.filter(note => note.id !== id);

    selectedImages.delete(noteObj);
    updateCanvasStats();
    updateDeleteButtonState();
    commitHistorySnapshot();
    debouncedSave({ immediate: true });
}

async function generateImageFromNote(event, id) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const apiKey = document.getElementById('apiKey').value.trim();

    const noteObj = canvasState.notes.find(note => note.id === id);
    if (!noteObj) {
        addChatMessage(`⚠️ Note ${formatNoteRef(id)} not found on canvas.`, 'system');
        return;
    }

    const prompt = (noteObj.text || '').trim();
    if (!prompt) {
        showError('Add text to the note before generating an image.');
        const noteEditor = noteObj.element?.querySelector('.note-content');
        if (noteEditor) {
            focusNoteEditor(noteEditor);
        }
        return;
    }

    const requestId = ++requestSequence;
    startRequestStatus(requestId, `Queued — generating image from Note ${formatNoteRef(id)}`);

    try {
        updateRequestStatus(requestId, 'running', 'Preparing note prompt...');
        addRequestLog(requestId, '📝', `Using Note ${formatNoteRef(id)} text as prompt.`);

        const aspectRatio = getClosestAspectRatioLabel(noteObj.width, noteObj.height);
        addRequestLog(requestId, '📐', `Aspect ratio: ${aspectRatio}`);

        const placeholder = addImagePlaceholder(requestId, prompt, aspectRatio);
        addRequestLog(requestId, '🎨', 'Generating image from note...');
        updateRequestStatus(requestId, 'running', 'Calling Gemini image API');

        const generatedImage = await generateSingleImage(
            apiKey,
            requestId,
            prompt,
            1,
            1,
            null,
            aspectRatio,
            [],
            placeholder
        );

        if (generatedImage) {
            addRequestLog(requestId, '✅', `Image generated from Note ${formatNoteRef(id)} as ${formatImageRef(generatedImage.id)}.`);
            updateRequestStatus(requestId, 'success', 'Image generated from note');
        } else {
            addRequestLog(requestId, '❌', `Failed to generate image from Note ${formatNoteRef(id)}.`);
            updateRequestStatus(requestId, 'error', 'Image generation failed');
        }
    } catch (error) {
        console.error('Error generating image from note:', error);
        updateRequestStatus(requestId, 'error', error.message || 'Image generation failed');
        showError(error.message || 'Failed to generate image from note.');
        addChatMessage(
            `❌ ${requestLabel(requestId)} — ${error.message || 'Failed to generate image from note.'}`,
            'assistant',
            { requestId }
        );
    } finally {
        completeRequestStatus(requestId);
    }
}

/**
 * Attach event handlers to video elements
 */
function attachCanvasVideoEvents(element, videoObj) {
    element.addEventListener('mousedown', (e) => {
        // Allow video controls and download button to work
        if (
            e.target.closest('.image-control') ||
            e.target.tagName === 'VIDEO' ||
            e.target.tagName === 'IFRAME'
        ) {
            e.stopPropagation();
            return;
        }
        
        // Only allow dragging from the header
        const header = e.target.closest('.media-header');
        if (!header) {
            return;
        }
        
        e.stopPropagation();
        const isSelected = selectVideo(videoObj, {
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
            items: activeSelection.map(item => ({
                image: item,  // Keep this name for compatibility
                offsetX: pointer.x - item.x,
                offsetY: pointer.y - item.y
            }))
        };
        dragMoved = false;
    });

    element.addEventListener('mouseenter', (e) => showVideoTooltip(e, videoObj));
    element.addEventListener('mouseleave', hideImageTooltip);
}

/**
 * Select video (similar to image selection)
 */
function selectVideo(videoObj, options = {}) {
    // For now, treat videos like images in selection
    // Future: could have separate video selection logic
    return selectImage(videoObj, options);
}

/**
 * Select audio (similar to image/video selection)
 */
function selectAudio(audioObj, options = {}) {
    return selectImage(audioObj, options);
}

/**
 * Show video tooltip
 */
function showVideoTooltip(e, videoObj) {
    hideImageTooltip();
    
    tooltip = document.createElement('div');
    tooltip.className = 'image-tooltip show';
    const durationLabel = (typeof videoObj.duration === 'number' && Number.isFinite(videoObj.duration))
        ? `${videoObj.duration}s`
        : 'Unknown';
    const sourceLabel = videoObj.sourceType === 'youtube'
        ? 'YouTube'
        : (videoObj.sourceType === 'url' ? 'External URL' : 'Embedded');
    const sourceDetail = videoObj.sourceUrl
        ? `<br>Source: ${formatUrlForChat(videoObj.sourceUrl)}`
        : '';
    
    tooltip.innerHTML = `
        <div class="tooltip-title">Video ${formatVideoRef(videoObj.id)}</div>
        <div class="tooltip-prompt">"${videoObj.prompt}"</div>
        <div class="tooltip-meta">
            Duration: ${durationLabel}<br>
            Aspect Ratio: ${videoObj.aspectRatio}<br>
            Format: ${videoObj.mimeType || 'video/mp4'}<br>
            Source: ${sourceLabel}${sourceDetail}
        </div>
    `;
    
    document.body.appendChild(tooltip);
    
    const rect = videoObj.element.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${rect.right + 10}px`;
    tooltip.style.top = `${rect.top}px`;
    
    const tooltipRect = tooltip.getBoundingClientRect();
    if (tooltipRect.right > window.innerWidth) {
        tooltip.style.left = `${rect.left - tooltipRect.width - 10}px`;
    }
    if (tooltipRect.bottom > window.innerHeight) {
        tooltip.style.top = `${window.innerHeight - tooltipRect.height - 10}px`;
    }
}

/**
 * Download video
 */
function downloadVideo(event, id) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const videoObj = canvasState.videos.find(vid => vid.id === id);
    if (!videoObj) return;

    if (videoObj.sourceType === 'youtube') {
        const targetUrl = videoObj.sourceUrl || (videoObj.externalId ? `https://youtu.be/${videoObj.externalId}` : videoObj.embedUrl);
        if (targetUrl) {
            window.open(targetUrl, '_blank', 'noopener');
        } else {
            addChatMessage('⚠️ Unable to open YouTube video. Source URL missing.', 'system');
        }
        return;
    }

    if (videoObj.sourceType === 'url' && videoObj.sourceUrl) {
        const link = document.createElement('a');
        link.href = videoObj.sourceUrl;
        link.download = `canvas-agent-video-${id}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    if (videoObj.data) {
        const link = document.createElement('a');
        link.href = `data:${videoObj.mimeType};base64,${videoObj.data}`;
        link.download = `canvas-agent-video-${id}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    addChatMessage('⚠️ Video data unavailable for download.', 'system');
}

async function copyVideoPrompt(event, id) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const videoObj = canvasState.videos.find(vid => vid.id === id);
    if (!videoObj) {
        addChatMessage('⚠️ Video not found', 'system');
        return;
    }

    try {
        // Check if clipboard API is available
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            addChatMessage('⚠️ Clipboard API not supported in this browser', 'system');
            return;
        }

        const prompt = videoObj.prompt || '';
        if (!prompt) {
            addChatMessage('⚠️ No prompt available for this video', 'system');
            return;
        }

        // Copy prompt text to clipboard
        await navigator.clipboard.writeText(prompt);

        const videoLabel = formatVideoRef(id);
        addChatMessage(`✓ Prompt for ${videoLabel} copied to clipboard`, 'system');
    } catch (error) {
        console.error('Failed to copy prompt:', error);
        addChatMessage(`⚠️ Failed to copy prompt: ${error.message}`, 'system');
    }
}

/**
 * Generate video using Gemini 2.0 Flash
 * @param {number} requestId - Request tracking ID
 * @param {string} prompt - Video generation prompt
 * @param {Object} config - Video configuration
 * @param {number} currentIndex - Current video index (for batch generation)
 * @param {number} totalCount - Total number of videos being generated
 */
async function generateVideo(requestId, prompt, config = {}, currentIndex = 1, totalCount = 1) {
    const apiKey = document.getElementById('apiKey')?.value?.trim() || '';
    
    if (!apiKey) {
        throw new Error('Video generation requires a Gemini API key. Please add your API key in Settings.');
    }

    const indexLabel = totalCount > 1 ? ` ${currentIndex}/${totalCount}` : '';
    
    try {
        updateRequestStatus(requestId, 'running', `Generating video${indexLabel}...`);
        addRequestLog(requestId, '🎬', `Video${indexLabel}: "${prompt}"`);

        // Configure video parameters
        const aspectRatio = config.aspectRatio || '16:9';
        const duration = config.durationSeconds || 4;
        
        // Build Gemini 2.0 Flash video generation request
        const payload = {
            contents: [{
                role: 'user',
                parts: [{
                    text: `Generate a ${duration}-second video with ${aspectRatio} aspect ratio: ${prompt}`
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024
            }
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `Video generation failed: ${response.status}`);
        }

        const result = await response.json();
        
        // For now, show that video generation was attempted
        // Note: Actual video generation with Gemini 2.0 Flash may require different API endpoints
        addRequestLog(requestId, '⚠️', `Video generation attempted but may require updated API endpoint`);
        updateRequestStatus(requestId, 'error', 'Video generation needs API endpoint verification');
        
        console.log('Video generation response:', result);
        
    } catch (error) {
        console.error('[Video] Generation failed:', error);
        addRequestLog(requestId, '❌', `Video${indexLabel} generation failed: ${error.message}`);
        updateRequestStatus(requestId, 'error', error.message);
        throw error;
    }
}

/**
 * Generate video from image (image-to-video)
 * @param {number} requestId - Request tracking ID
 * @param {Object} sourceImage - Source image object from canvas
 * @param {string} prompt - Optional text prompt for motion/effects
 * @param {Object} config - Video configuration
 * @param {number} currentIndex - Current video index (for batch generation)
 * @param {number} totalCount - Total number of videos being generated
 */
async function generateVideoFromImage(requestId, sourceImage, prompt = '', config = {}, currentIndex = 1, totalCount = 1) {
    // Check if user has API key configured
    const apiKey = document.getElementById('apiKey')?.value?.trim() || '';

    if (!apiKey) {
        const indexLabel = totalCount > 1 ? ` ${currentIndex}/${totalCount}` : '';
        addRequestLog(requestId, '⚠️', `Image-to-video generation${indexLabel} requires an API key`);
        addRequestLog(requestId, 'ℹ️', 'Please configure your Gemini API key in settings');
        updateRequestStatus(requestId, 'error', 'API key required for image-to-video generation');
        throw new Error('Image-to-video generation requires an API key. Please configure your Gemini API key in settings.');
    }

    let placeholder = null;

    try {
        const indexLabel = totalCount > 1 ? ` ${currentIndex}/${totalCount}` : '';
        const sourceLabel = formatImageRef(sourceImage.id);

        addRequestLog(requestId, '🎬', `Starting Veo 3 image-to-video generation${indexLabel} from ${sourceLabel}`);
        addRequestLog(requestId, '📝', `Prompt: "${prompt || '(motion from image)'}"`);

        // Default configuration
        const videoConfig = {
            aspectRatio: config.aspectRatio || '9:16',
            durationSeconds: config.durationSeconds || 8,
            resolution: config.resolution || '720p',
            enhancePrompt: config.enhancePrompt !== false,
            generateAudio: config.generateAudio !== false
        };

        addRequestLog(requestId, '⚙️', `Config: ${videoConfig.durationSeconds}s, ${videoConfig.aspectRatio}, ${videoConfig.resolution}, audio=${videoConfig.generateAudio}`);
        addRequestLog(requestId, '🖼️', `Source: ${sourceLabel} (${sourceImage.resolution || 'unknown'}, ${sourceImage.aspectRatio || 'unknown'})`);

        // Create placeholder
        placeholder = addVideoPlaceholder(requestId, `Video from ${sourceLabel}`, config);
        updateRequestStatus(requestId, 'running', `Preparing image${indexLabel}...`);

        // Step 1: Prepare image data (use inline base64, not fileUri)
        addRequestLog(requestId, '🖼️', 'Preparing image data for video generation...');

        // Step 2: Start video generation with image
        const model = config.model || 'veo-3.1-fast-generate-preview';

        const requestBody = {
            instances: [{
                prompt: prompt || '',
                image: {
                    bytesBase64Encoded: sourceImage.data,
                    mimeType: sourceImage.mimeType || 'image/png'
                }
            }],
            parameters: {
                aspectRatio: videoConfig.aspectRatio,
                durationSeconds: videoConfig.durationSeconds,
                resolution: videoConfig.resolution
            }
        };

        // Add negative prompt if provided
        if (config.negativePrompt && config.negativePrompt.trim()) {
            requestBody.parameters.negativePrompt = config.negativePrompt.trim();
        }

        addRequestLog(requestId, '🎬', 'Starting video generation from image...');
        updateRequestStatus(requestId, 'running', `Generating video${indexLabel}...`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Failed to start image-to-video generation';
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.error?.message || errorData.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        const operationName = result.name;

        if (!operationName) {
            throw new Error('No operation name returned from Gemini API');
        }

        console.log('✅ [Veo3 Image-to-Video] Video generation started:', operationName);
        addRequestLog(requestId, '⏳', `Video generation from image started (operation: ${operationName.split('/').pop()})`);
        addRequestLog(requestId, 'ℹ️', 'Estimated time: 30s-6min');

        // Step 3: Poll operation status
        const POLL_INTERVAL = 10000; // 10 seconds
        const MAX_POLLS = 60; // 10 minutes max
        let pollCount = 0;
        let done = false;
        let operationResult = null;

        while (!done && pollCount < MAX_POLLS) {
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            pollCount++;

            const operation = await pollVeo3Operation(apiKey, operationName);
            done = operation.done === true;

            const estimatedProgress = Math.min(Math.floor((pollCount / MAX_POLLS) * 100), 95);
            updateRequestStatus(requestId, 'running', `Generating video${indexLabel}... ${estimatedProgress}%`);

            if (placeholder) {
                placeholder.updateProgress(estimatedProgress, 'Generating video from image...');
            }

            console.log(`🔄 [Veo3 Image-to-Video] Poll ${pollCount}/${MAX_POLLS} - Done: ${done}`);

            if (done) {
                operationResult = operation.response;
                break;
            }

            if (operation.error) {
                throw new Error(operation.error.message || 'Video generation failed');
            }
        }

        if (!done) {
            throw new Error('Video generation timed out after 10 minutes');
        }

        if (!operationResult || !operationResult.generateVideoResponse || !operationResult.generateVideoResponse.generatedSamples) {
            throw new Error('Invalid response format from Gemini API');
        }

        // Step 4: Extract and download video
        const sample = operationResult.generateVideoResponse.generatedSamples[0];
        if (!sample || !sample.video || !sample.video.uri) {
            throw new Error('No video URI in response');
        }

        const videoUri = sample.video.uri;
        addRequestLog(requestId, '✅', `Video${indexLabel} generation completed!`);
        addRequestLog(requestId, '📹', `Video URI: ${videoUri}`);
        updateRequestStatus(requestId, 'success', `Video${indexLabel} ready`);

        console.log('📥 [Veo3 Image-to-Video] Downloading video from:', videoUri);
        const videoBlob = await downloadVeo3Video(apiKey, videoUri);

        const reader = new FileReader();
        const videoData = await new Promise((resolve, reject) => {
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(videoBlob);
        });

        console.log('✅ [Veo3 Image-to-Video] Video downloaded successfully, size:', videoBlob.size, 'bytes');

        // Remove placeholder and add video to canvas
        const placeholderPosition = placeholder ? { x: placeholder.x, y: placeholder.y } : null;
        if (placeholder) {
            placeholder.remove();
        }

        const videoObj = addVideoToCanvas(
            videoData,
            'video/mp4',
            `Video from ${sourceLabel}: ${prompt}`,
            videoConfig.aspectRatio,
            videoConfig.durationSeconds,
            placeholderPosition ? { position: placeholderPosition } : {}
        );

        addRequestLog(requestId, '🎬', `Video added to canvas as ${formatVideoRef(videoObj.id)}`);
        addRequestLog(requestId, '💾', `Video saved to canvas`);

        return {
            videoUri,
            videoData,
            mimeType: 'video/mp4',
            prompt,
            config: videoConfig
        };

    } catch (error) {
        console.error('❌ [Veo3 Image-to-Video] Video generation failed:', error);
        addRequestLog(requestId, '❌', `Image-to-video generation failed: ${error.message}`);
        updateRequestStatus(requestId, 'error', error.message);

        if (placeholder) {
            placeholder.showError(error.message);
        }

        throw error;
    }
}

async function generateVideoFromFirstLastFrames(requestId, firstImage, lastImage, prompt = '', config = {}, currentIndex = 1, totalCount = 1) {
    // Check if user has API key configured
    const apiKey = document.getElementById('apiKey')?.value?.trim() || '';

    if (!apiKey) {
        const indexLabel = totalCount > 1 ? ` ${currentIndex}/${totalCount}` : '';
        addRequestLog(requestId, '⚠️', `First/last frame video generation${indexLabel} requires an API key`);
        addRequestLog(requestId, 'ℹ️', 'Please configure your Gemini API key in settings');
        updateRequestStatus(requestId, 'error', 'API key required for first/last frame video generation');
        throw new Error('First/last frame video generation requires an API key. Please configure your Gemini API key in settings.');
    }

    let placeholder = null;

    try {
        const indexLabel = totalCount > 1 ? ` ${currentIndex}/${totalCount}` : '';
        const firstLabel = formatImageRef(firstImage.id);
        const lastLabel = formatImageRef(lastImage.id);

        addRequestLog(requestId, '🎬', `Starting Veo 3 first/last frame video generation${indexLabel}`);
        addRequestLog(requestId, '📝', `Prompt: "${prompt || '(interpolate between frames)'}"`);

        // Default configuration
        const videoConfig = {
            aspectRatio: config.aspectRatio || '9:16',
            durationSeconds: config.durationSeconds || 8,
            resolution: config.resolution || '720p',
            enhancePrompt: config.enhancePrompt !== false,
            generateAudio: config.generateAudio !== false
        };

        addRequestLog(requestId, '⚙️', `Config: ${videoConfig.durationSeconds}s, ${videoConfig.aspectRatio}, ${videoConfig.resolution}, audio=${videoConfig.generateAudio}`);
        addRequestLog(requestId, '🖼️', `First frame: ${firstLabel} (${firstImage.resolution || 'unknown'})`);
        addRequestLog(requestId, '🖼️', `Last frame: ${lastLabel} (${lastImage.resolution || 'unknown'})`);

        // Create placeholder
        placeholder = addVideoPlaceholder(requestId, `Video ${firstLabel} → ${lastLabel}`, config);
        updateRequestStatus(requestId, 'running', `Preparing frames${indexLabel}...`);

        // Step 1: Prepare frame data (use inline base64, not fileUri)
        addRequestLog(requestId, '🖼️', 'Preparing first and last frames for interpolation...');

        // Step 2: Start video generation with first/last frames
        const model = config.model || 'veo-3.1-fast-generate-preview';

        const requestBody = {
            instances: [{
                prompt: prompt || '',
                image: {  // First frame uses 'image' parameter
                    bytesBase64Encoded: firstImage.data,
                    mimeType: firstImage.mimeType || 'image/png'
                },
                lastFrame: {  // Last frame uses 'lastFrame' parameter
                    bytesBase64Encoded: lastImage.data,
                    mimeType: lastImage.mimeType || 'image/png'
                }
            }],
            parameters: {
                aspectRatio: videoConfig.aspectRatio,
                durationSeconds: videoConfig.durationSeconds,
                resolution: videoConfig.resolution
            }
        };

        // Add negative prompt if provided
        if (config.negativePrompt && config.negativePrompt.trim()) {
            requestBody.parameters.negativePrompt = config.negativePrompt.trim();
        }

        addRequestLog(requestId, '🎬', 'Starting video generation from first/last frames...');
        updateRequestStatus(requestId, 'running', `Generating video${indexLabel}...`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Failed to start first/last frame video generation';
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.error?.message || errorData.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        const operationName = result.name;

        if (!operationName) {
            throw new Error('No operation name returned from Gemini API');
        }

        console.log('✅ [Veo3 First/Last Frame] Video generation started:', operationName);
        addRequestLog(requestId, '⏳', `Video generation from frames started (operation: ${operationName.split('/').pop()})`);
        addRequestLog(requestId, 'ℹ️', 'Estimated time: 30s-6min');

        // Step 3: Poll operation status
        const POLL_INTERVAL = 10000; // 10 seconds
        const MAX_POLLS = 60; // 10 minutes max
        let pollCount = 0;
        let done = false;
        let operationResult = null;

        while (!done && pollCount < MAX_POLLS) {
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            pollCount++;

            const operation = await pollVeo3Operation(apiKey, operationName);
            done = operation.done === true;

            const estimatedProgress = Math.min(Math.floor((pollCount / MAX_POLLS) * 100), 95);
            updateRequestStatus(requestId, 'running', `Generating video${indexLabel}... ${estimatedProgress}%`);

            if (placeholder) {
                placeholder.updateProgress(estimatedProgress, 'Interpolating between frames...');
            }

            console.log(`🔄 [Veo3 First/Last Frame] Poll ${pollCount}/${MAX_POLLS} - Done: ${done}`);

            if (done) {
                operationResult = operation.response;
                break;
            }

            if (operation.error) {
                throw new Error(operation.error.message || 'Video generation failed');
            }
        }

        if (!done) {
            throw new Error('Video generation timed out after 10 minutes');
        }

        if (!operationResult || !operationResult.generateVideoResponse || !operationResult.generateVideoResponse.generatedSamples) {
            throw new Error('Invalid response format from Gemini API');
        }

        // Step 4: Extract and download video
        const sample = operationResult.generateVideoResponse.generatedSamples[0];
        if (!sample || !sample.video || !sample.video.uri) {
            throw new Error('No video URI in response');
        }

        const videoUri = sample.video.uri;
        addRequestLog(requestId, '✅', `Video${indexLabel} generation completed!`);
        addRequestLog(requestId, '📹', `Video URI: ${videoUri}`);
        updateRequestStatus(requestId, 'success', `Video${indexLabel} ready`);

        console.log('📥 [Veo3 First/Last Frame] Downloading video from:', videoUri);
        const videoBlob = await downloadVeo3Video(apiKey, videoUri);

        const reader = new FileReader();
        const videoData = await new Promise((resolve, reject) => {
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(videoBlob);
        });

        console.log('✅ [Veo3 First/Last Frame] Video downloaded successfully, size:', videoBlob.size, 'bytes');

        // Remove placeholder and add video to canvas
        const placeholderPosition = placeholder ? { x: placeholder.x, y: placeholder.y } : null;
        if (placeholder) {
            placeholder.remove();
        }

        const videoObj = addVideoToCanvas(
            videoData,
            'video/mp4',
            `Video from ${firstLabel} to ${lastLabel}: ${prompt}`,
            videoConfig.aspectRatio,
            videoConfig.durationSeconds,
            placeholderPosition ? { position: placeholderPosition } : {}
        );

        addRequestLog(requestId, '🎬', `Video added to canvas as ${formatVideoRef(videoObj.id)}`);
        addRequestLog(requestId, '💾', `Video saved to canvas`);

        return {
            videoUri,
            videoData,
            mimeType: 'video/mp4',
            prompt,
            config: videoConfig
        };

    } catch (error) {
        console.error('❌ [Veo3 First/Last Frame] Video generation failed:', error);
        addRequestLog(requestId, '❌', `First/last frame video generation failed: ${error.message}`);
        updateRequestStatus(requestId, 'error', error.message);

        if (placeholder) {
            placeholder.showError(error.message);
        }

        throw error;
    }
}

/**
 * Extend a Veo-generated video by 7 seconds
 * @param {number} requestId - Request tracking ID
 * @param {Object} sourceVideo - Source video object from canvas
 * @param {string} prompt - Text prompt for the extension
 * @param {Object} config - Video configuration
 * @param {number} currentIndex - Current video index (for batch generation)
 * @param {number} totalCount - Total number of videos being generated
 */
async function extendVeo3Video(requestId, sourceVideo, prompt = '', config = {}, currentIndex = 1, totalCount = 1) {
    // Check if user has API key configured
    const apiKey = document.getElementById('apiKey')?.value?.trim() || '';

    if (!apiKey) {
        const indexLabel = totalCount > 1 ? ` ${currentIndex}/${totalCount}` : '';
        addRequestLog(requestId, '⚠️', `Video extension${indexLabel} requires an API key`);
        addRequestLog(requestId, 'ℹ️', 'Please configure your Gemini API key in settings');
        updateRequestStatus(requestId, 'error', 'API key required for video extension');
        throw new Error('Video extension requires an API key. Please configure your Gemini API key in settings.');
    }

    let placeholder = null;

    try {
        const indexLabel = totalCount > 1 ? ` ${currentIndex}/${totalCount}` : '';
        const sourceLabel = formatVideoRef(sourceVideo.id);

        addRequestLog(requestId, '🎬', `Starting Veo 3 video extension${indexLabel} from ${sourceLabel}`);
        addRequestLog(requestId, '📝', `Extension prompt: "${prompt || '(continue the action)'}"`);

        // Video extension config (must be 720p and 8s)
        const videoConfig = {
            aspectRatio: config.aspectRatio || sourceVideo.aspectRatio || '16:9',
            durationSeconds: 8,  // Must be 8 for extensions
            resolution: '720p',  // Must be 720p for extensions
            enhancePrompt: config.enhancePrompt !== false,
            generateAudio: config.generateAudio !== false
        };

        addRequestLog(requestId, '⚙️', `Config: ${videoConfig.durationSeconds}s extension, ${videoConfig.aspectRatio}, ${videoConfig.resolution}`);
        addRequestLog(requestId, '🎥', `Source: ${sourceLabel} (${sourceVideo.duration || 'unknown'}s)`);

        // Create placeholder
        placeholder = addVideoPlaceholder(requestId, `Extended from ${sourceLabel}`, config);
        updateRequestStatus(requestId, 'running', `Uploading video${indexLabel}...`);

        // Step 1: Upload source video to Gemini Files API
        addRequestLog(requestId, '📤', 'Uploading source video to Gemini Files API...');

        const videoFileUri = await uploadVideoBytesToGemini(
            apiKey,
            sourceVideo.data,
            sourceVideo.mimeType || 'video/mp4',
            `Video for extension ${sourceLabel}`,
            { requestId, label: sourceLabel }
        );

        addRequestLog(requestId, '✅', `Video uploaded: ${videoFileUri.split('/').pop()}`);

        // Step 2: Start video extension
        const model = config.model || 'veo-3.1-generate-preview';  // Use quality model for extension

        const requestBody = {
            instances: [{
                prompt: prompt || '',
                video: {
                    fileUri: videoFileUri
                }
            }],
            parameters: {
                aspectRatio: videoConfig.aspectRatio,
                durationSeconds: videoConfig.durationSeconds,
                resolution: videoConfig.resolution
            }
        };

        // Add negative prompt if provided
        if (config.negativePrompt && config.negativePrompt.trim()) {
            requestBody.parameters.negativePrompt = config.negativePrompt.trim();
        }

        addRequestLog(requestId, '🎬', 'Starting video extension...');
        updateRequestStatus(requestId, 'running', `Extending video${indexLabel}...`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Failed to start video extension';
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.error?.message || errorData.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        const operationName = result.name;

        if (!operationName) {
            throw new Error('No operation name returned from Gemini API');
        }

        console.log('✅ [Veo3 Extension] Video extension started:', operationName);
        addRequestLog(requestId, '⏳', `Video extension started (operation: ${operationName.split('/').pop()})`);
        addRequestLog(requestId, 'ℹ️', 'Estimated time: 30s-6min. Extension will add 7 seconds to your video.');

        // Step 3: Poll operation status
        const POLL_INTERVAL = 10000; // 10 seconds
        const MAX_POLLS = 60; // 10 minutes max
        let pollCount = 0;
        let done = false;
        let operationResult = null;

        while (!done && pollCount < MAX_POLLS) {
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            pollCount++;

            const operation = await pollVeo3Operation(apiKey, operationName);
            done = operation.done === true;

            const estimatedProgress = Math.min(Math.floor((pollCount / MAX_POLLS) * 100), 95);
            updateRequestStatus(requestId, 'running', `Extending video${indexLabel}... ${estimatedProgress}%`);

            if (placeholder) {
                placeholder.updateProgress(estimatedProgress, 'Extending video...');
            }

            console.log(`🔄 [Veo3 Extension] Poll ${pollCount}/${MAX_POLLS} - Done: ${done}`);

            if (done) {
                operationResult = operation.response;
                break;
            }

            if (operation.error) {
                throw new Error(operation.error.message || 'Video extension failed');
            }
        }

        if (!done) {
            throw new Error('Video extension timed out after 10 minutes');
        }

        if (!operationResult || !operationResult.generateVideoResponse || !operationResult.generateVideoResponse.generatedSamples) {
            throw new Error('Invalid response format from Gemini API');
        }

        // Step 4: Extract and download extended video
        const sample = operationResult.generateVideoResponse.generatedSamples[0];
        if (!sample || !sample.video || !sample.video.uri) {
            throw new Error('No video URI in response');
        }

        const videoUri = sample.video.uri;
        addRequestLog(requestId, '✅', `Video${indexLabel} extension completed!`);
        addRequestLog(requestId, '📹', `Video URI: ${videoUri}`);
        updateRequestStatus(requestId, 'success', `Video${indexLabel} ready`);

        console.log('📥 [Veo3 Extension] Downloading extended video from:', videoUri);
        const videoBlob = await downloadVeo3Video(apiKey, videoUri);

        const reader = new FileReader();
        const videoData = await new Promise((resolve, reject) => {
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(videoBlob);
        });

        console.log('✅ [Veo3 Extension] Video downloaded successfully, size:', videoBlob.size, 'bytes');

        // Remove placeholder and add extended video to canvas
        const placeholderPosition = placeholder ? { x: placeholder.x, y: placeholder.y } : null;
        if (placeholder) {
            placeholder.remove();
        }

        const videoObj = addVideoToCanvas(
            videoData,
            'video/mp4',
            `Extended ${sourceLabel}: ${prompt}`,
            videoConfig.aspectRatio,
            (sourceVideo.duration || 4) + 7,  // Original duration + 7 seconds
            placeholderPosition ? { position: placeholderPosition } : {}
        );

        addRequestLog(requestId, '🎬', `Extended video added to canvas as ${formatVideoRef(videoObj.id)}`);
        addRequestLog(requestId, '💾', `Video saved to canvas`);
        addRequestLog(requestId, 'ℹ️', `Original duration: ${sourceVideo.duration || 4}s → Extended: ${(sourceVideo.duration || 4) + 7}s`);

        return {
            videoUri,
            videoData,
            mimeType: 'video/mp4',
            prompt,
            config: videoConfig,
            originalDuration: sourceVideo.duration || 4,
            extendedDuration: (sourceVideo.duration || 4) + 7
        };

    } catch (error) {
        console.error('❌ [Veo3 Extension] Video extension failed:', error);
        addRequestLog(requestId, '❌', `Video extension failed: ${error.message}`);
        updateRequestStatus(requestId, 'error', error.message);

        if (placeholder) {
            placeholder.showError(error.message);
        }

        throw error;
    }
}

/**
 * Poll video generation status
 * @param {string} jobId - Job ID from proxy server
 * @param {number} requestId - Request tracking ID
 */
async function pollVideoStatus(jobId, requestId) {
    const POLL_INTERVAL = 5000; // 5 seconds
    const MAX_POLLS = 360; // 30 minutes max
    let pollCount = 0;

    const poll = async () => {
        try {
            pollCount++;

            const response = await fetch(`${VIDEO_PROXY_URL}/api/video/status/${jobId}`);
            
            if (!response.ok) {
                throw new Error('Failed to check video status');
            }

            const status = await response.json();
            
            // Get placeholder if available
            const jobInfo = activeVideoJobs.get(jobId);
            const placeholder = jobInfo?.placeholder;
            const indexLabel = (jobInfo?.totalCount > 1) ? ` ${jobInfo.currentIndex}/${jobInfo.totalCount}` : '';

            // Update progress
            if (status.progress > 0) {
                updateRequestStatus(requestId, 'running', `Generating video${indexLabel}... ${status.progress}%`);
                if (placeholder) {
                    placeholder.updateProgress(status.progress, status.status);
                }
            }

            if (status.status === 'completed' && status.videoData) {
                // Video is ready!
                addRequestLog(requestId, '✅', `Video${indexLabel} generation completed!`);
                updateRequestStatus(requestId, 'success', `Video${indexLabel} ready`);

                // Remove placeholder
                if (placeholder) {
                    placeholder.remove();
                }

                // Add video to canvas
                const videoObj = addVideoToCanvas(
                    status.videoData,
                    'video/mp4',
                    status.prompt,
                    status.config.aspectRatio,
                    status.config.durationSeconds,
                    placeholder ? { position: { x: placeholder.x, y: placeholder.y } } : {}
                );

                // Show prompt in chat
                addRequestLog(requestId, '🎬', `Video added to canvas as ${formatVideoRef(videoObj.id)}`);
                addRequestLog(requestId, '📝', `Prompt: "${status.prompt}"`);
                addRequestLog(requestId, 'ℹ️', `Duration: ${status.config.durationSeconds}s | Aspect Ratio: ${status.config.aspectRatio}`);
                
                // Clean up
                activeVideoJobs.delete(jobId);
                return;
            }

            if (status.status === 'failed') {
                throw new Error(status.error || 'Video generation failed');
            }

            // Continue polling if still processing
            if (pollCount < MAX_POLLS && (status.status === 'queued' || status.status === 'processing')) {
                setTimeout(poll, POLL_INTERVAL);
            } else if (pollCount >= MAX_POLLS) {
                throw new Error('Video generation timed out after 30 minutes');
            }

        } catch (error) {
            console.error('Error polling video status:', error);
            addRequestLog(requestId, '❌', `Video polling error: ${error.message}`);
            updateRequestStatus(requestId, 'error', error.message);

            // Show error on placeholder
            const jobInfo = activeVideoJobs.get(jobId);
            if (jobInfo?.placeholder) {
                jobInfo.placeholder.showError(error.message);
            }

            activeVideoJobs.delete(jobId);
        }
    };

    // Start polling
    poll();
}

// ============================================================================
// VEO 3 VIDEO GENERATION FUNCTIONS (Direct Gemini API calls)
// ============================================================================

/**
 * Generate video using Veo 3 with direct Gemini API calls
 * @param {number} requestId - Request tracking ID
 * @param {string} apiKey - User's Gemini API key
 * @param {string} prompt - Text prompt for video generation
 * @param {Object} config - Video configuration options
 * @param {number} currentIndex - Current video index (for batch generation)
 * @param {number} totalCount - Total number of videos being generated
 * @returns {Promise<string>} Operation name for polling
 */
async function generateVideoVeo3(requestId, apiKey, prompt = '', config = {}, currentIndex = 1, totalCount = 1) {
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        throw new Error('Video generation requires an API key. Please configure your Gemini API key in settings.');
    }

    const trimmedKey = apiKey.trim();
    const indexLabel = totalCount > 1 ? ` ${currentIndex}/${totalCount}` : '';

    // Default configuration
    const videoConfig = {
        aspectRatio: config.aspectRatio || '16:9',
        durationSeconds: config.durationSeconds || 8,  // Default to 8 seconds
        resolution: config.resolution || '720p',
        enhancePrompt: config.enhancePrompt !== false,
        generateAudio: config.generateAudio !== false
    };

    // Model selection - default to fast for better UX
    const model = config.model || 'veo-3.1-fast-generate-preview';

    // Build API request body according to Gemini docs
    const requestBody = {
        instances: [{
            prompt: prompt
        }],
        parameters: {
            aspectRatio: videoConfig.aspectRatio,
            durationSeconds: videoConfig.durationSeconds,  // Must be a number, not string
            resolution: videoConfig.resolution
        }
    };

    // Add negative prompt if provided
    if (config.negativePrompt && config.negativePrompt.trim()) {
        requestBody.parameters.negativePrompt = config.negativePrompt.trim();
    }

    // Log the request
    addRequestLog(requestId, '🎬', `Starting Veo 3 video generation${indexLabel}`);
    addRequestLog(requestId, '📝', `Prompt: "${prompt}"`);
    addRequestLog(requestId, '🤖', `Model: ${model}`);
    addRequestLog(requestId, '⚙️', `Config: ${videoConfig.durationSeconds}s, ${videoConfig.aspectRatio}, ${videoConfig.resolution}, audio=${videoConfig.generateAudio}`);
    if (config.negativePrompt) {
        addRequestLog(requestId, '🚫', `Negative: "${config.negativePrompt}"`);
    }
    updateRequestStatus(requestId, 'running', `Starting video${indexLabel} generation...`);

    try {
        // Call Gemini API predictLongRunning endpoint
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning`;

        console.log('📤 [Veo3] Starting video generation:', {
            model,
            prompt: prompt.substring(0, 100) + '...',
            config: videoConfig
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': trimmedKey
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Failed to start video generation';

            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.error?.message || errorData.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();
        const operationName = result.name;

        if (!operationName) {
            throw new Error('No operation name returned from Gemini API');
        }

        console.log('✅ [Veo3] Video generation started:', operationName);
        addRequestLog(requestId, '⏳', `Video generation started (operation: ${operationName.split('/').pop()})`);
        addRequestLog(requestId, 'ℹ️', 'Estimated time: 30s-6min depending on complexity');

        return operationName;

    } catch (error) {
        console.error('❌ [Veo3] Failed to start video generation:', error);
        addRequestLog(requestId, '❌', `Video generation failed to start: ${error.message}`);
        updateRequestStatus(requestId, 'error', error.message);
        throw error;
    }
}

/**
 * Poll Veo 3 operation status
 * @param {string} apiKey - User's Gemini API key
 * @param {string} operationName - Operation name from generateVideoVeo3
 * @returns {Promise<Object>} Operation status object
 */
async function pollVeo3Operation(apiKey, operationName) {
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        throw new Error('API key is required to poll operation status');
    }

    if (!operationName || typeof operationName !== 'string') {
        throw new Error('Operation name is required');
    }

    const trimmedKey = apiKey.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/${operationName}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-goog-api-key': trimmedKey
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Failed to poll operation status';

            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.error?.message || errorData.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();
        return result;

    } catch (error) {
        console.error('❌ [Veo3] Failed to poll operation:', error);
        throw error;
    }
}

/**
 * Download video file from Gemini Files API
 * @param {string} apiKey - User's Gemini API key
 * @param {string} videoUri - Video URI from completed operation
 * @returns {Promise<Blob>} Video blob data
 */
async function downloadVeo3Video(apiKey, videoUri) {
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        throw new Error('API key is required to download video');
    }

    if (!videoUri || typeof videoUri !== 'string') {
        throw new Error('Video URI is required');
    }

    const trimmedKey = apiKey.trim();

    try {
        const response = await fetch(videoUri, {
            method: 'GET',
            headers: {
                'x-goog-api-key': trimmedKey
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to download video: ${response.statusText}`);
        }

        const blob = await response.blob();
        return blob;

    } catch (error) {
        console.error('❌ [Veo3] Failed to download video:', error);
        throw error;
    }
}

/**
 * Complete Veo 3 video generation with polling
 * This is the main function that handles the entire flow:
 * 1. Start generation
 * 2. Poll until complete
 * 3. Return video data
 * @param {number} requestId - Request tracking ID
 * @param {string} apiKey - User's Gemini API key
 * @param {string} prompt - Text prompt for video generation
 * @param {Object} config - Video configuration options
 * @param {number} currentIndex - Current video index (for batch generation)
 * @param {number} totalCount - Total number of videos being generated
 * @returns {Promise<Object>} Video data with URI and blob
 */
async function generateAndPollVeo3Video(requestId, apiKey, prompt, config = {}, currentIndex = 1, totalCount = 1) {
    let placeholder = null;

    try {
        const indexLabel = totalCount > 1 ? ` ${currentIndex}/${totalCount}` : '';

        // Create placeholder for video
        placeholder = addVideoPlaceholder(requestId, `Veo 3: ${prompt.substring(0, 50)}...`, config);

        // Step 1: Start video generation
        const operationName = await generateVideoVeo3(requestId, apiKey, prompt, config, currentIndex, totalCount);

        updateRequestStatus(requestId, 'running', `Generating video${indexLabel}... 0%`);

        // Step 2: Poll operation status
        const POLL_INTERVAL = 10000; // 10 seconds
        const MAX_POLLS = 60; // 10 minutes max
        let pollCount = 0;
        let done = false;
        let result = null;

        while (!done && pollCount < MAX_POLLS) {
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            pollCount++;

            const operation = await pollVeo3Operation(apiKey, operationName);
            done = operation.done === true;

            // Update progress (estimate based on time)
            const estimatedProgress = Math.min(Math.floor((pollCount / MAX_POLLS) * 100), 95);
            updateRequestStatus(requestId, 'running', `Generating video${indexLabel}... ${estimatedProgress}%`);

            if (placeholder) {
                placeholder.updateProgress(estimatedProgress, 'Generating video...');
            }

            console.log(`🔄 [Veo3] Poll ${pollCount}/${MAX_POLLS} - Done: ${done}`);

            if (done) {
                result = operation.response;
                break;
            }

            // Check for errors gg
            if (operation.error) {
                throw new Error(operation.error.message || 'Video generation failed');
            }
        }

        if (!done) {
            throw new Error('Video generation timed out after 10 minutes');
        }

        if (!result || !result.generateVideoResponse || !result.generateVideoResponse.generatedSamples) {
            throw new Error('Invalid response format from Gemini API');
        }

        // Step 3: Extract video URI
        const sample = result.generateVideoResponse.generatedSamples[0];
        if (!sample || !sample.video || !sample.video.uri) {
            throw new Error('No video URI in response');
        }

        const videoUri = sample.video.uri;

        addRequestLog(requestId, '✅', `Video${indexLabel} generation completed!`);
        addRequestLog(requestId, '📹', `Video URI: ${videoUri}`);
        updateRequestStatus(requestId, 'success', `Video${indexLabel} ready`);

        // Step 4: Download video
        console.log('📥 [Veo3] Downloading video from:', videoUri);
        const videoBlob = await downloadVeo3Video(apiKey, videoUri);

        // Convert blob to base64 for storage
        const reader = new FileReader();
        const videoData = await new Promise((resolve, reject) => {
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(videoBlob);
        });

        console.log('✅ [Veo3] Video downloaded successfully, size:', videoBlob.size, 'bytes');

        // Remove placeholder and add actual video to canvas
        const placeholderPosition = placeholder ? { x: placeholder.x, y: placeholder.y } : null;
        if (placeholder) {
            placeholder.remove();
        }

        // Add video to canvas
        const videoObj = addVideoToCanvas(
            videoData,
            'video/mp4',
            prompt,
            config.aspectRatio || '16:9',
            config.durationSeconds || 8,
            placeholderPosition ? { position: placeholderPosition } : {}
        );

        addRequestLog(requestId, '🎬', `Video added to canvas as ${formatVideoRef(videoObj.id)}`);
        addRequestLog(requestId, '💾', `Video saved to canvas`);

        return {
            videoUri,
            videoData,
            mimeType: 'video/mp4',
            prompt,
            config
        };

    } catch (error) {
        console.error('❌ [Veo3] Video generation failed:', error);
        addRequestLog(requestId, '❌', `Video generation failed: ${error.message}`);
        updateRequestStatus(requestId, 'error', error.message);

        if (placeholder) {
            placeholder.showError(error.message);
        }

        throw error;
    }
}

