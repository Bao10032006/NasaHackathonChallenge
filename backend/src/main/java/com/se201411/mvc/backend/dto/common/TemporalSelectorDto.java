package com.se201411.mvc.backend.dto.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TemporalSelectorDto(
		String type,
		LocalDate date,
		Integer year,
		Integer month,
		Integer pentad,
		LocalDate startDate,
		LocalDate endDate,
		CoverageDto coverage) {
}
