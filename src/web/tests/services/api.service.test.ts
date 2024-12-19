/**
 * @fileoverview Comprehensive test suite for ApiService class validating HTTP communications,
 * WebSocket connections, authentication flows, and real-time updates.
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'; // v29.0.0
import axios from 'axios'; // v1.4.0
import MockAdapter from 'axios-mock-adapter'; // v1.21.0
import { io, Socket } from 'socket.io-client'; // v4.6.0
import { performance } from 'jest-performance'; // v1.0.0

import ApiService from '../../src/services/api.service';
import { IProject } from '../../src/interfaces/IProject';
import { IEnvironment, EnvironmentStatus } from '../../src/interfaces/IEnvironment';
import { IModule, ModuleStatus } from '../../src/interfaces/IModule';
import { IGraph, LayoutType } from '../../src/interfaces/IGraph';

// Mock socket.io-client
jest.mock('socket.io-client');

describe('ApiService', () => {
    let apiService: ApiService;
    let mockAxios: MockAdapter;
    let mockSocket: jest.Mocked<Socket>;
    const baseURL = '/api/v1';
    const mockJwtToken = 'mock-jwt-token';
    const mockRefreshToken = 'mock-refresh-token';

    beforeEach(() => {
        // Setup axios mock
        mockAxios = new MockAdapter(axios);
        
        // Setup localStorage mock
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: jest.fn(),
                setItem: jest.fn(),
                removeItem: jest.fn(),
                clear: jest.fn()
            },
            writable: true
        });

        // Setup WebSocket mock
        mockSocket = {
            on: jest.fn(),
            emit: jest.fn(),
            connect: jest.fn(),
            disconnect: jest.fn()
        } as unknown as jest.Mocked<Socket>;
        (io as jest.Mock).mockReturnValue(mockSocket);

        // Initialize service
        apiService = new ApiService(baseURL);

        // Setup default localStorage values
        localStorage.getItem.mockImplementation((key: string) => {
            if (key === 'authToken') return mockJwtToken;
            if (key === 'refreshToken') return mockRefreshToken;
            return null;
        });
    });

    afterEach(() => {
        mockAxios.reset();
        jest.clearAllMocks();
        apiService.dispose();
    });

    describe('Authentication', () => {
        test('should add authorization header to requests when token exists', async () => {
            const projectId = '123';
            mockAxios.onGet(`${baseURL}/projects/${projectId}`).reply(200, { id: projectId });

            await apiService.getProject(projectId);

            expect(mockAxios.history.get[0].headers?.Authorization).toBe(`Bearer ${mockJwtToken}`);
        });

        test('should handle token refresh on 401 response', async () => {
            const projectId = '123';
            const newToken = 'new-jwt-token';

            // Mock initial request failure
            mockAxios.onGet(`${baseURL}/projects/${projectId}`).replyOnce(401);
            
            // Mock token refresh
            mockAxios.onPost(`${baseURL}/auth/refresh`).replyOnce(200, { token: newToken });
            
            // Mock retry with new token
            mockAxios.onGet(`${baseURL}/projects/${projectId}`).replyOnce(200, { id: projectId });

            await apiService.getProject(projectId);

            expect(localStorage.setItem).toHaveBeenCalledWith('authToken', newToken);
            expect(mockAxios.history.get[1].headers?.Authorization).toBe(`Bearer ${newToken}`);
        });

        test('should handle authentication failure gracefully', async () => {
            localStorage.getItem.mockReturnValue(null);

            const projectId = '123';
            mockAxios.onGet(`${baseURL}/projects/${projectId}`).reply(401);

            await expect(apiService.getProject(projectId)).rejects.toThrow('Authentication refresh failed');
            expect(localStorage.removeItem).toHaveBeenCalledWith('authToken');
            expect(localStorage.removeItem).toHaveBeenCalledWith('refreshToken');
        });
    });

    describe('Rate Limiting', () => {
        test('should handle rate limit responses with retry', async () => {
            const projectId = '123';
            const retryAfter = 1;

            mockAxios.onGet(`${baseURL}/projects/${projectId}`)
                .replyOnce(429, {}, { 'retry-after': retryAfter.toString() })
                .onGet(`${baseURL}/projects/${projectId}`)
                .replyOnce(200, { id: projectId });

            const result = await apiService.getProject(projectId);

            expect(result).toEqual({ id: projectId });
            expect(mockAxios.history.get.length).toBe(2);
        });

        test('should respect retry-after header', async () => {
            const projectId = '123';
            const retryAfter = 1;
            const start = Date.now();

            mockAxios.onGet(`${baseURL}/projects/${projectId}`)
                .replyOnce(429, {}, { 'retry-after': retryAfter.toString() })
                .onGet(`${baseURL}/projects/${projectId}`)
                .replyOnce(200, { id: projectId });

            await apiService.getProject(projectId);

            const duration = Date.now() - start;
            expect(duration).toBeGreaterThanOrEqual(retryAfter * 1000);
        });
    });

    describe('WebSocket Connection', () => {
        test('should establish WebSocket connection on initialization', () => {
            expect(io).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
            expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
        });

        test('should handle real-time updates', () => {
            const mockProject: IProject = {
                id: '123',
                name: 'Test Project',
                description: 'Test Description',
                githubUrl: 'https://github.com/test/repo',
                githubBranch: 'main',
                environments: [],
                lastSyncedAt: new Date(),
                created: new Date(),
                updated: new Date()
            };

            // Get the update handler
            const updateHandler = mockSocket.on.mock.calls.find(
                call => call[0] === 'project.update'
            )?.[1];

            if (updateHandler) {
                updateHandler(mockProject);
                // Verify cache invalidation
                const getProject = apiService.getProject(mockProject.id);
                expect(getProject).resolves.toBeDefined();
            }
        });

        test('should reconnect on connection loss', () => {
            const disconnectHandler = mockSocket.on.mock.calls.find(
                call => call[0] === 'disconnect'
            )?.[1];

            if (disconnectHandler) {
                disconnectHandler('io server disconnect');
                expect(mockSocket.connect).toHaveBeenCalled();
            }
        });
    });

    describe('Cache Management', () => {
        test('should cache and return cached responses', async () => {
            const projectId = '123';
            const mockProject = { id: projectId, name: 'Test Project' };

            mockAxios.onGet(`${baseURL}/projects/${projectId}`).replyOnce(200, mockProject);

            // First call - should hit API
            const result1 = await apiService.getProject(projectId);
            expect(mockAxios.history.get.length).toBe(1);

            // Second call - should use cache
            const result2 = await apiService.getProject(projectId);
            expect(mockAxios.history.get.length).toBe(1);

            expect(result1).toEqual(result2);
        });

        test('should invalidate cache on updates', async () => {
            const projectId = '123';
            const mockProject = { id: projectId, name: 'Test Project' };

            mockAxios.onGet(`${baseURL}/projects/${projectId}`).reply(200, mockProject);
            mockAxios.onPut(`${baseURL}/projects/${projectId}`).reply(200, { ...mockProject, name: 'Updated' });

            // Initial fetch
            await apiService.getProject(projectId);

            // Update project
            await apiService.updateProject({ ...mockProject, name: 'Updated' });

            // Fetch again - should hit API due to cache invalidation
            await apiService.getProject(projectId);

            expect(mockAxios.history.get.length).toBe(2);
        });
    });

    describe('Performance', () => {
        test('should meet response time benchmarks', async () => {
            const projectId = '123';
            mockAxios.onGet(`${baseURL}/projects/${projectId}`).reply(200, { id: projectId });

            const { duration } = await performance.measure(
                async () => await apiService.getProject(projectId)
            );

            expect(duration).toBeLessThan(200); // 200ms benchmark
        });

        test('should handle multiple concurrent requests efficiently', async () => {
            const projectIds = ['1', '2', '3', '4', '5'];
            projectIds.forEach(id => {
                mockAxios.onGet(`${baseURL}/projects/${id}`).reply(200, { id });
            });

            const { duration } = await performance.measure(async () => {
                await Promise.all(projectIds.map(id => apiService.getProject(id)));
            });

            expect(duration).toBeLessThan(1000); // 1s benchmark for 5 concurrent requests
        });
    });

    describe('Error Handling', () => {
        test('should handle network errors with retry', async () => {
            const projectId = '123';
            mockAxios.onGet(`${baseURL}/projects/${projectId}`)
                .networkError()
                .onGet(`${baseURL}/projects/${projectId}`)
                .reply(200, { id: projectId });

            const result = await apiService.getProject(projectId);
            expect(result).toEqual({ id: projectId });
            expect(mockAxios.history.get.length).toBe(2);
        });

        test('should handle server errors appropriately', async () => {
            const projectId = '123';
            mockAxios.onGet(`${baseURL}/projects/${projectId}`).reply(500, { message: 'Server Error' });

            await expect(apiService.getProject(projectId)).rejects.toThrow('Server Error');
        });

        test('should handle validation errors', async () => {
            const projectId = '123';
            mockAxios.onGet(`${baseURL}/projects/${projectId}`).reply(422, { message: 'Validation Error' });

            await expect(apiService.getProject(projectId)).rejects.toThrow('Validation Error');
        });
    });
});