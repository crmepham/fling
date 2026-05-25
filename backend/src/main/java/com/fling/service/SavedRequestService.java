package com.fling.service;

import com.fling.dto.PageResponse;
import com.fling.dto.request.CreateSavedRequestRequest;
import com.fling.dto.request.MoveRequestBody;
import com.fling.dto.request.SavedRequestResponse;
import com.fling.entity.KeyValueEnabled;
import com.fling.entity.RequestCollection;
import com.fling.entity.SavedRequest;
import com.fling.entity.User;
import com.fling.exception.ResourceNotFoundException;
import com.fling.repository.RequestCollectionRepository;
import com.fling.repository.SavedRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SavedRequestService {

    private final SavedRequestRepository requestRepository;
    private final RequestCollectionRepository collectionRepository;

    @Transactional(readOnly = true)
    public PageResponse<SavedRequestResponse> listByCollection(User user, UUID collectionId, int page, int pageSize) {
        var collection = collectionRepository.findByIdAndUser(collectionId, user)
                .orElseThrow(() -> ResourceNotFoundException.of("Collection", collectionId));
        var pageable = PageRequest.of(page - 1, pageSize, Sort.by("sortOrder").ascending());
        return PageResponse.of(requestRepository.findAllByCollection(collection, pageable), SavedRequestResponse::of);
    }

    @Transactional
    public SavedRequestResponse create(User user, CreateSavedRequestRequest req) {
        var savedRequest = new SavedRequest();
        savedRequest.setUser(user);
        applyFields(savedRequest, req, user);
        return SavedRequestResponse.of(requestRepository.save(savedRequest));
    }

    @Transactional(readOnly = true)
    public SavedRequestResponse get(User user, UUID id) {
        return SavedRequestResponse.of(findOrThrow(user, id));
    }

    @Transactional
    public SavedRequestResponse update(User user, UUID id, CreateSavedRequestRequest req) {
        var savedRequest = findOrThrow(user, id);
        applyFields(savedRequest, req, user);
        return SavedRequestResponse.of(requestRepository.save(savedRequest));
    }

    @Transactional
    public void reorder(User user, UUID collectionId, List<UUID> ids) {
        var collection = collectionRepository.findByIdAndUser(collectionId, user)
                .orElseThrow(() -> ResourceNotFoundException.of("Collection", collectionId));
        for (int i = 0; i < ids.size(); i++) {
            var request = findOrThrow(user, ids.get(i));
            if (!collection.equals(request.getCollection())) {
                throw new ResourceNotFoundException("Request " + ids.get(i) + " does not belong to collection " + collectionId);
            }
            request.setSortOrder(i);
        }
    }

    @Transactional
    public void delete(User user, UUID id) {
        requestRepository.delete(findOrThrow(user, id));
    }

    @Transactional
    public SavedRequestResponse duplicate(User user, UUID id) {
        var original = findOrThrow(user, id);
        var copy = new SavedRequest();
        copy.setUser(user);
        copy.setCollection(original.getCollection());
        copy.setName(original.getName() + " (Copy)");
        copy.setMethod(original.getMethod());
        copy.setUrl(original.getUrl());
        copy.setQueryParams(original.getQueryParams());
        copy.setHeaders(original.getHeaders());
        copy.setBody(original.getBody());
        copy.setBodyType(original.getBodyType());
        copy.setAuth(original.getAuth());
        return SavedRequestResponse.of(requestRepository.save(copy));
    }

    @Transactional
    public SavedRequestResponse move(User user, UUID id, MoveRequestBody body) {
        var savedRequest = findOrThrow(user, id);
        if (body.collectionId() == null) {
            savedRequest.setCollection(null);
        } else {
            var collection = collectionRepository.findByIdAndUser(body.collectionId(), user)
                    .orElseThrow(() -> ResourceNotFoundException.of("Collection", body.collectionId()));
            savedRequest.setCollection(collection);
        }
        return SavedRequestResponse.of(requestRepository.save(savedRequest));
    }

    private void applyFields(SavedRequest target, CreateSavedRequestRequest req, User user) {
        RequestCollection collection = null;
        if (req.collectionId() != null) {
            collection = collectionRepository.findByIdAndUser(req.collectionId(), user)
                    .orElseThrow(() -> ResourceNotFoundException.of("Collection", req.collectionId()));
        }
        target.setCollection(collection);
        target.setName(req.name());
        target.setMethod(req.method());
        target.setUrl(req.url());
        var queryParams = req.queryParams() != null ? req.queryParams() : List.<KeyValueEnabled>of();
        var headers = req.headers() != null ? req.headers() : List.<KeyValueEnabled>of();
        target.setQueryParams(queryParams);
        target.setHeaders(headers);
        target.setBody(req.body());
        target.setBodyType(req.bodyType());
        target.setAuth(req.auth());
    }

    private SavedRequest findOrThrow(User user, UUID id) {
        return requestRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> ResourceNotFoundException.of("Request", id));
    }
}
