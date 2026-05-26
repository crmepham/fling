package com.fling.dto.request;

import com.fling.entity.AuthConfig;
import com.fling.entity.BodyType;
import com.fling.entity.KeyValueEnabled;
import com.fling.entity.RequestHistory;
import com.fling.entity.SavedRequest;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record SavedRequestResponse(
        UUID id,
        UUID collectionId,
        String name,
        String method,
        String url,
        List<KeyValueEnabled> queryParams,
        List<KeyValueEnabled> headers,
        String body,
        BodyType bodyType,
        AuthConfig auth,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        LatestHistory latestHistory
) {
    public record LatestHistory(
            UUID id,
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
        public static LatestHistory of(RequestHistory h) {
            return new LatestHistory(
                    h.getId(), h.getMethod(), h.getUrl(),
                    h.getQueryParams(), h.getHeaders(), h.getBody(),
                    h.getResponseStatus(), h.getResponseHeaders(),
                    h.getResponseBody(), h.getDurationMs(), h.getSentAt()
            );
        }
    }

    public static SavedRequestResponse of(SavedRequest r) {
        return of(r, null);
    }

    public static SavedRequestResponse of(SavedRequest r, RequestHistory latestHistory) {
        return new SavedRequestResponse(
                r.getId(),
                r.getCollection() != null ? r.getCollection().getId() : null,
                r.getName(),
                r.getMethod(),
                r.getUrl(),
                r.getQueryParams(),
                r.getHeaders(),
                r.getBody(),
                r.getBodyType(),
                r.getAuth(),
                r.getCreatedAt(),
                r.getUpdatedAt(),
                latestHistory != null ? LatestHistory.of(latestHistory) : null
        );
    }
}
