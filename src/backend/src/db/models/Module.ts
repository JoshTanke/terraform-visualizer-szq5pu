// @ts-ignore - mongoose version 6.0.0
import { model, Model, Types, QueryOptions } from 'mongoose';
import { IModule } from '../../interfaces/IModule';
import { ModuleSchema } from '../schemas/module.schema';

/**
 * Enhanced Mongoose model class for Terraform modules with visualization support.
 * Provides comprehensive database operations and business logic for module entities
 * with optimized query patterns and validation.
 */
export class Module extends Model<IModule> {
  /**
   * Find all modules within a specific environment with pagination support
   * @param environmentId - Environment identifier
   * @param options - Query options for pagination and sorting
   * @returns Promise containing modules array and total count
   */
  static async findByEnvironment(
    environmentId: Types.ObjectId,
    options: QueryOptions = {}
  ): Promise<{ modules: IModule[]; total: number }> {
    const {
      skip = 0,
      limit = 50,
      sort = { createdAt: -1 },
      select
    } = options;

    // Execute queries in parallel for better performance
    const [modules, total] = await Promise.all([
      this.find({ environmentId })
        .skip(Number(skip))
        .limit(Number(limit))
        .sort(sort)
        .select(select)
        .populate('resources', 'type name provider position')
        .lean()
        .exec(),
      this.countDocuments({ environmentId })
    ]);

    return { modules, total };
  }

  /**
   * Find a module by ID and populate its resources with specified fields
   * @param moduleId - Module identifier
   * @param selectFields - Array of resource fields to populate
   * @returns Promise containing the found module with populated resources
   */
  static async findWithResources(
    moduleId: Types.ObjectId,
    selectFields: string[] = ['type', 'name', 'provider', 'position', 'dependencies']
  ): Promise<IModule | null> {
    if (!Types.ObjectId.isValid(moduleId)) {
      throw new Error('Invalid module ID format');
    }

    return this.findById(moduleId)
      .populate('resources', selectFields.join(' '))
      .lean()
      .exec();
  }

  /**
   * Update module's position in the visualization with optimistic locking
   * @param moduleId - Module identifier
   * @param position - New position coordinates
   * @param version - Document version for optimistic locking
   * @returns Promise containing the updated module
   * @throws Error if position validation fails or version mismatch occurs
   */
  static async updatePosition(
    moduleId: Types.ObjectId,
    position: { x: number; y: number },
    version: number
  ): Promise<IModule> {
    // Validate position coordinates
    if (!this.validatePosition(position)) {
      throw new Error('Invalid position coordinates');
    }

    // Perform atomic update with version check
    const updatedModule = await this.findOneAndUpdate(
      {
        _id: moduleId,
        __v: version
      },
      {
        $set: {
          position,
          updatedAt: new Date()
        },
        $inc: { __v: 1 }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedModule) {
      throw new Error('Module update failed - version mismatch or not found');
    }

    return updatedModule;
  }

  /**
   * Validate position coordinates for visualization
   * @param position - Position coordinates to validate
   * @returns boolean indicating validation result
   * @private
   */
  private static validatePosition(position: { x: number; y: number }): boolean {
    const { x, y } = position;

    // Type validation
    if (typeof x !== 'number' || typeof y !== 'number') {
      return false;
    }

    // Bounds validation (matching schema constraints)
    const MIN_COORD = -10000;
    const MAX_COORD = 10000;

    return (
      x >= MIN_COORD &&
      x <= MAX_COORD &&
      y >= MIN_COORD &&
      y <= MAX_COORD
    );
  }

  /**
   * Find modules by name pattern with environment context
   * @param environmentId - Environment identifier
   * @param namePattern - Name pattern to match
   * @returns Promise containing matching modules
   */
  static async findByNamePattern(
    environmentId: Types.ObjectId,
    namePattern: string
  ): Promise<IModule[]> {
    return this.find({
      environmentId,
      name: { $regex: namePattern, $options: 'i' }
    })
      .select('name source version position')
      .lean()
      .exec();
  }

  /**
   * Bulk update module positions with transaction support
   * @param updates - Array of position updates
   * @returns Promise containing update results
   */
  static async bulkUpdatePositions(
    updates: Array<{
      moduleId: Types.ObjectId;
      position: { x: number; y: number };
    }>
  ): Promise<IModule[]> {
    const session = await this.startSession();
    
    try {
      await session.startTransaction();

      const updatePromises = updates.map(({ moduleId, position }) =>
        this.findByIdAndUpdate(
          moduleId,
          { $set: { position } },
          { new: true, session }
        )
      );

      const results = await Promise.all(updatePromises);
      await session.commitTransaction();
      return results.filter((result): result is IModule => result !== null);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

// Create and export the Mongoose model
export default model<IModule, typeof Module>('Module', ModuleSchema);