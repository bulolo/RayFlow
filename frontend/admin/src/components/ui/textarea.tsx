import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends ComponentPropsWithoutRef<'textarea'> {
  label: string;
}

export function Textarea({ className, label, ...props }: TextareaProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <textarea
        className={cn(
          'min-h-28 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm leading-6 outline-none transition duration-200 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </label>
  );
}
