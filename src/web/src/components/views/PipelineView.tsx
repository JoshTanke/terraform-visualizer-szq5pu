/**
 * @fileoverview Enhanced React component for rendering the Pipeline view visualization
 * with real-time updates, accessibility features, and performance optimizations.
 * @version 1.0.0
 */

import React, { useEffect, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box, Typography, CircularProgress, Tooltip } from '@mui/material';
import { EnvironmentStatus } from '../../interfaces/IEnvironment';
import { IProject } from '../../interfaces/IProject';
import { NodeType, EdgeType, LayoutType } from '../../interfaces/IGraph';
import GraphCanvas from '../graph/GraphCanvas';
import { useGraph } from '../../hooks/useGraph';
import ErrorBoundary from '../common/ErrorBoundary';
import { getLogger } from '../../utils/logger';

const logger = getLogger();

/**
 * Props interface for PipelineView component
 */
interface PipelineViewProps {
    projectId: string;
    onError: (error: Error) => void;
}

/**
 * Enhanced PipelineView component for visualizing environment pipeline
 * with real-time updates and accessibility features.
 */
const PipelineView: React.FC<PipelineViewProps> = memo(({ projectId, onError }) => {
    const navigate = useNavigate();
    const project = useSelector((state: any) => state.projects.currentProject as IProject);

    // Initialize graph management hook with pipeline layout
    const {
        graph,
        selectedNodeId,
        isLoading,
        error,
        performanceMetrics,
        handleNodeClick,
        handleLayoutChange,
        useWebSocketUpdates
    } = useGraph(projectId, LayoutType.HIERARCHICAL);

    // Subscribe to real-time updates
    useWebSocketUpdates(projectId);

    /**
     * Transform environments into optimized graph nodes and edges
     */
    const graphData = useMemo(() => {
        if (!project?.environments) return { nodes: [], edges: [] };

        const nodes = project.environments.map((env, index) => ({
            id: env.id,
            type: NodeType.ENVIRONMENT,
            position: { x: index * 300, y: 0 },
            data: {
                label: env.name,
                status: env.status,
                moduleCount: env.modules.length,
                description: env.description || '',
                version: env.version
            },
            metadata: {
                createdAt: env.created.toISOString(),
                updatedAt: env.updated.toISOString(),
                status: env.status === EnvironmentStatus.ACTIVE ? 'valid' :
                       env.status === EnvironmentStatus.ERROR ? 'error' : 'warning'
            }
        }));

        const edges = project.environments.slice(0, -1).map((env, index) => ({
            id: `${env.id}-${project.environments[index + 1].id}`,
            source: env.id,
            target: project.environments[index + 1].id,
            type: EdgeType.DEPENDENCY,
            animated: true,
            style: { stroke: '#b1b1b7', strokeWidth: 2 },
            metadata: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                description: 'Environment pipeline flow'
            }
        }));

        return { nodes, edges };
    }, [project?.environments]);

    /**
     * Enhanced node click handler with navigation and logging
     */
    const handleEnvironmentSelect = useCallback((nodeId: string) => {
        try {
            const environment = project?.environments.find(env => env.id === nodeId);
            if (environment) {
                logger.log('Environment selected', { 
                    environmentId: nodeId, 
                    environmentName: environment.name 
                }, 'info');
                navigate(`/environments/${nodeId}`);
            }
        } catch (error) {
            logger.log('Environment selection failed', { nodeId, error }, 'error');
            onError(error as Error);
        }
    }, [project, navigate, onError]);

    /**
     * Error handling effect
     */
    useEffect(() => {
        if (error) {
            logger.log('Pipeline view error', { error }, 'error');
            onError(new Error(error));
        }
    }, [error, onError]);

    return (
        <ErrorBoundary onReset={() => handleLayoutChange(LayoutType.HIERARCHICAL)}>
            <Box sx={styles.container}>
                <Box sx={styles.header}>
                    <Typography variant="h5" component="h1">
                        Environment Pipeline
                    </Typography>
                    {project && (
                        <Tooltip title={project.description || ''}>
                            <Typography variant="subtitle1" color="textSecondary">
                                {project.name}
                            </Typography>
                        </Tooltip>
                    )}
                </Box>

                <Box sx={styles.graphContainer}>
                    <GraphCanvas
                        moduleId={projectId}
                        onNodeSelect={handleEnvironmentSelect}
                        layout={LayoutType.HIERARCHICAL}
                        initialZoom={1}
                        performanceMode={graphData.nodes.length > 100}
                        accessibilityMode={true}
                    />

                    {isLoading && (
                        <Box sx={styles.loadingOverlay}>
                            <CircularProgress 
                                size={40}
                                aria-label="Loading pipeline visualization"
                            />
                        </Box>
                    )}
                </Box>
            </Box>
        </ErrorBoundary>
    );
});

// Styles
const styles = {
    container: {
        width: '100%',
        height: '100%',
        padding: '24px',
        position: 'relative'
    },
    header: {
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    graphContainer: {
        width: '100%',
        height: 'calc(100% - 64px)',
        backgroundColor: 'background.paper',
        borderRadius: '8px',
        position: 'relative'
    },
    loadingOverlay: {
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.8)'
    }
};

PipelineView.displayName = 'PipelineView';

export default PipelineView;