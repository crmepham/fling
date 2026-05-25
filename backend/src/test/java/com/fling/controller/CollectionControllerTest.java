package com.fling.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fling.dto.PageResponse;
import com.fling.dto.collection.CollectionResponse;
import com.fling.entity.User;
import com.fling.exception.ConflictException;
import com.fling.exception.GlobalExceptionHandler;
import com.fling.exception.ResourceNotFoundException;
import com.fling.service.CollectionService;
import com.fling.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;


import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CollectionController.class)
@Import(GlobalExceptionHandler.class)
class CollectionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private CollectionService collectionService;

    @MockitoBean
    private UserService userService;

    private User user;
    private CollectionResponse sampleResponse;

    @BeforeEach
    void setUp() {
        user = new User();
        when(userService.getDefaultUser()).thenReturn(user);

        sampleResponse = new CollectionResponse(
                UUID.randomUUID(), "My Collection", "A description",
                OffsetDateTime.now(), OffsetDateTime.now()
        );
    }

    @Test
    void GET_collections_returns200WithPagedResults() throws Exception {
        var page = new PageResponse<>(List.of(sampleResponse),
                new PageResponse.Pagination(1, 20, 1, 1));
        when(collectionService.list(eq(user), eq(1), eq(20))).thenReturn(page);

        mockMvc.perform(get("/api/v1/collections"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").value("My Collection"))
                .andExpect(jsonPath("$.data[0].requestCount").doesNotExist())
                .andExpect(jsonPath("$.pagination.totalElements").value(1));
    }

    @Test
    void POST_collections_returns201WithCreatedCollection() throws Exception {
        when(collectionService.create(eq(user), any())).thenReturn(sampleResponse);

        mockMvc.perform(post("/api/v1/collections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "My Collection"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("My Collection"));
    }

    @Test
    void POST_collections_returns400_whenNameIsBlank() throws Exception {
        mockMvc.perform(post("/api/v1/collections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", ""))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void DELETE_collection_returns204() throws Exception {
        var id = UUID.randomUUID();
        doNothing().when(collectionService).delete(eq(user), eq(id));

        mockMvc.perform(delete("/api/v1/collections/{id}", id))
                .andExpect(status().isNoContent());
    }

    @Test
    void DELETE_collection_returns409_whenLastCollection() throws Exception {
        var id = UUID.randomUUID();
        doThrow(new ConflictException("Cannot delete the last remaining collection"))
                .when(collectionService).delete(eq(user), eq(id));

        mockMvc.perform(delete("/api/v1/collections/{id}", id))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    void GET_collection_returns404_whenNotFound() throws Exception {
        var id = UUID.randomUUID();
        when(collectionService.get(eq(user), eq(id)))
                .thenThrow(ResourceNotFoundException.of("Collection", id));

        mockMvc.perform(get("/api/v1/collections/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("RESOURCE_NOT_FOUND"));
    }
}
