/**
 * @fileoverview Redux Toolkit slice for managing application settings state
 * including editor, visualization, GitHub integration, and theme preferences
 * with local storage persistence, validation, and migration support.
 * @version 1.0.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // v1.9.0
import { debounce } from 'lodash'; // v4.17.21
import {
  ISettings,
  IEditorSettings,
  IVisualizationSettings,
  IGithubSettings,
  IThemeSettings,
  isIEditorSettings,
  isIVisualizationSettings,
  isIGithubSettings,
  isIThemeSettings,
} from '../interfaces/ISettings';
import { LayoutType } from '../interfaces/IGraph';

// Constants
const SETTINGS_VERSION = '1.0.0';
const STORAGE_KEY = 'tf_visualizer_settings';
const DEBOUNCE_DELAY = 500;

/**
 * Initial state with default settings
 */
const initialState: ISettings = {
  version: SETTINGS_VERSION,
  lastUpdated: new Date(),
  editor: {
    autoSave: true,
    syntaxHighlighting: true,
    autoFormat: false,
    fontSize: 14,
    tabSize: 2,
    fontFamily: 'Monaco, monospace',
    lineHeight: 1.5,
    wordWrap: true,
    minimap: true
  },
  visualization: {
    defaultLayout: LayoutType.HIERARCHICAL,
    showResourceTypes: true,
    showDependencies: true,
    showAttributes: false,
    nodeSpacing: 50,
    edgeStyle: 'bezier',
    animationDuration: 300,
    snapToGrid: true
  },
  github: {
    autoSync: true,
    repository: '',
    branch: 'main',
    syncInterval: 300,
    personalAccessToken: '',
    organization: ''
  },
  theme: {
    darkMode: true,
    primaryColor: '#1a73e8',
    accentColor: '#007AFF',
    fontSize: 14,
    customTheme: {
      background: '#1e1e1e',
      surface: '#252526',
      text: '#ffffff',
      border: '#404040',
      hover: '#2a2d2e',
      active: '#37373d',
      disabled: '#6c6c6c',
      error: '#f44336',
      warning: '#ff9800',
      success: '#4caf50'
    }
  }
};

/**
 * Load settings from local storage with validation
 */
const loadStoredSettings = (): ISettings => {
  try {
    const storedSettings = localStorage.getItem(STORAGE_KEY);
    if (!storedSettings) return initialState;

    const parsedSettings = JSON.parse(storedSettings);
    if (parsedSettings.version !== SETTINGS_VERSION) {
      // Trigger migration if versions don't match
      return initialState;
    }

    // Validate each settings section
    if (!isIEditorSettings(parsedSettings.editor) ||
        !isIVisualizationSettings(parsedSettings.visualization) ||
        !isIGithubSettings(parsedSettings.github) ||
        !isIThemeSettings(parsedSettings.theme)) {
      console.warn('Invalid settings format detected, resetting to defaults');
      return initialState;
    }

    return parsedSettings;
  } catch (error) {
    console.error('Error loading settings:', error);
    return initialState;
  }
};

/**
 * Debounced function to persist settings to local storage
 */
const persistSettings = debounce((settings: ISettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}, DEBOUNCE_DELAY);

/**
 * Settings slice with reducers for all setting types
 */
const settingsSlice = createSlice({
  name: 'settings',
  initialState: loadStoredSettings(),
  reducers: {
    updateEditorSettings(state, action: PayloadAction<Partial<IEditorSettings>>) {
      if (!isIEditorSettings({ ...state.editor, ...action.payload })) {
        console.error('Invalid editor settings update');
        return;
      }
      state.editor = { ...state.editor, ...action.payload };
      state.lastUpdated = new Date();
      persistSettings(state);
    },

    updateVisualizationSettings(state, action: PayloadAction<Partial<IVisualizationSettings>>) {
      if (!isIVisualizationSettings({ ...state.visualization, ...action.payload })) {
        console.error('Invalid visualization settings update');
        return;
      }
      state.visualization = { ...state.visualization, ...action.payload };
      state.lastUpdated = new Date();
      persistSettings(state);
    },

    updateGithubSettings(state, action: PayloadAction<Partial<IGithubSettings>>) {
      if (!isIGithubSettings({ ...state.github, ...action.payload })) {
        console.error('Invalid GitHub settings update');
        return;
      }
      state.github = { ...state.github, ...action.payload };
      state.lastUpdated = new Date();
      persistSettings(state);
    },

    updateThemeSettings(state, action: PayloadAction<Partial<IThemeSettings>>) {
      if (!isIThemeSettings({ ...state.theme, ...action.payload })) {
        console.error('Invalid theme settings update');
        return;
      }
      state.theme = { ...state.theme, ...action.payload };
      state.lastUpdated = new Date();
      persistSettings(state);
    },

    resetSettings() {
      persistSettings(initialState);
      return initialState;
    },

    migrateSettings(state, action: PayloadAction<{ fromVersion: string; toVersion: string }>) {
      const { fromVersion, toVersion } = action.payload;
      
      // Implement version-specific migrations here
      if (fromVersion < toVersion) {
        // Example migration logic
        if (fromVersion === '0.9.0' && toVersion === '1.0.0') {
          // Migrate specific settings
          state.visualization.snapToGrid = true;
        }
      }

      state.version = toVersion;
      state.lastUpdated = new Date();
      persistSettings(state);
    }
  }
});

// Export actions and reducer
export const {
  updateEditorSettings,
  updateVisualizationSettings,
  updateGithubSettings,
  updateThemeSettings,
  resetSettings,
  migrateSettings
} = settingsSlice.actions;

export default settingsSlice.reducer;

// Selector helpers
export const selectEditorSettings = (state: { settings: ISettings }) => state.settings.editor;
export const selectVisualizationSettings = (state: { settings: ISettings }) => state.settings.visualization;
export const selectGithubSettings = (state: { settings: ISettings }) => state.settings.github;
export const selectThemeSettings = (state: { settings: ISettings }) => state.settings.theme;
export const selectSettingsVersion = (state: { settings: ISettings }) => state.settings.version;