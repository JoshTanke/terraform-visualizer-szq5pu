// @ts-ignore - mongoose version 6.0.0
import { Schema, Types } from 'mongoose';
import { IResource } from '../../interfaces/IResource';

/**
 * Mongoose schema definition for Terraform infrastructure resources.
 * Implements comprehensive validation, indexing, and graph visualization support
 * based on the IResource interface specifications.
 */
const ResourceSchema = new Schema<IResource>(
  {
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'Module',
      required: [true, 'Module ID is required'],
      index: true,
      validate: {
        validator: (value: unknown) => Types.ObjectId.isValid(value),
        message: 'Invalid moduleId format'
      }
    },

    type: {
      type: String,
      required: [true, 'Resource type is required'],
      trim: true,
      minlength: [1, 'Resource type cannot be empty'],
      maxlength: [100, 'Resource type is too long'],
      index: true,
      validate: {
        validator: (value: string) => /^[a-zA-Z0-9_-]+$/.test(value),
        message: 'Resource type must contain only alphanumeric characters, underscores, and hyphens'
      }
    },

    name: {
      type: String,
      required: [true, 'Resource name is required'],
      trim: true,
      minlength: [1, 'Resource name cannot be empty'],
      maxlength: [100, 'Resource name is too long'],
      index: true,
      validate: {
        validator: (value: string) => /^[a-zA-Z0-9_-]+$/.test(value),
        message: 'Resource name must contain only alphanumeric characters, underscores, and hyphens'
      }
    },

    provider: {
      type: String,
      required: [true, 'Provider is required'],
      trim: true,
      index: true,
      validate: {
        validator: (value: string) => /^[a-zA-Z0-9_-]+$/.test(value),
        message: 'Provider must contain only alphanumeric characters, underscores, and hyphens'
      }
    },

    attributes: {
      type: Schema.Types.Mixed,
      default: {},
      validate: {
        validator: (value: unknown) => typeof value === 'object' && value !== null,
        message: 'Attributes must be an object'
      }
    },

    dependencies: [{
      type: Schema.Types.ObjectId,
      ref: 'Resource',
      validate: {
        validator: (value: unknown) => Types.ObjectId.isValid(value),
        message: 'Invalid dependency resource ID format'
      }
    }],

    count: {
      type: Number,
      required: false,
      min: [0, 'Count must be non-negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Count must be a positive integer'
      }
    },

    forEach: {
      type: Schema.Types.Mixed,
      required: false,
      validate: {
        validator: (value: unknown) => value === null || (typeof value === 'object' && value !== null),
        message: 'forEach must be null or an object'
      }
    },

    position: {
      x: {
        type: Number,
        required: true,
        default: 0,
        validate: {
          validator: Number.isFinite,
          message: 'Position X must be a finite number'
        }
      },
      y: {
        type: Number,
        required: true,
        default: 0,
        validate: {
          validator: Number.isFinite,
          message: 'Position Y must be a finite number'
        }
      },
      width: {
        type: Number,
        required: false,
        validate: {
          validator: (value: unknown) => value === undefined || Number.isFinite(value),
          message: 'Width must be a finite number'
        }
      },
      height: {
        type: Number,
        required: false,
        validate: {
          validator: (value: unknown) => value === undefined || Number.isFinite(value),
          message: 'Height must be a finite number'
        }
      }
    },

    metadata: {
      icon: {
        type: String,
        required: false,
        trim: true
      },
      color: {
        type: String,
        required: false,
        trim: true,
        validate: {
          validator: (value: string) => !value || /^#[0-9A-Fa-f]{6}$/.test(value),
          message: 'Color must be a valid hex color code'
        }
      },
      description: {
        type: String,
        required: false,
        trim: true,
        maxlength: [500, 'Description is too long']
      }
    },

    validation: {
      isValid: {
        type: Boolean,
        required: true,
        default: true
      },
      errors: [{
        type: String,
        trim: true
      }],
      warnings: [{
        type: String,
        trim: true
      }]
    },

    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
      required: true
    },

    updatedAt: {
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
      getters: true,
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    },
    id: true,
    strict: true,
    validateBeforeSave: true,
    collation: {
      locale: 'en',
      strength: 2
    }
  }
);

/**
 * Compound index for efficient querying by module and resource type
 */
ResourceSchema.index({ moduleId: 1, type: 1 });

/**
 * Compound index for efficient querying by module and resource name
 */
ResourceSchema.index({ moduleId: 1, name: 1 }, { unique: true });

/**
 * Pre-save middleware for document validation and timestamp management
 */
ResourceSchema.pre('save', function(next) {
  // Validate required fields
  if (!this.moduleId || !this.type || !this.name || !this.provider) {
    next(new Error('Required fields missing'));
    return;
  }

  // Update timestamps
  const now = new Date();
  this.updatedAt = now;
  if (this.isNew) {
    this.createdAt = now;
  }

  // Normalize string fields
  this.type = this.type.trim();
  this.name = this.name.trim();
  this.provider = this.provider.trim();

  // Validate position coordinates
  if (!Number.isFinite(this.position.x) || !Number.isFinite(this.position.y)) {
    next(new Error('Invalid position coordinates'));
    return;
  }

  next();
});

export { ResourceSchema };