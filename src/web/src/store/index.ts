/**
 * @fileoverview Root Redux store configuration with comprehensive middleware setup,
 * performance optimizations, and development tools integration.
 * Combines all feature slices for centralized state management.
 * @version 1.0.0
 */

import { 
  configureStore, 
  combineReducers,
  Middleware,
  isPlain,
  createListenerMiddleware
} from '@reduxjs/toolkit'; // v1.9.5

// Import feature reducers
import authReducer from './authSlice';
import editorReducer from './editorSlice';
import graphReducer from './graphSlice';
import projectReducer from './projectSlice';
import settingsReducer from './settingsSlice';

// Performance monitoring constants
const PERFORMANCE_THRESHOLD = 16; // 60fps frame budget in ms
const STATE_MUTATION_THRESHOLD = 10000; // Maximum state size for performance warning

/**
 * Custom serialization configuration for Redux DevTools
 * Optimizes performance by controlling what gets logged
 */
const serializationConfig = {
  // Ignore these action types in DevTools
  actionSanitizer: (action: any) => 
    action.type.includes('editor/updateContent') ? { type: action.type } : action,
  
  // Ignore large state slices in DevTools
  stateSanitizer: (state: any) => ({
    ...state,
    editor: {
      ...state.editor,
      content: state.editor.content?.length > 1000 ? 
        '<<CONTENT_TRUNCATED>>' : state.editor.content
    }
  })
};

/**
 * Performance monitoring middleware
 * Tracks state update performance and logs warnings for slow updates
 */
const performanceMiddleware: Middleware = () => next => action => {
  const start = performance.now();
  const result = next(action);
  const duration = performance.now() - start;

  if (duration > PERFORMANCE_THRESHOLD) {
    console.warn(
      `Slow state update detected for action ${action.type}:`,
      `${duration.toFixed(2)}ms`
    );
  }

  return result;
};

/**
 * State validation middleware
 * Ensures state mutations are valid and within size limits
 */
const validationMiddleware: Middleware = () => next => action => {
  const result = next(action);
  
  // Check state size
  const stateSize = JSON.stringify(result).length;
  if (stateSize > STATE_MUTATION_THRESHOLD) {
    console.warn(
      `Large state mutation detected (${stateSize} bytes) for action:`,
      action.type
    );
  }

  return result;
};

/**
 * Listener middleware for side effects
 * Handles async operations and cross-slice updates
 */
const listenerMiddleware = createListenerMiddleware();

// Add listeners for cross-slice coordination
listenerMiddleware.startListening({
  predicate: (action) => action.type.startsWith('editor/'),
  effect: async (action, listenerApi) => {
    // Handle editor-related side effects
    if (action.type === 'editor/updateContent') {
      // Trigger graph update if needed
      const state = listenerApi.getState();
      if (state.settings.visualization.autoUpdate) {
        listenerApi.dispatch({ type: 'graph/updateLayout' });
      }
    }
  }
});

/**
 * Root reducer combining all feature slices
 */
const rootReducer = combineReducers({
  auth: authReducer,
  editor: editorReducer,
  graph: graphReducer,
  projects: projectReducer,
  settings: settingsReducer
});

/**
 * Configure and create the Redux store with optimizations
 */
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    // Performance optimizations
    serializableCheck: {
      isSerializable: (value: any) => isPlain(value) || value instanceof Date,
      warnAfter: 200
    },
    immutableCheck: {
      warnAfter: 200
    }
  }).concat(
    performanceMiddleware,
    validationMiddleware,
    listenerMiddleware.middleware
  ),
  devTools: {
    // Development tools configuration
    name: 'Terraform Visualizer',
    maxAge: 50,
    latency: 250,
    trace: true,
    traceLimit: 25,
    ...serializationConfig
  }
});

// Export types for TypeScript support
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Development-only performance monitoring
if (process.env.NODE_ENV === 'development') {
  let prevState = store.getState();
  store.subscribe(() => {
    const currentState = store.getState();
    const stateChanges = Object.keys(currentState).filter(
      key => currentState[key] !== prevState[key]
    );
    
    if (stateChanges.length > 3) {
      console.warn(
        'Multiple state slices updated simultaneously:',
        stateChanges.join(', ')
      );
    }
    
    prevState = currentState;
  });
}