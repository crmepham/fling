package com.fling.dto.collection;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCollectionRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 1000) String description
) {
    public CreateCollectionRequest {
        description = description != null ? description : "";
    }
}
