# 环境变量

RayFlow 应用服务通过 `.env` 文件注入环境变量，Docker Compose 中的 RayFlow Backend/Admin 使用 `env_file` 读取配置。后端配置放在 `backend/.env`，Admin 配置放在 `frontend/admin/.env`；生产环境对应 `deploy/.env` 和 `deploy/.env.admin.local`。系统内部时间、数据库和 API 序列化默认使用 UTC；`RAYFLOW_TIMEZONE` 用作业务默认时区，主要影响调度工作流默认时区和测试数据初始化。

## 后端

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DB_HOST` | `postgres` | Compose 内部 PostgreSQL 主机名。执行 `make run-backend` 本地直跑后端时会自动覆盖为 `localhost`。 |
| `DB_PORT` | `5432` | Compose 内部 PostgreSQL 端口。执行 `make run-backend` 本地直跑后端时会自动覆盖为 `5433`。 |
| `DB_NAME` | `rayflow` | 数据库名称。 |
| `DB_USER` | `rayflow` | 数据库用户名。 |
| `DB_PASSWORD` | `rayflow123` | 数据库密码。 |
| `REDIS_HOST` | `redis` | Redis 主机名。 |
| `REDIS_PORT` | `6379` | Redis 端口。 |
| `SPRING_PROFILES_ACTIVE` | `dev` | Spring Boot Profile。 |
| `RAYFLOW_VERSION` | `0.0.4` | 后端版本号，健康检查与 OpenAPI 展示使用。 |
| `RAYFLOW_TIMEZONE` | `Asia/Shanghai` | 业务默认时区，仅用于调度工作流默认时区和测试数据初始化；不影响数据库、JDBC、JVM 默认时区和 JSON 序列化，这些仍固定为 UTC。 |
| `JWT_SECRET` | 无 | JWT 签名密钥，生产必须显式配置。 |
| `RAYFLOW_SECRET_ENCRYPTION_KEY` | 无 | 敏感配置加密密钥，生产必须显式配置并与 JWT 密钥分离。 |
| `RAYFLOW_SUPER_ADMIN_USERNAME` | 空 | 平台超级管理员用户名。 |
| `RAYFLOW_SUPER_ADMIN_PASSWORD` | 空 | 平台超级管理员密码。 |
| `RAYFLOW_DEFAULT_TENANT_ADMIN_USERNAME` | 空 | default 租户管理员用户名。 |
| `RAYFLOW_DEFAULT_TENANT_ADMIN_PASSWORD` | 空 | default 租户管理员密码。 |
| `RAYFLOW_PREVIEW_CALLBACK_BASE_URL` | 开发环境默认 `http://backend:3000` | SQL 查询预览结果回传地址，要求 Flink 运行时侧可访问。 |
| `RAYFLOW_PREVIEW_CALLBACK_TOKEN` | `rayflow-preview-token` | 查询预览内部回传鉴权 Token。 |
| `RAYFLOW_PREVIEW_WAIT_TIMEOUT_MS` | `60000` | SQL 查询预览等待首批结果的超时时间。 |
| `RAYFLOW_SCHEDULER_INSTANCE_ID` | `local` | 调度执行实例标识。 |

## Artifact S3

Flink JAR 资源和作业依赖统一存储在 S3 兼容对象存储中。

| 变量 | 开发默认值 | 说明 |
| --- | --- | --- |
| `RAYFLOW_ARTIFACT_S3_ENDPOINT` | `http://rustfs:9000` | 后端访问 S3 的 Endpoint。 |
| `RAYFLOW_ARTIFACT_S3_ACCESS_KEY` | `rustfsadmin` | S3 Access Key。 |
| `RAYFLOW_ARTIFACT_S3_SECRET_KEY` | `rustfsadmin` | S3 Secret Key。 |
| `RAYFLOW_ARTIFACT_S3_BUCKET` | `rayflow-artifacts` | JAR 资源 Bucket。 |
| `RAYFLOW_LAKE_S3_BUCKET` | `rayflow-lake` | 流湖测试数据 Bucket。 |
| `RAYFLOW_ARTIFACT_S3_REGION` | `us-east-1` | S3 Region。 |
| `RAYFLOW_ARTIFACT_S3_PATH_STYLE` | `true` | 是否使用 path-style S3 访问方式。 |

