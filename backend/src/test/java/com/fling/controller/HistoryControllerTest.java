package com.fling.controller;

import com.fling.dto.PageResponse;
import com.fling.dto.history.HistoryDetailResponse;
import com.fling.dto.history.HistorySummaryResponse;
import com.fling.entity.User;
import com.fling.exception.GlobalExceptionHandler;
import com.fling.exception.ResourceNotFoundException;
import com.fling.service.HistoryService;
import com.fling.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(HistoryController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class HistoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private HistoryService historyService;

    @MockitoBean
    private UserService userService;

    private User user;
    private HistoryDetailResponse detail;

    @BeforeEach
    void setUp() {
        user = new User();
        when(userService.getDefaultUser()).thenReturn(user);

        detail = new HistoryDetailResponse(
                UUID.randomUUID(), UUID.randomUUID(),
                "GET", "https://api.example.com",
                Map.of(), Map.of(), null,
                200, Map.of(), "{}", 120,
                OffsetDateTime.now()
        );
    }

    @Test
    void GET_history_returns200WithPagedResults() throws Exception {
        var summary = new HistorySummaryResponse(
                detail.id(), detail.requestId(), "GET", "https://api.example.com", 200, 120, OffsetDateTime.now()
        );
        var page = new PageResponse<>(List.of(summary), new PageResponse.Pagination(1, 50, 1, 1));
        when(historyService.list(eq(user), eq(1), eq(50))).thenReturn(page);

        mockMvc.perform(get("/api/v1/history"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].method").value("GET"))
                .andExpect(jsonPath("$.data[0].responseStatus").value(200));
    }

    @Test
    void GET_historyById_returns200() throws Exception {
        when(historyService.get(eq(user), eq(detail.id()))).thenReturn(detail);

        mockMvc.perform(get("/api/v1/history/{id}", detail.id()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.method").value("GET"))
                .andExpect(jsonPath("$.responseStatus").value(200));
    }

    @Test
    void GET_historyById_returns404_whenNotFound() throws Exception {
        var id = UUID.randomUUID();
        when(historyService.get(eq(user), eq(id)))
                .thenThrow(ResourceNotFoundException.of("History entry", id));

        mockMvc.perform(get("/api/v1/history/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void GET_latestHistory_returns200_whenFound() throws Exception {
        var requestId = UUID.randomUUID();
        when(historyService.getLatestForRequest(eq(user), eq(requestId))).thenReturn(Optional.of(detail));

        mockMvc.perform(get("/api/v1/history/latest").param("requestId", requestId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.method").value("GET"))
                .andExpect(jsonPath("$.responseStatus").value(200));
    }

    @Test
    void GET_latestHistory_returns204_whenNotFound() throws Exception {
        var requestId = UUID.randomUUID();
        when(historyService.getLatestForRequest(eq(user), eq(requestId))).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/history/latest").param("requestId", requestId.toString()))
                .andExpect(status().isNoContent());
    }

    @Test
    void DELETE_historyById_returns204() throws Exception {
        mockMvc.perform(delete("/api/v1/history/{id}", detail.id()))
                .andExpect(status().isNoContent());
    }
}
