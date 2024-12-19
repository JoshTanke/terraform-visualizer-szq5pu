// External dependencies
import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { Types } from 'mongoose'; // v6.0.0
import { jest } from '@jest/globals'; // v29.0.0

// Internal dependencies
import { ProjectController } from '../../../src/api/controllers/ProjectController';
import { ProjectService } from '../../../src/services/ProjectService';
import { IProject, ProjectStatus } from '../../../src/interfaces/IProject';
import { ValidationError, HttpError } from '../../../src/utils/errors';

// Mock ProjectService
jest.mock('../../../src/services/ProjectService');

describe('ProjectController', () => {
    let controller: ProjectController;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;
    let mockProjectService: jest.Mocked<ProjectService>;

    // Test data
    const validProject: Partial<IProject> = {
        name: 'Test Project',
        description: 'Test Description',
        githubUrl: 'https://github.com/test/repo',
        githubBranch: 'main',
        status: ProjectStatus.ACTIVE,
        version: 1
    };

    beforeAll(() => {
        // Configure test timeouts
        jest.setTimeout(10000);
    });

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Initialize mock response
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            send: jest.fn()
        };

        // Initialize mock request
        mockRequest = {
            body: {},
            params: {},
            headers: {}
        };

        // Initialize mock next function
        mockNext = jest.fn();

        // Initialize mock ProjectService
        mockProjectService = {
            getInstance: jest.fn().mockReturnThis(),
            createProject: jest.fn(),
            getProject: jest.fn(),
            updateProject: jest.fn(),
            deleteProject: jest.fn(),
            syncWithGithub: jest.fn()
        } as unknown as jest.Mocked<ProjectService>;

        // Create controller instance
        controller = new ProjectController();
    });

    describe('createProject', () => {
        it('should create a project successfully', async () => {
            // Arrange
            const createdProject = { ...validProject, id: new Types.ObjectId() };
            mockRequest.body = validProject;
            mockProjectService.createProject.mockResolvedValue(createdProject);

            // Act
            await controller.createProject(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(201);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: createdProject
            });
            expect(mockProjectService.createProject).toHaveBeenCalledWith(validProject);
        });

        it('should handle validation errors', async () => {
            // Arrange
            const validationError = new ValidationError(
                [{ field: 'name', message: 'Name is required' }],
                'project_creation'
            );
            mockRequest.body = { ...validProject, name: '' };
            mockProjectService.createProject.mockRejectedValue(validationError);

            // Act
            await controller.createProject(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            // Assert
            expect(mockNext).toHaveBeenCalledWith(validationError);
        });

        it('should handle rate limiting', async () => {
            // Arrange
            mockRequest.body = validProject;
            const rateLimitError = new HttpError(429, 'Too Many Requests');
            mockProjectService.createProject.mockRejectedValue(rateLimitError);

            // Act
            await controller.createProject(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            // Assert
            expect(mockNext).toHaveBeenCalledWith(rateLimitError);
        });
    });

    describe('getProject', () => {
        it('should retrieve a project successfully', async () => {
            // Arrange
            const projectId = new Types.ObjectId();
            const project = { ...validProject, id: projectId };
            mockRequest.params = { id: projectId.toString() };
            mockProjectService.getProject.mockResolvedValue(project);

            // Act
            await controller.getProject(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: project
            });
            expect(mockProjectService.getProject).toHaveBeenCalledWith(projectId.toString());
        });

        it('should handle not found errors', async () => {
            // Arrange
            const projectId = new Types.ObjectId();
            mockRequest.params = { id: projectId.toString() };
            mockProjectService.getProject.mockResolvedValue(null);

            // Act
            await controller.getProject(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            // Assert
            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 404,
                    message: expect.stringContaining('Project not found')
                })
            );
        });
    });

    describe('updateProject', () => {
        it('should update a project successfully', async () => {
            // Arrange
            const projectId = new Types.ObjectId();
            const updateData = { name: 'Updated Project' };
            const updatedProject = { ...validProject, ...updateData, id: projectId };
            mockRequest.params = { id: projectId.toString() };
            mockRequest.body = updateData;
            mockProjectService.updateProject.mockResolvedValue(updatedProject);

            // Act
            await controller.updateProject(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: updatedProject
            });
            expect(mockProjectService.updateProject).toHaveBeenCalledWith(
                projectId.toString(),
                updateData
            );
        });

        it('should handle concurrent update conflicts', async () => {
            // Arrange
            const projectId = new Types.ObjectId();
            mockRequest.params = { id: projectId.toString() };
            mockRequest.body = { name: 'Updated Project' };
            const conflictError = new HttpError(409, 'Concurrent update detected');
            mockProjectService.updateProject.mockRejectedValue(conflictError);

            // Act
            await controller.updateProject(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            // Assert
            expect(mockNext).toHaveBeenCalledWith(conflictError);
        });
    });

    describe('deleteProject', () => {
        it('should delete a project successfully', async () => {
            // Arrange
            const projectId = new Types.ObjectId();
            mockRequest.params = { id: projectId.toString() };
            mockProjectService.deleteProject.mockResolvedValue(undefined);

            // Act
            await controller.deleteProject(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(204);
            expect(mockResponse.send).toHaveBeenCalled();
            expect(mockProjectService.deleteProject).toHaveBeenCalledWith(projectId.toString());
        });

        it('should handle deletion constraints', async () => {
            // Arrange
            const projectId = new Types.ObjectId();
            mockRequest.params = { id: projectId.toString() };
            const constraintError = new HttpError(400, 'Project has active environments');
            mockProjectService.deleteProject.mockRejectedValue(constraintError);

            // Act
            await controller.deleteProject(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            // Assert
            expect(mockNext).toHaveBeenCalledWith(constraintError);
        });
    });

    describe('syncWithGithub', () => {
        it('should sync project with GitHub successfully', async () => {
            // Arrange
            const projectId = new Types.ObjectId();
            const syncedProject = { ...validProject, id: projectId, lastSyncedAt: new Date() };
            mockRequest.params = { id: projectId.toString() };
            mockProjectService.syncWithGithub.mockResolvedValue(syncedProject);

            // Act
            await controller.syncWithGithub(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: syncedProject
            });
            expect(mockProjectService.syncWithGithub).toHaveBeenCalledWith(projectId.toString());
        });

        it('should handle GitHub API errors', async () => {
            // Arrange
            const projectId = new Types.ObjectId();
            mockRequest.params = { id: projectId.toString() };
            const githubError = new HttpError(503, 'GitHub API unavailable');
            mockProjectService.syncWithGithub.mockRejectedValue(githubError);

            // Act
            await controller.syncWithGithub(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            // Assert
            expect(mockNext).toHaveBeenCalledWith(githubError);
        });
    });

    describe('Error Handling', () => {
        it('should handle internal server errors', async () => {
            // Arrange
            mockRequest.body = validProject;
            const internalError = new Error('Internal server error');
            mockProjectService.createProject.mockRejectedValue(internalError);

            // Act
            await controller.createProject(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            // Assert
            expect(mockNext).toHaveBeenCalledWith(internalError);
        });

        it('should handle authentication errors', async () => {
            // Arrange
            mockRequest.body = validProject;
            const authError = new HttpError(401, 'Unauthorized');
            mockProjectService.createProject.mockRejectedValue(authError);

            // Act
            await controller.createProject(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            // Assert
            expect(mockNext).toHaveBeenCalledWith(authError);
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.resetModules();
    });
});