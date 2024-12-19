// @ts-ignore - mongoose version 6.0.0
import { Schema, Types } from 'mongoose';
import { IEnvironment } from '../../interfaces/IEnvironment';
import { ModuleSchema } from './module.schema';

/**
 * Mongoose schema definition for the Environment model.
 * Implements the IEnvironment interface with comprehensive validation rules
 * and support for the three-tier visualization hierarchy.
 */
const EnvironmentSchema = new Schema<IEnvironment>(
  {
    name: {
      type: String,
      required: [true, 'Environment name is required'],
      trim: true,
      minlength: [1, 'Environment name cannot be empty'],
      maxlength: [100, 'Environment name cannot exceed 100 characters'],
      index: true,
      validate: {
        validator: (value: string) => /^[a-zA-Z0-9-_]+$/.test(value),
        message: 'Name must contain only alphanumeric characters, hyphens, and underscores'
      }
    },

    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required'],
      index: true,
      validate: {
        validator: (value: Types.ObjectId) => Types.ObjectId.isValid(value),
        message: 'Invalid project reference'
      }
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: ''
    },

    configuration: {
      type: Schema.Types.Mixed,
      default: {},
      validate: {
        validator: (value: unknown) => {
          try {
            JSON.stringify(value);
            return typeof value === 'object';
          } catch {
            return false;
          }
        },
        message: 'Configuration must be a valid JSON object'
      }
    },

    modules: [{
      type: Schema.Types.ObjectId,
      ref: 'Module',
      validate: {
        validator: async (value: Types.ObjectId) => {
          try {
            // @ts-ignore - mongoose model access
            return await mongoose.model('Module').exists({ _id: value });
          } catch {
            return false;
          }
        },
        message: 'Referenced module must exist'
      }
    }],

    variables: {
      type: Schema.Types.Mixed,
      default: {},
      validate: {
        validator: (value: unknown) => {
          try {
            JSON.stringify(value);
            return typeof value === 'object';
          } catch {
            return false;
          }
        },
        message: 'Variables must be a valid JSON object'
      }
    },

    version: {
      type: String,
      required: [true, 'Version is required'],
      trim: true,
      validate: {
        validator: (value: string) => /^\d+\.\d+\.\d+$/.test(value),
        message: 'Version must follow semantic versioning format (e.g., 1.0.0)'
      },
      default: '0.1.0'
    },

    status: {
      type: String,
      required: true,
      enum: {
        values: ['active', 'inactive', 'error', 'syncing'],
        message: 'Invalid status value'
      },
      default: 'active'
    },

    lastSync: {
      type: Date,
      default: null
    },

    created: {
      type: Date,
      default: Date.now,
      immutable: true,
      required: true
    },

    updated: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    timestamps: true,
    versionKey: true,
    toJSON: {
      virtuals: true,
      getters: true,
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      getters: true
    },
    id: true,
    minimize: false,
    strict: true
  }
);

/**
 * Compound index for efficient querying by project and name
 */
EnvironmentSchema.index({ projectId: 1, name: 1 }, { unique: true });

/**
 * Pre-save middleware for data validation and timestamp management
 */
EnvironmentSchema.pre('save', async function(next) {
  // Update timestamps
  const now = new Date();
  this.updated = now;
  if (this.isNew) {
    this.created = now;
  }

  // Normalize string fields
  if (this.name) this.name = this.name.trim();
  if (this.description) this.description = this.description.trim();
  if (this.version) this.version = this.version.trim();

  // Validate name format
  if (this.isModified('name') && !/^[a-zA-Z0-9-_]+$/.test(this.name)) {
    next(new Error('Environment name contains invalid characters'));
    return;
  }

  next();
});

/**
 * Virtual for getting the module count
 */
EnvironmentSchema.virtual('moduleCount').get(function() {
  return this.modules?.length || 0;
});

/**
 * Virtual for environment full path
 */
EnvironmentSchema.virtual('path').get(function() {
  return `${this.projectId}/${this.name}`;
});

export { EnvironmentSchema };