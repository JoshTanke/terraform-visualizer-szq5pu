/**
 * @fileoverview React component providing accessible zoom controls for graph visualization
 * with configurable zoom limits, keyboard shortcuts, and responsive design.
 * @version 1.0.0
 */

import React, { useCallback, memo, useEffect } from 'react';
import { useReactFlow } from 'reactflow'; // v11.x
import { IconButton, Stack, Tooltip } from '@mui/material'; // v5.x
import { ZoomIn, ZoomOut, CenterFocusStrong } from '@mui/icons-material'; // v5.x
import { debounce } from 'lodash'; // v4.x

/**
 * Props interface for ZoomControls component
 */
interface ZoomControlsProps {
    /** Optional CSS class name for styling */
    className?: string;
    /** Zoom increment/decrement step size */
    zoomStep?: number;
    /** Minimum zoom level (default: 0.1) */
    minZoom?: number;
    /** Maximum zoom level (default: 3.0) */
    maxZoom?: number;
    /** Custom positioning */
    position?: {
        right?: string;
        bottom?: string;
    };
}

/**
 * Zoom control component for graph visualization with accessibility support
 * and configurable zoom limits.
 */
export const ZoomControls: React.FC<ZoomControlsProps> = memo(({
    className,
    zoomStep = 0.2,
    minZoom = 0.1,
    maxZoom = 3.0,
    position = { right: '16px', bottom: '16px' }
}) => {
    // Initialize React Flow instance
    const { zoomIn: rfZoomIn, zoomOut: rfZoomOut, fitView, getZoom } = useReactFlow();

    /**
     * Debounced zoom operation to prevent rapid consecutive calls
     */
    const debouncedZoom = useCallback(
        debounce((zoomFn: () => void) => zoomFn(), 100, { maxWait: 200 }),
        []
    );

    /**
     * Handles zoom in with maximum limit
     */
    const handleZoomIn = useCallback(() => {
        const currentZoom = getZoom();
        if (currentZoom < maxZoom) {
            debouncedZoom(() => {
                rfZoomIn({ duration: 300 });
            });
        }
    }, [debouncedZoom, getZoom, maxZoom, rfZoomIn]);

    /**
     * Handles zoom out with minimum limit
     */
    const handleZoomOut = useCallback(() => {
        const currentZoom = getZoom();
        if (currentZoom > minZoom) {
            debouncedZoom(() => {
                rfZoomOut({ duration: 300 });
            });
        }
    }, [debouncedZoom, getZoom, minZoom, rfZoomOut]);

    /**
     * Handles fit view with zoom limits
     */
    const handleFitView = useCallback(() => {
        fitView({
            duration: 500,
            padding: 0.1,
            minZoom,
            maxZoom
        });
    }, [fitView, minZoom, maxZoom]);

    /**
     * Set up keyboard shortcuts for zoom controls
     */
    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            // Only handle if no input elements are focused
            if (document.activeElement?.tagName === 'INPUT' || 
                document.activeElement?.tagName === 'TEXTAREA') {
                return;
            }

            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case '=':
                    case '+':
                        event.preventDefault();
                        handleZoomIn();
                        break;
                    case '-':
                        event.preventDefault();
                        handleZoomOut();
                        break;
                    case '0':
                        event.preventDefault();
                        handleFitView();
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handleZoomIn, handleZoomOut, handleFitView]);

    return (
        <Stack
            spacing={1}
            className={className}
            sx={{
                position: 'absolute',
                ...position,
                zIndex: 4,
                backgroundColor: 'background.paper',
                borderRadius: 1,
                boxShadow: 1,
                '@media (max-width: 600px)': {
                    right: '8px',
                    bottom: '8px'
                }
            }}
        >
            <Tooltip title="Zoom In (Ctrl/⌘ +)" placement="left">
                <IconButton
                    onClick={handleZoomIn}
                    aria-label="Zoom in"
                    size="small"
                    sx={{
                        color: 'text.primary',
                        backgroundColor: 'background.paper',
                        '&:hover': {
                            backgroundColor: 'action.hover'
                        },
                        '&:focus-visible': {
                            outline: '2px solid',
                            outlineColor: 'primary.main'
                        }
                    }}
                >
                    <ZoomIn />
                </IconButton>
            </Tooltip>

            <Tooltip title="Zoom Out (Ctrl/⌘ -)" placement="left">
                <IconButton
                    onClick={handleZoomOut}
                    aria-label="Zoom out"
                    size="small"
                    sx={{
                        color: 'text.primary',
                        backgroundColor: 'background.paper',
                        '&:hover': {
                            backgroundColor: 'action.hover'
                        },
                        '&:focus-visible': {
                            outline: '2px solid',
                            outlineColor: 'primary.main'
                        }
                    }}
                >
                    <ZoomOut />
                </IconButton>
            </Tooltip>

            <Tooltip title="Fit View (Ctrl/⌘ 0)" placement="left">
                <IconButton
                    onClick={handleFitView}
                    aria-label="Fit view"
                    size="small"
                    sx={{
                        color: 'text.primary',
                        backgroundColor: 'background.paper',
                        '&:hover': {
                            backgroundColor: 'action.hover'
                        },
                        '&:focus-visible': {
                            outline: '2px solid',
                            outlineColor: 'primary.main'
                        }
                    }}
                >
                    <CenterFocusStrong />
                </IconButton>
            </Tooltip>
        </Stack>
    );
});

ZoomControls.displayName = 'ZoomControls';

export default ZoomControls;