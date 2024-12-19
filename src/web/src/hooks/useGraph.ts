/**
 * @fileoverview Enhanced custom React hook for managing graph visualization state and operations
 * with optimized performance, error handling, and real-time updates.
 * @version 1.0.0
 */

import { useCallback, useEffect, useState, useMemo } from 'react'; // v18.x
import { useDispatch, useSelector } from 'react-redux'; // v8.x
import { useReactFlow } from 'reactflow'; // v11.x
import { debounce } from 'lodash'; // v4.x

import { 
    IGraph, 
    LayoutType, 
    INode, 
    IEdge, 
    ViewLevel,
    isIGraph,
    isINode 
} from '../interfaces/IGraph';
import GraphService from '../services/graph.service';
import { 
    setGraph, 
    setSelectedNode, 
    setLayout, 
    updateNodePosition,
    setError,
    setLoading,
    selectGraph,
    selectSelectedNode,
    selectLayout,
    selectIsLoading,
    selectError
} from '../store/graphSlice';

/**
 * Performance metrics interface for monitoring graph operations
 */
interface IPerformanceMetrics {
    lastUpdateDuration: number;
    averageUpdateTime: number;
    updateCount: number;
}

/**
 * Enhanced custom hook for managing graph visualization state and operations
 * @param moduleId - Current module identifier
 * @param viewLevel - Current view level in the visualization hierarchy
 * @returns Object containing graph state and management functions
 */
export const useGraph = (moduleId: string, viewLevel: ViewLevel) => {
    // Initialize React Flow instance
    const { fitView, zoomTo, getNodes, getEdges } = useReactFlow();

    // Redux state management
    const dispatch = useDispatch();
    const graph = useSelector(selectGraph);
    const selectedNodeId = useSelector(selectSelectedNode);
    const currentLayout = useSelector(selectLayout);
    const isLoading = useSelector(selectIsLoading);
    const error = useSelector(selectError);

    // Local state
    const [graphService] = useState(() => new GraphService());
    const [performanceMetrics, setPerformanceMetrics] = useState<IPerformanceMetrics>({
        lastUpdateDuration: 0,
        averageUpdateTime: 0,
        updateCount: 0
    });

    /**
     * Memoized graph update handler with performance tracking
     */
    const handleGraphUpdate = useCallback((updatedGraph: IGraph) => {
        const startTime = performance.now();

        try {
            if (!isIGraph(updatedGraph)) {
                throw new Error('Invalid graph data received');
            }

            dispatch(setGraph(updatedGraph));
            
            // Update performance metrics
            const duration = performance.now() - startTime;
            setPerformanceMetrics(prev => ({
                lastUpdateDuration: duration,
                averageUpdateTime: (prev.averageUpdateTime * prev.updateCount + duration) / (prev.updateCount + 1),
                updateCount: prev.updateCount + 1
            }));

            // Optimize view after update
            requestAnimationFrame(() => {
                fitView({ duration: 200, padding: 0.2 });
            });
        } catch (error) {
            dispatch(setError((error as Error).message));
        }
    }, [dispatch, fitView]);

    /**
     * Debounced node position update handler
     */
    const debouncedUpdateNodePosition = useMemo(
        () => debounce((nodeId: string, position: { x: number; y: number }) => {
            dispatch(updateNodePosition({ id: nodeId, position }));
        }, 50, { maxWait: 100 }),
        [dispatch]
    );

    /**
     * Enhanced node click handler with accessibility support
     */
    const handleNodeClick = useCallback((node: INode) => {
        if (!isINode(node)) {
            console.error('Invalid node data in click handler');
            return;
        }

        dispatch(setSelectedNode(node.id));

        // Update ARIA attributes for accessibility
        const element = document.querySelector(`[data-node-id="${node.id}"]`);
        if (element) {
            element.setAttribute('aria-selected', 'true');
        }
    }, [dispatch]);

    /**
     * Optimized node drag end handler with batch updates
     */
    const handleNodeDragEnd = useCallback((nodes: INode[]) => {
        const validNodes = nodes.filter(isINode);
        
        if (validNodes.length !== nodes.length) {
            console.warn('Some nodes have invalid data structure');
        }

        validNodes.forEach(node => {
            debouncedUpdateNodePosition(node.id, node.position);
        });
    }, [debouncedUpdateNodePosition]);

    /**
     * Enhanced layout change handler with transition animations
     */
    const handleLayoutChange = useCallback(async (
        layoutType: LayoutType,
        viewLevel: ViewLevel
    ) => {
        try {
            dispatch(setLoading(true));
            dispatch(setLayout(layoutType));

            if (!graph) return;

            // Apply new layout with animation
            const updatedGraph = await graphService.updateLayout(graph, layoutType);
            handleGraphUpdate(updatedGraph);

            // Smooth zoom transition
            zoomTo(1, { duration: 300 });
        } catch (error) {
            dispatch(setError((error as Error).message));
        } finally {
            dispatch(setLoading(false));
        }
    }, [dispatch, graph, graphService, handleGraphUpdate, zoomTo]);

    /**
     * Initialize graph data and subscribe to updates
     */
    useEffect(() => {
        let isSubscribed = true;

        const initializeGraph = async () => {
            try {
                dispatch(setLoading(true));
                const initialGraph = await graphService.getGraph(moduleId);
                
                if (isSubscribed) {
                    handleGraphUpdate(initialGraph);
                }
            } catch (error) {
                if (isSubscribed) {
                    dispatch(setError((error as Error).message));
                }
            } finally {
                if (isSubscribed) {
                    dispatch(setLoading(false));
                }
            }
        };

        initializeGraph();

        // Subscribe to real-time updates
        const unsubscribe = graphService.subscribeToUpdates(
            moduleId,
            (updatedGraph) => {
                if (isSubscribed) {
                    handleGraphUpdate(updatedGraph);
                }
            },
            (error) => {
                if (isSubscribed) {
                    dispatch(setError(error.message));
                }
            }
        );

        return () => {
            isSubscribed = false;
            unsubscribe();
        };
    }, [moduleId, dispatch, graphService, handleGraphUpdate]);

    return {
        // Graph state
        graph,
        selectedNodeId,
        currentLayout,
        isLoading,
        error,
        performanceMetrics,

        // Event handlers
        handleNodeClick,
        handleNodeDragEnd,
        handleLayoutChange,

        // Utility functions
        getNodes,
        getEdges,
        fitView,
        zoomTo
    };
};

export default useGraph;