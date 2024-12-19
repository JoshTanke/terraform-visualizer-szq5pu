/**
 * @fileoverview React component that implements the environment-level visualization view,
 * displaying modules and their relationships within a specific environment.
 * Provides both graph visualization and code editing capabilities in a split-panel layout
 * with real-time WebSocket updates.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Box, Grid, Typography, useTheme, useMediaQuery } from '@mui/material'; // v5.x
import { useParams, useNavigate } from 'react-router-dom'; // v6.x

import { IEnvironment, EnvironmentStatus } from '../../interfaces/IEnvironment';
import { GraphCanvas } from '../graph/GraphCanvas';
import { useGraph } from '../../hooks/useGraph';
import { useWebSocket } from '../../hooks/useWebSocket';
import { LayoutType } from '../../interfaces/IGraph';
import { ApiService } from '../../services/api.service';

/**
 * Props interface for the EnvironmentView component
 */
interface EnvironmentViewProps {
    environmentId: string;
    onError: (error: Error) => void;
}

/**
 * EnvironmentView - Main component for rendering the environment-level visualization
 * with real-time updates and responsive layout.
 */
const EnvironmentView: React.FC<EnvironmentViewProps> = ({
    environmentId,
    onError
}) => {
    // Initialize hooks and services
    const theme = useTheme();
    const navigate = useNavigate();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [apiService] = useState(() => new ApiService());
    const [environment, setEnvironment] = useState<IEnvironment | null>(null);
    const [isEditorVisible, setIsEditorVisible] = useState(!isMobile);

    // Initialize graph management hook
    const {
        graph,
        selectedNodeId,
        isLoading,
        error: graphError,
        performanceMetrics,
        handleNodeClick,
        handleNodeDragEnd,
        handleLayoutChange
    } = useGraph(environmentId, LayoutType.HIERARCHICAL);

    // Initialize WebSocket connection for real-time updates
    const {
        isConnected: wsConnected,
        error: wsError,
        subscribe,
        connect: wsConnect
    } = useWebSocket({
        autoConnect: true,
        onError: (error) => onError(new Error(error.message))
    });

    /**
     * Loads environment data from the API
     */
    const loadEnvironment = useCallback(async () => {
        try {
            const data = await apiService.getEnvironment(environmentId);
            setEnvironment(data);
        } catch (error) {
            onError(error as Error);
        }
    }, [environmentId, apiService, onError]);

    /**
     * Handles module selection in the graph
     */
    const handleModuleSelect = useCallback((nodeId: string) => {
        if (!environment) return;

        const module = environment.modules.find(m => m.id === nodeId);
        if (module) {
            // Update URL with selected module
            navigate(`/environments/${environmentId}/modules/${nodeId}`);

            // Announce selection for screen readers
            const liveRegion = document.getElementById('live-announcer');
            if (liveRegion) {
                liveRegion.textContent = `Selected module: ${module.name}`;
            }
        }
    }, [environment, environmentId, navigate]);

    /**
     * Handles real-time environment updates
     */
    const handleEnvironmentUpdate = useCallback((updatedEnvironment: IEnvironment) => {
        if (updatedEnvironment.id === environmentId) {
            setEnvironment(updatedEnvironment);
        }
    }, [environmentId]);

    /**
     * Effect for initial data loading and WebSocket subscription
     */
    useEffect(() => {
        loadEnvironment();

        // Subscribe to real-time updates
        const unsubscribeEnv = subscribe<IEnvironment>(
            'environment.update',
            handleEnvironmentUpdate
        );

        return () => {
            unsubscribeEnv();
        };
    }, [loadEnvironment, subscribe, handleEnvironmentUpdate]);

    /**
     * Effect for handling responsive layout
     */
    useEffect(() => {
        setIsEditorVisible(!isMobile);
    }, [isMobile]);

    /**
     * Memoized error message
     */
    const errorMessage = useMemo(() => {
        if (graphError) return graphError;
        if (wsError) return wsError.message;
        return null;
    }, [graphError, wsError]);

    return (
        <Box
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'background.default'
            }}
            role="main"
            aria-label="Environment Visualization View"
        >
            {/* Environment Header */}
            <Box
                sx={{
                    p: 2,
                    borderBottom: 1,
                    borderColor: 'divider'
                }}
            >
                <Typography variant="h6" component="h1">
                    {environment?.name || 'Loading environment...'}
                </Typography>
                {environment?.status === EnvironmentStatus.ERROR && (
                    <Typography
                        color="error"
                        variant="body2"
                        role="alert"
                    >
                        Environment has configuration errors
                    </Typography>
                )}
            </Box>

            {/* Main Content Area */}
            <Grid
                container
                sx={{
                    flex: 1,
                    overflow: 'hidden'
                }}
                spacing={2}
            >
                {/* Graph Panel */}
                <Grid
                    item
                    xs={12}
                    md={isEditorVisible ? 6 : 12}
                    sx={{
                        height: '100%',
                        minHeight: 0
                    }}
                >
                    <GraphCanvas
                        moduleId={environmentId}
                        onNodeSelect={handleModuleSelect}
                        layout={LayoutType.HIERARCHICAL}
                        performanceMode={performanceMetrics.lastUpdateDuration > 100}
                        accessibilityMode={true}
                    />
                </Grid>

                {/* Editor Panel - Conditionally rendered */}
                {isEditorVisible && (
                    <Grid
                        item
                        md={6}
                        sx={{
                            height: '100%',
                            minHeight: 0,
                            display: { xs: 'none', md: 'block' }
                        }}
                    >
                        {/* Editor component would be rendered here */}
                    </Grid>
                )}
            </Grid>

            {/* Live Region for Accessibility */}
            <div
                id="live-announcer"
                role="status"
                aria-live="polite"
                className="sr-only"
            />

            {/* Error Display */}
            {errorMessage && (
                <Box
                    sx={{
                        position: 'fixed',
                        bottom: 16,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        bgcolor: 'error.main',
                        color: 'error.contrastText',
                        p: 2,
                        borderRadius: 1,
                        zIndex: 'tooltip'
                    }}
                    role="alert"
                >
                    {errorMessage}
                </Box>
            )}
        </Box>
    );
};

export default React.memo(EnvironmentView);