package com.fling.dto.history;

import com.fling.entity.RequestHistory;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record HistoryDetailResponse(
        UUID id,
        UUID requestId,
        String method,
        String url,
        Map<String, String> queryParams,
        Map<String, String> headers,
        String body,
        Integer responseStatus,
        Map<String, String> responseHeaders,
        String responseBody,
        Integer durationMs,
        OffsetDateTime sentAt
) {
    public static HistoryDetailResponse of(RequestHistory h) {
        return new HistoryDetailResponse(
                h.getId(),
                h.getRequest() != null ? h.getRequest().getId() : null,
                h.getMethod(),
                h.getUrl(),
                h.getQueryParams(),
                h.getHeaders(),
                h.getBody(),
                h.getResponseStatus(),
                h.getResponseHeaders(),
                h.getResponseBody(),
                h.getDurationMs(),
                h.getSentAt()
        );
    }
}
