/**
 * @fileoverview React component implementing a resizable split panel layout
 * for displaying visualization and code editor side by side with enhanced
 * accessibility and performance optimizations.
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef, memo } from 'react'; // v18.x
import { Box, useTheme, useMediaQuery, Fade } from '@mui/material'; // v5.x
import { styled } from '@mui/material/styles'; // v5.x
import { debounce } from 'lodash'; // v4.x

// Constants for panel behavior
const MIN_PANEL_WIDTH = 200;
const DEFAULT_SPLIT = 50;
const RESIZE_DEBOUNCE_MS = 16;
const STORAGE_KEY_PREFIX = 'split-panel-';

/**
 * Props interface for the SplitPanel component
 */
interface ISplitPanelProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultSplit?: number;
  minWidth?: number;
  onSplitChange?: (split: number) => void;
  persistKey?: string;
}

/**
 * Styled container for the split panel layout
 */
const Container = styled(Box)(({ theme }) => ({
  display: 'flex',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  position: 'relative',
  backgroundColor: theme.palette.background.default,
  transition: 'all 0.3s ease'
}));

/**
 * Styled panel component
 */
const Panel = styled(Box)(({ theme }) => ({
  height: '100%',
  overflow: 'hidden',
  transition: 'width 0.3s ease'
}));

/**
 * Styled drag handle for resizing panels
 */
const DragHandle = styled(Box)(({ theme }) => ({
  width: '4px',
  height: '100%',
  backgroundColor: theme.palette.divider,
  cursor: 'col-resize',
  position: 'absolute',
  zIndex: 1000,
  transition: 'background-color 0.2s ease',
  '&:hover, &:active': {
    backgroundColor: theme.palette.primary.main
  },
  '&:focus': {
    outline: `2px solid ${theme.palette.primary.main}`
  }
}));

/**
 * SplitPanel component implementing a resizable split panel layout with
 * enhanced accessibility and performance optimizations.
 */
const SplitPanel: React.FC<ISplitPanelProps> = memo(({
  leftPanel,
  rightPanel,
  defaultSplit = DEFAULT_SPLIT,
  minWidth = MIN_PANEL_WIDTH,
  onSplitChange,
  persistKey
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Refs for DOM elements
  const containerRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  
  // Initialize split position from storage or default
  const [split, setSplit] = useState(() => {
    if (persistKey) {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${persistKey}`);
      return stored ? parseFloat(stored) : defaultSplit;
    }
    return defaultSplit;
  });

  // Track dragging state
  const [isDragging, setIsDragging] = useState(false);

  /**
   * Handles the start of drag operation
   */
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
  }, []);

  /**
   * Handles the drag operation with debounced updates
   */
  const handleDrag = useCallback(
    debounce((clientX: number) => {
      if (!containerRef.current || !isDragging) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const newSplit = ((clientX - containerRect.left) / containerWidth) * 100;

      // Enforce minimum width constraints
      const minSplit = (minWidth / containerWidth) * 100;
      const maxSplit = 100 - minSplit;
      const clampedSplit = Math.max(minSplit, Math.min(maxSplit, newSplit));

      setSplit(clampedSplit);
      onSplitChange?.(clampedSplit);

      // Persist split position if key provided
      if (persistKey) {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${persistKey}`, clampedSplit.toString());
      }
    }, RESIZE_DEBOUNCE_MS),
    [isDragging, minWidth, onSplitChange, persistKey]
  );

  /**
   * Handles the end of drag operation
   */
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
  }, []);

  /**
   * Effect to handle mouse/touch move events during drag
   */
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      handleDrag(clientX);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleMouseMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchend', handleDragEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDrag, handleDragEnd]);

  // Render mobile or desktop layout based on screen size
  if (isMobile) {
    return (
      <Container>
        <Box sx={{ width: '100%', height: '50%' }}>{leftPanel}</Box>
        <Box sx={{ width: '100%', height: '50%' }}>{rightPanel}</Box>
      </Container>
    );
  }

  return (
    <Container ref={containerRef}>
      <Panel sx={{ width: `${split}%` }}>
        <Fade in={true}>
          <Box sx={{ height: '100%' }}>{leftPanel}</Box>
        </Fade>
      </Panel>

      <DragHandle
        ref={dragHandleRef}
        sx={{ left: `${split}%` }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        tabIndex={0}
        role="separator"
        aria-valuenow={split}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Resize panels"
      />

      <Panel sx={{ width: `${100 - split}%` }}>
        <Fade in={true}>
          <Box sx={{ height: '100%' }}>{rightPanel}</Box>
        </Fade>
      </Panel>
    </Container>
  );
});

SplitPanel.displayName = 'SplitPanel';

export default SplitPanel;