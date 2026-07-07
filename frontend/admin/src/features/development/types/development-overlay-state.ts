import type { ExtendedFlinkJob } from '@/types/extended';

export interface DevelopmentJobContextMenuState {
  job: ExtendedFlinkJob;
  x: number;
  y: number;
}

export interface DevelopmentGroupContextMenuState {
  group: string;
  rows: ExtendedFlinkJob[];
  x: number;
  y: number;
}

export interface DevelopmentConfirmDialogState {
  description: string;
  onConfirm: () => Promise<void>;
  submitLabel: string;
  title: string;
}
