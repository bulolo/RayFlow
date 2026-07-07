#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_DIR="$ROOT_DIR/backend/rayflow-server/src/main/resources/db/migration"
CURRENT_BRANCH="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)"
DESCRIPTION="${1:-}"

if [[ ! "$CURRENT_BRANCH" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ 当前分支不是版本分支: $CURRENT_BRANCH"
  echo "💡 请在类似 0.0.3 的版本分支上创建 migration。"
  exit 1
fi

if [[ -z "$DESCRIPTION" ]]; then
  echo "❌ 缺少 migration 描述。"
  echo "💡 用法: make migration-new desc=add_tenant_indexes"
  exit 1
fi

SLUG="$(printf '%s' "$DESCRIPTION" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/_/g; s/^_+//; s/_+$//; s/_+/_/g')"

if [[ -z "$SLUG" ]]; then
  echo "❌ migration 描述无法转换为合法文件名。"
  exit 1
fi

mkdir -p "$MIGRATION_DIR"
TARGET_FILE="$MIGRATION_DIR/V${CURRENT_BRANCH}__${SLUG}.sql"

if [[ -e "$TARGET_FILE" ]]; then
  echo "❌ migration 已存在: $TARGET_FILE"
  exit 1
fi

cat > "$TARGET_FILE" <<EOF
-- ==============================================================================
-- RayFlow ${CURRENT_BRANCH} migration: ${SLUG}
-- 约束:
--   1. 已发布 migration 只允许新增, 禁止回写历史文件
--   2. 结构变更与大批量数据修复应拆分评估
-- ==============================================================================

-- TODO: add migration SQL here
EOF

echo "✅ 已创建 migration: ${TARGET_FILE#$ROOT_DIR/}"
