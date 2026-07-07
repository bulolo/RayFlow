package com.rayflow.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

/**
 * RayFlow 主启动类
 * Flink/Fluss/Paimon 任务发布管理平台
 */
@SpringBootApplication
@ComponentScan(basePackages = "com.rayflow")
public class RayFlowApplication {

    public static void main(String[] args) {
        SpringApplication.run(RayFlowApplication.class, args);
    }
}
