
# Canvas Agent Engineering Guide

## 1. Repository layout
- `index.html`, `styles.css`: Dual-panel canvas/chat UI (vanilla HTML/CSS).
- `src/`: Browser JavaScript modules (no bundler frameworks). See module map below.
- `docs/`: Deep-dive references (Gemini prompting, integration guides, release plans).

### Frontend module map (`src/`)
| File | Responsibility |
| ---- | -------------- |
| `state.js` | Global runtime state (canvas items, chat history, request tracking, keyboard flags) and constants (ID prefixes, regex helpers, Firecrawl endpoints). |
| `canvas.js` | Everything that renders and mutates the infinite canvas: item placement, selection logic, drag/drop, zoom/pan, placeholders, media controls, ID badge lists, history stack, clipboard/import/export helpers. |
| `chat.js` | Chat UI rendering, request orchestration, Gemini command execution, status logging, and branching for notes, extractions, or image generation. |
| `agent.js` | System prompt + `interpretUserCommand` helper that calls Gemini 2.5 Flash to turn conversation state into structured commands. |
| `storage.js` | Persistence using IndexedDB + `localStorage` for API keys: saves/loads canvas images, notes, and chat history; rebuilds DOM nodes on restore. |
| `tools.js` | Operational helpers (Firecrawl polling, request logs, clipboard utilities) used by `chat.js` and `canvas.js`.
| `app.js` | Bootstraps the experience: restores state, wires global listeners (paste, keyboard shortcuts), and shows onboarding tips.

## 2. Canvas & media model
- Canvas items live in `canvasState.images`, `.videos`, and `.notes`; each gets an auto-incrementing ID used as `@i`, `@v`, or `@t` references across chat and UI.
- Items share common behaviours (selection set, draggable headers, regeneration/download controls) implemented in `canvas.js`.
- Viewport math uses `clientToWorld` helpers for consistent positioning during pan/zoom.
- History stacks in `canvas.js` (`historyStack`/`futureStack`) enable undo/redo; wrap mutations in the provided helpers instead of rolling your own.
- Generation placement relies on `generationAnchors`: when placing multiple assets from one request, call `acquireGenerationPlacement` so follow-ups line up predictably. Update the anchor with `updateGenerationAnchorAfterDrag` if users move the latest asset.
- Notes behave like lightweight sticky cards (`DEFAULT_NOTE_WIDTH/HEIGHT`) and are persisted alongside images/videos.

## 3. Command & request pipeline
1. `chat.js` gathers the message, scans for `@i/@v/@t` mentions, pulls matching canvas entities.
2. `interpretUserCommand` (from `agent.js`) calls Gemini with the structured system prompt, producing `{ action, ... }` JSON and a natural-language reply.
3. `chat.js` records the AI reply, then routes to the correct executor:
   - **Images**: `generate_images` vs `edit_images` → Gemini Images REST calls (in `chat.js`), handling batching, placeholders, and canvas placement.
   - **Videos**: `generate_video` → Gemini 2.0 Flash REST calls (in `tools.js`), handling video generation and canvas placement.
   - **Firecrawl**: `extract_from_url` → `tools.js` manages job polling and renders collapsible JSON results.
   - **Notes**: `create_note` → `canvas.js` helpers create positioned sticky notes.
4. Request status banners live in chat (`startRequestStatus`, `updateRequestStatus`, `addRequestLog`). Always update them when adding new workflows so users get progress feedback.

## 4. Persistence & storage
- API keys live in `localStorage` (`GEMINI_API_KEY`, `FIRECRAWL_API_KEY`). Toggle buttons in chat simply switch the `<input type="password">` display.
- Canvas/chat state persists via IndexedDB stores defined in `storage.js` (`canvas-agent` DB, stores for images/videos/notes). When adding new media attributes, update both the stored record structure and the hydrators.
- `exportCanvas()` in `canvas.js` downloads a JSON payload containing positioning plus raw media data. Keep this schema backward-compatible when possible.

### JSON Schema & Data Formats

Nano Banana uses several JSON schemas for persistence, import/export, and clipboard operations:

#### Canvas Export/Import Schema

The main canvas export format (`exportCanvas()`, `importCanvasFromJsonFile()`) follows this structure:

```json
{
  "nodes": [
    {
      "id": 0,
      "type": "image",
      "x": 50,
      "y": 50,
      "width": 768,
      "height": 1344,
      "url": "data:image/png;base64,...",
      "prompt": "A beautiful landscape",
      "aspectRatio": "9:16",
      "resolution": "768x1344"
    },
    {
      "id": 1,
      "type": "video",
      "x": 858,
      "y": 50,
      "width": 480,
      "height": 270,
      "url": "data:video/mp4;base64,...",
      "prompt": "Video generation prompt",
      "aspectRatio": "16:9",
      "duration": 4,
      "sourceType": "data",
      "mimeType": "video/mp4",
      "sourceUrl": null,
      "externalId": null,
      "embedUrl": null
    },
    {
      "id": 2,
      "type": "note",
      "x": 1378,
      "y": 50,
      "width": 280,
      "height": 180,
      "text": "Note content here"
    }
  ],
  "viewport": {
    "zoom": 1.0,
    "offsetX": 0,
    "offsetY": 0
  }
}
```

**Node types:**
- **Images**: Include `url` (data URI with base64), `prompt`, `aspectRatio`, `resolution`
- **Videos**: Include `url` (data URI or external URL), `prompt`, `aspectRatio`, `duration`, `sourceType` (`data`/`url`/`youtube`), `mimeType`, `sourceUrl`, `externalId` (for YouTube), `embedUrl`
- **Notes**: Include `text`, `width`, `height`

