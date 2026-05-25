package com.fling.dto.environment;

import com.fling.entity.Environment;
import com.fling.entity.EnvironmentVariable;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record EnvironmentDetailResponse(
        UUID id,
        String name,
        List<VariableResponse> variables,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public record VariableResponse(UUID id, String key, String value, boolean isSecret) {
        public static VariableResponse of(EnvironmentVariable v) {
            return new VariableResponse(v.getId(), v.getKey(), v.isSecret() ? null : v.getValue(), v.isSecret());
        }
    }

    public static EnvironmentDetailResponse of(Environment e) {
        return new EnvironmentDetailResponse(
                e.getId(),
                e.getName(),
                e.getVariables().stream().map(VariableResponse::of).toList(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
