import type {
  FlinkJarResourceRequest,
  FlinkRuntimeRequest,
  FlinkRuntimeResponse,
  FlussClusterRequest,
  FlussTopicRequest,
  PaimonCatalogRequest,
  PaimonCatalogResponse,
  StarRocksConnectionRequest,
} from '@/shared/api/generated';

export type ConnectionTab = 'paimon' | 'fluss' | 'starrocks' | 'flink' | 'flink-jars';

export type PaimonCatalogFormState = Omit<PaimonCatalogRequest, 'options'> & {
  advancedOptions: string;
  s3AccessKey: string;
  s3Endpoint: string;
  s3PathStyleAccess: string;
  s3SecretKey: string;
};

export const emptyFlinkRuntimeForm: FlinkRuntimeRequest = {
  address: '',
  clusterName: '',
  clusterType: 'standalone',
  deploymentMode: 'session',
  gatewayAddress: '',
  imagePullPolicy: 'IfNotPresent',
  serviceExposureType: 'CLUSTER_IP',
  status: 'UNREACHABLE',
};

export const emptyFlinkJarForm: FlinkJarResourceRequest = {
  compatibleFlinkVersion: '2.x',
  resourceName: '',
  resourceVersion: '1.0.0',
  status: 'ACTIVE',
  storageUri: '',
};

export const emptyFlussClusterForm: FlussClusterRequest = {
  bootstrapServers: '',
  clusterName: '',
  defaultDatabase: 'default',
  description: '',
  status: 'ACTIVE',
};

export const emptyPaimonForm: PaimonCatalogFormState = {
  advancedOptions: '',
  catalogName: '',
  description: '',
  metastoreType: 'filesystem',
  s3AccessKey: '',
  s3Endpoint: '',
  s3PathStyleAccess: 'true',
  s3SecretKey: '',
  status: 'ACTIVE',
  warehouse: '',
};

export const emptyStarRocksForm: StarRocksConnectionRequest = {
  connectionName: '',
  defaultDatabase: 'scm',
  feAddress: '',
  password: '',
  queryPort: 9030,
  status: 'ACTIVE',
  username: '',
};

