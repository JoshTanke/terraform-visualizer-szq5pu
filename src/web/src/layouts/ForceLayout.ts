/**
 * @fileoverview Force-directed graph layout implementation using d3-force for Terraform
 * infrastructure visualization with optimized performance and dynamic force calculations.
 * @version 1.0.0
 */

import { 
    forceSimulation,
    forceManyBody,
    forceLink,
    forceCenter,
    forceCollide,
    Simulation,
    SimulationNodeDatum,
    SimulationLinkDatum
} from 'd3-force'; // v3.0.0
import { IGraph, INode, IEdge } from '../interfaces/IGraph';
import { calculateNodePosition } from '../utils/graphHelpers';

/**
 * Configuration options for force simulation parameters
 */
interface ForceParameters {
    centerStrength: number;
    chargeStrength: number;
    linkDistance: number;
    linkStrength: number;
    collisionRadius: number;
    alpha: number;
    alphaDecay: number;
    alphaMin: number;
    velocityDecay: number;
}

/**
 * Options for simulation updates and progress tracking
 */
interface SimulationOptions {
    maxIterations?: number;
    minStableIterations?: number;
    stabilityThreshold?: number;
    onProgress?: (progress: number) => void;
}

/**
 * Options for graph updates
 */
interface UpdateOptions {
    preservePositions?: boolean;
    incrementalUpdate?: boolean;
    recalculateForces?: boolean;
}

/**
 * Simulation status tracking
 */
interface SimulationStatus {
    isRunning: boolean;
    currentIteration: number;
    stableIterations: number;
    lastUpdateTime: number;
}

/**
 * Default force parameters optimized for Terraform infrastructure visualization
 */
const DEFAULT_FORCE_PARAMETERS: ForceParameters = {
    centerStrength: 0.1,
    chargeStrength: -1000,
    linkDistance: 150,
    linkStrength: 0.7,
    collisionRadius: 60,
    alpha: 1,
    alphaDecay: 0.0228,
    alphaMin: 0.001,
    velocityDecay: 0.4
};

/**
 * Implements force-directed graph layout algorithm using d3-force with optimized
 * performance and dynamic force calculations.
 */
export class ForceLayout {
    private simulation: Simulation<SimulationNodeDatum, SimulationLinkDatum<SimulationNodeDatum>>;
    private nodes: INode[];
    private edges: IEdge[];
    private forceParameters: ForceParameters;
    private simulationStatus: SimulationStatus;

    /**
     * Creates a new ForceLayout instance with the specified graph and parameters
     * @param graph - Input graph structure
     * @param initialParameters - Optional custom force parameters
     */
    constructor(graph: IGraph, initialParameters?: Partial<ForceParameters>) {
        this.validateGraph(graph);
        this.nodes = [...graph.nodes];
        this.edges = [...graph.edges];
        this.forceParameters = { ...DEFAULT_FORCE_PARAMETERS, ...initialParameters };
        this.simulationStatus = {
            isRunning: false,
            currentIteration: 0,
            stableIterations: 0,
            lastUpdateTime: Date.now()
        };

        this.initializeSimulation();
    }

    /**
     * Applies force simulation to calculate optimal node positions
     * @param options - Simulation options and callbacks
     * @returns Promise resolving to updated graph with new node positions
     */
    public async applyForces(options: SimulationOptions = {}): Promise<IGraph> {
        const {
            maxIterations = 300,
            minStableIterations = 10,
            stabilityThreshold = 0.001,
            onProgress
        } = options;

        return new Promise((resolve) => {
            if (this.simulationStatus.isRunning) {
                this.simulation.stop();
            }

            this.simulationStatus.isRunning = true;
            this.simulationStatus.currentIteration = 0;
            this.simulationStatus.stableIterations = 0;

            this.simulation
                .on('tick', () => {
                    this.simulationStatus.currentIteration++;
                    
                    // Check stability
                    const currentEnergy = this.simulation.alpha();
                    if (currentEnergy < stabilityThreshold) {
                        this.simulationStatus.stableIterations++;
                    } else {
                        this.simulationStatus.stableIterations = 0;
                    }

                    // Report progress
                    if (onProgress) {
                        const progress = Math.min(
                            this.simulationStatus.currentIteration / maxIterations,
                            1
                        );
                        onProgress(progress);
                    }

                    // Check termination conditions
                    if (
                        this.simulationStatus.currentIteration >= maxIterations ||
                        this.simulationStatus.stableIterations >= minStableIterations
                    ) {
                        this.simulation.stop();
                        this.updateNodePositions();
                        this.simulationStatus.isRunning = false;
                        resolve(this.getUpdatedGraph());
                    }
                })
                .restart();
        });
    }

