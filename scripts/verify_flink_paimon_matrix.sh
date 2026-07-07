#!/usr/bin/env bash
set -euo pipefail

MAVEN_BASE_URLS="${MAVEN_BASE_URLS:-https://maven.aliyun.com/repository/public https://repo.maven.apache.org/maven2 https://repo1.maven.org/maven2}"
FLINK_MINORS="${FLINK_MINORS:-2.0 2.1 2.2}"
DOWNLOAD="${DOWNLOAD:-0}"
TMP_DIR="${TMP_DIR:-}"
CHECKED_SHARED_ARTIFACTS=""

if [[ "$DOWNLOAD" == "1" && -z "$TMP_DIR" ]]; then
  if ! command -v jar >/dev/null 2>&1; then
    echo "下载校验模式需要 jar 命令，请先安装 JDK。" >&2
    exit 1
  fi
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT
fi

fetch_metadata() {
  local path="$1"
  local base_url

  for base_url in $MAVEN_BASE_URLS; do
    if curl -fsSL --retry 3 --retry-all-errors --retry-delay 1 --connect-timeout 10 "${base_url%/}/${path#/}/maven-metadata.xml"; then
      return 0
    fi
  done

  return 1
}

extract_versions() {
  sed -n 's|.*<version>\([^<]*\)</version>.*|\1|p'
}

artifact_exists() {
  local path="$1"
  local base_url

  for base_url in $MAVEN_BASE_URLS; do
    if curl -fsIL --retry 3 --retry-all-errors --retry-delay 1 --connect-timeout 10 "${base_url%/}/${path#/}" >/dev/null; then
      return 0
    fi
  done

  return 1
}

download_and_validate() {
  local path="$1"
  local target="$TMP_DIR/$(basename "$path")"
  local base_url

  for base_url in $MAVEN_BASE_URLS; do
    if curl -fsSL --retry 3 --retry-all-errors --retry-delay 1 --connect-timeout 10 -o "$target" "${base_url%/}/${path#/}"; then
      jar tf "$target" >/dev/null
      return 0
    fi
    rm -f "$target"
  done

  return 1
}

check_artifact() {
  local label="$1"
  local path="$2"

  if [[ "$DOWNLOAD" == "1" ]]; then
    download_and_validate "$path"
  else
    artifact_exists "$path"
  fi
  echo "  - 通过: $label"
}

check_shared_artifact_once() {
  local label="$1"
  local path="$2"

  case " $CHECKED_SHARED_ARTIFACTS " in
    *" $path "*) return 0 ;;
  esac

  check_artifact "$label" "$path"
  CHECKED_SHARED_ARTIFACTS="$CHECKED_SHARED_ARTIFACTS $path"
}

latest_kafka_version_for_flink_minor() {
  local kafka_metadata="$1"
  local flink_minor="$2"

  printf '%s\n' "$kafka_metadata" \
    | extract_versions \
    | grep -- "-${flink_minor}$" \
    | tail -n 1
}

echo "🔎 [Flink/Paimon] 校验 Flink 2.x + Paimon 1.x 可用矩阵"
echo "  - 模式: $([[ "$DOWNLOAD" == "1" ]] && echo 下载校验 || echo 元数据校验)"

kafka_metadata="$(fetch_metadata "org/apache/flink/flink-sql-connector-kafka")"

for flink_minor in $FLINK_MINORS; do
  paimon_artifact="paimon-flink-${flink_minor}"
  paimon_metadata="$(fetch_metadata "org/apache/paimon/${paimon_artifact}")"
  kafka_version="$(latest_kafka_version_for_flink_minor "$kafka_metadata" "$flink_minor" || true)"

  echo "== Flink ${flink_minor}"

  if [[ -n "$kafka_version" ]]; then
    check_artifact \
      "flink-sql-connector-kafka-${kafka_version}.jar" \
      "org/apache/flink/flink-sql-connector-kafka/${kafka_version}/flink-sql-connector-kafka-${kafka_version}.jar"
  else
    echo "  - 跳过: Flink ${flink_minor} 未发现 Kafka SQL Connector"
  fi

  paimon_versions="$(printf '%s\n' "$paimon_metadata" | extract_versions | grep '^1\.')"
  while IFS= read -r paimon_version; do
    [[ -n "$paimon_version" ]] || continue
    check_artifact \
      "${paimon_artifact}-${paimon_version}.jar" \
      "org/apache/paimon/${paimon_artifact}/${paimon_version}/${paimon_artifact}-${paimon_version}.jar"
    check_shared_artifact_once \
      "paimon-flink-action-${paimon_version}.jar" \
      "org/apache/paimon/paimon-flink-action/${paimon_version}/paimon-flink-action-${paimon_version}.jar"
    check_shared_artifact_once \
      "paimon-s3-${paimon_version}.jar" \
      "org/apache/paimon/paimon-s3/${paimon_version}/paimon-s3-${paimon_version}.jar"
  done <<< "$paimon_versions"
done

echo "✅ [Flink/Paimon] 矩阵校验通过"
