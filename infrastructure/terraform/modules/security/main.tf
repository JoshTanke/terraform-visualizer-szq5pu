# AWS Provider version ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# ACM Certificate for HTTPS endpoints
resource "aws_acm_certificate" "main" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# WAF Web ACL with comprehensive protection rules
resource "aws_wafv2_web_acl" "main" {
  name        = "${var.project_name}-waf"
  description = "WAF rules with advanced protection capabilities"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate limiting rule
  rule {
    name     = "rate-limiting"
    priority = 1

    override_action {
      none {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "${var.project_name}-rate-limiting"
      sampled_requests_enabled  = true
    }
  }

  # SQL injection protection rule
  rule {
    name     = "sql-injection"
    priority = 2

    override_action {
      none {}
    }

    statement {
      sql_injection_match_statement {
        field_to_match {
          body {}
          query_string {}
          uri_path {}
        }
        text_transformation {
          priority = 1
          type     = "URL_DECODE"
        }
        text_transformation {
          priority = 2
          type     = "HTML_ENTITY_DECODE"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "${var.project_name}-sql-injection"
      sampled_requests_enabled  = true
    }
  }

  # XSS protection rule
  rule {
    name     = "xss-protection"
    priority = 3

    override_action {
      none {}
    }

    statement {
      xss_match_statement {
        field_to_match {
          body {}
          query_string {}
          uri_path {}
        }
        text_transformation {
          priority = 1
          type     = "URL_DECODE"
        }
        text_transformation {
          priority = 2
          type     = "HTML_ENTITY_DECODE"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "${var.project_name}-xss-protection"
      sampled_requests_enabled  = true
    }
  }

  # IP reputation rule
  rule {
    name     = "ip-reputation"
    priority = 4

    override_action {
      none {}
    }

    statement {
      ip_reputation_statement {
        field_to_match {
          source_ip {}
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "${var.project_name}-ip-reputation"
      sampled_requests_enabled  = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "${var.project_name}-waf-acl"
    sampled_requests_enabled  = true
  }

  tags = {
    Name        = "${var.project_name}-waf"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# KMS key for data encryption
resource "aws_kms_key" "main" {
  description             = "KMS key for sensitive data encryption"
  deletion_window_in_days = var.kms_deletion_window
  enable_key_rotation     = var.enable_key_rotation
  key_usage              = "ENCRYPT_DECRYPT"
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action = [
          "kms:*"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:CallerAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  tags = {
    Name        = var.project_name
    Environment = var.environment
    Purpose     = "data-encryption"
    ManagedBy   = "terraform"
  }
}

# Security group with strict access controls
resource "aws_security_group" "main" {
  name        = "${var.project_name}-sg"
  description = "Security group with comprehensive access controls"
  vpc_id      = var.vpc_id

  # HTTPS ingress
  ingress {
    description = "HTTPS access"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP ingress (for redirect to HTTPS)
  ingress {
    description = "HTTP access"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound traffic
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-sg"
    Environment = var.environment
    Type        = "security"
    ManagedBy   = "terraform"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Data source for AWS account ID
data "aws_caller_identity" "current" {}

# Outputs for resource references
output "certificate_arn" {
  description = "ARN of the ACM certificate"
  value       = aws_acm_certificate.main.arn
}

output "waf_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.arn
}

output "kms_key_arn" {
  description = "ARN of the KMS key"
  value       = aws_kms_key.main.arn
}

output "kms_key_id" {
  description = "ID of the KMS key"
  value       = aws_kms_key.main.key_id
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.main.id
}