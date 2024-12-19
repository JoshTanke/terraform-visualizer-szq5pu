/**
 * @fileoverview React component for rendering the module-level visualization view,
 * displaying a detailed graph of resources within a Terraform module along with
 * inspection capabilities and controls.
 * @version 1.0.0
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // v6.x
import {
    Box,
    Grid,
    Paper,
    CircularProgress,
    Alert,
    useTheme,
    useMediaQuery
} from '@mui/material'; // v5.x

import { IModule } from '../../interfaces/IModule';
import GraphCanvas from '../graph/GraphCanvas';
import NodeInspector from '../graph/NodeInspector';
import { useGraph } from '../../hooks/useGraph';
import { useWebSocket } from '../../hooks/useWebSocket';
import ErrorBoundary from '../common/ErrorBoundary';
import { LayoutType } from '../../interfaces/IGraph';
import { getLogger } from '../../utils/logger';

const logger = getLogger();

/**
 * Props interface for ModuleView component
 */
interface ModuleViewProps {
    onError?: (error: Error) => void;
    className?: string;
}

/**
 * ModuleView component for rendering the module-level visualization with real-time updates
 * and interactive graph capabilities.
 */
const ModuleView: React.FC<ModuleViewProps> = ({
    onError,
    className
}) => {
    // Router hooks
    const { moduleId } = useParams<{ moduleId: string }>();
    const navigate = useNavigate();

    // Theme and responsive layout
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Local state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Initialize graph management hook
    const {
        graph,
        selectedNodeId,
        currentLayout,
        isLoading: graphLoading,
        error: graphError,
        handleNodeClick,
        handleNodeDragEnd,
        handleLayoutChange
    } = useGraph(moduleId || '', LayoutType.HIERARCHICAL);

    // Initialize WebSocket for real-time updates
    const { subscribe } = useWebSocket({
        onError: (wsError) => {
            logger.error('WebSocket error in ModuleView', { error: wsError });
            setError(new Error('Real-time connection error'));
        }
    });

    /**
     * Handle node selection with URL updates
     */
    const handleNodeSelect = useCallback((nodeId: string | null) => {
        handleNodeClick({ id: nodeId || '' });
        if (nodeId) {
            navigate(`/modules/${moduleId}/resources/${nodeId}`, { replace: true });
        } else {
            navigate(`/modules/${moduleId}`, { replace: true });
        }
    }, [moduleId, navigate, handleNodeClick]);

    /**
     * Set up WebSocket subscription for real-time module updates
     */
    useEffect(() => {
        if (!moduleId) return;

        const unsubscribe = subscribe<IModule>('module.update', (updatedModule) => {
            if (updatedModule.id === moduleId) {
                logger.info('Module update received', { moduleId });
                // Graph will be automatically updated through the graph hook
            }
        });

        return () => {
            unsubscribe();
        };
    }, [moduleId, subscribe]);

    /**
     * Handle keyboard navigation
     */
    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleNodeSelect(null);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handleNodeSelect]);

    /**
     * Error handling effect
     */
    useEffect(() => {
        if (graphError) {
            setError(graphError);
            onError?.(graphError);
        }
    }, [graphError, onError]);

    /**
     * Loading state management
     */
    useEffect(() => {
        setLoading(graphLoading);
    }, [graphLoading]);

    /**
     * Memoized layout configuration
     */
    const layoutConfig = useMemo(() => ({
        initialZoom: 1,
        maxNodes: 500,
        performanceMode: graph?.nodes.length || 0 > 200,
        accessibilityMode: true
    }), [graph?.nodes.length]);

    // Error state
    if (error) {
        return (
            <Alert 
                severity="error"
                sx={{ m: 2 }}
                role="alert"
            >
                {error.message}
            </Alert>
        );
    }

    // Loading state
    if (loading) {
        return (
            <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                minHeight="400px"
            >
                <CircularProgress />
            </Box>
        );
    }

    return (
        <ErrorBoundary onError={onError}>
            <Box
                className={className}
                sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                <Grid
                    container
                    spacing={2}
                    sx={{ flex: 1, overflow: 'hidden' }}
                >
                    {/* Graph Visualization Panel */}
                    <Grid
                        item
                        xs={12}
                        md={8}
                        sx={{
                            height: isMobile ? '60vh' : '100%',
                            minHeight: '400px'
                        }}
                    >
                        <Paper
                            elevation={2}
                            sx={{
                                height: '100%',
                                overflow: 'hidden',
                                position: 'relative'
                            }}
                        >
                            <GraphCanvas
                                moduleId={moduleId}
                                onNodeSelect={handleNodeSelect}
                                layout={currentLayout}
                                initialZoom={layoutConfig.initialZoom}
                                maxNodes={layoutConfig.maxNodes}
                                performanceMode={layoutConfig.performanceMode}
                                accessibilityMode={layoutConfig.accessibilityMode}
                            />
                        </Paper>
                    </Grid>

                    {/* Node Inspector Panel */}
                    <Grid
                        item
                        xs={12}
                        md={4}
                        sx={{
                            height: isMobile ? '40vh' : '100%',
                            minHeight: '300px'
                        }}
                    >
                        <NodeInspector
                            selectedNode={selectedNodeId ? graph?.nodes.find(n => n.id === selectedNodeId) || null : null}
                            isLoading={loading}
                        />
                    </Grid>
                </Grid>
            </Box>
        </ErrorBoundary>
    );
};

export default React.memo(ModuleView);