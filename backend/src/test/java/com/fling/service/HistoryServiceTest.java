package com.fling.service;

import com.fling.entity.RequestHistory;
import com.fling.entity.User;
import com.fling.exception.ResourceNotFoundException;
import com.fling.repository.RequestHistoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HistoryServiceTest {

    @Mock
    private RequestHistoryRepository historyRepository;

    @InjectMocks
    private HistoryService historyService;

    private User user;
    private RequestHistory history;

    @BeforeEach
    void setUp() {
        user = new User();

        history = new RequestHistory();
        history.setUser(user);
        history.setMethod("GET");
        history.setUrl("https://api.example.com");
        history.setResponseStatus(200);
    }

    @Test
    void list_returnsPagedHistory() {
        var page = new PageImpl<>(List.of(history));
        when(historyRepository.findAll(any(Pageable.class))).thenReturn(page);

        var result = historyService.list(user, 1, 50);

        assertThat(result.data()).hasSize(1);
        assertThat(result.data().get(0).method()).isEqualTo("GET");
    }

    @Test
    void get_returnsHistoryDetail() {
        var id = UUID.randomUUID();
        history.setMethod("POST");
        when(historyRepository.findByIdAndUser(id, user)).thenReturn(Optional.of(history));

        var result = historyService.get(user, id);

        assertThat(result.method()).isEqualTo("POST");
    }

    @Test
    void get_throws_whenNotFound() {
        var id = UUID.randomUUID();
        when(historyRepository.findByIdAndUser(id, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> historyService.get(user, id))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getLatestForRequest_returnsDetail_whenHistoryExists() {
        var requestId = UUID.randomUUID();
        when(historyRepository.findFirstByUserAndRequestIdOrderBySentAtDesc(user, requestId))
                .thenReturn(Optional.of(history));

        var result = historyService.getLatestForRequest(user, requestId);

        assertThat(result).isPresent();
        assertThat(result.get().method()).isEqualTo("GET");
    }

    @Test
    void getLatestForRequest_returnsEmpty_whenNoHistory() {
        var requestId = UUID.randomUUID();
        when(historyRepository.findFirstByUserAndRequestIdOrderBySentAtDesc(user, requestId))
                .thenReturn(Optional.empty());

        var result = historyService.getLatestForRequest(user, requestId);

        assertThat(result).isEmpty();
    }

    @Test
    void delete_removesEntry() {
        var id = UUID.randomUUID();
        when(historyRepository.findByIdAndUser(id, user)).thenReturn(Optional.of(history));

        historyService.delete(user, id);

        verify(historyRepository).delete(history);
    }

    @Test
    void delete_throws_whenNotFound() {
        var id = UUID.randomUUID();
        when(historyRepository.findByIdAndUser(id, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> historyService.delete(user, id))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
