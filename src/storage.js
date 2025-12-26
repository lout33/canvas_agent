async function fetchImageRecords(imageMetas = []) {
    return await fetchSessionImageRecords(getCurrentSessionId(), imageMetas);
}

async function fetchSessionImageRecords(sessionId, imageMetas = []) {
    if (!supportsIndexedDB || imageMetas.length === 0) return [];

    try {
        console.log(`🔍 fetchSessionImageRecords called for session: ${sessionId}`, imageMetas);
        const db = await dbPromise;
        return await new Promise((resolve, reject) => {
            const tx = db.transaction([DB_IMAGES_STORE], 'readonly');
            const store = tx.objectStore(DB_IMAGES_STORE);
            const lookup = new Map();
        const keysToCheck = [];

            for (const meta of imageMetas) {
                const compositeKey = sessionId ? `${sessionId}_${meta.id}` : meta.id;
                console.log(`🔑 Looking for image key: ${compositeKey} (meta.id: ${meta.id})`);
                keysToCheck.push(compositeKey);
                const request = store.get(compositeKey);
                request.onsuccess = (event) => {
                    const data = event.target.result;
                    console.log(`[Storage] Looking for key: ${compositeKey}, found:`, !!data);
                    if (data) {
                        lookup.set(meta.id, {
                            id: meta.id,
                            x: meta.x,
                            y: meta.y,
                            data: data.data,
                            mimeType: data.mimeType,
                            prompt: data.prompt,
                            aspectRatio: data.aspectRatio,
                            resolution: data.resolution,
                            referenceIds: data.referenceIds || []
                        });
                    }
                };
                request.onerror = () => {
                    console.error(`Failed to load image ${meta.id} from storage`, request.error);
                };
            }

            tx.oncomplete = () => {
                console.log(`[Storage] Transaction complete. Checked ${keysToCheck.length} keys:`, keysToCheck);
                console.log(`[Storage] Found ${lookup.size} matching records`);
                const ordered = imageMetas
                    .map(meta => lookup.get(meta.id))
                    .filter(Boolean);
                resolve(ordered);
            };
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error('Failed to fetch image records:', error);
        return [];
    }
}

async function fetchVideoRecords(videoMetas = []) {
    return await fetchSessionVideoRecords(getCurrentSessionId(), videoMetas);
}

async function fetchSessionVideoRecords(sessionId, videoMetas = []) {
    if (!supportsIndexedDB || videoMetas.length === 0) return [];

    try {
        const db = await dbPromise;

        // Verify video store exists
        if (!db.objectStoreNames.contains(DB_VIDEOS_STORE)) {
            console.warn('Videos store does not exist yet. Videos will not be restored.');
            return [];
        }

        return await new Promise((resolve, reject) => {
            const tx = db.transaction([DB_VIDEOS_STORE], 'readonly');
            const store = tx.objectStore(DB_VIDEOS_STORE);
            const lookup = new Map();

            for (const meta of videoMetas) {
                const compositeKey = sessionId ? `${sessionId}_${meta.id}` : meta.id;
                const request = store.get(compositeKey);
                request.onsuccess = (event) => {
                    const data = event.target.result;
                    if (data) {
                        lookup.set(meta.id, {
                            id: meta.id,
                            x: meta.x,
                            y: meta.y,
                            data: data.data,
                            mimeType: data.mimeType,
                            prompt: data.prompt,
                            aspectRatio: data.aspectRatio,
                            duration: data.duration,
                            sourceType: data.sourceType,
                            sourceUrl: data.sourceUrl,
                            externalId: data.externalId,
                            embedUrl: data.embedUrl,
                            poster: data.poster,
                            width: data.width,
                            height: data.height
                        });
                    }
                };
                request.onerror = () => {
                    console.error(`Failed to load video ${meta.id} from storage`, request.error);
                };
            }

            tx.oncomplete = () => {
                const ordered = videoMetas
                    .map(meta => lookup.get(meta.id))
                    .filter(Boolean);
                resolve(ordered);
            };
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error('Failed to fetch video records:', error);
        return [];
    }
}

async function fetchAudioRecords(audioMetas = []) {
    return await fetchSessionAudioRecords(getCurrentSessionId(), audioMetas);
}

async function fetchSessionAudioRecords(sessionId, audioMetas = []) {
    if (!supportsIndexedDB || audioMetas.length === 0) return [];

    try {
        const db = await dbPromise;

        // Verify audio store exists
        if (!db.objectStoreNames.contains(DB_AUDIOS_STORE)) {
            console.warn('Audios store does not exist yet. Audios will not be restored.');
            return [];
        }

        return await new Promise((resolve, reject) => {
            const tx = db.transaction([DB_AUDIOS_STORE], 'readonly');
            const store = tx.objectStore(DB_AUDIOS_STORE);
            const lookup = new Map();

            for (const meta of audioMetas) {
                const compositeKey = sessionId ? `${sessionId}_${meta.id}` : meta.id;
                const request = store.get(compositeKey);
                request.onsuccess = (event) => {
                    const data = event.target.result;
                    if (data) {
                        lookup.set(meta.id, {
                            id: meta.id,
                            x: meta.x,
                            y: meta.y,
                            data: data.data,
                            mimeType: data.mimeType,
                            text: data.text,
                            duration: data.duration,
                            voiceId: data.voiceId,
                            config: data.config,
                            width: data.width,
                            height: data.height
                        });
                    }
                };
                request.onerror = () => {
                    console.error(`Failed to load audio ${meta.id} from storage`, request.error);
                };
            }

            tx.oncomplete = () => {
                const ordered = audioMetas
                    .map(meta => lookup.get(meta.id))
                    .filter(Boolean);
                resolve(ordered);
            };
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error('Failed to fetch audio records:', error);
        return [];
    }
}

async function fetchNoteRecords(noteMetas = []) {
    return await fetchSessionNoteRecords(getCurrentSessionId(), noteMetas);
}

async function fetchSessionNoteRecords(sessionId, noteMetas = []) {
    if (!supportsIndexedDB || noteMetas.length === 0) return [];

    try {
        const db = await dbPromise;

        // Verify note store exists
        if (!db.objectStoreNames.contains(DB_NOTES_STORE)) {
            console.warn('Notes store does not exist yet. Notes will not be restored.');
            return [];
        }

        return await new Promise((resolve, reject) => {
            const tx = db.transaction([DB_NOTES_STORE], 'readonly');
            const store = tx.objectStore(DB_NOTES_STORE);
            const lookup = new Map();

            for (const meta of noteMetas) {
                const compositeKey = sessionId ? `${sessionId}_${meta.id}` : meta.id;
                const request = store.get(compositeKey);
                request.onsuccess = (event) => {
                    const data = event.target.result;
                    if (data) {
                        lookup.set(meta.id, {
                            id: meta.id,
                            x: meta.x,
                            y: meta.y,
                            width: data.width,
                            height: data.height,
                            text: data.text
                        });
                    }
                };
                request.onerror = () => {
                    console.error(`Failed to load note ${meta.id} from storage`, request.error);
                };
            }

            tx.oncomplete = () => {
                const ordered = noteMetas
                    .map(meta => lookup.get(meta.id))
                    .filter(Boolean);
                resolve(ordered);
            };
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error('Failed to fetch note records:', error);
        return [];
    }
}

function hydrateCanvasFromRecords(imageRecords, videoRecords = [], audioRecords = [], noteRecords = [], persistedState = {}) {
    console.log('🔄 hydrateCanvasFromRecords called with:', {
        imageRecords: imageRecords.length,
        videoRecords: videoRecords.length,
        audioRecords: audioRecords.length,
        noteRecords: noteRecords.length
    });

    canvas.innerHTML = '';
    canvasState.images = [];
    canvasState.videos = [];
    canvasState.audios = [];
    canvasState.notes = [];
    clearSelection({ skipUpdate: true });

    // Restore images
    imageRecords.forEach(record => {
        console.log('📂 Processing image record:', record);
        const img = document.createElement('div');
        img.className = 'canvas-image with-header';

        // Use saved position or fallback to default
        const x = typeof record.x === 'number' ? record.x : 50;
        const y = typeof record.y === 'number' ? record.y : 50;
        img.style.left = `${x}px`;
        img.style.top = `${y}px`;

        // Use saved dimensions or fallback to defaults
        const savedWidth = typeof record.width === 'number' ? record.width : null;
        const savedHeight = typeof record.height === 'number' ? record.height : null;

        let width, height;
        if (savedWidth && savedHeight) {
            width = savedWidth;
            height = savedHeight;
        } else {
            [width, height] = getCanvasSizeFromAspectRatio(record.aspectRatio || '1:1');
        }

        img.style.width = `${width}px`;
        img.style.height = `${height}px`;

        const recordLabel = formatImageRef(record.id);

        img.innerHTML = `
            <div class="media-header">
                <div class="media-header-drag-handle">⠿</div>
                <div class="media-header-id">${recordLabel}</div>
                <div class="media-header-controls">
                    <button class="media-header-btn image-control" title="Regenerate image" aria-label="Regenerate image ${recordLabel}" onclick="regenerateImage(event, ${record.id})">♻️</button>
                    <button class="media-header-btn image-control" title="Copy image" aria-label="Copy image ${recordLabel}" onclick="copyImage(event, ${record.id})">📋</button>
                    <button class="media-header-btn image-control" title="Download image" aria-label="Download image ${recordLabel}" onclick="downloadImage(event, ${record.id})">⬇️</button>
                </div>
            </div>
            <img src="data:${record.mimeType};base64,${record.data}" alt="Image ${recordLabel}">
        `;

        const imageObj = {
            id: record.id,
            type: 'image',
            element: img,
            x: x,  // Use the actual x value we calculated
            y: y,  // Use the actual y value we calculated
            width,
            height,
            data: record.data,
            mimeType: record.mimeType,
            prompt: record.prompt || 'No prompt',
            aspectRatio: record.aspectRatio || '1:1',
            resolution: record.resolution || '1024x1024',
            referenceIds: record.referenceIds || []
        };

        canvasState.images.push(imageObj);
        canvas.appendChild(img);
        attachCanvasImageEvents(img, imageObj);
    });

    // Restore videos
    videoRecords.forEach(record => {
        const videoEl = document.createElement('div');
        videoEl.className = 'canvas-video';
        videoEl.style.left = `${record.x}px`;
        videoEl.style.top = `${record.y}px`;

        const [fallbackWidth, fallbackHeight] = VIDEO_CANVAS_SIZES[record.aspectRatio] ||
            getCanvasSizeFromAspectRatio(record.aspectRatio || '16:9') ||
            [480, 270];
        const width = record.width || fallbackWidth;
        const height = record.height || fallbackHeight;
        videoEl.style.width = `${width}px`;
        videoEl.style.height = `${height}px`;

        const videoObj = {
            id: record.id,
            type: 'video',
            element: videoEl,
            x: record.x,
            y: record.y,
            width,
            height,
            data: record.data || null,
            mimeType: record.mimeType || 'video/mp4',
            prompt: record.prompt || 'No prompt',
            aspectRatio: record.aspectRatio || '16:9',
            duration: typeof record.duration === 'number' ? record.duration : (record.duration === null ? null : 8),
            sourceType: record.sourceType || (record.data ? 'data' : 'url'),
            sourceUrl: record.sourceUrl || null,
            externalId: record.externalId || null,
            embedUrl: record.embedUrl || (record.externalId ? buildYoutubeEmbedUrl(record.externalId) : null),
            poster: record.poster || null
        };

        renderCanvasVideoContent(videoEl, videoObj);

        canvasState.videos.push(videoObj);
        canvas.appendChild(videoEl);
        attachCanvasVideoEvents(videoEl, videoObj);
    });

    // Restore audios
    audioRecords.forEach(record => {
        const audioEl = document.createElement('div');
        audioEl.className = 'canvas-audio';
        audioEl.style.left = `${record.x}px`;
        audioEl.style.top = `${record.y}px`;

        const [fallbackWidth, fallbackHeight] = AUDIO_CANVAS_SIZES.default || [350, 100];
        const width = record.width || fallbackWidth;
        const height = record.height || fallbackHeight;
        audioEl.style.width = `${width}px`;
        audioEl.style.height = `${height}px`;

        const audioObj = {
            id: record.id,
            type: 'audio',
            element: audioEl,
            x: record.x,
            y: record.y,
            width,
            height,
            data: record.data || null,
            mimeType: record.mimeType || 'audio/mp3',
            text: record.text || 'No text',
            duration: record.duration || null,
            voiceId: record.voiceId || null,
            config: record.config || {}
        };

        renderCanvasAudioContent(audioEl, audioObj);

        canvasState.audios.push(audioObj);
        canvas.appendChild(audioEl);
        attachCanvasAudioEvents(audioEl, audioObj);
    });

    // Restore notes
    noteRecords.forEach(record => {
        const noteEl = document.createElement('div');
        noteEl.className = 'canvas-note';
        noteEl.style.left = `${record.x}px`;
        noteEl.style.top = `${record.y}px`;

        const width = Math.max(NOTE_MIN_WIDTH, record.width || DEFAULT_NOTE_WIDTH);
        const height = Math.max(NOTE_MIN_HEIGHT, record.height || DEFAULT_NOTE_HEIGHT);
        noteEl.style.width = `${width}px`;
        noteEl.style.height = `${height}px`;
        noteEl.style.minWidth = `${NOTE_MIN_WIDTH}px`;
        noteEl.style.minHeight = `${NOTE_MIN_HEIGHT}px`;

        const recordLabel = formatNoteRef(record.id);
        noteEl.innerHTML = `
            <div class="media-header note-header">
                <div class="media-header-drag-handle">⠿</div>
                <div class="media-header-id">📝 ${recordLabel}</div>
                <div class="media-header-controls">
                    <button class="media-header-btn image-control" title="Generate image from note" aria-label="Generate image from note ${recordLabel}" onclick="generateImageFromNote(event, ${record.id})">🎨</button>
                    <button class="media-header-btn image-control" title="Delete note" aria-label="Delete note ${recordLabel}" onclick="deleteNote(event, ${record.id})">🗑️</button>
                </div>
            </div>
            <div class="note-content" contenteditable="true" data-note-id="${record.id}"></div>
            <div class="note-resize-handle" data-note-id="${record.id}" aria-hidden="true"></div>
        `;

        const noteContent = noteEl.querySelector('.note-content');
        const savedText = record.text === 'Double-click to edit...' ? '' : (record.text || '');
        if (noteContent) {
            noteContent.textContent = savedText;
        }

        const noteObj = {
            id: record.id,
            type: 'note',
            element: noteEl,
            x: record.x,
            y: record.y,
            width,
            height,
            text: savedText
        };

        canvasState.notes.push(noteObj);
        canvas.appendChild(noteEl);
        attachCanvasNoteEvents(noteEl, noteObj);
    });

    const highestImageId = imageRecords.reduce((max, record) => Math.max(max, record.id), -1);
    const highestVideoId = videoRecords.reduce((max, record) => Math.max(max, record.id), -1);
    const highestAudioId = audioRecords.reduce((max, record) => Math.max(max, record.id), -1);
    const highestNoteId = noteRecords.reduce((max, record) => Math.max(max, record.id), -1);

    imageCounter = typeof persistedState.imageCounter === 'number'
        ? persistedState.imageCounter
        : highestImageId + 1;

    videoCounter = typeof persistedState.videoCounter === 'number'
        ? persistedState.videoCounter
        : highestVideoId + 1;

    audioCounter = typeof persistedState.audioCounter === 'number'
        ? persistedState.audioCounter
        : highestAudioId + 1;

    noteCounter = typeof persistedState.noteCounter === 'number'
        ? persistedState.noteCounter
        : highestNoteId + 1;

    canvasState.projectTitle = typeof persistedState.projectTitle === 'string' && persistedState.projectTitle.trim()
        ? persistedState.projectTitle
        : null;  // Will be randomly generated on display
    canvasState.zoom = typeof persistedState.zoom === 'number' ? persistedState.zoom : 1;
    canvasState.offsetX = typeof persistedState.offsetX === 'number' ? persistedState.offsetX : 0;
    canvasState.offsetY = typeof persistedState.offsetY === 'number' ? persistedState.offsetY : 0;

    updateCanvas();
    updateCanvasStats();
    updateDeleteButtonState();

    const allItems = [...imageRecords, ...videoRecords, ...audioRecords, ...noteRecords];
    if (allItems.length > 0) {
        const last = allItems[allItems.length - 1];
        lastGeneratedPosition = {
            x: last.x,
            y: last.y
        };
    } else {
        lastGeneratedPosition = { x: 50, y: 50 };
    }

    return imageRecords.length + videoRecords.length + audioRecords.length + noteRecords.length;
}

function buildCanvasMetaPayload() {
    return {
        projectTitle: canvasState.projectTitle,  // Can be null, will generate on load
        images: canvasState.images.map(img => ({
            id: img.id,
            x: img.x,
            y: img.y
        })),
        videos: canvasState.videos.map(vid => ({
            id: vid.id,
            x: vid.x,
            y: vid.y
        })),
        audios: canvasState.audios.map(audio => ({
            id: audio.id,
            x: audio.x,
            y: audio.y
        })),
        notes: canvasState.notes.map(note => ({
            id: note.id,
            x: note.x,
            y: note.y
        })),
        zoom: canvasState.zoom,
        offsetX: canvasState.offsetX,
        offsetY: canvasState.offsetY,
        imageCounter,
        videoCounter,
        audioCounter,
        noteCounter
    };
}

async function saveCanvasState(options = {}) {
    const scope = options.scope === 'viewport' ? 'viewport' : 'full';
    const sessionId = getCurrentSessionId();

    if (!supportsIndexedDB) {
        if (!storageWarningShown) {
            addChatMessage('⚠️ Browser does not support IndexedDB. Canvas auto-save is disabled.', 'system');
            storageWarningShown = true;
        }
        updateSaveIndicator('error');
        return;
    }

    try {
        const db = await dbPromise;

        // Verify required object stores exist
        const requiredStores = scope === 'viewport'
            ? [DB_META_STORE]
            : [DB_IMAGES_STORE, DB_VIDEOS_STORE, DB_AUDIOS_STORE, DB_NOTES_STORE, DB_META_STORE];
        const missingStores = requiredStores.filter(store => !db.objectStoreNames.contains(store));

        if (missingStores.length > 0) {
            console.error('Missing object stores:', missingStores);
            addChatMessage('⚠️ Database needs to be upgraded. Please close all tabs with this app open and reload.', 'system');
            updateSaveIndicator('error');
            return;
        }

        if (scope === 'viewport') {
            await new Promise((resolve, reject) => {
                const tx = db.transaction([DB_META_STORE], 'readwrite');
                const metaStore = tx.objectStore(DB_META_STORE);

                const sessionKey = sessionId ? `canvas_${sessionId}` : 'canvas';
                metaStore.put({
                    key: sessionKey,
                    value: buildCanvasMetaPayload()
                });

                tx.oncomplete = () => {
                    updateSaveIndicator('saved');
                    resolve();
                };
                tx.onerror = () => {
                    console.error('Failed to save canvas viewport state:', tx.error);
                    updateSaveIndicator('error');
                    reject(tx.error);
                };
                tx.onabort = () => {
                    console.error('Canvas viewport save aborted:', tx.error);
                    updateSaveIndicator('error');
                    reject(tx.error || new Error('Save aborted'));
                };
            });
            return;
        }

        await new Promise((resolve, reject) => {
            const tx = db.transaction([DB_IMAGES_STORE, DB_VIDEOS_STORE, DB_AUDIOS_STORE, DB_NOTES_STORE, DB_META_STORE], 'readwrite');
            const imagesStore = tx.objectStore(DB_IMAGES_STORE);
            const videosStore = tx.objectStore(DB_VIDEOS_STORE);
            const audiosStore = tx.objectStore(DB_AUDIOS_STORE);
            const notesStore = tx.objectStore(DB_NOTES_STORE);
            const metaStore = tx.objectStore(DB_META_STORE);

            // Save metadata FIRST to ensure we have the reference
            const sessionKey = sessionId ? `canvas_${sessionId}` : 'canvas';
            const metadata = buildCanvasMetaPayload();
            console.log('Saving canvas metadata for session:', sessionId, 'metadata:', metadata);
            metaStore.put({
                key: sessionKey,
                value: metadata
            });

            // Save images with session prefix
            canvasState.images.forEach(img => {
                const imageKey = sessionId ? `${sessionId}_${img.id}` : img.id;
                imagesStore.put({
                    id: imageKey,
                    x: img.x,
                    y: img.y,
                    width: img.width,
                    height: img.height,
                    data: img.data,
                    mimeType: img.mimeType,
                    prompt: img.prompt,
                    aspectRatio: img.aspectRatio,
                    resolution: img.resolution,
                    referenceIds: img.referenceIds || []
                });
            });

            // Save videos with session prefix
            canvasState.videos.forEach(vid => {
                const videoKey = sessionId ? `${sessionId}_${vid.id}` : vid.id;
                videosStore.put({
                    id: videoKey,
                    x: vid.x,
                    y: vid.y,
                    data: vid.data,
                    mimeType: vid.mimeType,
                    prompt: vid.prompt,
                    aspectRatio: vid.aspectRatio,
                    duration: vid.duration,
                    sourceType: vid.sourceType,
                    sourceUrl: vid.sourceUrl,
                    externalId: vid.externalId,
                    embedUrl: vid.embedUrl,
                    poster: vid.poster,
                    width: vid.width,
                    height: vid.height
                });
            });

            // Save audios with session prefix
            canvasState.audios.forEach(audio => {
                const audioKey = sessionId ? `${sessionId}_${audio.id}` : audio.id;
                audiosStore.put({
                    id: audioKey,
                    x: audio.x,
                    y: audio.y,
                    data: audio.data,
                    mimeType: audio.mimeType,
                    text: audio.text,
                    duration: audio.duration,
                    voiceId: audio.voiceId,
                    config: audio.config,
                    width: audio.width,
                    height: audio.height
                });
            });

            // Save notes with session prefix
            canvasState.notes.forEach(note => {
                const noteKey = sessionId ? `${sessionId}_${note.id}` : note.id;
                notesStore.put({
                    id: noteKey,
                    x: note.x,
                    y: note.y,
                    width: note.width,
                    height: note.height,
                    text: note.text
                });
            });

            tx.oncomplete = () => {
                console.log('Canvas state saved successfully for session:', sessionId);
                updateSaveIndicator('saved');

                // Clean up orphaned records in a separate transaction
                cleanupOrphanedRecords(sessionId).then(resolve).catch(resolve);
            };
            tx.onerror = () => {
                console.error('Failed to save canvas state:', tx.error);
                updateSaveIndicator('error');
                reject(tx.error);
            };
            tx.onabort = () => {
                console.error('Canvas save aborted:', tx.error);
                updateSaveIndicator('error');
                reject(tx.error || new Error('Save aborted'));
            };
        });
    } catch (error) {
        console.error('Failed to save canvas state:', error);
        updateSaveIndicator('error');
    }
}

// Clean up orphaned records that are not referenced by metadata
async function cleanupOrphanedRecords(sessionId) {
    if (!supportsIndexedDB) return;

    try {
        const db = await dbPromise;
        const sessionPrefix = sessionId ? `${sessionId}_` : '';

        // Get current metadata to know which records should exist
        const metadata = await new Promise((resolve) => {
            const tx = db.transaction([DB_META_STORE], 'readonly');
            const store = tx.objectStore(DB_META_STORE);
            const sessionKey = sessionId ? `canvas_${sessionId}` : 'canvas';
            const request = store.get(sessionKey);
            request.onsuccess = (event) => {
                const result = event.target.result;
                resolve(result ? result.value : null);
            };
            request.onerror = () => resolve(null);
        });

        if (!metadata) return;

        const validKeys = new Set();
        metadata.images?.forEach(img => validKeys.add(sessionPrefix + img.id));
        metadata.videos?.forEach(vid => validKeys.add(sessionPrefix + vid.id));
        metadata.audios?.forEach(audio => validKeys.add(sessionPrefix + audio.id));
        metadata.notes?.forEach(note => validKeys.add(sessionPrefix + note.id));

        // Clean up each store
        const stores = [
            { name: DB_IMAGES_STORE, key: 'image' },
            { name: DB_VIDEOS_STORE, key: 'video' },
            { name: DB_AUDIOS_STORE, key: 'audio' },
            { name: DB_NOTES_STORE, key: 'note' }
        ];

        for (const storeInfo of stores) {
            await new Promise((resolve) => {
                const tx = db.transaction([storeInfo.name], 'readwrite');
                const store = tx.objectStore(storeInfo.name);
                const deleteRequest = store.openCursor();

                deleteRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const key = cursor.key.toString();
                        const shouldDelete = sessionId
                            ? key.startsWith(sessionPrefix) && !validKeys.has(key)
                            : !key.includes('_') && !validKeys.has(key);

                        if (shouldDelete) {
                            console.log(`Cleaning up orphaned ${storeInfo.key}:`, key);
                            cursor.delete();
                        }
                        cursor.continue();
                    }
                };

                tx.oncomplete = resolve;
                tx.onerror = resolve;
            });
        }
    } catch (error) {
        console.warn('Failed to cleanup orphaned records:', error);
    }
}

async function restoreCanvasState() {
    try {
        const legacySavedState = localStorage.getItem('canvas_agent_canvas');
        const sessionId = getCurrentSessionId();

        if (!supportsIndexedDB) {
            if (legacySavedState) {
                const state = JSON.parse(legacySavedState);
                const restored = hydrateCanvasFromRecords(state.images || [], state.videos || [], state.audios || [], state.notes || [], state);
                if (restored > 0) {
                    addChatMessage(`💾 Restored ${restored} item${restored > 1 ? 's' : ''} from previous session (legacy storage).`, 'system');
                    updateSaveIndicator('loaded');
                    return true;
                }
            }
            return false;
        }

        const db = await dbPromise;
        const sessionKey = sessionId ? `canvas_${sessionId}` : 'canvas';
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
            console.log('Restoring canvas state for session:', sessionId, 'with data:', persistedState);

            // Use the session-specific fetch functions with the correct session ID
            const imageRecords = await fetchSessionImageRecords(sessionId, persistedState.images || []);
            const videoRecords = await fetchSessionVideoRecords(sessionId, persistedState.videos || []);
            const audioRecords = await fetchSessionAudioRecords(sessionId, persistedState.audios || []);
            const noteRecords = await fetchSessionNoteRecords(sessionId, persistedState.notes || []);

            console.log('Fetched records:', {
                images: imageRecords.length,
                videos: videoRecords.length,
                audios: audioRecords.length,
                notes: noteRecords.length
            });

            // Debug: Check what keys we're looking for and if any records are missing
            if (persistedState.images?.length > 0) {
                const expectedKeys = persistedState.images.map(img => sessionId ? `${sessionId}_${img.id}` : img.id);
                console.log('Expected image keys:', expectedKeys);
                console.log('Missing image records:', expectedKeys.filter((_, index) => !imageRecords[index]));
            }

            const restored = hydrateCanvasFromRecords(imageRecords, videoRecords, audioRecords, noteRecords, persistedState);
            if (restored > 0) {
                const imageCount = imageRecords.length;
                const videoCount = videoRecords.length;
                const audioCount = audioRecords.length;
                const noteCount = noteRecords.length;
                let message = '💾 Restored ';
                const parts = [];
                if (imageCount > 0) parts.push(`${imageCount} image${imageCount > 1 ? 's' : ''}`);
                if (videoCount > 0) parts.push(`${videoCount} video${videoCount > 1 ? 's' : ''}`);
                if (audioCount > 0) parts.push(`${audioCount} audio${audioCount > 1 ? 's' : ''}`);
                if (noteCount > 0) parts.push(`${noteCount} note${noteCount > 1 ? 's' : ''}`);
                message += parts.join(', ') + ` from session "${sessionId}"`;
                addChatMessage(message, 'system');
                updateSaveIndicator('loaded');
                return true;
            } else {
                console.warn('No items were restored despite having metadata');

                // If restoration failed, clean up the inconsistent metadata
                console.warn('Cleaning up inconsistent metadata for session:', sessionId);
                const db = await dbPromise;
                await new Promise((resolve) => {
                    const tx = db.transaction([DB_META_STORE], 'readwrite');
                    const store = tx.objectStore(DB_META_STORE);
                    const sessionKey = sessionId ? `canvas_${sessionId}` : 'canvas';
                    store.delete(sessionKey);
                    tx.oncomplete = resolve;
                    tx.onerror = resolve;
                });
                console.warn('Inconsistent metadata cleaned up. Session will start fresh on next load.');
            }
        } else {
            console.log('No persisted state found for session:', sessionId);
        }

        // Handle legacy state for non-session or fallback
        if (!sessionId && legacySavedState) {
            const state = JSON.parse(legacySavedState);
            if (state.images && state.images.length > 0) {
                const restored = hydrateCanvasFromRecords(state.images, state.videos || [], state.audios || [], state.notes || [], state);
                if (restored > 0) {
                    await saveCanvasState();
                    localStorage.removeItem('canvas_agent_canvas');
                    addChatMessage(`💾 Migrated ${restored} item${restored > 1 ? 's' : ''} from legacy storage`, 'system');
                    updateSaveIndicator('loaded');
                    return true;
                }
            }
        }

        return false;
    } catch (error) {
        console.error('Failed to restore canvas state:', error);
        updateSaveIndicator('error');
        return false;
    }
}

// Update save indicator in UI
function updateSaveIndicator(status) {
    const indicator = document.getElementById('saveIndicator');
    if (!indicator) return;
    
    indicator.classList.remove('saved', 'saving', 'error', 'loaded');
    
    if (status === 'saved') {
        indicator.textContent = '💾 Saved';
        indicator.classList.add('saved');
    } else if (status === 'saving') {
        indicator.textContent = '💾 Saving...';
        indicator.classList.add('saving');
    } else if (status === 'error') {
        indicator.textContent = '⚠️ Save Error';
        indicator.classList.add('error');
    } else if (status === 'loaded') {
        indicator.textContent = '💾 Loaded';
        indicator.classList.add('loaded');
        setTimeout(() => {
            indicator.textContent = '💾 Auto-save';
            indicator.classList.remove('loaded');
        }, 3000);
    }
}

// Debounced auto-save function
const SAVE_SCOPE_PRIORITY = {
    none: 0,
    viewport: 1,
    full: 2
};

let saveTimeout;
let pendingSaveScope = 'none';

function debouncedSave(options = {}) {
    const immediate = options.immediate || false;
    const scope = options.scope === 'viewport' ? 'viewport' : 'full';

    if (SAVE_SCOPE_PRIORITY[scope] > SAVE_SCOPE_PRIORITY[pendingSaveScope]) {
        pendingSaveScope = scope;
    }

    clearTimeout(saveTimeout);
    updateSaveIndicator('saving');

    const flushSave = () => {
        const effectiveScope = pendingSaveScope !== 'none' ? pendingSaveScope : scope;
        pendingSaveScope = 'none';
        saveCanvasState({ scope: effectiveScope });
    };

    if (immediate) {
        flushSave();
        return;
    }

    saveTimeout = setTimeout(flushSave, 500);
}

// Chat History Persistence Functions
function getChatHistorySnapshot() {
    const chatMessages = document.getElementById('chatMessages');
    const messages = Array.from(chatMessages.children).map(msg => ({
        type: msg.className.replace('chat-message ', ''),
        text: msg.textContent
    }));

    return {
        conversationHistory: [...conversationHistory],
        chatMessages: messages,
        timestamp: Date.now()
    };
}

async function saveChatHistory() {
    if (!supportsIndexedDB) return;

    try {
        const db = await dbPromise;
        const sessionId = getCurrentSessionId();
        await new Promise((resolve, reject) => {
            const tx = db.transaction([DB_CHAT_STORE], 'readwrite');
            const store = tx.objectStore(DB_CHAT_STORE);

            // Get all chat messages from DOM
            const chatMessages = document.getElementById('chatMessages');
            const messages = Array.from(chatMessages.children).map(msg => ({
                type: msg.className.replace('chat-message ', ''),
                text: msg.textContent
            }));

            const chatKey = sessionId ? `history_${sessionId}` : 'history';
            store.put({
                key: chatKey,
                conversationHistory: conversationHistory,
                chatMessages: messages,
                timestamp: Date.now()
            });

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error('Failed to save chat history:', error);
    }
}

function applyChatHistorySnapshot(chatData) {
    if (chatData && chatData.chatMessages && chatData.chatMessages.length > 0) {
        // Restore conversation history for AI context
        conversationHistory = chatData.conversationHistory || [];

        // Restore visible chat messages
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';

        chatData.chatMessages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${msg.type}`;
            if (typeof renderChatMessageContent === 'function') {
                renderChatMessageContent(messageDiv, msg.text || '');
            } else {
                messageDiv.textContent = msg.text || '';
            }
            chatMessages.appendChild(messageDiv);
        });

        chatMessages.scrollTop = chatMessages.scrollHeight;
        return true;
    }
    return false;
}

async function restoreChatHistory() {
    if (!supportsIndexedDB) return false;

    try {
        const db = await dbPromise;
        const sessionId = getCurrentSessionId();
        const chatKey = sessionId ? `history_${sessionId}` : 'history';

        const chatData = await new Promise((resolve, reject) => {
            const tx = db.transaction([DB_CHAT_STORE], 'readonly');
            const store = tx.objectStore(DB_CHAT_STORE);
            const request = store.get(chatKey);

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
            request.onerror = () => reject(request.error);
        });

        if (applyChatHistorySnapshot(chatData)) {
            const messageCount = chatData.chatMessages.filter(m => m.type === 'user' || m.type === 'assistant').length;
            if (messageCount > 0) {
                addChatMessage(`💬 Restored ${messageCount} message${messageCount > 1 ? 's' : ''} from session "${sessionId}"`, 'system');
            }
            return true;
        }

        return false;
    } catch (error) {
        console.error('Failed to restore chat history:', error);
        return false;
    }
}

async function saveTemplatesToStorage() {
    const snapshot = getTemplateSnapshot();

    if (!supportsIndexedDB) {
        try {
            localStorage.setItem('canvas_agent_templates', JSON.stringify(snapshot));
        } catch (error) {
            console.error('Failed to save templates to localStorage:', error);
        }
        return;
    }

    try {
        const db = await dbPromise;

        if (!db.objectStoreNames.contains(DB_TEMPLATES_STORE)) {
            console.warn('Templates store does not exist yet. Templates will not be persisted.');
            return;
        }

        await new Promise((resolve, reject) => {
            const tx = db.transaction([DB_TEMPLATES_STORE], 'readwrite');
            const store = tx.objectStore(DB_TEMPLATES_STORE);

            store.clear();
            snapshot.forEach(template => {
                store.put(template);
            });

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Template save aborted'));
        });
    } catch (error) {
        console.error('Failed to save templates:', error);
    }
}

async function restoreTemplates() {
    const fallbackTemplates = (() => {
        try {
            const raw = localStorage.getItem('canvas_agent_templates');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('Failed to parse templates from localStorage:', error);
            return [];
        }
    })();

    let userTemplates = [];

    if (!supportsIndexedDB) {
        userTemplates = fallbackTemplates;
    } else {
        try {
            const db = await dbPromise;

            if (!db.objectStoreNames.contains(DB_TEMPLATES_STORE)) {
                console.warn('Templates store not found. Using fallback templates.');
                userTemplates = fallbackTemplates;
            } else {
                const storedTemplates = await new Promise((resolve, reject) => {
                    const tx = db.transaction([DB_TEMPLATES_STORE], 'readonly');
                    const store = tx.objectStore(DB_TEMPLATES_STORE);
                    const request = store.getAll();

                    request.onsuccess = (event) => {
                        resolve(event.target.result || []);
                    };
                    request.onerror = () => reject(request.error);
                });

                if (storedTemplates.length === 0 && fallbackTemplates.length > 0) {
                    userTemplates = fallbackTemplates;
                    // Merge with built-ins and save
                    const allTemplates = [...BUILT_IN_TEMPLATES, ...userTemplates];
                    setTemplateLibrary(allTemplates);
                    await saveTemplatesToStorage();
                    console.log(`Loaded ${BUILT_IN_TEMPLATES.length} built-in templates and ${userTemplates.length} user templates`);
                    return listTemplates();
                }

                userTemplates = storedTemplates;
            }
        } catch (error) {
            console.error('Failed to restore templates:', error);
            userTemplates = fallbackTemplates;
        }
    }

    // Merge built-in templates with user templates
    // User templates take precedence if they override a built-in command
    const allTemplates = [...BUILT_IN_TEMPLATES, ...userTemplates];
    setTemplateLibrary(allTemplates);

    console.log(`Loaded ${BUILT_IN_TEMPLATES.length} built-in templates and ${userTemplates.length} user templates`);
    return listTemplates();
}

// Built-in templates that come pre-installed
const BUILT_IN_TEMPLATES = [
    // Similar variations - subtle tweaks
    {
        command: '/2sim',
        prompt: 'IMPORTANT: Generate 2 SIMILAR variations with SUBTLE differences. Keep the same core subject, style, and overall composition. Make only minor adjustments such as: slight angle changes (5-15 degrees), subtle lighting tweaks, small compositional shifts, or minor perspective adjustments. The variations should feel like "different takes of the same scene" rather than completely different images.',
        createdAt: 0,
        isBuiltIn: true
    },
    {
        command: '/3sim',
        prompt: 'IMPORTANT: Generate 3 SIMILAR variations with SUBTLE differences. Keep the same core subject, style, and overall composition. Make only minor adjustments such as: slight angle changes (5-15 degrees), subtle lighting tweaks, small compositional shifts, or minor perspective adjustments. The variations should feel like "different takes of the same scene" rather than completely different images.',
        createdAt: 0,
        isBuiltIn: true
    },
    {
        command: '/4sim',
        prompt: 'IMPORTANT: Generate 4 SIMILAR variations with SUBTLE differences. Keep the same core subject, style, and overall composition. Make only minor adjustments such as: slight angle changes (5-15 degrees), subtle lighting tweaks, small compositional shifts, or minor perspective adjustments. The variations should feel like "different takes of the same scene" rather than completely different images.',
        createdAt: 0,
        isBuiltIn: true
    },
    {
        command: '/5sim',
        prompt: 'IMPORTANT: Generate 5 SIMILAR variations with SUBTLE differences. Keep the same core subject, style, and overall composition. Make only minor adjustments such as: slight angle changes (5-15 degrees), subtle lighting tweaks, small compositional shifts, or minor perspective adjustments. The variations should feel like "different takes of the same scene" rather than completely different images.',
        createdAt: 0,
        isBuiltIn: true
    },
    {
        command: '/10sim',
        prompt: 'IMPORTANT: Generate 10 SIMILAR variations with SUBTLE differences. Keep the same core subject, style, and overall composition. Make only minor adjustments such as: slight angle changes (5-15 degrees), subtle lighting tweaks, small compositional shifts, or minor perspective adjustments. The variations should feel like "different takes of the same scene" rather than completely different images.',
        createdAt: 0,
        isBuiltIn: true
    },

    // Different variations - completely different styles
    {
        command: '/2dif',
        prompt: 'IMPORTANT: Generate 2 COMPLETELY DIFFERENT variations exploring diverse creative directions. Each variation should have a DISTINCT style - for example: photorealistic, anime, oil painting, watercolor, 3D render, sketch, abstract, minimalist, etc. Vary the mood, composition, color palette, lighting scenario, artistic medium, and creative interpretation. Make each prompt unique and creatively distinct from the others.',
        createdAt: 0,
        isBuiltIn: true
    },
    {
        command: '/3dif',
        prompt: 'IMPORTANT: Generate 3 COMPLETELY DIFFERENT variations exploring diverse creative directions. Each variation should have a DISTINCT style - for example: photorealistic, anime, oil painting, watercolor, 3D render, sketch, abstract, minimalist, etc. Vary the mood, composition, color palette, lighting scenario, artistic medium, and creative interpretation. Make each prompt unique and creatively distinct from the others.',
        createdAt: 0,
        isBuiltIn: true
    },
    {
        command: '/4dif',
        prompt: 'IMPORTANT: Generate 4 COMPLETELY DIFFERENT variations exploring diverse creative directions. Each variation should have a DISTINCT style - for example: photorealistic, anime, oil painting, watercolor, 3D render, sketch, abstract, minimalist, etc. Vary the mood, composition, color palette, lighting scenario, artistic medium, and creative interpretation. Make each prompt unique and creatively distinct from the others.',
        createdAt: 0,
        isBuiltIn: true
    },
    {
        command: '/5dif',
        prompt: 'IMPORTANT: Generate 5 COMPLETELY DIFFERENT variations exploring diverse creative directions. Each variation should have a DISTINCT style - for example: photorealistic, anime, oil painting, watercolor, 3D render, sketch, abstract, minimalist, etc. Vary the mood, composition, color palette, lighting scenario, artistic medium, and creative interpretation. Make each prompt unique and creatively distinct from the others.',
        createdAt: 0,
        isBuiltIn: true
    },
    {
        command: '/10dif',
        prompt: 'IMPORTANT: Generate 10 COMPLETELY DIFFERENT variations exploring diverse creative directions. Each variation should have a DISTINCT style - for example: photorealistic, anime, oil painting, watercolor, 3D render, sketch, abstract, minimalist, etc. Vary the mood, composition, color palette, lighting scenario, artistic medium, and creative interpretation. Make each prompt unique and creatively distinct from the others.',
        createdAt: 0,
        isBuiltIn: true
    },

    // Keep existing /angles command
    {
        command: '/angles',
        prompt: 'IMPORTANT: Generate 6 images showing the subject from different camera angles: FRONT view, BACK view, LEFT side view, RIGHT side view, TOP view (bird\'s eye), and BOTTOM view (looking up). CRITICAL: The object/subject must remain in the EXACT SAME POSITION and pose in all 6 images - only the CAMERA moves around it to capture different angles. Maintain consistent lighting, scale, and style across all views. Each prompt should specify the camera position clearly (e.g., "front view of [subject]", "view from directly above [subject]", "view from the left side of [subject]"). Generate 6 prompts, one for each angle: front, back, left, right, top, bottom.',
        createdAt: 0,
        isBuiltIn: true
    }
];

// Persistence (IndexedDB)
const DB_NAME = 'canvas_agent_db';
const DB_VERSION = 6;  // Increment for audio support
const DB_IMAGES_STORE = 'images';
const DB_VIDEOS_STORE = 'videos';  // NEW: Videos store
const DB_AUDIOS_STORE = 'audios';  // NEW: Audios store
const DB_NOTES_STORE = 'notes';    // NEW: Notes store
const DB_META_STORE = 'meta';
const DB_CHAT_STORE = 'chat';
const DB_TEMPLATES_STORE = 'templates';
const supportsIndexedDB = typeof window !== 'undefined' && !!window.indexedDB;
const dbPromise = supportsIndexedDB ? initDatabase() : Promise.resolve(null);
let storageWarningShown = false;

function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const oldVersion = event.oldVersion;

            console.log(`Upgrading database from version ${oldVersion} to ${DB_VERSION}`);

            // Create stores if they don't exist
            if (!db.objectStoreNames.contains(DB_IMAGES_STORE)) {
                console.log('Creating images store');
                db.createObjectStore(DB_IMAGES_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(DB_VIDEOS_STORE)) {
                console.log('Creating videos store');
                db.createObjectStore(DB_VIDEOS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(DB_AUDIOS_STORE)) {
                console.log('Creating audios store');
                db.createObjectStore(DB_AUDIOS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(DB_NOTES_STORE)) {
                console.log('Creating notes store');
                db.createObjectStore(DB_NOTES_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(DB_META_STORE)) {
                console.log('Creating meta store');
                db.createObjectStore(DB_META_STORE, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(DB_CHAT_STORE)) {
                console.log('Creating chat store');
                db.createObjectStore(DB_CHAT_STORE, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(DB_TEMPLATES_STORE)) {
                console.log('Creating templates store');
                db.createObjectStore(DB_TEMPLATES_STORE, { keyPath: 'command' });
            }

            console.log('Database upgrade complete');
        };

        request.onsuccess = () => {
            const db = request.result;
            console.log('Database opened successfully');

            // Verify all required stores exist
            const requiredStores = [DB_IMAGES_STORE, DB_VIDEOS_STORE, DB_AUDIOS_STORE, DB_NOTES_STORE, DB_META_STORE, DB_CHAT_STORE, DB_TEMPLATES_STORE];
            const missingStores = requiredStores.filter(store => !db.objectStoreNames.contains(store));

            if (missingStores.length > 0) {
                console.error('Database is missing required stores:', missingStores);
                console.warn('This usually means the database upgrade was blocked. Please close all other tabs with this app open and refresh.');
            }

            resolve(db);
        };
        request.onerror = () => {
            console.error('Database error:', request.error);
            reject(request.error);
        };
        request.onblocked = () => {
            console.warn('Database upgrade blocked. Please close other tabs with this app open.');
            alert('⚠️ Database upgrade blocked!\n\nPlease close all other tabs with Canvas Agent open, then refresh this page.');
        };
    });
}

