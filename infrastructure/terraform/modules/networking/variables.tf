# VPC CIDR block configuration
variable "vpc_cidr" {
  type        = string
  description = "The CIDR block for the VPC. Must be a valid IPv4 CIDR block in the range /16 to /24."
  
  validation {
    condition     = can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/([16-9]|2[0-4])$", var.vpc_cidr))
    error_message = "VPC CIDR block must be a valid IPv4 CIDR in the range /16 to /24 (e.g., 10.0.0.0/16)."
  }
}

# Environment name configuration
variable "environment" {
  type        = string
  description = "The environment name (dev, staging, prod) for resource tagging and identification."
  
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Project name configuration
variable "project_name" {
  type        = string
  description = "The project name for resource tagging and identification. Must be lowercase alphanumeric with hyphens only."
  
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.project_name))
    error_message = "Project name must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric character."
  }
}

# NAT Gateway deployment strategy
variable "single_nat_gateway" {
  type        = bool
  description = "Whether to deploy a single NAT Gateway (true) or one per AZ (false). Use true for dev/staging, false for prod."
  default     = false
}

# Public subnet CIDR blocks
variable "public_subnet_cidrs" {
  type        = list(string)
  description = "List of CIDR blocks for public subnets. One per AZ, must be within VPC CIDR range."
  
  validation {
    condition = alltrue([
      for cidr in var.public_subnet_cidrs : can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$", cidr))
    ])
    error_message = "All public subnet CIDR blocks must be valid IPv4 CIDR notation."
  }

  validation {
    condition = length(var.public_subnet_cidrs) >= 2 && length(var.public_subnet_cidrs) <= 3
    error_message = "Must specify between 2 and 3 public subnet CIDR blocks for high availability."
  }
}

# Private subnet CIDR blocks
variable "private_subnet_cidrs" {
  type        = list(string)
  description = "List of CIDR blocks for private subnets. One per AZ, must be within VPC CIDR range."
  
  validation {
    condition = alltrue([
      for cidr in var.private_subnet_cidrs : can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$", cidr))
    ])
    error_message = "All private subnet CIDR blocks must be valid IPv4 CIDR notation."
  }

  validation {
    condition = length(var.private_subnet_cidrs) >= 2 && length(var.private_subnet_cidrs) <= 3
    error_message = "Must specify between 2 and 3 private subnet CIDR blocks for high availability."
  }
}