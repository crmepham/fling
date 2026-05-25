package com.fling.dto.environment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record BulkUpdateVariablesRequest(@NotNull List<VariableEntry> variables) {

    public record VariableEntry(
            @NotBlank @Size(max = 255) String key,
            @NotNull String value,
            boolean isSecret
    ) {}
}
