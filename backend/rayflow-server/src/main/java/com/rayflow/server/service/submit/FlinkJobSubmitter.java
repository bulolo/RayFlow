package com.rayflow.server.service.submit;

import com.rayflow.server.model.entity.FlinkCluster;
import com.rayflow.server.model.entity.FlinkJob;

/**
 * Flink 作业提交器接口
 */
public interface FlinkJobSubmitter {

    /**
     * 提交作业并返回 Flink 物理 Job ID
     * @param job 作业信息
     * @param cluster 目标运行时
     * @return 物理 Flink Job ID
     */
    String submit(FlinkJob job, FlinkCluster cluster);
}
