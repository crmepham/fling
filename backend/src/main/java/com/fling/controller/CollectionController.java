package com.fling.controller;

import com.fling.dto.PageResponse;
import com.fling.dto.ReorderRequest;
import com.fling.dto.collection.CollectionResponse;
import com.fling.dto.collection.CreateCollectionRequest;
import com.fling.dto.collection.UpdateCollectionAuthRequest;
import com.fling.service.CollectionService;
import com.fling.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/collections")
@RequiredArgsConstructor
public class CollectionController {

    private final CollectionService collectionService;
    private final UserService userService;

    @GetMapping
    public PageResponse<CollectionResponse> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return collectionService.list(userService.getDefaultUser(), page, pageSize);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CollectionResponse create(@Valid @RequestBody CreateCollectionRequest req) {
        return collectionService.create(userService.getDefaultUser(), req);
    }

    @GetMapping("/{id}")
    public CollectionResponse get(@PathVariable UUID id) {
        return collectionService.get(userService.getDefaultUser(), id);
    }

    @PutMapping("/{id}")
    public CollectionResponse update(@PathVariable UUID id, @Valid @RequestBody CreateCollectionRequest req) {
        return collectionService.update(userService.getDefaultUser(), id, req);
    }

    @PatchMapping("/{id}")
    public CollectionResponse patch(@PathVariable UUID id, @Valid @RequestBody CreateCollectionRequest req) {
        return collectionService.update(userService.getDefaultUser(), id, req);
    }

    @PatchMapping("/{id}/auth")
    public CollectionResponse updateAuth(@PathVariable UUID id, @RequestBody UpdateCollectionAuthRequest req) {
        return collectionService.updateAuth(userService.getDefaultUser(), id, req);
    }

    @PatchMapping("/{id}/pin")
    public CollectionResponse togglePin(@PathVariable UUID id) {
        return collectionService.togglePin(userService.getDefaultUser(), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        collectionService.delete(userService.getDefaultUser(), id);
    }

    @PatchMapping("/reorder")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorder(@Valid @RequestBody ReorderRequest req) {
        collectionService.reorder(userService.getDefaultUser(), req.ids());
    }
}
