/**
 * @fileoverview React component that provides graph manipulation controls including
 * layout selection, node/edge manipulation, and view options for the Terraform
 * visualization interface.
 * @version 1.0.0
 */

import React, { useCallback, memo } from 'react'; // v18.x
import {
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Divider,
    CircularProgress
} from '@mui/material'; // v5.x
import {
    AccountTree,
    BubbleChart,
    GraphicEq
} from '@mui/icons-material'; // v5.x

import { useGraph } from '../../hooks/useGraph';
import { LayoutType } from '../../interfaces/IGraph';
import ZoomControls from './ZoomControls';

/**
 * Props interface for the GraphControls component
 */
interface GraphControlsProps {
    /** Optional CSS class name for styling */
    className?: string;
    /** Disables all controls when true */
    disabled?: boolean;
}

/**
 * Layout option configuration type
 */
interface LayoutOption {
    type: LayoutType;
    icon: React.ReactNode;
    tooltip: string;
}

/**
 * GraphControls component providing layout selection and zoom controls
 * for the graph visualization interface.
 */
export const GraphControls: React.FC<GraphControlsProps> = memo(({
    className,
    disabled = false
}) => {
    // Get graph state and handlers from hook
    const {
        currentLayout: layout,
        handleLayoutChange,
        isLoading
    } = useGraph();

    // Define available layout options with icons and tooltips
    const layoutOptions: LayoutOption[] = [
        {
            type: LayoutType.HIERARCHICAL,
            icon: <AccountTree />,
            tooltip: 'Hierarchical Layout - Organizes nodes in a tree-like structure'
        },
        {
            type: LayoutType.FORCE,
            icon: <BubbleChart />,
            tooltip: 'Force Layout - Dynamically positions nodes based on relationships'
        },
        {
            type: LayoutType.DAGRE,
            icon: <GraphicEq />,
            tooltip: 'Dagre Layout - Optimized for directed acyclic graphs'
        }
    ];

    /**
     * Handles layout type changes with validation
     */
    const onLayoutChange = useCallback((
        _event: React.MouseEvent<HTMLElement>,
        newLayout: LayoutType | null
    ) => {
        if (newLayout && !disabled && !isLoading) {
            handleLayoutChange(newLayout);
        }
    }, [disabled, isLoading, handleLayoutChange]);

    return (
        <Stack
            spacing={2}
            className={className}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: 2,
                minWidth: 280,
                backgroundColor: 'background.paper',
                borderRadius: 1,
                boxShadow: 1,
                position: 'absolute',
                top: '16px',
                right: '16px',
                zIndex: 4,
                '@media (max-width: 600px)': {
                    minWidth: 'auto',
                    top: '8px',
                    right: '8px'
                }
            }}
        >
            {/* Layout Selection Controls */}
            <ToggleButtonGroup
                value={layout}
                exclusive
                onChange={onLayoutChange}
                disabled={disabled}
                aria-label="Graph layout selection"
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    width: '100%'
                }}
            >
                {layoutOptions.map((option) => (
                    <Tooltip
                        key={option.type}
                        title={option.tooltip}
                        placement="bottom"
                        sx={{
                            fontSize: '0.875rem',
                            maxWidth: 200
                        }}
                    >
                        <ToggleButton
                            value={option.type}
                            aria-label={`Select ${option.type} layout`}
                            sx={{
                                flex: 1,
                                '&.Mui-selected': {
                                    backgroundColor: 'primary.main',
                                    color: 'primary.contrastText',
                                    '&:hover': {
                                        backgroundColor: 'primary.dark'
                                    }
                                }
                            }}
                        >
                            {isLoading && layout === option.type ? (
                                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                                    <CircularProgress
                                        size={24}
                                        sx={{
                                            position: 'absolute',
                                            left: '50%',
                                            marginLeft: '-12px'
                                        }}
                                    />
                                    {option.icon}
                                </div>
                            ) : (
                                option.icon
                            )}
                        </ToggleButton>
                    </Tooltip>
                ))}
            </ToggleButtonGroup>

            <Divider sx={{ margin: '16px 0' }} />

            {/* Zoom Controls */}
            <ZoomControls
                position={{ right: 'auto', bottom: 'auto' }}
                minZoom={0.1}
                maxZoom={3}
                zoomStep={0.2}
            />
        </Stack>
    );
});

GraphControls.displayName = 'GraphControls';

export default GraphControls;