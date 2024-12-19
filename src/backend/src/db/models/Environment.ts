// @ts-ignore - mongoose version 6.0.0
import { model, Model, Types, QueryOptions } from 'mongoose'; // mongoose version 6.0.0
import { IEnvironment } from '../../interfaces/IEnvironment';
import { EnvironmentSchema } from '../schemas/environment.schema';

/**
 * Interface for Environment model static methods
 */
interface EnvironmentModel extends Model<IEnvironment> {
  findByProject(projectId: Types.ObjectId, options?: QueryOptions): Promise<IEnvironment[]>;
  findWithModules(environmentId: Types.ObjectId, options?: QueryOptions): Promise<IEnvironment>;
}

/**
 * Static method to find all environments for a given project
 * Optimized query with essential module data population
 */
EnvironmentSchema.statics.findByProject = async function(
  projectId: Types.ObjectId,
  options: QueryOptions = {}
): Promise<IEnvironment[]> {
  if (!Types.ObjectId.isValid(projectId)) {
    throw new Error('Invalid project ID provided');
  }

  try {
    const environments = await this.find(
      { projectId },
      {
        name: 1,
        description: 1,
        status: 1,
        version: 1,
        lastSync: 1,
        created: 1,
        updated: 1
      },
      {
        ...options,
        lean: true,
        sort: { name: 1 }
      }
    ).populate({
      path: 'modules',
      select: 'name source version position',
      options: { sort: { name: 1 } }
    });

    return environments;
  } catch (error) {
    throw new Error(`Error finding environments for project: ${error.message}`);
  }
};

/**
 * Static method to find an environment by ID with fully populated modules
 * Includes optimized query performance and proper error handling
 */
EnvironmentSchema.statics.findWithModules = async function(
  environmentId: Types.ObjectId,
  options: QueryOptions = {}
): Promise<IEnvironment> {
  if (!Types.ObjectId.isValid(environmentId)) {
    throw new Error('Invalid environment ID provided');
  }

  try {
    const environment = await this.findById(
      environmentId,
      null,
      {
        ...options,
        lean: options.lean !== false
      }
    ).populate({
      path: 'modules',
      select: '-__v',
      populate: {
        path: 'resources',
        select: '-__v'
      }
    });

    if (!environment) {
      throw new Error('Environment not found');
    }

    return environment;
  } catch (error) {
    throw new Error(`Error finding environment with modules: ${error.message}`);
  }
};

/**
 * Pre-remove middleware to handle cleanup of related resources
 */
EnvironmentSchema.pre('remove', async function(next) {
  try {
    // Remove all associated modules
    await this.model('Module').deleteMany({ environmentId: this._id });
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Post-save middleware to handle real-time updates
 */
EnvironmentSchema.post('save', function(doc) {
  // Emit environment update event for real-time sync
  // @ts-ignore - global event emitter
  if (global.eventEmitter) {
    global.eventEmitter.emit('environment:updated', {
      environmentId: doc._id,
      projectId: doc.projectId,
      action: 'save'
    });
  }
});

/**
 * Post-remove middleware to handle cleanup notifications
 */
EnvironmentSchema.post('remove', function(doc) {
  // Emit environment removal event
  // @ts-ignore - global event emitter
  if (global.eventEmitter) {
    global.eventEmitter.emit('environment:removed', {
      environmentId: doc._id,
      projectId: doc.projectId
    });
  }
});

/**
 * Environment model implementing IEnvironment interface with static methods
 * Provides comprehensive CRUD operations with optimized query performance
 */
const Environment = model<IEnvironment, EnvironmentModel>('Environment', EnvironmentSchema);

// Create indexes for optimized querying
Environment.collection.createIndex(
  { projectId: 1, name: 1 },
  { unique: true, background: true }
);
Environment.collection.createIndex(
  { updated: 1 },
  { background: true, expireAfterSeconds: 7776000 } // 90 days TTL
);

export { Environment };