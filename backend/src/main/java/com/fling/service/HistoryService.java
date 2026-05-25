package com.fling.service;

import com.fling.dto.PageResponse;
import com.fling.dto.history.HistoryDetailResponse;
import com.fling.dto.history.HistorySummaryResponse;
import com.fling.entity.User;
import com.fling.exception.ResourceNotFoundException;
import com.fling.repository.RequestHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HistoryService {

    private final RequestHistoryRepository historyRepository;

    @Transactional(readOnly = true)
    public PageResponse<HistorySummaryResponse> list(User user, int page, int pageSize) {
        var pageable = PageRequest.of(page - 1, pageSize, Sort.by("sentAt").descending());
        // TODO: add filtering (method, status, statusRange, search, requestId)
        var result = historyRepository.findAll(pageable);
        return PageResponse.of(result, HistorySummaryResponse::of);
    }

    @Transactional(readOnly = true)
    public HistoryDetailResponse get(User user, UUID id) {
        var history = historyRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> ResourceNotFoundException.of("History entry", id));
        return HistoryDetailResponse.of(history);
    }

    @Transactional
    public void delete(User user, UUID id) {
        var history = historyRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> ResourceNotFoundException.of("History entry", id));
        historyRepository.delete(history);
    }

    @Transactional
    public void clear(User user, UUID requestId, OffsetDateTime before) {
        if (requestId != null && before != null) {
            historyRepository.deleteAllByUserAndRequestIdAndSentAtBefore(user, requestId, before);
        } else if (requestId != null) {
            historyRepository.deleteAllByUserAndRequestId(user, requestId);
        } else if (before != null) {
            historyRepository.deleteAllByUserAndSentAtBefore(user, before);
        } else {
            historyRepository.deleteAllByUser(user);
        }
    }
}
