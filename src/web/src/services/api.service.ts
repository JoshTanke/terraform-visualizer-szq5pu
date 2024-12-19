/**
 * @fileoverview Core API service handling HTTP and WebSocket communications
 * with comprehensive error handling, caching, and real-time updates.
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError } from 'axios'; // v1.4.0
import { io, Socket } from 'socket.io-client'; // v4.7.0
import { IProject } from '../interfaces/IProject';
import { IEnvironment, EnvironmentStatus } from '../interfaces/IEnvironment';
import { IModule, ModuleStatus } from '../interfaces/IModule';
import { IResource } from '../interfaces/IResource';
import { IGraph, LayoutType } from '../interfaces/IGraph';

/**
 * Error types for API operations
 */
enum ApiErrorType {
    NETWORK = 'NETWORK',
    AUTHENTICATION = 'AUTHENTICATION',
    AUTHORIZATION = 'AUTHORIZATION',
    RATE_LIMIT = 'RATE_LIMIT',
    VALIDATION = 'VALIDATION',
    SERVER = 'SERVER',
    UNKNOWN = 'UNKNOWN'
}

/**
 * Cache entry structure with TTL
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
}

/**
 * Core API service class handling all backend communications
 */
export class ApiService {
    private axiosInstance: AxiosInstance;
    private socket: Socket | null = null;
    private cache: Map<string, CacheEntry<any>> = new Map();
    private readonly retryAttempts: number;
    private readonly retryDelay: number;
    private readonly requestTimeout: number;
    private readonly cacheTimeout: number;

