import type {
  FlinkJobResponse,
  SchedulerDefinitionRequest,
  SchedulerDefinitionResponse,
  SchedulerEdgeResponse,
  SchedulerNodeResponse,
  SchedulerVersionResponse,
  SchedulerWorkflowRequest,
  SchedulerWorkflowResponse,
} from '@/shared/api/generated';
import type { VersionSnapshot, Workflow, WorkflowEdge, WorkflowNode } from '@/features/scheduler/types';
import { formatBackendUtcDateTime } from '@/lib/date';

export type AtomicSchedulerJob = {
  id: number;
  name: string;
  type: 'SQL' | 'JAR';
  desc: string;
};

export function toWorkflow(response: SchedulerWorkflowResponse): Workflow {
  const latestExecutionStatus = normalizeExecutionStatus(response.latestExecutionStatus);
  return {
    id: response.id ?? 0,
    name: response.workflowName ?? '',
    description: response.description ?? '',
    cron: response.cron ?? '',
    period: response.period ?? '',
    timezone: response.timezone,
    status: response.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
    latestExecutionStatus,
    nodeCount: response.nodeCount ?? 0,
    lastRunTime: formatBackendUtcDateTime(response.lastRunTime),
    nextRunTime: formatBackendUtcDateTime(response.nextRunTime),
    executionMode: response.executionMode === 'SERIAL_QUEUE' ? 'SERIAL_QUEUE' : 'TOPOLOGY',
    failureStrategy: response.failureStrategy === 'CONTINUE_NEXT' ? 'CONTINUE_NEXT' : 'BLOCK_ALL',
    concurrentPolicy: response.concurrentPolicy === 'CONCURRENT' ? 'CONCURRENT' : 'SERIAL_RUNS',
    variables: [],
    alertChannelId: response.alertChannelId,
  };
}

function normalizeExecutionStatus(status?: string): Workflow['latestExecutionStatus'] {
  if (
    status === 'SUCCESS'
    || status === 'RUNNING'
    || status === 'FAILED'
    || status === 'PENDING'
    || status === 'RETRYING'
    || status === 'CANCELED'
  ) {
    return status;
  }
  return 'UNKNOWN';
}

export function toWorkflowRequest(workflow: Workflow): SchedulerWorkflowRequest {
  return {
    workflowName: workflow.name,
    description: workflow.description,
    cron: workflow.cron,
    period: workflow.period,
    timezone: workflow.timezone,
    status: workflow.status,
    executionMode: workflow.executionMode,
    failureStrategy: workflow.failureStrategy,
    concurrentPolicy: workflow.concurrentPolicy,
    alertChannelId: workflow.alertChannelId,
  };
}

export function toWorkflowFromDefinition(definition: SchedulerDefinitionResponse): Workflow | null {
  if (!definition.workflow) return null;
  return {
    ...toWorkflow(definition.workflow),
    variables: (definition.variables ?? []).map((variable) => ({
      key: variable.variableKey ?? '',
      value: variable.variableValue ?? '',
    })),
  };
}

export function toAtomicJob(job: FlinkJobResponse): AtomicSchedulerJob | null {
  if (!job.id || !job.jobName) return null;
  return {
    id: job.id,
    name: job.jobName,
    type: job.jobType === 'JAR' ? 'JAR' : 'SQL',
    desc: job.description || job.jobGroup || '开发运维作业',
  };
}

export function toNode(response: SchedulerNodeResponse): WorkflowNode {
  return {
    id: response.nodeKey ?? String(response.id ?? Date.now()),
    flinkJobId: response.flinkJobId ?? 0,
    jobName: response.jobName ?? '',
    type: response.jobType === 'JAR' ? 'JAR' : 'SQL',
    status: 'IDLE',
    duration: '-',
    x: response.positionX ?? 40,
    y: response.positionY ?? 80,
    maxRetries: response.maxRetries ?? 0,
    retryInterval: response.retryInterval ?? 60,
    timeoutMinutes: response.timeoutMinutes ?? 0,
    onTimeout: response.onTimeout === 'KILL_AND_ALARM' ? 'KILL_AND_ALARM' : 'ALARM_ONLY',
  };
}

export function toEdge(response: SchedulerEdgeResponse): WorkflowEdge {
  return {
    from: response.fromNodeKey ?? '',
    to: response.toNodeKey ?? '',
    strategy: response.strategy === 'WAIT_FAILED' ? 'WAIT_FAILED' : response.strategy === 'WAIT_ENDED' ? 'WAIT_ENDED' : 'WAIT_SUCCESS',
  };
}

export function toDefinitionRequest(workflow: Workflow, nodes: WorkflowNode[], edges: WorkflowEdge[]): SchedulerDefinitionRequest {
  return {
    nodes: nodes.map((node) => ({
      nodeKey: node.id,
      flinkJobId: node.flinkJobId,
      maxRetries: node.maxRetries,
      retryInterval: node.retryInterval,
      timeoutMinutes: node.timeoutMinutes,
      onTimeout: node.onTimeout,
      positionX: Math.round(node.x),
      positionY: Math.round(node.y),
    })),
    edges: edges.map((edge) => ({
      fromNodeKey: edge.from,
      toNodeKey: edge.to,
      strategy: edge.strategy,
    })),
    variables: workflow.variables.map((variable) => ({
      variableKey: variable.key,
      variableValue: variable.value,
    })),
  };
}

export function toVersionSnapshot(version: SchedulerVersionResponse): VersionSnapshot {
  return {
    version: version.versionName ?? `V${version.versionNo ?? '-'}`,
    time: formatBackendUtcDateTime(version.createdAt),
    nodes: [],
    edges: [],
    remark: version.remark ?? '',
  };
}
