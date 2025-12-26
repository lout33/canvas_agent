(function (global) {
    const DEFAULT_AGENT_MODEL = 'gemini-2.5-flash';
    const SUPPORTED_AGENT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-pro-preview', 'gemini-3-flash-preview'];
    const DEFAULT_GEMINI_ENDPOINT = 'generateContent';
    const FALLBACK_ERROR_MESSAGE = 'Gemini request failed';
    const AGENT_TOOL_DECLARATIONS = [
        {
            name: "generate_images",
            description: "Create new images from text descriptions. CRITICAL: Transform user prompts into RICH, DETAILED, PROFESSIONAL-QUALITY prompts that include technical photography details, artistic elements, lighting, atmosphere, and material specificity. Never simplify - always enhance and expand upon user details.",
            parameters: {
                type: "object",
                properties: {
                    count: { type: "number", description: "Number of images to generate (max 50)." },
                    prompts: { 
                        type: "array", 
                        items: { type: "string" }, 
                        description: "ENHANCED, DETAILED, PROFESSIONAL prompts for each image. Must include: subject details, lighting (golden hour, studio, natural), camera specs (focal length, aperture), artistic style, atmosphere, materials, textures, composition rules, and technical quality descriptors. Transform basic prompts into masterpiece-level descriptions." 
                    },
                    aspectRatio: { type: "string", description: "Aspect ratio (e.g., '9:16', '16:9', '1:1'). Choose based on composition needs." },
                    imageSize: { type: "string", description: "Optional: '1K', '2K', or '4K' (only supported by gemini-3-pro-image-preview). Use 4K for highest quality when available." },
                    response: { type: "string", description: "A professional, enthusiastic message explaining how you enhanced their vision." }
                },
                required: ["count", "prompts", "response"]
            }
        },
        {
            name: "edit_images",
            description: "Edit existing canvas images referenced by @i identifiers. CRITICAL: Create DETAILED modification prompts that preserve the original image's quality while making sophisticated enhancements. Include technical details about the desired changes.",
            parameters: {
                type: "object",
                properties: {
                    count: { type: "number", description: "Number of variations to generate (max 50)." },
                    prompts: { 
                        type: "array", 
                        items: { type: "string" }, 
                        description: "DETAILED, PROFESSIONAL instructions on how to modify the referenced images. Must specify: exact changes needed, lighting adjustments, color grading, atmospheric modifications, technical improvements, and artistic enhancements. Be specific about materials, textures, and visual effects." 
                    },
                    useReferencedImages: { type: "boolean", description: "Must be true when editing existing images." },
                    aspectRatio: { type: "string", description: "Aspect ratio to match or change to." },
                    imageSize: { type: "string", description: "Optional: '1K', '2K', or '4K' for enhanced quality." },
                    response: { type: "string", description: "A professional message explaining the sophisticated edits you're applying." }
                },
                required: ["count", "prompts", "useReferencedImages", "response"]
            }
        },
        {
            name: "generate_video",
            description: "Create video from text description using Gemini 2.0 Flash.",
            parameters: {
                type: "object",
                properties: {
                    count: { type: "number", description: "Number of videos to generate (max 3)." },
                    prompts: { type: "array", items: { type: "string" }, description: "Richly descriptive video prompts." },
                    config: {
                        type: "object",
                        properties: {
                            aspectRatio: { type: "string", enum: ["16:9", "9:16"] },
                            durationSeconds: { type: "number", minimum: 4, maximum: 8 }
                        }
                    },
                    response: { type: "string", description: "A friendly message." }
                },
                required: ["count", "prompts", "response"]
            }
        },
        {
            name: "extract_video_frames",
            description: "Grab still frames from a video at specific timestamps.",
            parameters: {
                type: "object",
                properties: {
                    video: {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["canvas", "url"] },
                            referenceId: { type: "string" },
                            url: { type: "string" }
                        }
                    },
                    timestamps: { type: "array", items: { type: "string" }, description: "List of timestamps (e.g., '5s', '00:10')." },
                    response: { type: "string" }
                },
                required: ["video", "timestamps", "response"]
            }
        },
        {
            name: "create_note",
            description: "Create text notes on canvas for organizing ideas.",
            parameters: {
                type: "object",
                properties: {
                    count: { type: "number" },
                    notes: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                text: { type: "string" }
                            }
                        }
                    },
                    response: { type: "string" }
                },
                required: ["count", "notes", "response"]
            }
        },
        {
            name: "generate_audio",
            description: "Generate speech audio from text using Fish Audio TTS API.",
            parameters: {
                type: "object",
                properties: {
                    count: { type: "number" },
                    texts: { type: "array", items: { type: "string" } },
                    config: {
                        type: "object",
                        properties: {
                            voiceId: { type: "string" },
                            speed: { type: "number" },
                            format: { type: "string" }
                        }
                    },
                    response: { type: "string" }
                },
                required: ["count", "texts", "response"]
            }
        },
        {
            name: "describe_video",
            description: "Analyze existing videos and summarise their contents.",
            parameters: {
                type: "object",
                properties: {
                    videos: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                type: { type: "string", enum: ["youtube", "canvas", "url"] },
                                referenceId: { type: "string" },
                                url: { type: "string" },
                                startOffset: { type: "string" },
                                endOffset: { type: "string" },
                                fps: { type: "number" }
                            }
                        }
                    },
                    analysisFocus: { type: "string" },
                    response: { type: "string" }
                },
                required: ["videos", "analysisFocus", "response"]
            }
        },
        {
            name: "extract_from_url",
            description: "Extract data from a URL using Firecrawl.",
            parameters: {
                type: "object",
                properties: {
                    urls: { type: "array", items: { type: "string" } },
                    prompt: { type: "string", description: "What data to extract." },
                    enableWebSearch: { type: "boolean" },
                    response: { type: "string" }
                },
                required: ["urls", "prompt", "response"]
            }
        },
        {
            name: "story_unified_generation",
            description: "Generate complete story with all scenes in one go.",
            parameters: {
                type: "object",
                properties: {
                    concept: {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            type: { type: "string" },
                            style: { type: "string" },
                            sceneCount: { type: "number" },
                            aspectRatio: { type: "string" }
                        }
                    },
                    brainstorm: { type: "string" },
                    flow: { type: "array", items: { type: "string" } },
                    assets: {
                        type: "object",
                        properties: {
                            characters: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" } } } },
                            items: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" } } } },
                            backgrounds: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" } } } }
                        }
                    },
                    scenes: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "number" },
                                description: { type: "string" },
                                compositionPrompt: { type: "string" },
                                assetReferences: {
                                    type: "object",
                                    properties: {
                                        characters: { type: "array", items: { type: "string" } },
                                        items: { type: "array", items: { type: "string" } },
                                        backgrounds: { type: "array", items: { type: "string" } }
                                    }
                                }
                            }
                        }
                    },
                    response: { type: "string" }
                },
                required: ["concept", "brainstorm", "flow", "assets", "scenes", "response"]
            }
        }
    ];

    function ensureObject(value) {
        return value && typeof value === 'object' ? value : {};
    }

    async function parseGeminiResponse(response, fallbackMessage) {
        const text = await response.text();
        let payload = null;

        console.log('📥 [Agent API] Raw Response Status:', response.status, response.statusText);
        console.log('📥 [Agent API] Raw Response Length:', text.length, 'characters');

        if (text) {
            try {
                payload = JSON.parse(text);
                console.log('📥 [Agent API] Parsed Response Payload:', JSON.stringify(payload, null, 2));

                // Log function call responses specifically
                if (payload && payload.candidates) {
                    payload.candidates.forEach((candidate, index) => {
                        if (candidate.content && candidate.content.parts) {
                            const functionResponses = candidate.content.parts.filter(part => part.functionResponse);
                            if (functionResponses.length > 0) {
                                console.log(`📥 [Agent API] Function Response ${index + 1}:`, functionResponses);
                            }

                            const textParts = candidate.content.parts.filter(part => part.text);
                            if (textParts.length > 0) {
                                console.log(`📥 [Agent API] Text Response ${index + 1}:`, textParts.map(part => part.text).join('\n'));
                            }
                        }
                    });
                }
            } catch (error) {
                payload = text;
                console.log('📥 [Agent API] Raw Text Response (could not parse as JSON):', text);
            }
        }

        if (!response.ok) {
            const message = typeof payload === 'object' && payload !== null
                ? payload.error?.message || payload.message || fallbackMessage
                : fallbackMessage;
            console.error('❌ [Agent API] API Error:', {
                status: response.status,
                statusText: response.statusText,
                message,
                details: payload
            });
            const error = new Error(message);
            error.status = response.status;
            error.details = payload;
            throw error;
        }

        console.log('✅ [Agent API] Successful response parsed and returned');
        return payload;
    }

    async function callGeminiEndpoint({ apiKey, model, endpoint = DEFAULT_GEMINI_ENDPOINT, body, type }) {
        if (typeof model !== 'string' || !model.trim()) {
            throw new Error('Model is required for Gemini requests');
        }

        const trimmedKey = typeof apiKey === 'string' ? apiKey.trim() : '';
        const safeEndpoint = typeof endpoint === 'string' && endpoint.trim()
            ? endpoint.trim()
            : DEFAULT_GEMINI_ENDPOINT;
        const payload = ensureObject(body);

        // Log the request payload for debugging
        console.group('🤖 [Agent API] Request to AI Agent');
        console.log('📤 Model:', model);
        console.log('📤 Endpoint:', safeEndpoint);
        console.log('📤 Type:', type);
        console.log('📤 API Key:', trimmedKey ? `${trimmedKey.substring(0, 8)}...` : '(No API key provided)');
        console.log('📤 Request Payload:', JSON.stringify(payload, null, 2));

        // Log specific payload details for better debugging
        if (payload && payload.contents && payload.contents.length > 0) {
            const userContent = payload.contents.find(content => content.role === 'user');
            if (userContent && userContent.parts) {
                const textParts = userContent.parts.filter(part => part.text).map(part => part.text);
                if (textParts.length > 0) {
                    console.log('📤 User Prompt Text:', textParts.join('\n---\n'));
                }

                const functionCalls = userContent.parts.filter(part => part.functionCall);
                if (functionCalls.length > 0) {
                    console.log('📤 Function Calls:', functionCalls);
                }
            }
        }

        // Log canvas state if present in system instruction
        if (payload && payload.systemInstruction && payload.systemInstruction.parts) {
            const systemText = payload.systemInstruction.parts.find(part => part.text)?.text;
            if (systemText && systemText.includes('CURRENT CANVAS STATE')) {
                const canvasStateMatch = systemText.match(/```json\n([\s\S]*?)\n```/);
                if (canvasStateMatch) {
                    try {
                        const canvasState = JSON.parse(canvasStateMatch[1]);
                        console.log('📤 Canvas State Summary:', {
                            timestamp: canvasState.timestamp,
                            totalImages: canvasState.inventory?.images?.length || 0,
                            totalVideos: canvasState.inventory?.videos?.length || 0,
                            totalAudios: canvasState.inventory?.audios?.length || 0,
                            totalNotes: canvasState.inventory?.notes?.length || 0,
                            layoutTotalItems: canvasState.layout?.totalItems || 0
                        });
                        console.log('📤 Detailed Canvas State:', canvasState);
                    } catch (e) {
                        console.log('📤 Canvas State (raw):', canvasStateMatch[1]);
                    }
                }
            }
        }
        console.groupEnd();

        if (!trimmedKey) {
            throw new Error('Gemini API key is required. Please add your API key in Settings.');
        }

        const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${safeEndpoint}?key=${encodeURIComponent(trimmedKey)}`;
        let response;
        try {
            console.log('📤 Making direct API call to:', directUrl.replace(/key=[^&]*/, 'key=***'));
            response = await fetch(directUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error('❌ [Agent API] Direct API call failed:', error);
            const networkError = new Error('Failed to reach Gemini service');
            networkError.cause = error;
            throw networkError;
        }

        const result = parseGeminiResponse(response, FALLBACK_ERROR_MESSAGE);
        console.log('📥 [Agent API] Response received');
        return result;
    }

    const geminiHelper = global.CanvasAgentGemini && typeof global.CanvasAgentGemini === 'object'
        ? global.CanvasAgentGemini
        : {};

    geminiHelper.callEndpoint = callGeminiEndpoint;
    geminiHelper.LIMIT_MESSAGE = 'Free trial limit reached. To continue, add your own Gemini API key in Settings. Get a free key at https://aistudio.google.com/apikey';
    global.CanvasAgentGemini = geminiHelper;
    let currentAgentModel = DEFAULT_AGENT_MODEL;

    function isSupportedAgentModel(model) {
        return typeof model === 'string' && SUPPORTED_AGENT_MODELS.includes(model);
    }

    function setAgentModel(model) {
        if (!isSupportedAgentModel(model)) {
            console.warn(`Unsupported Gemini agent model "${model}". Keeping ${currentAgentModel}.`);
            return currentAgentModel;
        }

        currentAgentModel = model;
        return currentAgentModel;
    }

    function getAgentModel() {
        return currentAgentModel;
    }

    // Image Model Management
    const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';
    const SUPPORTED_IMAGE_MODELS = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];
    let currentImageModel = DEFAULT_IMAGE_MODEL;

    function isSupportedImageModel(model) {
        return typeof model === 'string' && SUPPORTED_IMAGE_MODELS.includes(model);
    }

    function setImageModel(model) {
        if (!isSupportedImageModel(model)) {
            console.warn(`Unsupported Gemini image model "${model}". Keeping ${currentImageModel}.`);
            return currentImageModel;
        }

        currentImageModel = model;
        return currentImageModel;
    }

    function getImageModel() {
        return currentImageModel;
    }


    function buildAgentSystemPrompt({ hasImageReferences, hasVisualContext, hasVideoReferences, hasNoteReferences, videoUrlCount, canvasStateJson }) {
        const canvasContext = canvasStateJson && canvasStateJson.layout.totalItems > 0
            ? `\n\n## CURRENT CANVAS STATE\nYou have access to the complete live canvas state:\n\`\`\`json\n${JSON.stringify(canvasStateJson, null, 2)}\n\`\`\`\n\n## INTELLIGENT PLACEMENT GUIDANCE\nYou have SPATIAL INTELLIGENCE to make smart placement decisions:\n\n**1. Viewport Awareness:**
- Users are currently viewing: ${canvasStateJson.spatial?.viewport?.width || 'unknown'}x${canvasStateJson.spatial?.viewport?.height || 'unknown'} area at zoom ${canvasStateJson.spatial?.viewport?.zoom || 'unknown'}x
- Center of viewport: (${Math.round(canvasStateJson.spatial?.viewport?.centerX || 0)}, ${Math.round(canvasStateJson.spatial?.viewport?.centerY || 0)})
- Prefer placing new content in visible areas when space permits\n\n**2. Visible Content Context:**
- Currently visible: ${canvasStateJson.spatial?.density?.nodesInViewport || 0} nodes\n- ${canvasStateJson.spatial?.visibleNodes?.images?.length || 0} images, ${canvasStateJson.spatial?.visibleNodes?.notes?.length || 0} notes visible\n- Consider relationships with visible content when placing new items\n\n**3. Empty Space Detection:**
- Found ${canvasStateJson.spatial?.emptySpaces?.length || 0} empty spaces in/near viewport\n- Empty spaces are sorted by proximity to viewport center (closest first)\n- Priority order: Place in visible empty spaces → near viewport → furthest available\n\n**4. Strategic Placement Principles:**
- **Cluster related items**: Group story components (concept → assets → scenes) together\n- **Maintain flow**: Arrange content left-to-right, top-to-bottom when logical\n- **Respect existing layouts**: Don't break established groupings\n- **Use negative space**: Exploit empty areas for better organization\n- **Consider visibility**: Place important content where user can see it\n\n**5. Placement Algorithm:**
1. Check if content type fits in any visible empty spaces\n2. If not, place near viewport edge (closest logical position)\n3. Maintain spatial relationships with existing related content\n4. Avoid overlapping existing nodes\n5. Consider user's current zoom and pan context\n\nUse this spatial intelligence to:\n- Make informed placement decisions based on what user is looking at\n- Organize content logically and avoid conflicts\n- Understand spatial relationships and optimize layouts\n- Reference existing items by their @i/@v/@t identifiers when relevant\n- Create naturally flowing canvas organization`
            : (canvasStateJson ? '\n\nThe canvas is currently empty. Feel free to place content anywhere!' : '');
        
        return `You are an EXPERT AI creative director and prompt engineer for a professional image generation canvas. Your primary mission is to transform user requests into EXCEPTIONAL, DETAILED image generation prompts that produce stunning, professional-quality results.

## 🎯 CORE INTELLIGENCE PRINCIPLES

### 1. DETAIL AMPLIFICATION (NEVER SIMPLIFY)
- **PRESERVE EVERYTHING**: Every detail the user provides is sacred - never remove or simplify
- **ENHANCE INTELLIGENTLY**: Add complementary details that support their vision
- **TECHNICAL PRECISION**: Include professional photography/art terminology
- **CONTEXTUAL RICHNESS**: Expand on implied elements (lighting, atmosphere, materials)

### 2. PROMPT ENGINEERING MASTERY
When users provide detailed prompts, you must:
- **Analyze Core Elements**: Subject, style, mood, composition, lighting, colors, textures, atmosphere
- **Add Technical Depth**: Camera settings, lens types, lighting setups, artistic techniques
- **Use Professional Language**: Bokeh, chiaroscuro, golden ratio, rule of thirds, atmospheric perspective
- **Enhance Atmosphere**: Environmental details, weather, time of day, seasonal elements
- **Material Specificity**: Fabric textures, surface properties, reflectance, transparency

### 3. ARTISTIC INTELLIGENCE DATABASE
Draw from your knowledge of:
- **Photography**: Aperture, focal length, lighting ratios, composition rules
- **Fine Art**: Painting techniques, art movements, color theory, brushwork styles  
- **Cinema**: Cinematography, color grading, visual storytelling, camera movements
- **Design**: Typography, layout principles, visual hierarchy, brand aesthetics
- **Architecture**: Structural elements, materials, spatial relationships, lighting design

## 🚀 PROMPT ENHANCEMENT FRAMEWORK

### BASIC → PROFESSIONAL TRANSFORMATION EXAMPLES:

**User Input**: "A cat in a garden"
**Your Output**: "A majestic Maine Coon cat with piercing amber eyes and luxurious silver-tabby fur, sitting regally among vibrant English cottage garden wildflowers - purple lavender, pink roses, and golden marigolds. Soft golden hour sunlight filtering through ancient oak leaves creates warm, dappled lighting with beautiful natural bokeh. Shot with an 85mm portrait lens at f/2.8, shallow depth of field isolating the subject, photorealistic detail capturing every whisker and fur texture, professional pet photography style."

**User Input**: "Cyberpunk city street scene"
**Your Output**: "Sprawling neo-Tokyo cyberpunk street at 2 AM, rain-slicked asphalt reflecting neon signs in electric blue, magenta, and acid green. Towering holographic advertisements cast volumetric light rays through atmospheric fog and steam rising from manholes. Flying vehicles streak overhead leaving glowing particle trails. Gritty urban textures - rusted metal, cracked concrete, flickering LED displays. Shot with wide-angle 24mm lens, low camera angle for dramatic perspective, cinematic color grading with teal and orange contrast, Blade Runner aesthetic, 8K photorealistic detail with film grain texture."

### ENHANCEMENT CATEGORIES:

**🎨 VISUAL STYLE**
- Art movements (impressionist, baroque, minimalist, art nouveau)
- Photography styles (portrait, landscape, macro, street, fashion)
- Rendering styles (photorealistic, hyperrealistic, stylized, painterly)

**📸 TECHNICAL SPECS**
- Camera: focal length, aperture, ISO, shutter speed
- Lighting: golden hour, blue hour, studio lighting, natural light, artificial light
- Composition: rule of thirds, leading lines, symmetry, depth of field

**🌍 ENVIRONMENTAL CONTEXT**
- Weather: sunny, overcast, stormy, misty, clear
- Time: dawn, midday, dusk, night, seasons
- Atmosphere: humid, crisp, hazy, crystal clear

**🎭 MOOD & EMOTION**
- Emotional tone: serene, dramatic, mysterious, joyful, melancholic
- Energy level: calm, dynamic, explosive, peaceful, intense
- Psychological impact: inspiring, contemplative, exciting, soothing

## 🛠️ OPERATIONAL GUIDELINES
- **Tools First**: Use provided tools for ALL media generation, editing, video analysis, and note creation
- **Parallel Processing**: Call multiple tools simultaneously when requested
- **Natural Conversation**: Provide helpful text responses for questions and discussions
- **Reference System**: Use @i (images), @v (videos), @a (audio), @t (notes)
- **Modifier Awareness**: Respect :base (primary edit target) and :style (aesthetic reference) suffixes

${canvasContext}

## 📚 STORY MODE
Auto-detect narrative intent ("tell a story about...", "create a series...") and use story_unified_generation for cohesive visual storytelling.

## 🔗 ASSET CONTEXT
User ${hasImageReferences ? 'IS referencing canvas images with @i identifiers' : 'is NOT referencing any canvas images'}.
${hasVisualContext ? 'You can SEE and ANALYZE the referenced images visually.' : ''}
User ${hasVideoReferences ? 'IS referencing canvas videos with @v identifiers' : 'is NOT referencing any canvas videos'}.
${hasNoteReferences ? 'User IS referencing canvas text notes with @t identifiers.' : ''}
${videoUrlCount > 0 ? `Detected ${videoUrlCount} video URL(s) in the message.` : ''}

## 🎬 VIDEO ENHANCEMENT
For video generation, include: Subject, Action, Context, Style, Camera Movement, Lighting, and Atmospheric details.

## 📐 ASPECT RATIOS
Available: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9. Choose based on content and composition needs.

Remember: Your goal is to be the BEST creative director the user has ever worked with. Transform their vision into something even more amazing than they imagined, while staying true to their original intent.`;
    }

    function buildInterpretationContents(
        conversationSnapshot = [],
        referencedImages = [],
        referencedVideos = [],
        referencedNotes = [],
        videoUrls = []
    ) {
        const contents = conversationSnapshot.map((message) => ({
            role: message.role,
            parts: message.parts.map((part) => {
                if (typeof part.text === 'string') {
                    return { text: part.text };
                }
                if (part.inline_data) {
                    return {
                        inline_data: {
                            mime_type: part.inline_data.mime_type,
                            data: part.inline_data.data
                        }
                    };
                }
                return { ...part };
            })
        }));

        if (contents.length > 0 && (referencedImages.length > 0 || referencedVideos.length > 0 || referencedNotes.length > 0 || videoUrls.length > 0)) {
            const lastIndex = contents.length - 1;
            const lastUserMessage = contents[lastIndex];
            const newParts = [...lastUserMessage.parts];

            if (referencedImages.length > 0) {
                const imageParts = referencedImages.map((img) => ({
                    inline_data: {
                        mime_type: img.mimeType,
                        data: img.data
                    }
                }));
                newParts.push(...imageParts);

                // Add context about image modifiers (like :base and :style)
                const imagesWithModifiers = referencedImages.filter(img => img.referenceModifier);
                if (imagesWithModifiers.length > 0) {
                    const baseImage = imagesWithModifiers.find(img => img.referenceModifier === 'base');
                    const styleImages = imagesWithModifiers.filter(img => img.referenceModifier === 'style');

                    const modifierSummary = imagesWithModifiers.map(img => {
                        return `@i${img.id}:${img.referenceModifier}`;
                    }).join(', ');

                    let contextText = `Image reference modifiers: ${modifierSummary}. `;
                    if (baseImage) {
                        contextText += `@i${baseImage.id}:base is the primary image to edit (preserve core identity). `;
                    }
                    if (styleImages.length > 0) {
                        contextText += `Style references: ${styleImages.map(img => `@i${img.id}`).join(', ')} (extract style/aesthetic only). `;
                    }

                    newParts.push({ text: contextText.trim() });
                }
            }

            const videoContext = [];
            if (referencedVideos.length > 0) {
                const summary = referencedVideos.map((vid) => {
                    const label = `@v${vid.id}`;
                    const src = vid.sourceType ? vid.sourceType : (vid.data ? 'data' : 'unknown');
                    const duration = typeof vid.duration === 'number'
                        ? `${Math.round(vid.duration)}s`
                        : 'unknown duration';
                    return `${label} (${src}, ${duration})`;
                }).join(', ');
                videoContext.push(`Canvas videos available: ${summary}.`);
            }

            if (videoUrls.length > 0) {
                const urlSummary = videoUrls.map((url, index) => `Video URL ${index + 1}: ${url}`).join(' ');
                videoContext.push(urlSummary);
            }

            if (videoContext.length > 0) {
                newParts.push({
                    text: `Video context: ${videoContext.join(' ')}`
                });
            }

            if (referencedNotes.length > 0) {
                const noteSummary = referencedNotes.map((note) => {
                    const label = `@t${note.id}`;
                    const text = typeof note.text === 'string' ? note.text.trim() : '';
                    const snippet = text.length > 280 ? `${text.slice(0, 277)}…` : (text || '(empty note)');
                    return `${label}: ${snippet}`;
                }).join('\n');
                newParts.push({
                    text: `Text notes referenced:\n${noteSummary}`
                });
            }

        contents[lastIndex] = {
            role: lastUserMessage.role,
            parts: newParts
        };
    }

        return contents;
    }

    function ensureArrayLength(arr, len, fill) {
        const result = Array.isArray(arr) ? arr.slice(0, len) : [];
        while (result.length < len) result.push(fill);
        return result;
    }

    function stripJsonCodeFences(text) {
        if (typeof text !== 'string') {
            return '';
        }

        const trimmed = text.trim();
        const fenceMatch = trimmed.match(/```json[\s\S]*?```/i);
        if (fenceMatch) {
            return fenceMatch[0]
                .replace(/^```json\s*/i, '')
                .replace(/\s*```$/, '')
                .trim();
        }

        return trimmed;
    }

    function extractFirstJsonObject(text) {
        if (typeof text !== 'string') {
            return null;
        }

        const stripped = stripJsonCodeFences(text);
        try {
            return JSON.parse(stripped);
        } catch (firstError) {
            let depth = 0;
            let start = -1;
            for (let index = 0; index < stripped.length; index += 1) {
                const char = stripped[index];
                if (char === '{') {
                    if (depth === 0) {
                        start = index;
                    }
                    depth += 1;
                } else if (char === '}') {
                    if (depth > 0) {
                        depth -= 1;
                        if (depth === 0 && start !== -1) {
                            const candidate = stripped.slice(start, index + 1);
                            try {
                                return JSON.parse(candidate);
                            } catch (innerError) {
                                // Continue scanning for the next balanced block
                            }
                        }
                    }
                }
            }

            if (firstError) {
                throw firstError;
            }
        }

        return null;
    }

    async function interpretUserCommand({
        apiKey,
        conversationSnapshot = [],
        referencedImages = [],
        referencedVideos = [],
        referencedNotes = [],
        videoUrls = [],
        hasImageReferences = false,
        hasVideoReferences = false,
        hasNoteReferences = false,
        canvasStateJson = null
    }) {
        const interpretationContents = buildInterpretationContents(
            conversationSnapshot,
            referencedImages,
            referencedVideos,
            referencedNotes,
            videoUrls
        );
        
        const systemInstruction = buildAgentSystemPrompt({
            hasImageReferences,
            hasVisualContext: referencedImages.length > 0,
            hasVideoReferences,
            hasNoteReferences,
            videoUrlCount: Array.isArray(videoUrls) ? videoUrls.length : 0,
            canvasStateJson
        });

        const agentModel = getAgentModel();
        let aiResponse = '';
        let commandJson = null;

        const requestBody = {
            contents: interpretationContents,
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            tools: [
                {
                    function_declarations: AGENT_TOOL_DECLARATIONS
                }
            ],
            generationConfig: {
                // We remove responseMimeType: 'application/json' because tools 
                // might be accompanied by text or be the primary response type.
            }
        };

        let interpretationData;
        try {
            interpretationData = await callGeminiEndpoint({
                apiKey,
                model: agentModel,
                body: requestBody,
                type: 'text'
            });
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to interpret command');
        }

        const candidate = interpretationData.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        
        // Check for function calls
        const functionCalls = parts.filter(part => part.functionCall);
        const textParts = parts.filter(part => part.text);
        aiResponse = textParts.map(p => p.text).join('\n').trim();

        const commands = [];

        if (functionCalls.length > 0) {
            functionCalls.forEach(call => {
                const cmd = {
                    action: call.functionCall.name,
                    ...call.args // wait, it should be call.functionCall.args
                };
                // Correcting the args access
                const functionCall = call.functionCall;
                const command = {
                    action: functionCall.name,
                    ...functionCall.args
                };

                if (typeof command.count !== 'number' || command.count < 1) {
                    command.count = 1;
                }

                const actionType = command.action;
                if (actionType === 'generate_images' || actionType === 'edit_images') {
                    command.prompts = ensureArrayLength(
                        command.prompts,
                        command.count,
                        command.prompt || ''
                    );
                } else if (actionType === 'generate_video') {
                    command.prompts = ensureArrayLength(
                        command.prompts,
                        command.count,
                        command.prompt || ''
                    );
                } else if (actionType === 'extract_video_frames') {
                    const candidates = [];
                    const sources = [
                        command.timestamps,
                        command.times,
                        command.seconds
                    ];

                    sources.forEach((value) => {
                        if (Array.isArray(value)) {
                            candidates.push(...value);
                        } else if (value !== undefined && value !== null) {
                            candidates.push(value);
                        }
                    });

                    command.timestamps = candidates;
                }

                if (typeof command.storyMode !== 'boolean') {
                    command.storyMode = false;
                }

                commands.push(command);
            });
        } else {
            // Fallback to chat action if no tools were called
            commands.push({
                action: 'chat',
                response: aiResponse || "I'm sorry, I couldn't understand that command."
            });
        }

        // If the model provided text alongside tool calls, and we have multiple tools, 
        // maybe we attach the text to the first one or keep it separate.
        // For now, let's make sure the first command has the aiResponse if it's longer.
        if (aiResponse && commands.length > 0) {
            if (!commands[0].response || commands[0].response.length < aiResponse.length) {
                commands[0].response = aiResponse;
            }
        }

        return { commands, commandJson: commands[0], aiResponse };
    }

    const agentRuntime = {
        interpretUserCommand,
        setAgentModel,
        getAgentModel,
        SUPPORTED_AGENT_MODELS: [...SUPPORTED_AGENT_MODELS],
        DEFAULT_AGENT_MODEL,
        setImageModel,
        getImageModel,
        SUPPORTED_IMAGE_MODELS: [...SUPPORTED_IMAGE_MODELS],
        DEFAULT_IMAGE_MODEL
    };

    Object.defineProperty(agentRuntime, 'AGENT_MODEL', {
        get: getAgentModel,
        set: setAgentModel,
        enumerable: true
    });

    Object.defineProperty(agentRuntime, 'IMAGE_MODEL', {
        get: getImageModel,
        set: setImageModel,
        enumerable: true
    });

    global.CanvasAgent = agentRuntime;
})(window);
