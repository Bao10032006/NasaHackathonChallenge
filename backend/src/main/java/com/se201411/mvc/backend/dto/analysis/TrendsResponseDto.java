package com.se201411.mvc.backend.dto.analysis;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.se201411.mvc.backend.dto.common.CoverageDto;
import com.se201411.mvc.backend.dto.common.ResponseMetaDto;
import com.se201411.mvc.backend.dto.common.SpatialSelectionDto;

import java.util.List;

/** OpenAPI v0.4 {@code TrendsResponse}; {@code period} is omitted for granularity=year. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TrendsResponseDto(
		SpatialSelectionDto selection,
		String granularity,
		Integer period,
		List<PointDto> points,
		ResponseMetaDto meta) {

	/** OpenAPI v0.4 {@code TrendPoint}: value and origin are required and may be null. */
	@JsonInclude(JsonInclude.Include.ALWAYS)
	public record PointDto(
			int year,
			@JsonInclude(JsonInclude.Include.NON_NULL) Integer period,
			Double value,
			String valueStatus,
			boolean partial,
			String origin,
			CoverageDto coverage) {
	}
}
