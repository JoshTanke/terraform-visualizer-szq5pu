// External dependencies
import { describe, test, expect, beforeAll, beforeEach, afterEach, jest } from '@jest/globals';
import { performance } from 'perf_hooks';

// Internal dependencies
import { TerraformParser } from '../../src/parser/TerraformParser';
import { IModule } from '../../src/interfaces/IModule';
import { IResource } from '../../src/interfaces/IResource';

// Test constants
const TEST_TIMEOUT = 10000; // 10 seconds for longer tests
const PERFORMANCE_THRESHOLD = 3000; // 3 seconds max parse time
const BATCH_SIZE = 50;

// Test fixtures
const TEST_FIXTURES = {
  SMALL_CONFIG: `
    resource "aws_instance" "web" {
      ami           = "ami-123"
      instance_type = "t2.micro"
    }
  `,
  MEDIUM_CONFIG: `
    module "vpc" {
      source = "terraform-aws-modules/vpc/aws"
      version = "3.2.0"
      name = "my-vpc"
      cidr = "10.0.0.0/16"
    }
    resource "aws_instance" "web" {
      count = 5
      ami   = "ami-123"
      instance_type = "t2.micro"
      subnet_id = module.vpc.public_subnets[0]
    }
  `,
  LARGE_CONFIG: Array(100).fill(`
    resource "aws_instance" "web" {
      ami           = "ami-123"
      instance_type = "t2.micro"
      tags = {
        Name = "web-server"
      }
    }
  `).join('\n'),
  INVALID_CONFIG: `
    resource "aws_instance" {
      // Missing name
      ami = "ami-123"
    }
  `
};

describe('TerraformParser', () => {
  let parser: TerraformParser;

  beforeAll(() => {
    jest.setTimeout(TEST_TIMEOUT);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Parse Performance Tests', () => {
    test('should parse small configuration within performance threshold', async () => {
      const startTime = performance.now();
      parser = new TerraformParser(TEST_FIXTURES.SMALL_CONFIG);
      const result = await parser.parseConfiguration();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(result.metadata.parseTime).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(result.resources.size).toBe(1);
    });

    test('should parse medium configuration with modules within threshold', async () => {
      const startTime = performance.now();
      parser = new TerraformParser(TEST_FIXTURES.MEDIUM_CONFIG);
      const result = await parser.parseConfiguration();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(result.metadata.moduleCount).toBe(1);
      expect(result.resources.size).toBe(5); // Due to count = 5
    });

    test('should parse large configuration efficiently', async () => {
      const startTime = performance.now();
      parser = new TerraformParser(TEST_FIXTURES.LARGE_CONFIG);
      const result = await parser.parseConfiguration();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(result.resources.size).toBe(100);
    });

    test('should utilize caching for repeated parses', async () => {
      parser = new TerraformParser(TEST_FIXTURES.MEDIUM_CONFIG);
      
      const firstParseStart = performance.now();
      await parser.parseConfiguration();
      const firstParseDuration = performance.now() - firstParseStart;

      const secondParseStart = performance.now();
      await parser.parseConfiguration();
      const secondParseDuration = performance.now() - secondParseStart;

      expect(secondParseDuration).toBeLessThan(firstParseDuration);
    });
  });

  describe('Block Parsing Tests', () => {
    test('should parse resource blocks correctly', async () => {
      parser = new TerraformParser(TEST_FIXTURES.SMALL_CONFIG);
      const result = await parser.parseConfiguration();

      const resource = result.resources.get('aws_instance.web');
      expect(resource).toBeDefined();
      expect(resource?.type).toBe('aws_instance');
      expect(resource?.name).toBe('web');
      expect(resource?.attributes.ami).toBe('ami-123');
      expect(resource?.attributes.instance_type).toBe('t2.micro');
    });

    test('should parse module blocks with dependencies', async () => {
      parser = new TerraformParser(TEST_FIXTURES.MEDIUM_CONFIG);
      const result = await parser.parseConfiguration();

      const vpcModule = result.modules.get('vpc');
      expect(vpcModule).toBeDefined();
      expect(vpcModule?.source).toBe('terraform-aws-modules/vpc/aws');
      expect(vpcModule?.version).toBe('3.2.0');

      const webInstance = result.resources.get('aws_instance.web');
      expect(webInstance?.dependencies).toContain('module.vpc');
    });

    test('should handle count meta-argument correctly', async () => {
      parser = new TerraformParser(TEST_FIXTURES.MEDIUM_CONFIG);
      const result = await parser.parseConfiguration();

      const webInstance = result.resources.get('aws_instance.web');
      expect(webInstance?.count).toBe(5);
    });

    test('should validate and reject invalid configurations', async () => {
      parser = new TerraformParser(TEST_FIXTURES.INVALID_CONFIG);
      await expect(parser.parseConfiguration()).rejects.toThrow();
    });
  });

  describe('Visualization Support Tests', () => {
    test('should generate pipeline view metadata', async () => {
      const config = `
        module "staging" {
          source = "./environments/staging"
        }
        module "production" {
          source = "./environments/production"
        }
      `;
      
      parser = new TerraformParser(config);
      const result = await parser.parseConfiguration();

      expect(result.modules.size).toBe(2);
      result.modules.forEach(module => {
        expect(module.position).toBeDefined();
        expect(typeof module.position.x).toBe('number');
        expect(typeof module.position.y).toBe('number');
      });
    });

    test('should generate environment view metadata', async () => {
      const config = `
        module "network" {
          source = "./modules/network"
        }
        module "compute" {
          source = "./modules/compute"
          depends_on = [module.network]
        }
      `;
      
      parser = new TerraformParser(config);
      const result = await parser.parseConfiguration();

      expect(result.dependencies.size).toBeGreaterThan(0);
      const computeModule = result.modules.get('compute');
      expect(computeModule?.dependencies).toContain('module.network');
    });

    test('should generate module view with resource relationships', async () => {
      const config = `
        resource "aws_vpc" "main" {
          cidr_block = "10.0.0.0/16"
        }
        resource "aws_subnet" "public" {
          vpc_id = aws_vpc.main.id
          cidr_block = "10.0.1.0/24"
        }
      `;
      
      parser = new TerraformParser(config);
      const result = await parser.parseConfiguration();

      const subnet = result.resources.get('aws_subnet.public');
      expect(subnet?.dependencies).toContain('aws_vpc.main');
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle syntax errors gracefully', async () => {
      const invalidConfig = `
        resource "aws_instance" "web" {
          ami = // Missing value
        }
      `;
      
      parser = new TerraformParser(invalidConfig);
      await expect(parser.parseConfiguration()).rejects.toThrow();
    });

    test('should detect circular dependencies', async () => {
      const circularConfig = `
        resource "aws_instance" "a" {
          depends_on = [aws_instance.b]
        }
        resource "aws_instance" "b" {
          depends_on = [aws_instance.a]
        }
      `;
      
      parser = new TerraformParser(circularConfig);
      await expect(parser.parseConfiguration()).rejects.toThrow();
    });

    test('should validate resource references', async () => {
      const invalidRefConfig = `
        resource "aws_instance" "web" {
          subnet_id = aws_subnet.missing.id
        }
      `;
      
      parser = new TerraformParser(invalidRefConfig);
      await expect(parser.parseConfiguration()).rejects.toThrow();
    });
  });
});