package com.fling.service;

import com.fling.dto.PageResponse;
import com.fling.dto.collection.CollectionResponse;
import com.fling.dto.collection.CreateCollectionRequest;
import com.fling.dto.collection.UpdateCollectionAuthRequest;
import com.fling.entity.RequestCollection;
import com.fling.entity.User;
import com.fling.exception.ConflictException;
import com.fling.exception.ResourceNotFoundException;
import com.fling.repository.RequestCollectionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CollectionService {

    private final RequestCollectionRepository collectionRepository;

    @Transactional(readOnly = true)
    public PageResponse<CollectionResponse> list(User user, int page, int pageSize) {
        var pageable = PageRequest.of(page - 1, pageSize, Sort.by("sortOrder").ascending());
        var pageResult = collectionRepository.findAllByUser(user, pageable);
        return PageResponse.of(pageResult, CollectionResponse::of);
    }

    @Transactional
    public CollectionResponse create(User user, CreateCollectionRequest req) {
        var collection = new RequestCollection();
        collection.setUser(user);
        collection.setName(req.name());
        collection.setDescription(req.description());
        return CollectionResponse.of(collectionRepository.save(collection));
    }

    @Transactional(readOnly = true)
    public CollectionResponse get(User user, UUID id) {
        return CollectionResponse.of(findOrThrow(user, id));
    }

    @Transactional
    public CollectionResponse update(User user, UUID id, CreateCollectionRequest req) {
        return collectionRepository.updateAndReturn(id, user.getId(), req.name(), req.description())
                .map(CollectionResponse::of)
                .orElseThrow(() -> ResourceNotFoundException.of("Collection", id));
    }

    @Transactional
    public void reorder(User user, List<UUID> ids) {
        for (int i = 0; i < ids.size(); i++) {
            var collection = findOrThrow(user, ids.get(i));
            collection.setSortOrder(i);
        }
    }

    @Transactional
    public void delete(User user, UUID id) {
        var collection = findOrThrow(user, id);
        if (collectionRepository.countByUser(user) <= 1) {
            throw new ConflictException("Cannot delete the last remaining collection");
        }
        collectionRepository.delete(collection);
    }

    @Transactional
    public CollectionResponse updateAuth(User user, UUID id, UpdateCollectionAuthRequest req) {
        var collection = findOrThrow(user, id);
        collection.setAuth(req.auth());
        return CollectionResponse.of(collectionRepository.save(collection));
    }

    private RequestCollection findOrThrow(User user, UUID id) {
        return collectionRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> ResourceNotFoundException.of("Collection", id));
    }
}
