# Flink Runtime 规划

## 背景

RayFlow 当前优先解决批任务提交到内置或外部 Standalone Flink 运行时的问题。后续流任务会逐步引入 Kubernetes Application Mode，因此 Flink 相关能力需要提前抽象边界，避免后续从 Standalone 重构到 K8s 时推翻现有设计。

本规划采用“先轻量闭环，再扩展运行时”的策略：

- 当前只面向 Flink 2.x。
- 内置 Flink 默认使用 2.2.1。
- 本地 Paimon 示例默认使用 Compose 内置 RustFS，不依赖外部 S3。
- 当前批任务优先走 Standalone Session 运行时。
- 后续流任务只通过 Flink Kubernetes Operator 的 Application Deployment 接入，不在产品侧暴露 Native Application 路线。
- 暂不引入 StreamPark 式本地 `FLINK_HOME` 多版本管理。

## 当前进度

### 已完成

- 统一抽象为 Flink Runtime，不再把运行目标只理解为 REST 地址。
- 内置 Flink 2.2.1 运行时初始化。
- 外部 Standalone Session 运行时接入、版本探测、状态检测。
- Kubernetes Application Runtime 配置录入，包括 namespace、serviceAccount、镜像、镜像拉取策略、服务对外类型、Kube Config、Pod Template、checkpoint/savepoint 路径；当前是 Operator Application 的基础配置准备。
- Kube Config 和 Pod Template 使用 YAML 编辑器维护，Kube Config 留空时使用后端容器内 `/root/.kube/config`。
- Kubernetes Application Runtime **K8s 配置连通性检测**：通过 fabric8 Kubernetes Client 向目标 Namespace 发送轻量 GET 请求，验证 Kube Config 和网络可达性；检测结果写回 `status` 字段，前端展示专属 Toast 提示。
- 作业运行模式字段 `runtimeMode`，SQL 作业提交时统一生成 `execution.runtime-mode`。
- Standalone REST 提交和 SQL Gateway 提交。
- JAR 作业通过 REST `/jars/upload` 和 `/jars/:jarid/run` 提交。
- SQL REST 作业通过 SQL Runner 提交，并支持作业级 JAR 依赖 `classpaths`。
- SQL Gateway 作业支持通过 `ADD JAR` 加载作业级 JAR 依赖。
- Flink JAR 资源管理：上传到 S3、登记已有 S3、列表、编辑、删除、选择绑定到作业。
- `make setup-flink-paimon` 已提供内置 Flink/Paimon 运行依赖准备能力，会下载并校验 Paimon、S3/Hadoop、CDC、Kafka、MySQL 等托管 JAR，并同步 `backend/.env` 的 Flink/Paimon 版本。
- 内置 Flink 的 runtime 级依赖通过 `deploy/docker/flink/custom-lib/rayflow/**` 管理，Compose 启动时复制到 `/opt/flink/lib`，避免覆盖 Flink 原生 lib 目录。
- 本地 Paimon Catalog 示例已切换为 RustFS：`s3://rayflow-lake/paimon` + `http://rustfs:9000`。
- Savepoint 触发、Savepoint 记录列表、Checkpoint 状态查询。
- 作业执行记录已保存提交参数快照 `submit_payload`，日志弹窗可查看 RayFlow 信息、Flink 提交参数和 Flink 错误。
- Flink REST read timeout 默认提升到 120 秒，避免 Paimon/S3 等初始化较慢时 RayFlow 过早判定提交失败。
- Cancel、状态同步、作业运行记录和运维视图基础闭环。
- `make init-test` 已包含 Standalone Runtime、Kubernetes Application Runtime、JAR 资源、批/流 SQL 作业和资源配置示例。
- OpenAPI 和前端 SDK 已覆盖 Flink Runtime、Flink Job、JAR Resource、Savepoint、Checkpoint 字段与接口。

### 部分完成

