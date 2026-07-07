'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { ColumnInfo, FlinkJobRequest, FlinkSqlPreviewRequest } from '@/shared/api/generated';
import type { PreviewData } from '@/features/development/components/job-editor-panels';
import { SQL_PREVIEW_LIMIT } from '@/features/development/lib/job-forms';
import { getErrorMessage } from '@/lib/error-message';

type PreviewMutation = {
  mutateAsync: (input: { data: FlinkSqlPreviewRequest & { jobName?: string } }) => Promise<{
    columns?: ColumnInfo[];
    data?: Array<Record<string, unknown>>;
    message?: string;
    previewType?: string;
    truncated?: boolean;
  } | undefined>;
};

interface UseDevelopmentSqlPreviewOptions {
  draft: FlinkJobRequest;
  previewSql: PreviewMutation;
  setPreviewHeight: React.Dispatch<React.SetStateAction<number>>;
}

export function useDevelopmentSqlPreview({
  draft,
  previewSql,
  setPreviewHeight,
}: UseDevelopmentSqlPreviewOptions) {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function handlePreview(previewHeight: number) {
    if (!draft.clusterId) {
      toast.error('请先选择运行时');
      return;
    }
    if (!draft.content?.trim()) {
      toast.error('请输入 SQL 内容');
      return;
    }
    if (previewHeight < 140) {
      setPreviewHeight(224);
    }
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await previewSql.mutateAsync({
        data: {
          clusterId: draft.clusterId,
          sql: draft.content,
          jobName: draft.jobName,
          limit: SQL_PREVIEW_LIMIT,
        },
      });
      setPreviewData({
        previewType: res?.previewType,
        message: res?.message,
        truncated: res?.truncated,
        columns: res?.columns ?? [],
        data: res?.data ?? [],
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'SQL 调试预览失败'));
    } finally {
      setPreviewLoading(false);
    }
  }

  return {
    handlePreview,
    previewData,
    previewLoading,
    setPreviewData,
  };
}
