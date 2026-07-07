<div align="center">

# RayFlow

**Enterprise-grade Apache Flink SQL/JAR Development, Resource Management, and Job Scheduling Platform**

RayFlow is a unified dashboard for Flink job development, runtime hosting, resource connection management, Paimon/StarRocks database browsing, workflow scheduling, and execution auditing. It comes with a built-in Docker development environment, pre-integrating PostgreSQL, Redis, RustFS, Flink, Admin Console, Docs, and Nginx Gateway.

[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.3.6-6DB33F?logo=spring-boot)](https://spring.io/)
[![Java](https://img.shields.io/badge/Java-17-007396?logo=openjdk)](https://openjdk.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-000000?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Flink](https://img.shields.io/badge/Flink-2.2.1-E6522E?logo=apache-flink)](https://flink.apache.org/)
[![Paimon](https://img.shields.io/badge/Paimon-1.4.2-0B7285)](https://paimon.apache.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)

English | [简体中文](./README.md)

[Console](http://localhost:8080) | [Documentation](http://localhost:8003) | [Flink UI](http://localhost:8081) | [RustFS Console](http://localhost:9011)

<p>
  <a href="https://github.com/bulolo/RayFlow">
    <img src="https://img.shields.io/badge/Star-Project-yellow?style=for-the-badge&logo=github" alt="Star">
  </a>
</p>

**If RayFlow is helpful to you, please give us a Star in the top right corner.**

</div>

---

## Features

- **Unified Lifecycle**: Develop, run, manage connections, schedule workflows, and audit logs all inside a single enterprise dashboard.
- **Out of the Box Flink/Paimon**: One command `make setup-flink-paimon` interactively downloads all Flink, Paimon, CDC, Kafka, JDBC, and filesystem dependencies.
- **Lakehouse Explorer**: Browse Paimon metadata, table schemas, snapshots, manifests, indexes, and raw data files. Preview StarRocks databases, tables, partitions, and execute SQL statements.
- **SDK First**: Backend OpenAPI schema automatically drives frontend TypeScript SDK generation, preventing type drifting and path typos.
- **Controlled Upgrades**: Database schemas are managed using Flyway migrations. Flink/Paimon version matrix is checkable, separating RayFlow managed dependencies from user custom libraries.
- **Developer Friendly**: A single Makefile encapsulates environment init, building, lint checking, SDK generation, and local runtime dependencies.

---

## Project Position

RayFlow is more than just a Flink SQL editor. It is a complete pipeline for developing, operating, and orchestrating stream/batch computation jobs:

- **Unified Ops & Dev**: Develop SQL/JAR jobs, track Flink Job IDs, check status, trigger savepoints, and jump to the Flink Web UI directly.
- **Resource Center**: Manage connection metadata for Flink runtimes, Paimon catalogs, StarRocks connectors, and JAR libraries.
- **Configuration Center**: Centralized administration for tenants, user permissions, notification channels, AI model providers, and system parameters.
- **DAG Workflow Scheduling**: Orchestrate Flink jobs with dependency trees, execute cron tasks, and view execution step logs.
- **Lakehouse Explorer**: Browse Paimon snapshot chains and manifests; preview StarRocks tables and partition splits.

---

## Technology Stack

RayFlow integrates standard components to form the stream-batch data lakehouse control plane:

- **Backend**: Java 17, Spring Boot 3.3.6, MyBatis-Plus, Flyway, Maven
- **Frontend Admin**: Next.js 16.1.6, React 19.2, TypeScript 5.9, React Query, Orval SDK, Tailwind CSS, CodeMirror
- **Documentation**: VitePress 2.0 alpha
- **Data Layer**: PostgreSQL 16, Redis 7, RustFS
- **Engine & Storage**: Flink 2.2.1, Paimon 1.4.2, Flink CDC 3.5.0, Kafka SQL Connector 5.0.0-2.2
- **Gateway**: Nginx (Nginx reverse proxies all local endpoints under `http://localhost:8080`)

---

## Quick Start

### 1. Requirements

- Docker Desktop / Docker Engine
- Docker Compose v2
- Make
- Java 17
- Maven 3.9+
- Node.js 22+
- pnpm 10+

### 2. Initialize Configurations

```bash
make dev-init
```

This generates `backend/.env` from the template [backend/.env.example](./backend/.env.example) containing default parameters.

### 3. Setup Flink/Paimon Dependencies

```bash
make setup-flink-paimon
```

Press Enter to accept defaults when prompted. For non-interactive settings:

```bash
make setup-flink-paimon FLINK_VERSION=2.2 PAIMON_VERSION=1.4.2
```

### 4. Start Development Environment

```bash
make dev-up
```

Default Endpoints:

| Service | Endpoint |
| --- | --- |
| Admin Console | http://localhost:8080 |
| Backend API | http://localhost:3000 |
| Flink Web UI | http://localhost:8081 |
| Flink SQL Gateway | http://localhost:8083 |
| RustFS Console | http://localhost:9011 |
| Docs Site | http://localhost:8003 |

Default Credentials:

| Role | Username | Password |
| --- | --- | --- |
| Super Admin | `superadmin@rayflow.cn` | `admin123` |
| Tenant Admin | `admin@rayflow.cn` | `admin123` |

### 5. Load Demo Data

```bash
make init-test
```

This writes seed tenants, workspace logs, variables, Flink SQL demos, and Paimon batch queries into the database.

---

## Common Makefile Commands

| Command | Description |
| --- | --- |
| `make help` | View all available project tasks |
| `make dev-init` | Initialize local development configurations |
| `make setup-flink-paimon` | Download Flink/Paimon/CDC/Kafka jars |
| `make verify-flink-libs` | Validate custom-lib files are readable |
| `make dev-up` | Start development stack in foreground |
| `make dev-down` | Stop development stack |
| `make check-all` | Run full backend compiles and frontend lint checks |
| `make gen-sdk` | Generate frontend TypeScript SDK client |

---

## License & Usage

This project is released under the **RayFlow Open Source License** (see [LICENSE](./LICENSE)). It extends Apache 2.0 with the following additions:
- Free for personal use and internal enterprise business scenarios.
- Do not remove or alter any RayFlow logos, branding tags, or attribution marks (e.g. "Powered by RayFlow") in the UI, logs, or API headers.
- Commercial hosting of this software as a multi-tenant SaaS or managed Flink platform is strictly prohibited unless separate commercial terms are granted by the project team.

---

## Contact

- **Feedback**: [GitHub Issues](https://github.com/bulolo/RayFlow/issues)
- **Business Inquiries**: support@bulolo.cn
- **WeChat Community**: Scan QR code in [README.md](./README.md#联系方式) (using remark `RayFlow`)
