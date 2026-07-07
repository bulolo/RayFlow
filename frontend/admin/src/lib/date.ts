export function parseBackendUtcTime(value?: string) {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized);
  const date = new Date(hasZone ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatBackendUtcDateTime(value?: string) {
  const date = parseBackendUtcTime(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatBackendUtcDuration(startedAt?: string, finishedAt?: string) {
  const started = parseBackendUtcTime(startedAt);
  if (!started) return '-';
  const finished = finishedAt ? parseBackendUtcTime(finishedAt) : new Date();
  if (!finished || finished.getTime() < started.getTime()) return '-';
  return `${Math.max(Math.round((finished.getTime() - started.getTime()) / 1000), 1)}s`;
}
