package com.fling.repository;

import com.fling.entity.RequestHistory;
import com.fling.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface RequestHistoryRepository extends JpaRepository<RequestHistory, UUID>,
        JpaSpecificationExecutor<RequestHistory> {

    Optional<RequestHistory> findByIdAndUser(UUID id, User user);

    @Modifying
    @Query("DELETE FROM RequestHistory h WHERE h.user = :user")
    void deleteAllByUser(User user);

    @Modifying
    @Query("DELETE FROM RequestHistory h WHERE h.user = :user AND h.request.id = :requestId")
    void deleteAllByUserAndRequestId(User user, UUID requestId);

    @Modifying
    @Query("DELETE FROM RequestHistory h WHERE h.user = :user AND h.sentAt < :before")
    void deleteAllByUserAndSentAtBefore(User user, OffsetDateTime before);

    @Modifying
    @Query("DELETE FROM RequestHistory h WHERE h.user = :user AND h.request.id = :requestId AND h.sentAt < :before")
    void deleteAllByUserAndRequestIdAndSentAtBefore(User user, UUID requestId, OffsetDateTime before);
}
