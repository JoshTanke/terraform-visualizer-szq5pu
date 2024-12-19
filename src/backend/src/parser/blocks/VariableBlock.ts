import { injectable } from 'inversify';
import { z } from 'zod'; // v3.0.0
import { parse } from 'hcl2-parser'; // v1.0.0
import { IModule } from '../../interfaces/IModule';

/**
 * Interface defining the structure of a Terraform variable block
 */
interface IVariableDefinition {
  name: string;
  type: {
    type: string;
    constraints?: Record<string, any>;
    nested?: Record<string, any>;
  };
  default?: any;
  description?: string;
  validation?: {
    condition: string;
    error_message: string;
  }[];
  sensitive?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Advanced parser for Terraform variable blocks with comprehensive validation and caching
 * Implements high-performance parsing with optimized schema validation
 */
@injectable()
export class VariableBlock {
  private blockContent: Record<string, any>;
  private variableSchema: z.ZodSchema;
  private schemaCache: Map<string, z.ZodSchema>;

  /**
   * Initializes the variable block parser with validation schema and caching
   * @param blockContent - Raw HCL block content
   */
  constructor(blockContent: Record<string, any>) {
    this.blockContent = blockContent;
    this.schemaCache = new Map();
    
    // Initialize base validation schema
    this.variableSchema = z.object({
      name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
      type: z.object({
        type: z.string(),
        constraints: z.record(z.any()).optional(),
        nested: z.record(z.any()).optional()
      }),
      default: z.any().optional(),
      description: z.string().optional(),
      validation: z.array(z.object({
        condition: z.string(),
        error_message: z.string()
      })).optional(),
      sensitive: z.boolean().optional(),
      metadata: z.record(z.any()).optional()
    });
  }

  /**
   * Parses variable block with optimized performance using caching
   * @returns Parsed and validated variable definition
   */
  public async parse(): Promise<IVariableDefinition> {
    try {
      const cacheKey = JSON.stringify(this.blockContent);
      const cachedSchema = this.schemaCache.get(cacheKey);

      if (cachedSchema) {
        return cachedSchema.parse(this.blockContent);
      }

      const parsedVariable: IVariableDefinition = {
        name: this.parseVariableName(),
        type: await this.parseType(this.blockContent.type),
        ...this.parseOptionalFields()
      };

      await this.validate(parsedVariable);

      // Cache the validated schema
      this.schemaCache.set(cacheKey, this.variableSchema);

      return parsedVariable;
    } catch (error) {
      throw new Error(`Variable block parsing error: ${error.message}`);
    }
  }

  /**
   * Validates variable definition against schema with detailed error reporting
   * @param parsedVariable - Variable definition to validate
   * @returns Validation result with error information
   */
  public async validate(parsedVariable: IVariableDefinition): Promise<boolean> {
    try {
      await this.variableSchema.parseAsync(parsedVariable);
      
      // Additional validation for type compatibility
      if (parsedVariable.default !== undefined) {
        await this.validateDefaultValue(parsedVariable);
      }

      // Validate custom validation rules if present
      if (parsedVariable.validation) {
        await this.validateCustomRules(parsedVariable);
      }

      return true;
    } catch (error) {
      throw new Error(`Variable validation error: ${error.message}`);
    }
  }

  /**
   * Advanced type parsing with support for complex types and constraints
   * @param typeDefinition - Raw type definition from HCL
   * @returns Parsed type structure
   */
  public parseType(typeDefinition: string | Record<string, any>): object {
    try {
      if (typeof typeDefinition === 'string') {
        return {
          type: typeDefinition,
          constraints: {}
        };
      }

      const result = {
        type: typeDefinition.type || 'any',
        constraints: {},
        nested: {}
      };

      // Handle complex types
      switch (result.type) {
        case 'list':
        case 'set':
          result.nested = this.parseType(typeDefinition.items || 'any');
          break;
        case 'map':
        case 'object':
          result.nested = Object.entries(typeDefinition.fields || {}).reduce(
            (acc, [key, value]) => ({
              ...acc,
              [key]: this.parseType(value)
            }),
            {}
          );
          break;
      }

      // Parse type constraints
      if (typeDefinition.constraints) {
        result.constraints = typeDefinition.constraints;
      }

      return result;
    } catch (error) {
      throw new Error(`Type parsing error: ${error.message}`);
    }
  }

  /**
   * Parses variable name from block labels
   * @private
   */
  private parseVariableName(): string {
    const labels = this.blockContent.labels || [];
    if (!labels.length) {
      throw new Error('Variable block must have a name label');
    }
    return labels[0];
  }

  /**
   * Parses optional fields from variable block
   * @private
   */
  private parseOptionalFields(): Partial<IVariableDefinition> {
    return {
      default: this.blockContent.default,
      description: this.blockContent.description,
      validation: this.blockContent.validation,
      sensitive: this.blockContent.sensitive || false,
      metadata: this.blockContent.metadata || {}
    };
  }

  /**
   * Validates default value against variable type
   * @private
   */
  private async validateDefaultValue(variable: IVariableDefinition): Promise<void> {
    const { type, default: defaultValue } = variable;
    const typeSchema = this.createTypeSchema(type);
    
    try {
      await typeSchema.parseAsync(defaultValue);
    } catch (error) {
      throw new Error(`Default value does not match declared type: ${error.message}`);
    }
  }

  /**
   * Validates custom validation rules
   * @private
   */
  private async validateCustomRules(variable: IVariableDefinition): Promise<void> {
    if (!variable.validation) return;

    for (const rule of variable.validation) {
      try {
        // Parse and evaluate validation condition
        const condition = parse(rule.condition);
        if (!condition) {
          throw new Error(`Invalid validation condition: ${rule.condition}`);
        }
      } catch (error) {
        throw new Error(`Validation rule parsing error: ${error.message}`);
      }
    }
  }

  /**
   * Creates Zod schema for type validation
   * @private
   */
  private createTypeSchema(type: IVariableDefinition['type']): z.ZodSchema {
    switch (type.type) {
      case 'string':
        return z.string();
      case 'number':
        return z.number();
      case 'bool':
        return z.boolean();
      case 'list':
        return z.array(this.createTypeSchema(type.nested));
      case 'map':
        return z.record(this.createTypeSchema(type.nested));
      case 'object':
        return z.object(
          Object.entries(type.nested).reduce(
            (acc, [key, value]) => ({
              ...acc,
              [key]: this.createTypeSchema(value)
            }),
            {}
          )
        );
      default:
        return z.any();
    }
  }
}