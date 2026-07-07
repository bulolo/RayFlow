'use client';

import { useMemo, useState } from 'react';
import { Network, Search, Table2 } from 'lucide-react';
import {
  type FlussClusterRequest,
  type FlussClusterResponse,
  type FlussTopicRequest,
  type FlussTopicResponse,
  useCheckFlussCluster,
  useCreateFlussCluster,
  useCreateFlussTopic,
  useDeleteFlussCluster,
  useDeleteFlussTopic,
  useListFlussClusters,
  useListFlussTopics,
  useUpdateFlussCluster,
  useUpdateFlussTopic,
} from '@/shared/api/generated';
import { Button, ConfirmModal, Field, Modal, SelectField } from '@/components/ui';
import { ConnectionStatusBadge } from '@/features/resource-center/components/connection-status-badge';
import { ResourcePanelSkeleton } from '@/features/resource-center/components/resource-panel-skeleton';
import {
  connectionStatusLabel,
  emptyFlussClusterForm,
  emptyFlussTopicForm,
  normalizeFlussClusterForm,
  normalizeFlussTopicForm,
} from '@/features/resource-center/lib/resource-center-forms';
import { getErrorMessage } from '@/lib/error-message';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function FlussConnectionsPanel() {
  const clusters = useListFlussClusters(undefined, { query: { refetchOnMount: 'always' } });
  const topics = useListFlussTopics({ is_pager: 0, page: 1, size: 500 }, { query: { refetchOnMount: 'always' } });
  const createCluster = useCreateFlussCluster();
  const updateCluster = useUpdateFlussCluster();
  const deleteCluster = useDeleteFlussCluster();
  const checkCluster = useCheckFlussCluster();
  const createTopic = useCreateFlussTopic();
  const updateTopic = useUpdateFlussTopic();
  const deleteTopic = useDeleteFlussTopic();
  const clusterRows = useMemo(() => clusters.data?.list ?? [], [clusters.data?.list]);
  const topicRows = useMemo(() => topics.data?.list ?? [], [topics.data?.list]);
  const [keyword, setKeyword] = useState('');
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [clusterCreateOpen, setClusterCreateOpen] = useState(false);
  const [editingCluster, setEditingCluster] = useState<FlussClusterResponse | null>(null);
  const [pendingDeleteCluster, setPendingDeleteCluster] = useState<FlussClusterResponse | null>(null);
  const [clusterForm, setClusterForm] = useState<FlussClusterRequest>(emptyFlussClusterForm);
  const [topicCreateOpen, setTopicCreateOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<FlussTopicResponse | null>(null);
  const [pendingDeleteTopic, setPendingDeleteTopic] = useState<FlussTopicResponse | null>(null);
  const [topicForm, setTopicForm] = useState<FlussTopicRequest>(emptyFlussTopicForm(0));
  const filteredClusters = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return clusterRows;
    return clusterRows.filter((row) =>
      [row.clusterName, row.bootstrapServers, row.defaultDatabase, row.status]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword),
    );
  }, [clusterRows, keyword]);
  const selectedCluster = filteredClusters.find((row) => row.id === selectedClusterId) ?? filteredClusters[0];
  const currentTopics = useMemo(
    () => topicRows.filter((topic) => topic.clusterId === selectedCluster?.id),
    [selectedCluster?.id, topicRows],
  );
  const saving =
    createCluster.isPending ||
    updateCluster.isPending ||
    deleteCluster.isPending ||
    checkCluster.isPending ||
    createTopic.isPending ||
    updateTopic.isPending ||
    deleteTopic.isPending;
  const initialLoading =
    (!clusters.data && (clusters.isLoading || clusters.isFetching)) ||
    (!topics.data && (topics.isLoading || topics.isFetching));

  function openCreateCluster() {
    setClusterForm(emptyFlussClusterForm);
    setClusterCreateOpen(true);
  }

  function openEditCluster(cluster: FlussClusterResponse) {
    setClusterForm({
      bootstrapServers: cluster.bootstrapServers ?? '',
      clusterName: cluster.clusterName ?? '',
      defaultDatabase: cluster.defaultDatabase ?? 'default',
      description: cluster.description ?? '',
      status: cluster.status ?? 'ACTIVE',
    });
    setEditingCluster(cluster);
  }

  function openCreateTopic() {
    if (!selectedCluster?.id) return;
    setTopicForm(emptyFlussTopicForm(selectedCluster.id));
    setTopicCreateOpen(true);
  }

  function openEditTopic(topic: FlussTopicResponse) {
    setTopicForm({
      bucketCount: topic.bucketCount ?? 1,
      clusterId: topic.clusterId ?? selectedCluster?.id ?? 0,
      description: topic.description ?? '',
      namespaceName: topic.namespaceName ?? 'default',
      replicationFactor: topic.replicationFactor ?? 1,
      status: topic.status ?? 'CREATED',
      topicName: topic.topicName ?? '',
    });
    setEditingTopic(topic);
  }

  async function handleCreateCluster() {
    try {
      await createCluster.mutateAsync({ data: normalizeFlussClusterForm(clusterForm) });
      toast.success(`Fluss 集群「${clusterForm.clusterName}」已添加`);
      setClusterCreateOpen(false);
      setClusterForm(emptyFlussClusterForm);
      await clusters.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, '添加 Fluss 集群失败'));
    }
  }

  async function handleUpdateCluster() {
    if (!editingCluster?.id) return;
    try {
      await updateCluster.mutateAsync({ id: editingCluster.id, data: normalizeFlussClusterForm(clusterForm) });
      toast.success(`Fluss 集群「${clusterForm.clusterName}」已更新`);
      setEditingCluster(null);
      setClusterForm(emptyFlussClusterForm);
      await clusters.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, '更新 Fluss 集群失败'));
    }
  }

  async function handleDeleteCluster() {
    if (!pendingDeleteCluster?.id) return;
    try {
      await deleteCluster.mutateAsync({ id: pendingDeleteCluster.id });
      toast.success(`Fluss 集群「${pendingDeleteCluster.clusterName}」已删除`);
      setPendingDeleteCluster(null);
      if (selectedClusterId === pendingDeleteCluster.id) {
        setSelectedClusterId(null);
      }
      await Promise.all([clusters.refetch(), topics.refetch()]);
    } catch (error) {
      toast.error(getErrorMessage(error, '删除 Fluss 集群失败'));
    }
  }

  async function handleCheckCluster() {
    if (!selectedCluster?.id) return;
    try {
      const ok = await checkCluster.mutateAsync({ id: selectedCluster.id });
      await clusters.refetch();
      if (ok) {
        toast.success(`Fluss 集群「${selectedCluster.clusterName}」连通正常`);
        return;
      }
      toast.error(`Fluss 集群「${selectedCluster.clusterName}」连通失败`);
    } catch (error) {
      await clusters.refetch();
      toast.error(getErrorMessage(error, '检测 Fluss 集群失败'));
    }
  }

  async function handleCreateTopic() {
    try {
      await createTopic.mutateAsync({ data: normalizeFlussTopicForm(topicForm) });
      toast.success(`Fluss Topic「${topicForm.topicName}」已创建`);
      setTopicCreateOpen(false);
      setTopicForm(emptyFlussTopicForm(selectedCluster?.id ?? 0));
      await topics.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, '创建 Fluss Topic 失败'));
    }
  }

  async function handleUpdateTopic() {
    if (!editingTopic?.id) return;
    try {
      await updateTopic.mutateAsync({ id: editingTopic.id, data: normalizeFlussTopicForm(topicForm) });
      toast.success(`Fluss Topic「${topicForm.topicName}」已更新`);
      setEditingTopic(null);
      setTopicForm(emptyFlussTopicForm(selectedCluster?.id ?? 0));
      await topics.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, '更新 Fluss Topic 失败'));
    }
  }

  async function handleDeleteTopic() {
    if (!pendingDeleteTopic?.id) return;
    try {
      await deleteTopic.mutateAsync({ id: pendingDeleteTopic.id });
      toast.success(`Fluss Topic「${pendingDeleteTopic.topicName}」已删除`);
      setPendingDeleteTopic(null);
      await topics.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, '删除 Fluss Topic 失败'));
    }
  }

  return (
    initialLoading ? <ResourcePanelSkeleton /> :
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-5">
        <div className="border border-border-subtle bg-white">
          <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              <h3 className="text-base font-bold text-foreground">Fluss 集群</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={!selectedCluster || saving} onClick={handleCheckCluster}>测试连接</Button>
              <Button size="sm" variant="primary" onClick={openCreateCluster}>添加 Fluss 集群</Button>
            </div>
          </div>
          <div className="grid gap-3 border-b border-border-subtle p-5 md:grid-cols-3">
            {[
              ['集群', String(clusterRows.length)],
              ['Topic', String(topicRows.length)],
              ['启用', String(clusterRows.filter((row) => row.status === 'ACTIVE').length)],
            ].map(([label, value]) => (
              <div key={label} className="bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-bold text-muted-foreground">{label}</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
              </div>
            ))}
          </div>
          <div className="border-b border-border-subtle p-4">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索 Fluss 集群"
                className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm placeholder-slate-400 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1fr_1.4fr_1fr_6rem] bg-slate-50 px-4 py-2.5 text-xs font-bold text-muted-foreground">
                <span>名称</span>
                <span>Bootstrap</span>
                <span>默认库</span>
                <span className="text-right">状态</span>
              </div>
              {filteredClusters.length > 0 ? (
                filteredClusters.map((row) => {
                  const selected = selectedCluster?.id === row.id;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedClusterId(row.id ?? null)}
                      className={cn(
                        'grid w-full grid-cols-[1fr_1.4fr_1fr_6rem] border-t border-border-subtle px-4 py-3 text-left text-sm transition-colors',
                        selected ? 'bg-primary/5' : 'hover:bg-slate-50',
                      )}
                    >
                      <span className="min-w-0 truncate font-bold text-slate-900">{row.clusterName}</span>
                      <span className="min-w-0 truncate text-slate-600">{row.bootstrapServers}</span>
                      <span className="min-w-0 truncate text-slate-600">{row.defaultDatabase}</span>
                      <span className="text-right"><ConnectionStatusBadge status={connectionStatusLabel(row.status)} /></span>
                    </button>
                  );
                })
              ) : (
                <div className="border-t border-border-subtle px-4 py-10 text-center text-sm font-medium text-muted-foreground">
                  {clusterRows.length === 0 ? '暂无 Fluss 集群，请添加真实连接。' : '没有匹配的集群'}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border border-border-subtle bg-white">
          <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Table2 className="h-4 w-4 text-primary" />
              <h3 className="text-base font-bold text-foreground">Topic</h3>
            </div>
            <Button size="sm" variant="primary" disabled={!selectedCluster?.id} onClick={openCreateTopic}>创建 Topic</Button>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.8fr_7rem] bg-slate-50 px-4 py-2.5 text-xs font-bold text-muted-foreground">
                <span>Topic</span>
                <span>Namespace</span>
                <span>Bucket</span>
                <span>副本</span>
                <span>状态</span>
                <span className="text-right">操作</span>
              </div>
              {currentTopics.length > 0 ? (
                currentTopics.map((topic) => (
                  <div key={topic.id} className="grid grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.8fr_7rem] border-t border-border-subtle px-4 py-3 text-sm">
                    <span className="min-w-0 truncate font-bold text-slate-900">{topic.topicName}</span>
                    <span className="min-w-0 truncate text-slate-600">{topic.namespaceName}</span>
                    <span className="text-slate-600">{topic.bucketCount}</span>
                    <span className="text-slate-600">{topic.replicationFactor}</span>
                    <span><ConnectionStatusBadge status={connectionStatusLabel(topic.status)} /></span>
                    <span className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => openEditTopic(topic)}>编辑</Button>
                      <Button size="sm" variant="ghost" onClick={() => setPendingDeleteTopic(topic)}>删除</Button>
                    </span>
                  </div>
                ))
              ) : (
                <div className="border-t border-border-subtle px-4 py-10 text-center text-sm font-medium text-muted-foreground">
                  {selectedCluster ? '当前 Fluss 集群暂无 Topic。' : '请先选择 Fluss 集群。'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border border-border-subtle bg-white p-5">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">当前选择</div>
            <div className="mt-1 text-base font-bold text-foreground">{selectedCluster?.clusterName ?? '-'}</div>
          </div>
          {selectedCluster ? <ConnectionStatusBadge status={connectionStatusLabel(selectedCluster.status)} /> : null}
        </div>
        <div className="mt-4 space-y-3">
          {[
            ['Bootstrap', selectedCluster?.bootstrapServers ?? '-'],
            ['默认库', selectedCluster?.defaultDatabase ?? '-'],
            ['Topic', String(currentTopics.length)],
            ['连接类型', 'Fluss 集群'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 text-sm">
              <span className="shrink-0 text-muted-foreground">{label}</span>
              <span className="min-w-0 break-words text-right font-semibold text-slate-700">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button size="sm" disabled={!selectedCluster} onClick={() => selectedCluster && openEditCluster(selectedCluster)}>编辑</Button>
          <Button size="sm" variant="ghost" disabled={!selectedCluster} onClick={() => selectedCluster && setPendingDeleteCluster(selectedCluster)}>删除</Button>
        </div>
      </div>

      <FlussClusterFormModal disabled={saving} form={clusterForm} onFormChange={setClusterForm} onOpenChange={setClusterCreateOpen} onSubmit={handleCreateCluster} open={clusterCreateOpen} submitLabel="添加" title="添加 Fluss 集群" />
      <FlussClusterFormModal
        disabled={saving}
        form={clusterForm}
        onFormChange={setClusterForm}
        onOpenChange={(open) => {
          if (!open) setEditingCluster(null);
        }}
        onSubmit={handleUpdateCluster}
        open={Boolean(editingCluster)}
        submitLabel="保存"
        title={`编辑 ${editingCluster?.clusterName ?? ''}`}
      />
      <FlussTopicFormModal disabled={saving} form={topicForm} onFormChange={setTopicForm} onOpenChange={setTopicCreateOpen} onSubmit={handleCreateTopic} open={topicCreateOpen} submitLabel="创建" title="创建 Fluss Topic" />
      <FlussTopicFormModal
        disabled={saving}
        form={topicForm}
        onFormChange={setTopicForm}
        onOpenChange={(open) => {
          if (!open) setEditingTopic(null);
        }}
        onSubmit={handleUpdateTopic}
        open={Boolean(editingTopic)}
        submitLabel="保存"
        title={`编辑 ${editingTopic?.topicName ?? ''}`}
      />
      <ConfirmModal confirmLabel="删除" description={`删除后将移除 Fluss 集群「${pendingDeleteCluster?.clusterName ?? ''}」。`} onClose={() => setPendingDeleteCluster(null)} onConfirm={handleDeleteCluster} open={Boolean(pendingDeleteCluster)} title="删除 Fluss 集群" tone="danger" />
      <ConfirmModal confirmLabel="删除" description={`删除后将移除 Fluss Topic「${pendingDeleteTopic?.topicName ?? ''}」。`} onClose={() => setPendingDeleteTopic(null)} onConfirm={handleDeleteTopic} open={Boolean(pendingDeleteTopic)} title="删除 Fluss Topic" tone="danger" />
    </div>
  );
}

function FlussClusterFormModal({
  disabled,
  form,
  onFormChange,
  onOpenChange,
  onSubmit,
  open,
  submitLabel,
  title,
}: {
  disabled?: boolean;
  form: FlussClusterRequest;
  onFormChange: (form: FlussClusterRequest) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
  submitLabel: string;
  title: string;
}) {
  return (
    <Modal disabled={disabled} onOpenChange={onOpenChange} open={open} submitLabel={submitLabel} title={title} onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="集群名称" value={form.clusterName} onChange={(event) => onFormChange({ ...form, clusterName: event.target.value })} placeholder="fluss" />
        <Field label="默认库" value={form.defaultDatabase ?? ''} onChange={(event) => onFormChange({ ...form, defaultDatabase: event.target.value })} placeholder="default" />
        <div className="md:col-span-2">
          <Field label="Bootstrap Servers" value={form.bootstrapServers} onChange={(event) => onFormChange({ ...form, bootstrapServers: event.target.value })} placeholder="fluss:9123" />
        </div>
        <SelectField
          label="状态"
          value={form.status}
          onValueChange={(value) => onFormChange({ ...form, status: value })}
          options={[
            { label: '启用', value: 'ACTIVE' },
            { label: '停用', value: 'INACTIVE' },
          ]}
        />
        <div className="md:col-span-2">
          <Field label="描述" value={form.description ?? ''} onChange={(event) => onFormChange({ ...form, description: event.target.value })} placeholder="Fluss 集群连接资源" />
        </div>
      </div>
    </Modal>
  );
}

function FlussTopicFormModal({
  disabled,
  form,
  onFormChange,
  onOpenChange,
  onSubmit,
  open,
  submitLabel,
  title,
}: {
  disabled?: boolean;
  form: FlussTopicRequest;
  onFormChange: (form: FlussTopicRequest) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
  submitLabel: string;
  title: string;
}) {
  return (
    <Modal disabled={disabled} onOpenChange={onOpenChange} open={open} submitLabel={submitLabel} title={title} onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Topic 名称" value={form.topicName} onChange={(event) => onFormChange({ ...form, topicName: event.target.value })} placeholder="demo_user_events" />
        <Field label="Namespace" value={form.namespaceName ?? ''} onChange={(event) => onFormChange({ ...form, namespaceName: event.target.value })} placeholder="default" />
        <Field label="Bucket 数" type="number" value={form.bucketCount ?? 1} onChange={(event) => onFormChange({ ...form, bucketCount: Number(event.target.value) })} placeholder="12" />
        <Field label="副本数" type="number" value={form.replicationFactor ?? 1} onChange={(event) => onFormChange({ ...form, replicationFactor: Number(event.target.value) })} placeholder="1" />
        <SelectField
          label="状态"
          value={form.status}
          onValueChange={(value) => onFormChange({ ...form, status: value })}
          options={[
            { label: '已创建', value: 'CREATED' },
            { label: '启用', value: 'ACTIVE' },
            { label: '停用', value: 'INACTIVE' },
          ]}
        />
        <div className="md:col-span-2">
          <Field label="描述" value={form.description ?? ''} onChange={(event) => onFormChange({ ...form, description: event.target.value })} placeholder="Fluss Topic 资源" />
        </div>
      </div>
    </Modal>
  );
}
