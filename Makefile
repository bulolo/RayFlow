# ==============================================================================
# Makefile - RayFlow 项目管理脚本
# ==============================================================================
# 支持环境: macOS, Linux
# 核心功能: 开发环境启停, 生产环境部署, 静态站点, 后端/前端构建, 代码生成
# ==============================================================================

.PHONY: help \
	check-dev-env dev-init dev-up dev-down dev-build dev-rebuild dev-restart dev-restart-backend dev-logs dev-logs-backend dev-clean dev-purge \
	check-prod-env prod-init prod-up prod-up-build prod-down prod-rebuild prod-restart prod-logs prod-clean \
	prod-static-up prod-static-up-build prod-static-down prod-static-logs \
	setup-flink-paimon verify-flink-libs verify-flink-paimon-matrix \
	build-backend build-admin build-docs build-website \
	run-backend run-admin run-docs run-website \
	format check-admin check-website check-docs check-backend check-all \
	gen-swagger gen-sdk init init-test migrate-streampark-batch migration-new migration-verify publish-ce-github set-version

# ------------------------------------------------------------------------------
# 基础配置
# ------------------------------------------------------------------------------
DEV_COMPOSE := docker compose --env-file backend/.env -f docker-compose.dev.yml
PROD_COMPOSE := docker compose --env-file deploy/.env -f deploy/docker-compose.yml
STATIC_COMPOSE := docker compose --env-file deploy/.env -f deploy/docker-compose.static.yml
OPENAPI_URL ?= http://localhost:3000/v3/api-docs
TEST_SQL ?= scripts/init-test.sql
MAVEN ?= mvn
BACKEND_JAVA_HOME ?= $(shell /usr/libexec/java_home -v 17 2>/dev/null || true)
FLINK_VERSION ?= 2.2
PAIMON_VERSION ?= 1.4.2
PAIMON_FLINK_MINOR ?= 2.2
FLINK_CDC_VERSION ?= 3.5.0
FLINK_KAFKA_CONNECTOR_VERSION ?= 5.0.0-2.2
MYSQL_DRIVER_VERSION ?= 8.0.27
FLINK_HADOOP_SHADED_VERSION ?= 2.8.3-10.0
FLINK_LIB_DIR ?= deploy/docker/flink/custom-lib
FORCE ?= 0
CLEAN_STALE ?= 1
SETUP_FLINK_PAIMON_INTERACTIVE ?= auto
SETUP_FLINK_PAIMON_HAS_VERSION_ARG := $(filter command line,$(origin FLINK_VERSION) $(origin PAIMON_VERSION) $(origin PAIMON_FLINK_MINOR) $(origin FLINK_CDC_VERSION) $(origin FLINK_KAFKA_CONNECTOR_VERSION) $(origin MYSQL_DRIVER_VERSION) $(origin FLINK_HADOOP_SHADED_VERSION))

# ------------------------------------------------------------------------------
# 帮助信息
# ------------------------------------------------------------------------------
help:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo " 🐟 RayFlow - Flink/Fluss/Paimon 任务发布管理平台"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo " 🛠️  [环境配置]"
	@echo "  make dev-init            初始化开发环境配置 (复制 .env.example)"
	@echo "  make prod-init           初始化生产环境配置"
	@echo "  make setup-flink-paimon  下载并校验内置 Flink/Paimon 运行依赖"
	@echo "  make verify-flink-libs   校验 deploy/docker/flink/custom-lib 下的 JAR"
	@echo "  make verify-flink-paimon-matrix 校验 Flink 2.x + Paimon 1.x 可用矩阵"
	@echo ""
	@echo " 🛠️  [开发运行]"
	@echo "  make dev-up              启动全栈开发环境 (Docker Compose)"
	@echo "  make dev-down            停止开发环境"
	@echo "  make dev-build           构建开发环境镜像"
	@echo "  make dev-rebuild         重建并后台启动开发环境"
	@echo "  make dev-restart         重启开发环境所有服务"
	@echo "  make dev-restart-backend 仅重启后端服务"
	@echo "  make dev-logs            查看开发环境日志"
	@echo "  make dev-logs-backend    查看后端服务日志"
	@echo "  make dev-clean           清理开发环境业务数据卷 (保留 Maven 缓存)"
	@echo "  make dev-purge           彻底清理开发环境 (包含 Maven 缓存)"
	@echo ""
	@echo " 🚀 [生产环境]"
	@echo "  make prod-init           初始化生产环境配置"
	@echo "  make prod-up             启动生产集群 (拉取远端镜像)"
	@echo "  make prod-up-build       本地构建并启动生产集群"
	@echo "  make prod-rebuild        无缓存重新构建并启动生产环境"
	@echo "  make prod-down           停止生产集群"
	@echo "  make prod-restart        重启生产环境所有服务"
	@echo "  make prod-logs           查看生产环境日志"
	@echo "  make prod-clean          清理生产环境 (含数据卷，危险)"
	@echo ""
	@echo " 🌐 [静态站点]"
	@echo "  make prod-static-up       启动 Docs 文档站 + Website 官网 (拉取远端镜像)"
	@echo "  make prod-static-up-build 本地构建并启动 Docs 文档站 + Website 官网"
	@echo "  make prod-static-down     停止 Docs 文档站 + Website 官网"
	@echo "  make prod-static-logs     查看 Docs 文档站 + Website 官网日志"
	@echo ""
	@echo " 🔨 [本地构建]"
	@echo "  make build-backend       编译后端 (Maven)"
	@echo "  make build-admin         构建前端 Admin"
	@echo "  make build-docs          构建 Docs 文档站"
	@echo "  make build-website       构建前端 Website"
	@echo ""
	@echo " [代码质量]"
	@echo "  make format              自动修复可格式化代码 (Admin/Website ESLint --fix)"
	@echo "  make check-admin         检查 Admin 前端 (lint + typecheck)"
	@echo "  make check-website       检查 Website 前端 (lint + typecheck)"
	@echo "  make check-docs          检查 Docs 文档站构建"
	@echo "  make check-backend       检查后端编译与迁移规范"
	@echo "  make check-all           全量检查 (后端 + Admin + Website + Docs + diff 空白)"
	@echo ""
	@echo " 🚀 [本地运行]"
	@echo "  make run-backend         本地启动后端"
	@echo "  make run-admin           本地启动 Admin 前端"
	@echo "  make run-docs            本地启动 Docs 文档站"
	@echo "  make run-website         本地启动 Website"
	@echo "  make gen-swagger         从后端 /v3/api-docs 拉取 OpenAPI"
	@echo "  make gen-sdk             从 OpenAPI 生成 Admin TypeScript SDK"
	@echo "  make init                初始化全部测试数据"
	@echo "  make init-test           初始化全部测试数据"
	@echo "  make migrate-streampark-batch 迁移 StreamPark batch 标签作业到开发作业 (默认真实写入；DRY_RUN=1 预览)"
	@echo "  make migration-new desc=add_xxx  按当前版本分支创建 Flyway migration 模板"
	@echo "  make migration-verify    校验数据库迁移规范与脚本边界"
	@echo ""
	@echo " 🚀 [版本管理]"
	@echo "  make set-version v=0.0.5 统一修改项目版本号"
	@echo ""

