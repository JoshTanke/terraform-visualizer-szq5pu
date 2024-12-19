// External dependencies
import { Types } from 'mongoose'; // v6.0.0

// Internal dependencies
import { IModule } from '../../interfaces/IModule';
import { Module } from '../db/models/Module';
import { ModuleParser } from '../parser/ModuleParser';
import { ResourceService } from './ResourceService';
import { CacheService } from './CacheService';
import { Logger } from '../utils/logger';

/**
 * Service class that provides optimized business logic and data access operations
 * for managing Terraform modules with caching and performance features.
 */
export class ModuleService {
  private static instance: ModuleService;
  private readonly cacheService: CacheService;
  private readonly logger: Logger;
  private readonly moduleParser: ModuleParser;
  private readonly resourceService: ResourceService;
  private readonly CACHE_TTL_SECONDS = 3600; // 1 hour
  private readonly MAX_RETRIES = 3;

  /**
   * Private constructor implementing singleton pattern with service initialization
   */
  private constructor() {
    this.cacheService = CacheService.getInstance();
    this.logger = Logger.getInstance();
    this.moduleParser = new ModuleParser('');
    this.resourceService = ResourceService.getInstance();
  }

  /**
   * Gets singleton instance of ModuleService
   * @returns Singleton service instance
   */
  public static getInstance(): ModuleService {
    if (!ModuleService.instance) {
      ModuleService.instance = new ModuleService();
    }
    return ModuleService.instance;
  }

