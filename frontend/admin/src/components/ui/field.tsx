import type { ComponentPropsWithoutRef } from 'react';

export interface FieldProps extends ComponentPropsWithoutRef<'input'> {
  label: string;
  placeholder?: string;
  type?: string;
}

export function Field({ label, placeholder, type = 'text', ...props }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none transition duration-200 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-50"
        placeholder={placeholder}
        type={type}
        {...props}
      />
    </label>
  );
}
