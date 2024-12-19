// @ts-check
import React, { memo } from 'react'; // v18.x

// Constants
export const DEFAULT_ICON_SIZE = 24;
export const DEFAULT_ICON_COLOR = '#0078D4'; // Azure blue
export const SVG_VIEWBOX = '0 0 24 24';

// Types
export interface AzureIconProps {
  size?: number;
  color?: string;
  className?: string;
  ariaLabel?: string;
}

export type AzureResourceType = 
  | 'azurerm_virtual_machine'
  | 'azurerm_storage_account'
  | 'azurerm_app_service'
  | 'azurerm_sql_database'
  | 'azurerm_virtual_network'
  | 'azurerm_subnet'
  | 'azurerm_network_interface'
  | 'azurerm_public_ip'
  | 'azurerm_resource_group'
  | 'azurerm_container_registry'
  | 'azurerm_kubernetes_cluster';

// Icon cache for performance optimization
const iconCache = new WeakMap<string, React.FC<AzureIconProps>>();

// Base icon wrapper for consistent props and error handling
const withIconWrapper = (
  WrappedIcon: React.FC<AzureIconProps>,
  defaultLabel: string
): React.FC<AzureIconProps> => {
  return memo(({
    size = DEFAULT_ICON_SIZE,
    color = DEFAULT_ICON_COLOR,
    className = '',
    ariaLabel = defaultLabel,
  }: AzureIconProps) => {
    try {
      return (
        <svg
          width={size}
          height={size}
          viewBox={SVG_VIEWBOX}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-label={ariaLabel}
          role="img"
        >
          <WrappedIcon size={size} color={color} className={className} ariaLabel={ariaLabel} />
        </svg>
      );
    } catch (error) {
      console.error(`Error rendering Azure icon: ${error}`);
      return null;
    }
  });
};

// Individual icon components
export const VirtualMachineIcon = withIconWrapper(
  memo(({ color = DEFAULT_ICON_COLOR }: AzureIconProps) => (
    <path
      d="M20 3H4C3.45 3 3 3.45 3 4V20C3 20.55 3.45 21 4 21H20C20.55 21 21 20.55 21 20V4C21 3.45 20.55 3 20 3ZM19 19H5V5H19V19ZM16 7H8V9H16V7ZM16 11H8V13H16V11ZM16 15H8V17H16V15Z"
      fill={color}
    />
  )),
  'Azure Virtual Machine'
);

export const StorageAccountIcon = withIconWrapper(
  memo(({ color = DEFAULT_ICON_COLOR }: AzureIconProps) => (
    <path
      d="M20 6H4V8H20V6ZM20 10H4V12H20V10ZM20 14H4V16H20V14ZM4 18H20V20H4V18Z"
      fill={color}
    />
  )),
  'Azure Storage Account'
);

// Resource type to icon mapping
export const AZURE_RESOURCE_TYPES: Record<AzureResourceType, React.FC<AzureIconProps>> = {
  azurerm_virtual_machine: VirtualMachineIcon,
  azurerm_storage_account: StorageAccountIcon,
  azurerm_app_service: VirtualMachineIcon, // Placeholder - implement specific icon
  azurerm_sql_database: StorageAccountIcon, // Placeholder - implement specific icon
  azurerm_virtual_network: VirtualMachineIcon, // Placeholder - implement specific icon
  azurerm_subnet: StorageAccountIcon, // Placeholder - implement specific icon
  azurerm_network_interface: VirtualMachineIcon, // Placeholder - implement specific icon
  azurerm_public_ip: StorageAccountIcon, // Placeholder - implement specific icon
  azurerm_resource_group: VirtualMachineIcon, // Placeholder - implement specific icon
  azurerm_container_registry: StorageAccountIcon, // Placeholder - implement specific icon
  azurerm_kubernetes_cluster: VirtualMachineIcon, // Placeholder - implement specific icon
};

/**
 * Retrieves the appropriate icon component for a given Azure resource type
 * @param resourceType - The Azure resource type to get an icon for
 * @returns A memoized React component for the resource icon
 * @throws Error if resource type is not supported
 */
export const getAzureIcon = (resourceType: AzureResourceType): React.FC<AzureIconProps> => {
  // Check cache first
  const cachedIcon = iconCache.get(resourceType);
  if (cachedIcon) {
    return cachedIcon;
  }

  // Get icon from mapping
  const icon = AZURE_RESOURCE_TYPES[resourceType];
  if (!icon) {
    console.warn(`No icon found for Azure resource type: ${resourceType}`);
    return VirtualMachineIcon; // Fallback to generic icon
  }

  // Cache and return icon
  iconCache.set(resourceType, icon);
  return icon;
};

// Export all icons and helper functions
export const azureIcons = {
  VirtualMachineIcon,
  StorageAccountIcon,
  // Add other icons as implemented
};

export default {
  getAzureIcon,
  azureIcons,
  AZURE_RESOURCE_TYPES,
};