package com.se201411.mvc.backend.domain.activity;

import java.time.LocalDate;
import java.util.List;

/**
 * Total snpp_eq of one grid cell over an inclusive date range, with its source composition.
 * For a single day the composition holds exactly one source, which carries the cell-day source code,
 * input observation count and validity needed by the exact-date map.
 *
 * @param cellId    canonical cell ID ({@code cy_cx})
 * @param startDate first day of the range (inside the dataset)
 * @param endDate   last day of the range (inside the dataset)
 * @param value     total harmonized snpp_eq of the cell, summed in double precision and not rounded
 * @param sources   composition per source code, ascending by code, only codes used at least once
 */
public record CellActivityAggregate(
		String cellId,
		LocalDate startDate,
		LocalDate endDate,
		double value,
		List<SourceComposition> sources) {

	public CellActivityAggregate {
		if (cellId == null || cellId.isBlank()) {
			throw new IllegalArgumentException("cellId must not be blank");
		}
		if (startDate == null || endDate == null) {
			throw new IllegalArgumentException("startDate and endDate must not be null");
		}
		if (endDate.isBefore(startDate)) {
			throw new IllegalArgumentException("endDate must not be before startDate");
		}
		if (!Double.isFinite(value) || value < 0) {
			throw new IllegalArgumentException("value must be finite and non-negative");
		}
		sources = sources == null ? List.of() : List.copyOf(sources);
	}
}
