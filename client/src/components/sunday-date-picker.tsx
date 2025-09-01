import { forwardRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSundayOptions } from '@/utils/date-utils';

interface SundayDatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  'data-testid'?: string;
}

export const SundayDatePicker = forwardRef<HTMLButtonElement, SundayDatePickerProps>(
  ({ value, onChange, placeholder = "Select a Sunday", required, className, 'data-testid': testId, ...props }, ref) => {
    const sundayOptions = getSundayOptions(12); // Show 12 months range (6 months back and forward)

    const handleValueChange = (selectedValue: string) => {
      onChange?.(selectedValue);
    };

    return (
      <Select value={value || ''} onValueChange={handleValueChange}>
        <SelectTrigger 
          ref={ref} 
          className={className}
          data-testid={testId}
          {...props}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {sundayOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
);

SundayDatePicker.displayName = 'SundayDatePicker';
