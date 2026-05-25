package com.fling.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler {

    record ErrorResponse(Error error) {
        record Error(ErrorCode code, String message, List<FieldErr> fieldErrors) {}
        record FieldErr(String field, String message) {}
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(error(ErrorCode.RESOURCE_NOT_FOUND, ex.getMessage()));
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflict(ConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(error(ErrorCode.CONFLICT, ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        var fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> new ErrorResponse.FieldErr(f.getField(), f.getDefaultMessage()))
                .toList();
        var body = new ErrorResponse(new ErrorResponse.Error(ErrorCode.VALIDATION_ERROR, "Validation failed", fieldErrors));
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleNotReadable(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest().body(error(ErrorCode.VALIDATION_ERROR, "Malformed request body"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(error(ErrorCode.VALIDATION_ERROR, ex.getMessage()));
    }

    @ExceptionHandler(RequestExecutionException.class)
    public ResponseEntity<ErrorResponse> handleRequestExecution(RequestExecutionException ex) {
        var status = ex.getErrorCode() == ErrorCode.PROXY_UPSTREAM_TIMEOUT
                ? HttpStatus.GATEWAY_TIMEOUT
                : HttpStatus.BAD_GATEWAY;
        return ResponseEntity.status(status).body(error(ex.getErrorCode(), ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(error(ErrorCode.INTERNAL_ERROR, "An unexpected error occurred"));
    }

    private ErrorResponse error(ErrorCode code, String message) {
        return new ErrorResponse(new ErrorResponse.Error(code, message, List.of()));
    }
}
