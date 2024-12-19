/**
 * @fileoverview Enhanced React component for rendering the infrastructure visualization graph
 * with optimized performance, accessibility features, and advanced layout management.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    Panel,
    useReactFlow,
    ReactFlowInstance
} from 'reactflow'; // v11.x
import { Box } from '@mui/material'; // v5.x
import { debounce } from 'lodash'; // v4.x

import { IGraph, INode, IEdge, LayoutType } from '../../interfaces/IGraph';
import { useGraph } from '../../hooks/useGraph';
import NodeComponent from './NodeComponent';

/**
 * Props interface for the GraphCanvas component
 */
interface GraphCanvasProps {
    moduleId?: string;
    onNodeSelect: (node: INode | null) => void;
    layout: LayoutType;
    initialZoom?: number;
    maxNodes?: number;
    performanceMode?: boolean;
    accessibilityMode?: boolean;
}

/**
 * Enhanced node types configuration with custom styling and behavior
 */
const nodeTypes = {
    default: NodeComponent
};

/**
 * Enhanced edge types configuration with custom styling
 */
const edgeTypes = {
    default: {
        style: {
            stroke: '#b1b1b7',
            strokeWidth: 2,
            transition: 'stroke-width 0.2s ease'
        },
        selectedStyle: {
            stroke: '#1976d2',
            strokeWidth: 3
        }
    }
};

/**
 * GraphCanvas - Core component for rendering the infrastructure visualization graph
 * with enhanced performance optimizations and accessibility features.
 */
const GraphCanvas: React.FC<GraphCanvasProps> = ({
    moduleId = '',
    onNodeSelect,
    layout,
    initialZoom = 1,
    maxNodes = 500,
    performanceMode = false,
    accessibilityMode = true
}) => {
    // Initialize React Flow instance
    const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
    const { fitView, zoomTo } = useReactFlow();

    // Initialize graph management hook
    const {
        graph,
        selectedNodeId,
        isLoading,
        error,
        performanceMetrics,
        handleNodeClick,
        handleNodeDragEnd,
        handleLayoutChange
    } = useGraph(moduleId, layout);

    /**
     * Memoized graph elements with performance optimization
     */
    const graphElements = useMemo(() => {
        if (!graph) return { nodes: [], edges: [] };

        return {
            nodes: graph.nodes.map(node => ({
                ...node,
                type: 'default',
                draggable: !performanceMode,
                selectable: true,
                data: {
                    ...node.data,
                    label: node.data.name || node.id,
                    selected: node.id === selectedNodeId
                }
            })),
            edges: graph.edges.map(edge => ({
                ...edge,
                type: 'default',
                animated: edge.metadata?.animated || false,
                style: edge.id === selectedNodeId ? edgeTypes.default.selectedStyle : edgeTypes.default.style
            }))
        };
    }, [graph, selectedNodeId, performanceMode]);

    /**
     * Debounced layout update handler
     */
    const debouncedLayoutUpdate = useCallback(
        debounce((newLayout: LayoutType) => {
            handleLayoutChange(newLayout, layout);
        }, 250),
        [handleLayoutChange, layout]
    );

    /**
     * Enhanced node click handler with accessibility support
     */
    const onNodeClick = useCallback((event: React.MouseEvent, node: INode) => {
        event.preventDefault();
        handleNodeClick(node);
        onNodeSelect(node);

        // Update ARIA live region
        const liveRegion = document.getElementById('graph-live-region');
        if (liveRegion) {
            liveRegion.textContent = `Selected ${node.type.toLowerCase()} ${node.data.label || node.id}`;
        }
    }, [handleNodeClick, onNodeSelect]);

    /**
     * Initialize graph view and accessibility features
     */
    useEffect(() => {
        if (graph && reactFlowInstance.current) {
            // Set initial zoom and center
            zoomTo(initialZoom, { duration: 300 });
            fitView({ duration: 300, padding: 0.2 });

            // Initialize accessibility features
            if (accessibilityMode) {
                const container = reactFlowInstance.current.getContainer();
                container.setAttribute('role', 'application');
                container.setAttribute('aria-label', 'Infrastructure Visualization Graph');
            }
        }
    }, [graph, initialZoom, zoomTo, fitView, accessibilityMode]);

    /**
     * Performance monitoring effect
     */
    useEffect(() => {
        if (performanceMode && graphElements.nodes.length > maxNodes) {
            console.warn(`Large graph detected: ${graphElements.nodes.length} nodes. Performance mode enabled.`);
        }
    }, [graphElements.nodes.length, maxNodes, performanceMode]);

    return (
        <Box
            sx={{
                width: '100%',
                height: '100%',
                backgroundColor: 'background.default',
                position: 'relative'
            }}
        >
            {/* ARIA live region for accessibility */}
            <div
                id="graph-live-region"
                role="status"
                aria-live="polite"
                className="sr-only"
            />

            <ReactFlow
                nodes={graphElements.nodes}
                edges={graphElements.edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodeClick={onNodeClick}
                onNodeDragEnd={handleNodeDragEnd}
                onInit={(instance) => {
                    reactFlowInstance.current = instance;
                }}
                fitView
                attributionPosition="bottom-right"
                minZoom={0.1}
                maxZoom={3}
                defaultViewport={{ x: 0, y: 0, zoom: initialZoom }}
                nodesDraggable={!performanceMode}
                nodesConnectable={false}
                snapToGrid={true}
                snapGrid={[15, 15]}
                elevateNodesOnSelect={true}
                selectNodesOnDrag={false}
                panOnDrag={!performanceMode}
                zoomOnScroll={!performanceMode}
                panOnScroll={false}
                preventScrolling={true}
                proOptions={{ hideAttribution: true }}
            >
                {/* Background pattern */}
                <Background
                    variant="dots"
                    gap={12}
                    size={1}
                    color="#f0f0f0"
                />

                {/* Controls panel */}
                <Controls
                    showZoom={true}
                    showFitView={true}
                    showInteractive={!performanceMode}
                    position="bottom-right"
                />

                {/* Minimap for navigation */}
                <MiniMap
                    nodeColor={(node) => {
                        return node.data?.status === 'error' ? '#ef5350' :
                               node.data?.status === 'warning' ? '#ff9800' :
                               '#4caf50';
                    }}
                    maskColor="rgba(0, 0, 0, 0.1)"
                    style={{
                        backgroundColor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: '4px'
                    }}
                />

                {/* Performance metrics panel */}
                {performanceMode && (
                    <Panel position="top-left">
                        <Box
                            sx={{
                                padding: 1,
                                backgroundColor: 'background.paper',
                                borderRadius: 1,
                                boxShadow: 1
                            }}
                        >
                            <div>Nodes: {graphElements.nodes.length}</div>
                            <div>Update time: {performanceMetrics.lastUpdateDuration.toFixed(2)}ms</div>
                        </Box>
                    </Panel>
                )}
            </ReactFlow>

            {/* Loading and error states */}
            {isLoading && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'background.paper',
                        padding: 2,
                        borderRadius: 1,
                        boxShadow: 1
                    }}
                >
                    Loading graph...
                </Box>
            )}

            {error && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'error.light',
                        color: 'error.contrastText',
                        padding: 2,
                        borderRadius: 1,
                        boxShadow: 1
                    }}
                >
                    Error: {error}
                </Box>
            )}
        </Box>
    );
};

export default React.memo(GraphCanvas);