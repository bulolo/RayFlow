import type { ExtendedFlinkJob } from '@/types/extended';

export const DEFAULT_JOB_GROUP = '未分组';
export const CUSTOM_GROUPS_KEY = 'rayflow_flink_job_groups';

export type GroupTreeNode = {
  children: GroupTreeNode[];
  key: string;
  label: string;
  rows: ExtendedFlinkJob[];
  total: number;
};

export function normalizeJobs(data: { list?: ExtendedFlinkJob[] } | undefined) {
  return (data?.list ?? []) as ExtendedFlinkJob[];
}

export function normalizeGroupPath(value?: string): string {
  return (value ?? '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/');
}

export function buildGroupTree(groups: Array<{ key: string; rows: ExtendedFlinkJob[] }>): GroupTreeNode[] {
  const nodeByPath = new Map<string, GroupTreeNode>();

  function ensureNode(path: string): GroupTreeNode {
    const normalizedPath = normalizeGroupPath(path);
    const existing = nodeByPath.get(normalizedPath);
    if (existing) return existing;

    const parts = normalizedPath.split('/');
    let currentPath = '';
    let parent: GroupTreeNode | null = null;
    let current: GroupTreeNode | null = null;

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      current = nodeByPath.get(currentPath) ?? null;
      if (!current) {
        current = {
          children: [],
          key: currentPath,
          label: part,
          rows: [],
          total: 0,
        };
        nodeByPath.set(currentPath, current);
        parent?.children.push(current);
      }
      parent = current;
    }

    return current!;
  }

  for (const group of groups) {
    if (group.key === DEFAULT_JOB_GROUP) continue;
    const node = ensureNode(group.key);
    node.rows = group.rows;
  }

  function sortAndCount(nodes: GroupTreeNode[]): GroupTreeNode[] {
    return nodes
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((node) => {
        node.children = sortAndCount(node.children);
        node.total = node.rows.length + node.children.reduce((sum, child) => sum + child.total, 0);
        return node;
      });
  }

  return sortAndCount(Array.from(nodeByPath.values()).filter((node) => !node.key.includes('/')));
}

export function collectGroupRows(node: GroupTreeNode): ExtendedFlinkJob[] {
  return [...node.rows, ...node.children.flatMap((child) => collectGroupRows(child))];
}

export function groupPathChain(path: string): string[] {
  const parts = normalizeGroupPath(path).split('/').filter(Boolean);
  return parts.map((_, index) => parts.slice(0, index + 1).join('/'));
}
