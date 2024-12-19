/**
 * @fileoverview Monaco-based code editor component for Terraform configurations with
 * real-time validation, WebSocket synchronization, and accessibility features.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'; // v18.x
import { Editor } from '@monaco-editor/react'; // v4.5.x
import { Box, useTheme } from '@mui/material'; // v5.x
import { usePerformanceMonitor } from '@datadog/browser-rum'; // v4.x

import { language, theme } from './MonacoConfig';
import useCodeEditor from '../../hooks/useCodeEditor';
import ValidationPanel from './ValidationPanel';
import LoadingSpinner from '../common/LoadingSpinner';
import useWebSocket from '../../hooks/useWebSocket';

// Constants for performance optimization
const CONTENT_UPDATE_DEBOUNCE = 200;
const PERFORMANCE_THRESHOLDS = {
  contentUpdate: 200,
  syncDelay: 100,
  renderTime: 50
};

// Editor configuration options
const EDITOR_OPTIONS = {
  minimap: { enabled: true },
  wordWrap: 'on',
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  accessibilitySupport: 'on',
  tabSize: 2,
  fontSize: 14,
  renderWhitespace: 'boundary'
};

/**
 * Props interface for CodeEditor component
 */
interface ICodeEditorProps {
  moduleId: string;
  initialContent?: string;
  readOnly?: boolean;
  onContentChange?: (content: string) => void;
  onValidationChange?: (hasErrors: boolean) => void;
  ariaLabel?: string;
}

/**
 * Monaco-based code editor component for Terraform configurations with real-time
 * validation, WebSocket synchronization, and accessibility features.
 */
const CodeEditor: React.FC<ICodeEditorProps> = ({
  moduleId,
  initialContent = '',
  readOnly = false,
  onContentChange,
  onValidationChange,
  ariaLabel = 'Terraform Configuration Editor'
}) => {
  // Theme and performance monitoring
  const theme = useTheme();
  const { startInteraction, endInteraction } = usePerformanceMonitor();

  // Editor state management
  const editorRef = useRef<any>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Custom hooks for editor and WebSocket functionality
  const {
    content,
    settings,
    validationErrors,
    handleContentChange,
    performanceMetrics
  } = useCodeEditor();

  const {
    isConnected: wsConnected,
    emit: wsSend,
    subscribe: wsSubscribe
  } = useWebSocket({
    autoConnect: true,
    onError: (error) => console.error('WebSocket error:', error)
  });

  /**
   * Handles editor initialization and configuration
   */
  const handleEditorDidMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;

    // Register Terraform language support
    monaco.languages.register({
      id: language.id,
      extensions: language.extensions,
      aliases: language.aliases
    });

    monaco.languages.setMonarchTokensProvider(language.id, language.configuration);
    monaco.editor.defineTheme('terraform-theme', theme);

    // Configure accessibility features
    editor.updateOptions({
      ...EDITOR_OPTIONS,
      accessibilitySupport: 'on',
      ariaLabel: ariaLabel,
      tabIndex: 0,
      readOnly: readOnly
    });

    // Set up keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleContentChange(editor.getValue());
    });

    setIsEditorReady(true);
  }, [ariaLabel, readOnly, handleContentChange]);

  /**
   * Handles content changes with performance monitoring and WebSocket sync
   */
  const handleChange = useCallback((value: string | undefined) => {
    if (!value) return;

    startInteraction('editor.contentUpdate');
    const startTime = performance.now();

    try {
      handleContentChange(value);

      // Sync changes via WebSocket if connected
      if (wsConnected) {
        wsSend('code.update', {
          moduleId,
          content: value
        });
      }

      const updateTime = performance.now() - startTime;
      if (updateTime > PERFORMANCE_THRESHOLDS.contentUpdate) {
        console.warn(`Content update took ${updateTime}ms`);
      }

    } catch (error) {
      console.error('Error handling content change:', error);
    } finally {
      endInteraction();
    }
  }, [moduleId, wsConnected, handleContentChange, startInteraction, endInteraction]);

  /**
   * Sets up WebSocket subscriptions for real-time updates
   */
  useEffect(() => {
    if (!wsConnected) return;

    const unsubscribe = wsSubscribe('code.update', (data: { content: string }) => {
      if (data.content !== content) {
        handleContentChange(data.content);
      }
    });

    return () => unsubscribe();
  }, [wsConnected, content, handleContentChange]);

  /**
   * Updates validation status
   */
  useEffect(() => {
    onValidationChange?.(validationErrors.length > 0);
  }, [validationErrors, onValidationChange]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper'
      }}
    >
      {!isEditorReady && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%'
          }}
        >
          <LoadingSpinner
            size={40}
            message="Initializing code editor..."
          />
        </Box>
      )}

      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          '& .monaco-editor': {
            paddingTop: 1
          }
        }}
      >
        <Editor
          height="100%"
          defaultLanguage={language.id}
          defaultValue={initialContent}
          theme="terraform-theme"
          options={{
            ...EDITOR_OPTIONS,
            readOnly,
            minimap: { enabled: settings.minimap }
          }}
          onMount={handleEditorDidMount}
          onChange={handleChange}
          loading={<LoadingSpinner size={40} />}
        />
      </Box>

      <ValidationPanel
        code={content}
        moduleId={moduleId}
        onFix={(line, error) => {
          editorRef.current?.revealLineInCenter(line);
          editorRef.current?.focus();
        }}
      />
    </Box>
  );
};

export default CodeEditor;