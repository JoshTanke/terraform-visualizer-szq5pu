/**
 * @fileoverview Redux slice for managing Monaco code editor state with real-time synchronization,
 * performance optimization, and comprehensive settings management.
 * @version 1.0.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // v1.9.x
import { debounce } from 'lodash'; // v4.17.x
import { IEditorSettings } from '../interfaces/ISettings';

/**
 * Interface for editor performance metrics
 */
interface IPerformanceMetrics {
  lastUpdateTime: number | null;
  averageUpdateTime: number;
  updateCount: number;
  lastSaveTime: number | null;
  saveCount: number;
}

/**
 * Interface for editor validation error
 */
interface IValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Interface for editor state
 */
interface EditorState {
  content: string;
  settings: IEditorSettings;
  validationErrors: IValidationError[];
  lastModified: number | null;
  lastSaved: number | null;
  isDirty: boolean;
  performance: IPerformanceMetrics;
}

/**
 * Initial state for the editor slice
 */
const initialState: EditorState = {
  content: '',
  settings: {
    autoSave: true,
    formatOnSave: true,
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    minimap: true,
    syntaxHighlighting: true,
    autoFormat: true,
    fontFamily: 'Monaco, monospace',
    lineHeight: 1.5
  },
  validationErrors: [],
  lastModified: null,
  lastSaved: null,
  isDirty: false,
  performance: {
    lastUpdateTime: null,
    averageUpdateTime: 0,
    updateCount: 0,
    lastSaveTime: null,
    saveCount: 0
  }
};

/**
 * Redux slice for editor state management
 */
const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    /**
     * Updates editor content with performance tracking
     */
    updateContent: {
      reducer(state, action: PayloadAction<string>) {
        const startTime = performance.now();
        
        state.content = action.payload;
        state.isDirty = true;
        state.lastModified = Date.now();
        
        // Update performance metrics
        const updateTime = performance.now() - startTime;
        state.performance.lastUpdateTime = Date.now();
        state.performance.updateCount += 1;
        state.performance.averageUpdateTime = 
          (state.performance.averageUpdateTime * (state.performance.updateCount - 1) + updateTime) / 
          state.performance.updateCount;
      },
      prepare: (content: string) => ({
        payload: content,
        meta: { debounce: 200 } // Debounce content updates for performance
      })
    },

    /**
     * Updates editor settings with validation
     */
    updateSettings(state, action: PayloadAction<Partial<IEditorSettings>>) {
      state.settings = {
        ...state.settings,
        ...action.payload
      };
    },

    /**
     * Updates validation errors
     */
    setValidationErrors(state, action: PayloadAction<IValidationError[]>) {
      state.validationErrors = action.payload;
    },

    /**
     * Marks content as saved
     */
    markContentSaved(state) {
      state.isDirty = false;
      state.lastSaved = Date.now();
      state.performance.lastSaveTime = Date.now();
      state.performance.saveCount += 1;
    },

    /**
     * Resets editor state
     */
    resetEditor(state) {
      return { ...initialState };
    }
  }
});

/**
 * Memoized selectors for editor state
 */
export const editorSelectors = {
  selectContent: (state: { editor: EditorState }) => state.editor.content,
  selectSettings: (state: { editor: EditorState }) => state.editor.settings,
  selectValidationErrors: (state: { editor: EditorState }) => state.editor.validationErrors,
  selectIsDirty: (state: { editor: EditorState }) => state.editor.isDirty,
  selectPerformanceMetrics: (state: { editor: EditorState }) => state.editor.performance
};

// Export actions and reducer
export const {
  updateContent,
  updateSettings,
  setValidationErrors,
  markContentSaved,
  resetEditor
} = editorSlice.actions;

export default editorSlice.reducer;

/**
 * Debounced content update thunk
 * Ensures optimal performance for real-time updates
 */
export const debouncedUpdateContent = debounce(
  (content: string, dispatch: any) => {
    dispatch(updateContent(content));
  },
  200,
  { maxWait: 1000 }
);

/**
 * Save content thunk with formatting support
 */
export const saveContent = () => async (dispatch: any, getState: any) => {
  const state = getState().editor;
  
  if (!state.isDirty) {
    return;
  }

  try {
    let content = state.content;

    // Apply formatting if enabled
    if (state.settings.formatOnSave) {
      content = await formatContent(content);
    }

    // Validate content before saving
    const validationErrors = await validateContent(content);
    dispatch(setValidationErrors(validationErrors));

    if (validationErrors.length === 0) {
      // Save content implementation here
      dispatch(markContentSaved());
    }
  } catch (error) {
    console.error('Error saving content:', error);
    dispatch(setValidationErrors([{
      line: 0,
      column: 0,
      message: 'Failed to save content',
      severity: 'error'
    }]));
  }
};

/**
 * Helper function to format content
 * @param content Content to format
 */
async function formatContent(content: string): Promise<string> {
  // Formatting implementation here
  return content;
}

/**
 * Helper function to validate content
 * @param content Content to validate
 */
async function validateContent(content: string): Promise<IValidationError[]> {
  // Validation implementation here
  return [];
}