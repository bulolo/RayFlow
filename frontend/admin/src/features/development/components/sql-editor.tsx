'use client';

import { useMemo } from 'react';
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
import { linter } from '@codemirror/lint';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { BookOpen, Bug, FileCheck2, FileCode2, Rocket, Save, Search, Square, Wand2 } from 'lucide-react';
import { Tooltip } from '@/components/ui';
import type { SqlSchemaMap } from '@/features/development/lib/job-forms';
import { buildSqlDiagnostics, type SqlValidationDiagnostic } from '@/features/development/lib/sql-editor-diagnostics';
import { EditorToolButton, getJobStatusMeta } from '@/features/development/components/job-editor-shared';

const SQL_KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'INSERT INTO',
  'CREATE TABLE',
  'CREATE TEMPORARY TABLE',
  'ALTER TABLE',
  'DROP TABLE',
  'WITH',
  'VALUES',
  'JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'FULL JOIN',
  'ON',
  'UNION',
  'UNION ALL',
  'LIMIT',
  'OFFSET',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'AS',
  'AND',
  'OR',
  'NOT',
  'NULL',
  'SET',
];

interface SqlEditorProps {
  cancelDisabled: boolean;
  content: string;
  jobDescription?: string;
  jobName: string;
  onCancel: () => void;
  onChange: (content: string) => void;
  onFormat: () => void;
  onPublish: () => void;
  onQuery: () => void;
  onRun: () => void;
  onSave: () => void;
  onValidate: () => void;
  placeholders?: string[];
  publishDisabled: boolean;
  queryDisabled: boolean;
  runDisabled: boolean;
  saveDisabled: boolean;
  sqlSchema?: SqlSchemaMap;
  validateDisabled: boolean;
  validating: boolean;
  validationDiagnostic?: SqlValidationDiagnostic | null;
  status?: string;
  unresolvedPlaceholders?: string[];
  docUrl?: string;
}


