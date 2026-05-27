package com.fling.entity;

public record ResponseExtraction(
        String source,      // "body" or "header"
        String path,        // dot-notation JSON path for body, header name for header
        String variableKey  // environment variable key to populate
) {}
