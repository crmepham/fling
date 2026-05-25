package com.fling.dto.environment;

import com.fling.entity.Environment;

import java.time.OffsetDateTime;
import java.util.UUID;

public record EnvironmentSummaryResponse(
        UUID id,
        String name,
        long variableCount,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static EnvironmentSummaryResponse of(Environment e) {
        return new EnvironmentSummaryResponse(e.getId(), e.getName(), e.getVariables().size(), e.getCreatedAt(), e.getUpdatedAt());
    }
}
