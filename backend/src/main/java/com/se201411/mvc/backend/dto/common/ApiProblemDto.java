package com.se201411.mvc.backend.dto.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.OffsetDateTime;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiProblemDto(
		String type,
		String title,
		int status,
		String code,
		String detail,
		String instance,
		List<FieldErrorDto> errors,
		OffsetDateTime timestamp) {

	public record FieldErrorDto(String field, String message) {
	}
}
