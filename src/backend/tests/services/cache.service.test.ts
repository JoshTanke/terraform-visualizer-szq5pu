// External dependencies
import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll, jest } from '@jest/globals'; // ^29.0.0
import Redis from 'ioredis-mock'; // ^8.0.0
import { faker } from '@faker-js/faker'; // ^8.0.0

// Internal dependencies
import { CacheService } from '../../src/services/CacheService';
import { cacheConfig } from '../../src/config/cache.config';

// Mock Redis client
jest.mock('ioredis', () => require('ioredis-mock'));

// Mock Logger to prevent actual logging during tests
jest.mock('../../src/utils/logger', () => ({
  Logger: {
    getInstance: () => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    })
  }
}));

describe('CacheService', () => {
  let cacheService: CacheService;
  let testKey: string;
  let testValue: any;

  beforeAll(() => {
    // Configure test environment
    process.env.CACHE_ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long!!';
  });

  beforeEach(() => {
    // Reset CacheService instance and get fresh instance
    jest.clearAllMocks();
    cacheService = CacheService.getInstance();
    
    // Generate test data
    testKey = faker.string.alphanumeric(10);
    testValue = {
      id: faker.string.uuid(),
      data: faker.lorem.sentence(),
      timestamp: faker.date.recent()
    };
  });

  afterEach(async () => {
    // Clear cache after each test
    await cacheService.clear();
  });

  afterAll(() => {
    // Clean up environment variables
    delete process.env.CACHE_ENCRYPTION_KEY;
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance when getInstance is called multiple times', () => {
      const instance1 = CacheService.getInstance();
      const instance2 = CacheService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should maintain state across getInstance calls', async () => {
      const instance1 = CacheService.getInstance();
      await instance1.set(testKey, testValue);

      const instance2 = CacheService.getInstance();
      const retrievedValue = await instance2.get(testKey);
      expect(retrievedValue).toEqual(testValue);
    });
  });

  describe('Basic Cache Operations', () => {
    test('should successfully set and get a value', async () => {
      await cacheService.set(testKey, testValue);
      const result = await cacheService.get(testKey);
      expect(result).toEqual(testValue);
    });

    test('should set value with TTL', async () => {
      const ttl = 60;
      await cacheService.set(testKey, testValue, ttl);
      const result = await cacheService.get(testKey);
      expect(result).toEqual(testValue);
    });

    test('should return null for non-existent key', async () => {
      const result = await cacheService.get('nonexistent-key');
      expect(result).toBeNull();
    });

    test('should successfully delete a value', async () => {
      await cacheService.set(testKey, testValue);
      const deleteResult = await cacheService.delete(testKey);
      expect(deleteResult).toBe(true);
      
      const getResult = await cacheService.get(testKey);
      expect(getResult).toBeNull();
    });

    test('should clear all values with given prefix', async () => {
      const prefix = 'test-prefix:';
      await cacheService.set(`${prefix}1`, 'value1');
      await cacheService.set(`${prefix}2`, 'value2');
      await cacheService.set('other-key', 'value3');

      await cacheService.clear(prefix);

      expect(await cacheService.get(`${prefix}1`)).toBeNull();
      expect(await cacheService.get(`${prefix}2`)).toBeNull();
      expect(await cacheService.get('other-key')).not.toBeNull();
    });
  });

  describe('Encryption Functionality', () => {
    test('should encrypt and decrypt sensitive data', async () => {
      const sensitiveData = {
        password: 'secret123',
        apiKey: 'very-secret-key'
      };

      await cacheService.set(testKey, sensitiveData, undefined, { encrypt: true });
      const result = await cacheService.get(testKey, { encrypt: true });

      expect(result).toEqual(sensitiveData);
    });

    test('should handle encryption with different data types', async () => {
      const testCases = [
        { input: 123, description: 'number' },
        { input: true, description: 'boolean' },
        { input: [1, 2, 3], description: 'array' },
        { input: { nested: { data: 'test' } }, description: 'nested object' }
      ];

      for (const { input, description } of testCases) {
        await cacheService.set(`${testKey}-${description}`, input, undefined, { encrypt: true });
        const result = await cacheService.get(`${testKey}-${description}`, { encrypt: true });
        expect(result).toEqual(input);
      }
    });
  });

  describe('Connection Pool Management', () => {
    test('should return a healthy client from the pool', () => {
      const client = cacheService.getClient();
      expect(client).toBeInstanceOf(Redis);
    });

    test('should prefer replica client when specified', () => {
      const client = cacheService.getClient({ preferReplica: true });
      expect(client).toBeInstanceOf(Redis);
    });

    test('should handle connection pool exhaustion', async () => {
      const clients = Array.from({ length: 12 }, () => cacheService.getClient());
      expect(clients).toHaveLength(12);
      expect(clients.every(client => client instanceof Redis)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle set operation failures', async () => {
      const mockError = new Error('Redis connection error');
      jest.spyOn(Redis.prototype, 'set').mockRejectedValueOnce(mockError);

      await expect(cacheService.set(testKey, testValue))
        .rejects
        .toThrow('Failed to set cache value');
    });

    test('should handle get operation failures', async () => {
      const mockError = new Error('Redis connection error');
      jest.spyOn(Redis.prototype, 'get').mockRejectedValueOnce(mockError);

      await expect(cacheService.get(testKey))
        .rejects
        .toThrow('Failed to get cache value');
    });

    test('should handle delete operation failures', async () => {
      const mockError = new Error('Redis connection error');
      jest.spyOn(Redis.prototype, 'del').mockRejectedValueOnce(mockError);

      await expect(cacheService.delete(testKey))
        .rejects
        .toThrow('Failed to delete cache value');
    });
  });

  describe('Performance Optimization', () => {
    test('should handle batch operations efficiently', async () => {
      const batchSize = 1000;
      const operations = Array.from({ length: batchSize }, (_, i) => ({
        key: `batch-key-${i}`,
        value: `batch-value-${i}`
      }));

      const startTime = Date.now();
      
      await Promise.all(operations.map(op => 
        cacheService.set(op.key, op.value)
      ));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify performance is within acceptable range (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds for 1000 operations

      // Verify data integrity
      const results = await Promise.all(operations.map(op =>
        cacheService.get(op.key)
      ));

      expect(results).toHaveLength(batchSize);
      results.forEach((result, i) => {
        expect(result).toBe(`batch-value-${i}`);
      });
    });
  });

  describe('Security Features', () => {
    test('should handle secure key prefixes', async () => {
      const secureKey = `${cacheConfig.redis.keyPrefix}secure:${testKey}`;
      await cacheService.set(secureKey, testValue);
      const result = await cacheService.get(secureKey);
      expect(result).toEqual(testValue);
    });

    test('should prevent cache poisoning attempts', async () => {
      const maliciousKey = '../etc/passwd';
      await expect(cacheService.set(maliciousKey, 'malicious-data'))
        .rejects
        .toThrow();
    });

    test('should handle null and undefined values securely', async () => {
      await cacheService.set(testKey, null);
      expect(await cacheService.get(testKey)).toBeNull();

      await cacheService.set(testKey, undefined);
      expect(await cacheService.get(testKey)).toBeNull();
    });
  });
});