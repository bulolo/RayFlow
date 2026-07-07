#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAIMON_FLINK_MINOR_PROVIDED="${PAIMON_FLINK_MINOR+x}"
FLINK_KAFKA_CONNECTOR_VERSION_PROVIDED="${FLINK_KAFKA_CONNECTOR_VERSION+x}"
FLINK_VERSION="${FLINK_VERSION:-2.2}"
PAIMON_VERSION="${PAIMON_VERSION:-1.4.2}"
PAIMON_FLINK_MINOR="${PAIMON_FLINK_MINOR:-${FLINK_VERSION%.*}}"
FLINK_CDC_VERSION="${FLINK_CDC_VERSION:-3.5.0}"
FLINK_KAFKA_CONNECTOR_VERSION="${FLINK_KAFKA_CONNECTOR_VERSION:-5.0.0-2.2}"
MYSQL_DRIVER_VERSION="${MYSQL_DRIVER_VERSION:-8.0.27}"
FLINK_HADOOP_SHADED_VERSION="${FLINK_HADOOP_SHADED_VERSION:-2.8.3-10.0}"
FLINK_LIB_DIR="${FLINK_LIB_DIR:-deploy/docker/flink/custom-lib}"
MAVEN_BASE_URL="${MAVEN_BASE_URL:-https://repo.maven.apache.org/maven2}"
MAVEN_FALLBACK_BASE_URLS="${MAVEN_FALLBACK_BASE_URLS:-https://repo1.maven.org/maven2 https://maven.aliyun.com/repository/public}"
INSTALL_CDC="${INSTALL_CDC:-1}"
INSTALL_KAFKA="${INSTALL_KAFKA:-1}"
INSTALL_HADOOP="${INSTALL_HADOOP:-1}"
INSTALL_MYSQL_DRIVER="${INSTALL_MYSQL_DRIVER:-1}"
WRITE_ENV="${WRITE_ENV:-1}"
FORCE="${FORCE:-0}"
CLEAN_STALE="${CLEAN_STALE:-1}"
SETUP_FLINK_PAIMON_INTERACTIVE="${SETUP_FLINK_PAIMON_INTERACTIVE:-auto}"

TARGET_DIR="$ROOT_DIR/$FLINK_LIB_DIR"
RAYFLOW_LIB_DIR="$TARGET_DIR/rayflow"
ENV_FILE="$ROOT_DIR/backend/.env"
PAIMON_LIB_DIR="$RAYFLOW_LIB_DIR/paimon"
CDC_LIB_DIR="$RAYFLOW_LIB_DIR/cdc"
MESSAGING_LIB_DIR="$RAYFLOW_LIB_DIR/messaging"
JDBC_LIB_DIR="$RAYFLOW_LIB_DIR/jdbc"
FILESYSTEM_LIB_DIR="$RAYFLOW_LIB_DIR/filesystem"

fetch_maven_metadata() {
  local path="$1"
  local base_url

  for base_url in "$MAVEN_BASE_URL" $MAVEN_FALLBACK_BASE_URLS; do
    if curl -fsSL --retry 3 --retry-all-errors --retry-delay 1 --connect-timeout 10 "${base_url%/}/${path#/}/maven-metadata.xml"; then
      return 0
    fi
  done

  return 1
}

resolve_flink_version() {
  local version="$1"

  if [[ "$version" =~ ^[0-9]+\.[0-9]+$ ]]; then
    local resolved
    resolved="$(
      fetch_maven_metadata "org/apache/flink/flink-clients" \
        | sed -n 's|.*<version>\([^<]*\)</version>.*|\1|p' \
        | grep "^${version//./\\.}\\.[0-9][0-9]*$" \
        | sort -V \
        | tail -n 1
    )"
    if [[ -z "$resolved" ]]; then
      echo "无法解析 Flink $version 版本线的最新 patch 版本" >&2
      exit 1
    fi
    echo "$resolved"
    return
  fi

  echo "$version"
}

interactive_enabled() {
  [[ -t 0 && -t 1 ]] || return 1
  [[ "${CI:-}" != "true" ]] || return 1
  [[ "$SETUP_FLINK_PAIMON_INTERACTIVE" != "0" ]] || return 1
  return 0
}

prompt_value() {
  local label="$1"
  local variable_name="$2"
  local default_value="$3"
  local input_value

  printf "%s [%s]: " "$label" "$default_value" > /dev/tty
  IFS= read -r input_value < /dev/tty || input_value=""
  printf -v "$variable_name" "%s" "${input_value:-$default_value}"
}

