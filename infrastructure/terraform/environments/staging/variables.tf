# AWS Provider version: ~> 4.0

# Environment Configuration
variable "environment" {
  description = "Environment name for resource tagging"
  type        = string
  default     = "staging"

  validation {
    condition     = var.environment == "staging"
    error_message = "Environment must be 'staging' for this configuration"
  }
}

variable "project_name" {
  description = "Project name for resource tagging"
  type        = string
  default     = "terraform-visualizer"
}

# Region Configuration
variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "us-west-2"
}

# Network Configuration
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

# Database Configuration
variable "mongodb_username" {
  description = "MongoDB admin username"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.mongodb_username) >= 3
    error_message = "MongoDB username must be at least 3 characters long"
  }
}

variable "mongodb_password" {
  description = "MongoDB admin password"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.mongodb_password) >= 8
    error_message = "MongoDB password must be at least 8 characters long"
  }
}

# Container Images
variable "frontend_image" {
  description = "Docker image for frontend service"
  type        = string
}

variable "api_image" {
  description = "Docker image for API gateway service"
  type        = string
}

variable "parser_image" {
  description = "Docker image for parser service"
  type        = string
}