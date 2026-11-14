package com.se201411.mvc.backend.dto.common;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record MapCellValueDto(
		String cellId,
		CoordinatesDto center,
		BoundsDto bounds,
		@JsonInclude(JsonInclude.Include.ALWAYS)
		Double value,
		String valueStatus,
		boolean partial,
		@JsonInclude(JsonInclude.Include.ALWAYS)
		String origin,
		Integer sourceCode,
		String source,
		Integer inputObservationCount,
		Boolean sourceInputValid) {
}
