package com.fling.dto.history;

import com.fling.entity.RequestHistory;

import java.time.OffsetDateTime;
import java.util.UUID;

public record HistorySummaryResponse(
        UUID id,
        UUID requestId,
        String method,
        String url,
        Integer responseStatus,
        Integer durationMs,
        OffsetDateTime sentAt
) {
    public static HistorySummaryResponse of(RequestHistory h) {
        return new HistorySummaryResponse(
                h.getId(),
                h.getRequest() != null ? h.getRequest().getId() : null,
                h.getMethod(),
                h.getUrl(),
                h.getResponseStatus(),
                h.getDurationMs(),
                h.getSentAt()
        );
    }
}
