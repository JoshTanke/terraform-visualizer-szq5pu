# AWS Provider version: ~> 4.0
# Production environment variable definitions for the Terraform Visualization Tool
# Defines critical configuration parameters for networking, compute, database, monitoring, and security

# AWS Region Configuration
variable "aws_region" {
  type        = string
  description = "AWS region for deploying the production infrastructure with high availability"
  default     = "us-west-2"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.aws_region))
    error_message = "AWS region must be in the format: us-west-2, eu-central-1, etc."
  }
}

# Domain Configuration
variable "domain_name" {
  type        = string
  description = "Domain name for the Terraform Visualization Tool production environment"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid domain format"
  }
}

# Network Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the production VPC network"
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

# Database Configuration
variable "mongodb_username" {
  type        = string
  description = "MongoDB admin username for production database access"

  validation {
    condition     = length(var.mongodb_username) >= 3
    error_message = "MongoDB username must be at least 3 characters long"
  }
}

variable "mongodb_password" {
  type        = string
  description = "Secure MongoDB admin password for production database access"
  sensitive   = true

  validation {
    condition = length(var.mongodb_password) >= 12 && can(regex(
      "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[^A-Za-z0-9])[A-Za-z\\d^A-Za-z0-9]{12,}$",
      var.mongodb_password
    ))
    error_message = "MongoDB password must be at least 12 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character"
  }
}

# Monitoring Configuration
variable "datadog_api_key" {
  type        = string
  description = "DataDog API key for production monitoring and observability integration"
  sensitive   = true

  validation {
    condition     = length(var.datadog_api_key) > 0 && can(regex("^[a-f0-9]{32}$", var.datadog_api_key))
    error_message = "DataDog API key must be a valid 32-character hexadecimal string"
  }
}