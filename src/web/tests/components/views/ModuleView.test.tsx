/**
 * @fileoverview Test suite for ModuleView component with comprehensive coverage of
 * visualization functionality, graph interactions, and real-time updates.
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // v13.x
import { vi, describe, it, expect, beforeEach } from 'vitest'; // v0.34.x
import { Provider } from 'react-redux'; // v8.x
import { MemoryRouter, Routes, Route } from 'react-router-dom'; // v6.x
import { configureAxe, toHaveNoViolations } from 'jest-axe'; // v4.x
import { createStore } from '@reduxjs/toolkit';

import ModuleView from '../../../../src/components/views/ModuleView';
import { useGraph } from '../../../../src/hooks/useGraph';
import { useWebSocket } from '../../../../src/hooks/useWebSocket';
import { IModule, ModuleStatus } from '../../../../src/interfaces/IModule';
import { LayoutType } from '../../../../src/interfaces/IGraph';

// Mock dependencies
vi.mock('../../../../src/hooks/useGraph');
vi.mock('../../../../src/hooks/useWebSocket');

// Test data
const mockModule: IModule = {
    id: 'test-module-1',
    environmentId: 'env-1',
    name: 'Test Module',
    source: 'test/module',
    version: '1.0.0',
    description: 'Test module for visualization',
    configuration: {},
    resources: [
        {
            id: 'resource-1',
            moduleId: 'test-module-1',
            type: 'aws_instance',
            name: 'test_instance',
            provider: 'aws',
            attributes: {
                instance_type: 't2.micro',
                ami: 'ami-123456'
            },
            dependencies: [],
            position: { x: 0, y: 0 },
            selected: false,
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01'
        }
    ],
    variables: {},
    outputs: {},
    position: { x: 0, y: 0 },
    status: ModuleStatus.VALID
};

const mockGraph = {
    nodes: [
        {
            id: 'node-1',
            type: 'resource',
            data: {
                label: 'test_instance',
                type: 'aws_instance'
            },
            position: { x: 0, y: 0 }
        }
    ],
    edges: [],
    layout: LayoutType.HIERARCHICAL,
    viewport: { x: 0, y: 0, zoom: 1 },
    metadata: {
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
        version: '1.0.0',
        name: 'Test Graph',
        nodeCount: 1,
        edgeCount: 0
    }
};

// Helper function to render component with providers
const renderWithProviders = (
    ui: React.ReactElement,
    {
        initialState = {},
        store = createStore((state = initialState) => state),
        route = '/modules/test-module-1'
    } = {}
) => {
    window.history.pushState({}, 'Test page', route);
    
    return {
        ...render(
            <Provider store={store}>
                <MemoryRouter initialEntries={[route]}>
                    <Routes>
                        <Route path="/modules/:moduleId" element={ui} />
                    </Routes>
                </MemoryRouter>
            </Provider>
        ),
        store
    };
};

describe('ModuleView Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Mock useGraph hook
        (useGraph as jest.Mock).mockReturnValue({
            graph: mockGraph,
            selectedNodeId: null,
            currentLayout: LayoutType.HIERARCHICAL,
            isLoading: false,
            error: null,
            handleNodeClick: vi.fn(),
            handleNodeDragEnd: vi.fn(),
            handleLayoutChange: vi.fn()
        });

        // Mock useWebSocket hook
        (useWebSocket as jest.Mock).mockReturnValue({
            subscribe: vi.fn(),
            unsubscribe: vi.fn()
        });
    });

    it('renders module view with graph canvas and inspector', async () => {
        renderWithProviders(<ModuleView />);

        // Verify main components are rendered
        expect(screen.getByRole('application')).toBeInTheDocument();
        expect(screen.getByRole('complementary')).toBeInTheDocument();
        
        // Verify graph canvas is rendered with correct attributes
        const graphCanvas = screen.getByRole('application');
        expect(graphCanvas).toHaveAttribute('aria-label', 'Infrastructure Visualization Graph');
    });

    it('handles loading state correctly', async () => {
        (useGraph as jest.Mock).mockReturnValue({
            ...mockGraph,
            isLoading: true
        });

        renderWithProviders(<ModuleView />);

        // Verify loading indicator is shown
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('handles error state correctly', async () => {
        const errorMessage = 'Failed to load module';
        (useGraph as jest.Mock).mockReturnValue({
            ...mockGraph,
            error: new Error(errorMessage)
        });

        renderWithProviders(<ModuleView />);

        // Verify error message is displayed
        expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
    });

    it('handles node selection and updates URL', async () => {
        const handleNodeClick = vi.fn();
        (useGraph as jest.Mock).mockReturnValue({
            ...mockGraph,
            handleNodeClick
        });

        renderWithProviders(<ModuleView />);

        // Simulate node click
        const node = screen.getByRole('button', { name: /test_instance/i });
        fireEvent.click(node);

        // Verify URL update and node selection
        expect(handleNodeClick).toHaveBeenCalled();
        expect(window.location.pathname).toContain('/modules/test-module-1/resources');
    });

    it('subscribes to real-time updates on mount', async () => {
        const subscribe = vi.fn();
        (useWebSocket as jest.Mock).mockReturnValue({
            subscribe,
            unsubscribe: vi.fn()
        });

        renderWithProviders(<ModuleView />);

        // Verify WebSocket subscription
        expect(subscribe).toHaveBeenCalledWith(
            'module.update',
            expect.any(Function)
        );
    });

    it('unsubscribes from updates on unmount', () => {
        const unsubscribe = vi.fn();
        (useWebSocket as jest.Mock).mockReturnValue({
            subscribe: vi.fn(),
            unsubscribe
        });

        const { unmount } = renderWithProviders(<ModuleView />);
        unmount();

        // Verify cleanup
        expect(unsubscribe).toHaveBeenCalled();
    });

    it('handles keyboard navigation', async () => {
        const handleNodeClick = vi.fn();
        (useGraph as jest.Mock).mockReturnValue({
            ...mockGraph,
            selectedNodeId: 'node-1',
            handleNodeClick
        });

        renderWithProviders(<ModuleView />);

        // Simulate Escape key press
        fireEvent.keyDown(window, { key: 'Escape' });

        // Verify node deselection
        expect(handleNodeClick).toHaveBeenCalledWith({ id: '' });
    });

    it('meets accessibility requirements', async () => {
        const { container } = renderWithProviders(<ModuleView />);
        
        // Configure axe
        const axe = configureAxe({
            rules: {
                'color-contrast': { enabled: true },
                'aria-roles': { enabled: true }
            }
        });

        // Run accessibility tests
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('handles layout changes', async () => {
        const handleLayoutChange = vi.fn();
        (useGraph as jest.Mock).mockReturnValue({
            ...mockGraph,
            handleLayoutChange
        });

        renderWithProviders(<ModuleView />);

        // Simulate layout change
        const layoutButton = screen.getByRole('button', { name: /change layout/i });
        fireEvent.click(layoutButton);

        // Verify layout update
        expect(handleLayoutChange).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String)
        );
    });

    it('updates node inspector when node is selected', async () => {
        (useGraph as jest.Mock).mockReturnValue({
            ...mockGraph,
            selectedNodeId: 'node-1'
        });

        renderWithProviders(<ModuleView />);

        // Verify node inspector shows selected node details
        const inspector = screen.getByRole('complementary');
        expect(within(inspector).getByText('test_instance')).toBeInTheDocument();
    });

    it('handles responsive layout changes', async () => {
        // Mock mobile viewport
        window.matchMedia = vi.fn().mockImplementation(query => ({
            matches: query === '(max-width: 900px)',
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn()
        }));

        renderWithProviders(<ModuleView />);

        // Verify mobile layout adjustments
        const graphPanel = screen.getByRole('application').parentElement;
        expect(graphPanel).toHaveStyle({ height: '60vh' });
    });
});