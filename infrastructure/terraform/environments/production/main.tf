# Provider version: ~> 4.0
terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }

  # Production state management with encryption and locking
  backend "s3" {
    bucket         = "terraform-visualizer-tfstate-prod"
    key            = "terraform.tfstate"
    region         = var.aws_region
    encrypt        = true
    kms_key_id     = var.kms_key_id
    dynamodb_table = "terraform-visualizer-tfstate-lock-prod"
  }
}

# AWS Provider configuration with production tags
provider "aws" {
  region = var.aws_region
  
  default_tags {
    Environment     = "production"
    Project         = "terraform-visualizer"
    ManagedBy       = "terraform"
    Owner           = "infrastructure-team"
    CostCenter      = "production-infrastructure"
    ComplianceLevel = "high"
  }
}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Networking module for multi-AZ infrastructure
module "networking" {
  source = "../../modules/networking"

  environment            = "production"
  project_name          = "terraform-visualizer"
  vpc_cidr              = "10.0.0.0/16"
  availability_zones    = data.aws_availability_zones.available.names
  enable_vpc_flow_logs  = true
  enable_network_firewall = true
  
  # Production requires multi-AZ deployment
  public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnet_cidrs = ["10.0.4.0/24", "10.0.5.0/24", "10.0.6.0/24"]
  single_nat_gateway   = false # High availability with NAT gateway per AZ
}

# ECS module for container orchestration
module "ecs" {
  source = "../../modules/ecs"

  environment         = "production"
  project_name       = "terraform-visualizer"
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnets
  
  # Production capacity configuration
  capacity_providers      = ["FARGATE", "FARGATE_SPOT"]
  enable_container_insights = true
  enable_execute_command   = false # Disabled for security
  
  # Production scaling configuration
  min_capacity  = 2
  max_capacity  = 8
  frontend_cpu  = 2048
  frontend_memory = 4096
}

# Database module for data persistence
module "database" {
  source = "../../modules/database"

  environment         = "production"
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnets
  security_group_ids = [module.security.security_group_ids]
  
  # Production database configuration
  enable_encryption        = true
  kms_key_arn             = module.security.kms_key_arn
  backup_retention_period = 30
  multi_az               = true
  
  # MongoDB configuration
  mongodb_instance_class = "r5.large"
  mongodb_instance_count = 3
  mongodb_username       = var.mongodb_username
  mongodb_password       = var.mongodb_password
  
  # Redis configuration
  redis_node_type        = "r6g.large"
  redis_num_cache_nodes  = 2
  redis_port             = 6379
}

# Monitoring module for observability
module "monitoring" {
  source = "../../modules/monitoring"

  environment           = "production"
  project_name         = "terraform-visualizer"
  datadog_api_key      = var.datadog_api_key
  datadog_app_key      = var.datadog_app_key
  
  # Production monitoring configuration
  enable_apm             = true
  enable_anomaly_detection = true
  log_retention_days     = 90
  metrics_collection_interval = 60
  dashboard_refresh_interval = 300
  alert_notification_channel = "pagerduty"
}

# Security module for enhanced protection
module "security" {
  source = "../../modules/security"

  environment     = "production"
  project_name   = "terraform-visualizer"
  vpc_id         = module.networking.vpc_id
  domain_name    = var.domain_name
  
  # Production security configuration
  enable_waf          = true
  enable_shield       = true
  enable_guardduty    = true
  enable_security_hub = true
  
  # WAF configuration
  waf_rate_limit     = 2000
  
  # KMS configuration
  kms_deletion_window = 30
  enable_key_rotation = true
}

# Output values for reference
output "vpc_id" {
  description = "VPC identifier for the production environment"
  value       = module.networking.vpc_id
}

output "mongodb_endpoint" {
  description = "MongoDB connection endpoint"
  value       = module.database.mongodb_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis connection endpoint"
  value       = module.database.redis_endpoint
  sensitive   = true
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN for the production environment"
  value       = module.ecs.cluster_arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution identifier"
  value       = module.networking.cloudfront_distribution_id
}

output "waf_web_acl_arn" {
  description = "WAF web ACL ARN for security configuration"
  value       = module.security.waf_web_acl_arn
}