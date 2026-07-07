# 产品简介

RayFlow 是围绕 **Flink 作业从开发、提交、运维到编排** 建设的一体化控制台。它不是单纯的 SQL 编辑器，也不是只做连接登记的资源台，而是把 Flink、Paimon、StarRocks、Fluss 相关的日常操作收口到同一个多租户平台。

## RayFlow 解决什么问题

在实际数据平台中，Flink 作业往往会遇到这些问题：

- SQL、变量、依赖 JAR、运行时配置分散，提交链路难以复用。
- 运维需要在控制台、Flink UI、对象存储、数据库之间来回切换。
- Paimon Catalog、StarRocks 数据源和 Flink Runtime 的连接信息缺少统一管理。
- 多个批任务之间存在依赖，但缺少可审计的 DAG 编排和执行日志。
- 数据库结构和前端 SDK 缺少版本化流程，升级容易漂移。

RayFlow 的定位是把这些操作收敛为产品化流程：**开发作业、运行运维、资源中心、任务调度、配置中心、平台管理**。

## 核心技术栈

| 技术 | RayFlow 中的定位 |
| --- | --- |
| Apache Flink | SQL/JAR 作业运行时，提供流批一体计算能力。 |
| Apache Paimon | 湖仓表存储，支持 Catalog、库表、表定义、快照、manifest、index 和文件浏览。 |
| StarRocks | 实时分析库，支持库表浏览、预览、分区、物化视图和常规操作。 |
| Apache Fluss | 湖流一体方向的实时数据通道资源管理入口。 |
| PostgreSQL / Redis | 平台元数据、执行状态、缓存和后续协作能力基础。 |
| RustFS / S3 | Flink JAR 资源、作业依赖、Paimon 示例湖仓和制品存储。 |

## 产品模块

### 控制台总览

总览页用于快速了解平台运行状态，包括作业、资源、调度和常用入口。

![控制台总览](/screenshots/8.png)

### 开发运维

开发视图面向 Flink SQL/JAR 作业研发，运维视图面向运行状态、Flink Job ID、启动、取消、删除和筛选。

![开发作业编辑器](/screenshots/1.png)

### 资源中心

资源中心统一维护 Flink Runtime、Paimon Catalog、StarRocks 连接、Fluss 集群和 Flink JAR 资源。

![资源中心](/screenshots/3.png)

### 任务调度

任务调度以开发运维中的 Flink 作业为原子节点，通过 DAG 编排批处理链路，提供手动运行、执行记录和日志审计。

![任务调度](/screenshots/5.png)

## 适用场景

- Flink SQL/JAR 作业研发、测试、提交和状态跟踪。
- Paimon Catalog 和 StarRocks 数据源的自助浏览。
- 多个 Flink 批任务的串行编排和执行审计。
- 多租户下的资源隔离、用户管理和平台侧组织维护。
- 希望用 OpenAPI SDK 保证前后端接口一致的工程团队。

## 当前边界

- 定时调度暂不作为第一阶段重点，当前任务调度优先保证手动触发和异步串行执行闭环。
- K8s Application Runtime 保留模型和入口，但主闭环仍以 Standalone Session 和内置运行时为主。
- Paimon 数据预览依赖 Flink SQL Gateway；元数据浏览优先使用 Paimon Java API。
