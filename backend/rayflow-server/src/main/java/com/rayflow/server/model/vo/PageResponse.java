package com.rayflow.server.model.vo;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.function.Function;

/**
 * 统一分页响应，仅保留 list/pagination 格式。
 */
public final class PageResponse<T> {

    private final List<T> list;
    private final Pagination pagination;

    private PageResponse(List<T> list, Pagination pagination) {
        this.list = list;
        this.pagination = pagination;
    }

    public static <T> PageResponse<T> from(IPage<T> page) {
        return new PageResponse<>(
                page.getRecords(),
                new Pagination(1, page.getCurrent(), page.getSize(), page.getTotal(), page.getPages())
        );
    }

    public static <S, T> PageResponse<T> from(IPage<S> page, Function<S, T> mapper) {
        return new PageResponse<>(
                page.getRecords().stream().map(mapper).toList(),
                new Pagination(1, page.getCurrent(), page.getSize(), page.getTotal(), page.getPages())
        );
    }

    public static <T> PageResponse<T> of(List<T> list) {
        long total = list.size();
        long size = total == 0 ? 0 : total;
        long pages = total == 0 ? 0 : 1;
        return new PageResponse<>(list, new Pagination(0, 1, size, total, pages));
    }

    public static <S, T> PageResponse<T> of(List<S> list, Function<S, T> mapper) {
        return of(list.stream().map(mapper).toList());
    }

    @JsonProperty("list")
    public List<T> getList() {
        return list;
    }

    @JsonProperty("pagination")
    public Pagination getPagination() {
        return pagination;
    }

    public record Pagination(
            @JsonProperty("is_pager") int isPager,
            @JsonProperty("page") long page,
            @JsonProperty("size") long size,
            @JsonProperty("total") long total,
            @JsonProperty("pages") long pages
    ) {
    }
}
