/**
 * @fileoverview Entry point of the React application that sets up the root render with
 * necessary providers, error boundaries, performance monitoring, and global styles.
 * @version 1.0.0
 */

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { datadogRum } from '@datadog/browser-rum';
import { ErrorBoundary } from 'react-error-boundary';

import App from './App';
import { store } from './store';
import { createCustomTheme } from './assets/styles/theme';

// Initialize performance monitoring in production
function initializeApp(): void {
  if (process.env.NODE_ENV === 'production') {
    datadogRum.init({
      applicationId: process.env.VITE_DATADOG_APP_ID || '',
      clientToken: process.env.VITE_DATADOG_CLIENT_TOKEN || '',
      site: 'datadoghq.com',
      service: 'terraform-visualizer',
      env: process.env.NODE_ENV,
      version: process.env.VITE_APP_VERSION || '1.0.0',
      sessionSampleRate: 100,
      sessionReplaySampleRate: 20,
      trackUserInteractions: true,
      trackResources: true,
      trackLongTasks: true,
      defaultPrivacyLevel: 'mask-user-input'
    });

    // Start tracking performance
    datadogRum.startSessionReplayRecording();
  }

  // Set up development tools
  if (process.env.NODE_ENV === 'development') {
    // Enable React strict mode checks
    const strictMode = true;

    // Enable performance monitoring in dev tools
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('debug', 'perf,render');
    }
  }
}

// Initialize application monitoring and error tracking
initializeApp();

// Get root element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

// Create React 18 root using createRoot
const root = createRoot(rootElement);

// Render app with providers hierarchy
root.render(
  <StrictMode>
    <ErrorBoundary
      fallback={
        <div>
          <h1>Application Error</h1>
          <p>The application encountered an unexpected error. Please try refreshing the page.</p>
        </div>
      }
      onError={(error, errorInfo) => {
        console.error('Application error:', error, errorInfo);
        if (process.env.NODE_ENV === 'production') {
          datadogRum.addError(error, { errorInfo });
        }
      }}
    >
      <Provider store={store}>
        <ThemeProvider theme={createCustomTheme('light')}>
          {/* CssBaseline kickstart an elegant, consistent, and simple baseline */}
          <CssBaseline />
          <App />
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  </StrictMode>
);

// Configure hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    // Re-render app on hot module replacement
    const NextApp = require('./App').default;
    root.render(
      <StrictMode>
        <Provider store={store}>
          <ThemeProvider theme={createCustomTheme('light')}>
            <CssBaseline />
            <NextApp />
          </ThemeProvider>
        </Provider>
      </StrictMode>
    );
  });
}