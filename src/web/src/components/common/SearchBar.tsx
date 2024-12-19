import React, { useCallback, useState, useEffect, useRef } from 'react'; // v18.0.0
import { TextField, InputAdornment, IconButton, CircularProgress } from '@mui/material'; // v5.0.0
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material'; // v5.0.0
import { debounce } from 'lodash'; // v4.17.21
import { showWarning } from '../../hooks/useNotifications';

// Constants for search configuration
const MINIMUM_SEARCH_LENGTH = 3;
const DEBOUNCE_DELAY = 300;
const ARIA_DESCRIPTIONS = {
  searchInput: 'Search for Terraform resources, modules, or environments',
  clearButton: 'Clear search input',
  minimumChars: `Please enter at least ${MINIMUM_SEARCH_LENGTH} characters to search`,
};

interface SearchBarProps {
  /**
   * Callback function triggered when search criteria is met
   * @param term - The search term to process
   */
  onSearch: (term: string) => Promise<void>;
  
  /**
   * Optional placeholder text for the search input
   * @default "Search..."
   */
  placeholder?: string;
  
  /**
   * Optional ARIA label for accessibility
   * @default "Search resources"
   */
  ariaLabel?: string;
  
  /**
   * Optional loading state indicator
   * @default false
   */
  isLoading?: boolean;
}

/**
 * A reusable search bar component with real-time filtering capabilities
 * Implements WCAG 2.1 Level AA compliance with proper focus management
 * and keyboard navigation support
 */
const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = 'Search...',
  ariaLabel = 'Search resources',
  isLoading = false,
}) => {
  // State management
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(isLoading);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cleanup effect
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, []);

  // Update loading state when prop changes
  useEffect(() => {
    setIsSearching(isLoading);
  }, [isLoading]);

  /**
   * Debounced search handler to prevent excessive API calls
   */
  const debouncedSearch = useCallback(
    debounce(async (term: string) => {
      if (term.length >= MINIMUM_SEARCH_LENGTH) {
        setIsSearching(true);
        try {
          await onSearch(term);
        } finally {
          setIsSearching(false);
        }
      }
    }, DEBOUNCE_DELAY),
    [onSearch]
  );

  /**
   * Handles search input changes with validation
   */
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchTerm(value);

      if (value.length > 0 && value.length < MINIMUM_SEARCH_LENGTH) {
        showWarning(ARIA_DESCRIPTIONS.minimumChars, {
          persist: false,
          'aria-live': 'polite',
        });
        return;
      }

      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  /**
   * Handles clearing the search input with proper focus management
   */
  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setIsSearching(false);
    debouncedSearch.cancel();
    
    // Reset search results
    onSearch('');
    
    // Restore focus to input after clearing
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [onSearch]);

  /**
   * Handles keyboard events for accessibility
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClearSearch();
    }
  }, [handleClearSearch]);

  return (
    <TextField
      fullWidth
      inputRef={inputRef}
      value={searchTerm}
      onChange={handleSearchChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-describedby="search-description"
      aria-busy={isSearching}
      disabled={isSearching}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon color="action" aria-hidden="true" />
          </InputAdornment>
        ),
        endAdornment: (
          <InputAdornment position="end">
            {isSearching ? (
              <CircularProgress
                size={20}
                aria-label="Searching..."
                role="progressbar"
              />
            ) : searchTerm ? (
              <IconButton
                aria-label={ARIA_DESCRIPTIONS.clearButton}
                onClick={handleClearSearch}
                size="small"
                edge="end"
              >
                <ClearIcon />
              </IconButton>
            ) : null}
          </InputAdornment>
        ),
      }}
      sx={{
        '& .MuiInputBase-root': {
          borderRadius: 2,
        },
        '& .MuiOutlinedInput-root': {
          '&:hover fieldset': {
            borderColor: 'primary.main',
          },
        },
      }}
    />
  );
};

export default SearchBar;