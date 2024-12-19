/**
 * @fileoverview Custom React hook for managing application settings with type safety,
 * validation, and performance optimization. Provides unified access to editor,
 * visualization, GitHub integration, and theme settings through Redux store.
 * @version 1.0.0
 */

import { useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux'; // v8.0.0
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
import {
  updateEditorSettings,
  updateVisualizationSettings,
  updateGithubSettings,
  updateThemeSettings,
  selectEditorSettings,
  selectVisualizationSettings,
  selectGithubSettings,
  selectThemeSettings,
} from '../store/settingsSlice';

/**
 * Custom hook for managing application settings
 * @returns Object containing current settings and memoized update functions
 */
export function useSettings() {
  const dispatch = useDispatch();

  // Select settings from Redux store with type safety
  const editorSettings = useSelector(selectEditorSettings);
  const visualizationSettings = useSelector(selectVisualizationSettings);
  const githubSettings = useSelector(selectGithubSettings);
  const themeSettings = useSelector(selectThemeSettings);

  // Memoized settings object for performance
  const settings: ISettings = useMemo(() => ({
    editor: editorSettings,
    visualization: visualizationSettings,
    github: githubSettings,
    theme: themeSettings,
    version: '1.0.0',
    lastUpdated: new Date(),
  }), [editorSettings, visualizationSettings, githubSettings, themeSettings]);

  /**
   * Updates editor settings with validation
   * @param newSettings - Partial editor settings to update
   */
  const handleEditorSettingsUpdate = useCallback((
    newSettings: Partial<IEditorSettings>
  ) => {
    try {
      const updatedSettings = { ...editorSettings, ...newSettings };
      if (!isIEditorSettings(updatedSettings)) {
        throw new Error('Invalid editor settings');
      }
      dispatch(updateEditorSettings(newSettings));
    } catch (error) {
      console.error('Editor settings update failed:', error);
    }
  }, [dispatch, editorSettings]);

  /**
   * Updates visualization settings with performance optimization
   * @param newSettings - Partial visualization settings to update
   */
  const handleVisualizationSettingsUpdate = useCallback((
    newSettings: Partial<IVisualizationSettings>
  ) => {
    try {
      const updatedSettings = { ...visualizationSettings, ...newSettings };
      if (!isIVisualizationSettings(updatedSettings)) {
        throw new Error('Invalid visualization settings');
      }
      dispatch(updateVisualizationSettings(newSettings));
    } catch (error) {
      console.error('Visualization settings update failed:', error);
    }
  }, [dispatch, visualizationSettings]);

  /**
   * Updates GitHub settings with secure token handling
   * @param newSettings - Partial GitHub settings to update
   */
  const handleGithubSettingsUpdate = useCallback((
    newSettings: Partial<IGithubSettings>
  ) => {
    try {
      // Sanitize sensitive data before validation
      const sanitizedSettings = { ...newSettings };
      if (sanitizedSettings.personalAccessToken) {
        // Ensure token is properly formatted
        if (!/^gh[ps]_[a-zA-Z0-9]{36}$/.test(sanitizedSettings.personalAccessToken)) {
          throw new Error('Invalid GitHub token format');
        }
      }

      const updatedSettings = { ...githubSettings, ...sanitizedSettings };
      if (!isIGithubSettings(updatedSettings)) {
        throw new Error('Invalid GitHub settings');
      }
      dispatch(updateGithubSettings(sanitizedSettings));
    } catch (error) {
      console.error('GitHub settings update failed:', error);
    }
  }, [dispatch, githubSettings]);

  /**
   * Updates theme settings with system preference detection
   * @param newSettings - Partial theme settings to update
   */
  const handleThemeSettingsUpdate = useCallback((
    newSettings: Partial<IThemeSettings>
  ) => {
    try {
      const updatedSettings = { ...themeSettings, ...newSettings };
      if (!isIThemeSettings(updatedSettings)) {
        throw new Error('Invalid theme settings');
      }

      // Apply theme changes to document
      if (newSettings.darkMode !== undefined) {
        document.documentElement.classList.toggle('dark', newSettings.darkMode);
      }

      dispatch(updateThemeSettings(newSettings));
    } catch (error) {
      console.error('Theme settings update failed:', error);
    }
  }, [dispatch, themeSettings]);

  // Return immutable settings and memoized update functions
  return {
    settings,
    updateEditorSettings: handleEditorSettingsUpdate,
    updateVisualizationSettings: handleVisualizationSettingsUpdate,
    updateGithubSettings: handleGithubSettingsUpdate,
    updateThemeSettings: handleThemeSettingsUpdate,
  };
}

// Type definitions for hook return value
export type UseSettingsReturn = ReturnType<typeof useSettings>;