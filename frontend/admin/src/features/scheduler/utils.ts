import type { WorkflowEdge } from '@/features/scheduler/types';



export function wouldCauseCycle(fromId: string, toId: string, edges: WorkflowEdge[]): boolean {
  if (fromId === toId) return true;
  const visited = new Set<string>();

  const dfs = (curr: string): boolean => {
    if (curr === fromId) return true;
    visited.add(curr);
    const downstreams = edges.filter((edge) => edge.from === curr).map((edge) => edge.to);
    for (const nextNode of downstreams) {
      if (!visited.has(nextNode) && dfs(nextNode)) {
        return true;
      }
    }
    return false;
  };

  return dfs(toId);
}

export function nextEdgeStrategy(strategy: WorkflowEdge['strategy']): WorkflowEdge['strategy'] {
  const strategyCycle: Array<WorkflowEdge['strategy']> = ['WAIT_SUCCESS', 'WAIT_ENDED', 'WAIT_FAILED'];
  const currentIndex = strategyCycle.indexOf(strategy);
  return strategyCycle[(currentIndex + 1) % strategyCycle.length];
}

export function edgeStrategyLabel(strategy: WorkflowEdge['strategy']) {
  if (strategy === 'WAIT_SUCCESS') return '成功触发';
  if (strategy === 'WAIT_ENDED') return '仅等待结束(忽略失败)';
  return '上游失败时触发';
}
