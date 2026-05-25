package com.fling.dto.execute;

import java.util.Map;
import java.util.UUID;

public record ExecuteResponse(
        UUID historyId,
        RequestSnapshot request,
        ResponseSnapshot response
) {
    public record RequestSnapshot(
            String method,
            String url,
            Map<String, String> queryParams,
            Map<String, String> headers,
            String body
    ) {}

    public record ResponseSnapshot(
            int status,
            String statusText,
            Map<String, String> headers,
            String body,
            long durationMs,
            long bodySize
    ) {}
}
