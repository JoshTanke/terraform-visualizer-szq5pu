# Required provider configuration for monitoring services
# DataDog Provider Version: ~> 3.20.0
# AWS Provider Version: ~> 4.0
terraform {
  required_providers {
    datadog = {
      source  = "datadog/datadog"
      version = "~> 3.20.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# DataDog authentication and API access variables
variable "datadog_api_key" {
  description = "DataDog API key for authentication and monitoring service integration"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.datadog_api_key) > 0
    error_message = "DataDog API key cannot be empty - required for monitoring service authentication"
  }
}

variable "datadog_app_key" {
  description = "DataDog Application key for API access and service configuration"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.datadog_app_key) > 0
    error_message = "DataDog Application key cannot be empty - required for API access"
  }
}

# Environment configuration
variable "environment" {
  description = "Environment name for resource naming, tagging, and configuration management (staging or production)"
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either staging or production for proper monitoring configuration"
  }
}

# Log retention configuration
variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs for compliance and troubleshooting"
  type        = number
  default     = 30

  validation {
    condition     = var.log_retention_days >= 1 && var.log_retention_days <= 365
    error_message = "Log retention days must be between 1 and 365 to balance storage costs and compliance requirements"
  }
}

# Alert notification configuration
variable "alert_notification_channel" {
  description = "Primary channel for alert notifications with support for email, slack, or pagerduty integration"
  type        = string
  default     = "slack"

  validation {
    condition     = contains(["email", "slack", "pagerduty"], var.alert_notification_channel)
    error_message = "Alert notification channel must be email, slack, or pagerduty for proper alert routing"
  }
}

# Metrics collection configuration
variable "metrics_collection_interval" {
  description = "Interval in seconds for metrics collection, affecting monitoring granularity and cost"
  type        = number
  default     = 60

  validation {
    condition     = var.metrics_collection_interval >= 30 && var.metrics_collection_interval <= 300
    error_message = "Metrics collection interval must be between 30 and 300 seconds to balance performance and cost"
  }
}

# APM configuration
variable "enable_apm_tracing" {
  description = "Toggle for Application Performance Monitoring tracing with impact on performance and cost"
  type        = bool
  default     = true
}

# Dashboard configuration
variable "dashboard_refresh_interval" {
  description = "Dashboard refresh interval in seconds for real-time monitoring updates"
  type        = number
  default     = 300

  validation {
    condition     = var.dashboard_refresh_interval >= 60 && var.dashboard_refresh_interval <= 3600
    error_message = "Dashboard refresh interval must be between 60 and 3600 seconds for optimal performance"
  }
}