## Flink

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `FLINK_VERSION` | `2.2.1` | `make setup-flink-paimon` 使用的 Flink 精确版本。交互式输入 `2.2` 时会解析为该版本线最新 patch。 |
| `PAIMON_VERSION` | `1.4.2` | `make setup-flink-paimon` 下载的 Paimon 版本。 |
| `PAIMON_FLINK_MINOR` | `2.2` | Paimon Flink 适配包版本线，例如 `paimon-flink-2.2`。一般由 Flink 版本自动推断。 |
| `FLINK_CDC_VERSION` | `3.5.0` | Flink CDC Connector 版本。 |
| `FLINK_KAFKA_CONNECTOR_VERSION` | `5.0.0-2.2` | Flink Kafka SQL Connector 版本。Kafka 这里指 Flink connector 版本，不是 Kafka broker 版本。 |
| `MYSQL_DRIVER_VERSION` | `8.0.27` | MySQL JDBC 驱动版本。 |
| `FLINK_HADOOP_SHADED_VERSION` | `2.8.3-10.0` | Flink shaded Hadoop filesystem 依赖版本。 |
| `FLINK_IMAGE` | `flink:2.2.1` | 开发环境内置 Flink 镜像。 |
| `FLINK_LIB_DIR` | `./deploy/docker/flink/custom-lib` | 内置 Flink 扩展 JAR 目录。Compose 会挂载到容器 `/opt/rayflow/flink-lib`，启动时复制 `*.jar` 到 `/opt/flink/lib`。 |
| `FLINK_REST_PORT` | `8081` | 生产 Compose 暴露 Flink REST 端口。 |
| `FLINK_SQL_GATEWAY_PORT` | `8083` | 生产 Compose 暴露 SQL Gateway 端口。 |
| `FLINK_REST_CONNECT_TIMEOUT_MS` | `3000` | 后端访问 Flink REST API 的连接超时。 |
| `FLINK_REST_READ_TIMEOUT_MS` | `120000` | 后端访问 Flink REST API 的读取超时。 |
| `FLINK_REST_SUBMIT_READ_TIMEOUT_MS` | `300000` | 后端提交 Flink 作业时的读取超时，避免批任务启动较慢时过早中断。 |
| `FLINK_SQL_RUNNER_JAR` | 空 | 可选，显式指定 RayFlow SQL Runner JAR 路径。一般开发环境无需配置。 |
| `RAYFLOW_BUILTIN_FLINK_RUNTIME_NAME` | `内置` | 系统启动时内置的 Flink 运行时名称。 |
| `RAYFLOW_BUILTIN_FLINK_REST_URL` | `http://flink-jobmanager:8081` | 后端访问内置 Flink REST API 的地址。 |
| `RAYFLOW_BUILTIN_FLINK_SQL_GATEWAY_URL` | `http://flink-sql-gateway:8083` | 后端访问内置 SQL Gateway 的地址。 |
| `RAYFLOW_BUILTIN_FLINK_VERSION` | `2.2.1` | 内置 Flink 运行时版本。 |
| `RAYFLOW_BUILTIN_FLINK_IMAGE` | `flink:2.2.1` | 内置 Flink 运行时镜像。 |

## Paimon 浏览

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `RAYFLOW_PAIMON_BROWSER_CACHE_TTL_MS` | `10800000` | Paimon 元数据浏览缓存时长，默认 3 小时。缓存覆盖 Database、Table、Schema、表定义和文件目录。 |
| `RAYFLOW_PAIMON_BROWSER_OPERATION_TIMEOUT_MS` | `30000` | Paimon Java API 浏览操作超时。 |

手动刷新会带 `refresh=true` 绕过缓存。空 Database/Table 结果不会写入缓存，避免第一次打开空结果被缓存导致后续看不到数据。

## Kubernetes

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `RAYFLOW_KUBECONFIG_DIR` | `${HOME}/.kube` | 挂载给后端容器的 kubeconfig 目录。 |
| `KUBECONFIG` | `/root/.kube/config` | 后端容器内读取的 kubeconfig 文件路径。 |

## 模型提供商

模型提供商通过配置中心维护，当前只保留 OpenAI 兼容接口方式：

- Base URL，例如 `https://ai-gateway.example.com/v1`。
- API Key。
- 模型名。

## 前端

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `CI` | `true` | Admin 容器安装和构建时使用的 CI 标识。 |
| `NEXT_PUBLIC_API_BASE_URL` | 空 | Admin 请求 API 的基础路径。为空时走同源反向代理，包括 `/api/health`。 |
| `NEXT_PUBLIC_APP_VERSION` | `package.json` 中的 `version` | Admin 顶部展示的前端版本号。 |
| `RAYFLOW_API_PROXY_TARGET` | `http://127.0.0.1:3000` | 仅 Next 服务端使用的同源代理目标。Docker Compose 环境应设为 `http://backend:3000`。 |

## SDK 生成

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `OPENAPI_URL` | `http://localhost:3000/v3/api-docs` | `make gen-sdk` 拉取 OpenAPI 的地址。 |