# ------------------------------------------------------------------------------
# 开发/生产环境初始化
# ------------------------------------------------------------------------------
check-dev-env:
	@if [ ! -f "backend/.env" ]; then \
		echo "❌ [RayFlow] 错误: 未检测到开发环境配置文件 backend/.env"; \
		echo "💡 [RayFlow] 请先执行 'make dev-init' 生成配置文件。"; \
		exit 1; \
	fi

dev-init:
	@echo "🔧 [RayFlow] 正在初始化开发环境配置..."
	@if [ ! -f "backend/.env" ]; then \
		cp backend/.env.example backend/.env; \
		echo "✅ 开发环境配置文件已生成: backend/.env"; \
	else \
		echo "💡 backend/.env 已存在，跳过拷贝。"; \
	fi
	@if grep -q '^DB_HOST=localhost' backend/.env; then \
		sed -i.bak 's|^DB_HOST=.*|DB_HOST=postgres|' backend/.env && rm -f backend/.env.bak; \
	elif ! grep -q '^DB_HOST=' backend/.env; then \
		echo 'DB_HOST=postgres' >> backend/.env; \
	fi
	@if grep -q '^DB_PORT=5433' backend/.env; then \
		sed -i.bak 's|^DB_PORT=.*|DB_PORT=5432|' backend/.env && rm -f backend/.env.bak; \
	elif ! grep -q '^DB_PORT=' backend/.env; then \
		echo 'DB_PORT=5432' >> backend/.env; \
	fi
	@if grep -q '^REDIS_HOST=localhost' backend/.env; then \
		sed -i.bak 's|^REDIS_HOST=.*|REDIS_HOST=redis|' backend/.env && rm -f backend/.env.bak; \
	elif ! grep -q '^REDIS_HOST=' backend/.env; then \
		echo 'REDIS_HOST=redis' >> backend/.env; \
	fi
	@sed -E -i.bak '/^(CI|NEXT_PUBLIC_API_BASE_URL|NEXT_PUBLIC_APP_VERSION|RAYFLOW_API_PROXY_TARGET)=/d' backend/.env && rm -f backend/.env.bak
	@if ! grep -q '^JWT_SECRET=' backend/.env; then \
		echo 'JWT_SECRET=rayflow-dev-jwt-secret-at-least-32-bytes' >> backend/.env; \
	elif grep -q '^JWT_SECRET=change-this-to-a-random-secret-at-least-32-bytes' backend/.env; then \
		sed -i.bak 's|^JWT_SECRET=.*|JWT_SECRET=rayflow-dev-jwt-secret-at-least-32-bytes|' backend/.env && rm -f backend/.env.bak; \
	fi
	@if ! grep -q '^RAYFLOW_SUPER_ADMIN_USERNAME=' backend/.env; then \
		echo 'RAYFLOW_SUPER_ADMIN_USERNAME=superadmin@rayflow.cn' >> backend/.env; \
	fi
	@if ! grep -q '^RAYFLOW_DEFAULT_TENANT_ADMIN_USERNAME=' backend/.env; then \
		echo 'RAYFLOW_DEFAULT_TENANT_ADMIN_USERNAME=admin@rayflow.cn' >> backend/.env; \
	fi
	@if ! grep -q '^RAYFLOW_TIMEZONE=' backend/.env; then \
		echo 'RAYFLOW_TIMEZONE=Asia/Shanghai' >> backend/.env; \
	fi
	@if ! grep -q '^FLINK_VERSION=' backend/.env; then \
		echo 'FLINK_VERSION=2.2.1' >> backend/.env; \
	fi
	@if ! grep -q '^PAIMON_VERSION=' backend/.env; then \
		echo 'PAIMON_VERSION=1.4.2' >> backend/.env; \
	fi
	@if ! grep -q '^PAIMON_FLINK_MINOR=' backend/.env; then \
		echo 'PAIMON_FLINK_MINOR=2.2' >> backend/.env; \
	fi
	@if ! grep -q '^FLINK_CDC_VERSION=' backend/.env; then \
		echo 'FLINK_CDC_VERSION=3.5.0' >> backend/.env; \
	fi
	@if ! grep -q '^FLINK_KAFKA_CONNECTOR_VERSION=' backend/.env; then \
		echo 'FLINK_KAFKA_CONNECTOR_VERSION=5.0.0-2.2' >> backend/.env; \
	fi
	@if ! grep -q '^MYSQL_DRIVER_VERSION=' backend/.env; then \
		echo 'MYSQL_DRIVER_VERSION=8.0.27' >> backend/.env; \
	fi
	@if ! grep -q '^FLINK_HADOOP_SHADED_VERSION=' backend/.env; then \
		echo 'FLINK_HADOOP_SHADED_VERSION=2.8.3-10.0' >> backend/.env; \
	fi
	@if ! grep -q '^FLINK_LIB_DIR=' backend/.env; then \
		echo 'FLINK_LIB_DIR=./deploy/docker/flink/custom-lib' >> backend/.env; \
	fi
	@if ! grep -q '^RAYFLOW_SUPER_ADMIN_PASSWORD=' backend/.env; then \
		echo 'RAYFLOW_SUPER_ADMIN_PASSWORD=admin123' >> backend/.env; \
	elif grep -q '^RAYFLOW_SUPER_ADMIN_PASSWORD=change-me-before-start' backend/.env; then \
		sed -i.bak 's|^RAYFLOW_SUPER_ADMIN_PASSWORD=.*|RAYFLOW_SUPER_ADMIN_PASSWORD=admin123|' backend/.env && rm -f backend/.env.bak; \
	fi
	@if ! grep -q '^RAYFLOW_DEFAULT_TENANT_ADMIN_PASSWORD=' backend/.env; then \
		echo 'RAYFLOW_DEFAULT_TENANT_ADMIN_PASSWORD=admin123' >> backend/.env; \
	elif grep -q '^RAYFLOW_DEFAULT_TENANT_ADMIN_PASSWORD=change-me-before-start' backend/.env; then \
		sed -i.bak 's|^RAYFLOW_DEFAULT_TENANT_ADMIN_PASSWORD=.*|RAYFLOW_DEFAULT_TENANT_ADMIN_PASSWORD=admin123|' backend/.env && rm -f backend/.env.bak; \
	fi
	@if ! grep -q '^RAYFLOW_ARTIFACT_S3_ENDPOINT=' backend/.env; then \
		echo 'RAYFLOW_ARTIFACT_S3_ENDPOINT=http://rustfs:9000' >> backend/.env; \
	fi
	@if ! grep -q '^RAYFLOW_ARTIFACT_S3_ACCESS_KEY=' backend/.env; then \
		echo 'RAYFLOW_ARTIFACT_S3_ACCESS_KEY=rustfsadmin' >> backend/.env; \
	fi
	@if ! grep -q '^RAYFLOW_ARTIFACT_S3_SECRET_KEY=' backend/.env; then \
		echo 'RAYFLOW_ARTIFACT_S3_SECRET_KEY=rustfsadmin' >> backend/.env; \
	fi
	@if ! grep -q '^RAYFLOW_ARTIFACT_S3_BUCKET=' backend/.env; then \
		echo 'RAYFLOW_ARTIFACT_S3_BUCKET=rayflow-artifacts' >> backend/.env; \
	fi
	@if ! grep -q '^RAYFLOW_LAKE_S3_BUCKET=' backend/.env; then \
		echo 'RAYFLOW_LAKE_S3_BUCKET=rayflow-lake' >> backend/.env; \
	fi
	@if ! grep -q '^RAYFLOW_ARTIFACT_S3_REGION=' backend/.env; then \
		echo 'RAYFLOW_ARTIFACT_S3_REGION=us-east-1' >> backend/.env; \
	fi
	@if ! grep -q '^RAYFLOW_ARTIFACT_S3_PATH_STYLE=' backend/.env; then \
		echo 'RAYFLOW_ARTIFACT_S3_PATH_STYLE=true' >> backend/.env; \
	fi
	@if ! grep -q '^RAYFLOW_BUILTIN_FLINK_RUNTIME_NAME=' backend/.env; then \
		echo 'RAYFLOW_BUILTIN_FLINK_RUNTIME_NAME=内置' >> backend/.env; \
	fi
	@if ! grep -q '^RAYFLOW_BUILTIN_FLINK_REST_URL=' backend/.env; then \
		echo 'RAYFLOW_BUILTIN_FLINK_REST_URL=http://flink-jobmanager:8081' >> backend/.env; \
	fi
	@if ! grep -q '^RAYFLOW_BUILTIN_FLINK_SQL_GATEWAY_URL=' backend/.env; then \
		echo 'RAYFLOW_BUILTIN_FLINK_SQL_GATEWAY_URL=http://flink-sql-gateway:8083' >> backend/.env; \
	fi
	@if ! grep -q '^RAYFLOW_BUILTIN_FLINK_VERSION=' backend/.env; then \
		echo 'RAYFLOW_BUILTIN_FLINK_VERSION=2.2.1' >> backend/.env; \
	fi
	@if ! grep -q '^RAYFLOW_BUILTIN_FLINK_IMAGE=' backend/.env; then \
		echo 'RAYFLOW_BUILTIN_FLINK_IMAGE=flink:2.2.1' >> backend/.env; \
	fi
	@if ! grep -q '^FLINK_REST_READ_TIMEOUT_MS=' backend/.env; then \
		echo 'FLINK_REST_READ_TIMEOUT_MS=120000' >> backend/.env; \
	fi
	@if ! grep -q '^KUBECONFIG=' backend/.env; then \
		echo 'KUBECONFIG=/root/.kube/config' >> backend/.env; \
	fi

