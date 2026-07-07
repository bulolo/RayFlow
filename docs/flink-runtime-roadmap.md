# Flink Runtime 规划

## 背景

RayFlow 当前优先解决批任务提交到内置或外部 Standalone Flink 运行时的问题。后续流任务会逐步引入 Kubernetes Application Mode，因此 Flink 相关能力需要提前抽象边界，避免后续从 Standalone 重构到 K8s 时推翻现有设计。

本规划采用“先轻量闭环，再扩展运行时”的策略：

- 当前只面向 Flink 2.x。
- 内置 Flink 默认使用 2.2.1。
- 当前批任务优先走 Standalone Session 运行时。
- 后续流任务优先通过 Flink Kubernetes Operator 的 Application Deployment 接入。
- 暂不引入 StreamPark 式本地 `FLINK_HOME` 多版本管理。

## 当前进度

### 已完成

- 统一抽象为 Flink Runtime，不再把运行目标只理解为 REST 地址。
- 内置 Flink 2.2.1 运行时初始化。
- 外部 Standalone Session 运行时接入、版本探测、状态检测。
- Kubernetes Application Runtime 配置录入，包括 namespace、serviceAccount、镜像、镜像拉取策略、服务对外类型、Kube Config、Pod Template、checkpoint/savepoint 路径。
- Kube Config 和 Pod Template 使用 YAML 编辑器维护，Kube Config 留空时使用后端容器内 `/root/.kube/config`。
- Kubernetes Application Runtime **K8s 配置连通性检测**：通过 fabric8 Kubernetes Client 向目标 Namespace 发送轻量 GET 请求，验证 Kube Config 和网络可达性；检测结果写回 `status` 字段，前端展示专属 Toast 提示。
- 作业运行模式字段 `runtimeMode`，SQL 作业提交时统一生成 `execution.runtime-mode`。
- Standalone REST 提交和 SQL Gateway 提交。
- JAR 作业通过 REST `/jars/upload` 和 `/jars/:jarid/run` 提交。
- SQL REST 作业通过 SQL Runner 提交，并支持作业级 JAR 依赖 `classpaths`。
- SQL Gateway 作业支持通过 `ADD JAR` 加载作业级 JAR 依赖。
- Flink JAR 资源管理：上传到 S3、登记已有 S3、列表、编辑、删除、选择绑定到作业。
- Savepoint 触发、Savepoint 记录列表、Checkpoint 状态查询。
- Cancel、状态同步、作业运行记录和运维视图基础闭环。
- `make init-test` 已包含 Standalone Runtime、Kubernetes Application Runtime、JAR 资源、批/流 SQL 作业和资源配置示例。
- OpenAPI 和前端 SDK 已覆盖 Flink Runtime、Flink Job、JAR Resource、Savepoint、Checkpoint 字段与接口。

### 部分完成

- Kubernetes Application Runtime 当前已完成配置模型、UI 录入、初始化示例和 K8s 连通性检测；作业提交尚未开放。
- Checkpoint 当前读取 Flink REST 保留的 Job ID 状态；历史化、告警化和失败诊断视图还未展开。
- Savepoint 已有 RayFlow 触发记录；自动从 Flink 外部历史恢复的能力未做。

### 未开始

- 通过 Flink Kubernetes Operator 创建 `FlinkDeployment`。
- K8s Application 作业状态同步、cancel/suspend、savepoint upgrade。
- K8s 事件、Operator CRD 状态和 Flink Job 状态统一展示。
- 自动构建 Flink 作业镜像。
- Flink Home、多主版本 SQL Runner、Yarn。

## 设计原则

### 只支持 Flink 2.x

RayFlow 不再把 Flink 1.20 作为近期目标。

原因：

- 当前没有历史 1.x 作业迁移包袱。
- Flink 2.x + Java 17 更符合新平台默认技术线。
- 先把 2.x 的 REST、SQL Gateway、SQL Runner、Savepoint、Cancel、状态同步做稳定，比提前引入 1.x/2.x 多版本矩阵更重要。

需要保留的扩展点：

- 运行时仍然记录 `flinkVersion`，但它是探测结果，不是让用户自由选择兼容线。
- 作业和依赖资源后续可以记录兼容 Flink 版本范围。
- 提交器内部保留按 runtime 类型扩展的结构。

