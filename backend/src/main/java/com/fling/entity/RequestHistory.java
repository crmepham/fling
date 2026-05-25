package com.fling.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "history")
@Getter
@Setter
public class RequestHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // Nullable — set to null when the originating saved request is deleted
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id")
    private SavedRequest request;

    @Column(nullable = false, length = 10)
    private String method;

    @Column(nullable = false, columnDefinition = "text")
    private String url;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "query_params", columnDefinition = "jsonb", nullable = false)
    private Map<String, String> queryParams = new HashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, String> headers = new HashMap<>();

    @Column(columnDefinition = "text")
    private String body;

    @Column(name = "response_status")
    private Integer responseStatus;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "response_headers", columnDefinition = "jsonb", nullable = false)
    private Map<String, String> responseHeaders = new HashMap<>();

    @Column(name = "response_body", columnDefinition = "text")
    private String responseBody;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(name = "sent_at", nullable = false)
    private OffsetDateTime sentAt = OffsetDateTime.now();
}
