export interface Workflow {
  id: number;
  name: string;
  description: string;
  cron: string;
  period: string;
  timezone?: string;
  status: 'ACTIVE' | 'PAUSED';
  latestExecutionStatus: 'SUCCESS' | 'RUNNING' | 'FAILED' | 'PENDING' | 'RETRYING' | 'CANCELED' | 'UNKNOWN';
  nodeCount: number;
  lastRunTime: string;
  nextRunTime: string;
  executionMode: 'TOPOLOGY' | 'SERIAL_QUEUE';
  failureStrategy: 'BLOCK_ALL' | 'CONTINUE_NEXT';
  concurrentPolicy: 'SERIAL_RUNS' | 'CONCURRENT';
  variables: Array<{ key: string; value: string }>;
  alertChannelId?: number;
}

export interface WorkflowNode {
  id: string;
  flinkJobId: number;
  jobName: string;
  type: 'SQL' | 'JAR';
  status: 'SUCCESS' | 'RUNNING' | 'PENDING' | 'RETRYING' | 'FAILED' | 'SKIPPED' | 'CANCELED' | 'IDLE';
  duration?: string;
  x: number;
  y: number;
  maxRetries: number;
  retryInterval: number;
  timeoutMinutes: number;
  onTimeout: 'ALARM_ONLY' | 'KILL_AND_ALARM';
}

export interface WorkflowEdge {
  from: string;
  to: string;
  strategy: 'WAIT_SUCCESS' | 'WAIT_ENDED' | 'WAIT_FAILED';
}

export interface VersionSnapshot {
  version: string;
  time: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  remark: string;
}