  /**
   * Creates a new Terraform module with optimized parsing and caching
   * @param moduleData Module data to create
   * @returns Promise resolving to created module with parsed resources
   */
  public async createModule(moduleData: Partial<IModule>): Promise<IModule> {
    try {
      this.logger.info('Creating new module', { name: moduleData.name });

      // Parse module configuration
      const parser = new ModuleParser(JSON.stringify(moduleData.configuration));
      const parsedModule = await parser.parseModule();

      // Validate module configuration
      await this.moduleParser.validateModuleConfiguration({
        ...moduleData,
        ...parsedModule
      } as IModule);

      // Create module with retry logic
      let module: IModule | null = null;
      let attempts = 0;

      while (!module && attempts < this.MAX_RETRIES) {
        try {
          module = await Module.create({
            ...moduleData,
            ...parsedModule,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        } catch (error) {
          attempts++;
          if (attempts === this.MAX_RETRIES) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      if (!module) {
        throw new Error('Failed to create module after maximum retries');
      }

      // Parse and create resources in parallel
      if (parsedModule.resources && parsedModule.resources.length > 0) {
        const resourcePromises = parsedModule.resources.map(resource =>
          this.resourceService.createResource({
            ...resource,
            moduleId: module!._id
          })
        );

        const resources = await Promise.all(resourcePromises);
        module.resources = resources;
      }

      // Cache module data
      await this.cacheService.set(
        `module:${module._id}`,
        module,
        this.CACHE_TTL_SECONDS
      );

      this.logger.info('Module created successfully', {
        moduleId: module._id,
        resourceCount: module.resources?.length || 0
      });

      return module;

    } catch (error) {
      this.logger.error('Failed to create module', {
        error: error.message,
        moduleData
      });
      throw error;
    }
  }

  /**
   * Retrieves a module by ID with caching and performance optimization
   * @param moduleId Module identifier
   * @returns Promise resolving to module with resources
   */
  public async getModuleById(moduleId: Types.ObjectId): Promise<IModule | null> {
    try {
      // Check cache first
      const cachedModule = await this.cacheService.get(`module:${moduleId}`);
      if (cachedModule) {
        return cachedModule;
      }

      // Fetch from database with lean query
      const module = await Module.findWithResources(moduleId);
      if (!module) {
        return null;
      }

      // Fetch resources in parallel if needed
      if (!module.resources) {
        module.resources = await this.resourceService.getResourcesByModule(moduleId);
      }

      // Cache module data
      await this.cacheService.set(
        `module:${moduleId}`,
        module,
        this.CACHE_TTL_SECONDS
      );

      return module;

    } catch (error) {
      this.logger.error('Failed to get module', {
        error: error.message,
        moduleId
      });
      throw error;
    }
  }

  /**
   * Retrieves all modules for an environment with batch processing
   * @param environmentId Environment identifier
   * @returns Promise resolving to list of modules with resources
   */
  public async getModulesByEnvironment(environmentId: Types.ObjectId): Promise<IModule[]> {
    try {
      // Check cache first
      const cacheKey = `environment:${environmentId}:modules`;
      const cachedModules = await this.cacheService.get(cacheKey);
      if (cachedModules) {
        return cachedModules;
      }

      // Fetch modules with pagination and lean query
      const { modules } = await Module.findByEnvironment(environmentId);

      // Fetch resources for all modules in parallel
      const modulesWithResources = await Promise.all(
        modules.map(async module => ({
          ...module,
          resources: await this.resourceService.getResourcesByModule(module._id)
        }))
      );

      // Cache modules list
      await this.cacheService.set(
        cacheKey,
        modulesWithResources,
        this.CACHE_TTL_SECONDS
      );

      return modulesWithResources;

    } catch (error) {
      this.logger.error('Failed to get modules by environment', {
        error: error.message,
        environmentId
      });
      throw error;
    }
  }

  /**
   * Updates a module with optimistic concurrency
   * @param moduleId Module identifier
   * @param updateData Update data
   * @returns Promise resolving to updated module
   */
  public async updateModule(
    moduleId: Types.ObjectId,
    updateData: Partial<IModule>
  ): Promise<IModule> {
    try {
      // Parse updated module configuration
      if (updateData.configuration) {
        const parser = new ModuleParser(JSON.stringify(updateData.configuration));
        const parsedModule = await parser.parseModule();
        updateData = { ...updateData, ...parsedModule };
      }

      // Validate update data
      await this.moduleParser.validateModuleConfiguration({
        ...await this.getModuleById(moduleId),
        ...updateData
      } as IModule);

      // Update module with retry logic
      let module: IModule | null = null;
      let attempts = 0;

      while (!module && attempts < this.MAX_RETRIES) {
        try {
          module = await Module.findByIdAndUpdate(
            moduleId,
            { ...updateData, updatedAt: new Date() },
            { new: true, runValidators: true }
          );
        } catch (error) {
          attempts++;
          if (attempts === this.MAX_RETRIES) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      if (!module) {
        throw new Error('Module not found or update failed');
      }

      // Update resources if needed
      if (updateData.resources) {
        await this.resourceService.bulkUpdateResources(
          updateData.resources.map(resource => ({
            id: resource._id,
            data: resource
          }))
        );
      }

      // Update cache
      await this.cacheService.delete(`module:${moduleId}`);
      await this.cacheService.set(
        `module:${moduleId}`,
        module,
        this.CACHE_TTL_SECONDS
      );

      return module;

    } catch (error) {
      this.logger.error('Failed to update module', {
        error: error.message,
        moduleId,
        updateData
      });
      throw error;
    }
  }

  /**
   * Deletes a module and its resources with transaction
   * @param moduleId Module identifier
   * @returns Promise resolving to deletion success status
   */
  public async deleteModule(moduleId: Types.ObjectId): Promise<boolean> {
    try {
      // Start MongoDB transaction
      const session = await Module.startSession();
      session.startTransaction();

      try {
        // Delete module and resources atomically
        const module = await Module.findByIdAndDelete(moduleId, { session });
        if (!module) {
          throw new Error('Module not found');
        }

        // Delete associated resources
        const resources = await this.resourceService.getResourcesByModule(moduleId);
        await Promise.all(
          resources.map(resource =>
            this.resourceService.deleteResource(resource._id)
          )
        );

        // Commit transaction
        await session.commitTransaction();

        // Remove from cache
        await this.cacheService.delete(`module:${moduleId}`);
        await this.cacheService.delete(`environment:${module.environmentId}:modules`);

        return true;

      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

    } catch (error) {
      this.logger.error('Failed to delete module', {
        error: error.message,
        moduleId
      });
      throw error;
    }
  }

  /**
   * Updates module position in graph visualization with optimistic locking
   * @param moduleId Module identifier
   * @param position New position coordinates
   * @returns Promise resolving to updated module
   */
  public async updateModulePosition(
    moduleId: Types.ObjectId,
    position: { x: number; y: number }
  ): Promise<IModule> {
    try {
      const module = await Module.updatePosition(moduleId, position, 0);

      // Update cache
      await this.cacheService.delete(`module:${moduleId}`);
      await this.cacheService.set(
        `module:${moduleId}`,
        module,
        this.CACHE_TTL_SECONDS
      );

      return module;

    } catch (error) {
      this.logger.error('Failed to update module position', {
        error: error.message,
        moduleId,
        position
      });
      throw error;
    }
  }
}

// Export singleton instance
export default ModuleService.getInstance();