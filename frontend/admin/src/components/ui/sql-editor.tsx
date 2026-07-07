'use client';

import { useMemo } from 'react';
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
import { linter, type Diagnostic } from '@codemirror/lint';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';

export type SqlSchemaMap = Record<string, string[]>;

export type SqlValidationDiagnostic = {
  column?: number;
  line?: number;
  message: string;
};

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

export function buildSqlDiagnostics(
  content: string,
  unresolvedPlaceholders: string[],
  validationDiagnostic?: SqlValidationDiagnostic | null,
): Diagnostic[] {
  return [
    ...findUndefinedVariableDiagnostics(content, unresolvedPlaceholders),
    ...findServerValidationDiagnostics(content, validationDiagnostic),
  ];
}

function findUndefinedVariableDiagnostics(content: string, unresolvedPlaceholders: string[]): Diagnostic[] {
  if (unresolvedPlaceholders.length === 0) return [];

  const diagnostics: Diagnostic[] = [];
  for (const placeholder of unresolvedPlaceholders) {
    const token = `\${${placeholder}}`;
    const index = content.indexOf(token);
    if (index >= 0) {
      diagnostics.push({
        from: index,
        to: index + token.length,
        severity: 'warning',
        message: `未定义变量 ${token}`,
      });
    }
  }
  return diagnostics;
}

function findServerValidationDiagnostics(
  content: string,
  validationDiagnostic?: SqlValidationDiagnostic | null,
): Diagnostic[] {
  if (!validationDiagnostic?.message) return [];
  const position = lineColumnToOffset(content, validationDiagnostic.line ?? 1, validationDiagnostic.column ?? 1);
  return [
    {
      from: position,
      to: Math.min(position + 1, content.length),
      severity: 'error',
      message: validationDiagnostic.message,
    },
  ];
}

function lineColumnToOffset(content: string, line: number, column: number): number {
  const safeLine = Math.max(line, 1);
  const safeColumn = Math.max(column, 1);
  const lines = content.split('\n');
  let offset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (index === safeLine - 1) {
      return Math.min(offset + safeColumn - 1, content.length);
    }
    offset += lines[index].length + 1;
  }
  return 0;
}

export interface SqlCodeEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSubmit?: () => void;
  placeholders?: string[];
  placeholder?: string;
  sqlSchema?: SqlSchemaMap;
  submitDisabled?: boolean;
  unresolvedPlaceholders?: string[];
  validationDiagnostic?: SqlValidationDiagnostic | null;
}

export function SqlCodeEditor({
  content,
  onChange,
  onSubmit,
  placeholders = [],
  placeholder = '-- 编写 SQL',
  sqlSchema = {},
  submitDisabled = false,
  unresolvedPlaceholders = [],
  validationDiagnostic,
}: SqlCodeEditorProps) {
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
    const placeholderOptions = placeholders.map((placeholderName) => ({
      label: `\${${placeholderName}}`,
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
              validFor: /^(?:\$\{)?[\w$]*$/,
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
          key: 'Mod-Enter',
          run: () => {
            if (!submitDisabled) onSubmit?.();
            return true;
          },
        },
      ]),
    ],
    [completionOptions, content, onSubmit, sqlSchema, submitDisabled, unresolvedPlaceholders, validationDiagnostic],
  );

  return (
    <div className="h-full min-h-0 overflow-hidden bg-zinc-950 font-mono">
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
        placeholder={placeholder}
        onChange={(value) => onChange(value)}
      />
    </div>
  );
}
