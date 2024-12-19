# Provider configuration for DataDog and AWS
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

# DataDog dashboard URL for infrastructure monitoring visualization
output "dashboard_url" {
  description = "URL of the DataDog infrastructure monitoring dashboard for system visualization"
  value       = datadog_dashboard.infrastructure_overview.url
}

# Map of DataDog monitor IDs for external integrations
output "monitor_ids" {
  description = "Map of DataDog monitor names to their IDs for external integrations"
  value       = {
    for monitor in datadog_monitor.service_health : monitor.name => monitor.id
  }
}

# CloudWatch log group ARN for application logs and audit trails
output "log_group_arn" {
  description = "ARN of the CloudWatch log group for application logs and audit trails"
  value       = aws_cloudwatch_log_group.app_logs.arn
}

# CloudWatch log group name for application logs and monitoring
output "log_group_name" {
  description = "Name of the CloudWatch log group for application logs and monitoring"
  value       = aws_cloudwatch_log_group.app_logs.name
}

# Secure map of DataDog monitor webhook URLs for CI/CD integration
output "alert_webhook_urls" {
  description = "Secure map of DataDog monitor names to their notification webhook URLs for CI/CD integration"
  value       = {
    for monitor in datadog_monitor.service_health : monitor.name => monitor.notification_url
  }
  sensitive   = true
}

# Additional outputs for comprehensive monitoring integration

# SNS topic ARN for CloudWatch alerts
output "monitoring_sns_topic_arn" {
  description = "ARN of the SNS topic for CloudWatch monitoring alerts"
  value       = aws_sns_topic.monitoring_alerts.arn
}

# KMS key ARN used for log encryption
output "log_encryption_key_arn" {
  description = "ARN of the KMS key used for encrypting CloudWatch logs"
  value       = aws_kms_key.log_encryption.arn
  sensitive   = true
}

# CloudWatch metric namespace for custom metrics
output "metrics_namespace" {
  description = "Namespace used for custom CloudWatch metrics in the monitoring configuration"
  value       = local.metrics_namespace
}

# APM service name for tracing and metrics correlation
output "apm_service_name" {
  description = "APM service name used for tracing and metrics correlation in DataDog"
  value       = local.apm_service_name
}

# Error tracking alarm ARN
output "error_alarm_arn" {
  description = "ARN of the CloudWatch alarm monitoring error rates"
  value       = aws_cloudwatch_metric_alarm.error_rate.arn
}