**Viewport**: Stores zoom level and pan offset for restoring canvas position.

#### IndexedDB Storage Schema

Internal persistence (`storage.js`) uses separate IndexedDB stores:

**Images store** (`images`):
```json
{
  "id": 0,
  "x": 50,
  "y": 50,
  "data": "base64...",
  "mimeType": "image/png",
  "prompt": "prompt text",
  "aspectRatio": "9:16",
  "resolution": "768x1344",
  "referenceIds": [1, 2]
}
```

**Videos store** (`videos`):
```json
{
  "id": 0,
  "x": 50,
  "y": 50,
  "data": "base64..." (or null for URL-based),
  "mimeType": "video/mp4",
  "prompt": "prompt text",
  "aspectRatio": "16:9",
  "duration": 4,
  "sourceType": "data",
  "sourceUrl": null,
  "externalId": null,
  "embedUrl": null,
  "poster": null
}
```

**Notes store** (`notes`):
```json
{
  "id": 0,
  "x": 50,
  "y": 50,
  "width": 280,
  "height": 180,
  "text": "note content"
}
```

**Canvas metadata** (stored separately, from `buildCanvasMetaPayload()`):
```json
{
  "images": [{"id": 0, "x": 50, "y": 50}, ...],
  "videos": [{"id": 0, "x": 50, "y": 50}, ...],
  "notes": [{"id": 0, "x": 50, "y": 50}, ...],
  "zoom": 1.0,
  "offsetX": 0,
  "offsetY": 0,
  "imageCounter": 1,
  "videoCounter": 1,
  "noteCounter": 1
}
```

#### Internal Clipboard Schema

Copy/paste operations use `application/x-canvas-agent-items` MIME type:

```json
{
  "version": 1,
  "items": [
    {
      "type": "image",
      "offsetX": 0,
      "offsetY": 0,
      "width": 768,
      "height": 1344,
      "data": "base64...",
      "mimeType": "image/png",
      "prompt": "prompt text",
      "aspectRatio": "9:16",
      "resolution": "768x1344",
      "referenceIds": []
    }
  ]
}
```

Paste operations calculate positions relative to the paste origin using `offsetX`/`offsetY`.

#### Schema Evolution & Compatibility

- **Export format**: Designed for portability; includes full media data as data URIs
- **Storage format**: Optimized for IndexedDB; stores base64 strings directly
- **Hydration**: `hydrateCanvasFromRecords()` rebuilds DOM elements from stored records
- **Normalization**: `normalizeImportedCanvasPayload()` handles legacy formats and validates structure
- **Versioning**: Clipboard format includes a `version` field for future schema changes

When extending schemas:
1. Add new fields as optional (use `||` fallbacks in hydrators)
2. Update both export and storage schemas consistently
3. Test import/export round-trips with new fields
4. Document breaking changes in release notes

## 5. Conventions & guardrails
- Keep the stack vanilla (ES modules, no frameworks). Avoid introducing React/Svelte/etc. unless explicitly required.
- Follow the existing naming scheme for IDs (`@i`, `@t`) and ensure chat/canvas/storages stay in sync when adding new asset types.
- Prefer extending shared helpers instead of writing ad-hoc DOM mutations—`canvas.js` and `chat.js` expose utilities for most tasks (selection, placement, logging, downloads).
- When altering AI prompts or response handling, review `agent.js` to keep the system prompt aligned with new capabilities.
- UI affordances should remain keyboard-friendly (buttons with `aria-label`, focus states). Mirror current patterns when adding controls.
- Test frontend (`npm run lint`) before shipping changes.

## 6. Current capabilities & limitations

### ✅ Supported Features
- **Image Generation**: Gemini 2.5 Flash Image with 10 aspect ratios, batch generation
- **Video Generation**: Gemini 2.0 Flash for 4-8 second videos (16:9 or 9:16 aspect ratios)
- **Image Editing**: Reference existing images with `@i` mentions for modifications
- **Story Generation**: Multi-part narratives with automatic image variations
- **Canvas Management**: Infinite pan/zoom canvas with drag/drop, undo/redo
- **Asset Management**: Check/uncheck system for controlling AI context
- **Session Management**: Multiple workspaces with persistent storage
- **Notes System**: Text notes with `@t` references
- **Web Extraction**: Firecrawl integration for URL content extraction
- **Template System**: Reusable prompt shortcuts
- **Export/Import**: JSON export with full canvas state

### ❌ Removed Features
- **Audio Generation**: Previously used Fish Audio via proxy server
- **Server-side Processing**: Now pure frontend application
- **Proxy Services**: Direct API calls only, requires user API keys
- **Code Obfuscation**: Removed for open-source transparency

### 🔧 Technical Architecture
- **Frontend-only**: Vanilla HTML/CSS/JS with ES modules
- **Direct API Integration**: Gemini API calls from browser
- **Local Persistence**: IndexedDB for canvas state, localStorage for API keys
- **No Build Dependencies**: Optional Vite for development, works without bundling

## 7. Useful references
- Prompting best practices: `docs/PROMPTING_GUIDE.md`, `docs/docs_gemini_image.md`.
- Firecrawl usage: `docs/FIRECRAWL_INTEGRATION.md`.
- Historical roadmap & context: `docs/nanobanana.md`, `docs/release-plan.md`.

Welcome to Canvas Agent! Keep the instructions succinct, preserve the smooth canvas/chat workflow, and document any new flows inside `docs/` as they evolve.
