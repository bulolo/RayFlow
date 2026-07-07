#!/usr/bin/env python3
# ==============================================================================
# RayFlow DevOps 版本控制引擎
# 一键修改前端、后端 Java pom、Compose 默认镜像 tag 及 Makefile 的发布版本号
# ==============================================================================
import os
import re
import sys
import json
import glob

def update_file(file_path, pattern, replacement):
    if not os.path.exists(file_path):
        return False

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = re.sub(pattern, replacement, content)

    if content == new_content:
        return False

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    return True

def get_current_version():
    pkg_path = 'frontend/admin/package.json'
    if os.path.exists(pkg_path):
        try:
            with open(pkg_path, 'r', encoding='utf-8') as f:
                return json.load(f).get('version', '0.1.0')
        except Exception:
            pass
    return '0.1.0'

def get_current_maven_version():
    pom_path = 'backend/pom.xml'
    if os.path.exists(pom_path):
        try:
            with open(pom_path, 'r', encoding='utf-8') as f:
                content = f.read()
            # 提取项目的 <version>0.1.0-SNAPSHOT</version>
            match = re.search(r'<groupId>com\.rayflow</groupId>\s*<artifactId>rayflow</artifactId>\s*<version>([^<]+)</version>', content)
            if match:
                return match.group(1)
        except Exception:
            pass
    return '0.1.0-SNAPSHOT'

def set_version(version):
    v_num = version.lstrip('v')
    print(f"🚀 [RayFlow] Aligning project version to {v_num}")

    # 1. 前端 Node package.json 版本变更
    for pkg_path in [
        'frontend/admin/package.json',
        'frontend/docs/package.json',
        'frontend/website/package.json',
    ]:
        if not os.path.exists(pkg_path):
            continue
        try:
            with open(pkg_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if data.get('version') == v_num:
                continue
            data['version'] = v_num
            with open(pkg_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write('\n')
            print(f"✅ Updated: {pkg_path} ({v_num})")
        except Exception as e:
            print(f"❌ Error updating {pkg_path}: {e}")

    # 2. 后端 Maven pom.xml 版本变更
    # 提取旧版本号进行精准替换，避免篡改 Spring Boot 等第三方依赖的版本
    old_mvn_ver = get_current_maven_version()
    escaped_mvn_ver = re.escape(old_mvn_ver)
    
    pom_files = glob.glob('backend/**/pom.xml', recursive=True)
    for pom_path in pom_files:
        # a. 匹配 <version>old_mvn_ver</version> 并替换
        pattern = fr'<version>{escaped_mvn_ver}</version>'
        replacement = f'<version>{v_num}</version>'
        if update_file(pom_path, pattern, replacement):
            print(f"✅ Updated: {pom_path} (Maven version → {v_num})")

    # 3. Makefile set-version 帮助说明中的版本示例变更
    if update_file(
        'Makefile',
        r'make set-version v=[A-Za-z0-9][A-Za-z0-9._-]*',
        f'make set-version v={v_num}',
    ):
        print("✅ Updated: Makefile (help set-version example)")

    # 4. 后端运行时版本配置，用于 /api/health 和 OpenAPI 文档展示
    if update_file(
        'backend/rayflow-server/src/main/resources/application.yml',
        r'version: \$\{RAYFLOW_VERSION:[^}]+\}',
        f'version: ${{RAYFLOW_VERSION:{v_num}}}',
    ):
        print("✅ Updated: application.yml (rayflow.version fallback)")

    for java_path in [
        'backend/rayflow-server/src/main/java/com/rayflow/server/controller/HealthController.java',
        'backend/rayflow-server/src/main/java/com/rayflow/server/config/SwaggerConfig.java',
    ]:
        if update_file(
            java_path,
            r'\$\{rayflow\.version:[^}]+\}',
            f'${{rayflow.version:{v_num}}}',
        ):
            print(f"✅ Updated: {java_path} (rayflow.version fallback)")

    # 5. docker-compose.dev.yml 中的 App 版本环境变量变更
    if update_file(
        'docker-compose.dev.yml',
        r'- NEXT_PUBLIC_APP_VERSION=[A-Za-z0-9][A-Za-z0-9._-]*',
        f'- NEXT_PUBLIC_APP_VERSION={v_num}',
    ):
        print(f"✅ Updated: docker-compose.dev.yml (NEXT_PUBLIC_APP_VERSION → {v_num})")

    # 6. 静态站点生产 Compose 的默认镜像 tag
    if update_file(
        'deploy/docker-compose.static.yml',
        r'DOCKER_IMAGE_TAG:-[^}]+',
        f'DOCKER_IMAGE_TAG:-{v_num}',
    ):
        print(f"✅ Updated: deploy/docker-compose.static.yml (DOCKER_IMAGE_TAG fallback → {v_num})")

    print(f"\n🎉 Done. RayFlow version is now successfully set to {v_num}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f"RayFlow Current Frontend Version: {get_current_version()}")
        print(f"RayFlow Current Maven Version:    {get_current_maven_version()}")
        print("\nUsage: make set-version v=<version>")
        sys.exit(0)
    set_version(sys.argv[1])
