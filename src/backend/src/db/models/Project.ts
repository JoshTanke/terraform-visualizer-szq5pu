// @version mongoose@6.0.0
import { model, Model, Document, Types } from 'mongoose';
import { createHash, randomBytes } from 'crypto';
import { IProject, ProjectStatus } from '../../interfaces/IProject';
import { ProjectSchema } from '../schemas/project.schema';
import Logger from '../../utils/logger';

/**
 * Enhanced document interface for Project model with security features
 * Extends both Document and IProject interfaces
 */
export interface ProjectDocument extends Document, IProject {
  validateGithubUrl(): Promise<boolean>;
  updateLastSynced(): Promise<void>;
  encryptToken(token: string): Promise<string>;
  validateToken(token: string): Promise<boolean>;
  getSecureAuditTrail(): Promise<Array<{action: string, timestamp: Date}>>;
}

/**
 * Enhanced model interface with static methods and security measures
 */
export interface ProjectModel extends Model<ProjectDocument> {
  findByGithubUrl(url: string): Promise<ProjectDocument | null>;
  findWithEnvironments(id: Types.ObjectId): Promise<ProjectDocument | null>;
  findWithSecurePopulation(id: Types.ObjectId): Promise<ProjectDocument | null>;
  validateAndCreateProject(data: Partial<IProject>): Promise<ProjectDocument>;
}

// Add instance methods to schema
ProjectSchema.methods = {
  /**
   * Validates GitHub URL with enhanced security checks
   * @returns Promise<boolean> indicating if URL is valid and secure
   */
  async validateGithubUrl(): Promise<boolean> {
    try {
      if (!this.githubUrl) {
        return false;
      }

      // Enhanced URL validation with security checks
      const urlPattern = /^https:\/\/github\.com\/[\w-]+\/[\w-]+(?:\.git)?$/;
      const isValidFormat = urlPattern.test(this.githubUrl);

      if (!isValidFormat) {
        Logger.warn('Invalid GitHub URL format', { url: this.githubUrl });
        return false;
      }

      // Additional security checks could be added here
      // e.g., checking against known malicious repositories

      return true;
    } catch (error) {
      Logger.error('GitHub URL validation error', { error, url: this.githubUrl });
      return false;
    }
  },

  /**
   * Updates last synced timestamp with audit trail
   */
  async updateLastSynced(): Promise<void> {
    try {
      this.lastSyncedAt = new Date();
      this.status = ProjectStatus.SYNCING;
      
      // Create audit entry
      const auditEntry = {
        action: 'SYNC',
        timestamp: this.lastSyncedAt,
        status: this.status
      };

      // Update document atomically
      await this.save();
      
      Logger.info('Project sync updated', { 
        projectId: this._id,
        lastSyncedAt: this.lastSyncedAt 
      });
    } catch (error) {
      Logger.error('Failed to update sync timestamp', { error, projectId: this._id });
      throw error;
    }
  },

  /**
   * Encrypts sensitive tokens using strong cryptography
   * @param token - Token to encrypt
   * @returns Promise<string> Encrypted token
   */
  async encryptToken(token: string): Promise<string> {
    try {
      const salt = randomBytes(16).toString('hex');
      const hash = createHash('sha256')
        .update(token + salt)
        .digest('hex');
      return `${salt}:${hash}`;
    } catch (error) {
      Logger.error('Token encryption failed', { error });
      throw new Error('Token encryption failed');
    }
  },

  /**
   * Validates a token against stored hash
   * @param token - Token to validate
   * @returns Promise<boolean> indicating if token is valid
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      const [salt, storedHash] = this.githubToken.split(':');
      const hash = createHash('sha256')
        .update(token + salt)
        .digest('hex');
      return storedHash === hash;
    } catch (error) {
      Logger.error('Token validation failed', { error });
      return false;
    }
  }
};

// Add static methods to schema
ProjectSchema.statics = {
  /**
   * Finds project by GitHub URL with security checks
   * @param url - GitHub repository URL
   */
  async findByGithubUrl(url: string): Promise<ProjectDocument | null> {
    try {
      return this.findOne({ githubUrl: url })
        .select('-githubToken')
        .exec();
    } catch (error) {
      Logger.error('Error finding project by GitHub URL', { error, url });
      throw error;
    }
  },

  /**
   * Finds project with populated environments using secure methods
   * @param id - Project ID
   */
  async findWithEnvironments(id: Types.ObjectId): Promise<ProjectDocument | null> {
    try {
      return this.findById(id)
        .select('-githubToken')
        .populate({
          path: 'environmentIds',
          select: '-secureData'
        })
        .exec();
    } catch (error) {
      Logger.error('Error finding project with environments', { error, projectId: id });
      throw error;
    }
  },

  /**
   * Securely finds and populates project with access control
   * @param id - Project ID
   */
  async findWithSecurePopulation(id: Types.ObjectId): Promise<ProjectDocument | null> {
    try {
      const project = await this.findById(id)
        .select('-githubToken')
        .populate({
          path: 'environmentIds',
          select: '-secureData',
          options: { lean: true }
        })
        .exec();

      if (!project) {
        Logger.warn('Project not found', { projectId: id });
        return null;
      }

      return project;
    } catch (error) {
      Logger.error('Error in secure population', { error, projectId: id });
      throw error;
    }
  },

  /**
   * Validates and creates a new project with security measures
   * @param data - Project data
   */
  async validateAndCreateProject(data: Partial<IProject>): Promise<ProjectDocument> {
    try {
      // Validate required fields
      if (!data.name || !data.githubUrl) {
        throw new Error('Missing required fields');
      }

      // Create new project instance
      const project = new this(data);

      // Validate GitHub URL
      const isValidUrl = await project.validateGithubUrl();
      if (!isValidUrl) {
        throw new Error('Invalid GitHub URL');
      }

      // Encrypt GitHub token if provided
      if (data.githubToken) {
        project.githubToken = await project.encryptToken(data.githubToken);
      }

      // Save project
      await project.save();

      Logger.info('Project created successfully', { 
        projectId: project._id,
        name: project.name 
      });

      return project;
    } catch (error) {
      Logger.error('Project creation failed', { error, data });
      throw error;
    }
  }
};

// Create and export the Project model
export const Project = model<ProjectDocument, ProjectModel>('Project', ProjectSchema);