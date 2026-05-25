package com.fling.repository;

import com.fling.entity.RequestCollection;
import com.fling.entity.SavedRequest;
import com.fling.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;
import java.util.UUID;

public interface SavedRequestRepository extends JpaRepository<SavedRequest, UUID>,
        JpaSpecificationExecutor<SavedRequest> {

    Page<SavedRequest> findAllByCollection(RequestCollection collection, Pageable pageable);

    Optional<SavedRequest> findByIdAndUser(UUID id, User user);
}
