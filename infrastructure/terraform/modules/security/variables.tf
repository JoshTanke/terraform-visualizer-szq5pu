# AWS Provider version ~> 4.0

# Project identification variable
variable "project_name" {
  type        = string
  description = "Name of the project for resource tagging and identification"

  validation {
    condition     = length(var.project_name) > 0 && length(var.project_name) <= 63
    error_message = "Project name must be between 1 and 63 characters"
  }
}

# Environment segregation variable
variable "environment" {
  type        = string
  description = "Environment name for resource tagging (e.g., production, staging, development)"

  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Environment must be one of: production, staging, development"
  }
}

# Network security variable
variable "vpc_id" {
  type        = string
  description = "VPC ID for security group association and network security controls"

  validation {
    condition     = can(regex("^vpc-[a-f0-9]{8,17}$", var.vpc_id))
    error_message = "VPC ID must be a valid AWS VPC identifier"
  }
}

# SSL/TLS configuration variable
variable "domain_name" {
  type        = string
  description = "Domain name for SSL certificate provisioning and validation"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid fully qualified domain name"
  }
}

# WAF configuration variable
variable "waf_rate_limit" {
  type        = number
  description = "Rate limit for WAF rules (requests per 5 minutes) for DDoS protection"
  default     = 2000

  validation {
    condition     = var.waf_rate_limit >= 100 && var.waf_rate_limit <= 20000
    error_message = "WAF rate limit must be between 100 and 20000 requests per 5 minutes"
  }
}

# KMS configuration variables
variable "kms_deletion_window" {
  type        = number
  description = "KMS key deletion window in days for secure key management"
  default     = 30

  validation {
    condition     = var.kms_deletion_window >= 7 && var.kms_deletion_window <= 30
    error_message = "KMS deletion window must be between 7 and 30 days"
  }
}

variable "enable_key_rotation" {
  type        = bool
  description = "Enable automatic KMS key rotation for enhanced security"
  default     = true
}