package com.fling.service;

import com.fling.dto.execute.ExecuteRequest;
import com.fling.entity.*;
import com.fling.repository.EnvironmentRepository;
import com.fling.repository.RequestHistoryRepository;
import com.fling.repository.SavedRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExecuteServiceTest {

    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    private RestClient restClient;

    @Mock
    private SavedRequestRepository savedRequestRepository;

    @Mock
    private EnvironmentRepository environmentRepository;

    @Mock
    private RequestHistoryRepository historyRepository;

    @InjectMocks
    private ExecuteService executeService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        when(restClient.method(any()).uri(any(java.net.URI.class)).retrieve().toEntity(byte[].class))
                .thenReturn(ResponseEntity.ok("{}".getBytes()));
        when(historyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void execute_interpolatesVariablesIntoUrl() {
        var environmentId = UUID.randomUUID();
        var env = environmentWithVariable(environmentId, "BASE_URL", "api.example.com", false);
        when(environmentRepository.findByIdAndUser(environmentId, user)).thenReturn(Optional.of(env));

        var req = new ExecuteRequest(null, environmentId, "GET", "https://{{BASE_URL}}/users",
                List.of(), List.of(), null, BodyType.NONE);

        var result = executeService.execute(user, req);

        assertThat(result.request().url()).isEqualTo("https://api.example.com/users");
    }

    @Test
    void execute_redactsSecretVariablesInEchoedHeaders() {
        var environmentId = UUID.randomUUID();
        var env = environmentWithVariable(environmentId, "API_KEY", "super-secret", true);
        when(environmentRepository.findByIdAndUser(environmentId, user)).thenReturn(Optional.of(env));

        var req = new ExecuteRequest(null, environmentId, "GET", "https://api.example.com",
                List.of(),
                List.of(new KeyValueEnabled("Authorization", "Bearer {{API_KEY}}", true)),
                null, BodyType.NONE);

        var result = executeService.execute(user, req);

        assertThat(result.request().headers().get("Authorization")).isEqualTo("[REDACTED]");
    }

    @Test
    void execute_savesHistoryEntry() {
        var req = new ExecuteRequest(null, null, "GET", "https://api.example.com",
                List.of(), List.of(), null, BodyType.NONE);

        executeService.execute(user, req);

        var captor = ArgumentCaptor.forClass(RequestHistory.class);
        verify(historyRepository).save(captor.capture());
        assertThat(captor.getValue().getMethod()).isEqualTo("GET");
        assertThat(captor.getValue().getUrl()).isEqualTo("https://api.example.com");
        assertThat(captor.getValue().getResponseStatus()).isEqualTo(200);
    }

    @Test
    void execute_excludesDisabledHeaders() {
        var req = new ExecuteRequest(null, null, "GET", "https://api.example.com",
                List.of(),
                List.of(
                        new KeyValueEnabled("X-Active", "yes", true),
                        new KeyValueEnabled("X-Disabled", "no", false)
                ),
                null, BodyType.NONE);

        var result = executeService.execute(user, req);

        assertThat(result.request().headers()).containsKey("X-Active");
        assertThat(result.request().headers()).doesNotContainKey("X-Disabled");
    }

    private Environment environmentWithVariable(UUID envId, String key, String value, boolean secret) {
        var variable = new EnvironmentVariable();
        variable.setKey(key);
        variable.setValue(value);
        variable.setSecret(secret);

        var env = new Environment();
        env.setUser(user);
        env.setName("Test");
        env.getVariables().add(variable);
        variable.setEnvironment(env);
        return env;
    }
}
