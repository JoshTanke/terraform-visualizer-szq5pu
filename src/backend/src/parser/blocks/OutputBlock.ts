import { injectable } from 'inversify';
import { z } from 'zod'; // v3.0.0
import { IModule } from '../../interfaces/IModule';

/**
 * Interface defining the structure of a parsed output block with enhanced validation
 */
export interface IOutputBlock {
  name: string;
  value: any;
  attributes: Record<string, any>;
  sensitive: boolean;
  description: string;
  dependencies: string[];
}

/**
 * Enhanced parser class for handling Terraform output block declarations
 * with comprehensive validation and security features.
 */
@injectable()
export class OutputBlock {
  private name: string;
  private value: any;
  private attributes: Record<string, any>;
  private sensitive: boolean;
  private description: string;
  private dependencies: string[];
  private validationSchema: z.ZodSchema;

  /**
   * Initializes a new OutputBlock instance with enhanced validation capabilities
   * @param name - Output block name
   * @param value - Output value expression
   * @param attributes - Additional output attributes
   */
  constructor(
    name: string,
    value: any,
    attributes: Record<string, any> = {}
  ) {
    this.name = name;
    this.value = value;
    this.attributes = attributes;
    this.sensitive = false;
    this.description = '';
    this.dependencies = [];

    // Initialize validation schema
    this.validationSchema = z.object({
      name: z.string().min(1).regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
      value: z.any(),
      attributes: z.record(z.string(), z.any()),
      sensitive: z.boolean(),
      description: z.string().optional(),
      dependencies: z.array(z.string())
    });
  }

  /**
   * Parses an output block definition with enhanced validation and security checks
   * @param outputBlock - Raw output block configuration
   * @returns Parsed and validated output block configuration
   */
  public parse(outputBlock: Record<string, any>): Record<string, any> {
    try {
      // Extract and validate basic properties
      this.name = outputBlock.name;
      this.value = outputBlock.value;
      this.attributes = outputBlock.attributes || {};
      
      // Process sensitive flag with security implications
      this.sensitive = Boolean(outputBlock.sensitive || this.attributes.sensitive);
      
      // Extract description for documentation
      this.description = outputBlock.description || this.attributes.description || '';
      
      // Process dependencies
      this.dependencies = this.extractDependencies(this.value);

      // Validate the complete configuration
      const validationResult = this.validate();
      if (!validationResult.success) {
        throw new Error(`Output block validation failed: ${validationResult.errors.join(', ')}`);
      }

      return this.toJSON();
    } catch (error) {
      throw new Error(`Failed to parse output block: ${error.message}`);
    }
  }

  /**
   * Performs comprehensive validation of the output block configuration
   * @returns Validation result with detailed error information
   */
  public validate(): { success: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Validate against schema
      this.validationSchema.parse({
        name: this.name,
        value: this.value,
        attributes: this.attributes,
        sensitive: this.sensitive,
        description: this.description,
        dependencies: this.dependencies
      });

      // Additional validation rules
      if (this.sensitive && typeof this.value === 'object') {
        errors.push('Sensitive outputs should not contain complex objects for security reasons');
      }

      if (this.dependencies.length > 0) {
        this.validateDependencies();
      }

      return {
        success: errors.length === 0,
        errors
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.errors.map(err => err.message)
        };
      }
      throw error;
    }
  }

  /**
   * Converts the output block to a secure JSON representation
   * @returns Sanitized JSON representation of the output block
   */
  public toJSON(): Record<string, any> {
    const json: Record<string, any> = {
      name: this.name,
      value: this.sensitive ? '[SENSITIVE]' : this.value,
      attributes: { ...this.attributes },
      sensitive: this.sensitive,
      dependencies: [...this.dependencies]
    };

    if (this.description) {
      json.description = this.description;
    }

    return json;
  }

  /**
   * Extracts dependencies from output value expressions
   * @param value - Output value to analyze
   * @returns Array of dependency identifiers
   * @private
   */
  private extractDependencies(value: any): string[] {
    const dependencies = new Set<string>();

    if (typeof value === 'string') {
      // Extract references from interpolation syntax ${...}
      const matches = value.match(/\$\{([^}]+)\}/g) || [];
      matches.forEach(match => {
        const reference = match.slice(2, -1).trim();
        dependencies.add(reference);
      });
    } else if (typeof value === 'object' && value !== null) {
      // Recursively process object properties
      Object.values(value).forEach(v => {
        this.extractDependencies(v).forEach(dep => dependencies.add(dep));
      });
    }

    return Array.from(dependencies);
  }

  /**
   * Validates dependency references for integrity
   * @private
   */
  private validateDependencies(): void {
    // Validate dependency reference format
    const validReferencePattern = /^[a-zA-Z0-9_.-]+\.[a-zA-Z0-9_.-]+$/;
    
    this.dependencies.forEach(dep => {
      if (!validReferencePattern.test(dep)) {
        throw new Error(`Invalid dependency reference format: ${dep}`);
      }
    });
  }
}