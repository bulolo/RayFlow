import { Suspense } from 'react';
import { SchedulerWorkspace } from '@/features/scheduler';

export default function SchedulerPage() {
  return (
    <Suspense fallback={null}>
      <SchedulerWorkspace />
    </Suspense>
  );
}
