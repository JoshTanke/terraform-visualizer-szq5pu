/**
 * @fileoverview Redux Toolkit slice for managing graph visualization state
 * Implements high-performance state management for real-time graph updates
 * with comprehensive type safety and error handling.
 * @version 1.0.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // v1.9.0
import { 
    IGraph, 
    INode, 
    IEdge, 
    LayoutType, 
    isIGraph, 
    isINode, 
    isIEdge,
    ViewportConfig 
} from '../interfaces/IGraph';

/**
 * Interface defining the graph visualization state structure
 */
export interface GraphState {
    currentGraph: IGraph | null;
    selectedNodeId: string | null;
    currentLayout: LayoutType;
    isLoading: boolean;
    error: string | null;
    zoomLevel: number;
    viewPort: ViewportConfig;
    lastUpdateTimestamp: number;
}

/**
 * Initial state configuration with performance-optimized defaults
 */
const initialState: GraphState = {
    currentGraph: null,
    selectedNodeId: null,
    currentLayout: LayoutType.HIERARCHICAL,
    isLoading: false,
    error: null,
    zoomLevel: 1,
    viewPort: {
        x: 0,
        y: 0,
        zoom: 1
    },
    lastUpdateTimestamp: Date.now()
};

/**
 * Redux Toolkit slice for graph state management
 */
export const graphSlice = createSlice({
    name: 'graph',
    initialState,
    reducers: {
        /**
         * Updates the current graph with validation
         */
        setGraph: (state, action: PayloadAction<IGraph>) => {
            if (!isIGraph(action.payload)) {
                state.error = 'Invalid graph structure';
                return;
            }
            state.currentGraph = action.payload;
            state.isLoading = false;
            state.error = null;
            state.lastUpdateTimestamp = Date.now();
        },

        /**
         * Sets loading state during async operations
         */
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
            state.error = null;
        },

        /**
         * Updates node position with optimized state updates
         */
        updateNodePosition: (state, action: PayloadAction<{ 
            id: string; 
            position: { x: number; y: number } 
        }>) => {
            if (!state.currentGraph) return;
            
            const nodeIndex = state.currentGraph.nodes.findIndex(
                node => node.id === action.payload.id
            );

            if (nodeIndex === -1) return;

            state.currentGraph.nodes[nodeIndex].position = action.payload.position;
            state.lastUpdateTimestamp = Date.now();
        },

        /**
         * Updates the selected node with validation
         */
        setSelectedNode: (state, action: PayloadAction<string | null>) => {
            if (action.payload && state.currentGraph) {
                const nodeExists = state.currentGraph.nodes.some(
                    node => node.id === action.payload
                );
                if (!nodeExists) return;
            }
            state.selectedNodeId = action.payload;
        },

        /**
         * Updates layout type with validation
         */
        setLayout: (state, action: PayloadAction<LayoutType>) => {
            if (!Object.values(LayoutType).includes(action.payload)) {
                state.error = 'Invalid layout type';
                return;
            }
            state.currentLayout = action.payload;
            if (state.currentGraph) {
                state.currentGraph.layout = action.payload;
            }
        },

        /**
         * Updates viewport configuration
         */
        setViewPort: (state, action: PayloadAction<ViewportConfig>) => {
            state.viewPort = action.payload;
            state.zoomLevel = action.payload.zoom;
        },

        /**
         * Adds a new node with validation
         */
        addNode: (state, action: PayloadAction<INode>) => {
            if (!state.currentGraph || !isINode(action.payload)) {
                state.error = 'Invalid node data';
                return;
            }
            state.currentGraph.nodes.push(action.payload);
            state.currentGraph.metadata.nodeCount++;
            state.lastUpdateTimestamp = Date.now();
        },

        /**
         * Adds a new edge with validation
         */
        addEdge: (state, action: PayloadAction<IEdge>) => {
            if (!state.currentGraph || !isIEdge(action.payload)) {
                state.error = 'Invalid edge data';
                return;
            }
            state.currentGraph.edges.push(action.payload);
            state.currentGraph.metadata.edgeCount++;
            state.lastUpdateTimestamp = Date.now();
        },

        /**
         * Removes a node and its connected edges
         */
        removeNode: (state, action: PayloadAction<string>) => {
            if (!state.currentGraph) return;

            const nodeIndex = state.currentGraph.nodes.findIndex(
                node => node.id === action.payload
            );
            if (nodeIndex === -1) return;

            // Remove connected edges
            state.currentGraph.edges = state.currentGraph.edges.filter(
                edge => edge.source !== action.payload && edge.target !== action.payload
            );

            // Remove node
            state.currentGraph.nodes.splice(nodeIndex, 1);
            state.currentGraph.metadata.nodeCount--;
            state.currentGraph.metadata.edgeCount = state.currentGraph.edges.length;
            
            if (state.selectedNodeId === action.payload) {
                state.selectedNodeId = null;
            }
            
            state.lastUpdateTimestamp = Date.now();
        },

        /**
         * Sets error state
         */
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.isLoading = false;
        }
    }
});

// Export actions
export const { 
    setGraph,
    setLoading,
    updateNodePosition,
    setSelectedNode,
    setLayout,
    setViewPort,
    addNode,
    addEdge,
    removeNode,
    setError
} = graphSlice.actions;

// Memoized selectors for optimized state access
export const selectGraph = (state: { graph: GraphState }) => state.graph.currentGraph;
export const selectSelectedNode = (state: { graph: GraphState }) => state.graph.selectedNodeId;
export const selectLayout = (state: { graph: GraphState }) => state.graph.currentLayout;
export const selectViewPort = (state: { graph: GraphState }) => state.graph.viewPort;
export const selectIsLoading = (state: { graph: GraphState }) => state.graph.isLoading;
export const selectError = (state: { graph: GraphState }) => state.graph.error;

export default graphSlice.reducer;