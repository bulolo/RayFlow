# 快速开始

本页用于在本地启动完整 RayFlow 开发环境，并初始化一套可演示的数据。

## 前置要求

- Docker 20.10+
- Docker Compose V2
- Make
- pnpm 10，仅本地单独运行前端或文档站时需要
- Java 17，仅本地编译后端时需要

> 如果本机默认 Java 是 22/26，Maven 编译可能触发 Lombok/Javac 兼容问题。建议执行后端命令时显式使用 Java 17。

## 启动开发环境

```bash
git clone https://github.com/bulolo/RayFlow.git
cd RayFlow

make dev-init
make dev-up
```

启动完成后访问：

| 服务 | 地址 |
| --- | --- |
| Admin 控制台 | `http://localhost:8080` |
| 文档站 | `http://localhost:8003` |
| 后端 API | `http://localhost:3000` |
| Flink Web UI | `http://localhost:8081` |
| Flink SQL Gateway | `http://localhost:8083` |
| RustFS S3 API | `http://localhost:9010` |
| RustFS Console | `http://localhost:9011` |
| PostgreSQL | `localhost:5433` |
| Redis | `localhost:6379` |

## 初始化测试数据

```bash
make init-test
```

该命令会初始化：

- 默认组织和默认账号。
- 内置 Flink Runtime。
- Paimon Catalog。
- StarRocks 测试连接。
- Flink SQL/JAR 示例作业。
- `scheduler-demo` 三节点批处理编排工作流。
- Paimon batch word count 最小示例。

开发默认账号：

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 超级管理员 | `superadmin@rayflow.cn` | `admin123` |
| 默认租户管理员 | `admin@rayflow.cn` | `admin123` |

## 准备 Flink/Paimon 运行依赖

内置 Flink 的扩展 JAR 通过 `deploy/docker/flink/custom-lib` 管理。

```bash
make setup-flink-paimon
```

交互式默认值：

```text
Flink 版本或版本线 [2.2]
Paimon 版本 [1.4.2]
Flink CDC Connector 版本 [3.5.0]
Flink Kafka Connector 版本 [5.0.0-2.2]
MySQL 驱动版本 [8.0.27]
Flink Shaded Hadoop 版本 [2.8.3-10.0]
```

用户自定义 JAR 放在：

```text
deploy/docker/flink/custom-lib/custom
```

RayFlow 管理的 JAR 放在：

```text
deploy/docker/flink/custom-lib/rayflow
```

`make setup-flink-paimon` 只清理 `rayflow` 目录，不清理 `custom`。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `make dev-up` | 启动开发环境，不启动官网 website。 |
| `make dev-down` | 停止开发环境，保留数据卷。 |
| `make dev-clean` | 停止并清理数据卷。 |
| `make init-test` | 初始化测试数据。 |
| `make gen-sdk` | 从 OpenAPI 生成 Admin TypeScript SDK。 |
| `make format` | 统一格式化前后端代码。 |
| `make check-all` | 执行后端、Admin、Website、Docs 和 Git 空白检查。 |
| `make migration-verify` | 校验 Flyway 迁移规范。 |
| `make verify-flink-libs` | 校验 Flink/Paimon 运行依赖。 |

## 本地单独运行文档站

```bash
pnpm --dir frontend/docs install
pnpm --dir frontend/docs docs:dev
```

默认监听 `http://localhost:8003`。
