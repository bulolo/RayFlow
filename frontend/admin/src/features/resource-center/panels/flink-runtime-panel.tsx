'use client';

import { useMemo, useState } from 'react';
import { yaml } from '@codemirror/lang-yaml';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { Search, Waypoints } from 'lucide-react';
import {
  type FlinkRuntimeRequest,
  type FlinkRuntimeResponse,
  useCheckFlinkRuntime,
  useCreateFlinkRuntime,
  useDeleteFlinkRuntime,
  useUpdateFlinkRuntime,
} from '@/shared/api/generated';
import { Button, ConfirmModal, Field, Modal, SelectField } from '@/components/ui';
import { ConnectionStatusBadge } from '@/features/resource-center/components/connection-status-badge';
import { ResourcePanelSkeleton } from '@/features/resource-center/components/resource-panel-skeleton';
import {
  connectionStatusLabel,
  emptyFlinkRuntimeForm,
  extractVersionFromImageTag,
  formFromFlinkRuntime,
  normalizeFlinkRuntimeForm,
} from '@/features/resource-center/lib/resource-center-forms';
import { useRuntimeSettings } from '../hooks/use-runtime-settings';
import { useAuthTokenState } from '@/hooks/use-auth-token-state';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function serviceExposureTypeLabel(value?: string) {
  const labels: Record<string, string> = {
    CLUSTER_IP: 'ClusterIP',
    NODE_PORT: 'NodePort',
    LOAD_BALANCER: 'LoadBalancer',
    INGRESS: 'Ingress',
  };
  return value ? labels[value] ?? value : '-';
}

function runtimeAddressLabel(runtime: FlinkRuntimeResponse) {
  if (runtime.clusterType === 'kubernetes' && runtime.deploymentMode === 'application') {
    return serviceExposureTypeLabel(runtime.serviceExposureType);
  }
  return runtime.address ?? '-';
}

const yamlEditorTheme = EditorView.theme({
  '&': {
    fontSize: '12px',
  },
  '.cm-editor': {
    height: '100%',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
    lineHeight: '1.55',
  },
  '.cm-content': {
    padding: '10px 0',
  },
  '.cm-line': {
    padding: '0 12px',
  },
});

function trimLeadingBlankLines(value: string) {
  return value.replace(/^(?:[ \t]*\r?\n)+/, '');
}

