import type { ReactNode } from 'react';

export function SectionHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
    </div>
  );
}

export function SectionCard({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border-subtle bg-white shadow-card">
      <div className="border-b border-border-subtle bg-zinc-50/60 px-5 py-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
      </div>
      <div className="divide-y divide-border-subtle">{children}</div>
    </section>
  );
}

export function SectionRow({
  children,
  description,
  label,
}: {
  children: ReactNode;
  description: string;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="mr-8 flex-1">
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
