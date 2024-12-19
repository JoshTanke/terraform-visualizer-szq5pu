import { z } from 'zod'; // v3.0.0
import { parse as parseHCL } from 'hcl2-parser'; // v1.0.0
import { IModule } from '../../interfaces/IModule';
import { HCLParser } from './HCLParser';
import { ModuleBlock } from './blocks/ModuleBlock';
import { ValidationError } from '../utils/errors';
import { Logger } from '../utils/logger';

// Constants for performance optimization and caching
const PARSE_TIMEOUT = 3000; // 3 seconds timeout for parsing operations
const MAX_NESTED_DEPTH = 5; // Maximum depth for nested module parsing
const CACHE_EXPIRY = 300000; // 5 minutes cache expiry
const MAX_CACHE_SIZE = 100; // Maximum number of cached entries

/**
 * High-level parser class for handling complete Terraform module configurations
 * with enhanced visualization support and performance optimization.
 */
export class ModuleParser {
    private readonly hclParser: HCLParser;
    private readonly moduleBlockParser: ModuleBlock;
    private readonly content: string;
    private readonly parsedModules: Map<string, IModule>;
    private readonly moduleCache: Map<string, { data: IModule; timestamp: number }>;
    private readonly positionCache: Map<string, { x: number; y: number }>;
    private readonly logger: Logger;

    /**
     * Initializes a new ModuleParser instance with caching support
     * @param content - Raw Terraform configuration content
     */
    constructor(content: string) {
        this.content = content;
        this.hclParser = new HCLParser(content, Logger.getInstance());
        this.moduleBlockParser = new ModuleBlock(content, { x: 0, y: 0 });
        this.parsedModules = new Map();
        this.moduleCache = new Map();
        this.positionCache = new Map();
        this.logger = Logger.getInstance();
    }

