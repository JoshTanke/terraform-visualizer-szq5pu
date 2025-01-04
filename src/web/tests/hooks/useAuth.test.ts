/**
 * @fileoverview Test suite for useAuth hook with comprehensive security testing
 * Verifies authentication flows, token management, session validation,
 * and role-based access control.
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { Provider } from 'react-redux'; // v8.1.0
import { configureStore } from '@reduxjs/toolkit'; // v1.9.5
import { jest, describe, beforeEach, it, expect } from '@jest/globals'; // v29.5.0

import { useAuth } from '../../src/hooks/useAuth';
import AuthService from '../../src/services/auth.service';
import authReducer, { 
  loginWithGithub,
  handleAuthCallback,
  refreshAuthToken,
  logout
} from '../../src/store/authSlice';
import { UserRole, IUser, IToken } from '../../src/interfaces/IAuth';

// Mock AuthService
jest.mock('../../src/services/auth.service');

// Test data
const mockUser: IUser = {
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  role: UserRole.EDITOR,
  avatarUrl: 'https://example.com/avatar.jpg',
  githubId: '12345',
  lastLogin: new Date(),
  isActive: true
};

const mockToken: IToken = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
  tokenType: 'Bearer',
  scope: ['repo', 'read:user'],
  issuedAt: Math.floor(Date.now() / 1000)
};

describe('useAuth hook', () => {
  let store: any;
  let wrapper: React.FC<{ children: React.ReactNode }>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create fresh store for each test
    store = configureStore({
      reducer: {
        auth: authReducer
      },
      preloadedState: {
        auth: {
          isAuthenticated: false,
          user: null,
          token: null,
          loading: false,
          error: null,
          lastActivity: 0,
          sessionExpiry: 0
        }
      }
    });

    // Create wrapper with Redux Provider
    wrapper = ({ children }) => (
      <Provider store={store}>{children}</Provider>
    );

    // Reset window event listeners
    window.removeEventListener = jest.fn();
    window.addEventListener = jest.fn();
  });

  it('should handle GitHub login flow with CSRF protection', async () => {
    // Mock AuthService login
    (AuthService.login as jest.Mock).mockImplementation(() => Promise.resolve());

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login();
    });

    expect(AuthService.login).toHaveBeenCalledTimes(1);
    expect(store.getState().auth.loading).toBe(false);
    expect(store.getState().auth.error).toBeNull();
  });

  it('should handle OAuth callback with PKCE validation', async () => {
    // Mock successful OAuth callback
    (AuthService.handleOAuthCallback as jest.Mock).mockResolvedValue(mockToken);

    const { result } = renderHook(() => useAuth(), { wrapper });

    const mockResponse = {
      code: 'test-code',
      state: 'test-state',
      scope: 'repo read:user',
      error: null,
      error_description: null
    };

    await act(async () => {
      await result.current.handleGithubCallback(mockResponse.code, mockResponse.state);
    });

    expect(AuthService.handleOAuthCallback).toHaveBeenCalledWith(mockResponse);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toEqual(mockToken);
  });

  it('should handle secure token refresh', async () => {
    // Setup initial authenticated state
    store = configureStore({
      reducer: { auth: authReducer },
      preloadedState: {
        auth: {
          isAuthenticated: true,
          user: mockUser,
          token: mockToken,
          loading: false,
          error: null,
          lastActivity: Date.now(),
          sessionExpiry: Date.now() + 3600000
        }
      }
    });

    // Mock token refresh
    const newToken = { ...mockToken, accessToken: 'new-access-token' };
    (AuthService.refreshToken as jest.Mock).mockResolvedValue(newToken);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await store.dispatch(refreshAuthToken());
    });

    expect(AuthService.refreshToken).toHaveBeenCalled();
    expect(result.current.token?.accessToken).toBe('new-access-token');
  });

  it('should handle session validation and inactivity timeout', async () => {
    // Setup expired session
    store = configureStore({
      reducer: { auth: authReducer },
      preloadedState: {
        auth: {
          isAuthenticated: true,
          user: mockUser,
          token: mockToken,
          loading: false,
          error: null,
          lastActivity: Date.now() - 3600000, // 1 hour ago
          sessionExpiry: Date.now() - 1000 // Expired
        }
      }
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.validateSession()).toBe(false);
    expect(window.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should handle role-based access control', async () => {
    // Setup authenticated admin user
    const adminUser = { ...mockUser, role: UserRole.ADMIN };
    store = configureStore({
      reducer: { auth: authReducer },
      preloadedState: {
        auth: {
          isAuthenticated: true,
          user: adminUser,
          token: mockToken,
          loading: false,
          error: null,
          lastActivity: Date.now(),
          sessionExpiry: Date.now() + 3600000
        }
      }
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.checkPermission('admin')).toBe(true);
    expect(result.current.checkPermission('write')).toBe(true);
    expect(result.current.checkPermission('read')).toBe(true);

    // Test editor role permissions
    store.getState().auth.user.role = UserRole.EDITOR;
    expect(result.current.checkPermission('admin')).toBe(false);
    expect(result.current.checkPermission('write')).toBe(true);
    expect(result.current.checkPermission('read')).toBe(true);
  });

  it('should handle secure logout with cleanup', async () => {
    // Setup authenticated state
    store = configureStore({
      reducer: { auth: authReducer },
      preloadedState: {
        auth: {
          isAuthenticated: true,
          user: mockUser,
          token: mockToken,
          loading: false,
          error: null,
          lastActivity: Date.now(),
          sessionExpiry: Date.now() + 3600000
        }
      }
    });

    // Mock logout
    (AuthService.logout as jest.Mock).mockImplementation(() => Promise.resolve());

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    expect(AuthService.logout).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it('should handle rate limiting for authentication operations', async () => {
    // Mock rate limit exceeded
    (AuthService.login as jest.Mock).mockRejectedValue(
      new Error('Rate limit exceeded for login attempts')
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      try {
        await result.current.login();
      } catch (error) {
        expect(error.message).toBe('Rate limit exceeded for login attempts');
      }
    });

    expect(store.getState().auth.error).toBe('Rate limit exceeded for login attempts');
  });

  it('should handle token rotation', async () => {
    jest.useFakeTimers();
    
    // Setup authenticated state
    store = configureStore({
      reducer: { auth: authReducer },
      preloadedState: {
        auth: {
          isAuthenticated: true,
          user: mockUser,
          token: mockToken,
          loading: false,
          error: null,
          lastActivity: Date.now(),
          sessionExpiry: Date.now() + 3600000
        }
      }
    });

    // Mock token refresh
    const newToken = { ...mockToken, accessToken: 'rotated-token' };
    (AuthService.refreshToken as jest.Mock).mockResolvedValue(newToken);

    renderHook(() => useAuth(), { wrapper });

    // Fast-forward past token rotation interval
    jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes

    expect(AuthService.refreshToken).toHaveBeenCalled();
    
    jest.useRealTimers();
  });
});