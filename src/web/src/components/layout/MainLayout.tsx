/**
 * @fileoverview Main application layout component providing a consistent layout framework
 * with navigation, sidebar, content area, and status bar. Implements responsive behavior
 * and accessibility features.
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useSwipeable } from 'react-swipeable';

import Navigation from '../common/Navigation';
import Sidebar from '../common/Sidebar';
import StatusBar from '../common/StatusBar';
import SplitPanel from './SplitPanel';
import ErrorBoundary from '../common/ErrorBoundary';

// Constants for layout configuration
const SIDEBAR_WIDTH = 240;
const MOBILE_BREAKPOINT = 'md';
const RESIZE_DEBOUNCE_MS = 150;
const MIN_SWIPE_DISTANCE = 50;

/**
 * Props interface for the MainLayout component
 */
interface IMainLayoutProps {
  children: React.ReactNode;
  className?: string;
  initialSidebarOpen?: boolean;
}

/**
 * Styled container for the main layout
 */
const LayoutContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  overflow: 'hidden',
  position: 'relative',
  backgroundColor: theme.palette.background.default,
  touchAction: 'none'
}));

/**
 * Styled main content area
 */
const MainContent = styled(Box)(({ theme }) => ({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
  position: 'relative'
}));

/**
 * MainLayout component implementing the application's layout structure
 * with responsive behavior and accessibility features.
 */
const MainLayout: React.FC<IMainLayoutProps> = ({
  children,
  className,
  initialSidebarOpen = true
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down(MOBILE_BREAKPOINT));
  
  // State management
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen && !isMobile);
  const [settingsOpen, setSettingsOpen] = useState(false);

  /**
   * Handles sidebar toggle with state management
   */
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  /**
   * Handles settings dialog toggle
   */
  const handleSettingsToggle = useCallback(() => {
    setSettingsOpen(prev => !prev);
  }, []);

  /**
   * Configure swipe handlers for mobile navigation
   */
  const swipeHandlers = useSwipeable({
    onSwipedRight: (event) => {
      if (event.absX > MIN_SWIPE_DISTANCE && !sidebarOpen && isMobile) {
        setSidebarOpen(true);
      }
    },
    onSwipedLeft: (event) => {
      if (event.absX > MIN_SWIPE_DISTANCE && sidebarOpen && isMobile) {
        setSidebarOpen(false);
      }
    },
    trackMouse: false,
    preventDefaultTouchmoveEvent: true
  });

  /**
   * Handle window resize events
   */
  useEffect(() => {
    const handleResize = () => {
      if (!isMobile && !sidebarOpen) {
        setSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, sidebarOpen]);

  /**
   * Memoized layout offset calculations
   */
  const layoutStyles = useMemo(() => ({
    paddingLeft: !isMobile && sidebarOpen ? `${SIDEBAR_WIDTH}px` : 0,
    transition: theme.transitions.create(['padding'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen
    })
  }), [isMobile, sidebarOpen, theme.transitions]);

  return (
    <ErrorBoundary>
      <LayoutContainer className={className} {...swipeHandlers}>
        {/* Top Navigation Bar */}
        <Navigation
          onSettingsClick={handleSettingsToggle}
        />

        <MainContent>
          {/* Sidebar Navigation */}
          <Sidebar
            open={sidebarOpen}
            onClose={handleSidebarToggle}
            width={SIDEBAR_WIDTH}
          />

          {/* Main Content Area */}
          <Box
            component="main"
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              ...layoutStyles
            }}
            role="main"
            tabIndex={-1}
          >
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </Box>
        </MainContent>

        {/* Status Bar */}
        <StatusBar />
      </LayoutContainer>
    </ErrorBoundary>
  );
};

export default MainLayout;