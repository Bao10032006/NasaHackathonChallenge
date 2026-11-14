package com.se201411.mvc.backend.service.model;

import java.time.LocalDate;

public record Coverage(
		LocalDate requestedStartDate,
		LocalDate requestedEndDate,
		LocalDate coveredStartDate,
		LocalDate coveredEndDate,
		int expectedDayCount,
		int coveredDayCount,
		int uncoveredDayCount,
		boolean partial) {

	public Coverage {
		if (requestedStartDate == null || requestedEndDate == null || requestedEndDate.isBefore(requestedStartDate)) {
			throw new IllegalArgumentException("requested date range must be valid");
		}
		if ((coveredStartDate == null) != (coveredEndDate == null)) {
			throw new IllegalArgumentException("covered dates must both be null or non-null");
		}
		if (coveredStartDate != null
				&& (coveredEndDate.isBefore(coveredStartDate)
				|| coveredStartDate.isBefore(requestedStartDate)
				|| coveredEndDate.isAfter(requestedEndDate))) {
			throw new IllegalArgumentException("covered date range must be inside requested date range");
		}
		if (expectedDayCount < 1 || coveredDayCount < 0 || uncoveredDayCount < 0
				|| coveredDayCount + uncoveredDayCount != expectedDayCount
				|| partial != (coveredDayCount < expectedDayCount)) {
			throw new IllegalArgumentException("coverage counts are inconsistent");
		}
	}

	public boolean hasCoverage() {
		return coveredDayCount > 0;
	}
}