export function FlinkRuntimePanel() {
  const hasToken = useAuthTokenState();
  const runtimeSettings = useRuntimeSettings(hasToken);
  const checkFlinkRuntime = useCheckFlinkRuntime();
  const createFlinkRuntime = useCreateFlinkRuntime();
  const updateFlinkRuntime = useUpdateFlinkRuntime();
  const deleteFlinkRuntime = useDeleteFlinkRuntime();
  const runtimes = useMemo(() => runtimeSettings.runtimes.data?.list ?? [], [runtimeSettings.runtimes.data]);
  const checking = checkFlinkRuntime.isPending || runtimeSettings.runtimes.isFetching;
  const mutating = createFlinkRuntime.isPending || updateFlinkRuntime.isPending || deleteFlinkRuntime.isPending;
  const initialLoading = hasToken && !runtimeSettings.runtimes.data && (runtimeSettings.runtimes.isLoading || runtimeSettings.runtimes.isFetching);

  async function handleCheckRuntime(cluster: FlinkRuntimeResponse) {
    if (!cluster.id) return;
    const result = await checkFlinkRuntime.mutateAsync({ id: cluster.id });
    await runtimeSettings.runtimes.refetch();
    const isK8sApp = cluster.clusterType === 'kubernetes' && cluster.deploymentMode === 'application';
    if (result.clusterReachable) {
      if (isK8sApp) {
        toast.success(`K8s 配置「${cluster.clusterName}」检测通过，Namespace ${cluster.namespaceName ?? '-'} 可达`);
      } else {
        const gatewayMessage = result.gatewayStatus === 'RUNNING'
          ? '，SQL Gateway 正常'
          : result.gatewayStatus === 'UNREACHABLE'
            ? '，SQL Gateway 不可用'
            : '';
        toast.success(`连接「${cluster.clusterName}」检测通过，Flink ${result.flinkVersion ?? '2.x'}${gatewayMessage}`);
      }
      return;
    }
    if (isK8sApp) {
      toast.error(`K8s 配置「${cluster.clusterName}」不可用，请检查 Kube Config 和 Namespace 是否正确`);
      return;
    }
    toast.error(result.flinkVersion
      ? `连接「${cluster.clusterName}」不可用，当前版本 ${result.flinkVersion}；RayFlow 仅支持 Flink 2.x`
      : `连接「${cluster.clusterName}」不可用，请检查 REST 地址`);
  }

  async function handleCreateRuntime(data: FlinkRuntimeRequest) {
    await createFlinkRuntime.mutateAsync({ data });
    await runtimeSettings.runtimes.refetch();
    toast.success(`Flink 运行时「${data.clusterName}」已添加`);
  }

  async function handleUpdateRuntime(runtime: FlinkRuntimeResponse, data: FlinkRuntimeRequest) {
    if (!runtime.id) {
      toast.error(`未找到 Flink 运行时「${runtime.clusterName ?? '-'}」`);
      return;
    }
    await updateFlinkRuntime.mutateAsync({ id: runtime.id, data });
    await runtimeSettings.runtimes.refetch();
    toast.success(`Flink 运行时「${data.clusterName}」已更新`);
  }

  async function handleDeleteRuntime(runtime: FlinkRuntimeResponse) {
    if (!runtime.id) {
      toast.error(`未找到 Flink 运行时「${runtime.clusterName ?? '-'}」`);
      return;
    }
    await deleteFlinkRuntime.mutateAsync({ id: runtime.id });
    await runtimeSettings.runtimes.refetch();
    toast.success(`Flink 运行时「${runtime.clusterName}」已删除`);
  }

  return (
    <FlinkRuntimeContent
      checking={checking}
      initialLoading={initialLoading}
      mutating={mutating}
      onCheck={handleCheckRuntime}
      onCreate={handleCreateRuntime}
      onDelete={handleDeleteRuntime}
      onUpdate={handleUpdateRuntime}
      runtimes={runtimes}
    />
  );
}

