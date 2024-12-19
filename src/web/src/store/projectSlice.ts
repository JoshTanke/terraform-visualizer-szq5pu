/**
 * @fileoverview Redux Toolkit slice for managing Terraform project state with comprehensive
 * project management, GitHub synchronization, and three-tier visualization support.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { IProject } from '../interfaces/IProject';
import ApiService from '../services/api.service';

// Version of external dependencies
// @reduxjs/toolkit: ^1.9.0

/**
 * Loading states for async operations
 */
export enum LoadingState {
  IDLE = 'idle',
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed'
}

/**
 * Error state structure
 */
interface ErrorState {
  code: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * Sync status tracking
 */
interface SyncState {
  inProgress: boolean;
  projectId: string | null;
  progress: number;
  stage: string | null;
  error?: ErrorState;
}

/**
 * Cache entry with TTL
 */
interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
}

/**
 * Project slice state interface
 */
interface ProjectState {
  projects: IProject[];
  selectedProject: IProject | null;
  loading: {
    status: LoadingState;
    source: string | null;
    timestamp: number | null;
  };
  error: ErrorState | null;
  syncStatus: SyncState;
  projectCache: Record<string, CacheEntry>;
}

/**
 * Fetch options for API calls
 */
interface FetchOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

/**
 * Initial state for the project slice
 */
const initialState: ProjectState = {
  projects: [],
  selectedProject: null,
  loading: {
    status: LoadingState.IDLE,
    source: null,
    timestamp: null
  },
  error: null,
  syncStatus: {
    inProgress: false,
    projectId: null,
    progress: 0,
    stage: null
  },
  projectCache: {}
};

// API service instance
const apiService = new ApiService();

/**
 * Async thunk for fetching all projects
 */
export const fetchProjects = createAsyncThunk(
  'projects/fetchAll',
  async (options: FetchOptions = {}, { rejectWithValue }) => {
    try {
      const projects = await apiService.getProjects();
      return projects;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'FETCH_ERROR',
        message: error.message || 'Failed to fetch projects'
      });
    }
  }
);

/**
 * Async thunk for fetching a specific project
 */
export const fetchProjectById = createAsyncThunk(
  'projects/fetchById',
  async ({ projectId, options = {} }: { projectId: string; options?: FetchOptions }, 
    { rejectWithValue }) => {
    try {
      const project = await apiService.getProject(projectId);
      return project;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'FETCH_ERROR',
        message: error.message || 'Failed to fetch project'
      });
    }
  }
);

/**
 * Async thunk for syncing project with GitHub
 */
export const syncProject = createAsyncThunk(
  'projects/sync',
  async (projectId: string, { dispatch, rejectWithValue }) => {
    try {
      await apiService.syncWithGitHub(projectId);
      // Refresh project data after sync
      dispatch(fetchProjectById({ projectId }));
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'SYNC_ERROR',
        message: error.message || 'Failed to sync project'
      });
    }
  }
);

/**
 * Project slice definition
 */
const projectSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setSelectedProject: (state, action: PayloadAction<IProject | null>) => {
      state.selectedProject = action.payload;
    },
    updateSyncProgress: (state, action: PayloadAction<{ progress: number; stage: string }>) => {
      state.syncStatus.progress = action.payload.progress;
      state.syncStatus.stage = action.payload.stage;
    },
    clearError: (state) => {
      state.error = null;
    },
    invalidateCache: (state, action: PayloadAction<string>) => {
      delete state.projectCache[action.payload];
    }
  },
  extraReducers: (builder) => {
    // Fetch Projects
    builder.addCase(fetchProjects.pending, (state) => {
      state.loading = {
        status: LoadingState.PENDING,
        source: 'fetchProjects',
        timestamp: Date.now()
      };
    });
    builder.addCase(fetchProjects.fulfilled, (state, action) => {
      state.projects = action.payload;
      state.loading.status = LoadingState.SUCCEEDED;
      state.error = null;
    });
    builder.addCase(fetchProjects.rejected, (state, action) => {
      state.loading.status = LoadingState.FAILED;
      state.error = action.payload as ErrorState;
    });

    // Fetch Project by ID
    builder.addCase(fetchProjectById.pending, (state) => {
      state.loading = {
        status: LoadingState.PENDING,
        source: 'fetchProjectById',
        timestamp: Date.now()
      };
    });
    builder.addCase(fetchProjectById.fulfilled, (state, action) => {
      const index = state.projects.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.projects[index] = action.payload;
      } else {
        state.projects.push(action.payload);
      }
      if (state.selectedProject?.id === action.payload.id) {
        state.selectedProject = action.payload;
      }
      state.loading.status = LoadingState.SUCCEEDED;
      state.error = null;
    });
    builder.addCase(fetchProjectById.rejected, (state, action) => {
      state.loading.status = LoadingState.FAILED;
      state.error = action.payload as ErrorState;
    });

    // Sync Project
    builder.addCase(syncProject.pending, (state, action) => {
      state.syncStatus = {
        inProgress: true,
        projectId: action.meta.arg,
        progress: 0,
        stage: 'Initializing'
      };
    });
    builder.addCase(syncProject.fulfilled, (state) => {
      state.syncStatus = {
        inProgress: false,
        projectId: null,
        progress: 100,
        stage: null
      };
    });
    builder.addCase(syncProject.rejected, (state, action) => {
      state.syncStatus = {
        ...state.syncStatus,
        inProgress: false,
        error: action.payload as ErrorState
      };
    });
  }
});

// Export actions
export const {
  setSelectedProject,
  updateSyncProgress,
  clearError,
  invalidateCache
} = projectSlice.actions;

// Export selectors
export const selectProjects = (state: { projects: ProjectState }) => state.projects.projects;
export const selectSelectedProject = (state: { projects: ProjectState }) => state.projects.selectedProject;
export const selectProjectLoading = (state: { projects: ProjectState }) => state.projects.loading;
export const selectProjectError = (state: { projects: ProjectState }) => state.projects.error;
export const selectSyncStatus = (state: { projects: ProjectState }) => state.projects.syncStatus;

// Export reducer
export default projectSlice.reducer;