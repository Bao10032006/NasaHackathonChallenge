package com.se201411.mvc.backend.dto.common;

import java.time.LocalDate;

public record CoverageDto(
		LocalDate requestedStartDate,
		LocalDate requestedEndDate,
		LocalDate coveredStartDate,
		LocalDate coveredEndDate,
		int expectedDayCount,
		int coveredDayCount,
		int uncoveredDayCount,
		boolean partial) {
}
