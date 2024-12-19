/**
 * @fileoverview Test suite for the Monaco-based code editor component with comprehensive
 * coverage of functionality, performance, accessibility, and real-time sync features.
 * @version 1.0.0
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { axe, toHaveNoViolations } from 'jest-axe';
import CodeEditor from '../../src/components/code/CodeEditor';
import useCodeEditor from '../../src/hooks/useCodeEditor';
import { websocketConfig } from '../../src/config/websocket.config';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock Monaco editor
jest.mock('monaco-editor/esm/vs/editor/editor.api');

// Test content constants
const TEST_CONTENT = `
resource "aws_instance" "example" {
  ami           = "ami-123"
  instance_type = "t2.micro"
}`;

const LARGE_TEST_CONTENT = Array(1000)
  .fill('# Line')
  .join('\n');

const VALIDATION_ERROR = {
  line: 2,
  message: 'Invalid AMI ID format',
  severity: 'error'
};

/**
 * Helper function to render components with Redux provider
 */
const renderWithProviders = (
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = configureStore({
      reducer: {
        editor: (state = preloadedState) => state
      }
    }),
    ...renderOptions
  } = {}
) => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions })
  };
};

/**
 * Setup Monaco editor mock with comprehensive functionality
 */
const setupMonacoMock = () => {
  const editorInstance = {
    getValue: jest.fn(() => TEST_CONTENT),
    setValue: jest.fn(),
    onDidChangeModelContent: jest.fn(),
    updateOptions: jest.fn(),
    getModel: jest.fn(() => ({
      setValue: jest.fn(),
      onDidChangeContent: jest.fn()
    })),
    layout: jest.fn(),
    dispose: jest.fn(),
    addCommand: jest.fn(),
    focus: jest.fn(),
    revealLineInCenter: jest.fn()
  };

  const monaco = {
    editor: {
      create: jest.fn(() => editorInstance),
      defineTheme: jest.fn(),
      setTheme: jest.fn(),
      EditorOption: {
        readOnly: 'readOnly',
        minimap: 'minimap'
      }
    },
    languages: {
      register: jest.fn(),
      setMonarchTokensProvider: jest.fn(),
      registerCompletionItemProvider: jest.fn()
    },
    KeyMod: {
      CtrlCmd: 1
    },
    KeyCode: {
      KeyS: 2
    }
  };

  return { editorInstance, monaco };
};

/**
 * Utility to measure performance
 */
const measurePerformance = async (callback: () => Promise<void>): Promise<number> => {
  const start = performance.now();
  await callback();
  return performance.now() - start;
};

describe('CodeEditor Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMonacoMock();
  });

  describe('Basic Functionality', () => {
    it('renders editor with initial content', async () => {
      const { container } = renderWithProviders(
        <CodeEditor
          moduleId="test-module"
          initialContent={TEST_CONTENT}
          ariaLabel="Test Editor"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('complementary')).toBeInTheDocument();
      });

      expect(container.querySelector('.monaco-editor')).toBeInTheDocument();
      expect(screen.getByLabelText('Test Editor')).toBeInTheDocument();
    });

    it('handles content changes with WebSocket sync', async () => {
      const onContentChange = jest.fn();
      const { editorInstance } = setupMonacoMock();

      renderWithProviders(
        <CodeEditor
          moduleId="test-module"
          initialContent={TEST_CONTENT}
          onContentChange={onContentChange}
        />
      );

      await waitFor(() => {
        expect(editorInstance.onDidChangeModelContent).toHaveBeenCalled();
      });

      // Simulate content change
      const changeHandler = editorInstance.onDidChangeModelContent.mock.calls[0][0];
      await changeHandler({ changes: [{ text: 'new content' }] });

      expect(onContentChange).toHaveBeenCalledWith('new content');
    });

    it('displays validation errors correctly', async () => {
      const { rerender } = renderWithProviders(
        <CodeEditor
          moduleId="test-module"
          initialContent={TEST_CONTENT}
        />
      );

      // Simulate validation error
      rerender(
        <CodeEditor
          moduleId="test-module"
          initialContent={TEST_CONTENT}
          validationErrors={[VALIDATION_ERROR]}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(VALIDATION_ERROR.message)).toBeInTheDocument();
      });
    });

    it('updates theme based on settings', async () => {
      const { monaco } = setupMonacoMock();
      
      renderWithProviders(
        <CodeEditor
          moduleId="test-module"
          initialContent={TEST_CONTENT}
        />
      );

      await waitFor(() => {
        expect(monaco.editor.defineTheme).toHaveBeenCalledWith(
          'terraform-theme',
          expect.any(Object)
        );
      });
    });
  });

  describe('Performance Tests', () => {
    it('updates content within performance threshold', async () => {
      const { editorInstance } = setupMonacoMock();

      renderWithProviders(
        <CodeEditor
          moduleId="test-module"
          initialContent={LARGE_TEST_CONTENT}
        />
      );

      const updateTime = await measurePerformance(async () => {
        const changeHandler = editorInstance.onDidChangeModelContent.mock.calls[0][0];
        await changeHandler({ changes: [{ text: 'new content' }] });
      });

      expect(updateTime).toBeLessThan(200); // 200ms threshold from technical spec
    });

    it('handles real-time sync efficiently', async () => {
      const { editorInstance } = setupMonacoMock();
      const wsConfig = websocketConfig;

      renderWithProviders(
        <CodeEditor
          moduleId="test-module"
          initialContent={TEST_CONTENT}
        />
      );

      const syncTime = await measurePerformance(async () => {
        for (let i = 0; i < 10; i++) {
          const changeHandler = editorInstance.onDidChangeModelContent.mock.calls[0][0];
          await changeHandler({ changes: [{ text: `content ${i}` }] });
        }
      });

      expect(syncTime / 10).toBeLessThan(wsConfig.options.timeout || 5000);
    });
  });

  describe('Accessibility Tests', () => {
    it('meets WCAG 2.1 Level AA requirements', async () => {
      const { container } = renderWithProviders(
        <CodeEditor
          moduleId="test-module"
          initialContent={TEST_CONTENT}
          ariaLabel="Accessible Editor"
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      const { editorInstance } = setupMonacoMock();
      
      renderWithProviders(
        <CodeEditor
          moduleId="test-module"
          initialContent={TEST_CONTENT}
        />
      );

      await userEvent.tab();
      expect(editorInstance.focus).toHaveBeenCalled();

      // Verify keyboard shortcuts
      expect(editorInstance.addCommand).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Function)
      );
    });
  });

  describe('Error Handling', () => {
    it('handles WebSocket connection errors gracefully', async () => {
      const onError = jest.fn();
      
      renderWithProviders(
        <CodeEditor
          moduleId="test-module"
          initialContent={TEST_CONTENT}
          onError={onError}
        />
      );

      // Simulate WebSocket error
      const wsError = new Error('Connection failed');
      await waitFor(() => {
        expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
        expect(onError).toHaveBeenCalledWith(wsError);
      });
    });

    it('recovers from validation errors', async () => {
      const { rerender } = renderWithProviders(
        <CodeEditor
          moduleId="test-module"
          initialContent={TEST_CONTENT}
          validationErrors={[VALIDATION_ERROR]}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(VALIDATION_ERROR.message)).toBeInTheDocument();
      });

      // Clear validation errors
      rerender(
        <CodeEditor
          moduleId="test-module"
          initialContent={TEST_CONTENT}
          validationErrors={[]}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(VALIDATION_ERROR.message)).not.toBeInTheDocument();
      });
    });
  });
});