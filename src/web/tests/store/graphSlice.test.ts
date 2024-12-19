/**
 * @fileoverview Test suite for the Redux Toolkit graph slice
 * Validates graph state management, actions, and selectors with performance benchmarks
 * @version 1.0.0
 */

import { configureStore } from '@reduxjs/toolkit'; // v1.9.0
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import { performance } from 'perf_hooks';

import { reducer, actions, selectors } from '../../src/store/graphSlice';
import { IGraph, LayoutType, NodeType, EdgeType } from '../../src/interfaces/IGraph';

// Helper function to create test store
const createTestStore = () => {
    return configureStore({
        reducer: { graph: reducer }
    });
};

// Helper function to measure performance
const measurePerformance = (callback: () => void): number => {
    const start = performance.now();
    callback();
    return performance.now() - start;
};

// Mock data for testing
const mockPipelineGraph: IGraph = {
    nodes: [
        {
            id: 'dev',
            type: NodeType.ENVIRONMENT,
            data: { label: 'Development' },
            position: { x: 0, y: 0 },
            metadata: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        }
    ],
    edges: [],
    layout: LayoutType.HIERARCHICAL,
    viewport: { x: 0, y: 0, zoom: 1 },
    metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        name: 'Pipeline View',
        nodeCount: 1,
        edgeCount: 0
    }
};

// Large graph for performance testing
const mockLargeGraph: IGraph = {
    nodes: Array.from({ length: 100 }, (_, i) => ({
        id: `node-${i}`,
        type: NodeType.RESOURCE,
        data: { label: `Resource ${i}` },
        position: { x: i * 100, y: i * 100 },
        metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    })),
    edges: Array.from({ length: 150 }, (_, i) => ({
        id: `edge-${i}`,
        source: `node-${i % 100}`,
        target: `node-${(i + 1) % 100}`,
        type: EdgeType.DEPENDENCY,
        metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    })),
    layout: LayoutType.FORCE,
    viewport: { x: 0, y: 0, zoom: 1 },
    metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        name: 'Large Graph',
        nodeCount: 100,
        edgeCount: 150
    }
};

describe('Graph Slice', () => {
    let store: ReturnType<typeof createTestStore>;

    beforeEach(() => {
        store = createTestStore();
    });

    describe('Initial State', () => {
        it('should initialize with null currentGraph', () => {
            expect(selectors.selectGraph(store.getState())).toBeNull();
        });

        it('should initialize with null selectedNodeId', () => {
            expect(selectors.selectSelectedNode(store.getState())).toBeNull();
        });

        it('should initialize with hierarchical layout', () => {
            expect(selectors.selectLayout(store.getState())).toBe(LayoutType.HIERARCHICAL);
        });

        it('should initialize with loading as false', () => {
            expect(selectors.selectIsLoading(store.getState())).toBe(false);
        });

        it('should initialize with null error', () => {
            expect(selectors.selectError(store.getState())).toBeNull();
        });

        it('should initialize with default viewport configuration', () => {
            const viewport = selectors.selectViewPort(store.getState());
            expect(viewport).toEqual({ x: 0, y: 0, zoom: 1 });
        });
    });

    describe('Graph Actions', () => {
        it('should update graph state within 1 second', () => {
            const executionTime = measurePerformance(() => {
                store.dispatch(actions.setGraph(mockPipelineGraph));
            });
            
            expect(executionTime).toBeLessThan(1000);
            expect(selectors.selectGraph(store.getState())).toEqual(mockPipelineGraph);
        });

        it('should handle large graphs efficiently', () => {
            const executionTime = measurePerformance(() => {
                store.dispatch(actions.setGraph(mockLargeGraph));
            });
            
            expect(executionTime).toBeLessThan(1000);
            expect(selectors.selectGraph(store.getState())).toEqual(mockLargeGraph);
        });

        it('should maintain node selection when updating graph', () => {
            store.dispatch(actions.setGraph(mockPipelineGraph));
            store.dispatch(actions.setSelectedNode('dev'));
            store.dispatch(actions.setGraph({ ...mockPipelineGraph }));
            
            expect(selectors.selectSelectedNode(store.getState())).toBe('dev');
        });

        it('should handle layout changes correctly', () => {
            store.dispatch(actions.setGraph(mockPipelineGraph));
            store.dispatch(actions.setLayout(LayoutType.FORCE));
            
            expect(selectors.selectLayout(store.getState())).toBe(LayoutType.FORCE);
            expect(selectors.selectGraph(store.getState())?.layout).toBe(LayoutType.FORCE);
        });

        it('should update node positions efficiently', () => {
            store.dispatch(actions.setGraph(mockPipelineGraph));
            
            const executionTime = measurePerformance(() => {
                store.dispatch(actions.updateNodePosition({ 
                    id: 'dev',
                    position: { x: 100, y: 100 }
                }));
            });
            
            expect(executionTime).toBeLessThan(100);
            expect(selectors.selectGraph(store.getState())?.nodes[0].position)
                .toEqual({ x: 100, y: 100 });
        });
    });

    describe('View Management', () => {
        it('should handle viewport position updates', () => {
            const newViewport = { x: 100, y: 100, zoom: 1.5 };
            store.dispatch(actions.setViewPort(newViewport));
            
            expect(selectors.selectViewPort(store.getState())).toEqual(newViewport);
        });

        it('should persist view state during graph updates', () => {
            const viewport = { x: 100, y: 100, zoom: 1.5 };
            store.dispatch(actions.setViewPort(viewport));
            store.dispatch(actions.setGraph(mockPipelineGraph));
            
            expect(selectors.selectViewPort(store.getState())).toEqual(viewport);
        });
    });

    describe('Error Handling', () => {
        it('should set error state correctly', () => {
            const errorMessage = 'Invalid graph structure';
            store.dispatch(actions.setError(errorMessage));
            
            expect(selectors.selectError(store.getState())).toBe(errorMessage);
            expect(selectors.selectIsLoading(store.getState())).toBe(false);
        });

        it('should clear error state when resolved', () => {
            store.dispatch(actions.setError('Error'));
            store.dispatch(actions.setGraph(mockPipelineGraph));
            
            expect(selectors.selectError(store.getState())).toBeNull();
        });

        it('should maintain graph state during errors', () => {
            store.dispatch(actions.setGraph(mockPipelineGraph));
            store.dispatch(actions.setError('Error'));
            
            expect(selectors.selectGraph(store.getState())).toEqual(mockPipelineGraph);
        });

        it('should reject invalid graph structures', () => {
            const invalidGraph = { ...mockPipelineGraph, nodes: null };
            store.dispatch(actions.setGraph(invalidGraph as any));
            
            expect(selectors.selectError(store.getState())).toBe('Invalid graph structure');
            expect(selectors.selectGraph(store.getState())).toBeNull();
        });
    });
});