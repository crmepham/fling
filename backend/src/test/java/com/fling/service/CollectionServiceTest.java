package com.fling.service;

import com.fling.dto.collection.CreateCollectionRequest;
import com.fling.entity.RequestCollection;
import com.fling.entity.User;
import com.fling.exception.ConflictException;
import com.fling.exception.ResourceNotFoundException;
import com.fling.repository.RequestCollectionRepository;
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
class CollectionServiceTest {

    @Mock
    private RequestCollectionRepository collectionRepository;

    @InjectMocks
    private CollectionService collectionService;

    private User user;
    private RequestCollection collection;

    @BeforeEach
    void setUp() {
        user = new User();

        collection = new RequestCollection();
        collection.setUser(user);
        collection.setName("Test Collection");
        collection.setDescription("A description");
    }

    @Test
    void list_returnsPagedCollections() {
        var page = new PageImpl<>(List.of(collection));
        when(collectionRepository.findAllByUser(eq(user), any(Pageable.class))).thenReturn(page);

        var result = collectionService.list(user, 1, 20);

        assertThat(result.data()).hasSize(1);
        assertThat(result.data().get(0).name()).isEqualTo("Test Collection");
        assertThat(result.pagination().page()).isEqualTo(1);
    }

    @Test
    void create_savesAndReturnsCollection() {
        var req = new CreateCollectionRequest("New Collection", "desc");
        when(collectionRepository.save(any())).thenReturn(collection);

        var result = collectionService.create(user, req);

        assertThat(result.name()).isEqualTo("Test Collection");
        verify(collectionRepository).save(any(RequestCollection.class));
    }

    @Test
    void get_throwsNotFound_whenCollectionDoesNotExist() {
        var id = UUID.randomUUID();
        when(collectionRepository.findByIdAndUser(id, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> collectionService.get(user, id))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void delete_throwsConflict_whenDeletingLastCollection() {
        var id = UUID.randomUUID();
        when(collectionRepository.findByIdAndUser(id, user)).thenReturn(Optional.of(collection));
        when(collectionRepository.countByUser(user)).thenReturn(1L);

        assertThatThrownBy(() -> collectionService.delete(user, id))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("last remaining collection");
    }

    @Test
    void delete_succeeds_whenMultipleCollectionsExist() {
        var id = UUID.randomUUID();
        when(collectionRepository.findByIdAndUser(id, user)).thenReturn(Optional.of(collection));
        when(collectionRepository.countByUser(user)).thenReturn(2L);

        collectionService.delete(user, id);

        verify(collectionRepository).delete(collection);
    }
}
