/**
 * @fileoverview Redux slice for secure authentication state management
 * Implements comprehensive authentication flow with GitHub OAuth,
 * secure token handling, and session management following OWASP guidelines.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // v1.9.5
import { IAuthState, IToken, IGithubAuthResponse } from '../interfaces/IAuth';
import AuthService from '../services/auth.service';

// Constants for security configuration
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;

// Initial state with comprehensive session tracking
const initialState: IAuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: false,
  error: null,
  lastActivity: 0,
  sessionExpiry: 0
};

/**
 * Async thunk for initiating GitHub OAuth login with enhanced security
 * Implements CSRF protection and session validation
 */
export const loginWithGithub = createAsyncThunk(
  'auth/login',
  async (_, { rejectWithValue }) => {
    try {
      await AuthService.login();
      return;
    } catch (error: any) {
      console.error('Login error:', error);
      return rejectWithValue(error.message || 'Login failed');
    }
  }
);

/**
 * Async thunk for handling OAuth callback with comprehensive security validation
 * Implements PKCE verification and token validation
 */
export const handleAuthCallback = createAsyncThunk(
  'auth/callback',
  async (response: IGithubAuthResponse, { rejectWithValue, dispatch }) => {
    try {
      const token = await AuthService.handleOAuthCallback(response);
      
      // Initialize token refresh cycle
      const refreshCycle = setInterval(() => {
        dispatch(refreshAuthToken());
      }, TOKEN_REFRESH_INTERVAL);

      // Store refresh cycle reference
      (window as any).tokenRefreshCycle = refreshCycle;

      return token;
    } catch (error: any) {
      console.error('OAuth callback error:', error);
      return rejectWithValue(error.message || 'Authentication failed');
    }
  }
);

/**
 * Async thunk for secure token refresh with retry logic
 * Implements token rotation and expiry management
 */
export const refreshAuthToken = createAsyncThunk(
  'auth/refresh',
  async (_, { rejectWithValue, getState }) => {
    let attempts = 0;
    
    while (attempts < MAX_RETRY_ATTEMPTS) {
      try {
        const token = await AuthService.refreshToken();
        return token;
      } catch (error: any) {
        attempts++;
        if (attempts === MAX_RETRY_ATTEMPTS) {
          console.error('Token refresh failed:', error);
          return rejectWithValue(error.message || 'Token refresh failed');
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }
  }
);

/**
 * Async thunk for secure logout with session cleanup
 * Implements comprehensive state reset and token invalidation
 */
export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      // Clear token refresh cycle
      clearInterval((window as any).tokenRefreshCycle);
      
      await AuthService.logout();
      return;
    } catch (error: any) {
      console.error('Logout error:', error);
      return rejectWithValue(error.message || 'Logout failed');
    }
  }
);

/**
 * Authentication slice with comprehensive state management
 * Implements secure token handling and session tracking
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Updates session activity timestamp
     * Implements inactivity tracking for security
     */
    updateSessionActivity: (state) => {
      state.lastActivity = Date.now();
    },
    
    /**
     * Clears authentication errors
     * Implements secure error state management
     */
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login action handlers
      .addCase(loginWithGithub.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithGithub.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // OAuth callback handlers
      .addCase(handleAuthCallback.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(handleAuthCallback.fulfilled, (state, action: PayloadAction<IToken>) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.token = action.payload;
        state.lastActivity = Date.now();
        state.sessionExpiry = Date.now() + (action.payload.expiresIn * 1000);
      })
      .addCase(handleAuthCallback.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Token refresh handlers
      .addCase(refreshAuthToken.pending, (state) => {
        state.loading = true;
      })
      .addCase(refreshAuthToken.fulfilled, (state, action: PayloadAction<IToken>) => {
        state.loading = false;
        state.token = action.payload;
        state.sessionExpiry = Date.now() + (action.payload.expiresIn * 1000);
      })
      .addCase(refreshAuthToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
        state.token = null;
        state.user = null;
      })
      
      // Logout handlers
      .addCase(logout.pending, (state) => {
        state.loading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        return { ...initialState };
      })
      .addCase(logout.rejected, (state, action) => {
        return { ...initialState, error: action.payload as string };
      });
  }
});

// Export actions and reducer
export const { updateSessionActivity, clearError } = authSlice.actions;
export default authSlice.reducer;

// Selector with security validation
export const selectAuth = (state: { auth: IAuthState }): IAuthState => {
  const auth = state.auth;
  
  // Validate session expiry
  if (auth.isAuthenticated && auth.sessionExpiry < Date.now()) {
    // Session expired, trigger logout
    AuthService.logout();
    return { ...initialState };
  }
  
  return auth;
};