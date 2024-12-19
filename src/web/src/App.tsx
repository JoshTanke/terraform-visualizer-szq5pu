/**
 * @fileoverview Root application component that sets up routing, theme provider,
 * authentication context, global state management, error boundaries, and WebSocket
 * connectivity for the Terraform Visualization Tool.
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ErrorBoundary } from '@sentry/react';

// Layout components
import MainLayout from './components/layout/MainLayout';
import LoadingSpinner from './components/common/LoadingSpinner';

// Authentication components
import PrivateRoute from './components/auth/PrivateRoute';
import GithubLogin from './components/auth/GithubLogin';

// Theme and store
import { createCustomTheme } from './assets/styles/theme';
import { store } from './store';
import { useAuth } from './hooks/useAuth';
import { useSettings } from './hooks/useSettings';

// Lazy-loaded view components for code splitting
const PipelineView = React.lazy(() => import('./views/PipelineView'));
const EnvironmentView = React.lazy(() => import('./views/EnvironmentView'));
const ModuleView = React.lazy(() => import('./views/ModuleView'));
const SettingsView = React.lazy(() => import('./views/SettingsView'));
const UnauthorizedView = React.lazy(() => import('./views/UnauthorizedView'));

/**
 * Root application component implementing core infrastructure and routing
 */
const App: React.FC = () => {
  // Theme management
  const { settings } = useSettings();
  const [theme, setTheme] = useState(createCustomTheme('light'));

  // Update theme when settings change
  useEffect(() => {
    const newTheme = createCustomTheme(
      settings.theme.darkMode ? 'dark' : 'light',
      settings.theme.customTheme
    );
    setTheme(newTheme);
  }, [settings.theme]);

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary
          fallback={({ error }) => (
            <div>
              <h1>Application Error</h1>
              <pre>{error.message}</pre>
            </div>
          )}
        >
          <BrowserRouter>
            <React.Suspense
              fallback={
                <LoadingSpinner
                  size={40}
                  message="Loading application..."
                />
              }
            >
              <Routes>
                {/* Public routes */}
                <Route
                  path="/login"
                  element={
                    <GithubLogin
                      onLoginError={(error) => {
                        console.error('Login failed:', error);
                      }}
                    />
                  }
                />

                {/* Protected routes within MainLayout */}
                <Route
                  element={
                    <MainLayout>
                      <ErrorBoundary>
                        <React.Suspense
                          fallback={
                            <LoadingSpinner
                              size={40}
                              message="Loading view..."
                            />
                          }
                        >
                          <Routes>
                            {/* Pipeline view (requires viewer role) */}
                            <Route
                              path="/pipeline"
                              element={
                                <PrivateRoute
                                  element={<PipelineView />}
                                  requiredRole="VIEWER"
                                />
                              }
                            />

                            {/* Environment view (requires viewer role) */}
                            <Route
                              path="/environment/:environmentId"
                              element={
                                <PrivateRoute
                                  element={<EnvironmentView />}
                                  requiredRole="VIEWER"
                                />
                              }
                            />

                            {/* Module view (requires viewer role) */}
                            <Route
                              path="/environment/:environmentId/module/:moduleId"
                              element={
                                <PrivateRoute
                                  element={<ModuleView />}
                                  requiredRole="VIEWER"
                                />
                              }
                            />

                            {/* Settings view (requires editor role) */}
                            <Route
                              path="/settings"
                              element={
                                <PrivateRoute
                                  element={<SettingsView />}
                                  requiredRole="EDITOR"
                                />
                              }
                            />

                            {/* Unauthorized access view */}
                            <Route
                              path="/unauthorized"
                              element={<UnauthorizedView />}
                            />

                            {/* Default redirect to pipeline view */}
                            <Route
                              path="/"
                              element={<Navigate to="/pipeline" replace />}
                            />

                            {/* Catch-all redirect */}
                            <Route
                              path="*"
                              element={<Navigate to="/pipeline" replace />}
                            />
                          </Routes>
                        </React.Suspense>
                      </ErrorBoundary>
                    </MainLayout>
                  }
                />
              </Routes>
            </React.Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </ThemeProvider>
    </Provider>
  );
};

export default App;