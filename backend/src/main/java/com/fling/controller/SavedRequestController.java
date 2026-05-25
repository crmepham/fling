package com.fling.controller;

import com.fling.dto.PageResponse;
import com.fling.dto.ReorderRequest;
import com.fling.dto.request.CreateSavedRequestRequest;
import com.fling.dto.request.MoveRequestBody;
import com.fling.dto.request.SavedRequestResponse;
import com.fling.service.SavedRequestService;
import com.fling.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class SavedRequestController {

    private final SavedRequestService requestService;
    private final UserService userService;

    // Requests nested under a collection
    @GetMapping("/api/v1/collections/{collectionId}/requests")
    public PageResponse<SavedRequestResponse> listByCollection(
            @PathVariable UUID collectionId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return requestService.listByCollection(userService.getDefaultUser(), collectionId, page, pageSize);
    }

    @PostMapping("/api/v1/requests")
    @ResponseStatus(HttpStatus.CREATED)
    public SavedRequestResponse create(@Valid @RequestBody CreateSavedRequestRequest req) {
        return requestService.create(userService.getDefaultUser(), req);
    }

    @GetMapping("/api/v1/requests/{id}")
    public SavedRequestResponse get(@PathVariable UUID id) {
        return requestService.get(userService.getDefaultUser(), id);
    }

    @PutMapping("/api/v1/requests/{id}")
    public SavedRequestResponse update(@PathVariable UUID id, @Valid @RequestBody CreateSavedRequestRequest req) {
        return requestService.update(userService.getDefaultUser(), id, req);
    }

    @PatchMapping("/api/v1/requests/{id}")
    public SavedRequestResponse patch(@PathVariable UUID id, @Valid @RequestBody CreateSavedRequestRequest req) {
        return requestService.update(userService.getDefaultUser(), id, req);
    }

    @DeleteMapping("/api/v1/requests/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        requestService.delete(userService.getDefaultUser(), id);
    }

    @PatchMapping("/api/v1/collections/{collectionId}/requests/reorder")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorder(@PathVariable UUID collectionId, @Valid @RequestBody ReorderRequest req) {
        requestService.reorder(userService.getDefaultUser(), collectionId, req.ids());
    }

    @PostMapping("/api/v1/requests/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public SavedRequestResponse duplicate(@PathVariable UUID id) {
        return requestService.duplicate(userService.getDefaultUser(), id);
    }

    @PatchMapping("/api/v1/requests/{id}/move")
    public SavedRequestResponse move(@PathVariable UUID id, @RequestBody MoveRequestBody body) {
        return requestService.move(userService.getDefaultUser(), id, body);
    }
}
