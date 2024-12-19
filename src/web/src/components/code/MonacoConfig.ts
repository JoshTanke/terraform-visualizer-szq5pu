/**
 * @fileoverview Monaco Editor configuration for Terraform HCL code editing with
 * comprehensive language support, theme customization, and performance optimization.
 * @version 1.0.0
 */

import { languages, editor } from 'monaco-editor'; // v0.34.x
import { IEditorSettings } from '../../interfaces/ISettings';

// Language Constants
const LANGUAGE_ID = 'terraform';
const FILE_EXTENSIONS = ['.tf', '.tfvars'];
const LANGUAGE_ALIASES = ['terraform', 'tf', 'hcl'];

// Terraform Keywords and Operators
const KEYWORDS = [
    'resource', 'data', 'variable', 'output', 'module', 'provider',
    'terraform', 'locals', 'backend', 'count', 'for_each',
    'depends_on', 'lifecycle', 'provisioner'
];

const OPERATORS = [
    '=', '==', '!=', '>=', '<=', '+', '-', '*', '/', '?', ':',
    '=>', '!', '&&', '||'
];

/**
 * Creates a comprehensive HCL language definition for Monaco editor
 * with support for all Terraform block types and optimized performance.
 */
export function createLanguageDefinition(): languages.IMonarchLanguage {
    return {
        defaultToken: 'invalid',
        tokenPostfix: '.tf',
        brackets: [
            { open: '{', close: '}', token: 'delimiter.curly' },
            { open: '[', close: ']', token: 'delimiter.square' },
            { open: '(', close: ')', token: 'delimiter.parenthesis' }
        ],
        keywords: KEYWORDS,
        operators: OPERATORS,
        
        // Block structure tokens
        symbols: /[=><!~?:&|+\-*\/\^%]+/,
        escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
        
        // Tokenizer with performance optimizations
        tokenizer: {
            root: [
                // Block comments
                [/\/\*/, 'comment', '@comment'],
                // Line comments
                [/\/\/.*$/, 'comment'],
                // String literals
                [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
                // Heredoc
                [/<<-?\s*["']?([^"']*)["']?/, { token: 'string.heredoc', next: '@heredoc.$1' }],
                // Numbers
                [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
                [/\d+/, 'number'],
                // Block identifiers
                [/[a-zA-Z_]\w*/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@default': 'identifier'
                    }
                }],
                // Operators
                [/@symbols/, {
                    cases: {
                        '@operators': 'operator',
                        '@default': 'delimiter'
                    }
                }]
            ],
            
            // String state with interpolation support
            string: [
                [/\$\{/, { token: 'delimiter.bracket', next: '@interpolated' }],
                [/[^"\\$]+/, 'string'],
                [/@escapes/, 'string.escape'],
                [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
            ],
            
            // Interpolation state
            interpolated: [
                [/\}/, { token: 'delimiter.bracket', next: '@pop' }],
                { include: 'root' }
            ],
            
            // Block comment state
            comment: [
                [/[^\/*]+/, 'comment'],
                [/\*\//, 'comment', '@pop'],
                [/[\/*]/, 'comment']
            ],
            
            // Heredoc state
            heredoc: [
                [/^(\s*)(.*)$/, {
                    cases: {
                        '$2~^\\s*\\w+\\s*$': { token: 'string.heredoc', next: '@pop' },
                        '@default': 'string.heredoc'
                    }
                }]
            ]
        }
    };
}

/**
 * Creates a custom theme for Terraform HCL syntax highlighting
 * with semantic token support and optimal visibility.
 */
export function createThemeDefinition(): editor.IStandaloneThemeData {
    return {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
            { token: 'string', foreground: 'CE9178' },
            { token: 'number', foreground: 'B5CEA8' },
            { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
            { token: 'operator', foreground: 'D4D4D4' },
            { token: 'identifier', foreground: '9CDCFE' },
            { token: 'delimiter.curly', foreground: 'D4D4D4' },
            { token: 'delimiter.square', foreground: 'D4D4D4' },
            { token: 'delimiter.parenthesis', foreground: 'D4D4D4' },
            { token: 'string.heredoc', foreground: 'CE9178' },
            { token: 'string.escape', foreground: 'D7BA7D' }
        ],
        colors: {
            'editor.background': '#1E1E1E',
            'editor.foreground': '#D4D4D4',
            'editor.lineHighlightBackground': '#2D2D2D',
            'editorCursor.foreground': '#FFFFFF',
            'editorWhitespace.foreground': '#404040',
            'editorLineNumber.foreground': '#858585',
            'editor.selectionBackground': '#264F78',
            'editor.inactiveSelectionBackground': '#3A3D41'
        }
    };
}

/**
 * Creates performance-optimized editor configuration options
 * meeting the 200ms response time requirement for files up to 1000 lines.
 */
export function createEditorOptions(settings: IEditorSettings): editor.IStandaloneEditorConstructionOptions {
    return {
        language: LANGUAGE_ID,
        automaticLayout: true,
        formatOnPaste: settings.autoFormat,
        formatOnType: settings.autoFormat,
        minimap: {
            enabled: false // Disabled for performance
        },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        wrappingStrategy: 'advanced',
        folding: true,
        foldingStrategy: 'indentation',
        renderWhitespace: 'boundary',
        quickSuggestions: {
            other: true,
            comments: false,
            strings: true
        },
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: 'on',
        tabSize: 2,
        insertSpaces: true,
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        autoSurround: 'brackets',
        mouseWheelZoom: true,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: true,
        renderControlCharacters: false,
        fontLigatures: true,
        // Performance optimizations
        maxTokenizationLineLength: 5000,
        largeFileOptimizations: true,
        fastScrollSensitivity: 5,
        scrollPredominantAxis: true,
        renderValidationDecorations: 'on',
        // Debounce settings for real-time updates
        renderWhitespaceDelay: 100,
        cursorSurroundingLinesStyle: 'default',
        // Memory management
        maxFileSize: 1024 * 1024, // 1MB limit
        accessibilitySupport: 'auto'
    };
}

// Export configured language, theme, and editor options
export const language = {
    id: LANGUAGE_ID,
    extensions: FILE_EXTENSIONS,
    aliases: LANGUAGE_ALIASES,
    configuration: createLanguageDefinition()
};

export const theme = {
    base: 'vs-dark',
    rules: createThemeDefinition().rules,
    colors: createThemeDefinition().colors,
    semanticHighlighting: true,
    semanticTokenColors: {
        variable: '#9CDCFE',
        property: '#D4D4D4',
        function: '#DCDCAA',
        namespace: '#569CD6',
        type: '#4EC9B0'
    }
};

export const editorOptions = createEditorOptions;