package com.fling.dto.execute;

import com.fling.entity.BodyType;
import com.fling.entity.KeyValueEnabled;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record ExecuteRequest(
        UUID requestId,
        UUID environmentId,
        @NotBlank String method,
        @NotBlank String url,
        List<KeyValueEnabled> queryParams,
        List<KeyValueEnabled> headers,
        String body,
        @NotNull BodyType bodyType
) {}
