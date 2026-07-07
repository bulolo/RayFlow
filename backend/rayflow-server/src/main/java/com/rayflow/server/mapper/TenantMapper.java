package com.rayflow.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.rayflow.server.model.entity.Tenant;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface TenantMapper extends BaseMapper<Tenant> {
}
