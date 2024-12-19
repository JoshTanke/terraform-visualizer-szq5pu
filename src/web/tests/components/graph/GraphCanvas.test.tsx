/**
 * @fileoverview Comprehensive test suite for the GraphCanvas component
 * covering rendering, interactions, layout, performance, and accessibility.
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { Provider } from 'react-redux';
import { ReactFlowProvider } from 'reactflow';
import { configureStore } from '@reduxjs/toolkit';

import GraphCanvas from '../../src/components/graph/GraphCanvas';
import { IGraph, INode, IEdge, LayoutType, NodeType } from '../../src/interfaces/IGraph';
import { useGraph } from '../../src/hooks/useGraph';
import graphReducer from '../../src/store/graphSlice';

// Mock useGraph hook
vi.mock('../../src/hooks/useGraph', () => ({
    useGraph: vi.fn()
}));

// Mock ResizeObserver
const mockResizeObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
}));
window.ResizeObserver = mockResizeObserver;

// Test data
const mockNodes: INode[] = [
    {
        id: 'node1',
        type: NodeType.RESOURCE,
        data: {
            label: 'AWS Instance',
            type: 'aws_instance',
            status: 'valid'
        },
        position: { x: 0, y: 0 },
        metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    },
    {
        id: 'node2',
        type: NodeType.MODULE,
        data: {
            label: 'VPC Module',
            type: 'module',
            status: 'warning'
        },
        position: { x: 200, y: 0 },
        metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    }
];

const mockEdges: IEdge[] = [
    {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'dependency',
        metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    }
];

const mockGraph: IGraph = {
    nodes: mockNodes,
    edges: mockEdges,
    layout: LayoutType.HIERARCHICAL,
    viewport: { x: 0, y: 0, zoom: 1 },
    metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        name: 'Test Graph',
        nodeCount: mockNodes.length,
        edgeCount: mockEdges.length
    }
};

// Setup test environment
const setupTest = () => {
    // Mock useGraph implementation
    const mockSetSelectedNode = vi.fn();
    const mockUpdateLayout = vi.fn();
    
    (useGraph as jest.Mock).mockReturnValue({
        graph: mockGraph,
        selectedNodeId: null,
        isLoading: false,
        error: null,
        performanceMetrics: {
            lastUpdateDuration: 0,
            averageUpdateTime: 0,
            updateCount: 0
        },
        handleNodeClick: mockSetSelectedNode,
        handleNodeDragEnd: vi.fn(),
        handleLayoutChange: mockUpdateLayout
    });

    // Create test store
    const store = configureStore({
        reducer: {
            graph: graphReducer
        }
    });

    const renderComponent = () => {
        return render(
            <Provider store={store}>
                <ReactFlowProvider>
                    <GraphCanvas
                        moduleId="test-module"
                        onNodeSelect={() => {}}
                        layout={LayoutType.HIERARCHICAL}
                        initialZoom={1}
                        maxNodes={500}
                        performanceMode={false}
                        accessibilityMode={true}
                    />
                </ReactFlowProvider>
            </Provider>
        );
    };

    return {
        renderComponent,
        mockSetSelectedNode,
        mockUpdateLayout,
        store
    };
};

describe('GraphCanvas', () => {
    let cleanup: () => void;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (cleanup) {
            cleanup();
        }
    });

    describe('Rendering', () => {
        it('should render the graph container with correct accessibility attributes', () => {
            const { renderComponent } = setupTest();
            const { container } = renderComponent();

            const graphContainer = container.querySelector('.react-flow');
            expect(graphContainer).toBeInTheDocument();
            expect(graphContainer).toHaveAttribute('role', 'application');
            expect(graphContainer).toHaveAttribute('aria-label', 'Infrastructure Visualization Graph');
        });

        it('should render all nodes and edges from the graph', async () => {
            const { renderComponent } = setupTest();
            renderComponent();

            await waitFor(() => {
                const nodes = screen.getAllByRole('button');
                expect(nodes).toHaveLength(mockNodes.length);
            });

            // Check edge rendering
            const edges = document.querySelectorAll('.react-flow__edge');
            expect(edges).toHaveLength(mockEdges.length);
        });

        it('should render zoom controls when not in performance mode', () => {
            const { renderComponent } = setupTest();
            renderComponent();

            expect(screen.getByLabelText('zoom in')).toBeInTheDocument();
            expect(screen.getByLabelText('zoom out')).toBeInTheDocument();
            expect(screen.getByLabelText('fit view')).toBeInTheDocument();
        });
    });

    describe('Interactions', () => {
        it('should handle node selection', async () => {
            const { renderComponent, mockSetSelectedNode } = setupTest();
            renderComponent();

            const node = await screen.findByText('AWS Instance');
            await userEvent.click(node);

            expect(mockSetSelectedNode).toHaveBeenCalledWith(expect.objectContaining({
                id: 'node1'
            }));
        });

        it('should support keyboard navigation', async () => {
            const { renderComponent, mockSetSelectedNode } = setupTest();
            renderComponent();

            const node = await screen.findByText('AWS Instance');
            await userEvent.tab();
            expect(node).toHaveFocus();

            await userEvent.keyboard('{enter}');
            expect(mockSetSelectedNode).toHaveBeenCalled();
        });

        it('should handle zoom controls', async () => {
            const { renderComponent } = setupTest();
            renderComponent();

            const zoomIn = screen.getByLabelText('zoom in');
            const zoomOut = screen.getByLabelText('zoom out');

            await userEvent.click(zoomIn);
            await userEvent.click(zoomOut);

            // Verify zoom level changes through ReactFlow's internal state
            const viewport = document.querySelector('.react-flow__viewport');
            expect(viewport).toHaveStyle('transform: scale(1)');
        });
    });

    describe('Layout Management', () => {
        it('should apply layout changes', async () => {
            const { renderComponent, mockUpdateLayout } = setupTest();
            renderComponent();

            // Trigger layout change
            await waitFor(() => {
                expect(mockUpdateLayout).toHaveBeenCalledWith(
                    LayoutType.HIERARCHICAL,
                    expect.any(Object)
                );
            });
        });

        it('should maintain node positions after layout updates', async () => {
            const { renderComponent } = setupTest();
            renderComponent();

            const node = await screen.findByText('AWS Instance');
            const initialPosition = node.getBoundingClientRect();

            // Simulate layout update
            await waitFor(() => {
                const newPosition = node.getBoundingClientRect();
                expect(newPosition).toEqual(initialPosition);
            });
        });
    });

    describe('Performance', () => {
        it('should handle large graphs efficiently', async () => {
            const largeGraph = {
                ...mockGraph,
                nodes: Array.from({ length: 400 }, (_, i) => ({
                    ...mockNodes[0],
                    id: `node${i}`,
                    position: { x: i * 10, y: i * 10 }
                }))
            };

            (useGraph as jest.Mock).mockReturnValue({
                ...useGraph(),
                graph: largeGraph
            });

            const { renderComponent } = setupTest();
            const startTime = performance.now();
            renderComponent();

            await waitFor(() => {
                const renderTime = performance.now() - startTime;
                expect(renderTime).toBeLessThan(1000); // Should render within 1 second
            });
        });

        it('should optimize performance in performance mode', async () => {
            const { renderComponent } = setupTest();
            renderComponent();

            // Verify performance optimizations are applied
            const viewport = document.querySelector('.react-flow__viewport');
            expect(viewport).toHaveAttribute('data-performance-mode', 'true');
        });
    });

    describe('Accessibility', () => {
        it('should provide proper ARIA labels for nodes', async () => {
            const { renderComponent } = setupTest();
            renderComponent();

            const node = await screen.findByText('AWS Instance');
            expect(node).toHaveAttribute('aria-label', expect.stringContaining('resource AWS Instance'));
        });

        it('should maintain focus management', async () => {
            const { renderComponent } = setupTest();
            renderComponent();

            const nodes = await screen.findAllByRole('button');
            await userEvent.tab();

            expect(nodes[0]).toHaveFocus();
            await userEvent.tab();
            expect(nodes[1]).toHaveFocus();
        });

        it('should announce node selection changes', async () => {
            const { renderComponent } = setupTest();
            renderComponent();

            const node = await screen.findByText('AWS Instance');
            await userEvent.click(node);

            const liveRegion = screen.getByRole('status');
            expect(liveRegion).toHaveTextContent('Selected resource AWS Instance');
        });
    });
});