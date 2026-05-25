package com.fling.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fling.dto.execute.ExecuteResponse;
import com.fling.entity.BodyType;
import com.fling.entity.User;
import com.fling.exception.GlobalExceptionHandler;
import com.fling.service.ExecuteService;
import com.fling.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ExecuteController.class)
@Import(GlobalExceptionHandler.class)
class ExecuteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ExecuteService executeService;

    @MockitoBean
    private UserService userService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        when(userService.getDefaultUser()).thenReturn(user);
    }

    @Test
    void POST_execute_returns200WithResponse() throws Exception {
        var historyId = UUID.randomUUID();
        var response = new ExecuteResponse(
                historyId,
                new ExecuteResponse.RequestSnapshot("GET", "https://api.example.com", Map.of(), Map.of(), null),
                new ExecuteResponse.ResponseSnapshot(200, "OK", Map.of("content-type", "application/json"),
                        "{\"status\":\"ok\"}", 120, 15)
        );
        when(executeService.execute(eq(user), any())).thenReturn(response);

        var body = Map.of(
                "method", "GET",
                "url", "https://api.example.com",
                "bodyType", "NONE"
        );

        mockMvc.perform(post("/api/v1/execute")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.historyId").value(historyId.toString()))
                .andExpect(jsonPath("$.response.status").value(200))
                .andExpect(jsonPath("$.response.durationMs").value(120));
    }

    @Test
    void POST_execute_returns400_whenMethodMissing() throws Exception {
        var body = Map.of(
                "url", "https://api.example.com",
                "bodyType", "NONE"
        );

        mockMvc.perform(post("/api/v1/execute")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }
}
