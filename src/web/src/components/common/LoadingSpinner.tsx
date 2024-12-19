import React from 'react'; // v18.x
import { CircularProgress, Box, useTheme } from '@mui/material'; // v5.x
import { COLORS } from '../../assets/styles/theme';

// Default size for the spinner in pixels
const DEFAULT_SPINNER_SIZE = 40;

/**
 * Props interface for the LoadingSpinner component
 */
interface LoadingSpinnerProps {
  /**
   * Size of the spinner in pixels
   * @default DEFAULT_SPINNER_SIZE
   */
  size?: number;
  
  /**
   * Custom color for the spinner
   * If not provided, uses theme-based color
   */
  color?: string;
  
  /**
   * Optional loading message to display below the spinner
   */
  message?: string;
}

/**
 * A reusable loading spinner component that provides visual feedback during
 * asynchronous operations. Supports both light and dark themes with customizable
 * size and color options while maintaining WCAG 2.1 Level AA accessibility compliance.
 *
 * @param props - The component props
 * @returns A rendered loading spinner component with optional message
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = DEFAULT_SPINNER_SIZE,
  color,
  message
}) => {
  // Get current theme to determine color mode
  const theme = useTheme();
  
  // Determine spinner color based on theme mode and custom color prop
  const spinnerColor = color || (
    theme.palette.mode === 'light' 
      ? COLORS.light.primary.main
      : COLORS.dark.primary.main
  );

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <CircularProgress
        size={size}
        sx={{
          color: spinnerColor,
          // Ensure sufficient color contrast for accessibility
          '& .MuiCircularProgress-svg': {
            filter: theme.palette.mode === 'dark' ? 'brightness(1.2)' : 'none'
          }
        }}
        aria-label={message || 'Loading'}
      />
      
      {message && (
        <Box
          mt={2}
          sx={{
            color: theme.palette.text.primary,
            fontSize: theme.typography.body2.fontSize,
            textAlign: 'center'
          }}
          aria-hidden="true" // Screen readers already announce the aria-label
        >
          {message}
        </Box>
      )}
    </Box>
  );
};

export default LoadingSpinner;