export function parseJsonObject(value?: string) {
  if (!value?.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function getPaimonEndpoint(options?: string) {
  const parsedOptions = parseJsonObject(options);
  const endpoint = parsedOptions['s3.endpoint'] ?? parsedOptions['fs.s3a.endpoint'];
  return typeof endpoint === 'string' && endpoint.trim() ? endpoint.trim() : undefined;
}

export function getStringOption(options: Record<string, unknown>, key: string) {
  const value = options[key];
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
}

export function setStringOption(options: Record<string, unknown>, key: string, value: string) {
  if (value.trim()) {
    options[key] = value.trim();
  } else {
    delete options[key];
  }
}

export function connectionStatusLabel(status?: string) {
  if (status === 'ACTIVE' || status === 'RUNNING') return '健康';
  if (status === 'INACTIVE' || status === 'STOPPED') return '停用';
  if (status === 'UNREACHABLE') return '不可用';
  if (status === 'UNTESTED') return '未测试';
  return status || '未知';
}

export function extractVersionFromImageTag(image: string | undefined): string | null {
  if (!image?.trim()) return null;
  const colonIndex = image.lastIndexOf(':');
  if (colonIndex === -1 || colonIndex >= image.length - 1) return null;
  const tag = image.substring(colonIndex + 1);
  const match = /^(\d+\.\d+(?:\.\d+)?)/.exec(tag);
  return match ? match[1] : null;
}

export function normalizeFlinkRuntimeForm(form: FlinkRuntimeRequest, existing?: FlinkRuntimeResponse): FlinkRuntimeRequest {
  const clusterType = form.clusterType === 'kubernetes' ? 'kubernetes' : 'standalone';
  const deploymentMode = clusterType === 'kubernetes'
    ? form.deploymentMode || 'application'
    : 'session';
  const defaultParallelism = Number(form.defaultParallelism);
  const isK8sApp = clusterType === 'kubernetes' && deploymentMode === 'application';
  const base: FlinkRuntimeRequest = {
    address: isK8sApp ? undefined : form.address?.trim() || undefined,
    checkpointDir: form.checkpointDir?.trim() || undefined,
    clusterName: form.clusterName.trim(),
    clusterType,
    defaultParallelism: Number.isFinite(defaultParallelism) && defaultParallelism > 0 ? defaultParallelism : undefined,
    deploymentMode,
    description: form.description?.trim() || undefined,
    flinkVersion: isK8sApp
      ? (extractVersionFromImageTag(form.image) || '2.2.1')
      : existing?.flinkVersion,
    gatewayAddress: isK8sApp ? undefined : form.gatewayAddress?.trim() || undefined,
    savepointDir: form.savepointDir?.trim() || undefined,
    status: existing?.status || 'UNREACHABLE',
  };
  if (clusterType === 'kubernetes') {
    return {
      ...base,
      image: form.image?.trim() || undefined,
      imagePullPolicy: form.imagePullPolicy || 'IfNotPresent',
      kubeConfigRef: form.kubeConfigRef?.trim() || undefined,
      namespaceName: form.namespaceName?.trim() || undefined,
      podTemplate: form.podTemplate?.trim() || undefined,
      serviceExposureType: form.serviceExposureType || 'CLUSTER_IP',
      serviceAccount: form.serviceAccount?.trim() || undefined,
    };
  }
  return base;
}

export function formFromFlinkRuntime(runtime?: FlinkRuntimeResponse | null): FlinkRuntimeRequest {
  if (!runtime) return emptyFlinkRuntimeForm;
  return {
    address: runtime.address ?? '',
    checkpointDir: runtime.checkpointDir ?? '',
    clusterName: runtime.clusterName ?? '',
    clusterType: runtime.clusterType ?? 'standalone',
    defaultParallelism: runtime.defaultParallelism,
    deploymentMode: runtime.deploymentMode ?? 'session',
    description: runtime.description ?? '',
    gatewayAddress: runtime.gatewayAddress ?? '',
    image: runtime.image ?? '',
    imagePullPolicy: runtime.imagePullPolicy ?? 'IfNotPresent',
    kubeConfigRef: runtime.kubeConfigRef ?? '',
    namespaceName: runtime.namespaceName ?? '',
    podTemplate: runtime.podTemplate ?? '',
    savepointDir: runtime.savepointDir ?? '',
    serviceExposureType: runtime.serviceExposureType ?? 'CLUSTER_IP',
    serviceAccount: runtime.serviceAccount ?? '',
    status: runtime.status ?? 'UNREACHABLE',
  };
}

export function normalizeFlinkJarForm(form: FlinkJarResourceRequest): FlinkJarResourceRequest {
  return {
    checksum: form.checksum?.trim() || undefined,
    compatibleFlinkVersion: form.compatibleFlinkVersion?.trim() || '2.x',
    resourceName: form.resourceName.trim(),
    resourceVersion: form.resourceVersion?.trim() || '1.0.0',
    status: form.status || 'ACTIVE',
    storageUri: form.storageUri.trim(),
  };
}

export function inferJarResourceName(filename?: string) {
  return (filename ?? '')
    .replace(/\.jar$/i, '')
    .replace(/[-_.]v?\d+(?:\.\d+){1,3}(?:[-_.]?(?:SNAPSHOT|RELEASE|FINAL|RC\d*|BETA\d*|ALPHA\d*))?$/i, '');
}

export function inferJarResourceVersion(filename?: string) {
  const match = (filename ?? '').replace(/\.jar$/i, '').match(/[-_.](v?\d+(?:\.\d+){1,3}(?:[-_.]?(?:SNAPSHOT|RELEASE|FINAL|RC\d*|BETA\d*|ALPHA\d*))?)$/i);
  if (!match?.[1]) return '1.0.0';
  return match[1].replace(/^v/i, '');
}

export function normalizeFlussClusterForm(form: FlussClusterRequest): FlussClusterRequest {
  return {
    bootstrapServers: form.bootstrapServers.trim(),
    clusterName: form.clusterName.trim(),
    defaultDatabase: form.defaultDatabase?.trim() || 'default',
    description: form.description?.trim() || undefined,
    status: form.status || 'ACTIVE',
  };
}

export function emptyFlussTopicForm(clusterId: number): FlussTopicRequest {
  return {
    bucketCount: 1,
    clusterId,
    description: '',
    namespaceName: 'default',
    replicationFactor: 1,
    status: 'CREATED',
    topicName: '',
  };
}

export function normalizeFlussTopicForm(form: FlussTopicRequest): FlussTopicRequest {
  return {
    bucketCount: Number(form.bucketCount) || 1,
    clusterId: Number(form.clusterId),
    description: form.description?.trim() || undefined,
    namespaceName: form.namespaceName?.trim() || 'default',
    replicationFactor: Number(form.replicationFactor) || 1,
    status: form.status || 'CREATED',
    topicName: form.topicName.trim(),
  };
}

export function toPaimonForm(catalog: PaimonCatalogResponse): PaimonCatalogFormState {
  const options = parseJsonObject(catalog.options);
  const s3Endpoint = getStringOption(options, 's3.endpoint') || getStringOption(options, 'fs.s3a.endpoint');
  return {
    advancedOptions: catalog.options ?? '',
    catalogName: catalog.catalogName ?? '',
    description: catalog.description ?? '',
    metastoreType: catalog.metastoreType ?? 'filesystem',
    s3AccessKey: getStringOption(options, 's3.access-key') || getStringOption(options, 'fs.s3a.access.key'),
    s3Endpoint,
    s3PathStyleAccess: getStringOption(options, 's3.path.style.access') || 'true',
    s3SecretKey: getStringOption(options, 's3.secret-key') || getStringOption(options, 'fs.s3a.secret.key'),
    status: catalog.status ?? 'ACTIVE',
    warehouse: catalog.warehouse ?? '',
  };
}

export function normalizePaimonForm(form: PaimonCatalogFormState): PaimonCatalogRequest {
  const options = parseJsonObject(form.advancedOptions);
  setStringOption(options, 's3.endpoint', form.s3Endpoint);
  setStringOption(options, 's3.access-key', form.s3AccessKey);
  setStringOption(options, 's3.secret-key', form.s3SecretKey);
  setStringOption(options, 's3.path.style.access', form.s3PathStyleAccess);
  return {
    catalogName: form.catalogName.trim(),
    description: form.description?.trim() || undefined,
    metastoreType: form.metastoreType || 'filesystem',
    options: Object.keys(options).length > 0 ? JSON.stringify(options, null, 2) : undefined,
    status: form.status || 'ACTIVE',
    warehouse: form.warehouse.trim(),
  };
}

export function normalizeStarRocksForm(form: StarRocksConnectionRequest): StarRocksConnectionRequest {
  return {
    connectionName: form.connectionName.trim(),
    defaultDatabase: form.defaultDatabase?.trim() || 'scm',
    description: form.description?.trim() || undefined,
    feAddress: form.feAddress.trim(),
    password: form.password?.trim() || undefined,
    queryPort: Number(form.queryPort) || 9030,
    status: form.status || 'ACTIVE',
    username: form.username.trim(),
  };
}
