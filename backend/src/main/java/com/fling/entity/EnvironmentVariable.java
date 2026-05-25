package com.fling.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(
    name = "environment_variables",
    uniqueConstraints = @UniqueConstraint(columnNames = {"environment_id", "key"})
)
@Getter
@Setter
public class EnvironmentVariable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "environment_id", nullable = false)
    private Environment environment;

    @Column(nullable = false, length = 255)
    private String key;

    @Column(nullable = false, columnDefinition = "text")
    private String value;

    @Column(name = "is_secret", nullable = false)
    private boolean secret = false;
}
