# Network Infrastructure Outputs
output "vpc_id" {
  description = "ID of the production VPC for network integration"
  value       = module.networking.vpc_id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for internal service deployment in production"
  value       = module.networking.private_subnets
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for internet-facing resources in production"
  value       = module.networking.public_subnets
}

# Database Connection Endpoints
output "mongodb_endpoint" {
  description = "MongoDB connection endpoint for application database access"
  value       = module.database.mongodb_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis connection endpoint for application caching"
  value       = module.database.redis_endpoint
  sensitive   = true
}

# ECS Cluster Information
output "ecs_cluster_name" {
  description = "Name of the ECS cluster for container orchestration management"
  value       = module.ecs.cluster_name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster for AWS service integration"
  value       = module.ecs.cluster_arn
}

# Security Resource ARNs
output "ssl_certificate_arn" {
  description = "ARN of the SSL certificate for HTTPS termination"
  value       = module.security.ssl_certificate_arn
}

output "waf_web_acl_arn" {
  description = "ARN of the WAF web ACL for application security rules"
  value       = module.security.waf_web_acl_arn
}