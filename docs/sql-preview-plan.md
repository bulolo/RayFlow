# SQL 查询预览第一版计划

## 目标

补齐 RayFlow 数据开发中的 `查询预览` 能力，先覆盖最常用、最有价值的批任务场景，并和 `运行作业` 明确解耦。

第一版目标不是一次做成 Dinky 的全量能力，而是先把以下几类闭环做稳：

1. `SELECT / WITH` 查询预览
2. 单条 `INSERT INTO ... SELECT ...` 查询预览
3. `SHOW / DESC / DESCRIBE / EXPLAIN` 结果预览

## Dinky 对比

| 维度 | Dinky 1.2.4 | RayFlow 当前 | RayFlow 第一版 |
| --- | --- | --- | --- |
| 查询预览入口 | 统一入口，内部按 SQL 类型分流 | 统一入口，但只支持最后一条 `SELECT` | 保持统一入口，支持 `SELECT / WITH / SHOW / DESC / EXPLAIN` 和单条 `INSERT INTO ... SELECT ...` |
| `SELECT / WITH` | 支持结果预览 | 已支持 | 保持并补齐边界 |
| `INSERT` 预览 | 支持，基于 mock sink | 不支持 | 第一版补齐 |
| 运行作业 | 与预览逻辑分开 | 已分开，但预览逻辑过窄 | 明确彻底分开 |
| 多 `INSERT` / statement set | 有一定支持 | 正式提交支持，预览不支持 | 第一版不做 |
| 结果模型 | 结果预览 + sink 预览 | 普通表格结果 | 普通表格结果为主，先跑通核心闭环 |

## RayFlow 当前现状

### 已有能力

1. 前端有 `查询预览` 按钮
2. 后端已有 `/api/flink/sql/preview`
3. 后端通过 SQL Gateway 执行前置 `SET / DDL` 和最后一条查询
4. 前端已有结果表格展示
5. `运行作业` 已经和 `查询预览` 是两个入口

### 当前限制

1. 最后一条语句必须是 `SELECT`
2. `WITH ... SELECT ...` 识别不完整
3. 单条 `INSERT INTO ... SELECT ...` 不能预览
4. 预览响应结构还比较单一
5. 还没有 preview sink 基础设施

## 第一版范围

### 要做

1. 支持 `SELECT`
2. 支持 `WITH ... SELECT ...`
3. 支持单条 `INSERT INTO ... SELECT ...` 查询预览
4. 继续执行前置 `SET / CREATE / DROP / USE` 等语句
5. 保留最大预览条数限制
6. 保留超时和取消逻辑
7. 运行作业与查询预览继续完全解耦

### 不做

1. 多条 `INSERT INTO`
2. `EXECUTE STATEMENT SET`
3. 多 sink 预览
4. 流式长时间预览
5. 多 sink / 多阶段 preview sink 完整工程化
6. 分布式结果缓存
7. 任意复杂 SQL 的全自动预览重写

## 实现策略

第一版直接按最终方向落地：`preview sink / mock sink`。

也就是：

1. 保留原 SQL 主干逻辑
2. 预览模式下替换真实 sink
3. 收集前 N 条结果返回前端
4. 不真实写入目标端

这样第一版虽然范围仍然收敛，但架构不会走弯路。

### 第一版范围控制

第一版仍然只支持：

1. `SELECT / WITH / VALUES / TABLE`
2. `SHOW / DESC / DESCRIBE / EXPLAIN`
3. 单条 `INSERT INTO ... SELECT ...`

但对 `INSERT` 的实现方式不再做过渡方案，而是直接按 preview sink 链路建设，为后续扩展多 `INSERT`、`statement set`、多 sink 预留好结构。

## Preview Sink 最小技术设计

### 现有可复用基础

RayFlow 当前已经有一条可复用的 SQL 物理执行链路：

1. `rayflow-server`
2. `RestFlinkJobSubmitter`
3. `rayflow-flink-sql-runner`
4. Flink REST `runJar`

这意味着 preview sink 第一版可以直接复用 Runner 侧能力，不需要先依赖 SQL Gateway 完成内部 mock sink 替换。

### 第一阶段模块职责

#### 1. `rayflow-server`

负责：

1. 接收预览请求
2. 生成 `previewId`
3. 识别 SQL 类型
4. 对用户保持统一入口，内部按 SQL 类型分流
5. `SELECT / WITH / VALUES / TABLE / INSERT ... SELECT ...` 走 preview runner
6. `SHOW / DESC / DESCRIBE / EXPLAIN` 走 SQL Gateway 结果拉取
7. 轮询读取预览结果
8. 聚合成统一响应返回前端

#### 2. `rayflow-flink-sql-runner`

负责：

1. 新增 `preview` 执行模式
2. 解析参数：
   - `preview-id`
   - `preview-limit`
   - `preview-mode`
3. 注册 RayFlow 自有 preview sink
4. 在预览模式下替换真实 sink
5. 执行 SQL
6. 将前 N 条结果写回 RayFlow 可读取的位置

