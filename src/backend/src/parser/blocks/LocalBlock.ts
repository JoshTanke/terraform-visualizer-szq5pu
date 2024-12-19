import { z } from 'zod'; // v3.0.0
import { parse } from 'hcl2-parser'; // v1.0.0
import { IModule } from '../../interfaces/IModule';

/**
 * Schema for validating local block structure using Zod
 */
const LocalBlockSchema = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  value: z.any(),
  dependencies: z.array(z.string())
});

/**
 * Interface representing a parsed local value with evaluation status
 */
interface ILocalValue {
  name: string;
  value: any;
  dependencies: string[];
  evaluated: boolean;
}

/**
 * Parser for Terraform local value blocks that handles complex expressions
 * and dependency resolution with circular dependency detection.
 */
export class LocalBlock {
  private blockContent: Record<string, any>;
  private parsedLocals: Map<string, ILocalValue>;
  private evaluationStack: Set<string>;

  /**
   * Creates a new LocalBlock parser instance
   * @param blockContent - The raw local block content to parse
   */
  constructor(blockContent: Record<string, any>) {
    this.blockContent = blockContent;
    this.parsedLocals = new Map<string, ILocalValue>();
    this.evaluationStack = new Set<string>();

    // Validate initial block structure
    if (!blockContent || typeof blockContent !== 'object') {
      throw new Error('Invalid local block content structure');
    }
  }

  /**
   * Parses and evaluates all local values in the block
   * @returns Promise resolving to evaluated local values
   * @throws Error on circular dependencies or invalid syntax
   */
  public async parse(): Promise<Record<string, any>> {
    try {
      // Extract local declarations
      const locals = this.blockContent.locals || {};
      
      // Process each local declaration
      for (const [name, value] of Object.entries(locals)) {
        if (!this.validateLocalValue(name, value)) {
          throw new Error(`Invalid local value declaration: ${name}`);
        }

        // Parse dependencies and store initial state
        const dependencies = this.extractDependencies(value);
        this.parsedLocals.set(name, {
          name,
          value,
          dependencies,
          evaluated: false
        });
      }

      // Evaluate locals in dependency order
      const evaluatedLocals: Record<string, any> = {};
      for (const [name] of this.parsedLocals) {
        const evaluated = await this.evaluateExpression(name, new Set());
        evaluatedLocals[name] = evaluated;
      }

      return evaluatedLocals;
    } catch (error) {
      throw new Error(`Failed to parse local block: ${error.message}`);
    }
  }

  /**
   * Validates a single local value declaration
   * @param name - Local value name
   * @param value - Local value content
   * @returns boolean indicating validation status
   */
  public validateLocalValue(name: string, value: any): boolean {
    try {
      // Validate using schema
      LocalBlockSchema.parse({
        name,
        value,
        dependencies: this.extractDependencies(value)
      });

      // Additional validation rules
      if (typeof name !== 'string' || name.length === 0) {
        return false;
      }

      // Check for reserved keywords
      const reservedKeywords = ['count', 'each', 'path', 'terraform'];
      if (reservedKeywords.includes(name)) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Evaluates a local value expression with dependency resolution
   * @param expression - Expression to evaluate
   * @param visitedNodes - Set of visited nodes for circular dependency detection
   * @returns Promise resolving to evaluated value
   * @throws Error on circular dependencies or evaluation failures
   */
  private async evaluateExpression(
    expression: string,
    visitedNodes: Set<string>
  ): Promise<any> {
    // Check for circular dependencies
    if (visitedNodes.has(expression)) {
      throw new Error(`Circular dependency detected: ${Array.from(visitedNodes).join(' -> ')} -> ${expression}`);
    }

    // Get local value entry
    const local = this.parsedLocals.get(expression);
    if (!local) {
      throw new Error(`Unknown local value: ${expression}`);
    }

    // Return if already evaluated
    if (local.evaluated) {
      return local.value;
    }

    // Add to evaluation stack
    visitedNodes.add(expression);
    this.evaluationStack.add(expression);

    try {
      // Evaluate dependencies first
      for (const dep of local.dependencies) {
        if (this.parsedLocals.has(dep)) {
          await this.evaluateExpression(dep, visitedNodes);
        }
      }

      // Parse and evaluate the expression
      const parsedExpr = await parse(local.value.toString());
      let evaluatedValue = parsedExpr;

      // Handle variable interpolation
      if (typeof parsedExpr === 'string' && parsedExpr.includes('${')) {
        evaluatedValue = await this.interpolateVariables(parsedExpr, visitedNodes);
      }

      // Update local value with evaluated result
      local.value = evaluatedValue;
      local.evaluated = true;
      this.parsedLocals.set(expression, local);

      return evaluatedValue;
    } finally {
      // Clean up evaluation stack
      visitedNodes.delete(expression);
      this.evaluationStack.delete(expression);
    }
  }

  /**
   * Extracts dependencies from a local value expression
   * @param value - Expression to analyze
   * @returns Array of dependency names
   */
  private extractDependencies(value: any): string[] {
    const dependencies = new Set<string>();
    
    if (typeof value === 'string') {
      // Extract ${local.xxx} references
      const matches = value.match(/\$\{[^}]+\}/g) || [];
      for (const match of matches) {
        const ref = match.slice(2, -1).trim();
        if (ref.startsWith('local.')) {
          dependencies.add(ref.slice(6));
        }
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Interpolates variables in an expression
   * @param expression - Expression containing variable references
   * @param visitedNodes - Set of visited nodes for circular dependency detection
   * @returns Promise resolving to interpolated value
   */
  private async interpolateVariables(
    expression: string,
    visitedNodes: Set<string>
  ): Promise<string> {
    return expression.replace(/\$\{([^}]+)\}/g, async (match, ref) => {
      if (ref.startsWith('local.')) {
        const localName = ref.slice(6);
        return String(await this.evaluateExpression(localName, visitedNodes));
      }
      return match;
    });
  }
}