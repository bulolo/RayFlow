# 技术栈集成

RayFlow 的技术栈围绕 Flink、Paimon、StarRocks、Fluss 展开。

<div class="tech-stack-grid">
  <a class="tech-stack-card" href="https://flink.apache.org/" target="_blank">
    <img src="/tech-logos/flink.png" alt="Apache Flink">
    <strong>Apache Flink</strong>
    <span>作业运行时、SQL Gateway、REST 提交和状态同步。</span>
  </a>
  <a class="tech-stack-card" href="https://paimon.apache.org/" target="_blank">
    <img src="/tech-logos/paimon-icon.svg" alt="Apache Paimon">
    <strong>Apache Paimon</strong>
    <span>湖仓 Catalog、表定义、快照、Manifest、Index 与文件浏览。</span>
  </a>
  <a class="tech-stack-card" href="https://www.starrocks.io/" target="_blank">
    <img src="/tech-logos/starrocks-icon.svg" alt="StarRocks">
    <strong>StarRocks</strong>
    <span>实时分析库浏览、分区、预览、SQL 命令和物化视图管理。</span>
  </a>
  <a class="tech-stack-card" href="https://fluss.apache.org/" target="_blank">
    <img src="/tech-logos/fluss-icon.svg" alt="Apache Fluss">
    <strong>Apache Fluss</strong>
    <span>湖流一体方向的实时数据通道与 Topic 资源入口。</span>
  </a>
</div>

## Apache Flink

RayFlow 通过 Flink REST API 和 SQL Gateway 集成 Flink。

主要能力：

- Standalone Session Runtime。
- SQL REST Runner。
- SQL Gateway。
- JAR 作业提交。
- Cancel、状态同步、Flink UI 跳转。
- 批任务完成状态检测。

内置 Flink 默认使用 2.2.1，可通过 `make setup-flink-paimon` 准备 Paimon、CDC、Kafka、JDBC 和 filesystem 依赖。

## Apache Paimon

Paimon 在 RayFlow 中承担湖仓表存储和元数据浏览角色。

当前采用两段式能力：

- 元数据浏览优先使用 Paimon Java API，减少对 Flink SQL Gateway 的依赖。
- 数据预览和复杂查询继续交给 Flink SQL Gateway。

支持内容：

- database/table。
- schema。
- table definition。
- snapshot。
- manifest、index-manifest、index 文件。
- S3 表目录文件浏览。

## StarRocks

StarRocks 用于实时分析库资源浏览和常规管理。

支持内容：

- Database/Object 树。
- 表、视图、物化视图定义。
- Schema 和分区。
- 数据预览。
- SQL 命令窗口。
- 物化视图刷新、强制刷新、取消刷新。
- 表/物化视图删除和清空。

## Apache Fluss

Fluss 在 RayFlow 中作为湖流一体方向的实时数据通道资源入口。

当前主要能力：

- Fluss 集群登记。
- 连接检测。
- Topic 管理。

后续可继续扩展 Schema、权限、监控和消费链路治理。

## 安全原则

- 连接密钥只保存在后端。
- 前端只展示脱敏状态。
- 所有运行态操作通过后端服务层封装，便于审计和权限控制。
- 前端接口调用通过 OpenAPI SDK，减少手写 URL 和类型漂移。

<style>
.tech-stack-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 1rem;
  margin: 1.25rem 0 2rem;
}

.tech-stack-card {
  display: flex;
  min-height: 210px;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.85rem;
  padding: 1.25rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  background:
    radial-gradient(circle at 12% 10%, rgba(50, 125, 140, 0.12), transparent 34%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.92));
  box-shadow: 0 12px 34px rgba(15, 23, 42, 0.07);
  color: var(--vp-c-text-1);
  text-decoration: none !important;
}

.tech-stack-card img {
  width: 100%;
  height: 72px;
  object-fit: contain;
  object-position: center;
}

.tech-stack-card strong {
  font-size: 1.05rem;
}

.tech-stack-card span {
  color: var(--vp-c-text-2);
  font-size: 0.92rem;
  line-height: 1.65;
}
</style>