prompt_runtime_versions() {
  interactive_enabled || return 0

  echo "🧭 [Flink/Paimon] 交互式初始化，直接回车使用默认值。"
  prompt_value "Flink 版本或版本线" FLINK_VERSION "$FLINK_VERSION"
  prompt_value "Paimon 版本" PAIMON_VERSION "$PAIMON_VERSION"
  FLINK_VERSION="$(resolve_flink_version "$FLINK_VERSION")"
  local paimon_flink_minor_default="$PAIMON_FLINK_MINOR"
  local kafka_connector_default="$FLINK_KAFKA_CONNECTOR_VERSION"
  if [[ -z "$PAIMON_FLINK_MINOR_PROVIDED" ]]; then
    paimon_flink_minor_default="${FLINK_VERSION%.*}"
  fi
  if [[ -z "$FLINK_KAFKA_CONNECTOR_VERSION_PROVIDED" ]]; then
    kafka_connector_default="5.0.0-${FLINK_VERSION%.*}"
  fi
  PAIMON_FLINK_MINOR="$paimon_flink_minor_default"
  prompt_value "Flink CDC Connector 版本" FLINK_CDC_VERSION "$FLINK_CDC_VERSION"
  prompt_value "Flink Kafka Connector 版本" FLINK_KAFKA_CONNECTOR_VERSION "$kafka_connector_default"
  prompt_value "MySQL 驱动版本" MYSQL_DRIVER_VERSION "$MYSQL_DRIVER_VERSION"
  prompt_value "Flink Shaded Hadoop 版本" FLINK_HADOOP_SHADED_VERSION "$FLINK_HADOOP_SHADED_VERSION"
  prompt_value "是否清理旧版本托管依赖？1=是，0=否" CLEAN_STALE "$CLEAN_STALE"
  prompt_value "是否强制重新下载？1=是，0=否" FORCE "$FORCE"

  TARGET_DIR="$ROOT_DIR/$FLINK_LIB_DIR"
  RAYFLOW_LIB_DIR="$TARGET_DIR/rayflow"
  PAIMON_LIB_DIR="$RAYFLOW_LIB_DIR/paimon"
  CDC_LIB_DIR="$RAYFLOW_LIB_DIR/cdc"
  MESSAGING_LIB_DIR="$RAYFLOW_LIB_DIR/messaging"
  JDBC_LIB_DIR="$RAYFLOW_LIB_DIR/jdbc"
  FILESYSTEM_LIB_DIR="$RAYFLOW_LIB_DIR/filesystem"
}

download_file() {
  local path="$1"
  local target="$2"
  local name
  name="$(basename "$target")"

  if [[ -f "$target" && "$FORCE" != "1" ]]; then
    echo "  - 已存在: $name"
    return
  fi

  echo "  - 下载: $name"
  local tmp="${target}.tmp"
  rm -f "$tmp"

  local base_url
  for base_url in "$MAVEN_BASE_URL" $MAVEN_FALLBACK_BASE_URLS; do
    local url="${base_url%/}/${path#/}"
    echo "    源: $base_url"
    if curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 15 -o "$tmp" "$url"; then
      mv "$tmp" "$target"
      return
    fi
    rm -f "$tmp"
  done

  echo "下载失败: $name，所有 Maven 仓库源均不可用" >&2
  exit 1
}

