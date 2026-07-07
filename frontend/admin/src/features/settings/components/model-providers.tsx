'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Textarea, Toggle, SectionCard, SectionHeader } from '@/components/ui';
import {
  getGetModelProviderConfigQueryKey,
  type ModelProviderConfigRequest,
  type ModelProviderConfigResponse,
  useGetModelProviderConfig,
  useTestModelProviderConfig,
  useUpdateModelProviderConfig,
} from '@/shared/api/generated';
import { useQueryClient } from '@tanstack/react-query';

type ModelProviderType = 'openai_compatible';

type ModelProviderConfig = {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  enabled: boolean;
  models: string;
  provider: ModelProviderType;
  updatedAt: string;
};

const PROVIDER_OPENAI_COMPATIBLE: ModelProviderType = 'openai_compatible';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODELS = 'gpt-4.1,gpt-4.1-mini,text-embedding-3-large';
const DEFAULT_MODEL = 'gpt-4.1-mini';

function createDefaultConfig(): ModelProviderConfig {
  return {
    apiKey: '',
    baseUrl: DEFAULT_BASE_URL,
    defaultModel: DEFAULT_MODEL,
    enabled: false,
    models: DEFAULT_MODELS,
    provider: PROVIDER_OPENAI_COMPATIBLE,
    updatedAt: new Date().toISOString(),
  };
}

function toConfig(response?: ModelProviderConfigResponse): ModelProviderConfig {
  if (!response) return createDefaultConfig();
  const fallback = createDefaultConfig();
  return {
    ...fallback,
    apiKey: response.apiKey ?? '',
    baseUrl: response.baseUrl ?? fallback.baseUrl,
    defaultModel: response.defaultModel ?? fallback.defaultModel,
    enabled: response.enabled ?? fallback.enabled,
    models: response.models ?? fallback.models,
    provider: PROVIDER_OPENAI_COMPATIBLE,
    updatedAt: response.updatedAt || fallback.updatedAt,
  };
}

function toRequest(config: ModelProviderConfig): ModelProviderConfigRequest {
  return {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    defaultModel: config.defaultModel,
    enabled: config.enabled,
    models: config.models,
    provider: PROVIDER_OPENAI_COMPATIBLE,
  };
}

export function ModelProviders() {
  const [config, setConfig] = useState<ModelProviderConfig>(createDefaultConfig);
  const [secretVisible, setSecretVisible] = useState(false);
  const queryClient = useQueryClient();
  const modelProviderQuery = useGetModelProviderConfig({ query: { refetchOnWindowFocus: false } });
  const updateModelProvider = useUpdateModelProviderConfig();
  const testModelProvider = useTestModelProviderConfig();

  useEffect(() => {
    if (modelProviderQuery.data) {
      const timeoutId = window.setTimeout(() => setConfig(toConfig(modelProviderQuery.data)), 0);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [modelProviderQuery.data]);

  const validConfig = config.baseUrl.trim() && config.defaultModel.trim();

  async function persist(nextConfig: ModelProviderConfig) {
    const normalized: ModelProviderConfig = {
      ...nextConfig,
      provider: PROVIDER_OPENAI_COMPATIBLE,
      baseUrl: nextConfig.baseUrl.trim(),
      defaultModel: nextConfig.defaultModel.trim(),
      models: nextConfig.models.trim(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await updateModelProvider.mutateAsync({ data: toRequest(normalized) });
    setConfig(toConfig(saved));
    await queryClient.invalidateQueries({ queryKey: getGetModelProviderConfigQueryKey() });
    toast.success('模型提供商配置已保存');
  }

  async function testConfig() {
    if (!validConfig) return;
    const ok = await testModelProvider.mutateAsync({ data: toRequest(config) });
    if (ok) {
      toast.success('模型提供商连通正常');
    } else {
      toast.error('模型提供商连通失败');
    }
  }

  const saving = updateModelProvider.isPending;
  const testing = testModelProvider.isPending;

  return (
    <div className="w-full space-y-6">
      <SectionHeader
        title="模型提供商"
        description="配置唯一的模型服务入口，为后续 AI 助手、SQL 生成和运维诊断接入做准备。"
        action={
          <div className="flex gap-2">
            <Button onClick={() => void testConfig()} disabled={!validConfig || testing || modelProviderQuery.isLoading} className="h-9 px-4 text-xs font-bold">
              {testing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
              测试
            </Button>
            <Button onClick={() => void persist(config)} disabled={!validConfig || saving || modelProviderQuery.isLoading} variant="primary" className="h-9 px-4 text-xs font-bold shadow-sm">
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              保存
            </Button>
          </div>
        }
      />

      <SectionCard title={`OpenAI 兼容接口 / ${config.enabled ? '启用' : '停用'} / ${config.defaultModel || '-'}`}>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Base URL" value={config.baseUrl} onChange={(event) => setConfig({ ...config, baseUrl: event.target.value })} placeholder="https://api.openai.com/v1" />
          </div>
          <div className="md:col-span-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">API Key</span>
              <div className="flex gap-2">
                <input
                  className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-white px-3 text-sm outline-none transition duration-200 focus:border-primary focus:ring-4 focus:ring-primary/10"
                  type={secretVisible ? 'text' : 'password'}
                  value={config.apiKey}
                  onChange={(event) => setConfig({ ...config, apiKey: event.target.value })}
                  placeholder="sk-..."
                />
                <Button type="button" variant="ghost" className="h-9 w-9 p-0" onClick={() => setSecretVisible((visible) => !visible)} aria-label="切换密钥可见性">
                  {secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </label>
          </div>
          <Field label="默认模型" value={config.defaultModel} onChange={(event) => setConfig({ ...config, defaultModel: event.target.value })} placeholder="gpt-4.1-mini" />
          <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-slate-50 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-foreground">启用</div>
              <div className="mt-0.5 text-xs font-medium text-muted-foreground">后续 AI 功能只读取启用状态。</div>
            </div>
            <Toggle checked={config.enabled} onChange={(enabled) => setConfig({ ...config, enabled })} />
          </div>
          <div className="md:col-span-2">
            <Textarea
              label="可用模型"
              value={config.models}
              onChange={(event) => setConfig({ ...config, models: event.target.value })}
              placeholder="多个模型用逗号分隔，如 gpt-4.1-mini,text-embedding-3-large"
              rows={4}
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
