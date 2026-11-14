package com.se201411.mvc.backend.service.model;

import java.time.LocalDate;

public record TemporalSelectionCriteria(
		LocalDate date,
		Integer year,
		Integer month,
		Integer pentad) {
}
