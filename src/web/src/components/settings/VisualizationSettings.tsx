/**
 * @fileoverview React component for managing visualization settings with real-time updates,
 * accessibility support, and comprehensive validation.
 * @version 1.0.0
 */

import React, { useCallback, useMemo } from 'react';
import {
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormGroup,
  Tooltip,
  Box,
  Typography,
  SelectChangeEvent,
} from '@mui/material'; // v5.0.0
import { useTheme } from '@mui/material/styles'; // v5.0.0
import { useDebounce } from 'use-debounce'; // v9.0.0

import { useSettings } from '../../hooks/useSettings';
import { IVisualizationSettings } from '../../interfaces/ISettings';
import { LayoutType } from '../../interfaces/IGraph';

/**
 * Component for managing visualization settings with accessibility support
 * and real-time updates
 */
const VisualizationSettings: React.FC = () => {
  const theme = useTheme();
  const { settings, updateVisualizationSettings } = useSettings();
  const { visualization } = settings;

  // Debounced update handler to prevent excessive updates
  const [debouncedUpdate] = useDebounce(
    (updates: Partial<IVisualizationSettings>) => {
      updateVisualizationSettings(updates);
    },
    300
  );

  /**
   * Handles changes to layout type with validation
   */
  const handleLayoutChange = useCallback(
    (event: SelectChangeEvent<LayoutType>) => {
      const newLayout = event.target.value as LayoutType;
      if (!Object.values(LayoutType).includes(newLayout)) {
        console.error('Invalid layout type:', newLayout);
        return;
      }
      debouncedUpdate({ defaultLayout: newLayout });
    },
    [debouncedUpdate]
  );

  /**
   * Handles changes to boolean settings with type safety
   */
  const handleToggleChange = useCallback(
    (setting: keyof Pick<IVisualizationSettings, 'showResourceTypes' | 'showDependencies' | 'showAttributes'>) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        debouncedUpdate({ [setting]: event.target.checked });
      },
    [debouncedUpdate]
  );

  // Memoized layout options for performance
  const layoutOptions = useMemo(() => [
    { value: LayoutType.HIERARCHICAL, label: 'Hierarchical', description: 'Tree-like structure with parent-child relationships' },
    { value: LayoutType.FORCE, label: 'Force-Directed', description: 'Dynamic layout based on node relationships' },
    { value: LayoutType.DAGRE, label: 'Dagre', description: 'Directed graph optimized for flow visualization' }
  ], []);

  return (
    <Box
      sx={{
        padding: theme.spacing(2),
        backgroundColor: theme.palette.background.paper,
        borderRadius: theme.shape.borderRadius,
      }}
    >
      <Typography
        variant="h6"
        component="h2"
        gutterBottom
        sx={{ marginBottom: theme.spacing(2) }}
      >
        Visualization Settings
      </Typography>

      <FormGroup>
        {/* Layout Selection */}
        <Box sx={{ marginBottom: theme.spacing(2) }}>
          <Typography
            variant="subtitle2"
            component="label"
            htmlFor="layout-select"
            sx={{ marginBottom: theme.spacing(1) }}
          >
            Default Layout
          </Typography>
          <Select
            id="layout-select"
            value={visualization.defaultLayout}
            onChange={handleLayoutChange}
            fullWidth
            size="small"
            aria-label="Select graph layout type"
          >
            {layoutOptions.map(({ value, label, description }) => (
              <Tooltip key={value} title={description} placement="right">
                <MenuItem value={value}>{label}</MenuItem>
              </Tooltip>
            ))}
          </Select>
        </Box>

        {/* Display Options */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: theme.spacing(1) }}>
          <Tooltip title="Show resource type icons and labels">
            <FormControlLabel
              control={
                <Switch
                  checked={visualization.showResourceTypes}
                  onChange={handleToggleChange('showResourceTypes')}
                  inputProps={{
                    'aria-label': 'Toggle resource type display',
                  }}
                />
              }
              label="Show Resource Types"
            />
          </Tooltip>

          <Tooltip title="Display dependency lines between resources">
            <FormControlLabel
              control={
                <Switch
                  checked={visualization.showDependencies}
                  onChange={handleToggleChange('showDependencies')}
                  inputProps={{
                    'aria-label': 'Toggle dependency lines',
                  }}
                />
              }
              label="Show Dependencies"
            />
          </Tooltip>

          <Tooltip title="Display resource attributes in node details">
            <FormControlLabel
              control={
                <Switch
                  checked={visualization.showAttributes}
                  onChange={handleToggleChange('showAttributes')}
                  inputProps={{
                    'aria-label': 'Toggle attribute display',
                  }}
                />
              }
              label="Show Attributes"
            />
          </Tooltip>
        </Box>
      </FormGroup>
    </Box>
  );
};

export default VisualizationSettings;