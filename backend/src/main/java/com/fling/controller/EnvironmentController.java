package com.fling.controller;

import com.fling.dto.PageResponse;
import com.fling.dto.environment.BulkUpdateVariablesRequest;
import com.fling.dto.environment.EnvironmentDetailResponse;
import com.fling.dto.environment.EnvironmentSummaryResponse;
import com.fling.service.EnvironmentService;
import com.fling.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/environments")
@RequiredArgsConstructor
public class EnvironmentController {

    private final EnvironmentService environmentService;
    private final UserService userService;

    @GetMapping
    public PageResponse<EnvironmentSummaryResponse> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return environmentService.list(userService.getDefaultUser(), page, pageSize);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EnvironmentDetailResponse create(@RequestBody Map<String, String> body) {
        return environmentService.create(userService.getDefaultUser(), body.get("name"));
    }

    @GetMapping("/{id}")
    public EnvironmentDetailResponse get(@PathVariable UUID id) {
        return environmentService.get(userService.getDefaultUser(), id);
    }

    @PutMapping("/{id}")
    public EnvironmentDetailResponse rename(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        return environmentService.rename(userService.getDefaultUser(), id, body.get("name"));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        environmentService.delete(userService.getDefaultUser(), id);
    }

    @PutMapping("/{id}/variables")
    public EnvironmentDetailResponse bulkUpdateVariables(
            @PathVariable UUID id,
            @Valid @RequestBody BulkUpdateVariablesRequest req) {
        return environmentService.bulkUpdateVariables(userService.getDefaultUser(), id, req);
    }

    @PatchMapping("/{environmentId}/variables/{variableId}")
    public EnvironmentDetailResponse.VariableResponse updateVariable(
            @PathVariable UUID environmentId,
            @PathVariable UUID variableId,
            @RequestBody Map<String, Object> body) {
        String key = (String) body.get("key");
        String value = (String) body.get("value");
        Boolean isSecret = body.containsKey("isSecret") ? (Boolean) body.get("isSecret") : null;
        return environmentService.updateVariable(userService.getDefaultUser(), environmentId, variableId, key, value, isSecret);
    }

    @DeleteMapping("/{environmentId}/variables/{variableId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteVariable(@PathVariable UUID environmentId, @PathVariable UUID variableId) {
        environmentService.deleteVariable(userService.getDefaultUser(), environmentId, variableId);
    }
}
