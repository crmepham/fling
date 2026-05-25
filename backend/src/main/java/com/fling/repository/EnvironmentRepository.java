package com.fling.repository;

import com.fling.entity.Environment;
import com.fling.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface EnvironmentRepository extends JpaRepository<Environment, UUID> {

    Page<Environment> findAllByUser(User user, Pageable pageable);

    Optional<Environment> findByIdAndUser(UUID id, User user);

    boolean existsByUserAndNameAndIdNot(User user, String name, UUID id);

    long countByUser(User user);
}
