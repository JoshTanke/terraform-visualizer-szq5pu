// @ts-check
import React from 'react'; // v18.x

// Type definitions for AWS icon components
interface AWSIconProps {
  size?: number;
  color?: string;
  className?: string;
  ariaLabel?: string;
}

// Constants for icon configuration
const DEFAULT_ICON_SIZE = 24;
const DEFAULT_ICON_COLOR = '#FF9900'; // AWS Orange
const AWS_ICON_VIEWBOX = '0 0 24 24';

/**
 * Memoized SVG icon component for AWS EC2 instances
 * @param props - Icon properties including size, color, className, and accessibility label
 * @returns Accessible SVG icon element
 */
export const EC2Icon = React.memo<AWSIconProps>(({
  size = DEFAULT_ICON_SIZE,
  color = DEFAULT_ICON_COLOR,
  className = '',
  ariaLabel = 'AWS EC2 Instance'
}) => (
  <svg
    width={size}
    height={size}
    viewBox={AWS_ICON_VIEWBOX}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role="img"
    aria-label={ariaLabel}
  >
    <path
      d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h6v2H7v-2z"
      fill={color}
    />
  </svg>
));

EC2Icon.displayName = 'EC2Icon';

/**
 * Memoized SVG icon component for AWS VPC resources
 * @param props - Icon properties including size, color, className, and accessibility label
 * @returns Accessible SVG icon element
 */
export const VPCIcon = React.memo<AWSIconProps>(({
  size = DEFAULT_ICON_SIZE,
  color = DEFAULT_ICON_COLOR,
  className = '',
  ariaLabel = 'AWS VPC'
}) => (
  <svg
    width={size}
    height={size}
    viewBox={AWS_ICON_VIEWBOX}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role="img"
    aria-label={ariaLabel}
  >
    <path
      d="M12 2L2 7v10l10 5 10-5V7L12 2zm-8 14.5v-7L12 4l8 5.5v7L12 22l-8-5.5z"
      fill={color}
    />
  </svg>
));

VPCIcon.displayName = 'VPCIcon';

/**
 * Memoized SVG icon component for AWS RDS instances
 * @param props - Icon properties including size, color, className, and accessibility label
 * @returns Accessible SVG icon element
 */
export const RDSIcon = React.memo<AWSIconProps>(({
  size = DEFAULT_ICON_SIZE,
  color = DEFAULT_ICON_COLOR,
  className = '',
  ariaLabel = 'AWS RDS Database'
}) => (
  <svg
    width={size}
    height={size}
    viewBox={AWS_ICON_VIEWBOX}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role="img"
    aria-label={ariaLabel}
  >
    <path
      d="M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2zm0 18c-4.42 0-8-1.48-8-3.5v-1.9c1.8 1.5 4.72 2.4 8 2.4s6.2-.9 8-2.4v1.9c0 2.02-3.58 3.5-8 3.5zm0-4c-4.42 0-8-1.48-8-3.5V10.1c1.8 1.5 4.72 2.4 8 2.4s6.2-.9 8-2.4v2.4c0 2.02-3.58 3.5-8 3.5zm0-4c-4.42 0-8-1.48-8-3.5S7.58 5 12 5s8 1.48 8 3.5S16.42 12 12 12z"
      fill={color}
    />
  </svg>
));

RDSIcon.displayName = 'RDSIcon';

/**
 * Memoized SVG icon component for AWS S3 buckets
 * @param props - Icon properties including size, color, className, and accessibility label
 * @returns Accessible SVG icon element
 */
export const S3Icon = React.memo<AWSIconProps>(({
  size = DEFAULT_ICON_SIZE,
  color = DEFAULT_ICON_COLOR,
  className = '',
  ariaLabel = 'AWS S3 Bucket'
}) => (
  <svg
    width={size}
    height={size}
    viewBox={AWS_ICON_VIEWBOX}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role="img"
    aria-label={ariaLabel}
  >
    <path
      d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 0h-4V4h4v2z"
      fill={color}
    />
  </svg>
));

S3Icon.displayName = 'S3Icon';

/**
 * Memoized SVG icon component for AWS IAM resources
 * @param props - Icon properties including size, color, className, and accessibility label
 * @returns Accessible SVG icon element
 */
export const IAMIcon = React.memo<AWSIconProps>(({
  size = DEFAULT_ICON_SIZE,
  color = DEFAULT_ICON_COLOR,
  className = '',
  ariaLabel = 'AWS IAM Resource'
}) => (
  <svg
    width={size}
    height={size}
    viewBox={AWS_ICON_VIEWBOX}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role="img"
    aria-label={ariaLabel}
  >
    <path
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
      fill={color}
    />
  </svg>
));

IAMIcon.displayName = 'IAMIcon';

// Export all icons as a collection
export const AWSIcons = {
  EC2Icon,
  VPCIcon,
  RDSIcon,
  S3Icon,
  IAMIcon,
};