package com.fling.dto.request;

import com.fling.entity.AuthConfig;
import com.fling.entity.BodyType;
import com.fling.entity.KeyValueEnabled;
import com.fling.entity.SavedRequest;

import java.time.OffsetDateTime;
import java.util.List;
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
        OffsetDateTime updatedAt
) {
    public static SavedRequestResponse of(SavedRequest r) {
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
                r.getUpdatedAt()
        );
    }
}