check-prod-env:
	@if [ ! -f "deploy/.env" ]; then \
		echo "❌ [RayFlow] 未找到 deploy/.env，请先执行: make prod-init"; \
		exit 1; \
	fi

prod-init:
	@echo "🚀 [RayFlow] 正在初始化生产环境配置..."
	@if [ ! -f "deploy/.env" ]; then \
		cp backend/.env.example deploy/.env; \
		echo "✅ 生产环境配置文件已生成: deploy/.env"; \
	else \
		echo "💡 deploy/.env 已存在，跳过拷贝。"; \
	fi
	@if [ ! -f "deploy/.env.admin.local" ]; then \
		cp frontend/admin/.env.example deploy/.env.admin.local; \
		echo "✅ Admin 生产环境配置文件已生成: deploy/.env.admin.local"; \
	else \
		echo "💡 deploy/.env.admin.local 已存在，跳过拷贝。"; \
	fi
	@if grep -q '^SPRING_PROFILES_ACTIVE=' deploy/.env; then \
		sed -i.bak 's|^SPRING_PROFILES_ACTIVE=.*|SPRING_PROFILES_ACTIVE=prod|' deploy/.env && rm -f deploy/.env.bak; \
	else \
		echo 'SPRING_PROFILES_ACTIVE=prod' >> deploy/.env; \
	fi
	@if grep -q '^DB_HOST=' deploy/.env; then \
		sed -i.bak 's|^DB_HOST=.*|DB_HOST=postgres|' deploy/.env && rm -f deploy/.env.bak; \
	else \
		echo 'DB_HOST=postgres' >> deploy/.env; \
	fi
	@if grep -q '^DB_PORT=' deploy/.env; then \
		sed -i.bak 's|^DB_PORT=.*|DB_PORT=5432|' deploy/.env && rm -f deploy/.env.bak; \
	else \
		echo 'DB_PORT=5432' >> deploy/.env; \
	fi
	@if grep -q '^REDIS_HOST=' deploy/.env; then \
		sed -i.bak 's|^REDIS_HOST=.*|REDIS_HOST=redis|' deploy/.env && rm -f deploy/.env.bak; \
	else \
		echo 'REDIS_HOST=redis' >> deploy/.env; \
	fi
	@sed -E -i.bak '/^(CI|NEXT_PUBLIC_API_BASE_URL|NEXT_PUBLIC_APP_VERSION|RAYFLOW_API_PROXY_TARGET)=/d' deploy/.env && rm -f deploy/.env.bak
	@if grep -q '^JWT_SECRET=change-this-to-a-random-secret-at-least-32-bytes' deploy/.env; then \
		sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$$(openssl rand -hex 32)|" deploy/.env && rm -f deploy/.env.bak; \
	elif ! grep -q '^JWT_SECRET=' deploy/.env; then \
		echo 'JWT_SECRET=change-this-to-a-random-secret-at-least-32-bytes' >> deploy/.env; \
		sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$$(openssl rand -hex 32)|" deploy/.env && rm -f deploy/.env.bak; \
	fi
	@if grep -q '^RAYFLOW_SECRET_ENCRYPTION_KEY=change-this-to-a-random-secret-encryption-key' deploy/.env; then \
		sed -i.bak "s|^RAYFLOW_SECRET_ENCRYPTION_KEY=.*|RAYFLOW_SECRET_ENCRYPTION_KEY=$$(openssl rand -hex 32)|" deploy/.env && rm -f deploy/.env.bak; \
	elif ! grep -q '^RAYFLOW_SECRET_ENCRYPTION_KEY=' deploy/.env; then \
		echo 'RAYFLOW_SECRET_ENCRYPTION_KEY=change-this-to-a-random-secret-encryption-key' >> deploy/.env; \
		sed -i.bak "s|^RAYFLOW_SECRET_ENCRYPTION_KEY=.*|RAYFLOW_SECRET_ENCRYPTION_KEY=$$(openssl rand -hex 32)|" deploy/.env && rm -f deploy/.env.bak; \
	fi
	@if grep -q '^RAYFLOW_PREVIEW_CALLBACK_TOKEN=change-this-to-a-random-preview-callback-token' deploy/.env; then \
		sed -i.bak "s|^RAYFLOW_PREVIEW_CALLBACK_TOKEN=.*|RAYFLOW_PREVIEW_CALLBACK_TOKEN=$$(openssl rand -hex 32)|" deploy/.env && rm -f deploy/.env.bak; \
	elif ! grep -q '^RAYFLOW_PREVIEW_CALLBACK_TOKEN=' deploy/.env; then \
		echo 'RAYFLOW_PREVIEW_CALLBACK_TOKEN=change-this-to-a-random-preview-callback-token' >> deploy/.env; \
		sed -i.bak "s|^RAYFLOW_PREVIEW_CALLBACK_TOKEN=.*|RAYFLOW_PREVIEW_CALLBACK_TOKEN=$$(openssl rand -hex 32)|" deploy/.env && rm -f deploy/.env.bak; \
	fi
	@if grep -q '^DB_PASSWORD=rayflow123' deploy/.env; then \
		sed -i.bak "s|^DB_PASSWORD=.*|DB_PASSWORD=$$(openssl rand -hex 16)|" deploy/.env && rm -f deploy/.env.bak; \
	fi
	@if ! grep -q '^RAYFLOW_SUPER_ADMIN_USERNAME=' deploy/.env; then \
		echo 'RAYFLOW_SUPER_ADMIN_USERNAME=superadmin@rayflow.cn' >> deploy/.env; \
	fi
	@if ! grep -q '^RAYFLOW_DEFAULT_TENANT_ADMIN_USERNAME=' deploy/.env; then \
		echo 'RAYFLOW_DEFAULT_TENANT_ADMIN_USERNAME=admin@rayflow.cn' >> deploy/.env; \
	fi
	@if ! grep -q '^RAYFLOW_TIMEZONE=' deploy/.env; then \
		echo 'RAYFLOW_TIMEZONE=Asia/Shanghai' >> deploy/.env; \
	fi
	@if ! grep -q '^RAYFLOW_SUPER_ADMIN_PASSWORD=' deploy/.env; then \
		echo 'RAYFLOW_SUPER_ADMIN_PASSWORD=change-me-before-start' >> deploy/.env; \
	fi
	@if ! grep -q '^RAYFLOW_DEFAULT_TENANT_ADMIN_PASSWORD=' deploy/.env; then \
		echo 'RAYFLOW_DEFAULT_TENANT_ADMIN_PASSWORD=change-me-before-start' >> deploy/.env; \
	fi
	@if ! grep -q '^RAYFLOW_BUILTIN_FLINK_RUNTIME_NAME=' deploy/.env; then \
		echo 'RAYFLOW_BUILTIN_FLINK_RUNTIME_NAME=内置' >> deploy/.env; \
	fi
	@if ! grep -q '^RAYFLOW_BUILTIN_FLINK_REST_URL=' deploy/.env; then \
		echo 'RAYFLOW_BUILTIN_FLINK_REST_URL=http://flink-jobmanager:8081' >> deploy/.env; \
	fi
	@if ! grep -q '^RAYFLOW_BUILTIN_FLINK_SQL_GATEWAY_URL=' deploy/.env; then \
		echo 'RAYFLOW_BUILTIN_FLINK_SQL_GATEWAY_URL=http://flink-sql-gateway:8083' >> deploy/.env; \
	fi
	@if ! grep -q '^RAYFLOW_BUILTIN_FLINK_VERSION=' deploy/.env; then \
		echo 'RAYFLOW_BUILTIN_FLINK_VERSION=2.2.1' >> deploy/.env; \
	fi
	@if ! grep -q '^RAYFLOW_BUILTIN_FLINK_IMAGE=' deploy/.env; then \
		echo 'RAYFLOW_BUILTIN_FLINK_IMAGE=flink:2.2.1' >> deploy/.env; \
	fi
	@if ! grep -q '^FLINK_VERSION=' deploy/.env; then \
		echo 'FLINK_VERSION=2.2.1' >> deploy/.env; \
	fi
	@if ! grep -q '^PAIMON_VERSION=' deploy/.env; then \
		echo 'PAIMON_VERSION=1.4.2' >> deploy/.env; \
	fi
	@if ! grep -q '^PAIMON_FLINK_MINOR=' deploy/.env; then \
		echo 'PAIMON_FLINK_MINOR=2.2' >> deploy/.env; \
	fi
	@if ! grep -q '^FLINK_CDC_VERSION=' deploy/.env; then \
		echo 'FLINK_CDC_VERSION=3.5.0' >> deploy/.env; \
	fi
	@if ! grep -q '^FLINK_KAFKA_CONNECTOR_VERSION=' deploy/.env; then \
		echo 'FLINK_KAFKA_CONNECTOR_VERSION=5.0.0-2.2' >> deploy/.env; \
	fi
	@if ! grep -q '^MYSQL_DRIVER_VERSION=' deploy/.env; then \
		echo 'MYSQL_DRIVER_VERSION=8.0.27' >> deploy/.env; \
	fi
	@if ! grep -q '^FLINK_HADOOP_SHADED_VERSION=' deploy/.env; then \
		echo 'FLINK_HADOOP_SHADED_VERSION=2.8.3-10.0' >> deploy/.env; \
	fi
	@if ! grep -q '^FLINK_LIB_DIR=' deploy/.env; then \
		echo 'FLINK_LIB_DIR=./deploy/docker/flink/custom-lib' >> deploy/.env; \
	fi
	@if ! grep -q '^KUBECONFIG=' deploy/.env; then \
		echo 'KUBECONFIG=/root/.kube/config' >> deploy/.env; \
	fi
	@if ! grep -q '^CI=' deploy/.env.admin.local; then \
		echo 'CI=true' >> deploy/.env.admin.local; \
	fi
	@if ! grep -q '^NEXT_PUBLIC_API_BASE_URL=' deploy/.env.admin.local; then \
		echo 'NEXT_PUBLIC_API_BASE_URL=' >> deploy/.env.admin.local; \
	fi
	@if ! grep -q '^NEXT_PUBLIC_APP_VERSION=' deploy/.env.admin.local; then \
		echo 'NEXT_PUBLIC_APP_VERSION=0.0.4' >> deploy/.env.admin.local; \
	fi
	@if ! grep -q '^RAYFLOW_API_PROXY_TARGET=' deploy/.env.admin.local; then \
		echo 'RAYFLOW_API_PROXY_TARGET=http://backend:3000' >> deploy/.env.admin.local; \
	fi
	@echo "✅ JWT_SECRET 和 DB_PASSWORD 已自动随机生成。"
	@echo "⚠️  请在生产启动前修改 deploy/.env 中的内置管理员密码。"

