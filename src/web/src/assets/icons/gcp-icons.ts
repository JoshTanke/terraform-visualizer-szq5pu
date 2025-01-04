import React from 'react'; // v18.x

// Constants for icon configuration
const DEFAULT_ICON_SIZE = 24;
const DEFAULT_ICON_COLOR = '#4285F4';
const SVG_VIEWBOX = '0 0 24 24';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const ARIA_HIDDEN = true;

// Interface for icon component props
interface GCPIconProps {
  size?: number;
  color?: string;
  className?: string;
  title?: string;
}

// Compute Engine Icon Component
export const ComputeEngineIcon: React.FC<GCPIconProps> = React.memo(({
  size = DEFAULT_ICON_SIZE,
  color = DEFAULT_ICON_COLOR,
  className,
  title
}) => (
  <svg
    xmlns={SVG_NAMESPACE}
    viewBox={SVG_VIEWBOX}
    width={size}
    height={size}
    fill={color}
    className={className}
    aria-hidden={!title}
    role="img"
  >
    {title && <title>{title}</title>}
    <path d="M20 14h-2v2h2v-2zm-2-8h2v2h-2V6zM4 6h2v2H4V6zm0 8h2v2H4v-2zm16-4h-2v2h2v-2zM4 10h2v2H4v-2zm16 8h-2v2h2v-2zM4 18h2v2H4v-2z" />
    <path d="M18 4H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H6V6h12v12z" />
  </svg>
));

// VPC Network Icon Component
export const VPCNetworkIcon: React.FC<GCPIconProps> = React.memo(({
  size = DEFAULT_ICON_SIZE,
  color = DEFAULT_ICON_COLOR,
  className,
  title
}) => (
  <svg
    xmlns={SVG_NAMESPACE}
    viewBox={SVG_VIEWBOX}
    width={size}
    height={size}
    fill={color}
    className={className}
    aria-hidden={!title}
    role="img"
  >
    {title && <title>{title}</title>}
    <path d="M15 20c0 .55-.45 1-1 1s-1-.45-1-1v-3h-4v3c0 .55-.45 1-1 1s-1-.45-1-1v-3H3v-1c0-1.1.9-2 2-2h5V9H7c-.55 0-1-.45-1-1s.45-1 1-1h3V3c0-.55.45-1 1-1s1 .45 1 1v4h3c.55 0 1 .45 1 1s-.45 1-1 1h-3v5h5c1.1 0 2 .9 2 2v1h-4v3z" />
  </svg>
));

// Cloud SQL Icon Component
export const CloudSQLIcon: React.FC<GCPIconProps> = React.memo(({
  size = DEFAULT_ICON_SIZE,
  color = DEFAULT_ICON_COLOR,
  className,
  title
}) => (
  <svg
    xmlns={SVG_NAMESPACE}
    viewBox={SVG_VIEWBOX}
    width={size}
    height={size}
    fill={color}
    className={className}
    aria-hidden={!title}
    role="img"
  >
    {title && <title>{title}</title>}
    <path d="M20 13v-2c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zM6 13V9h12v4H6zm14 4v-2H4v2h16z" />
    <path d="M7 11h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" />
  </svg>
));

// Cloud Storage Icon Component
export const CloudStorageIcon: React.FC<GCPIconProps> = React.memo(({
  size = DEFAULT_ICON_SIZE,
  color = DEFAULT_ICON_COLOR,
  className,
  title
}) => (
  <svg
    xmlns={SVG_NAMESPACE}
    viewBox={SVG_VIEWBOX}
    width={size}
    height={size}
    fill={color}
    className={className}
    aria-hidden={!title}
    role="img"
  >
    {title && <title>{title}</title>}
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" />
    <path d="M7 7h10v2H7zm0 4h10v2H7zm0 4h7v2H7z" />
  </svg>
));

// IAM Icon Component
export const IAMIcon: React.FC<GCPIconProps> = React.memo(({
  size = DEFAULT_ICON_SIZE,
  color = DEFAULT_ICON_COLOR,
  className,
  title
}) => (
  <svg
    xmlns={SVG_NAMESPACE}
    viewBox={SVG_VIEWBOX}
    width={size}
    height={size}
    fill={color}
    className={className}
    aria-hidden={!title}
    role="img"
  >
    {title && <title>{title}</title>}
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 7c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4zm6 5H6v-.99c.2-.72 3.3-2.01 6-2.01s5.8 1.29 6 2v1z" />
  </svg>
));

// Export all icon components
export const GCPIcons = {
  ComputeEngineIcon,
  VPCNetworkIcon,
  CloudSQLIcon,
  CloudStorageIcon,
  IAMIcon
};