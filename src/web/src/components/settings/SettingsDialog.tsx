/**
 * @fileoverview Settings dialog component providing comprehensive settings management
 * with enhanced accessibility, error handling, and real-time updates.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material'; // v5.0.0

import { EditorSettings } from './EditorSettings';
import { GithubSettings } from './GithubSettings';
import { ThemeSettings } from './ThemeSettings';
import { VisualizationSettings } from './VisualizationSettings';
import { useSettings } from '../../hooks/useSettings';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { getLogger } from '../../utils/logger';

// Constants for tab configuration and accessibility
const TABS = [
  { 
    label: 'Editor', 
    component: EditorSettings, 
    ariaLabel: 'Editor Settings Tab',
    id: 'settings-tab-editor'
  },
  { 
    label: 'GitHub', 
    component: GithubSettings, 
    ariaLabel: 'GitHub Integration Tab',
    id: 'settings-tab-github'
  },
  { 
    label: 'Theme', 
    component: ThemeSettings, 
    ariaLabel: 'Theme Settings Tab',
    id: 'settings-tab-theme'
  },
  { 
    label: 'Visualization', 
    component: VisualizationSettings, 
    ariaLabel: 'Visualization Settings Tab',
    id: 'settings-tab-visualization'
  }
] as const;

const DIALOG_LABELS = {
  title: 'Settings',
  closeButton: 'Close Settings Dialog',
  resetButton: 'Reset All Settings',
  saveButton: 'Save Changes'
} as const;

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Settings dialog component with comprehensive settings management
 */
const SettingsDialog: React.FC<SettingsDialogProps> = React.memo(({ open, onClose }) => {
  const logger = getLogger();
  const { settings, resetSettings, updateSettings } = useSettings();
  
  // Local state management
  const [selectedTab, setSelectedTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Memoized tab panel content
  const tabPanels = useMemo(() => TABS.map((tab, index) => ({
    id: `settings-tabpanel-${index}`,
    'aria-labelledby': tab.id,
  })), []);

  /**
   * Handles tab change with validation
   */
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    if (hasUnsavedChanges) {
      // Prompt user about unsaved changes
      const confirmChange = window.confirm('You have unsaved changes. Continue without saving?');
      if (!confirmChange) return;
    }
    setSelectedTab(newValue);
  }, [hasUnsavedChanges]);

  /**
   * Handles settings reset with confirmation
   */
  const handleReset = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const confirmReset = window.confirm('Are you sure you want to reset all settings to defaults?');
      if (!confirmReset) return;

      await resetSettings();
      setHasUnsavedChanges(false);
      
      logger.log('Settings reset successfully', { action: 'reset_settings' });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset settings';
      setError(errorMessage);
      logger.error('Failed to reset settings', { error: err });
    } finally {
      setIsLoading(false);
    }
  }, [resetSettings, logger]);

  /**
   * Handles dialog close with unsaved changes check
   */
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmClose = window.confirm('You have unsaved changes. Close without saving?');
      if (!confirmClose) return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);

  /**
   * Effect to cleanup state on dialog close
   */
  useEffect(() => {
    if (!open) {
      setSelectedTab(0);
      setError(null);
      setHasUnsavedChanges(false);
    }
  }, [open]);

  /**
   * Renders tab panel content with error boundary
   */
  const renderTabContent = useCallback((index: number) => {
    const TabComponent = TABS[index].component;
    return (
      <Box
        role="tabpanel"
        hidden={selectedTab !== index}
        id={tabPanels[index].id}
        aria-labelledby={TABS[index].id}
        sx={{ pt: 2 }}
      >
        <ErrorBoundary
          fallback={
            <Alert severity="error">
              Failed to load settings panel. Please try again.
            </Alert>
          }
        >
          <TabComponent />
        </ErrorBoundary>
      </Box>
    );
  }, [selectedTab, tabPanels]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="settings-dialog-title"
    >
      <DialogTitle id="settings-dialog-title">
        {DIALOG_LABELS.title}
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Tabs
          value={selectedTab}
          onChange={handleTabChange}
          aria-label="Settings tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          {TABS.map((tab, index) => (
            <Tab
              key={tab.id}
              label={tab.label}
              id={tab.id}
              aria-controls={tabPanels[index].id}
              aria-label={tab.ariaLabel}
              disabled={isLoading}
            />
          ))}
        </Tabs>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          renderTabContent(selectedTab)
        )}
      </DialogContent>

      <DialogActions>
        <Button
          onClick={handleReset}
          color="error"
          disabled={isLoading}
          aria-label={DIALOG_LABELS.resetButton}
        >
          Reset All
        </Button>
        <Button
          onClick={handleClose}
          disabled={isLoading}
          aria-label={DIALOG_LABELS.closeButton}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
});

SettingsDialog.displayName = 'SettingsDialog';

export default SettingsDialog;