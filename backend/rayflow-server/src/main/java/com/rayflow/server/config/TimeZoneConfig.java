package com.rayflow.server.config;

import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Configuration;

import java.util.TimeZone;

@Configuration
public class TimeZoneConfig {

    @PostConstruct
    public void configureDefaultTimeZone() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    }
}