#### 3. `rayflow-flink-core`

负责：

1. 提供 preview 结果上报/回传客户端
2. 提供 preview 结果读取客户端
3. 封装和 RayFlow Server 的通信

### 第一阶段结果回传方案

第一阶段优先选择“Runner 主动回传结果到 Server”，而不是让 Server 主动去 Flink 内部取 accumulator。

原因：

1. RayFlow 当前没有 Flink 内部结果缓存基础设施
2. REST/JAR 提交链路已存在，扩展成本更低
3. 结果回传协议更容易控制
4. 后续从单 sink 扩成多 sink 时更平滑

### 第一阶段 preview sink 形态

第一阶段的 preview sink 本质是一个“只缓存前 N 条结果并回传”的测试 sink。

能力范围：

1. 接收输出行
2. 保留列名
3. 最多缓存前 N 条
4. 标记是否截断
5. 执行结束后一次性回传结果

### 第一阶段边界

第一阶段为了尽快稳定，只支持：

1. 单条 `INSERT INTO ... SELECT ...`
2. 单 sink
3. 批作业优先
4. 结果一次性返回

暂不支持：

1. 多 sink 聚合返回
2. 持续流式推送结果
3. statement set
4. 多条 insert 同时预览

## 拆解步骤

### 步骤 1：增强 SQL 分析

目标：

1. 识别 `SELECT`
2. 识别 `WITH`
3. 识别单条 `INSERT INTO ... SELECT ...`
4. 区分多 `INSERT`

涉及：

- `backend/rayflow-server/src/main/java/com/rayflow/server/service/submit/FlinkSqlStatementInspector.java`

### 步骤 2：重构预览服务

目标：

1. 将 `SELECT / WITH` 预览链路和 `INSERT` 预览链路拆开
2. 保留前置语句执行
3. 对不同 SQL 类型给出明确错误提示

涉及：

- `backend/rayflow-server/src/main/java/com/rayflow/server/service/FlinkSqlPreviewService.java`

### 步骤 3：补 preview sink 基础设施

目标：

1. 增加 RayFlow 自有 preview sink
2. 为预览执行传入 `previewId`、`limit`
3. 收集前 N 条输出结果
4. 为后端提供结果读取与超时清理能力

初步涉及：

- `backend/rayflow-flink-sql-runner`
- `backend/rayflow-flink-core`
- `backend/rayflow-server`

补充说明：

1. 第一阶段优先复用现有 `rayflow-flink-sql-runner`
2. 不强行把所有语句塞进 preview runner，元数据语句保留 SQL Gateway 兜底
3. 后续如果要对齐 Dinky 到更完整形态，再考虑 SQL Gateway 侧统一 preview connector

### 步骤 4：扩展预览返回结构

目标：

1. 为前端补充预览模式标识
2. 为结果截断补充状态位
3. 为后续 preview sink 预留扩展位

涉及：

- `backend/rayflow-server/src/main/java/com/rayflow/server/model/dto/FlinkSqlPreviewResponse.java`
- `frontend/admin/src/lib/sdk/sdk.schemas.ts`

### 步骤 5：前端结果面板适配

目标：

1. 使用新的响应字段
2. 对 `INSERT` 查询预览提示其为预览结果
3. 保持现有编辑体验不倒退

涉及：

- `frontend/admin/src/features/development/components/development-workspace.tsx`
- `frontend/admin/src/features/development/components/workspace-panels.tsx`

## 当前进度

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| RayFlow 现状审计 | 已完成 | 已定位前后端预览与提交链路 |
| Dinky 行为对比 | 已完成 | 已明确其 `SELECT` 和 `INSERT mock preview` 分流 |
| 第一版范围收敛 | 已完成 | 已确定覆盖 `SELECT / WITH / SHOW / DESC / EXPLAIN` 和单 `INSERT` |
| 技术方向收敛 | 已完成 | 不再走过渡改写，直接按 preview sink 落 |
| 最小技术设计 | 已完成 | 已明确 Runner / Core / Server 分工 |
| 文档计划落地 | 已完成 | 本文档 |
| 后端实现 | 已完成 | 统一 preview runner、结果回传、fat jar 均已落地 |
| 前端适配 | 已完成 | 预览类型、提示文案、截断提示已接入 |
| 环境配置 | 已完成 | 已补 callback 配置与文档说明 |
| SDK 同步 | 已完成 | 已执行 `make gen-sdk`，OpenAPI 与 SDK 已更新 |

## 下一步

1. 验证前端查询预览展示：
   - `SELECT`
   - `WITH ... SELECT ...`
   - 单条 `INSERT INTO ... SELECT ...`
2. 在外部 Flink 运行时场景下，补齐可达的 `RAYFLOW_PREVIEW_CALLBACK_BASE_URL`
3. 后续如要继续对齐 Dinky，再扩展多 `INSERT` / `statement set` / 流式预览
