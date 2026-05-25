package com.fling.service;

import com.fling.dto.execute.ExecuteRequest;
import com.fling.dto.execute.ExecuteResponse;
import com.fling.entity.*;
import com.fling.exception.ResourceNotFoundException;
import com.fling.repository.EnvironmentRepository;
import com.fling.repository.RequestHistoryRepository;
import com.fling.repository.SavedRequestRepository;
import com.fling.exception.ErrorCode;
import com.fling.exception.RequestExecutionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExecuteService {

    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{(\\w+)}}");
    private static final String REDACTED = "[REDACTED]";

    private final RestClient restClient;
    private final SavedRequestRepository savedRequestRepository;
    private final EnvironmentRepository environmentRepository;
    private final RequestHistoryRepository historyRepository;

    @Transactional
    public ExecuteResponse execute(User user, ExecuteRequest req) {
        Map<String, String> variables = resolveVariables(user, req.environmentId());
        Set<String> secretValues = resolveSecretValues(user, req.environmentId());

        String interpolatedUrl = interpolate(req.url(), variables);

        Map<String, String> outboundQueryParams = new LinkedHashMap<>();
        if (req.queryParams() != null) {
            for (var kv : req.queryParams()) {
                if (kv.enabled()) outboundQueryParams.put(kv.key(), interpolate(kv.value(), variables));
            }
        }

        Map<String, String> outboundHeaders = new LinkedHashMap<>();
        if (req.headers() != null) {
            for (var kv : req.headers()) {
                if (kv.enabled()) outboundHeaders.put(kv.key(), interpolate(kv.value(), variables));
            }
        }

        var rawBody = req.body() != null ? req.body() : null;
        var outboundBody = rawBody != null ? interpolate(rawBody, variables) : null;

        long start = System.currentTimeMillis();
        ResponseEntity<byte[]> response = sendRequest(req.method(), interpolatedUrl, outboundQueryParams, outboundHeaders, outboundBody, req.bodyType());
        int durationMs = (int) (System.currentTimeMillis() - start);

        var responseBytes = response.getBody();
        var responseBody = responseBytes != null ? new String(responseBytes, StandardCharsets.UTF_8) : null;
        Map<String, String> responseHeaders = new LinkedHashMap<>();
        response.getHeaders().forEach((name, values) -> responseHeaders.put(name, String.join(", ", values)));

        // Redact secret values in echoed request data before persisting/returning
        Map<String, String> redactedHeaders = redact(outboundHeaders, secretValues);
        String redactedBody = outboundBody; // body redaction left for future enhancement

        SavedRequest savedRequest = null;
        if (req.requestId() != null) {
            savedRequest = savedRequestRepository.findByIdAndUser(req.requestId(), user).orElse(null);
        }

        RequestHistory history = new RequestHistory();
        history.setUser(user);
        history.setRequest(savedRequest);
        history.setMethod(req.method());
        history.setUrl(interpolatedUrl);
        history.setQueryParams(outboundQueryParams);
        history.setHeaders(redactedHeaders);
        history.setBody(redactedBody);
        history.setResponseStatus(response.getStatusCode().value());
        history.setResponseHeaders(responseHeaders);
        history.setResponseBody(responseBody);
        history.setDurationMs(durationMs);
        history.setSentAt(OffsetDateTime.now());
        historyRepository.save(history);

        var statusCode = response.getStatusCode().value();
        var httpStatus = org.springframework.http.HttpStatus.resolve(statusCode);
        var statusText = httpStatus != null ? httpStatus.getReasonPhrase() : "";

        return new ExecuteResponse(
                history.getId(),
                new ExecuteResponse.RequestSnapshot(req.method(), interpolatedUrl, outboundQueryParams, redactedHeaders, redactedBody),
                new ExecuteResponse.ResponseSnapshot(
                        statusCode,
                        statusText,
                        responseHeaders,
                        responseBody,
                        durationMs,
                        responseBytes != null ? responseBytes.length : 0
                )
        );
    }

    private ResponseEntity<byte[]> sendRequest(String method, String url, Map<String, String> queryParams,
                                               Map<String, String> headers, String body, BodyType bodyType) {
        var uriBuilder = UriComponentsBuilder.fromUriString(url);
        queryParams.forEach(uriBuilder::queryParam);

        var spec = restClient.method(HttpMethod.valueOf(method))
                .uri(uriBuilder.build().toUri());

        headers.forEach(spec::header);

        // Set Content-Type if the user hasn't provided one and a body is present
        if (body != null && !hasContentTypeHeader(headers)) {
            spec.contentType(resolveContentType(bodyType));
        }

        var retrieveSpec = body != null ? spec.body(body).retrieve() : spec.retrieve();

        // Suppress the default error handler so 4xx/5xx responses from the target
        // server are captured and returned to the client rather than thrown as exceptions.
        try {
            return retrieveSpec
                    .onStatus(code -> code.isError(), (req, res) -> {})
                    .toEntity(byte[].class);
        } catch (ResourceAccessException ex) {
            throw translateNetworkException(ex);
        }
    }

    private static RequestExecutionException translateNetworkException(ResourceAccessException ex) {
        var cause = ex.getCause();
        if (cause instanceof java.net.UnknownHostException uhe) {
            return new RequestExecutionException(ErrorCode.PROXY_UPSTREAM_UNREACHABLE,
                    "Could not resolve host: " + uhe.getMessage());
        }
        if (cause instanceof java.net.ConnectException) {
            return new RequestExecutionException(ErrorCode.PROXY_UPSTREAM_UNREACHABLE,
                    "Connection refused: " + Optional.ofNullable(cause.getMessage()).orElse(ex.getMessage()));
        }
        if (cause instanceof java.net.SocketTimeoutException) {
            return new RequestExecutionException(ErrorCode.PROXY_UPSTREAM_TIMEOUT,
                    "Request timed out");
        }
        return new RequestExecutionException(ErrorCode.PROXY_UPSTREAM_UNREACHABLE,
                "Network error: " + ex.getMessage());
    }

    private static boolean hasContentTypeHeader(Map<String, String> headers) {
        return headers.keySet().stream().anyMatch(k -> k.equalsIgnoreCase("content-type"));
    }

    private static org.springframework.http.MediaType resolveContentType(BodyType bodyType) {
        return switch (bodyType) {
            case JSON -> org.springframework.http.MediaType.APPLICATION_JSON;
            case FORM -> org.springframework.http.MediaType.APPLICATION_FORM_URLENCODED;
            default -> org.springframework.http.MediaType.TEXT_PLAIN;
        };
    }

    private Map<String, String> resolveVariables(User user, UUID environmentId) {
        if (environmentId == null) return Map.of();
        var env = environmentRepository.findByIdAndUser(environmentId, user)
                .orElseThrow(() -> ResourceNotFoundException.of("Environment", environmentId));
        var map = new LinkedHashMap<String, String>();
        env.getVariables().forEach(v -> map.put(v.getKey(), v.getValue()));
        return map;
    }

    private Set<String> resolveSecretValues(User user, UUID environmentId) {
        if (environmentId == null) return Set.of();
        var env = environmentRepository.findByIdAndUser(environmentId, user)
                .orElseThrow(() -> ResourceNotFoundException.of("Environment", environmentId));
        var values = new HashSet<String>();
        env.getVariables().stream().filter(EnvironmentVariable::isSecret).forEach(v -> values.add(v.getValue()));
        return values;
    }

    private String interpolate(String template, Map<String, String> variables) {
        if (template == null) return null;
        Matcher matcher = VARIABLE_PATTERN.matcher(template);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            String key = matcher.group(1);
            String replacement = variables.getOrDefault(key, matcher.group(0));
            matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    private Map<String, String> redact(Map<String, String> headers, Set<String> secretKeys) {
        if (secretKeys.isEmpty()) return headers;
        var redacted = new LinkedHashMap<>(headers);
        for (var secretKey : secretKeys) {
            redacted.replaceAll((headerName, headerValue) ->
                    headerValue != null && headerValue.contains(secretKey) ? REDACTED : headerValue);
        }
        return redacted;
    }
}
