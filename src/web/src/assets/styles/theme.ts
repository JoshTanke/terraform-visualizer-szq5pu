// @mui/material v5.14.x
import { createTheme, ThemeOptions, PaletteOptions, Components } from '@mui/material';

// Type definition for theme mode
type ThemeMode = 'light' | 'dark';

// Color palette configurations
export const COLORS = {
  light: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#9c27b0',
      light: '#ba68c8',
      dark: '#7b1fa2',
      contrastText: '#ffffff',
    },
    error: {
      main: '#d32f2f',
      light: '#ef5350',
      dark: '#c62828',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#ed6c02',
      light: '#ff9800',
      dark: '#e65100',
      contrastText: '#ffffff',
    },
    info: {
      main: '#0288d1',
      light: '#03a9f4',
      dark: '#01579b',
      contrastText: '#ffffff',
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20',
      contrastText: '#ffffff',
    },
    background: {
      default: '#ffffff',
      paper: '#f5f5f5',
    },
    surface: {
      main: '#ffffff',
      light: '#fafafa',
      dark: '#f0f0f0',
    },
  } as PaletteOptions,
  dark: {
    primary: {
      main: '#90caf9',
      light: '#e3f2fd',
      dark: '#42a5f5',
      contrastText: '#000000',
    },
    secondary: {
      main: '#ce93d8',
      light: '#f3e5f5',
      dark: '#ab47bc',
      contrastText: '#000000',
    },
    error: {
      main: '#f44336',
      light: '#e57373',
      dark: '#d32f2f',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#ffa726',
      light: '#ffb74d',
      dark: '#f57c00',
      contrastText: '#000000',
    },
    info: {
      main: '#29b6f6',
      light: '#4fc3f7',
      dark: '#0288d1',
      contrastText: '#000000',
    },
    success: {
      main: '#66bb6a',
      light: '#81c784',
      dark: '#388e3c',
      contrastText: '#000000',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    surface: {
      main: '#1e1e1e',
      light: '#2c2c2c',
      dark: '#0f0f0f',
    },
  } as PaletteOptions,
  highContrast: {
    primary: {
      main: '#ffffff',
      light: '#ffffff',
      dark: '#ffffff',
      contrastText: '#000000',
    },
    secondary: {
      main: '#ffffff',
      light: '#ffffff',
      dark: '#ffffff',
      contrastText: '#000000',
    },
    background: {
      default: '#000000',
      paper: '#000000',
    },
  } as PaletteOptions,
};

// Typography configuration
export const TYPOGRAPHY = {
  fontFamily: 'Roboto, Arial, sans-serif',
  fontSize: 14,
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,
  responsiveFontSizes: {
    h1: { xs: 30, sm: 38, md: 48 },
    h2: { xs: 24, sm: 32, md: 40 },
    h3: { xs: 20, sm: 26, md: 32 },
    h4: { xs: 18, sm: 22, md: 26 },
    h5: { xs: 16, sm: 18, md: 22 },
    h6: { xs: 14, sm: 16, md: 18 },
    body1: { xs: 14, sm: 16, md: 16 },
    body2: { xs: 12, sm: 14, md: 14 },
  },
  lineHeights: {
    xs: 1.2,
    sm: 1.4,
    md: 1.6,
  },
};

// Breakpoint configuration
export const BREAKPOINTS = {
  values: {
    xs: 320,
    sm: 768,
    md: 1024,
    lg: 1440,
    xl: 1920,
  },
};

// Transition configurations
export const TRANSITIONS = {
  durations: {
    shortest: 150,
    shorter: 200,
    short: 250,
    standard: 300,
    complex: 375,
    enteringScreen: 225,
    leavingScreen: 195,
  },
  easings: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
};

// Component overrides
export const COMPONENTS: Components = {
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        scrollbarWidth: 'thin',
        '&::-webkit-scrollbar': {
          width: '8px',
          height: '8px',
        },
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        borderRadius: '4px',
      },
    },
    defaultProps: {
      disableElevation: true,
    },
  },
  MuiTextField: {
    defaultProps: {
      variant: 'outlined',
      size: 'small',
    },
  },
  MuiTooltip: {
    defaultProps: {
      arrow: true,
      enterDelay: 500,
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: '8px',
      },
    },
  },
};

/**
 * Creates a customized Material-UI theme based on mode with enhanced accessibility and responsive features
 * @param mode - The theme mode ('light' or 'dark')
 * @param highContrast - Whether to enable high contrast mode
 * @returns A complete Material-UI theme object
 */
export const createCustomTheme = (mode: ThemeMode, highContrast: boolean = false) => {
  // Detect system color scheme preference
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effectiveMode = mode || (prefersDarkMode ? 'dark' : 'light');

  // Create theme options
  const themeOptions: ThemeOptions = {
    palette: {
      mode: effectiveMode,
      ...(highContrast ? COLORS.highContrast : COLORS[effectiveMode]),
    },
    typography: {
      ...TYPOGRAPHY,
      allVariants: {
        fontFamily: TYPOGRAPHY.fontFamily,
        textTransform: 'none',
      },
    },
    breakpoints: {
      values: BREAKPOINTS.values,
    },
    transitions: {
      duration: TRANSITIONS.durations,
      easing: TRANSITIONS.easings,
    },
    components: COMPONENTS,
    shape: {
      borderRadius: 4,
    },
    spacing: 8,
    zIndex: {
      modal: 1300,
      snackbar: 1400,
      tooltip: 1500,
    },
  };

  // Create and return the theme
  const theme = createTheme(themeOptions);

  // Apply responsive font sizes
  Object.entries(TYPOGRAPHY.responsiveFontSizes).forEach(([variant, sizes]) => {
    if (theme.typography[variant]) {
      theme.typography[variant] = {
        ...theme.typography[variant],
        ...Object.entries(sizes).reduce((acc, [breakpoint, size]) => ({
          ...acc,
          [theme.breakpoints.up(breakpoint)]: {
            fontSize: size,
          },
        }), {}),
      };
    }
  });

  return theme;
};