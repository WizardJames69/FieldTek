import { memo, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface SelectCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  'aria-label'?: string;
}

export const SelectCheckbox = memo(function SelectCheckbox({
  checked,
  onCheckedChange,
  className,
  'aria-label': ariaLabel = 'Select item',
}: SelectCheckboxProps) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleCheckedChange = useCallback((value: boolean | 'indeterminate') => {
    onCheckedChange(value === true);
  }, [onCheckedChange]);

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        className
      )}
      onClick={handleClick}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={handleCheckedChange}
        aria-label={ariaLabel}
        className="h-4 w-4 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
      />
    </div>
  );
});

interface SelectAllCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

export const SelectAllCheckbox = memo(function SelectAllCheckbox({
  checked,
  indeterminate,
  onCheckedChange,
  className,
}: SelectAllCheckboxProps) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleCheckedChange = useCallback((value: boolean | 'indeterminate') => {
    onCheckedChange(value === true);
  }, [onCheckedChange]);

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        className
      )}
      onClick={handleClick}
    >
      <Checkbox
        checked={indeterminate ? 'indeterminate' : checked}
        onCheckedChange={handleCheckedChange}
        aria-label="Select all"
        className="h-4 w-4 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
      />
    </div>
  );
});