- Operator Application 当前已完成 Runtime 配置模型、UI 录入、初始化示例、K8s 连通性检测、SQL 作业镜像发布、FlinkDeployment 创建和基础状态同步闭环。
- Checkpoint 当前读取 Flink REST 保留的 Job ID 状态，并在作业侧展示最近状态；历史持久化、告警化和失败诊断视图还未展开。
- Savepoint 已有 RayFlow 触发记录；自动从 Flink 外部历史恢复的能力未做。

### 未开始

- K8s Application 事件、日志、cancel/suspend、savepoint upgrade 的完整治理。
- K8s 事件、Operator CRD 状态和 Flink Job 状态统一展示。
- 作业镜像构建到提交运行的增强治理，例如镜像 digest 固化展示、构建失败重试和发布前校验。
- Flink Home、多主版本 SQL Runner、Yarn。
- 平台内置依赖自动发布到外部 Standalone 或 K8s Runtime 的 runtime lib 目录。

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

当前不引入 Flink Home 或 Flink Client Runtime；K8s Application 统一通过 Operator CRD 提交。

下列能力不进入当前路线：

- 本地执行 `flink run` 或 `flink run-application`。
- Yarn Application 提交。
- 直接使用 Flink Java Client SDK 组装并提交作业。
- 根据 Flink 版本动态编译用户作业。

## Runtime 抽象

RayFlow 不应把 Flink 运行目标只理解为一个 REST 地址，而应抽象为 Flink Runtime。

建议 runtime 类型：

```text
standalone-session
kubernetes-application
```

当前实现：

```text
standalone-session
kubernetes-application
```

说明：

- 当前 `kubernetes-application` 运行时语义就是 Operator Application：RayFlow 通过 Kubernetes API 创建 `FlinkDeployment`，由 Flink Kubernetes Operator 管理生命周期。
- 不做产品侧 Native Application：RayFlow 不直接持有 Flink Client / CLI，也不拼装 `flink run-application`。

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
- 内置 Paimon 示例依赖 `make setup-flink-paimon` 准备 runtime 级 JAR；这些 JAR 不进入 Git。
- Paimon Catalog 本地示例必须使用容器内可达地址，例如 `http://rustfs:9000`，不要使用宿主机或外部局域网地址作为默认 seed。

## 后续阶段：K8s Application 流任务

Kubernetes Application Mode 与 Standalone Session 的核心区别：

```text
Standalone Session:
提交作业到已有 Flink 运行时。

K8s Application:
为一个作业创建独立 Flink 应用集群。
```

K8s Application 接入方式：

```text
RayFlow -> Kubernetes API -> FlinkDeployment
```

使用 Flink Kubernetes Operator，而不是在 RayFlow 后端直接拼 `flink run-application` 命令。

原因：

- Operator 负责 reconcile。
- Operator 负责 JobManager / TaskManager 生命周期。
- Operator 支持 savepoint upgrade。
- Operator 暴露标准 CRD 状态，方便 RayFlow 同步运行态。
- RayFlow 不需要持有本地 Flink Home。

当前审计结论：

- 已完成：Runtime 表结构、后端 DTO、前端表单、Kube Config / Pod Template YAML 编辑器、Namespace 连通性检测、`make init-test` 示例、作业字段 `K8S_APPLICATION` / `k8s-application`、SQL 作业镜像异步发布、构建完成后回填发布版本快照、创建 `FlinkDeployment`、基础状态同步和取消删除。
- 已保护：K8s Application 只能运行发布版本；镜像仍在构建或构建失败时会拒绝运行，不静默 fallback 到 Standalone REST。
- 未完全展开：K8s 事件/日志采集、savepoint upgrade、suspend、重启、Operator 详细诊断和镜像构建重试还未做。
- 前端现状：作业设置已开放 `K8s Application (Operator)`；资源中心 Kubernetes 运行时只保留 `Application (Operator)`。

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

### 长期方向：作业镜像优先