# ------------------------------------------------------------------------------
# 开发环境 (Docker Compose)
# ------------------------------------------------------------------------------
setup-flink-paimon:
	@SETUP_FLINK_PAIMON_INTERACTIVE="$(if $(SETUP_FLINK_PAIMON_HAS_VERSION_ARG),0,$(SETUP_FLINK_PAIMON_INTERACTIVE))" FORCE="$(FORCE)" CLEAN_STALE="$(CLEAN_STALE)" $(if $(filter command line,$(origin FLINK_VERSION)),FLINK_VERSION="$(FLINK_VERSION)",) $(if $(filter command line,$(origin PAIMON_VERSION)),PAIMON_VERSION="$(PAIMON_VERSION)",) $(if $(filter command line,$(origin PAIMON_FLINK_MINOR)),PAIMON_FLINK_MINOR="$(PAIMON_FLINK_MINOR)",) $(if $(filter command line,$(origin FLINK_CDC_VERSION)),FLINK_CDC_VERSION="$(FLINK_CDC_VERSION)",) $(if $(filter command line,$(origin FLINK_KAFKA_CONNECTOR_VERSION)),FLINK_KAFKA_CONNECTOR_VERSION="$(FLINK_KAFKA_CONNECTOR_VERSION)",) $(if $(filter command line,$(origin MYSQL_DRIVER_VERSION)),MYSQL_DRIVER_VERSION="$(MYSQL_DRIVER_VERSION)",) $(if $(filter command line,$(origin FLINK_HADOOP_SHADED_VERSION)),FLINK_HADOOP_SHADED_VERSION="$(FLINK_HADOOP_SHADED_VERSION)",) $(if $(filter command line,$(origin FLINK_LIB_DIR)),FLINK_LIB_DIR="$(FLINK_LIB_DIR)",) bash scripts/setup_flink_paimon_libs.sh