    /**
     * Initialize API service with configuration
     */
    constructor(
        baseURL: string = '/api/v1',
        retryAttempts: number = 3,
        retryDelay: number = 1000,
        requestTimeout: number = 30000,
        cacheTimeout: number = 300000
    ) {
        this.retryAttempts = retryAttempts;
        this.retryDelay = retryDelay;
        this.requestTimeout = requestTimeout;
        this.cacheTimeout = cacheTimeout;

        // Initialize axios instance with configuration
        this.axiosInstance = axios.create({
            baseURL,
            timeout: requestTimeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Configure request interceptors
        this.setupInterceptors();

        // Initialize WebSocket connection
        this.setupWebSocket();
    }

    /**
     * Configure axios interceptors for authentication and error handling
     */
    private setupInterceptors(): void {
        // Request interceptor
        this.axiosInstance.interceptors.request.use(
            (config) => {
                const token = localStorage.getItem('authToken');
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor
        this.axiosInstance.interceptors.response.use(
            (response) => response,
            async (error) => {
                return this.handleError(error);
            }
        );
    }

    /**
     * Initialize and configure WebSocket connection
     */
    private setupWebSocket(): void {
        this.socket = io(process.env.REACT_APP_WS_URL || 'ws://localhost:3000', {
            reconnection: true,
            reconnectionAttempts: this.retryAttempts,
            reconnectionDelay: this.retryDelay,
            transports: ['websocket']
        });

        this.socket.on('connect', () => {
            console.log('WebSocket connected');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
        });

        this.socket.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

        // Set up real-time update handlers
        this.setupRealtimeHandlers();
    }

    /**
     * Configure WebSocket event handlers for real-time updates
     */
    private setupRealtimeHandlers(): void {
        if (!this.socket) return;

        this.socket.on('project.update', (project: IProject) => {
            this.invalidateCache(`projects/${project.id}`);
        });

        this.socket.on('environment.update', (environment: IEnvironment) => {
            this.invalidateCache(`environments/${environment.id}`);
        });

        this.socket.on('module.update', (module: IModule) => {
            this.invalidateCache(`modules/${module.id}`);
        });

        this.socket.on('graph.update', (graph: IGraph) => {
            this.invalidateCache('graph');
        });
    }

    /**
     * Handle API errors with retry logic
     */
    private async handleError(error: AxiosError): Promise<never> {
        const errorType = this.categorizeError(error);
        
        switch (errorType) {
            case ApiErrorType.NETWORK:
                if (error.config && error.config.retryCount < this.retryAttempts) {
                    return this.retryRequest(error.config);
                }
                throw new Error('Network error after retry attempts');

            case ApiErrorType.RATE_LIMIT:
                const retryAfter = parseInt(error.response?.headers['retry-after'] || '5', 10);
                await this.delay(retryAfter * 1000);
                return this.retryRequest(error.config!);

            case ApiErrorType.AUTHENTICATION:
                // Trigger authentication refresh
                await this.refreshAuthentication();
                return this.retryRequest(error.config!);

            default:
                throw new Error(error.response?.data?.message || error.message);
        }
    }

    /**
     * Categorize API errors for appropriate handling
     */
    private categorizeError(error: AxiosError): ApiErrorType {
        if (!error.response) {
            return ApiErrorType.NETWORK;
        }

        switch (error.response.status) {
            case 401:
                return ApiErrorType.AUTHENTICATION;
            case 403:
                return ApiErrorType.AUTHORIZATION;
            case 429:
                return ApiErrorType.RATE_LIMIT;
            case 422:
                return ApiErrorType.VALIDATION;
            case 500:
                return ApiErrorType.SERVER;
            default:
                return ApiErrorType.UNKNOWN;
        }
    }

    /**
     * Retry failed requests with exponential backoff
     */
    private async retryRequest(config: any): Promise<any> {
        config.retryCount = (config.retryCount || 0) + 1;
        const delay = this.retryDelay * Math.pow(2, config.retryCount - 1);
        await this.delay(delay);
        return this.axiosInstance(config);
    }

    /**
     * Utility method for delayed execution
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Refresh authentication token
     */
    private async refreshAuthentication(): Promise<void> {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await this.axiosInstance.post('/auth/refresh', { refreshToken });
            localStorage.setItem('authToken', response.data.token);
        } catch (error) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            throw new Error('Authentication refresh failed');
        }
    }

    /**
     * Cache management methods
     */
    private getCacheKey(path: string): string {
        return `${path}`;
    }

    private setCacheEntry<T>(key: string, data: T): void {
        const now = Date.now();
        this.cache.set(key, {
            data,
            timestamp: now,
            expiresAt: now + this.cacheTimeout
        });
    }

    private getCacheEntry<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry || entry.expiresAt < Date.now()) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    private invalidateCache(key: string): void {
        this.cache.delete(this.getCacheKey(key));
    }

    /**
     * API Methods
     */

    /**
     * Retrieve all projects
     */
    async getProjects(): Promise<IProject[]> {
        const cacheKey = this.getCacheKey('projects');
        const cached = this.getCacheEntry<IProject[]>(cacheKey);
        if (cached) return cached;

        const response = await this.axiosInstance.get<IProject[]>('/projects');
        this.setCacheEntry(cacheKey, response.data);
        return response.data;
    }

    /**
     * Get project by ID
     */
    async getProject(id: string): Promise<IProject> {
        const cacheKey = this.getCacheKey(`projects/${id}`);
        const cached = this.getCacheEntry<IProject>(cacheKey);
        if (cached) return cached;

        const response = await this.axiosInstance.get<IProject>(`/projects/${id}`);
        this.setCacheEntry(cacheKey, response.data);
        return response.data;
    }

    /**
     * Get environment by ID
     */
    async getEnvironment(id: string): Promise<IEnvironment> {
        const cacheKey = this.getCacheKey(`environments/${id}`);
        const cached = this.getCacheEntry<IEnvironment>(cacheKey);
        if (cached) return cached;

        const response = await this.axiosInstance.get<IEnvironment>(`/environments/${id}`);
        this.setCacheEntry(cacheKey, response.data);
        return response.data;
    }

    /**
     * Get module by ID
     */
    async getModule(id: string): Promise<IModule> {
        const cacheKey = this.getCacheKey(`modules/${id}`);
        const cached = this.getCacheEntry<IModule>(cacheKey);
        if (cached) return cached;

        const response = await this.axiosInstance.get<IModule>(`/modules/${id}`);
        this.setCacheEntry(cacheKey, response.data);
        return response.data;
    }

    /**
     * Get graph visualization data
     */
    async getGraph(projectId: string, layout: LayoutType = LayoutType.HIERARCHICAL): Promise<IGraph> {
        const cacheKey = this.getCacheKey(`graph/${projectId}/${layout}`);
        const cached = this.getCacheEntry<IGraph>(cacheKey);
        if (cached) return cached;

        const response = await this.axiosInstance.get<IGraph>(`/graph/${projectId}`, {
            params: { layout }
        });
        this.setCacheEntry(cacheKey, response.data);
        return response.data;
    }

    /**
     * Update project
     */
    async updateProject(project: IProject): Promise<IProject> {
        const response = await this.axiosInstance.put<IProject>(`/projects/${project.id}`, project);
        this.invalidateCache(`projects/${project.id}`);
        return response.data;
    }

    /**
     * Update environment
     */
    async updateEnvironment(environment: IEnvironment): Promise<IEnvironment> {
        const response = await this.axiosInstance.put<IEnvironment>(
            `/environments/${environment.id}`,
            environment
        );
        this.invalidateCache(`environments/${environment.id}`);
        return response.data;
    }

    /**
     * Update module
     */
    async updateModule(module: IModule): Promise<IModule> {
        const response = await this.axiosInstance.put<IModule>(`/modules/${module.id}`, module);
        this.invalidateCache(`modules/${module.id}`);
        return response.data;
    }

    /**
     * Sync project with GitHub
     */
    async syncWithGitHub(projectId: string): Promise<void> {
        await this.axiosInstance.post(`/projects/${projectId}/sync`);
        this.invalidateCache(`projects/${projectId}`);
    }

    /**
     * Cleanup resources
     */
    dispose(): void {
        this.socket?.disconnect();
        this.cache.clear();
    }
}

export default ApiService;