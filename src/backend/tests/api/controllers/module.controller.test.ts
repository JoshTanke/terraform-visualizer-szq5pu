// External dependencies
import { jest } from '@jest/globals'; // v29.0.0
import { Request, Response } from 'express'; // v4.18.2
import { Types } from 'mongoose'; // v6.0.0
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import { MockRequest, MockResponse } from 'jest-mock-express'; // v0.2.2
import { performance } from 'perf_hooks'; // native

// Internal dependencies
import { ModuleController } from '../../src/api/controllers/ModuleController';
import { ModuleService } from '../../src/services/ModuleService';
import { IModule } from '../../src/interfaces/IModule';
import { ValidationError } from '../../src/utils/errors';

describe('ModuleController', () => {
  let moduleController: ModuleController;
  let req: MockRequest;
  let res: MockResponse;
  let next: jest.Mock;
  let moduleServiceMock: jest.Mocked<ModuleService>;
  let perfObserver: PerformanceObserver;

  // Sample test data
  const sampleModule: Partial<IModule> = {
    name: 'test-module',
    source: 'git::https://github.com/test/module',
    version: '1.0.0',
    description: 'Test module for unit tests',
    configuration: {
      provider: 'aws',
      region: 'us-west-2'
    },
    variables: {
      instance_type: 't2.micro'
    },
    position: { x: 100, y: 100 }
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup request/response mocks
    req = new MockRequest();
    res = new MockResponse();
    next = jest.fn();

    // Setup ModuleService mock
    moduleServiceMock = {
      getInstance: jest.fn().mockReturnThis(),
      createModule: jest.fn(),
      getModulesByEnvironment: jest.fn(),
      getModuleWithDependencies: jest.fn(),
      updateModule: jest.fn(),
      deleteModule: jest.fn(),
      validateModuleConfiguration: jest.fn()
    } as unknown as jest.Mocked<ModuleService>;

    // Mock ModuleService.getInstance
    jest.spyOn(ModuleService, 'getInstance').mockReturnValue(moduleServiceMock);

    // Initialize controller
    moduleController = new ModuleController();

    // Setup performance observer
    perfObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      // Verify operations complete within 3 seconds
      entries.forEach(entry => {
        expect(entry.duration).toBeLessThan(3000);
      });
    });
    perfObserver.observe({ entryTypes: ['measure'] });
  });

  afterEach(() => {
    perfObserver.disconnect();
  });

  describe('createModule', () => {
    it('should create a module successfully within performance limits', async () => {
      // Start performance measurement
      performance.mark('createModule-start');

      // Setup test data
      req.body = sampleModule;
      moduleServiceMock.createModule.mockResolvedValue({
        ...sampleModule,
        _id: new Types.ObjectId(),
        environmentId: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date()
      } as IModule);

      // Execute test
      await moduleController.createModule(req as Request, res as Response, next);

      // End performance measurement
      performance.mark('createModule-end');
      performance.measure('createModule', 'createModule-start', 'createModule-end');

      // Verify response
      expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          name: sampleModule.name,
          source: sampleModule.source
        })
      }));
      expect(moduleServiceMock.createModule).toHaveBeenCalledWith(sampleModule);
    });

    it('should handle validation errors appropriately', async () => {
      // Setup invalid data
      req.body = { ...sampleModule, name: '' };

      // Mock validation error
      moduleServiceMock.createModule.mockRejectedValue(
        new ValidationError(
          [{ field: 'name', message: 'Name is required' }],
          'validation'
        )
      );

      // Execute test
      await moduleController.createModule(req as Request, res as Response, next);

      // Verify error handling
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('getModulesByEnvironment', () => {
    it('should retrieve modules for an environment with pagination', async () => {
      // Setup test data
      const environmentId = new Types.ObjectId();
      req.params = { environmentId: environmentId.toString() };
      req.query = { page: '1', limit: '10' };

      const modules = [
        { ...sampleModule, _id: new Types.ObjectId() },
        { ...sampleModule, _id: new Types.ObjectId(), name: 'test-module-2' }
      ];

      moduleServiceMock.getModulesByEnvironment.mockResolvedValue(modules);

      // Execute test
      await moduleController.getModulesByEnvironment(req as Request, res as Response, next);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: modules,
        metadata: expect.objectContaining({
          total: modules.length,
          page: 1,
          limit: 10
        })
      }));
    });

    it('should handle invalid environment ID', async () => {
      // Setup invalid data
      req.params = { environmentId: 'invalid-id' };

      // Execute test
      await moduleController.getModulesByEnvironment(req as Request, res as Response, next);

      // Verify error handling
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('getModuleWithDependencies', () => {
    it('should retrieve a module with its dependencies', async () => {
      // Setup test data
      const moduleId = new Types.ObjectId();
      req.params = { moduleId: moduleId.toString() };

      const moduleWithDeps = {
        ...sampleModule,
        _id: moduleId,
        dependencies: [
          { _id: new Types.ObjectId(), type: 'aws_instance', name: 'web_server' }
        ]
      };

      moduleServiceMock.getModuleWithDependencies.mockResolvedValue(moduleWithDeps);

      // Execute test
      await moduleController.getModuleWithDependencies(req as Request, res as Response, next);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: moduleWithDeps
      }));
    });

    it('should handle module not found', async () => {
      // Setup test data
      req.params = { moduleId: new Types.ObjectId().toString() };
      moduleServiceMock.getModuleWithDependencies.mockResolvedValue(null);

      // Execute test
      await moduleController.getModuleWithDependencies(req as Request, res as Response, next);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Module not found'
      }));
    });
  });

  describe('updateModule', () => {
    it('should update a module successfully', async () => {
      // Setup test data
      const moduleId = new Types.ObjectId();
      req.params = { moduleId: moduleId.toString() };
      req.body = {
        name: 'updated-module',
        description: 'Updated description'
      };

      const updatedModule = {
        ...sampleModule,
        ...req.body,
        _id: moduleId,
        updatedAt: new Date()
      };

      moduleServiceMock.updateModule.mockResolvedValue(updatedModule);

      // Execute test
      await moduleController.updateModule(req as Request, res as Response, next);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: updatedModule
      }));
    });
  });

  describe('deleteModule', () => {
    it('should delete a module successfully', async () => {
      // Setup test data
      const moduleId = new Types.ObjectId();
      req.params = { moduleId: moduleId.toString() };
      moduleServiceMock.deleteModule.mockResolvedValue(true);

      // Execute test
      await moduleController.deleteModule(req as Request, res as Response, next);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: { deleted: true }
      }));
    });
  });

  describe('validateModuleConfiguration', () => {
    it('should validate module configuration successfully', async () => {
      // Setup test data
      req.body = sampleModule.configuration;
      moduleServiceMock.validateModuleConfiguration.mockResolvedValue({
        isValid: true,
        errors: []
      });

      // Execute test
      await moduleController.validateModuleConfiguration(req as Request, res as Response, next);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          isValid: true,
          errors: []
        })
      }));
    });

    it('should handle invalid configuration', async () => {
      // Setup test data
      req.body = { invalid: 'configuration' };
      moduleServiceMock.validateModuleConfiguration.mockRejectedValue(
        new ValidationError(
          [{ field: 'configuration', message: 'Invalid configuration format' }],
          'validation'
        )
      );

      // Execute test
      await moduleController.validateModuleConfiguration(req as Request, res as Response, next);

      // Verify error handling
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });
});