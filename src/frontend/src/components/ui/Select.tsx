import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/utils';

interface Option {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: Option[];
  value?: string | number;
  defaultValue?: string | number;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  className?: string;
  onChange: (value: string | number | (string | number)[]) => void;
}

const Select: React.FC<SelectProps> = ({
  options,
  value,
  defaultValue,
  placeholder = 'Select an option',
  label,
  error,
  disabled = false,
  multiple = false,
  searchable = false,
  clearable = false,
  className,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedValues, setSelectedValues] = useState<(string | number)[]>(
    multiple
      ? Array.isArray(value) ? value : value ? [value] : []
      : value ? [value] : defaultValue ? [defaultValue] : []
  );
  
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = searchable && searchQuery
    ? options.filter(option =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  const selectedOption = !multiple && selectedValues.length > 0
    ? options.find(opt => opt.value === selectedValues[0])
    : null;

  const selectedLabels = multiple
    ? options.filter(opt => selectedValues.includes(opt.value)).map(opt => opt.label)
    : [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen && searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  const handleOptionClick = (optionValue: string | number) => {
    if (multiple) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter(val => val !== optionValue)
        : [...selectedValues, optionValue];
      
      setSelectedValues(newValues);
      onChange(newValues);
    } else {
      setSelectedValues([optionValue]);
      onChange(optionValue);
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedValues([]);
    onChange(multiple ? [] : '');
  };

  const displayText = () => {
    if (multiple && selectedLabels.length > 0) {
      if (selectedLabels.length === 1) return selectedLabels[0];
      return `${selectedLabels.length} selected`;
    }
    
    if (selectedOption) return selectedOption.label;
    return placeholder;
  };

  return (
    <div className={cn('relative w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      
      <div ref={containerRef} className="relative">
        <button
          type="button"
          className={cn(
            'relative w-full bg-white dark:bg-gray-800 border rounded-md shadow-sm',
            'px-3 py-2 text-left cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            'text-gray-900 dark:text-gray-100',
            error
              ? 'border-danger-300 focus:ring-danger-500'
              : 'border-gray-300 dark:border-gray-600',
            disabled && 'bg-gray-50 cursor-not-allowed opacity-50',
            className
          )}
          onClick={handleToggle}
          disabled={disabled}
        >
          <span className={cn(
            'block truncate',
            (!selectedOption && !selectedLabels.length) && 'text-gray-400'
          )}>
            {displayText()}
          </span>
          
          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            {clearable && selectedValues.length > 0 && !disabled ? (
              <button
                type="button"
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded pointer-events-auto"
                onClick={handleClear}
              >
                ×
              </button>
            ) : (
              <ChevronDown className={cn(
                'w-4 h-4 text-gray-400 transition-transform',
                isOpen && 'transform rotate-180'
              )} />
            )}
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
            {searchable && (
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            )}
            
            <ul className="max-h-60 overflow-auto">
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-2 text-gray-500 dark:text-gray-400 text-center">
                  No options found
                </li>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = selectedValues.includes(option.value);
                  
                  return (
                    <li
                      key={option.value}
                      className={cn(
                        'px-3 py-2 cursor-pointer flex items-center justify-between',
                        'hover:bg-gray-100 dark:hover:bg-gray-700',
                        isSelected && 'bg-primary-50 dark:bg-primary-900',
                        option.disabled && 'opacity-50 cursor-not-allowed'
                      )}
                      onClick={() => !option.disabled && handleOptionClick(option.value)}
                    >
                      <span className={cn(
                        'text-gray-900 dark:text-gray-100',
                        isSelected && 'font-medium text-primary-600 dark:text-primary-400'
                      )}>
                        {option.label}
                      </span>
                      
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
      
      {error && (
        <p className="mt-1 text-sm text-danger-600">{error}</p>
      )}
    </div>
  );
};

export default Select;