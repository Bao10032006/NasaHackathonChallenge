package com.se201411.mvc.backend.dto.analysis;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.se201411.mvc.backend.dto.common.ResponseMetaDto;
import com.se201411.mvc.backend.dto.common.SpatialSelectionDto;

import java.util.List;

/** OpenAPI v0.4 {@code SeasonalityResponse}. */
public record SeasonalityResponseDto(
		SpatialSelectionDto selection,
		String granularity,
		int referenceStartYear,
		int referenceEndYear,
		int minimumSampleSize,
		List<PeriodDto> periods,
		ResponseMetaDto meta) {

	/** OpenAPI v0.4 {@code SeasonalityPeriod}: mean and median are required and null when insufficient. */
	@JsonInclude(JsonInclude.Include.ALWAYS)
	public record PeriodDto(int period, int sampleSize, Double mean, Double median, String valueStatus) {
	}
}
