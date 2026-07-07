export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function statusTone(status?: string): StatusTone {
  if (!status) return 'neutral';
  if (['RUNNING', 'UP', 'ACTIVE'].includes(status)) return 'success';
  if (['FINISHED'].includes(status)) return 'info';
  if (['CREATED', 'PENDING', 'STOPPED'].includes(status)) return 'warning';
  if (['FAILED', 'UNREACHABLE', 'ERROR'].includes(status)) return 'danger';
  return 'neutral';
}
