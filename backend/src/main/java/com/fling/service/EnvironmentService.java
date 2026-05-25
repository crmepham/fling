package com.fling.service;

import com.fling.dto.PageResponse;
import com.fling.dto.environment.BulkUpdateVariablesRequest;
import com.fling.dto.environment.EnvironmentDetailResponse;
import com.fling.dto.environment.EnvironmentSummaryResponse;
import com.fling.entity.Environment;
import com.fling.entity.EnvironmentVariable;
import com.fling.entity.User;
import com.fling.exception.ConflictException;
import com.fling.exception.ResourceNotFoundException;
import com.fling.repository.EnvironmentRepository;
import com.fling.repository.EnvironmentVariableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EnvironmentService {

    private static final String SECRET_SENTINEL = "__UNCHANGED__";

    private final EnvironmentRepository environmentRepository;
    private final EnvironmentVariableRepository variableRepository;

    @Transactional(readOnly = true)
    public PageResponse<EnvironmentSummaryResponse> list(User user, int page, int pageSize) {
        var pageable = PageRequest.of(page - 1, pageSize, Sort.by("createdAt").descending());
        var result = environmentRepository.findAllByUser(user, pageable);
        return PageResponse.of(result, EnvironmentSummaryResponse::of);
    }

    @Transactional
    public EnvironmentDetailResponse create(User user, String name) {
        checkNameUnique(user, name, null);
        var env = new Environment();
        env.setUser(user);
        env.setName(name);
        return EnvironmentDetailResponse.of(environmentRepository.save(env));
    }

    @Transactional(readOnly = true)
    public EnvironmentDetailResponse get(User user, UUID id) {
        return EnvironmentDetailResponse.of(findOrThrow(user, id));
    }

    @Transactional
    public EnvironmentDetailResponse rename(User user, UUID id, String name) {
        checkNameUnique(user, name, id);
        var env = findOrThrow(user, id);
        env.setName(name);
        return EnvironmentDetailResponse.of(environmentRepository.save(env));
    }

    @Transactional
    public void delete(User user, UUID id) {
        if (environmentRepository.countByUser(user) <= 1) {
            throw new ConflictException("Cannot delete the last environment");
        }
        environmentRepository.delete(findOrThrow(user, id));
    }

    @Transactional
    public EnvironmentDetailResponse bulkUpdateVariables(User user, UUID id, BulkUpdateVariablesRequest req) {
        var env = findOrThrow(user, id);
        var entries = req.variables();

        long distinctKeys = entries.stream().map(BulkUpdateVariablesRequest.VariableEntry::key).distinct().count();
        if (distinctKeys != entries.size()) {
            throw new IllegalArgumentException("Duplicate variable keys in request");
        }

        // Build secret-value lookup before deleting anything
        var existingByKey = env.getVariables().stream()
                .collect(java.util.stream.Collectors.toMap(EnvironmentVariable::getKey, v -> v));

        // Bypass Hibernate's collection management entirely.
        // Using env.getVariables().clear() + cascade would trigger orphan-removal deletes
        // AFTER Hibernate has already queued the new inserts (default flush order: inserts →
        // updates → deletes), violating the unique (environment_id, key) constraint.
        // A @Modifying JPQL delete goes straight to the DB before we insert new rows.
        variableRepository.deleteAllByEnvironment(env);

        var newVariables = entries.stream().map(entry -> {
            var variable = new EnvironmentVariable();
            variable.setEnvironment(env);
            variable.setKey(entry.key());
            variable.setSecret(entry.isSecret());
            if (entry.isSecret() && SECRET_SENTINEL.equals(entry.value())) {
                var existing = existingByKey.get(entry.key());
                variable.setValue(existing != null ? existing.getValue() : "");
            } else {
                variable.setValue(entry.value());
            }
            return variable;
        }).toList();

        var saved = variableRepository.saveAll(newVariables);

        return new EnvironmentDetailResponse(
                env.getId(),
                env.getName(),
                saved.stream().map(EnvironmentDetailResponse.VariableResponse::of).toList(),
                env.getCreatedAt(),
                env.getUpdatedAt()
        );
    }

    @Transactional
    public EnvironmentDetailResponse.VariableResponse updateVariable(User user, UUID environmentId, UUID variableId,
                                                                     String key, String value, Boolean isSecret) {
        findOrThrow(user, environmentId);
        var variable = variableRepository.findByIdAndEnvironmentId(variableId, environmentId)
                .orElseThrow(() -> ResourceNotFoundException.of("Variable", variableId));

        if (key != null) variable.setKey(key);
        if (value != null) variable.setValue(value);
        if (isSecret != null) variable.setSecret(isSecret);

        variableRepository.save(variable);
        return EnvironmentDetailResponse.VariableResponse.of(variable);
    }

    @Transactional
    public void deleteVariable(User user, UUID environmentId, UUID variableId) {
        findOrThrow(user, environmentId);
        var variable = variableRepository.findByIdAndEnvironmentId(variableId, environmentId)
                .orElseThrow(() -> ResourceNotFoundException.of("Variable", variableId));
        variableRepository.delete(variable);
    }

    private void checkNameUnique(User user, String name, UUID excludeId) {
        if (excludeId != null && environmentRepository.existsByUserAndNameAndIdNot(user, name, excludeId)) {
            throw new ConflictException("An environment named '" + name + "' already exists");
        }
    }

    private Environment findOrThrow(User user, UUID id) {
        return environmentRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> ResourceNotFoundException.of("Environment", id));
    }
}
