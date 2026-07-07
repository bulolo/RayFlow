export type Variable = {
  id: string;
  name: string;
  value: string;
  description?: string;
};

const PLACEHOLDER_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_-]*)\}/g;

export function extractSqlPlaceholders(sql?: string): string[] {
  if (!sql) return [];
  const names = new Set<string>();
  for (const match of sql.matchAll(PLACEHOLDER_PATTERN)) {
    const name = match[1]?.trim();
    if (name) names.add(name);
  }
  return Array.from(names);
}

export function buildVariableMap(variables: Variable[]): Map<string, string> {
  return new Map(variables.map((item) => [item.name, item.value]));
}

export function renderSqlWithVariables(
  sql: string,
  variables: Variable[],
): { renderedSql: string; unresolved: string[] } {
  const variableMap = buildVariableMap(variables);
  const unresolved = new Set<string>();

  const renderedSql = sql.replace(PLACEHOLDER_PATTERN, (_, rawName: string) => {
    const name = rawName.trim();
    if (!variableMap.has(name)) {
      unresolved.add(name);
      return `\${${name}}`;
    }
    return variableMap.get(name) ?? '';
  });

  return {
    renderedSql,
    unresolved: Array.from(unresolved),
  };
}

export function normalizeVariableName(value: string): string {
  return value.trim().replace(/\s+/g, '_');
}
