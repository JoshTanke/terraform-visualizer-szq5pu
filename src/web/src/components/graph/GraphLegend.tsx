import React, { memo, useCallback } from 'react';
import { Box, Typography, Paper, Fade, useTheme } from '@mui/material'; // v5.x
import { NodeType, EdgeType } from '../../interfaces/IGraph';
import { TerraformIcons } from '../../assets/icons/terraform-icons';

// Interface for component props
interface GraphLegendProps {
  isVisible: boolean;
  visibleNodeTypes: NodeType[];
  visibleEdgeTypes: EdgeType[];
  className?: string;
  style?: React.CSSProperties;
}

// Constant styles with responsive breakpoints and accessibility considerations
const LEGEND_STYLES = {
  container: {
    position: 'absolute',
    bottom: { xs: '8px', sm: '16px', md: '24px' },
    right: { xs: '8px', sm: '16px', md: '24px' },
    padding: { xs: '12px', sm: '16px', md: '20px' },
    minWidth: { xs: '160px', sm: '200px', md: '240px' },
    maxWidth: { xs: '240px', sm: '300px', md: '360px' },
    zIndex: 1000,
    backgroundColor: 'background.paper',
    boxShadow: 2,
    borderRadius: 1,
  },
  entry: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: { xs: '6px', sm: '8px', md: '10px' },
    padding: '4px',
    borderRadius: '4px',
    '&:focus': {
      outline: '2px solid primary.main',
      outlineOffset: '2px',
    },
  },
  icon: {
    marginRight: { xs: '6px', sm: '8px', md: '10px' },
    width: { xs: '16px', sm: '20px', md: '24px' },
    height: { xs: '16px', sm: '20px', md: '24px' },
  },
} as const;

// Helper function to get human-readable names for node types
const getNodeTypeName = (type: NodeType): string => {
  const names: Record<NodeType, string> = {
    [NodeType.ENVIRONMENT]: 'Environment',
    [NodeType.MODULE]: 'Module',
    [NodeType.RESOURCE]: 'Resource',
    [NodeType.DATA]: 'Data Source',
    [NodeType.VARIABLE]: 'Variable',
  };
  return names[type] || type;
};

// Helper function to get human-readable names for edge types
const getEdgeTypeName = (type: EdgeType): string => {
  const names: Record<EdgeType, string> = {
    [EdgeType.DEPENDENCY]: 'Dependency',
    [EdgeType.REFERENCE]: 'Reference',
    [EdgeType.MODULE_LINK]: 'Module Link',
  };
  return names[type] || type;
};

// Main component implementation
export const GraphLegend = memo(({
  isVisible,
  visibleNodeTypes,
  visibleEdgeTypes,
  className,
  style,
}: GraphLegendProps) => {
  const theme = useTheme();

  // Render node type entry with proper accessibility
  const renderNodeTypeEntry = useCallback((type: NodeType) => {
    let Icon;
    switch (type) {
      case NodeType.RESOURCE:
        Icon = TerraformIcons.ResourceIcon;
        break;
      case NodeType.MODULE:
        Icon = TerraformIcons.ModuleIcon;
        break;
      case NodeType.DATA:
        Icon = TerraformIcons.DataIcon;
        break;
      case NodeType.VARIABLE:
        Icon = TerraformIcons.VariableIcon;
        break;
      default:
        Icon = TerraformIcons.ResourceIcon;
    }

    return (
      <Box
        key={type}
        sx={LEGEND_STYLES.entry}
        component="div"
        role="listitem"
        tabIndex={0}
        aria-label={`${getNodeTypeName(type)} node type`}
      >
        <Box sx={LEGEND_STYLES.icon}>
          <Icon
            size={24}
            color={theme.palette.primary.main}
            ariaLabel={`${getNodeTypeName(type)} icon`}
          />
        </Box>
        <Typography variant="body2" component="span">
          {getNodeTypeName(type)}
        </Typography>
      </Box>
    );
  }, [theme]);

  // Render edge type entry with proper accessibility
  const renderEdgeTypeEntry = useCallback((type: EdgeType) => {
    const getEdgeStyle = (type: EdgeType) => {
      switch (type) {
        case EdgeType.DEPENDENCY:
          return { borderStyle: 'solid' };
        case EdgeType.REFERENCE:
          return { borderStyle: 'dashed' };
        case EdgeType.MODULE_LINK:
          return { borderStyle: 'dotted' };
        default:
          return { borderStyle: 'solid' };
      }
    };

    return (
      <Box
        key={type}
        sx={LEGEND_STYLES.entry}
        component="div"
        role="listitem"
        tabIndex={0}
        aria-label={`${getEdgeTypeName(type)} connection type`}
      >
        <Box
          sx={{
            ...LEGEND_STYLES.icon,
            borderBottom: `2px ${getEdgeStyle(type).borderStyle} ${theme.palette.text.primary}`,
          }}
        />
        <Typography variant="body2" component="span">
          {getEdgeTypeName(type)}
        </Typography>
      </Box>
    );
  }, [theme]);

  return (
    <Fade in={isVisible}>
      <Paper
        sx={LEGEND_STYLES.container}
        className={className}
        style={style}
        elevation={2}
        component="aside"
        role="complementary"
        aria-label="Graph legend"
      >
        <Typography
          variant="subtitle2"
          component="h2"
          gutterBottom
          sx={{ mb: 2 }}
          role="heading"
        >
          Legend
        </Typography>
        
        {visibleNodeTypes.length > 0 && (
          <Box component="div" role="list" aria-label="Node types">
            {visibleNodeTypes.map(renderNodeTypeEntry)}
          </Box>
        )}
        
        {visibleEdgeTypes.length > 0 && (
          <Box 
            component="div" 
            role="list" 
            aria-label="Connection types"
            sx={{ mt: visibleNodeTypes.length > 0 ? 2 : 0 }}
          >
            {visibleEdgeTypes.map(renderEdgeTypeEntry)}
          </Box>
        )}
      </Paper>
    </Fade>
  );
});

GraphLegend.displayName = 'GraphLegend';

export default GraphLegend;