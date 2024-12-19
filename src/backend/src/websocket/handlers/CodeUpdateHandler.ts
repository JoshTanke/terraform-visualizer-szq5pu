// External dependencies
import WebSocket from 'ws'; // v8.2.3
import { debounce } from 'lodash'; // v4.17.21
import CircuitBreaker from 'opossum'; // v6.0.0

// Internal dependencies
import { TerraformParser } from '../../parser/TerraformParser';
import { GraphService } from '../../services/GraphService';
import { logger } from '../../utils/logger';

// Constants for performance and reliability
const PARSE_TIMEOUT_MS = 3000;
const UPDATE_DEBOUNCE_MS = 500;
const MAX_CODE_SIZE_BYTES = 1048576; // 1MB
const MAX_UPDATE_ATTEMPTS = 3;
const HEALTH_CHECK_INTERVAL_MS = 30000;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_TIMEOUT = 30000;

/**
 * Enhanced handler for real-time code updates with production-ready features
 * including performance monitoring, security controls, and robust error handling.
 */
export class CodeUpdateHandler {
    private graphService: GraphService;
    private clientGraphMap: Map<string, string>;
    private parseBreaker: CircuitBreaker;
    private updateAttempts: Map<string, number>;
    private healthChecks: Map<string, NodeJS.Timeout>;

    /**
     * Initializes the code update handler with enhanced production features
     */
    constructor() {
        this.graphService = GraphService.getInstance();
        this.clientGraphMap = new Map();
        this.updateAttempts = new Map();
        this.healthChecks = new Map();

        // Initialize circuit breaker for parse operations
        this.parseBreaker = new CircuitBreaker(
            async (code: string) => {
                const parser = new TerraformParser(code);
                return await parser.parseConfiguration();
            },
            {
                timeout: PARSE_TIMEOUT_MS,
                errorThresholdPercentage: CIRCUIT_BREAKER_THRESHOLD,
                resetTimeout: CIRCUIT_BREAKER_RESET_TIMEOUT
            }
        );

        // Circuit breaker event handlers
        this.parseBreaker.on('open', () => {
            logger.warn('Parse circuit breaker opened due to failures');
        });

        this.parseBreaker.on('halfOpen', () => {
            logger.info('Parse circuit breaker attempting reset');
        });

        this.parseBreaker.on('close', () => {
            logger.info('Parse circuit breaker closed, service recovered');
        });
    }

    /**
     * Processes code updates with enhanced error handling and performance monitoring
     * @param client WebSocket client connection
     * @param clientId Unique client identifier
     * @param code Updated Terraform configuration code
     */
    @debounce(UPDATE_DEBOUNCE_MS)
    public async handleCodeUpdate(
        client: WebSocket,
        clientId: string,
        code: string
    ): Promise<void> {
        const startTime = Date.now();
        
        try {
            // Validate input size
            if (Buffer.byteLength(code, 'utf8') > MAX_CODE_SIZE_BYTES) {
                throw new Error('Code size exceeds maximum limit');
            }

            // Track update attempts
            const attempts = this.updateAttempts.get(clientId) || 0;
            if (attempts >= MAX_UPDATE_ATTEMPTS) {
                logger.error('Maximum update attempts exceeded', { clientId });
                throw new Error('Maximum update attempts exceeded');
            }
            this.updateAttempts.set(clientId, attempts + 1);

            // Parse configuration with circuit breaker protection
            const parsedConfig = await this.parseBreaker.fire(code);

            // Get associated graph ID
            const graphId = this.clientGraphMap.get(clientId);
            if (!graphId) {
                throw new Error('No graph association found for client');
            }

            // Update graph visualization
            await this.graphService.updateGraph(graphId, {
                nodes: parsedConfig.resources,
                edges: parsedConfig.dependencies,
                layout: parsedConfig.metadata.layout,
                layoutConfig: parsedConfig.metadata.layoutConfig,
                metadata: {
                    ...parsedConfig.metadata,
                    parseTime: Date.now() - startTime
                }
            });

            // Reset update attempts on success
            this.updateAttempts.set(clientId, 0);

            logger.info('Code update processed successfully', {
                clientId,
                duration: Date.now() - startTime,
                configSize: Buffer.byteLength(code, 'utf8')
            });

        } catch (error) {
            logger.error('Code update processing failed', {
                error: error.message,
                clientId,
                duration: Date.now() - startTime
            });

            // Send error notification to client
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'error',
                    message: 'Failed to process code update',
                    details: error.message
                }));
            }
        }
    }

    /**
     * Associates client with graph and sets up monitoring
     * @param clientId Client identifier
     * @param graphId Graph identifier
     */
    public associateClientWithGraph(clientId: string, graphId: string): void {
        if (!clientId || !graphId) {
            throw new Error('Invalid client or graph ID');
        }

        this.clientGraphMap.set(clientId, graphId);
        
        // Setup health check monitoring
        const healthCheck = setInterval(
            () => this.monitorConnectionHealth(client, clientId),
            HEALTH_CHECK_INTERVAL_MS
        );
        
        this.healthChecks.set(clientId, healthCheck);

        logger.info('Client associated with graph', { clientId, graphId });
    }

    /**
     * Removes client association with enhanced cleanup
     * @param clientId Client identifier
     */
    public removeClientAssociation(clientId: string): void {
        // Clear health check interval
        const healthCheck = this.healthChecks.get(clientId);
        if (healthCheck) {
            clearInterval(healthCheck);
            this.healthChecks.delete(clientId);
        }

        // Remove client mappings
        this.clientGraphMap.delete(clientId);
        this.updateAttempts.delete(clientId);

        logger.info('Client association removed', { clientId });
    }

    /**
     * Monitors WebSocket connection health
     * @param client WebSocket client
     * @param clientId Client identifier
     */
    private monitorConnectionHealth(client: WebSocket, clientId: string): void {
        if (client.readyState !== WebSocket.OPEN) {
            logger.warn('Client connection unhealthy', { clientId });
            this.removeClientAssociation(clientId);
            return;
        }

        client.ping('', false, (error) => {
            if (error) {
                logger.error('Client ping failed', { clientId, error });
                this.removeClientAssociation(clientId);
            }
        });
    }
}

export default CodeUpdateHandler;