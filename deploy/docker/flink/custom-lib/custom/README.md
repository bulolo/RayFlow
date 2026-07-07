# Custom Flink Libraries

Put user-provided Flink extension jars in this directory.

Examples:

```text
custom/company-udf.jar
custom/experimental/my-connector.jar
```

`make setup-flink-paimon` only manages `../rayflow/` and does not clean this directory.
Docker Compose recursively loads all `*.jar` files under `deploy/docker/flink/custom-lib`,
so jars placed here are available to the built-in Flink runtime after restart.

RayFlow setup commands do not validate jars in this directory. Keep custom jars
compatible with the selected Flink runtime version.
