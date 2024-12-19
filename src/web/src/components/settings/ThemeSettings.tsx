/**
 * @fileoverview Theme settings component providing theme customization options
 * including dark/light mode toggle and system preference detection with real-time
 * updates and persistence.
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import {
  FormControl,
  FormControlLabel,
  FormGroup,
  Switch,
  Typography,
  Box,
  useMediaQuery
} from '@mui/material'; // v5.0.0
import { useSettings } from '../../hooks/useSettings';
import { COLORS } from '../../assets/styles/theme';

/**
 * Component for managing theme settings with system preference detection
 */
const ThemeSettings: React.FC = () => {
  // Get theme settings and update function from settings hook
  const { settings, updateThemeSettings } = useSettings();
  
  // Detect system color scheme preference
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  /**
   * Handles theme mode toggle changes
   * @param event - Change event from switch component
   */
  const handleThemeModeChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const darkMode = event.target.checked;
    
    // Update theme settings with new mode
    updateThemeSettings({
      darkMode,
      // Update color palette based on mode
      customTheme: {
        ...settings.theme.customTheme,
        background: darkMode ? COLORS.dark.background.default : COLORS.light.background.default,
        surface: darkMode ? COLORS.dark.background.paper : COLORS.light.background.paper,
        text: darkMode ? '#ffffff' : '#000000'
      }
    });

    // Apply theme change to document
    document.documentElement.classList.toggle('dark', darkMode);
  }, [settings.theme.customTheme, updateThemeSettings]);

  /**
   * Handles system preference toggle changes
   * @param event - Change event from switch component
   */
  const handleSystemPreferenceChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const useSystemPreference = event.target.checked;
    
    if (useSystemPreference) {
      // Apply system preference
      updateThemeSettings({
        darkMode: prefersDarkMode,
        customTheme: {
          ...settings.theme.customTheme,
          background: prefersDarkMode ? COLORS.dark.background.default : COLORS.light.background.default,
          surface: prefersDarkMode ? COLORS.dark.background.paper : COLORS.light.background.paper,
          text: prefersDarkMode ? '#ffffff' : '#000000'
        }
      });
    }
    
    // Store system preference setting
    localStorage.setItem('useSystemPreference', String(useSystemPreference));
  }, [prefersDarkMode, settings.theme.customTheme, updateThemeSettings]);

  // Effect to handle system preference changes
  useEffect(() => {
    const useSystemPreference = localStorage.getItem('useSystemPreference') === 'true';
    
    if (useSystemPreference) {
      handleThemeModeChange({ 
        target: { checked: prefersDarkMode }
      } as React.ChangeEvent<HTMLInputElement>);
    }

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (useSystemPreference) {
        handleThemeModeChange({
          target: { checked: e.matches }
        } as React.ChangeEvent<HTMLInputElement>);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [prefersDarkMode, handleThemeModeChange]);

  return (
    <Box
      component="section"
      aria-label="Theme Settings"
      sx={{ p: 2 }}
    >
      <Typography variant="h6" gutterBottom>
        Theme Settings
      </Typography>
      
      <FormControl component="fieldset">
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={settings.theme.darkMode}
                onChange={handleThemeModeChange}
                inputProps={{
                  'aria-label': 'Dark Mode Toggle'
                }}
              />
            }
            label="Dark Mode"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={localStorage.getItem('useSystemPreference') === 'true'}
                onChange={handleSystemPreferenceChange}
                inputProps={{
                  'aria-label': 'Use System Preference Toggle'
                }}
              />
            }
            label="Use System Preference"
          />
        </FormGroup>
      </FormControl>
    </Box>
  );
};

export default ThemeSettings;