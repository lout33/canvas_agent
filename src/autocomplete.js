/**
 * Autocomplete Controller
 * Provides intelligent completion for @, /, and : references in the chat input
 */

// ============================================================================
// State
// ============================================================================

let isOpen = false;
let currentContext = null; // { type, prefix, query, cursorPos }
let selectedIndex = 0;
let filteredItems = [];
let debounceTimer = null;

// DOM references
let dropdown = null;
let dropdownHeader = null;
let dropdownItems = null;
let textarea = null;

// ============================================================================
// Context Detection
// ============================================================================

/**
 * Detects what type of completion to show based on cursor position
 * Priority: : > @ > /
 */
function detectContext(textareaElement) {
    const text = textareaElement.value;
    const cursorPos = textareaElement.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);

    // 1. Check for : modifier (only after @i)
    const modifierMatch = textBeforeCursor.match(/@i(\d+):(\w*)$/);
    if (modifierMatch) {
        return {
            type: 'modifier',
            prefix: `@i${modifierMatch[1]}:`,
            query: modifierMatch[2],
            cursorPos,
            imageId: modifierMatch[1]
        };
    }

    // 2. Check for @ references (must specify type: @i, @v, @t, @a)
    const refMatch = textBeforeCursor.match(/@([ivta])(\d*)$/);
    if (refMatch) {
        return {
            type: refMatch[1], // 'i', 'v', 't', 'a'
            prefix: `@${refMatch[1]}`,
            query: refMatch[2],
            cursorPos
        };
    }

    // 3. Check for / templates
    const templateMatch = textBeforeCursor.match(/\/([\w-]*)$/);
    if (templateMatch) {
        return {
            type: 'template',
            prefix: '/',
            query: templateMatch[1],
            cursorPos
        };
    }

    return null;
}

// ============================================================================
// Data Filtering
// ============================================================================

/**
 * Gets filtered items based on current context
 */
function filterItems(context) {
    if (!context) return [];

    switch (context.type) {
        case 'i': // Images
            return canvasState.images
                .filter(img => String(img.id).startsWith(context.query || ''))
                .sort((a, b) => b.id - a.id) // Most recent first
                .map(img => ({
                    label: `@i${img.id}`,
                    value: `@i${img.id}`
                }));

        case 'v': // Videos
            return canvasState.videos
                .filter(v => String(v.id).startsWith(context.query || ''))
                .sort((a, b) => b.id - a.id)
                .map(v => ({
                    label: `@v${v.id}`,
                    value: `@v${v.id}`
                }));

        case 't': // Text notes
            return canvasState.notes
                .filter(n => String(n.id).startsWith(context.query || ''))
                .sort((a, b) => b.id - a.id)
                .map(n => ({
                    label: `@t${n.id}`,
                    value: `@t${n.id}`
                }));

        case 'a': // Audio
            return canvasState.audios
                .filter(a => String(a.id).startsWith(context.query || ''))
                .sort((a, b) => b.id - a.id)
                .map(a => ({
                    label: `@a${a.id}`,
                    value: `@a${a.id}`
                }));

        case 'modifier': // : modifiers
            const modifiers = ['base', 'style'];
            return modifiers
                .filter(m => m.startsWith(context.query || ''))
                .map(m => ({
                    label: m,
                    value: context.prefix + m
                }));

        case 'template': // / commands
            return listTemplates()
                .filter(t => {
                    const commandName = t.command.substring(1); // Remove leading /
                    return commandName.startsWith(context.query || '');
                })
                .map(t => ({
                    label: t.command,
                    value: t.command
                }));

        default:
            return [];
    }
}

/**
 * Gets header label for current context
 */
function getContextLabel(context) {
    if (!context) return '';

    switch (context.type) {
        case 'i': return 'Images';
        case 'v': return 'Videos';
        case 't': return 'Notes';
        case 'a': return 'Audio';
        case 'modifier': return 'Modifiers';
        case 'template': return 'Templates';
        default: return '';
    }
}

// ============================================================================
// UI Updates
// ============================================================================

/**
 * Shows the autocomplete dropdown with given items
 */
function showAutocomplete(items, context) {
    if (items.length === 0) {
        hideAutocomplete();
        return;
    }

    filteredItems = items;
    currentContext = context;
    selectedIndex = 0;
    isOpen = true;

    // Update header
    dropdownHeader.textContent = getContextLabel(context);

    // Render items
    renderItems();

    // Show dropdown
    dropdown.hidden = false;
}

