/**
 * @fileoverview React component for rendering customized edges in the infrastructure visualization graph.
 * Supports different edge types, visual styles, and optimized performance for large-scale infrastructure relationships.
 * @version 1.0.0
 */

import React, { memo, useMemo } from 'react'; // v18.x
import { BaseEdge, EdgeProps, getBezierPath, useStore } from 'reactflow'; // v11.x
import { styled, keyframes, useTheme } from '@mui/material/styles'; // v5.x
import { IEdge, EdgeType } from '../../interfaces/IGraph';
import { optimizeEdgeRouting } from '../../utils/graphHelpers';

// Animation keyframes for reference edges
const flowAnimation = keyframes`
  from { stroke-dashoffset: 24; }
  to { stroke-dashoffset: 0; }
`;

// Styled path component with theme-aware colors and animations
const StyledPath = styled('path')<{ type: string; animated: boolean }>`
  stroke-dasharray: ${props => props.type === EdgeType.DEPENDENCY ? '5,5' : 'none'};
  animation: ${props => props.animated ? `${flowAnimation} 30s linear infinite` : 'none'};
  stroke: ${props => props.theme.palette.mode === 'dark' ? '#ffffff' : '#000000'};
  stroke-width: ${props => props.type === EdgeType.DEPENDENCY ? '1.5px' : '2px'};
  transition: stroke-width 0.2s ease-in-out;
  
  &:hover {
    stroke-width: ${props => props.type === EdgeType.DEPENDENCY ? '2px' : '2.5px'};
  }
`;

/**
 * Interface extending EdgeProps with IEdge properties
 */
interface CustomEdgeProps extends EdgeProps, IEdge {}

/**
 * Memoized edge component for optimized rendering performance
 */
export const EdgeComponent = memo(({ 
  id,
  source,
  target,
  type,
  metadata,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd
}: CustomEdgeProps) => {
  const theme = useTheme();
  const zoom = useStore((state) => state.transform[2]);

  /**
   * Calculate edge style based on type and theme
   */
  const getEdgeStyle = useMemo(() => {
    const baseStyle = {
      strokeOpacity: Math.min(1, Math.max(0.3, zoom)),
      transition: 'stroke-opacity 0.2s ease-in-out'
    };

    if (type === EdgeType.DEPENDENCY) {
      return {
        ...baseStyle,
        stroke: theme.palette.mode === 'dark' ? '#90caf9' : '#1976d2',
        strokeDasharray: '5,5'
      };
    }

    return {
      ...baseStyle,
      stroke: theme.palette.mode === 'dark' ? '#81c784' : '#2e7d32'
    };
  }, [type, theme.palette.mode, zoom]);

  /**
   * Calculate optimized edge path with bundling support
   */
  const [edgePath, labelX, labelY] = useMemo(() => {
    const { points, labelCoordinates } = optimizeEdgeRouting(
      [{ source, target, type, metadata }],
      [],
      'dagre'
    )[0];

    return getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      curvature: 0.2
    });
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, source, target, type, metadata]);

  /**
   * Render optimized edge with proper styling and animation
   */
  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
      >
        <StyledPath
          id={id}
          d={edgePath}
          type={type}
          animated={type === EdgeType.REFERENCE}
          style={getEdgeStyle}
        />
      </BaseEdge>
      {metadata?.description && (
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          alignmentBaseline="middle"
          style={{
            fontSize: '10px',
            fill: theme.palette.text.secondary,
            pointerEvents: 'none'
          }}
        >
          {metadata.description}
        </text>
      )}
    </>
  );
});

EdgeComponent.displayName = 'EdgeComponent';

export default EdgeComponent;