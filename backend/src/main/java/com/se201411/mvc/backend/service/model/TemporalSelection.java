package com.se201411.mvc.backend.service.model;

import java.time.LocalDate;

public record TemporalSelection(
		TemporalSelectionType type,
		LocalDate date,
		Integer year,
		Integer month,
		Integer pentad,
		LocalDate startDate,
		LocalDate endDate,
		Coverage coverage) {

	public TemporalSelection {
		if (type == null || startDate == null || endDate == null || coverage == null) {
			throw new IllegalArgumentException("temporal selection fields must not be null");
		}
		if (!startDate.equals(coverage.requestedStartDate()) || !endDate.equals(coverage.requestedEndDate())) {
			throw new IllegalArgumentException("temporal range must match coverage request range");
		}
	}
}
