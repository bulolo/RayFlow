package com.rayflow.server.model.response.resource;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaimonTableFilesResponse {
    private String databaseName;
    private String tableName;
    private String tablePath;
    private String currentPath;
    private String parentPath;
    private List<Entry> entries;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Entry {
        private String name;
        private String path;
        private String type;
        private Long size;
        private OffsetDateTime lastModified;
    }
}
