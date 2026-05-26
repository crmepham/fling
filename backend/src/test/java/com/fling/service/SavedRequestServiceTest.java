package com.fling.service;

import com.fling.dto.request.CreateSavedRequestRequest;
import com.fling.dto.request.MoveRequestBody;
import com.fling.entity.BodyType;
import com.fling.entity.RequestCollection;
import com.fling.entity.RequestHistory;
import com.fling.entity.SavedRequest;
import com.fling.entity.User;
import com.fling.exception.ResourceNotFoundException;
import com.fling.repository.RequestCollectionRepository;
import com.fling.repository.RequestHistoryRepository;
import com.fling.repository.SavedRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SavedRequestServiceTest {

    @Mock
    private SavedRequestRepository requestRepository;

    @Mock
    private RequestCollectionRepository collectionRepository;

    @Mock
    private RequestHistoryRepository historyRepository;

    @InjectMocks
    private SavedRequestService savedRequestService;

    private User user;
    private RequestCollection collection;
    private SavedRequest savedRequest;

    @BeforeEach
    void setUp() {
        user = new User();

        collection = new RequestCollection();
        collection.setUser(user);
        collection.setName("My Collection");

        savedRequest = new SavedRequest();
        savedRequest.setUser(user);
        savedRequest.setCollection(collection);
        savedRequest.setName("Get Users");
        savedRequest.setMethod("GET");
        savedRequest.setUrl("https://api.example.com/users");
        savedRequest.setBodyType(BodyType.NONE);
    }

    @Test
    void get_throwsNotFound_whenRequestDoesNotExist() {
        var id = UUID.randomUUID();
        when(requestRepository.findByIdAndUser(id, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> savedRequestService.get(user, id))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void get_includesLatestHistory_whenHistoryExists() {
        var id = UUID.randomUUID();
        savedRequest.setId(id);

        var history = new RequestHistory();
        history.setId(UUID.randomUUID());
        history.setMethod("GET");
        history.setUrl("https://api.example.com/users");
        history.setResponseStatus(200);
        history.setDurationMs(55);
        history.setSentAt(OffsetDateTime.now());
        history.setRequest(savedRequest);
        history.setUser(user);

        when(requestRepository.findByIdAndUser(id, user)).thenReturn(Optional.of(savedRequest));
        when(historyRepository.findFirstByUserAndRequestIdOrderBySentAtDesc(user, id))
                .thenReturn(Optional.of(history));

        var result = savedRequestService.get(user, id);

        assertThat(result.latestHistory()).isNotNull();
        assertThat(result.latestHistory().responseStatus()).isEqualTo(200);
    }

    @Test
    void get_returnsNullLatestHistory_whenNoHistoryExists() {
        var id = UUID.randomUUID();
        savedRequest.setId(id);

        when(requestRepository.findByIdAndUser(id, user)).thenReturn(Optional.of(savedRequest));
        when(historyRepository.findFirstByUserAndRequestIdOrderBySentAtDesc(user, id))
                .thenReturn(Optional.empty());

        var result = savedRequestService.get(user, id);

        assertThat(result.latestHistory()).isNull();
    }

    @Test
    void create_throwsNotFound_whenCollectionDoesNotExist() {
        var collectionId = UUID.randomUUID();
        when(collectionRepository.findByIdAndUser(collectionId, user)).thenReturn(Optional.empty());

        var req = new CreateSavedRequestRequest(collectionId, "My Request", "GET",
                "https://example.com", List.of(), List.of(), null, BodyType.NONE, null);

        assertThatThrownBy(() -> savedRequestService.create(user, req))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void duplicate_copiesRequestWithCopySuffix() {
        var id = UUID.randomUUID();
        when(requestRepository.findByIdAndUser(id, user)).thenReturn(Optional.of(savedRequest));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = savedRequestService.duplicate(user, id);

        assertThat(result.name()).isEqualTo("Get Users (Copy)");
        assertThat(result.method()).isEqualTo("GET");
        assertThat(result.url()).isEqualTo("https://api.example.com/users");
    }

    @Test
    void move_setsCollectionToNull_whenCollectionIdIsNull() {
        var id = UUID.randomUUID();
        when(requestRepository.findByIdAndUser(id, user)).thenReturn(Optional.of(savedRequest));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = savedRequestService.move(user, id, new MoveRequestBody(null));

        assertThat(result.collectionId()).isNull();
    }

    @Test
    void delete_removesRequest() {
        var id = UUID.randomUUID();
        when(requestRepository.findByIdAndUser(id, user)).thenReturn(Optional.of(savedRequest));

        savedRequestService.delete(user, id);

        verify(requestRepository).delete(savedRequest);
    }

    @Test
    void listByCollection_returnsLatestHistoryAsNull_whenNoHistoryExists() {
        var collectionId = UUID.randomUUID();
        when(collectionRepository.findByIdAndUser(collectionId, user)).thenReturn(Optional.of(collection));
        when(requestRepository.findAllByCollection(eq(collection), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(savedRequest)));
        when(historyRepository.findLatestByUserAndRequestIds(eq(user), any())).thenReturn(List.of());

        var result = savedRequestService.listByCollection(user, collectionId, 1, 20);

        assertThat(result.data()).hasSize(1);
        assertThat(result.data().get(0).latestHistory()).isNull();
    }

    @Test
    void listByCollection_embedsLatestHistory_whenHistoryExists() {
        var collectionId = UUID.randomUUID();
        var requestId = UUID.randomUUID();
        savedRequest.setId(requestId);

        var history = new RequestHistory();
        history.setId(UUID.randomUUID());
        history.setMethod("GET");
        history.setUrl("https://api.example.com/users");
        history.setResponseStatus(200);
        history.setDurationMs(42);
        history.setSentAt(OffsetDateTime.now());
        history.setRequest(savedRequest);
        history.setUser(user);

        when(collectionRepository.findByIdAndUser(collectionId, user)).thenReturn(Optional.of(collection));
        when(requestRepository.findAllByCollection(eq(collection), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(savedRequest)));
        when(historyRepository.findLatestByUserAndRequestIds(eq(user), any())).thenReturn(List.of(history));

        var result = savedRequestService.listByCollection(user, collectionId, 1, 20);

        assertThat(result.data()).hasSize(1);
        var latestHistory = result.data().get(0).latestHistory();
        assertThat(latestHistory).isNotNull();
        assertThat(latestHistory.responseStatus()).isEqualTo(200);
        assertThat(latestHistory.durationMs()).isEqualTo(42);
    }
}
