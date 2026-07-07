#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_DIR="$ROOT_DIR/backend/rayflow-server/src/main/resources/db/migration"
INIT_DB="$ROOT_DIR/scripts/init-db.sql"
INIT_TEST="$ROOT_DIR/scripts/init-test.sql"
TMP_VERSIONS="$(mktemp)"
trap 'rm -f "$TMP_VERSIONS"' EXIT

has_forbidden_ddl() {
  local file="$1"
  local pattern='^[[:space:]]*(CREATE|ALTER|DROP)[[:space:]]+(TABLE|INDEX)|^[[:space:]]*ALTER[[:space:]]+TABLE[[:space:]]+.*[[:space:]]+(ADD|DROP)[[:space:]]+COLUMN'
  local content

  if command -v rg >/dev/null 2>&1; then
    content="$(strip_dollar_quoted_blocks "$file")"
    rg -n -i "$pattern" - <<< "$content" >/dev/null
    return $?
  fi

  content="$(strip_dollar_quoted_blocks "$file")"
  grep -Eni "$pattern" <<< "$content" >/dev/null
}

strip_dollar_quoted_blocks() {
  local file="$1"

  awk '
    {
      line = $0
      while (line != "") {
        if (in_quote) {
          end_pos = index(line, end_token)
          if (end_pos > 0) {
            line = substr(line, end_pos + length(end_token))
            in_quote = 0
          } else {
            line = ""
          }
        } else if (match(line, /\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$/)) {
          print substr(line, 1, RSTART - 1)
          end_token = substr(line, RSTART, RLENGTH)
          line = substr(line, RSTART + RLENGTH)
          in_quote = 1
        } else {
          print line
          line = ""
        }
      }
    }
  ' "$file"
}

echo "[Migration] Checking database migration rules..."

if has_forbidden_ddl "$INIT_DB"; then
  echo "[ERROR] scripts/init-db.sql must not contain executable DDL."
  exit 1
fi

if has_forbidden_ddl "$INIT_TEST"; then
  echo "[ERROR] scripts/init-test.sql is seed-only and must not contain DDL."
  exit 1
fi

if [[ ! -d "$MIGRATION_DIR" ]]; then
  echo "[ERROR] migration directory does not exist: $MIGRATION_DIR"
  exit 1
fi

while IFS= read -r file; do
  base="$(basename "$file")"
  if [[ "$base" =~ ^V([0-9]+\.[0-9]+\.[0-9]+)__[a-z0-9_]+\.sql$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}" >> "$TMP_VERSIONS"
    continue
  fi

  if [[ "$base" =~ ^R__[a-z0-9_]+\.sql$ ]]; then
    continue
  fi

  echo "[ERROR] Invalid migration file name: $base"
  echo "[HINT] Allowed formats: V0.0.4__add_xxx.sql or R__refresh_xxx.sql"
  exit 1
done < <(find "$MIGRATION_DIR" -maxdepth 1 -type f -name '*.sql' | sort)

if [[ -s "$TMP_VERSIONS" ]]; then
  duplicates="$(sort "$TMP_VERSIONS" | uniq -d)"
  if [[ -n "$duplicates" ]]; then
    echo "[ERROR] Duplicate migration versions detected:"
    printf '%s\n' "$duplicates"
    exit 1
  fi
fi

echo "[Migration] Database migration rules passed"
