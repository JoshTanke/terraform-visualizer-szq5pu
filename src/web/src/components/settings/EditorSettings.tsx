/**
 * @fileoverview React component for managing Monaco editor settings with
 * accessibility support, validation, and performance optimizations.
 * @version 1.0.0
 */

import React, { useCallback, useMemo } from 'react';
import {
  Box,
  FormControl,
  FormControlLabel,
  Slider,
  Switch,
  Typography,
  Tooltip
} from '@mui/material'; // v5.0.0
import { useSettings } from '../../hooks/useSettings';
import { IEditorSettings } from '../../interfaces/ISettings';
import {
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  DEFAULT_TAB_SIZE
} from '../../config/editor.config';

/**
 * Editor settings form component with accessibility support
 */
const EditorSettings: React.FC = () => {
  const { settings, updateEditorSettings } = useSettings();
  const editorSettings = settings.editor;

  // Memoized marks for font size slider
  const fontSizeMarks = useMemo(() => [
    { value: MIN_FONT_SIZE, label: `${MIN_FONT_SIZE}px` },
    { value: MAX_FONT_SIZE, label: `${MAX_FONT_SIZE}px` }
  ], []);

  // Memoized marks for tab size slider
  const tabSizeMarks = useMemo(() => [
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 4, label: '4' },
    { value: 8, label: '8' }
  ], []);

  /**
   * Handles auto-save toggle with validation
   */
  const handleAutoSaveChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      const newSettings: Partial<IEditorSettings> = {
        autoSave: event.target.checked
      };
      updateEditorSettings(newSettings);
    } catch (error) {
      console.error('Failed to update auto-save setting:', error);
    }
  }, [updateEditorSettings]);

  /**
   * Handles syntax highlighting toggle with performance check
   */
  const handleSyntaxHighlightingChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      const newSettings: Partial<IEditorSettings> = {
        syntaxHighlighting: event.target.checked
      };
      updateEditorSettings(newSettings);
    } catch (error) {
      console.error('Failed to update syntax highlighting:', error);
    }
  }, [updateEditorSettings]);

  /**
   * Handles auto-format toggle with validation
   */
  const handleAutoFormatChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      const newSettings: Partial<IEditorSettings> = {
        autoFormat: event.target.checked
      };
      updateEditorSettings(newSettings);
    } catch (error) {
      console.error('Failed to update auto-format setting:', error);
    }
  }, [updateEditorSettings]);

  /**
   * Handles font size changes with range validation
   */
  const handleFontSizeChange = useCallback((_: Event, value: number | number[]) => {
    try {
      const fontSize = Math.min(
        Math.max(value as number, MIN_FONT_SIZE),
        MAX_FONT_SIZE
      );
      const newSettings: Partial<IEditorSettings> = {
        fontSize
      };
      updateEditorSettings(newSettings);
    } catch (error) {
      console.error('Failed to update font size:', error);
    }
  }, [updateEditorSettings]);

  /**
   * Handles tab size changes with validation
   */
  const handleTabSizeChange = useCallback((_: Event, value: number | number[]) => {
    try {
      const tabSize = Math.max(value as number, 1);
      const newSettings: Partial<IEditorSettings> = {
        tabSize
      };
      updateEditorSettings(newSettings);
    } catch (error) {
      console.error('Failed to update tab size:', error);
    }
  }, [updateEditorSettings]);

  return (
    <Box
      component="section"
      aria-labelledby="editor-settings-title"
      sx={{ p: 3 }}
    >
      <Typography
        id="editor-settings-title"
        variant="h6"
        component="h2"
        gutterBottom
      >
        Editor Settings
      </Typography>

      <FormControl component="fieldset" sx={{ width: '100%' }}>
        {/* Auto-save toggle */}
        <Tooltip title="Automatically save changes while typing">
          <FormControlLabel
            control={
              <Switch
                checked={editorSettings.autoSave}
                onChange={handleAutoSaveChange}
                name="autoSave"
                color="primary"
                inputProps={{ 'aria-label': 'Auto-save toggle' }}
              />
            }
            label="Auto-save"
          />
        </Tooltip>

        {/* Syntax highlighting toggle */}
        <Tooltip title="Enable syntax highlighting for Terraform code">
          <FormControlLabel
            control={
              <Switch
                checked={editorSettings.syntaxHighlighting}
                onChange={handleSyntaxHighlightingChange}
                name="syntaxHighlighting"
                color="primary"
                inputProps={{ 'aria-label': 'Syntax highlighting toggle' }}
              />
            }
            label="Syntax Highlighting"
          />
        </Tooltip>

        {/* Auto-format toggle */}
        <Tooltip title="Automatically format code on save">
          <FormControlLabel
            control={
              <Switch
                checked={editorSettings.autoFormat}
                onChange={handleAutoFormatChange}
                name="autoFormat"
                color="primary"
                inputProps={{ 'aria-label': 'Auto-format toggle' }}
              />
            }
            label="Auto-format"
          />
        </Tooltip>

        {/* Font size slider */}
        <Box sx={{ mt: 3 }}>
          <Typography
            id="font-size-slider-label"
            gutterBottom
          >
            Font Size
          </Typography>
          <Slider
            value={editorSettings.fontSize}
            onChange={handleFontSizeChange}
            aria-labelledby="font-size-slider-label"
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            marks={fontSizeMarks}
            valueLabelDisplay="auto"
            sx={{ width: '100%', maxWidth: 300 }}
          />
        </Box>

        {/* Tab size slider */}
        <Box sx={{ mt: 3 }}>
          <Typography
            id="tab-size-slider-label"
            gutterBottom
          >
            Tab Size
          </Typography>
          <Slider
            value={editorSettings.tabSize}
            onChange={handleTabSizeChange}
            aria-labelledby="tab-size-slider-label"
            min={1}
            max={8}
            marks={tabSizeMarks}
            step={1}
            valueLabelDisplay="auto"
            sx={{ width: '100%', maxWidth: 300 }}
          />
        </Box>
      </FormControl>
    </Box>
  );
};

export default EditorSettings;