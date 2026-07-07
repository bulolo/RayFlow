'use client';

import { useState } from 'react';
import { ArrowLeft, Bell, Loader2, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, ConfirmModal, Toggle, SectionCard, SectionHeader } from '@/components/ui';
import { TableEmpty, TablePagination, TableShell, TableToolbar } from '@/components/data-display/table-shell';
import {
  type NotificationChannelRequest,
  type NotificationChannelResponse,
  useCreateNotificationChannel,
  useDeleteNotificationChannel,
  useListNotificationChannels,
  useTestNotificationChannel,
  useUpdateNotificationChannel,
} from '@/shared/api/generated';
import { cn } from '@/lib/utils';

type NotificationChannelType = 'feishu' | 'webhook' | 'dingtalk' | 'wecom' | 'inapp';

type DraftState = {
  id?: number;
  name: string;
  type: NotificationChannelType;
  webhookUrl: string;
  secret: string;
  enabled: boolean;
};

const CHANNEL_META: Record<NotificationChannelType, { label: string; hint: string; hasSecret: boolean; needsUrl: boolean }> = {
  feishu: { label: '飞书', hint: '飞书群自定义机器人的 Webhook 地址', hasSecret: false, needsUrl: true },
  webhook: { label: '通用 Webhook', hint: '任意接收 JSON 的 HTTP 地址', hasSecret: false, needsUrl: true },
  dingtalk: { label: '钉钉', hint: '钉钉群机器人 Webhook，可选加签 secret', hasSecret: true, needsUrl: true },
  wecom: { label: '企业微信', hint: '企业微信群机器人的 Webhook 地址', hasSecret: false, needsUrl: true },
  inapp: { label: '站内通知', hint: '控制台内实时提示，无需填写地址', hasSecret: false, needsUrl: false },
};

const EMPTY_DRAFT: DraftState = {
  name: '',
  type: 'feishu',
  webhookUrl: '',
  secret: '',
  enabled: true,
};

function normalizeChannelType(type?: string): NotificationChannelType {
  return type && type in CHANNEL_META ? (type as NotificationChannelType) : 'feishu';
}

function toDraft(channel: NotificationChannelResponse): DraftState {
  return {
    id: channel.id,
    name: channel.name ?? '',
    type: normalizeChannelType(channel.type),
    webhookUrl: channel.config?.webhook_url ?? '',
    secret: '',
    enabled: channel.enabled ?? true,
  };
}

