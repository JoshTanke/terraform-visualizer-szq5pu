import React, { useState, useEffect, useCallback } from 'react';
import { Box, Paper, Typography, Alert, IconButton } from '@mui/material';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import { validateModule, validateResource } from '../../utils/validation';
import LoadingSpinner from '../common/LoadingSpinner';
import { ModuleStatus } from '../../interfaces/IModule';

// Constants for validation behavior
const VALIDATION_DEBOUNCE_MS = 500;
const MAX_ERRORS_DISPLAYED = 5;
const ERROR_CACHE_DURATION_MS = 5000;
const VALIDATION_METRICS_INTERVAL_MS = 60000;

/**
 * Interface for validation error objects with enhanced metadata
 */
interface ValidationError {
  line: number;
  message: string;
  severity: 'error' | 'warning';
  fixable: boolean;
  code: string;
}

/**
 * Props interface for ValidationPanel component with enhanced accessibility
 */
interface ValidationPanelProps {
  code: string;
  moduleId: string;
  onFix: (lineNumber: number, error: string) => void;
  ariaLabel?: string;
}

/**
 * A React component that displays validation results for Terraform configurations
 * with enhanced accessibility and error management features.
 */
const ValidationPanel: React.FC<ValidationPanelProps> = ({
  code,
  moduleId,
  onFix,
  ariaLabel = 'Terraform Configuration Validation Results'
}) => {
  // State management
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationCache, setValidationCache] = useState<{
    code: string;
    errors: ValidationError[];
    timestamp: number;
  } | null>(null);

  /**
   * Validates the current Terraform configuration with enhanced error detection
   */
  const validateCode = useCallback(async (code: string, moduleId: string): Promise<ValidationError[]> => {
    const validationErrors: ValidationError[] = [];

    try {
      // Validate module structure
      const moduleStatus = await validateModule({
        id: moduleId,
        environmentId: '',
        name: '',
        source: '',
        version: '',
        description: '',
        configuration: {},
        resources: [],
        variables: {},
        outputs: {},
        position: { x: 0, y: 0 },
        status: ModuleStatus.LOADING
      });

      if (moduleStatus === ModuleStatus.ERROR) {
        validationErrors.push({
          line: 1,
          message: 'Invalid module structure',
          severity: 'error',
          fixable: false,
          code: 'MODULE_STRUCTURE'
        });
      }

      // Parse and validate individual resources
      const resourceLines = code.split('\n');
      for (let i = 0; i < resourceLines.length; i++) {
        const line = resourceLines[i];
        if (line.trim().startsWith('resource')) {
          const resourceValid = await validateResource({
            id: '',
            moduleId,
            type: '',
            name: '',
            provider: '',
            attributes: {},
            dependencies: [],
            position: { x: 0, y: 0 },
            selected: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          if (!resourceValid) {
            validationErrors.push({
              line: i + 1,
              message: 'Invalid resource configuration',
              severity: 'error',
              fixable: true,
              code: 'RESOURCE_CONFIG'
            });
          }
        }
      }

      return validationErrors;
    } catch (error) {
      console.error('Validation error:', error);
      return [{
        line: 1,
        message: 'Validation failed unexpectedly',
        severity: 'error',
        fixable: false,
        code: 'VALIDATION_ERROR'
      }];
    }
  }, []);

  /**
   * Debounced validation effect
   */
  useEffect(() => {
    const validateWithDebounce = async () => {
      // Check cache validity
      if (
        validationCache &&
        validationCache.code === code &&
        Date.now() - validationCache.timestamp < ERROR_CACHE_DURATION_MS
      ) {
        setErrors(validationCache.errors);
        return;
      }

      setIsValidating(true);
      const timeoutId = setTimeout(async () => {
        const newErrors = await validateCode(code, moduleId);
        setErrors(newErrors);
        setValidationCache({
          code,
          errors: newErrors,
          timestamp: Date.now()
        });
        setIsValidating(false);
      }, VALIDATION_DEBOUNCE_MS);

      return () => clearTimeout(timeoutId);
    };

    validateWithDebounce();
  }, [code, moduleId, validateCode, validationCache]);

  /**
   * Groups errors by severity for organized display
   */
  const groupedErrors = errors.reduce(
    (acc, error) => {
      acc[error.severity].push(error);
      return acc;
    },
    { error: [], warning: [] } as Record<'error' | 'warning', ValidationError[]>
  );

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        backgroundColor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider'
      }}
      role="complementary"
      aria-label={ariaLabel}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="subtitle2" fontWeight="medium">
          Validation Results
        </Typography>
        {isValidating && (
          <LoadingSpinner size={20} message="Validating configuration..." />
        )}
      </Box>

      {!isValidating && errors.length === 0 && (
        <Alert severity="success" sx={{ mb: 1 }}>
          No validation issues found
        </Alert>
      )}

      {Object.entries(groupedErrors).map(([severity, severityErrors]) => (
        severityErrors.length > 0 && (
          <Box key={severity} mb={1}>
            {severityErrors.slice(0, MAX_ERRORS_DISPLAYED).map((error, index) => (
              <Alert
                key={`${error.line}-${index}`}
                severity={severity as 'error' | 'warning'}
                sx={{ mb: 1 }}
                action={
                  error.fixable && (
                    <IconButton
                      size="small"
                      onClick={() => onFix(error.line, error.code)}
                      aria-label={`Fix error on line ${error.line}`}
                    >
                      <BuildCircleIcon />
                    </IconButton>
                  )
                }
              >
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Line {error.line}: {error.message}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Error Code: {error.code}
                  </Typography>
                </Box>
              </Alert>
            ))}
            {severityErrors.length > MAX_ERRORS_DISPLAYED && (
              <Typography variant="caption" color="text.secondary">
                {severityErrors.length - MAX_ERRORS_DISPLAYED} more {severity}
                {severityErrors.length - MAX_ERRORS_DISPLAYED > 1 ? 's' : ''} not shown
              </Typography>
            )}
          </Box>
        )
      ))}
    </Paper>
  );
};

export default ValidationPanel;