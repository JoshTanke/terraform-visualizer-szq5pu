/**
 * @fileoverview GitHub settings component for managing repository integration
 * with comprehensive validation, secure token handling, and real-time status updates.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react'; // v18.0.0
import { useDispatch, useSelector } from 'react-redux'; // v8.0.0
import {
  TextField,
  Switch,
  Button,
  FormControlLabel,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
} from '@mui/material'; // v5.0.0
import { debounce } from 'lodash'; // v4.17.21
import { IGithubSettings } from '../../interfaces/ISettings';
import { GithubService } from '../../services/github.service';

// Constants for validation and UI
const GITHUB_REPO_REGEX = /^[\w-]+\/[\w-]+$/;
const VALIDATION_DEBOUNCE_MS = 500;
const ERROR_MESSAGES = {
  INVALID_FORMAT: 'Repository must be in format "owner/repo"',
  NOT_FOUND: 'Repository not found or inaccessible',
  NETWORK_ERROR: 'Network error occurred while validating repository',
  RATE_LIMIT: 'GitHub API rate limit exceeded. Please try again later.',
  PERMISSION_ERROR: 'Insufficient permissions to access repository',
};

interface ValidationState {
  isValid: boolean;
  message: string | null;
  isValidating: boolean;
}

interface ConnectionState {
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  message: string | null;
  lastSync: Date | null;
}

/**
 * GitHub Settings Component
 * Provides interface for managing GitHub integration settings with real-time validation
 * and secure token handling.
 */
export const GithubSettings: React.FC = () => {
  const dispatch = useDispatch();
  const githubService = new GithubService();

  // Local state management
  const [settings, setSettings] = useState<IGithubSettings>({
    autoSync: false,
    repository: '',
    branch: 'main',
    syncInterval: 300,
    personalAccessToken: '',
    organization: ''
  });

  const [validation, setValidation] = useState<ValidationState>({
    isValid: false,
    message: null,
    isValidating: false
  });

  const [connection, setConnection] = useState<ConnectionState>({
    status: 'disconnected',
    message: null,
    lastSync: null
  });

  const [availableBranches, setAvailableBranches] = useState<string[]>([]);

  /**
   * Validates repository format and accessibility
   * @param repository - Repository string to validate
   */
  const validateRepository = useCallback(async (repository: string) => {
    if (!GITHUB_REPO_REGEX.test(repository)) {
      setValidation({
        isValid: false,
        message: ERROR_MESSAGES.INVALID_FORMAT,
        isValidating: false
      });
      return;
    }

    setValidation(prev => ({ ...prev, isValidating: true }));

    try {
      const [owner, repo] = repository.split('/');
      await githubService.getRepository(owner, repo);
      
      setValidation({
        isValid: true,
        message: null,
        isValidating: false
      });
    } catch (error) {
      let errorMessage = ERROR_MESSAGES.NETWORK_ERROR;
      
      if (error.response) {
        switch (error.response.status) {
          case 404:
            errorMessage = ERROR_MESSAGES.NOT_FOUND;
            break;
          case 403:
            errorMessage = error.response.headers['x-ratelimit-remaining'] === '0'
              ? ERROR_MESSAGES.RATE_LIMIT
              : ERROR_MESSAGES.PERMISSION_ERROR;
            break;
        }
      }

      setValidation({
        isValid: false,
        message: errorMessage,
        isValidating: false
      });
    }
  }, [githubService]);

  // Debounced repository validation
  const debouncedValidateRepository = useCallback(
    debounce(validateRepository, VALIDATION_DEBOUNCE_MS),
    [validateRepository]
  );

  /**
   * Handles repository input changes with validation
   */
  const handleRepositoryChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newRepository = event.target.value;
    setSettings(prev => ({ ...prev, repository: newRepository }));
    debouncedValidateRepository(newRepository);
  }, [debouncedValidateRepository]);

  /**
   * Handles auto-sync toggle
   */
  const handleAutoSyncChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newAutoSync = event.target.checked;
    setSettings(prev => ({ ...prev, autoSync: newAutoSync }));
    dispatch({ type: 'UPDATE_GITHUB_SETTINGS', payload: { autoSync: newAutoSync }});
  }, [dispatch]);

  /**
   * Handles branch selection
   */
  const handleBranchChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newBranch = event.target.value;
    setSettings(prev => ({ ...prev, branch: newBranch }));
    dispatch({ type: 'UPDATE_GITHUB_SETTINGS', payload: { branch: newBranch }});
  }, [dispatch]);

  /**
   * Tests GitHub connection and fetches available branches
   */
  const handleConnect = useCallback(async () => {
    setConnection(prev => ({ ...prev, status: 'connecting' }));

    try {
      // Validate token and repository access
      await githubService.validateToken();
      await githubService.testConnection(settings.repository);

      // Fetch available branches
      const branches = await githubService.listBranches(settings.repository);
      setAvailableBranches(branches);

      setConnection({
        status: 'connected',
        message: 'Successfully connected to repository',
        lastSync: new Date()
      });

      // Update global settings
      dispatch({ type: 'UPDATE_GITHUB_SETTINGS', payload: settings });
    } catch (error) {
      setConnection({
        status: 'error',
        message: error.message,
        lastSync: null
      });
    }
  }, [settings, githubService, dispatch]);

  // Effect to load initial settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load settings from store/storage
        const storedSettings = localStorage.getItem('githubSettings');
        if (storedSettings) {
          const parsed = JSON.parse(storedSettings);
          setSettings(parsed);
          await validateRepository(parsed.repository);
        }
      } catch (error) {
        console.error('Error loading GitHub settings:', error);
      }
    };

    loadSettings();
  }, [validateRepository]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        GitHub Integration
      </Typography>

      <FormControl fullWidth margin="normal">
        <TextField
          label="Repository"
          value={settings.repository}
          onChange={handleRepositoryChange}
          error={!validation.isValid && !!validation.message}
          helperText={validation.message}
          placeholder="owner/repository"
          InputProps={{
            endAdornment: validation.isValidating && <CircularProgress size={20} />
          }}
        />
      </FormControl>

      <FormControl fullWidth margin="normal">
        <InputLabel>Branch</InputLabel>
        <Select
          value={settings.branch}
          onChange={handleBranchChange}
          disabled={!validation.isValid || connection.status !== 'connected'}
        >
          {availableBranches.map(branch => (
            <MenuItem key={branch} value={branch}>
              {branch}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControlLabel
        control={
          <Switch
            checked={settings.autoSync}
            onChange={handleAutoSyncChange}
            disabled={!validation.isValid}
          />
        }
        label="Enable Auto-sync"
      />

      <Box sx={{ mt: 2 }}>
        <Button
          variant="contained"
          onClick={handleConnect}
          disabled={!validation.isValid || connection.status === 'connecting'}
          startIcon={connection.status === 'connecting' && <CircularProgress size={20} />}
        >
          {connection.status === 'connected' ? 'Reconnect' : 'Connect'}
        </Button>
      </Box>

      {connection.message && (
        <Alert
          severity={connection.status === 'error' ? 'error' : 'success'}
          sx={{ mt: 2 }}
        >
          {connection.message}
        </Alert>
      )}

      {connection.lastSync && (
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          Last synchronized: {connection.lastSync.toLocaleString()}
        </Typography>
      )}
    </Box>
  );
};

export default GithubSettings;