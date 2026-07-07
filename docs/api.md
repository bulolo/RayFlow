# RayFlow API

Base URL: `/api`

## Flink

- `GET /flink/jobs`
- `GET /flink/jobs/{id}`
- `POST /flink/jobs`
- `POST /flink/jobs:submit`
- `POST /flink/jobs/{id}:start`
- `PUT /flink/jobs/{id}`
- `POST /flink/jobs/{id}:cancel`
- `POST /flink/jobs/{id}:triggerSavepoint`
- `DELETE /flink/jobs/{id}`
- `GET /flink/runtimes`
- `POST /flink/runtimes`
- `POST /flink/runtimes/{id}:check`
- `GET /flink/jar-resources`
- `POST /flink/jar-resources`
- `POST /flink/jar-resources/upload`
- `POST /flink/sql:preview`
- `POST /flink/sql:validate`

## 任务编排

- `GET /scheduler/workflows`
- `POST /scheduler/workflows`
- `PUT /scheduler/workflows/{id}`
- `DELETE /scheduler/workflows/{id}`
- `PUT /scheduler/workflows/{id}/definition`
- `POST /scheduler/workflows/{id}:validate`
- `POST /scheduler/workflows/{id}:publish`
- `POST /scheduler/workflows/{id}:run`
- `GET /scheduler/executions`
- `GET /scheduler/executions/{id}/logs`
- `POST /scheduler/executions/{id}:cancel`

## 资源中心

- `GET /paimon/catalogs`
- `POST /paimon/catalogs`
- `POST /paimon/catalogs/{id}:check`
- `GET /fluss/clusters`
- `POST /fluss/clusters`
- `POST /fluss/clusters/{id}:check`
- `GET /fluss/topics`
- `POST /fluss/topics`
- `GET /starrocks/connections`
- `POST /starrocks/connections`
- `POST /starrocks/connections/{id}:check`

## 配置中心

- `GET /variables`
- `POST /variables`
- `GET /notification-channels`
- `POST /notification-channels`
- `GET /model-provider`
- `PUT /model-provider`
- `POST /model-provider/test`
