package com.se201411.mvc.backend.exception;

import org.springframework.http.HttpStatus;

public final class ApiException extends RuntimeException {

	private final HttpStatus status;
	private final String code;
	private final String title;

	public ApiException(HttpStatus status, String code, String title, String detail) {
		super(detail);
		this.status = status;
		this.code = code;
		this.title = title;
	}

	public HttpStatus status() {
		return status;
	}

	public String code() {
		return code;
	}

	public String title() {
		return title;
	}

	public static ApiException invalidParameter(String detail) {
		return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PARAMETER", "Invalid parameter", detail);
	}

	public static ApiException invalidSpatialSelector(String detail) {
		return new ApiException(
				HttpStatus.BAD_REQUEST,
				"INVALID_SPATIAL_SELECTOR",
				"Invalid spatial selector",
				detail);
	}

	public static ApiException invalidBounds(String detail) {
		return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_BOUNDS", "Invalid bounds", detail);
	}

	public static ApiException invalidTemporalSelector(String detail) {
		return new ApiException(
				HttpStatus.BAD_REQUEST,
				"INVALID_TEMPORAL_SELECTOR",
				"Invalid temporal selector",
				detail);
	}

	public static ApiException areaNotFound(String detail) {
		return new ApiException(HttpStatus.NOT_FOUND, "AREA_NOT_FOUND", "Area not found", detail);
	}

	public static ApiException cellNotFound(String detail) {
		return new ApiException(HttpStatus.NOT_FOUND, "CELL_NOT_FOUND", "Cell not found", detail);
	}

	public static ApiException noCellsInBounds(String detail) {
		return new ApiException(
				HttpStatus.UNPROCESSABLE_CONTENT,
				"NO_CELLS_IN_BOUNDS",
				"No cells in bounds",
				detail);
	}

	public static ApiException unsupportedQuery(String detail) {
		return new ApiException(
				HttpStatus.UNPROCESSABLE_CONTENT,
				"UNSUPPORTED_QUERY",
				"Unsupported query",
				detail);
	}

	public static ApiException dateOutsideDatasetRange(String detail) {
		return new ApiException(
				HttpStatus.UNPROCESSABLE_CONTENT,
				"DATE_OUTSIDE_DATASET_RANGE",
				"Date outside dataset range",
				detail);
	}
}