verify-flink-libs:
	@WRITE_ENV=0 FORCE=0 CLEAN_STALE=0 FLINK_VERSION="$(FLINK_VERSION)" PAIMON_VERSION="$(PAIMON_VERSION)" PAIMON_FLINK_MINOR="$(PAIMON_FLINK_MINOR)" FLINK_CDC_VERSION="$(FLINK_CDC_VERSION)" FLINK_KAFKA_CONNECTOR_VERSION="$(FLINK_KAFKA_CONNECTOR_VERSION)" MYSQL_DRIVER_VERSION="$(MYSQL_DRIVER_VERSION)" FLINK_HADOOP_SHADED_VERSION="$(FLINK_HADOOP_SHADED_VERSION)" FLINK_LIB_DIR="$(FLINK_LIB_DIR)" bash scripts/setup_flink_paimon_libs.sh

verify-flink-paimon-matrix:
	@bash scripts/verify_flink_paimon_matrix.sh

dev-up: check-dev-env
	@echo "🐳 [DEV] 正在启动 RayFlow 开发环境..."
	@echo "    - 统一控制台 (Nginx): http://localhost:8080"
	@echo "    - 后端 API (Spring):  http://localhost:3000"
	@echo "    - Flink 控制台 (REST): http://localhost:8081"
	@echo "    - Flink SQL Gateway:  http://localhost:8083"
	@echo "    - 对象存储 API (S3):   http://localhost:9010 (控制台: http://localhost:9011)"
	@echo "    - 文档站点 (Docs):     http://localhost:8003"
	@echo "    - 官网门户 (Website):  http://localhost:8004 (需要使用: make dev-up-website 启动)"
	@echo "    - 数据库 (Postgres):   localhost:5433"
	@echo "    - 缓存数据库 (Redis):  localhost:6379"
	$(DEV_COMPOSE) up --build

