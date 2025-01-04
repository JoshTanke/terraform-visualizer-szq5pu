// @ts-check
import React, { memo } from 'react'; // v18.x

// Types
interface TerraformIconProps {
  size?: number;
  color?: string;
  className?: string;
  ariaLabel?: string;
  testId?: string;
}

// Constants
const DEFAULT_ICON_SIZE = 24;
const DEFAULT_ICON_COLOR = '#7B42BC';
const ICON_VIEWBOX = '0 0 24 24';

const ARIA_LABELS = {
  RESOURCE: 'Terraform Resource Icon',
  DATA_SOURCE: 'Terraform Data Source Icon',
  MODULE: 'Terraform Module Icon',
  VARIABLE: 'Terraform Variable Icon',
  OUTPUT: 'Terraform Output Icon',
  PROVIDER: 'Terraform Provider Icon',
} as const;

const ERROR_MESSAGES = {
  INVALID_RESOURCE_TYPE: 'Invalid Terraform resource type provided',
} as const;

// Resource Icon Component
export const ResourceIcon: React.FC<TerraformIconProps> = memo(({
  size = DEFAULT_ICON_SIZE,
  color = DEFAULT_ICON_COLOR,
  className = '',
  ariaLabel = ARIA_LABELS.RESOURCE,
  testId = 'terraform-resource-icon',
}) => (
  <svg
    width={size}
    height={size}
    viewBox={ICON_VIEWBOX}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label={ariaLabel}
    data-testid={testId}
    role="img"
  >
    <path
      d="M20 6.4L12 2L4 6.4V17.6L12 22L20 17.6V6.4Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 2V22"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
));

ResourceIcon.displayName = 'ResourceIcon';

// Data Source Icon Component
export const DataSourceIcon: React.FC<TerraformIconProps> = memo(({
  size = DEFAULT_ICON_SIZE,
  color = DEFAULT_ICON_COLOR,
  className = '',
  ariaLabel = ARIA_LABELS.DATA_SOURCE,
  testId = 'terraform-data-source-icon',
}) => (
  <svg
    width={size}
    height={size}
    viewBox={ICON_VIEWBOX}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label={ariaLabel}
    data-testid={testId}
    role="img"
  >
    <path
      d="M12 3C16.9706 3 21 5.23858 21 8C21 10.7614 16.9706 13 12 13C7.02944 13 3 10.7614 3 8C3 5.23858 7.02944 3 12 3Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21 12C21 14.7614 16.9706 17 12 17C7.02944 17 3 14.7614 3 12"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21 16C21 18.7614 16.9706 21 12 21C7.02944 21 3 18.7614 3 16"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
));

DataSourceIcon.displayName = 'DataSourceIcon';

// Module Icon Component
export const ModuleIcon: React.FC<TerraformIconProps> = memo(({
  size = DEFAULT_ICON_SIZE,
  color = DEFAULT_ICON_COLOR,
  className = '',
  ariaLabel = ARIA_LABELS.MODULE,
  testId = 'terraform-module-icon',
}) => (
  <svg
    width={size}
    height={size}
    viewBox={ICON_VIEWBOX}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label={ariaLabel}
    data-testid={testId}
    role="img"
  >
    <path
      d="M4 4H10V10H4V4Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 4H20V10H14V4Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4 14H10V20H4V14Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 14H20V20H14V14Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
));

ModuleIcon.displayName = 'ModuleIcon';

// Variable Icon Component
export const VariableIcon: React.FC<TerraformIconProps> = memo(({
  size = DEFAULT_ICON_SIZE,
  color = DEFAULT_ICON_COLOR,
  className = '',
  ariaLabel = ARIA_LABELS.VARIABLE,
  testId = 'terraform-variable-icon',
}) => (
  <svg
    width={size}
    height={size}
    viewBox={ICON_VIEWBOX}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label={ariaLabel}
    data-testid={testId}
    role="img"
  >
    <path
      d="M4 4L12 12L20 4"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4 12L12 20L20 12"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
));

VariableIcon.displayName = 'VariableIcon';

// Output Icon Component
export const OutputIcon: React.FC<TerraformIconProps> = memo(({
  size = DEFAULT_ICON_SIZE,
  color = DEFAULT_ICON_COLOR,
  className = '',
  ariaLabel = ARIA_LABELS.OUTPUT,
  testId = 'terraform-output-icon',
}) => (
  <svg
    width={size}
    height={size}
    viewBox={ICON_VIEWBOX}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label={ariaLabel}
    data-testid={testId}
    role="img"
  >
    <path
      d="M12 3V16M12 16L7 11M12 16L17 11"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4 21H20"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
));

OutputIcon.displayName = 'OutputIcon';

// Helper function to get the appropriate icon component
export const getResourceIcon = memo((resourceType: string): React.FC<TerraformIconProps> => {
  const iconMap: Record<string, React.FC<TerraformIconProps>> = {
    resource: ResourceIcon,
    data: DataSourceIcon,
    module: ModuleIcon,
    variable: VariableIcon,
    output: OutputIcon,
  };

  if (!resourceType || !iconMap[resourceType.toLowerCase()]) {
    console.warn(ERROR_MESSAGES.INVALID_RESOURCE_TYPE);
    return ResourceIcon;
  }

  return iconMap[resourceType.toLowerCase()];
});

getResourceIcon.displayName = 'getResourceIcon';

// Export all components and utilities
export const TerraformIcons = {
  ResourceIcon,
  DataSourceIcon,
  ModuleIcon,
  VariableIcon,
  OutputIcon,
  getResourceIcon,
} as const;

// Type exports for consumers
export type { TerraformIconProps };