/**
 * @fileoverview Validation utilities for Terraform configurations using Zod schemas
 * Provides comprehensive validation for projects, environments, modules, and resources
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { IProject } from '../interfaces/IProject';
import { IEnvironment, EnvironmentStatus } from '../interfaces/IEnvironment';
import { IModule, ModuleStatus } from '../interfaces/IModule';
import { IResource } from '../interfaces/IResource';

// Shared schemas for common patterns
const positionSchema = z.object({
  x: z.number(),
  y: z.number()
});

const timestampSchema = z.date();

// GitHub URL validation regex
const GITHUB_URL_REGEX = /^https:\/\/github\.com\/[\w-]+\/[\w-]+$/;

/**
 * Project validation schema using Zod
 */
const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  githubUrl: z.string().regex(GITHUB_URL_REGEX, 'Invalid GitHub URL format'),
  githubBranch: z.string().min(1),
  environments: z.array(z.any()), // Detailed validation done separately
  lastSyncedAt: z.date().nullable(),
  created: timestampSchema,
  updated: timestampSchema
});

/**
 * Environment validation schema using Zod
 */
const environmentSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  configuration: z.record(z.any()),
  variables: z.record(z.any()),
  modules: z.array(z.any()), // Detailed validation done separately
  status: z.nativeEnum(EnvironmentStatus),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Invalid semantic version'),
  created: timestampSchema,
  updated: timestampSchema
});

/**
 * Module validation schema using Zod
 */
const moduleSchema = z.object({
  id: z.string().min(1),
  environmentId: z.string().min(1),
  name: z.string().min(1).max(100),
  source: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Invalid semantic version'),
  description: z.string(),
  configuration: z.record(z.any()),
  resources: z.array(z.any()), // Detailed validation done separately
  variables: z.record(z.any()),
  outputs: z.record(z.any()),
  position: positionSchema,
  status: z.nativeEnum(ModuleStatus)
});

/**
 * Resource validation schema using Zod
 */
const resourceSchema = z.object({
  id: z.string().min(1),
  moduleId: z.string().min(1),
  type: z.string().min(1),
  name: z.string().min(1).max(100),
  provider: z.string().min(1),
  attributes: z.record(z.any()),
  dependencies: z.array(z.string()),
  count: z.number().optional(),
  forEach: z.record(z.any()).optional(),
  position: positionSchema,
  selected: z.boolean(),
  icon: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

/**
 * Validates project configuration and metadata
 * @param project - Project configuration to validate
 * @returns Promise<boolean> indicating validation success
 */
export async function validateProject(project: IProject): Promise<boolean> {
  try {
    projectSchema.parse(project);
    
    // Validate environments recursively
    for (const environment of project.environments) {
      if (!(await validateEnvironment(environment))) {
        return false;
      }
    }
    
    // Additional project-specific validations
    if (project.updated < project.created) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Project validation failed:', error);
    return false;
  }
}

/**
 * Validates environment configuration and module relationships
 * @param environment - Environment configuration to validate
 * @returns Promise<boolean> indicating validation success
 */
export async function validateEnvironment(environment: IEnvironment): Promise<boolean> {
  try {
    environmentSchema.parse(environment);
    
    // Validate modules recursively
    for (const module of environment.modules) {
      if ((await validateModule(module)) === ModuleStatus.ERROR) {
        return false;
      }
    }
    
    // Additional environment-specific validations
    if (environment.updated < environment.created) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Environment validation failed:', error);
    return false;
  }
}

/**
 * Validates module configuration, resources, and dependencies
 * @param module - Module configuration to validate
 * @returns Promise<ModuleStatus> indicating validation status
 */
export async function validateModule(module: IModule): Promise<ModuleStatus> {
  try {
    moduleSchema.parse(module);
    
    // Validate resources
    for (const resource of module.resources) {
      if (!(await validateResource(resource))) {
        return ModuleStatus.ERROR;
      }
    }
    
    // Validate resource dependencies
    if (!(await validateDependencies(module.resources))) {
      return ModuleStatus.ERROR;
    }
    
    // Check for required provider configurations
    if (!module.configuration.provider) {
      return ModuleStatus.WARNING;
    }
    
    // Validate module variables and outputs
    if (Object.keys(module.variables).length === 0 && Object.keys(module.outputs).length === 0) {
      return ModuleStatus.WARNING;
    }
    
    return ModuleStatus.VALID;
  } catch (error) {
    console.error('Module validation failed:', error);
    return ModuleStatus.ERROR;
  }
}

/**
 * Validates resource configuration and attributes
 * @param resource - Resource configuration to validate
 * @returns Promise<boolean> indicating validation success
 */
export async function validateResource(resource: IResource): Promise<boolean> {
  try {
    resourceSchema.parse(resource);
    
    // Validate resource type format
    if (!resource.type.includes('_')) {
      return false;
    }
    
    // Validate count and forEach mutual exclusivity
    if (resource.count !== undefined && resource.forEach !== undefined) {
      return false;
    }
    
    // Validate position boundaries
    if (resource.position.x < 0 || resource.position.y < 0) {
      return false;
    }
    
    // Validate timestamps
    if (new Date(resource.updatedAt) < new Date(resource.createdAt)) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Resource validation failed:', error);
    return false;
  }
}

/**
 * Validates resource dependency relationships within a module
 * @param resources - Array of resources to validate dependencies
 * @returns Promise<boolean> indicating validation success
 */
export async function validateDependencies(resources: IResource[]): Promise<boolean> {
  try {
    const resourceIds = new Set(resources.map(r => r.id));
    
    // Check for invalid dependency references
    for (const resource of resources) {
      for (const depId of resource.dependencies) {
        if (!resourceIds.has(depId)) {
          return false;
        }
      }
    }
    
    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    function hasCircularDependency(resourceId: string): boolean {
      if (!visited.has(resourceId)) {
        visited.add(resourceId);
        recursionStack.add(resourceId);
        
        const resource = resources.find(r => r.id === resourceId);
        if (resource) {
          for (const depId of resource.dependencies) {
            if (!visited.has(depId) && hasCircularDependency(depId)) {
              return true;
            } else if (recursionStack.has(depId)) {
              return true;
            }
          }
        }
      }
      recursionStack.delete(resourceId);
      return false;
    }
    
    for (const resource of resources) {
      if (hasCircularDependency(resource.id)) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Dependency validation failed:', error);
    return false;
  }
}