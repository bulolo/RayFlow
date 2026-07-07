import { useEffect } from 'react';
interface JobLike {
  status?: string;
}

export function useJobAutoRefresh(
  jobs: JobLike[],
  refetchJobs: () => Promise<unknown>,
  refetchOpsJobs: () => Promise<unknown>,
) {
  useEffect(() => {
    const hasRunningJob = jobs.some((job) => job.status === 'RUNNING');
    if (!hasRunningJob) return;

    const timer = window.setInterval(() => {
      void Promise.all([refetchJobs(), refetchOpsJobs()]);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [jobs, refetchJobs, refetchOpsJobs]);
}
