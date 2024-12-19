# Network Infrastructure Outputs
output "vpc_id" {
  description = "ID of the VPC used for staging environment infrastructure"
  value       = module.networking.vpc_id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs used for internal service deployment in staging"
  value       = module.networking.private_subnets
}

output "public_subnet_ids" {
  description = "List of public subnet IDs used for internet-facing resources in staging"
  value       = module.networking.public_subnets
}

# Database Connection Outputs
output "mongodb_endpoint" {
  description = "MongoDB (DocumentDB) connection endpoint for staging environment"
  value       = module.database.mongodb_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis (ElastiCache) connection endpoint for staging environment"
  value       = module.database.redis_endpoint
  sensitive   = true
}

# Container Orchestration Outputs
output "ecs_cluster_name" {
  description = "Name of the ECS cluster for staging environment container orchestration"
  value       = module.ecs.cluster_name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster for staging environment container orchestration"
  value       = module.ecs.cluster_arn
}

# Security Configuration Outputs
output "ssl_certificate_arn" {
  description = "ARN of the SSL certificate used for HTTPS endpoints in staging"
  value       = module.security.ssl_certificate_arn
}

output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL providing security controls for staging environment"
  value       = module.security.waf_web_acl_arn
}