package com.fling.service;

import com.fling.dto.request.CreateSavedRequestRequest;
import com.fling.dto.request.MoveRequestBody;
import com.fling.entity.BodyType;
import com.fling.entity.RequestCollection;
import com.fling.entity.SavedRequest;
import com.fling.entity.User;
import com.fling.exception.ResourceNotFoundException;
import com.fling.repository.RequestCollectionRepository;
import com.fling.repository.SavedRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SavedRequestServiceTest {

    @Mock
    private SavedRequestRepository requestRepository;

    @Mock
    private RequestCollectionRepository collectionRepository;

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
    void create_throwsNotFound_whenCollectionDoesNotExist() {
        var collectionId = UUID.randomUUID();
        when(collectionRepository.findByIdAndUser(collectionId, user)).thenReturn(Optional.empty());

        var req = new CreateSavedRequestRequest(collectionId, "My Request", "GET",
                "https://example.com", List.of(), List.of(), null, BodyType.NONE);

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
}
