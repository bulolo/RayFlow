# REST API

后端基础路径为 `/api`。开发环境推荐通过 Nginx 入口访问：

```text
http://localhost:8080/api
```

也可以直连后端：

```text
http://localhost:3000/api
```

## 统一响应

成功响应：

```json
{
  "code": 0,
  "data": {},
  "msg": "success"
}
```

失败响应：

```json
{
  "code": 1,
  "data": null,
  "msg": "错误信息"
}
```

## 分页结构

分页接口统一返回：

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

请求参数统一使用：

| 参数 | 说明 |
| --- | --- |
| `is_pager` | 是否分页，`1` 分页，`0` 不分页。 |
| `page` | 页码，从 1 开始。 |
| `size` | 每页数量。 |

## 认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/auth/login` | 登录并获取 JWT。 |
| `GET` | `/auth/me` | 获取当前用户资料。 |
| `POST` | `/auth/logout` | 退出登录。 |

## Flink 作业

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/flink/jobs` | 查询作业列表。 |
| `GET` | `/flink/jobs/{id}` | 查询作业详情。 |
| `POST` | `/flink/jobs` | 创建作业。 |
| `PUT` | `/flink/jobs/{id}` | 更新作业。 |
| `DELETE` | `/flink/jobs/{id}` | 删除作业。 |
| `POST` | `/flink/jobs/{id}:start` | 启动作业。 |
| `POST` | `/flink/jobs/{id}:cancel` | 取消作业。 |
| `POST` | `/flink/jobs/{id}:triggerSavepoint` | 触发 Savepoint。 |
| `POST` | `/flink/sql:validate` | SQL 校验。 |
| `POST` | `/flink/sql:preview` | SQL 查询预览。 |

## 任务调度

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/scheduler/workflows` | 查询工作流。 |
| `POST` | `/scheduler/workflows` | 创建工作流。 |
| `GET` | `/scheduler/workflows/{id}` | 查询工作流详情。 |
| `PUT` | `/scheduler/workflows/{id}` | 更新工作流。 |
| `DELETE` | `/scheduler/workflows/{id}` | 删除工作流。 |
| `GET` | `/scheduler/workflows/{id}/definition` | 查询 DAG 定义。 |
| `PUT` | `/scheduler/workflows/{id}/definition` | 保存 DAG 定义。 |
| `POST` | `/scheduler/workflows/{id}:run` | 手动运行工作流。 |
| `POST` | `/scheduler/workflows/{id}:validate` | 校验工作流。 |
| `POST` | `/scheduler/workflows/{id}:publish` | 发布版本。 |
| `GET` | `/scheduler/executions` | 查询执行记录。 |
| `GET` | `/scheduler/executions/{id}/nodes` | 查询节点执行。 |
| `GET` | `/scheduler/executions/{id}/logs` | 查询执行日志。 |
| `POST` | `/scheduler/executions/{id}:cancel` | 取消执行。 |

## Paimon

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/paimon/catalogs` | 查询 Catalog。 |
| `POST` | `/paimon/catalogs` | 新增 Catalog。 |
| `PUT` | `/paimon/catalogs/{id}` | 更新 Catalog。 |
| `DELETE` | `/paimon/catalogs/{id}` | 删除 Catalog。 |
| `POST` | `/paimon/catalogs/{id}:check` | 检测 Catalog。 |
| `GET` | `/paimon/catalogs/{id}/databases` | 查询 Database，支持 `refresh=true`。 |
| `GET` | `/paimon/catalogs/{id}/databases/{database}/tables` | 查询 Table，支持 `refresh=true`。 |
| `GET` | `/paimon/catalogs/{id}/databases/{database}/tables/{table}/definition` | 查询表定义。 |
| `GET` | `/paimon/catalogs/{id}/databases/{database}/tables/{table}/schema` | 查询 Schema。 |
| `GET` | `/paimon/catalogs/{id}/databases/{database}/tables/{table}/snapshots` | 查询快照。 |
| `GET` | `/paimon/catalogs/{id}/databases/{database}/tables/{table}/files` | 浏览表目录。 |
| `GET` | `/paimon/catalogs/{id}/databases/{database}/tables/{table}/files/content` | 查看文件内容。 |
| `GET` | `/paimon/catalogs/{id}/databases/{database}/tables/{table}/preview` | 预览数据。 |

## StarRocks

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/starrocks/connections` | 查询连接。 |
| `POST` | `/starrocks/connections` | 新增连接。 |
| `PUT` | `/starrocks/connections/{id}` | 更新连接。 |
| `DELETE` | `/starrocks/connections/{id}` | 删除连接。 |
| `POST` | `/starrocks/connections/{id}:check` | 检测连接。 |
| `GET` | `/starrocks/connections/{id}/databases` | 查询 Database。 |
| `GET` | `/starrocks/connections/{id}/databases/{database}/objects` | 查询表/视图/物化视图。 |
| `GET` | `/starrocks/connections/{id}/databases/{database}/objects/{object}/definition` | 查询定义。 |
| `GET` | `/starrocks/connections/{id}/databases/{database}/objects/{object}/schema` | 查询 Schema。 |
| `GET` | `/starrocks/connections/{id}/databases/{database}/objects/{object}/partitions` | 查询分区。 |
| `GET` | `/starrocks/connections/{id}/databases/{database}/objects/{object}/preview` | 预览数据。 |

## Flink 运行时与 JAR 资源

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/flink/runtimes` | 查询运行时。 |
| `POST` | `/flink/runtimes` | 新增运行时。 |
| `POST` | `/flink/runtimes/{id}:check` | 检测运行时。 |
| `GET` | `/flink/jar-resources` | 查询 JAR 资源。 |
| `POST` | `/flink/jar-resources` | 登记已有 S3 JAR。 |
| `POST` | `/flink/jar-resources/upload` | 上传 JAR。 |

## 配置中心

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/variables` | 查询变量。 |
| `POST` | `/variables` | 新增变量。 |
| `GET` | `/notification-channels` | 查询通知渠道。 |
| `POST` | `/notification-channels` | 新增通知渠道。 |
| `POST` | `/notification-channels/{id}:test` | 测试通知渠道。 |
| `GET` | `/model-provider` | 查询模型提供商配置。 |
| `PUT` | `/model-provider` | 保存模型提供商配置。 |

## OpenAPI 与 SDK

开发环境：

- Knife4j UI：`http://localhost:3000/doc.html`
- Swagger UI：`http://localhost:3000/swagger-ui/index.html`
- OpenAPI JSON：`http://localhost:3000/v3/api-docs`

生成前端 SDK：

```bash
make gen-sdk
```

SDK 文件位于：

```text
frontend/admin/src/lib/sdk
```

不要手改 SDK，SDK 由 `make gen-sdk` 生成。
