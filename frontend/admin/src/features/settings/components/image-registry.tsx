'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Save, Send } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Field, SectionCard, SectionHeader, Toggle } from '@/components/ui';
import {
  getGetImageRegistryConfigQueryKey,
  type ImageRegistryConfigRequest,
  type ImageRegistryConfigResponse,
  useGetImageRegistryConfig,
  useTestImageRegistryConfig,
  useUpdateImageRegistryConfig,
} from '@/shared/api/generated';

type ImageRegistryConfig = Required<Omit<ImageRegistryConfigRequest, 'password'>> & {
  password: string;
  updatedAt: string;
};

const defaultConfig: ImageRegistryConfig = {
  enabled: false,
  namespaceName: 'rayflow',
  password: '',
  registryUrl: 'https://registry-1.docker.io',
  updatedAt: new Date().toISOString(),
  username: '',
};

function toConfig(response?: ImageRegistryConfigResponse): ImageRegistryConfig {
  if (!response) return defaultConfig;
  return {
    ...defaultConfig,
    enabled: response.enabled ?? defaultConfig.enabled,
    namespaceName: response.namespaceName ?? defaultConfig.namespaceName,
    password: response.password ?? '',
    registryUrl: response.registryUrl ?? defaultConfig.registryUrl,
    updatedAt: response.updatedAt || defaultConfig.updatedAt,
    username: response.username ?? '',
  };
}

function toRequest(config: ImageRegistryConfig): ImageRegistryConfigRequest {
  return {
    enabled: config.enabled,
    namespaceName: config.namespaceName,
    password: config.password,
    registryUrl: config.registryUrl,
    username: config.username,
  };
}

export function ImageRegistry() {
  const [config, setConfig] = useState<ImageRegistryConfig>(defaultConfig);
  const [secretVisible, setSecretVisible] = useState(false);
  const queryClient = useQueryClient();
  const imageRegistryQuery = useGetImageRegistryConfig({ query: { refetchOnWindowFocus: false } });
  const updateImageRegistry = useUpdateImageRegistryConfig();
  const testImageRegistry = useTestImageRegistryConfig();

  useEffect(() => {
    if (imageRegistryQuery.data) {
      const timeoutId = window.setTimeout(() => setConfig(toConfig(imageRegistryQuery.data)), 0);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [imageRegistryQuery.data]);

  const validConfig = config.registryUrl.trim();

  async function persist(nextConfig: ImageRegistryConfig) {
    const normalized: ImageRegistryConfig = {
      ...nextConfig,
      namespaceName: nextConfig.namespaceName.trim(),
      registryUrl: nextConfig.registryUrl.trim(),
      updatedAt: new Date().toISOString(),
      username: nextConfig.username.trim(),
    };
    const saved = await updateImageRegistry.mutateAsync({ data: toRequest(normalized) });
    setConfig(toConfig(saved));
    await queryClient.invalidateQueries({ queryKey: getGetImageRegistryConfigQueryKey() });
    toast.success('镜像仓库配置已保存');
  }

  async function testConfig() {
    if (!validConfig) return;
    const ok = await testImageRegistry.mutateAsync({ data: toRequest(config) });
    if (ok) {
      toast.success('镜像仓库连通正常');
    } else {
      toast.error('镜像仓库连通失败，请检查地址和凭证');
    }
  }

  const saving = updateImageRegistry.isPending;
  const testing = testImageRegistry.isPending;

  return (
    <div className="w-full space-y-6">
      <SectionHeader
        title="镜像仓库"
        description="配置 RayFlow 后续打包作业镜像时使用的目标镜像仓库和推送凭证。"
        action={
          <div className="flex gap-2">
            <Button onClick={() => void testConfig()} disabled={!validConfig || testing || imageRegistryQuery.isLoading} className="h-9 px-4 text-xs font-bold">
              {testing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
              测试
            </Button>
            <Button onClick={() => void persist(config)} disabled={!validConfig || saving || imageRegistryQuery.isLoading} variant="primary" className="h-9 px-4 text-xs font-bold shadow-sm">
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              保存
            </Button>
          </div>
        }
      />

      <SectionCard title={`镜像仓库 / ${config.enabled ? '启用' : '停用'} / ${config.registryUrl || '-'}`}>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Registry URL" value={config.registryUrl} onChange={(event) => setConfig({ ...config, registryUrl: event.target.value })} placeholder="https://registry.example.com" />
          </div>
          <Field label="命名空间 / 项目" value={config.namespaceName} onChange={(event) => setConfig({ ...config, namespaceName: event.target.value })} placeholder="rayflow" />
          <Field label="用户名" value={config.username} onChange={(event) => setConfig({ ...config, username: event.target.value })} placeholder="robot$rayflow" />
          <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-slate-50 px-4 py-3 md:col-span-2">
            <div>
              <div className="text-sm font-bold text-foreground">启用</div>
              <div className="mt-0.5 text-xs font-medium text-muted-foreground">启用后，后续作业镜像打包推送默认读取此仓库。</div>
            </div>
            <Toggle checked={config.enabled} onChange={(enabled) => setConfig({ ...config, enabled })} />
          </div>
          <div className="md:col-span-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">密码 / Token</span>
              <div className="flex gap-2">
                <input
                  className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-white px-3 text-sm outline-none transition duration-200 focus:border-primary focus:ring-4 focus:ring-primary/10"
                  type={secretVisible ? 'text' : 'password'}
                  value={config.password}
                  onChange={(event) => setConfig({ ...config, password: event.target.value })}
                  placeholder="用于 RayFlow 推送作业镜像"
                />
                <Button type="button" variant="ghost" className="h-9 w-9 p-0" onClick={() => setSecretVisible((visible) => !visible)} aria-label="切换密钥可见性">
                  {secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </label>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
