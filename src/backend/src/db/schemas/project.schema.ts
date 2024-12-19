// @version mongoose@6.0.0
import { Schema, Types } from 'mongoose';
import { IProject } from '../../interfaces/IProject';

/**
 * Mongoose schema definition for Terraform projects.
 * Implements comprehensive validation, security features, and performance optimizations
 * for managing infrastructure configurations and GitHub integration.
 * 
 * @see IProject for complete type definitions
 */
const ProjectSchema = new Schema<IProject>({
    name: {
        type: String,
        required: [true, 'Project name is required'],
        trim: true,
        minlength: [1, 'Project name cannot be empty'],
        maxlength: [100, 'Project name cannot exceed 100 characters'],
        index: true,
        validate: {
            validator: function(value: string) {
                return /^[\w\s-]+$/.test(value);
            },
            message: 'Project name can only contain letters, numbers, spaces, and hyphens'
        }
    },

    description: {
        type: String,
        required: false,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },

    githubUrl: {
        type: String,
        required: [true, 'GitHub repository URL is required'],
        trim: true,
        unique: true,
        index: true,
        validate: {
            validator: function(url: string) {
                return /^https:\/\/github\.com\/[\w-]+\/[\w-]+(?:\.git)?$/.test(url);
            },
            message: 'Invalid GitHub repository URL format'
        }
    },

    githubBranch: {
        type: String,
        required: [true, 'GitHub branch is required'],
        default: 'main',
        trim: true,
        validate: {
            validator: function(branch: string) {
                return /^[\w\/-]+$/.test(branch);
            },
            message: 'Invalid branch name format'
        }
    },

    githubToken: {
        type: String,
        required: [true, 'GitHub access token is required'],
        select: false, // Exclude from query results by default
        validate: {
            validator: function(token: string) {
                return /^gh[ps]_[a-zA-Z0-9_]+$/.test(token);
            },
            message: 'Invalid GitHub token format'
        }
    },

    environmentIds: {
        type: [Types.ObjectId],
        ref: 'Environment',
        default: [],
        validate: {
            validator: Array.isArray,
            message: 'EnvironmentIds must be an array'
        }
    },

    lastSyncedAt: {
        type: Date,
        default: null,
        validate: {
            validator: function(date: Date | null) {
                return date === null || date instanceof Date;
            },
            message: 'Invalid lastSyncedAt date'
        }
    },

    created: {
        type: Date,
        required: true,
        default: Date.now,
        immutable: true // Prevent modification after creation
    },

    updated: {
        type: Date,
        required: true,
        default: Date.now
    },

    version: {
        type: Number,
        required: true,
        default: 1,
        min: [1, 'Version must be greater than 0']
    },

    status: {
        type: String,
        required: true,
        enum: ['ACTIVE', 'ARCHIVED', 'SYNCING', 'ERROR'],
        default: 'ACTIVE'
    }
}, {
    // Schema options
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
    collection: 'projects',
    versionKey: false, // Disable automatic __v field
    strict: true, // Enforce schema validation strictly
    id: true, // Enable .id virtual getter
    toJSON: {
        virtuals: true,
        getters: true,
        transform: function(doc, ret) {
            delete ret._id;
            delete ret.githubToken;
            return ret;
        }
    }
});

/**
 * Indexes for optimizing query performance and ensuring data integrity
 */
ProjectSchema.index({ githubUrl: 1 }, { 
    unique: true, 
    background: true,
    name: 'unique_github_url'
});

ProjectSchema.index({ name: 1 }, { 
    background: true,
    name: 'project_name_search'
});

ProjectSchema.index({ lastSyncedAt: 1 }, { 
    background: true,
    sparse: true,
    name: 'project_sync_status'
});

/**
 * Pre-save middleware for timestamp management and validation
 */
ProjectSchema.pre('save', async function(next) {
    if (this.isNew) {
        this.created = new Date();
    }
    this.updated = new Date();

    // Validate required fields
    if (!this.name || !this.githubUrl || !this.githubBranch) {
        next(new Error('Required fields are missing'));
        return;
    }

    // Ensure environmentIds is always an array
    if (!Array.isArray(this.environmentIds)) {
        this.environmentIds = [];
    }

    next();
});

/**
 * Virtual for computing the sync status based on lastSyncedAt
 */
ProjectSchema.virtual('syncStatus').get(function() {
    if (!this.lastSyncedAt) return 'NEVER_SYNCED';
    const hoursSinceSync = (Date.now() - this.lastSyncedAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceSync > 24 ? 'NEEDS_SYNC' : 'SYNCED';
});

export { ProjectSchema };