package com.se201411.mvc.backend.dto.activity;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.se201411.mvc.backend.dto.common.CoverageDto;
import com.se201411.mvc.backend.dto.common.ResponseMetaDto;
import com.se201411.mvc.backend.dto.common.SpatialSelectionDto;

import java.time.LocalDate;
import java.util.List;

public record DailyCalendarResponseDto(
		SpatialSelectionDto selection,
		int year,
		int month,
		List<ValueDto> values,
		SummaryDto summary,
		ResponseMetaDto meta) {

	@JsonInclude(JsonInclude.Include.ALWAYS)
	public record ValueDto(
			LocalDate date,
			Double value,
			String valueStatus,
			boolean partial,
			String origin,
			List<String> warnings) {
	}

	@JsonInclude(JsonInclude.Include.ALWAYS)
	public record SummaryDto(
			Double totalValue,
			String valueStatus,
			CoverageDto coverage,
			DatePeakDto peakDate) {
	}

	public record DatePeakDto(LocalDate date, double value) {
	}
}
