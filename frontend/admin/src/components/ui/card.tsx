import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: ComponentPropsWithoutRef<'section'>) {
  return (
    <section
      className={cn('rounded-lg border border-border/80 bg-white shadow-sm', className)}
      {...props}
    />
  );
}

