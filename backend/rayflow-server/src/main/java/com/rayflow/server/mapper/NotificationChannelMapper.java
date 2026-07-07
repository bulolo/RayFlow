package com.rayflow.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.rayflow.server.model.entity.NotificationChannel;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface NotificationChannelMapper extends BaseMapper<NotificationChannel> {
}
