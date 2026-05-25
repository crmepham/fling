package com.fling.repository;

import com.fling.entity.RequestCollection;
import com.fling.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface RequestCollectionRepository extends JpaRepository<RequestCollection, UUID> {

    Page<RequestCollection> findAllByUser(User user, Pageable pageable);

    Optional<RequestCollection> findByIdAndUser(UUID id, User user);

    long countByUser(User user);

    @Query(value = """
            UPDATE collections
            SET name = :name, description = :description, updated_at = NOW()
            WHERE id = :id AND user_id = :userId
            RETURNING id, name, description, created_at, updated_at
            """, nativeQuery = true)
    Optional<CollectionRow> updateAndReturn(UUID id, UUID userId, String name, String description);

    interface CollectionRow {
        UUID getId();
        String getName();
        String getDescription();
        OffsetDateTime getCreatedAt();
        OffsetDateTime getUpdatedAt();
    }
}
