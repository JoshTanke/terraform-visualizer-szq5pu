/**
 * @fileoverview Monaco Editor configuration with performance optimizations
 * for Terraform code editing. Includes settings for syntax highlighting,
 * validation, and memory management for large files.
 * @version 1.0.0
 */

import { editor } from 'monaco-editor'; // v0.34.x
import { IEditorSettings } from '../interfaces/ISettings';

// Font size constraints
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 24;
const DEFAULT_FONT_SIZE = 14;

// Editor configuration constants
const DEFAULT_TAB_SIZE = 2;
const AUTO_SAVE_DELAY = 1000; // milliseconds
const WORD_WRAP = 'on';

// Performance thresholds
const LARGE_FILE_THRESHOLD = 50000; // characters
const SYNTAX_HIGHLIGHT_LIMIT = 100000; // characters
const TOKENIZATION_DELAY = 30; // milliseconds
const MAX_TOKEN_LENGTH = 5000;

/**
 * Default editor configuration with performance optimizations
 */
export const DEFAULT_EDITOR_CONFIG: IEditorSettings = {
    autoSave: true,
    syntaxHighlighting: true,
    autoFormat: true,
    fontSize: DEFAULT_FONT_SIZE,
    tabSize: DEFAULT_TAB_SIZE,
    fontFamily: 'Consolas, "Courier New", monospace',
    lineHeight: 1.5,
    wordWrap: true,
    minimap: true
};

/**
 * Creates optimized Monaco editor configuration based on provided settings
 * @param settings - Editor settings to apply
 * @returns Optimized Monaco editor configuration object
 */
export function createEditorConfiguration(settings: IEditorSettings): editor.IEditorOptions {
    const validatedSettings = validateEditorSettings(settings);
    const fileSize = getCurrentFileSize();

    // Base configuration
    const config: editor.IEditorOptions = {
        fontSize: validatedSettings.fontSize,
        tabSize: validatedSettings.tabSize,
        fontFamily: validatedSettings.fontFamily,
        lineHeight: validatedSettings.lineHeight,
        wordWrap: validatedSettings.wordWrap ? WORD_WRAP : 'off',
        minimap: {
            enabled: validatedSettings.minimap && fileSize < LARGE_FILE_THRESHOLD
        },

        // Performance optimizations
        maxTokenizationLineLength: MAX_TOKEN_LENGTH,
        largeFileOptimizations: true,
        bracketPairColorization: {
            enabled: validatedSettings.syntaxHighlighting && fileSize < SYNTAX_HIGHLIGHT_LIMIT
        },

        // Editor behavior
        formatOnPaste: validatedSettings.autoFormat,
        formatOnType: validatedSettings.autoFormat,
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        autoSurround: 'quotes',

        // Performance settings for large files
        renderWhitespace: fileSize > LARGE_FILE_THRESHOLD ? 'none' : 'selection',
        folding: fileSize < LARGE_FILE_THRESHOLD,
        scrollBeyondLastLine: false,
        renderLineHighlight: fileSize < LARGE_FILE_THRESHOLD ? 'all' : 'none',

        // Memory optimizations
        scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
            alwaysConsumeMouseWheel: false
        },

        // Accessibility features
        accessibilitySupport: 'on',
        ariaLabel: 'Terraform Code Editor',

        // Performance-based tokenization
        tokenization: {
            maxLineLength: MAX_TOKEN_LENGTH,
            tokenizationDelay: TOKENIZATION_DELAY
        }
    };

    // Configure auto-save if enabled
    if (validatedSettings.autoSave) {
        config.autoSave = {
            delay: AUTO_SAVE_DELAY,
            enabled: true
        };
    }

    return config;
}

/**
 * Validates editor settings against allowed ranges and defaults
 * @param settings - Editor settings to validate
 * @returns Validated editor settings
 */
function validateEditorSettings(settings: IEditorSettings): IEditorSettings {
    return {
        ...DEFAULT_EDITOR_CONFIG,
        ...settings,
        fontSize: Math.min(
            Math.max(settings.fontSize || DEFAULT_FONT_SIZE, MIN_FONT_SIZE),
            MAX_FONT_SIZE
        ),
        tabSize: Math.max(settings.tabSize || DEFAULT_TAB_SIZE, 1),
        syntaxHighlighting: settings.syntaxHighlighting ?? true,
        autoFormat: settings.autoFormat ?? true,
        wordWrap: settings.wordWrap ?? true,
        minimap: settings.minimap ?? true
    };
}

/**
 * Gets the current file size for performance optimizations
 * @returns Current file size in characters
 */
function getCurrentFileSize(): number {
    try {
        const model = editor.getModel(editor.getActiveEditor()?.getModel()?.uri);
        return model ? model.getValueLength() : 0;
    } catch {
        return 0;
    }
}

/**
 * Disposes editor resources for memory management
 * @param editorInstance - Monaco editor instance to dispose
 */
export function disposeEditor(editorInstance: editor.IStandaloneCodeEditor): void {
    if (editorInstance) {
        const model = editorInstance.getModel();
        if (model) {
            model.dispose();
        }
        editorInstance.dispose();
    }
}