### 不引入 FLINK_HOME

StreamPark 需要配置 `FLINK_HOME`，主要是因为它要在平台侧持有不同 Flink 发行版的 `bin/lib/conf`，用于本地构建 classpath、执行 CLI、组装提交上下文和多版本隔离。

RayFlow 当前不走这个方向。

当前 RayFlow 的提交模型是：

```text
RayFlow -> Flink REST API / SQL Gateway -> 已运行的 Flink 运行时
```

因此当前不要求用户在 RayFlow 服务端安装多个 Flink 发行包。

只有未来需要下列能力时，才重新评估是否引入 Flink Home 或 Flink Client Runtime：

- 本地执行 `flink run` 或 `flink run-application`。
- Yarn Application 提交。
- 直接使用 Flink Java Client SDK 组装并提交作业。
- 根据 Flink 版本动态编译用户作业。
- 平台侧自动构建 Flink 运行镜像。

## Runtime 抽象

RayFlow 不应把 Flink 运行目标只理解为一个 REST 地址，而应抽象为 Flink Runtime。

建议 runtime 类型：

```text
standalone-session
kubernetes-application
kubernetes-session
```

当前实现：

```text
standalone-session
kubernetes-application
```

后续可扩展：

```text
kubernetes-session
```

## 当前阶段：Standalone 批任务

目标：

- 内置 Flink 2.2.1 可直接运行。
- 外部 Standalone Flink 2.x 运行时可接入。
- 批任务可以通过 REST 或 SQL Gateway 提交。
- 作业状态、Cancel、Savepoint、日志/运行记录形成闭环。

当前提交方式：

```text
JAR 作业:
RayFlow -> /jars/upload -> /jars/:jarid/run

SQL 作业:
RayFlow -> SQL Gateway
或
RayFlow -> 上传 RayFlow SQL Runner -> /jars/:jarid/run
```

当前约束：

- 运行时探测到非 Flink 2.x 时应标记不可用。
- 作业提交前必须确认目标运行时是 Flink 2.x。
- SQL Runner 使用 Java 17 构建。
- 内置 Docker Flink 镜像默认 2.2.1，并允许通过 `FLINK_IMAGE` 覆盖。

## 后续阶段：K8s Application 流任务

Kubernetes Application Mode 与 Standalone Session 的核心区别：

```text
Standalone Session:
提交作业到已有 Flink 运行时。

K8s Application:
为一个作业创建独立 Flink 应用集群。
```

推荐接入方式：

```text
RayFlow -> Kubernetes API -> FlinkDeployment
```

优先使用 Flink Kubernetes Operator，而不是在 RayFlow 后端直接拼 `flink run-application` 命令。

原因：

- Operator 负责 reconcile。
- Operator 负责 JobManager / TaskManager 生命周期。
- Operator 支持 savepoint upgrade。
- Operator 暴露标准 CRD 状态，方便 RayFlow 同步运行态。
- RayFlow 不需要持有本地 Flink Home。

目标资源形态：

```yaml
apiVersion: flink.apache.org/v1beta1
kind: FlinkDeployment
spec:
  image: your-flink-job-image
  flinkVersion: v2_0
  mode: native
  job:
    jarURI: s3://rayflow-artifacts/flink-jars/default/job/1.0.0/job-1.0.0.jar
    entryClass: com.example.Job
    parallelism: 4
    upgradeMode: savepoint
```

RayFlow 需要管理的 K8s Application 信息：

- Kubernetes 集群凭证引用。
- namespace。
- serviceAccount。
- Flink 镜像。
- 作业镜像或 JAR URI。
- JobManager / TaskManager 资源。
- parallelism。
- checkpoint 配置。
- savepoint 路径。
- upgradeMode。
- restart policy。
- flinkConfiguration。

## 数据模型准备

### Flink Runtime / Cluster

`rf_flink_cluster` 当前包含以下字段：

