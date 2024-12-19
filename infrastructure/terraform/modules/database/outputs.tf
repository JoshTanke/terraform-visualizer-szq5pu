# MongoDB (DocumentDB) Outputs
output "mongodb_endpoint" {
  description = "The endpoint of the DocumentDB cluster for application connection"
  value       = aws_docdb_cluster.main.endpoint
}

output "mongodb_port" {
  description = "The port number on which the DocumentDB cluster accepts connections"
  value       = aws_docdb_cluster.main.port
}

output "mongodb_connection_string" {
  description = "The complete MongoDB connection string including protocol, endpoint, and port"
  value       = "mongodb://${aws_docdb_cluster.main.endpoint}:${aws_docdb_cluster.main.port}"
  sensitive   = true # Marked sensitive to prevent exposure in logs
}

# Redis (ElastiCache) Outputs
output "redis_endpoint" {
  description = "The configuration endpoint for the Redis cluster"
  value       = aws_elasticache_cluster.main.configuration_endpoint
}

output "redis_port" {
  description = "The port number on which the Redis cluster accepts connections"
  value       = var.redis_port
}

output "redis_nodes" {
  description = "Detailed information about all Redis cache nodes in the cluster"
  value = [
    for node in aws_elasticache_cluster.main.cache_nodes : {
      id      = node.id
      address = node.address
      port    = node.port
      az      = node.availability_zone
      status  = node.status
    }
  ]
}

# Additional Monitoring and Status Outputs
output "mongodb_monitoring_role_arn" {
  description = "The ARN of the IAM role used for enhanced MongoDB monitoring"
  value       = aws_iam_role.monitoring.arn
}

output "alerts_topic_arn" {
  description = "The ARN of the SNS topic used for database alerts and notifications"
  value       = aws_sns_topic.cache_alerts.arn
}

output "mongodb_cluster_identifier" {
  description = "The identifier of the DocumentDB cluster"
  value       = aws_docdb_cluster.main.cluster_identifier
}

output "redis_cluster_identifier" {
  description = "The identifier of the Redis cluster"
  value       = aws_elasticache_cluster.main.cluster_id
}

output "mongodb_resource_id" {
  description = "The resource ID of the DocumentDB cluster for CloudWatch monitoring"
  value       = aws_docdb_cluster.main.cluster_resource_id
}

output "database_security_group_ids" {
  description = "List of security group IDs associated with the database clusters"
  value       = var.security_group_ids
}

output "mongodb_subnet_group_name" {
  description = "The name of the subnet group used by the DocumentDB cluster"
  value       = aws_docdb_subnet_group.main.name
}

output "redis_subnet_group_name" {
  description = "The name of the subnet group used by the Redis cluster"
  value       = aws_elasticache_subnet_group.main.name
}