function FlinkRuntimeContent({
  checking,
  initialLoading,
  mutating,
  onCheck,
  onCreate,
  onDelete,
  onUpdate,
  runtimes,
}: {
  checking: boolean;
  initialLoading: boolean;
  mutating: boolean;
  onCheck: (runtime: FlinkRuntimeResponse) => Promise<void>;
  onCreate: (data: FlinkRuntimeRequest) => Promise<void>;
  onDelete: (runtime: FlinkRuntimeResponse) => Promise<void>;
  onUpdate: (runtime: FlinkRuntimeResponse, data: FlinkRuntimeRequest) => Promise<void>;
  runtimes: FlinkRuntimeResponse[];
}) {
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRuntime, setEditingRuntime] = useState<FlinkRuntimeResponse | null>(null);
  const [pendingDeleteRuntime, setPendingDeleteRuntime] = useState<FlinkRuntimeResponse | null>(null);
  const [form, setForm] = useState<FlinkRuntimeRequest>(emptyFlinkRuntimeForm);
  const filteredRuntimes = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return runtimes;
    return runtimes.filter((runtime) =>
      [runtime.clusterName, runtime.clusterType, runtime.deploymentMode, runtime.address, runtime.gatewayAddress, runtime.serviceExposureType, runtime.flinkVersion, runtime.status]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword),
    );
  }, [keyword, runtimes]);
  const selectedRuntime = filteredRuntimes.find((runtime) => runtime.id === selectedId) ?? filteredRuntimes[0];
  const runtimeDetailItems = useMemo(() => {
    if (!selectedRuntime) return [];
    const items: Array<[string, string]> = [
      ['类型', selectedRuntime.clusterType ?? '-'],
      ['部署模式', selectedRuntime.deploymentMode ?? '-'],
      [
        selectedRuntime.clusterType === 'kubernetes' && selectedRuntime.deploymentMode === 'application' ? '服务对外类型' : 'REST 地址',
        runtimeAddressLabel(selectedRuntime),
      ],
      ['Flink 版本', selectedRuntime.flinkVersion ?? '-'],
      ['默认并行度', selectedRuntime.defaultParallelism ? String(selectedRuntime.defaultParallelism) : '-'],
      ['Checkpoint 路径', selectedRuntime.checkpointDir ?? '-'],
      ['Savepoint 路径', selectedRuntime.savepointDir ?? '-'],
      ['描述', selectedRuntime.description ?? '-'],
    ];
    if (selectedRuntime.clusterType === 'kubernetes') {
      items.splice(
        6,
        0,
        ['Namespace', selectedRuntime.namespaceName ?? '-'],
        ['ServiceAccount', selectedRuntime.serviceAccount ?? '-'],
        ['镜像', selectedRuntime.image ?? '-'],
        ['拉取策略', selectedRuntime.imagePullPolicy ?? '-'],
        ['Kube Config', selectedRuntime.kubeConfigRef ? '已配置' : '默认 /root/.kube/config'],
        ['Pod Template', selectedRuntime.podTemplate ? '已配置' : '-'],
      );
    } else {
      items.splice(
        4,
        0,
        ['SQL Gateway', selectedRuntime.gatewayAddress ?? '-'],
        ['Gateway 状态', selectedRuntime.gatewayStatus ?? '-'],
      );
    }
    return items;
  }, [selectedRuntime]);

  function openCreate() {
    setForm(emptyFlinkRuntimeForm);
    setCreateOpen(true);
  }

  function openEdit(runtime: FlinkRuntimeResponse) {
    setForm(formFromFlinkRuntime(runtime));
    setEditingRuntime(runtime);
  }

  async function handleCreate() {
    await onCreate(normalizeFlinkRuntimeForm(form));
    setCreateOpen(false);
    setSelectedId(null);
    setForm(emptyFlinkRuntimeForm);
  }

  async function handleUpdate() {
    if (!editingRuntime) return;
    await onUpdate(editingRuntime, normalizeFlinkRuntimeForm(form, editingRuntime));
    setEditingRuntime(null);
    setForm(emptyFlinkRuntimeForm);
  }

  async function handleDelete() {
    if (!pendingDeleteRuntime) return;
    await onDelete(pendingDeleteRuntime);
    if (selectedId === pendingDeleteRuntime.id) {
      setSelectedId(null);
    }
    setPendingDeleteRuntime(null);
  }

  return (
    initialLoading ? <ResourcePanelSkeleton /> :
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 border border-border-subtle bg-white">
        <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Waypoints className="h-4 w-4 text-primary" />
            <h3 className="text-base font-bold text-foreground">Flink 运行时</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={!selectedRuntime || checking || mutating} onClick={() => selectedRuntime && void onCheck(selectedRuntime)}>测试连接</Button>
            <Button size="sm" variant="primary" disabled={mutating} onClick={openCreate}>添加 Flink 运行时</Button>
          </div>
        </div>
        <div className="grid gap-3 border-b border-border-subtle p-5 md:grid-cols-3">
          {[
            ['运行时', String(runtimes.length)],
            ['运行中', String(runtimes.filter((runtime) => runtime.status === 'RUNNING').length)],
            ['Gateway', String(runtimes.filter((runtime) => Boolean(runtime.gatewayAddress)).length)],
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
              placeholder="搜索 Flink 运行时"
              className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm placeholder-slate-400 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[1.1fr_0.7fr_0.8fr_1.6fr_1.6fr_0.7fr_6rem] bg-slate-50 px-4 py-2.5 text-xs font-bold text-muted-foreground">
              <span>名称</span>
              <span>类型</span>
              <span>模式</span>
              <span>入口</span>
              <span>SQL Gateway</span>
              <span>版本</span>
              <span className="text-right">状态</span>
            </div>
            {filteredRuntimes.length > 0 ? (
              filteredRuntimes.map((runtime) => {
                const selected = selectedRuntime?.id === runtime.id;
                return (
                  <button
                    key={runtime.id}
                    type="button"
                    onClick={() => setSelectedId(runtime.id ?? null)}
                    className={cn(
                      'grid w-full grid-cols-[1.1fr_0.7fr_0.8fr_1.6fr_1.6fr_0.7fr_6rem] border-t border-border-subtle px-4 py-3 text-left text-sm transition-colors',
                      selected ? 'bg-primary/5' : 'hover:bg-slate-50',
                    )}
                  >
                    <span className="min-w-0 truncate font-bold text-slate-900">{runtime.clusterName}</span>
                    <span className="min-w-0 truncate text-slate-600">{runtime.clusterType ?? '-'}</span>
                    <span className="min-w-0 truncate text-slate-600">{runtime.deploymentMode ?? '-'}</span>
                    <span className="min-w-0 truncate text-slate-600">{runtimeAddressLabel(runtime)}</span>
                    <span className="min-w-0 truncate text-slate-600">{runtime.clusterType === 'kubernetes' && runtime.deploymentMode === 'application' ? '-' : runtime.gatewayAddress ?? '-'}</span>
                    <span className="min-w-0 truncate text-slate-600">{runtime.flinkVersion ?? '-'}</span>
                    <span className="text-right"><ConnectionStatusBadge status={connectionStatusLabel(runtime.status)} /></span>
                  </button>
                );
              })
            ) : (
              <div className="border-t border-border-subtle px-4 py-10 text-center text-sm font-medium text-muted-foreground">
                {runtimes.length === 0 ? '暂无 Flink 运行时，请添加真实运行时连接。' : '没有匹配的运行时'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border border-border-subtle bg-white p-5">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">当前选择</div>
            <div className="mt-1 text-base font-bold text-foreground">{selectedRuntime?.clusterName ?? '-'}</div>
          </div>
          {selectedRuntime ? <ConnectionStatusBadge status={connectionStatusLabel(selectedRuntime.status)} /> : null}
        </div>
        <div className="mt-4 space-y-3">
          {runtimeDetailItems.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 text-sm">
              <span className="shrink-0 text-muted-foreground">{label}</span>
              <span className="min-w-0 break-words text-right font-semibold text-slate-700">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button size="sm" disabled={!selectedRuntime || mutating} onClick={() => selectedRuntime && openEdit(selectedRuntime)}>编辑</Button>
          <Button size="sm" variant="ghost" disabled={!selectedRuntime || mutating} onClick={() => selectedRuntime && setPendingDeleteRuntime(selectedRuntime)}>删除</Button>
        </div>
      </div>

      <FlinkRuntimeFormModal
        disabled={mutating}
        form={form}
        onFormChange={setForm}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        open={createOpen}
        submitLabel="添加"
        title="添加 Flink 运行时"
      />
      <FlinkRuntimeFormModal
        disabled={mutating}
        form={form}
        onFormChange={setForm}
        onOpenChange={(open) => {
          if (!open) setEditingRuntime(null);
        }}
        onSubmit={handleUpdate}
        open={Boolean(editingRuntime)}
        submitLabel="保存"
        title={`编辑 ${editingRuntime?.clusterName ?? ''}`}
      />
      <ConfirmModal
        confirmLabel="删除"
        description={`删除后将移除 Flink 运行时「${pendingDeleteRuntime?.clusterName ?? ''}」。`}
        onClose={() => setPendingDeleteRuntime(null)}
        onConfirm={() => void handleDelete()}
        open={Boolean(pendingDeleteRuntime)}
        title="删除 Flink 运行时"
        tone="danger"
      />
    </div>
  );
}


function FlinkRuntimeFormModal({
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
  form: FlinkRuntimeRequest;
  onFormChange: (form: FlinkRuntimeRequest) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
  submitLabel: string;
  title: string;
}) {
  const isKubernetes = form.clusterType === 'kubernetes';
  const isKubernetesApplication = isKubernetes && (form.deploymentMode ?? 'application') === 'application';
  const [k8sConfigTab, setK8sConfigTab] = useState<'kubeConfig' | 'podTemplate'>('kubeConfig');
  return (
    <Modal
      className="w-[min(56rem,calc(100vw-2rem))] max-w-none"
      disabled={disabled}
      onOpenChange={onOpenChange}
      open={open}
      submitLabel={submitLabel}
      title={title}
      onSubmit={onSubmit}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="名称" value={form.clusterName} onChange={(event) => onFormChange({ ...form, clusterName: event.target.value })} placeholder="flink-dev" />
        <SelectField
          label="类型"
          value={form.clusterType ?? 'standalone'}
          onValueChange={(value) => onFormChange({
            ...form,
            address: value === 'kubernetes' ? '' : form.address,
            clusterType: value,
            deploymentMode: value === 'kubernetes' ? 'application' : 'session',
            gatewayAddress: value === 'kubernetes' ? '' : form.gatewayAddress,
            serviceExposureType: value === 'kubernetes' ? (form.serviceExposureType || 'CLUSTER_IP') : undefined,
          })}
          options={[
            { label: 'Standalone', value: 'standalone' },
            { label: 'Kubernetes', value: 'kubernetes' },
          ]}
        />
        {isKubernetes ? (
          <SelectField
            label="部署模式"
            value={form.deploymentMode ?? 'application'}
            onValueChange={(value) => onFormChange({ ...form, deploymentMode: value })}
            options={[
              { label: 'Application', value: 'application' },
              { label: 'Session', value: 'session' },
            ]}
          />
        ) : null}
        {!isKubernetesApplication ? (
          <>
            <Field label="REST 地址" value={form.address ?? ''} onChange={(event) => onFormChange({ ...form, address: event.target.value })} placeholder="http://flink-jobmanager:8081" />
            <Field label="SQL Gateway" value={form.gatewayAddress ?? ''} onChange={(event) => onFormChange({ ...form, gatewayAddress: event.target.value })} placeholder="http://flink-sql-gateway:8083" />
          </>
        ) : (
          <SelectField
            label="K8S 服务对外类型"
            value={form.serviceExposureType ?? 'CLUSTER_IP'}
            onValueChange={(value) => onFormChange({ ...form, serviceExposureType: value })}
            options={[
              { label: 'ClusterIP', value: 'CLUSTER_IP' },
              { label: 'NodePort', value: 'NODE_PORT' },
              { label: 'LoadBalancer', value: 'LOAD_BALANCER' },
              { label: 'Ingress', value: 'INGRESS' },
            ]}
          />
        )}
        <Field label="默认并行度" type="number" value={form.defaultParallelism ? String(form.defaultParallelism) : ''} onChange={(event) => onFormChange({ ...form, defaultParallelism: Number(event.target.value) || undefined })} placeholder="1" />
        {isKubernetes ? (
          <>
            <Field label="Namespace" value={form.namespaceName ?? ''} onChange={(event) => onFormChange({ ...form, namespaceName: event.target.value })} placeholder="default" />
            <Field label="ServiceAccount" value={form.serviceAccount ?? ''} onChange={(event) => onFormChange({ ...form, serviceAccount: event.target.value })} placeholder="flink" />
            <div>
              <Field label="镜像" value={form.image ?? ''} onChange={(event) => onFormChange({ ...form, image: event.target.value })} placeholder="flink:2.2.1" />
              {(() => {
                const ver = extractVersionFromImageTag(form.image);
                return (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Flink 版本：<span className={ver ? 'font-medium text-slate-700' : 'italic'}>{ver ?? '无法从 tag 识别，将默认 2.2.1'}</span>
                  </p>
                );
              })()}
            </div>
            <SelectField
              label="拉取策略"
              value={form.imagePullPolicy ?? 'IfNotPresent'}
              onValueChange={(value) => onFormChange({ ...form, imagePullPolicy: value })}
              options={[
                { label: 'IfNotPresent', value: 'IfNotPresent' },
                { label: 'Always', value: 'Always' },
                { label: 'Never', value: 'Never' },
              ]}
            />
            <div className="md:col-span-2">
              <div className="mb-2 flex rounded-lg border border-border bg-slate-50 p-0.5">
                {[
                  { label: 'Kube Config', value: 'kubeConfig' },
                  { label: 'Pod Template', value: 'podTemplate' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setK8sConfigTab(item.value as 'kubeConfig' | 'podTemplate')}
                    className={cn(
                      'h-8 rounded-md px-3 text-xs font-bold transition',
                      k8sConfigTab === item.value ? 'bg-white text-slate-900 shadow-sm' : 'text-muted-foreground hover:text-slate-700',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {k8sConfigTab === 'kubeConfig' ? (
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kube Config</span>
                  <CodeMirror
                    className="h-64 overflow-hidden rounded-lg border border-border bg-white text-xs outline-none transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"
                    value={form.kubeConfigRef ?? ''}
                    height="16rem"
                    basicSetup={{
                      bracketMatching: true,
                      closeBrackets: true,
                      foldGutter: true,
                      highlightActiveLine: true,
                      highlightActiveLineGutter: true,
                      lineNumbers: true,
                    }}
                    extensions={[yaml(), yamlEditorTheme]}
                    placeholder="留空使用容器 /root/.kube/config；也可以填写 kubeconfig 路径或粘贴 kubeconfig 内容"
                    onChange={(value) => onFormChange({ ...form, kubeConfigRef: trimLeadingBlankLines(value) })}
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kubernetes Pod 模板</span>
                  <CodeMirror
                    className="h-64 overflow-hidden rounded-lg border border-border bg-white text-xs outline-none transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"
                    value={form.podTemplate ?? ''}
                    height="16rem"
                    basicSetup={{
                      bracketMatching: true,
                      closeBrackets: true,
                      foldGutter: true,
                      highlightActiveLine: true,
                      highlightActiveLineGutter: true,
                      lineNumbers: true,
                    }}
                    extensions={[yaml(), yamlEditorTheme]}
                    placeholder="apiVersion: v1&#10;kind: Pod&#10;metadata:&#10;  name: pod-template"
                    onChange={(value) => onFormChange({ ...form, podTemplate: trimLeadingBlankLines(value) })}
                  />
                </label>
              )}
            </div>
          </>
        ) : null}
        <div className="md:col-span-2">
          <Field label="Checkpoint 路径" value={form.checkpointDir ?? ''} onChange={(event) => onFormChange({ ...form, checkpointDir: event.target.value })} placeholder="s3://rayflow-artifacts/checkpoints" />
        </div>
        <div className="md:col-span-2">
          <Field label="Savepoint 路径" value={form.savepointDir ?? ''} onChange={(event) => onFormChange({ ...form, savepointDir: event.target.value })} placeholder="s3://rayflow-artifacts/savepoints" />
        </div>
        <div className="md:col-span-2">
          <Field label="描述" value={form.description ?? ''} onChange={(event) => onFormChange({ ...form, description: event.target.value })} placeholder="运行时说明" />
        </div>
      </div>
    </Modal>
  );
}
