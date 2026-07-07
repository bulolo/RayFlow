package com.rayflow.flink.sqlrunner;

import java.io.Serializable;

final class PreviewResultColumn implements Serializable {

    private static final long serialVersionUID = 1L;

    private final String name;
    private final String type;

    PreviewResultColumn(String name, String type) {
        this.name = name;
        this.type = type;
    }

    public String getName() {
        return name;
    }

    public String getType() {
        return type;
    }
}
