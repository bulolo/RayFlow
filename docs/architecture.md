# RayFlow Architecture

RayFlow uses a three-layer structure:

- `backend`: Spring Boot API service and Flink integration modules.
- `frontend/admin`: Next.js management console.
- `frontend/docs`: VitePress documentation site.
- `deploy`: Docker, Nginx, and production deployment templates.

Core domains:

- Flink jobs, runtimes, SQL preview, Savepoint, and job state sync.
- Scheduler workflows, workflow versions, executions, node logs, and execution logs.
- Resource Center: Paimon Catalogs, Fluss clusters/topics, StarRocks connections, Flink runtimes, and Flink JAR resources.
- Settings Center: variables, notification channels, timezone, and OpenAI-compatible model provider config.
- Tenants and users.

The current Flink execution model is:

```text
RayFlow -> Flink REST API / SQL Gateway -> existing Flink runtime
```

Flink JAR resources are stored in S3-compatible object storage. JAR jobs use the selected S3 JAR as the main artifact; SQL REST jobs pass selected JARs via Flink REST `classpaths`; SQL Gateway jobs load selected JARs through `ADD JAR`.
