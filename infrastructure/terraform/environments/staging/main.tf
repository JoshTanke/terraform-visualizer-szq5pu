# Provider version: ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }

  # S3 backend configuration for state management
  backend "s3" {
    bucket         = "terraform-visualizer-staging-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-visualizer-staging-locks"
  }
}

# AWS Provider configuration
provider "aws" {
  region = "us-east-1"
}

# Networking Module - Single AZ VPC setup
module "networking" {
  source = "../modules/networking"

  environment         = "staging"
  project_name        = "terraform-visualizer"
  vpc_cidr           = "10.1.0.0/16"
  availability_zones = ["us-east-1a"]  # Single AZ for staging
  
  # Subnet configuration for single AZ
  public_subnet_cidrs  = ["10.1.1.0/24"]
  private_subnet_cidrs = ["10.1.2.0/24"]
  
  # NAT Gateway configuration
  enable_nat_gateway = true
  single_nat_gateway = true  # Single NAT for cost optimization
}

# ECS Module - Scaled-down task definitions
module "ecs" {
  source = "../modules/ecs"

  environment     = "staging"
  project_name    = "terraform-visualizer"
  vpc_id          = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnets

  # Reduced capacity for staging
  frontend_cpu    = 1024  # 1 vCPU
  frontend_memory = 2048  # 2 GB
  min_capacity    = 2     # Minimum 2 tasks for basic HA
  max_capacity    = 4     # Maximum 4 tasks for staging

  # Container insights for monitoring
  container_insights_enabled = true
}

# Database Module - Single-AZ MongoDB and Redis
module "database" {
  source = "../modules/database"

  environment        = "staging"
  vpc_id            = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnets
  
  # Security group configuration
  security_group_ids = [module.security.security_group_id]

  # MongoDB configuration - scaled down for staging
  mongodb_instance_class = "db.t3.medium"
  mongodb_instance_count = 1  # Single instance for staging
  mongodb_username       = "admin"
  mongodb_password      = var.mongodb_password  # Sensitive value from variables

  # Redis configuration - scaled down for staging
  redis_node_type       = "cache.t3.medium"
  redis_num_cache_nodes = 1  # Single node for staging
  redis_port           = 6379

  # Enable encryption for security
  enable_encryption    = true
}

# Monitoring Module - Staging-specific thresholds
module "monitoring" {
  source = "../modules/monitoring"

  environment                  = "staging"
  project_name                = "terraform-visualizer"
  datadog_api_key             = var.datadog_api_key
  datadog_app_key             = var.datadog_app_key
  
  # Monitoring configuration
  log_retention_days          = 30
  metrics_collection_interval = 60
  enable_apm_tracing         = true
  dashboard_refresh_interval  = 300
  
  # Alert configuration
  alert_notification_channel  = "slack"
}

# Security Module - WAF, ACM, and KMS configuration
module "security" {
  source = "../modules/security"

  environment     = "staging"
  project_name    = "terraform-visualizer"
  vpc_id         = module.networking.vpc_id
  domain_name    = "staging.terraform-visualizer.com"
  
  # WAF configuration
  waf_rate_limit = 2000  # Requests per 5 minutes
  
  # KMS configuration
  kms_deletion_window = 7
  enable_key_rotation = true
}

# Output values for reference
output "vpc_id" {
  description = "VPC ID for reference by other environments or modules"
  value       = module.networking.vpc_id
}

output "mongodb_endpoint" {
  description = "MongoDB connection endpoint for application configuration"
  value       = module.database.mongodb_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis connection endpoint for application configuration"
  value       = module.database.redis_endpoint
  sensitive   = true
}

output "ecs_cluster_name" {
  description = "ECS cluster name for deployment references"
  value       = module.ecs.cluster_name
}

# Variables for sensitive values
variable "mongodb_password" {
  description = "MongoDB admin password"
  type        = string
  sensitive   = true
}

variable "datadog_api_key" {
  description = "DataDog API key for monitoring integration"
  type        = string
  sensitive   = true
}

variable "datadog_app_key" {
  description = "DataDog Application key for monitoring integration"
  type        = string
  sensitive   = true
}