import { Gauge } from 'lucide-react';
import { OverviewDashboard } from '@/features/overview/components/overview-dashboard';

export default function OverviewPage() {
  return (
    <main className="min-h-0 overflow-hidden px-6 py-5 lg:px-8 animate-in fade-in-50 duration-200">
      <div className="mb-4 flex flex-col gap-2 border-b border-border pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-primary shadow-sm">
              <Gauge className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">系统总览</h1>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            监控 Flink 运行时、作业负载和重点运行风险。
          </p>
        </div>
      </div>
      <OverviewDashboard />
    </main>
  );
}
