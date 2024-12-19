// External dependencies
import Joi from 'joi'; // v17.9.0

// Internal dependencies
import { 
  IGraph, 
  INode, 
  IEdge, 
  LayoutType, 
  NodeType, 
  EdgeType, 
  ValidationStatus 
} from '../../interfaces/IGraph';
import { validateSchema } from '../../utils/validation';
import { ValidationError } from '../../utils/errors';
import { Logger } from '../../utils/logger';

// Initialize logger
const logger = Logger.getInstance();

// Constants for validation
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_NODES = 1000;
const MAX_EDGES = 2000;
const POSITION_BOUNDS = {
  min: -10000,
  max: 10000
};

// Schema Definitions
const NODE_STYLE_SCHEMA = Joi.object({
  width: Joi.number().min(10).max(500).optional(),
  height: Joi.number().min(10).max(500).optional(),
  backgroundColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  borderColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  borderWidth: Joi.number().min(0).max(10).optional(),
  borderStyle: Joi.string().valid('solid', 'dashed', 'dotted').optional(),
  opacity: Joi.number().min(0).max(1).optional(),
  icon: Joi.string().uri().optional(),
  fontSize: Joi.number().min(8).max(32).optional(),
  fontFamily: Joi.string().optional(),
  zIndex: Joi.number().optional()
}).optional();

const EDGE_STYLE_SCHEMA = Joi.object({
  strokeWidth: Joi.number().min(1).max(10).optional(),
  strokeColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  strokeStyle: Joi.string().valid('solid', 'dashed', 'dotted').optional(),
  opacity: Joi.number().min(0).max(1).optional(),
  animated: Joi.boolean().optional(),
  labelFontSize: Joi.number().min(8).max(24).optional(),
  labelFontFamily: Joi.string().optional(),
  zIndex: Joi.number().optional()
}).optional();

const NODE_METADATA_SCHEMA = Joi.object({
  resourceId: Joi.string().pattern(UUID_PATTERN).optional(),
  moduleId: Joi.string().pattern(UUID_PATTERN).optional(),
  environmentId: Joi.string().pattern(UUID_PATTERN).optional(),
  description: Joi.string().max(500).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
}).optional();

const EDGE_METADATA_SCHEMA = Joi.object({
  description: Joi.string().max(500).optional(),
  dependencyType: Joi.string().max(50).optional(),
  isRequired: Joi.boolean().optional(),
  validationErrors: Joi.array().items(Joi.string()).optional()
}).optional();

const GRAPH_NODE_SCHEMA = Joi.object({
  id: Joi.string().pattern(UUID_PATTERN).required(),
  type: Joi.string().valid(...Object.values(NodeType)).required(),
  data: Joi.object().required(),
  position: Joi.object({
    x: Joi.number().min(POSITION_BOUNDS.min).max(POSITION_BOUNDS.max).required(),
    y: Joi.number().min(POSITION_BOUNDS.min).max(POSITION_BOUNDS.max).required()
  }).required(),
  validationStatus: Joi.string().valid(...Object.values(ValidationStatus)).required(),
  style: NODE_STYLE_SCHEMA,
  metadata: NODE_METADATA_SCHEMA
});

const GRAPH_EDGE_SCHEMA = Joi.object({
  id: Joi.string().pattern(UUID_PATTERN).required(),
  source: Joi.string().pattern(UUID_PATTERN).required(),
  target: Joi.string().pattern(UUID_PATTERN).required(),
  type: Joi.string().valid(...Object.values(EdgeType)).required(),
  weight: Joi.number().min(0).max(10).required(),
  style: EDGE_STYLE_SCHEMA,
  metadata: EDGE_METADATA_SCHEMA
});

const GRAPH_SCHEMA = Joi.object({
  nodes: Joi.array().items(GRAPH_NODE_SCHEMA).max(MAX_NODES).required(),
  edges: Joi.array().items(GRAPH_EDGE_SCHEMA).max(MAX_EDGES).required(),
  layout: Joi.string().valid(...Object.values(LayoutType)).required(),
  layoutConfig: Joi.object().optional(),
  metadata: Joi.object({
    id: Joi.string().pattern(UUID_PATTERN).required(),
    name: Joi.string().max(100).required(),
    description: Joi.string().max(500).optional(),
    level: Joi.string().valid('pipeline', 'environment', 'module').required(),
    version: Joi.string().optional(),
    createdAt: Joi.date().required(),
    updatedAt: Joi.date().required(),
    nodeCount: Joi.number().integer().min(0).max(MAX_NODES).required(),
    edgeCount: Joi.number().integer().min(0).max(MAX_EDGES).required(),
    validationStatus: Joi.string().valid(...Object.values(ValidationStatus)).required()
  }).required()
});

