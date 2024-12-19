/**
 * @fileoverview TypeScript interface definitions for application settings including
 * editor, visualization, GitHub integration, and theme configurations with comprehensive
 * type safety and validation.
 * @version 1.0.0
 */

import { LayoutType } from './IGraph'; // v1.0.0

/**
 * Edge styling options for graph visualization
 */
export enum EdgeStyle {
    STRAIGHT = 'straight',
    BEZIER = 'bezier',
    STEP = 'step',
    SMOOTHSTEP = 'smoothstep'
}

/**
 * Custom theme configuration interface
 */
export interface ICustomTheme {
    background: string;
    surface: string;
    text: string;
    border: string;
    hover: string;
    active: string;
    disabled: string;
    error: string;
    warning: string;
    success: string;
}

/**
 * Monaco editor configuration settings
 */
export interface IEditorSettings {
    autoSave: boolean;
    syntaxHighlighting: boolean;
    autoFormat: boolean;
    fontSize: number;
    tabSize: number;
    fontFamily: string;
    lineHeight: number;
    wordWrap: boolean;
    minimap: boolean;
}

/**
 * Graph visualization configuration settings
 */
export interface IVisualizationSettings {
    defaultLayout: LayoutType;
    showResourceTypes: boolean;
    showDependencies: boolean;
    showAttributes: boolean;
    nodeSpacing: number;
    edgeStyle: EdgeStyle;
    animationDuration: number;
    snapToGrid: boolean;
}

/**
 * GitHub integration configuration settings
 */
export interface IGithubSettings {
    autoSync: boolean;
    repository: string;
    branch: string;
    syncInterval: number;
    personalAccessToken: string;
    organization: string;
}

/**
 * Theme and appearance configuration settings
 */
export interface IThemeSettings {
    darkMode: boolean;
    primaryColor: string;
    accentColor: string;
    fontSize: number;
    customTheme: ICustomTheme;
}

/**
 * Main settings interface combining all configuration options
 */
export interface ISettings {
    editor: IEditorSettings;
    visualization: IVisualizationSettings;
    github: IGithubSettings;
    theme: IThemeSettings;
    version: string;
    lastUpdated: Date;
}

/**
 * Type guard to validate ISettings structure
 * @param obj - Object to validate
 * @returns boolean indicating if object is a valid ISettings
 */
export function isISettings(obj: any): obj is ISettings {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        isIEditorSettings(obj.editor) &&
        isIVisualizationSettings(obj.visualization) &&
        isIGithubSettings(obj.github) &&
        isIThemeSettings(obj.theme) &&
        typeof obj.version === 'string' &&
        obj.lastUpdated instanceof Date
    );
}

/**
 * Type guard for IEditorSettings validation
 */
export function isIEditorSettings(obj: any): obj is IEditorSettings {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        typeof obj.autoSave === 'boolean' &&
        typeof obj.syntaxHighlighting === 'boolean' &&
        typeof obj.autoFormat === 'boolean' &&
        typeof obj.fontSize === 'number' &&
        typeof obj.tabSize === 'number' &&
        typeof obj.fontFamily === 'string' &&
        typeof obj.lineHeight === 'number' &&
        typeof obj.wordWrap === 'boolean' &&
        typeof obj.minimap === 'boolean'
    );
}

/**
 * Type guard for IVisualizationSettings validation
 */
export function isIVisualizationSettings(obj: any): obj is IVisualizationSettings {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        Object.values(LayoutType).includes(obj.defaultLayout) &&
        typeof obj.showResourceTypes === 'boolean' &&
        typeof obj.showDependencies === 'boolean' &&
        typeof obj.showAttributes === 'boolean' &&
        typeof obj.nodeSpacing === 'number' &&
        Object.values(EdgeStyle).includes(obj.edgeStyle) &&
        typeof obj.animationDuration === 'number' &&
        typeof obj.snapToGrid === 'boolean'
    );
}

/**
 * Type guard for IGithubSettings validation
 */
export function isIGithubSettings(obj: any): obj is IGithubSettings {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        typeof obj.autoSync === 'boolean' &&
        typeof obj.repository === 'string' &&
        typeof obj.branch === 'string' &&
        typeof obj.syncInterval === 'number' &&
        typeof obj.personalAccessToken === 'string' &&
        typeof obj.organization === 'string'
    );
}

/**
 * Type guard for IThemeSettings validation
 */
export function isIThemeSettings(obj: any): obj is IThemeSettings {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        typeof obj.darkMode === 'boolean' &&
        typeof obj.primaryColor === 'string' &&
        typeof obj.accentColor === 'string' &&
        typeof obj.fontSize === 'number' &&
        isICustomTheme(obj.customTheme)
    );
}

/**
 * Type guard for ICustomTheme validation
 */
export function isICustomTheme(obj: any): obj is ICustomTheme {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        typeof obj.background === 'string' &&
        typeof obj.surface === 'string' &&
        typeof obj.text === 'string' &&
        typeof obj.border === 'string' &&
        typeof obj.hover === 'string' &&
        typeof obj.active === 'string' &&
        typeof obj.disabled === 'string' &&
        typeof obj.error === 'string' &&
        typeof obj.warning === 'string' &&
        typeof obj.success === 'string'
    );
}