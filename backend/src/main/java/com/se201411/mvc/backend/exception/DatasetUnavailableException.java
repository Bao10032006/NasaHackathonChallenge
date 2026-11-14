package com.se201411.mvc.backend.exception;

public class DatasetUnavailableException extends RuntimeException {

	public DatasetUnavailableException(String message) {
		super(message);
	}

	public DatasetUnavailableException(String message, Throwable cause) {
		super(message, cause);
	}
}
