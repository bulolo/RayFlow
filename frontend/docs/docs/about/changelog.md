# 更新日志

## 1.0.0

- **开发运维闭环**：完成 SQL/JAR 作业开发、变量管理、SQL 校验、格式化、预览、提交、运行状态追踪和 Flink UI 跳转。
- **资源中心升级**：统一管理 Flink 运行时、Paimon Catalog、StarRocks 数据源、Fluss 集群、JAR 资源和对象存储依赖。
- **Paimon 浏览**：支持 database/table/schema/表定义/快照/manifest/index/文件内容浏览，元数据缓存支持 `refresh=true`。
- **StarRocks 浏览**：支持库表、Schema、定义、预览、分区、SQL 命令和物化视图常用操作。
- **任务调度闭环**：支持基于 DAG 编排开发运维内的 Flink 作业，并提供执行记录与日志审计。
- **多租户与平台管理**：支持超级管理员跨租户管理、租户管理员初始化、租户内用户隔离和配置中心维护。
- **Flink/Paimon 环境工具化**：新增 `make setup-flink-paimon`、`make verify-flink-libs`、`make verify-flink-paimon-matrix`。
- **工程规范收口**：统一 API 响应、分页结构、OpenAPI SDK、Flyway 迁移、Makefile 检查命令和前后端代码组织。
- **文档站重构**：面向产品指南、使用指南、部署指南、开发参考重新组织文档，并补充截图和技术栈展示。

## 0.0.4

- 优化开发运维 URL 直达能力，支持开发/运维视图和指定作业地址。
- 优化资源中心 Paimon 与 StarRocks 浏览窗口。
- 调整 Flink/Paimon 依赖目录为 `rayflow/` 与 `custom/` 双目录。
- README 补充技术栈、截图、联系方式和快速启动说明。

## 0.0.3

- 引入任务编排模块，完成 DAG 定义、保存、手动运行和执行日志基础能力。
- 引入 Flyway 数据库迁移规范。
- 支持配置中心、平台组织管理和超级管理员跨租户管理。
- 支持 StreamPark batch 作业迁移脚本。

## 0.0.2

- 初始化资源中心、Flink 作业管理和前端 Admin 基础能力。
- 支持默认租户、用户管理和基础配置。

## 0.0.1

- 初始化 RayFlow 项目结构、后端服务、Admin、Docs 和 Docker 开发环境。
