'use client';

import { toast } from 'sonner';
import {
  useCreateVariable,
  useDeleteVariable,
  useListVariables,
  useUpdateVariable,
} from '@/shared/api/generated';
import type { VariableDraft } from '@/features/development/types';
import { getErrorMessage } from '@/lib/error-message';
import { useTenantStore } from '@/stores/tenant-store';

export function useDevelopmentVariables() {
  const selectedTenantSlug = useTenantStore((state) => state.selectedTenantSlug);
  const variables = useListVariables(undefined, {
    query: {
      queryKey: ['listVariables', selectedTenantSlug ?? 'default'],
      staleTime: 0,
    },
  });
  const createVariable = useCreateVariable();
  const updateVariable = useUpdateVariable();
  const deleteVariable = useDeleteVariable();

  async function handleCreateVariable(draftValue: VariableDraft) {
    try {
      await createVariable.mutateAsync({
        data: {
          variableName: draftValue.name.trim(),
          variableValue: draftValue.value,
          description: draftValue.description.trim() || undefined,
        },
      });
      await variables.refetch();
      toast.success(`变量「${draftValue.name.trim()}」已创建`);
    } catch (error) {
      toast.error(getErrorMessage(error, '创建变量失败'));
      throw error;
    }
  }

  async function handleUpdateVariable(id: number, draftValue: VariableDraft) {
    try {
      await updateVariable.mutateAsync({
        id,
        data: {
          variableName: draftValue.name.trim(),
          variableValue: draftValue.value,
          description: draftValue.description.trim() || undefined,
        },
      });
      await variables.refetch();
      toast.success(`变量「${draftValue.name.trim()}」已保存`);
    } catch (error) {
      toast.error(getErrorMessage(error, '保存变量失败'));
      throw error;
    }
  }

  async function handleDeleteVariable(id: number) {
    try {
      await deleteVariable.mutateAsync({ id });
      await variables.refetch();
      toast.success('变量已删除');
    } catch (error) {
      toast.error(getErrorMessage(error, '删除变量失败'));
      throw error;
    }
  }

  return {
    deletePending: deleteVariable.isPending,
    handleCreateVariable,
    handleDeleteVariable,
    handleUpdateVariable,
    isLoading: variables.isLoading,
    variables: variables.data?.list ?? [],
  };
}
