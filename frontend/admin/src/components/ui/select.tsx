import { Check, ChevronDown } from 'lucide-react';
import {
  type ComponentPropsWithoutRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  className?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
}

export interface SelectFieldProps extends Omit<ComponentPropsWithoutRef<'button'>, 'onChange' | 'value'> {
  disabled?: boolean;
  label: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
}

export function Select({
  className,
  disabled,
  onValueChange,
  options,
  placeholder = '请选择',
  value,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-lg border border-border bg-white px-3 text-left text-sm outline-none transition duration-200',
          'focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50',
          open && 'border-primary ring-4 ring-primary/10',
        )}
      >
        <span className={cn('truncate', selectedOption ? 'text-slate-900' : 'text-slate-400')}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-white p-1 shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onValueChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex h-9 w-full items-center justify-between rounded-md px-2.5 text-left text-sm transition',
                  active ? 'bg-primary/8 text-primary' : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                <span className="truncate">{option.label}</span>
                {active && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SelectField({
  disabled,
  label,
  onValueChange,
  options,
  placeholder,
  value,
  ...props
}: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <Select
        className={props.className}
        disabled={disabled}
        onValueChange={onValueChange}
        options={options}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}
