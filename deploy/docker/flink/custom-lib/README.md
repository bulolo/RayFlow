# Flink custom libraries

Put local Flink extension JARs in this directory for the built-in Docker Flink runtime.

`docker-compose.dev.yml` and `deploy/docker-compose.yml` mount this directory to
`/opt/rayflow/flink-lib` and recursively copy `*.jar` files into `/opt/flink/lib`
before starting JobManager, TaskManager, and SQL Gateway.

Directory layout:

```text
custom-lib/
  rayflow/      RayFlow-managed runtime jars. `make setup-flink-paimon` owns this tree.
    paimon/     Paimon runtime, action, and Paimon S3 jars
    cdc/        Flink CDC SQL connector jars
    messaging/  Message queue SQL connector jars, such as Kafka
    jdbc/       JDBC database drivers
    filesystem/ Hadoop/filesystem integration jars
  custom/       User-provided jars. This tree is never cleaned by setup.
```

Use the project command to prepare the default local runtime dependencies:

```bash
make setup-flink-paimon
```

In an interactive terminal, the command prompts for versions and lets you press Enter
to use defaults. In CI or non-interactive shells, it uses defaults automatically.

The default profile targets Flink `2.2.1` and Paimon `1.4.2`. Override versions
non-interactively when needed:

```bash
make setup-flink-paimon FLINK_VERSION=2.2 PAIMON_VERSION=1.4.2
```

Minor-line values such as `2.2` are resolved to the latest available patch version
from Maven metadata, then written to `backend/.env` as an exact runtime version.
`PAIMON_FLINK_MINOR` is derived automatically, for example `2.2.1` -> `2.2`.
Override it only when testing a non-standard Paimon/Flink adapter.

The command downloads and validates Paimon, Paimon S3, Flink CDC connectors, Kafka SQL
connector, MySQL driver, and the shaded Hadoop runtime jar. It skips existing files
unless `FORCE=1` is provided.

When versions change, the command removes stale jars managed by this script by default
to avoid loading incompatible connector versions together. Custom jars with unrelated
names are preserved. Disable cleanup only for diagnostics:

```bash
make setup-flink-paimon CLEAN_STALE=0
```

Place your own extension jars under `custom/`:

```text
custom-lib/custom/company-udf.jar
custom-lib/custom/experimental/my-connector.jar
```

The Docker Compose runtime recursively loads all `*.jar` files under `custom-lib`, so
custom jars are loaded automatically. The setup script does not remove files under
`custom/`.

Verify the supported Flink 2.x + Paimon 1.x artifact matrix without downloading all
large jars:

```bash
make verify-flink-paimon-matrix
```

Run a full download-and-jar-validation matrix only when explicitly needed:

```bash
DOWNLOAD=1 make verify-flink-paimon-matrix
```

Do not mount this directory directly over `/opt/flink/lib`; doing so would hide Flink's
built-in runtime libraries.
