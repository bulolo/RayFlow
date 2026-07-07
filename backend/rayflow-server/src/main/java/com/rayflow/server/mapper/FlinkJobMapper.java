package com.rayflow.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.rayflow.server.model.entity.FlinkJob;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface FlinkJobMapper extends BaseMapper<FlinkJob> {
}
