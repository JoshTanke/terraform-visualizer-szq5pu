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

# Local variables for resource naming and tagging
locals {
  metrics_namespace = "terraform-visualizer-${var.environment}"
  apm_service_name = "terraform-visualizer-${var.environment}"
  security_tags = {
    Environment   = var.environment
    SecurityZone  = "restricted"
    Service      = "terraform-visualizer"
    MonitoringType = "enhanced"
  }
}

# DataDog provider configuration
provider "datadog" {
  api_key = var.datadog_api_key
  app_key = var.datadog_app_key
}

# Enhanced Infrastructure Monitoring Dashboard
resource "datadog_dashboard" "infrastructure_overview" {
  title       = "Infrastructure Overview - ${title(var.environment)}"
  layout_type = "ordered"
  
  widget {
    group_definition {
      title = "System Health Overview"
      
      widget {
        query_value_definition {
          title = "System Health Score"
          request {
            q = "avg:system.cpu.user{environment:${var.environment}} + avg:system.mem.used{environment:${var.environment}}"
            aggregator = "avg"
          }
          custom_unit = "%"
          precision  = 2
        }
      }
      
      widget {
        timeseries_definition {
          title = "Resource Utilization"
          request {
            q = "avg:system.cpu.user{environment:${var.environment}}.rollup(avg, 60)"
            display_type = "line"
          }
          yaxis {
            min = "0"
            max = "100"
          }
        }
      }
    }
  }

  widget {
    group_definition {
      title = "APM Performance Metrics"
      
      widget {
        trace_service_definition {
          title = "Service Latency Distribution"
          service = local.apm_service_name
          span_name = "http.request"
          show_hits = true
          show_errors = true
          show_latency = true
        }
      }
      
      widget {
        toplist_definition {
          title = "Slowest Endpoints"
          request {
            q = "avg:trace.http.request.duration{service:${local.apm_service_name}} by {resource_name}.top(10)"
          }
        }
      }
    }
  }

  widget {
    group_definition {
      title = "Security Events"
      
      widget {
        alert_graph_definition {
          title = "Security Alerts"
          alert_id = datadog_monitor.service_health.id
          viz_type = "timeseries"
        }
      }
      
      widget {
        log_stream_definition {
          title = "Security Logs"
          query = "service:${local.apm_service_name} status:error"
          columns = ["timestamp", "message", "service", "status"]
        }
      }
    }
  }
}

# Enhanced Service Health Monitor
resource "datadog_monitor" "service_health" {
  name    = "Service Health - ${title(var.environment)}"
  type    = "metric alert"
  message = <<-EOT
    Service health degradation detected in ${var.environment} environment.
    
    Current Status: {{value}}
    Threshold: {{threshold}}
    
    Priority: High
    Environment: ${var.environment}
    Service: ${local.apm_service_name}
    
    Please investigate immediately.
    
    #security #production #alert
  EOT

  query = "avg(last_5m):( avg:system.cpu.user{environment:${var.environment}} + avg:system.mem.used{environment:${var.environment}} ) > 85"

  monitor_thresholds {
    warning  = 75.0
    critical = 85.0
  }

  evaluation_delay    = 60
  include_tags       = true
  require_full_window = true
  
  tags = [
    "env:${var.environment}",
    "service:terraform-visualizer",
    "security:enhanced",
    "team:infrastructure"
  ]
}

# Enhanced CloudWatch Log Group with Security Controls
resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/aws/terraform-visualizer/${var.environment}"
  retention_in_days = var.log_retention_days
  
  kms_key_id = aws_kms_key.log_encryption.arn

  tags = merge(local.security_tags, {
    Name = "terraform-visualizer-logs-${var.environment}"
    DataRetention = "${var.log_retention_days} days"
  })
}

# KMS Key for Log Encryption
resource "aws_kms_key" "log_encryption" {
  description = "KMS key for encrypting CloudWatch logs - ${var.environment}"
  enable_key_rotation = true
  
  tags = merge(local.security_tags, {
    Name = "terraform-visualizer-logs-key-${var.environment}"
  })
}

# CloudWatch Log Metric Filter for Error Tracking
resource "aws_cloudwatch_log_metric_filter" "error_metrics" {
  name           = "error-metrics-${var.environment}"
  pattern        = "[timestamp, requestid, level = ERROR, message]"
  log_group_name = aws_cloudwatch_log_group.app_logs.name

  metric_transformation {
    name          = "ErrorCount"
    namespace     = local.metrics_namespace
    value         = "1"
    default_value = "0"
  }
}

# CloudWatch Alarm for Error Rate
resource "aws_cloudwatch_metric_alarm" "error_rate" {
  alarm_name          = "error-rate-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ErrorCount"
  namespace           = local.metrics_namespace
  period             = "300"
  statistic          = "Sum"
  threshold          = "10"
  alarm_description  = "This metric monitors error rate in ${var.environment}"
  
  alarm_actions = ["${aws_sns_topic.monitoring_alerts.arn}"]
  
  tags = local.security_tags
}

# SNS Topic for CloudWatch Alarms
resource "aws_sns_topic" "monitoring_alerts" {
  name = "monitoring-alerts-${var.environment}"
  
  kms_master_key_id = aws_kms_key.log_encryption.id
  
  tags = local.security_tags
}