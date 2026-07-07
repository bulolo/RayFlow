import type { FlinkJobExecutionResponse } from '@/shared/api/generated';
import type { ExtendedFlinkJob } from '@/types/extended';

export function isActiveExecutionStatus(status?: string | null) {
  return ['CREATED', 'SUBMITTING', 'RUNNING'].includes(status ?? '');
}

export function formatExecutionTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function formatExecutionDuration(value?: number) {
  if (value === undefined || value === null) return '-';
  if (value < 1000) return `${value} ms`;
  const seconds = Math.floor(value / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds} 秒`;
  return `${minutes} 分 ${remainingSeconds} 秒`;
}

export function executionStageLabel(row?: FlinkJobExecutionResponse | null) {
  if (!row) return '-';
  if (row.status === 'FAILED' && !row.flinkJobId) return '提交阶段失败';
  if (row.status === 'FAILED' && row.flinkJobId) return 'Flink 运行失败';
  if (row.status === 'FINISHED') return '执行完成';
  if (isActiveExecutionStatus(row.status)) return '执行中';
  if (row.status === 'CANCELED') return '已取消';
  return row.status || '-';
}

function normalizeText(value?: string | null) {
  return value?.trim() || '-';
}

function buildFlinkSubmitParameters(job?: ExtendedFlinkJob | null) {
  if (!job) return ['[Flink] jobContext=-'];
  return [
    `[Flink] submitType=${normalizeText(job.submitType)}`,
    `[Flink] executionMode=${normalizeText(job.executionMode)}`,
    `[Flink] runtimeMode=${normalizeText(job.runtimeMode)}`,
    `[Flink] clusterId=${job.clusterId ?? '-'}`,
    `[Flink] parallelism=${job.parallelism ?? '-'}`,
    `[Flink] savepointPath=${normalizeText(job.savepointPath)}`,
    `[Flink] args=${normalizeText(job.args)}`,
    `[Flink] flinkConfig=${normalizeText(job.flinkConfig)}`,
    `[Flink] jarUri=${normalizeText(job.jarUri)}`,
    `[Flink] mainClass=${normalizeText(job.mainClass)}`,
    `[Flink] dependencyRefs=${normalizeText(job.dependencyRefs)}`,
    `[Flink] applicationImage=${normalizeText(job.applicationImage)}`,
  ];
}

export function buildRayFlowExecutionInfo(row?: FlinkJobExecutionResponse | null, job?: ExtendedFlinkJob | null) {
  if (!row) return '';
  const lines = [
    `[RayFlow] execution=${row.id ?? '-'}`,
    `[RayFlow] jobId=${row.jobId ?? job?.id ?? '-'}`,
    `[RayFlow] jobName=${job?.jobName || '-'}`,
    `[RayFlow] jobType=${job?.jobType || '-'}`,
    `[RayFlow] publishStatus=${job?.publishStatus || '-'}`,
    `[RayFlow] stage=${executionStageLabel(row)}`,
    `[RayFlow] status=${row.status ?? '-'}`,
    `[RayFlow] version=${row.versionName ?? '草稿'}`,
    `[RayFlow] versionId=${row.versionId ?? '-'}`,
    `[RayFlow] flinkJobId=${row.flinkJobId || '-'}`,
    `[RayFlow] startTime=${formatExecutionTime(row.startTime)}`,
    `[RayFlow] endTime=${formatExecutionTime(row.endTime)}`,
    `[RayFlow] duration=${formatExecutionDuration(row.duration)}`,
    `[RayFlow] createdAt=${formatExecutionTime(row.createdAt)}`,
    `[RayFlow] updatedAt=${formatExecutionTime(row.updatedAt)}`,
    '',
    '==== Flink 提交参数 ====',
  ];
  if (row.submitPayload?.trim()) {
    lines.push(row.submitPayload.trim());
  } else {
    lines.push(...buildFlinkSubmitParameters(job));
  }
  return lines.join('\n');
}

export function buildExecutionOutputText(row?: FlinkJobExecutionResponse | null, job?: ExtendedFlinkJob | null) {
  if (!row) return '';
  return [
    '==== RayFlow 信息 ====',
    buildRayFlowExecutionInfo(row, job),
    '',
    '==== Flink 错误 ====',
    row.errorLog?.trim() || (row.status === 'RUNNING' ? '作业正在运行，等待 Flink 返回运行日志。' : '本次执行暂无错误日志。'),
  ].join('\n');
}

export function buildFallbackExecutionOutputText(errorMessage: string, job?: ExtendedFlinkJob | null) {
  return [
    '==== RayFlow 信息 ====',
    '[RayFlow] execution=-',
    `[RayFlow] jobId=${job?.id ?? '-'}`,
    `[RayFlow] jobName=${job?.jobName || '-'}`,
    `[RayFlow] jobType=${job?.jobType || '-'}`,
    `[RayFlow] runtimeMode=${job?.runtimeMode || '-'}`,
    `[RayFlow] submitType=${job?.submitType || '-'}`,
    `[RayFlow] executionMode=${job?.executionMode || '-'}`,
    `[RayFlow] clusterId=${job?.clusterId ?? '-'}`,
    `[RayFlow] parallelism=${job?.parallelism ?? '-'}`,
    `[RayFlow] publishStatus=${job?.publishStatus || '-'}`,
    '[RayFlow] stage=提交阶段失败',
    '[RayFlow] status=FAILED',
    '[RayFlow] version=草稿',
    '[RayFlow] versionId=-',
    '[RayFlow] flinkJobId=-',
    `[RayFlow] startTime=${formatExecutionTime(new Date().toISOString())}`,
    '[RayFlow] endTime=-',
    '[RayFlow] duration=-',
    '',
    '==== Flink 提交参数 ====',
    ...buildFlinkSubmitParameters(job),
    '',
    '==== Flink 错误 ====',
    errorMessage,
  ].join('\n');
}