K8s Application 不应长期依赖平台侧 `FLINK_HOME`、手动挂载 PVC 中的 runner jar，或在 RayFlow 后端临时拼装 `flink run-application` 命令。

长期模型应是：

```text
RayFlow -> 构建/选择作业镜像 -> 推送镜像仓库 -> Kubernetes Operator -> FlinkDeployment
```

SQL Application 第一阶段优先使用作业族镜像，而不是每个 SQL 都单独构建一张镜像：

- `rayflow-flink-sql-runner`：只包含 Flink + RayFlow SQL Runner。
- `rayflow-flink-sql-paimon`：包含 SQL Runner + Paimon/S3/Hadoop 依赖。
- `rayflow-flink-sql-cdc`：包含 SQL Runner + CDC/Kafka/MySQL/SQLServer 依赖。

作业提交时，Operator 侧 `jarURI` 优先指向镜像内本地路径，例如：

```text
local:///opt/rayflow/usrlib/rayflow-flink-sql-runner.jar
```

配置中心应提供镜像仓库配置，用于后续打包推送闭环：

- registry 地址。
- namespace / project。
- 用户名。
- 密码或 token。

凭证边界：

- 镜像仓库用户名、密码、token 不应直接落到作业配置里。
- 这些凭证只服务于 RayFlow 打包作业镜像后的 push 行为。
- Kubernetes 拉取镜像凭证属于 K8s Runtime / `imagePullSecret` 配置，不放在镜像仓库连接配置里。
- 作业只记录最终镜像地址、镜像 digest、构建版本和运行配置快照。

这条路线比 PVC 挂载 runner jar 更稳定：镜像是可版本化、可审计、可回滚的交付物，也更接近 StreamPark / Flink Operator 在生产环境里的使用方式。

## 数据模型准备

### Flink Runtime / Cluster

`rf_flink_cluster` 当前包含以下字段：

```text
cluster_type          standalone / kubernetes
deployment_mode       session / application
flink_version         探测或配置的 Flink 版本
address               Standalone REST 地址；Kubernetes Application 不依赖该字段
gateway_address       SQL Gateway 地址；Kubernetes Application 不要求配置
namespace_name        K8s namespace
service_account       K8s serviceAccount
image                 Flink runtime image
image_pull_policy     IfNotPresent / Always
service_exposure_type K8s Application 服务对外类型: ClusterIP / NodePort / LoadBalancer
kube_config_ref       K8s kubeconfig；为空时使用容器默认 /root/.kube/config，也可保存 kubeconfig 内容
pod_template          K8s Application Pod Template YAML
default_parallelism   默认并行度
checkpoint_dir        默认 checkpoint 路径
savepoint_dir         默认 savepoint 路径
```

当前 UI 已按运行时类型区分配置：

- Standalone Session：REST 地址、可选 SQL Gateway、版本探测结果、状态。
- Kubernetes Application：固定为 Operator Application，只配置 namespace、serviceAccount、运行镜像、镜像拉取策略、服务对外类型、Kube Config、Pod Template。

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
- `k8s-application` 只走 Operator Application：运行发布版本时创建 `FlinkDeployment`，不静默降级到 REST。
- K8s Application 作业镜像、JAR URI、主类由发布流程生成并写入发布版本快照，运行时不要求用户手工填写。

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

runtime 级依赖单独处理：

- Paimon Catalog factory、Paimon S3、Hadoop shaded 等必须在 Flink JobManager / TaskManager / SQL Gateway 启动前进入 runtime classpath。
- 本地内置 Flink 通过 `make setup-flink-paimon` 下载到 `deploy/docker/flink/custom-lib/rayflow/**`。
- Compose 将 `FLINK_LIB_DIR` 挂载到 `/opt/rayflow/flink-lib`，启动时复制所有 `*.jar` 到 `/opt/flink/lib`。
- 不把 `custom-lib` 直接挂载覆盖 `/opt/flink/lib`，否则会隐藏 Flink 自带运行库。
- `*.jar` 被 Git 忽略，仓库只保留脚本和目录说明；新机器需要重新执行 `make setup-flink-paimon`。

