export interface FlinkJobLinkInfo {
  executionMode?: string;
  flinkJobId?: string;
  status?: string;
}

export function getFlinkUiUrl(address: string, job: FlinkJobLinkInfo): string {
  const flinkJobId = job.flinkJobId || '';
  const baseUrl = address.replace(/\/+$/, '');

  const isRunning = job.status === 'RUNNING';
  const subPath = isRunning ? 'running' : 'completed';
  const mode = (job.executionMode || '').toLowerCase();

  if (mode.includes('application') || mode.includes('app')) {
    return `${baseUrl}/#/application/${subPath}/${flinkJobId}/overview`;
  }

  return `${baseUrl}/#/job/${subPath}/${flinkJobId}/overview`;
}