dev-down:
	@echo "🛑 [DEV] 正在停止 RayFlow 开发环境..."
	$(DEV_COMPOSE) down --remove-orphans

dev-build: check-dev-env
	@echo "🐳 [DEV] 正在构建 RayFlow 开发镜像..."
	$(DEV_COMPOSE) build

dev-rebuild: check-dev-env
	@echo "🔧 [DEV] 正在重建并后台启动 RayFlow 开发环境..."
	$(DEV_COMPOSE) up -d --build

dev-restart:
	$(DEV_COMPOSE) restart

dev-restart-backend:
	$(DEV_COMPOSE) restart backend

dev-logs:
	$(DEV_COMPOSE) logs -f

dev-logs-backend:
	$(DEV_COMPOSE) logs -f backend

dev-clean:
	@echo "🧹 [DEV] 正在尝试清理 RayFlow 开发环境..."
	@echo "⚠️  警告：此操作将删除开发环境容器和业务数据卷，保留 Maven 依赖缓存。"
	@read -p "您确定要继续吗？[y/N] " ans && [ $${ans:-N} = y ] || (echo "❌ 操作已取消"; exit 1)
	$(DEV_COMPOSE) down --remove-orphans
	@docker volume rm rayflow_pgdata rayflow_rustfs_data 2>/dev/null || true
	@echo "✅ 开发环境已清理"