    /**
     * Updates the layout with new graph data
     * @param graph - New graph structure
     * @param options - Update configuration options
     */
    public updateGraph(graph: IGraph, options: UpdateOptions = {}): void {
        const {
            preservePositions = true,
            incrementalUpdate = true,
            recalculateForces = true
        } = options;

        this.validateGraph(graph);

        // Preserve existing positions if requested
        if (preservePositions) {
            graph.nodes.forEach(newNode => {
                const existingNode = this.nodes.find(n => n.id === newNode.id);
                if (existingNode) {
                    newNode.position = existingNode.position;
                }
            });
        }

        // Update internal state
        this.nodes = [...graph.nodes];
        this.edges = [...graph.edges];

        // Recalculate force parameters if needed
        if (recalculateForces) {
            this.forceParameters = this.calculateForces({
                nodeCount: this.nodes.length,
                edgeCount: this.edges.length
            });
        }

        // Update simulation
        if (incrementalUpdate) {
            this.updateSimulation();
        } else {
            this.initializeSimulation();
        }
    }

    /**
     * Performs cleanup of simulation resources
     */
    public cleanup(): void {
        if (this.simulation) {
            this.simulation.stop();
            this.simulation.on('tick', null);
            this.simulation = null;
        }
        this.nodes = [];
        this.edges = [];
    }

    /**
     * Calculates optimal force parameters based on graph structure
     */
    private calculateForces(options: { nodeCount: number; edgeCount: number }): ForceParameters {
        const { nodeCount, edgeCount } = options;
        const density = edgeCount / (nodeCount * (nodeCount - 1));

        return {
            ...this.forceParameters,
            chargeStrength: -1000 * Math.log10(nodeCount + 1),
            linkDistance: 150 * (1 + density),
            centerStrength: 0.1 * Math.log10(nodeCount + 1),
            alphaDecay: 0.0228 * (1 + density)
        };
    }

    /**
     * Initializes the d3-force simulation with current parameters
     */
    private initializeSimulation(): void {
        this.simulation = forceSimulation(this.nodes as SimulationNodeDatum[])
            .force('charge', forceManyBody()
                .strength(this.forceParameters.chargeStrength))
            .force('link', forceLink(this.edges as SimulationLinkDatum<SimulationNodeDatum>[])
                .id((d: any) => d.id)
                .distance(this.forceParameters.linkDistance)
                .strength(this.forceParameters.linkStrength))
            .force('center', forceCenter()
                .strength(this.forceParameters.centerStrength))
            .force('collision', forceCollide()
                .radius(this.forceParameters.collisionRadius))
            .alpha(this.forceParameters.alpha)
            .alphaDecay(this.forceParameters.alphaDecay)
            .alphaMin(this.forceParameters.alphaMin)
            .velocityDecay(this.forceParameters.velocityDecay);
    }

    /**
     * Updates existing simulation with new data
     */
    private updateSimulation(): void {
        this.simulation
            .nodes(this.nodes as SimulationNodeDatum[]);

        (this.simulation.force('link') as any)
            .links(this.edges as SimulationLinkDatum<SimulationNodeDatum>[]);

        this.simulation.alpha(this.forceParameters.alpha).restart();
    }

    /**
     * Updates node positions after simulation
     */
    private updateNodePositions(): void {
        this.nodes.forEach(node => {
            const simNode = node as SimulationNodeDatum;
            node.position = {
                x: simNode.x || 0,
                y: simNode.y || 0
            };
        });
    }

    /**
     * Returns updated graph with current node positions
     */
    private getUpdatedGraph(): IGraph {
        return {
            nodes: this.nodes,
            edges: this.edges,
            layout: this.nodes[0]?.metadata?.layout || 'force',
            viewport: {
                x: 0,
                y: 0,
                zoom: 1
            },
            metadata: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: '1.0.0',
                name: 'force-layout',
                nodeCount: this.nodes.length,
                edgeCount: this.edges.length
            }
        };
    }

    /**
     * Validates input graph structure
     */
    private validateGraph(graph: IGraph): void {
        if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
            throw new Error('Invalid graph structure: missing nodes or edges arrays');
        }
        if (graph.nodes.some(node => !node.id || !node.position)) {
            throw new Error('Invalid node structure: missing required properties');
        }
        if (graph.edges.some(edge => !edge.id || !edge.source || !edge.target)) {
            throw new Error('Invalid edge structure: missing required properties');
        }
    }
}