package com.fling.repository;

import com.fling.entity.Environment;
import com.fling.entity.EnvironmentVariable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EnvironmentVariableRepository extends JpaRepository<EnvironmentVariable, UUID> {

    List<EnvironmentVariable> findAllByEnvironment(Environment environment);

    Optional<EnvironmentVariable> findByIdAndEnvironmentId(UUID id, UUID environmentId);

    @Modifying
    @Query("DELETE FROM EnvironmentVariable v WHERE v.environment = :environment")
    void deleteAllByEnvironment(@Param("environment") Environment environment);
}
