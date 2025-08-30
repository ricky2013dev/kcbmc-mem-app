import { forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { formatDateForInput, isSunday, getNextSunday } from '@/utils/date-utils';

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
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedDate = e.target.value;
      
      if (!selectedDate) {
        onChange?.(selectedDate);
        return;
      }

      const date = new Date(selectedDate);
      
      if (!isSunday(date)) {
        // Automatically adjust to next Sunday
        const nextSunday = getNextSunday(date);
        const formattedDate = formatDateForInput(nextSunday);
        onChange?.(formattedDate);
      } else {
        onChange?.(selectedDate);
      }
    };

    return (
      <Input
        ref={ref}
        type="date"
        value={value || ''}
        onChange={handleDateChange}
        placeholder={placeholder}
        required={required}
        className={className}
        data-testid={testId}
        {...props}
      />
    );
  }
);

SundayDatePicker.displayName = 'SundayDatePicker';
