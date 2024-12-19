// External dependencies
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import nock from 'nock'; // v13.0.0

// Internal dependencies
import { GithubClient } from '../../src/github/GithubClient';
import { githubConfig } from '../../src/config/github.config';
import { CustomErrors } from '../../src/utils/errors';

// Test constants
const TEST_TOKEN = 'ghs_test123456789abcdefghijklmnopqrstuvwxyz';
const TEST_OWNER = 'test-owner';
const TEST_REPO = 'test-repo';
const TEST_PATH = 'test/path.ts';
const RATE_LIMIT_WINDOW = 3600;
const MAX_RETRIES = 3;
const CIRCUIT_BREAKER_THRESHOLD = 5;

describe('GithubClient', () => {
  let githubClient: GithubClient;
  let mockMetricsIncrement: jest.SpyInstance;
  let mockMetricsTiming: jest.SpyInstance;
  let mockLogger: jest.SpyInstance;

  beforeEach(() => {
    // Reset nock and create fresh instance
    nock.cleanAll();
    githubClient = GithubClient.getInstance();

    // Mock metrics and logging
    mockMetricsIncrement = jest.spyOn(githubClient['metrics'], 'increment');
    mockMetricsTiming = jest.spyOn(githubClient['metrics'], 'timing');
    mockLogger = jest.spyOn(githubClient['logger'], 'error');

    // Configure nock defaults
    nock.disableNetConnect();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance on multiple calls', () => {
      const instance1 = GithubClient.getInstance();
      const instance2 = GithubClient.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should initialize with default configuration', () => {
      expect(githubClient['octokit']).toBeDefined();
      expect(githubClient['circuitBreaker']).toBeDefined();
      expect(githubClient['token']).toBeNull();
    });

    test('should maintain instance state across calls', async () => {
      // Mock authentication endpoint
      nock(githubConfig.apiUrl)
        .get('/user')
        .reply(200, { login: 'testuser' });

      await githubClient.authenticate(TEST_TOKEN);
      const instance2 = GithubClient.getInstance();
      expect(instance2['token']).toBe(TEST_TOKEN);
    });
  });

  describe('Authentication', () => {
    test('should authenticate successfully with valid token', async () => {
      nock(githubConfig.apiUrl)
        .get('/user')
        .reply(200, { login: 'testuser' });

      await expect(githubClient.authenticate(TEST_TOKEN)).resolves.not.toThrow();
      expect(mockMetricsIncrement).toHaveBeenCalledWith('github.auth.success');
    });

    test('should throw AuthenticationError with invalid token', async () => {
      nock(githubConfig.apiUrl)
        .get('/user')
        .reply(401, { message: 'Bad credentials' });

      await expect(githubClient.authenticate('invalid_token'))
        .rejects
        .toThrow(CustomErrors.AuthenticationError);
      expect(mockMetricsIncrement).toHaveBeenCalledWith('github.auth.failure');
    });

    test('should handle rate limiting during authentication', async () => {
      nock(githubConfig.apiUrl)
        .get('/user')
        .reply(403, {}, {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60)
        });

      await expect(githubClient.authenticate(TEST_TOKEN))
        .rejects
        .toThrow(CustomErrors.RateLimitError);
      expect(mockLogger).toHaveBeenCalled();
    });

    test('should implement exponential backoff for retries', async () => {
      const responses = Array(MAX_RETRIES).fill(0).map(() => 
        nock(githubConfig.apiUrl)
          .get('/user')
          .reply(500)
      );

      await expect(githubClient.authenticate(TEST_TOKEN))
        .rejects
        .toThrow();
      
      responses.forEach(response => {
        expect(response.isDone()).toBeTruthy();
      });
    });
  });

  describe('Repository Operations', () => {
    beforeEach(async () => {
      nock(githubConfig.apiUrl)
        .get('/user')
        .reply(200, { login: 'testuser' });
      await githubClient.authenticate(TEST_TOKEN);
    });

    test('should retrieve repository information successfully', async () => {
      nock(githubConfig.apiUrl)
        .get(`/repos/${TEST_OWNER}/${TEST_REPO}`)
        .reply(200, {
          id: 123,
          name: TEST_REPO,
          owner: { login: TEST_OWNER }
        });

      const repo = await githubClient.getRepository(TEST_OWNER, TEST_REPO);
      expect(repo.name).toBe(TEST_REPO);
      expect(mockMetricsIncrement).toHaveBeenCalledWith('github.repo.get.success');
    });

    test('should handle repository not found error', async () => {
      nock(githubConfig.apiUrl)
        .get(`/repos/${TEST_OWNER}/${TEST_REPO}`)
        .reply(404, { message: 'Not Found' });

      await expect(githubClient.getRepository(TEST_OWNER, TEST_REPO))
        .rejects
        .toThrow();
      expect(mockMetricsIncrement).toHaveBeenCalledWith('github.repo.get.failure');
    });

    test('should implement retry mechanism for failed requests', async () => {
      const responses = Array(MAX_RETRIES).fill(0).map(() => 
        nock(githubConfig.apiUrl)
          .get(`/repos/${TEST_OWNER}/${TEST_REPO}`)
          .reply(500)
      );

      await expect(githubClient.getRepository(TEST_OWNER, TEST_REPO))
        .rejects
        .toThrow();
      
      responses.forEach(response => {
        expect(response.isDone()).toBeTruthy();
      });
    });
  });

  describe('Content Operations', () => {
    beforeEach(async () => {
      nock(githubConfig.apiUrl)
        .get('/user')
        .reply(200, { login: 'testuser' });
      await githubClient.authenticate(TEST_TOKEN);
    });

    test('should retrieve file content successfully', async () => {
      const content = Buffer.from('test content').toString('base64');
      nock(githubConfig.apiUrl)
        .get(`/repos/${TEST_OWNER}/${TEST_REPO}/contents/${TEST_PATH}`)
        .reply(200, {
          content,
          sha: 'abc123',
          encoding: 'base64'
        });

      const result = await githubClient.getContent(TEST_OWNER, TEST_REPO, TEST_PATH);
      expect(result.content).toBe('test content');
      expect(mockMetricsIncrement).toHaveBeenCalledWith('github.content.get.success');
    });

    test('should handle file not found error', async () => {
      nock(githubConfig.apiUrl)
        .get(`/repos/${TEST_OWNER}/${TEST_REPO}/contents/${TEST_PATH}`)
        .reply(404, { message: 'Not Found' });

      await expect(githubClient.getContent(TEST_OWNER, TEST_REPO, TEST_PATH))
        .rejects
        .toThrow();
      expect(mockMetricsIncrement).toHaveBeenCalledWith('github.content.get.failure');
    });

    test('should sanitize file paths', async () => {
      const maliciousPath = '../../../secret/file';
      const sanitizedPath = 'secretfile';
      
      nock(githubConfig.apiUrl)
        .get(`/repos/${TEST_OWNER}/${TEST_REPO}/contents/${sanitizedPath}`)
        .reply(200, {
          content: Buffer.from('content').toString('base64'),
          sha: 'abc123'
        });

      await githubClient.getContent(TEST_OWNER, TEST_REPO, maliciousPath);
      expect(mockLogger).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      nock(githubConfig.apiUrl)
        .get('/user')
        .reply(200, { login: 'testuser' });
      await githubClient.authenticate(TEST_TOKEN);
    });

    test('should track rate limit consumption', async () => {
      nock(githubConfig.apiUrl)
        .get(`/repos/${TEST_OWNER}/${TEST_REPO}`)
        .reply(200, {}, {
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-limit': '5000',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + RATE_LIMIT_WINDOW)
        });

      await githubClient.getRepository(TEST_OWNER, TEST_REPO);
      expect(mockMetricsIncrement).toHaveBeenCalledWith('github.repo.get.success');
    });

    test('should handle rate limit exceeded', async () => {
      nock(githubConfig.apiUrl)
        .get(`/repos/${TEST_OWNER}/${TEST_REPO}`)
        .reply(403, {
          message: 'API rate limit exceeded'
        }, {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60)
        });

      await expect(githubClient.getRepository(TEST_OWNER, TEST_REPO))
        .rejects
        .toThrow(CustomErrors.RateLimitError);
      expect(mockMetricsIncrement).toHaveBeenCalledWith('github.rate_limit.exceeded');
    });

    test('should implement token bucket algorithm', async () => {
      const requests = Array(githubConfig.rateLimiting.burstLimit + 1)
        .fill(0)
        .map(() => 
          nock(githubConfig.apiUrl)
            .get(`/repos/${TEST_OWNER}/${TEST_REPO}`)
            .reply(200, { id: 123 })
        );

      const promises = requests.map(() => 
        githubClient.getRepository(TEST_OWNER, TEST_REPO)
      );

      await expect(Promise.all(promises)).rejects.toThrow();
    });
  });
});