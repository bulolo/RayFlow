# 系统架构

RayFlow 采用“前端控制台 + 后端控制面 + 外部计算/存储系统”的架构。

```text
Admin / Docs / Website
        |
        | OpenAPI SDK + Nginx /api
        v
rayflow-server
        |
        +-- PostgreSQL        平台元数据、租户、作业、资源、调度记录
        +-- Redis             缓存和后续协作能力基础
        +-- RustFS / S3       JAR 资源、作业依赖、Paimon 示例湖仓
        +-- Flink REST        作业提交、取消、状态同步
        +-- Flink SQL Gateway SQL 预览、Paimon 数据预览、SQL Gateway 提交
        +-- Paimon Java API   Catalog、库表、Schema、表定义、文件浏览
        +-- StarRocks JDBC    库表浏览、预览、分区和物化视图操作
        +-- Fluss             集群和 Topic 资源管理
```

## 前端

| 项目 | 说明 |
| --- | --- |
| `frontend/admin` | Next.js Admin 控制台。 |
| `frontend/docs` | VitePress 文档站。 |
| `frontend/website` | 官网站点，开发环境默认不启动。 |

Admin 的接口层由 OpenAPI 生成 SDK，业务代码优先调用生成的方法和类型，减少手写接口路径。

## 后端

| 模块 | 说明 |
| --- | --- |
| `rayflow-server` | Spring Boot API 服务，包含认证、租户、Flink、资源中心、调度、配置中心等业务。 |
| `rayflow-common` | 统一响应、异常和公共模型。 |
| `rayflow-flink-core` | Flink REST / SQL Gateway 客户端封装。 |
| `rayflow-flink-sql-runner` | SQL REST 模式下提交到 Flink 的执行器 JAR。 |

## 数据库迁移

RayFlow 使用 Flyway 管理数据库结构。

规则：

- `V0.0.2__init_schema.sql` 作为初始化 schema。
- `V0.0.3__changes.sql` 等版本文件承载对应分支的结构变更。
- `scripts/init-test.sql` 只维护测试数据，不承载 DDL。
- `make migration-verify` 校验迁移规范。

## API 响应

后端统一返回结构：

```json
{
  "code": 0,
  "data": {},
  "msg": "success"
}
```

分页统一为：

```json
{
  "list": [],
  "pagination": {
    "is_pager": 1,
    "page": 1,
    "size": 20,
    "total": 0,
    "pages": 0
  }
}
```

## 权限与租户

- 超级管理员可以跨租户管理组织和平台资源。
- 租户管理员管理当前组织内用户、资源和配置。
- 资源中心、作业、变量、调度工作流均按租户隔离。

## 运行时边界

- 开发环境内置 Flink、RustFS、PostgreSQL、Redis 和 Nginx。
- 生产环境可以替换为外部 Flink、S3/MinIO/RustFS、StarRocks 和 Paimon Warehouse。
- 后端不把密钥下发到前端，前端只展示脱敏状态。
