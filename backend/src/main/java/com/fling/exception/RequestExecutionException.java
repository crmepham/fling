package com.fling.exception;

public class RequestExecutionException extends RuntimeException {
    private final ErrorCode errorCode;

    public RequestExecutionException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}
