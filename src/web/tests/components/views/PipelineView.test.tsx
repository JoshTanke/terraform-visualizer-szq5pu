import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { axe } from '@axe-core/react';

// Components and hooks
import PipelineView from '../../../src/components/views/PipelineView';
import ErrorBoundary from '../../../src/components/common/ErrorBoundary';
import { useWebSocket } from '../../../src/hooks/useWebSocket';

// Types and interfaces
import { IProject, IEnvironment } from '../../../src/interfaces/IProject';
import { EnvironmentStatus } from '../../../src/interfaces/IEnvironment';
import { LayoutType } from '../../../src/interfaces/IGraph';

// Mock dependencies
jest.mock('../../../src/hooks/useWebSocket');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

/**
 * Helper function to render component with required providers and accessibility testing
 */
const renderWithProviders = async (
  ui: JSX.Element,
  {
    preloadedState = {},
    store = configureStore({
      reducer: {
        projects: (state = preloadedState) => state
      }
    }),
    ...renderOptions
  } = {}
) => {
  // Setup WebSocket mock
  (useWebSocket as jest.Mock).mockImplementation(() => ({
    isConnected: true,
    subscribe: jest.fn(),
    emit: jest.fn()
  }));

  const rendered = render(
    <Provider store={store}>
      <MemoryRouter>
        <ErrorBoundary>
          {ui}
        </ErrorBoundary>
      </MemoryRouter>
    </Provider>,
    renderOptions
  );

  // Run accessibility tests
  const axeResults = await axe(rendered.container);
  expect(axeResults).toHaveNoViolations();

  return {
    ...rendered,
    store,
    axeResults
  };
};

/**
 * Mock project data factory
 */
const mockProject = (overrides = {}, environmentCount = 3): IProject => {
  const environments: IEnvironment[] = Array.from({ length: environmentCount }, (_, index) => ({
    id: `env-${index}`,
    projectId: 'test-project',
    name: ['Development', 'Staging', 'Production'][index] || `Environment ${index}`,
    description: `Test environment ${index}`,
    configuration: {},
    variables: {},
    modules: [],
    status: EnvironmentStatus.ACTIVE,
    version: '1.0.0',
    created: new Date(),
    updated: new Date()
  }));

  return {
    id: 'test-project',
    name: 'Test Project',
    description: 'Test project description',
    githubUrl: 'https://github.com/test/project',
    githubBranch: 'main',
    environments,
    lastSyncedAt: new Date(),
    created: new Date(),
    updated: new Date(),
    ...overrides
  };
};

describe('PipelineView Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders pipeline view with environments and metrics', async () => {
    const project = mockProject();
    const { container } = await renderWithProviders(
      <PipelineView 
        projectId={project.id}
        onError={jest.fn()}
      />,
      {
        preloadedState: {
          currentProject: project
        }
      }
    );

    // Verify environment nodes are rendered
    project.environments.forEach(env => {
      const envNode = screen.getByText(env.name);
      expect(envNode).toBeInTheDocument();
      
      // Check status indicators
      const statusIndicator = within(envNode.closest('.MuiCard-root')!).getByRole('status');
      expect(statusIndicator).toHaveAttribute('aria-label', expect.stringContaining(env.status));
    });

    // Verify graph layout
    const graphContainer = container.querySelector('[data-testid="graph-canvas"]');
    expect(graphContainer).toHaveAttribute('data-layout', LayoutType.HIERARCHICAL);
  });

  it('handles environment navigation with loading states', async () => {
    const project = mockProject();
    const navigate = jest.fn();
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigate);

    await renderWithProviders(
      <PipelineView 
        projectId={project.id}
        onError={jest.fn()}
      />,
      {
        preloadedState: {
          currentProject: project
        }
      }
    );

    // Click environment node
    const envNode = screen.getByText('Development');
    await userEvent.click(envNode);

    // Verify loading indicator during transition
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Verify navigation
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(`/environments/${project.environments[0].id}`);
    }, { timeout: 500 }); // Verify transition time under 500ms
  });

  it('processes real-time updates via WebSocket', async () => {
    const project = mockProject();
    let wsCallback: (data: any) => void;

    (useWebSocket as jest.Mock).mockImplementation(() => ({
      isConnected: true,
      subscribe: (event: string, callback: (data: any) => void) => {
        wsCallback = callback;
        return jest.fn();
      },
      emit: jest.fn()
    }));

    await renderWithProviders(
      <PipelineView 
        projectId={project.id}
        onError={jest.fn()}
      />,
      {
        preloadedState: {
          currentProject: project
        }
      }
    );

    // Simulate WebSocket update
    const updatedEnv = {
      ...project.environments[0],
      status: EnvironmentStatus.UPDATING
    };

    wsCallback({
      type: 'environment_update',
      payload: updatedEnv
    });

    // Verify update is reflected in UI
    await waitFor(() => {
      const envNode = screen.getByText('Development');
      const statusIndicator = within(envNode.closest('.MuiCard-root')!).getByRole('status');
      expect(statusIndicator).toHaveAttribute('aria-label', expect.stringContaining('UPDATING'));
    }, { timeout: 200 }); // Verify update time under 200ms
  });

  it('handles error scenarios and recovery', async () => {
    const project = mockProject();
    const onError = jest.fn();
    const errorMessage = 'Test error message';

    // Mock graph error
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (useWebSocket as jest.Mock).mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await renderWithProviders(
      <PipelineView 
        projectId={project.id}
        onError={onError}
      />,
      {
        preloadedState: {
          currentProject: project
        }
      }
    );

    // Verify error handling
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);

    // Test recovery
    const retryButton = screen.getByRole('button', { name: /try to recover/i });
    await userEvent.click(retryButton);

    // Verify error boundary resets
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('maintains accessibility compliance', async () => {
    const project = mockProject();
    
    const { axeResults } = await renderWithProviders(
      <PipelineView 
        projectId={project.id}
        onError={jest.fn()}
      />,
      {
        preloadedState: {
          currentProject: project
        }
      }
    );

    // Verify ARIA labels and roles
    expect(screen.getByRole('application')).toBeInTheDocument();
    project.environments.forEach(env => {
      const envNode = screen.getByText(env.name);
      expect(envNode.closest('[role="button"]')).toHaveAttribute('aria-label');
    });

    // Verify keyboard navigation
    const firstEnv = screen.getByText('Development');
    firstEnv.focus();
    fireEvent.keyPress(firstEnv, { key: 'Enter', code: 'Enter' });
    
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });

    // Double-check axe results
    expect(axeResults).toHaveNoViolations();
  });
});