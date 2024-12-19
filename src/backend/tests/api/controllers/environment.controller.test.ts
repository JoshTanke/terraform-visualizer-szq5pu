// External dependencies
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals'; // v29.0.0
import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose'; // v6.0.0
import supertest from 'supertest'; // v6.3.3

// Internal dependencies
import { EnvironmentController } from '../../../src/api/controllers/EnvironmentController';
import { EnvironmentService } from '../../../src/services/EnvironmentService';
import { IEnvironment } from '../../../src/interfaces/IEnvironment';
import { ValidationError } from '../../../src/utils/errors';

describe('EnvironmentController', () => {
  let controller: EnvironmentController;
  let mockEnvironmentService: jest.Mocked<EnvironmentService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  // Test data fixtures
  const testEnvironment: Partial<IEnvironment> = {
    _id: new Types.ObjectId(),
    projectId: new Types.ObjectId(),
    name: 'test-environment',
    description: 'Test environment for unit tests',
    configuration: {},
    modules: [],
    variables: {},
    version: '1.0.0',
    status: 'active',
    lastSync: new Date(),
    created: new Date(),
    updated: new Date()
  };

  beforeEach(() => {
    // Reset controller instance
    jest.clearAllMocks();
    
    // Mock EnvironmentService
    mockEnvironmentService = {
      getInstance: jest.fn(),
      create: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getByProject: jest.fn()
    } as unknown as jest.Mocked<EnvironmentService>;

    // Mock request/response objects
    mockRequest = {
      body: {},
      params: {},
      headers: {
        'x-correlation-id': 'test-correlation-id'
      }
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };

    mockNext = jest.fn();

    // Initialize controller with mocked service
    controller = EnvironmentController.getInstance();
    jest.spyOn(EnvironmentService, 'getInstance').mockReturnValue(mockEnvironmentService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createEnvironment', () => {
    it('should create a new environment successfully', async () => {
      // Arrange
      const createData = {
        projectId: testEnvironment.projectId?.toString(),
        name: testEnvironment.name,
        description: testEnvironment.description
      };

      mockRequest.body = createData;
      mockEnvironmentService.create.mockResolvedValue(testEnvironment as IEnvironment);

      // Act
      await controller.createEnvironment(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockEnvironmentService.create).toHaveBeenCalledWith(
        new Types.ObjectId(createData.projectId),
        expect.objectContaining(createData)
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: testEnvironment,
          metadata: expect.any(Object)
        })
      );
    });

    it('should handle validation errors during creation', async () => {
      // Arrange
      const invalidData = {
        projectId: 'invalid-id',
        name: '',
      };

      mockRequest.body = invalidData;

      // Act
      await controller.createEnvironment(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(ValidationError)
      );
      expect(mockEnvironmentService.create).not.toHaveBeenCalled();
    });

    it('should enforce name format validation', async () => {
      // Arrange
      const invalidData = {
        projectId: testEnvironment.projectId?.toString(),
        name: 'Invalid Name!', // Contains invalid characters
      };

      mockRequest.body = invalidData;

      // Act
      await controller.createEnvironment(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(ValidationError)
      );
    });
  });

  describe('getEnvironment', () => {
    it('should retrieve an environment by ID successfully', async () => {
      // Arrange
      mockRequest.params = { id: testEnvironment._id?.toString() };
      mockEnvironmentService.getById.mockResolvedValue(testEnvironment as IEnvironment);

      // Act
      await controller.getEnvironment(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockEnvironmentService.getById).toHaveBeenCalledWith(
        new Types.ObjectId(testEnvironment._id)
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: testEnvironment
        })
      );
    });

    it('should handle non-existent environment', async () => {
      // Arrange
      mockRequest.params = { id: new Types.ObjectId().toString() };
      mockEnvironmentService.getById.mockResolvedValue(null);

      // Act
      await controller.getEnvironment(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('not found')
        })
      );
    });
  });

  describe('updateEnvironment', () => {
    it('should update an environment successfully', async () => {
      // Arrange
      const updateData = {
        name: 'updated-environment',
        description: 'Updated description'
      };

      mockRequest.params = { id: testEnvironment._id?.toString() };
      mockRequest.body = updateData;
      mockEnvironmentService.update.mockResolvedValue({
        ...testEnvironment,
        ...updateData
      } as IEnvironment);

      // Act
      await controller.updateEnvironment(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockEnvironmentService.update).toHaveBeenCalledWith(
        new Types.ObjectId(testEnvironment._id),
        expect.objectContaining(updateData)
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining(updateData)
        })
      );
    });

    it('should validate update data', async () => {
      // Arrange
      const invalidData = {
        name: '!invalid!',
        version: 'invalid-version'
      };

      mockRequest.params = { id: testEnvironment._id?.toString() };
      mockRequest.body = invalidData;

      // Act
      await controller.updateEnvironment(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(ValidationError)
      );
      expect(mockEnvironmentService.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteEnvironment', () => {
    it('should delete an environment successfully', async () => {
      // Arrange
      mockRequest.params = { id: testEnvironment._id?.toString() };
      mockEnvironmentService.delete.mockResolvedValue(undefined);

      // Act
      await controller.deleteEnvironment(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockEnvironmentService.delete).toHaveBeenCalledWith(
        new Types.ObjectId(testEnvironment._id)
      );
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should handle deletion of non-existent environment', async () => {
      // Arrange
      mockRequest.params = { id: new Types.ObjectId().toString() };
      mockEnvironmentService.delete.mockRejectedValue(new Error('Environment not found'));

      // Act
      await controller.deleteEnvironment(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('not found')
        })
      );
    });
  });

  describe('getProjectEnvironments', () => {
    it('should retrieve all environments for a project', async () => {
      // Arrange
      const projectId = new Types.ObjectId();
      const environments = [testEnvironment, { ...testEnvironment, name: 'env-2' }];

      mockRequest.params = { projectId: projectId.toString() };
      mockEnvironmentService.getByProject.mockResolvedValue(environments as IEnvironment[]);

      // Act
      await controller.getProjectEnvironments(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockEnvironmentService.getByProject).toHaveBeenCalledWith(projectId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: environments,
          metadata: expect.objectContaining({
            count: environments.length
          })
        })
      );
    });

    it('should validate project ID format', async () => {
      // Arrange
      mockRequest.params = { projectId: 'invalid-id' };

      // Act
      await controller.getProjectEnvironments(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(ValidationError)
      );
      expect(mockEnvironmentService.getByProject).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // Arrange
      const serviceError = new Error('Service error');
      mockRequest.params = { id: testEnvironment._id?.toString() };
      mockEnvironmentService.getById.mockRejectedValue(serviceError);

      // Act
      await controller.getEnvironment(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(serviceError);
    });

    it('should handle validation errors with proper format', async () => {
      // Arrange
      const validationError = new ValidationError(
        [{ field: 'name', message: 'Invalid format' }],
        'create'
      );

      mockRequest.body = { name: '!invalid!' };
      mockEnvironmentService.create.mockRejectedValue(validationError);

      // Act
      await controller.createEnvironment(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              field: 'name',
              message: expect.any(String)
            })
          ])
        })
      );
    });
  });

  describe('Performance', () => {
    it('should complete CRUD operations within acceptable time', async () => {
      // Arrange
      const start = Date.now();
      mockRequest.body = {
        projectId: testEnvironment.projectId?.toString(),
        name: testEnvironment.name
      };
      mockEnvironmentService.create.mockResolvedValue(testEnvironment as IEnvironment);

      // Act
      await controller.createEnvironment(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // 100ms threshold
    });
  });
});