export function SqlEditor({
  cancelDisabled,
  content,
  jobDescription,
  jobName,
  onCancel,
  onChange,
  onFormat,
  onPublish,
  onQuery,
  onRun,
  onSave,
  onValidate,
  placeholders = [],
  publishDisabled,
  queryDisabled,
  runDisabled,
  saveDisabled,
  sqlSchema = {},
  validateDisabled,
  validating,
  validationDiagnostic,
  status,
  unresolvedPlaceholders = [],
  docUrl,
}: SqlEditorProps) {
  const statusMeta = getJobStatusMeta(status);
  const lineCount = useMemo(() => Math.max(content.split('\n').length, 1), [content]);
  const completionOptions = useMemo(() => {
    const keywordOptions = SQL_KEYWORDS.map((keyword) => ({
      label: keyword,
      type: 'keyword' as const,
      apply: keyword,
    }));
    const tableOptions = Object.keys(sqlSchema).map((tableName) => ({
      label: tableName,
      type: 'class' as const,
      detail: 'table',
    }));
    const columnOptions = Array.from(new Set(Object.values(sqlSchema).flat())).map((columnName) => ({
      label: columnName,
      type: 'property' as const,
      detail: 'column',
    }));
    const placeholderOptions = placeholders.map((placeholder) => ({
      label: `\${${placeholder}}`,
      type: 'variable' as const,
      detail: 'variable',
    }));

    return [...keywordOptions, ...tableOptions, ...columnOptions, ...placeholderOptions];
  }, [placeholders, sqlSchema]);

  const editorExtensions = useMemo(
    () => [
      sql({ schema: sqlSchema, upperCaseKeywords: true }),
      oneDark,
      EditorView.lineWrapping,
      linter(() => buildSqlDiagnostics(content, unresolvedPlaceholders, validationDiagnostic)),
      autocompletion({
        override: [
          (context: CompletionContext) => {
            const word = context.matchBefore(/(?:\$\{)?[\w$]*/);
            if (!word || (word.from === word.to && !context.explicit)) return null;
            return {
              from: word.from,
              options: completionOptions,
            };
          },
        ],
      }),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '12px',
          backgroundColor: '#0f172a',
        },
        '.cm-editor': {
          height: '100%',
        },
        '.cm-scroller': {
          height: '100%',
          overflow: 'auto',
          fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
          lineHeight: '1.6',
        },
        '.cm-content, .cm-gutter': {
          minHeight: '100%',
        },
        '.cm-gutters': {
          backgroundColor: '#f1f5f9',
          color: '#475569',
          borderRight: '1px solid #cbd5e1',
        },
        '.cm-gutter-element': {
          color: '#475569 !important',
        },
        '.cm-activeLine': {
          backgroundColor: 'rgba(248, 250, 252, 0.08) !important',
          boxShadow: 'inset 0 0 0 1px rgba(148, 163, 184, 0.12)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: '#e2e8f0 !important',
          color: '#334155 !important',
        },
        '.cm-focused .cm-activeLine': {
          backgroundColor: 'rgba(255, 255, 255, 0.12) !important',
        },
        '.cm-focused .cm-activeLineGutter': {
          backgroundColor: '#dbeafe !important',
          color: '#1e3a8a !important',
        },
        '.cm-selectionBackground, .cm-content ::selection': {
          backgroundColor: 'rgba(59, 130, 246, 0.28) !important',
        },
      }),
      keymap.of([
        {
          key: 'Mod-s',
          run: () => {
            if (!saveDisabled) onSave();
            return true;
          },
        },
        {
          key: 'Mod-Enter',
          run: () => {
            if (!queryDisabled) onQuery();
            return true;
          },
        },
      ]),
    ],
    [completionOptions, content, onQuery, onSave, queryDisabled, saveDisabled, sqlSchema, unresolvedPlaceholders, validationDiagnostic],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex min-h-[44px] shrink-0 items-center justify-between border-b border-slate-100 bg-zinc-50/50 px-4 py-1.5 font-sans">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-primary/10 bg-primary/5">
            <FileCode2 className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="shrink-0 rounded-md border border-primary/20 bg-gradient-to-r from-primary/5 to-indigo-50/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
            SQL
          </span>
          <div className="min-w-0 flex flex-1 items-center gap-2">
            <Tooltip content={jobName}>
              <span className="min-w-0 shrink-0 truncate text-[13px] font-semibold leading-5 text-slate-900">{jobName}</span>
            </Tooltip>
            {jobDescription ? (
              <>
                <span className="shrink-0 text-slate-300">/</span>
                <Tooltip content={jobDescription} className="min-w-0 flex-1">
                  <span className="min-w-0 flex-1 truncate text-[11px] leading-4 text-slate-500">{jobDescription}</span>
                </Tooltip>
              </>
            ) : (
              <span className="min-w-0 flex-1 truncate text-[11px] leading-4 text-slate-400">暂无描述</span>
            )}
            {statusMeta ? (
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-bold ${statusMeta.badgeClass}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status === 'RUNNING' ? 'animate-pulse' : ''} ${statusMeta.dotClass}`} />
                {statusMeta.label}
              </span>
            ) : null}
            {docUrl ? (
              <Tooltip content="查看作业文档">
                <button
                  type="button"
                  onClick={() => window.open(docUrl, '_blank')}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-primary/20 bg-primary/5 text-primary transition hover:bg-primary/10"
                >
                  <BookOpen className="h-3 w-3" />
                </button>
              </Tooltip>
            ) : (
              <Tooltip content="暂无作业文档链接，可在右侧配置关联">
                <span className="flex h-5 w-5 shrink-0 cursor-not-allowed items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-400">
                  <BookOpen className="h-3 w-3" />
                </span>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-h-[38px] shrink-0 items-center justify-between gap-3 border-b border-border bg-slate-50/50 px-3 py-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <EditorToolButton
            onClick={onSave}
            disabled={saveDisabled}
            className="flex h-7 w-7 items-center justify-center p-0 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
            tooltip="保存 (Ctrl+S)"
          >
            <Save className="h-4 w-4" />
          </EditorToolButton>
          <EditorToolButton
            onClick={onPublish}
            disabled={publishDisabled}
            className="flex h-7 w-7 items-center justify-center p-0 text-violet-600 transition-all hover:bg-violet-50 hover:text-violet-700 disabled:opacity-30"
            tooltip="发布最新版本"
          >
            <Rocket className="h-4 w-4" />
          </EditorToolButton>
          <EditorToolButton
            onClick={onFormat}
            className="flex h-7 w-7 items-center justify-center p-0 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900"
            tooltip="格式化 SQL"
          >
            <Wand2 className="h-4 w-4 text-primary" />
          </EditorToolButton>
          <EditorToolButton
            onClick={onValidate}
            disabled={validateDisabled}
            className="flex h-7 w-7 items-center justify-center p-0 text-cyan-600 transition-all hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-30"
            tooltip="校验 SQL"
          >
            <FileCheck2 className={`h-4 w-4 ${validating ? 'animate-pulse' : ''}`} />
          </EditorToolButton>
          <div className="mx-1 h-3 w-px bg-slate-200" />
          <EditorToolButton
            onClick={onQuery}
            disabled={queryDisabled}
            className="flex h-7 w-7 items-center justify-center p-0 text-blue-500 transition-all hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30"
            tooltip="调试预览 (Ctrl+Enter)"
          >
            <Search className="h-4 w-4" />
          </EditorToolButton>
          {status === 'RUNNING' ? (
            <EditorToolButton
              onClick={onCancel}
              disabled={cancelDisabled}
              className="flex h-7 w-7 items-center justify-center p-0 text-rose-500 transition-all hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
              tooltip="停止运行"
            >
              <Square className="h-4 w-4 fill-current" />
            </EditorToolButton>
          ) : (
            <EditorToolButton
              onClick={onRun}
              disabled={runDisabled}
              className="flex h-7 w-7 items-center justify-center p-0 text-emerald-500 transition-all hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-30"
            tooltip="运行草稿"
            >
              <Bug className="h-4 w-4" />
            </EditorToolButton>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground">LINES: {lineCount}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-zinc-950 font-mono">
        <CodeMirror
          className="h-full"
          value={content}
          height="100%"
          basicSetup={{
            autocompletion: true,
            bracketMatching: true,
            closeBrackets: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            lineNumbers: true,
          }}
          extensions={editorExtensions}
          placeholder="-- 编写 Flink SQL"
          onChange={(value) => onChange(value)}
        />
      </div>
    </div>
  );
}
