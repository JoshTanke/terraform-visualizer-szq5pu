# ACM Certificate output for HTTPS endpoints
output "certificate_arn" {
  description = "ARN of the ACM certificate for securing HTTPS endpoints"
  value       = aws_acm_certificate.main.arn
}

# WAF Web ACL output for application protection
output "waf_acl_arn" {
  description = "ARN of the WAF web ACL for implementing application protection rules"
  value       = aws_wafv2_web_acl.main.arn
}

# KMS Key output for data encryption
output "kms_key_arn" {
  description = "ARN of the KMS key for implementing data encryption"
  value       = aws_kms_key.main.arn
}

# Security Group output for network access control
output "security_group_id" {
  description = "ID of the security group for controlling network access"
  value       = aws_security_group.main.id
}