/**
 * @fileoverview React component that provides a container for graph manipulation controls
 * including layout selection, node/edge manipulation, and zoom controls in the Terraform
 * visualization interface with enhanced error handling, accessibility, and performance optimizations.
 * @version 1.0.0
 */

import React, { useCallback, useMemo, useEffect } from 'react';
import { Paper, Box, Divider, useMediaQuery } from '@mui/material'; // v5.x
import { useGraph } from '../../hooks/useGraph';
import { GraphControls } from './GraphControls';
import { NodeInspector } from './NodeInspector';

/**
 * Props interface for the ControlPanel component
 */
interface ControlPanelProps {
    /** Optional CSS class name for styling */
    className?: string;
    /** Optional error handler callback */
    onError?: (error: Error) => void;
    /** Accessibility label for the control panel */
    ariaLabel?: string;
}

/**
 * ControlPanel component that provides a container for graph manipulation controls
 * with enhanced error handling and performance optimizations.
 */
export const ControlPanel: React.FC<ControlPanelProps> = React.memo(({
    className,
    onError,
    ariaLabel = 'Graph control panel'
}) => {
    // Get responsive breakpoint
    const isMobile = useMediaQuery('(max-width:600px)');

    // Get graph state and handlers from hook
    const {
        selectedNodeId,
        isLoading,
        error,
        graph
    } = useGraph();

    // Memoize selected node to prevent unnecessary re-renders
    const selectedNode = useMemo(() => {
        if (!graph || !selectedNodeId) return null;
        return graph.nodes.find(node => node.id === selectedNodeId) || null;
    }, [graph, selectedNodeId]);

    /**
     * Handle node updates with error boundary
     */
    const handleNodeUpdate = useCallback((nodeId: string, updates: any) => {
        try {
            // Node update logic here
            console.log('Node update:', nodeId, updates);
        } catch (err) {
            onError?.(err as Error);
        }
    }, [onError]);

    /**
     * Handle node deletion with error boundary
     */
    const handleNodeDelete = useCallback((nodeId: string) => {
        try {
            // Node deletion logic here
            console.log('Node delete:', nodeId);
        } catch (err) {
            onError?.(err as Error);
        }
    }, [onError]);

    /**
     * Error effect handler
     */
    useEffect(() => {
        if (error && onError) {
            onError(new Error(error));
        }
    }, [error, onError]);

    /**
     * Memoized styles based on screen size
     */
    const styles = useMemo(() => ({
        container: {
            position: 'absolute',
            right: isMobile ? '8px' : '16px',
            top: isMobile ? '8px' : '16px',
            width: isMobile ? 'calc(100% - 16px)' : '320px',
            maxHeight: isMobile ? 'calc(100vh - 16px)' : 'calc(100vh - 32px)',
            overflow: 'auto',
            zIndex: 4,
            backgroundColor: 'background.paper',
            borderRadius: 1,
            boxShadow: 2,
            transition: 'all 0.3s ease'
        },
        content: {
            padding: isMobile ? 1 : 2,
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 1 : 2
        }
    }), [isMobile]);

    return (
        <Paper
            className={className}
            sx={styles.container}
            elevation={3}
            role="complementary"
            aria-label={ariaLabel}
        >
            <Box sx={styles.content}>
                {/* Graph Controls Section */}
                <GraphControls
                    disabled={isLoading}
                />

                <Divider />

                {/* Node Inspector Section */}
                <NodeInspector
                    selectedNode={selectedNode}
                    isLoading={isLoading}
                    onNodeUpdate={handleNodeUpdate}
                    onNodeDelete={handleNodeDelete}
                />
            </Box>
        </Paper>
    );
});

ControlPanel.displayName = 'ControlPanel';

export default ControlPanel;