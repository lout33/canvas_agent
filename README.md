# Canvas Agent - AI Image Generator 🎨

Canvas Agent is a dual-panel AI creative studio that combines a free-form canvas with a conversational assistant powered by Google's Gemini 2.x image models. The project is intentionally framework-free so you can clone, drop in an API key, and start generating or editing images in minutes.

## ✨ Current Features

- **🖼️ Image Generation** - Create images with Gemini 2.5 Flash Image (10 aspect ratios, batch generation)
- **🎬 Video Generation** - Create videos with Gemini 2.0 Flash (4-8 seconds, 16:9 or 9:16 aspect ratios)
- **✏️ Image Editing** - Reference and modify images on canvas with natural language
- **📚 Story Generation** - Unified story creation with intelligent placement and automatic variations
- **🎨 Free-form Canvas** - Pan, zoom, drag, and organize your creations
- **✅ Asset Management** - Check/uncheck assets to control agent context inclusion
- **🔄 Session Management** - Multi-canvas support with persistent sessions and sharing
- **💬 AI Assistant** - Chat-based interface with intelligent spatial awareness
- **💾 Auto-save** - IndexedDB persistence keeps your work safe
- **🔗 Canvas References** - Chat mentions like `@i1`, `@v2`, `@t3` render as clickable badges that jump to the linked asset
- **📝 Notes System** - Create and manage text notes on the canvas
- **🌐 Web Extraction** - Extract content from URLs using Firecrawl (requires API key)
- **📋 Template System** - Save and reuse complex prompts as shortcuts

## ❌ Not Supported

- **Audio Generation** - Removed (previously used Fish Audio via server)
- **Server-side Processing** - Pure frontend application, no backend required
- **Proxy Services** - Direct API calls only, requires user's own API keys

## Quick start

1. **Clone the repo**
   ```bash
   git clone https://github.com/your-user/canvas-agent.git
   cd canvas-agent
   ```

2. **Open the app**
   - Double-click `index.html`, or
   - Serve locally: `python3 -m http.server` or `npm run dev`
   - Deploy to any static host (GitHub Pages, Netlify, Vercel)

