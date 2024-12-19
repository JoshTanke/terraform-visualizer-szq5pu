# Output definitions for the ECS module
# Terraform AWS Provider version: ~> 4.0

# ECS Cluster Outputs
output "cluster_id" {
  description = "The ID of the ECS cluster for service deployments and task scheduling"
  value       = aws_ecs_cluster.main.id
  depends_on  = [aws_ecs_cluster.main]
}

output "cluster_arn" {
  description = "The ARN of the ECS cluster for IAM policy attachments and cross-account access"
  value       = aws_ecs_cluster.main.arn
  depends_on  = [aws_ecs_cluster.main]
}

output "cluster_name" {
  description = "The name of the ECS cluster for service discovery and monitoring integration"
  value       = aws_ecs_cluster.main.name
  depends_on  = [aws_ecs_cluster.main]
}

# Service Discovery Outputs
output "service_discovery_namespace_id" {
  description = "The ID of the service discovery namespace for internal service communication"
  value       = aws_service_discovery_private_dns_namespace.main.id
  depends_on  = [aws_service_discovery_private_dns_namespace.main]
}

output "service_discovery_namespace_arn" {
  description = "The ARN of the service discovery namespace for cross-account access"
  value       = aws_service_discovery_private_dns_namespace.main.arn
  depends_on  = [aws_service_discovery_private_dns_namespace.main]
}

# Service Names for Load Balancer Integration
output "frontend_service_name" {
  description = "The name of the frontend ECS service for load balancer target group association"
  value       = aws_ecs_service.frontend.name
  depends_on  = [aws_ecs_service.frontend]
}

output "frontend_service_id" {
  description = "The ID of the frontend ECS service for resource referencing"
  value       = aws_ecs_service.frontend.id
  depends_on  = [aws_ecs_service.frontend]
}

# Security Group Outputs
output "frontend_security_group_id" {
  description = "The ID of the frontend service security group for network access control"
  value       = aws_security_group.frontend.id
  depends_on  = [aws_security_group.frontend]
}

output "alb_security_group_id" {
  description = "The ID of the ALB security group for network access control"
  value       = aws_security_group.alb.id
  depends_on  = [aws_security_group.alb]
}

# IAM Role Outputs
output "execution_role_arn" {
  description = "The ARN of the ECS task execution role for task permissions"
  value       = aws_iam_role.task_execution_role.arn
  sensitive   = true
  depends_on  = [aws_iam_role.task_execution_role]
}

output "execution_role_name" {
  description = "The name of the ECS task execution role for policy attachments"
  value       = aws_iam_role.task_execution_role.name
  sensitive   = true
  depends_on  = [aws_iam_role.task_execution_role]
}

# Auto Scaling Outputs
output "frontend_autoscaling_target_id" {
  description = "The ID of the frontend service auto scaling target for scaling policy management"
  value       = aws_appautoscaling_target.frontend.id
  depends_on  = [aws_appautoscaling_target.frontend]
}

# Task Definition Outputs
output "frontend_task_definition_arn" {
  description = "The ARN of the frontend task definition for service deployment"
  value       = aws_ecs_task_definition.frontend.arn
  depends_on  = [aws_ecs_task_definition.frontend]
}

output "frontend_task_definition_family" {
  description = "The family name of the frontend task definition for version tracking"
  value       = aws_ecs_task_definition.frontend.family
  depends_on  = [aws_ecs_task_definition.frontend]
}

# Service Health Outputs
output "frontend_desired_count" {
  description = "The desired count of frontend service tasks for capacity planning"
  value       = aws_ecs_service.frontend.desired_count
  depends_on  = [aws_ecs_service.frontend]
}