    /**
     * Parses a complete module configuration with visualization metadata
     * @returns Promise resolving to parsed and validated module configuration
     */
    public async parseModule(): Promise<IModule> {
        const startTime = Date.now();
        try {
            // Check module cache first
            const cacheKey = this.generateCacheKey();
            const cached = this.moduleCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY) {
                this.logger.debug('Using cached module parse result', { cacheKey });
                return cached.data;
            }

            // Parse complete HCL content
            const parsedContent = await this.hclParser.parse();

            // Extract and parse module blocks
            const moduleBlocks = parsedContent.modules;
            const parsedModules: IModule[] = [];

            // Process each module block with position tracking
            for (const [moduleName, moduleContent] of moduleBlocks.entries()) {
                const position = this.calculateModulePosition(moduleName);
                const moduleBlock = new ModuleBlock(JSON.stringify(moduleContent), position);
                
                const parsedModule = await moduleBlock.parse();
                if (parsedModule) {
                    parsedModules.push(parsedModule as IModule);
                }
            }

            // Parse nested modules recursively
            const nestedModules = await this.parseNestedModules(parsedContent);
            parsedModules.push(...nestedModules);

            // Build complete module structure
            const moduleStructure: IModule = {
                _id: undefined!, // Will be set by database layer
                environmentId: undefined!, // Will be set by environment context
                name: parsedContent.name || 'root',
                source: parsedContent.source || '.',
                version: parsedContent.version || '1.0.0',
                description: parsedContent.description || '',
                configuration: parsedContent.configuration || {},
                resources: parsedContent.resources || [],
                variables: parsedContent.variables || {},
                outputs: parsedContent.outputs || {},
                position: { x: 0, y: 0 }, // Root module position
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Validate complete module configuration
            await this.validateModuleConfiguration(moduleStructure);

            // Cache successful parse result
            this.moduleCache.set(cacheKey, {
                data: moduleStructure,
                timestamp: Date.now()
            });

            // Maintain cache size
            if (this.moduleCache.size > MAX_CACHE_SIZE) {
                const oldestKey = Array.from(this.moduleCache.keys())[0];
                this.moduleCache.delete(oldestKey);
            }

            this.logger.info('Module parsing completed', {
                duration: Date.now() - startTime,
                moduleCount: parsedModules.length
            });

            return moduleStructure;

        } catch (error) {
            this.logger.error('Module parsing failed', {
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    /**
     * Validates a complete module configuration with enhanced error reporting
     * @param moduleConfig - Module configuration to validate
     * @returns Promise resolving to validation result
     */
    private async validateModuleConfiguration(moduleConfig: IModule): Promise<boolean> {
        const moduleSchema = z.object({
            name: z.string().min(1),
            source: z.string(),
            version: z.string().optional(),
            description: z.string().optional(),
            configuration: z.record(z.unknown()),
            resources: z.array(z.unknown()),
            variables: z.record(z.unknown()),
            outputs: z.record(z.unknown()),
            position: z.object({
                x: z.number(),
                y: z.number()
            })
        });

        try {
            await moduleSchema.parseAsync(moduleConfig);

            // Additional validation rules
            if (moduleConfig.resources.length === 0) {
                this.logger.warn('Module contains no resources', { moduleName: moduleConfig.name });
            }

            // Validate resource references
            for (const resource of moduleConfig.resources) {
                if (resource.dependencies) {
                    for (const dep of resource.dependencies) {
                        if (!this.parsedModules.has(dep.toString())) {
                            throw new ValidationError(
                                [{
                                    field: 'dependencies',
                                    message: `Invalid resource reference: ${dep}`
                                }],
                                'reference'
                            );
                        }
                    }
                }
            }

            return true;
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new ValidationError(
                    error.errors.map(err => ({
                        field: err.path.join('.'),
                        message: err.message
                    })),
                    'schema'
                );
            }
            throw error;
        }
    }

    /**
     * Recursively parses nested module configurations
     * @param moduleContent - Parent module content
     * @returns Promise resolving to array of parsed nested modules
     */
    private async parseNestedModules(moduleContent: Record<string, any>): Promise<IModule[]> {
        const nestedModules: IModule[] = [];
        const processedPaths = new Set<string>();

        const parseNested = async (content: any, depth: number = 0): Promise<void> => {
            if (depth >= MAX_NESTED_DEPTH) {
                this.logger.warn('Maximum nested module depth reached', { depth });
                return;
            }

            if (content.module) {
                for (const [moduleName, moduleData] of Object.entries(content.module)) {
                    const modulePath = `${content.source}/${moduleName}`;
                    if (processedPaths.has(modulePath)) continue;
                    processedPaths.add(modulePath);

                    const position = this.calculateModulePosition(moduleName, depth);
                    const moduleBlock = new ModuleBlock(JSON.stringify(moduleData), position);
                    
                    try {
                        const parsedModule = await moduleBlock.parse();
                        if (parsedModule) {
                            nestedModules.push(parsedModule as IModule);
                            await parseNested(moduleData, depth + 1);
                        }
                    } catch (error) {
                        this.logger.error('Failed to parse nested module', {
                            modulePath,
                            error: error.message
                        });
                    }
                }
            }
        };

        await parseNested(moduleContent);
        return nestedModules;
    }

    /**
     * Calculates optimal position for module visualization
     * @param moduleName - Name of the module
     * @param depth - Nesting depth of the module
     * @returns Calculated position coordinates
     */
    private calculateModulePosition(moduleName: string, depth: number = 0): { x: number; y: number } {
        const cacheKey = `${moduleName}_${depth}`;
        if (this.positionCache.has(cacheKey)) {
            return this.positionCache.get(cacheKey)!;
        }

        const position = {
            x: 200 * (depth + 1),
            y: 150 * (this.positionCache.size % 4)
        };

        this.positionCache.set(cacheKey, position);
        return position;
    }

    /**
     * Generates cache key for module parsing results
     * @returns Cache key string
     */
    private generateCacheKey(): string {
        return `${this.content.length}_${this.content.slice(0, 100)}`;
    }
}

export default ModuleParser;