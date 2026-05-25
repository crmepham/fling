package com.fling.service;

import com.fling.dto.environment.BulkUpdateVariablesRequest;
import com.fling.entity.Environment;
import com.fling.entity.EnvironmentVariable;
import com.fling.entity.User;
import com.fling.exception.ConflictException;
import com.fling.exception.ResourceNotFoundException;
import com.fling.repository.EnvironmentRepository;
import com.fling.repository.EnvironmentVariableRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EnvironmentServiceTest {

    @Mock
    private EnvironmentRepository environmentRepository;

    @Mock
    private EnvironmentVariableRepository variableRepository;

    @InjectMocks
    private EnvironmentService environmentService;

    private User user;
    private Environment environment;

    @BeforeEach
    void setUp() {
        user = new User();

        environment = new Environment();
        environment.setUser(user);
        environment.setName("Production");
    }

    @Test
    void delete_throwsConflict_whenOnlyOneEnvironmentRemains() {
        var id = UUID.randomUUID();
        when(environmentRepository.countByUser(user)).thenReturn(1L);

        assertThatThrownBy(() -> environmentService.delete(user, id))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("last environment");
        verify(environmentRepository, never()).delete(any());
    }

    @Test
    void delete_succeeds_whenMultipleEnvironmentsExist() {
        var id = UUID.randomUUID();
        when(environmentRepository.countByUser(user)).thenReturn(2L);
        when(environmentRepository.findByIdAndUser(id, user)).thenReturn(Optional.of(environment));

        environmentService.delete(user, id);

        verify(environmentRepository).delete(environment);
    }

    @Test
    void get_throwsNotFound_whenEnvironmentDoesNotExist() {
        var id = UUID.randomUUID();
        when(environmentRepository.findByIdAndUser(id, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> environmentService.get(user, id))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void rename_throwsConflict_whenNameAlreadyTaken() {
        var id = UUID.randomUUID();
        when(environmentRepository.existsByUserAndNameAndIdNot(user, "Staging", id)).thenReturn(true);

        assertThatThrownBy(() -> environmentService.rename(user, id, "Staging"))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void bulkUpdateVariables_replacesAllVariables() {
        var id = UUID.randomUUID();
        environment.getVariables().add(existingVariable("OLD_KEY", "old_value", false));
        when(environmentRepository.findByIdAndUser(id, user)).thenReturn(Optional.of(environment));
        when(variableRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        var req = new BulkUpdateVariablesRequest(List.of(
                new BulkUpdateVariablesRequest.VariableEntry("NEW_KEY", "new_value", false)
        ));
        var result = environmentService.bulkUpdateVariables(user, id, req);

        // JPQL delete must run before saveAll — prevents unique (environment_id, key) violation
        var inOrder = inOrder(variableRepository);
        inOrder.verify(variableRepository).deleteAllByEnvironment(environment);
        inOrder.verify(variableRepository).saveAll(any());

        assertThat(result.variables()).hasSize(1);
        assertThat(result.variables().get(0).key()).isEqualTo("NEW_KEY");
        assertThat(result.variables().get(0).value()).isEqualTo("new_value");
    }

    @Test
    void bulkUpdateVariables_deletesBeforeInserts_whenSameKeyResubmitted() {
        // Reproduces: duplicate key value violates unique constraint "environment_variables_environment_id_key_key"
        var id = UUID.randomUUID();
        environment.getVariables().add(existingVariable("MY_VAR", "old_value", false));
        when(environmentRepository.findByIdAndUser(id, user)).thenReturn(Optional.of(environment));
        when(variableRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        var req = new BulkUpdateVariablesRequest(List.of(
                new BulkUpdateVariablesRequest.VariableEntry("MY_VAR", "new_value", false)
        ));
        var result = environmentService.bulkUpdateVariables(user, id, req);

        var inOrder = inOrder(variableRepository);
        inOrder.verify(variableRepository).deleteAllByEnvironment(environment);
        inOrder.verify(variableRepository).saveAll(any());

        assertThat(result.variables()).hasSize(1);
        assertThat(result.variables().get(0).value()).isEqualTo("new_value");
    }

    @Test
    void bulkUpdateVariables_preservesSecretValue_whenSentinelProvided() {
        var id = UUID.randomUUID();
        environment.getVariables().add(existingVariable("API_KEY", "super-secret", true));
        when(environmentRepository.findByIdAndUser(id, user)).thenReturn(Optional.of(environment));
        when(environmentRepository.save(any())).thenReturn(environment);

        var req = new BulkUpdateVariablesRequest(List.of(
                new BulkUpdateVariablesRequest.VariableEntry("API_KEY", "__UNCHANGED__", true)
        ));
        environmentService.bulkUpdateVariables(user, id, req);

        assertThat(environment.getVariables().get(0).getValue()).isEqualTo("super-secret");
    }

    @Test
    void bulkUpdateVariables_throwsIllegalArgument_whenDuplicateKeysSubmitted() {
        var id = UUID.randomUUID();
        when(environmentRepository.findByIdAndUser(id, user)).thenReturn(Optional.of(environment));

        var req = new BulkUpdateVariablesRequest(List.of(
                new BulkUpdateVariablesRequest.VariableEntry("DUPLICATE", "a", false),
                new BulkUpdateVariablesRequest.VariableEntry("DUPLICATE", "b", false)
        ));

        assertThatThrownBy(() -> environmentService.bulkUpdateVariables(user, id, req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Duplicate");
    }

    private EnvironmentVariable existingVariable(String key, String value, boolean secret) {
        var variable = new EnvironmentVariable();
        variable.setEnvironment(environment);
        variable.setKey(key);
        variable.setValue(value);
        variable.setSecret(secret);
        return variable;
    }
}
