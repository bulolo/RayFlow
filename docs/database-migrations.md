# 数据库迁移规范

## 目标

RayFlow 的数据库结构变更统一通过 Flyway 管理，避免手工 SQL、测试数据脚本和部署编排同时维护表结构，导致环境漂移。

## 唯一结构来源

- 所有表结构、索引、约束、列变更必须放在 `backend/rayflow-server/src/main/resources/db/migration`
- `scripts/init-test.sql` 只允许维护测试/示例数据
- `scripts/init-db.sql` 已废弃，不再承载任何可执行 DDL

## 文件命名

- 版本迁移：`V<版本号>__<描述>.sql`
- 重复迁移：`R__<描述>.sql`
- 版本分支采用语义化版本号，例如 `0.0.4`
- 对应版本迁移示例：`V0.0.4__add_tenant_indexes.sql`

## 初始基线

- 项目正式使用前，数据库初始结构统一收敛在 `V0.0.1__init_schema.sql`
- 该文件是全新环境的唯一初始化脚本，包含当前版本需要的所有表、索引和约束
- 项目正式发布后，已发布 migration 禁止回写，只允许新增后续版本文件

## 分支约定

- 在版本分支上创建迁移，例如 `0.0.4`
- 当前版本分支内新增的结构变更，优先落在与该分支同版本号的 migration 中
- 已发布 migration 禁止回写，只允许新增后续版本文件

## 编写原则

- 一个 migration 只处理一组清晰的结构变更
- 大表变更、长事务、批量数据修复需要单独评估锁影响
- 结构变更和测试数据初始化分离
- 禁止把 schema 变更塞回 `init-test.sql`

## 常用命令

```bash
make migration-new desc=add_tenant_indexes
make migration-verify
make init-test
```

## 校验项

`make migration-verify` 会检查：

- `scripts/init-db.sql` 不包含可执行 DDL
- `scripts/init-test.sql` 不包含 DDL
- migration 文件命名是否合法
- migration version 是否重复
