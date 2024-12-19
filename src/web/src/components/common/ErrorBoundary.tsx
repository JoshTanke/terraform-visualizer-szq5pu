import React from 'react'; // v18.x
import { Alert, Box, Button, Typography } from '@mui/material'; // v5.x
import { ErrorHandler, ERROR_TYPES, ERROR_SEVERITY } from '../../utils/errorHandling';
import { error as logError } from '../../utils/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
  maxRecoveryAttempts?: number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  severity: keyof typeof ERROR_SEVERITY;
  timestamp: number | null;
}

/**
 * Enhanced Error Boundary component with monitoring integration and recovery capabilities.
 * Provides comprehensive error handling, tracking, and accessible error UI.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private recoveryAttempts: number;
  private readonly errorId: string;
  private readonly maxRecoveryAttempts: number;
  private readonly errorHandler: ErrorHandler;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      severity: ERROR_SEVERITY.MEDIUM,
      timestamp: null,
    };
    this.recoveryAttempts = 0;
    this.errorId = `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.maxRecoveryAttempts = props.maxRecoveryAttempts || 3;
    this.errorHandler = ErrorHandler.getInstance();
  }

  /**
   * Static lifecycle method for updating error state
   * @param error The error that was caught
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      timestamp: Date.now(),
      severity: error instanceof TypeError ? ERROR_SEVERITY.HIGH : ERROR_SEVERITY.MEDIUM,
    };
  }

  /**
   * Lifecycle method for handling caught errors with monitoring integration
   * @param error The error that was caught
   * @param errorInfo React error info object
   */
  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo): Promise<void> {
    const errorContext = {
      componentStack: errorInfo.componentStack,
      errorId: this.errorId,
      recoveryAttempts: this.recoveryAttempts,
      timestamp: this.state.timestamp,
    };

    // Process error through error handler
    await this.errorHandler.handleError(
      error,
      ERROR_TYPES.RUNTIME_ERROR,
      errorContext
    );

    // Log error with enhanced context
    await logError(
      error.message,
      {
        ...errorContext,
        severity: this.state.severity,
        stack: error.stack,
      },
      'error',
      { notify: true }
    );

    // Update component state with error details
    this.setState({
      errorInfo,
    });
  }

  /**
   * Handles recovery attempts with tracking
   */
  private handleRecoveryAttempt = async (): Promise<void> => {
    this.recoveryAttempts++;

    await logError(
      `Recovery attempt ${this.recoveryAttempts} for error ${this.errorId}`,
      {
        errorId: this.errorId,
        attemptNumber: this.recoveryAttempts,
        maxAttempts: this.maxRecoveryAttempts,
      },
      'info'
    );

    if (this.recoveryAttempts <= this.maxRecoveryAttempts) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        timestamp: null,
      });

      if (this.props.onReset) {
        this.props.onReset();
      }
    }
  };

  /**
   * Renders error UI or children components
   */
  render(): React.ReactNode {
    const { hasError, error, timestamp } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback;
      }

      const canRecover = this.recoveryAttempts < this.maxRecoveryAttempts;
      const formattedTimestamp = timestamp 
        ? new Date(timestamp).toLocaleString()
        : '';

      return (
        <Box
          role="alert"
          aria-live="polite"
          sx={{
            p: 3,
            m: 2,
            borderRadius: 1,
            backgroundColor: 'background.paper',
          }}
        >
          <Alert 
            severity={this.state.severity}
            sx={{ mb: 2 }}
          >
            <Typography variant="h6" component="h2" gutterBottom>
              An error has occurred
            </Typography>
            <Typography variant="body1" gutterBottom>
              {error.message}
            </Typography>
          </Alert>

          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography variant="caption" display="block" gutterBottom>
              Error ID: {this.errorId}
            </Typography>
            <Typography variant="caption" display="block" gutterBottom>
              Timestamp: {formattedTimestamp}
            </Typography>
          </Box>

          {canRecover && (
            <Button
              variant="contained"
              color="primary"
              onClick={this.handleRecoveryAttempt}
              sx={{ mt: 2 }}
            >
              Try to Recover
            </Button>
          )}

          {!canRecover && (
            <Typography variant="body2" color="error" sx={{ mt: 2 }}>
              Maximum recovery attempts reached. Please refresh the page.
            </Typography>
          )}
        </Box>
      );
    }

    return children;
  }
}