/**
 * @fileoverview Utility functions for handling Terraform configuration data,
 * validation, and transformations with performance optimizations and caching.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.0.0
import memoizee from 'memoizee'; // v0.4.15
import { debounce, get, set } from 'lodash'; // v4.17.21
import { IModule, ModuleStatus } from '../interfaces/IModule';
import { IResource } from '../interfaces/IResource';

// Validation schemas with performance optimization
const resourceSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  type: z.string(),
  name: z.string(),
  provider: z.string(),
  attributes: z.record(z.any()),
  dependencies: z.array(z.string()),
  count: z.number().optional(),
  forEach: z.record(z.any()).optional(),
  position: z.object({
    x: z.number(),
    y: z.number()
  }),
  selected: z.boolean(),
  icon: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const moduleSchema = z.object({
  id: z.string(),
  environmentId: z.string(),
  name: z.string(),
  source: z.string(),
  version: z.string(),
  description: z.string(),
  configuration: z.record(z.any()),
  resources: z.array(resourceSchema),
  variables: z.record(z.any()),
  outputs: z.record(z.any()),
  position: z.object({
    x: z.number(),
    y: z.number()
  }),
  status: z.nativeEnum(ModuleStatus)
});

// Cache for validation results
const validationCache = new Map<string, boolean>();

/**
 * Validates a module's configuration against expected schema with caching
 * @param module - Module configuration to validate
 * @returns Promise resolving to validation result
 */
export const validateModuleConfiguration = memoizee(
  async (module: IModule): Promise<boolean> => {
    const cacheKey = `module_${module.id}`;
    const cachedResult = validationCache.get(cacheKey);
    
    if (cachedResult !== undefined) {
      return cachedResult;
    }

    try {
      const validationResult = moduleSchema.safeParse(module);
      const isValid = validationResult.success;
      
      // Cache the result for 5 seconds
      validationCache.set(cacheKey, isValid);
      setTimeout(() => validationCache.delete(cacheKey), 5000);
      
      return isValid;
    } catch (error) {
      console.error('Module validation error:', error);
      return false;
    }
  },
  { maxAge: 5000 } // Cache for 5 seconds
);

/**
 * Validates a resource's configuration against expected schema with optimization
 * @param resource - Resource configuration to validate
 * @returns Promise resolving to validation result
 */
export const validateResourceConfiguration = memoizee(
  async (resource: IResource): Promise<boolean> => {
    const cacheKey = `resource_${resource.id}`;
    const cachedResult = validationCache.get(cacheKey);
    
    if (cachedResult !== undefined) {
      return cachedResult;
    }

    try {
      const validationResult = resourceSchema.safeParse(resource);
      const isValid = validationResult.success;
      
      validationCache.set(cacheKey, isValid);
      setTimeout(() => validationCache.delete(cacheKey), 5000);
      
      return isValid;
    } catch (error) {
      console.error('Resource validation error:', error);
      return false;
    }
  },
  { maxAge: 5000 }
);

/**
 * Analyzes resource configuration to determine dependencies with circular detection
 * @param resource - Resource to analyze
 * @param allResources - All resources in the current context
 * @returns Promise resolving to dependency information
 */
export const calculateResourceDependencies = memoizee(
  async (
    resource: IResource,
    allResources: IResource[]
  ): Promise<{ dependencies: string[]; circular: boolean }> => {
    const visited = new Set<string>();
    const dependencies = new Set<string>();
    
    const findDependencies = (currentResource: IResource): boolean => {
      if (visited.has(currentResource.id)) {
        return true; // Circular dependency detected
      }
      
      visited.add(currentResource.id);
      
      // Analyze attributes for references
      const refs = extractReferences(currentResource.attributes);
      refs.forEach(refId => {
        dependencies.add(refId);
        const dependentResource = allResources.find(r => r.id === refId);
        if (dependentResource) {
          if (findDependencies(dependentResource)) {
            return true;
          }
        }
      });
      
      visited.delete(currentResource.id);
      return false;
    };
    
    const hasCircular = findDependencies(resource);
    
    return {
      dependencies: Array.from(dependencies),
      circular: hasCircular
    };
  },
  { maxAge: 10000 }
);

/**
 * Formats Terraform configuration object for visualization with enhanced layout
 * @param configuration - Raw configuration object
 * @returns Formatted configuration with optimized layout
 */
export const formatTerraformConfiguration = (
  configuration: Record<string, any>
): Record<string, any> => {
  const formatted: Record<string, any> = {};
  
  // Process resources with count/forEach handling
  if (configuration.resources) {
    formatted.resources = configuration.resources.map((resource: any) => {
      const base = {
        ...resource,
        position: calculateOptimalPosition(resource),
        icon: getResourceIcon(resource.type, resource.provider)
      };
      
      // Handle count expansion
      if (resource.count) {
        return Array.from({ length: resource.count }, (_, i) => ({
          ...base,
          name: `${base.name}[${i}]`,
          position: calculateInstancePosition(base.position, i, resource.count)
        }));
      }
      
      // Handle forEach expansion
      if (resource.forEach) {
        return Object.keys(resource.forEach).map(key => ({
          ...base,
          name: `${base.name}[${key}]`,
          position: calculateInstancePosition(base.position, 
            Object.keys(resource.forEach).indexOf(key),
            Object.keys(resource.forEach).length
          )
        }));
      }
      
      return base;
    }).flat();
  }
  
  return formatted;
};

/**
 * Determines the appropriate icon for a resource with caching
 * @param resourceType - Type of the resource
 * @param provider - Provider of the resource
 * @returns Path to the resource icon
 */
export const getResourceIcon = memoizee(
  (resourceType: string, provider: string): string => {
    const baseIconPath = '/assets/icons/resources';
    const defaultIcon = `${baseIconPath}/default.svg`;
    
    // Provider-specific icon mapping
    const iconMap: Record<string, Record<string, string>> = {
      aws: {
        instance: 'aws/ec2.svg',
        bucket: 'aws/s3.svg',
        // Add more AWS resource mappings
      },
      google: {
        compute_instance: 'gcp/compute.svg',
        storage_bucket: 'gcp/storage.svg',
        // Add more GCP resource mappings
      }
      // Add more provider mappings
    };
    
    const providerIcons = iconMap[provider];
    if (!providerIcons) return defaultIcon;
    
    const resourceTypeKey = resourceType.replace(`${provider}_`, '');
    return providerIcons[resourceTypeKey] || defaultIcon;
  }
);

// Helper functions
const calculateOptimalPosition = (resource: any) => {
  // Implement force-directed positioning algorithm
  return {
    x: Math.random() * 800,
    y: Math.random() * 600
  };
};

const calculateInstancePosition = (
  basePosition: { x: number; y: number },
  index: number,
  total: number
) => {
  const radius = 100;
  const angle = (2 * Math.PI * index) / total;
  
  return {
    x: basePosition.x + radius * Math.cos(angle),
    y: basePosition.y + radius * Math.sin(angle)
  };
};

const extractReferences = (attributes: Record<string, any>): string[] => {
  const references: string[] = [];
  
  const traverse = (obj: any) => {
    if (typeof obj === 'string' && obj.includes('${')) {
      // Extract resource references from interpolation strings
      const matches = obj.match(/\$\{([^}]+)\}/g) || [];
      matches.forEach(match => {
        const ref = match.slice(2, -1).split('.')[0];
        if (ref) references.push(ref);
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.values(obj).forEach(traverse);
    }
  };
  
  traverse(attributes);
  return Array.from(new Set(references));
};