dev-purge:
	@echo "🧨 [DEV] 正在尝试彻底清理 RayFlow 开发环境..."
	@echo "⚠️  警告：此操作将删除开发环境容器、业务数据卷和 Maven 依赖缓存。"
	@read -p "您确定要继续吗？[y/N] " ans && [ $${ans:-N} = y ] || (echo "❌ 操作已取消"; exit 1)
	$(DEV_COMPOSE) down -v --remove-orphans
	@docker volume rm rayflow_m2 2>/dev/null || true
	@echo "✅ 开发环境已彻底清理"

# ------------------------------------------------------------------------------
# 生产环境 (Docker Compose)
# ------------------------------------------------------------------------------
prod-up: check-prod-env
	@echo "🚀 [PROD] 正在启动 RayFlow 生产集群..."
	$(PROD_COMPOSE) pull
	$(PROD_COMPOSE) up -d
	@echo "✅ RayFlow 生产集群已启动"

prod-up-build: check-prod-env
	@echo "🚀 [PROD] 本地构建并启动 RayFlow 生产集群..."
	$(PROD_COMPOSE) up -d --build
	@echo "✅ RayFlow 生产集群已启动"

prod-rebuild: check-prod-env
	@echo "🔧 [PROD] 无缓存重新构建 RayFlow 生产环境..."
	$(PROD_COMPOSE) build --no-cache
	$(PROD_COMPOSE) up -d

prod-down: check-prod-env
	@echo "🛑 [PROD] 正在停止 RayFlow 生产集群..."
	$(PROD_COMPOSE) down --remove-orphans

prod-restart: check-prod-env
	$(PROD_COMPOSE) restart

prod-logs: check-prod-env
	$(PROD_COMPOSE) logs -f

prod-clean: check-prod-env
	@echo "🛑 [危险] 正在尝试清理 RayFlow 生产环境..."
	@echo "⚠️  警告：此操作将删除生产环境容器和数据卷。"
	@read -p "您确定要继续吗？[y/N] " ans && [ $${ans:-N} = y ] || (echo "❌ 操作已取消"; exit 1)
	$(PROD_COMPOSE) down -v --remove-orphans
	@echo "✅ 生产环境已清理"

# ------------------------------------------------------------------------------
# 静态站点 (Docs + Website)
# ------------------------------------------------------------------------------
prod-static-up: check-prod-env
	@echo "🌐 [STATIC] 正在启动 RayFlow Docs 文档站 + Website 官网..."
	$(STATIC_COMPOSE) pull
	$(STATIC_COMPOSE) up -d
	@echo "✅ RayFlow Docs 文档站 + Website 官网已启动"

prod-static-up-build: check-prod-env
	@echo "🌐 [STATIC] 本地构建并启动 RayFlow Docs 文档站 + Website 官网..."
	$(STATIC_COMPOSE) up -d --build
	@echo "✅ RayFlow Docs 文档站 + Website 官网已启动"

prod-static-down: check-prod-env
	@echo "🛑 [STATIC] 正在停止 RayFlow Docs 文档站 + Website 官网..."
	$(STATIC_COMPOSE) down

prod-static-logs: check-prod-env
	$(STATIC_COMPOSE) logs -f

# ------------------------------------------------------------------------------
# 本地构建
# ------------------------------------------------------------------------------
build-backend:
	@if [ -n "$(BACKEND_JAVA_HOME)" ]; then \
		export JAVA_HOME="$(BACKEND_JAVA_HOME)"; \
		export PATH="$$JAVA_HOME/bin:$$PATH"; \
	fi; \
	cd backend && $(MAVEN) clean package -DskipTests

build-admin:
	cd frontend/admin && pnpm install && pnpm build

build-docs:
	cd frontend/docs && pnpm install && pnpm docs:build

build-website:
	cd frontend/website && pnpm install && pnpm build

# ------------------------------------------------------------------------------
# 代码质量
# ------------------------------------------------------------------------------
format:
	@echo "[Format] Fixing Admin frontend issues..."
	@if [ -d "frontend/admin/node_modules" ]; then \
		cd frontend/admin && pnpm format; \
	else \
		echo "[WARN] frontend/admin/node_modules 未安装，跳过 Admin 格式化"; \
	fi
	@echo "[Format] Fixing Website frontend issues..."
	@if [ -d "frontend/website/node_modules" ]; then \
		cd frontend/website && pnpm format; \
	else \
		echo "[WARN] frontend/website/node_modules 未安装，跳过 Website 格式化"; \
	fi
	@echo "[Format] Done"

