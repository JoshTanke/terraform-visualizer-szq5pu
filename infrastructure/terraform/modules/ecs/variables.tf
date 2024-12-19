# Terraform AWS ECS Module Variables
# terraform >= 1.0.0

# Environment identifier for resource naming and tagging
variable "environment" {
  type        = string
  description = "Environment name for resource naming and tagging (e.g., dev, staging, prod)"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Project name for consistent resource naming
variable "project_name" {
  type        = string
  description = "Project name used for resource naming and tagging across infrastructure"
}

# VPC configuration for network isolation
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where ECS resources will be deployed"
}

# Subnet configuration for high availability
variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for multi-AZ ECS task deployment"
  
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least two private subnets must be provided for high availability."
  }
}

# Frontend service Fargate task configuration
variable "frontend_cpu" {
  type        = number
  description = "CPU units (in vCPU) allocated to frontend service Fargate tasks"
  default     = 2048 # 2 vCPU
  
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.frontend_cpu)
    error_message = "Frontend CPU must be one of: 256, 512, 1024, 2048, 4096 units."
  }
}

variable "frontend_memory" {
  type        = number
  description = "Memory (in MiB) allocated to frontend service Fargate tasks"
  default     = 4096 # 4 GB
  
  validation {
    condition     = var.frontend_memory >= 512 && var.frontend_memory <= 30720
    error_message = "Frontend memory must be between 512 MiB and 30720 MiB."
  }
}

# API Gateway service Fargate task configuration
variable "api_cpu" {
  type        = number
  description = "CPU units (in vCPU) allocated to API Gateway service Fargate tasks"
  default     = 1024 # 1 vCPU
  
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.api_cpu)
    error_message = "API CPU must be one of: 256, 512, 1024, 2048, 4096 units."
  }
}

variable "api_memory" {
  type        = number
  description = "Memory (in MiB) allocated to API Gateway service Fargate tasks"
  default     = 2048 # 2 GB
  
  validation {
    condition     = var.api_memory >= 512 && var.api_memory <= 30720
    error_message = "API memory must be between 512 MiB and 30720 MiB."
  }
}

# Parser service Fargate task configuration
variable "parser_cpu" {
  type        = number
  description = "CPU units (in vCPU) allocated to Parser service Fargate tasks"
  default     = 2048 # 2 vCPU
  
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.parser_cpu)
    error_message = "Parser CPU must be one of: 256, 512, 1024, 2048, 4096 units."
  }
}

variable "parser_memory" {
  type        = number
  description = "Memory (in MiB) allocated to Parser service Fargate tasks"
  default     = 4096 # 4 GB
  
  validation {
    condition     = var.parser_memory >= 512 && var.parser_memory <= 30720
    error_message = "Parser memory must be between 512 MiB and 30720 MiB."
  }
}

# Auto-scaling configuration
variable "min_capacity" {
  type        = number
  description = "Minimum number of tasks for service auto-scaling"
  default     = 2
  
  validation {
    condition     = var.min_capacity >= 2
    error_message = "Minimum capacity must be at least 2 for high availability."
  }
}

variable "max_capacity" {
  type        = number
  description = "Maximum number of tasks for service auto-scaling"
  default     = 8
  
  validation {
    condition     = var.max_capacity >= var.min_capacity
    error_message = "Maximum capacity must be greater than or equal to minimum capacity."
  }
}