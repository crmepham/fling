package com.fling.dto.collection;

import com.fling.entity.AuthConfig;
import com.fling.entity.RequestCollection;
import com.fling.repository.RequestCollectionRepository.CollectionRow;

import java.time.OffsetDateTime;
import java.util.UUID;

public record CollectionResponse(
        UUID id,
        String name,
        String description,
        AuthConfig auth,
        boolean pinned,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static CollectionResponse of(RequestCollection c) {
        return new CollectionResponse(c.getId(), c.getName(), c.getDescription(), c.getAuth(), c.isPinned(), c.getCreatedAt(), c.getUpdatedAt());
    }

    public static CollectionResponse of(CollectionRow row) {
        return new CollectionResponse(row.getId(), row.getName(), row.getDescription(), null, false, row.getCreatedAt(), row.getUpdatedAt());
    }
}
