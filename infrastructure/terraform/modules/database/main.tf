# Provider configuration
# AWS Provider version ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Local variables for resource naming and configuration
locals {
  mongodb_cluster_name = "${var.environment}-docdb-cluster"
  redis_cluster_name   = "${var.environment}-redis-cluster"
  monitoring_interval  = 30

  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Module      = "database"
  }
}

# DocumentDB (MongoDB) Cluster
resource "aws_docdb_cluster" "main" {
  cluster_identifier              = local.mongodb_cluster_name
  engine                         = "docdb"
  engine_version                 = "6.0"
  master_username                = var.mongodb_username
  master_password                = var.mongodb_password
  backup_retention_period        = var.backup_retention_period
  preferred_backup_window        = "02:00-04:00"
  preferred_maintenance_window   = "mon:04:00-mon:06:00"
  skip_final_snapshot           = false
  final_snapshot_identifier     = "${local.mongodb_cluster_name}-final-snapshot"
  storage_encrypted             = var.enable_encryption
  kms_key_id                    = var.enable_encryption ? var.kms_key_id : null
  vpc_security_group_ids        = var.security_group_ids
  db_subnet_group_name          = aws_docdb_subnet_group.main.name
  enabled_cloudwatch_logs_exports = ["audit", "profiler"]

  tags = merge(local.common_tags, {
    Name = local.mongodb_cluster_name
  })
}

# DocumentDB Subnet Group
resource "aws_docdb_subnet_group" "main" {
  name        = "${local.mongodb_cluster_name}-subnet-group"
  subnet_ids  = var.private_subnet_ids
  description = "Subnet group for ${local.mongodb_cluster_name} DocumentDB cluster"

  tags = local.common_tags
}

# DocumentDB Cluster Instances
resource "aws_docdb_cluster_instance" "main" {
  count              = var.mongodb_instance_count
  identifier         = "${local.mongodb_cluster_name}-${count.index + 1}"
  cluster_identifier = aws_docdb_cluster.main.id
  instance_class     = var.mongodb_instance_class
  
  auto_minor_version_upgrade = true
  monitoring_interval       = local.monitoring_interval
  monitoring_role_arn      = aws_iam_role.monitoring.arn

  tags = merge(local.common_tags, {
    Name = "${local.mongodb_cluster_name}-${count.index + 1}"
  })
}

# ElastiCache (Redis) Cluster
resource "aws_elasticache_cluster" "main" {
  cluster_id           = local.redis_cluster_name
  engine              = "redis"
  engine_version      = "7.0"
  node_type           = var.redis_node_type
  num_cache_nodes     = var.redis_num_cache_nodes
  parameter_group_name = aws_elasticache_parameter_group.main.name
  port                = var.redis_port
  
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = var.security_group_ids
  
  snapshot_retention_limit = var.backup_retention_period
  snapshot_window         = "03:00-05:00"
  maintenance_window      = "sun:05:00-sun:07:00"
  
  at_rest_encryption_enabled = var.enable_encryption
  transit_encryption_enabled = true
  auth_token                = var.mongodb_password # Using same password for Redis AUTH
  
  auto_minor_version_upgrade = true
  notification_topic_arn     = aws_sns_topic.cache_alerts.arn

  tags = merge(local.common_tags, {
    Name = local.redis_cluster_name
  })
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  family = "redis7"
  name   = "${local.redis_cluster_name}-params"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "AKE"
  }

  tags = local.common_tags
}

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name        = "${local.redis_cluster_name}-subnet-group"
  subnet_ids  = var.private_subnet_ids
  description = "Subnet group for ${local.redis_cluster_name} ElastiCache cluster"

  tags = local.common_tags
}

# IAM Role for Enhanced Monitoring
resource "aws_iam_role" "monitoring" {
  name = "${var.environment}-db-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# Attach Enhanced Monitoring Policy
resource "aws_iam_role_policy_attachment" "monitoring" {
  role       = aws_iam_role.monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# SNS Topic for Cache Alerts
resource "aws_sns_topic" "cache_alerts" {
  name = "${var.environment}-cache-alerts"

  tags = local.common_tags
}

# CloudWatch Alarms for DocumentDB
resource "aws_cloudwatch_metric_alarm" "docdb_cpu" {
  alarm_name          = "${local.mongodb_cluster_name}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/DocDB"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors DocumentDB CPU utilization"
  alarm_actions       = [aws_sns_topic.cache_alerts.arn]
  
  dimensions = {
    DBClusterIdentifier = aws_docdb_cluster.main.cluster_identifier
  }

  tags = local.common_tags
}

# CloudWatch Alarms for Redis
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${local.redis_cluster_name}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors Redis CPU utilization"
  alarm_actions       = [aws_sns_topic.cache_alerts.arn]
  
  dimensions = {
    CacheClusterId = aws_elasticache_cluster.main.cluster_id
  }

  tags = local.common_tags
}