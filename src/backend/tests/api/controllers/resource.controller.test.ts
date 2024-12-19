// External dependencies
import { describe, beforeAll, afterAll, beforeEach, test, expect, jest } from '@jest/globals'; // v29.0.0
import supertest from 'supertest'; // v6.3.0
import { Types } from 'mongoose'; // v6.0.0

// Internal dependencies
import { ResourceController } from '../../../src/api/controllers/ResourceController';
import { ResourceService } from '../../../src/services/ResourceService';
import { IResource } from '../../../src/interfaces/IResource';
import { ValidationError } from '../../../src/utils/errors';
import { Logger } from '../../../src/utils/logger';

// Test constants
const TEST_TIMEOUT = 10000;
const PERFORMANCE_THRESHOLD = 3000; // 3 seconds max for operations
const MOCK_MODULE_ID = new Types.ObjectId();

// Mock data
const mockResource: Partial<IResource> = {
  moduleId: MOCK_MODULE_ID,
  type: 'aws_instance',
  name: 'test_instance',
  provider: 'aws',
  attributes: {
    instance_type: 't2.micro',
    ami: 'ami-12345'
  },
  position: { x: 100, y: 100 }
};

describe('ResourceController', () => {
  let controller: ResourceController;
  let mockResourceService: jest.Mocked<ResourceService>;
  let testLogger: Logger;

  beforeAll(async () => {
    // Initialize logger with test configuration
    testLogger = Logger.getInstance();
    jest.spyOn(testLogger, 'error');
    jest.spyOn(testLogger, 'info');
    jest.spyOn(testLogger, 'debug');

    // Mock ResourceService
    mockResourceService = {
      getInstance: jest.fn(),
      createResource: jest.fn(),
      getResourceById: jest.fn(),
      getResourcesByModule: jest.fn(),
      updateResource: jest.fn(),
      deleteResource: jest.fn(),
      updateResourcePosition: jest.fn()
    } as unknown as jest.Mocked<ResourceService>;

    // Initialize controller
    controller = ResourceController.getInstance();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createResource', () => {
    test('should successfully create a valid resource', async () => {
      // Arrange
      const req = {
        body: mockResource
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      mockResourceService.createResource.mockResolvedValueOnce({
        ...mockResource,
        _id: new Types.ObjectId()
      } as IResource);

      // Act
      const startTime = Date.now();
      await controller.createResource(req, res, next);
      const duration = Date.now() - startTime;

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          type: mockResource.type,
          name: mockResource.name
        })
      }));
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(mockResourceService.createResource).toHaveBeenCalledWith(mockResource);
    });

    test('should handle validation errors correctly', async () => {
      // Arrange
      const invalidResource = { ...mockResource, type: '' };
      const req = {
        body: invalidResource
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      mockResourceService.createResource.mockRejectedValueOnce(
        new ValidationError(
          [{ field: 'type', message: 'Resource type is required' }],
          'validation'
        )
      );

      // Act
      await controller.createResource(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ValidationError'
        })
      );
      expect(testLogger.error).toHaveBeenCalled();
    });

    test('should handle duplicate resource names', async () => {
      // Arrange
      const req = {
        body: mockResource
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      mockResourceService.createResource.mockRejectedValueOnce(
        new ValidationError(
          [{ field: 'name', message: 'Resource with this name already exists' }],
          'duplicate'
        )
      );

      // Act
      await controller.createResource(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ValidationError',
          code: 'VAL_001'
        })
      );
    });
  });

  describe('getResource', () => {
    test('should retrieve a resource by ID', async () => {
      // Arrange
      const resourceId = new Types.ObjectId();
      const req = {
        params: { id: resourceId.toString() }
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      mockResourceService.getResourceById.mockResolvedValueOnce({
        ...mockResource,
        _id: resourceId
      } as IResource);

      // Act
      const startTime = Date.now();
      await controller.getResource(req, res, next);
      const duration = Date.now() - startTime;

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          _id: resourceId
        })
      }));
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
    });

    test('should handle non-existent resource', async () => {
      // Arrange
      const req = {
        params: { id: new Types.ObjectId().toString() }
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      mockResourceService.getResourceById.mockResolvedValueOnce(null);

      // Act
      await controller.getResource(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Resource not found'
        })
      );
    });
  });

  describe('getModuleResources', () => {
    test('should retrieve all resources for a module', async () => {
      // Arrange
      const req = {
        params: { moduleId: MOCK_MODULE_ID.toString() }
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      const mockResources = [
        { ...mockResource, _id: new Types.ObjectId() },
        { ...mockResource, _id: new Types.ObjectId(), name: 'test_instance_2' }
      ];

      mockResourceService.getResourcesByModule.mockResolvedValueOnce(
        mockResources as IResource[]
      );

      // Act
      const startTime = Date.now();
      await controller.getModuleResources(req, res, next);
      const duration = Date.now() - startTime;

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ name: 'test_instance' }),
          expect.objectContaining({ name: 'test_instance_2' })
        ]),
        metadata: expect.objectContaining({
          count: 2
        })
      }));
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
    });
  });

  describe('updateResource', () => {
    test('should update resource attributes', async () => {
      // Arrange
      const resourceId = new Types.ObjectId();
      const updateData = {
        attributes: {
          instance_type: 't2.large'
        }
      };
      const req = {
        params: { id: resourceId.toString() },
        body: updateData
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      mockResourceService.updateResource.mockResolvedValueOnce({
        ...mockResource,
        _id: resourceId,
        attributes: updateData.attributes
      } as IResource);

      // Act
      const startTime = Date.now();
      await controller.updateResource(req, res, next);
      const duration = Date.now() - startTime;

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          attributes: updateData.attributes
        })
      }));
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
    });
  });

  describe('updateResourcePosition', () => {
    test('should update resource position', async () => {
      // Arrange
      const resourceId = new Types.ObjectId();
      const position = { x: 200, y: 300 };
      const req = {
        params: { id: resourceId.toString() },
        body: position
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      mockResourceService.updateResourcePosition.mockResolvedValueOnce({
        ...mockResource,
        _id: resourceId,
        position
      } as IResource);

      // Act
      await controller.updateResourcePosition(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          position
        })
      }));
    });
  });

  describe('deleteResource', () => {
    test('should delete a resource', async () => {
      // Arrange
      const resourceId = new Types.ObjectId();
      const req = {
        params: { id: resourceId.toString() }
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      mockResourceService.deleteResource.mockResolvedValueOnce({
        ...mockResource,
        _id: resourceId
      } as IResource);

      // Act
      await controller.deleteResource(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          _id: resourceId
        })
      }));
      expect(mockResourceService.deleteResource).toHaveBeenCalledWith(resourceId);
    });
  });
});