/**
 * @fileoverview Test suite for graph helper utility functions
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'; // v29.x
import { Position, NodeProps, EdgeProps, Viewport } from 'reactflow'; // v11.x
import {
    calculateNodePosition,
    optimizeEdgeRouting,
    calculateGraphBounds,
    centerGraph
} from '../../src/utils/graphHelpers';
import {
    IGraph,
    INode,
    IEdge,
    LayoutType,
    NodeType,
    EdgeType,
    ViewportConfig
} from '../../src/interfaces/IGraph';

// Mock external modules
jest.mock('dagre', () => ({
    graphlib: {
        Graph: jest.fn().mockImplementation(() => ({
            setGraph: jest.fn(),
            setNode: jest.fn(),
            setEdge: jest.fn(),
            node: jest.fn().mockReturnValue({ x: 100, y: 100 })
        }))
    },
    layout: jest.fn()
}));

// Test data setup
const mockViewport: ViewportConfig = {
    x: 0,
    y: 0,
    zoom: 1
};

const mockNodes: INode[] = [
    {
        id: 'node1',
        type: NodeType.RESOURCE,
        position: { x: 0, y: 0 },
        data: { label: 'Resource 1' },
        metadata: {
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01',
            status: 'valid'
        }
    },
    {
        id: 'node2',
        type: NodeType.MODULE,
        position: { x: 100, y: 100 },
        data: { label: 'Module 1' },
        metadata: {
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01',
            status: 'valid'
        }
    }
];

const mockEdges: IEdge[] = [
    {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: EdgeType.DEPENDENCY,
        metadata: {
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01'
        }
    }
];

describe('calculateNodePosition', () => {
    it('should return default position for empty edges array', () => {
        const node = mockNodes[0];
        const position = calculateNodePosition(
            node,
            [],
            LayoutType.HIERARCHICAL,
            { width: 800, height: 600, zoom: 1 }
        );
        
        expect(position).toEqual({ x: 0, y: 0 });
    });

    it('should calculate hierarchical layout position correctly', () => {
        const node = mockNodes[0];
        const position = calculateNodePosition(
            node,
            mockEdges,
            LayoutType.HIERARCHICAL,
            { width: 800, height: 600, zoom: 1 }
        );
        
        expect(position.x).toBeDefined();
        expect(position.y).toBeDefined();
        expect(typeof position.x).toBe('number');
        expect(typeof position.y).toBe('number');
    });

    it('should handle force-directed layout calculations', () => {
        const node = mockNodes[0];
        const position = calculateNodePosition(
            node,
            mockEdges,
            LayoutType.FORCE,
            { width: 800, height: 600, zoom: 1 }
        );
        
        expect(position.x).toBeDefined();
        expect(position.y).toBeDefined();
    });

    it('should calculate dagre layout position correctly', () => {
        const node = mockNodes[0];
        const position = calculateNodePosition(
            node,
            mockEdges,
            LayoutType.DAGRE,
            { width: 800, height: 600, zoom: 1 }
        );
        
        expect(position).toEqual({ x: 100, y: 100 }); // From mocked dagre
    });
});

describe('optimizeEdgeRouting', () => {
    it('should return empty array for no edges', () => {
        const result = optimizeEdgeRouting([], mockNodes, LayoutType.HIERARCHICAL);
        expect(result).toEqual([]);
    });

    it('should optimize single edge routing', () => {
        const result = optimizeEdgeRouting(mockEdges, mockNodes, LayoutType.HIERARCHICAL);
        
        expect(result.length).toBe(1);
        expect(result[0].style).toBeDefined();
        expect(result[0].controlPoints).toBeDefined();
    });

    it('should handle parallel edge bundling', () => {
        const parallelEdges: IEdge[] = [
            ...mockEdges,
            {
                id: 'edge2',
                source: 'node1',
                target: 'node2',
                type: EdgeType.REFERENCE,
                metadata: {
                    createdAt: '2023-01-01',
                    updatedAt: '2023-01-01'
                }
            }
        ];

        const result = optimizeEdgeRouting(parallelEdges, mockNodes, LayoutType.HIERARCHICAL);
        
        expect(result.length).toBe(2);
        expect(result[0].bundleOffset).toBeDefined();
        expect(result[1].bundleOffset).toBeDefined();
    });

    it('should apply correct edge styles based on type', () => {
        const result = optimizeEdgeRouting(mockEdges, mockNodes, LayoutType.HIERARCHICAL);
        
        expect(result[0].style).toMatchObject({
            strokeWidth: expect.any(Number),
            opacity: expect.any(Number)
        });
    });
});

describe('calculateGraphBounds', () => {
    it('should return viewport dimensions for empty nodes array', () => {
        const bounds = calculateGraphBounds(
            [],
            { width: 800, height: 600 },
            1
        );
        
        expect(bounds).toEqual({
            x: 0,
            y: 0,
            width: 800,
            height: 600,
            padding: 0
        });
    });

    it('should calculate correct bounds for multiple nodes', () => {
        const bounds = calculateGraphBounds(
            mockNodes,
            { width: 800, height: 600 },
            1
        );
        
        expect(bounds.x).toBeLessThanOrEqual(mockNodes[0].position.x);
        expect(bounds.y).toBeLessThanOrEqual(mockNodes[0].position.y);
        expect(bounds.width).toBeGreaterThan(0);
        expect(bounds.height).toBeGreaterThan(0);
    });

    it('should apply correct padding based on zoom level', () => {
        const bounds1 = calculateGraphBounds(mockNodes, { width: 800, height: 600 }, 1);
        const bounds2 = calculateGraphBounds(mockNodes, { width: 800, height: 600 }, 2);
        
        expect(bounds1.padding).toBeGreaterThan(bounds2.padding);
    });
});

describe('centerGraph', () => {
    const mockGraph: IGraph = {
        nodes: mockNodes,
        edges: mockEdges,
        layout: LayoutType.HIERARCHICAL,
        viewport: mockViewport,
        metadata: {
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01',
            version: '1.0.0',
            name: 'Test Graph',
            nodeCount: 2,
            edgeCount: 1
        }
    };

    it('should center empty graph correctly', () => {
        const emptyGraph = { ...mockGraph, nodes: [] };
        const result = centerGraph(
            emptyGraph,
            { width: 800, height: 600, zoom: 1 },
            { duration: 300, easing: 'easeInOut' }
        );
        
        expect(result).toEqual(emptyGraph);
    });

    it('should apply correct translation to nodes', () => {
        const result = centerGraph(
            mockGraph,
            { width: 800, height: 600, zoom: 1 },
            { duration: 300, easing: 'easeInOut' }
        );
        
        expect(result.nodes[0].position).toBeDefined();
        expect(result.nodes[0].animated).toBe(true);
        expect(result.nodes[0].animationConfig).toBeDefined();
    });

    it('should preserve graph structure while centering', () => {
        const result = centerGraph(
            mockGraph,
            { width: 800, height: 600, zoom: 1 },
            { duration: 300, easing: 'easeInOut' }
        );
        
        expect(result.edges).toEqual(mockGraph.edges);
        expect(result.layout).toEqual(mockGraph.layout);
        expect(result.metadata).toEqual(mockGraph.metadata);
    });

    it('should handle different viewport dimensions', () => {
        const result = centerGraph(
            mockGraph,
            { width: 1200, height: 800, zoom: 1 },
            { duration: 300, easing: 'easeInOut' }
        );
        
        expect(result.nodes.length).toBe(mockGraph.nodes.length);
        expect(result.nodes[0].position).toBeDefined();
    });
});