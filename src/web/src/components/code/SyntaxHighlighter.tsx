/**
 * @fileoverview High-performance syntax highlighting component for Terraform HCL code
 * using Monaco Editor with optimized configuration and real-time validation support.
 * @version 1.0.0
 */

import React, { useEffect, useRef, useCallback, memo } from 'react';
import * as monaco from 'monaco-editor'; // v0.34.x
import { Box } from '@mui/material'; // v5.x
import { debounce } from 'lodash'; // v4.x
import { language, theme } from './MonacoConfig';
import { validateModuleConfiguration } from '../../utils/terraformHelpers';

// Global constants for editor configuration
const EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: true },
  lineNumbers: 'on',
  folding: true,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  renderValidationDecorations: 'on',
  suggest: {
    snippetsPreventQuickSuggestions: false,
    showWords: true
  },
  accessibilitySupport: 'on',
  fontSize: 14,
  tabSize: 2,
  wordWrap: 'on',
  formatOnPaste: true,
  formatOnType: true
};

// Interface for validation errors
interface ValidationError {
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
}

// Props interface for the component
interface ISyntaxHighlighterProps {
  code: string;
  onChange: (value: string) => void;
  onValidation?: (errors: ValidationError[]) => void;
  readOnly?: boolean;
  height?: string | number;
  width?: string | number;
}

/**
 * High-performance syntax highlighter component for Terraform HCL code
 * with real-time validation and accessibility support.
 */
const SyntaxHighlighter: React.FC<ISyntaxHighlighterProps> = memo(({
  code,
  onChange,
  onValidation,
  readOnly = false,
  height = '100%',
  width = '100%'
}) => {
  // Refs for editor instance and container
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Debounced validation handler to prevent excessive validation calls
   */
  const debouncedValidate = useCallback(
    debounce(async (value: string) => {
      try {
        const moduleConfig = JSON.parse(value);
        const isValid = await validateModuleConfiguration(moduleConfig);
        
        if (!isValid && onValidation) {
          onValidation([{
            message: 'Invalid module configuration',
            line: 1,
            column: 1,
            severity: 'error'
          }]);
        }
      } catch (error) {
        console.error('Validation error:', error);
      }
    }, 200),
    [onValidation]
  );

  /**
   * Debounced change handler to prevent excessive updates
   */
  const debouncedOnChange = useCallback(
    debounce((value: string) => {
      onChange(value);
      debouncedValidate(value);
    }, 200),
    [onChange, debouncedValidate]
  );

  /**
   * Initialize Monaco editor with Terraform language support
   */
  const setupMonacoLanguage = useCallback(() => {
    // Register the Terraform language
    monaco.languages.register({
      id: language.id,
      extensions: ['.tf', '.tfvars'],
      aliases: ['terraform', 'tf', 'hcl']
    });

    // Register the language configuration
    monaco.languages.setMonarchTokensProvider(language.id, language.configuration);

    // Register the theme
    monaco.editor.defineTheme('terraform-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: theme.rules,
      colors: theme.colors
    });
  }, []);

  /**
   * Initialize editor instance
   */
  useEffect(() => {
    if (!containerRef.current) return;

    setupMonacoLanguage();

    // Create editor instance
    editorRef.current = monaco.editor.create(containerRef.current, {
      ...EDITOR_OPTIONS,
      value: code,
      language: language.id,
      theme: 'terraform-dark',
      readOnly,
      'aria-label': 'Terraform code editor'
    });

    // Set up change handler
    editorRef.current.onDidChangeModelContent(() => {
      if (editorRef.current) {
        const value = editorRef.current.getValue();
        debouncedOnChange(value);
      }
    });

    // Cleanup
    return () => {
      debouncedOnChange.cancel();
      debouncedValidate.cancel();
      if (editorRef.current) {
        editorRef.current.dispose();
      }
    };
  }, [code, readOnly, setupMonacoLanguage, debouncedOnChange, debouncedValidate]);

  /**
   * Update editor value when code prop changes
   */
  useEffect(() => {
    if (editorRef.current) {
      const currentValue = editorRef.current.getValue();
      if (currentValue !== code) {
        editorRef.current.setValue(code);
      }
    }
  }, [code]);

  /**
   * Handle editor layout updates on container resize
   */
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <Box
      ref={containerRef}
      sx={{
        width,
        height,
        overflow: 'hidden',
        '& .monaco-editor': {
          paddingTop: 1,
          paddingBottom: 1
        },
        '& .monaco-editor .margin': {
          backgroundColor: 'transparent'
        }
      }}
      role="textbox"
      aria-multiline="true"
      aria-label="Terraform code editor"
    />
  );
});

SyntaxHighlighter.displayName = 'SyntaxHighlighter';

export default SyntaxHighlighter;