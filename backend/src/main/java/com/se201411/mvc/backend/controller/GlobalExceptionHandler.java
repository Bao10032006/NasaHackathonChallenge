package com.se201411.mvc.backend.controller;

import com.se201411.mvc.backend.dto.common.ApiProblemDto;
import com.se201411.mvc.backend.exception.ApiException;
import com.se201411.mvc.backend.exception.DatasetUnavailableException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Set;

@RestControllerAdvice
public final class GlobalExceptionHandler {

	private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);
	private static final String PROBLEM_BASE = "https://hoalich.local/problems/";

	@ExceptionHandler(ApiException.class)
	ResponseEntity<ApiProblemDto> handleApiException(
			ApiException exception,
			HttpServletRequest request) {
		return problem(
				exception.status(),
				exception.code(),
				exception.title(),
				exception.getMessage(),
				request);
	}

	@ExceptionHandler({
			MethodArgumentTypeMismatchException.class,
			MissingServletRequestParameterException.class,
			HandlerMethodValidationException.class,
			ConstraintViolationException.class
	})
	ResponseEntity<ApiProblemDto> handleInvalidParameter(
			Exception exception,
			HttpServletRequest request) {
		return problem(
				HttpStatus.BAD_REQUEST,
				"INVALID_PARAMETER",
				"Invalid parameter",
				exception.getMessage(),
				request);
	}

	/** Unknown routes are client errors; without this the catch-all below turned them into 500s. */
	@ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
	ResponseEntity<ApiProblemDto> handleNotFound(
			Exception exception,
			HttpServletRequest request) {
		return problem(
				HttpStatus.NOT_FOUND,
				"NOT_FOUND",
				"Resource not found",
				"No API resource exists at this path",
				request);
	}

	@ExceptionHandler(HttpRequestMethodNotSupportedException.class)
	ResponseEntity<ApiProblemDto> handleMethodNotAllowed(
			HttpRequestMethodNotSupportedException exception,
			HttpServletRequest request) {
		ResponseEntity<ApiProblemDto> response = problem(
				HttpStatus.METHOD_NOT_ALLOWED,
				"METHOD_NOT_ALLOWED",
				"Method not allowed",
				"HTTP method " + exception.getMethod() + " is not supported for this path",
				request);
		Set<HttpMethod> supported = exception.getSupportedHttpMethods();
		if (supported == null || supported.isEmpty()) {
			return response;
		}
		return ResponseEntity.status(response.getStatusCode())
				.headers(response.getHeaders())
				.allow(supported.toArray(HttpMethod[]::new))
				.body(response.getBody());
	}

	@ExceptionHandler(DatasetUnavailableException.class)
	ResponseEntity<ApiProblemDto> handleDatasetUnavailable(
			DatasetUnavailableException exception,
			HttpServletRequest request) {
		LOGGER.error("Dataset became unavailable while serving {}", request.getRequestURI(), exception);
		return problem(
				HttpStatus.SERVICE_UNAVAILABLE,
				"DATASET_UNAVAILABLE",
				"Dataset unavailable",
				exception.getMessage(),
				request);
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<ApiProblemDto> handleUnexpected(
			Exception exception,
			HttpServletRequest request) {
		LOGGER.error("Unexpected error while serving {}", request.getRequestURI(), exception);
		return problem(
				HttpStatus.INTERNAL_SERVER_ERROR,
				"INTERNAL_ERROR",
				"Internal server error",
				"An unexpected error occurred",
				request);
	}

	private static ResponseEntity<ApiProblemDto> problem(
			HttpStatus status,
			String code,
			String title,
			String detail,
			HttpServletRequest request) {
		ApiProblemDto body = new ApiProblemDto(
				PROBLEM_BASE + code.toLowerCase().replace('_', '-'),
				title,
				status.value(),
				code,
				detail,
				request.getRequestURI(),
				null,
				OffsetDateTime.now(ZoneOffset.UTC));
		return ResponseEntity.status(status)
				.contentType(MediaType.APPLICATION_PROBLEM_JSON)
				.body(body);
	}
}
