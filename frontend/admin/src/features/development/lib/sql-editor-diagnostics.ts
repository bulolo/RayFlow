import type { Diagnostic } from '@codemirror/lint';

export type SqlValidationDiagnostic = {
  column?: number;
  line?: number;
  message: string;
};

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
