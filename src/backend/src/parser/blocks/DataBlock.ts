// External dependencies
import { parse as parseHCL } from 'hcl2-parser'; // v1.0.0

// Internal dependencies
import { IResource } from '../../interfaces/IResource';
import { ParseError } from '../../utils/errors';
import { validateResourceReferences } from '../../utils/validation';
import { Logger } from '../../utils/logger';

/**
 * Enhanced parser class for handling Terraform data blocks with comprehensive validation
 * and error handling capabilities. Implements performance optimization and monitoring.
 */
export class DataBlock {
  private readonly type: string;
  private readonly name: string;
  private readonly attributes: Record<string, any>;
  private readonly logger: Logger;

  /**
   * Creates a new DataBlock instance with logging capabilities
   * @param type - The type of the data source
   * @param name - The name identifier for the data block
   * @param attributes - Configuration attributes for the data source
   */
  constructor(type: string, name: string, attributes: Record<string, any>) {
    this.logger = Logger.getInstance();
    
    // Validate input parameters
    if (!type || !name) {
      throw new ParseError(
        'Data block requires both type and name',
        { type, name },
        'data_block_constructor',
        []
      );
    }

    this.type = type;
    this.name = name;
    this.attributes = attributes || {};

    this.logger.debug('Initialized data block', {
      type: this.type,
      name: this.name,
      attributeCount: Object.keys(this.attributes).length
    });
  }

  /**
   * Parses a data block from HCL configuration with enhanced error handling
   * @param blockConfig - The HCL block configuration to parse
   * @returns Parsed data block as a resource
   */
  public async parse(blockConfig: any): Promise<IResource> {
    const startTime = Date.now();
    this.logger.debug('Starting data block parse', { 
      type: this.type,
      name: this.name 
    });

    try {
      // Extract data block configuration
      const { type, name, ...config } = blockConfig;

      // Validate data source type format
      if (!type.match(/^[a-zA-Z0-9_]+_[a-zA-Z0-9_]+$/)) {
        throw new ParseError(
          'Invalid data source type format',
          { type },
          'data_block_parse',
          [{
            line: blockConfig.line || 0,
            column: blockConfig.column || 0,
            message: 'Data source type must follow provider_type format'
          }]
        );
      }

      // Parse and validate attributes
      const parsedAttributes = await this.parseAttributes(config);

      // Validate data source references
      await this.validateReferences(parsedAttributes);

      // Create resource representation
      const resource = this.toResource();

      this.logger.debug('Successfully parsed data block', {
        type: this.type,
        name: this.name,
        duration: Date.now() - startTime
      });

      return resource;

    } catch (error) {
      this.logger.error('Failed to parse data block', {
        type: this.type,
        name: this.name,
        error: error.message,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Performs comprehensive validation of data block configuration
   * @returns Validation result
   */
  public async validate(): Promise<boolean> {
    try {
      // Validate required fields
      if (!this.type || !this.name) {
        throw new ParseError(
          'Missing required fields',
          { type: this.type, name: this.name },
          'data_block_validation',
          []
        );
      }

      // Validate attribute types and values
      for (const [key, value] of Object.entries(this.attributes)) {
        if (value === undefined || value === null) {
          throw new ParseError(
            `Invalid attribute value for ${key}`,
            { key, value },
            'data_block_validation',
            []
          );
        }
      }

      // Validate data source references
      await this.validateReferences(this.attributes);

      return true;

    } catch (error) {
      this.logger.error('Data block validation failed', {
        type: this.type,
        name: this.name,
        error: error.message
      });

      return false;
    }
  }

  /**
   * Converts data block to resource representation with enhanced properties
   * @returns Resource representation of data block
   */
  public toResource(): IResource {
    const resource: Partial<IResource> = {
      type: `data.${this.type}`,
      name: this.name,
      provider: this.type.split('_')[0],
      attributes: this.attributes,
      dependencies: [],
      validation: {
        isValid: true,
        errors: [],
        warnings: []
      },
      metadata: {
        icon: `data_${this.type}`,
        color: '#4A90E2',
        description: `Data source: ${this.type}`
      },
      position: {
        x: 0,
        y: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return resource as IResource;
  }

  /**
   * Parses and validates data block attributes
   * @param config - Raw attribute configuration
   * @returns Parsed attributes
   */
  private async parseAttributes(config: any): Promise<Record<string, any>> {
    try {
      const parsedConfig = await parseHCL(JSON.stringify(config));
      return parsedConfig.attributes || {};
    } catch (error) {
      throw new ParseError(
        'Failed to parse data block attributes',
        config,
        'data_block_attributes',
        [{
          line: config.line || 0,
          column: config.column || 0,
          message: error.message
        }]
      );
    }
  }

  /**
   * Validates data source references and dependencies
   * @param attributes - Parsed attributes to validate
   */
  private async validateReferences(attributes: Record<string, any>): Promise<void> {
    const references = new Map<string, any>([[`data.${this.type}.${this.name}`, attributes]]);
    
    const validationResult = await validateResourceReferences(references, {
      allowCrossModule: true,
      checkDeprecated: true
    });

    if (!validationResult.isValid) {
      throw new ParseError(
        'Invalid data source references',
        { references: validationResult.dependencies },
        'data_block_references',
        []
      );
    }
  }
}