K8s Application 阶段应优先支持：

- 构建或选择包含依赖的 Flink 作业镜像。
- 配置中心管理用于打包推送的镜像仓库连接。
- Operator 使用镜像内 `local://` JAR 启动 SQL Runner。
- 通过对象存储 URI 作为补充能力加载额外 JAR，不作为首选 SQL Application 路径。

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

调度逻辑：

```text
if submitType == REST:
  standalone REST

if submitType == SQL_GATEWAY:
  standalone SQL Gateway

if submitType == K8S_APPLICATION:
  Kubernetes Operator CRD
```

`K8S_APPLICATION` 当前走 `K8sOperatorApplicationSubmitter`：

- 校验 Flink Kubernetes Operator CRD 是否存在。
- 根据发布版本镜像、SQL Runner、本次作业配置和 Runtime 配置生成 `FlinkDeployment`。
- apply 到目标 namespace。
- 将 FlinkDeployment 名称作为 RayFlow 当前运行标识。
- 后台 watcher 从 `FlinkDeployment.status` 同步 RayFlow 运行状态。

不要静默 fallback 到 REST；K8s Application 失败必须明确暴露 Operator / K8s 错误。

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
- Paimon 批任务示例使用 RustFS，本地可通过 `make setup-flink-paimon && make init-test` 准备依赖与测试数据。

不做：

- K8s 提交。
- 多 Flink 主版本适配。
- Flink Home 管理。

### Phase 2：依赖资源管理

状态：已完成基础闭环；runtime 级依赖准备脚本已补齐。

目标：

- 资源中心新增 Flink JAR 资源。
- JAR 统一上传到 S3。
- 记录兼容 Flink 版本。
- 支持 JAR 作业选择主程序 JAR。
- 支持 SQL REST 作业通过 `classpaths` 加载依赖 JAR。
- 支持 SQL Gateway 作业通过 `ADD JAR` 加载依赖 JAR。
- 支持内置 Flink runtime 级托管依赖下载、校验、清理旧版本和同步 `.env`。

不做：

- 自动远程拷贝任意服务器 JAR。
- 外部 Standalone / K8s runtime 的 runtime 级 lib 自动分发。
- 自动构建 K8s 镜像。

### Phase 3：K8s Runtime 配置

状态：已完成配置录入、初始化示例和 **K8s 连通性检测**；这是 Operator Application 提交前置能力，不代表已经能运行 K8s Application 作业。

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

状态：已完成第一阶段闭环；高级治理未完成。

目标：

- Application 提交路线已收敛为 Operator Application。
- 当前 `kubernetes-application` 运行时语义为 Operator Application；Native 不进入产品界面。
- 已复用 `K8S_APPLICATION` submit type，并补齐后端 Operator 提交器。
- 已通过 Flink Kubernetes Operator 创建 `FlinkDeployment`。
- SQL 作业已优先使用发布镜像和镜像内 SQL Runner。
- 镜像构建成功后已回填作业主表和发布版本快照，运行读取发布版本镜像。
- 已支持 Application 作业基础状态同步。
- 已支持 cancel 时删除 FlinkDeployment。

后续目标：

- savepoint upgrade。
- suspend / restart。
- K8s 事件和 Operator 诊断日志展示。
- 镜像 digest 展示、构建失败重试和发布前校验。

建议落地顺序：

1. 补齐 Operator 事件和日志采集。
2. 补齐 savepoint upgrade、suspend、restart。
3. 将 FlinkDeployment CR 名称、namespace、image digest、jarURI 在执行记录中更清晰展示。
4. 增加镜像构建失败重试和构建日志查看入口。

### Phase 5：流任务治理

状态：部分完成。

目标：

- Checkpoint 当前状态视图已完成；后续补历史持久化、失败诊断和趋势。
- Savepoint 历史已完成基础记录；后续补外部历史恢复和升级治理。
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
