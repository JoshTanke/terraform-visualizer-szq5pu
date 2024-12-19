// @ts-ignore - mongoose version 6.0.0
import { Schema, Types } from 'mongoose';
import { IModule } from '../../interfaces/IModule';

/**
 * Mongoose schema definition for Terraform modules.
 * Implements the IModule interface with MongoDB-specific validations and configurations.
 */
const ModuleSchema = new Schema<IModule>(
  {
    environmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Environment',
      required: [true, 'Environment reference is required'],
      index: true,
      validate: {
        validator: (value: Types.ObjectId) => Types.ObjectId.isValid(value),
        message: 'Invalid environment reference'
      }
    },

    name: {
      type: String,
      required: [true, 'Module name is required'],
      trim: true,
      minlength: [1, 'Module name cannot be empty'],
      maxlength: [100, 'Module name cannot exceed 100 characters'],
      index: true,
      validate: {
        validator: (value: string) => /^[a-zA-Z0-9-_]+$/.test(value),
        message: 'Name must contain only alphanumeric characters, hyphens, and underscores'
      }
    },

    source: {
      type: String,
      required: [true, 'Module source is required'],
      trim: true,
      validate: {
        validator: (value: string) => /^(git:|http:|https:|file:|./).+$/.test(value),
        message: 'Invalid module source format'
      }
    },

    version: {
      type: String,
      trim: true,
      validate: {
        validator: (value: string) => !value || /^\d+\.\d+\.\d+$/.test(value),
        message: 'Version must follow semantic versioning format (e.g., 1.0.0)'
      }
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },

    configuration: {
      type: Schema.Types.Mixed,
      default: {},
      validate: {
        validator: (value: unknown) => {
          try {
            JSON.stringify(value);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Configuration must be valid JSON'
      }
    },

    resources: [{
      type: Schema.Types.ObjectId,
      ref: 'Resource',
      validate: {
        validator: (value: Types.ObjectId) => Types.ObjectId.isValid(value),
        message: 'Invalid resource reference'
      }
    }],

    variables: {
      type: Schema.Types.Mixed,
      default: {},
      validate: {
        validator: (value: unknown) => {
          try {
            JSON.stringify(value);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Variables must be valid JSON'
      }
    },

    outputs: {
      type: Schema.Types.Mixed,
      default: {},
      validate: {
        validator: (value: unknown) => {
          try {
            JSON.stringify(value);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Outputs must be valid JSON'
      }
    },

    position: {
      x: {
        type: Number,
        required: true,
        default: 0,
        min: [-10000, 'X coordinate cannot be less than -10000'],
        max: [10000, 'X coordinate cannot exceed 10000']
      },
      y: {
        type: Number,
        required: true,
        default: 0,
        min: [-10000, 'Y coordinate cannot be less than -10000'],
        max: [10000, 'Y coordinate cannot exceed 10000']
      }
    },

    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    },

    updatedAt: {
      type: Date,
      default: Date.now
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
      getters: true,
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    },
    id: true,
    minimize: false,
    strict: true
  }
);

/**
 * Index for efficient querying by environment and name
 */
ModuleSchema.index({ environmentId: 1, name: 1 }, { unique: true });

/**
 * Pre-save middleware for data validation and timestamp management
 */
ModuleSchema.pre('save', async function(next) {
  // Update timestamps
  const now = new Date();
  this.updatedAt = now;
  if (this.isNew) {
    this.createdAt = now;
  }

  // Normalize string fields
  if (this.name) this.name = this.name.trim();
  if (this.source) this.source = this.source.trim();
  if (this.version) this.version = this.version.trim();
  if (this.description) this.description = this.description.trim();

  next();
});

/**
 * Virtual for getting the full module path
 */
ModuleSchema.virtual('fullPath').get(function() {
  return `${this.source}/${this.name}`;
});

export { ModuleSchema };