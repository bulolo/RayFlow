---
layout: home

hero:
  name: "RayFlow"
  text: "企业级 Flink 流批一体开发运维平台"
  tagline: 面向 Apache Flink、Apache Paimon、StarRocks 与 Apache Fluss，提供作业开发、运行运维、资源浏览、任务编排、配置中心和执行审计的一体化控制台。
  image:
    src: /logo.svg
    alt: RayFlow
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: 使用指南
      link: /guide/admin-console
    - theme: alt
      text: 部署环境
      link: /deployment/docker

features:
  - icon: 🧩
    title: 开发运维闭环
    details: Flink SQL/JAR 作业开发、变量替换、SQL 校验、格式化、预览、提交、状态追踪与 Flink UI 跳转在同一页面完成。
  - icon: 🗂️
    title: 资源中心
    details: 统一管理 Flink 运行时、Paimon Catalog、StarRocks 数据源、Fluss 集群和 Flink JAR 资源。
  - icon: 🧭
    title: 任务调度
    details: 以开发运维中的 Flink 作业为原子节点，使用 DAG 串行编排批处理链路，并提供执行记录和日志审计。
  - icon: 🔎
    title: 湖仓与数仓浏览
    details: Paimon 支持库表、Schema、表定义、快照、manifest、index 和文件浏览；StarRocks 支持库表、分区、预览和物化视图操作。
  - icon: 🛡️
    title: 多租户管理
    details: 超级管理员跨租户管理，租户管理员维护组织内用户、资源、配置和权限边界。
  - icon: 🛠️
    title: 工程规范
    details: Flyway 管理数据库迁移，OpenAPI 生成前端 SDK，Makefile 收口启动、检查、格式化、依赖准备和测试数据初始化。
---

<div class="home-content">

## 技术栈

<div class="tech-stack-grid">
  <a class="tech-stack-card" href="https://flink.apache.org/" target="_blank">
    <img class="no-zoom" src="/tech-logos/flink.png" alt="Apache Flink">
    <strong>Apache Flink</strong>
    <span>流批一体计算运行时，承载 SQL/JAR 作业提交、状态同步和 Flink UI 跳转。</span>
  </a>
  <a class="tech-stack-card" href="https://paimon.apache.org/" target="_blank">
    <img class="no-zoom" src="/tech-logos/paimon-icon.svg" alt="Apache Paimon">
    <strong>Apache Paimon</strong>
    <span>湖仓表存储，支持 Catalog、库表、Schema、快照、Manifest 和文件浏览。</span>
  </a>
  <a class="tech-stack-card" href="https://www.starrocks.io/" target="_blank">
    <img class="no-zoom" src="/tech-logos/starrocks-icon.svg" alt="StarRocks">
    <strong>StarRocks</strong>
    <span>实时分析库，提供库表浏览、分区、预览、SQL 命令和物化视图操作。</span>
  </a>
  <a class="tech-stack-card" href="https://fluss.apache.org/" target="_blank">
    <img class="no-zoom" src="/tech-logos/fluss-icon.svg" alt="Apache Fluss">
    <strong>Apache Fluss</strong>
    <span>湖流一体实时数据通道方向，提供集群登记与 Topic 管理入口。</span>
  </a>
</div>

## 产品预览

<div class="screenshot-grid">
  <figure>
    <div class="img-wrapper">
      <img src="/screenshots/8.png" alt="控制台总览">
    </div>
    <figcaption>
      <strong>控制台总览</strong>
      <span>汇总作业、资源、调度与近期操作。</span>
    </figcaption>
  </figure>
  <figure>
    <div class="img-wrapper">
      <img src="/screenshots/3.png" alt="资源中心">
    </div>
    <figcaption>
      <strong>资源中心</strong>
      <span>集中管理 Flink、Paimon、StarRocks、Fluss 和 JAR 资源。</span>
    </figcaption>
  </figure>
  <figure>
    <div class="img-wrapper">
      <img src="/screenshots/1.png" alt="开发作业编辑器">
    </div>
    <figcaption>
      <strong>开发作业编辑器</strong>
      <span>Flink SQL/JAR 作业研发、变量、校验和提交。</span>
    </figcaption>
  </figure>
  <figure>
    <div class="img-wrapper">
      <img src="/screenshots/2.png" alt="开发运维视图">
    </div>
    <figcaption>
      <strong>开发运维视图</strong>
      <span>作业状态、Flink Job ID、运行操作和运维筛选。</span>
    </figcaption>
  </figure>
  <figure>
    <div class="img-wrapper">
      <img src="/screenshots/5.png" alt="任务调度">
    </div>
    <figcaption>
      <strong>任务调度</strong>
      <span>基于 DAG 编排开发运维内的 Flink 作业。</span>
    </figcaption>
  </figure>
  <figure>
    <div class="img-wrapper">
      <img src="/screenshots/4.png" alt="Paimon 湖仓浏览">
    </div>
    <figcaption>
      <strong>Paimon 湖仓浏览</strong>
      <span>浏览库表、表定义、快照、manifest 和文件。</span>
    </figcaption>
  </figure>
  <figure>
    <div class="img-wrapper">
      <img src="/screenshots/6.png" alt="StarRocks 管理">
    </div>
    <figcaption>
      <strong>StarRocks 管理</strong>
      <span>库表浏览、SQL 命令、数据预览、分区和物化视图操作。</span>
    </figcaption>
  </figure>
  <figure>
    <div class="img-wrapper">
      <img src="/screenshots/7.png" alt="配置中心">
    </div>
    <figcaption>
      <strong>配置中心</strong>
      <span>组织、用户、租户和平台配置的统一管理入口。</span>
    </figcaption>
  </figure>
</div>

## 建议阅读路径

1. 从 [快速开始](/guide/quick-start) 启动本地环境并初始化测试数据。
2. 阅读 [控制台总览](/guide/admin-console)，了解页面入口和基础操作。
3. 阅读 [开发运维](/guide/flink-submission)，掌握 SQL/JAR 作业生命周期。
4. 阅读 [资源中心](/guide/resource-center)，配置 Paimon、StarRocks、Flink 和 JAR 资源。
5. 阅读 [任务调度](/guide/scheduler)，用 DAG 编排多个 Flink 批任务。

</div>

<style>
.home-content {
  max-width: 1180px;
  margin: 0 auto;
  padding: 2rem 24px 3rem;
}

.home-content h2 {
  margin-top: 2.5rem;
  margin-bottom: 1rem;
  font-size: 1.55rem;
  font-weight: 700;
  border-bottom: 1px solid var(--vp-c-divider);
  padding-bottom: 0.55rem;
}

.tech-stack-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 1rem;
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

.screenshot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.25rem;
}

.screenshot-grid figure {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
}

.screenshot-grid .img-wrapper {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}

.screenshot-grid .img-wrapper::after {
  position: absolute;
  right: 0.75rem;
  bottom: 0.65rem;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #fff;
  content: "点击放大";
  font-size: 0.72rem;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.screenshot-grid figure:hover .img-wrapper::after {
  opacity: 1;
}

.screenshot-grid img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  object-position: top center;
  border-radius: 10px;
  transition: transform 0.24s ease;
}

.screenshot-grid figure:hover img {
  transform: scale(1.02);
}

.screenshot-grid figcaption {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.screenshot-grid strong {
  font-size: 1rem;
}

.screenshot-grid span {
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}
</style>
