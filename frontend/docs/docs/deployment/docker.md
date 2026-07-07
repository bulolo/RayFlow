# Docker 开发与部署

RayFlow 提供开发 Compose 和生产 Compose 两套入口。

| 文件 | 用途 |
| --- | --- |
| `docker-compose.dev.yml` | 本地开发环境。默认启动 backend、admin、docs、nginx、postgres、redis、rustfs、flink。 |
| `deploy/docker-compose.yml` | 生产部署模板。 |

## 开发环境

```bash
make dev-up
```

该命令会自动执行 `make dev-init`，在缺少 `backend/.env` 时从 `backend/.env.example` 生成本地配置。

开发环境默认不启动 website，如需官网单独启动：

```bash
make dev-up-website
```

## 服务拓扑

| 服务 | 容器 | 地址 |
| --- | --- | --- |
| Nginx | `rayflow_nginx_dev` | `http://localhost:8080` |
| Backend | `rayflow_backend_dev` | `http://localhost:3000` |
| Admin | `rayflow_admin_dev` | 通过 Nginx 访问 |
| Docs | `rayflow_docs_dev` | `http://localhost:8003` |
| PostgreSQL | `rayflow_postgres_dev` | `localhost:5433` |
| Redis | `rayflow_redis_dev` | `localhost:6379` |
| RustFS | `rayflow_rustfs_dev` | API `localhost:9010` / Console `localhost:9011` |
| Flink | `rayflow_flink_dev` | REST `localhost:8081` / SQL Gateway `localhost:8083` |

## Flink/Paimon 依赖

Flink 扩展 JAR 目录：

```text
deploy/docker/flink/custom-lib
```

目录约定：

```text
custom-lib/
  rayflow/   RayFlow 管理的依赖，setup 命令会清理旧版本
  custom/    用户自定义依赖，setup 命令不会清理
```

准备依赖：

```bash
make setup-flink-paimon
```

验证依赖：

```bash
make verify-flink-libs
```

验证 Flink 2.x 与 Paimon 1.x 可用矩阵：

```bash
make verify-flink-paimon-matrix
```

## RustFS / S3

开发环境默认创建：

- `rayflow-artifacts`：Flink JAR 资源和作业依赖。
- `rayflow-lake`：Paimon 示例湖仓。

开发默认凭证：

```text
access key: rustfsadmin
secret key: rustfsadmin
```

容器内后端访问 RustFS：

```text
http://rustfs:9000
```

宿主机访问 RustFS：

```text
http://localhost:9010
```

## 停止和清理

```bash
make dev-down
```

停止容器并保留数据卷。

```bash
make dev-clean
```

停止并清理数据卷。PostgreSQL 与 RustFS 数据都会丢失。

## 生产部署要点

生产环境必须显式配置：

- `JWT_SECRET`
- `RAYFLOW_SECRET_ENCRYPTION_KEY`
- `DB_PASSWORD`
- `RAYFLOW_SUPER_ADMIN_USERNAME`
- `RAYFLOW_SUPER_ADMIN_PASSWORD`
- `RAYFLOW_DEFAULT_TENANT_ADMIN_USERNAME`
- `RAYFLOW_DEFAULT_TENANT_ADMIN_PASSWORD`
- S3 endpoint、access key、secret key、bucket

如果生产使用外部 S3/MinIO/RustFS，可以移除 Compose 内置 RustFS 服务，但 Bucket 需要提前创建。

## 健康检查

后端健康检查通过：

```text
/api/health
```

不再建议把 `/health` 直接暴露为 Nginx 根路径代理，避免和前端路由混淆。
