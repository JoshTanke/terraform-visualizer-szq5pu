# VPC Outputs
output "vpc_id" {
  description = "The ID of the VPC for use by other modules and resources"
  value       = aws_vpc.main.id
  sensitive   = true # Marking as sensitive since VPC ID can be used for network attacks
}

output "vpc_cidr" {
  description = "The CIDR block of the VPC for network planning and security group configuration"
  value       = aws_vpc.main.cidr_block
}

# Subnet Outputs
output "public_subnet_ids" {
  description = "List of public subnet IDs for deploying internet-facing resources like load balancers"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for deploying internal resources like application servers and databases"
  value       = aws_subnet.private[*].id
}

# Gateway Outputs
output "internet_gateway_id" {
  description = "The ID of the Internet Gateway for public subnet routing configuration"
  value       = aws_internet_gateway.main.id
}

output "nat_gateway_ids" {
  description = "List of NAT Gateway IDs used by private subnets for internet access"
  value       = aws_nat_gateway.main[*].id
}

output "nat_gateway_public_ips" {
  description = "List of public IP addresses of the NAT Gateways for security group and firewall configurations"
  value       = aws_nat_gateway.main[*].public_ip
  sensitive   = true # Marking as sensitive since these are public IPs
}

# Additional Network Information
output "availability_zones" {
  description = "List of availability zones where the subnets are deployed"
  value = {
    public_subnets  = aws_subnet.public[*].availability_zone
    private_subnets = aws_subnet.private[*].availability_zone
  }
}

output "vpc_tags" {
  description = "Tags applied to the VPC for resource identification and management"
  value       = aws_vpc.main.tags
}

output "nat_gateway_details" {
  description = "Detailed information about NAT Gateways including subnet placement and tags"
  value = [
    for nat in aws_nat_gateway.main : {
      id        = nat.id
      subnet_id = nat.subnet_id
      tags      = nat.tags
    }
  ]
}

output "flow_logs_config" {
  description = "VPC Flow Logs configuration details for network monitoring"
  value = {
    log_group_name = aws_cloudwatch_log_group.flow_log.name
    role_arn       = aws_iam_role.flow_log.arn
  }
}