export function AlertChannels() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const { data, isLoading, isFetching, refetch } = useListNotificationChannels({
    is_pager: 1,
    keyword: keyword.trim() || undefined,
    page,
    size: pageSize,
  });
  const channels = data?.list ?? [];
  const total = data?.pagination?.total ?? channels.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const createMut = useCreateNotificationChannel();
  const updateMut = useUpdateNotificationChannel();
  const deleteMut = useDeleteNotificationChannel();
  const testMut = useTestNotificationChannel();
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [pendingDeleteChannel, setPendingDeleteChannel] = useState<NotificationChannelResponse | null>(null);

  const saving = createMut.isPending || updateMut.isPending;
  const dirtyValid =
    draft && draft.name.trim() && (!CHANNEL_META[draft.type].needsUrl || draft.webhookUrl.trim());

  async function handleSave() {
    if (!draft) return;
    const config: Record<string, string> = {};
    if (CHANNEL_META[draft.type].needsUrl) {
      config.webhook_url = draft.webhookUrl.trim();
    }
    if (CHANNEL_META[draft.type].hasSecret && draft.secret.trim()) {
      config.secret = draft.secret.trim();
    }
    const payload: NotificationChannelRequest = {
      name: draft.name.trim(),
      type: draft.type,
      config,
      enabled: draft.enabled,
    };
    if (draft.id) {
      await updateMut.mutateAsync({ id: draft.id, data: payload });
    } else {
      await createMut.mutateAsync({ data: payload });
    }
    await refetch();
    setDraft(null);
  }

  async function handleDelete(channel: NotificationChannelResponse) {
    if (!channel.id) return;
    await deleteMut.mutateAsync({ id: channel.id });
    await refetch();
    setPendingDeleteChannel(null);
  }

  async function handleTest(channel: NotificationChannelResponse) {
    if (!channel.id) return;
    const ok = await testMut.mutateAsync({ id: channel.id });
    if (ok) {
      toast.success(`渠道「${channel.name}」测试成功`);
    } else {
      toast.error(`渠道「${channel.name}」测试失败`);
    }
  }

  if (draft) {
    return (
      <div className="w-full space-y-6">
        <SectionHeader
          title={draft.id ? '编辑告警渠道' : '新增告警渠道'}
          description="选择渠道类型并填写接收地址。"
          action={
            <Button variant="ghost" onClick={() => setDraft(null)} className="h-9 px-3 text-xs font-bold">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Button>
          }
        />

        <SectionCard title="渠道配置">
          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">渠道名称</label>
              <input
                className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                placeholder="如：运维飞书群"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">渠道类型</label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {(Object.keys(CHANNEL_META) as NotificationChannelType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDraft({ ...draft, type })}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                      draft.type === type
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40',
                    )}
                  >
                    {CHANNEL_META[type].label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{CHANNEL_META[draft.type].hint}</p>
            </div>

            {CHANNEL_META[draft.type].needsUrl ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Webhook 地址</label>
                <input
                  className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  placeholder="https://..."
                  value={draft.webhookUrl}
                  onChange={(event) => setDraft({ ...draft, webhookUrl: event.target.value })}
                />
              </div>
            ) : null}

            {CHANNEL_META[draft.type].hasSecret ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">加签 Secret</label>
                <input
                  className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  placeholder={draft.id ? '留空表示不修改' : '钉钉机器人安全设置的加签密钥'}
                  value={draft.secret}
                  onChange={(event) => setDraft({ ...draft, secret: event.target.value })}
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-1">
              <label className="text-sm font-medium text-foreground">启用</label>
              <Toggle checked={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} />
            </div>
          </div>
        </SectionCard>

        <div className="flex justify-end gap-2">
          <Button onClick={() => setDraft(null)} className="h-9 px-4 text-xs font-bold">取消</Button>
          <Button onClick={() => void handleSave()} disabled={!dirtyValid || saving} variant="primary" className="h-9 px-4 text-xs font-bold shadow-sm">
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            保存
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <SectionHeader
        title="告警渠道"
        description="配置组织级别的告警通知方式。作业和资源检查可引用这些渠道。"
        action={
          <Button onClick={() => setDraft({ ...EMPTY_DRAFT })} variant="primary" className="h-9 px-5 text-xs font-bold shadow-sm">
            <Plus className="mr-1 h-4 w-4" />
            新增渠道
          </Button>
        }
      />

      <TableToolbar
        onSearchChange={(value) => {
          setKeyword(value);
          setPage(1);
        }}
        searchPlaceholder="搜索渠道名称、类型或地址"
        searchValue={keyword}
      />

      <TableShell>
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-border-subtle bg-slate-50/70 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">渠道名称</th>
              <th className="px-5 py-3 font-semibold">类型</th>
              <th className="px-5 py-3 font-semibold">状态</th>
              <th className="px-5 py-3 font-semibold">接收地址</th>
              <th className="px-5 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle bg-white">
            {isLoading ? (
              <tr>
                <td className="px-5 py-12 text-center text-sm font-medium text-slate-400" colSpan={5}>
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : channels.length ? (
              channels.map((channel) => {
                const channelType = normalizeChannelType(channel.type);
                return (
                <tr key={channel.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Bell className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate font-bold text-slate-900">{channel.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge className="text-[10px]">{CHANNEL_META[channelType]?.label ?? channel.type}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={channel.enabled === false ? 'neutral' : 'success'}>
                      {channel.enabled === false ? '已停用' : '启用'}
                    </Badge>
                  </td>
                  <td className="max-w-[420px] truncate px-5 py-3 text-xs font-semibold text-slate-500" title={channel.config?.webhook_url}>
                    {channel.config?.webhook_url || (channel.type === 'inapp' ? '控制台内实时提示' : '-')}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        onClick={() => void handleTest(channel)}
                        disabled={testMut.isPending}
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="测试"
                        aria-label="测试"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button onClick={() => setDraft(toDraft(channel))} variant="ghost" className="h-7 w-7 p-0" title="编辑" aria-label="编辑">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        onClick={() => setPendingDeleteChannel(channel)}
                        disabled={deleteMut.isPending}
                        variant="ghost"
                        className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                        title="删除"
                        aria-label="删除"
                      >
                        {deleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </td>
                </tr>
                );
              })
            ) : (
              <TableEmpty colSpan={5} message="还没有配置告警渠道" />
            )}
          </tbody>
        </table>
        <TablePagination
          disabled={isLoading || isFetching}
          end={Math.min(page * pageSize, total)}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPage(1);
            setPageSize(size);
          }}
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          start={(page - 1) * pageSize + 1}
          total={total}
        />
      </TableShell>
      <ConfirmModal
        description={`删除后将停用告警渠道「${pendingDeleteChannel?.name ?? ''}」，相关通知策略需要重新绑定。`}
        onConfirm={() => void (pendingDeleteChannel ? handleDelete(pendingDeleteChannel) : Promise.resolve())}
        onClose={() => setPendingDeleteChannel(null)}
        open={Boolean(pendingDeleteChannel)}
        title="删除告警渠道"
        tone="danger"
      />
    </div>
  );
}
