/**
 * @fileoverview React component for rendering customized nodes in the infrastructure visualization graph.
 * Implements performance optimizations, accessibility features, and comprehensive styling based on node types.
 * @version 1.0.0
 */

import React, { memo, useCallback, useMemo } from 'react';
import { 
    Box, 
    Card, 
    CardContent, 
    Typography, 
    Tooltip, 
    IconButton 
} from '@mui/material';
import { 
    Handle, 
    Position, 
    NodeProps, 
    useReactFlow 
} from 'reactflow';
import { INode, NodeType } from '../../interfaces/IGraph';

// Version comments for external dependencies
// @mui/material v5.x
// reactflow v11.x

/**
 * Props interface for the NodeComponent with enhanced type safety
 */
interface NodeComponentProps extends NodeProps {
    data: Record<string, any>;
    isConnectable: boolean;
    selected: boolean;
    nodeId: string;
    disabled?: boolean;
    dragHandle?: string;
    onNodeClick?: (nodeId: string) => void;
}

/**
 * Memoized function to generate node styles based on type and state
 */
const getNodeStyle = (
    type: NodeType, 
    selected: boolean, 
    disabled?: boolean
) => {
    return useMemo(() => {
        const baseStyle = {
            borderRadius: '4px',
            padding: '8px',
            minWidth: '150px',
            backgroundColor: 'background.paper',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            cursor: disabled ? 'default' : 'pointer',
            transition: 'all 0.2s ease',
            outline: 'none',
            opacity: disabled ? 0.5 : 1,
            pointerEvents: disabled ? 'none' : 'auto',
            ...selected && {
                boxShadow: '0 0 0 2px primary.main',
                zIndex: 1
            }
        };

        const typeStyles = {
            [NodeType.ENVIRONMENT]: {
                backgroundColor: 'success.light',
                color: 'success.contrastText'
            },
            [NodeType.MODULE]: {
                backgroundColor: 'info.light',
                color: 'info.contrastText'
            },
            [NodeType.RESOURCE]: {
                backgroundColor: 'warning.light',
                color: 'warning.contrastText'
            },
            [NodeType.DATA]: {
                backgroundColor: 'secondary.light',
                color: 'secondary.contrastText'
            },
            [NodeType.VARIABLE]: {
                backgroundColor: 'primary.light',
                color: 'primary.contrastText'
            },
            [NodeType.OUTPUT]: {
                backgroundColor: 'error.light',
                color: 'error.contrastText'
            }
        };

        return {
            ...baseStyle,
            ...typeStyles[type]
        };
    }, [type, selected, disabled]);
};

/**
 * NodeComponent - Renders a customized node in the infrastructure visualization graph
 * with optimized performance and accessibility features.
 */
const NodeComponent = memo(({
    data,
    isConnectable,
    selected,
    nodeId,
    disabled,
    dragHandle,
    onNodeClick
}: NodeComponentProps) => {
    const { getNode } = useReactFlow();
    const node = getNode(nodeId) as INode;

    // Memoize node style based on type and state
    const nodeStyle = getNodeStyle(node.type, selected, disabled);

    // Memoize event handlers
    const handleClick = useCallback(() => {
        if (!disabled && onNodeClick) {
            onNodeClick(nodeId);
        }
    }, [disabled, nodeId, onNodeClick]);

    const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            handleClick();
        }
    }, [handleClick]);

    // Generate ARIA label based on node data
    const ariaLabel = useMemo(() => {
        const typeLabel = node.type.toLowerCase();
        const nameLabel = data.label || node.id;
        const statusLabel = data.status ? ` - ${data.status}` : '';
        return `${typeLabel} ${nameLabel}${statusLabel}`;
    }, [node.type, data.label, node.id, data.status]);

    return (
        <Card
            sx={nodeStyle}
            onClick={handleClick}
            onKeyPress={handleKeyPress}
            tabIndex={0}
            role="button"
            aria-label={ariaLabel}
            aria-selected={selected}
            data-drag-handle={dragHandle}
        >
            {/* Source handle for connections */}
            <Handle
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
                style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: 'primary.main',
                    border: '2px solid',
                    borderColor: 'background.paper',
                    transition: 'transform 0.2s ease'
                }}
            />

            {/* Target handle for connections */}
            <Handle
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
                style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: 'primary.main',
                    border: '2px solid',
                    borderColor: 'background.paper',
                    transition: 'transform 0.2s ease'
                }}
            />

            <CardContent sx={{ padding: '4px !important' }}>
                <Tooltip
                    title={data.description || ''}
                    placement="top"
                    arrow
                >
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        {data.icon && (
                            <Box
                                component="img"
                                src={data.icon}
                                alt=""
                                sx={{
                                    width: '24px',
                                    height: '24px',
                                    flexShrink: 0
                                }}
                            />
                        )}
                        <Typography
                            variant="body2"
                            sx={{
                                fontWeight: 'medium',
                                fontSize: '14px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1
                            }}
                        >
                            {data.label || node.id}
                        </Typography>
                        {data.status && (
                            <Box
                                sx={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: data.status === 'valid' ? 'success.main' :
                                                   data.status === 'warning' ? 'warning.main' :
                                                   'error.main'
                                }}
                            />
                        )}
                    </Box>
                </Tooltip>
            </CardContent>
        </Card>
    );
});

NodeComponent.displayName = 'NodeComponent';

export default NodeComponent;