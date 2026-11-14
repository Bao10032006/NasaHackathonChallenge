package com.se201411.mvc.backend.dto.activity;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.se201411.mvc.backend.dto.common.CoverageDto;
import com.se201411.mvc.backend.dto.common.ResponseMetaDto;
import com.se201411.mvc.backend.dto.common.SpatialSelectionDto;

import java.time.LocalDate;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CalendarResponseDto(
		SpatialSelectionDto selection,
		int year,
		String granularity,
		List<ValueDto> values,
		SummaryDto summary,
		BaselineDto baseline,
		ResponseMetaDto meta) {

	@JsonInclude(JsonInclude.Include.ALWAYS)
	public record ValueDto(
			int period,
			LocalDate startDate,
			LocalDate endDate,
			Double value,
			String valueStatus,
			boolean partial,
			String origin,
			CoverageDto coverage) {
	}

	@JsonInclude(JsonInclude.Include.ALWAYS)
	public record SummaryDto(
			Double totalValue,
			String valueStatus,
			CoverageDto coverage,
			PeriodPeakDto peakPeriod) {
	}

	public record PeriodPeakDto(int period, double value) {
	}

	public record BaselineDto(
			String method,
			int referenceStartYear,
			int referenceEndYear,
			boolean excludesTargetYear,
			List<BaselineValueDto> values) {
	}

	@JsonInclude(JsonInclude.Include.ALWAYS)
	public record BaselineValueDto(int period, Double value, int sampleSize, String valueStatus) {
	}
}
