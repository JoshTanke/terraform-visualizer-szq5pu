/**
 * @fileoverview Comprehensive test suite for useGraph hook with real-time updates,
 * performance monitoring, and multi-level visualization testing.
 * @version 1.0.0
 */

import { render, renderHook, act, cleanup, waitFor } from '@testing-library/react'; // v14.0.0
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals'; // v29.0.0
import { Provider } from 'react-redux'; // v8.0.0
import { performance } from 'perf_hooks';
import { configureStore } from '@reduxjs/toolkit';

import { useGraph } from '../../src/hooks/useGraph';
import { 
    IGraph, 
    LayoutType, 
    NodeType, 
    EdgeType, 
    ViewLevel 
} from '../../src/interfaces/IGraph';
import GraphService from '../../src/services/graph.service';
import WebSocketService from '../../src/services/websocket.service';
import graphReducer from '../../src/store/graphSlice';

// Mock services
jest.mock('../../src/services/graph.service');
jest.mock('../../src/services/websocket.service');

// Test data constants
const TEST_MODULE_ID = 'test-module-123';
const TEST_VIEW_LEVEL = ViewLevel.MODULE;

// Mock graph data
const mockGraph: IGraph = {
    nodes: [
        {
            id: 'node1',
            type: NodeType.RESOURCE,
            data: { label: 'Test Resource 1' },
            position: { x: 0, y: 0 },
            metadata: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'valid'
            }
        }
    ],
    edges: [
        {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            type: EdgeType.DEPENDENCY,
            metadata: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        }
    ],
    layout: LayoutType.HIERARCHICAL,
    viewport: { x: 0, y: 0, zoom: 1 },
    metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        name: 'Test Graph',
        nodeCount: 1,
        edgeCount: 1
    }
};

// Test wrapper setup
const createWrapper = () => {
    const store = configureStore({
        reducer: {
            graph: graphReducer
        }
    });

    return ({ children }: { children: React.ReactNode }) => (
        <Provider store={store}>{children}</Provider>
    );
};

