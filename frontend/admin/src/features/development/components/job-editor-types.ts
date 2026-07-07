import type { ColumnInfo } from '@/shared/api/generated';

export type PreviewData = {
  previewType?: string;
  message?: string;
  truncated?: boolean;
  columns: ColumnInfo[];
  data: Array<Record<string, unknown>>;
};
