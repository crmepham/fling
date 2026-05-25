package com.fling.dto.request;

import com.fling.entity.AuthConfig;
import com.fling.entity.BodyType;
import com.fling.entity.KeyValueEnabled;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record CreateSavedRequestRequest(
        UUID collectionId,
        @NotBlank @Size(max = 255) String name,
        @NotBlank String method,
        @NotBlank @Size(max = 2048) String url,
        List<KeyValueEnabled> queryParams,
        List<KeyValueEnabled> headers,
        String body,
        @NotNull BodyType bodyType,
        AuthConfig auth
) {}
