import { cn } from '@/lib/utils';

export interface ToggleProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ checked = false, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      className={cn(
        'relative h-6 w-10 rounded-full transition duration-200 outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-50 disabled:cursor-not-allowed',
        checked ? 'bg-primary' : 'bg-slate-300'
      )}
      onClick={() => !disabled && onChange?.(!checked)}
      type="button"
      disabled={disabled}
    >
      <span
        className={cn(
          'absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200',
          checked ? 'left-5' : 'left-1'
        )}
      />
    </button>
  );
}