```text
cluster_type          standalone / kubernetes
deployment_mode       session / application
flink_version         探测或配置的 Flink 版本
address               Standalone / Kubernetes Session REST 地址；Kubernetes Application 不依赖该字段
gateway_address       SQL Gateway 地址；Kubernetes Application 不要求配置
namespace_name        K8s namespace
service_account       K8s serviceAccount
image                 Flink runtime image
image_pull_policy     IfNotPresent / Always
service_exposure_type K8s Application 服务对外类型: ClusterIP / NodePort / LoadBalancer / Ingress
kube_config_ref       K8s kubeconfig；为空时使用容器默认 /root/.kube/config，也可保存 kubeconfig 内容
pod_template          K8s Application Pod Template YAML
default_parallelism   默认并行度
checkpoint_dir        默认 checkpoint 路径
savepoint_dir         默认 savepoint 路径
```

当前 UI 已按运行时类型区分配置：

- Standalone / Kubernetes Session：REST 地址、可选 SQL Gateway、版本探测结果、状态。
- Kubernetes Application：namespace、serviceAccount、运行镜像、镜像拉取策略、服务对外类型、Kube Config、Pod Template。

Kube Config 和 Pod Template 使用 YAML 编辑器维护；Kube Config 留空时使用后端容器内的 `/root/.kube/config`。

### Flink Job

`rf_flink_job` 当前保留以下运行提交字段：

```text
submit_type             REST / SQL_GATEWAY / K8S_APPLICATION
execution_mode          standalone / k8s-application
runtime_mode            BATCH / STREAMING
cluster_id              目标 runtime
application_image       K8s Application 作业镜像
jar_uri                 K8s Application JAR URI
main_class              主类
args                    启动参数
parallelism             并行度
flink_config            Flink 配置 JSON
savepoint_path          恢复路径
dependency_refs         依赖资源引用
```

当前 UI 保持轻量：

- 批任务默认 `standalone`。
- SQL 默认 `SQL_GATEWAY` 或 `REST + SQL Runner`。
- JAR 默认 `REST`。
- `k8s-application` 作为预留执行模式展示，后端提交会明确拒绝，不静默降级到 REST。

当后续实现 K8s Application 时，再开放：

- 作业镜像
- JAR URI
- K8s namespace
- savepoint upgrade 策略
- 资源规格

## SQL 运行模式与作业 Flink 配置规范

RayFlow 同时支持在 SQL 文本中写 `SET`，也支持在作业配置中维护 `flink_config`。两者不要混用同一个 key，避免执行时优先级不清晰。

推荐归属如下：

- SQL 作业的流批模式使用作业字段“运行模式”维护。RayFlow 提交时会自动生成 `execution.runtime-mode`，不要在 SQL 文本里手写这个 key。
- SQL 语义、SQL Planner、表执行行为可以放在 SQL 文本里，例如 `SET 'table.local-time-zone' = 'Asia/Shanghai';`。
- 平台提交、作业运行、运维治理参数放在 `flink_config`，例如 `pipeline.name`、checkpoint 路径、checkpoint 间隔、restart strategy、operator chaining。
- JAR 作业没有 SQL 文本，运行行为统一放在作业参数和 `flink_config`。
- 同一个配置项如果 SQL 和 `flink_config` 都能设置，优先选择离用户意图最近的位置：影响 SQL 结果语义的放 SQL，影响提交运行治理的放 `flink_config`。

批 SQL 作业建议配置方式：

- 作业字段“运行模式”选择 `BATCH`。
- SQL 文本只保留业务 SQL。

```sql
INSERT INTO sink_table
SELECT ...
FROM source_table;
```

对应作业级 `flink_config` 只保留运行治理配置：

```json
{
  "pipeline.name": "daily-user-sync",
  "execution.checkpointing.interval": "60s",
  "state.checkpoints.dir": "s3://rayflow-artifacts/checkpoints/daily-user-sync"
}
```

## JAR 资源规划

资源中心提供 Flink JAR 资源管理，统一使用 S3 存储，避免用户手动拷贝到 Flink 服务器或运行时 lib 目录。

核心字段：

```text
resource_name
resource_version
compatible_flink_version
storage_uri
checksum
status
```

当前闭环：

- JAR 作业：选择资源中心 JAR 作为主程序包，RayFlow 从 S3 下载临时文件，再通过 Flink REST `/jars/upload` 和 `/jars/:jarid/run` 提交。
- SQL REST 作业：选择资源中心 JAR 作为作业级依赖，通过 Flink REST `classpaths` 传入 SQL Runner 作业。
- SQL Gateway 作业：选择资源中心 JAR 作为会话依赖，通过 `ADD JAR 's3://...'` 加载。