/**
 * Renders the list of items
 */
function renderItems() {
    dropdownItems.innerHTML = '';

    if (filteredItems.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'autocomplete-empty';
        emptyDiv.textContent = 'No matches';
        dropdownItems.appendChild(emptyDiv);
        return;
    }

    filteredItems.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'autocomplete-item';
        if (index === selectedIndex) {
            itemDiv.classList.add('selected');
        }
        itemDiv.textContent = item.label;
        itemDiv.dataset.index = index;

        // Mouse events
        itemDiv.addEventListener('mouseenter', () => {
            selectedIndex = index;
            updateSelection();
        });

        itemDiv.addEventListener('click', () => {
            insertCompletion(item);
            hideAutocomplete();
        });

        dropdownItems.appendChild(itemDiv);
    });
}

/**
 * Updates which item is selected
 */
function updateSelection() {
    const items = dropdownItems.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add('selected');
            // Scroll into view if needed
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('selected');
        }
    });
}

/**
 * Hides the autocomplete dropdown
 */
function hideAutocomplete() {
    if (!isOpen) return;

    isOpen = false;
    currentContext = null;
    selectedIndex = 0;
    filteredItems = [];
    dropdown.hidden = true;
}

// ============================================================================
// Keyboard Navigation
// ============================================================================

/**
 * Handles keyboard navigation in autocomplete
 */
function handleKeyboardNavigation(event) {
    if (!isOpen) return false;

    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, filteredItems.length - 1);
            updateSelection();
            return true;

        case 'ArrowUp':
            event.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            updateSelection();
            return true;

        case 'Enter':
        case 'Tab':
            if (filteredItems.length > 0) {
                event.preventDefault();
                insertCompletion(filteredItems[selectedIndex]);
                hideAutocomplete();
                return true;
            }
            break;

        case 'Escape':
            event.preventDefault();
            hideAutocomplete();
            return true;
    }

    return false;
}

// ============================================================================
// Completion Insertion
// ============================================================================

/**
 * Inserts the selected completion into the textarea
 */
function insertCompletion(item) {
    if (!currentContext || !textarea) return;

    const text = textarea.value;
    const context = currentContext;

    // Find start position of the query
    const startPos = context.cursorPos - context.prefix.length - context.query.length;
    const endPos = context.cursorPos;

    // Replace query with completion
    const before = text.substring(0, startPos);
    const after = text.substring(endPos);
    const newText = before + item.value + after;

    textarea.value = newText;

    // Set cursor after insertion
    const newCursorPos = startPos + item.value.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();

    // Trigger input event for any listeners
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handles input events on the textarea
 */
function handleInput(event) {
    // Clear existing debounce timer
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    // Debounce to prevent flicker during rapid typing
    debounceTimer = setTimeout(() => {
        const context = detectContext(event.target);

        if (context) {
            const items = filterItems(context);
            if (items.length > 0) {
                showAutocomplete(items, context);
            } else {
                hideAutocomplete();
            }
        } else {
            hideAutocomplete();
        }
    }, 50);
}

/**
 * Handles click outside to close autocomplete
 */
function handleClickOutside(event) {
    if (!isOpen) return;

    if (!dropdown.contains(event.target) && event.target !== textarea) {
        hideAutocomplete();
    }
}

/**
 * Handles textarea blur
 */
function handleBlur() {
    // Delay hiding to allow click events on items to fire first
    setTimeout(() => {
        if (isOpen && document.activeElement !== textarea) {
            hideAutocomplete();
        }
    }, 200);
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initializes the autocomplete system
 */
function initializeAutocomplete() {
    // Get DOM references
    dropdown = document.getElementById('autocompleteDropdown');
    dropdownHeader = dropdown.querySelector('.autocomplete-header');
    dropdownItems = dropdown.querySelector('.autocomplete-items');
    textarea = document.getElementById('chatInput');

    if (!dropdown || !textarea) {
        console.error('Autocomplete: Required DOM elements not found');
        return;
    }

    // Add event listeners
    textarea.addEventListener('input', handleInput);
    textarea.addEventListener('keydown', (e) => {
        handleKeyboardNavigation(e);
    });
    textarea.addEventListener('blur', handleBlur);
    document.addEventListener('click', handleClickOutside);

    console.log('Autocomplete initialized');
}

/**
 * Returns whether autocomplete is currently open
 */
function isAutocompleteOpen() {
    return isOpen;
}