describe('useGraph Hook', () => {
    let mockGraphService: jest.Mocked<GraphService>;
    let mockWebSocketService: jest.Mocked<WebSocketService>;
    let wrapper: ReturnType<typeof createWrapper>;
    let performanceMonitor: { startTime: number; measurements: number[] };

    beforeEach(() => {
        // Reset mocks and setup test environment
        mockGraphService = new GraphService() as jest.Mocked<GraphService>;
        mockWebSocketService = new WebSocketService() as jest.Mocked<WebSocketService>;
        
        // Setup mock implementations
        mockGraphService.getGraph.mockResolvedValue(mockGraph);
        mockGraphService.updateLayout.mockImplementation((graph) => graph);
        mockGraphService.subscribeToUpdates.mockImplementation(() => () => {});

        mockWebSocketService.subscribe.mockImplementation(() => () => {});

        // Initialize performance monitoring
        performanceMonitor = {
            startTime: performance.now(),
            measurements: []
        };

        wrapper = createWrapper();
    });

    afterEach(() => {
        cleanup();
        jest.clearAllMocks();
    });

    it('should initialize with correct default state', async () => {
        const { result } = renderHook(
            () => useGraph(TEST_MODULE_ID, TEST_VIEW_LEVEL),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.graph).toBeDefined();
            expect(result.current.isLoading).toBe(false);
            expect(result.current.error).toBeNull();
        });

        expect(mockGraphService.getGraph).toHaveBeenCalledWith(TEST_MODULE_ID);
    });

    it('should handle real-time graph updates efficiently', async () => {
        const { result } = renderHook(
            () => useGraph(TEST_MODULE_ID, TEST_VIEW_LEVEL),
            { wrapper }
        );

        const updatedGraph = {
            ...mockGraph,
            nodes: [...mockGraph.nodes, {
                id: 'node2',
                type: NodeType.RESOURCE,
                data: { label: 'Test Resource 2' },
                position: { x: 100, y: 100 },
                metadata: {
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    status: 'valid'
                }
            }]
        };

        await act(async () => {
            const startTime = performance.now();
            const updateCallback = mockGraphService.subscribeToUpdates.mock.calls[0][1];
            updateCallback(updatedGraph);
            performanceMonitor.measurements.push(performance.now() - startTime);
        });

        expect(result.current.graph?.nodes.length).toBe(2);
        expect(performanceMonitor.measurements[0]).toBeLessThan(100); // Update should be under 100ms
    });

    it('should handle layout changes with animation', async () => {
        const { result } = renderHook(
            () => useGraph(TEST_MODULE_ID, TEST_VIEW_LEVEL),
            { wrapper }
        );

        await act(async () => {
            const startTime = performance.now();
            await result.current.handleLayoutChange(LayoutType.FORCE, TEST_VIEW_LEVEL);
            performanceMonitor.measurements.push(performance.now() - startTime);
        });

        expect(result.current.currentLayout).toBe(LayoutType.FORCE);
        expect(mockGraphService.updateLayout).toHaveBeenCalled();
        expect(performanceMonitor.measurements[0]).toBeLessThan(500); // Layout change should be under 500ms
    });

    it('should handle node selection with accessibility updates', async () => {
        const { result } = renderHook(
            () => useGraph(TEST_MODULE_ID, TEST_VIEW_LEVEL),
            { wrapper }
        );

        const testNode = mockGraph.nodes[0];

        await act(async () => {
            result.current.handleNodeClick(testNode);
        });

        expect(result.current.selectedNodeId).toBe(testNode.id);
        const nodeElement = document.querySelector(`[data-node-id="${testNode.id}"]`);
        expect(nodeElement?.getAttribute('aria-selected')).toBe('true');
    });

    it('should handle node drag operations with debouncing', async () => {
        const { result } = renderHook(
            () => useGraph(TEST_MODULE_ID, TEST_VIEW_LEVEL),
            { wrapper }
        );

        const dragOperations = Array.from({ length: 5 }, (_, i) => ({
            ...mockGraph.nodes[0],
            position: { x: i * 10, y: i * 10 }
        }));

        await act(async () => {
            const startTime = performance.now();
            dragOperations.forEach(node => {
                result.current.handleNodeDragEnd([node]);
            });
            performanceMonitor.measurements.push(performance.now() - startTime);
        });

        // Wait for debounce
        await waitFor(() => {
            expect(result.current.graph?.nodes[0].position).toEqual(
                dragOperations[dragOperations.length - 1].position
            );
        });

        expect(performanceMonitor.measurements[0]).toBeLessThan(200); // Drag operations should be under 200ms
    });

    it('should handle WebSocket reconnection gracefully', async () => {
        const { result } = renderHook(
            () => useGraph(TEST_MODULE_ID, TEST_VIEW_LEVEL),
            { wrapper }
        );

        // Simulate WebSocket disconnection
        await act(async () => {
            const errorCallback = mockGraphService.subscribeToUpdates.mock.calls[0][2];
            errorCallback(new Error('WebSocket disconnected'));
        });

        expect(result.current.error).toBeTruthy();
        expect(mockWebSocketService.subscribe).toHaveBeenCalled();
    });

    it('should maintain performance under load', async () => {
        const { result } = renderHook(
            () => useGraph(TEST_MODULE_ID, TEST_VIEW_LEVEL),
            { wrapper }
        );

        const largeGraph = {
            ...mockGraph,
            nodes: Array.from({ length: 100 }, (_, i) => ({
                ...mockGraph.nodes[0],
                id: `node${i}`,
                position: { x: i * 10, y: i * 10 }
            }))
        };

        await act(async () => {
            const startTime = performance.now();
            const updateCallback = mockGraphService.subscribeToUpdates.mock.calls[0][1];
            updateCallback(largeGraph);
            performanceMonitor.measurements.push(performance.now() - startTime);
        });

        expect(result.current.graph?.nodes.length).toBe(100);
        expect(performanceMonitor.measurements[0]).toBeLessThan(1000); // Large graph update should be under 1s
    });

    it('should cleanup subscriptions on unmount', async () => {
        const unsubscribeSpy = jest.fn();
        mockGraphService.subscribeToUpdates.mockReturnValue(unsubscribeSpy);

        const { unmount } = renderHook(
            () => useGraph(TEST_MODULE_ID, TEST_VIEW_LEVEL),
            { wrapper }
        );

        unmount();

        expect(unsubscribeSpy).toHaveBeenCalled();
    });
});