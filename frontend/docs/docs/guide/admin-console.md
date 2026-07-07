# 控制台总览

Admin 控制台是 RayFlow 的主要操作入口。日常使用建议按以下路径理解：

1. **总览**：查看平台状态与常用入口。
2. **开发运维**：开发、提交和运维 Flink SQL/JAR 作业。
3. **任务调度**：把开发运维内的 Flink 作业编排成 DAG 工作流。
4. **资源中心**：管理 Flink、Paimon、StarRocks、Fluss 和 JAR 资源。
5. **配置中心**：维护变量、用户、通知渠道、模型提供商和默认参数。
6. **平台管理**：超级管理员维护组织和内置运行时。

## 登录

开发环境默认账号：

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 超级管理员 | `superadmin@rayflow.cn` | `admin123` |
| 默认租户管理员 | `admin@rayflow.cn` | `admin123` |

> 生产环境必须通过 `.env` 显式配置初始管理员账号和强密码。

## 总览页

总览页用于快速确认平台是否可用，并跳转到常用模块。

![控制台总览](/screenshots/8.png)

你可以重点关注：

- Flink 作业状态和最近操作。
- 资源中心连接状态。
- 任务调度执行情况。
- 当前组织、版本和平台管理入口。

## 开发运维入口

开发运维有两个视图：

| 视图 | 地址 | 用途 |
| --- | --- | --- |
| 开发视图 | `/development?view=develop` | 编写 SQL/JAR 作业、维护变量、校验、格式化和提交。 |
| 运维视图 | `/development?view=ops` | 查看作业运行状态、Flink Job ID、启动/取消和筛选。 |

开发视图支持直达具体作业：

```text
/development?view=develop&jobId=123
```

## 资源中心入口

资源中心每个 Tab 都有可直达地址：

| 资源 | 地址 |
| --- | --- |
| Paimon | `/resource-center?tab=paimon` |
| StarRocks | `/resource-center?tab=starrocks` |
| Fluss | `/resource-center?tab=fluss` |
| Flink 运行时 | `/resource-center?tab=flink` |
| Flink JAR | `/resource-center?tab=flink-jars` |

## 配置中心入口

配置中心用于维护租户内配置。每个 Tab 也支持 URL 直达，刷新页面不会回到默认 Tab。

常见配置包括：

- 用户管理。
- 变量管理。
- 通知渠道。
- 模型提供商。
- 默认参数。

## 超级管理员与租户管理员

超级管理员不是某个租户内的普通用户，它可以跨租户进入平台管理和组织管理。租户管理员只管理当前组织内的用户、资源和配置。

平台创建组织时必须指定一个初始租户管理员，避免出现没有租户管理员的组织。
