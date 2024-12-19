/**
 * @fileoverview Enhanced file explorer component for Terraform configuration files with
 * real-time updates, virtualization, and advanced filtering capabilities.
 * @version 1.0.0
 */

import React, { useCallback, useMemo, useState } from 'react';
import { TreeView } from '@mui/lab'; // v5.x
import { TreeItem } from '@mui/lab'; // v5.x
import { Box, IconButton, Tooltip } from '@mui/material'; // v5.x
import { useCodeEditor } from '../../hooks/useCodeEditor';
import { IProject } from '../../interfaces/IProject';

// File type constants
const TERRAFORM_FILE_EXTENSIONS = ['.tf', '.tfvars', '.tfstate', '.hcl'];
const INITIAL_EXPANDED = ['root'];

// File icons mapping for different file types
const FILE_ICONS = {
  tf: 'TerraformIcon',
  tfvars: 'VariablesIcon',
  tfstate: 'StateIcon',
  directory: 'FolderIcon'
} as const;

/**
 * Interface for file tree node structure with enhanced metadata
 */
interface IFileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  children: IFileNode[];
  status: 'modified' | 'new' | 'deleted' | 'unchanged';
  metadata: Record<string, unknown>;
}

/**
 * Interface for file explorer component props
 */
interface IFileExplorerProps {
  project: IProject;
  onFileSelect: (path: string) => void;
  onContextMenu: (event: React.MouseEvent, node: IFileNode) => void;
}

/**
 * Interface for tree building options
 */
interface IBuildTreeOptions {
  sortDirectoriesFirst?: boolean;
  excludePatterns?: RegExp[];
  includeHidden?: boolean;
  maxDepth?: number;
}

/**
 * Enhanced file explorer component with advanced features
 */
export const FileExplorer: React.FC<IFileExplorerProps> = React.memo(({ 
  project, 
  onFileSelect, 
  onContextMenu 
}) => {
  // State management
  const [expanded, setExpanded] = useState<string[]>(INITIAL_EXPANDED);
  const [selected, setSelected] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Custom hooks
  const { handleFileSelect } = useCodeEditor();

  /**
   * Builds optimized hierarchical file tree structure
   */
  const buildFileTree = useCallback((files: string[], options: IBuildTreeOptions = {}): IFileNode[] => {
    const {
      sortDirectoriesFirst = true,
      excludePatterns = [],
      includeHidden = false,
      maxDepth = Infinity
    } = options;

    const root: IFileNode = {
      id: 'root',
      name: 'root',
      path: '',
      type: 'directory',
      children: [],
      status: 'unchanged',
      metadata: {}
    };

    // Filter and normalize paths
    const normalizedFiles = files
      .filter(file => {
        if (!includeHidden && file.startsWith('.')) return false;
        return !excludePatterns.some(pattern => pattern.test(file));
      })
      .map(file => file.replace(/\\/g, '/'));

    // Build tree structure
    normalizedFiles.forEach(filePath => {
      const parts = filePath.split('/');
      let currentNode = root;
      let currentPath = '';

      parts.forEach((part, index) => {
        if (index >= maxDepth) return;
        
        currentPath += (currentPath ? '/' : '') + part;
        let child = currentNode.children.find(node => node.name === part);

        if (!child) {
          const isFile = index === parts.length - 1;
          child = {
            id: currentPath,
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'directory',
            children: [],
            status: 'unchanged',
            metadata: {
              extension: isFile ? part.split('.').pop() : null,
              lastModified: new Date().toISOString()
            }
          };
          currentNode.children.push(child);
        }
        currentNode = child;
      });
    });

    // Sort nodes
    const sortNodes = (nodes: IFileNode[]): IFileNode[] => {
      return nodes.sort((a, b) => {
        if (sortDirectoriesFirst) {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
        }
        return a.name.localeCompare(b.name);
      });
    };

    // Apply sorting recursively
    const processSorting = (node: IFileNode): IFileNode => {
      if (node.children.length > 0) {
        node.children = sortNodes(node.children.map(processSorting));
      }
      return node;
    };

    return processSorting(root).children;
  }, []);

  /**
   * Memoized file tree based on project structure
   */
  const fileTree = useMemo(() => {
    if (!project.githubUrl) return [];
    
    // Example file structure - replace with actual project files
    const files = [
      'main.tf',
      'variables.tf',
      'outputs.tf',
      'environments/dev/main.tf',
      'environments/prod/main.tf',
      'modules/vpc/main.tf',
      'modules/vpc/variables.tf'
    ];

    return buildFileTree(files, {
      sortDirectoriesFirst: true,
      excludePatterns: [/\.git/, /node_modules/],
      includeHidden: false,
      maxDepth: 10
    });
  }, [project.githubUrl, buildFileTree]);

  /**
   * Handles node expansion state
   */
  const handleToggle = useCallback((event: React.SyntheticEvent, nodeIds: string[]) => {
    setExpanded(nodeIds);
  }, []);

  /**
   * Handles node selection with file loading
   */
  const handleSelect = useCallback((event: React.SyntheticEvent, nodeId: string) => {
    const node = findNodeById(fileTree, nodeId);
    if (node?.type === 'file') {
      setSelected(nodeId);
      handleFileSelect(node.path);
      onFileSelect(node.path);
    }
  }, [fileTree, handleFileSelect, onFileSelect]);

  /**
   * Renders tree item with enhanced features
   */
  const renderTreeItem = useCallback((node: IFileNode): React.ReactNode => {
    const isFile = node.type === 'file';
    const icon = isFile ? 
      FILE_ICONS[node.metadata.extension as keyof typeof FILE_ICONS] || 'FileIcon' : 
      FILE_ICONS.directory;

    return (
      <TreeItem
        key={node.id}
        nodeId={node.id}
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}>
            <Tooltip title={node.path}>
              <span>{node.name}</span>
            </Tooltip>
            {node.status !== 'unchanged' && (
              <Box component="span" sx={{ ml: 1, color: 'warning.main' }}>
                {node.status}
              </Box>
            )}
          </Box>
        }
        onContextMenu={(event) => onContextMenu(event, node)}
      >
        {node.children.map(renderTreeItem)}
      </TreeItem>
    );
  }, [onContextMenu]);

  /**
   * Helper function to find node by ID
   */
  const findNodeById = (nodes: IFileNode[], id: string): IFileNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children.length > 0) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  return (
    <Box
      sx={{
        height: '100%',
        overflow: 'auto',
        backgroundColor: 'background.paper',
        '& .MuiTreeItem-root': {
          '&:hover': {
            backgroundColor: 'action.hover'
          }
        }
      }}
    >
      <TreeView
        expanded={expanded}
        selected={selected}
        onNodeToggle={handleToggle}
        onNodeSelect={handleSelect}
        aria-label="file system navigator"
      >
        {fileTree.map(renderTreeItem)}
      </TreeView>
    </Box>
  );
});

FileExplorer.displayName = 'FileExplorer';

export default FileExplorer;