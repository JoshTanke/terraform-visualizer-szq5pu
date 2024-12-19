# Environment Configuration
variable "environment" {
  type        = string
  description = "Environment name (e.g., dev, staging, prod) for resource tagging and naming"
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Network Configuration
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where database resources will be deployed"
  validation {
    condition     = can(regex("^vpc-[a-z0-9]{8,}$", var.vpc_id))
    error_message = "VPC ID must be a valid AWS VPC identifier."
  }
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for multi-AZ database deployment"
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least two private subnets must be provided for high availability."
  }
}

variable "security_group_ids" {
  type        = list(string)
  description = "List of security group IDs to control database access"
  validation {
    condition     = length(var.security_group_ids) > 0
    error_message = "At least one security group ID must be provided."
  }
}

# MongoDB (DocumentDB) Configuration
variable "mongodb_instance_class" {
  type        = string
  default     = "t3.large"
  description = "MongoDB DocumentDB instance class for performance configuration"
  validation {
    condition     = can(regex("^(t3|r5|r6g)\\.(large|xlarge|2xlarge)$", var.mongodb_instance_class))
    error_message = "Instance class must be a valid DocumentDB instance type (t3/r5/r6g).(large/xlarge/2xlarge)."
  }
}

variable "mongodb_instance_count" {
  type        = number
  default     = 3
  description = "Number of MongoDB DocumentDB instances for high availability"
  validation {
    condition     = var.mongodb_instance_count >= 1 && var.mongodb_instance_count <= 10
    error_message = "Instance count must be between 1 and 10."
  }
}

variable "mongodb_username" {
  type        = string
  description = "MongoDB admin username"
  sensitive   = true
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{2,15}$", var.mongodb_username))
    error_message = "Username must start with a letter, contain only alphanumeric characters and underscores, and be 3-16 characters long."
  }
}

variable "mongodb_password" {
  type        = string
  description = "MongoDB admin password"
  sensitive   = true
  validation {
    condition     = can(regex("^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{12,}$", var.mongodb_password))
    error_message = "Password must be at least 12 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
  }
}

# Redis (ElastiCache) Configuration
variable "redis_node_type" {
  type        = string
  default     = "r6g.large"
  description = "Redis ElastiCache node type for performance configuration"
  validation {
    condition     = can(regex("^(t3|r5|r6g)\\.(micro|small|medium|large|xlarge)$", var.redis_node_type))
    error_message = "Node type must be a valid ElastiCache instance type."
  }
}

variable "redis_num_cache_nodes" {
  type        = number
  default     = 2
  description = "Number of Redis cache nodes for scaling and availability"
  validation {
    condition     = var.redis_num_cache_nodes >= 1 && var.redis_num_cache_nodes <= 6
    error_message = "Number of cache nodes must be between 1 and 6."
  }
}

variable "redis_port" {
  type        = number
  default     = 6379
  description = "Redis port number for service access"
  validation {
    condition     = var.redis_port >= 1024 && var.redis_port <= 65535
    error_message = "Port number must be between 1024 and 65535."
  }
}

# Security Configuration
variable "enable_encryption" {
  type        = bool
  default     = true
  description = "Enable encryption at rest for both MongoDB and Redis databases"
}