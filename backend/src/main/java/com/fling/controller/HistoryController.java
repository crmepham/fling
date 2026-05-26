package com.fling.controller;

import com.fling.dto.PageResponse;
import com.fling.dto.history.HistoryDetailResponse;
import com.fling.dto.history.HistorySummaryResponse;
import com.fling.service.HistoryService;
import com.fling.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/history")
@RequiredArgsConstructor
public class HistoryController {

    private final HistoryService historyService;
    private final UserService userService;

    @GetMapping
    public PageResponse<HistorySummaryResponse> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int pageSize) {
        return historyService.list(userService.getDefaultUser(), page, pageSize);
    }

    @GetMapping("/latest")
    public ResponseEntity<HistoryDetailResponse> getLatest(@RequestParam UUID requestId) {
        return historyService.getLatestForRequest(userService.getDefaultUser(), requestId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/{id}")
    public HistoryDetailResponse get(@PathVariable UUID id) {
        return historyService.get(userService.getDefaultUser(), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        historyService.delete(userService.getDefaultUser(), id);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clear(
            @RequestParam(required = false) UUID requestId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime before) {
        historyService.clear(userService.getDefaultUser(), requestId, before);
    }
}
