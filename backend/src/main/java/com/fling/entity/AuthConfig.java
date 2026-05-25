package com.fling.entity;

public record AuthConfig(
        String type,
        boolean enabled,
        String username,
        String password
) {
    public static AuthConfig none() {
        return new AuthConfig("none", true, "", "");
    }
}
