import { forwardRef, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { formatDateForInput, isSunday, getNextSunday, getSundayValidationMessage } from '@/utils/date-utils';

interface SundayDatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  'data-testid'?: string;
}

export const SundayDatePicker = forwardRef<HTMLInputElement, SundayDatePickerProps>(
  ({ value, onChange, placeholder, required, className, 'data-testid': testId, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedDate = e.target.value;
      
      if (!selectedDate) {
        onChange?.(selectedDate);
        return;
      }

      // Parse YYYY-MM-DD format properly to avoid timezone issues
      const parts = selectedDate.split('-');
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      
      if (!isSunday(date)) {
        // Automatically adjust to next Sunday
        const nextSunday = getNextSunday(date);
        const formattedDate = formatDateForInput(nextSunday);
        onChange?.(formattedDate);
      } else {
        onChange?.(selectedDate);
      }
    };

    // Add custom validation to restrict non-Sundays
    useEffect(() => {
      const input = inputRef.current || (typeof ref === 'object' && ref?.current);
      if (!input) return;

      const handleInput = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const selectedDate = target.value;
        
        if (selectedDate) {
          // Parse YYYY-MM-DD format properly to avoid timezone issues
          const parts = selectedDate.split('-');
          const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          
          if (!isSunday(date)) {
            // Set custom validity to show error with helpful message
            const validationMessage = getSundayValidationMessage(selectedDate);
            target.setCustomValidity(validationMessage);
            target.reportValidity();
            
            // Auto-adjust to next Sunday after a brief delay
            setTimeout(() => {
              const nextSunday = getNextSunday(date);
              const formattedDate = formatDateForInput(nextSunday);
              target.value = formattedDate;
              target.setCustomValidity(''); // Clear custom validity
              onChange?.(formattedDate);
            }, 1500);
          } else {
            target.setCustomValidity(''); // Clear any previous custom validity
          }
        }
      };

      input.addEventListener('input', handleInput);
      return () => input.removeEventListener('input', handleInput);
    }, [onChange, ref]);

    return (
      <Input
        ref={ref || inputRef}
        type="date"
        value={value || ''}
        onChange={handleDateChange}
        placeholder={placeholder}
        required={required}
        className={className}
        data-testid={testId}
        title="Please select a Sunday only"
        {...props}
      />
    );
  }
);

SundayDatePicker.displayName = 'SundayDatePicker';
