# 资源中心

资源中心是 RayFlow 的连接资源与作业依赖管理入口。它把 Flink Runtime、Paimon Catalog、StarRocks、Fluss 和 JAR 资源统一托管，避免把连接参数、对象存储路径和依赖包散落在作业 SQL 或服务器目录中。

![资源中心](/screenshots/3.png)

## Paimon Catalog

Paimon Catalog 用于浏览湖仓元数据和表文件。

![Paimon 湖仓浏览](/screenshots/4.png)

支持能力：

- Catalog 连接登记和检测。
- Database/Table 树形浏览。
- Schema 与表定义查看。
- Snapshot、manifest、index 和文件目录浏览。
- manifest、index-manifest、index 文件的结构化读取。
- 数据预览，默认通过 Flink SQL Gateway 查询前 100 行。

### 缓存策略

Paimon 浏览会缓存 Database、Table、Schema、表定义和文件目录，默认 3 小时。点击刷新会使用 `refresh=true` 绕过缓存。

为避免首次打开看到空目录，后端不会缓存空的 Database/Table 结果；前端首次拿到空 Database 时也会自动刷新一次。

### 使用建议

- Catalog 的 S3 endpoint、access key、secret key 只保存在后端，前端只展示脱敏状态。
- 如果浏览失败，优先检查 S3 endpoint、path style、warehouse、Paimon/Flink 版本和后端依赖。
- 预览查询依赖 SQL Gateway；如果只需要元数据浏览，Paimon Java API 已可独立完成大部分操作。

## StarRocks

StarRocks 连接用于浏览数仓库表、预览数据和执行常用管理操作。

![StarRocks 管理](/screenshots/6.png)

支持能力：

- 连接登记和连接测试。
- Database/Object 树形浏览。
- 表、视图、物化视图定义查看。
- Schema、分区和数据预览。
- SQL 命令窗口，默认限制返回行数。
- 物化视图刷新、强制刷新、取消刷新。
- 表/物化视图删除和清空等高危操作入口。

## Flink 运行时

Flink 运行时用于登记可提交作业的 Flink 集群。

当前主闭环：

- 内置 Flink Standalone Session。
- Flink REST API。
- Flink SQL Gateway。
- 运行时连接测试。
- Flink UI 跳转。

K8s Application Runtime 保留数据模型和入口，物理提交流程不作为当前主要闭环。

## Flink JAR 资源

JAR 资源用于管理作业主包和 SQL 作业依赖。

推荐流程：

1. 上传 JAR 到资源中心。
2. 后端写入 S3，例如 `s3://rayflow-artifacts/flink-jars/default/my-job/1.0.0/my-job-1.0.0.jar`。
3. SQL 作业把它作为依赖 JAR。
4. JAR 作业把它作为主程序包。

加载方式：

- SQL REST 作业：通过 Flink REST `classpaths` 加载。
- SQL Gateway 作业：通过 `ADD JAR 's3://...'` 加载。
- JAR 作业：RayFlow 后端从 S3 下载临时文件，再上传到 Flink JobManager。

## Fluss 集群

Fluss 作为实时数据通道资源入口，目前提供集群登记和 Topic 管理基础能力。

当前适合作为统一资源台的一部分，后续可继续扩展 Schema、权限、监控和消费链路治理。

## 租户隔离

资源中心资源按租户隔离。一个租户下配置的连接、JAR 和运行时不会被其他租户直接感知或引用。超级管理员可以跨租户进入管理视图，但业务资源仍按租户边界组织。