K8s Application 阶段应优先支持：

- 构建或选择包含依赖的 Flink 作业镜像。
- 通过对象存储 URI 结合 Operator 支持能力加载 JAR。

## 提交器规划

建议后端提交器分层：

```text
FlinkJobSubmitter
├── StandaloneRestSubmitter
├── StandaloneSqlGatewaySubmitter
└── K8sApplicationSubmitter
```

当前实现：

- `StandaloneRestSubmitter`
- `StandaloneSqlGatewaySubmitter`

未来新增：

- `K8sApplicationSubmitter`

调度逻辑：

```text
if submitType == REST:
  standalone REST

if submitType == SQL_GATEWAY:
  standalone SQL Gateway

if submitType == K8S_APPLICATION:
  Kubernetes Operator CRD
```

在 `K8S_APPLICATION` 未实现前，后端应明确拒绝：

```text
K8s Application 提交尚未启用
```

不要静默 fallback 到 REST。

## 阶段计划

### Phase 1：Standalone 批任务闭环

状态：已完成基础闭环。

目标：

- Flink 2.x Standalone 运行时接入。
- 内置 Flink 2.2.1。
- REST / SQL Gateway 提交。
- Cancel / Savepoint / 状态同步。
- 资源中心展示版本、状态、Gateway 状态。
- 作业提交前校验 Flink 2.x。

不做：

- K8s 提交。
- 多 Flink 主版本适配。
- Flink Home 管理。

### Phase 2：依赖资源管理

状态：已完成基础闭环。

目标：

- 资源中心新增 Flink JAR 资源。
- JAR 统一上传到 S3。
- 记录兼容 Flink 版本。
- 支持 JAR 作业选择主程序 JAR。
- 支持 SQL REST 作业通过 `classpaths` 加载依赖 JAR。
- 支持 SQL Gateway 作业通过 `ADD JAR` 加载依赖 JAR。

不做：

- 自动远程拷贝任意服务器 JAR。
- 运行时级 lib 挂载。
- 自动构建 K8s 镜像。

### Phase 3：K8s Runtime 配置

状态：已完成配置录入、初始化示例和 **K8s 连通性检测**。

目标：

- 支持配置 Kubernetes Runtime。
- 记录 namespace、serviceAccount、image、checkpoint/savepoint 目录。
- 对接 K8s API 凭证引用。
- **K8s 连通性检测**：通过 Kube Config 调用 K8s API，验证 Namespace 可达性并写回状态。
  - `kubeConfigRef` 为空时使用容器默认 `/root/.kube/config`。
  - `kubeConfigRef` 为内联 YAML 文本时直接解析使用。
  - `kubeConfigRef` 为文件路径时读取容器内文件后解析。
  - 后端依赖：`io.fabric8:kubernetes-client:6.13.0`。
  - 连通成功展示「K8s 配置检测通过，Namespace xxx 可达」；失败展示「请检查 Kube Config 和 Namespace」。

### Phase 4：K8s Application 提交

状态：未开始。

目标：

- 新增 `K8S_APPLICATION` submit type。
- 通过 Flink Kubernetes Operator 创建 `FlinkDeployment`。
- 支持 Application 作业状态同步。
- 支持 savepoint upgrade。
- 支持 cancel/suspend。
- 支持作业镜像和 JAR URI。

### Phase 5：流任务治理

状态：部分完成。

目标：

- Checkpoint 监控。
- Savepoint 历史。
- Upgrade / rollback。
- 自动重启策略。
- K8s 事件和 Flink Job 状态统一展示。

## 当前不做的事情

- 不支持 Flink 1.20。
- 不做 Flink Home 管理。
- 不做 Yarn。
- 不做多版本 SQL Runner 矩阵。
- 不假设一个作业天然可以运行在所有 Flink 版本上。

## 关键结论

RayFlow 当前应该保持轻量：

```text
Standalone 批任务先闭环
Flink 2.x 先稳定
K8s Application 作为下一阶段 runtime
```

这样当前实现不会被未来 K8s 流任务推翻，同时也不会过早引入 StreamPark 式复杂度。
