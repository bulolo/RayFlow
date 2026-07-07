# 开发运维

开发运维是 RayFlow 的核心页面，用于完成 Flink SQL/JAR 作业从研发到运行管理的闭环。

![开发作业编辑器](/screenshots/1.png)

## 页面模式

| 模式 | 地址 | 说明 |
| --- | --- | --- |
| 开发视图 | `/development?view=develop` | 管理作业目录、编辑 SQL/JAR 参数、变量、校验、格式化、预览和提交。 |
| 运维视图 | `/development?view=ops` | 查看运行状态、Flink Job ID、启动、取消、删除、筛选和 Flink UI 跳转。 |

具体作业可直达：

```text
/development?view=develop&jobId=123
```

## SQL 作业

SQL 作业支持：

- Flink SQL 编辑器。
- `${variable}` 变量替换。
- SQL 校验与格式化。
- 查询预览。
- SQL REST Runner 提交。
- SQL Gateway 提交。
- 依赖 JAR 选择。
- Flink 配置覆盖。

SQL 编辑器对 Paimon DDL、ROW/ARRAY 类型和 `${var}` 变量做了兼容处理，减少默认 SQL 解析器产生的误报。

## JAR 作业

JAR 作业推荐使用资源中心上传的 JAR 资源。

流程：

1. 在资源中心上传 JAR。
2. 在作业配置里选择 JAR 资源。
3. 配置 Main Class、programArgs、并行度和 Savepoint。
4. 点击提交或运行。
5. RayFlow 下载 S3 JAR、上传到 Flink JobManager 并调用 `/jars/:jarid/run`。

## SQL REST Runner

SQL REST 模式通过 `rayflow-flink-sql-runner` 执行 SQL。

执行流程：

1. RayFlow 解析变量并处理 SQL。
2. 上传 SQL Runner JAR 到 Flink JobManager。
3. 调用 Flink REST `/jars/:jarid/run`。
4. SQL Runner 执行 `SET`、DDL 和 `INSERT`。
5. Flink 返回 Job ID 后，RayFlow 记录运行状态。

SQL REST 作业必须包含至少一个可提交的写入语句。

## SQL Gateway

SQL Gateway 模式适合使用 Flink 官方 SQL Gateway 会话能力：

1. 打开 SQL Gateway Session。
2. 对依赖 JAR 执行 `ADD JAR 's3://...'`。
3. 执行 `SET`、DDL 和 DML。
4. 从操作结果读取 Flink Job ID。

Paimon 数据预览也依赖 SQL Gateway。

## 运行状态

运维视图展示作业运行状态、Flink Job ID、最近启动时间和操作入口。

![开发运维视图](/screenshots/2.png)

状态同步依赖 Flink REST API。对于批任务，RayFlow 会根据 Flink 作业状态判断是否完成；对于调度编排，后端会等待当前节点完成后再启动下游节点。

## 失败处理

如果 Flink 提交失败或任务运行失败：

- 开发运维页面会展示提交错误。
- 后端会记录运行状态和错误信息。
- 任务调度中，节点失败会使工作流进入失败或按重试策略重试。
- 对象存储、Paimon、依赖 JAR 等运行时错误应通过 Flink 日志定位。

RayFlow 不在提交前强制探测所有 S3/Paimon endpoint，避免把作业运行环境诊断做得过重；运行失败时应能从日志看到真实原因。
