'use client';

import { useState, type RefObject } from 'react';
import type { AtomicSchedulerJob } from '@/features/scheduler/api-adapters';
import type { VersionSnapshot, Workflow, WorkflowEdge, WorkflowNode } from '@/features/scheduler/types';
import { edgeStrategyLabel, nextEdgeStrategy, wouldCauseCycle } from '@/features/scheduler/utils';
import type { SchedulerExecutionResponse } from '@/shared/api/generated';

interface NotificationChannel {
  id?: number;
  name?: string;
  type?: string;
}

interface UseSchedulerDesignerStateOptions {
  canvasRef: RefObject<HTMLDivElement | null>;
  channelsList: NotificationChannel[];
  selectedWorkflow: Workflow | null;
  showToast: (message: string) => void;
}

function formatTime() {
  return new Date().toTimeString().split(' ')[0];
}

export function useSchedulerDesignerState({
  canvasRef,
  channelsList,
  selectedWorkflow,
  showToast,
}: UseSchedulerDesignerStateOptions) {
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [runConsoleOpen, setRunConsoleOpen] = useState(false);
  const [runLogs, setRunLogs] = useState<string[]>([]);
  const [designerEdges, setDesignerEdges] = useState<WorkflowEdge[]>([]);
  const [designerNodes, setDesignerNodes] = useState<WorkflowNode[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [nodeConfigModalOpen, setNodeConfigModalOpen] = useState(false);
  const [nodeToConfig, setNodeToConfig] = useState<WorkflowNode | null>(null);

  const handleNodeMouseDown = (event: React.MouseEvent, nodeId: string) => {
    event.preventDefault();
    const node = designerNodes.find((item) => item.id === nodeId);
    if (!node) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const initialX = node.x;
    const initialY = node.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setDesignerNodes((prev) =>
        prev.map((item) =>
          item.id === nodeId ? { ...item, x: Math.max(10, initialX + dx), y: Math.max(10, initialY + dy) } : item,
        ),
      );
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleDragStartFromPool = (event: React.DragEvent, job: AtomicSchedulerJob) => {
    event.dataTransfer.setData('application/json', JSON.stringify(job));
  };

  const handleCanvasDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (!canvasRef.current) return;

    try {
      const jobDataStr = event.dataTransfer.getData('application/json');
      if (!jobDataStr) return;
      const job = JSON.parse(jobDataStr) as AtomicSchedulerJob;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.max(10, event.clientX - rect.left - 100);
      const y = Math.max(10, event.clientY - rect.top - 60);

      const newNode: WorkflowNode = {
        id: String(Date.now()),
        flinkJobId: job.id,
        jobName: job.name,
        type: job.type as WorkflowNode['type'],
        status: 'IDLE',
        duration: '-',
        x,
        y,
        maxRetries: 3,
        retryInterval: 60,
        timeoutMinutes: 0,
        onTimeout: 'ALARM_ONLY',
      };

      setDesignerNodes((prev) => [...prev, newNode]);
    } catch {
      showToast('拖入节点失败，请重试');
    }
  };

  const handleAnchorClick = (event: React.MouseEvent, nodeId: string) => {
    event.stopPropagation();
    if (connectingFromId === null) {
      setConnectingFromId(nodeId);
      return;
    }

    if (connectingFromId !== nodeId) {
      const edgeExists = designerEdges.some((edge) => edge.from === connectingFromId && edge.to === nodeId);
      if (!edgeExists) {
        if (wouldCauseCycle(connectingFromId, nodeId, designerEdges)) {
          showToast('建立依赖失败，检测到循环依赖');
        } else {
          setDesignerEdges((prev) => [...prev, { from: connectingFromId, to: nodeId, strategy: 'WAIT_SUCCESS' }]);
          showToast('已建立节点依赖');
        }
      }
    }

    setConnectingFromId(null);
  };

  const handleSaveNodeConfig = () => {
    if (!nodeToConfig) return;
    setDesignerNodes((prev) => prev.map((node) => (node.id === nodeToConfig.id ? { ...nodeToConfig } : node)));
    setNodeConfigModalOpen(false);
    showToast(`已应用节点「${nodeToConfig.jobName}」的重试与超时策略`);
  };

  const toggleEdgeStrategy = (event: React.MouseEvent, edge: WorkflowEdge) => {
    event.stopPropagation();
    const nextStrategy = nextEdgeStrategy(edge.strategy);
    setDesignerEdges((prev) =>
      prev.map((item) =>
        item.from === edge.from && item.to === edge.to ? { ...item, strategy: nextStrategy } : item,
      ),
    );
    showToast(`依赖条件已切换为：${edgeStrategyLabel(nextStrategy)}`);
  };

  const handleStartRun = (execution?: SchedulerExecutionResponse) => {
    if (!selectedWorkflow || designerNodes.length === 0) return;

    setIsRunning(true);
    setRunConsoleOpen(true);
    setRunLogs([]);
    setDesignerNodes((prev) => prev.map((node) => ({ ...node, status: 'RUNNING', duration: '后端执行中' })));

    const activeVariables = selectedWorkflow.variables ?? [];
    const status = execution?.status ?? 'UNKNOWN';

    setRunLogs((prev) => [...prev, `[${formatTime()}] [SYSTEM] 工作流 "${selectedWorkflow.name}" 已提交到后端调度执行器。`]);
    setRunLogs((prev) => [...prev, `[${formatTime()}] [SYSTEM] 执行实例: ${execution?.id ?? '-'} | 状态: ${status} | 触发方式: ${execution?.triggerType ?? 'MANUAL'}`]);
    setRunLogs((prev) => [...prev, `[${formatTime()}] [SYSTEM] 全局策略 - 拓扑模式: ${selectedWorkflow.executionMode === 'TOPOLOGY' ? '拓扑依赖执行' : '单队列强串行'} | 失败控制: ${selectedWorkflow.failureStrategy === 'BLOCK_ALL' ? '失败阻断' : '忽略失败继续'}`]);

    if (activeVariables.length > 0) {
      setRunLogs((prev) => [...prev, `[${formatTime()}] [SYSTEM] [VARIABLES] 本次运行携带 ${activeVariables.length} 个工作流变量。`]);
    }

    if (selectedWorkflow.alertChannelId) {
      const channel = channelsList.find((item) => item.id === selectedWorkflow.alertChannelId);
      setRunLogs((prev) => [...prev, `[${formatTime()}] [SYSTEM] [ALARM] 告警通道: ${channel?.name ?? selectedWorkflow.alertChannelId}`]);
    }
  };

  const openWorkflowDesigner = () => {
    setDesignerNodes([]);
    setDesignerEdges([]);
  };

  const handleRollbackSnapshot = (snapshot: VersionSnapshot) => {
    setDesignerNodes(snapshot.nodes.map((node) => ({ ...node, status: 'IDLE', duration: '-' })));
    setDesignerEdges(snapshot.edges);
    showToast(`成功回滚到历史版本: ${snapshot.version}`);
  };

  return {
    connectingFromId,
    runConsoleOpen,
    runLogs,
    designerEdges,
    designerNodes,
    handleAnchorClick,
    handleCanvasDrop,
    handleDragStartFromPool,
    handleNodeMouseDown,
    handleRollbackSnapshot,
    handleSaveNodeConfig,
    handleStartRun,
    isRunning,
    nodeConfigModalOpen,
    nodeToConfig,
    openWorkflowDesigner,
    setConnectingFromId,
    setRunConsoleOpen,
    setRunLogs,
    setDesignerEdges,
    setDesignerNodes,
    setIsRunning,
    setNodeConfigModalOpen,
    setNodeToConfig,
    toggleEdgeStrategy,
  };
}
