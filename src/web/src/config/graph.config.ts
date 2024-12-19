/**
 * @fileoverview Comprehensive configuration settings for the graph visualization system.
 * Implements performance-optimized defaults for layout algorithms, styling, and interactions.
 * Compliant with WCAG 2.1 Level AA accessibility standards.
 * @version 1.0.0
 */

import { ReactFlowProps } from 'reactflow'; // v11.x
import { LayoutType } from '../interfaces/IGraph';

/**
 * Type-safe configuration for zoom behavior
 */
interface ZoomConfig {
    minZoom: number;
    maxZoom: number;
    defaultZoom: number;
    zoomOnScroll: boolean;
    zoomOnPinch: boolean;
    panOnScroll: boolean;
    panOnDrag: boolean;
    preventScrolling: boolean;
    wheelSensitivity: number;
}

/**
 * Type-safe configuration for layout algorithms
 */
interface LayoutConfigs {
    [LayoutType.HIERARCHICAL]: Record<string, any>;
    [LayoutType.FORCE]: Record<string, any>;
    [LayoutType.DAGRE]: Record<string, any>;
}

/**
 * Comprehensive graph configuration with performance-optimized defaults
 */
export const GRAPH_CONFIG = {
    // Default layout algorithm
    defaultLayout: LayoutType.HIERARCHICAL,

    // Zoom and pan behavior configuration
    zoomConfig: {
        minZoom: 0.1, // Minimum zoom level per requirements
        maxZoom: 3, // Maximum zoom level per requirements
        defaultZoom: 1,
        zoomOnScroll: true,
        zoomOnPinch: true, // Touch device support
        panOnScroll: false, // Prevent accidental panning
        panOnDrag: true, // Enable drag-to-pan
        preventScrolling: true, // Prevent page scroll while interacting
        wheelSensitivity: 0.5 // Reduced sensitivity for better control
    } as ZoomConfig,

    // Layout algorithm configurations
    layoutConfig: {
        [LayoutType.HIERARCHICAL]: {
            rankdir: 'TB', // Top to bottom direction
            align: 'UL', // Upper-left alignment
            ranker: 'network-simplex', // Efficient edge crossing minimization
            nodesep: 50, // Horizontal separation between nodes
            ranksep: 100, // Vertical separation between ranks
            edgeBundling: true, // Enable edge bundling for cleaner visualization
            optimizeLayout: true, // Enable layout optimization
            layerSpacing: 150 // Space between hierarchical layers
        },
        [LayoutType.FORCE]: {
            gravity: 0.3, // Global gravity strength
            repulsion: 1000, // Node repulsion force
            iterations: 300, // Maximum layout iterations
            springLength: 100, // Ideal edge length
            springStrength: 0.1, // Edge spring force
            dampening: 0.5, // Movement dampening
            centerStrength: 0.05, // Center gravity strength
            adaptiveTimeStep: true // Dynamic time step for better convergence
        },
        [LayoutType.DAGRE]: {
            rankdir: 'TB', // Top to bottom direction
            align: 'UL', // Upper-left alignment
            ranker: 'network-simplex', // Efficient edge routing
            marginx: 20, // Horizontal margin
            marginy: 20, // Vertical margin
            acyclicer: 'greedy', // Cycle removal algorithm
            rankerMethod: 'network-simplex', // Ranking method
            edgeSeparation: 30 // Minimum edge separation
        }
    } as LayoutConfigs,

    // Node styling configuration
    nodeConfig: {
        defaultWidth: 180, // Default node width
        defaultHeight: 40, // Default node height
        borderRadius: 4, // Rounded corners
        padding: 10, // Internal padding
        fontSize: 12, // WCAG 2.1 AA compliant font size
        fontFamily: "'Roboto', sans-serif", // Primary font
        fontWeight: 400, // Regular weight
        lineHeight: 1.5, // Accessible line height
        colors: {
            ENVIRONMENT: '#4CAF50', // Green for environments
            MODULE: '#2196F3', // Blue for modules
            RESOURCE: '#FF9800' // Orange for resources
        },
        shadows: {
            default: '0 2px 4px rgba(0,0,0,0.1)',
            hover: '0 4px 8px rgba(0,0,0,0.15)'
        },
        transitions: {
            duration: '200ms',
            timing: 'ease-in-out'
        }
    },

    // Edge styling configuration
    edgeConfig: {
        strokeWidth: 2, // Edge thickness
        radius: 20, // Edge corner radius
        colors: {
            DEPENDENCY: '#666666', // Dark gray for dependencies
            REFERENCE: '#999999' // Light gray for references
        },
        markerEnd: {
            type: 'arrowclosed',
            width: 20,
            height: 20,
            color: 'inherit',
            strokeWidth: 2
        },
        animations: {
            duration: '300ms',
            timing: 'ease'
        }
    }
} as const;

/**
 * Retrieves and validates layout configuration for the specified layout type
 * with performance optimizations.
 * 
 * @param layoutType - The type of layout algorithm to use
 * @returns Optimized layout configuration object
 */
export function getLayoutConfig(layoutType: LayoutType): Record<string, any> {
    if (!Object.values(LayoutType).includes(layoutType)) {
        throw new Error(`Invalid layout type: ${layoutType}`);
    }
    
    const baseConfig = GRAPH_CONFIG.layoutConfig[layoutType];
    
    // Apply performance optimizations based on layout type
    switch (layoutType) {
        case LayoutType.HIERARCHICAL:
            return {
                ...baseConfig,
                optimizeLayout: window.innerWidth > 1920 ? true : false // Disable on smaller screens
            };
        case LayoutType.FORCE:
            return {
                ...baseConfig,
                iterations: window.innerWidth > 1920 ? 300 : 200 // Reduce iterations on smaller screens
            };
        case LayoutType.DAGRE:
            return {
                ...baseConfig,
                optimizeLayout: window.innerWidth > 1920 ? true : false // Disable on smaller screens
            };
        default:
            return baseConfig;
    }
}