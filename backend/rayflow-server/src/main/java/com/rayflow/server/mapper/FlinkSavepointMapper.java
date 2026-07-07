package com.rayflow.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.rayflow.server.model.entity.FlinkSavepoint;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface FlinkSavepointMapper extends BaseMapper<FlinkSavepoint> {
}
