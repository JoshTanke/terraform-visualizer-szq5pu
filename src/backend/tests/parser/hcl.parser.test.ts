// External dependencies
import { describe, it, expect, beforeEach, afterEach, jest } from 'jest'; // v29.0.0
import { performance } from 'perf_hooks';

// Internal dependencies
import { HCLParser } from '../../src/parser/HCLParser';
import { Logger } from '../../src/utils/logger';
import { ValidationError, ParseError } from '../../src/utils/errors';

// Constants
const TEST_TIMEOUT = 10000;
const PERFORMANCE_THRESHOLD_MS = 3000;
const TEST_FILE_SIZES = [1, 5, 10, 20]; // MB sizes for performance testing

// Sample Terraform configurations for testing
const SAMPLE_CONFIGURATIONS = {
  resource: `
    resource "aws_instance" "web" {
      ami           = "ami-123456"
      instance_type = "t2.micro"
      tags = {
        Name = "web-server"
      }
    }
  `,
  module: `
    module "vpc" {
      source = "terraform-aws-modules/vpc/aws"
      version = "3.2.0"
      name = "my-vpc"
      cidr = "10.0.0.0/16"
    }
  `,
  variable: `
    variable "environment" {
      type = string
      default = "development"
      description = "Environment name"
    }
  `,
  output: `
    output "instance_ip" {
      value = aws_instance.web.public_ip
      description = "Public IP of web server"
      sensitive = false
    }
  `,
  provider: `
    provider "aws" {
      region = "us-west-2"
      profile = "default"
    }
  `,
  data: `
    data "aws_ami" "ubuntu" {
      most_recent = true
      filter {
        name   = "name"
        values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"]
      }
    }
  `
};

describe('HCLParser', () => {
  let parser: HCLParser;
  let logger: Logger;

  beforeEach(() => {
    logger = Logger.getInstance();
    jest.spyOn(logger, 'error');
    jest.spyOn(logger, 'debug');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Block Parsing', () => {
    it('should parse resource blocks correctly', async () => {
      parser = new HCLParser(SAMPLE_CONFIGURATIONS.resource, logger);
      const result = await parser.parse();

      expect(result.resources.size).toBe(1);
      const resource = result.resources.get('aws_instance.web');
      expect(resource).toBeDefined();
      expect(resource.type).toBe('aws_instance');
      expect(resource.name).toBe('web');
      expect(resource.attributes.instance_type).toBe('t2.micro');
    });

    it('should parse module blocks correctly', async () => {
      parser = new HCLParser(SAMPLE_CONFIGURATIONS.module, logger);
      const result = await parser.parse();

      expect(result.modules.size).toBe(1);
      const module = result.modules.get('vpc');
      expect(module).toBeDefined();
      expect(module.source).toBe('terraform-aws-modules/vpc/aws');
      expect(module.version).toBe('3.2.0');
    });

    it('should parse variable blocks correctly', async () => {
      parser = new HCLParser(SAMPLE_CONFIGURATIONS.variable, logger);
      const result = await parser.parse();

      expect(result.variables.size).toBe(1);
      const variable = result.variables.get('environment');
      expect(variable).toBeDefined();
      expect(variable.type).toBe('string');
      expect(variable.default).toBe('development');
    });

    it('should parse output blocks correctly', async () => {
      parser = new HCLParser(SAMPLE_CONFIGURATIONS.output, logger);
      const result = await parser.parse();

      expect(result.outputs.size).toBe(1);
      const output = result.outputs.get('instance_ip');
      expect(output).toBeDefined();
      expect(output.value).toBe('aws_instance.web.public_ip');
      expect(output.sensitive).toBe(false);
    });

    it('should parse provider blocks correctly', async () => {
      parser = new HCLParser(SAMPLE_CONFIGURATIONS.provider, logger);
      const result = await parser.parse();

      expect(result.providers.size).toBe(1);
      const provider = result.providers.get('aws');
      expect(provider).toBeDefined();
      expect(provider.region).toBe('us-west-2');
    });

    it('should parse data blocks correctly', async () => {
      parser = new HCLParser(SAMPLE_CONFIGURATIONS.data, logger);
      const result = await parser.parse();

      expect(result.data.size).toBe(1);
      const data = result.data.get('aws_ami.ubuntu');
      expect(data).toBeDefined();
      expect(data.most_recent).toBe(true);
    });
  });

  describe('Performance Testing', () => {
    it('should parse files within performance threshold', async () => {
      for (const size of TEST_FILE_SIZES) {
        const content = generateLargeConfig(size);
        parser = new HCLParser(content, logger);

        const startTime = performance.now();
        const result = await parser.parse();
        const duration = performance.now() - startTime;

        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
        expect(result.metadata.parseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      }
    }, TEST_TIMEOUT);

    it('should utilize caching for repeated parses', async () => {
      parser = new HCLParser(SAMPLE_CONFIGURATIONS.resource, logger);

      const firstParseStart = performance.now();
      await parser.parse();
      const firstParseDuration = performance.now() - firstParseStart;

      const secondParseStart = performance.now();
      await parser.parse();
      const secondParseDuration = performance.now() - secondParseStart;

      expect(secondParseDuration).toBeLessThan(firstParseDuration);
      expect(logger.debug).toHaveBeenCalledWith('Using cached parse result', expect.any(Object));
    });
  });

  describe('Error Handling', () => {
    it('should handle syntax errors gracefully', async () => {
      const invalidConfig = `
        resource "aws_instance" "web" {
          ami = "ami-123456"
          instance_type = # Missing value
        }
      `;
      parser = new HCLParser(invalidConfig, logger);

      await expect(parser.parse()).rejects.toThrow(ParseError);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should validate resource references', async () => {
      const configWithInvalidRef = `
        resource "aws_instance" "web" {
          subnet_id = aws_subnet.nonexistent.id
        }
      `;
      parser = new HCLParser(configWithInvalidRef, logger);

      const result = await parser.parse();
      expect(result.metadata.hasErrors).toBe(true);
    });

    it('should detect circular dependencies', async () => {
      const circularConfig = `
        resource "aws_instance" "a" {
          depends_on = [aws_instance.b]
        }
        resource "aws_instance" "b" {
          depends_on = [aws_instance.a]
        }
      `;
      parser = new HCLParser(circularConfig, logger);

      const result = await parser.parse();
      expect(result.metadata.hasErrors).toBe(true);
    });

    it('should handle missing required fields', async () => {
      const incompleteConfig = `
        resource "aws_instance" "web" {
          # Missing required 'ami' field
          instance_type = "t2.micro"
        }
      `;
      parser = new HCLParser(incompleteConfig, logger);

      await expect(parser.parse()).rejects.toThrow(ValidationError);
    });
  });
});

/**
 * Helper function to generate large test configurations
 */
function generateLargeConfig(sizeMB: number): string {
  const resourceTemplate = SAMPLE_CONFIGURATIONS.resource;
  const resourceSize = Buffer.from(resourceTemplate).length;
  const repetitions = Math.floor((sizeMB * 1024 * 1024) / resourceSize);
  
  return Array(repetitions).fill(resourceTemplate).join('\n');
}