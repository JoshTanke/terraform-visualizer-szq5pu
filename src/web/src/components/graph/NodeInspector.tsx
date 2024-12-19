/**
 * @fileoverview Enhanced NodeInspector component for displaying detailed information
 * about selected nodes in the graph visualization with accessibility support and
 * performance optimizations.
 * @version 1.0.0
 */

import React, { useCallback, useMemo, useState } from 'react'; // v18.x
import {
    Box,
    Card,
    Typography,
    Divider,
    IconButton,
    Collapse,
    CircularProgress
} from '@mui/material'; // v5.x
import { ExpandMore, ExpandLess, Edit, Delete } from '@mui/icons-material'; // v5.x
import { VariableSizeList as VirtualList } from 'react-window'; // v1.8.x

import { INode, NodeType } from '../../interfaces/IGraph';
import { IResource } from '../../interfaces/IResource';
import { useGraph } from '../../hooks/useGraph';

/**
 * Props interface for NodeInspector component
 */
interface NodeInspectorProps {
    selectedNode: INode | null;
    isLoading: boolean;
    onNodeUpdate?: (nodeId: string, updates: Partial<INode>) => void;
    onNodeDelete?: (nodeId: string) => void;
}

/**
 * Constants for component styling and behavior
 */
const INSPECTOR_HEIGHT = 600;
const ATTRIBUTE_ROW_HEIGHT = 48;
const VIRTUAL_LIST_WIDTH = '100%';
const SENSITIVE_MASK = '••••••••';

/**
 * Enhanced NodeInspector component with accessibility support and performance optimizations
 */
export const NodeInspector: React.FC<NodeInspectorProps> = React.memo(({
    selectedNode,
    isLoading,
    onNodeUpdate,
    onNodeDelete
}) => {
    // Local state for expanded sections
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        attributes: true,
        dependencies: true,
        metadata: false
    });

    // Memoized resource data from selected node
    const resourceData = useMemo(() => {
        if (!selectedNode || !selectedNode.data) return null;
        return selectedNode.data as IResource;
    }, [selectedNode]);

    /**
     * Toggle section expansion with accessibility support
     */
    const toggleSection = useCallback((section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    }, []);

    /**
     * Memoized attribute rendering with virtualization
     */
    const renderAttributes = useCallback((attributes: Record<string, any>, sensitiveFields: string[]) => {
        const attributeEntries = Object.entries(attributes);

        const getRowHeight = (index: number) => {
            const [_, value] = attributeEntries[index];
            return typeof value === 'object' ? ATTRIBUTE_ROW_HEIGHT * 2 : ATTRIBUTE_ROW_HEIGHT;
        };

        const renderRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
            const [key, value] = attributeEntries[index];
            const isSensitive = sensitiveFields.includes(key);
            const displayValue = isSensitive ? SENSITIVE_MASK : JSON.stringify(value, null, 2);

            return (
                <Box
                    style={style}
                    sx={{ p: 1, borderBottom: '1px solid rgba(0, 0, 0, 0.12)' }}
                    role="row"
                    aria-label={`Attribute ${key}`}
                >
                    <Typography variant="subtitle2" color="textSecondary">
                        {key}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            wordBreak: 'break-word',
                            fontFamily: 'monospace'
                        }}
                    >
                        {displayValue}
                    </Typography>
                </Box>
            );
        };

        return (
            <VirtualList
                height={300}
                width={VIRTUAL_LIST_WIDTH}
                itemCount={attributeEntries.length}
                itemSize={getRowHeight}
                overscanCount={5}
            >
                {renderRow}
            </VirtualList>
        );
    }, []);

    /**
     * Memoized dependencies rendering with validation status
     */
    const renderDependencies = useCallback((dependencies: string[]) => {
        if (!dependencies.length) {
            return (
                <Typography variant="body2" color="textSecondary" sx={{ p: 1 }}>
                    No dependencies
                </Typography>
            );
        }

        return (
            <Box role="list" aria-label="Resource dependencies">
                {dependencies.map((dep) => (
                    <Box
                        key={dep}
                        sx={{
                            p: 1,
                            display: 'flex',
                            alignItems: 'center',
                            borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
                        }}
                        role="listitem"
                    >
                        <Typography variant="body2">{dep}</Typography>
                    </Box>
                ))}
            </Box>
        );
    }, []);

    // Render loading state
    if (isLoading) {
        return (
            <Card sx={{ height: INSPECTOR_HEIGHT, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress />
            </Card>
        );
    }

    // Render empty state
    if (!selectedNode || !resourceData) {
        return (
            <Card sx={{ height: INSPECTOR_HEIGHT, p: 2 }}>
                <Typography variant="body1" color="textSecondary" align="center">
                    Select a node to view details
                </Typography>
            </Card>
        );
    }

    return (
        <Card
            sx={{ height: INSPECTOR_HEIGHT, overflow: 'auto' }}
            role="complementary"
            aria-label="Node inspector"
        >
            {/* Header */}
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" component="h2">
                    {resourceData.name}
                </Typography>
                <Box>
                    {onNodeUpdate && (
                        <IconButton
                            aria-label="Edit resource"
                            onClick={() => onNodeUpdate(selectedNode.id, {})}
                            size="small"
                        >
                            <Edit />
                        </IconButton>
                    )}
                    {onNodeDelete && (
                        <IconButton
                            aria-label="Delete resource"
                            onClick={() => onNodeDelete(selectedNode.id)}
                            size="small"
                            color="error"
                        >
                            <Delete />
                        </IconButton>
                    )}
                </Box>
            </Box>

            <Divider />

            {/* Resource Type and Provider */}
            <Box sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">
                    Type
                </Typography>
                <Typography variant="body1">{resourceData.type}</Typography>
                <Typography variant="subtitle2" color="textSecondary" sx={{ mt: 1 }}>
                    Provider
                </Typography>
                <Typography variant="body1">{resourceData.provider}</Typography>
            </Box>

            <Divider />

            {/* Attributes Section */}
            <Box>
                <Box
                    sx={{ p: 2, cursor: 'pointer' }}
                    onClick={() => toggleSection('attributes')}
                    onKeyPress={(e) => e.key === 'Enter' && toggleSection('attributes')}
                    tabIndex={0}
                    role="button"
                    aria-expanded={expandedSections.attributes}
                    aria-controls="attributes-content"
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1">Attributes</Typography>
                        {expandedSections.attributes ? <ExpandLess /> : <ExpandMore />}
                    </Box>
                </Box>
                <Collapse in={expandedSections.attributes} id="attributes-content">
                    {renderAttributes(resourceData.attributes, resourceData.sensitive || [])}
                </Collapse>
            </Box>

            <Divider />

            {/* Dependencies Section */}
            <Box>
                <Box
                    sx={{ p: 2, cursor: 'pointer' }}
                    onClick={() => toggleSection('dependencies')}
                    onKeyPress={(e) => e.key === 'Enter' && toggleSection('dependencies')}
                    tabIndex={0}
                    role="button"
                    aria-expanded={expandedSections.dependencies}
                    aria-controls="dependencies-content"
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1">Dependencies</Typography>
                        {expandedSections.dependencies ? <ExpandLess /> : <ExpandMore />}
                    </Box>
                </Box>
                <Collapse in={expandedSections.dependencies} id="dependencies-content">
                    {renderDependencies(resourceData.dependencies)}
                </Collapse>
            </Box>
        </Card>
    );
});

NodeInspector.displayName = 'NodeInspector';

export default NodeInspector;