/**
 * Validates a single graph node structure and data with comprehensive checks for node integrity
 * @param node The node to validate
 * @returns Promise resolving to true if valid, throws ValidationError otherwise
 */
export async function validateGraphNode(node: INode): Promise<boolean> {
  try {
    logger.debug('Validating graph node', { nodeId: node.id, nodeType: node.type });
    
    await validateSchema(node, GRAPH_NODE_SCHEMA);

    // Additional validation based on node type
    switch (node.type) {
      case NodeType.RESOURCE:
        if (!node.metadata?.resourceId) {
          throw new ValidationError([{ 
            field: 'metadata.resourceId', 
            message: 'Resource nodes must have a resourceId' 
          }], 'node');
        }
        break;
      case NodeType.MODULE:
        if (!node.metadata?.moduleId) {
          throw new ValidationError([{ 
            field: 'metadata.moduleId', 
            message: 'Module nodes must have a moduleId' 
          }], 'node');
        }
        break;
      case NodeType.ENVIRONMENT:
        if (!node.metadata?.environmentId) {
          throw new ValidationError([{ 
            field: 'metadata.environmentId', 
            message: 'Environment nodes must have an environmentId' 
          }], 'node');
        }
        break;
    }

    return true;
  } catch (error) {
    logger.error('Node validation failed', { 
      nodeId: node.id, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Validates a single graph edge structure and connections ensuring proper node relationships
 * @param edge The edge to validate
 * @returns Promise resolving to true if valid, throws ValidationError otherwise
 */
export async function validateGraphEdge(edge: IEdge): Promise<boolean> {
  try {
    logger.debug('Validating graph edge', { 
      edgeId: edge.id, 
      source: edge.source, 
      target: edge.target 
    });

    await validateSchema(edge, GRAPH_EDGE_SCHEMA);

    // Validate that source and target are different
    if (edge.source === edge.target) {
      throw new ValidationError([{
        field: 'source/target',
        message: 'Edge source and target cannot be the same node'
      }], 'edge');
    }

    return true;
  } catch (error) {
    logger.error('Edge validation failed', { 
      edgeId: edge.id, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Validates complete graph structure including nodes, edges, and their relationships
 * @param graph The graph structure to validate
 * @returns Promise resolving to true if valid, throws ValidationError otherwise
 */
export async function validateGraphStructure(graph: IGraph): Promise<boolean> {
  try {
    logger.debug('Validating graph structure', { 
      nodeCount: graph.nodes.length, 
      edgeCount: graph.edges.length 
    });

    // Validate overall graph structure
    await validateSchema(graph, GRAPH_SCHEMA);

    // Validate node count matches metadata
    if (graph.nodes.length !== graph.metadata.nodeCount) {
      throw new ValidationError([{
        field: 'metadata.nodeCount',
        message: 'Node count in metadata does not match actual number of nodes'
      }], 'graph');
    }

    // Validate edge count matches metadata
    if (graph.edges.length !== graph.metadata.edgeCount) {
      throw new ValidationError([{
        field: 'metadata.edgeCount',
        message: 'Edge count in metadata does not match actual number of edges'
      }], 'graph');
    }

    // Validate all nodes
    await Promise.all(graph.nodes.map(validateGraphNode));

    // Validate all edges
    await Promise.all(graph.edges.map(validateGraphEdge));

    // Create node ID set for quick lookup
    const nodeIds = new Set(graph.nodes.map(node => node.id));

    // Validate all edge references exist
    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.source)) {
        throw new ValidationError([{
          field: 'edges',
          message: `Edge source node ${edge.source} does not exist`
        }], 'graph');
      }
      if (!nodeIds.has(edge.target)) {
        throw new ValidationError([{
          field: 'edges',
          message: `Edge target node ${edge.target} does not exist`
        }], 'graph');
      }
    }

    // Validate graph is not empty
    if (graph.nodes.length === 0) {
      throw new ValidationError([{
        field: 'nodes',
        message: 'Graph must contain at least one node'
      }], 'graph');
    }

    return true;
  } catch (error) {
    logger.error('Graph validation failed', { error: error.message });
    throw error;
  }
}