check-admin:
	@echo "[Admin] Running lint + typecheck..."
	cd frontend/admin && pnpm lint && pnpm typecheck

check-website:
	@echo "[Website] Running lint + typecheck..."
	@if [ -d "frontend/website" ]; then \
		cd frontend/website && pnpm lint && pnpm typecheck; \
	else \
		echo "[Website] Directory frontend/website not found, skipping check-website"; \
	fi

check-docs:
	@echo "[Docs] Building docs..."
	cd frontend/docs && pnpm docs:build

check-backend:
	@echo "[Backend] Compiling backend..."
	@if command -v "$(MAVEN)" >/dev/null 2>&1; then \
		if [ -n "$(BACKEND_JAVA_HOME)" ]; then \
			export JAVA_HOME="$(BACKEND_JAVA_HOME)"; \
			export PATH="$$JAVA_HOME/bin:$$PATH"; \
		fi; \
		cd backend && $(MAVEN) -q -DskipTests compile; \
	elif command -v docker >/dev/null 2>&1; then \
		echo "[WARN] 未找到本机 Maven，改用 dev backend 容器执行编译"; \
		$(DEV_COMPOSE) run --rm --no-deps backend mvn -q -DskipTests compile; \
	else \
		echo "[ERROR] [Backend] 未找到 Maven 命令: $(MAVEN)，且 Docker 不可用"; \
		echo "[HINT] 请先安装 Maven，或执行 make check-all MAVEN=/path/to/mvn"; \
		exit 1; \
	fi
	@echo "[Backend] Checking Flyway migration rules..."
	$(MAKE) migration-verify

check-all:
	@echo "[RayFlow] Running full checks..."
	$(MAKE) check-backend
	$(MAKE) check-admin
	$(MAKE) check-website
	$(MAKE) check-docs
	@echo "[Git] Checking diff whitespace..."
	git diff --check
	@echo "[RayFlow] Full checks passed"

# ------------------------------------------------------------------------------
# 本地运行
# ------------------------------------------------------------------------------
run-backend:
	@if [ -n "$(BACKEND_JAVA_HOME)" ]; then \
		export JAVA_HOME="$(BACKEND_JAVA_HOME)"; \
		export PATH="$$JAVA_HOME/bin:$$PATH"; \
	fi; \
	cd backend && $(MAVEN) -pl rayflow-flink-sql-runner -am package -DskipTests
	@if [ -n "$(BACKEND_JAVA_HOME)" ]; then \
		export JAVA_HOME="$(BACKEND_JAVA_HOME)"; \
		export PATH="$$JAVA_HOME/bin:$$PATH"; \
	fi; \
	cd backend && set -a && . ./.env && set +a && \
		DB_HOST=$${LOCAL_DB_HOST:-localhost} \
		DB_PORT=$${LOCAL_DB_PORT:-5433} \
		REDIS_HOST=$${LOCAL_REDIS_HOST:-localhost} \
		RAYFLOW_PREVIEW_CALLBACK_BASE_URL=$${LOCAL_PREVIEW_CALLBACK_BASE_URL:-http://localhost:3000} \
		$(MAVEN) -pl rayflow-server -am spring-boot:run

run-admin:
	cd frontend/admin && pnpm dev

run-docs:
	cd frontend/docs && pnpm docs:dev --host 0.0.0.0 --port 8003

run-website:
	cd frontend/website && pnpm dev

# ------------------------------------------------------------------------------
# 代码生成
# ------------------------------------------------------------------------------
gen-swagger:
	OPENAPI_URL=$(OPENAPI_URL) python3 scripts/generate_sdk.py --openapi-only

gen-sdk:
	OPENAPI_URL=$(OPENAPI_URL) python3 scripts/generate_sdk.py

init: init-test

init-test:
	@echo "🧪 [RayFlow] 正在初始化全部测试数据..."
	@if ! $(DEV_COMPOSE) ps --status running --services | grep -q '^postgres$$'; then \
		echo "❌ [RayFlow] Postgres 未运行，请先执行 make dev-up 或 make dev-rebuild"; \
		exit 1; \
	fi
	@if [ ! -f "$(TEST_SQL)" ]; then \
		echo "❌ [RayFlow] 未找到 SQL 文件: $(TEST_SQL)"; \
		exit 1; \
	fi
	@RAYFLOW_TZ=$$(awk -F= '/^RAYFLOW_TIMEZONE=/{print $$2}' backend/.env | tail -n 1); \
	$(DEV_COMPOSE) exec -T postgres sh -c 'PGOPTIONS="-c client_min_messages=warning -c TimeZone=UTC -c rayflow.timezone='"$${RAYFLOW_TZ:-UTC}"'" psql -q -U rayflow -d rayflow' < "$(TEST_SQL)"
	@echo "✅ [RayFlow] 全部测试数据已初始化"

migrate-streampark-batch:
	@SOURCE_TAG=batch TARGET_JOB_GROUP=$${TARGET_JOB_GROUP:-batch} TARGET_CLUSTER_NAME=$${TARGET_CLUSTER_NAME:-内置} DRY_RUN=$${DRY_RUN:-0} python3 scripts/migrate_streampark_jobs.py

migration-new:
	@./scripts/create_migration.sh "$(desc)"

migration-verify:
	@./scripts/verify_migration_rules.sh

set-version:
	@python3 scripts/version.py $(v)

