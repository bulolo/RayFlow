import type { FlinkJobResponse, FlinkJobRequest } from '@/shared/api/generated';
import { format as formatWithSqlFormatter } from 'sql-formatter';

export const SQL_PREVIEW_LIMIT = 50;
const PLACEHOLDER_PATTERN = /\$\{[A-Za-z_][A-Za-z0-9_-]*\}/;

export const defaultSql = `CREATE TEMPORARY TABLE demo_source (
  id BIGINT,
  name STRING
) WITH (
  'connector' = 'datagen',
  'rows-per-second' = '1',
  'fields.id.kind' = 'sequence',
  'fields.id.start' = '1',
  'fields.id.end' = '1000000',
  'fields.name.length' = '8'
);

SELECT id, name
FROM demo_source;`;

export type SqlSchemaMap = Record<string, string[]>;

export const emptyJobForm = (firstClusterId?: number): FlinkJobRequest => ({
  jobName: '',
  jobGroup: '',
  jobType: 'SQL',
  runtimeMode: 'STREAMING',
  submitType: 'REST',
  executionMode: 'standalone',
  clusterId: firstClusterId,
  content: '',
  mainClass: '',
  args: '',
  flinkConfig: '{}',
  parallelism: 1,
  description: '',
  jobTags: '',
  docUrl: '',
  savepointPath: '',
  applicationImage: '',
  jarUri: '',
  dependencyRefs: '',
});

export function formatSql(sql: string): string {
  const normalized = sql.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';
  if (PLACEHOLDER_PATTERN.test(normalized)) return normalized;
  try {
    return formatWithSqlFormatter(normalized, {
      language: 'sql',
      keywordCase: 'upper',
      linesBetweenQueries: 2,
      tabWidth: 2,
    });
  } catch {
    return normalized;
  }
}

export function extractSqlSchema(sql: string): SqlSchemaMap {
  const schema: SqlSchemaMap = {};
  const tableRegex = /CREATE\s+(?:TEMPORARY\s+)?TABLE\s+([a-zA-Z_][\w.]*)\s*\(([\s\S]*?)\)\s*WITH/gi;

  for (const match of sql.matchAll(tableRegex)) {
    const tableName = match[1]?.split('.').pop()?.trim();
    const block = match[2] ?? '';
    if (!tableName) continue;

    const columns = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('--') && !line.startsWith('#'))
      .map((line) => line.replace(/,$/, ''))
      .map((line) => line.match(/^`?([a-zA-Z_][\w]*)`?\s+/)?.[1] ?? null)
      .filter((value): value is string => Boolean(value));

    schema[tableName] = Array.from(new Set(columns));
  }

  return schema;
}

export function formFromJob(job: FlinkJobResponse | null, firstClusterId?: number): FlinkJobRequest {
  if (!job) return emptyJobForm(firstClusterId);

  return {
    jobName: job.jobName ?? '',
    jobGroup: (job as FlinkJobResponse & { jobGroup?: string }).jobGroup ?? '',
    jobType: job.jobType ?? 'SQL',
    runtimeMode: job.runtimeMode ?? 'STREAMING',
    submitType: job.submitType ?? 'REST',
    executionMode: job.executionMode ?? 'standalone',
    clusterId: job.clusterId ?? firstClusterId,
    content: job.content ?? '',
    mainClass: job.mainClass ?? '',
    args: job.args ?? '',
    flinkConfig: job.flinkConfig ?? '{}',
    parallelism: job.parallelism ?? 1,
    description: job.description ?? '',
    jobTags: job.jobTags ?? '',
    docUrl: job.docUrl ?? '',
    savepointPath: job.savepointPath ?? '',
    applicationImage: job.applicationImage ?? '',
    jarUri: job.jarUri ?? '',
    dependencyRefs: job.dependencyRefs ?? '',
  };
}