3. **Add API keys**
   - **Required**: Gemini API key from [Google AI Studio](https://aistudio.google.com/api-keys)
   - **Optional**: Firecrawl API key for web extraction

4. **Start creating**
   - "generate 4 cyberpunk posters"
   - "create a cinematic sunset video"
   - "make @i2 warmer lighting"
   - "create a 3-part story about a robot"

### Complete User Guide

#### Getting Started

1. **Connect your tools** – Open ⚙️ Settings to add your Gemini API key for chat & imaging, plug in Firecrawl for web extraction, and run the optional Veo proxy for video jobs.

2. **Explore the canvas** – Review the toolbar buttons, ID sidebars, and save indicator so you know where undo, export, and auto-save feedback live.

3. **Prompt the agent** – Describe what you need in natural language and reference canvas items with `@i/@v/@t` to edit or extend previous work.

4. **Iterate & organize** – Drag, regenerate, or annotate assets directly on the canvas, then export when you're ready to share or archive.

#### Agent Commands & Actions

**Generate images**
Ask for batches like `generate 4 vaporwave posters`. Results land on the canvas with metadata and unique `@i` IDs you can reference later.

**Generate stories**
Request narratives such as `generate a 3-part origin story for our mascot`. The agent replies generating images using the reference of the last images. Like for create image 2 will use image 1 and for image 3 will use image 1 and 2.

**Edit existing images**
Reference assets with `@i2` to iterate: `make @i2 warmer lighting` or `add neon outlines to @i4`. The agent invokes Gemini image editing and replaces the selection in place.

**Extract from the web**
Unlock structured scraping with Firecrawl: `extract the headline and bullets from https://example.com`. Results render as collapsible JSON for easy copying.

**Capture ideas with notes**
Say `create a note titled lighting directions` or press the 📝 button to drop sticky text cards that persist alongside your media.

**Reuse prompts with templates**
Open the template manager (🧩) to save complex prompts as commands like `/template_productshot`, then type the shortcut in chat to expand it automatically.

**Track request progress**
Status updates appear in chat for every request (Queued → Running → Complete). Use them to spot failures quickly and jump back to the relevant command.

**Manage assets with checkmarks**
Use the ✅ Check All and ⬜ Uncheck All buttons to include/exclude assets in agent context. Individual assets have checkmark buttons (⬜/✅) to control whether the agent references them when generating new content.

**Work with sessions**
Create multiple canvas sessions with 🆕 New Session to organize different projects. Each session has its own canvas, conversation history, and persistent storage. Share sessions by copying the session URL or ID from the 📋 Session Info panel.

#### Canvas Toolbar Reference

**↩️ Undo / ↪️ Redo**
Step backward or forward through canvas changes. Keyboard shortcuts `Ctrl`/`⌘` + `Z` and `Shift` + `Ctrl`/`⌘` + `Z` (or `Ctrl`/`⌘` + `Y`) mirror these controls.

**🗑️ Delete**
Remove the current selection. Select items first by clicking them or using box-select, then tap Delete or press the keyboard key.

**✅ Check All / ⬜ Uncheck All**
Control which assets are included in agent context. Check All includes every current asset in AI responses; Uncheck All excludes them. Individual assets have their own checkmark buttons for fine-grained control.

**📝 Create Text Node**
Drop a sticky note anywhere on the canvas for briefs, checklists, or scene descriptions. Notes inherit IDs so you can reference them with `@t`.

**🧩 Create Template**
Open the prompt template manager to store reusable commands. Saved templates appear in chat when you use their `/shortcut`.

**✋ Pan Mode**
Toggle grab-to-pan navigation. You can also hold `Space` or press `H` to activate it temporarily.

**🔍 Zoom In / Out**
Adjust the viewport to focus on details or view the whole board. Zoom centers on your cursor location for precise framing.

**🔄 Reset View**
Snap the canvas back to the default zoom and origin if you get lost.

**🧹 Clear All**
Remove every asset from the canvas. Use export options first if you need a backup.

**💾 Export JSON**
Download a project snapshot containing prompts, placement, and media metadata—perfect for archiving or sharing setups.

**📦 Export Assets**
Bundle all current images and videos into a ZIP so you can move deliverables into other tools.

**🆕 New Session / 📋 Session Info**
Create and manage multiple canvas sessions. New Session starts a fresh workspace with a unique ID. Session Info shows the current session ID and URL for sharing your work with others or switching between projects.

#### Canvas Interactions & Layout Tips

- Hold `Space` or press `H` to toggle Pan Mode, then drag to move around the infinite canvas.
- Drag a blank area to box-select multiple items, then move or align them together; toolbar actions like Delete and Export respect the current selection.
- Paste screenshots and image files to import external media instantly.
- Use the header controls (♻️ regenerate, ⬇️ download) on each image to iterate without leaving the canvas.
- Click individual asset checkmark buttons (⬜/✅) to control agent context inclusion on a per-asset basis.
- Click IDs in the side panels to jump focus to that asset and reveal its on-canvas controls.
- Watch the 💾 indicator in the canvas footer to confirm when auto-save finishes or if IndexedDB encounters an error.

#### Keyboard Shortcuts

| Action | Shortcut |
| --- | --- |
| Send chat message | `Enter` |
| Insert newline without sending | `Shift` + `Enter` |
| Close guide | `Esc` |
| Delete selected items | `Delete` / `Backspace` |
| Undo | `Ctrl`/`⌘` + `Z` |
| Redo | `Shift` + `Ctrl`/`⌘` + `Z` or `Ctrl`/`⌘` + `Y` |
| Zoom in/out | `Ctrl`/`⌘` + `+` / `-` |
| Toggle pan mode | `H` |
| Toggle pan mode (temporary) | Hold `Space` |
| Box-select multiple images | Drag empty canvas |
| Zoom | Mousewheel or toolbar buttons |

## Architecture at a glance

- **Vanilla HTML/CSS/JS** – No bundler required; optional npm scripts wire up linting and deployment workflows.
- **Canvas state management** – Images and notes are tracked with deterministic IDs so chat prompts can reference them (`@i0`, `@t0`, ...).
- **Persistence** – IndexedDB caches images, layout metadata, and chat history for session recovery. LocalStorage stores the API key (you can now clear it with one click).
- **AI integration** – `app.js` builds Gemini requests based on structured chat analysis, manages multi-image batches, and streams progress updates into the chat.

## Security checklist

Because the app runs entirely in the browser, you are responsible for keeping secrets secure:

- ✅ Store Gemini keys in localStorage only for personal development; production deployments should proxy requests.
- ✅ Rotate API keys regularly and delete any that are accidentally exposed.
- ✅ Use the new “Copy API check command” button to verify credentials in a terminal before pasting them into the UI.
- ⚠️ Never commit keys to git—add environment variables or proxy services instead.

See [`SECURITY.md`](SECURITY.md) for a deeper checklist covering proxy deployment and rate-limit handling.

## Deployment recipes

- **Static hosts** – Works on GitHub Pages, Netlify, or Vercel static exports. Serve the `index.html`, `app.js`, and `styles.css` files directly.
- **Optional build step** – Use your preferred bundler (esbuild, Rollup, etc.) to minify `app.js` and `styles.css` before publishing.
- **Optional build step** – Use your preferred bundler (esbuild, Rollup, etc.) to minify `app.js` and `styles.css` before publishing.
- **Vercel (frontend-only)** – Choose the “Other” framework preset, set the build command to `npm run build`, and the output directory to `dist`. The postbuild step copies `src/` into the build output so every browser module is still served without touching the `server/` code.
- **Demo mode** – Configure environment variables or feature flags in your hosting setup to disable generation while showcasing the UI.

## Contributing

We welcome pull requests! Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup instructions, coding style, and the review process. Please read the [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) before engaging with the community.

If you find a bug or want to propose a feature, open an issue using the templates in `.github/ISSUE_TEMPLATE/`.

### OpenSpec workflow

This repo uses OpenSpec for any non-trivial change planning. Before you start a feature or major refactor:

- Read `openspec/AGENTS.md` to understand the end-to-end process and quick checklist.
- Ground yourself by running `openspec list` and `openspec list --specs` to see active work and existing capabilities.
- When you need a proposal, pick a unique verb-led `change-id` (for example, `update-chat-feedback`) and scaffold it under `openspec/changes/<change-id>/` using the CLI.
- Capture requirements in `specs/` deltas with `## ADDED|MODIFIED|REMOVED Requirements` sections and at least one `#### Scenario:` per requirement.
- Validate everything with `openspec validate <change-id> --strict` before requesting review to catch formatting or consistency issues early.

Simple fixes (typos, documentation tweaks, bug fixes that restore expected behaviour) generally skip the proposal stage, but still double-check `openspec/AGENTS.md` if you are unsure.

## Release readiness

When you're preparing a public release:

- [x] Follow the launch roadmap in [`release-plan.md`](release-plan.md)
- [x] Update the changelog (coming soon) and tag a version
- [x] Run the accessibility checklist (WCAG 2.1 AA baseline)
- [x] Publish the security guidance for self-hosters

## License

Canvas Agent is released under the [MIT License](LICENSE).

---