ensure_env_value() {
  local key="$1"
  local value="$2"

  [[ "$WRITE_ENV" == "1" ]] || return 0
  [[ -f "$ENV_FILE" ]] || return 0

  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

validate_jar() {
  local jar_path="$1"
  local name
  name="$(basename "$jar_path")"

  if command -v jar >/dev/null 2>&1; then
    jar tf "$jar_path" >/dev/null
  elif command -v unzip >/dev/null 2>&1; then
    unzip -tq "$jar_path" >/dev/null
  elif [[ ! -s "$jar_path" ]]; then
    echo "JAR 文件为空或不可用: $name" >&2
    exit 1
  fi
}

remove_stale_file() {
  local file_path="$1"
  local expected_path="$2"

  [[ "$file_path" != "$expected_path" ]] || return 0
  echo "  - 清理旧版本: $(basename "$file_path")"
  rm -f "$file_path"
}

clean_stale_by_name() {
  local dir="$1"
  local pattern="$2"
  local expected_path="$3"
  local file_path

  [[ -d "$dir" ]] || return 0
  while IFS= read -r file_path; do
    remove_stale_file "$file_path" "$expected_path"
  done < <(find "$dir" -maxdepth 1 -type f -name "$pattern" | sort)
}

clean_stale_managed_libs() {
  [[ "$CLEAN_STALE" == "1" ]] || return 0

  echo "🧹 [Flink/Paimon] 清理旧版本托管依赖"

  local expected_paimon_flink="$PAIMON_LIB_DIR/paimon-flink-${PAIMON_FLINK_MINOR}-${PAIMON_VERSION}.jar"
  local expected_paimon_action="$PAIMON_LIB_DIR/paimon-flink-action-${PAIMON_VERSION}.jar"
  local expected_paimon_s3="$PAIMON_LIB_DIR/paimon-s3-${PAIMON_VERSION}.jar"
  local expected_hadoop="$FILESYSTEM_LIB_DIR/flink-shaded-hadoop-2-uber-${FLINK_HADOOP_SHADED_VERSION}.jar"
  local expected_mysql_driver="$JDBC_LIB_DIR/mysql-connector-java-${MYSQL_DRIVER_VERSION}.jar"
  local expected_kafka="$MESSAGING_LIB_DIR/flink-sql-connector-kafka-${FLINK_KAFKA_CONNECTOR_VERSION}.jar"
  clean_stale_by_name "$PAIMON_LIB_DIR" "paimon-flink-[0-9]*.jar" "$expected_paimon_flink"
  clean_stale_by_name "$PAIMON_LIB_DIR" "paimon-flink-action-*.jar" "$expected_paimon_action"
  clean_stale_by_name "$PAIMON_LIB_DIR" "paimon-s3-*.jar" "$expected_paimon_s3"
  if [[ "$INSTALL_HADOOP" == "1" ]]; then
    clean_stale_by_name "$FILESYSTEM_LIB_DIR" "flink-shaded-hadoop-2-uber-*.jar" "$expected_hadoop"
  fi
  if [[ "$INSTALL_MYSQL_DRIVER" == "1" ]]; then
    clean_stale_by_name "$JDBC_LIB_DIR" "mysql-connector-java-*.jar" "$expected_mysql_driver"
  fi
  if [[ "$INSTALL_KAFKA" == "1" ]]; then
    clean_stale_by_name "$MESSAGING_LIB_DIR" "flink-sql-connector-kafka-*.jar" "$expected_kafka"
  fi

  if [[ "$INSTALL_CDC" == "1" ]]; then
    for connector in mysql postgres mongodb sqlserver; do
      local expected_cdc="$CDC_LIB_DIR/flink-sql-connector-${connector}-cdc-${FLINK_CDC_VERSION}.jar"
      clean_stale_by_name "$CDC_LIB_DIR" "flink-sql-connector-${connector}-cdc-*.jar" "$expected_cdc"
    done
  fi
}

cleanup_legacy_managed_dirs() {
  [[ "$CLEAN_STALE" == "1" ]] || return 0

  local legacy_dir
  for legacy_dir in paimon cdc messaging jdbc filesystem; do
    local legacy_path="$TARGET_DIR/$legacy_dir"
    if [[ -d "$legacy_path" ]]; then
      echo "  - 清理历史托管目录: $legacy_dir/"
      rm -rf "$legacy_path"
    fi
  done
}

prompt_runtime_versions
FLINK_VERSION="$(resolve_flink_version "$FLINK_VERSION")"
if [[ -z "$PAIMON_FLINK_MINOR_PROVIDED" ]]; then
  PAIMON_FLINK_MINOR="${FLINK_VERSION%.*}"
fi
if [[ -z "$FLINK_KAFKA_CONNECTOR_VERSION_PROVIDED" ]]; then
  FLINK_KAFKA_CONNECTOR_VERSION="5.0.0-${FLINK_VERSION%.*}"
fi

mkdir -p "$PAIMON_LIB_DIR" "$CDC_LIB_DIR" "$MESSAGING_LIB_DIR" "$JDBC_LIB_DIR" "$FILESYSTEM_LIB_DIR" "$TARGET_DIR/custom"
cleanup_legacy_managed_dirs

echo "🔧 [Flink/Paimon] 准备运行依赖"
echo "  - flink:  $FLINK_VERSION"
echo "  - paimon: $PAIMON_VERSION"
echo "  - 目录:    $FLINK_LIB_DIR"

clean_stale_managed_libs

download_file \
  "org/apache/paimon/paimon-flink-${PAIMON_FLINK_MINOR}/${PAIMON_VERSION}/paimon-flink-${PAIMON_FLINK_MINOR}-${PAIMON_VERSION}.jar" \
  "$PAIMON_LIB_DIR/paimon-flink-${PAIMON_FLINK_MINOR}-${PAIMON_VERSION}.jar"

download_file \
  "org/apache/paimon/paimon-flink-action/${PAIMON_VERSION}/paimon-flink-action-${PAIMON_VERSION}.jar" \
  "$PAIMON_LIB_DIR/paimon-flink-action-${PAIMON_VERSION}.jar"

download_file \
  "org/apache/paimon/paimon-s3/${PAIMON_VERSION}/paimon-s3-${PAIMON_VERSION}.jar" \
  "$PAIMON_LIB_DIR/paimon-s3-${PAIMON_VERSION}.jar"

if [[ "$INSTALL_HADOOP" == "1" ]]; then
  download_file \
    "org/apache/flink/flink-shaded-hadoop-2-uber/${FLINK_HADOOP_SHADED_VERSION}/flink-shaded-hadoop-2-uber-${FLINK_HADOOP_SHADED_VERSION}.jar" \
    "$FILESYSTEM_LIB_DIR/flink-shaded-hadoop-2-uber-${FLINK_HADOOP_SHADED_VERSION}.jar"
fi

if [[ "$INSTALL_MYSQL_DRIVER" == "1" ]]; then
  download_file \
    "mysql/mysql-connector-java/${MYSQL_DRIVER_VERSION}/mysql-connector-java-${MYSQL_DRIVER_VERSION}.jar" \
    "$JDBC_LIB_DIR/mysql-connector-java-${MYSQL_DRIVER_VERSION}.jar"
fi

if [[ "$INSTALL_CDC" == "1" ]]; then
  for connector in mysql postgres mongodb sqlserver; do
    download_file \
      "org/apache/flink/flink-sql-connector-${connector}-cdc/${FLINK_CDC_VERSION}/flink-sql-connector-${connector}-cdc-${FLINK_CDC_VERSION}.jar" \
      "$CDC_LIB_DIR/flink-sql-connector-${connector}-cdc-${FLINK_CDC_VERSION}.jar"
  done
fi

if [[ "$INSTALL_KAFKA" == "1" ]]; then
  download_file \
    "org/apache/flink/flink-sql-connector-kafka/${FLINK_KAFKA_CONNECTOR_VERSION}/flink-sql-connector-kafka-${FLINK_KAFKA_CONNECTOR_VERSION}.jar" \
    "$MESSAGING_LIB_DIR/flink-sql-connector-kafka-${FLINK_KAFKA_CONNECTOR_VERSION}.jar"
fi

echo "🔍 [Flink/Paimon] 校验 JAR 文件"
jar_files="$(find "$RAYFLOW_LIB_DIR" -name '*.jar' -type f | sort)"
if [[ -n "$jar_files" ]]; then
  while IFS= read -r jar_path; do
    [[ -n "$jar_path" ]] && validate_jar "$jar_path"
  done <<< "$jar_files"
fi

ensure_env_value "FLINK_VERSION" "$FLINK_VERSION"
ensure_env_value "FLINK_IMAGE" "flink:$FLINK_VERSION"
ensure_env_value "FLINK_LIB_DIR" "./${FLINK_LIB_DIR#./}"
ensure_env_value "PAIMON_VERSION" "$PAIMON_VERSION"
ensure_env_value "PAIMON_FLINK_MINOR" "$PAIMON_FLINK_MINOR"
ensure_env_value "FLINK_CDC_VERSION" "$FLINK_CDC_VERSION"
ensure_env_value "FLINK_KAFKA_CONNECTOR_VERSION" "$FLINK_KAFKA_CONNECTOR_VERSION"
ensure_env_value "MYSQL_DRIVER_VERSION" "$MYSQL_DRIVER_VERSION"
ensure_env_value "FLINK_HADOOP_SHADED_VERSION" "$FLINK_HADOOP_SHADED_VERSION"
ensure_env_value "RAYFLOW_BUILTIN_FLINK_VERSION" "$FLINK_VERSION"
ensure_env_value "RAYFLOW_BUILTIN_FLINK_IMAGE" "flink:$FLINK_VERSION"

echo "✅ [Flink/Paimon] 运行依赖已准备完成"
