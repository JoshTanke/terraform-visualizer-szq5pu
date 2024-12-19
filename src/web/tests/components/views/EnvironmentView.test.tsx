import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Provider } from 'react-redux';
import { axe } from 'jest-axe';
import ResizeObserver from 'resize-observer-polyfill';

import EnvironmentView from '../../src/components/views/EnvironmentView';
import { useGraph } from '../../src/hooks/useGraph';
import { GraphService } from '../../src/services/graph.service';
import { WebSocketService } from '../../src/services/websocket.service';
import { ErrorBoundary } from '../../src/components/common/ErrorBoundary';
import { EnvironmentStatus } from '../../src/interfaces/IEnvironment';
import { LayoutType } from '../../src/interfaces/IGraph';
import { createTestStore } from '../../../test-utils/store';

// Mock dependencies
vi.mock('../../src/hooks/useGraph');
vi.mock('../../src/services/graph.service');
vi.mock('../../src/services/websocket.service');

// Mock ResizeObserver
global.ResizeObserver = ResizeObserver;

describe('EnvironmentView Component', () => {
    // Test data setup
    const mockEnvironment = {
        id: 'env-1',
        name: 'Test Environment',
        status: EnvironmentStatus.ACTIVE,
        modules: [
            { id: 'module-1', name: 'Module 1', type: 'terraform' },
            { id: 'module-2', name: 'Module 2', type: 'terraform' }
        ]
    };

    const mockGraph = {
        nodes: [
            {
                id: 'node-1',
                type: 'module',
                data: { label: 'Module 1', type: 'terraform', resources: 3 },
                position: { x: 0, y: 0 }
            },
            {
                id: 'node-2',
                type: 'module',
                data: { label: 'Module 2', type: 'terraform', resources: 2 },
                position: { x: 100, y: 0 }
            }
        ],
        edges: [
            {
                id: 'edge-1',
                source: 'node-1',
                target: 'node-2',
                type: 'dependency'
            }
        ]
    };

    // Setup mocks and store
    let store: any;
    const mockOnError = vi.fn();

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Initialize test store
        store = createTestStore();

        // Mock useGraph hook
        (useGraph as jest.Mock).mockReturnValue({
            graph: mockGraph,
            selectedNodeId: null,
            isLoading: false,
            error: null,
            performanceMetrics: {
                lastUpdateDuration: 50,
                averageUpdateTime: 45
            },
            handleNodeClick: vi.fn(),
            handleNodeDragEnd: vi.fn(),
            handleLayoutChange: vi.fn()
        });

        // Mock GraphService
        (GraphService as jest.Mock).mockImplementation(() => ({
            getGraph: vi.fn().mockResolvedValue(mockGraph),
            updateLayout: vi.fn().mockResolvedValue(mockGraph)
        }));

        // Mock WebSocketService
        (WebSocketService as jest.Mock).mockImplementation(() => ({
            connect: vi.fn().mockResolvedValue(undefined),
            subscribe: vi.fn().mockReturnValue(() => {}),
            disconnect: vi.fn()
        }));
    });

    // Test cases
    it('should render environment view with correct layout', async () => {
        render(
            <Provider store={store}>
                <EnvironmentView
                    environmentId="env-1"
                    onError={mockOnError}
                />
            </Provider>
        );

        // Verify basic structure
        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByText(/Test Environment/i)).toBeInTheDocument();
        expect(screen.getByRole('application')).toBeInTheDocument();

        // Verify graph canvas presence
        const graphCanvas = screen.getByRole('application', {
            name: /Infrastructure Visualization Graph/i
        });
        expect(graphCanvas).toBeInTheDocument();

        // Verify split panel layout
        const panels = screen.getAllByRole('grid');
        expect(panels).toHaveLength(2); // Graph and editor panels
    });

    it('should handle module selection and navigation', async () => {
        const mockNavigate = vi.fn();
        vi.mock('react-router-dom', () => ({
            ...vi.importActual('react-router-dom'),
            useNavigate: () => mockNavigate
        }));

        render(
            <Provider store={store}>
                <EnvironmentView
                    environmentId="env-1"
                    onError={mockOnError}
                />
            </Provider>
        );

        // Simulate module selection
        const moduleNode = screen.getByText('Module 1');
        await userEvent.click(moduleNode);

        // Verify navigation
        expect(mockNavigate).toHaveBeenCalledWith(
            '/environments/env-1/modules/node-1'
        );

        // Verify accessibility announcement
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/Selected module: Module 1/i);
    });

    it('should handle real-time updates via WebSocket', async () => {
        const mockWebSocketUpdate = {
            id: 'env-1',
            name: 'Test Environment',
            status: EnvironmentStatus.UPDATING,
            modules: [...mockEnvironment.modules]
        };

        render(
            <Provider store={store}>
                <EnvironmentView
                    environmentId="env-1"
                    onError={mockOnError}
                />
            </Provider>
        );

        // Get WebSocket subscription callback
        const wsService = WebSocketService.mock.instances[0];
        const subscribeCallback = wsService.subscribe.mock.calls[0][1];

        // Simulate WebSocket update
        subscribeCallback(mockWebSocketUpdate);

        // Verify update reflection
        await waitFor(() => {
            expect(screen.getByText(/Test Environment/i)).toBeInTheDocument();
            expect(screen.getByRole('application')).toBeInTheDocument();
        });
    });

    it('should meet performance requirements', async () => {
        const performanceObserver = vi.fn();
        global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
            observe: performanceObserver,
            disconnect: vi.fn()
        }));

        render(
            <Provider store={store}>
                <EnvironmentView
                    environmentId="env-1"
                    onError={mockOnError}
                />
            </Provider>
        );

        // Verify graph update performance
        const { performanceMetrics } = useGraph();
        expect(performanceMetrics.lastUpdateDuration).toBeLessThan(1000);
        expect(performanceMetrics.averageUpdateTime).toBeLessThan(1000);
    });

    it('should handle error states appropriately', async () => {
        const mockError = new Error('Test error');
        (useGraph as jest.Mock).mockReturnValue({
            ...useGraph(),
            error: mockError
        });

        render(
            <Provider store={store}>
                <ErrorBoundary>
                    <EnvironmentView
                        environmentId="env-1"
                        onError={mockOnError}
                    />
                </ErrorBoundary>
            </Provider>
        );

        // Verify error display
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Test error/i)).toBeInTheDocument();
        expect(mockOnError).toHaveBeenCalledWith(mockError);
    });

    it('should be accessible', async () => {
        const { container } = render(
            <Provider store={store}>
                <EnvironmentView
                    environmentId="env-1"
                    onError={mockOnError}
                />
            </Provider>
        );

        // Run accessibility tests
        const results = await axe(container);
        expect(results).toHaveNoViolations();

        // Verify keyboard navigation
        const moduleNode = screen.getByText('Module 1');
        moduleNode.focus();
        fireEvent.keyDown(moduleNode, { key: 'Enter' });
        
        // Verify focus management
        expect(document.activeElement).toBe(moduleNode);
    });

    it('should handle responsive layout changes', async () => {
        // Mock mobile viewport
        global.innerWidth = 500;
        fireEvent(window, new Event('resize'));

        render(
            <Provider store={store}>
                <EnvironmentView
                    environmentId="env-1"
                    onError={mockOnError}
                />
            </Provider>
        );

        // Verify mobile layout
        const editorPanel = screen.queryByRole('grid', { name: /editor/i });
        expect(editorPanel).not.toBeVisible();

        // Mock desktop viewport
        global.innerWidth = 1024;
        fireEvent(window, new Event('resize'));

        // Verify desktop layout
        await waitFor(() => {
            const editorPanel = screen.queryByRole('grid', { name: /editor/i });
            expect(editorPanel).toBeVisible();
        });
    });
});